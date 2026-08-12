// =============================================
// FICHA DE NPC — Aba Inventário + Partes do Corpo
// Gerencia itens (coleção 'items' com characterId = npcId),
// anatomia/slots do NPC e transferências (NPC ⇄ NPC / Personagem / Caixa).
// Respeita a lógica de logs do painel (addLog → coleção 'logs').
// =============================================
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, query, where, updateDoc, writeBatch } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
// Os construtores de seletor do Criador (mecânicas, VDs com Equação de Valor,
// status vitais, atributos, perícias, condições) — o formulário de item mostra
// exatamente os mesmos controles do cadastro de Equipamento.
import * as SEL from '../../painel-criador/js/painel-mechanics.js';
import {
    ESTADO_EQUIP, FORMA_EQUIP, qtdDe, ehContainer, escolherQtd, dividirPilha,
    htmlInventario, tratarClique, iniciarArrasto, tplDoItem,
} from '../../shared/inventario-motor.js?v=2';
import {
    camposDaInstancia, valorDoItem, htmlCampo, coletarCampos, aplicarVisibilidade,
    instanciarDoModelo,
} from '../../shared/equip-campos.js?v=3';

// Estado local. `abertos`/`contAbertos` são do motor de inventário
// (shared/inventario-motor.js), o mesmo da Ficha de Combate do Tabuleiro.
const NI = { items: [], loadedFor: null, abertos: new Set(), contAbertos: new Set(), ctx: null };
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
            // partId é o que shared/equip-slots.js espera; `part` continua para o resto daqui
            slots[key] = { label: qty > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴', part: bp, partId: bp.id };
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
        items.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        if (NI.loadedFor !== npcId) { NI.abertos.clear(); NI.contAbertos.clear(); }
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

/**
 * Contexto do motor de inventário — mesmo motor da Ficha de Combate do
 * Tabuleiro (shared/inventario-motor.js). O que muda aqui: além de arrastar,
 * cada linha traz os botões do Mestre (editar / transferir / excluir), e toda
 * escrita passa pelo log do painel.
 */
function _ctxInventario() {
    const listEl = document.getElementById('npcInventoryList');
    if (!listEl) return null;
    if (NI.ctx && NI.ctx.raiz === listEl) return NI.ctx;

    NI.ctx = {
        raiz: listEl,
        get itens() { return NI.items; },
        get sys() { return window._npcSys || window._systemData || null; },
        abertos: NI.abertos,
        contAbertos: NI.contAbertos,
        dica: 'arraste ⠿: equipar/desequipar entre seções · guardar em contêiner · juntar pilha igual',
        rotuloSlot: (k) => _npcBodySlots(_npc()?.partesDoCorpo)[k]?.label || k,
        botoes: (i) => `
            <button type="button" class="lr-inv-btn" title="Editar item" data-npcitem="editar" data-id="${escapeHtml(i.id)}">✏️</button>
            <button type="button" class="lr-inv-btn" title="Transferir" data-npcitem="transferir" data-id="${escapeHtml(i.id)}">🔄</button>
            <button type="button" class="lr-inv-btn perigo" title="Excluir" data-npcitem="excluir" data-id="${escapeHtml(i.id)}">🗑️</button>`,
        repintar: renderNpcInventoryList,
        acoes: {
            equipar: (id) => window.openNpcEquipModal(id),
            desequipar: (id) => window.npcUnequipItem(id),
            mover: moverItemNpc,
            fundir: fundirPilhasNpc,
            qtd: setQtdNpc,
        },
    };

    // Delegação: cliques do motor (expandir, contêiner, ±) e os botões do Mestre
    listEl.addEventListener('click', e => {
        const bt = e.target.closest('[data-npcitem]');
        if (bt) {
            const { npcitem, id } = bt.dataset;
            if (npcitem === 'editar') window.openNpcItemForm(id);
            else if (npcitem === 'transferir') window.openNpcTransferModal(id);
            else if (npcitem === 'excluir') window.deleteNpcItem(id);
            return;
        }
        tratarClique(NI.ctx, e);
    });
    listEl.addEventListener('pointerdown', e => {
        const grab = e.target.closest?.('[data-grab]');
        if (grab) iniciarArrasto(NI.ctx, grab, e);
    });
    return NI.ctx;
}

// exportado para __check-npc-inventario.html (pintar a lista sem Firestore)
export function renderNpcInventoryList() {
    const ctx = _ctxInventario();
    if (!ctx || !_npc()) return;
    ctx.raiz.innerHTML = htmlInventario(ctx);
}

/* ---- Ações de arrasto (mesmas do Tabuleiro, com o log do painel) ---- */

/** ± na quantidade da pilha. */
async function setQtdNpc(itemId, delta) {
    const i = NI.items.find(x => x.id === itemId); if (!i) return;
    const q = Math.max(1, qtdDe(i) + delta);
    if (q === qtdDe(i)) return;
    i.quantidade = q;              // otimista: a lista repinta na hora
    renderNpcInventoryList();
    try { await updateDoc(doc(db, 'items', itemId), { quantidade: q }); }
    catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); await loadNpcInventory(); }
}

