// =============================================
// TABULEIRO — Ferramentas & Interações (FASES 1–7)
// Seleção, Mover (waypoints+custo+lock), Desenho, Texto, Régua (hex/diagonal/terreno),
// Alfinetes avançados, Luz, Templates AoE, Terreno difícil, Pan/Zoom/Pinch,
// Cursores/Pings, Menu radial, Undo/Redo, Atalhos e toque.
// =============================================
import { setDoc, deleteDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty, gridSize, can, camadasVisiveis, objVisivel, tokenDoUsuario, pxParaUnidades, fmtDist, fmtViagem, getCamada, cfgGrid, upcEm, unidadeEm, sincLarguraReal, selecionar, CENARIO_INTERATIVO,
         deveAtualizarPasso, DRAG_WRITE_MS, DRAG_PASSO_CELULA } from './tab-state.js';
import { refReguas, abrirModal, fecharModal } from './tab-main.js';
import { screenToWorld, worldToScreen, bboxOf, handlesOf, centerCamera, paredesDeMovimento, getImg } from './tab-render.js';
import { addObj, updObj, updObjLocal, moverEmLote, delObj, maxZ, abrirPropriedades, uploadArquivo } from './tab-objects.js';
import { snapPonto, medirTrajeto, trajetoColide, simplificarPontos, normalizarRet, bboxDentroDoRet } from './tab-grid.js';
import { criarFilaDeEscrita } from './tab-write-queue.js';
import { publicarCursor, enviarPing } from './tab-presenca.js';
import { abrirMenuRadial } from './tab-hud.js';
import { pontoVisivelAgora } from './tab-fog.js';
import { confirmarTemplate, confirmarTerreno, terrenosDoCanvas, tplCfg } from './tab-templates.js';
import { desfazer, refazer, registrarOp } from './tab-undo.js';
import { anguloDoMovimento, temCone } from './tab-girar.js';
import { medir, contar } from './tab-perf.js';

let cv;
let ponteiro = null;    // estado do gesto atual
let luzSubTool = 'luz'; // luz | porta | janela
let espacoApertado = false;  // Espaço segurado = arrastar o canva com o botão esquerdo
const DRAG_THROTTLE = DRAG_WRITE_MS; // F2.2: padronizado (ver tab-state)

// Toque: pinch + long-press
const pointersAtivos = new Map();
let pinch = null;
let longPressTimer = null;

export function initTools() {
    cv = document.getElementById('tbCanvas');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => {
        if (e.target.matches?.('input,textarea,select')) return;
        if (e.key === ' ' || e.code === 'Space') {
            espacoApertado = false;
            if (cv) cv.style.cursor = T.tool === 'move' ? 'grab' : '';
        }
    });
    // Perder o foco da janela com o Espaço apertado deixava o canva travado em pan
    window.addEventListener('blur', () => {
        if (!espacoApertado) return;
        espacoApertado = false;
        if (cv) cv.style.cursor = T.tool === 'move' ? 'grab' : '';
    });

    document.querySelectorAll('.tb-tool[data-tool]').forEach(b => {
        b.addEventListener('click', () => setTool(b.dataset.tool));
    });
    // Sub-barra de desenho
    document.querySelectorAll('[data-shape]').forEach(b => b.addEventListener('click', () => {
        T.drawShape = b.dataset.shape;
        document.querySelectorAll('[data-shape]').forEach(x => x.classList.toggle('active', x.dataset.shape === T.drawShape));
    }));
    const cor = document.getElementById('drawColor'); if (cor) cor.addEventListener('input', () => T.drawColor = cor.value);
    const gros = document.getElementById('drawWidth'); if (gros) gros.addEventListener('input', () => T.drawWidth = parseInt(gros.value) || 4);
    const fill = document.getElementById('drawFill'); if (fill) fill.addEventListener('change', () => T.drawFill = fill.checked);

    // Config da régua
    const mc = T.measureCfg;
    const bind = (id, campo, tipo) => {
        const el = document.getElementById(id); if (!el) return;
        el.addEventListener('change', () => { mc[campo] = tipo === 'check' ? el.checked : el.value; });
    };
    bind('mFormaSel', 'forma'); bind('mSnapSel', 'snap'); bind('mExibSel', 'exib');
    bind('mMedirToken', 'medirToken', 'check'); bind('mMostrarOutros', 'mostrarOutros', 'check');

    // Submenu de luz
    document.querySelectorAll('[data-luz]').forEach(b => b.addEventListener('click', () => {
        luzSubTool = b.dataset.luz;
        document.querySelectorAll('[data-luz]').forEach(x => x.classList.toggle('active', x.dataset.luz === luzSubTool));
        toast(luzSubTool === 'luz' ? '💡 Clique no mapa para inserir luz' : luzSubTool === 'porta' ? '🚪 Arraste para criar a porta' : '🪟 Arraste para criar a janela');
    }));

    // Redimensionar muda o que cabe na tela: a câmera de quem não pode "ver além
    // do mapa" precisa ser reencaixada, senão o jogador fica olhando para fora do
    // mapa sem ter como voltar (o clamp só rodava no arrasto/zoom). O gancho é
    // chamado pelo resize do render — que ouve o ResizeObserver, não só a janela.
    T._aposResize = clampCamera;

    setTool('select');
}

