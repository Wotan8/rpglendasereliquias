// =============================================
// TABULEIRO — Ferramentas & Interações
// Seleção, Mover, Desenho, Texto, Régua, Alfinetes, Luz, Pan/Zoom
// =============================================
import { setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, markDirty, gridSize, can, camadasVisiveis, objVisivel, tokenDoUsuario, pxParaUnidades, fmtDist, getCamada } from './tab-state.js';
import { refReguas, abrirModal, fecharModal } from './tab-main.js';
import { screenToWorld, worldToScreen, bboxOf, handlesOf, centerCamera } from './tab-render.js';
import { addObj, updObj, delObj, maxZ, abrirPropriedades } from './tab-objects.js';

let cv;
let ponteiro = null;   // estado do gesto atual
let luzSubTool = 'luz'; // luz | porta | janela
let reguaTimer = 0;

export function initTools() {
    cv = document.getElementById('tbCanvas');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

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
        el.addEventListener(tipo === 'check' ? 'change' : 'change', () => {
            mc[campo] = tipo === 'check' ? el.checked : el.value;
        });
    };
    bind('mFormaSel', 'forma'); bind('mSnapSel', 'snap'); bind('mExibSel', 'exib');
    bind('mMedirToken', 'medirToken', 'check'); bind('mMostrarOutros', 'mostrarOutros', 'check');

    // Submenu de luz
    document.querySelectorAll('[data-luz]').forEach(b => b.addEventListener('click', () => {
        luzSubTool = b.dataset.luz;
        document.querySelectorAll('[data-luz]').forEach(x => x.classList.toggle('active', x.dataset.luz === luzSubTool));
        toast(luzSubTool === 'luz' ? '💡 Clique no mapa para inserir luz' : luzSubTool === 'porta' ? '🚪 Arraste para criar a porta' : '🪟 Arraste para criar a janela');
    }));

    setTool('select');
}

