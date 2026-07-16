// =============================================
// TABULEIRO — Boot / Sync / Canvases / Camadas / Permissões
// =============================================
import {
    db, auth, onAuthStateChanged,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    onSnapshot, query, where
} from '../../painel-mestre/js/firebase-config.js';
import { T, CAMADAS_PADRAO, PERMISSOES_LISTA, esc, uid, toast, markDirty, camadasVisiveis } from './tab-state.js';
import { startRenderLoop, centerCamera } from './tab-render.js';
import { initTools } from './tab-tools.js';
import { initObjects, abrirPropriedades } from './tab-objects.js';
import { initCombat } from './tab-combat.js';
import { initMostrar } from './tab-mostrar.js';

// ===== Refs Firestore =====
export const refCanvases = () => collection(db, 'mesas', T.mesaId, 'tabuleiros');
export const refCanvas = (id) => doc(db, 'mesas', T.mesaId, 'tabuleiros', id || T.canvasId);
export const refObjetos = (id) => collection(db, 'mesas', T.mesaId, 'tabuleiros', id || T.canvasId, 'objetos');
export const refObjeto = (objId) => doc(db, 'mesas', T.mesaId, 'tabuleiros', T.canvasId, 'objetos', objId);
export const refEstado = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'estado');
export const refCombate = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'combate');
export const refReguas = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'reguas');

// ===== BOOT =====
window.addEventListener('DOMContentLoaded', () => {
    const p = new URLSearchParams(location.search);
    T.mesaId = p.get('mesa');
    T.mode = p.get('mode') === 'public' ? 'public' : 'secret';
    if (!T.mesaId) { bootError('Nenhuma mesa informada. Abra o Tabuleiro pelo Painel do Mestre ou pela Ficha.'); return; }

    onAuthStateChanged(auth, async (user) => {
        if (!user) { bootError('Você precisa estar logado para acessar o Tabuleiro.', true); return; }
        T.user = user;
        try {
            // É mestre?
            try {
                const ms = await getDoc(doc(db, 'masters', user.uid));
                T.isMaster = ms.exists();
            } catch (e) { T.isMaster = false; }

            if (T.mode === 'secret' && !T.isMaster) {
                T.mode = 'public';
                toast('Sem acesso ao modo secreto — abrindo modo público', 'warning');
            }

            const mesaSnap = await getDoc(doc(db, 'mesas', T.mesaId));
            if (!mesaSnap.exists()) { bootError('Mesa não encontrada.'); return; }
            T.mesa = { id: mesaSnap.id, ...mesaSnap.data() };

            await Promise.all([carregarChars(), carregarNpcs(), carregarUsers()]);
            await iniciarSync();
            montarUI();
            initTools();
            initObjects();
            initCombat();
            initMostrar();
            startRenderLoop();
            document.getElementById('tbLoading').style.display = 'none';
        } catch (e) {
            console.error(e);
            bootError('Erro ao carregar o Tabuleiro: ' + (e.message || e));
        }
    });
});

function bootError(msg, login = false) {
    const el = document.getElementById('tbLoading');
    el.innerHTML = `<div style="font-size:2.4rem">🗺️</div><div style="max-width:420px;text-align:center">${esc(msg)}</div>` +
        (login ? `<a href="../index.html" class="tb-btn tb-btn-primary" style="text-decoration:none">Ir para o Login</a>` : '');
}

async function carregarChars() {
    const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', T.mesaId)));
    T.chars = [];
    snap.forEach(d => {
        const raw = d.data(); const f = raw.fields || {};
        T.chars.push({ id: d.id, nome: f.nome || raw.nome || 'Sem nome', charImg: raw.charImg || '', ownerUid: raw.ownerUid, ownerEmail: raw.ownerEmail, raca: f.raca, classe: f.classe });
    });
}
async function carregarNpcs() {
    const snap = await getDocs(collection(db, 'npcs'));
    T.npcs = [];
    snap.forEach(d => { const n = d.data(); if (n.mesaId === T.mesaId) T.npcs.push({ id: d.id, ...n }); });
}
async function carregarUsers() {
    T.usersMap = {};
    try {
        const uids = T.mesa.jogadores || [];
        for (const u of uids) {
            const s = await getDoc(doc(db, 'users', u));
            if (s.exists()) { const d = s.data(); T.usersMap[u] = { email: d.email || u, nome: d.displayName || d.nome || d.email || u }; }
            else T.usersMap[u] = { email: u, nome: u };
        }
    } catch (e) { console.warn('users', e); }
}

