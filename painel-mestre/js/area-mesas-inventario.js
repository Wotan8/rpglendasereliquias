// =============================================
// AREA MESAS — Inventário Geral + Caixa do Mestre + Personagens
// =============================================
import { db, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaInventarios = loadMesaInventarios;
window._loadPersonagensInventario = loadPersonagensInventario;

function _calcItemPressure(item, allItems) {
    const base = item.pressaoOverride != null ? item.pressaoOverride
        : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));
    if (item.ehContainer) {
        const inside = allItems.filter(i => i.parentItemId === item.id);
        const insideWeight = inside.reduce((sum, i) => sum + ((i.peso || 0) * Math.max(1, parseInt(i.quantidade)||1)), 0);
        return base + (insideWeight * (item.multiplicadorPressao || 1));
    }
    return base;
}

function _getCaixaMestreId(mesaId) {
    return '__caixa_mestre__' + mesaId;
}

const TIPO_EMOJI_MAP = {
    'Arma': '⚔️', 'Vestimenta': '🧥', 'Acessório': '💍', 'Projétil': '🎯',
    'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨'
};
function _getTipoEmoji(tipo) { return TIPO_EMOJI_MAP[tipo] || '📦'; }

window._mestreOpenContainers = {};

window.toggleMestreContainer = function(charId, itemId) {
    if (window._mestreOpenContainers[charId] === itemId) {
        delete window._mestreOpenContainers[charId];
    } else {
        window._mestreOpenContainers[charId] = itemId;
    }
    loadMesaInventarios();
    if (document.getElementById('mesaCharactersInventoryContainer')?.style.display !== 'none') {
        loadPersonagensInventario();
    }
};

async function loadMesaInventarios() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaInventarioContent'); 
    if (!el) return;
    try {
        const allItems = await _fetchAllItems();
        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const caixaItems = allItems.filter(it => it.characterId === caixaId);

        let html = _buildCaixaDoMestreHTML(caixaItems, allItems);
        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}

async function loadPersonagensInventario() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaCharactersInventoryContainer'); 
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando inventários...</div>';
    try {
        const chars = await _fetchMesaCharacters();
        const allItems = await _fetchAllItems();
        
        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const caixaItems = allItems.filter(it => it.characterId === caixaId);

        let html = _buildCaixaDoMestreHTML(caixaItems, allItems);

        if (!chars.length) {
            html += '<div style="text-align:center;padding:30px;color:var(--muted)">Nenhum personagem nesta mesa</div>';
        } else {
            html += `<div style="margin-top: 20px;">
                        <h3 style="color:var(--light);margin-bottom:10px;padding-left:10px;border-left:4px solid var(--primary)">Inventário dos Personagens</h3>
                        <div class="accordion-group">`;
            for (const c of chars) {
                const charItems = allItems.filter(it => it.characterId === c.id);
                html += _buildCharacterInventoryAccordionHTML(c, charItems, allItems);
            }
            html += `</div></div>`;
        }

        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}

async function _fetchMesaCharacters() {
    const chars = S.mesaCharacters || [];
    if (!chars.length) {
        const snap = await getDocs(collection(db, 'char'));
        snap.forEach(d => {
            const raw = d.data();
            const f = raw.fields || {};
            if (raw.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores||[]).includes(raw.ownerUid)) {
                chars.push({ id: d.id, nome: f.nome || raw.nome || '', ownerUid: raw.ownerUid || '', ownerEmail: raw.ownerEmail || '', ...raw });
            }
        });
        S.setMesaCharacters(chars);
    }
    return chars;
}

async function _fetchAllItems() {
    const itemsSnap = await getDocs(collection(db, 'items'));
    const allItems = []; itemsSnap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
    return allItems;
}

function _buildCaixaDoMestreHTML(caixaItems, allItems) {
    const caixaId = _getCaixaMestreId(S.currentMesaId);
    let html = `<div class="sessao-card" style="margin-bottom:14px;border:2px solid rgba(245,158,11,.25)">
        <div class="sessao-card-header" style="background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.02))">
            <div class="sessao-titulo" style="color:#f59e0b">📦 Caixa do Mestre</div>
            <div style="display:flex;gap:8px;align-items:center">
                <span class="sessao-data">${caixaItems.length} item(ns)</span>
                <button onclick="_openMestreItemFormModal('${S.currentMesaId}', null, '${caixaId}')" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);color:#f59e0b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:700;transition:all .2s">➕ Criar Item</button>
            </div>
        </div>
        <div style="padding: 10px;">`;
    
    html += _buildInventoryListHTML(caixaItems, allItems, caixaId);
    html += '</div></div>';
    return html;
}