export function setTool(t) {
    T.tool = t;
    T.temp = null;
    document.querySelectorAll('.tb-tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    document.getElementById('tbDrawBar').classList.toggle('open', t === 'draw');
    document.getElementById('tbMeasureBar').classList.toggle('open', t === 'measure');
    document.getElementById('tbLuzBar').classList.toggle('open', t === 'light');
    cv.style.cursor = { select: 'default', move: 'grab', draw: 'crosshair', text: 'text', measure: 'crosshair', pin: 'copy', light: 'crosshair' }[t] || 'default';
    markDirty();
}

// ===== HELPERS =====
function evPos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function evWorld(e) { return screenToWorld(evPos(e)); }

function snapMedida(p) {
    const gs = gridSize(), s = T.measureCfg.snap;
    if (s === 'centro') return { x: Math.floor(p.x / gs) * gs + gs / 2, y: Math.floor(p.y / gs) * gs + gs / 2 };
    if (s === 'canto') return { x: Math.round(p.x / gs) * gs, y: Math.round(p.y / gs) * gs };
    return p;
}
function snapToken(p) {
    if (T.canvas?.grid?.snap === false) return p;
    const gs = gridSize();
    return { x: Math.floor(p.x / gs) * gs + gs / 2, y: Math.floor(p.y / gs) * gs + gs / 2 };
}

function distPontos(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    return d;
}

function labelMedida(pts) {
    const d = distPontos(pts);
    const info = pxParaUnidades(d, pts[0]);
    return { label: fmtDist(info), sub: `${Math.round(info.celulas * 10) / 10} qd` };
}

function podeMoverObj(o) {
    if (T.isMaster && T.mode === 'secret') return true;
    if (T.isMaster) return true;
    if (o.tipo === 'token' && tokenDoUsuario(o)) return can('moverToken');
    if (o.criadoPor === T.user?.uid) return true;
    return false;
}
function podeEditarObj(o) {
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
    if (o.tipo === 'alfinete') return Math.hypot(w.x - o.x, w.y - (o.y - 16)) <= 20 || Math.hypot(w.x - o.x, w.y - o.y) <= 12;
    if (o.tipo === 'luz') return Math.hypot(w.x - o.x, w.y - o.y) <= 18;
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

    // Botão do meio ou direito = pan (ou vértice na régua)
    if (e.button === 2) {
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

    switch (T.tool) {
        case 'select': {
            const h = pickHandle(w);
            if (h) { ponteiro = { tipo: 'resize', id: T.selection, handle: h.k, b0: h.b, w0: w }; return; }
            const o = pickObject(w);
            if (o) {
                T.selection = o.id;
                abrirPropriedades(o.id);
                markDirty();
                if (podeMoverObj(o)) {
                    ponteiro = { tipo: 'dragObj', id: o.id, w0: w, x0: o.x, y0: o.y, pontos0: o.pontos ? o.pontos.map(p => ({...p})) : null, moveu: false };
                    const lo = T.objects.get(o.id); if (lo) lo.__dragging = true;
                } else ponteiro = { tipo: 'clickObj', id: o.id };
                if (o.tipo === 'alfinete') mostrarPopupAlfinete(o);
            } else {
                T.selection = null; abrirPropriedades(null); markDirty();
                ponteiro = { tipo: 'pan', scr, cam: { ...T.cam }, botao: 0, moveu: false };
            }
            break;
        }
        case 'move': {
            const o = pickObject(w);
            if (o && podeMoverObj(o)) {
                T.selection = o.id; abrirPropriedades(o.id);
                ponteiro = { tipo: 'dragObj', id: o.id, w0: w, x0: o.x, y0: o.y, pontos0: o.pontos ? o.pontos.map(p => ({...p})) : null, moveu: false };
                const lo = T.objects.get(o.id); if (lo) lo.__dragging = true;
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
            const p0 = T.measureCfg.forma === 'caneta' ? w : snapMedida(w);
            T.temp = { tipo: 'medida', pontos: [p0], atual: null, caneta: T.measureCfg.forma === 'caneta' };
            ponteiro = { tipo: 'measure' };
            break;
        }
        case 'pin': {
            if (!can('alfinete') && !T.isMaster) { toast('⚠️ Sem permissão para alfinetes', 'warning'); return; }
            criarAlfinete(w);
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
    }
}

function onMove(e) {
    const w = evWorld(e);
    document.getElementById('tbCoords').textContent = `${Math.round(w.x)}, ${Math.round(w.y)} · ${Math.round(T.cam.z * 100)}%`;
    if (!ponteiro) {
        if (T.temp?.tipo === 'medida' && !T.temp.caneta) { atualizarMedida(w); }
        return;
    }
    switch (ponteiro.tipo) {
        case 'pan': {
            const scr = evPos(e);
            const dx = (scr.x - ponteiro.scr.x) / T.cam.z, dy = (scr.y - ponteiro.scr.y) / T.cam.z;
            if (Math.abs(scr.x - ponteiro.scr.x) + Math.abs(scr.y - ponteiro.scr.y) > 4) ponteiro.moveu = true;
            T.cam.x = ponteiro.cam.x - dx; T.cam.y = ponteiro.cam.y - dy;
            clampCamera();
            markDirty();
            break;
        }
        case 'dragObj': {
            const o = T.objects.get(ponteiro.id); if (!o) break;
            const dx = w.x - ponteiro.w0.x, dy = w.y - ponteiro.w0.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) ponteiro.moveu = true;
            if (ponteiro.pontos0) {
                o.pontos = ponteiro.pontos0.map(p => ({ x: p.x + dx, y: p.y + dy }));
                updObj(o.id, { pontos: o.pontos }, 150);
            } else {
                let nx = ponteiro.x0 + dx, ny = ponteiro.y0 + dy;
                if (o.tipo === 'token') { const s = snapToken({ x: nx, y: ny }); nx = s.x; ny = s.y; }
                o.x = nx; o.y = ny;
                updObj(o.id, { x: nx, y: ny }, 150);
                // Medir movimento do token
                if (o.tipo === 'token' && T.measureCfg.medirToken) {
                    const pts = [{ x: ponteiro.x0, y: ponteiro.y0 }, { x: nx, y: ny }];
                    const l = labelMedida(pts);
                    T.temp = { tipo: 'medida', pontos: pts, atual: null, label: l.label, labelSub: l.sub };
                    compartilharRegua(pts, l.label);
                }
            }
            markDirty();
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
            updObj(o.id, { x, y, w: wdt, h: hgt }, 150);
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
    // Soltar o botão direito durante a medição (vértice) não encerra a régua
    if (ponteiro && ponteiro.tipo === 'measure' && e.button === 2) return;
    const p = ponteiro; ponteiro = null;
    if (T.tool === 'move') cv.style.cursor = 'grab';
    if (!p) return;

    if (p.tipo === 'pan' && p.botao === 2 && !p.moveu && p.alvoCtx && T.mode === 'secret') {
        // clique direito sem arrastar = menu de contexto
        abrirMenuContexto(p.alvoCtx, e.clientX, e.clientY);
        return;
    }
    if (p.tipo === 'dragObj') {
        const o = T.objects.get(p.id);
        if (o) { delete o.__dragging; updObj(o.id, o.pontos ? { pontos: o.pontos } : { x: o.x, y: o.y }); }
        if (T.temp?.tipo === 'medida') { T.temp = null; limparReguaCompartilhada(); markDirty(); }
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
        const t = T.temp;
        const pts = t.caneta ? t.pontos : t.pontos.concat(t.atual ? [t.atual] : []);
        T.temp = null;
        limparReguaCompartilhada();
        if (pts.length >= 2 && T.measureCfg.exib === 'permanente') {
            const l = labelMedida(pts);
            await addObj({ tipo: 'medida', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', pontos: pts, label: l.label, cor: '#22d3ee' });
        }
        markDirty();
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
    const o = pickObject(w);
    if (!o) return;
    if (o.tipo === 'texto' && podeEditarObj(o)) { abrirModalTexto(null, o); return; }
    if (o.tipo === 'porta' && T.mode === 'secret') { updObj(o.id, { aberta: !o.aberta }); return; }
    if (o.tipo === 'token' && o.vinculo?.tipo === 'npc' && (T.mode === 'secret' || can('abrirNpc'))) {
        window.tbAbrirNpcModal && window.tbAbrirNpcModal(o.vinculo.id);
        return;
    }
    if (o.tipo === 'mostrar') { window.tbClickMostrar && window.tbClickMostrar(o.id); }
}

function onKey(e) {
    if (e.target.matches('input,textarea,select')) return;
    if (e.key === 'Escape') { T.temp = null; T.selection = null; abrirPropriedades(null); limparReguaCompartilhada(); markDirty(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (T.selection) { const o = T.objects.get(T.selection); if (o && podeEditarObj(o)) delObj(T.selection); }
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 's') { e.preventDefault(); setTool('select'); }
        if (k === 'f') { e.preventDefault(); setTool('draw'); T.drawShape = 'livre'; }
        if (k === 'd') { e.preventDefault(); setTool('draw'); T.drawShape = 'ret'; }
        if (k === 'g') { e.preventDefault(); setTool('text'); }
        if (k === 'm') { e.preventDefault(); setTool('measure'); }
        document.querySelectorAll('[data-shape]').forEach(x => x.classList.toggle('active', x.dataset.shape === T.drawShape));
        return;
    }
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
function compartilharRegua(pontos, label) {
    if (!T.measureCfg.mostrarOutros) return;
    const agora = Date.now();
    if (agora - reguaTimer < 130) return;
    reguaTimer = agora;
    const nome = T.isMaster ? 'Mestre' : (T.usersMap[T.user?.uid]?.nome || 'Jogador');
    setDoc(refReguas(), { [T.user.uid]: { pontos: pontos.slice(-60), label, nome, cor: T.isMaster ? '#f59e0b' : '#f472b6', t: agora } }, { merge: true }).catch(()=>{});
}
function limparReguaCompartilhada() {
    if (!T.user) return;
    setDoc(refReguas(), { [T.user.uid]: null }, { merge: true }).catch(()=>{});
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

// ===== ALFINETES =====
async function criarAlfinete(w) {
    const id = await addObj({ tipo: 'alfinete', layerId: T.mode === 'secret' ? T.activeLayerId : 'tokens', x: w.x, y: w.y, cor: '#ef4444', titulo: '', descricao: '' });
    T.selection = id;
    abrirModal('📌 Novo Alfinete', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>Título<input type="text" id="pin_t" placeholder="Ex: Entrada da caverna"></label>
            <label>Descrição<textarea id="pin_d" rows="3" placeholder="Anotações..."></textarea></label>
            <label>Cor<input type="color" id="pin_c" value="#ef4444"></label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" id="pin_ok">✅ Salvar</button></div>
    `);
    document.getElementById('pin_ok').onclick = () => {
        updObj(id, { titulo: document.getElementById('pin_t').value, descricao: document.getElementById('pin_d').value, cor: document.getElementById('pin_c').value });
        fecharModal();
    };
}

function mostrarPopupAlfinete(o) {
    if (!o.titulo && !o.descricao) return;
    const el = document.getElementById('tbPinPopup');
    const s = worldToScreen({ x: o.x, y: o.y });
    el.style.left = (s.x + 14) + 'px';
    el.style.top = (s.y - 10) + 'px';
    el.innerHTML = `<b>📌 ${esc(o.titulo || 'Alfinete')}</b>${o.descricao ? `<div>${esc(o.descricao)}</div>` : ''}`;
    el.classList.add('open');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('open'), 4000);
}

// ===== MENU DE CONTEXTO =====
function abrirMenuContexto(o, x, y) {
    if (o.tipo === 'mostrar' && window.tbMenuMostrar) { window.tbMenuMostrar(o.id, x, y); return; }
    const menu = document.getElementById('tbCtxMenu');
    const itens = [];
    itens.push({ t: (o.visivelPublico !== false ? '🚫 Ocultar do público' : '👁️ Exibir ao público'), fn: () => updObj(o.id, { visivelPublico: !(o.visivelPublico !== false) }) });
    if (o.tipo === 'porta') itens.push({ t: o.aberta ? '🚪 Fechar porta' : '🚪 Abrir porta', fn: () => updObj(o.id, { aberta: !o.aberta }) });
    if (o.tipo === 'token' && o.vinculo?.tipo === 'npc') itens.push({ t: '👹 Abrir ficha do NPC', fn: () => window.tbAbrirNpcModal && window.tbAbrirNpcModal(o.vinculo.id) });
    itens.push({ t: '⬆️ Trazer para frente', fn: () => updObj(o.id, { z: maxZ() + 1 }) });
    itens.push({ t: '⚙️ Propriedades', fn: () => { T.selection = o.id; abrirPropriedades(o.id); markDirty(); } });
    itens.push({ t: '🗑️ Excluir', fn: () => delObj(o.id), danger: true });
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