// ===== SYNC =====
async function iniciarSync() {
    // Estado geral (canvas ativo ao público)
    T.unsubs.push(onSnapshot(refEstado(), s => {
        T.estado = s.exists() ? s.data() : {};
        if (T.mode === 'public') {
            const alvo = T.estado.canvasAtivoId;
            if (alvo && alvo !== T.canvasId) trocarCanvas(alvo, false);
        }
        atualizarBarraCanvas();
        markDirty();
    }));

    // Lista de canvases
    await new Promise((resolve) => {
        let first = true;
        T.unsubs.push(onSnapshot(refCanvases(), async s => {
            T.canvases = [];
            s.forEach(d => T.canvases.push({ id: d.id, ...d.data() }));
            T.canvases.sort((a, b) => (a.createdAt||0) - (b.createdAt||0));
            if (first) {
                first = false;
                if (!T.canvases.length && T.isMaster) {
                    await criarCanvas('Tabuleiro 1', true);
                } else if (T.canvases.length) {
                    const alvo = (T.mode === 'public' && T.estado?.canvasAtivoId) ? T.estado.canvasAtivoId : (T.estado?.canvasAtivoId || T.canvases[0].id);
                    await trocarCanvas(T.canvases.find(c => c.id === alvo) ? alvo : T.canvases[0].id, false);
                }
                resolve();
            }
            atualizarBarraCanvas();
        }, e => { console.error(e); resolve(); }));
    });

    // Combate
    T.unsubs.push(onSnapshot(refCombate(), s => {
        T.combate = s.exists() ? s.data() : null;
        window._renderCombate && window._renderCombate();
        atualizarBarraCanvas();
    }));

    // Réguas compartilhadas
    T.unsubs.push(onSnapshot(refReguas(), s => {
        T.reguasRemotas = s.exists() ? s.data() : {};
        markDirty();
    }));
}

export async function trocarCanvas(id, escreverEstado) {
    if (T.unsubCanvasDoc) { T.unsubCanvasDoc(); T.unsubCanvasDoc = null; }
    if (T.unsubObjetos) { T.unsubObjetos(); T.unsubObjetos = null; }
    T.canvasId = id;
    T.objects = new Map();
    T.selection = null;
    abrirPropriedades(null);

    T.unsubCanvasDoc = onSnapshot(refCanvas(id), s => {
        if (!s.exists()) return;
        T.canvas = { id: s.id, ...s.data() };
        resolverPermissoes();
        atualizarBarraCanvas();
        window._renderCamadasPanel && window._renderCamadasPanel();
        aplicarModoUI();
        markDirty();
    });
    T.unsubObjetos = onSnapshot(refObjetos(id), s => {
        s.docChanges().forEach(ch => {
            if (ch.type === 'removed') { T.objects.delete(ch.doc.id); if (T.selection === ch.doc.id) { T.selection = null; abrirPropriedades(null); } }
            else {
                const local = T.objects.get(ch.doc.id);
                const novo = { id: ch.doc.id, ...ch.doc.data() };
                // Não sobrescrever objeto que estou arrastando agora
                if (local && local.__dragging) { Object.assign(local, novo, { x: local.x, y: local.y, __dragging: true }); }
                else T.objects.set(ch.doc.id, novo);
                if (T.selection === ch.doc.id) abrirPropriedades(ch.doc.id, true);
            }
        });
        markDirty();
    });
    if (escreverEstado && T.isMaster) {
        // apenas seleção local no modo secreto; não muda o público
    }
    setTimeout(() => centerCamera(), 350);
}