export function setTool(t) {
    T.tool = t;
    T.temp = null;
    document.querySelectorAll('.tb-tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    const barra = (id, aberto) => { const el = document.getElementById(id); if (el) el.classList.toggle('open', aberto); };
    barra('tbDrawBar', t === 'draw');
    barra('tbMeasureBar', t === 'measure');
    barra('tbLuzBar', t === 'light');
    barra('tbTemplateBar', t === 'template');
    barra('tbTerrenoBar', t === 'terreno');
    cv.style.cursor = { select: 'default', move: 'grab', draw: 'crosshair', text: 'text', measure: 'crosshair', pin: 'copy', light: 'crosshair', template: 'crosshair', terreno: 'crosshair', foco: 'crosshair' }[t] || 'default';
    if (t === 'terreno') toast('⛰️ Clique para adicionar vértices · duplo-clique/Enter fecha · Esc cancela');
    if (t === 'foco') toast('🔭 Clique no ponto — a tela de todos vai até ele');
    markDirty();
}

// ===== HELPERS =====
function evPos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function evWorld(e) { return screenToWorld(evPos(e)); }

function snapMedida(p) {
    const s = T.measureCfg.snap;
    return snapPonto(p, cfgGrid(), s === 'centro' ? 'centro' : s === 'canto' ? 'canto' : 'livre');
}
function snapToken(p) {
    if (T.canvas?.grid?.snap === false) return p;
    return snapPonto(p, cfgGrid(), 'centro');
}

/** Medição completa (F4): grid hex/quad, regra de diagonal, terreno difícil e escala do mapa. */
function labelMedida(pts) {
    const cfg = cfgGrid();
    const info = medirTrajeto(pts, {
        ...cfg,
        upc: (pt) => upcEm(pt),
        unidade: unidadeEm(pts[0]),
        terrenos: terrenosDoCanvas(),
    });
    return { label: fmtDist(info), sub: `${Math.round(info.celulas * 10) / 10} cel`, info };
}

// ===== ROTAS DE VIAGEM =====
// Um desenho (livre/linha) vira rota com `ehRota: true`: tracejado no render e
// distância/dias na mesma régua do resto (hex/diagonal/terreno/escala do mapa).
function infoRota(o) {
    const pts = o.pontos || [];
    return medirTrajeto(pts, { ...cfgGrid(), upc: (pt) => upcEm(pt), unidade: unidadeEm(pts[0]), terrenos: terrenosDoCanvas() });
}
window._tbInfoRota = (id) => {
    const o = T.objects.get(id);
    if (!o || !o.ehRota) return '';
    return fmtViagem(infoRota(o), T.canvas?.viagemPorDia);
};

function converterEmRota(o) {
    // ponytail: tolerância fixa (~gs/16) — traçado a mão perde o tremido, não a forma; expor na UI só se incomodar
    const pontos = simplificarPontos(o.pontos || [], gridSize() / 16);
    updObj(o.id, { ehRota: true, pontos });
    toast(window._tbInfoRota(o.id) || '🛤️ Rota criada');
}

function deslocDoToken(o) {
    // limite de deslocamento vindo da ficha (se existir)
    if (o.vinculo?.tipo === 'char') {
        const ch = T.chars.find(c => c.id === o.vinculo.id);
        if (ch && ch.desloc != null && !isNaN(ch.desloc)) return ch.desloc;
    }
    return null;
}

function podeMoverObj(o) {
    // 🔒 Objeto bloqueado: ninguém move — nem o Mestre (desbloqueie antes)
    if (o.bloqueado) return false;
    if (T.isMaster) return true;
    if (o.tipo === 'token' && tokenDoUsuario(o)) return can('moverToken');
    // loot segue a MESMA permissão de interação do cenário (portas/janelas/luzes)
    if (o.tipo === 'loot') return can('interagirCenario');
    if (o.criadoPor === T.user?.uid) return true;
    return false;
}
/**
 * Pode acionar porta/janela/luz? Mestre sempre; jogador precisa da permissão
 * `interagirCenario` E de enxergar o objeto — senão dava para abrir às cegas
 * uma porta escondida no fog e mapear o cenário por tentativa.
 */
function podeAcionarCenario(o) {
    if (!CENARIO_INTERATIVO.has(o.tipo) || !can('interagirCenario')) return false;
    if (T.mode === 'secret') return true;
    if (!T.canvas?.luzDinamica?.ativa) return true;
    const p = o.pontos?.length >= 2
        ? { x: (o.pontos[0].x + o.pontos[1].x) / 2, y: (o.pontos[0].y + o.pontos[1].y) / 2 }
        : { x: o.x, y: o.y };
    return !!pontoVisivelAgora(p);
}

/** Abre/fecha porta e janela, acende/apaga luz. Um write, todo mundo vê. */
function acionarCenario(o) {
    if (o.tipo === 'luz') { updObj(o.id, { apagada: !o.apagada }); toast(o.apagada ? '💡 Luz acesa' : '🕯️ Luz apagada'); return; }
    // Trancada: jogador precisa da chave (mesmo mecanismo do baú); mestre ignora
    if (o.trancado && !(T.mode === 'secret' || T.isMaster)) {
        if (window.tbAbrirDestrancar) window.tbAbrirDestrancar(o.id);
        return;
    }
    updObj(o.id, { aberta: !o.aberta });
    const nome = o.tipo === 'porta' ? '🚪 Porta' : '🪟 Janela';
    toast(`${nome} ${o.aberta ? 'fechada' : 'aberta'}`);
}

function podeEditarObj(o) {
    // 🔒 Objeto bloqueado: edição/redimensionamento desabilitados para todos
    if (o.bloqueado) return false;
    if (T.isMaster) return true;
    return o.criadoPor === T.user?.uid;
}

/** Hit-test do topo para baixo respeitando a ordem de renderização do modo atual. */
function pickObject(w) {
    let camadas = camadasVisiveis().slice();
    if (T.mode === 'secret') {
        const luz = (T.canvas?.camadas || []).find(c => c.tipo === 'luz');
        if (luz && !camadas.includes(luz)) camadas.push(luz);
    }
    camadas.sort((a, b) => (b.ordem||0) - (a.ordem||0));
    for (const cam of camadas) {
        const objs = [...T.objects.values()].filter(o => o.layerId === cam.id && objVisivel(o)).sort((a, b) => (b.z||0) - (a.z||0));
        for (const o of objs) if (hitObj(o, w)) return o;
    }
    return null;
}

function hitObj(o, w) {
    const b = bboxOf(o);
    const dentro = w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h;
    if (!dentro) return false;
    if (o.tipo === 'token') return Math.hypot(w.x - o.x, w.y - o.y) <= ((o.tamanhoCelulas || 1) * gridSize()) / 2 + 4;
    if (o.tipo === 'loot') return Math.hypot(w.x - o.x, w.y - o.y) <= gridSize() * 0.45;
    if (o.tipo === 'relogio') return Math.hypot(w.x - o.x, w.y - o.y) <= gridSize() * 0.75;
    if (o.tipo === 'alfinete') return Math.hypot(w.x - o.x, w.y - (o.y - 16)) <= 20 || Math.hypot(w.x - o.x, w.y - o.y) <= 12;
    if (o.tipo === 'luz') return Math.hypot(w.x - o.x, w.y - o.y) <= 18;
    if (o.tipo === 'template') return true; // bbox já filtra (seleção p/ mestre)
    if (o.tipo === 'terreno') return T.mode === 'secret';
    if (o.tipo === 'porta' || o.tipo === 'janela') {
        const p = o.pontos || []; if (p.length < 2) return false;
        return distSeg(p[0], p[1], w) <= 10 / T.cam.z + 4;
    }
    if (o.tipo === 'desenho' || o.tipo === 'medida') {
        const pts = o.pontos || []; const tol = (o.grossura || 4) / 2 + 8 / T.cam.z;
        if (o.forma === 'ret' || o.forma === 'elipse') return true; // bbox já filtra
        for (let i = 0; i < pts.length - 1; i++) if (distSeg(pts[i], pts[i+1], w) <= tol) return true;
        return pts.length === 1;
    }
    return true; // imagem, texto, mostrar
}
function distSeg(a, b, p) {
    const l2 = (b.x-a.x)**2 + (b.y-a.y)**2;
    if (!l2) return Math.hypot(p.x-a.x, p.y-a.y);
    let t = ((p.x-a.x)*(b.x-a.x) + (p.y-a.y)*(b.y-a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t*(b.x-a.x)), p.y - (a.y + t*(b.y-a.y)));
}

function pickHandle(w) {
    if (!T.selection) return null;
    const o = T.objects.get(T.selection);
    if (!o || !['imagem', 'mostrar'].includes(o.tipo) || !podeEditarObj(o)) return null;
    const b = bboxOf(o);
    for (const h of handlesOf(b)) if (Math.hypot(w.x - h.x, w.y - h.y) <= 10 / T.cam.z) return { k: h.k, b };
    return null;
}

// ===== EVENTOS =====
function onDown(e) {
    cv.setPointerCapture(e.pointerId);
    const scr = evPos(e), w = evWorld(e);

    // ---- Toque: 2º dedo durante o arrasto = vértice (equivale ao botão direito) ----
    // Consome o toque inteiro: nada de pinça/long-press no meio de um movimento.
    if (e.pointerType === 'touch' && ponteiro?.tipo === 'dragObj' && ponteiro.trail) {
        pointersAtivos.set(e.pointerId, scr);
        cancelarLongPress();
        if (addWaypoint()) toast('📍 Vértice adicionado');
        return;
    }

    // ---- Toque: 2º dedo durante a régua = vértice (equivale ao botão direito) ----
    if (e.pointerType === 'touch' && ponteiro?.tipo === 'measure' && T.temp?.tipo === 'medida' && !T.temp.caneta) {
        pointersAtivos.set(e.pointerId, scr);
        cancelarLongPress();
        T.temp.pontos.push(snapMedida(w));
        markDirty(); toast('📍 Vértice adicionado');
        return;
    }

    // ---- Pinch-zoom (2 dedos) — F7.4 ----
    pointersAtivos.set(e.pointerId, scr);
    if (pointersAtivos.size === 2) {
        cancelarLongPress();
        const [p1, p2] = [...pointersAtivos.values()];
        pinch = { d0: Math.hypot(p2.x - p1.x, p2.y - p1.y), z0: T.cam.z, c0: { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 }, cam0: { ...T.cam } };
        ponteiro = null; T.temp = null;
        return;
    }

    // ---- Long-press (toque) = menu de contexto — F7.4 ----
    if (e.pointerType === 'touch') {
        cancelarLongPress();
        longPressTimer = setTimeout(() => {
            const o = pickObject(w);
            if (o) { ponteiro = null; abrirCtxOuRadial(o, e.clientX, e.clientY); }
        }, 550);
    }

    // Botão do meio ou direito = pan (ou vértice na régua / waypoint no arrasto)
    if (e.button === 2) {
        // F4.4: waypoint durante arrasto de token. TEM de vir antes da régua:
        // arrastando um token, T.temp já é uma 'medida' (a rota do movimento),
        // então o teste de baixo capturava o clique e empurrava o vértice em
        // T.temp.pontos — que o onMove reconstrói do trail a cada movimento.
        // O vértice ia para o lugar errado e sumia no frame seguinte.
        if (ponteiro?.tipo === 'dragObj' && ponteiro.trail) { addWaypoint(); return; }
        if (T.temp?.tipo === 'medida' && T.measureCfg.forma !== 'caneta') {
            T.temp.pontos.push(snapMedida(w));
            markDirty();
            return;
        }
        ponteiro = { tipo: 'pan', scr, cam: { ...T.cam }, botao: 2, moveu: false, alvoCtx: pickObject(w), w0: w };
        return;
    }
    if (e.button === 1) { ponteiro = { tipo: 'pan', scr, cam: { ...T.cam }, botao: 1, moveu: false }; return; }
    if (e.button !== 0) return;

    // Espaço segurado: o botão esquerdo arrasta o canva, qualquer que seja a
    // ferramenta — atalho padrão de editor, evita trocar para ✋ e voltar.
    if (espacoApertado) {
        ponteiro = { tipo: 'pan', scr, cam: { ...T.cam }, botao: 0, moveu: false };
        return;
    }

    switch (T.tool) {
        case 'select': {
            const h = pickHandle(w);
            if (h) { ponteiro = { tipo: 'resize', id: T.selection, handle: h.k, b0: h.b, w0: w }; return; }
            const o = pickObject(w);
            if (o) {
                // Relógio: clique do mestre = avançar fatia (F6.2)
                if (o.tipo === 'relogio' && T.isMaster && T.mode === 'secret' && !e.shiftKey && !o.bloqueado) {
                    // Vinculado a frente: só exibição — o avanço passa pela
                    // colheita/Painel para registrar motivo e disparar presságio
                    if (o.frenteId) {
                        toast('🕰️ Relógio de frente — avance pela colheita ou pelo Painel do Mestre');
                        selecionar(o.id); markDirty();
                        return;
                    }
                    const cheias = Math.min((o.cheias || 0) + 1, o.fatias || 6);
                    updObj(o.id, { cheias });
                    selecionar(o.id); markDirty();
                    return;
                }
                // Clicar num item já laçado arrasta o conjunto inteiro
                if (T.selecionados.length > 1 && T.selecionados.includes(o.id) && podeMoverObj(o)) {
                    iniciarDragMulti(w, e.pointerId);
                    markDirty();
                    break;
                }
                selecionar(o.id);
                abrirPropriedades(o.id);
                markDirty();
                if (podeMoverObj(o)) {
                    iniciarDragObj(o, w, e.pointerId);
                } else ponteiro = { tipo: 'clickObj', id: o.id };
                if (o.tipo === 'alfinete') mostrarPopupAlfinete(o);
                if (o.tipo === 'desenho' && o.ehRota) toast(window._tbInfoRota(o.id));
            } else {
                // Canva vazio: laço de seleção (para arrastar o canva, use ✋,
                // o botão direito ou o Espaço)
                selecionar(null); abrirPropriedades(null);
                T.temp = { tipo: 'marquee', a: w, b: w };
                ponteiro = { tipo: 'marquee' };
                markDirty();
            }
            break;
        }
        case 'move': {
            const o = pickObject(w);
            if (o && podeMoverObj(o)) {
                selecionar(o.id); abrirPropriedades(o.id);
                iniciarDragObj(o, w, e.pointerId);
                cv.style.cursor = 'grabbing';
            } else ponteiro = { tipo: 'pan', scr, cam: { ...T.cam }, botao: 0, moveu: false };
            break;
        }
        case 'draw': {
            if (!can('desenhar') && !T.isMaster) { toast('⚠️ Sem permissão para desenhar', 'warning'); return; }
            T.temp = { tipo: 'desenho', forma: T.drawShape === 'caneta' ? 'livre' : T.drawShape, pontos: [w], cor: T.drawColor, grossura: T.drawWidth, fill: T.drawFill };
            ponteiro = { tipo: 'draw' };
            break;
        }
        case 'text': {
            if (!can('addTexto') && !T.isMaster) { toast('⚠️ Sem permissão para texto', 'warning'); return; }
            abrirModalTexto(w);
            break;
        }
        case 'measure': {
            if (!can('medir') && !T.isMaster) { toast('⚠️ Sem permissão para medir', 'warning'); return; }
            // Régua já aberta no modo clique-a-clique: este clique é mais um vértice
            if (T.temp?.tipo === 'medida' && T.temp.modoClique) {
                T.temp.pontos.push(snapMedida(w));
                markDirty();
                return;
            }
            const p0 = T.measureCfg.forma === 'caneta' ? w : snapMedida(w);
            T.temp = { tipo: 'medida', pontos: [p0], atual: null, caneta: T.measureCfg.forma === 'caneta' };
            ponteiro = { tipo: 'measure', scr, moveu: false, pointerId: e.pointerId };
            break;
        }
        case 'pin': {
            if (!can('alfinete') && !T.isMaster) { toast('⚠️ Sem permissão para alfinetes', 'warning'); return; }
            criarAlfinete(w);
            break;
        }
        case 'foco': {
            // Ping FORÇADO: o mesmo caminho do Alt+Shift+clique, mas como
            // ferramenta — a tela de todo mundo (menos a secreta, que é a de
            // trabalho) viaja até o ponto. Zero estado novo: um campo no doc de
            // pings que a mesa já escuta.
            if (T.mode !== 'secret') return;
            enviarPing(w, true);
            break;
        }
        case 'light': {
            if (T.mode !== 'secret') return;
            if (luzSubTool === 'luz') {
                addObj({ tipo: 'luz', layerId: 'luz', x: w.x, y: w.y, alcance: T.luzCfg.alcance, cor: T.luzCfg.cor, visivelPublico: true });
            } else {
                T.temp = { tipo: 'segmento', sub: luzSubTool, pontos: [w], atual: w };
                ponteiro = { tipo: 'segmento' };
            }
            break;
        }
        case 'template': { // F4.3
            if (T.mode !== 'secret') return;
            const p0 = snapMedida(w);
            T.temp = { tipo: 'template', pontos: [p0], atual: p0, dados: { ...tplCfg, forma: tplCfg.forma, raio: tplCfg.forma === 'circulo' ? 0 : tplCfg.largura * gridSize(), ang: tplCfg.ang, cor: tplCfg.cor, alpha: tplCfg.alpha } };
            ponteiro = { tipo: 'template' };
            break;
        }
        case 'terreno': { // F4.5 — cliques adicionam vértices
            if (T.mode !== 'secret') return;
            if (!T.temp || T.temp.tipo !== 'terreno') T.temp = { tipo: 'terreno', pontos: [] };
            T.temp.pontos.push(w);
            T.temp.atual = w;
            markDirty();
            break;
        }
    }
}

/** Paredes valem para este arrasto? (jogador movendo token, com o bloqueio ligado) */
function segsDoArrasto(o) {
    if (o.tipo !== 'token' || !bloqueioAtivo()) return null;
    return paredesDeMovimento(o.elev || 0);   // uma vez por arrasto: paredes não mudam no meio
}
/** Bloqueio de movimento por paredes. Ligado por padrão — desligar é escolha do mestre. */
function bloqueioAtivo() {
    return T.canvas?.bloquearMovimento !== false && !T.isMaster;
}

/**
 * Fixa um vértice no trajeto do token que está sendo arrastado — é o que
 * transforma o arrasto em rota (e faz a régua somar trecho a trecho).
 * Botão direito (mouse) e 2º dedo (toque) caem os dois aqui.
 * @returns true se o vértice foi realmente criado.
 */
function addWaypoint() {
    const o = T.objects.get(ponteiro.id);
    if (!o) return false;
    const ult = ponteiro.trail[ponteiro.trail.length - 1];
    if (Math.hypot(o.x - ult.x, o.y - ult.y) < 1) return false; // parado: vértice repetido não vira rota
    ponteiro.trail.push({ x: o.x, y: o.y });
    markDirty();
    return true;
}

/**
 * Arrasto do conjunto laçado. O grupo é RÍGIDO: um único offset (dx, dy) vindo
 * do ponteiro é aplicado a todos os itens, só no estado LOCAL, e a gravação é
 * um commit em lote ao soltar. Antes cada objeto escrevia por conta própria
 * durante o arrasto e os ecos do Firestore voltavam intercalados, embaralhando
 * as posições relativas do grupo.
 */
function iniciarDragMulti(w, pointerId) {
    const moviveis = T.selecionados.map(id => T.objects.get(id)).filter(o => o && podeMoverObj(o));
    const travados = T.selecionados.length - moviveis.length;
    const itens = moviveis.map(o => ({
        id: o.id, x0: o.x, y0: o.y,
        pontos0: o.pontos ? o.pontos.map(p => ({ ...p })) : null,
    }));
    // __dragging blinda cada item contra o eco do snapshot durante o arrasto;
    // __fogPos é o ponto de partida da visão, que acompanha o grupo em passos.
    for (const o of moviveis) {
        o.__dragging = true;
        if (o.tipo === 'token') o.__fogPos = { x: o.x, y: o.y };
    }
    T.dragAtivo = true;
    ponteiro = { tipo: 'dragMulti', itens, w0: w, pointerId, moveu: false };
    if (travados) toast(`🔒 ${travados} item(ns) da seleção estão travados e ficaram no lugar`, 'warning');
}

/** Tudo que está contido no retângulo e visível no modo atual. */
function selecionarNoRetangulo(r) {
    if (r.w < 3 && r.h < 3) { selecionar(null); abrirPropriedades(null); return; }   // clique seco = só limpa
    const visiveis = new Set(camadasVisiveis().map(c => c.id));
    if (T.mode === 'secret') {
        const luz = (T.canvas?.camadas || []).find(c => c.tipo === 'luz');
        if (luz) visiveis.add(luz.id);
    }
    const ids = [...T.objects.values()]
        .filter(o => visiveis.has(o.layerId) && objVisivel(o) && bboxDentroDoRet(bboxOf(o), r))
        .sort((a, b) => (a.z || 0) - (b.z || 0))
        .map(o => o.id);

    T.selecionados = ids;
    T.selection = ids.length === 1 ? ids[0] : null;
    abrirPropriedades(T.selection);
    if (ids.length > 1) toast(`✅ ${ids.length} objetos selecionados — arraste para mover, Delete para excluir`);
    else if (!ids.length) toast('Nada dentro do laço', 'warning');
}

function iniciarDragObj(o, w, pointerId) {
    ponteiro = {
        tipo: 'dragObj', id: o.id, w0: w, x0: o.x, y0: o.y, pointerId,
        pontos0: o.pontos ? o.pontos.map(p => ({ ...p })) : null,
        moveu: false, ultimoWrite: 0,
        trail: o.tipo === 'token' ? [{ x: o.x, y: o.y }] : null, // waypoints
        // F4.6: a parede segura o token DURANTE o arrasto — nada de atravessar e voltar no fim
        segs: segsDoArrasto(o),
        ultimoValido: { x: o.x, y: o.y },
        ultWrite: { x: o.x, y: o.y },   // última posição enviada ao Firestore
    };
    const lo = T.objects.get(o.id);
    if (lo) {
        lo.__dragging = true;
        if (lo.tipo === 'token') lo.__fogPos = { x: lo.x, y: lo.y }; // ponto de partida do fog; anda em passos junto com o arrasto
    }
    T.dragAtivo = true;   // segura o save da exploração até soltar (ver tab-fog)
}

function cancelarLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }

