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
        // Re-aplicar TODAS as mecânicas para que Regras de Item (itemRules)
        // tenham acesso aos itens carregados e apliquem corretamente
        // (ex: somar Pressão Total no valor atual de um DV).
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
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
 * Pressão = peso efetivo × quantidade. Para containers, inclui peso dos itens internos × multiplicador.
 */
function calculateTotalPressure() {
    const items = window._inventoryState.items;
    const equipped = items.filter(i => i.equipado === true && !i.parentItemId);
    let total = 0;

    for (const item of equipped) {
        const qty = Math.max(1, parseInt(item.quantidade) || 1);
        const basePressao = item.pressaoOverride != null ? item.pressaoOverride
            : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));

        if (item.ehContainer) {
            const insideItems = items.filter(i => i.parentItemId === item.id);
            const insideWeight = insideItems.reduce((sum, i) => {
                const iQty = Math.max(1, parseInt(i.quantidade) || 1);
                return sum + ((i.peso || 0) * iQty);
            }, 0);
            const mult = item.multiplicadorPressao || 1;
            total += (basePressao * qty) + (insideWeight * mult);
        } else {
            total += basePressao * qty;
        }
    }
    return total;
}

/**
 * Recalcula a Pressão e dispara recalcAll para que mecânicas de Regra de Item
 * atualizem o DV "Carga (Atual)" via _resolveSheetRef('Pressão Total (Equipados)').
 * NÃO injeta pressão diretamente em DERIVED:CARGA (o máximo),
 * pois o máximo é calculado por sua própria mecânica no Firebase.
 */
