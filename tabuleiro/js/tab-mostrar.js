// =============================================
// TABULEIRO — "Mostrar" (NPCs, Equipamentos, Caixa do Mestre)
// + Ficha rápida de NPC + entrega de itens ao inventário
// =============================================
import { db, collection, doc, getDoc, getDocs, addDoc, updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty } from './tab-state.js';
import { abrirModal, fecharModal } from './tab-main.js';
import { addObj, updObj, delObj, vincularNpcNaMesa } from './tab-objects.js';
import { screenToWorld } from './tab-render.js';

let equipCatalogo = null;
let caixaItens = null;

export function initMostrar() {
    window.tbAbrirMostrar = abrirMostrar;
    window.tbMenuMostrar = menuMostrar;
    window.tbClickMostrar = clickMostrar;
    window.tbAbrirNpcModal = abrirNpcModal;
}

function caixaId() { return '__caixa_mestre__' + T.mesaId; }

async function carregarEquip() {
    if (equipCatalogo) return equipCatalogo;
    const snap = await getDocs(collection(db, 'system/data/equipment'));
    equipCatalogo = [];
    snap.forEach(d => { const x = d.data(); if (x.publicado !== false) equipCatalogo.push({ id: d.id, ...x }); });
    equipCatalogo.sort((a, b) => (a.nome||'').localeCompare(b.nome||''));
    return equipCatalogo;
}
async function carregarCaixa() {
    const snap = await getDocs(collection(db, 'items'));
    caixaItens = [];
    snap.forEach(d => { const x = d.data(); if (x.characterId === caixaId()) caixaItens.push({ id: d.id, ...x }); });
    return caixaItens;
}

// ===== MODAL "MOSTRAR" =====
async function abrirMostrar() {
    abrirModal('🎁 Mostrar na mesa', '<div class="tb-muted" style="padding:20px;text-align:center">Carregando registros...</div>', true);
    try {
        const [equips, caixa] = await Promise.all([carregarEquip(), carregarCaixa()]);
        const abas = `
            <div class="tb-tabs">
                <button class="tb-tab active" data-aba="npcs" onclick="tbMostrarAba('npcs',this)">👹 NPCs (${T.npcs.length})</button>
                <button class="tb-tab" data-aba="equip" onclick="tbMostrarAba('equip',this)">⚔️ Equipamentos (${equips.length})</button>
                <button class="tb-tab" data-aba="caixa" onclick="tbMostrarAba('caixa',this)">📦 Caixa do Mestre (${caixa.length})</button>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin:10px 0">
                <input type="text" class="tb-input" id="ms_busca" placeholder="🔍 Buscar..." oninput="tbMostrarFiltra()">
                <button class="tb-btn tb-btn-small" style="white-space:nowrap" onclick="tbVincularNpcs()" title="Vincular ou desvincular NPCs desta mesa">🔗 Vincular NPCs</button>
            </div>
            <div id="ms_lista" class="tb-mostrar-grid"></div>`;
        document.querySelector('#tbModal .tb-modal-body').innerHTML = abas;
        window._msAba = 'npcs';
        renderListaMostrar();
    } catch (e) { console.error(e); toast('❌ Erro ao carregar registros', 'danger'); }
}

window.tbMostrarAba = (aba, btn) => {
    window._msAba = aba;
    document.querySelectorAll('#tbModal .tb-tab').forEach(b => b.classList.toggle('active', b === btn));
    renderListaMostrar();
};
window.tbMostrarFiltra = () => renderListaMostrar();