// Elemento das coordenadas em cache + último texto: era um getElementById e uma
// escrita no DOM a CADA pointermove, 60x por segundo durante todo o arrasto.
let elCoords = null, ultCoords = '';

function onMove(e) {
    contar('pointermove');
    const scr = evPos(e), w = evWorld(e);
    if (!elCoords) elCoords = document.getElementById('tbCoords');
    if (elCoords) {
        const txt = `${Math.round(w.x)}, ${Math.round(w.y)} · ${Math.round(T.cam.z * 100)}%`;
        if (txt !== ultCoords) { elCoords.textContent = txt; ultCoords = txt; }
    }

    // Cursor ao vivo (F2.4)
    publicarCursor(w);

    // Pinch em andamento
    if (pinch && pointersAtivos.has(e.pointerId)) {
        pointersAtivos.set(e.pointerId, scr);
        if (pointersAtivos.size === 2) {
            const [p1, p2] = [...pointersAtivos.values()];
            const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const c = { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 };
            const alvo0 = { x: (pinch.c0.x - cv.getBoundingClientRect().width/2) / pinch.z0 + pinch.cam0.x, y: (pinch.c0.y - cv.getBoundingClientRect().height/2) / pinch.z0 + pinch.cam0.y };
            T.cam.z = Math.max(0.04, Math.min(6, pinch.z0 * (d / Math.max(20, pinch.d0))));
            T.cam.x = alvo0.x - (c.x - cv.getBoundingClientRect().width/2) / T.cam.z;
            T.cam.y = alvo0.y - (c.y - cv.getBoundingClientRect().height/2) / T.cam.z;
            clampCamera(); markDirty();
        }
        return;
    }
    if (longPressTimer && ponteiro) {
        // mover além de um limiar cancela o long-press
        if (Math.abs(scr.x - (ponteiro.scr?.x ?? scr.x)) + Math.abs(scr.y - (ponteiro.scr?.y ?? scr.y)) > 12) cancelarLongPress();
    }

    if (!ponteiro) {
        if (T.temp?.tipo === 'medida' && !T.temp.caneta) { atualizarMedida(w); }
        if (T.temp?.tipo === 'terreno') { T.temp.atual = w; markDirty(); }
        return;
    }
    if (ponteiro.tipo === 'measure' && !ponteiro.moveu && ponteiro.scr &&
        Math.abs(scr.x - ponteiro.scr.x) + Math.abs(scr.y - ponteiro.scr.y) > 6) ponteiro.moveu = true;

    switch (ponteiro.tipo) {
        case 'pan': {
            const dx = (scr.x - ponteiro.scr.x) / T.cam.z, dy = (scr.y - ponteiro.scr.y) / T.cam.z;
            if (Math.abs(scr.x - ponteiro.scr.x) + Math.abs(scr.y - ponteiro.scr.y) > 4) { ponteiro.moveu = true; cancelarLongPress(); }
            T.cam.x = ponteiro.cam.x - dx; T.cam.y = ponteiro.cam.y - dy;
            clampCamera();
            markDirty();
            break;
        }
        case 'dragObj': {
            // Botão direito apertado DURANTE o arrasto: no PC o `pointerdown` do
            // 2º botão nem sempre chega enquanto o 1º segura a captura, então a
            // borda de subida é detectada aqui, pelo bitmask de `buttons`.
            if (ponteiro.trail && e.pointerType === 'mouse') {
                const direito = (e.buttons & 2) !== 0;
                if (direito && !ponteiro.direitoAntes && addWaypoint()) toast('📍 Vértice fixado');
                ponteiro.direitoAntes = direito;
            }
            // só o dedo/ponteiro que iniciou o arrasto move o objeto — o 2º dedo
            // está ali para marcar vértice, não para teleportar o token até ele
            if (ponteiro.pointerId != null && e.pointerId !== ponteiro.pointerId) break;
            const o = T.objects.get(ponteiro.id); if (!o) break;
            const dx = w.x - ponteiro.w0.x, dy = w.y - ponteiro.w0.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) { ponteiro.moveu = true; cancelarLongPress(); }
            if (ponteiro.pontos0) {
                o.pontos = ponteiro.pontos0.map(p => ({ x: p.x + dx, y: p.y + dy }));
                updObj(o.id, { pontos: o.pontos }, DRAG_THROTTLE);
            } else {
                let nx = ponteiro.x0 + dx, ny = ponteiro.y0 + dy;
                if (o.tipo === 'token') { const s = snapToken({ x: nx, y: ny }); nx = s.x; ny = s.y; }
                if (ponteiro.segs) {
                    // parede segura aqui: o token para nela e continua deslizando pelos lados
                    const v = ponteiro.ultimoValido;
                    if (nx !== v.x || ny !== v.y) {
                        if (trajetoColide([v, { x: nx, y: ny }], ponteiro.segs)) {
                            nx = v.x; ny = v.y;
                            if (!ponteiro.avisou) { ponteiro.avisou = true; toast('🧱 Parede no caminho', 'warning'); }
                        } else ponteiro.ultimoValido = { x: nx, y: ny };
                    }
                }
                if (nx === o.x && ny === o.y) break;
                // O token olha para onde anda: sem isto, quem tem visão em cone
                // atravessa o mapa mirando o mesmo canto o tempo todo.
                const mira = temCone(o) ? anguloDoMovimento(nx - o.x, ny - o.y) : null;
                o.x = nx; o.y = ny;
                const patch = o.tipo === 'token' ? { x: nx, y: ny, movendo: true } : { x: nx, y: ny };
                if (mira != null && mira !== o.rot) { o.rot = mira; patch.rot = mira; }
                // F2.2/F2.3: deltas com flag `movendo` (clientes remotos seguram o fog).
                // Só escreve quando andou meia célula desde a última escrita: ajuste
                // fino de posição gerava write sem ninguém notar diferença do outro
                // lado, e write sobrando no mesmo documento é o que enfileira no
                // servidor. O write FINAL do onUp é sempre imediato.
                if (deveAtualizarPasso(ponteiro.ultWrite, { x: nx, y: ny }, gridSize() * DRAG_PASSO_CELULA)) {
                    ponteiro.ultWrite = { x: nx, y: ny };
                    updObj(o.id, patch, DRAG_THROTTLE);
                } else {
                    updObjLocal(o.id, patch);
                }
                // F4.4: preview de custo com waypoints e terreno.
                // Marcou vértice = quer ver a rota, mesmo com "medir token" desligado.
                if (o.tipo === 'token' && (T.measureCfg.medirToken || ponteiro.trail?.length > 1)) medir('regua', () => {
                    const pts = [...ponteiro.trail, { x: nx, y: ny }];
                    const l = labelMedida(pts);
                    const limite = deslocDoToken(o);
                    const excede = limite != null && l.info.valor > limite + 1e-9;
                    T.temp = {
                        tipo: 'medida', pontos: pts, atual: null,
                        label: l.label + (limite != null ? ` / ${limite}` : ''),
                        labelSub: excede ? '⚠️ excede o deslocamento!' : l.sub,
                        cor: excede ? '#ef4444' : '#22d3ee',
                    };
                    // A régua do arrasto do MESTRE só sai daqui se ele deixou
                    // ligado em ⚙️ — desligado não gera write nenhum.
                    if (!T.isMaster || T.canvas?.reguaPublica !== false) compartilharRegua(pts, l.label, o.id);
                });
            }
            markDirty();
            break;
        }
        case 'marquee': {
            if (T.temp?.tipo === 'marquee') { T.temp.b = w; markDirty(); }
            break;
        }
        case 'dragMulti': {
            if (ponteiro.pointerId != null && e.pointerId !== ponteiro.pointerId) break;
            // Offset único, sem snap por item: encaixar cada token no grid
            // separadamente arredondaria uns para um lado e outros para o outro,
            // que é justamente o que "tratar como um objeto só" precisa evitar.
            const dx = w.x - ponteiro.w0.x, dy = w.y - ponteiro.w0.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) { ponteiro.moveu = true; cancelarLongPress(); }
            for (const it of ponteiro.itens) {
                updObjLocal(it.id, it.pontos0
                    ? { pontos: it.pontos0.map(p => ({ x: p.x + dx, y: p.y + dy })) }
                    : { x: it.x0 + dx, y: it.y0 + dy });
            }
            break;
        }
        case 'resize': {
            const o = T.objects.get(ponteiro.id); if (!o) break;
            const b0 = ponteiro.b0, k = ponteiro.handle;
            let x = b0.x, y = b0.y, wdt = b0.w, hgt = b0.h;
            const dx = w.x - ponteiro.w0.x, dy = w.y - ponteiro.w0.y;
            if (k.includes('e')) wdt = Math.max(20, b0.w + dx);
            if (k.includes('s')) hgt = Math.max(20, b0.h + dy);
            if (k.includes('w')) { wdt = Math.max(20, b0.w - dx); x = b0.x + b0.w - wdt; }
            if (k.includes('n')) { hgt = Math.max(20, b0.h - dy); y = b0.y + b0.h - hgt; }
            if (e.shiftKey && o.propW) { hgt = wdt * (o.propH / o.propW); }
            o.x = x; o.y = y; o.w = wdt; o.h = hgt;
            updObj(o.id, { x, y, w: wdt, h: hgt }, DRAG_THROTTLE);
            markDirty();
            break;
        }
        case 'draw': {
            const t = T.temp; if (!t) break;
            if (t.forma === 'livre') t.pontos.push(w);
            else { t.pontos = [t.pontos[0], w]; }
            markDirty();
            break;
        }
        case 'measure': {
            const t = T.temp; if (!t) break;
            if (t.caneta) {
                t.pontos.push(w);
                const l = labelMedida(t.pontos);
                t.label = l.label; t.labelSub = l.sub;
                compartilharRegua(t.pontos, l.label);
            } else atualizarMedida(w);
            markDirty();
            break;
        }
        case 'segmento': {
            if (T.temp) { T.temp.atual = w; markDirty(); }
            break;
        }
        case 'template': {
            if (T.temp) { T.temp.atual = snapMedida(w); markDirty(); }
            break;
        }
    }
}