window.toggleAccordion = function(elId) {
    const el = document.getElementById(elId);
    if(el) {
        el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    }
};

function _buildCharacterInventoryAccordionHTML(char, charItems, allItems) {
    const cid = char.id;
    const bodyId = `acc_body_${cid}`;
    const f = char.fields || {};
    const nomeReal = f.nome || char.nome || 'Sem nome';
    const equipped = charItems.filter(i => i.equipado && !i.parentItemId);
    const totalPressure = equipped.reduce((sum, it) => sum + _calcItemPressure(it, charItems), 0);

    return `
    <div class="accordion-item" style="margin-bottom:8px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px;">
        <div class="accordion-header" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleAccordion('${bodyId}')">
            <div style="font-weight:bold; color:var(--light);">🎭 ${escapeHtml(nomeReal)}</div>
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:3px 10px;border-radius:8px;font-size:.78rem;font-weight:700">⚖️ Pressão: ${parseFloat(totalPressure).toFixed(2)}</span>
                <span style="font-size:0.8rem; color:var(--muted);">${charItems.length} itens</span>
                <span style="color:var(--muted);">▼</span>
            </div>
        </div>
        <div class="accordion-body" id="${bodyId}" style="display:none; padding:16px; border-top:1px solid var(--border);">
            <div style="margin-bottom:12px; text-align:right;">
                <button class="btn btn-secondary btn-small" onclick="_openMestreItemFormModal('${S.currentMesaId}', null, '${cid}')">➕ Criar Item p/ Personagem</button>
            </div>
            ${_buildInventoryListHTML(charItems, allItems, cid)}
        </div>
    </div>`;
}

function _buildInventoryListHTML(items, allItems, ownerId) {
    const topLevel = items.filter(i => !i.parentItemId);
    const equipped = topLevel.filter(i => i.equipado);
    const loose = topLevel.filter(i => !i.equipado);

    let html = '';

    html += `<div class="inv-section">
        <div class="inv-section-title">🎒 Equipados <span class="inv-section-count">${equipped.length}</span></div>
        <div class="inv-section-grid">`;
    if (equipped.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item equipado</div>';
    } else {
        html += equipped.map(i => _renderInvItemRow(i, true, items)).join('');
    }
    html += '</div></div>';

    html += `<div class="inv-section" style="margin-top:16px;">
        <div class="inv-section-title">📋 Itens Soltos <span class="inv-section-count">${loose.length}</span></div>
        <div class="inv-section-grid">`;
    if (loose.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item solto</div>';
    } else {
        html += loose.map(i => _renderInvItemRow(i, false, items)).join('');
    }
    html += '</div></div>';

    const openContId = window._mestreOpenContainers[ownerId];
    if (openContId) {
        const contItem = items.find(i => i.id === openContId);
        if (contItem) {
            const inside = items.filter(i => i.parentItemId === openContId);
            const cap = contItem.capacidadeContainer || 10;
            const pesoMax = contItem.pesoMaximoContainer || null;
            const insideWeight = inside.reduce((sum, i) => sum + ((i.peso || 0) * Math.max(1, parseInt(i.quantidade)||1)), 0);
            const pesoBase = contItem.pressaoBase != null ? contItem.pressaoBase : (contItem.peso || 0);
            const overWeight = pesoMax != null && insideWeight > pesoMax;
            const mult = contItem.multiplicadorPressao || 1;
            const pressaoContainer = pesoBase + (insideWeight * mult);
            
            html += `<div class="inv-container-viewer" style="margin-top:16px;">
                <div class="inv-container-header">
                    <span class="inv-container-title">📂 ${escapeHtml(contItem.nome || 'Container')}</span>
                    <span class="inv-container-cap">Itens: ${inside.length} / ${cap}</span>
                    <button class="inv-btn inv-btn-close" onclick="toggleMestreContainer('${ownerId}', '${openContId}')">✕</button>
                </div>
                <div class="inv-container-stats">
                    <span class="${overWeight ? 'inv-stat-over' : 'inv-stat-ok'}">⚖️ Peso: ${insideWeight.toFixed(2)}${pesoMax ? ' / '+parseFloat(pesoMax).toFixed(2) : ''}</span>
                    <span class="inv-stat-pressure">📐 Pressão: ${pressaoContainer.toFixed(2)} (${pesoBase.toFixed(2)} + ${insideWeight.toFixed(2)} × ${mult})</span>
                </div>
                <div class="inv-container-items">`;
            
            if (inside.length === 0) {
                html += '<div class="inv-empty-small">Container vazio</div>';
            } else {
                html += inside.map(i => _renderInvItemRow(i, false, items, true)).join('');
            }
            
            html += `</div>
            </div>`;
        }
    }

    return html;
}

