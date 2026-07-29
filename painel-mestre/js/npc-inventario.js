// =============================================
// FICHA DE NPC — Aba Inventário + Partes do Corpo
// Gerencia itens (coleção 'items' com characterId = npcId),
// anatomia/slots do NPC e transferências (NPC ⇄ NPC / Personagem / Caixa).
// Respeita a lógica de logs do painel (addLog → coleção 'logs').
// =============================================
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, query, where } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { buildMechanicSelectorHTML } from '../../painel-criador/js/painel-mechanics.js';

const TIPO_EMOJI_MAP = {
    'Arma': '⚔️', 'Vestimenta': '🧥', 'Acessório': '💍', 'Projétil': '🎯',
    'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨'
};
const _emoji = t => TIPO_EMOJI_MAP[t] || '📦';

const EQUIP_STATES = {
    empunhado: { label: 'Empunhado', icon: '✊' },
    segurar:   { label: 'Segurado',  icon: '🖐️' },
    vestido:   { label: 'Vestido',   icon: '👕' },
    fixado:    { label: 'Fixado',    icon: '📌' }
};

// Estado local
const NI = { items: [], loadedFor: null };
window._npcInv = NI;

function _F() { return window.F || {}; }
function _npc() { return _F().npc || null; }
function _npcId() { const n = _npc(); return (n && n.id) || null; }
function _npcNome() { return document.getElementById('npcNome')?.value?.trim() || _npc()?.nome || 'NPC'; }
function _npcMesaId() {
    const n = _npc(); if (!n) return null;
    const v = (n.vinculos || []).find(v => v.tipo === 'mesa');
    return v ? v.id : (n.mesaId || null);
}

/* ===================================================================
   REGISTRO DE PARTES DO CORPO (system/data/bodyParts)
   =================================================================== */
export async function ensureBodyPartsRegistry() {
    if (!window._systemData) window._systemData = {};
    if (Array.isArray(window._systemData.bodyParts) && window._systemData.bodyParts.length > 0) {
        return window._systemData.bodyParts;
    }
    try {
        const snap = await getDocs(collection(db, 'system/data/bodyParts'));
        const arr = [];
        snap.forEach(d => { const data = d.data(); if (data.publicado !== false) arr.push({ id: d.id, ...data }); });
        arr.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._systemData.bodyParts = arr;
    } catch (e) {
        console.error('Erro ao carregar registro de partes do corpo:', e);
        window._systemData.bodyParts = window._systemData.bodyParts || [];
    }
    return window._systemData.bodyParts;
}
window._npcEnsureBodyPartsRegistry = ensureBodyPartsRegistry;

/** Partes padrão (humanoide bípede) definidas no Painel de Criador (ehPadrao). */
export function defaultHumanoidParts() {
    const parts = (window._systemData?.bodyParts || []).filter(bp => bp.ehPadrao);
    return JSON.parse(JSON.stringify(parts)).map(bp => ({ ...bp, slots: bp.slots || 1 }));
}
window._npcDefaultHumanoidParts = defaultHumanoidParts;

/* ===================================================================
   ABERTURA DA SEÇÃO INVENTÁRIO
   =================================================================== */
window._npcInvOnSectionOpen = async function() {
    const n = _npc(); if (!n) return;
    await ensureBodyPartsRegistry();

    // NPCs "comuns" (bípedes) nascem com a anatomia padrão; criaturas ficam
    // livres para o mestre montar do zero (ou aplicar o padrão com um clique).
    if (!Array.isArray(n.partesDoCorpo)) n.partesDoCorpo = [];
    const tipoAtual = document.getElementById('npcTipo')?.value || n.tipo || 'npc';
    if (n.partesDoCorpo.length === 0 && tipoAtual === 'npc') {
        n.partesDoCorpo = defaultHumanoidParts();
    }

    renderNpcBodyPartsEditor();
    await loadNpcInventory();
};

/* ===================================================================
   EDITOR DE PARTES DO CORPO / SLOTS
   =================================================================== */