function atualizarMedida(w) {
    const t = T.temp; if (!t) return;
    t.atual = snapMedida(w);
    const pts = t.pontos.concat([t.atual]);
    const l = labelMedida(pts);
    t.label = l.label; t.labelSub = l.sub;
    compartilharRegua(pts, l.label);
    markDirty();
}

async function onUp(e) {
    pointersAtivos.delete(e.pointerId);
    cancelarLongPress();
    if (pinch) { if (pointersAtivos.size < 2) pinch = null; return; }
    // Soltar o botão direito durante a medição (vértice) não encerra a régua
    if (ponteiro && ponteiro.tipo === 'measure' && e.button === 2) return;
    // Idem no toque: levantar o 2º dedo (o que marcou o vértice) não encerra
    if (ponteiro && ponteiro.tipo === 'measure' && ponteiro.pointerId != null && e.pointerId !== ponteiro.pointerId) return;
    // Soltar o botão direito durante o arrasto (waypoint) não encerra o arrasto
    if (ponteiro && ponteiro.tipo === 'dragObj' && e.button === 2) return;
    // Idem no toque: levantar o 2º dedo (o que marcou o vértice) não solta o token
    if (ponteiro && ponteiro.tipo === 'dragObj' && ponteiro.pointerId != null && e.pointerId !== ponteiro.pointerId) return;
    const p = ponteiro; ponteiro = null;
    if (T.tool === 'move') cv.style.cursor = 'grab';
    if (!p) return;
    // Cobre todos os fins de arrasto (soltar, cancelar, colisão) num lugar só
    if (p.tipo === 'dragObj' || p.tipo === 'dragMulti') T.dragAtivo = false;

    if (p.tipo === 'pan' && p.botao === 2 && !p.moveu && p.alvoCtx) {
        abrirCtxOuRadial(p.alvoCtx, e.clientX, e.clientY);
        return;
    }
    if (p.tipo === 'dragObj') {
        const o = T.objects.get(p.id);
        if (o) {
            delete o.__dragging;
            const trail = p.trail ? [...p.trail, { x: o.x, y: o.y }] : null;

            // F4.6: rede de segurança — o clamp do onMove já segura, mas waypoints
            // (botão direito) e escritas remotas podem ter escapado.
            if (o.tipo === 'token' && p.segs && p.moveu) {
                const hit = trajetoColide(trail || [{ x: p.x0, y: p.y0 }, { x: o.x, y: o.y }], p.segs);
                if (hit) {
                    // Recua para a ÚLTIMA posição válida, não para o ponto de partida.
                    // O clamp do onMove faz o token deslizar rente à parede, e esse
                    // rasante às vezes conta como toque aqui — cancelar o percurso
                    // inteiro fazia o token "voltar para onde estava" no fim de um
                    // movimento legítimo. Agora ele fica onde deu para chegar.
                    const volta = p.ultimoValido || { x: p.x0, y: p.y0 };
                    o.x = volta.x; o.y = volta.y;
                    delete o.__fogPos;
                    updObj(o.id, { x: volta.x, y: volta.y, movendo: false });
                    toast('🧱 Parede no caminho — o token parou onde deu para chegar', 'warning');
                    if (T.temp?.tipo === 'medida') { T.temp = null; limparReguaCompartilhada(); }
                    markDirty();
                    return;
                }
            }

            delete o.__fogPos; // F2.3: agora o fog recalcula na posição final
            const patchFinal = o.pontos ? { pontos: o.pontos } : (o.tipo === 'token' ? { x: o.x, y: o.y, movendo: false } : { x: o.x, y: o.y });
            updObj(o.id, patchFinal);

            // F7.3: registra o movimento no undo (mestre)
            if (p.moveu) {
                registrarOp(p.pontos0
                    ? { tipo: 'patch', id: o.id, antes: { pontos: p.pontos0 }, depois: { pontos: o.pontos } }
                    : { tipo: 'patch', id: o.id, antes: { x: p.x0, y: p.y0 }, depois: { x: o.x, y: o.y } });
            }

            // F5.4: loot solto sobre um token = entrega
            if (o.tipo === 'loot' && p.moveu) {
                const alvo = tokenSobPonto({ x: o.x, y: o.y }, o.id);
                if (alvo && window.tbEntregarLoot) window.tbEntregarLoot(o.id, alvo);
            }
        }
        if (T.temp?.tipo === 'medida') { T.temp = null; limparReguaCompartilhada(); markDirty(); }
        return;
    }
    if (p.tipo === 'marquee') {
        const t = T.temp; T.temp = null;
        if (t) selecionarNoRetangulo(normalizarRet(t.a, t.b));
        markDirty();
        return;
    }
    if (p.tipo === 'dragMulti') {
        const liberar = () => {
            for (const it of p.itens) {
                const o = T.objects.get(it.id); if (!o) continue;
                delete o.__dragging; delete o.__fogPos;   // fog volta a acompanhar a posição real
            }
            markDirty();
        };
        // Clique sem arrastar não gera write nenhum
        if (!p.moveu) { liberar(); return; }

        const patches = [];
        for (const it of p.itens) {
            const o = T.objects.get(it.id); if (!o) continue;
            patches.push({ id: it.id, patch: o.pontos ? { pontos: o.pontos } : { x: o.x, y: o.y } });
        }
        try {
            // Um commit para o grupo inteiro: chega tudo junto ou não chega nada
            await moverEmLote(patches);
            for (const it of p.itens) {
                const o = T.objects.get(it.id); if (!o) continue;
                registrarOp(it.pontos0
                    ? { tipo: 'patch', id: it.id, antes: { pontos: it.pontos0 }, depois: { pontos: o.pontos } }
                    : { tipo: 'patch', id: it.id, antes: { x: it.x0, y: it.y0 }, depois: { x: o.x, y: o.y } });
            }
            toast(`✅ ${patches.length} objetos movidos juntos`);
        } catch (err) {
            console.error(err);
            // Grupo volta inteiro para a origem: melhor desfazer que deixar meio movido
            for (const it of p.itens) {
                updObjLocal(it.id, it.pontos0 ? { pontos: it.pontos0 } : { x: it.x0, y: it.y0 });
            }
            toast('❌ Não consegui mover o grupo — posições restauradas', 'danger');
        } finally {
            liberar();
        }
        return;
    }
    if (p.tipo === 'resize') {
        const o = T.objects.get(p.id);
        if (o) {
            // write final (o throttle do arrasto pode ter ficado para trás) + reencaixe da escala do mapa
            updObj(o.id, { x: o.x, y: o.y, w: o.w, h: o.h, ...sincLarguraReal(o) });
            registrarOp({ tipo: 'patch', id: o.id,
                antes: { x: p.b0.x, y: p.b0.y, w: p.b0.w, h: p.b0.h },
                depois: { x: o.x, y: o.y, w: o.w, h: o.h } });
            abrirPropriedades(o.id, true);
        }
        markDirty();
        return;
    }
    if (p.tipo === 'draw' && T.temp) {
        const t = T.temp; T.temp = null;
        if (t.pontos.length >= 2) {
            await addObj({ tipo: 'desenho', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', forma: t.forma, pontos: t.pontos, cor: t.cor, grossura: t.grossura, fill: t.fill, z: maxZ() + 1 });
        }
        markDirty();
        return;
    }
    if (p.tipo === 'measure' && T.temp) {
        // Clique seco (sem arrastar): a régua fica VIVA no modo clique-a-clique.
        // Antes, soltar o botão encerrava e só dava para criar vértice segurando o
        // botão esquerdo o tempo todo — ninguém mede assim no PC.
        if (!p.moveu && !T.temp.caneta) {
            T.temp.modoClique = true;
            toast('📏 Clique para cada vértice · duplo-clique ou Enter encerra · Esc cancela');
            markDirty();
            return;
        }
        await finalizarMedida();
        return;
    }
    if (p.tipo === 'segmento' && T.temp) {
        const t = T.temp; T.temp = null;
        if (t.atual && Math.hypot(t.atual.x - t.pontos[0].x, t.atual.y - t.pontos[0].y) > 8) {
            await addObj({ tipo: t.sub === 'porta' ? 'porta' : 'janela', layerId: 'luz', pontos: [t.pontos[0], t.atual], aberta: false, x: t.pontos[0].x, y: t.pontos[0].y });
        }
        markDirty();
        return;
    }
    if (p.tipo === 'template' && T.temp) {
        const t = T.temp; T.temp = null;
        const origem = t.pontos[0], destino = t.atual || origem;
        markDirty();
        if (Math.hypot(destino.x - origem.x, destino.y - origem.y) > 6 || tplCfg.forma === 'circulo') {
            await confirmarTemplate(origem, destino);
        }
        return;
    }
}

/** Fecha a medição em andamento (arrasto solto, duplo-clique ou Enter). */
async function finalizarMedida() {
    const t = T.temp; if (!t || t.tipo !== 'medida') return;
    const pts = t.caneta ? t.pontos : t.pontos.concat(t.atual ? [t.atual] : []);
    // duplo-clique deixa o último vértice e o ponto do cursor no mesmo lugar
    const ult = pts[pts.length - 1], penult = pts[pts.length - 2];
    if (penult && Math.hypot(ult.x - penult.x, ult.y - penult.y) < 2) pts.pop();
    T.temp = null;
    limparReguaCompartilhada();
    if (pts.length >= 2 && T.measureCfg.exib === 'permanente') {
        const l = labelMedida(pts);
        await addObj({ tipo: 'medida', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', pontos: pts, label: l.label, cor: '#22d3ee' });
    }
    markDirty();
}

function tokenSobPonto(w, ignorarId) {
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || o.id === ignorarId || !objVisivel(o)) continue;
        if (Math.hypot(w.x - o.x, w.y - o.y) <= ((o.tamanhoCelulas || 1) * gridSize()) / 2 + 6) return o;
    }
    return null;
}

function abrirCtxOuRadial(o, x, y) {
    // Tokens abrem o menu radial (F5.5); demais objetos o menu clássico
    if (o.tipo === 'token' && (T.mode === 'secret' || (o.vinculo?.tipo === 'npc' && can('abrirNpc')))) {
        abrirMenuRadial(o, x, y);
        return;
    }
    // No público o menu só existe para o cenário interativo e o loot (é o caminho
    // do toque, que não tem duplo-clique).
    if (T.mode !== 'secret' && !podeAcionarCenario(o) &&
        !(o.tipo === 'loot' && can('interagirCenario'))) return;
    abrirMenuContexto(o, x, y);
}

function onWheel(e) {
    e.preventDefault();
    const scr = evPos(e);
    const antes = screenToWorld(scr);
    const fator = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    T.cam.z = Math.max(0.04, Math.min(6, T.cam.z * fator));
    const depois = screenToWorld(scr);
    T.cam.x += antes.x - depois.x;
    T.cam.y += antes.y - depois.y;
    clampCamera();
    markDirty();
}

function onDblClick(e) {
    const w = evWorld(e);
    // Régua clique-a-clique: duplo-clique encerra
    if (T.temp?.tipo === 'medida' && T.temp.modoClique) { finalizarMedida(); return; }
    // F2.5: Alt + duplo-clique = ping (Shift junto: mestre força a câmera)
    if (e.altKey) { enviarPing(w, e.shiftKey && T.isMaster); return; }
    // Terreno: duplo-clique fecha o polígono
    if (T.tool === 'terreno' && T.temp?.tipo === 'terreno') {
        const pts = T.temp.pontos; T.temp = null; markDirty();
        confirmarTerreno(pts);
        return;
    }
    const o = pickObject(w);
    if (!o) return;
    if (o.tipo === 'texto' && podeEditarObj(o)) { abrirModalTexto(null, o); return; }
    // Cenário interativo: mestre sempre; jogador com a permissão `interagirCenario`
    if (podeAcionarCenario(o)) { acionarCenario(o); return; }
    if (o.tipo === 'token' && o.vinculo?.tipo === 'npc' && (T.mode === 'secret' || can('abrirNpc'))) {
        const somenteLeitura = T.mode !== 'secret' || !T.isMaster;
        window.tbAbrirNpcModal && window.tbAbrirNpcModal(o.vinculo.id, somenteLeitura);
        return;
    }
    if (o.tipo === 'loot') { window.tbClickLoot && window.tbClickLoot(o.id); return; }
    if (o.tipo === 'mostrar') { window.tbClickMostrar && window.tbClickMostrar(o.id); }
}

function onKey(e) {
    if (e.target.matches?.('input,textarea,select')) return;
    // Vértice de rota pelo TECLADO. É o caminho confiável no PC: segurar o
    // botão esquerdo e clicar com o direito depende do navegador entregar o
    // segundo botão durante a captura, o que nem sempre acontece.
    if ((e.key === ' ' || e.code === 'Space') && ponteiro?.tipo === 'dragObj' && ponteiro.trail) {
        e.preventDefault();
        if (addWaypoint()) toast('📍 Vértice fixado');
        return;
    }
    // Espaço (fora de arrasto) = modo "mãozinha" temporário até soltar a tecla
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!espacoApertado) { espacoApertado = true; if (cv) cv.style.cursor = 'grab'; }
        return;
    }
    if (e.key === 'Escape') { T.temp = null; selecionar(null); abrirPropriedades(null); limparReguaCompartilhada(); markDirty(); return; }
    if (e.key === 'Enter' && T.temp?.tipo === 'medida' && T.temp.modoClique) { finalizarMedida(); return; }
    if (e.key === 'Enter' && T.tool === 'terreno' && T.temp?.tipo === 'terreno') {
        const pts = T.temp.pontos; T.temp = null; markDirty();
        confirmarTerreno(pts);
        return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = T.selecionados.length ? [...T.selecionados] : (T.selection ? [T.selection] : []);
        let n = 0;
        for (const id of ids) {
            const o = T.objects.get(id);
            if (o && podeEditarObj(o)) { delObj(id); n++; }
        }
        if (n > 1) toast(`🗑️ ${n} objetos excluídos`);
        else if (ids.length && !n) toast('⚠️ Nada que você possa excluir na seleção', 'warning');
        return;
    }
    if (e.key === '?' && e.shiftKey) { abrirAjudaAtalhos(); return; }
    // F7.4: setas movem o token selecionado 1 célula
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        const o = T.selection && T.objects.get(T.selection);
        if (o && o.tipo === 'token' && podeMoverObj(o)) {
            e.preventDefault();
            const gs = gridSize();
            const dx = e.key === 'ArrowLeft' ? -gs : e.key === 'ArrowRight' ? gs : 0;
            const dy = e.key === 'ArrowUp' ? -gs : e.key === 'ArrowDown' ? gs : 0;
            const destino = snapToken({ x: o.x + dx, y: o.y + dy });
            if (bloqueioAtivo()) {
                const hit = trajetoColide([{ x: o.x, y: o.y }, destino], paredesDeMovimento(o.elev || 0));
                if (hit) { toast('🧱 Movimento bloqueado', 'warning'); return; }
            }
            const antes = { x: o.x, y: o.y };
            o.x = destino.x; o.y = destino.y;
            updObj(o.id, { x: o.x, y: o.y, movendo: false });
            registrarOp({ tipo: 'patch', id: o.id, antes, depois: { x: o.x, y: o.y } });
            markDirty();
        }
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); return; }
        if (k === 's') { e.preventDefault(); setTool('select'); }
        if (k === 'f') { e.preventDefault(); setTool('draw'); T.drawShape = 'livre'; }
        if (k === 'd') { e.preventDefault(); setTool('draw'); T.drawShape = 'ret'; }
        if (k === 'g') { e.preventDefault(); setTool('text'); }
        if (k === 'm') { e.preventDefault(); setTool('measure'); }
        document.querySelectorAll('[data-shape]').forEach(x => x.classList.toggle('active', x.dataset.shape === T.drawShape));
        return;
    }
}

