/* ===== INVENTORY MODULE — Sistema de Inventário (Ficha v1.7) ===== */
/* Substitui equipment.js para as abas Combate (Equipamentos) e Inventário.
   Itens ficam na coleção Firestore 'items', não no gatherData().
   Pressão = peso efetivo de itens equipados, alimenta o DV "Carga" via mechanicBonuses. */

// ===== STATE: Cache local de itens do personagem =====
window._inventoryState = {
    items: [],          // Todos os itens do personagem (instâncias Firestore)
    catalog: [],        // Cache do catálogo global (system/data/equipment)
    itemRules: [],      // Regras globais de itens (system/data/itemRules)
    loading: false,
    loaded: false
};

// ===== FIREBASE HELPERS =====
// Usam window.db exposto pelo firebase.js
function _getFirestore() { return window.db; }
function _getCurrentCharId() { return window.currentCharacterId; }
function _getCurrentUser() { return window.currentUser; }

async function _firestoreGetDocs(colPath) {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    const snap = await getDocs(collection(db, colPath));
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
}

async function _firestoreQuery(colPath, field, op, value) {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    const q = query(collection(db, colPath), where(field, op, value));
    const snap = await getDocs(q);
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
}

async function _firestoreSetDoc(colPath, docId, data, merge = true) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    await setDoc(doc(db, colPath, docId), data, { merge });
}

async function _firestoreDeleteDoc(colPath, docId) {
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    await deleteDoc(doc(db, colPath, docId));
}

// ===== LOAD CHARACTER ITEMS =====
async function loadCharacterItems(charId) {
    if (!charId) return;
    window._inventoryState.loading = true;
    try {
        const items = await _firestoreQuery('items', 'characterId', '==', charId);
        window._inventoryState.items = items;
        window._inventoryState.loaded = true;
        console.log(`✅ Inventário carregado: ${items.length} item(ns)`);
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao carregar inventário:', e);
    } finally {
        window._inventoryState.loading = false;
    }
}

// ===== LOAD CATALOG & ITEM RULES =====
async function loadInventoryCatalog() {
    try {
        // Catalog comes from system-data-loader (window._systemData.equipment)
        if (window._systemData?.equipment) {
            window._inventoryState.catalog = window._systemData.equipment.filter(e => e.publicado !== false);
        }
        // Item Rules
        if (window._systemData?.itemRules) {
            window._inventoryState.itemRules = window._systemData.itemRules.filter(r => r.publicado !== false && r.ativo !== false);
        }
        console.log(`✅ Catálogo: ${window._inventoryState.catalog.length} template(s), ${window._inventoryState.itemRules.length} regra(s)`);
    } catch (e) {
        console.error('❌ Erro ao carregar catálogo:', e);
    }
}

// ===== PRESSURE CALCULATION =====
/**
 * Calcula a Pressão total de todos os itens equipados.
 * Pressão = peso efetivo. Para containers, inclui peso dos itens internos × multiplicador.
 */
function calculateTotalPressure() {
    const items = window._inventoryState.items;
    const equipped = items.filter(i => i.equipado === true && !i.parentItemId);
    let total = 0;

    for (const item of equipped) {
        const pressao = item.pressaoOverride != null ? item.pressaoOverride
            : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));

        if (item.ehContainer) {
            const insideItems = items.filter(i => i.parentItemId === item.id);
            const insideWeight = insideItems.reduce((sum, i) => sum + (i.peso || 0), 0);
            const mult = item.multiplicadorPressao || 1;
            total += pressao + (insideWeight * mult);
        } else {
            total += pressao;
        }
    }
    return total;
}

/**
 * Recalcula a Pressão e injeta no mechanicBonuses para que o DV "Carga" capture.
 */