/** Soltar sobre pilha idêntica: soma as quantidades e junta. */
async function fundirPilhasNpc(origemId, alvoId) {
    const a = NI.items.find(x => x.id === origemId);
    const b = NI.items.find(x => x.id === alvoId);
    if (!a || !b) return;
    const q = escolherQtd(a, `Juntar quantos "${a.nome || 'item'}" nesta pilha?`);
    if (q == null) return;
    const plano = dividirPilha(a, q);
    const total = qtdDe(b) + plano.qtd;
    try {
        const lote = writeBatch(db);
        lote.update(doc(db, 'items', b.id), { quantidade: total });
        if (plano.move) lote.delete(doc(db, 'items', a.id));
        else lote.update(doc(db, 'items', a.id), { quantidade: plano.restante });
        await lote.commit();
        _logItem(`🧺 ${plano.qtd}× "${a.nome || 'Item'}" juntado na pilha do NPC`, [
            { label: 'Item', from: a.nome || origemId, to: b.nome || alvoId },
            { label: 'Quantidade', from: String(qtdDe(b)), to: String(total) },
        ]);
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/** Soltar em contêiner ('cont:<id>') ou fora dele ('root'). */
async function moverItemNpc(itemId, alvo) {
    const i = NI.items.find(x => x.id === itemId); if (!i) return;

    if (alvo === 'root') {
        if (!i.parentItemId) return;
        try {
            await updateDoc(doc(db, 'items', itemId), { parentItemId: null });
            _logItem(`📤 Item "${i.nome || itemId}" tirado do contêiner`, [
                { label: 'Item', from: i.nome || itemId, to: i.nome || itemId },
                { label: 'Contêiner', from: 'dentro', to: '—' },
            ]);
            await loadNpcInventory();
        } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
        return;
    }

    const contId = alvo.slice(5);
    if (contId === itemId || i.parentItemId === contId) return;
    const c = NI.items.find(x => x.id === contId); if (!c) return;
    if (ehContainer(i)) { showAlert('⚠️ Contêiner não entra em contêiner', 'warning'); return; }

    const q = escolherQtd(i, `Mover quantos "${i.nome || 'item'}" para ${c.nome || 'o contêiner'}?`);
    if (q == null) return;
    const plano = dividirPilha(i, q);
    const dentro = { parentItemId: contId, equipado: false, estadoEquip: null, slotAnatomico: null, slotsOcupados: [] };
    try {
        if (plano.move) {
            await updateDoc(doc(db, 'items', itemId), dentro);
        } else {
            // divide a pilha: o original fica com o resto, o clone entra no contêiner
            const lote = writeBatch(db);
            lote.update(doc(db, 'items', itemId), { quantidade: plano.restante });
            const { id: _id, ...campos } = i;
            const novoId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            lote.set(doc(db, 'items', novoId), { ...campos, id: novoId, quantidade: plano.qtd, ...dentro });
            await lote.commit();
        }
        NI.contAbertos.add(contId);
        _logItem(`📦 ${plano.qtd}× "${i.nome || 'Item'}" guardado em "${c.nome || 'contêiner'}"`, [
            { label: 'Item', from: i.nome || itemId, to: i.nome || itemId },
            { label: 'Contêiner', from: '—', to: c.nome || contId },
            { label: 'Quantidade', from: String(qtdDe(i)), to: String(plano.qtd) },
        ]);
        await loadNpcInventory();
    } catch (e) { console.error(e); showAlert('❌ Erro: ' + e.message, 'danger'); }
}

/** Log de inventário no padrão do painel (mesmos campos dos demais). */
function _logItem(acao, changes) {
    addLog(S.currentUser?.email, acao, _npcNome(), 'items', {
        charId: _npcId(), mesaId: _npcMesaId() || S.currentMesaId || null,
        category: 'Inventário',
        changes: [{ label: 'NPC', from: _npcNome(), to: _npcNome() }, ...changes],
    });
}

/* ===================================================================
   CRIAR / EDITAR ITEM DO NPC
   =================================================================== */
/** Registros que os seletores do formulário consomem. */
function _cachesDoForm() {
    const n = _npc();
    const sys = window._npcSys || window._systemData || {};
    return {
        derivedValues: sys.derivedValues || [],
        vitalStats: sys.vitalStats || [],
        skills: sys.skills || [],
        mechanics: sys.mechanics || window._systemData?.mechanics || [],
        conditions: sys.conditions || window._systemData?.conditions || [],
        // Partes do NPC mandam no "Equipável em": a anatomia é dele, não do catálogo
        bodyParts: (n?.partesDoCorpo && n.partesDoCorpo.length) ? n.partesDoCorpo : (sys.bodyParts || []),
    };
}

const _catalogo = () => (window._npcSys?.equipment || window._systemData?.equipment || [])
    .filter(t => t.publicado !== false);

/** Redesenha os campos do formulário para um item (ou semente de modelo). */
function _pintarCamposItem(item, modelo) {
    const corpoEl = document.querySelector('#npcItemFormModal .inv-modal-body');
    const grade = corpoEl?.querySelector('.inv-form-grid');
    if (!grade) return;
    const caches = _cachesDoForm();
    window._mechCache = caches.mechanics;   // os construtores de seletor leem daqui
    grade.innerHTML = camposDaInstancia()
        .map(f => htmlCampo(f, valorDoItem(item, f), { sel: SEL, caches, modelo })).join('');

    const nota = corpoEl.querySelector('[data-nota-modelo]');
    nota.innerHTML = modelo
        ? `<div class="inv-form-nota">📘 Instância de <b>${escapeHtml(modelo.nome || 'modelo do catálogo')}</b> —
            o que você mudar aqui vale <b>só para este item</b>. Campo em branco continua herdando do modelo.</div>`
        : '';
    corpoEl.querySelector('#nif_modeloId').value = modelo?.id || '';
    aplicarVisibilidade(corpoEl);
}

/**
 * Formulário de item — MESMOS campos do cadastro de Equipamento do Painel do
 * Criador (shared/equip-campos.js), só que gravando em `items/<id>`: mexe
 * nesta peça e em mais nenhuma, o catálogo fica intacto.
 *
 * Campo deixado em branco continua HERDANDO do modelo do catálogo (o motor lê
 * `instancia.campo ?? modelo.campo`), e o placeholder mostra o que seria
 * herdado — por isso o formulário não vem pré-preenchido com o modelo.
 */
window.openNpcItemForm = function(editItemId) {
    const n = _npc();
    const npcId = _npcId();
    if (!n) return;
    if (!npcId) { showAlert('⚠️ Salve o NPC antes de criar itens.', 'warning'); return; }

    const item = editItemId ? NI.items.find(i => i.id === editItemId) : null;
    const isEdit = !!item;
    const sys = window._npcSys || window._systemData || {};
    const modelo = item ? tplDoItem(item, sys) : null;

    // Buscar no catálogo só ao CRIAR: trocar o modelo de um item que já existe
    // apagaria o que o Mestre ajustou nele.
    const cat = _catalogo();
    const buscaHtml = (!isEdit && cat.length) ? `
        <div class="inv-form-catalogo">
            <label class="inv-form-label" for="nif_buscaCat">📚 Partir de um equipamento do catálogo</label>
            <input type="search" id="nif_buscaCat" class="inv-form-input" autocomplete="off"
                placeholder="🔍 Buscar por nome, tipo ou tag — ou deixe em branco para item personalizado"
                oninput="window._npcFiltrarCatalogo()">
            <select id="nif_listaCat" class="inv-form-select" size="6"
                onchange="window._npcUsarModelo(this.value)"></select>
            <small class="inv-form-hint">O item nasce vinculado ao modelo: o que você não preencher
                continua seguindo o catálogo.</small>
        </div>` : '';

    document.getElementById('npcItemFormModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'npcItemFormModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:760px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item'} — ${escapeHtml(_npcNome())}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${buscaHtml}
            <div data-nota-modelo></div>
            <div class="inv-form-grid"></div>
            <input type="hidden" id="nif_modeloId" value="${escapeHtml(item?.modeloId || '')}">
            ${isEdit ? `<input type="hidden" id="nif_editId" value="${escapeHtml(item.id)}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="window.saveNpcItemForm()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);

    _pintarCamposItem(item, modelo);
    if (!isEdit && cat.length) window._npcFiltrarCatalogo();

    // Tipo e "É Container?" abrem/fecham os campos dependentes
    const corpoEl = modal.querySelector('.inv-modal-body');
    corpoEl.addEventListener('change', e => {
        if (e.target.id === 'field_tipo' || e.target.id === 'field_ehContainer') aplicarVisibilidade(corpoEl);
    });
};

/** Filtra o catálogo por nome, tipo ou tag. Sem busca, mostra tudo. */
window._npcFiltrarCatalogo = function() {
    const lista = document.getElementById('nif_listaCat');
    if (!lista) return;
    const q = (document.getElementById('nif_buscaCat')?.value || '').trim().toLowerCase();
    const casa = (t) => !q || [t.nome, t.tipo, ...(t.tags || [])]
        .some(v => String(v || '').toLowerCase().includes(q));
    const achados = _catalogo().filter(casa)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    lista.innerHTML = achados.length
        ? achados.slice(0, 200).map(t => {
            const det = [t.tipo, t.liga != null ? 'Liga ' + t.liga : '', t.formulaDano].filter(Boolean).join(' · ');
            return `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome || 'Sem nome')}${det ? ' — ' + escapeHtml(det) : ''}</option>`;
        }).join('')
        : '<option value="" disabled>Nenhum equipamento encontrado</option>';
};

/** Escolheu um modelo: semeia os campos e vincula a instância a ele. */
window._npcUsarModelo = function(templateId) {
    const tpl = _catalogo().find(t => t.id === templateId);
    if (!tpl) return;
    _pintarCamposItem(instanciarDoModelo(tpl), tpl);
};

window.saveNpcItemForm = async function() {
    const npcId = _npcId();
    if (!npcId) { showAlert('⚠️ Salve o NPC antes de criar itens.', 'warning'); return; }

    const campos = camposDaInstancia();
    const dados = coletarCampos(campos);

    const nome = String(dados.nome || '').trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    if (dados.tipo === 'Arma' && !dados.categoriaArma) { showAlert('⚠️ Selecione a categoria da arma', 'warning'); return; }

    const editId = document.getElementById('nif_editId')?.value || '';
    const old = editId ? NI.items.find(i => i.id === editId) : null;
    const isContainer = dados.tipo === 'Container' || !!dados.ehContainer;

    const itemData = {
        ...dados,
        nome,
        // A instância guarda a imagem em `imagem`; `imagemUrl` é chave do catálogo
        imagem: dados.imagemUrl || '',
        // Mecânicas da instância não se misturam com as do modelo
        mecanicaIdsProprias: dados.mecanicaIds || [],
        ehContainer: isContainer,
        equipavelEm: (dados.equipavelEm || []).length ? dados.equipavelEm : null,
        formaEquipar: dados.formaEquipar || null,
        categoriaArma: dados.tipo === 'Arma' ? dados.categoriaArma : null,
        peso: Number(dados.peso) || 1,
        tamanho: Number(dados.tamanho) || 1,
        pressaoBase: dados.pressaoBase != null ? Number(dados.pressaoBase) : (Number(dados.peso) || 1),
        // Vínculo com o catálogo: é ele que faz campo em branco herdar do modelo
        modeloId: document.getElementById('nif_modeloId')?.value || null,
        characterId: npcId,
        ownerType: 'npc',
        ownerUid: old?.ownerUid || S.currentUser?.uid || '',
        ownerId: old?.ownerId || S.currentUser?.uid || '',
        lastModified: new Date().toISOString(),
    };
    delete itemData.imagemUrl;
    delete itemData.mecanicaIds;
    if (!isContainer) { itemData.pesoMaximoContainer = null; itemData.multiplicadorPressao = null; itemData.capacidadeContainer = null; }
    // Arma e contêiner não empilham; a quantidade da instância não vem do formulário
    itemData.quantidade = (isContainer || dados.tipo === 'Arma') ? 1 : Math.max(1, parseInt(old?.quantidade) || 1);

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
                    { label: 'Tipo', from: editId ? (old?.tipo || '') : '', to: dados.tipo || '' },
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
    // Um item de vários slots (armadura completa, arma de duas mãos) bloqueia todos.
    const ocupados = new Set(NI.items.filter(i => i.equipado && i.id !== itemId)
        .flatMap(i => window.EquipSlots.slotsDoItem(i)));

    // Restringe às partes permitidas do item, se definidas
    const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;

    const opts = slotKeys.map(k => {
        const s = slots[k];
        const bloqueadoPorParte = permitidas && !permitidas.has(s.part.id);
        const ocupado = ocupados.has(k);
        return `<option value="${k}" ${bloqueadoPorParte || ocupado ? 'disabled' : ''}>${s.icon} ${escapeHtml(s.label)}${ocupado ? ' (ocupado)' : ''}${bloqueadoPorParte ? ' (não permitido)' : ''}</option>`;
    }).join('');

    const forma = item.formaEquipar;
    const estadoOpts = Object.entries(ESTADO_EQUIP).map(([v, rot]) => {
        const [icone, formaDoEstado] = FORMA_EQUIP[v];
        const bloqueado = forma && formaDoEstado !== forma;
        return `<option value="${v}" ${bloqueado ? 'disabled' : ''} ${!bloqueado && forma ? 'selected' : ''}>${icone} ${rot}</option>`;
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

    const n = _npc();
    const bodySlots = _npcBodySlots(n?.partesDoCorpo);
    const nomeParte = pid => (n?.partesDoCorpo || []).find(b => b.id === pid)?.nome || pid;
    const plano = window.EquipSlots.planejarEquipar(item, slot, NI.items, bodySlots, {
        catalog: window._npcSys?.equipment || window._systemData?.equipment,
        labelParte: nomeParte,
    });
    if (!plano.ok) {
        showAlert(`⚠️ "${item.nome}" precisa de slots ocupados: ${plano.faltando.join(', ')}`, 'warning');
        return;
    }

    try {
        await setDoc(doc(db, 'items', itemId), {
            equipado: true, slotAnatomico: slot, slotsOcupados: plano.extras,
            estadoEquip: estado, parentItemId: null,
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
            equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null,
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
            equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null, parentItemId: null,
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