function abrirAjudaAtalhos() {
    abrirModal('⌨️ Atalhos do Tabuleiro', `
        <div class="tb-list" style="font-size:.85rem;line-height:1.9">
            <div><b>Ctrl+S</b> Selecionar · <b>Ctrl+F</b> Caneta · <b>Ctrl+D</b> Retângulo · <b>Ctrl+G</b> Texto · <b>Ctrl+M</b> Régua</div>
            <div><b>Ctrl+Z / Ctrl+Y</b> Desfazer / Refazer (mestre)</div>
            <div><b>Setas</b> Movem o token selecionado 1 célula</div>
            <div><b>Selecionar (▶):</b> arraste no vazio para <b>laçar</b> tudo que couber dentro do retângulo · arraste um dos laçados para mover o conjunto</div>
            <div><b>Espaço + arrastar</b> Move o canva sem trocar de ferramenta (o botão direito também arrasta)</div>
            <div><b>Alt + duplo-clique</b> Ping no mapa · <b>+Shift</b> (mestre) puxa a câmera de todos</div>
            <div><b>Régua:</b> clique para começar, um clique por vértice, <b>duplo-clique</b> ou <b>Enter</b> encerra · <b>Esc</b> cancela</div>
            <div><b>Arrastando a régua:</b> botão direito também cria vértice · no toque, o 2º dedo faz o mesmo</div>
            <div><b>Botão direito (arrastando token)</b> Adiciona waypoint · no toque, 2º dedo</div>
            <div><b>Botão direito (parado)</b> Menu de contexto</div>
            <div><b>Duplo-clique / Enter</b> Fecha o polígono de terreno · <b>Esc</b> Cancela</div>
            <div><b>Duplo-clique</b> em 🚪 porta / 🪟 janela abre e fecha · em 💡 luz acende e apaga (jogadores precisam da permissão “Interagir com o cenário”)</div>
            <div><b>Delete</b> Exclui a seleção (inclusive várias de uma vez) · <b>Shift+?</b> Esta ajuda</div>
            <div><b>🔒 Bloqueio:</b> menu de contexto/propriedades bloqueiam o objeto; clique no objeto bloqueado e use o botão 🔒 (Mestre) para desbloquear</div>
            <div><b>Toque:</b> pinça = zoom · segurar = menu de contexto · <b>arrastando o token, tocar com um 2º dedo</b> fixa um vértice da rota</div>
        </div>`);
}