function recalcInventoryPressure() {
    const totalPressure = calculateTotalPressure();

    // Encontrar a key do DV "Carga" no TARGET_MAP
    // Carga é um DV do Firebase, registrado via populateTargetMapFromDerivedValues
    // Seu key seria algo como DERIVED:CARGA
    const cargaKey = _findDerivedKey('Carga');
    if (cargaKey) {
        // Limpar contribuição anterior do inventário
        const prevKey = '_INV_PRESSURE_' + cargaKey;
        const prevVal = state._invPressureContrib || 0;
        state.mechanicBonuses[cargaKey] = (state.mechanicBonuses[cargaKey] || 0) - prevVal + totalPressure;
        state._invPressureContrib = totalPressure;
    }

    // Atualizar indicador visual de pressão
    _updatePressureDisplay(totalPressure);

    // Recalcular DVs e testes
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
}

function _findDerivedKey(nome) {
    if (!window.DERIVED_VALUES) return null;
    const dv = window.DERIVED_VALUES.find(d => d.nome === nome);
    if (dv) return `DERIVED:${dv.key}`;
    // Fallback: buscar no TARGET_MAP
    if (typeof TARGET_MAP !== 'undefined' && TARGET_MAP[nome]) return TARGET_MAP[nome];
    return null;
}

function _updatePressureDisplay(totalPressure) {
    const el = document.getElementById('invPressureDisplay');
    if (el) {
        el.textContent = `⚖️ Pressão: ${parseFloat(totalPressure).toFixed(2)}`;
    }
}

// ===== APPLY EQUIPPED ITEM MECHANICS =====
/**
 * Aplica mecânicas dos itens equipados ao personagem.
 * Chamada em applyAllRaceMechanics() após outras mecânicas.
 */
function applyEquippedItemsMechanics() {
    const items = window._inventoryState.items;
    const equipped = items.filter(i => i.equipado === true && !i.parentItemId);
    if (equipped.length === 0) return;

    const mechanicsById = {};
    if (window._systemData?.mechanics) {
        for (const m of window._systemData.mechanics) {
            mechanicsById[m.id] = m;
        }
    }

    for (const item of equipped) {
        // 1) Mecânicas herdadas do modelo (catálogo)
        if (item.modeloId) {
            const template = window._inventoryState.catalog.find(t => t.id === item.modeloId);
            if (template?.mecanicaIds) {
                for (const mechId of template.mecanicaIds) {
                    const mech = mechanicsById[mechId];
                    if (mech) applyMechanicToSheet(mech, null);
                }
            }
        }

        // 2) Mecânicas próprias da instância
        if (item.mecanicaIdsProprias) {
            for (const mechId of item.mecanicaIdsProprias) {
                const mech = mechanicsById[mechId];
                if (mech) applyMechanicToSheet(mech, null);
            }
        }
    }

    // 3) Regras globais de item
    const rules = window._inventoryState.itemRules || [];
    for (const rule of rules) {
        if (rule.mecanicaIds) {
            for (const mechId of rule.mecanicaIds) {
                const mech = mechanicsById[mechId];
                if (mech) applyMechanicToSheet(mech, null);
            }
        }
    }
}

// ===== RENDER: ABA COMBATE — EQUIPAMENTOS =====
function renderEquippedItems() {
    const container = document.getElementById('equippedItemsGrid');
    if (!container) return;

    const items = window._inventoryState.items;
    const equipped = items.filter(i => i.equipado === true && !i.parentItemId);

    if (equipped.length === 0) {
        container.innerHTML = `<div class="inv-empty">
            <span class="inv-empty-icon">⚔️</span>
            <span>Nenhum item equipado</span>
            <small class="inv-empty-hint">Equipe itens na aba Inventário</small>
        </div>`;
        return;
    }

    container.innerHTML = equipped.map(item => _renderEquipCard(item)).join('');
}