export async function criarCanvas(nome, ativar) {
    const id = uid();
    await setDoc(refCanvas(id), {
        nome: nome || 'Novo Tabuleiro',
        createdAt: Date.now(),
        grid: { size: 70, show: true, snap: true },
        escala: { valorPorCelula: 1.5, unidade: 'm' },
        luzDinamica: { ativa: false, modo: 'noite', fogSecretOpacity: 0.6 },
        camadas: CAMADAS_PADRAO,
        permissoes: {},
    });
    if (ativar) {
        await setDoc(refEstado(), { canvasAtivoId: id }, { merge: true });
        await trocarCanvas(id, false);
    }
    return id;
}

function resolverPermissoes() {
    if (T.isMaster) { T.perms = {}; return; }
    T.perms = (T.canvas?.permissoes || {})[T.user.uid] || {};
}

// ===== UI GERAL =====
function montarUI() {
    document.getElementById('tbModeBadge').innerHTML = T.mode === 'secret'
        ? '🕵️ <b>SECRETO</b>' : '👁️ <b>PÚBLICO</b>';
    document.getElementById('tbModeBadge').className = 'tb-mode-badge ' + (T.mode === 'secret' ? 'secret' : 'public');
    document.getElementById('tbMesaNome').textContent = '🎲 ' + (T.mesa?.nome || '');

    if (T.mode === 'secret') {
        document.getElementById('tbBtnAbrirPublico').style.display = '';
        document.getElementById('tbBtnAbrirPublico').onclick = () =>
            window.open(`tabuleiro.html?mesa=${T.mesaId}&mode=public`, '_blank');
    }
    aplicarModoUI();
}

export function aplicarModoUI() {
    const secret = T.mode === 'secret';
    const show = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v ? '' : 'none'; };
    // Ferramentas por permissão
    show('toolSelect', true);
    show('toolMove', secret);
    show('toolDraw', secret || T.perms.desenhar);
    show('toolText', secret || T.perms.addTexto);
    show('toolMeasure', secret || T.perms.medir);
    show('toolPin', secret || T.perms.alfinete);
    show('toolLight', secret);
    show('btnUploadImg', secret || T.perms.addImagem);
    show('btnToken', secret);
    show('btnMostrar', secret);
    show('btnCamadas', secret);
    show('btnConfig', secret);
    show('btnPerms', secret);
    show('btnCanvases', secret);
    show('btnCombate', secret || !!(T.estado?.combateVisivelPublico));
}

function atualizarBarraCanvas() {
    const el = document.getElementById('tbCanvasNome');
    if (!el) return;
    const c = T.canvases.find(x => x.id === T.canvasId);
    const ativo = T.estado?.canvasAtivoId === T.canvasId;
    el.innerHTML = `${esc(c?.nome || T.canvas?.nome || '...')} ${T.mode==='secret' ? (ativo ? '<span class="tb-tag-live">AO VIVO</span>' : '<span class="tb-tag-off">oculto</span>') : ''}`;
    const btn = document.getElementById('btnCombate');
    if (btn) btn.style.display = (T.mode === 'secret' || T.estado?.combateVisivelPublico) ? '' : 'none';
}

