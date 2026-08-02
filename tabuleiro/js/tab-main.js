// =============================================
// TABULEIRO — Boot / Sync / Canvases / Camadas / Permissões
// =============================================
import {
    db, auth, onAuthStateChanged,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    onSnapshot, query, where, writeBatch
} from '../../painel-mestre/js/firebase-config.js';
import { T, CAMADAS_PADRAO, mesclarCamadasPadrao, PERMISSOES_LISTA, esc, uid, toast, markDirty, camadasVisiveis, optsUnidade, popNavegacaoValida, refViagemPorDia, HORAS_DE_MARCHA, ehEcoAtrasado, duracaoLerp, marcarRecebimentoReguas, configDoCanvasMudou } from './tab-state.js';
import { notifyObjectChange, notifyCanvasConfigChange } from './tab-perf.js';
import { npcNaMesa } from '../../shared/npc-mesas.js';
import { startRenderLoop, centerCamera } from './tab-render.js';
import { initTools } from './tab-tools.js';
import { initObjects, abrirPropriedades, addObj } from './tab-objects.js';
import { initCombat } from './tab-combat.js';
import { initMostrar } from './tab-mostrar.js';
import { initLivros, sincLivroExibido } from './tab-livros.js';
import { initPresenca } from './tab-presenca.js';
import { initHud } from './tab-hud.js';
import { initCena, transicaoDeCena } from './tab-cena.js';
import { initTemplates } from './tab-templates.js';
import { initMusica } from './tab-musica.js';
import './tab-local.js';   // 📍 Locais do Worldbuilding (registra window.tbAbrirLocal)
import { initGirar } from './tab-girar.js';
import { initSessao } from './tab-sessao.js';
import { carregarExploracao } from './tab-fog.js';
import { limparHistorico } from './tab-undo.js';
import { posDisplay, screenToWorld } from './tab-render.js';

// ===== Refs Firestore =====
export const refCanvases = () => collection(db, 'mesas', T.mesaId, 'tabuleiros');
export const refCanvas = (id) => doc(db, 'mesas', T.mesaId, 'tabuleiros', id || T.canvasId);
export const refObjetos = (id) => collection(db, 'mesas', T.mesaId, 'tabuleiros', id || T.canvasId, 'objetos');
export const refObjeto = (objId) => doc(db, 'mesas', T.mesaId, 'tabuleiros', T.canvasId, 'objetos', objId);
export const refEstado = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'estado');
export const refCombate = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'combate');
// Réguas: mesma divisão da presença — um doc por usuário (ver colPresenca).
export const colReguas = () => collection(db, 'mesas', T.mesaId, 'reguas');
export const refReguas = (uid) => doc(db, 'mesas', T.mesaId, 'reguas', uid);
// Presença: um doc POR USUÁRIO. No doc único antigo, N pessoas mexendo o mouse
// disputavam o mesmo doc (fila de escrita no servidor) e cada movimento reenviava
// os N cursores para os N clientes. Separado, cada um escreve só no seu e o
// snapshot entrega apenas o doc que mudou.
export const colPresenca = () => collection(db, 'mesas', T.mesaId, 'presenca');
export const refPresenca = (uid) => doc(db, 'mesas', T.mesaId, 'presenca', uid);
export const refPings = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'pings');
export const refLegenda = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'legenda');
export const refMusica = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'musica');

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
            initGirar();
            initObjects();
            initCombat();
            initMostrar();
            initLivros();
            initPresenca();
            initHud();
            initCena();
            initTemplates();
            initMusica();
            initSessao();
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
        const desloc = parseFloat(f.deslocamento ?? raw.deslocamento);
        T.chars.push({
            id: d.id, nome: f.nome || raw.nome || 'Sem nome', charImg: raw.charImg || '',
            ownerUid: raw.ownerUid, ownerEmail: raw.ownerEmail, raca: f.raca, classe: f.classe,
            desloc: isNaN(desloc) ? null : desloc,
            // VDs prontos espelhados pela ficha — o alcance de visão por Percepção lê daqui
            derivedTotals: raw.derivedTotals || {},
            // livros que o MESTRE amarrou neste personagem (📖 Livros → 🎭 Vincular).
            // Vem de carona nesta query, que já traz o doc inteiro — leitura zero.
            livrosVinculados: raw.livrosVinculados || [],
        });
    });
}
async function carregarNpcs() {
    return new Promise((resolve) => {
        let first = true;
        onSnapshot(collection(db, 'npcs'), snap => {
            T.npcs = []; T.npcsTodos = [];
            snap.forEach(d => {
                const n = { id: d.id, ...d.data() };
                T.npcsTodos.push(n);
                if (npcNaMesa(n, T.mesaId)) T.npcs.push(n);
            });
            T.npcsTodos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            if (first) { first = false; resolve(); }
            else {
                if (window._renderCombate) window._renderCombate();
                if (window._renderVincNpcs) window._renderVincNpcs();
                // trigger HUD update for tokens
                import('./tab-state.js').then(m => m.markDirty());
            }
        });
    });
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
            if (alvo && alvo !== T.canvasId && T.canvasId) {
                transicaoDeCena(() => trocarCanvas(alvo, false)); // fade + pré-carregamento
            } else if (alvo && alvo !== T.canvasId) {
                trocarCanvas(alvo, false);
            }
        }
        sincLivroExibido(T.estado.livroExibido);   // 📖 capítulo que o mestre exibe
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

    // Réguas compartilhadas — expiração pelo relógio LOCAL de recebimento,
    // nunca pelo `t` do outro aparelho (ver marcarRecebimentoReguas).
    // docChanges reconstrói o mapa uid->régua e a MESMA função testada de TTL
    // continua decidindo o carimbo de chegada.
    T.unsubs.push(onSnapshot(colReguas(), s => {
        const novas = { ...T.reguasRemotas };
        s.docChanges().forEach(ch => {
            if (ch.type === 'removed') delete novas[ch.doc.id];
            else novas[ch.doc.id] = ch.doc.data();
        });
        T.reguasRecebidas = marcarRecebimentoReguas(T.reguasRemotas, novas, T.reguasRecebidas, Date.now());
        T.reguasRemotas = novas;
        markDirty();
    }));
}