function clampCamera() {
    if (T.mode !== 'public' || T.isMaster || can('verAlemDoMapa')) return;
    let minX = 1e12, minY = 1e12, maxX = -1e12, maxY = -1e12, tem = false;
    for (const o of T.objects.values()) {
        if (o.tipo === 'imagem' && o.layerId === 'mapa' && objVisivel(o)) {
            tem = true;
            minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
            maxX = Math.max(maxX, o.x + (o.w||0)); maxY = Math.max(maxY, o.y + (o.h||0));
        }
    }
    if (!tem) return;
    const m = 150 / T.cam.z;
    T.cam.x = Math.max(minX - m, Math.min(maxX + m, T.cam.x));
    T.cam.y = Math.max(minY - m, Math.min(maxY + m, T.cam.y));
}

// ===== RÉGUA COMPARTILHADA =====
// A mesma fila de escrita do arrasto: no máximo 1 write por janela de 300ms,
// mas SEMPRE com o estado mais novo aterrissando no fim (o throttle antigo
// descartava a atualização — o último trecho da rota nunca chegava do outro
// lado, e o rastro remoto ficava picado/incompleto).
const filaRegua = criarFilaDeEscrita({
    write: (_id, dados) => {
        // doc próprio: overwrite (é pequeno); régua encerrada = doc apagado
        const ref = refReguas(T.user.uid);
        (dados ? setDoc(ref, dados) : deleteDoc(ref)).catch(() => {});
    },
});
function compartilharRegua(pontos, label, tokenId) {
    if (!T.measureCfg.mostrarOutros || !T.user) return;
    const nome = T.isMaster ? 'Mestre' : (T.usersMap[T.user?.uid]?.nome || 'Jogador');
    filaRegua.enviar('regua', {
        pontos: pontos.slice(-60), label, nome,
        // token do arrasto: do outro lado a ponta da seta ancora no centro dele
        tokenId: tokenId || null,
        cor: T.isMaster ? '#f59e0b' : '#f472b6', t: Date.now(),
    }, DRAG_WRITE_MS);
}
function limparReguaCompartilhada() {
    if (!T.user) return;
    // Sem throttle: cancela qualquer rastro pendente e apaga já — o pendente
    // não pode aterrissar DEPOIS do null e ressuscitar a régua.
    filaRegua.enviar('regua', null, 0);
}