function _renderEquipCard(item) {
    const pressao = _getItemPressure(item);
    const tipo = item.tipo || 'Objeto';
    const tipoEmoji = { 'Arma': '⚔️', 'Vestimenta': '🧥', 'Projétil': '🎯', 'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨' }[tipo] || '📦';
    const img = item.imagem || item.imagemUrl;
    const imgHtml = img
        ? `<img src="${_escHtml(img)}" class="inv-card-img" alt="${_escHtml(item.nome)}">`
        : `<div class="inv-card-img inv-card-img-placeholder">${tipoEmoji}</div>`;

    // Container info
    let containerBadge = '';
    if (item.ehContainer) {
        const inside = window._inventoryState.items.filter(i => i.parentItemId === item.id);
        containerBadge = `<span class="inv-badge inv-badge-container">📦 ${inside.length} item(ns)</span>`;
    }

    // Mecânicas preview
    const mechPreview = _getMechPreview(item);

    return `<div class="inv-card" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-card-body">
            <div class="inv-card-top">
                <span class="inv-card-name">${_escHtml(item.nome || 'Sem nome')}</span>
                <span class="inv-badge inv-badge-type">${tipoEmoji} ${_escHtml(tipo)}</span>
                <span class="inv-badge inv-badge-pressure">⚖️ ${parseFloat(pressao).toFixed(2)}</span>
                ${containerBadge}
            </div>
            ${mechPreview ? `<div class="inv-card-mechs">${mechPreview}</div>` : ''}
        </div>
        <button class="inv-btn-detail no-print" onclick="event.stopPropagation();openItemDetail('${item.id}')" title="Detalhes">ℹ️</button>
    </div>`;
}

function _getItemPressure(item) {
    if (item.pressaoOverride != null) return item.pressaoOverride;
    const base = item.pressaoBase != null ? item.pressaoBase : (item.peso || 0);
    if (item.ehContainer) {
        const inside = window._inventoryState.items.filter(i => i.parentItemId === item.id);
        const insideWeight = inside.reduce((sum, i) => sum + (i.peso || 0), 0);
        return base + (insideWeight * (item.multiplicadorPressao || 1));
    }
    return base;
}

function _getMechPreview(item) {
    const mechIds = [];
    if (item.modeloId) {
        const tpl = window._inventoryState.catalog.find(t => t.id === item.modeloId);
        if (tpl?.mecanicaIds) mechIds.push(...tpl.mecanicaIds);
    }
    if (item.mecanicaIdsProprias) mechIds.push(...item.mecanicaIdsProprias);
    if (mechIds.length === 0) return '';

    const previews = [];
    for (const mid of mechIds) {
        const m = window._systemData?.mechanics?.find(x => x.id === mid);
        if (m && typeof generatePreviewText === 'function') {
            previews.push(generatePreviewText(m));
        }
    }
    return previews.map(p => `<span class="inv-mech-tag">${_escHtml(p)}</span>`).join('');
}