function renderListaMostrar() {
    const el = document.getElementById('ms_lista'); if (!el) return;
    const busca = (document.getElementById('ms_busca')?.value || '').toLowerCase();
    const aba = window._msAba;
    let cards = [];
    if (aba === 'npcs') {
        cards = T.npcs.filter(n => (n.nome||'').toLowerCase().includes(busca)).map(n => card({
            img: n.imagem, nome: n.nome || 'NPC', sub: `${n.tipo === 'criatura' ? '🐉 Criatura' : '👤 NPC'} ${n.raca ? '· ' + n.raca : ''}`,
            onclick: `tbColocarMostrar('npc','${n.id}')`
        }));
    } else if (aba === 'equip') {
        cards = (equipCatalogo||[]).filter(i => (i.nome||'').toLowerCase().includes(busca)).map(i => card({
            img: i.imagem || i.imagemUrl, nome: i.nome || 'Item', sub: `${i.tipo || 'Equipamento'}${i.peso ? ' · ' + i.peso + 'kg' : ''}`,
            onclick: `tbColocarMostrar('equip','${i.id}')`
        }));
    } else {
        cards = (caixaItens||[]).filter(i => (i.nome||'').toLowerCase().includes(busca)).map(i => card({
            img: i.imagem || i.imagemUrl, nome: i.nome || 'Item', sub: `${i.tipo || 'Item'}${i.quantidade ? ' · x' + i.quantidade : ''}`,
            onclick: `tbColocarMostrar('caixa','${i.id}')`
        }));
    }
    el.innerHTML = cards.join('') || '<div class="tb-muted" style="grid-column:1/-1;text-align:center;padding:20px">Nada encontrado</div>';
}
function card({ img, nome, sub, onclick }) {
    return `<div class="tb-mostrar-card" onclick="${onclick}">
        ${img ? `<img src="${esc(img)}">` : '<div class="tb-mostrar-noimg">🖼️</div>'}
        <div class="tb-mostrar-nome">${esc(nome)}</div>
        <div class="tb-muted" style="font-size:.72rem">${esc(sub)}</div>
    </div>`;
}

// ===== VINCULAR NPCs À MESA =====
window.tbVincularNpcs = function() {
    if (T.mode !== 'secret') return;
    abrirModal('🔗 NPCs da mesa', `
        <input type="text" class="tb-input" id="vn_busca" placeholder="🔍 Buscar por nome ou papel..." oninput="_renderVincNpcs()">
        <div class="tb-muted" style="font-size:.76rem;margin:8px 0">Só NPCs vinculados aparecem no criador de token, no rastreador de combate e na aba 🎁 Mostrar.</div>
        <div class="tb-list" id="vn_lista" style="max-height:46vh;overflow-y:auto"></div>
    `, true);
    window._renderVincNpcs();
};

window._renderVincNpcs = function() {
    const el = document.getElementById('vn_lista');
    if (!el) return;   // modal fechado — o snapshot chama isto de qualquer jeito
    const busca = (document.getElementById('vn_busca')?.value || '').trim().toLowerCase();
    const lista = T.npcsTodos.filter(n =>
        !busca || (n.nome || '').toLowerCase().includes(busca) || (n.papel || '').toLowerCase().includes(busca));
    // os da mesa primeiro
    lista.sort((a, b) => (b.mesaId === T.mesaId) - (a.mesaId === T.mesaId));
    el.innerHTML = lista.map(n => {
        const aqui = n.mesaId === T.mesaId;
        const outra = !aqui && !!n.mesaId;
        return `<div class="tb-list-row ${aqui ? 'sel' : ''}">
            ${n.imagem ? `<img src="${esc(n.imagem)}" style="width:30px;height:30px;object-fit:cover;border-radius:6px;flex:none">` : '<span style="width:30px;text-align:center;flex:none">👤</span>'}
            <div style="flex:1;min-width:0">
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.nome || 'Sem nome')} ${n.tipo === 'criatura' ? '🐉' : ''}</div>
                <div class="tb-muted" style="font-size:.7rem">${esc(n.papel || (n.tipo === 'criatura' ? 'Criatura' : 'NPC'))}${outra ? ' · ⚠️ vinculado a outra mesa' : ''}</div>
            </div>
            <button class="tb-btn tb-btn-small ${aqui ? 'tb-btn-danger' : 'tb-btn-success'}" onclick="tbToggleVincNpc('${n.id}',${!aqui})">
                ${aqui ? '✕ Desvincular' : outra ? '🔗 Trazer' : '🔗 Vincular'}
            </button>
        </div>`;
    }).join('') || '<div class="tb-muted" style="text-align:center;padding:20px">Nenhum NPC encontrado</div>';
};