// ===== TEXTO =====
function abrirModalTexto(w, objExistente) {
    const c = objExistente || T.textCfg;
    abrirModal(objExistente ? '🔤 Editar Texto' : '🔤 Novo Texto', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Texto<textarea id="tx_texto" rows="3" placeholder="Digite o texto...">${esc(objExistente?.texto || '')}</textarea></label>
        </div>
        <div class="tb-form-grid">
            <label>Cor da letra<input type="color" id="tx_cor" value="${c.cor || '#ffffff'}"></label>
            <label class="tb-check"><input type="checkbox" id="tx_usaBorda" ${c.usaBorda ? 'checked' : ''}> Usar borda</label>
            <label>Cor da borda<input type="color" id="tx_corBorda" value="${c.corBorda || '#000000'}"></label>
            <label>Fonte<select id="tx_fonte">${['Arial','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact'].map(f=>`<option ${((c.fonte||'Arial')===f)?'selected':''}>${f}</option>`).join('')}</select></label>
            <label>Tamanho<input type="number" id="tx_tam" value="${c.tamanho || 28}" min="8" max="300"></label>
            <label class="tb-check"><input type="checkbox" id="tx_bold" ${c.bold ? 'checked' : ''}> <b>B</b> Negrito</label>
            <label class="tb-check"><input type="checkbox" id="tx_ital" ${c.italico ? 'checked' : ''}> <i>I</i> Itálico</label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" id="tx_ok">✅ ${objExistente ? 'Salvar' : 'Adicionar'}</button></div>
    `);
    document.getElementById('tx_ok').onclick = async () => {
        const v = id => document.getElementById(id);
        const dados = {
            texto: v('tx_texto').value, cor: v('tx_cor').value,
            usaBorda: v('tx_usaBorda').checked, corBorda: v('tx_corBorda').value,
            fonte: v('tx_fonte').value, tamanho: parseInt(v('tx_tam').value) || 28,
            bold: v('tx_bold').checked, italico: v('tx_ital').checked,
        };
        if (!dados.texto.trim()) { toast('⚠️ Digite algum texto', 'warning'); return; }
        Object.assign(T.textCfg, dados);
        if (objExistente) updObj(objExistente.id, dados);
        else await addObj({ tipo: 'texto', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', x: w.x, y: w.y, ...dados });
        fecharModal();
    };
}

// ===== ALFINETES AVANÇADOS (F6.1) =====
async function criarAlfinete(w) {
    const id = await addObj({ tipo: 'alfinete', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', x: w.x, y: w.y, cor: '#ef4444', titulo: '', descricao: '' });
    selecionar(id);
    window.tbEditarAlfinete(id);
}

window.tbEditarAlfinete = function(id) {
    const o = T.objects.get(id); if (!o) return;
    const npcs = T.npcs || [];
    abrirModal('📌 Alfinete', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Título<input type="text" id="pin_t" value="${esc(o.titulo || '')}" placeholder="Ex: Entrada da caverna"></label>
            <label>Descrição<textarea id="pin_d" rows="3" placeholder="Anotações...">${esc(o.descricao || '')}</textarea></label>
        </div>
        <div class="tb-form-grid">
            <label>Cor<input type="color" id="pin_c" value="${o.cor || '#ef4444'}"></label>
            <label>Imagem<input type="file" id="pin_img" accept="image/*"></label>
            ${T.mode === 'secret' ? `<label>Vincular NPC<select id="pin_npc"><option value="">— nenhum —</option>${npcs.map(n => `<option value="${n.id}" ${o.refTipo==='npc'&&o.refId===n.id?'selected':''}>${esc(n.nome)}</option>`).join('')}</select></label>` : ''}
            ${T.mode === 'secret' ? `<label>🗺️ Mapa vinculado (abre outro canvas)<select id="pin_mapa"><option value="">— nenhum —</option>${(T.canvases || []).filter(c => c.id !== T.canvasId).map(c => `<option value="${c.id}" ${o.linkedCanvasId===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></label>` : ''}
            ${T.mode === 'secret' ? `<label>📖 Geografia/Propriedade (card de info)<select id="pin_geo"><option value="${esc(o.geoRef || '')}">⏳ carregando…</option></select></label>` : ''}
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" id="pin_ok">✅ Salvar</button></div>
    `);
    if (T.mode === 'secret' && window.tbPreencherGeoSelect) window.tbPreencherGeoSelect();
    document.getElementById('pin_ok').onclick = async () => {
        const patch = {
            titulo: document.getElementById('pin_t').value,
            descricao: document.getElementById('pin_d').value,
            cor: document.getElementById('pin_c').value,
        };
        const sel = document.getElementById('pin_npc');
        if (sel) { patch.refTipo = sel.value ? 'npc' : null; patch.refId = sel.value || null; }
        const mapa = document.getElementById('pin_mapa');
        if (mapa) patch.linkedCanvasId = mapa.value || null;
        const geo = document.getElementById('pin_geo');
        if (geo) patch.geoRef = geo.value || null;   // opção "carregando" já carrega o valor atual
        const file = document.getElementById('pin_img').files[0];
        if (file) {
            try { patch.imagem = await uploadArquivo(file); } catch (e) { toast('❌ Falha no upload da imagem', 'danger'); }
        }
        updObj(id, patch);
        fecharModal();
    };
};

function mostrarPopupAlfinete(o) {
    if (!o.titulo && !o.descricao && !o.imagem && !o.refId && !o.linkedCanvasId && !o.geoRef) return;
    const el = document.getElementById('tbPinPopup');
    const s = worldToScreen({ x: o.x, y: o.y });
    el.style.left = (s.x + 14) + 'px';
    el.style.top = (s.y - 10) + 'px';
    el.innerHTML = `
        ${o.imagem ? `<img src="${esc(o.imagem)}" style="width:100%;max-height:130px;object-fit:cover;border-radius:6px;margin-bottom:6px">` : ''}
        <b>📌 ${esc(o.titulo || 'Alfinete')}</b>
        ${o.descricao ? `<div>${esc(o.descricao)}</div>` : ''}
        ${o.refTipo === 'npc' && o.refId ? `<button class="tb-btn" style="margin-top:6px;font-size:.72rem" onclick="window.tbAbrirNpcModal&&window.tbAbrirNpcModal('${o.refId}')">👹 Abrir NPC</button>` : ''}
        ${T.mode === 'secret' && o.linkedCanvasId ? `<button class="tb-btn" style="margin-top:6px;font-size:.72rem" onclick="window.tbAbrirMapaVinculado&&tbAbrirMapaVinculado('${o.linkedCanvasId}')">🗺️ Abrir mapa vinculado</button>` : ''}
        ${o.geoRef ? `<button class="tb-btn" style="margin-top:6px;font-size:.72rem" onclick="window.tbAbrirInfoGeo&&tbAbrirInfoGeo('${o.id}')">📖 Ver informações</button>` : ''}`;
    el.classList.add('open');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('open'), 5000);
}

// ===== MENU DE CONTEXTO =====
function abrirMenuContexto(o, x, y) {
    const menu = document.getElementById('tbCtxMenu');
    const itens = [];
    // 🔒 Objeto bloqueado: única ação disponível é o desbloqueio (apenas Mestre)
    if (o.bloqueado) {
        if (T.isMaster) itens.push({ t: '🔒 Desbloquear objeto', fn: () => window.tbDesbloquearObj(o.id) });
        if (!itens.length) return;
        renderMenuContexto(menu, itens, x, y);
        return;
    }
    if (o.tipo === 'mostrar' && window.tbMenuMostrar) { window.tbMenuMostrar(o.id, x, y); return; }
    // Jogador: só os acionamentos do cenário, nada de ocultar/excluir/z-ordem
    if (T.mode !== 'secret') {
        if (o.tipo === 'loot' && can('interagirCenario')) {
            renderMenuContexto(menu, [{
                t: o.item?.ehContainer ? '🧰 Abrir baú' : '📦 Pegar item',
                fn: () => window.tbClickLoot && window.tbClickLoot(o.id),
            }], x, y);
            return;
        }
        if (!podeAcionarCenario(o)) return;
        const rotulo = o.tipo === 'luz' ? (o.apagada ? '💡 Acender' : '🕯️ Apagar')
            : o.trancado ? (o.tipo === 'porta' ? '🔒 Porta trancada — usar chave' : '🔒 Janela trancada — usar chave')
            : o.aberta ? (o.tipo === 'porta' ? '🚪 Fechar porta' : '🪟 Fechar janela')
            : (o.tipo === 'porta' ? '🚪 Abrir porta' : '🪟 Abrir janela');
        renderMenuContexto(menu, [{ t: rotulo, fn: () => acionarCenario(o) }], x, y);
        return;
    }
    itens.push({ t: (o.visivelPublico !== false ? '🚫 Ocultar do público' : '👁️ Exibir ao público'), fn: () => updObj(o.id, { visivelPublico: !(o.visivelPublico !== false) }) });
    if (T.isMaster && ['imagem', 'token', 'mostrar'].includes(o.tipo)) {
        itens.push({ t: '🔒 Bloquear objeto', fn: () => window.tbBloquearObj(o.id) });
    }
    if (o.tipo === 'porta') itens.push({ t: o.aberta ? '🚪 Fechar porta' : '🚪 Abrir porta', fn: () => updObj(o.id, { aberta: !o.aberta }) });
    if (o.tipo === 'janela') itens.push({ t: o.aberta ? '🪟 Fechar janela' : '🪟 Abrir janela (deixa passar)', fn: () => updObj(o.id, { aberta: !o.aberta }) });
    if (o.tipo === 'luz') itens.push({ t: o.apagada ? '💡 Acender' : '🕯️ Apagar', fn: () => updObj(o.id, { apagada: !o.apagada }) });
    if (o.tipo === 'loot') {
        itens.push({ t: o.item?.ehContainer ? '🧰 Abrir baú' : '📦 Entregar item...', fn: () => window.tbClickLoot && window.tbClickLoot(o.id) });
        if (o.item) itens.push({ t: '↩️ Devolver à Caixa do Mestre', fn: () => window.tbDevolverLoot && window.tbDevolverLoot(o.id) });
    }
    if (o.tipo === 'alfinete') itens.push({ t: '📝 Editar alfinete', fn: () => window.tbEditarAlfinete(o.id) });
    if (o.tipo === 'alfinete' && o.linkedCanvasId) itens.push({ t: '🗺️ Abrir mapa vinculado', fn: () => window.tbAbrirMapaVinculado(o.linkedCanvasId) });
    if (o.tipo === 'alfinete' && o.geoRef) itens.push({ t: '📖 Ver informações do local', fn: () => window.tbAbrirInfoGeo(o.id) });
    if (o.tipo === 'desenho' && ['livre', 'linha'].includes(o.forma || 'livre')) {
        itens.push(o.ehRota
            ? { t: '✏️ Desfazer rota de viagem', fn: () => updObj(o.id, { ehRota: false }) }
            : { t: '🛤️ Transformar em rota de viagem', fn: () => converterEmRota(o) });
    }
    if (o.tipo === 'relogio' && !o.frenteId) {
        itens.push({ t: '➖ Voltar fatia', fn: () => updObj(o.id, { cheias: Math.max(0, (o.cheias || 0) - 1) }) });
        itens.push({ t: '🔄 Zerar relógio', fn: () => updObj(o.id, { cheias: 0 }) });
    }
    if (o.tipo === 'template') itens.push({ t: '🎯 Limpar alvos', fn: () => updObj(o.id, { alvos: [] }) });
    itens.push({ t: '⬆️ Trazer para frente', fn: () => updObj(o.id, { z: maxZ() + 1 }) });
    itens.push({ t: '⚙️ Propriedades', fn: () => { selecionar(o.id); abrirPropriedades(o.id); markDirty(); } });
    itens.push({ t: '🗑️ Excluir', fn: () => delObj(o.id), danger: true });
    renderMenuContexto(menu, itens, x, y);
}
function renderMenuContexto(menu, itens, x, y) {
    menu.innerHTML = itens.map((it, i) => `<div class="tb-ctx-item ${it.danger?'tb-danger':''}" data-i="${i}">${it.t}</div>`).join('');
    menu.querySelectorAll('.tb-ctx-item').forEach(el => el.onclick = () => { itens[+el.dataset.i].fn(); menu.classList.remove('open'); });
    menu.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - itens.length * 38 - 12) + 'px';
    menu.classList.add('open');
    setTimeout(() => document.addEventListener('pointerdown', function fecha(ev) {
        if (!menu.contains(ev.target)) { menu.classList.remove('open'); document.removeEventListener('pointerdown', fecha); }
    }), 10);
}

// Zoom por botões
window.tbZoom = (f) => {
    T.cam.z = Math.max(0.04, Math.min(6, T.cam.z * f));
    clampCamera(); markDirty();
};
