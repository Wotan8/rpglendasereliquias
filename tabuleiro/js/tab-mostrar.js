// =============================================
// TABULEIRO — "Mostrar" (NPCs, Equipamentos, Caixa do Mestre)
// + Ficha rápida de NPC + entrega de itens ao inventário
// =============================================
import { db, collection, doc, getDoc, getDocs, addDoc, updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty } from './tab-state.js';
import { abrirModal, fecharModal } from './tab-main.js';
import { addObj, updObj, delObj } from './tab-objects.js';
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
            <input type="text" class="tb-input" id="ms_busca" placeholder="🔍 Buscar..." oninput="tbMostrarFiltra()" style="margin:10px 0">
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
    menu.innerHTML = `
        <div class="tb-ctx-title">🎁 Exibição ao público</div>
        <label class="tb-ctx-check"><input type="checkbox" data-k="__visivel" ${o.visivelPublico !== false ? 'checked' : ''}> <b>Exibir ao público</b></label>
        ${check('soImagem', 'Só imagem (padrão)')}
        ${check('mostrarNome', 'Nome abaixo da imagem')}
        ${extras}
        <div class="tb-ctx-item" data-acao="abrir">${o.refTipo === 'npc' ? '👹 Abrir ficha do NPC' : '🎒 Adicionar ao inventário...'}</div>
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

// ===== FICHA RÁPIDA DE NPC =====
async function abrirNpcModal(npcId, somenteLeitura) {
    let n = T.npcs.find(x => x.id === npcId);
    try { const s = await getDoc(doc(db, 'npcs', npcId)); if (s.exists()) n = { id: s.id, ...s.data() }; } catch (e) {}
    if (!n) { toast('❌ NPC não encontrado', 'danger'); return; }
    const ro = somenteLeitura ? 'readonly disabled' : '';
    const vd = n.valoresDer || {};
    const personalidade = (n.rolePlay?.personalidade || []).join('\n');
    abrirModal(`👹 ${esc(n.nome || 'NPC')}`, `
        <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${n.imagem ? `<img src="${esc(n.imagem)}" style="width:130px;height:130px;object-fit:cover;border-radius:10px">` : ''}
            <div class="tb-form-grid" style="flex:1;min-width:260px">
                <label>Nome<input type="text" id="np_nome" value="${esc(n.nome||'')}" ${ro}></label>
                <label>Raça<input type="text" id="np_raca" value="${esc(n.raca||'')}" ${ro}></label>
                <label>Papel<input type="text" id="np_papel" value="${esc(n.papel||'')}" ${ro}></label>
                <label>Tags<input type="text" id="np_tags" value="${esc(n.tags||'')}" ${ro}></label>
            </div>
        </div>
        <div class="tb-form-grid" style="margin-top:10px">
            <label>❤️ VIT<input type="number" id="np_vit" value="${vd.VIT ?? 10}" ${ro}></label>
            <label>🔥 ENER<input type="number" id="np_ener" value="${vd.ENER ?? 5}" ${ro}></label>
            <label>🧠 SAN<input type="number" id="np_san" value="${vd.SAN ?? 100}" ${ro}></label>
        </div>
        <div class="tb-form-grid tb-form-grid-1" style="margin-top:10px">
            <label>Personalidade<textarea id="np_pers" rows="3" ${ro}>${esc(personalidade)}</textarea></label>
            <label>🎭 Trejeitos<textarea id="np_trej" rows="2" ${ro}>${esc(n.rolePlay?.trejeitos||'')}</textarea></label>
        </div>
        <div class="tb-modal-actions">
            ${!somenteLeitura ? `<button class="tb-btn tb-btn-success" onclick="tbSalvarNpc('${npcId}')">💾 Salvar</button>` : ''}
            ${T.isMaster ? `<a class="tb-btn" style="text-decoration:none" href="../painel-mestre/painel-mestre.html" target="_blank" title="Ficha completa no Painel do Mestre">📋 Painel do Mestre</a>` : ''}
        </div>`, true);
}
window.tbSalvarNpc = async function(npcId) {
    try {
        const v = id => document.getElementById(id);
        const n = T.npcs.find(x => x.id === npcId) || {};
        await updateDoc(doc(db, 'npcs', npcId), {
            nome: v('np_nome').value, raca: v('np_raca').value, papel: v('np_papel').value, tags: v('np_tags').value,
            valoresDer: { ...(n.valoresDer || {}), VIT: parseInt(v('np_vit').value)||0, ENER: parseInt(v('np_ener').value)||0, SAN: parseInt(v('np_san').value)||0 },
            rolePlay: { ...(n.rolePlay || {}), personalidade: v('np_pers').value.split('\n').filter(x=>x.trim()), trejeitos: v('np_trej').value },
        });
        // Atualiza cache local
        const i = T.npcs.findIndex(x => x.id === npcId);
        if (i >= 0) T.npcs[i] = { ...T.npcs[i], nome: v('np_nome').value, raca: v('np_raca').value, papel: v('np_papel').value, tags: v('np_tags').value };
        fecharModal(); toast('✅ NPC salvo'); markDirty();
    } catch (e) { console.error(e); toast('❌ Erro ao salvar NPC', 'danger'); }
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
window.tbEntregarItem = async function(objId) {
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
        fecharModal(); toast('✅ Item entregue ao inventário!');
    } catch (e) { console.error(e); toast('❌ Erro ao entregar item', 'danger'); }
};