window.tbToggleVincNpc = async function(npcId, vincular) {
    const n = T.npcsTodos.find(x => x.id === npcId);
    if (vincular && n?.mesaId && n.mesaId !== T.mesaId &&
        !confirm(`“${n.nome || 'NPC'}” está vinculado a outra mesa. Trazer para esta?`)) return;
    try {
        await vincularNpcNaMesa(npcId, vincular);
        toast(vincular ? `🔗 ${n?.nome || 'NPC'} vinculado` : `✕ ${n?.nome || 'NPC'} desvinculado`);
        window._renderVincNpcs();
    } catch (e) { console.error(e); toast('❌ Erro ao salvar o vínculo', 'danger'); }
};

window.tbColocarMostrar = async function(refTipo, refId) {
    let nome = '', url = '';
    if (refTipo === 'npc') { const n = T.npcs.find(x => x.id === refId); nome = n?.nome || 'NPC'; url = n?.imagem || ''; }
    if (refTipo === 'equip') { const i = (equipCatalogo||[]).find(x => x.id === refId); nome = i?.nome || 'Item'; url = i?.imagem || i?.imagemUrl || ''; }
    if (refTipo === 'caixa') { const i = (caixaItens||[]).find(x => x.id === refId); nome = i?.nome || 'Item'; url = i?.imagem || i?.imagemUrl || ''; }
    const centro = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    await addObj({
        tipo: 'mostrar', layerId: T.activeLayerId === 'luz' ? 'tokens' : T.activeLayerId,
        x: centro.x - 110, y: centro.y - 110, w: 220, h: 220,
        refTipo, refId, nome, url,
        visivelPublico: false,
        opcoes: { soImagem: true, mostrarNome: false },
        extrasVisiveis: [],
    });
    fecharModal();
    toast('🎁 Colocado no canva (oculto do público). Botão direito para configurar a exibição.');
};

// ===== MENU DE CONTEXTO (botão direito) =====
function menuMostrar(objId, x, y) {
    const o = T.objects.get(objId); if (!o) return;
    const menu = document.getElementById('tbCtxMenu');
    const op = o.opcoes || {};
    const check = (k, label) => `<label class="tb-ctx-check"><input type="checkbox" data-k="${k}" ${op[k] ? 'checked' : ''}> ${label}</label>`;
    let extras = '';
    if (o.refTipo === 'npc') extras = check('exRaca', 'Raça') + check('exPapel', 'Papel') + check('exTags', 'Tags');
    else extras = check('exTipo', 'Tipo') + check('exPeso', 'Peso') + check('exDesc', 'Descrição curta');
    let fichaVisItem = '';
    if (o.refTipo === 'npc' && T.isMaster) {
        const npcRef = T.npcs.find(x => x.id === o.refId);
        const fichaPub = npcRef?.visibilidade === 'publico';
        fichaVisItem = `<div class="tb-ctx-item" data-acao="vis-ficha">${fichaPub ? '🕵️ Tornar ficha Secreta (visão do Mestre)' : '📢 Tornar ficha Pública (Modo Rápido)'}</div>`;
    }
    menu.innerHTML = `
        <div class="tb-ctx-title">🎁 Exibição ao público</div>
        <label class="tb-ctx-check"><input type="checkbox" data-k="__visivel" ${o.visivelPublico !== false ? 'checked' : ''}> <b>Exibir ao público</b></label>
        ${check('soImagem', 'Só imagem (padrão)')}
        ${check('mostrarNome', 'Nome abaixo da imagem')}
        ${extras}
        <div class="tb-ctx-item" data-acao="abrir">${o.refTipo === 'npc' ? '👹 Abrir ficha do NPC' : '🎒 Adicionar ao inventário...'}</div>
        ${fichaVisItem}
        ${o.refTipo !== 'npc' ? '<div class="tb-ctx-item" data-acao="loot">📦 Transformar em loot no mapa</div>' : ''}
        <div class="tb-ctx-item tb-danger" data-acao="del">🗑️ Remover do canva</div>`;
    menu.style.left = Math.min(x, window.innerWidth - 260) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 320) + 'px';
    menu.classList.add('open');

    menu.querySelectorAll('input[data-k]').forEach(i => i.onchange = async () => {
        if (i.dataset.k === '__visivel') { updObj(objId, { visivelPublico: i.checked }); return; }
        const novo = { ...(T.objects.get(objId)?.opcoes || {}) };
        novo[i.dataset.k] = i.checked;
        if (i.dataset.k !== 'soImagem' && i.checked) novo.soImagem = false;
        await aplicarOpcoes(objId, novo);
    });
    menu.querySelector('[data-acao="abrir"]').onclick = () => { menu.classList.remove('open'); clickMostrar(objId); };
    const visFichaBtn = menu.querySelector('[data-acao="vis-ficha"]');
    if (visFichaBtn) visFichaBtn.onclick = () => { menu.classList.remove('open'); window.tbAlternarFichaNpc(o.refId); };
    const lootBtn = menu.querySelector('[data-acao="loot"]');
    if (lootBtn) lootBtn.onclick = async () => {
        menu.classList.remove('open');
        const src = T.objects.get(objId); if (!src) return;
        // vira um token de loot arrastável; entrega ao soltar sobre um token
        await addObj({
            tipo: 'loot', layerId: 'tokens',
            x: src.x + (src.w || 200) / 2, y: src.y + (src.h || 200) + 40,
            nome: src.nome, url: src.url || '',
            refTipo: src.refTipo, refId: src.refId,
            visivelPublico: true,
        });
        delObj(objId);
        toast('📦 Loot criado — arraste sobre um token para entregar');
    };
    menu.querySelector('[data-acao="del"]').onclick = () => { menu.classList.remove('open'); delObj(objId); };
    setTimeout(() => document.addEventListener('pointerdown', function fecha(ev) {
        if (!menu.contains(ev.target)) { menu.classList.remove('open'); document.removeEventListener('pointerdown', fecha); }
    }), 10);
}