// ===== PAINEL DE CANVASES =====
window.tbAbrirCanvases = function() {
    if (T.mode !== 'secret' || !T.isMaster) return;
    const lista = T.canvases.map(c => {
        const ativo = T.estado?.canvasAtivoId === c.id;
        const atual = T.canvasId === c.id;
        return `<div class="tb-list-row ${atual?'sel':''}">
            <div style="flex:1;cursor:pointer" onclick="tbIrCanvas('${c.id}')">${esc(c.nome)} ${ativo?'<span class="tb-tag-live">AO VIVO</span>':''}</div>
            <button class="tb-mini-btn" title="Exibir ao público" onclick="tbAtivarCanvas('${c.id}')">📡</button>
            <button class="tb-mini-btn" title="Renomear" onclick="tbRenomearCanvas('${c.id}')">✏️</button>
            <button class="tb-mini-btn tb-danger" title="Excluir" onclick="tbExcluirCanvas('${c.id}')">🗑️</button>
        </div>`;
    }).join('');
    abrirModal('🗂️ Tabuleiros (Canvases)', `
        <div class="tb-list">${lista || '<div class="tb-muted">Nenhum canvas</div>'}</div>
        <button class="tb-btn tb-btn-success" style="margin-top:12px" onclick="tbNovoCanvas()">➕ Novo Canvas</button>
        <div class="tb-muted" style="margin-top:8px;font-size:.78rem">📡 define qual canvas os jogadores veem no modo público. Cada canvas salva tudo automaticamente.</div>
    `);
};
window.tbIrCanvas = async (id) => { fecharModal(); await trocarCanvas(id, false); };
window.tbAtivarCanvas = async (id) => { await setDoc(refEstado(), { canvasAtivoId: id }, { merge: true }); toast('📡 Canvas exibido ao público'); fecharModal(); };
window.tbNovoCanvas = async () => {
    const nome = prompt('Nome do novo canvas:', 'Tabuleiro ' + (T.canvases.length + 1));
    if (nome === null) return;
    const id = await criarCanvas(nome || 'Tabuleiro', false);
    await trocarCanvas(id, false);
    fecharModal(); toast('✅ Canvas criado');
};
window.tbRenomearCanvas = async (id) => {
    const c = T.canvases.find(x => x.id === id);
    const nome = prompt('Novo nome:', c?.nome || '');
    if (!nome) return;
    await updateDoc(refCanvas(id), { nome });
    fecharModal(); window.tbAbrirCanvases();
};
window.tbExcluirCanvas = async (id) => {
    if (T.canvases.length <= 1) { toast('⚠️ Mantenha ao menos um canvas', 'warning'); return; }
    if (!confirm('Excluir este canvas e TODO o seu conteúdo?')) return;
    try {
        const objs = await getDocs(refObjetos(id));
        for (const d of objs.docs) await deleteDoc(d.ref);
        await deleteDoc(refCanvas(id));
        if (T.canvasId === id) await trocarCanvas(T.canvases.find(c => c.id !== id).id, false);
        fecharModal(); toast('🗑️ Canvas excluído');
    } catch (e) { console.error(e); toast('❌ Erro ao excluir', 'danger'); }
};

// ===== CONFIG DO CANVAS (grid, escala, luz dinâmica) =====
window.tbAbrirConfig = function() {
    const c = T.canvas; if (!c) return;
    const g = c.grid || {}, e = c.escala || {}, l = c.luzDinamica || {};
    abrirModal('⚙️ Configurações do Canvas', `
        <div class="tb-form-grid">
            <label>Tamanho da célula (px)<input type="number" id="cfg_grid" value="${g.size||70}" min="20" max="300"></label>
            <label>Valor por célula<input type="number" id="cfg_vpc" value="${e.valorPorCelula||1.5}" step="0.1" min="0.01"></label>
            <label>Unidade<select id="cfg_un">
                ${['m','cm','ft'].map(u=>`<option value="${u}" ${e.unidade===u?'selected':''}>${u}</option>`).join('')}
            </select></label>
            <label class="tb-check"><input type="checkbox" id="cfg_show" ${g.show!==false?'checked':''}> Mostrar grid</label>
            <label class="tb-check"><input type="checkbox" id="cfg_snap" ${g.snap!==false?'checked':''}> Encaixar tokens no grid</label>
        </div>
        <hr class="tb-hr">
        <div class="tb-section-title">🌗 Iluminação Dinâmica</div>
        <div class="tb-form-grid">
            <label class="tb-check"><input type="checkbox" id="cfg_luz" ${l.ativa?'checked':''}> Ativar iluminação dinâmica</label>
            <label>Ambiente<select id="cfg_modo">
                <option value="noite" ${l.modo!=='dia'?'selected':''}>🌙 Noite</option>
                <option value="dia" ${l.modo==='dia'?'selected':''}>☀️ Dia</option>
            </select></label>
            <label>Opacidade do fog na SUA visão secreta (${Math.round((l.fogSecretOpacity??0.6)*100)}%)
                <input type="range" id="cfg_fog" min="0" max="100" value="${Math.round((l.fogSecretOpacity??0.6)*100)}">
            </label>
        </div>
        <div class="tb-muted" style="font-size:.78rem;margin-top:6px">No modo público o fog é sempre 100% quando ativo. Riscos na camada <b>💡 Luz</b> bloqueiam a visão dos tokens.</div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarConfig()">💾 Salvar</button></div>
    `);
};
window.tbSalvarConfig = async function() {
    const v = id => document.getElementById(id);
    try {
        await updateDoc(refCanvas(), {
            grid: { size: parseInt(v('cfg_grid').value)||70, show: v('cfg_show').checked, snap: v('cfg_snap').checked },
            escala: { valorPorCelula: parseFloat(v('cfg_vpc').value)||1.5, unidade: v('cfg_un').value },
            luzDinamica: { ativa: v('cfg_luz').checked, modo: v('cfg_modo').value, fogSecretOpacity: (parseInt(v('cfg_fog').value)||0)/100 },
        });
        fecharModal(); toast('✅ Configurações salvas');
    } catch (e) { console.error(e); toast('❌ Erro ao salvar', 'danger'); }
};