function _renderInvItemRow(item, isEquipped, contextItems, isInsideContainer=false) {
    const tipoEmoji = _getTipoEmoji(item.tipo);
    const img = item.imagem || item.imagemUrl;
    
    // Thumbnail rendering: height clamped to line height (approx 1.2em to 1.5em). 
    const imgHtml = img
        ? `<img src="${escapeHtml(img)}" alt="" style="max-height:1.5em; width:auto; border-radius:4px; margin-right:6px; object-fit:contain; vertical-align:middle;">`
        : `<span class="inv-row-img-ph" style="margin-right:4px;">${tipoEmoji}</span>`;

    let containerBtn = '';
    if (item.ehContainer) {
        const isOpen = window._mestreOpenContainers[item.characterId] === item.id;
        containerBtn = `<button class="inv-btn ${isOpen ? 'inv-btn-open' : 'inv-btn-closed'}" onclick="event.stopPropagation();toggleMestreContainer('${item.characterId}', '${item.id}')" title="${isOpen ? 'Fechar' : 'Abrir'} container">${isOpen ? '📂' : '📁'}</button>`;
    }

    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    const qtyHtml = `<span class="inv-badge inv-badge-qty" title="Quantidade">×${qty}</span>`;
    const pressao = isEquipped ? `<span class="inv-badge inv-badge-pressure-sm">⚖️ ${parseFloat(_calcItemPressure(item, contextItems)).toFixed(2)}</span>` : '';

    let stateBadge = '';
    if (isEquipped && item.estadoEquip) {
        stateBadge = `<span class="inv-badge inv-badge-state inv-badge-state-${item.estadoEquip}">${item.estadoEquip}</span>`;
    }

    return `<div class="inv-item-row ${isEquipped ? 'inv-equipped' : ''}" onclick="_openMestreItemInspectionModal('${item.id}')" style="cursor:pointer; display:flex; align-items:center; padding: 8px;">
        ${!isInsideContainer && img ? imgHtml : (isInsideContainer && img ? `<img src="${escapeHtml(img)}" class="inv-row-img" alt="">` : imgHtml)}
        <div class="inv-item-info" style="flex:1;">
            <span class="inv-item-name">${escapeHtml(item.nome || 'Sem nome')}</span>
            <span class="inv-item-meta">${!img ? '' : tipoEmoji} ${escapeHtml(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)} | Tam: ${item.tamanho || 0}</span>
        </div>
        ${qtyHtml}
        ${pressao}
        ${stateBadge}
        <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
            ${containerBtn}
            <button class="inv-btn" style="background:rgba(6,182,212,.12);color:#06b6d4" onclick="_openMestreTransferModal('${item.id}', '${S.currentMesaId}')" title="Transferir">🔄</button>
            <button class="inv-btn" style="background:rgba(139,92,246,.12);color:var(--primary)" onclick="_openMestreItemFormModal('${S.currentMesaId}', '${item.id}', '${item.characterId}')" title="Editar">✏️</button>
            <button class="inv-btn inv-btn-delete" onclick="_deleteMestreItem('${item.id}')" title="Excluir">🗑️</button>
        </div>
    </div>`;
}