async function aplicarOpcoes(objId, op) {
    const o = T.objects.get(objId); if (!o) return;
    const extras = [];
    if (!op.soImagem) {
        if (o.refTipo === 'npc') {
            const n = T.npcs.find(x => x.id === o.refId) || {};
            if (op.exRaca && n.raca) extras.push('Raça: ' + n.raca);
            if (op.exPapel && n.papel) extras.push('Papel: ' + n.papel);
            if (op.exTags && n.tags) extras.push(n.tags);
        } else {
            const src = o.refTipo === 'equip' ? (equipCatalogo||[]).find(x => x.id === o.refId) : (caixaItens||[]).find(x => x.id === o.refId);
            const i = src || {};
            if (op.exTipo && i.tipo) extras.push('Tipo: ' + i.tipo);
            if (op.exPeso && i.peso != null) extras.push('Peso: ' + i.peso + 'kg');
            if (op.exDesc && (i.descricao || i.desc)) extras.push(String(i.descricao || i.desc).slice(0, 80));
        }
    }
    updObj(objId, { opcoes: op, extrasVisiveis: extras });
    markDirty();
}

// ===== CLIQUE (duplo-clique) NO OBJETO MOSTRAR =====
async function clickMostrar(objId) {
    const o = T.objects.get(objId); if (!o) return;
    if (o.refTipo === 'npc') {
        if (T.mode === 'secret' || T.perms.abrirNpc || T.isMaster) abrirNpcModal(o.refId, T.mode !== 'secret' && !T.isMaster);
        return;
    }
    if (T.mode !== 'secret' && !T.isMaster) return;
    abrirEntregaItem(o);
}

// =====================================================================
// FICHA DE NPC NO TABULEIRO — Renderização condicional por visibilidade
// - NPC "Secreto"  → instancia o MESMO componente da Ficha de NPC do
//   Painel do Mestre (painel-mestre/js/area-npcs.js), carregado sob demanda.
// - NPC "Público"  → instancia o componente da Ficha de NPC usado na
//   Ficha de Personagem (Aliados), restrito à view de Modo Rápido.
// =====================================================================

function _tbInjectCss(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
}

function _tbInjectScript(src, id) {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) { resolve(); return; }
        const s = document.createElement('script');
        s.id = id; s.src = src;
        s.onload = resolve; s.onerror = reject;
        document.body.appendChild(s);
    });
}