export function renderNpcBodyPartsEditor() {
    const listEl = document.getElementById('npcBodyPartsList');
    const pickerEl = document.getElementById('npcBodyPartPicker');
    const n = _npc();
    if (!listEl || !n) return;

    // Picker do registro (só partes ainda não vinculadas)
    if (pickerEl) {
        const usedIds = new Set((n.partesDoCorpo || []).map(p => p.id));
        const opts = (window._systemData?.bodyParts || [])
            .filter(bp => !usedIds.has(bp.id))
            .map(bp => `<option value="${bp.id}">${bp.icone || '🦴'} ${escapeHtml(bp.nome || 'Sem nome')}</option>`).join('');
        pickerEl.innerHTML = opts || '<option value="">— Registro esgotado —</option>';
    }

    if (!n.partesDoCorpo || !n.partesDoCorpo.length) {
        listEl.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:8px 0">
            Nenhuma parte do corpo definida. Aplique a <strong>anatomia padrão</strong> (humanoide bípede)
            ou monte a anatomia da criatura adicionando partes do registro / personalizadas.
        </div>`;
        return;
    }

    listEl.innerHTML = n.partesDoCorpo.map((bp, idx) => `
        <div class="npcv2-pec-row" style="flex-wrap:wrap;gap:8px">
            <span class="npcv2-pec-nome" style="min-width:130px">${bp.icone || '🦴'} ${escapeHtml(bp.nome || 'Sem nome')}</span>
            ${bp.ehPadrao ? '<span class="npcv2-pec-fonte">padrão</span>' : (bp.custom ? '<span class="npcv2-pec-fonte">custom</span>' : '')}
            <span class="npcv2-pec-nivel" title="Quantidade de slots desta parte (ex.: 2 mãos)">Slots
                <input type="number" min="1" value="${bp.slots || 1}"
                    onchange="window._npcBpSet(${idx},'slots',parseInt(this.value)||1)">
            </span>
            <label class="npcv2-check" style="font-size:.75rem" title="Pode Segurar"><input type="checkbox" ${bp.podeSegurar ? 'checked' : ''} onchange="window._npcBpSet(${idx},'podeSegurar',this.checked)">🖐️</label>
            <label class="npcv2-check" style="font-size:.75rem" title="Pode Empunhar"><input type="checkbox" ${bp.podeEmpunhar ? 'checked' : ''} onchange="window._npcBpSet(${idx},'podeEmpunhar',this.checked)">✊</label>
            <label class="npcv2-check" style="font-size:.75rem" title="Pode Vestir"><input type="checkbox" ${bp.podeVestir ? 'checked' : ''} onchange="window._npcBpSet(${idx},'podeVestir',this.checked)">👕</label>
            <label class="npcv2-check" style="font-size:.75rem" title="Pode Fixar"><input type="checkbox" ${bp.podeFixar ? 'checked' : ''} onchange="window._npcBpSet(${idx},'podeFixar',this.checked)">📌</label>
            <button class="npcv2-pec-del" title="Remover parte" onclick="window._npcBpRemove(${idx})">✕</button>
        </div>`).join('');
}
window.renderNpcBodyPartsEditor = renderNpcBodyPartsEditor;

window._npcBpSet = function(idx, campo, valor) {
    const n = _npc(); if (!n || !n.partesDoCorpo[idx]) return;
    n.partesDoCorpo[idx][campo] = valor;
};

window._npcBpRemove = function(idx) {
    const n = _npc(); if (!n) return;
    n.partesDoCorpo.splice(idx, 1);
    renderNpcBodyPartsEditor();
};

window.npcApplyDefaultBodyParts = async function() {
    const n = _npc(); if (!n) return;
    await ensureBodyPartsRegistry();
    const padrao = defaultHumanoidParts();
    if (!padrao.length) { showAlert('⚠️ Nenhuma parte padrão cadastrada no Painel de Criador.', 'warning'); return; }
    if (n.partesDoCorpo.length && !confirm('Substituir as partes atuais pela anatomia padrão (humanoide)?')) return;
    n.partesDoCorpo = padrao;
    renderNpcBodyPartsEditor();
    showAlert('✅ Anatomia padrão aplicada. Salve o NPC para persistir.', 'success');
};

window.npcAddBodyPartFromRegistry = function() {
    const n = _npc(); if (!n) return;
    const id = document.getElementById('npcBodyPartPicker')?.value;
    if (!id) return;
    const bp = (window._systemData?.bodyParts || []).find(b => b.id === id);
    if (!bp) return;
    n.partesDoCorpo.push({ ...JSON.parse(JSON.stringify(bp)), slots: bp.slots || 1 });
    renderNpcBodyPartsEditor();
};

window.npcAddBodyPartCustom = function() {
    const n = _npc(); if (!n) return;
    const nome = prompt('Nome da parte do corpo (ex.: Cauda, Asa, Tentáculo):');
    if (!nome || !nome.trim()) return;
    const icone = prompt('Ícone/emoji (opcional):') || '🦴';
    const slots = parseInt(prompt('Quantidade de slots desta parte:', '1')) || 1;
    n.partesDoCorpo.push({
        id: 'bp-custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        nome: nome.trim(), icone: icone.trim() || '🦴', slots,
        podeSegurar: false, podeEmpunhar: false, podeVestir: false, podeFixar: false,
        custom: true
    });
    renderNpcBodyPartsEditor();
};

/** Expande as partes em slots individuais (ex.: Mão 1, Mão 2). */
function _npcBodySlots(partes) {
    const slots = {};
    (partes || []).forEach(bp => {
        const qty = Math.max(1, parseInt(bp.slots) || 1);
        for (let i = 0; i < qty; i++) {
            const key = qty > 1 ? `${bp.id}_${i + 1}` : bp.id;
            slots[key] = { label: qty > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴', part: bp };
        }
    });
    return slots;
}

/* ===================================================================
   ITENS DO NPC — LISTAGEM
   =================================================================== */
export async function loadNpcInventory() {
    const listEl = document.getElementById('npcInventoryList');
    if (!listEl) return;
    const npcId = _npcId();

    if (!npcId) {
        listEl.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:10px;border:1px dashed var(--line);border-radius:8px">
            💾 Salve o NPC primeiro para poder criar e gerenciar itens (as partes do corpo acima já podem ser configuradas e serão salvas junto).
        </div>`;
        return;
    }

    listEl.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px">⏳ Carregando itens...</div>';
    try {
        const q = query(collection(db, 'items'), where('characterId', '==', npcId));
        const snap = await getDocs(q);
        const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        NI.items = items; NI.loadedFor = npcId;
        renderNpcInventoryList();
        // Reavaliar mecânicas com Verificação de Equipamento (booleano / cond. encadeada)
        if (typeof window.recalcStats === 'function') window.recalcStats();
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div style="color:var(--danger)">❌ Erro ao carregar itens do NPC.</div>';
    }
}
window.loadNpcInventory = loadNpcInventory;