// ===== INSPECTION MODAL =====
window._openMestreItemInspectionModal = async function(itemId) {
    let existing = document.getElementById('invDetailModal');
    if (existing) existing.remove();

    try {
        const snap = await getDoc(doc(db, 'items', itemId));
        if (!snap.exists()) return;
        const item = { id: snap.id, ...snap.data() };
        
        const modal = document.createElement('div');
        modal.className = 'inv-modal active';
        modal.id = 'invDetailModal';
        
        const tipoEmoji = _getTipoEmoji(item.tipo);
        const img = item.imagem || item.imagemUrl;
        
        modal.innerHTML = `<div class="inv-modal-content" style="max-width:450px">
            <div class="inv-modal-header">
                <span class="inv-modal-title">🔍 Inspeção de Item</span>
                <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
            </div>
            <div class="inv-modal-body" style="text-align:center;">
                ${img ? `<img src="${escapeHtml(img)}" style="max-width:100%; max-height:200px; object-fit:contain; border-radius:8px; margin-bottom:12px;">` : `<div style="font-size:3rem; margin-bottom:12px;">${tipoEmoji}</div>`}
                <h2 style="margin:0; color:var(--light);">${escapeHtml(item.nome || 'Sem nome')}</h2>
                <div style="color:var(--muted); font-size:0.9rem; margin-bottom:16px;">${tipoEmoji} ${escapeHtml(item.tipo || '')}</div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:left; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
                    <div><strong>⚖️ Peso:</strong> ${parseFloat(item.peso || 0).toFixed(2)}</div>
                    <div><strong>📏 Tamanho:</strong> ${item.tamanho || 1}</div>
                    <div><strong>× Quantidade:</strong> ${item.quantidade || 1}</div>
                    ${item.categoriaArma ? `<div><strong>⚔️ Categoria:</strong> ${item.categoriaArma}</div>` : ''}
                </div>
                
                ${item.descricao ? `<div style="margin-top:16px; text-align:left; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; white-space:pre-wrap; color:var(--light); font-size:0.9rem;">${escapeHtml(item.descricao)}</div>` : ''}
            </div>
            <div class="inv-modal-footer">
                <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Fechar</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    } catch(e) { console.error(e); }
};

// ===== CRUD MODAL (Identical to Ficha) =====
window._openMestreItemFormModal = async function(mesaId, editItemId, targetCharId) {
    let existing = document.getElementById('invFormModal');
    if (existing) existing.remove();

    let item = null;
    if (editItemId) {
        try {
            const snap = await getDoc(doc(db, 'items', editItemId));
            if (snap.exists()) item = { id: snap.id, ...snap.data() };
        } catch(e) { console.error(e); }
    }

    const isEdit = !!item;
    const bodyParts = window._systemData?.bodyParts || []; 

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invFormModal';

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item'}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="invFormName" class="inv-form-input" value="${escapeHtml(item?.nome || '')}" placeholder="Nome do item">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tipo</label>
                    <select id="invFormTipo" class="inv-form-select" onchange="window._toggleMestreModalFields()">
                        <option value="Objeto" ${item?.tipo === 'Objeto' ? 'selected' : ''}>📦 Objeto</option>
                        <option value="Arma" ${item?.tipo === 'Arma' ? 'selected' : ''}>⚔️ Arma</option>
                        <option value="Vestimenta" ${item?.tipo === 'Vestimenta' ? 'selected' : ''}>🧥 Vestimenta</option>
                        <option value="Acessório" ${item?.tipo === 'Acessório' ? 'selected' : ''}>💍 Acessório</option>
                        <option value="Projétil" ${item?.tipo === 'Projétil' ? 'selected' : ''}>🎯 Projétil</option>
                        <option value="Container" ${item?.tipo === 'Container' ? 'selected' : ''}>📦 Container</option>
                        <option value="Consumível" ${item?.tipo === 'Consumível' ? 'selected' : ''}>🧪 Consumível</option>
                        <option value="Relíquia" ${item?.tipo === 'Relíquia' ? 'selected' : ''}>✨ Relíquia</option>
                    </select>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Equipável em</label>
                    <select id="invFormEquipavelEm" class="inv-form-select" multiple size="4">
                        ${bodyParts.map(bp => {
                            const selected = Array.isArray(item?.equipavelEm) && item.equipavelEm.includes(bp.id) ? 'selected' : '';
                            return `<option value="${bp.id}" ${selected}>${bp.icone || '🦴'} ${bp.nome}</option>`;
                        }).join('')}
                    </select>
                    <small style="color:var(--muted); font-size: 0.8rem;">Segure Ctrl p/ múltiplos. Vazio = Livre.</small>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Forma de equipar</label>
                    <select id="invFormFormaEquipar" class="inv-form-select">
                        <option value="" ${!item?.formaEquipar ? 'selected' : ''}>— Livre —</option>
                        <option value="segurar" ${item?.formaEquipar === 'segurar' ? 'selected' : ''}>Segurar</option>
                        <option value="empunhar" ${item?.formaEquipar === 'empunhar' ? 'selected' : ''}>Empunhar</option>
                        <option value="vestir" ${item?.formaEquipar === 'vestir' ? 'selected' : ''}>Vestir</option>
                        <option value="fixar" ${item?.formaEquipar === 'fixar' ? 'selected' : ''}>Fixar</option>
                    </select>
                </div>
                <div class="inv-form-group" id="invFormCategoriaArmaGroup" style="display:${item?.tipo === 'Arma' ? 'flex' : 'none'}">
                    <label class="inv-form-label">Categoria da Arma *</label>
                    <select id="invFormCategoriaArma" class="inv-form-select">
                        <option value="" disabled ${!item?.categoriaArma ? 'selected' : ''}>— Selecione —</option>
                        <option value="uma_mao" ${item?.categoriaArma === 'uma_mao' ? 'selected' : ''}>🗡️ Arma de Uma Mão</option>
                        <option value="duas_maos" ${item?.categoriaArma === 'duas_maos' ? 'selected' : ''}>⚔️ Arma de Duas Mãos</option>
                        <option value="versatil" ${item?.categoriaArma === 'versatil' ? 'selected' : ''}>🔄 Arma Versátil</option>
                        <option value="escudo" ${item?.categoriaArma === 'escudo' ? 'selected' : ''}>🛡️ Escudo</option>
                        <option value="distancia" ${item?.categoriaArma === 'distancia' ? 'selected' : ''}>🏹 Arma a Distância</option>
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
                <div class="inv-form-group" id="invFormQuantidadeGroup" style="display:${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 'none' : 'flex'}">
                    <label class="inv-form-label">Quantidade</label>
                    <input type="number" id="invFormQuantidade" class="inv-form-input" value="${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 1 : (item?.quantidade || 1)}" min="1">
                </div>
                <div id="invContainerFields" class="inv-form-group inv-form-wide" style="display:${(item?.tipo === 'Container' || item?.ehContainer) ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="inv-form-group">
                        <label class="inv-form-label">⚖️ Peso Máximo</label>
                        <input type="number" id="invFormPesoMaximo" class="inv-form-input" value="${item?.pesoMaximoContainer || 10}" min="0" step="0.1">
                    </div>
                    <div class="inv-form-group">
                        <label class="inv-form-label">✖️ Mult. Pressão</label>
                        <input type="number" id="invFormMultPressao" class="inv-form-input" value="${item?.multiplicadorPressao || 1}" min="0" step="0.01">
                    </div>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="invFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição do item">${escapeHtml(item?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Imagem (URL)</label>
                    <input type="text" id="invFormImagem" class="inv-form-input" value="${escapeHtml(item?.imagem || item?.imagemUrl || '')}" placeholder="https://...">
                </div>
            </div>
            <input type="hidden" id="mif_mesaId" value="${mesaId}">
            <input type="hidden" id="mif_targetCharId" value="${targetCharId}">
            ${isEdit ? `<input type="hidden" id="mif_editId" value="${item.id}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="_saveMestreItem()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    window._toggleMestreModalFields();
};

window._toggleMestreModalFields = function() {
    const tipo = document.getElementById('invFormTipo')?.value;
    const catGroup = document.getElementById('invFormCategoriaArmaGroup');
    const qtyGroup = document.getElementById('invFormQuantidadeGroup');
    const contGroup = document.getElementById('invContainerFields');
    const qtyInput = document.getElementById('invFormQuantidade');

    if (catGroup) catGroup.style.display = tipo === 'Arma' ? 'flex' : 'none';
    if (contGroup) contGroup.style.display = tipo === 'Container' ? 'grid' : 'none';
    
    if (qtyGroup) {
        if (tipo === 'Container' || tipo === 'Arma') {
            qtyGroup.style.display = 'none';
            if (qtyInput) qtyInput.value = 1;
        } else {
            qtyGroup.style.display = 'flex';
        }
    }
};

window._saveMestreItem = async function() {
    const nome = document.getElementById('invFormName')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }

    const mesaId = document.getElementById('mif_mesaId')?.value;
    const editId = document.getElementById('mif_editId')?.value || '';
    const targetCharId = document.getElementById('mif_targetCharId')?.value;
    const tipo = document.getElementById('invFormTipo')?.value || 'Objeto';
    const isContainer = tipo === 'Container';

    const equipOpts = document.getElementById('invFormEquipavelEm')?.selectedOptions;
    const equipavelEm = equipOpts ? Array.from(equipOpts).map(o => o.value) : [];

    const itemData = {
        nome,
        tipo,
        formaEquipar: document.getElementById('invFormFormaEquipar')?.value || '',
        equipavelEm,
        categoriaArma: tipo === 'Arma' ? document.getElementById('invFormCategoriaArma')?.value : null,
        peso: parseFloat(document.getElementById('invFormPeso')?.value) || 1,
        tamanho: parseInt(document.getElementById('invFormTamanho')?.value) || 1,
        quantidade: (isContainer || tipo === 'Arma') ? 1 : Math.max(1, parseInt(document.getElementById('invFormQuantidade')?.value) || 1),
        descricao: document.getElementById('invFormDesc')?.value?.trim() || '',
        imagem: document.getElementById('invFormImagem')?.value?.trim() || '',
        characterId: targetCharId,
        ownerUid: S.currentUser?.uid || '', // Might update below
        ehContainer: isContainer,
        pressaoBase: parseFloat(document.getElementById('invFormPeso')?.value) || 1,
        lastModified: new Date().toISOString()
    };

    if (isContainer) {
        itemData.pesoMaximoContainer = parseFloat(document.getElementById('invFormPesoMaximo')?.value) || 10;
        itemData.multiplicadorPressao = parseFloat(document.getElementById('invFormMultPressao')?.value) || 1;
    }

    try {
        if (editId) {
            await setDoc(doc(db, 'items', editId), itemData, { merge: true });
        } else {
            itemData.equipado = false;
            itemData.parentItemId = null;
            itemData.criadoPor = 'mestre';
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await setDoc(doc(db, 'items', newId), itemData);
        }
        showAlert('✅ Item salvo!', 'success');
        document.getElementById('invFormModal')?.remove();
        
        loadMesaInventarios();
        if (document.getElementById('mesaCharactersInventoryContainer')?.style.display !== 'none') {
            loadPersonagensInventario();
        }
    } catch (e) {
        console.error('❌ Erro ao salvar item:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window._deleteMestreItem = async function(itemId) {
    if (!confirm('Excluir este item?')) return;
    try {
        await deleteDoc(doc(db, 'items', itemId));
        showAlert('✅ Item excluído', 'success');
        loadMesaInventarios();
        if (document.getElementById('mesaCharactersInventoryContainer')?.style.display !== 'none') {
            loadPersonagensInventario();
        }
    } catch (e) {
        console.error('❌ Erro ao excluir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

// ===== TRANSFER MODAL =====
window._openMestreTransferModal = async function(itemId, mesaId) {
    let existing = document.getElementById('mestreTransferModal');
    if (existing) existing.remove();

    let itemNome = 'Item';
    try {
        const snap = await getDoc(doc(db, 'items', itemId));
        if (snap.exists()) itemNome = snap.data().nome || 'Item';
    } catch(e) {}

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'mestreTransferModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:550px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">🔄 Transferir: ${escapeHtml(itemNome)}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="text" id="mt_search" class="inv-form-input" placeholder="🔍 Buscar personagem por nome ou e-mail..." oninput="window._filterMestreTransfer()">
                </div>
                <div class="sub-tabs" style="display:flex; overflow-x:auto; gap:4px;">
                    <button class="sub-tab-btn active" onclick="window._setMestreTransferScope('mesa', this)" style="padding:6px 10px; font-size:0.85rem;">Mesa Atual</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('caixa', this)" style="padding:6px 10px; font-size:0.85rem;">Caixa do Mestre</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('todas', this)" style="padding:6px 10px; font-size:0.85rem;">Todas as Mesas</button>
                    <button class="sub-tab-btn" onclick="window._setMestreTransferScope('avulsos', this)" style="padding:6px 10px; font-size:0.85rem;">Avulsos</button>
                </div>
                <div id="mt_results" style="display:grid; gap:8px; max-height:40vh; overflow-y:auto; padding:4px;">
                    <div style="text-align:center;color:var(--muted)">Carregando...</div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    window._mestreTransferData = {
        itemId: itemId,
        mesaId: mesaId,
        scope: 'mesa',
        chars: []
    };

    try {
        const snap = await getDocs(collection(db, 'char'));
        const allChars = [];
        snap.forEach(d => {
            const data = d.data();
            const f = data.fields || {};
            allChars.push({
                id: d.id,
                nome: f.nome || data.nome || 'Sem nome',
                ownerUid: data.ownerUid || '',
                ownerEmail: data.ownerEmail || data.userEmail || '',
                mesaId: data.mesaId || null
            });
        });
        window._mestreTransferData.chars = allChars;
        window._filterMestreTransfer();
    } catch (e) {
        document.getElementById('mt_results').innerHTML = `<div style="text-align:center;color:#ef4444">❌ Erro: ${e.message}</div>`;
    }
};

window._setMestreTransferScope = function(scope, btnEl) {
    window._mestreTransferData.scope = scope;
    const btns = btnEl.parentElement.querySelectorAll('.sub-tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    window._filterMestreTransfer();
};

window._filterMestreTransfer = function() {
    const data = window._mestreTransferData;
    const search = (document.getElementById('mt_search')?.value || '').toLowerCase();
    const resultsContainer = document.getElementById('mt_results');
    
    if (data.scope === 'caixa') {
        resultsContainer.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:rgba(15,23,42,.5);border:2px solid rgba(245,158,11,.2);border-radius:10px;cursor:pointer;transition:all .2s"
            onclick="_executeMestreTransfer('${data.itemId}','${_getCaixaMestreId(data.mesaId)}','${S.currentUser?.uid||''}')">
            <div style="font-weight:700;font-size:.95rem;color:#f59e0b">📦 Caixa do Mestre</div>
            <div style="font-size:.78rem;color:var(--muted)">Mesa Atual</div>
        </div>`;
        return;
    }

    let filtered = data.chars;
    if (data.scope === 'mesa') {
        filtered = filtered.filter(c => c.mesaId === data.mesaId);
    } else if (data.scope === 'todas') {
        filtered = filtered.filter(c => c.mesaId != null);
    } else if (data.scope === 'avulsos') {
        filtered = filtered.filter(c => !c.mesaId);
    }

    if (search) {
        filtered = filtered.filter(c => c.nome.toLowerCase().includes(search) || c.ownerEmail.toLowerCase().includes(search));
    }

    if (!filtered.length) {
        resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Nenhum personagem encontrado</div>';
        return;
    }

    resultsContainer.innerHTML = filtered.map(c => `
        <div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:rgba(15,23,42,.5);border:2px solid rgba(139,92,246,.12);border-radius:10px;cursor:pointer;transition:all .2s"
            onmouseenter="this.style.borderColor='#8b5cf6';this.style.background='rgba(139,92,246,.08)'"
            onmouseleave="this.style.borderColor='rgba(139,92,246,.12)';this.style.background='rgba(15,23,42,.5)'"
            onclick="_executeMestreTransfer('${data.itemId}','${c.id}','${c.ownerUid || ''}')">
            <div style="font-weight:700;font-size:.95rem;color:var(--light)">🎭 ${escapeHtml(c.nome)}</div>
            ${c.ownerEmail ? `<div style="font-size:.78rem;color:var(--muted)">👤 ${escapeHtml(c.ownerEmail)}</div>` : ''}
            ${c.mesaId && data.scope === 'todas' ? `<div style="font-size:.7rem;color:#06b6d4">Mesa ID: ${c.mesaId}</div>` : ''}
        </div>
    `).join('');
};

window._executeMestreTransfer = async function(itemId, targetCharId, targetOwnerUid) {
    if (!confirm('Transferir este item para o destino selecionado?')) return;
    try {
        await setDoc(doc(db, 'items', itemId), {
            characterId: targetCharId,
            ownerUid: targetOwnerUid,
            ownerId: targetOwnerUid,
            equipado: false,
            parentItemId: null,
            lastModified: new Date().toISOString()
        }, { merge: true });

        showAlert('✅ Item transferido com sucesso!', 'success');
        document.getElementById('mestreTransferModal')?.remove();
        
        loadMesaInventarios();
        if (document.getElementById('mesaCharactersInventoryContainer')?.style.display !== 'none') {
            loadPersonagensInventario();
        }
    } catch (e) {
        console.error('❌ Erro ao transferir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};