/* DOM do modal do Painel do Mestre (mesmo markup de painel-mestre.html) */
function _tbEnsureNpcModalDom() {
    if (document.getElementById('npcModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `<div id="npcModal" class="modal"><div class="modal-content" style="max-width:900px"><div class="modal-header"><span class="modal-title" id="npcModalTitle">Novo NPC</span><button class="modal-close" onclick="closeNpcModal()">✕</button></div><div class="modal-body" id="npcModalBody"></div></div></div>`;
    document.body.appendChild(div.firstElementChild);
}

/* DOM do modal de Aliado (mesmo markup de ficha-v1.7_1.html) */
function _tbEnsureAliadoModalDom() {
    if (document.getElementById('aliadoNpcModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `<div class="detail-modal hidden" id="aliadoNpcModal">
        <div class="detail-modal-content" style="max-width: 700px;">
            <button class="detail-modal-close" onclick="closeAliadoModal()">✕</button>
            <div class="detail-modal-body" id="aliadoNpcModalBody" style="padding: 20px;"></div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
}

/* Ficha completa do Mestre (componente do Painel do Mestre) */
async function abrirFichaMestreNpc(npc) {
    try {
        _tbInjectCss('../painel-mestre/css/modais.css', 'tbCssPmModais');
        _tbInjectCss('../painel-mestre/css/area-npcs.css', 'tbCssPmAreaNpcs');
        _tbEnsureNpcModalDom();

        const [S] = await Promise.all([
            import('../../painel-mestre/js/state.js'),
            import('../../painel-mestre/js/area-npcs.js')
        ]);

        // Garante o NPC atual no estado compartilhado usado pelo componente
        const existentes = Array.isArray(S.allNpcs) ? S.allNpcs.filter(x => x.id !== npc.id) : [];
        S.setAllNpcs([...existentes, npc]);
        if (!S.currentUser && T.user) S.setCurrentUser({ email: T.user.email || T.user.uid || 'tabuleiro' });

        await window.openNpcModal(npc.id);
    } catch (e) {
        console.error('❌ Erro ao abrir a Ficha de NPC (Painel do Mestre):', e);
        toast('❌ Erro ao abrir a ficha do Mestre', 'danger');
    }
}

/* Ficha de Aliado (componente da Ficha de Personagem), forçando Modo Rápido */
async function abrirFichaAliadoNpc(npc, opts = {}) {
    try {
        _tbInjectCss('css/tab-npc-sheet.css', 'tbCssNpcSheet');
        _tbEnsureAliadoModalDom();
        window.db = window.db || db;

        // Inventário do aliado (script clássico, opcional)
        try { await _tbInjectScript('../ficha-v1.7_1/js/aliado-inventario.js?v=6', 'tbScriptAliadoInv'); }
        catch (e) { console.warn('⚠️ aliado-inventario indisponível no tabuleiro:', e); }

        if (!window.openAliadoModal) {
            await import('../../ficha-v1.7_1/js/aliados.js?v=7');
        }
        await window.openAliadoModal(npc.id, { readonly: !!opts.readonly, forceRapido: true });
    } catch (e) {
        console.error('❌ Erro ao abrir a Ficha de NPC (Aliado):', e);
        toast('❌ Erro ao abrir a ficha do NPC', 'danger');
    }
}

async function abrirNpcModal(npcId, somenteLeitura) {
    let n = T.npcs.find(x => x.id === npcId);
    try { const s = await getDoc(doc(db, 'npcs', npcId)); if (s.exists()) n = { id: s.id, ...s.data() }; } catch (e) {}
    if (!n) { toast('❌ NPC não encontrado', 'danger'); return; }

    const vis = n.visibilidade === 'publico' ? 'publico' : 'secreto';
    const mestreView = !somenteLeitura && T.isMaster && T.mode === 'secret';

    if (mestreView && vis === 'secreto') {
        // NPC Secreto + Mestre em modo secreto → visão gerencial completa (Painel do Mestre)
        await abrirFichaMestreNpc(n);
        return;
    }

    // Qualquer outro caso (modo público, jogador, ou NPC público visto pelo mestre)
    // → componente de Aliados em Modo Rápido (leitura ou edição limitada)
    const readonly = !!somenteLeitura || !T.isMaster;
    await abrirFichaAliadoNpc(n, { readonly });
}
window.tbAlternarFichaNpc = async function(npcId) {
    try {
        const n = T.npcs.find(x => x.id === npcId);
        const atual = n?.visibilidade === 'publico' ? 'publico' : 'secreto';
        const novo = atual === 'publico' ? 'secreto' : 'publico';
        await updateDoc(doc(db, 'npcs', npcId), { visibilidade: novo });
        const i = T.npcs.findIndex(x => x.id === npcId);
        if (i >= 0) T.npcs[i] = { ...T.npcs[i], visibilidade: novo };
        toast(novo === 'publico' ? '📢 Ficha do NPC agora é Pública (Modo Rápido)' : '🕵️ Ficha do NPC agora é Secreta (visão do Mestre)');
    } catch (e) { console.error(e); toast('❌ Erro ao alterar visibilidade da ficha', 'danger'); }
};

// ===== ENTREGAR ITEM AO INVENTÁRIO =====
function abrirEntregaItem(o) {
    const alvos = [
        ...T.chars.map(c => `<option value="char:${c.id}">🎭 ${esc(c.nome)}</option>`),
        ...T.npcs.map(n => `<option value="npc:${n.id}">👹 ${esc(n.nome || 'NPC')}</option>`),
    ].join('');
    abrirModal(`🎒 Entregar "${esc(o.nome)}"`, `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Adicionar ao inventário de<select id="ei_alvo">${alvos}</select></label>
            <label>Quantidade<input type="number" id="ei_qtd" value="1" min="1"></label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbEntregarItem('${o.id}')">✅ Entregar</button></div>`);
}
/** F5.4: loot arrastado e solto sobre um token → fluxo de entrega pré-selecionado. */
window.tbEntregarLoot = function(lootId, tokenAlvo) {
    const loot = T.objects.get(lootId); if (!loot) return;
    const alvos = [
        ...T.chars.map(c => `<option value="char:${c.id}" ${tokenAlvo.vinculo?.tipo==='char'&&tokenAlvo.vinculo.id===c.id?'selected':''}>🎭 ${esc(c.nome)}</option>`),
        ...T.npcs.map(n => `<option value="npc:${n.id}" ${tokenAlvo.vinculo?.tipo==='npc'&&tokenAlvo.vinculo.id===n.id?'selected':''}>👹 ${esc(n.nome || 'NPC')}</option>`),
    ].join('');
    abrirModal(`📦 Entregar "${esc(loot.nome)}" para ${esc(tokenAlvo.nome || 'token')}`, `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Adicionar ao inventário de<select id="ei_alvo">${alvos}</select></label>
            <label>Quantidade<input type="number" id="ei_qtd" value="1" min="1"></label>
        </div>
        <div class="tb-modal-actions">
            <button class="tb-btn" onclick="tbFecharModal()">Cancelar</button>
            <button class="tb-btn tb-btn-success" onclick="tbEntregarItem('${lootId}', true)">✅ Entregar e remover loot</button>
        </div>`);
};

window.tbEntregarItem = async function(objId, removerLoot) {
    const o = T.objects.get(objId); if (!o) return;
    const alvo = document.getElementById('ei_alvo').value;
    const qtd = parseInt(document.getElementById('ei_qtd').value) || 1;
    const targetId = alvo.split(':')[1];
    try {
        if (o.refTipo === 'caixa') {
            // transfere o item existente da caixa
            await updateDoc(doc(db, 'items', o.refId), { characterId: targetId, quantidade: qtd });
            caixaItens = null;
        } else {
            const tpl = (equipCatalogo || []).find(x => x.id === o.refId) || {};
            const { id: _, ...campos } = tpl;
            await addDoc(collection(db, 'items'), {
                ...campos,
                nome: o.nome, imagem: o.url || campos.imagem || null,
                characterId: targetId, mesaId: T.mesaId, quantidade: qtd,
                origemTemplateId: o.refId || null,
                createdAt: new Date().toISOString(), createdBy: T.user?.email || null, ownerUid: T.user?.uid || null,
            });
        }
        if (removerLoot) delObj(objId);
        fecharModal(); toast('✅ Item entregue ao inventário!');
    } catch (e) { console.error(e); toast('❌ Erro ao entregar item', 'danger'); }
};