// ===== RENDER: ABA INVENTÁRIO =====
function renderInventoryTab() {
    const container = document.getElementById('inventoryItemsGrid');
    if (!container) return;

    const items = window._inventoryState.items;
    // Itens de primeiro nível: sem parentItemId
    const topLevel = items.filter(i => !i.parentItemId);
    const equipped = topLevel.filter(i => i.equipado);
    const loose = topLevel.filter(i => !i.equipado);

    let html = '';

    // Seção: Equipados
    html += `<div class="inv-section">
        <div class="inv-section-title">🎒 Equipados <span class="inv-section-count">${equipped.length}</span></div>
        <div class="inv-section-grid">`;
    if (equipped.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item equipado</div>';
    } else {
        html += equipped.map(i => _renderInvItemRow(i, true)).join('');
    }
    html += '</div></div>';

    // Seção: Inventário Solto
    html += `<div class="inv-section">
        <div class="inv-section-title">📋 Itens Soltos <span class="inv-section-count">${loose.length}</span></div>
        <div class="inv-section-grid">`;
    if (loose.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item solto</div>';
    } else {
        html += loose.map(i => _renderInvItemRow(i, false)).join('');
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Render container viewers
    _renderOpenContainers();
}

function _renderInvItemRow(item, isEquipped) {
    const tipoEmoji = { 'Arma': '⚔️', 'Vestimenta': '🧥', 'Projétil': '🎯', 'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨' }[item.tipo] || '📦';
    const img = item.imagem || item.imagemUrl;
    const imgHtml = img
        ? `<img src="${_escHtml(img)}" class="inv-row-img" alt="">`
        : `<div class="inv-row-img inv-row-img-ph">${tipoEmoji}</div>`;

    const equipBtn = isEquipped
        ? `<button class="inv-btn inv-btn-unequip" onclick="event.stopPropagation();toggleEquip('${item.id}',false)" title="Desequipar">⬇️</button>`
        : `<button class="inv-btn inv-btn-equip" onclick="event.stopPropagation();toggleEquip('${item.id}',true)" title="Equipar">⬆️</button>`;

    let containerBtn = '';
    if (item.ehContainer) {
        const isOpen = window._openContainerId === item.id;
        containerBtn = `<button class="inv-btn ${isOpen ? 'inv-btn-open' : 'inv-btn-closed'}" onclick="event.stopPropagation();toggleContainer('${item.id}')" title="${isOpen ? 'Fechar' : 'Abrir'} container">${isOpen ? '📂' : '📁'}</button>`;
    }

    const pressao = isEquipped ? `<span class="inv-badge inv-badge-pressure-sm">⚖️ ${parseFloat(_getItemPressure(item)).toFixed(2)}</span>` : '';

    return `<div class="inv-item-row ${isEquipped ? 'inv-equipped' : ''}" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-item-info">
            <span class="inv-item-name">${_escHtml(item.nome || 'Sem nome')}</span>
            <span class="inv-item-meta">${tipoEmoji} ${_escHtml(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)} | Tam: ${item.tamanho || 0}</span>
        </div>
        ${pressao}
        <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
            ${containerBtn}
            ${equipBtn}
            <button class="inv-btn inv-btn-delete" onclick="event.stopPropagation();deleteInventoryItem('${item.id}')" title="Excluir">🗑️</button>
        </div>
    </div>`;
}

// ===== CONTAINER VIEWER =====
window._openContainerId = null;

window.toggleContainer = function(itemId) {
    if (window._openContainerId === itemId) {
        window._openContainerId = null;
    } else {
        window._openContainerId = itemId;
    }
    renderInventoryTab();
};

function _renderOpenContainers() {
    const viewer = document.getElementById('containerViewer');
    if (!viewer) return;
    const cid = window._openContainerId;
    if (!cid) { viewer.innerHTML = ''; return; }

    const contItem = window._inventoryState.items.find(i => i.id === cid);
    if (!contItem) { viewer.innerHTML = ''; return; }

    const inside = window._inventoryState.items.filter(i => i.parentItemId === cid);
    const cap = contItem.capacidadeContainer || 10;

    let itemsHtml;
    if (inside.length === 0) {
        itemsHtml = '<div class="inv-empty-small"><span>📭</span> Container vazio</div>';
    } else {
        itemsHtml = inside.map(i => {
            const tipoEmoji = { 'Arma': '⚔️', 'Vestimenta': '🧥', 'Projétil': '🎯', 'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨' }[i.tipo] || '📦';
            return `<div class="inv-container-item">
                <span class="inv-item-name">${_escHtml(i.nome || 'Sem nome')}</span>
                <span class="inv-item-meta">${tipoEmoji} | Peso: ${parseFloat(i.peso || 0).toFixed(2)}</span>
                <div class="inv-item-actions no-print">
                    <button class="inv-btn inv-btn-remove" onclick="removeFromContainer('${i.id}')" title="Remover do container">📤</button>
                    <button class="inv-btn inv-btn-delete" onclick="deleteInventoryItem('${i.id}')" title="Excluir">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    viewer.innerHTML = `<div class="inv-container-viewer">
        <div class="inv-container-header">
            <span class="inv-container-title">📂 ${_escHtml(contItem.nome || 'Container')}</span>
            <span class="inv-container-cap">Itens: ${inside.length} / ${cap}</span>
            <button class="inv-btn inv-btn-close" onclick="toggleContainer('${cid}')">✕</button>
        </div>
        <div class="inv-container-items">${itemsHtml}</div>
        <button class="inv-btn inv-btn-add-to-container" onclick="addItemToContainer('${cid}')">➕ Adicionar Item</button>
    </div>`;
}

// ===== ACTIONS =====
window.toggleEquip = async function(itemId, equip) {
    try {
        await _firestoreSetDoc('items', itemId, { equipado: equip, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) item.equipado = equip;
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        // Re-apply all mechanics since equipped items changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao equipar/desequipar:', e);
    }
};

window.deleteInventoryItem = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;
    if (!confirm(`Excluir "${item.nome || 'item'}"?`)) return;
    try {
        // Also remove items inside if it's a container
        if (item.ehContainer) {
            const inside = window._inventoryState.items.filter(i => i.parentItemId === itemId);
            for (const child of inside) {
                await _firestoreDeleteDoc('items', child.id);
            }
        }
        await _firestoreDeleteDoc('items', itemId);
        window._inventoryState.items = window._inventoryState.items.filter(i => i.id !== itemId && i.parentItemId !== itemId);
        if (window._openContainerId === itemId) window._openContainerId = null;
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao excluir item:', e);
    }
};

window.removeFromContainer = async function(itemId) {
    try {
        await _firestoreSetDoc('items', itemId, { parentItemId: null, equipado: false, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) { item.parentItemId = null; item.equipado = false; }
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao remover do container:', e);
    }
};

window.addItemToContainer = function(containerId) {
    openItemFormModal('Criar Item no Container', null, containerId);
};

// ===== ITEM DETAIL MODAL =====
window.openItemDetail = function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    let existing = document.getElementById('invDetailModal');
    if (existing) existing.remove();

    const pressao = _getItemPressure(item);
    const tipoEmoji = { 'Arma': '⚔️', 'Vestimenta': '🧥', 'Projétil': '🎯', 'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨' }[item.tipo] || '📦';
    const img = item.imagem || item.imagemUrl;
    const mechPreview = _getMechPreview(item);

    const modal = document.createElement('div');
    modal.className = 'inv-modal';
    modal.id = 'invDetailModal';
    modal.innerHTML = `<div class="inv-modal-content">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${tipoEmoji} ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeItemDetail()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${img ? `<img src="${_escHtml(img)}" class="inv-detail-img" alt="">` : ''}
            <div class="inv-detail-grid">
                <div class="inv-detail-field"><span class="inv-detail-label">Tipo</span><span>${tipoEmoji} ${_escHtml(item.tipo || '-')}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Peso</span><span>${parseFloat(item.peso || 0).toFixed(2)}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Tamanho</span><span>${item.tamanho || 0}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Pressão</span><span>⚖️ ${parseFloat(pressao).toFixed(2)}</span></div>
                ${item.ehContainer ? `<div class="inv-detail-field"><span class="inv-detail-label">Multiplicador</span><span>×${item.multiplicadorPressao || 1}</span></div>` : ''}
            </div>
            ${item.descricao ? `<div class="inv-detail-desc">${_escHtml(item.descricao)}</div>` : ''}
            ${mechPreview ? `<div class="inv-detail-mechs"><span class="inv-detail-label">Efeitos</span>${mechPreview}</div>` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-action" onclick="closeItemDetail()">${item.equipado ? '⬇️ Desequipar' : '⬆️ Equipar'}</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
};

window.closeItemDetail = function() {
    const m = document.getElementById('invDetailModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

// ===== ITEM FORM MODAL (Create/Edit) =====
window.openItemFormModal = function(title, item, containerId) {
    let existing = document.getElementById('invFormModal');
    if (existing) existing.remove();

    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invFormModal';

    // Se temos catálogo, mostrar picker
    const catalog = window._inventoryState.catalog || [];
    let catalogHtml = '';
    if (!isEdit && catalog.length > 0) {
        catalogHtml = `<div class="inv-form-section">
            <label class="inv-form-label">📚 Criar a partir do catálogo</label>
            <select id="invCatalogPicker" class="inv-form-select" onchange="fillFromCatalog(this.value)">
                <option value="">— Item personalizado —</option>
                ${catalog.map(t => `<option value="${t.id}">${_escHtml(t.nome)} (${t.tipo || '-'})</option>`).join('')}
            </select>
        </div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${title || (isEdit ? 'Editar Item' : 'Criar Item')}</span>
            <button class="inv-modal-close" onclick="closeItemFormModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${catalogHtml}
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="invFormName" class="inv-form-input" value="${_escHtml(item?.nome || '')}" placeholder="Nome do item">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tipo</label>
                    <select id="invFormTipo" class="inv-form-select">
                        <option value="Objeto" ${item?.tipo === 'Objeto' ? 'selected' : ''}>📦 Objeto</option>
                        <option value="Arma" ${item?.tipo === 'Arma' ? 'selected' : ''}>⚔️ Arma</option>
                        <option value="Vestimenta" ${item?.tipo === 'Vestimenta' ? 'selected' : ''}>🧥 Vestimenta</option>
                        <option value="Projétil" ${item?.tipo === 'Projétil' ? 'selected' : ''}>🎯 Projétil</option>
                        <option value="Container" ${item?.tipo === 'Container' ? 'selected' : ''}>📦 Container</option>
                        <option value="Consumível" ${item?.tipo === 'Consumível' ? 'selected' : ''}>🧪 Consumível</option>
                        <option value="Relíquia" ${item?.tipo === 'Relíquia' ? 'selected' : ''}>✨ Relíquia</option>
                    </select>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Peso</label>
                    <input type="number" id="invFormPeso" class="inv-form-input" value="${item?.peso || 1}" min="0" step="0.1">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tamanho</label>
                    <input type="number" id="invFormTamanho" class="inv-form-input" value="${item?.tamanho || 1}" min="0">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="invFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição do item">${_escHtml(item?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Imagem (URL)</label>
                    <input type="text" id="invFormImagem" class="inv-form-input" value="${_escHtml(item?.imagem || item?.imagemUrl || '')}" placeholder="https://...">
                </div>
            </div>
            <input type="hidden" id="invFormModeloId" value="${item?.modeloId || ''}">
            <input type="hidden" id="invFormContainerId" value="${containerId || ''}">
            ${isEdit ? `<input type="hidden" id="invFormEditId" value="${item.id}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="closeItemFormModal()">Cancelar</button>
            <button class="inv-btn-save" onclick="saveInventoryItemForm()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.closeItemFormModal = function() {
    document.getElementById('invFormModal')?.remove();
};

window.fillFromCatalog = function(templateId) {
    if (!templateId) return;
    const tpl = window._inventoryState.catalog.find(t => t.id === templateId);
    if (!tpl) return;

    document.getElementById('invFormName').value = tpl.nome || '';
    document.getElementById('invFormTipo').value = tpl.tipo || 'Objeto';
    document.getElementById('invFormPeso').value = tpl.peso || 1;
    document.getElementById('invFormTamanho').value = tpl.tamanho || 1;
    document.getElementById('invFormDesc').value = tpl.descricao || '';
    document.getElementById('invFormImagem').value = tpl.imagemUrl || '';
    document.getElementById('invFormModeloId').value = tpl.id;
};

window.saveInventoryItemForm = async function() {
    const nome = document.getElementById('invFormName')?.value?.trim();
    if (!nome) { alert('Nome obrigatório'); return; }

    const charId = _getCurrentCharId();
    const user = _getCurrentUser();
    if (!charId || !user) { alert('Erro: personagem não carregado'); return; }

    const containerId = document.getElementById('invFormContainerId')?.value || '';
    const editId = document.getElementById('invFormEditId')?.value || '';

    const itemData = {
        nome,
        tipo: document.getElementById('invFormTipo')?.value || 'Objeto',
        peso: parseFloat(document.getElementById('invFormPeso')?.value) || 1,
        tamanho: parseInt(document.getElementById('invFormTamanho')?.value) || 1,
        descricao: document.getElementById('invFormDesc')?.value?.trim() || '',
        imagem: document.getElementById('invFormImagem')?.value?.trim() || '',
        modeloId: document.getElementById('invFormModeloId')?.value || null,
        characterId: charId,
        ownerUid: user.uid,
        equipado: !containerId,
        parentItemId: containerId || null,
        criadoPor: window.isCreator ? 'criador' : (window.isMestre ? 'mestre' : 'jogador'),
        lastModified: new Date().toISOString()
    };

    // Herdar campos do template se modeloId existe
    if (itemData.modeloId) {
        const tpl = window._inventoryState.catalog.find(t => t.id === itemData.modeloId);
        if (tpl) {
            itemData.pressaoBase = itemData.peso;
            itemData.ehContainer = tpl.ehContainer || false;
            itemData.multiplicadorPressao = tpl.multiplicadorPressao || 1;
            itemData.capacidadeContainer = tpl.capacidadeContainer || 10;
        }
    }

    try {
        if (editId) {
            await _firestoreSetDoc('items', editId, itemData);
            const idx = window._inventoryState.items.findIndex(i => i.id === editId);
            if (idx >= 0) window._inventoryState.items[idx] = { ...window._inventoryState.items[idx], ...itemData };
        } else {
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await _firestoreSetDoc('items', newId, itemData);
            window._inventoryState.items.push({ id: newId, ...itemData });
        }
        closeItemFormModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao salvar item:', e);
        alert('Erro ao salvar item: ' + e.message);
    }
};

// ===== LEGACY COMPAT: Keep old functions to not break existing calls =====
// Note: wC, aC, pC, cC, iC are already declared in app.js (same global scope)
function addWeapon() {} // No-op: replaced by inventory system
function addArmor() {}
function addProjectile() {}
function addCondition() {
    // Conditions still work the old way
    const c = document.getElementById('conditionsContainer'), i = cC++;
    if (!c) return;
    const r = document.createElement('div'); r.className = 'equip-row conditions';
    r.innerHTML = `<input type="text" data-key="cond_name_${i}" placeholder="Condição"><input type="text" data-key="cond_tipo_${i}" placeholder="Tipo"><input type="text" data-key="cond_desc_${i}" placeholder="Descrição"><input type="text" data-key="cond_tempo_${i}" placeholder="0/0"><button class="rm-btn no-print" onclick="this.parentElement.remove();scheduleAutosave()">✕</button>`;
    c.appendChild(r);
    r.querySelectorAll('input').forEach(x => x.addEventListener('input', scheduleAutosave));
}
function addInventoryItem() {} // No-op: replaced by inventory system

// ===== UTILITY =====
function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== EXPOSE GLOBALLY =====
window.loadCharacterItems = loadCharacterItems;
window.loadInventoryCatalog = loadInventoryCatalog;
window.applyEquippedItemsMechanics = applyEquippedItemsMechanics;
window.recalcInventoryPressure = recalcInventoryPressure;
window.renderEquippedItems = renderEquippedItems;
window.renderInventoryTab = renderInventoryTab;
window.openItemFormModal = openItemFormModal;