export async function trocarCanvas(id, escreverEstado) {
    if (T.unsubCanvasDoc) { T.unsubCanvasDoc(); T.unsubCanvasDoc = null; }
    if (T.unsubObjetos) { T.unsubObjetos(); T.unsubObjetos = null; }
    T.canvasId = id;
    T.objects = new Map();
    T.anims = new Map();
    notifyCanvasConfigChange();
    limparHistorico();   // undo/redo é por canvas
    T.selection = null;
    T.selecionados = [];
    abrirPropriedades(null);

    T.unsubCanvasDoc = onSnapshot(refCanvas(id), s => {
        if (!s.exists()) return;
        const anterior = T.canvas;
        T.canvas = { id: s.id, ...s.data() };
        T.canvas.camadas = mesclarCamadasPadrao(T.canvas.camadas);
        carregarExploracao(); // F3.1: memória de exploração (merge entre clientes)
        // Só exploração mudou (save do fog persistente, ~1 a cada 3s durante
        // arrasto no público)? Então NADA de invalidação geral: re-renderizar o
        // mapa inteiro + reconstruir paredes + recalcular todos os polígonos +
        // repintar painéis era o que congelava o token remoto por segundos.
        if (configDoCanvasMudou(anterior, T.canvas)) {
            notifyCanvasConfigChange();
            resolverPermissoes();
            atualizarBarraCanvas();
            window._renderCamadasPanel && window._renderCamadasPanel();
            aplicarModoUI();
        }
        markDirty();
    });
    T.unsubObjetos = onSnapshot(refObjetos(id), s => {
        s.docChanges().forEach(ch => {
            if (ch.type === 'removed') {
                notifyObjectChange(T.objects.get(ch.doc.id) || ch.doc.data());
                T.objects.delete(ch.doc.id);
                T.selecionados = T.selecionados.filter(x => x !== ch.doc.id);
                if (T.selection === ch.doc.id) { T.selection = null; abrirPropriedades(null); }
            }
            else {
                notifyObjectChange(ch.doc.data());
                const local = T.objects.get(ch.doc.id);
                const novo = { id: ch.doc.id, ...ch.doc.data() };
                // Eco atrasado do meu próprio arrasto: descartar (ver ehEcoAtrasado)
                if (ehEcoAtrasado(local, novo, T.user?.uid)) return;
                // Não sobrescrever objeto que estou arrastando agora: a posição
                // local é a verdade até eu soltar. `pontos` entra na proteção
                // junto com x/y — sem isso, arrastar desenho, porta ou janela
                // tremia brigando com o eco do próprio write.
                if (local && local.__dragging) {
                    const meu = { x: local.x, y: local.y, __dragging: true, __fogPos: local.__fogPos };
                    if (local.pontos) meu.pontos = local.pontos;
                    Object.assign(local, novo, meu);
                } else {
                    // F2.1: lerp — token movido por OUTRO usuário anima até a nova posição
                    novo.__ultRec = local?.__ultRec;   // chegada do trecho anterior (mede o ritmo do arrasto)
                    if (local && novo.tipo === 'token' && novo.lastWriter && novo.lastWriter !== T.user?.uid &&
                        (Math.abs((novo.x||0) - (local.x||0)) > 0.5 || Math.abs((novo.y||0) - (local.y||0)) > 0.5)) {
                        const de = posDisplay(local);
                        const agora = Date.now();
                        T.anims.set(ch.doc.id, {
                            x0: de.x, y0: de.y, t0: agora,
                            // ritmo REAL do outro lado, não um número fixo (ver duracaoLerp)
                            dur: duracaoLerp(local.__ultRec ? agora - local.__ultRec : 0),
                            // arrasto em curso = trecho de um percurso: velocidade constante.
                            // A desaceleração só faz sentido no write final, que é o token
                            // chegando; no meio do caminho ela vira o solavanco a cada trecho.
                            linear: !!novo.movendo,
                        });
                        novo.__ultRec = agora;
                    }
                    // preserva a posição confirmada do fog enquanto `movendo` estiver ativo (F2.3)
                    if (local && local.__fogPos && novo.movendo) novo.__fogPos = local.__fogPos;
                    T.objects.set(ch.doc.id, novo);
                }
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
        bloquearMovimento: true,
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
    show('toolFoco', secret);
    show('toolLight', secret);
    show('btnUploadImg', secret || T.perms.addImagem);
    show('btnLocal', secret);
    show('btnToken', secret);
    show('btnInventario', !secret);
    show('btnMostrar', secret);
    show('btnLivros', true);   // mestre vê a estante dele; jogador, a do personagem
    show('btnCamadas', secret);
    show('btnConfig', secret);
    show('btnPerms', secret);
    show('btnCanvases', secret);
    show('btnCombate', secret || !!(T.estado?.combateVisivelPublico));
    // FASES 2–6
    show('toolTemplate', secret);
    show('toolTerreno', secret);
    show('btnRelogio', secret);
    show('btnTeleprompter', secret);
    show('btnSessao', secret);
    show('btnCursores', true);
}

// ===== RELÓGIOS (F6.2) =====
window.tbNovoRelogio = function() {
    if (T.mode !== 'secret') return;
    // Frentes ativas (T.frentes vem do tab-sessao.js, só no modo secreto)
    const frentes = Object.values(T.frentes || {}).filter(f => f.status === 'ativa');
    const optsFrente = frentes.map(f => `<option value="${f.id}">${esc(f.nome || '')} (${Math.min(f.relogio?.cheias||0, f.relogio?.fatias||6)}/${f.relogio?.fatias||6})</option>`).join('');
    abrirModal('⏱️ Novo Relógio de Progresso', `
        <div class="tb-form-grid">
            <label>Nome<input type="text" id="rl_nome" placeholder="Ex: Alarme da fortaleza"></label>
            <label>Fatias<select id="rl_fatias">${[4,6,8,10,12].map(f=>`<option ${f===6?'selected':''}>${f}</option>`).join('')}</select></label>
            <label>Cor<input type="color" id="rl_cor" value="#ef4444"></label>
            <label class="tb-check"><input type="checkbox" id="rl_pub"> Visível ao público</label>
        </div>
        ${optsFrente ? `<div class="tb-form-grid" style="margin-top:6px">
            <label>🕰️ Vincular a uma frente (opcional)<select id="rl_frente"><option value="">— nenhuma —</option>${optsFrente}</select></label>
        </div>
        <div class="tb-muted" style="font-size:.72rem;margin-top:4px">Vinculado, o relógio espelha a frente (avança pela colheita/Painel) e o público vê só as fatias, sem nome.</div>` : ''}
        <div class="tb-muted" style="font-size:.75rem;margin-top:6px">Clique no relógio para avançar uma fatia; botão direito para voltar/zerar.</div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbCriarRelogio()">✅ Criar</button></div>
    `);
};
window.tbCriarRelogio = async function() {
    const centro = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const frenteId = document.getElementById('rl_frente')?.value || '';
    const f = frenteId ? (T.frentes || {})[frenteId] : null;
    await addObj({
        tipo: 'relogio', layerId: 'tokens',
        x: centro.x, y: centro.y,
        nome: document.getElementById('rl_nome').value.trim() || (f?.nome || ''),
        fatias: parseInt(document.getElementById('rl_fatias').value) || 6,
        cheias: 0,
        cor: document.getElementById('rl_cor').value,
        visivelPublico: document.getElementById('rl_pub').checked,
        ...(f ? { frenteId, espelho: { fatias: f.relogio?.fatias || 6, cheias: Math.min(f.relogio?.cheias || 0, f.relogio?.fatias || 6) } } : {}),
    });
    fecharModal(); toast('⏱️ Relógio criado no centro da tela');
};

function atualizarBarraCanvas() {
    const el = document.getElementById('tbCanvasNome');
    if (!el) return;
    const c = T.canvases.find(x => x.id === T.canvasId);
    const ativo = T.estado?.canvasAtivoId === T.canvasId;
    el.innerHTML = `${esc(c?.nome || T.canvas?.nome || '...')} ${T.mode==='secret' ? (ativo ? '<span class="tb-tag-live">AO VIVO</span>' : '<span class="tb-tag-off">oculto</span>') : ''}`;
    const btn = document.getElementById('btnCombate');
    if (btn) btn.style.display = (T.mode === 'secret' || T.estado?.combateVisivelPublico) ? '' : 'none';
}

// ===== NAVEGAÇÃO ENTRE MAPAS (alfinete → canvas vinculado, com trilha de "voltar") =====
const _navStack = [];   // [{id, nome}] — só no modo secreto; o público segue o canvas AO VIVO

function atualizarBtnVoltar() {
    const btn = document.getElementById('tbNavVoltar');
    if (!btn) return;
    const topo = _navStack[_navStack.length - 1];
    btn.style.display = (T.mode === 'secret' && topo) ? '' : 'none';
    if (topo) btn.textContent = `← ${topo.nome}`;
}

function limparNavegacao() { _navStack.length = 0; atualizarBtnVoltar(); }

window.tbAbrirMapaVinculado = async function(canvasId) {
    if (T.mode !== 'secret' || !T.isMaster) return;
    const alvo = T.canvases.find(c => c.id === canvasId);
    if (!alvo) { toast('⚠️ O mapa vinculado não existe mais', 'warning'); return; }
    _navStack.push({ id: T.canvasId, nome: T.canvases.find(c => c.id === T.canvasId)?.nome || 'Mapa' });
    await transicaoDeCena(() => trocarCanvas(canvasId, false));
    atualizarBtnVoltar();
    toast(`🗺️ ${alvo.nome}`);
};

window.tbNavVoltar = async function() {
    const ant = popNavegacaoValida(_navStack, id => T.canvases.some(c => c.id === id));
    atualizarBtnVoltar();
    if (!ant) return;
    await transicaoDeCena(() => trocarCanvas(ant.id, false));
    atualizarBtnVoltar();
};

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
window.tbIrCanvas = async (id) => { fecharModal(); limparNavegacao(); await trocarCanvas(id, false); };
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
        // F7.2: exclusão em lote (1 commit a cada 400 docs)
        const docs = objs.docs;
        for (let i = 0; i < docs.length; i += 400) {
            const lote = writeBatch(db);
            docs.slice(i, i + 400).forEach(d => lote.delete(d.ref));
            await lote.commit();
        }
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
            <label>Unidade<select id="cfg_un">${optsUnidade(e.unidade)}</select></label>
            <label class="tb-check"><input type="checkbox" id="cfg_show" ${g.show!==false?'checked':''}> Mostrar grid</label>
            <label class="tb-check"><input type="checkbox" id="cfg_snap" ${g.snap!==false?'checked':''}> Encaixar tokens no grid</label>
            <label>Tipo de grid<select id="cfg_gtipo">
                <option value="quad" ${(g.tipo||'quad')==='quad'?'selected':''}>◻️ Quadrada</option>
                <option value="hexP" ${g.tipo==='hexP'?'selected':''}>⬡ Hexagonal (ponta p/ cima)</option>
                <option value="hexF" ${g.tipo==='hexF'?'selected':''}>⬣ Hexagonal (lado p/ cima)</option>
                <option value="none" ${g.tipo==='none'?'selected':''}>🚫 Sem grid</option>
            </select></label>
            <label>Diagonais (grid quadrada)<select id="cfg_diag">
                <option value="eucl" ${(g.diagonal||'eucl')==='eucl'?'selected':''}>📐 Euclidiana (real)</option>
                <option value="cheb" ${g.diagonal==='cheb'?'selected':''}>♟️ 5-5-5 (Chebyshev)</option>
                <option value="alt" ${g.diagonal==='alt'?'selected':''}>🎲 5-10-5 (alternada)</option>
            </select></label>
        </div>
        <hr class="tb-hr">
        <div class="tb-section-title">🚶 Movimento & Andares</div>
        <div class="tb-form-grid">
            <label class="tb-check"><input type="checkbox" id="cfg_lock" ${c.bloquearMovimento!==false?'checked':''}> 🧱 Bloquear movimento através de paredes (jogadores)</label>
            <label class="tb-check"><input type="checkbox" id="cfg_reguaPub" ${c.reguaPublica!==false?'checked':''}> 📏 Exibir régua no Público do Mestre (o arrasto de token no secreto aparece na TV e para os jogadores)</label>
            <label>Altura de cada andar (elevação)<input type="number" id="cfg_andar" value="${c.andarAltura||5}" min="1" step="0.5"></label>
            <label>🛤️ Viagem do grupo por dia (${e.unidade||'m'}/dia · para rotas · vazio = sem cálculo)
                <input type="number" id="cfg_viagem" value="${c.viagemPorDia || ''}" min="0" step="1"
                    placeholder="≈ ${refViagemPorDia(e.unidade || 'm')} (grupo a pé)"></label>
        </div>
        <div class="tb-muted" style="font-size:.75rem;margin-top:6px;line-height:1.6">
            📖 Referência: a pé, um grupo de humanos comuns cobre <b>≈ ${refViagemPorDia(e.unidade || 'm')} ${esc(e.unidade || 'm')}/dia</b>
            (cerca de 3 km/h ao longo de ${HORAS_DE_MARCHA} h de marcha, já contando pausas para descanso e refeições).
            Montado ou de carroça em estrada boa, dobre esse valor; por trilha ruim, mata fechada ou montanha, corte pela metade.
            Um “dia” aqui vale ${HORAS_DE_MARCHA} h de marcha — é essa a base das horas e minutos mostrados nas rotas.
        </div>
        <hr class="tb-hr">
        <div class="tb-section-title">🌦️ Clima</div>
        <div class="tb-form-grid">
            <label>Tipo<select id="cfg_clima">
                ${[['nenhum','— Nenhum —'],['chuva','🌧️ Chuva'],['neve','❄️ Neve'],['cinzas','🌋 Cinzas'],['nevoa','🌫️ Névoa']].map(x=>`<option value="${x[0]}" ${((c.clima?.tipo)||'nenhum')===x[0]?'selected':''}>${x[1]}</option>`).join('')}
            </select></label>
            <label>Intensidade<input type="number" id="cfg_climaInt" value="${c.clima?.intensidade||1}" min="0.2" max="2" step="0.2"></label>
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
        <div class="tb-form-grid" style="margin-top:6px">
            <label class="tb-check"><input type="checkbox" id="cfg_memoria" ${l.memoria!==false?'checked':''}> 🗺️ Memória de exploração (áreas já vistas ficam semivisíveis)</label>
            <button class="tb-btn tb-btn-small tb-btn-danger" type="button" onclick="tbResetExploracao()">🌫️ Resetar exploração da mesa</button>
        </div>
        <div class="tb-muted" style="font-size:.78rem;margin-top:6px">No modo público o fog é sempre 100% quando ativo. Riscos na camada <b>💡 Luz</b> bloqueiam a visão dos tokens; 🪟 janelas deixam a luz passar mas bloqueiam movimento; 🚪 portas abertas liberam os dois.</div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarConfig()">💾 Salvar</button></div>
    `);
};
window.tbSalvarConfig = async function() {
    const v = id => document.getElementById(id);
    try {
        await updateDoc(refCanvas(), {
            grid: { size: parseInt(v('cfg_grid').value)||70, show: v('cfg_show').checked, snap: v('cfg_snap').checked, tipo: v('cfg_gtipo').value, diagonal: v('cfg_diag').value },
            escala: { valorPorCelula: parseFloat(v('cfg_vpc').value)||1.5, unidade: v('cfg_un').value },
            luzDinamica: { ativa: v('cfg_luz').checked, modo: v('cfg_modo').value, fogSecretOpacity: (parseInt(v('cfg_fog').value)||0)/100, memoria: v('cfg_memoria').checked },
            bloquearMovimento: v('cfg_lock').checked,
            reguaPublica: v('cfg_reguaPub').checked,
            andarAltura: parseFloat(v('cfg_andar').value)||5,
            viagemPorDia: parseFloat(v('cfg_viagem').value)||0,
            clima: { tipo: v('cfg_clima').value, intensidade: parseFloat(v('cfg_climaInt').value)||1 },
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
                ${PERMISSOES_LISTA.map(pl => `<label class="tb-check tb-check-sm"><input type="checkbox" data-uid="${u}" data-perm="${pl.key}" ${p[pl.key]?'checked':''} onchange="tbPermSync('${pl.key}')"> ${pl.label}</label>`).join('')}
            </div>
        </div>`;
    }).join('');
    // Linha da MESA: marcar aqui marca a mesma permissão em todo mundo. É só um
    // atalho de preenchimento — o que vai para o banco continua sendo a
    // permissão de cada jogador, então dá para ajustar um deles depois.
    const todos = `<div class="tb-perm-row" style="border-color:var(--tb-primary)">
        <div class="tb-perm-user"><b>🌐 Toda a mesa</b><div class="tb-muted" style="font-size:.75rem">${jogadores.length} ${jogadores.length === 1 ? 'jogador' : 'jogadores'}</div></div>
        <div class="tb-perm-checks">
            ${PERMISSOES_LISTA.map(pl => {
                const marcados = jogadores.filter(u => (perms[u] || {})[pl.key]).length;
                return `<label class="tb-check tb-check-sm"><input type="checkbox" data-todos="${pl.key}"
                    ${marcados === jogadores.length ? 'checked' : ''} onchange="tbPermTodos('${pl.key}',this.checked)"> ${pl.label}</label>`;
            }).join('')}
        </div>
    </div>`;
    abrirModal('🔑 Permissões de Edição (modo público)', `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">Válidas para <b>este canvas</b>. A linha da mesa aplica a permissão a todos de uma vez; abaixo dá para acertar caso a caso.</div>
        ${todos}
        ${linhas}
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarPermissoes()">💾 Salvar</button></div>
    `);
    PERMISSOES_LISTA.forEach(pl => window.tbPermSync(pl.key));   // meio-marcado já na abertura
};
/** Marca/desmarca a permissão de TODOS os jogadores da lista aberta. */
window.tbPermTodos = function(perm, valor) {
    document.querySelectorAll(`#tbModal input[data-perm="${perm}"]`).forEach(i => { i.checked = valor; });
};
/** Devolve a caixa da mesa ao estado certo quando um jogador é ajustado sozinho. */
window.tbPermSync = function(perm) {
    const ind = [...document.querySelectorAll(`#tbModal input[data-perm="${perm}"]`)];
    const box = document.querySelector(`#tbModal input[data-todos="${perm}"]`);
    if (!box) return;
    box.checked = ind.length > 0 && ind.every(i => i.checked);
    box.indeterminate = !box.checked && ind.some(i => i.checked);
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
