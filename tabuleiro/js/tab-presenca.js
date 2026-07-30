// =============================================
// TABULEIRO — Presença, Cursores e Pings (FASE 2)
// - Cursores dos participantes em tempo real (throttle 200ms, heartbeat 10s)
// - Ping com duplo-clique + Alt (mestre pode forçar a câmera dos outros)
// - Tween de câmera reutilizável
// =============================================
import { setDoc, onSnapshot } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, markDirty, toast, uid } from './tab-state.js';
import { refPresenca, refPings } from './tab-main.js';

// 300ms: o doc de presença é único para a mesa e concorre com as escritas do
// token durante o arrasto. Cursor é enfeite — não vale gastar banda de escrita.
const CURSOR_THROTTLE = 300;
const HEARTBEAT = 10000;
const CURSOR_TTL = 15000;
const PING_DUR = 2200;

let ultEnvio = 0;
let heartbeatTimer = null;
let minhaCor = '#f472b6';

export function cursoresAtivados() {
    return localStorage.getItem('tb_cursores') !== 'off';
}

export function initPresenca() {
    minhaCor = T.isMaster ? '#f59e0b' : corDeUid(T.user?.uid || 'x');
    T.cursoresRemotos = {};
    T.pingsAtivos = [];

    // Listeners
    T.unsubs.push(onSnapshot(refPresenca(), s => {
        T.cursoresRemotos = s.exists() ? (s.data() || {}) : {};
        markDirty();
    }));
    T.unsubs.push(onSnapshot(refPings(), s => {
        const d = s.exists() ? s.data() : null;
        const p = d?.ultimo;
        if (!p || !p.t || Date.now() - p.t > 8000) return;
        if (p.origem === T.user?.uid) return;
        if (p.canvasId && p.canvasId !== T.canvasId) return;
        dispararPingLocal(p);
        if (p.forcar && !T.isMaster) tweenCamera(p.x, p.y, Math.max(T.cam.z, 0.8), 650);
    }));

    // Heartbeat (mantém o cursor "vivo" mesmo parado)
    heartbeatTimer = setInterval(() => {
        if (document.visibilityState === 'visible') publicarCursor(T._ultimoCursorMundo, true);
    }, HEARTBEAT);

    // Botão de toggle
    const btn = document.getElementById('btnCursores');
    if (btn) {
        atualizarBotao(btn);
        btn.onclick = () => {
            localStorage.setItem('tb_cursores', cursoresAtivados() ? 'off' : 'on');
            atualizarBotao(btn);
            if (!cursoresAtivados()) publicarCursor(null, true);
            markDirty();
        };
    }
    window.addEventListener('beforeunload', () => { try { publicarCursor(null, true); } catch (e) {} });
}
function atualizarBotao(btn) {
    btn.classList.toggle('tb-btn-primary', cursoresAtivados());
    btn.title = cursoresAtivados() ? 'Cursores ao vivo: ATIVADOS' : 'Cursores ao vivo: desativados';
}

function corDeUid(u) {
    const cores = ['#f472b6', '#38bdf8', '#4ade80', '#facc15', '#fb923c', '#a78bfa', '#f87171', '#2dd4bf'];
    let h = 0; for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
    return cores[h % cores.length];
}

/** Publica a posição do cursor (mundo). Chamado no pointermove das ferramentas. */
export function publicarCursor(mundo, forcado = false) {
    if (!T.user || !T.canvasId) return;
    if (!cursoresAtivados() && !forcado) return;
    const agora = Date.now();
    if (!forcado && agora - ultEnvio < CURSOR_THROTTLE) return;
    ultEnvio = agora;
    T._ultimoCursorMundo = mundo;
    const nome = T.isMaster ? 'Mestre' : (T.usersMap[T.user.uid]?.nome || 'Jogador');
    const payload = (mundo && cursoresAtivados())
        ? { x: Math.round(mundo.x), y: Math.round(mundo.y), nome, cor: minhaCor, t: agora, canvasId: T.canvasId }
        : null;
    setDoc(refPresenca(), { [T.user.uid]: payload }, { merge: true }).catch(() => {});
}

/** Cursores remotos válidos (mesmo canvas, dentro do TTL). */
export function cursoresParaDesenhar() {
    const agora = Date.now();
    const out = [];
    for (const [u, c] of Object.entries(T.cursoresRemotos || {})) {
        if (!c || u === T.user?.uid) continue;
        if (c.canvasId !== T.canvasId) continue;
        if (!c.t || agora - c.t > CURSOR_TTL) continue;
        out.push(c);
    }
    return out;
}

// ---------- PINGS ----------
export function enviarPing(mundo, forcar = false) {
    const nome = T.isMaster ? 'Mestre' : (T.usersMap[T.user?.uid]?.nome || 'Jogador');
    const p = {
        id: uid(), x: Math.round(mundo.x), y: Math.round(mundo.y),
        cor: minhaCor, nome, t: Date.now(),
        forcar: forcar && T.isMaster, origem: T.user?.uid, canvasId: T.canvasId,
    };
    dispararPingLocal(p);
    setDoc(refPings(), { ultimo: p }, { merge: true }).catch(() => {});
    if (p.forcar) toast('📍 Ping enviado (puxando a câmera dos jogadores)');
}

function dispararPingLocal(p) {
    T.pingsAtivos.push({ ...p, t0: Date.now() });
    markDirty();
}

/** Pings em andamento (com progresso 0..1); remove expirados. */
export function pingsParaDesenhar() {
    const agora = Date.now();
    T.pingsAtivos = (T.pingsAtivos || []).filter(p => agora - p.t0 < PING_DUR);
    return T.pingsAtivos.map(p => ({ ...p, prog: (agora - p.t0) / PING_DUR }));
}
export function haPingsAtivos() { return (T.pingsAtivos || []).length > 0; }

// ---------- TWEEN DE CÂMERA ----------
export function tweenCamera(x, y, z, dur = 600) {
    T.camTween = { x0: T.cam.x, y0: T.cam.y, z0: T.cam.z, x1: x, y1: y, z1: z ?? T.cam.z, t0: Date.now(), dur };
    markDirty();
}
/** Avança o tween; retorna true enquanto animando (render marca dirty). */
export function avancarTweenCamera() {
    const tw = T.camTween;
    if (!tw) return false;
    let k = (Date.now() - tw.t0) / tw.dur;
    if (k >= 1) { k = 1; T.camTween = null; }
    const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
    T.cam.x = tw.x0 + (tw.x1 - tw.x0) * e;
    T.cam.y = tw.y0 + (tw.y1 - tw.y0) * e;
    T.cam.z = tw.z0 + (tw.z1 - tw.z0) * e;
    return !!T.camTween;
}