// ===== PERMISSÕES DOS JOGADORES =====
window.tbAbrirPermissoes = function() {
    const jogadores = T.mesa?.jogadores || [];
    if (!jogadores.length) { abrirModal('🔑 Permissões', '<div class="tb-muted">Nenhum jogador vinculado à mesa.</div>'); return; }
    const perms = T.canvas?.permissoes || {};
    const linhas = jogadores.map(u => {
        const info = T.usersMap[u] || { nome: u };
        const chars = T.chars.filter(c => c.ownerUid === u).map(c => c.nome).join(', ');
        const p = perms[u] || {};
        return `<div class="tb-perm-row">
            <div class="tb-perm-user"><b>${esc(info.nome)}</b><div class="tb-muted" style="font-size:.75rem">${esc(chars || 'sem personagem')}</div></div>
            <div class="tb-perm-checks">
                ${PERMISSOES_LISTA.map(pl => `<label class="tb-check tb-check-sm"><input type="checkbox" data-uid="${u}" data-perm="${pl.key}" ${p[pl.key]?'checked':''}> ${pl.label}</label>`).join('')}
            </div>
        </div>`;
    }).join('');
    abrirModal('🔑 Permissões de Edição (modo público)', `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">Permissões individuais por jogador, válidas para <b>este canvas</b>.</div>
        ${linhas}
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarPermissoes()">💾 Salvar</button></div>
    `);
};
window.tbSalvarPermissoes = async function() {
    const perms = {};
    document.querySelectorAll('#tbModal input[data-uid]').forEach(i => {
        const u = i.dataset.uid;
        perms[u] = perms[u] || {};
        perms[u][i.dataset.perm] = i.checked;
    });
    try { await updateDoc(refCanvas(), { permissoes: perms }); fecharModal(); toast('✅ Permissões salvas'); }
    catch (e) { console.error(e); toast('❌ Erro', 'danger'); }
};

// ===== MODAL GENÉRICO =====
export function abrirModal(titulo, html, wide) {
    const m = document.getElementById('tbModal');
    m.querySelector('.tb-modal-title').innerHTML = titulo;
    m.querySelector('.tb-modal-body').innerHTML = html;
    m.querySelector('.tb-modal-content').style.maxWidth = wide ? '860px' : '560px';
    m.classList.add('active');
}
export function fecharModal() { document.getElementById('tbModal').classList.remove('active'); }
window.tbFecharModal = fecharModal;
window._tbAbrirModal = abrirModal;