function recalcInventoryPressure() {
    const totalPressure = calculateTotalPressure();

    // Atualizar indicador visual de pressão
    _updatePressureDisplay(totalPressure);

    // Recalcular DVs e testes — as mecânicas de Regra de Item capturam
    // a pressão via _resolveSheetRef('Pressão Total (Equipados)')
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

    const mechanicsById = {};
    if (window._systemData?.mechanics) {
        for (const m of window._systemData.mechanics) {
            mechanicsById[m.id] = m;
        }
    }

    // 1) Mecânicas de itens equipados (modelo + próprias)
    for (const item of equipped) {
        // 1a) Mecânicas herdadas do modelo (catálogo)
        if (item.modeloId) {
            const template = window._inventoryState.catalog.find(t => t.id === item.modeloId);
            if (template?.mecanicaIds) {
                for (const mechId of template.mecanicaIds) {
                    const mech = mechanicsById[mechId];
                    if (mech) applyMechanicToSheet(mech, null);
                }
            }
        }

        // 1b) Mecânicas próprias da instância
        if (item.mecanicaIdsProprias) {
            for (const mechId of item.mecanicaIdsProprias) {
                const mech = mechanicsById[mechId];
                if (mech) applyMechanicToSheet(mech, null);
            }
        }
    }

    // 2) Regras globais de item (aplicam independente de ter itens equipados)
    const rules = window._inventoryState.itemRules || [];
    console.log(`🔧 [ItemRules] ${rules.length} regra(s) de item carregadas, ${equipped.length} item(ns) equipado(s)`);
    for (const rule of rules) {
        console.log(`🔧 [ItemRule] "${rule.nome}": mecanicaIds =`, rule.mecanicaIds);
        if (rule.mecanicaIds) {
            for (const mechId of rule.mecanicaIds) {
                const mech = mechanicsById[mechId];
                if (!mech) {
                    console.warn(`⚠️ [ItemRule] Mecânica "${mechId}" NÃO encontrada no cache de ${Object.keys(mechanicsById).length} mecânicas`);
                    continue;
                }
                console.log(`🔧 [ItemRule] Aplicando mecânica "${mech.nome}" (tipo=${mech.tipo}, duracao=${mech.duracao})`);
                if (mech.config?.calculos) {
                    for (const calc of mech.config.calculos) {
                        const targetKey = typeof TARGET_MAP !== 'undefined' ? TARGET_MAP[calc.alvo] : 'TARGET_MAP_UNDEFINED';
                        console.log(`🔧 [ItemRule]   calc: alvo="${calc.alvo}" → targetKey="${targetKey}", op="${calc.operacao}"`);
                        if (Array.isArray(calc.equacao)) {
                            for (const term of calc.equacao) {
                                if (term.tipo === 'ficha') {
                                    const resolved = typeof _resolveSheetRef === 'function' ? _resolveSheetRef(term.ref, 1) : 'FUNC_NOT_FOUND';
                                    console.log(`🔧 [ItemRule]   term: tipo=ficha, ref="${term.ref}" → resolved=${resolved}`);
                                } else {
                                    console.log(`🔧 [ItemRule]   term: tipo=${term.tipo}, valor=${term.valor}`);
                                }
                            }
                        }
                    }
                }
                applyMechanicToSheet(mech, null);
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
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
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

    // Quantity badge
    const qtyBadge = qty > 1 ? `<span class="inv-badge inv-badge-qty">×${qty}</span>` : '';

    // Mecânicas preview
    const mechPreview = _getMechPreview(item);

    return `<div class="inv-card" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-card-body">
            <div class="inv-card-top">
                <span class="inv-card-name">${_escHtml(item.nome || 'Sem nome')}</span>
                <span class="inv-badge inv-badge-type">${tipoEmoji} ${_escHtml(tipo)}</span>
                <span class="inv-badge inv-badge-pressure">⚖️ ${parseFloat(pressao).toFixed(2)}</span>
                ${qtyBadge}
                ${containerBadge}
            </div>
            ${mechPreview ? `<div class="inv-card-mechs">${mechPreview}</div>` : ''}
        </div>
        <button class="inv-btn-detail no-print" onclick="event.stopPropagation();openItemDetail('${item.id}')" title="Detalhes">ℹ️</button>
    </div>`;
}

function _getItemPressure(item) {
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    if (item.pressaoOverride != null) return item.pressaoOverride * qty;
    const base = item.pressaoBase != null ? item.pressaoBase : (item.peso || 0);
    if (item.ehContainer) {
        const inside = window._inventoryState.items.filter(i => i.parentItemId === item.id);
        const insideWeight = inside.reduce((sum, i) => {
            const iQty = Math.max(1, parseInt(i.quantidade) || 1);
            return sum + ((i.peso || 0) * iQty);
        }, 0);
        return (base * qty) + (insideWeight * (item.multiplicadorPressao || 1));
    }
    return base * qty;
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

    // Move to Container button — only when a container is open and this item isn't the open container itself
    let moveToContainerBtn = '';
    if (window._openContainerId && window._openContainerId !== item.id) {
        moveToContainerBtn = `<button class="inv-btn inv-btn-move-container" onclick="event.stopPropagation();moveToContainer('${item.id}')" title="Mover para container aberto">📦➡️</button>`;
    }

    // Quantity — editable if loose, or if equipped AND type is Projétil/Consumível
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    const canEditQty = !isEquipped || item.tipo === 'Projétil' || item.tipo === 'Consumível';
    const qtyHtml = canEditQty
        ? `<input type="number" class="inv-qty-input" value="${qty}" min="1" onclick="event.stopPropagation()" onchange="updateItemQuantity('${item.id}', this.value)" title="Quantidade">`
        : `<span class="inv-badge inv-badge-qty" title="Quantidade">×${qty}</span>`;

    const pressao = isEquipped ? `<span class="inv-badge inv-badge-pressure-sm">⚖️ ${parseFloat(_getItemPressure(item)).toFixed(2)}</span>` : '';

    return `<div class="inv-item-row ${isEquipped ? 'inv-equipped' : ''}" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-item-info">
            <span class="inv-item-name">${_escHtml(item.nome || 'Sem nome')}</span>
            <span class="inv-item-meta">${tipoEmoji} ${_escHtml(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)} | Tam: ${item.tamanho || 0}</span>
        </div>
        ${qtyHtml}
        ${pressao}
        <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
            ${moveToContainerBtn}
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
    const pesoMax = contItem.pesoMaximoContainer || null;
    const insideWeight = inside.reduce((sum, i) => {
        const iQty = Math.max(1, parseInt(i.quantidade) || 1);
        return sum + ((i.peso || 0) * iQty);
    }, 0);
    const mult = contItem.multiplicadorPressao || 1;
    const pesoBase = contItem.pressaoBase != null ? contItem.pressaoBase : (contItem.peso || 0);
    const pressaoContainer = pesoBase + (insideWeight * mult);
    const overWeight = pesoMax != null && insideWeight > pesoMax;

    let itemsHtml;
    if (inside.length === 0) {
        itemsHtml = '<div class="inv-empty-small"><span>📭</span> Container vazio</div>';
    } else {
        itemsHtml = inside.map(i => {
            const tipoEmoji = { 'Arma': '⚔️', 'Vestimenta': '🧥', 'Projétil': '🎯', 'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨' }[i.tipo] || '📦';
            const iQty = Math.max(1, parseInt(i.quantidade) || 1);
            const iWeightTotal = ((i.peso || 0) * iQty).toFixed(2);
            const iImg = i.imagem || i.imagemUrl;
            const iImgHtml = iImg
                ? `<img src="${_escHtml(iImg)}" class="inv-row-img" alt="">`
                : `<div class="inv-row-img inv-row-img-ph">${tipoEmoji}</div>`;

            // Quantity input — disable for Container type items (same rule as loose items)
            const canEditQty = i.tipo !== 'Container';
            const qtyHtml = canEditQty
                ? `<input type="number" class="inv-qty-input" value="${iQty}" min="1" onclick="event.stopPropagation()" onchange="updateItemQuantity('${i.id}', this.value)" title="Quantidade">`
                : `<span class="inv-badge inv-badge-qty" title="Quantidade">×${iQty}</span>`;

            return `<div class="inv-container-item inv-item-row" onclick="openItemDetail('${i.id}')">
                ${iImgHtml}
                <div class="inv-item-info">
                    <span class="inv-item-name">${_escHtml(i.nome || 'Sem nome')}</span>
                    <span class="inv-item-meta">${tipoEmoji} ${_escHtml(i.tipo || '')} | Peso: ${iWeightTotal}${iQty > 1 ? ` (${parseFloat(i.peso || 0).toFixed(2)} × ${iQty})` : ''} | Tam: ${i.tamanho || 0}</span>
                </div>
                ${qtyHtml}
                <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
                    <button class="inv-btn inv-btn-remove" onclick="event.stopPropagation();removeFromContainer('${i.id}')" title="Remover do container">📤</button>
                    <button class="inv-btn inv-btn-delete" onclick="event.stopPropagation();deleteInventoryItem('${i.id}')" title="Excluir">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    const weightDisplay = pesoMax != null
        ? `⚖️ Peso: ${insideWeight.toFixed(2)} / ${parseFloat(pesoMax).toFixed(2)}${overWeight ? ' ⚠️' : ''}`
        : `⚖️ Peso: ${insideWeight.toFixed(2)}`;

    viewer.innerHTML = `<div class="inv-container-viewer">
        <div class="inv-container-header">
            <span class="inv-container-title">📂 ${_escHtml(contItem.nome || 'Container')}</span>
            <span class="inv-container-cap">Itens: ${inside.length} / ${cap}</span>
            <button class="inv-btn inv-btn-close" onclick="toggleContainer('${cid}')">✕</button>
        </div>
        <div class="inv-container-stats">
            <span class="${overWeight ? 'inv-stat-over' : 'inv-stat-ok'}">${weightDisplay}</span>
            <span class="inv-stat-pressure">📐 Pressão: ${pressaoContainer.toFixed(2)} (${pesoBase.toFixed(2)} + ${insideWeight.toFixed(2)} × ${mult})</span>
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

window.moveToContainer = async function(itemId) {
    const containerId = window._openContainerId;
    if (!containerId || containerId === itemId) return;
    const contItem = window._inventoryState.items.find(i => i.id === containerId);
    if (!contItem) return;
    try {
        await _firestoreSetDoc('items', itemId, { parentItemId: containerId, equipado: false, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) { item.parentItemId = containerId; item.equipado = false; }
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        // Re-apply mechanics since equipped items may have changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao mover para container:', e);
    }
};

window.updateItemQuantity = async function(itemId, newQty) {
    const qty = Math.max(1, parseInt(newQty) || 1);
    try {
        await _firestoreSetDoc('items', itemId, { quantidade: qty, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) item.quantidade = qty;
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        // Re-apply mechanics since pressure changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao atualizar quantidade:', e);
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
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
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
                <div class="inv-detail-field"><span class="inv-detail-label">Peso (un.)</span><span>${parseFloat(item.peso || 0).toFixed(2)}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Quantidade</span><span>×${qty}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Tamanho</span><span>${item.tamanho || 0}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Pressão</span><span>⚖️ ${parseFloat(pressao).toFixed(2)}</span></div>
                ${item.ehContainer ? `<div class="inv-detail-field"><span class="inv-detail-label">Peso Máximo</span><span>⚖️ ${item.pesoMaximoContainer || '∞'}</span></div>` : ''}
                ${item.ehContainer ? `<div class="inv-detail-field"><span class="inv-detail-label">Multiplicador</span><span>×${item.multiplicadorPressao || 1}</span></div>` : ''}
            </div>
            ${item.descricao ? `<div class="inv-detail-desc">${_escHtml(item.descricao)}</div>` : ''}
            ${mechPreview ? `<div class="inv-detail-mechs"><span class="inv-detail-label">Efeitos</span>${mechPreview}</div>` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-action" onclick="toggleEquip('${item.id}',${!item.equipado});closeItemDetail()">${item.equipado ? '⬇️ Desequipar' : '⬆️ Equipar'}</button>
            <button class="inv-btn-transfer" onclick="openTransferModal('${item.id}')">🔄 Transferir</button>
            <button class="inv-btn-action" onclick="closeItemDetail();openItemFormModal('Editar Item', window._inventoryState.items.find(i=>i.id==='${item.id}'))" style="margin-left:auto">✏️ Editar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
};

window.closeItemDetail = function() {
    const m = document.getElementById('invDetailModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

// ===== TRANSFER MODAL =====
window.openTransferModal = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    // Close detail modal if open
    closeItemDetail();

    // Show loading modal
    let existing = document.getElementById('invTransferModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invTransferModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:500px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">🔄 Transferir: ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeTransferModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div style="text-align:center;padding:30px;color:var(--muted)">⏳ Carregando alvos...</div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    try {
        const { doc, getDoc, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = _getFirestore();
        const charId = _getCurrentCharId();

        // Get current character data to check mesaId
        const charSnap = await getDoc(doc(db, 'char', charId));
        const charData = charSnap.exists() ? charSnap.data() : {};
        const mesaId = charData.mesaId || null;

        let targets = [];

        if (mesaId) {
            // Character is in a mesa — show mesa characters + Caixa do Mestre
            // Add Caixa do Mestre as first option
            targets.push({
                id: '__caixa_mestre__' + mesaId,
                nome: '📦 Caixa do Mestre',
                ownerUid: '__mestre__',
                isCaixaMestre: true
            });

            // Get all characters in same mesa
            const charSnaps = await getDocs(collection(db, 'char'));
            charSnaps.forEach(d => {
                const data = d.data();
                if (data.mesaId === mesaId && d.id !== charId) {
                    const f = data.fields || {};
                    targets.push({
                        id: d.id,
                        nome: f.nome || data.nome || 'Sem nome',
                        ownerUid: data.ownerUid || '',
                        ownerEmail: data.ownerEmail || data.userEmail || ''
                    });
                }
            });
        } else {
            // Character is avulso — show all avulso characters
            const charSnaps = await getDocs(collection(db, 'char'));
            charSnaps.forEach(d => {
                const data = d.data();
                if (!data.mesaId && d.id !== charId) {
                    const f = data.fields || {};
                    targets.push({
                        id: d.id,
                        nome: f.nome || data.nome || 'Sem nome',
                        ownerUid: data.ownerUid || '',
                        ownerEmail: data.ownerEmail || data.userEmail || ''
                    });
                }
            });
        }

        // Render target list
        const body = modal.querySelector('.inv-modal-body');
        if (targets.length === 0) {
            body.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted)">
                <div style="font-size:2rem;margin-bottom:8px">🚫</div>
                Nenhum alvo disponível para transferência.
            </div>`;
            return;
        }

        body.innerHTML = `<div class="inv-transfer-list">
            ${targets.map(t => `<div class="inv-transfer-target ${t.isCaixaMestre ? 'inv-transfer-target-master' : ''}"
                onclick="transferItem('${itemId}', '${t.id}', '${t.ownerUid}')">
                <div class="inv-transfer-target-name">${t.isCaixaMestre ? '📦' : '🎭'} ${_escHtml(t.nome)}</div>
                ${t.ownerEmail ? `<div class="inv-transfer-target-meta">👤 ${_escHtml(t.ownerEmail)}</div>` : ''}
            </div>`).join('')}
        </div>`;

    } catch (e) {
        console.error('❌ Erro ao carregar alvos:', e);
        const body = modal.querySelector('.inv-modal-body');
        if (body) body.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444">❌ Erro ao carregar alvos: ${_escHtml(e.message)}</div>`;
    }
};

window.closeTransferModal = function() {
    const m = document.getElementById('invTransferModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

window.transferItem = async function(itemId, targetCharId, targetOwnerUid) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    const targetName = targetCharId.startsWith('__caixa_mestre__') ? 'Caixa do Mestre' : targetCharId;
    if (!confirm(`Transferir "${item.nome || 'item'}" para ${targetName}?`)) return;

    try {
        const updateData = {
            characterId: targetCharId,
            equipado: false,
            parentItemId: null,
            lastModified: new Date().toISOString()
        };

        // Only update ownerUid if target is a real character
        if (!targetCharId.startsWith('__caixa_mestre__')) {
            // Fetch target character to get ownerUid
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const db = _getFirestore();
            const targetSnap = await getDoc(doc(db, 'char', targetCharId));
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                updateData.ownerUid = targetData.ownerUid || targetOwnerUid;
                updateData.ownerId = targetData.ownerUid || targetOwnerUid;
            }
        }

        await _firestoreSetDoc('items', itemId, updateData);

        // Remove from local cache
        window._inventoryState.items = window._inventoryState.items.filter(i => i.id !== itemId);

        closeTransferModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();

        // Re-apply mechanics since equipped items may have changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();

        alert(`✅ Item "${item.nome}" transferido com sucesso!`);
    } catch (e) {
        console.error('❌ Erro ao transferir item:', e);
        alert('❌ Erro ao transferir item: ' + e.message);
    }
};

// ===== ITEM FORM MODAL (Create/Edit) =====
window.openItemFormModal = function(title, item, containerId) {
    let existing = document.getElementById('invFormModal');
    if (existing) existing.remove();

    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invFormModal';

    // Se temos catálogo, mostrar picker com busca
    const catalog = window._inventoryState.catalog || [];
    let catalogHtml = '';
    if (!isEdit && catalog.length > 0) {
        const options = catalog.map(t => ({
            value: t.id,
            label: `${_escHtml(t.nome)} (${t.tipo || '-'})`,
            sub: t.descricao ? t.descricao.substring(0, 60) + (t.descricao.length > 60 ? '...' : '') : ''
        }));
        catalogHtml = `<div class="inv-form-section">
            <label class="inv-form-label">📚 Criar a partir do catálogo</label>
            ${_createSearchableSelectHTML('invCatalogPicker', options, '— Item personalizado —', 'Pesquisar item...')}
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
                    <select id="invFormTipo" class="inv-form-select" onchange="_toggleContainerFields()">
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
                <div class="inv-form-group" id="invFormQuantidadeGroup" style="display:${(item?.tipo === 'Container' || item?.ehContainer) ? 'none' : 'flex'}">
                    <label class="inv-form-label">Quantidade</label>
                    <input type="number" id="invFormQuantidade" class="inv-form-input" value="${(item?.tipo === 'Container' || item?.ehContainer) ? 1 : (item?.quantidade || 1)}" min="1">
                </div>
                <div id="invContainerFields" class="inv-form-group inv-form-wide" style="display:${(item?.tipo === 'Container' || item?.ehContainer) ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="inv-form-group">
                        <label class="inv-form-label">⚖️ Peso Máximo</label>
                        <input type="number" id="invFormPesoMaximo" class="inv-form-input" value="${item?.pesoMaximoContainer || 10}" min="0" step="0.1" placeholder="Limite de peso interno">
                    </div>
                    <div class="inv-form-group">
                        <label class="inv-form-label">✖️ Multiplicador de Pressão</label>
                        <input type="number" id="invFormMultPressao" class="inv-form-input" value="${item?.multiplicadorPressao || 1}" min="0" step="0.01" placeholder="Ex: 0.5">
                    </div>
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

    // Initialize searchable select for catalog after DOM insertion
    if (!isEdit && catalog.length > 0) {
        _initSearchableSelect('invCatalogPicker', (value) => {
            fillFromCatalog(value);
        });
    }
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
    document.getElementById('invFormQuantidade').value = 1;

    // Preencher campos de container do catálogo
    if (tpl.ehContainer || tpl.tipo === 'Container') {
        document.getElementById('invFormPesoMaximo').value = tpl.pesoMaximoContainer || 10;
        document.getElementById('invFormMultPressao').value = tpl.multiplicadorPressao || 1;
    }
    _toggleContainerFields();
};

window.saveInventoryItemForm = async function() {
    const nome = document.getElementById('invFormName')?.value?.trim();
    if (!nome) { alert('Nome obrigatório'); return; }

    const charId = _getCurrentCharId();
    const user = _getCurrentUser();
    if (!charId || !user) { alert('Erro: personagem não carregado'); return; }

    const containerId = document.getElementById('invFormContainerId')?.value || '';
    const editId = document.getElementById('invFormEditId')?.value || '';

    const tipo = document.getElementById('invFormTipo')?.value || 'Objeto';
    const isContainer = tipo === 'Container';

    const itemData = {
        nome,
        tipo,
        peso: parseFloat(document.getElementById('invFormPeso')?.value) || 1,
        tamanho: parseInt(document.getElementById('invFormTamanho')?.value) || 1,
        // Containers NÃO podem ser "stacados" — quantidade sempre 1
        quantidade: isContainer ? 1 : Math.max(1, parseInt(document.getElementById('invFormQuantidade')?.value) || 1),
        descricao: document.getElementById('invFormDesc')?.value?.trim() || '',
        imagem: document.getElementById('invFormImagem')?.value?.trim() || '',
        modeloId: document.getElementById('invFormModeloId')?.value || null,
        characterId: charId,
        ownerUid: user.uid,
        equipado: false,
        parentItemId: containerId || null,
        criadoPor: window.isCreator ? 'criador' : (window.isMestre ? 'mestre' : 'jogador'),
        lastModified: new Date().toISOString(),
        // Campos de container
        ehContainer: isContainer,
        pesoMaximoContainer: isContainer ? (parseFloat(document.getElementById('invFormPesoMaximo')?.value) || 10) : null,
        multiplicadorPressao: isContainer ? (parseFloat(document.getElementById('invFormMultPressao')?.value) || 1) : null,
        pressaoBase: parseFloat(document.getElementById('invFormPeso')?.value) || 1
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
function addInventoryItem() {} // No-op: replaced by inventory system

// ===== SEARCHABLE SELECT UTILITY =====
/**
 * Creates a searchable select dropdown component.
 * @param {string} containerId - ID for the container div
 * @param {Array} options - Array of { value, label, sub? } objects
 * @param {Function} onChange - Callback(value) when option is selected
 * @param {string} placeholder - Placeholder text
 * @param {string} defaultLabel - Label for the default/empty option
 * @returns {string} HTML string for the component
 */
function _createSearchableSelectHTML(containerId, options, defaultLabel, placeholder) {
    const optionsHtml = options.map(opt =>
        `<div class="searchable-select-option" data-value="${_escHtml(opt.value)}">
            <div>${_escHtml(opt.label)}</div>
            ${opt.sub ? `<div class="searchable-select-option-sub">${_escHtml(opt.sub)}</div>` : ''}
        </div>`
    ).join('');

    return `<div class="searchable-select" id="${containerId}">
        <input type="text" class="searchable-select-input" placeholder="${_escHtml(placeholder || 'Selecionar...')}" readonly>
        <span class="searchable-select-arrow">▼</span>
        <div class="searchable-select-dropdown">
            <div class="searchable-select-search">
                <input type="text" placeholder="🔍 Pesquisar..." autocomplete="off">
            </div>
            <div class="searchable-select-default" data-value="">${_escHtml(defaultLabel || '— Nenhum —')}</div>
            <div class="searchable-select-options-list">
                ${optionsHtml}
            </div>
            <div class="searchable-select-empty" style="display:none">Nenhum resultado encontrado</div>
        </div>
    </div>`;
}

/**
 * Initializes the searchable select behavior after it's been added to the DOM.
 * @param {string} containerId - ID of the container div
 * @param {Function} onChange - Callback(value) when an option is selected
 */
function _initSearchableSelect(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    const arrow = container.querySelector('.searchable-select-arrow');
    const dropdown = container.querySelector('.searchable-select-dropdown');
    const searchInput = dropdown.querySelector('.searchable-select-search input');
    const optionsList = container.querySelector('.searchable-select-options-list');
    const emptyMsg = container.querySelector('.searchable-select-empty');
    const defaultOpt = container.querySelector('.searchable-select-default');

    function toggleOpen(open) {
        if (open) {
            container.classList.add('open');
            searchInput.value = '';
            _filterOptions('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            container.classList.remove('open');
        }
    }

    function _filterOptions(query) {
        const q = query.toLowerCase().trim();
        const options = optionsList.querySelectorAll('.searchable-select-option');
        let visible = 0;
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const match = !q || text.includes(q);
            opt.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        if (defaultOpt) defaultOpt.style.display = q ? 'none' : '';
        emptyMsg.style.display = (visible === 0 && q) ? '' : 'none';
    }

    function selectOption(value, label) {
        input.value = label || '';
        container.dataset.selectedValue = value || '';
        toggleOpen(false);
        if (onChange) onChange(value);
    }

    // Toggle dropdown on input click
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpen(!container.classList.contains('open'));
    });

    // Search filtering
    searchInput.addEventListener('input', () => {
        _filterOptions(searchInput.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // Default option click
    if (defaultOpt) {
        defaultOpt.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption('', '');
        });
    }

    // Option clicks
    optionsList.querySelectorAll('.searchable-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            const label = opt.querySelector('div').textContent;
            selectOption(val, label);
        });
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => toggleOpen(false));
    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// ===== CONDITION SYSTEM =====

/**
 * Opens the condition form modal (replaces old inline addCondition).
 * Similar UX to openItemFormModal.
 */
function addCondition() {
    openConditionFormModal('Criar Condição');
}

function openConditionFormModal(title, condition, editIndex) {
    let existing = document.getElementById('condFormModal');
    if (existing) existing.remove();

    const isEdit = editIndex != null;
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'condFormModal';

    // Build template picker from system data
    const templates = (window._systemData?.conditions || []).filter(c => c.publicado !== false);
    let templatePickerHtml = '';
    if (!isEdit && templates.length > 0) {
        const options = templates.map(t => ({
            value: t.id,
            label: `${t.icone || '💀'} ${t.nome}`,
            sub: t.duracao ? `Duração: ${t.duracao}` : ''
        }));
        templatePickerHtml = `<div class="inv-form-section">
            <label class="inv-form-label">📚 Criar a partir de modelo (Painel do Mestre)</label>
            ${_createSearchableSelectHTML('condTemplatePicker', options, '— Condição personalizada —', 'Pesquisar condição...')}
        </div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${title || (isEdit ? 'Editar Condição' : 'Criar Condição')}</span>
            <button class="inv-modal-close" onclick="closeConditionFormModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${templatePickerHtml}
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="condFormNome" class="inv-form-input" value="${_escHtml(condition?.nome || '')}" placeholder="Nome da condição">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="condFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição da condição">${_escHtml(condition?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Atual</label>
                    <input type="text" id="condFormTempoAtual" class="inv-form-input" value="${_escHtml(condition?.tempoAtual || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Restante</label>
                    <input type="text" id="condFormTempoRestante" class="inv-form-input" value="${_escHtml(condition?.tempoRestante || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Ícone / Emoji</label>
                    <input type="text" id="condFormIcone" class="inv-form-input" value="${_escHtml(condition?.icone || '💀')}" placeholder="💀" maxlength="4">
                </div>
            </div>
            <input type="hidden" id="condFormModeloId" value="${condition?.modeloId || ''}">
            <input type="hidden" id="condFormMechIds" value="${(condition?.efeitoMecanicaIds || []).join(',')}">
            ${isEdit ? `<input type="hidden" id="condFormEditIndex" value="${editIndex}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="closeConditionFormModal()">Cancelar</button>
            <button class="inv-btn-save" onclick="saveConditionForm()">💾 Salvar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    // Initialize searchable select after DOM insertion
    if (!isEdit && templates.length > 0) {
        _initSearchableSelect('condTemplatePicker', (value) => {
            _fillConditionFromTemplate(value);
        });
    }
}

window.closeConditionFormModal = function() {
    document.getElementById('condFormModal')?.remove();
};

function _fillConditionFromTemplate(templateId) {
    if (!templateId) {
        // Reset to empty
        document.getElementById('condFormNome').value = '';
        document.getElementById('condFormDesc').value = '';
        document.getElementById('condFormTempoAtual').value = '';
        document.getElementById('condFormTempoRestante').value = '';
        document.getElementById('condFormIcone').value = '💀';
        document.getElementById('condFormModeloId').value = '';
        document.getElementById('condFormMechIds').value = '';
        return;
    }

    const tpl = (window._systemData?.conditions || []).find(c => c.id === templateId);
    if (!tpl) return;

    document.getElementById('condFormNome').value = tpl.nome || '';
    document.getElementById('condFormDesc').value = tpl.descricao || '';
    document.getElementById('condFormTempoAtual').value = '';
    document.getElementById('condFormTempoRestante').value = tpl.duracao || '';
    document.getElementById('condFormIcone').value = tpl.icone || '💀';
    document.getElementById('condFormModeloId').value = tpl.id;
    document.getElementById('condFormMechIds').value = (tpl.efeitoMecanicaIds || []).join(',');
}

window.saveConditionForm = function() {
    const nome = document.getElementById('condFormNome')?.value?.trim();
    if (!nome) { alert('Nome obrigatório'); return; }

    const condData = {
        nome,
        descricao: document.getElementById('condFormDesc')?.value?.trim() || '',
        tempoAtual: document.getElementById('condFormTempoAtual')?.value?.trim() || '',
        tempoRestante: document.getElementById('condFormTempoRestante')?.value?.trim() || '',
        icone: document.getElementById('condFormIcone')?.value?.trim() || '💀',
        modeloId: document.getElementById('condFormModeloId')?.value || null,
        efeitoMecanicaIds: (document.getElementById('condFormMechIds')?.value || '').split(',').filter(Boolean)
    };

    const editIndexEl = document.getElementById('condFormEditIndex');
    if (editIndexEl) {
        const idx = parseInt(editIndexEl.value);
        if (idx >= 0 && idx < state.conditions.length) {
            state.conditions[idx] = condData;
        }
    } else {
        state.conditions.push(condData);
    }

    closeConditionFormModal();
    renderConditions();
    scheduleAutosave();
};

window.removeCondition = function(idx) {
    if (idx >= 0 && idx < state.conditions.length) {
        state.conditions.splice(idx, 1);
        renderConditions();
        scheduleAutosave();
    }
};

window.editCondition = function(idx) {
    if (idx >= 0 && idx < state.conditions.length) {
        openConditionFormModal('Editar Condição', state.conditions[idx], idx);
    }
};

/**
 * Renders all active conditions as cards in #conditionsContainer.
 */
function renderConditions() {
    const container = document.getElementById('conditionsContainer');
    if (!container) return;

    const conditions = state.conditions || [];

    if (conditions.length === 0) {
        container.innerHTML = `<div class="cond-empty">
            <span class="cond-empty-icon">💀</span>
            <span>Nenhuma condição ativa</span>
            <small style="color:var(--muted)">Adicione condições pelo botão abaixo</small>
        </div>`;
        return;
    }

    let html = '';
    conditions.forEach((cond, idx) => {
        const icon = cond.icone || '💀';
        const nome = _escHtml(cond.nome || 'Sem nome');
        const desc = cond.descricao ? `<div class="cond-card-desc">${_escHtml(cond.descricao)}</div>` : '';

        // Mechanic preview tags
        let mechHtml = '';
        const mechIds = cond.efeitoMecanicaIds || [];
        if (mechIds.length > 0) {
            const tags = [];
            for (const mid of mechIds) {
                const m = window._systemData?.mechanics?.find(x => x.id === mid);
                if (m && typeof generatePreviewText === 'function') {
                    tags.push(`<span class="cond-mech-tag">${_escHtml(generatePreviewText(m))}</span>`);
                }
            }
            if (tags.length > 0) {
                mechHtml = `<div class="cond-card-mechs">
                    <span class="cond-card-mechs-label">⚙️ Mecânicas:</span>
                    ${tags.join('')}
                </div>`;
            }
        }

        // Time inputs
        const tempoAtual = _escHtml(cond.tempoAtual || '');
        const tempoRestante = _escHtml(cond.tempoRestante || '');
        const timeHtml = `<div class="cond-card-time">
            <span class="cond-card-time-label">⏱️ Tempo:</span>
            <input type="text" class="cond-time-input" value="${tempoAtual}" placeholder="0"
                data-cond-idx="${idx}" data-cond-field="tempoAtual"
                oninput="updateConditionTime(${idx}, 'tempoAtual', this.value)">
            <span class="cond-time-sep">/</span>
            <input type="text" class="cond-time-input" value="${tempoRestante}" placeholder="0"
                data-cond-idx="${idx}" data-cond-field="tempoRestante"
                oninput="updateConditionTime(${idx}, 'tempoRestante', this.value)">
        </div>`;

        html += `<div class="cond-card">
            <div class="cond-card-header">
                <span class="cond-card-icon">${icon}</span>
                <span class="cond-card-name">${nome}</span>
                <button class="cond-card-remove no-print" onclick="removeCondition(${idx})" title="Remover condição">✕</button>
            </div>
            ${desc}
            ${mechHtml}
            ${timeHtml}
        </div>`;
    });

    container.innerHTML = html;
}

window.updateConditionTime = function(idx, field, value) {
    if (idx >= 0 && idx < state.conditions.length) {
        state.conditions[idx][field] = value;
        scheduleAutosave();
    }
};

// ===== TOGGLE CONTAINER FIELDS =====
window._toggleContainerFields = function() {
    const tipo = document.getElementById('invFormTipo')?.value;
    const fields = document.getElementById('invContainerFields');
    if (fields) {
        fields.style.display = tipo === 'Container' ? 'grid' : 'none';
    }
    // Containers NÃO podem ser "stacados" — ocultar campo de quantidade
    const qtyGroup = document.getElementById('invFormQuantidadeGroup');
    if (qtyGroup) {
        qtyGroup.style.display = tipo === 'Container' ? 'none' : 'flex';
    }
    // Resetar quantidade para 1 quando for Container
    if (tipo === 'Container') {
        const qtyInput = document.getElementById('invFormQuantidade');
        if (qtyInput) qtyInput.value = 1;
    }
};

// ===== UTILITY =====
function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== MERGE / STACK SYSTEM =====
/**
 * Mescla itens idênticos no inventário, somando suas quantidades.
 * Itens são considerados "idênticos" se possuem o mesmo:
 *   nome, tipo, modeloId, peso, tamanho, descricao, imagem, parentItemId, equipado.
 * Containers NUNCA são mesclados (não podem ser stacados).
 * Retorna a quantidade de merges realizados.
 */
window.mergeInventoryItems = async function() {
    const charId = _getCurrentCharId();
    if (!charId) { alert('Erro: personagem não carregado'); return 0; }

    const items = window._inventoryState.items;
    if (items.length < 2) {
        alert('ℹ️ Não há itens suficientes para mesclar.');
        return 0;
    }

    // Chave de identidade para comparar itens
    function _itemKey(item) {
        return [
            (item.nome || '').trim().toLowerCase(),
            (item.tipo || '').toLowerCase(),
            item.modeloId || '',
            parseFloat(item.peso || 0),
            parseInt(item.tamanho || 0),
            (item.descricao || '').trim().toLowerCase(),
            (item.imagem || item.imagemUrl || '').trim(),
            item.parentItemId || '__root__',
            !!item.equipado
        ].join('||');
    }

    // Agrupar por chave — excluir Containers (nunca mesclam)
    const groups = {};
    for (const item of items) {
        if (item.ehContainer || item.tipo === 'Container') continue;
        const key = _itemKey(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    }

    // Filtrar apenas grupos com 2+ itens
    const mergeableGroups = Object.values(groups).filter(g => g.length > 1);
    if (mergeableGroups.length === 0) {
        alert('ℹ️ Nenhum item idêntico encontrado para mesclar.');
        return 0;
    }

    // Confirmar
    const totalMerges = mergeableGroups.reduce((sum, g) => sum + g.length - 1, 0);
    const groupNames = mergeableGroups.map(g => `"${g[0].nome}" (${g.length} → 1)`).join('\n');
    if (!confirm(`🔀 Mesclar ${totalMerges} item(ns) em ${mergeableGroups.length} stack(s)?\n\n${groupNames}`)) {
        return 0;
    }

    let mergeCount = 0;
    try {
        for (const group of mergeableGroups) {
            // O primeiro item do grupo é o "sobrevivente"
            const survivor = group[0];
            let totalQty = 0;
            for (const item of group) {
                totalQty += Math.max(1, parseInt(item.quantidade) || 1);
            }

            // Atualizar quantidade do sobrevivente
            await _firestoreSetDoc('items', survivor.id, {
                quantidade: totalQty,
                lastModified: new Date().toISOString()
            });
            survivor.quantidade = totalQty;

            // Excluir os demais
            for (let i = 1; i < group.length; i++) {
                await _firestoreDeleteDoc('items', group[i].id);
                window._inventoryState.items = window._inventoryState.items.filter(x => x.id !== group[i].id);
                mergeCount++;
            }
        }

        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();

        // Re-apply mechanics
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();

        alert(`✅ ${mergeCount} item(ns) mesclado(s) com sucesso!`);
    } catch (e) {
        console.error('❌ Erro ao mesclar itens:', e);
        alert('❌ Erro ao mesclar itens: ' + e.message);
    }
    return mergeCount;
};

// ===== EXPOSE GLOBALLY =====
window.loadCharacterItems = loadCharacterItems;
window.loadInventoryCatalog = loadInventoryCatalog;
window.applyEquippedItemsMechanics = applyEquippedItemsMechanics;
window.recalcInventoryPressure = recalcInventoryPressure;
window.renderEquippedItems = renderEquippedItems;
window.renderInventoryTab = renderInventoryTab;
window.openItemFormModal = openItemFormModal;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.transferItem = transferItem;
window.mergeInventoryItems = mergeInventoryItems;
window.renderConditions = renderConditions;
window.addCondition = addCondition;
window.openConditionFormModal = openConditionFormModal;