function _itemPressure(item) {
    const base = item.pressaoOverride != null ? item.pressaoOverride
        : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));
    if (item.ehContainer) {
        const inside = NI.items.filter(i => i.parentItemId === item.id);
        const w = inside.reduce((s, i) => s + ((i.peso || 0) * Math.max(1, parseInt(i.quantidade) || 1)), 0);
        return base + (w * (item.multiplicadorPressao || 1));
    }
    return base * Math.max(1, parseInt(item.quantidade) || 1);
}

function renderNpcInventoryList() {
    const listEl = document.getElementById('npcInventoryList');
    const n = _npc();
    if (!listEl || !n) return;

    const top = NI.items.filter(i => !i.parentItemId);
    const equipped = top.filter(i => i.equipado);
    const loose = top.filter(i => !i.equipado);
    const pressao = equipped.reduce((s, i) => s + _itemPressure(i), 0);
    const slots = _npcBodySlots(n.partesDoCorpo);

    const row = (item, isEq) => {
        const img = item.imagem || item.imagemUrl;
        const slotLbl = isEq && item.slotAnatomico ? (slots[item.slotAnatomico]?.label || item.slotAnatomico) : '';
        const estado = isEq && item.estadoEquip ? (EQUIP_STATES[item.estadoEquip]?.label || item.estadoEquip) : '';
        return `<div class="inv-item-row ${isEq ? 'inv-equipped' : ''}" style="display:flex;align-items:center;padding:8px;gap:6px">
            ${img ? `<img src="${escapeHtml(img)}" style="max-height:1.5em;border-radius:4px;object-fit:contain">` : `<span>${_emoji(item.tipo)}</span>`}
            <div class="inv-item-info" style="flex:1">
                <span class="inv-item-name">${escapeHtml(item.nome || 'Sem nome')}</span>
                <span class="inv-item-meta">${escapeHtml(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)}${slotLbl ? ' | ' + escapeHtml(slotLbl) : ''}${estado ? ' | ' + estado : ''}</span>
            </div>
            <span class="inv-badge inv-badge-qty">×${Math.max(1, parseInt(item.quantidade) || 1)}</span>
            <div class="inv-item-actions" onclick="event.stopPropagation()" style="display:flex;gap:4px">
                ${isEq
                    ? `<button class="inv-btn" title="Desequipar" onclick="window.npcUnequipItem('${item.id}')">⬇️</button>`
                    : `<button class="inv-btn" title="Equipar" onclick="window.openNpcEquipModal('${item.id}')">⬆️</button>`}
                <button class="inv-btn" style="background:rgba(6,182,212,.12);color:var(--lr-arcane)" title="Transferir" onclick="window.openNpcTransferModal('${item.id}')">🔄</button>
                <button class="inv-btn" style="background:rgba(139,92,246,.12);color:var(--primary)" title="Editar" onclick="window.openNpcItemForm('${item.id}')">✏️</button>
                <button class="inv-btn inv-btn-delete" title="Excluir" onclick="window.deleteNpcItem('${item.id}')">🗑️</button>
            </div>
        </div>`;
    };

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="inv-badge" style="background:rgba(245,158,11,.15);color:var(--lr-gold);padding:3px 10px;border-radius:8px;font-size:.78rem;font-weight:700">⚖️ Pressão (equipados): ${pressao.toFixed(2)}</span>
        <button class="btn btn-success btn-small" onclick="window.openNpcItemForm(null)">➕ Criar Item</button>
    </div>`;

    html += `<div class="inv-section"><div class="inv-section-title">🎒 Equipados <span class="inv-section-count">${equipped.length}</span></div><div class="inv-section-grid">`;
    html += equipped.length ? equipped.map(i => row(i, true)).join('') : '<div class="inv-empty-small">Nenhum item equipado</div>';
    html += `</div></div>`;

    html += `<div class="inv-section" style="margin-top:12px"><div class="inv-section-title">📋 Itens Soltos <span class="inv-section-count">${loose.length}</span></div><div class="inv-section-grid">`;
    html += loose.length ? loose.map(i => row(i, false)).join('') : '<div class="inv-empty-small">Nenhum item solto</div>';
    html += `</div></div>`;

    // Itens dentro de containers (visão simples)
    const inside = NI.items.filter(i => i.parentItemId);
    if (inside.length) {
        html += `<div class="inv-section" style="margin-top:12px"><div class="inv-section-title">📂 Dentro de Containers <span class="inv-section-count">${inside.length}</span></div><div class="inv-section-grid">`;
        html += inside.map(i => row(i, false)).join('');
        html += `</div></div>`;
    }

    listEl.innerHTML = html;
}

/* ===================================================================
   CRIAR / EDITAR ITEM DO NPC
   =================================================================== */
window.openNpcItemForm = function(editItemId) {
    const n = _npc();
    const npcId = _npcId();
    if (!n) return;
    if (!npcId) { showAlert('⚠️ Salve o NPC antes de criar itens.', 'warning'); return; }

    const item = editItemId ? NI.items.find(i => i.id === editItemId) : null;
    const isEdit = !!item;

    document.getElementById('npcItemFormModal')?.remove();

    const partes = (n.partesDoCorpo && n.partesDoCorpo.length) ? n.partesDoCorpo : [];
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'npcItemFormModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item'} — ${escapeHtml(_npcNome())}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="nif_nome" class="inv-form-input" value="${escapeHtml(item?.nome || '')}" placeholder="Nome do item">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tipo</label>
                    <select id="nif_tipo" class="inv-form-select" onchange="window._npcToggleItemFormFields()">
                        ${['Objeto', 'Arma', 'Vestimenta', 'Acessório', 'Projétil', 'Container', 'Consumível', 'Relíquia'].map(t =>
                            `<option value="${t}" ${item?.tipo === t ? 'selected' : ''}>${_emoji(t)} ${t}</option>`).join('')}
                    </select>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Equipável em (partes do NPC)</label>
                    <select id="nif_equipavelEm" class="inv-form-select" multiple size="4">
                        ${partes.map(bp => {
                            const sel = Array.isArray(item?.equipavelEm) && item.equipavelEm.includes(bp.id) ? 'selected' : '';
                            return `<option value="${bp.id}" ${sel}>${bp.icone || '🦴'} ${escapeHtml(bp.nome)}</option>`;
                        }).join('')}
                    </select>
                    <small style="color:var(--muted);font-size:.8rem">Ctrl p/ múltiplos. Vazio = Livre.</small>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Forma de equipar</label>
                    <select id="nif_formaEquipar" class="inv-form-select">
                        <option value="" ${!item?.formaEquipar ? 'selected' : ''}>— Livre —</option>
                        <option value="segurar" ${item?.formaEquipar === 'segurar' ? 'selected' : ''}>Segurar</option>
                        <option value="empunhar" ${item?.formaEquipar === 'empunhar' ? 'selected' : ''}>Empunhar</option>
                        <option value="vestir" ${item?.formaEquipar === 'vestir' ? 'selected' : ''}>Vestir</option>
                        <option value="fixar" ${item?.formaEquipar === 'fixar' ? 'selected' : ''}>Fixar</option>
                    </select>
                </div>
                <div class="inv-form-group" id="nif_catArmaGroup" style="display:${item?.tipo === 'Arma' ? 'flex' : 'none'}">
                    <label class="inv-form-label">Categoria da Arma *</label>
                    <select id="nif_categoriaArma" class="inv-form-select">
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
                    <input type="number" id="nif_peso" class="inv-form-input" value="${item?.peso ?? 1}" min="0" step="0.1">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tamanho</label>
                    <input type="number" id="nif_tamanho" class="inv-form-input" value="${item?.tamanho ?? 1}" min="0">
                </div>
                <div class="inv-form-group" id="nif_qtyGroup" style="display:${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 'none' : 'flex'}">
                    <label class="inv-form-label">Quantidade</label>
                    <input type="number" id="nif_quantidade" class="inv-form-input" value="${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 1 : (item?.quantidade || 1)}" min="1">
                </div>
                <div id="nif_containerFields" class="inv-form-group inv-form-wide" style="display:${(item?.tipo === 'Container' || item?.ehContainer) ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px">
                    <div class="inv-form-group">
                        <label class="inv-form-label">⚖️ Peso Máximo</label>
                        <input type="number" id="nif_pesoMaximo" class="inv-form-input" value="${item?.pesoMaximoContainer || 10}" min="0" step="0.1">
                    </div>
                    <div class="inv-form-group">
                        <label class="inv-form-label">✖️ Mult. Pressão</label>
                        <input type="number" id="nif_multPressao" class="inv-form-input" value="${item?.multiplicadorPressao || 1}" min="0" step="0.01">
                    </div>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">💥 Fórmula de Dano</label>
                    <input type="text" id="nif_formulaDano" class="inv-form-input" value="${escapeHtml(item?.formulaDano || '')}" placeholder="Ex: 1d10 — só o dado; bônus numéricos vêm dos Valores Derivados">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="nif_desc" class="inv-form-textarea" rows="3">${escapeHtml(item?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Imagem (URL)</label>
                    <input type="text" id="nif_imagem" class="inv-form-input" value="${escapeHtml(item?.imagem || item?.imagemUrl || '')}" placeholder="https://...">
                </div>
                <div class="inv-form-group inv-form-wide">
                    ${(() => {
                        window._mechCache = (window._npcSys?.mechanics) || window._systemData?.mechanics || [];
                        return buildMechanicSelectorHTML('nifMecanicaIds', 'Mecânicas Vinculadas', item?.mecanicaIdsProprias || [], window._mechCache, 'item');
                    })()}
                </div>
            </div>
            ${isEdit ? `<input type="hidden" id="nif_editId" value="${item.id}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="window.saveNpcItemForm()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window._npcToggleItemFormFields = function() {
    const tipo = document.getElementById('nif_tipo')?.value;
    const cat = document.getElementById('nif_catArmaGroup');
    const qty = document.getElementById('nif_qtyGroup');
    const cont = document.getElementById('nif_containerFields');
    if (cat) cat.style.display = tipo === 'Arma' ? 'flex' : 'none';
    if (cont) cont.style.display = tipo === 'Container' ? 'grid' : 'none';
    if (qty) {
        if (tipo === 'Container' || tipo === 'Arma') {
            qty.style.display = 'none';
            const qi = document.getElementById('nif_quantidade'); if (qi) qi.value = 1;
        } else qty.style.display = 'flex';
    }
};

window.saveNpcItemForm = async function() {
    const nome = document.getElementById('nif_nome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }

    const npcId = _npcId();
    if (!npcId) { showAlert('⚠️ Salve o NPC antes de criar itens.', 'warning'); return; }

    const editId = document.getElementById('nif_editId')?.value || '';
    const tipo = document.getElementById('nif_tipo')?.value || 'Objeto';
    const isContainer = tipo === 'Container';
    const categoriaArma = document.getElementById('nif_categoriaArma')?.value || null;
    if (tipo === 'Arma' && !categoriaArma) { showAlert('⚠️ Selecione a categoria da arma', 'warning'); return; }

    const equipOpts = document.getElementById('nif_equipavelEm')?.selectedOptions;
    const equipavelEm = equipOpts ? Array.from(equipOpts).map(o => o.value) : [];

    let mecanicaIds = [];
    const mecEl = document.getElementById('field_nifMecanicaIds');
    if (mecEl) { try { mecanicaIds = JSON.parse(mecEl.value || '[]'); } catch { mecanicaIds = []; } }

    const old = editId ? NI.items.find(i => i.id === editId) : null;

    const itemData = {
        nome, tipo,
        categoriaArma: tipo === 'Arma' ? categoriaArma : null,
        peso: parseFloat(document.getElementById('nif_peso')?.value) || 1,
        tamanho: parseInt(document.getElementById('nif_tamanho')?.value) || 1,
        quantidade: (isContainer || tipo === 'Arma') ? 1 : Math.max(1, parseInt(document.getElementById('nif_quantidade')?.value) || 1),
        descricao: document.getElementById('nif_desc')?.value?.trim() || '',
        formulaDano: document.getElementById('nif_formulaDano')?.value?.trim() || '',
        imagem: document.getElementById('nif_imagem')?.value?.trim() || '',
        equipavelEm: equipavelEm.length ? equipavelEm : null,
        formaEquipar: document.getElementById('nif_formaEquipar')?.value || null,
        mecanicaIdsProprias: mecanicaIds,
        characterId: npcId,
        ownerType: 'npc',
        ownerUid: old?.ownerUid || S.currentUser?.uid || '',
        ownerId: old?.ownerId || S.currentUser?.uid || '',
        ehContainer: isContainer,
        pesoMaximoContainer: isContainer ? (parseFloat(document.getElementById('nif_pesoMaximo')?.value) || 10) : null,
        multiplicadorPressao: isContainer ? (parseFloat(document.getElementById('nif_multPressao')?.value) || 1) : null,
        pressaoBase: parseFloat(document.getElementById('nif_peso')?.value) || 1,
        lastModified: new Date().toISOString()
    };

    try {
        if (editId) {
            await setDoc(doc(db, 'items', editId), itemData, { merge: true });
        } else {
            itemData.equipado = false;
            itemData.slotAnatomico = null;
            itemData.estadoEquip = null;
            itemData.parentItemId = null;
            itemData.criadoPor = 'mestre';
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await setDoc(doc(db, 'items', newId), itemData);
        }

        // 📜 Log — mesma lógica dos demais logs de inventário do painel
        addLog(S.currentUser?.email,
            editId ? `🎒 Item "${nome}" do NPC editado pelo Mestre` : `🎒 Item "${nome}" adicionado ao NPC pelo Mestre`,
            _npcNome(), 'items', {
                charId: npcId, mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário',
                changes: [
                    { label: 'NPC', from: '', to: _npcNome() },
                    { label: 'Item', from: editId ? (old?.nome || nome) : '—', to: nome },
                    { label: 'Tipo', from: editId ? (old?.tipo || '') : '', to: tipo },
                    { label: 'Quantidade', from: editId ? String(old?.quantidade ?? '') : '', to: String(itemData.quantidade) }
                ]
            });

        showAlert('✅ Item salvo!', 'success');
        document.getElementById('npcItemFormModal')?.remove();
        await loadNpcInventory();
    } catch (e) {
        console.error('❌ Erro ao salvar item do NPC:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window.deleteNpcItem = async function(itemId) {
    if (!confirm('Excluir este item?')) return;
    const item = NI.items.find(i => i.id === itemId);
    try {
        await deleteDoc(doc(db, 'items', itemId));
        addLog(S.currentUser?.email, `🗑️ Item "${item?.nome || itemId}" removido do NPC pelo Mestre`,
            _npcNome(), 'items', {
                charId: _npcId(), mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário',
                changes: [
                    { label: 'NPC', from: _npcNome(), to: _npcNome() },
                    { label: 'Item', from: item?.nome || itemId, to: '—' },
                    { label: 'Quantidade', from: String(item?.quantidade ?? '—'), to: '—' }
                ]
            });
        showAlert('✅ Item excluído', 'success');
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
};

/* ===================================================================
   EQUIPAR / DESEQUIPAR
   =================================================================== */
window.openNpcEquipModal = function(itemId) {
    const n = _npc();
    const item = NI.items.find(i => i.id === itemId);
    if (!n || !item) return;

    const slots = _npcBodySlots(n.partesDoCorpo);
    const slotKeys = Object.keys(slots);
    if (!slotKeys.length) { showAlert('⚠️ Defina as partes do corpo do NPC antes de equipar itens.', 'warning'); return; }

    // Slots ocupados por outros itens equipados
    const ocupados = new Set(NI.items.filter(i => i.equipado && i.id !== itemId && i.slotAnatomico).map(i => i.slotAnatomico));

    // Restringe às partes permitidas do item, se definidas
    const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;

    const opts = slotKeys.map(k => {
        const s = slots[k];
        const bloqueadoPorParte = permitidas && !permitidas.has(s.part.id);
        const ocupado = ocupados.has(k);
        return `<option value="${k}" ${bloqueadoPorParte || ocupado ? 'disabled' : ''}>${s.icon} ${escapeHtml(s.label)}${ocupado ? ' (ocupado)' : ''}${bloqueadoPorParte ? ' (não permitido)' : ''}</option>`;
    }).join('');

    const forma = item.formaEquipar;
    const estadoOpts = Object.entries(EQUIP_STATES).map(([v, s]) => {
        const map = { empunhado: 'empunhar', segurar: 'segurar', vestido: 'vestir', fixado: 'fixar' };
        const bloqueado = forma && map[v] !== forma;
        return `<option value="${v}" ${bloqueado ? 'disabled' : ''} ${!bloqueado && forma ? 'selected' : ''}>${s.icon} ${s.label}</option>`;
    }).join('');

    document.getElementById('npcEquipModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'npcEquipModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:420px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">⬆️ Equipar: ${escapeHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div class="inv-form-group"><label class="inv-form-label">Slot anatômico</label>
                <select id="npcEquipSlot" class="inv-form-select">${opts}</select></div>
            <div class="inv-form-group" style="margin-top:10px"><label class="inv-form-label">Estado</label>
                <select id="npcEquipEstado" class="inv-form-select">${estadoOpts}</select></div>
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="window.confirmNpcEquip('${itemId}')">✅ Equipar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.confirmNpcEquip = async function(itemId) {
    const item = NI.items.find(i => i.id === itemId); if (!item) return;
    const slot = document.getElementById('npcEquipSlot')?.value;
    const estado = document.getElementById('npcEquipEstado')?.value;
    if (!slot || !estado) return;
    try {
        await setDoc(doc(db, 'items', itemId), {
            equipado: true, slotAnatomico: slot, estadoEquip: estado, parentItemId: null,
            lastModified: new Date().toISOString()
        }, { merge: true });
        addLog(S.currentUser?.email, `🎒 Item "${item.nome}" equipado no NPC`, _npcNome(), 'items', {
            charId: _npcId(), mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário',
            changes: [{ label: 'Equipado', from: 'Não', to: `Sim (${slot} / ${estado})` }]
        });
        document.getElementById('npcEquipModal')?.remove();
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.npcUnequipItem = async function(itemId) {
    const item = NI.items.find(i => i.id === itemId); if (!item) return;
    try {
        await setDoc(doc(db, 'items', itemId), {
            equipado: false, slotAnatomico: null, estadoEquip: null,
            lastModified: new Date().toISOString()
        }, { merge: true });
        addLog(S.currentUser?.email, `🎒 Item "${item.nome}" desequipado do NPC`, _npcNome(), 'items', {
            charId: _npcId(), mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário',
            changes: [{ label: 'Equipado', from: 'Sim', to: 'Não' }]
        });
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
};

/* ===================================================================
   TRANSFERÊNCIA (a partir do inventário do NPC)
   — busca/filtro em NPCs (todos ou da mesa), personagens e caixa
   =================================================================== */
window.openNpcTransferModal = async function(itemId) {
    const item = NI.items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('npcTransferModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'npcTransferModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:550px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">🔄 Transferir: ${escapeHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div style="display:flex;flex-direction:column;gap:12px">
                <input type="text" id="nt_search" class="inv-form-input" placeholder="🔍 Buscar por nome, papel ou e-mail..." oninput="window._filterNpcTransfer()">
                <div class="sub-tabs" style="display:flex;overflow-x:auto;gap:4px">
                    <button class="sub-tab-btn active" onclick="window._setNpcTransferScope('npcs_mesa', this)" style="padding:6px 10px;font-size:.85rem">NPCs da Mesa</button>
                    <button class="sub-tab-btn" onclick="window._setNpcTransferScope('npcs_todos', this)" style="padding:6px 10px;font-size:.85rem">Todos os NPCs</button>
                    <button class="sub-tab-btn" onclick="window._setNpcTransferScope('chars_mesa', this)" style="padding:6px 10px;font-size:.85rem">Personagens da Mesa</button>
                    <button class="sub-tab-btn" onclick="window._setNpcTransferScope('chars_todos', this)" style="padding:6px 10px;font-size:.85rem">Todos Personagens</button>
                    <button class="sub-tab-btn" onclick="window._setNpcTransferScope('caixa', this)" style="padding:6px 10px;font-size:.85rem">Caixa do Mestre</button>
                </div>
                <div id="nt_results" style="display:grid;gap:8px;max-height:40vh;overflow-y:auto;padding:4px">
                    <div style="text-align:center;color:var(--muted)">Carregando...</div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    window._npcTransferData = { itemId, scope: 'npcs_mesa', npcs: [], chars: [] };

    try {
        const [npcSnap, charSnap] = await Promise.all([
            getDocs(collection(db, 'npcs')),
            getDocs(S.currentMesaId ? query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)) : query(collection(db, 'char'), where('ownerUid', '==', S.currentUser?.uid || '')))
        ]);
        const npcs = []; npcSnap.forEach(d => { const data = d.data(); npcs.push({ id: d.id, nome: data.nome || 'Sem nome', papel: data.papel || '', tipo: data.tipo || 'npc', mesaId: data.mesaId || null, vinculos: data.vinculos || [] }); });
        const chars = []; charSnap.forEach(d => { const data = d.data(); const f = data.fields || {}; chars.push({ id: d.id, nome: f.nome || data.nome || 'Sem nome', ownerUid: data.ownerUid || '', ownerEmail: data.ownerEmail || data.userEmail || '', mesaId: data.mesaId || null }); });
        window._npcTransferData.npcs = npcs;
        window._npcTransferData.chars = chars;
        window._filterNpcTransfer();
    } catch (e) {
        const r = document.getElementById('nt_results');
        if (r) r.innerHTML = `<div style="text-align:center;color:#ef4444">❌ Erro: ${escapeHtml(e.message)}</div>`;
    }
};

window._setNpcTransferScope = function(scope, btn) {
    window._npcTransferData.scope = scope;
    btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window._filterNpcTransfer();
};

window._filterNpcTransfer = function() {
    const data = window._npcTransferData; if (!data) return;
    const search = (document.getElementById('nt_search')?.value || '').toLowerCase();
    const el = document.getElementById('nt_results'); if (!el) return;
    const mesaId = _npcMesaId() || S.currentMesaId || null;
    const currentNpcId = _npcId();

    if (data.scope === 'caixa') {
        if (!mesaId) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Vincule o NPC a uma mesa para usar a Caixa do Mestre.</div>'; return; }
        el.innerHTML = `<div class="inv-transfer-target inv-transfer-target-master" style="cursor:pointer"
            onclick="window._executeNpcTransfer('${data.itemId}','__caixa_mestre__${mesaId}','caixa')">
            <div class="inv-transfer-target-name">📦 Caixa do Mestre</div>
            <div class="inv-transfer-target-meta">Mesa vinculada</div></div>`;
        return;
    }

    let list, isNpcScope = data.scope.startsWith('npcs');
    if (isNpcScope) {
        list = data.npcs.filter(x => x.id !== currentNpcId);
        if (data.scope === 'npcs_mesa') {
            list = mesaId ? list.filter(x => x.mesaId === mesaId || (x.vinculos || []).some(v => v.tipo === 'mesa' && v.id === mesaId)) : [];
        }
        if (search) list = list.filter(x => x.nome.toLowerCase().includes(search) || (x.papel || '').toLowerCase().includes(search));
    } else {
        list = data.chars;
        if (data.scope === 'chars_mesa') list = mesaId ? list.filter(c => c.mesaId === mesaId) : [];
        if (search) list = list.filter(c => c.nome.toLowerCase().includes(search) || (c.ownerEmail || '').toLowerCase().includes(search));
    }

    if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Nenhum alvo encontrado</div>'; return; }

    el.innerHTML = list.slice(0, 100).map(t => isNpcScope
        ? `<div class="inv-transfer-target" style="cursor:pointer" onclick="window._executeNpcTransfer('${data.itemId}','${t.id}','npc')">
             <div class="inv-transfer-target-name">${t.tipo === 'criatura' ? '🐉' : '👤'} ${escapeHtml(t.nome)}</div>
             ${t.papel ? `<div class="inv-transfer-target-meta">${escapeHtml(t.papel)}</div>` : ''}</div>`
        : `<div class="inv-transfer-target" style="cursor:pointer" onclick="window._executeNpcTransfer('${data.itemId}','${t.id}','char')">
             <div class="inv-transfer-target-name">🎭 ${escapeHtml(t.nome)}</div>
             ${t.ownerEmail ? `<div class="inv-transfer-target-meta">👤 ${escapeHtml(t.ownerEmail)}</div>` : ''}</div>`
    ).join('');
};

window._executeNpcTransfer = async function(itemId, targetId, targetKind) {
    if (!confirm('Transferir este item para o destino selecionado?')) return;
    const item = NI.items.find(i => i.id === itemId);
    const nomeItem = item?.nome || itemId;
    try {
        const updateData = {
            characterId: targetId,
            equipado: false, slotAnatomico: null, estadoEquip: null, parentItemId: null,
            lastModified: new Date().toISOString()
        };
        if (targetKind === 'npc') {
            updateData.ownerType = 'npc';
        } else if (targetKind === 'char') {
            updateData.ownerType = 'char';
            try {
                const snap = await getDoc(doc(db, 'char', targetId));
                if (snap.exists()) {
                    const td = snap.data();
                    updateData.ownerUid = td.ownerUid || '';
                    updateData.ownerId = td.ownerUid || '';
                }
            } catch (e) { /* ignore */ }
        } else {
            updateData.ownerType = 'caixa';
            updateData.ownerUid = S.currentUser?.uid || '';
            updateData.ownerId = S.currentUser?.uid || '';
        }

        await setDoc(doc(db, 'items', itemId), updateData, { merge: true });

        // 📜 Logs (origem e destino), no mesmo padrão do painel
        const changes = [
            { label: 'Item', from: nomeItem, to: nomeItem },
            { label: 'Origem', from: `NPC ${_npcNome()}`, to: '' },
            { label: 'Destino (ID)', from: '', to: String(targetId) }
        ];
        addLog(S.currentUser?.email, `🔁 Item "${nomeItem}" transferido do NPC pelo Mestre`, _npcNome(), 'items', {
            charId: targetId, mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário', changes
        });
        addLog(S.currentUser?.email, `🔁 Item "${nomeItem}" saiu do inventário do NPC (transferência)`, _npcNome(), 'items', {
            charId: _npcId(), mesaId: _npcMesaId() || S.currentMesaId || null, category: 'Inventário', changes
        });

        showAlert('✅ Item transferido com sucesso!', 'success');
        document.getElementById('npcTransferModal')?.remove();
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
};

console.log('✅ [NPC] Módulo de Inventário do NPC carregado.');
