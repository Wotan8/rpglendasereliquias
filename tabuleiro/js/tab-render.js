// =============================================
// TABULEIRO — Motor de Renderização (FASES 1–6)
// Canvas infinito + camadas + fog em 3 estados + iluminação dinâmica
// F1: culling, cache estático, fog cacheado, raycasting por vértices, mipmaps
// F2: lerp de tokens remotos, cursores, pings, tween de câmera
// F3: exploração persistente, visão por jogador, sensores, luz colorida/animada, elevação
// F4: grid hex/gridless, templates AoE, terreno difícil
// F5: barras/condições/HUD constante, anel de iniciativa, anéis de alvo, loot
// F6: clima, telhados, transições
// =============================================
import { T, gridSize, camadasVisiveis, objVisivel, markDirty, unidadesParaPx, esc, cfgGrid, politicaDeFog, alcanceDeVisaoDoToken, tokenInvisivel, rotParaCanvas, deveAtualizarPasso, tokensDaVisao, reguaVisivelAqui, FOG_PASSO_CELULA, FOG_INTERVALO_MS, REGUA_TTL_MS } from './tab-state.js';
import { PERF, melhorBitmap, construirHashParedes, paredesProximas, medir, iniciarHudMedicaoSePedido, criarMemoPorVersao } from './tab-perf.js';
import { snapPonto, axialParaPixel, axialRound, pixelParaAxial, mesmaFaixaElev, faixaDe, pontoEmPoligono, normalizarRet } from './tab-grid.js';
import { desenharExploracao, registrarExploracaoCelulas, tokenVisivelParaMim, carregarExploracao, versaoExploracao } from './tab-fog.js';
import { cursoresParaDesenhar, pingsParaDesenhar, haPingsAtivos, avancarTweenCamera, cursoresAtivados } from './tab-presenca.js';
import { vitaisDoToken, barrasVisiveis, tokenAtivoDoCombate, vdsCombateDoToken } from './tab-hud.js';
import { shapeDaMira } from './tab-mira-calc.js';
import { desenharClima, climaAtivo, alphaTelhado } from './tab-clima.js';
import { temCone, podeGirarToken, posicionarBotoesGirar, esconderBotoesGirar } from './tab-girar.js';

let cv, ctx, fogCv, fogCtx, maskCv, maskCtx, luzCv, luzCtx;
// Clima em canvas overlay PRÓPRIO (DOM, acima do #tbCanvas): as partículas
// andam todo quadro por natureza, mas só elas são redesenhadas — antes o clima
// forçava T.dirty e a CENA INTEIRA (mapa, tokens, fog) redesenhava a 60fps.
let climaCv, climaCtx, climaLimpo = true;
// Fog composto em MEIA resolução: a composição são 3+ passes de tela cheia e o
// custo é fill-rate puro (medido: picos de 8–13ms até no desktop; no celular,
// com dpr 3, é o pior passo do frame). O fog é um véu suave — meia resolução
// esticada com smoothing é visualmente indistinguível e corta o fill em 4x.
const FOG_ESCALA = 0.5;
// Chave do fog já COMPOSTO em fogCv. Vazia = precisa recompor no próximo frame.
let _fogComposto = '';
// Fontes de luz/visão animadas VISÍVEIS no enquadramento atual (ver drawFog)
// e a última assinatura quantizada delas — o loop só redesenha quando muda.
let _fontesAnim = [];
let _animAssin = '';
// Cache por fonte dos polígonos de visibilidade (ver criarMemoPorVersao)
const memoPolys = criarMemoPorVersao();
let dpr = 1;
let viewRect = null;

const mapCache = { cv: null, ctx: null, cam: null, version: -1, pad: 1.7, w: 0, h: 0 };

export function startRenderLoop() {
    cv = document.getElementById('tbCanvas');
    ctx = cv.getContext('2d');
    fogCv = document.createElement('canvas'); fogCtx = fogCv.getContext('2d');
    maskCv = document.createElement('canvas'); maskCtx = maskCv.getContext('2d');
    // Máscara separada só para a UNIÃO das luzes — ver drawFog()
    luzCv = document.createElement('canvas'); luzCtx = luzCv.getContext('2d');
    mapCache.cv = document.createElement('canvas'); mapCache.ctx = mapCache.cv.getContext('2d');
    // Overlay do clima: irmão logo após o #tbCanvas (pinta acima dele e abaixo
    // de toda a UI). pointer-events:none — o canvas de baixo segue recebendo tudo.
    climaCv = document.createElement('canvas');
    climaCv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
    cv.insertAdjacentElement('afterend', climaCv);
    climaCtx = climaCv.getContext('2d');
    resize();
    // 🔴 O evento `resize` da janela NÃO é confiável para isto: em tela dividida,
    // barra do navegador aparecendo/sumindo no celular e mudança de viewport por
    // ferramenta, a CAIXA do canvas muda sem ele disparar — e aí o buffer fica do
    // tamanho antigo e o navegador ESTICA a cena (a "tela distorcida"). Quem sabe
    // o tamanho real do elemento é o ResizeObserver. O listener de janela fica
    // como reserva para troca de monitor, que muda o dpr sem mudar a caixa.
    if (window.ResizeObserver) new ResizeObserver(() => { resize(); markDirty(); }).observe(cv);
    window.addEventListener('resize', () => { resize(); markDirty(); });
    iniciarHudMedicaoSePedido();
    requestAnimationFrame(loop);
}

/** Um frame agora, fora do loop. Existe para os checks: com a aba oculta o
 *  requestAnimationFrame não dispara e o harness ficaria esperando para sempre. */
export function desenharUmFrame() { draw(); }

let _tamAnterior = null;
function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    // Janela redimensionada = mesmo pedaço de MUNDO na tela. Sem isto, encolher a
    // janela cortava a cena (e quem não tem "ver além do mapa" ficava preso ao
    // enquadramento torto, porque a câmera dele é grudada no mapa). O fator é o
    // menor dos dois eixos: assim nada que estava à vista some.
    if (_tamAnterior && r.width > 0 && r.height > 0) {
        const k = Math.min(r.width / _tamAnterior.w, r.height / _tamAnterior.h);
        if (isFinite(k) && k > 0 && Math.abs(k - 1) > 0.002) {
            T.cam.z = Math.max(0.04, Math.min(6, T.cam.z * k));
        }
    }
    _tamAnterior = { w: r.width || 1, h: r.height || 1 };
    T._aposResize?.();   // reencaixa a câmera de quem é preso ao mapa (tab-tools)
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const fw = Math.ceil(cv.width * FOG_ESCALA), fh = Math.ceil(cv.height * FOG_ESCALA);
    fogCv.width = fw; fogCv.height = fh;
    maskCv.width = fw; maskCv.height = fh;
    luzCv.width = fw; luzCv.height = fh;
    climaCv.width = cv.width; climaCv.height = cv.height; climaLimpo = true;
    mapCache.w = Math.round(cv.width * mapCache.pad);
    mapCache.h = Math.round(cv.height * mapCache.pad);
    mapCache.cv.width = mapCache.w; mapCache.cv.height = mapCache.h;
    mapCache.version = -1;
    aplicarSmoothing(ctx); aplicarSmoothing(fogCtx); aplicarSmoothing(mapCache.ctx); aplicarSmoothing(maskCtx);
}
function aplicarSmoothing(c) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }

function loop() {
    tickLoop();
    requestAnimationFrame(loop);
}

/** Um passo do loop: decide se este quadro precisa desenhar. True = desenhou. */
function tickLoop() {
    // Animações contínuas → força redraw
    if (avancarTweenCamera()) T.dirty = true;
    if (T.anims && T.anims.size) T.dirty = true;
    if (haPingsAtivos()) T.dirty = true;
    // Clima NÃO suja a cena: anima sozinho no canvas overlay (ver desenharClimaOverlay)
    desenharClimaOverlay();
    // Luz animada: redesenha só quando o FATOR quantizado de alguma fonte muda.
    // Estrobo e pulso produzem quadros IDÊNTICOS entre um degrau e outro —
    // redesenhar esses quadros era pagar a cena inteira por nada. Tocha muda
    // quase todo quadro mesmo (flicker rápido), e aí redesenhar é o correto.
    if (T._luzAnimada) {
        const a = assinaturaAnim();
        if (a !== _animAssin) { _animAssin = a; T.dirty = true; }
    }
    if (T._pulsoCombate) T.dirty = true;
    if (T.dirty) { T.dirty = false; medir('frame', draw); return true; }
    return false;
}

/** O mesmo passo, exportado para os __check (com a aba oculta o rAF não roda). */
export function __tickLoopParaTeste() { return tickLoop(); }

/** Anima o clima no canvas overlay; a cena embaixo continua em repouso. */
function desenharClimaOverlay() {
    if (!climaCtx) return;
    if (!climaAtivo()) {
        if (climaLimpo) return;                       // já está limpo: custo zero
        climaCtx.setTransform(1, 0, 0, 1, 0, 0);
        climaCtx.clearRect(0, 0, climaCv.width, climaCv.height);
        climaLimpo = true;
        return;
    }
    climaLimpo = false;
    medir('clima', () => {
        climaCtx.setTransform(1, 0, 0, 1, 0, 0);
        climaCtx.clearRect(0, 0, climaCv.width, climaCv.height);
        climaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        desenharClima(climaCtx, climaCv.width / dpr, climaCv.height / dpr);
    });
}

// ===== Transformações =====
export function worldToScreen(p) { return { x: (p.x - T.cam.x) * T.cam.z + cv.width / (2 * dpr), y: (p.y - T.cam.y) * T.cam.z + cv.height / (2 * dpr) }; }
export function screenToWorld(p) { return { x: (p.x - cv.width / (2 * dpr)) / T.cam.z + T.cam.x, y: (p.y - cv.height / (2 * dpr)) / T.cam.z + T.cam.y }; }

function calcularViewRect(cam, folga = 1) {
    const hw = (cv.width / dpr) / 2 / cam.z * folga;
    const hh = (cv.height / dpr) / 2 / cam.z * folga;
    return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}
function intersecta(b, r) { return b.x < r.x1 && b.x + b.w > r.x0 && b.y < r.y1 && b.y + b.h > r.y0; }

export function centerCamera() {
    let objs = [...T.objects.values()].filter(o => objVisivel(o));
    const mapas = objs.filter(o => o.tipo === 'imagem' && o.layerId === 'mapa');
    if (mapas.length) objs = mapas;
    if (!objs.length) { T.cam = { x: 0, y: 0, z: 1 }; markDirty(); return; }
    let minX = 1e12, minY = 1e12, maxX = -1e12, maxY = -1e12;
    objs.forEach(o => { const b = bboxOf(o); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); });
    T.cam.x = (minX + maxX) / 2; T.cam.y = (minY + maxY) / 2;
    const zw = (cv.width / dpr) / Math.max(200, maxX - minX + 200), zh = (cv.height / dpr) / Math.max(200, maxY - minY + 200);
    T.cam.z = Math.min(1.5, Math.max(0.05, Math.min(zw, zh)));
    markDirty();
}

// ===== Lerp de tokens remotos (F2.1) =====
/** Posição de exibição do objeto (interpolada quando animando). */
export function posDisplay(o) {
    const a = T.anims?.get(o.id);
    if (!a) return { x: o.x, y: o.y };
    let k = (Date.now() - a.t0) / a.dur;
    if (k >= 1) { T.anims.delete(o.id); return { x: o.x, y: o.y }; }
    const e = a.linear ? k : 1 - Math.pow(1 - k, 3);
    return { x: a.x0 + (o.x - a.x0) * e, y: a.y0 + (o.y - a.y0) * e };
}

/**
 * Posição do objeto para efeito de fog/visão.
 * Parado: a posição exata. Em arrasto (local `__dragging` ou remoto `movendo`):
 * ACOMPANHA o token, mas em passos de ~1/4 de célula. O passo não é frescura —
 * o cache do fog é uma chave única para todas as fontes, então mover um token
 * recalcula o polígono de visão e de luz de todo o canvas; a cada pixel isso é o
 * gargalo do ADR-001. Ao soltar, cai no ramo exato e a visão encaixa no lugar.
 * ponytail: passo fixo de 1/4 de célula; se ficar visível em zoom alto, dá para
 * escalar o passo com T.cam.z (mais recálculo perto, menos longe).
 */
function posConfirmada(o) {
    const arrastando = o.__dragging || o.movendo;
    if (!arrastando) { o.__fogPos = { x: o.x, y: o.y }; o.__fogT = 0; return o.__fogPos; }
    const agora = performance.now();
    const desdeUltimo = o.__fogT ? agora - o.__fogT : Infinity;
    if (deveAtualizarPasso(o.__fogPos, o, gridSize() * FOG_PASSO_CELULA, desdeUltimo, FOG_INTERVALO_MS)) {
        o.__fogPos = { x: o.x, y: o.y };
        o.__fogT = agora;
    }
    return o.__fogPos;
}

// ===== BBOX =====
export function bboxOf(o) {
    const gs = gridSize();
    switch (o.tipo) {
        case 'imagem': case 'mostrar': return { x: o.x, y: o.y, w: o.w || 200, h: o.h || 200 };
        case 'texto': return medirTexto(o);
        case 'token': { const s = (o.tamanhoCelulas || 1) * gs; return { x: o.x - s/2, y: o.y - s/2, w: s, h: s }; }
        case 'loot': { const s = gs * 0.8; return { x: o.x - s/2, y: o.y - s/2, w: s, h: s }; }
        case 'alfinete': return { x: o.x - 14, y: o.y - 30, w: 28, h: 34 };
        case 'luz': return { x: o.x - 14, y: o.y - 14, w: 28, h: 28 };
        case 'relogio': { const r = gs * 0.7; return { x: o.x - r, y: o.y - r, w: r*2, h: r*2 + 22 }; }
        case 'template': return bboxTemplate(o);
        case 'terreno': case 'desenho': case 'medida': case 'porta': case 'janela': {
            const pts = o.pontos || [];
            if (!pts.length) return { x: o.x||0, y: o.y||0, w: 10, h: 10 };
            if (o.__bbPts === pts && o.__bbG === (o.grossura||4)) return o.__bb;
            let minX=1e12,minY=1e12,maxX=-1e12,maxY=-1e12;
            for (const p of pts) { if (p.x<minX)minX=p.x; if (p.y<minY)minY=p.y; if (p.x>maxX)maxX=p.x; if (p.y>maxY)maxY=p.y; }
            const pad = (o.grossura||4) + 4;
            o.__bbPts = pts; o.__bbG = (o.grossura||4);
            o.__bb = { x: minX-pad, y: minY-pad, w: maxX-minX+pad*2, h: maxY-minY+pad*2 };
            return o.__bb;
        }
        default: return { x: o.x||0, y: o.y||0, w: 50, h: 50 };
    }
}
function bboxTemplate(o) {
    const a = o.origem || { x: o.x, y: o.y }, b = o.destino || a;
    if (o.forma === 'circulo') { const r = o.raio || 50; return { x: a.x - r, y: a.y - r, w: r*2, h: r*2 }; }
    const pad = (o.raio || 20) / 2 + 8;
    return { x: Math.min(a.x,b.x)-pad, y: Math.min(a.y,b.y)-pad, w: Math.abs(b.x-a.x)+pad*2, h: Math.abs(b.y-a.y)+pad*2 };
}

let _medCtx = null;
function medirTexto(o) {
    const key = `${o.texto}|${o.fonte}|${o.tamanho}|${o.bold}|${o.italico}`;
    if (o.__txKey !== key) {
        if (!_medCtx) _medCtx = document.createElement('canvas').getContext('2d');
        _medCtx.font = fontOf(o);
        const linhas = String(o.texto || '').split('\n');
        let w = 10; for (const l of linhas) { const m = _medCtx.measureText(l).width; if (m > w) w = m; }
        o.__txKey = key; o.__txW = w; o.__txH = linhas.length * (o.tamanho || 28) * 1.25;
    }
    return { x: o.x, y: o.y, w: o.__txW, h: o.__txH };
}
function fontOf(o) { return `${o.italico?'italic ':''}${o.bold?'bold ':''}${o.tamanho||28}px ${o.fonte||'Arial'}`; }

export function getImg(url) {
    if (!url) return null;
    let e = T.imgCache.get(url);
    if (e) return e.ok ? e.img : null;
    const img = new Image();
    // sem crossOrigin — Storage não envia CORS; no-cors funciona p/ desenhar
    e = { img, ok: false };
    img.onload = () => { e.ok = true; PERF.mapVersion++; markDirty(); };
    img.onerror = () => { e.ok = false; };
    img.src = url;
    T.imgCache.set(url, e);
    return null;
}

// Escala HUD constante (F5.3): px de tela → unidades de mundo
function hud(px) { return px / T.cam.z; }

// ===== DRAW PRINCIPAL =====
function draw() {
    viewRect = calcularViewRect(T.cam, 1.05);

    // pré-cálculos do frame
    T._meusTokens = tokensDaVisao();
    T._alvos = coletarAlvosDeTemplates();
    T._tokenAtivo = tokenAtivoDoCombate();
    // O pulso do anel é a ÚNICA animação contínua da cena parada: com ele ligado
    // a tela inteira redesenha a 60fps em todos os aparelhos enquanto durar o
    // combate. Só liga quando o anel vai mesmo aparecer — token na tela e não
    // tapado pelo fog. (Mesma ideia do culling das luzes animadas.)
    T._pulsoCombate = !!T._tokenAtivo
        && !foraDaTela({ x: T._tokenAtivo.x, y: T._tokenAtivo.y, r: gridSize() })
        && tokenVisivelParaMim(T._tokenAtivo, T._meusTokens);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);

    medir('base', desenharBaseEstatica);

    const camadas = camadasVisiveis();
    const abaixo = camadas.filter(c => c.tipo !== 'mapa' && (c.abaixoDaLuz !== false || c.tipo === 'tokens' || c.tipo === 'dm'));
    const acima = camadas.filter(c => c.tipo !== 'mapa' && !abaixo.includes(c) && c.tipo !== 'luz');
    // 🖼️ Vitrine: sai da fila do `acima` para ser desenhada por ÚLTIMO — acima do
    // fog, da camada de luz e até dos telhados. É a camada de exibir imagem para
    // a mesa; nada pode passar na frente dela.
    const camVitrine = acima.find(c => c.tipo === 'mostrar');
    const acimaSemVitrine = camVitrine ? acima.filter(c => c !== camVitrine) : acima;
    const camLuz = camadas.find(c => c.tipo === 'luz');
    medir('objetos', () => {
        ctx.save();
        aplicarCamera(ctx, T.cam);
        for (const cam of abaixo) drawCamada(cam, viewRect);
        // Público: o cenário interativo (porta/janela/luz) vai ANTES do fog — o jogador
        // só enxerga a porta que está no campo de visão dele. (No secreto, depois.)
        if (camLuz && T.mode !== 'secret') drawCamada(camLuz, viewRect);
        ctx.restore();
    });

    medir('fog', drawFog);

    medir('overlay', () => {
        ctx.save();
        aplicarCamera(ctx, T.cam);
        for (const cam of acimaSemVitrine) drawCamada(cam, viewRect);
        if (camLuz && T.mode === 'secret') drawCamada(camLuz, viewRect);
        drawTelhados();
        if (camVitrine) drawCamada(camVitrine, viewRect);
        drawSelecao();
        drawTemp();
        drawMira();
        drawReguasRemotas();
        drawCursores();
        drawPings();
        ctx.restore();
    });
    // (o clima vive no canvas overlay próprio — ver desenharClimaOverlay)
}

function aplicarCamera(c, cam) {
    c.translate(cv.width / (2*dpr), cv.height / (2*dpr));
    c.scale(cam.z, cam.z);
    c.translate(-cam.x, -cam.y);
}

function coletarAlvosDeTemplates() {
    const s = new Set();
    for (const o of T.objects.values()) {
        if (o.tipo === 'template' && Array.isArray(o.alvos)) o.alvos.forEach(id => s.add(id));
    }
    return s;
}

// ===== CACHE ESTÁTICO (grid + mapa) =====
function mapCacheValido() {
    if (mapCache.version !== PERF.mapVersion) return false;
    if (!mapCache.cam || mapCache.cam.z !== T.cam.z) return false;
    const margemX = (mapCache.pad - 1) * (cv.width / dpr) / 2 / T.cam.z;
    const margemY = (mapCache.pad - 1) * (cv.height / dpr) / 2 / T.cam.z;
    return Math.abs(T.cam.x - mapCache.cam.x) <= margemX && Math.abs(T.cam.y - mapCache.cam.y) <= margemY;
}
function desenharBaseEstatica() {
    if (!mapCacheValido()) renderizarMapCache();
    const offX = (mapCache.cam.x - T.cam.x) * T.cam.z * dpr + (cv.width - mapCache.w) / 2;
    const offY = (mapCache.cam.y - T.cam.y) * T.cam.z * dpr + (cv.height - mapCache.h) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(mapCache.cv, offX, offY);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function renderizarMapCache() {
    const c = mapCache.ctx;
    mapCache.cam = { x: T.cam.x, y: T.cam.y, z: T.cam.z };
    mapCache.version = PERF.mapVersion;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, mapCache.w, mapCache.h);
    aplicarSmoothing(c);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(mapCache.w / (2*dpr), mapCache.h / (2*dpr));
    c.scale(T.cam.z, T.cam.z);
    c.translate(-T.cam.x, -T.cam.y);
    const rect = calcularViewRect(T.cam, mapCache.pad + 0.05);
    const ctxAnterior = ctx;
    ctx = c;
    try {
        if (T.canvas?.grid?.show !== false) drawGrid(rect);
        const mapa = camadasVisiveis().find(x => x.tipo === 'mapa');
        if (mapa) drawCamada(mapa, rect, true);
    } finally { ctx = ctxAnterior; }
}

// ===== GRID (quad / hex / none) — F4.1 =====
function drawGrid(rect) {
    const gs = gridSize();
    const tipo = T.canvas?.grid?.tipo || 'quad';
    if (tipo === 'none') return;
    ctx.strokeStyle = 'rgba(148,163,184,0.10)';
    ctx.lineWidth = 1 / T.cam.z;
    if (tipo === 'quad') {
        const x0 = Math.floor(rect.x0 / gs) * gs, y0 = Math.floor(rect.y0 / gs) * gs;
        ctx.beginPath();
        for (let x = x0; x <= rect.x1; x += gs) { ctx.moveTo(x, rect.y0); ctx.lineTo(x, rect.y1); }
        for (let y = y0; y <= rect.y1; y += gs) { ctx.moveTo(rect.x0, y); ctx.lineTo(rect.x1, y); }
        ctx.stroke();
        return;
    }
    // Hexagonal: itera hexes que cobrem o rect
    const h0 = axialRound(pixelParaAxial({ x: rect.x0, y: rect.y0 }, gs, tipo));
    const h1 = axialRound(pixelParaAxial({ x: rect.x1, y: rect.y1 }, gs, tipo));
    const qMin = Math.min(h0.q, h1.q) - 2, qMax = Math.max(h0.q, h1.q) + 2;
    const rMin = Math.min(h0.r, h1.r) - 2, rMax = Math.max(h0.r, h1.r) + 2;
    // segurança: hexes demais em zoom-out extremo → pula grid
    if ((qMax - qMin) * (rMax - rMin) > 9000) return;
    const s = gs / 2;
    const a0 = tipo === 'hexF' ? 0 : Math.PI / 6; // rotação dos cantos
    ctx.beginPath();
    for (let q = qMin; q <= qMax; q++) {
        for (let r = rMin; r <= rMax; r++) {
            const c = axialParaPixel({ q, r }, gs, tipo);
            if (c.x < rect.x0 - gs || c.x > rect.x1 + gs || c.y < rect.y0 - gs || c.y > rect.y1 + gs) continue;
            for (let i = 0; i < 6; i++) {
                const ang = a0 + i * Math.PI / 3;
                const px = c.x + s * Math.cos(ang), py = c.y + s * Math.sin(ang);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
    }
    ctx.stroke();
}

// ===== CAMADAS / OBJETOS =====
function drawCamada(cam, rect, noCache) {
    const objs = [];
    for (const o of T.objects.values()) {
        if (o.layerId !== cam.id || !objVisivel(o)) continue;
        if (o.tipo === 'imagem' && o.telhado && !noCache) continue; // telhados: passe próprio
        if (rect && !intersecta(bboxOf(o), rect)) continue;
        // F3.3: tokens fora da visão do jogador não são desenhados
        if (o.tipo === 'token' && !tokenVisivelParaMim(o, T._meusTokens || [])) continue;
        // F3.6: filtro do "andar ativo" (secreto)
        if (T.mode === 'secret' && T.andarAtivo != null && temElev(o) &&
            faixaDe(o.elev || 0, T.canvas?.andarAltura || 5) !== T.andarAtivo) {
            o.__dim = true;
        } else o.__dim = false;
        objs.push(o);
    }
    objs.sort((a, b) => (a.z||0) - (b.z||0));
    for (const o of objs) drawObjeto(o, cam);
}
function temElev(o) { return ['token','luz','porta','janela'].includes(o.tipo) || (o.tipo === 'desenho' && o.layerId === 'luz'); }

function drawObjeto(o, cam) {
    const secreto = T.mode === 'secret';
    const ocultoPub = o.visivelPublico === false || cam?.visivelPublico === false || cam?.tipo==='dm';
    ctx.save();
    if (secreto && ocultoPub && cam?.tipo !== 'luz') ctx.globalAlpha = 0.45;
    if (o.__dim) ctx.globalAlpha *= 0.18;
    switch (o.tipo) {
        case 'imagem': drawImagem(o); break;
        case 'mostrar': drawMostrar(o); break;
        case 'token': drawToken(o); break;
        case 'loot': drawLoot(o); break;
        case 'texto': drawTexto(o); break;
        case 'desenho': drawDesenho(o, cam); break;
        case 'medida': drawLinhaMedida(o.pontos || [], o.cor || '#22d3ee', o.label); break;
        case 'alfinete': drawAlfinete(o); break;
        case 'luz': drawLuzPonto(o); break;   // no público só chega aqui com `interagirCenario`
        case 'porta': drawPorta(o); break;
        case 'janela': drawJanela(o); break;
        case 'template': drawTemplate(o); break;
        case 'terreno': if (secreto) drawTerreno(o); break;
        case 'relogio': drawRelogio(o); break;
    }
    ctx.restore();
}

function drawImagem(o) {
    const img = getImg(o.url);
    if (img) {
        const w = o.w || img.width, h = o.h || img.height;
        const bmp = melhorBitmap(img, (w / img.width) * T.cam.z);
        ctx.drawImage(bmp, o.x, o.y, w, h);
    } else {
        ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(o.x, o.y, o.w||200, o.h||200);
        ctx.fillStyle='#94a3b8'; ctx.font='16px Arial'; ctx.fillText('carregando...', o.x+10, o.y+24);
    }
}

function drawTelhados() {
    for (const o of T.objects.values()) {
        if (o.tipo !== 'imagem' || !o.telhado || !objVisivel(o)) continue;
        if (!intersecta(bboxOf(o), viewRect)) continue;
        ctx.save();
        ctx.globalAlpha = alphaTelhado(o);
        drawImagem(o);
        ctx.restore();
    }
}

function drawMostrar(o) {
    const img = getImg(o.url);
    const w = o.w || 220, h = o.h || 220;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#111827';
    roundRect(o.x - 6, o.y - 6, w + 12, h + 12 + (o.opcoes?.mostrarNome ? 30 : 0), 10); ctx.fill();
    ctx.restore();
    if (img) ctx.drawImage(img, o.x, o.y, w, h);
    else { ctx.fillStyle = 'rgba(148,163,184,.2)'; ctx.fillRect(o.x, o.y, w, h); }
    let yy = o.y + h + 4;
    if (o.opcoes?.mostrarNome) {
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
        ctx.fillText(o.nome || '', o.x + w/2, yy + 20); ctx.textAlign = 'left'; yy += 28;
    }
    const extras = o.extrasVisiveis || [];
    if (extras.length) {
        ctx.fillStyle = '#cbd5e1'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
        extras.forEach(t => { ctx.fillText(t, o.x + w/2, yy + 16); yy += 18; });
        ctx.textAlign = 'left';
    }
}

// ===== TOKEN (F5: barras, condições, anéis; F3: invisível) =====
function drawToken(o) {
    const gs = gridSize();
    const s = (o.tamanhoCelulas || 1) * gs;
    const pos = posDisplay(o);
    const img = getImg(o.url);
    ctx.save();
    if (tokenInvisivel(o)) { ctx.globalAlpha *= (T.mode === 'secret' ? 0.5 : 0.65); }

    // Anéis de destaque (embaixo do token)
    if (T._alvos?.has(o.id)) {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, s/2 + hud(6), 0, Math.PI*2);
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = hud(3); ctx.stroke();
    }
    if (T._tokenAtivo?.id === o.id) {
        const pulso = 0.5 + 0.5 * Math.sin(Date.now() / 260);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, s/2 + hud(9) + hud(4) * pulso, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(250,204,21,${0.55 + 0.35 * pulso})`; ctx.lineWidth = hud(3.5); ctx.stroke();
    }

    ctx.beginPath(); ctx.arc(pos.x, pos.y, s/2, 0, Math.PI*2); ctx.closePath();
    ctx.save(); ctx.clip();
    if (img) ctx.drawImage(img, pos.x - s/2, pos.y - s/2, s, s);
    else { ctx.fillStyle = '#1f2937'; ctx.fillRect(pos.x - s/2, pos.y - s/2, s, s); ctx.fillStyle = '#94a3b8'; ctx.font = `bold ${s*0.4}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((o.nome||'?')[0].toUpperCase(), pos.x, pos.y); }
    ctx.restore();

    const cor = o.vinculo?.tipo === 'char' ? '#22c55e' : o.vinculo?.tipo === 'npc' ? '#ef4444' : '#8b5cf6';
    ctx.lineWidth = Math.max(2, s * 0.045); ctx.strokeStyle = cor;
    if (tokenInvisivel(o)) ctx.setLineDash([hud(6), hud(5)]);
    ctx.stroke(); ctx.setLineDash([]);

    // Nome (HUD constante)
    if (o.mostrarNome !== false && o.nome) {
        const fs = hud(14);
        ctx.font = `bold ${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = hud(3.5); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(o.nome, pos.x, pos.y + s/2 + hud(4));
        ctx.fillStyle = '#f8fafc'; ctx.fillText(o.nome, pos.x, pos.y + s/2 + hud(4));
    }

    // Barras de vitais (F5.1)
    if (barrasVisiveis(o)) {
        const v = vitaisDoToken(o);
        const vds = vdsCombateDoToken(o);
        // Vitais e recursos de classe são a MESMA pilha de barras, na ordem do
        // cadastro; só o VD sem atual/máx sobra para a linha de texto acima.
        const medidores = medidoresDoToken(v, vds);
        if (medidores.length) drawBarras(pos, s, medidores);
        if (vds.length) drawVDsCombate(pos, s, vds, medidores.length);
        // Ícones de condição (F5.2)
        if (v?.conds?.length) drawCondicoes(pos, s, v.conds);
    }

    // Elevação ≠ 0
    if ((o.elev || 0) !== 0) {
        const fs = hud(11);
        ctx.font = `bold ${fs}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(17,24,39,.9)';
        const txt = `▲${o.elev}`;
        const tw = ctx.measureText(txt).width;
        roundRect(pos.x + s/2 - tw - hud(8), pos.y - s/2 - hud(2), tw + hud(8), fs + hud(4), hud(3)); ctx.fill();
        ctx.fillStyle = '#7dd3fc'; ctx.fillText(txt, pos.x + s/2 - tw - hud(4), pos.y - s/2 + fs + hud(1));
    }

    // Indicador de visão (secreto)
    if (T.mode === 'secret' && o.visao?.ativa) {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, unidadesParaPx(o.visao.alcance || 6, pos), 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(250,204,21,.22)'; ctx.setLineDash([6,6]); ctx.lineWidth = 1.5/T.cam.z; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
}

// Cores das barras de recurso de CLASSE (Harmonia, Graça, Bolha de Sangue...).
// O cadastro não tem campo de cor, então a escolha é estável pelo nome do VD:
// a mesma Harmonia sai sempre da mesma cor, em qualquer token e sessão.
const CORES_VD = ['#38bdf8', '#f472b6', '#a3e635', '#c084fc', '#2dd4bf', '#fb7185'];
function corDoVd(chave) {
    let h = 0;
    for (const c of String(chave || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return CORES_VD[h % CORES_VD.length];
}

/**
 * 📊 Medidores do token, NA ORDEM DE EXIBIÇÃO: os três Status Vitais e, depois,
 * todo VD de combate que tenha atual/máx (Harmonia 3/7 é barra, não texto) —
 * estes na ordem do cadastro, que é a ordem em que VDS_COMBATE chega.
 * VD sem campo Atual (Blindagem) não vira barra: vai na linha de texto acima.
 */
function medidoresDoToken(v, vds) {
    const out = [];
    if (v) {
        out.push({ cur: v.hp, max: v.hpMax, cor: '#34d399' });
        out.push({ cur: v.ener, max: v.enerMax, cor: '#fbbf24' });
        out.push({ cur: v.san, max: v.sanMax, cor: '#a78bfa' });
    }
    for (const d of (vds || [])) {
        if (!d.campoAtual || d.atual == null) continue;
        out.push({ cur: d.atual, max: d.valor, cor: corDoVd(d.key || d.nome), icone: d.icone });
    }
    return out;
}

/** Altura ocupada pela pilha de medidores — a linha de texto se pendura nela. */
function alturaMedidores(n) { return (hud(4.5) + hud(1.5)) * n; }

function drawBarras(pos, s, medidores) {
    const w = Math.max(s, hud(44)), h = hud(4.5), gap = hud(1.5);
    const x = pos.x - w / 2;
    let y = pos.y - s / 2 - hud(8) - alturaMedidores(medidores.length);
    for (const m of medidores) {
        ctx.fillStyle = 'rgba(10,14,22,.85)';
        roundRect(x - hud(1), y - hud(1), w + hud(2), h + hud(2), hud(2)); ctx.fill();
        const pct = m.max > 0 ? Math.max(0, Math.min(1, m.cur / m.max)) : 0;
        ctx.fillStyle = m.cor;
        if (pct > 0) { roundRect(x, y, w * pct, h, hud(2)); ctx.fill(); }
        // Barra de VD vai com o ícone à esquerda: cor sozinha não diz QUAL
        // recurso é, e um bardo pode ter três barras de classe empilhadas.
        if (m.icone) {
            const fs = hud(8);
            ctx.font = `${fs}px Arial`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(m.icone, x - hud(3), y + h / 2);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
        y += h + gap;
    }
}

// ⚔️ Linha compacta com os VDs de Status de Combate SEM atual/máx (Blindagem
// etc.) — os que têm atual/máx já viraram barra logo abaixo.
function drawVDsCombate(pos, s, vds, nMedidores) {
    const soNumero = vds.filter(d => !(d.campoAtual && d.atual != null));
    if (!soNumero.length) return;
    const fs = hud(10.5);
    ctx.font = `bold ${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const txt = soNumero.map(d => `${d.icone}${d.prefixo}${d.valor}${d.sufixo}`).join(' ');
    const y = pos.y - s / 2 - hud(8) - alturaMedidores(nMedidores) - hud(3);
    ctx.lineWidth = hud(3); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(txt, pos.x, y);
    ctx.fillStyle = '#e2e8f0'; ctx.fillText(txt, pos.x, y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

/**
 * Ícones de condição em arco sobre o token. A lista já vem AGRUPADA (um item
 * por condição, ver condicoesAgrupadas) — aqui só sobra mostrar o nível de quem
 * acumulou, num "×N" miúdo no canto do ícone.
 */
function drawCondicoes(pos, s, conds) {
    const fs = hud(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const max = Math.min(conds.length, 6);
    for (let i = 0; i < max; i++) {
        const ang = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
        const cx = pos.x + Math.cos(ang) * (s/2 + hud(11));
        const cy = pos.y + Math.sin(ang) * (s/2 + hud(11));
        ctx.fillStyle = 'rgba(17,24,39,.9)';
        ctx.beginPath(); ctx.arc(cx, cy, fs * 0.72, 0, Math.PI*2); ctx.fill();
        ctx.font = `${fs}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.fillText(conds[i].icone || '☠️', cx, cy + fs*0.05);
        // acumulou? o número vai no canto, pequeno, com contorno para ler sobre o ícone
        const nv = Number(conds[i].nivel) || 1;
        if (nv > 1) {
            const nfs = hud(8);
            ctx.font = `bold ${nfs}px Arial`;
            const bx = cx + fs * 0.6, by = cy + fs * 0.6;
            ctx.lineWidth = hud(2.5); ctx.strokeStyle = 'rgba(0,0,0,.9)';
            ctx.strokeText('×' + nv, bx, by);
            ctx.fillStyle = '#fde047';
            ctx.fillText('×' + nv, bx, by);
        }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Só a imagem, sem borda/fundo/nome: o loot deve parecer parte do mapa.
function drawLoot(o) {
    const s = gridSize() * 0.8;
    const img = getImg(o.url);
    ctx.save();
    if (img) {
        ctx.drawImage(img, o.x - s/2, o.y - s/2, s, s);
    } else {
        ctx.font = `${s*0.7}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.item?.ehContainer ? '🧰' : '📦', o.x, o.y);
    }
    // Cadeado só para o MESTRE — o jogador descobre a tranca ao interagir
    if (o.trancado && T.mode === 'secret') {
        ctx.font = `${s*0.45}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔒', o.x + s * 0.32, o.y + s * 0.32);
    }
    // 🔍 Oculto por teste — selo só na tela do MESTRE (Graus exigidos, ✔ = revelado)
    if (o.testeGraus != null && T.mode === 'secret') {
        ctx.font = `bold ${hud(11)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const selo = `🔍${o.reveladoPublico ? '✔' : o.testeGraus}`;
        ctx.lineWidth = hud(3); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(selo, o.x - s * 0.32, o.y - s * 0.38);
        ctx.fillStyle = '#7dd3fc'; ctx.fillText(selo, o.x - s * 0.32, o.y - s * 0.38);
    }
    ctx.restore();
}

function drawTexto(o) {
    ctx.font = fontOf(o);
    ctx.textBaseline = 'top';
    const linhas = String(o.texto||'').split('\n');
    const lh = (o.tamanho||28) * 1.25;
    linhas.forEach((l, i) => {
        if (o.usaBorda && o.corBorda) { ctx.lineWidth = Math.max(2, (o.tamanho||28)/9); ctx.strokeStyle = o.corBorda; ctx.strokeText(l, o.x, o.y + i*lh); }
        ctx.fillStyle = o.cor || '#fff';
        ctx.fillText(l, o.x, o.y + i*lh);
    });
}

function drawDesenho(o, cam) {
    const pts = o.pontos || []; if (pts.length < 1) return;
    const isLuz = cam?.tipo === 'luz';
    ctx.strokeStyle = isLuz ? '#f97316' : (o.cor || '#3b82f6');
    ctx.lineWidth = isLuz ? Math.max(3, 3/T.cam.z) : (o.grossura || 4);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.ehRota) ctx.setLineDash([hud(14), hud(9)]);   // 🛤️ rota de viagem: tracejado constante na tela
    ctx.beginPath();
    if (o.forma === 'ret' && pts.length >= 2) {
        const a = pts[0], b = pts[pts.length-1];
        ctx.rect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y));
    } else if (o.forma === 'elipse' && pts.length >= 2) {
        const a = pts[0], b = pts[pts.length-1];
        ctx.ellipse((a.x+b.x)/2, (a.y+b.y)/2, Math.abs(b.x-a.x)/2, Math.abs(b.y-a.y)/2, 0, 0, Math.PI*2);
    } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (o.fill && (o.forma === 'ret' || o.forma === 'elipse')) { ctx.fillStyle = hexA(o.cor||'#3b82f6', 0.25); ctx.fill(); }
    ctx.stroke();
    if (o.ehRota) ctx.setLineDash([]);
    if (isLuz && (o.elev || 0) !== 0) {
        ctx.font = `${hud(11)}px Arial`; ctx.fillStyle = '#fdba74';
        ctx.fillText(`▲${o.elev}`, pts[0].x + 6, pts[0].y - 6);
    }
}

// ===== TEMPLATES (F4.3) =====
function drawTemplate(o) {
    const a = o.origem, b = o.destino || a;
    ctx.save();
    ctx.fillStyle = hexA(o.cor || '#f97316', o.alpha ?? 0.35);
    ctx.strokeStyle = o.cor || '#f97316';
    ctx.lineWidth = hud(2);
    ctx.beginPath();
    if (o.forma === 'circulo') ctx.arc(a.x, a.y, o.raio || 50, 0, Math.PI*2);
    else if (o.forma === 'ret') ctx.rect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y));
    else if (o.forma === 'linha') {
        const ang = Math.atan2(b.y-a.y, b.x-a.x), hw = (o.raio || 20) / 2;
        const nx = Math.cos(ang + Math.PI/2) * hw, ny = Math.sin(ang + Math.PI/2) * hw;
        ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
        ctx.lineTo(b.x - nx, b.y - ny); ctx.lineTo(a.x - nx, a.y - ny);
        ctx.closePath();
    } else if (o.forma === 'cone') {
        const L = Math.hypot(b.x-a.x, b.y-a.y);
        const dir = Math.atan2(b.y-a.y, b.x-a.x);
        const meia = ((o.ang || 60) * Math.PI / 180) / 2;
        ctx.moveTo(a.x, a.y);
        ctx.arc(a.x, a.y, L, dir - meia, dir + meia);
        ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    if (o.duracao > 0) {
        const resta = Math.max(0, (o.rodadaCriada || 1) + o.duracao - (T.combate?.rodada || 1));
        ctx.font = `bold ${hud(12)}px Arial`; ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(`⏳${resta}`, a.x, a.y - hud(6));
        ctx.textAlign = 'left';
    }
    ctx.restore();
}

// ===== 🎯 MIRA DO TURNO (preview local — só quem está mirando vê) =====
// Reusa drawTemplate com um shape sintético; por cima vão o aro de alcance
// (contado a partir da BORDA do token) e o anel dos alvos escolhidos.
function drawMira() {
    const m = T.mira; if (!m) return;
    const tok = T.objects.get(m.tokenId); if (!tok) return;
    const gs = gridSize();
    const rTok = ((tok.tamanhoCelulas || 1) * gs) / 2;
    const cor = m.afeta === 'aliados' ? '#22c55e' : m.afeta === 'todos' ? '#eab308' : '#ef4444';

    // aro de alcance (quando a mira tem alcance: alvos, golpe e área livre)
    if (m.alcancePx > 0 && (m.tipo === 'alvos' || m.tipo === 'cac' || m.origem === 'livre')) {
        ctx.save();
        ctx.beginPath(); ctx.arc(tok.x, tok.y, rTok + m.alcancePx, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(cor, 0.55); ctx.setLineDash([hud(7), hud(6)]); ctx.lineWidth = hud(1.6);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
    }

    // shape da área/golpe seguindo o cursor
    const shape = shapeDaMira(m, { x: tok.x, y: tok.y, r: rTok }, m.cursor);
    if (shape) drawTemplate({ ...shape, cor, alpha: m.travada ? 0.4 : 0.25 });

    // anéis nos alvos marcados (mira de alvos)
    for (const id of m.alvos || []) {
        const o = T.objects.get(id); if (!o) continue;
        const r = ((o.tamanhoCelulas || 1) * gs) / 2;
        ctx.save();
        ctx.beginPath(); ctx.arc(o.x, o.y, r + hud(5), 0, Math.PI * 2);
        ctx.strokeStyle = cor; ctx.lineWidth = hud(3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tok.x, tok.y); ctx.lineTo(o.x, o.y);
        ctx.strokeStyle = hexA(cor, 0.4); ctx.setLineDash([hud(4), hud(4)]); ctx.lineWidth = hud(1.4);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
    }
}

// ===== TERRENO DIFÍCIL (F4.5, só secreto) =====
function drawTerreno(o) {
    const pts = o.pontos || []; if (pts.length < 3) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250,204,21,.12)';
    ctx.fill();
    ctx.clip();
    // hachura
    const b = bboxOf(o);
    ctx.strokeStyle = 'rgba(250,204,21,.28)'; ctx.lineWidth = 1.5/T.cam.z;
    ctx.beginPath();
    const passo = 22;
    for (let x = b.x - b.h; x < b.x + b.w; x += passo) {
        ctx.moveTo(x, b.y); ctx.lineTo(x + b.h, b.y + b.h);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(250,204,21,.6)'; ctx.setLineDash([8,6]); ctx.lineWidth = 2/T.cam.z;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const cx = pts.reduce((s,p)=>s+p.x,0)/pts.length, cy = pts.reduce((s,p)=>s+p.y,0)/pts.length;
    ctx.font = `bold ${hud(13)}px Arial`; ctx.textAlign='center'; ctx.fillStyle = '#fde047';
    ctx.fillText(`⛰️ x${o.mult || 2}`, cx, cy); ctx.textAlign='left';
}

// ===== RELÓGIOS (F6.2) =====
function drawRelogio(o) {
    const gs = gridSize();
    const r = gs * 0.7;
    // Vinculado a frente: mestre lê a frente ao vivo (T.frentes, tab-sessao);
    // público lê o espelho gravado no objeto — e nunca vê o nome (pressão anônima)
    let fatias = o.fatias || 6, cheias = Math.min(o.cheias || 0, fatias), nome = o.nome;
    if (o.frenteId) {
        const fr = (T.frentes || {})[o.frenteId];
        const dados = fr ? { fatias: fr.relogio?.fatias || 6, cheias: fr.relogio?.cheias || 0 } : (o.espelho || {});
        fatias = dados.fatias || 6;
        cheias = Math.min(dados.cheias || 0, fatias);
        if (T.mode !== 'secret') nome = '';
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(17,24,39,.92)'; ctx.fill();
    for (let i = 0; i < fatias; i++) {
        const a0 = -Math.PI/2 + (i / fatias) * Math.PI * 2;
        const a1 = -Math.PI/2 + ((i+1) / fatias) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.arc(o.x, o.y, r * 0.92, a0 + 0.03, a1 - 0.03);
        ctx.closePath();
        ctx.fillStyle = i < cheias ? (o.cor || '#ef4444') : 'rgba(148,163,184,.15)';
        ctx.fill();
    }
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = hud(2); ctx.stroke();
    if (nome) {
        const fs = hud(13);
        ctx.font = `bold ${fs}px Arial`; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.lineWidth = hud(3); ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(nome, o.x, o.y + r + hud(4));
        ctx.fillStyle = '#f8fafc'; ctx.fillText(nome, o.x, o.y + r + hud(4));
    }
    ctx.restore();
}

export function drawLinhaMedida(pts, cor, label, labelSub) {
    if (pts.length < 2) return;
    ctx.strokeStyle = cor; ctx.lineWidth = Math.max(2.5, 3/T.cam.z); ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    pts.forEach((p,i) => { if (i===0||i===pts.length-1) return; ctx.beginPath(); ctx.arc(p.x,p.y,4/T.cam.z,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill(); });
    const a = pts[pts.length-2], b = pts[pts.length-1];
    const ang = Math.atan2(b.y-a.y, b.x-a.x), L = 14/T.cam.z;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - L*Math.cos(ang-0.4), b.y - L*Math.sin(ang-0.4));
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - L*Math.cos(ang+0.4), b.y - L*Math.sin(ang+0.4));
    ctx.stroke();
    if (label) {
        const fs = 15 / T.cam.z, pad = 7/T.cam.z;
        ctx.font = `bold ${fs}px Arial`;
        const w = Math.max(ctx.measureText(label).width, labelSub?ctx.measureText(labelSub).width:0) + pad*2;
        const h = (labelSub ? fs*2.35 : fs*1.5) + pad;
        const bx = b.x + 12/T.cam.z, by = b.y - h/2;
        ctx.fillStyle = 'rgba(17,24,39,.92)';
        roundRect(bx, by, w, h, 6/T.cam.z); ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,.4)'; ctx.lineWidth = 1/T.cam.z; ctx.stroke();
        ctx.fillStyle = '#f8fafc'; ctx.textBaseline = 'top';
        ctx.fillText(label, bx + pad, by + pad*0.7);
        if (labelSub) { ctx.font = `${fs*0.8}px Arial`; ctx.fillStyle = '#94a3b8'; ctx.fillText(labelSub, bx + pad, by + pad*0.7 + fs*1.15); }
    }
}

function drawAlfinete(o) {
    const s = hud(15);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = o.cor || '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -s, s*0.75, Math.PI*0.85, Math.PI*2.15);
    ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = hud(1.5); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s, s*0.3, 0, Math.PI*2); ctx.fill();
    if (o.refTipo) { ctx.font = `${s*0.6}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(o.refTipo==='npc'?'👹':'🎁', 0, -s); }
    ctx.restore();
    if (o.titulo) {
        const fs = hud(12);
        ctx.font = `bold ${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline='top';
        ctx.lineWidth = hud(3); ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.strokeText(o.titulo, o.x, o.y + hud(4));
        ctx.fillStyle = '#fde68a'; ctx.fillText(o.titulo, o.x, o.y + hud(4));
        ctx.textAlign = 'left';
    }
}

function drawLuzPonto(o) {
    const r = unidadesParaPx(o.alcance || 6, o);
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
    ctx.strokeStyle = hexA(o.cor || '#fde047', o.apagada ? 0.1 : 0.3); ctx.setLineDash([8,8]); ctx.lineWidth = 1.5/T.cam.z; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${22/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha *= o.apagada ? 0.45 : 1;
    ctx.fillText(o.apagada ? '🕯️' : (o.animacao && o.animacao !== 'nenhuma' ? '🔥' : '💡'), o.x, o.y); ctx.textAlign='left';
    if ((o.elev || 0) !== 0) { ctx.font = `${hud(11)}px Arial`; ctx.fillStyle = '#fdba74'; ctx.fillText(`▲${o.elev}`, o.x + hud(14), o.y - hud(14)); }
}

function drawPorta(o) {
    const p = o.pontos || []; if (p.length < 2) return;
    ctx.strokeStyle = o.aberta ? '#22c55e' : '#eab308';
    ctx.lineWidth = Math.max(4, 5/T.cam.z);
    if (o.aberta) ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${18/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(o.trancado && !o.aberta && T.mode === 'secret' ? '🔒' : '🚪', (p[0].x+p[1].x)/2, (p[0].y+p[1].y)/2); ctx.textAlign='left';
}
function drawJanela(o) {
    const p = o.pontos || []; if (p.length < 2) return;
    ctx.strokeStyle = o.aberta ? '#22c55e' : '#38bdf8'; ctx.lineWidth = Math.max(3, 4/T.cam.z);
    ctx.setLineDash(o.aberta ? [10, 12] : [4, 6]);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${14/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(o.trancado && !o.aberta && T.mode === 'secret' ? '🔒' : '🪟', (p[0].x+p[1].x)/2, (p[0].y+p[1].y)/2); ctx.textAlign='left';
}

function drawSelecao() {
    syncLockBtn();
    // Some por padrão; desenharBussola reexibe no mesmo frame se couber —
    // assim os early returns abaixo não deixam os botões órfãos na tela.
    esconderBotoesGirar();
    // Seleção por retângulo: contorno em cada item (as alças e a bússola abaixo
    // continuam sendo só do item único, que é o que se redimensiona/gira).
    if (T.selecionados?.length > 1) {
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1.5/T.cam.z; ctx.setLineDash([5/T.cam.z, 3/T.cam.z]);
        for (const id of T.selecionados) {
            const o = T.objects.get(id); if (!o) continue;
            const b = bboxOf(o);
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        ctx.setLineDash([]);
    }
    if (!T.selection) return;
    const o = T.objects.get(T.selection); if (!o) return;
    const b = bboxOf(o);
    const bloqueado = !!o.bloqueado;
    ctx.strokeStyle = bloqueado ? '#f59e0b' : '#8b5cf6';
    ctx.lineWidth = 2/T.cam.z; ctx.setLineDash([6/T.cam.z, 4/T.cam.z]);
    ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
    if (bloqueado) {
        // 🔒 sem alças de redimensionamento; cadeado no canto superior esquerdo
        ctx.font = `${16/T.cam.z}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('🔒', b.x, b.y - 4/T.cam.z);
        return;
    }
    if (['imagem','mostrar'].includes(o.tipo)) {
        for (const h of handlesOf(b)) {
            ctx.fillStyle = '#8b5cf6';
            ctx.fillRect(h.x - 6/T.cam.z, h.y - 6/T.cam.z, 12/T.cam.z, 12/T.cam.z);
        }
    }
    desenharBussola(o, b);
}

/**
 * Token com visão/luz em CONE: um arco fino na borda mostra a amplitude e
 * para onde ele mira. Discreto de propósito — o token é que importa, não o
 * indicador; e sem nada o jogador não descobre que dá para girar.
 */
function desenharBussola(o, b) {
    if (!temCone(o) || !podeGirarToken(o)) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const r = Math.max(b.w, b.h) / 2 + hud(5);
    const dir = rotParaCanvas(o.rot) * Math.PI / 180;   // mesma conversão do cone
    const ang = (o.visao?.ativa && o.visao.angulo) || o.luz?.angulo || 360;
    const meia = Math.min(Math.PI, (ang * Math.PI / 180) / 2);

    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineCap = 'round';

    // Arco da amplitude: fininho, só na borda
    ctx.lineWidth = hud(2.5);
    ctx.beginPath();
    ctx.arc(cx, cy, r, dir - meia, dir + meia);
    ctx.stroke();

    // Marca da direção: um risco curto para fora, no centro do cone
    ctx.lineWidth = hud(2);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(dir) * r, cy + Math.sin(dir) * r);
    ctx.lineTo(cx + Math.cos(dir) * (r + hud(6)), cy + Math.sin(dir) * (r + hud(6)));
    ctx.stroke();
    ctx.restore();

    posicionarBotoesGirar(o, cx, cy, r);
}

/** 🔒 F8: posiciona o botão HTML de desbloqueio sobre o objeto bloqueado selecionado (só Mestre). */
function syncLockBtn() {
    const el = document.getElementById('tbLockBtn');
    if (!el) return;
    const o = T.selection && T.objects.get(T.selection);
    if (!o || !o.bloqueado || !T.isMaster) { el.classList.remove('open'); return; }
    const b = bboxOf(o);
    const s = worldToScreen({ x: b.x + b.w / 2, y: b.y });
    el.style.left = Math.max(24, Math.min(window.innerWidth - 24, s.x)) + 'px';
    el.style.top = Math.max(24, Math.min(window.innerHeight - 24, s.y - 18)) + 'px';
    el.dataset.id = o.id;
    el.classList.add('open');
}
export function handlesOf(b) {
    return [
        { k:'nw', x:b.x, y:b.y }, { k:'ne', x:b.x+b.w, y:b.y },
        { k:'sw', x:b.x, y:b.y+b.h }, { k:'se', x:b.x+b.w, y:b.y+b.h },
    ];
}

function drawTemp() {
    const t = T.temp; if (!t) return;
    if (t.tipo === 'marquee') {
        const r = normalizarRet(t.a, t.b);
        ctx.fillStyle = hexA('#8b5cf6', 0.12);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = hud(1.5);
        ctx.setLineDash([hud(6), hud(4)]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
        return;
    }
    if (t.tipo === 'desenho') drawDesenho({ pontos: t.pontos, cor: t.cor, grossura: t.grossura, forma: t.forma, fill: t.fill }, null);
    if (t.tipo === 'medida') drawLinhaMedida(t.pontos.concat(t.atual ? [t.atual] : []), t.cor || '#22d3ee', t.label, t.labelSub);
    if (t.tipo === 'segmento' && t.pontos.length) {
        const fim = t.atual || t.pontos[0];
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4/T.cam.z;
        ctx.beginPath(); ctx.moveTo(t.pontos[0].x, t.pontos[0].y); ctx.lineTo(fim.x, fim.y); ctx.stroke();
    }
    if (t.tipo === 'template') drawTemplate({ ...t.dados, origem: t.pontos[0], destino: t.atual || t.pontos[0] });
    if (t.tipo === 'terreno' && t.pontos.length) {
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2/T.cam.z; ctx.setLineDash([6,5]);
        ctx.beginPath(); ctx.moveTo(t.pontos[0].x, t.pontos[0].y);
        for (let i = 1; i < t.pontos.length; i++) ctx.lineTo(t.pontos[i].x, t.pontos[i].y);
        if (t.atual) ctx.lineTo(t.atual.x, t.atual.y);
        ctx.stroke(); ctx.setLineDash([]);
        t.pontos.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4/T.cam.z, 0, Math.PI*2); ctx.fillStyle = '#fde047'; ctx.fill(); });
    }
}

function drawReguasRemotas() {
    const agora = Date.now();
    for (const [u, r] of Object.entries(T.reguasRemotas || {})) {
        if (!r || !reguaVisivelAqui(u)) continue;
        // Expira pelo relógio LOCAL de recebimento — o `r.t` é do relógio do
        // outro aparelho e não é comparável com o daqui (celular minutos fora
        // de hora fazia a régua remota nunca aparecer).
        const recebida = T.reguasRecebidas?.[u];
        if (!recebida || agora - recebida > REGUA_TTL_MS) continue;
        // A ponta da régua é o CENTRO do token arrastado. Os dois viajam em
        // documentos diferentes e aterrissam em instantes diferentes: desenhar o
        // ponto que veio no doc deixava a seta descolada do token, que ainda está
        // interpolando. Ancorar na posição de exibição gruda os dois em qualquer
        // direção (mestre vendo jogador e jogador vendo mestre).
        let pts = r.pontos || [];
        const tk = r.tokenId && T.objects.get(r.tokenId);
        if (tk && pts.length) { pts = pts.slice(); pts[pts.length - 1] = posDisplay(tk); }
        drawLinhaMedida(pts, r.cor || '#f472b6', r.label, r.nome);
    }
}

// ===== CURSORES & PINGS (F2.4/2.5) =====
function drawCursores() {
    if (!cursoresAtivados()) return;
    for (const c of cursoresParaDesenhar()) {
        const s = hud(14);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.fillStyle = c.cor || '#f472b6';
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = hud(1.5);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(s*0.4, s*1.15); ctx.lineTo(s*0.55, s*0.72); ctx.lineTo(s*1.05, s*0.62);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const fs = hud(11);
        ctx.font = `bold ${fs}px Arial`;
        const tw = ctx.measureText(c.nome || '').width;
        ctx.fillStyle = 'rgba(17,24,39,.9)';
        roundRect(s*0.7, s*1.1, tw + hud(10), fs + hud(6), hud(4)); ctx.fill();
        ctx.fillStyle = c.cor || '#f472b6';
        ctx.textBaseline = 'top';
        ctx.fillText(c.nome || '', s*0.7 + hud(5), s*1.1 + hud(3));
        ctx.restore();
    }
}
function drawPings() {
    for (const p of pingsParaDesenhar()) {
        const k = p.prog;
        const r = hud(10) + hud(46) * k;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.cor || '#f472b6'; ctx.lineWidth = hud(3.5);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI*2); ctx.stroke();
        if (p.forcar) {
            ctx.font = `bold ${hud(13)}px Arial`; ctx.textAlign = 'center';
            ctx.fillStyle = p.cor || '#f472b6';
            ctx.fillText('📍 ' + (p.nome || ''), p.x, p.y - r - hud(6));
            ctx.textAlign = 'left';
        }
        ctx.restore();
    }
}

// =============================================
// FOG / ILUMINAÇÃO DINÂMICA (F3)
// 3 estados: oculto (preto) · explorado (memória, escurecido) · visível agora
// Público: visão POR JOGADOR (tokens próprios) + sensores + interseção luz×LoS
// =============================================
function drawFog() {
    const l = T.canvas?.luzDinamica;
    T._luzAnimada = false;
    if (!l?.ativa) {
        T.visiveisAgora = null; T._litPolys = null;
        _fogComposto = '';   // o canvas de fog não é mais válido
        // Cenário de fog montado + luz dinâmica desligada = o jogador vê tudo
        avisoFog(temCenarioDeFog() ? 'semFog' : null);
        return;
    }
    const dia = l.modo === 'dia';
    const op = T.mode === 'public' ? 1 : (l.fogSecretOpacity ?? 0.6);
    if (op <= 0 && T.mode === 'secret') { T.visiveisAgora = null; _fogComposto = ''; return; }

    if (PERF.wallHashVersion !== PERF.wallsVersion) {
        PERF.wallHash = construirHashParedes(coletarParedes());
        PERF.wallHashVersion = PERF.wallsVersion;
        PERF.fogKey = '';
    }

    // Público = TV da sessão: mesmo o mestre olha pela visão do grupo (só o
    // modo secreto é a tela particular dele, e ninguém além do mestre a abre).
    const escopo = T.mode === 'secret' ? 'mestre' : 'jogador';
    const pol = politicaDeFog({ luzAtiva: l.ativa, modo: l.modo, ehMestre: escopo === 'mestre' });
    const fontesVisao = coletarFontesDeVisao(escopo);
    const fontesLuz = coletarFontesDeLuz();
    avisoFog(!dia && fontesLuz.length === 0 && algumTokenPrecisaDeLuz() ? 'escuro' : null);
    const alturaAndar = T.canvas?.andarAltura || 5;

    const ser = f => `${f.x|0},${f.y|0},${f.r|0},${f.ang||360},${(f.dir||0)|0},${f.sensor||'p'},${faixaDe(f.elev||0, alturaAndar)}`;
    const key = PERF.wallsVersion + '|' + escopo + '|' + (dia?'d':'n') + '|' +
        fontesVisao.map(ser).join(';') + '#' + fontesLuz.map(ser).join(';');
    if (key !== PERF.fogKey || !PERF.fogPolys) medir('fog.polys', () => {
        // Um memo POR FONTE: no arrasto só a fonte que se moveu recalcula o
        // raycast — as outras 13 saem do cache. Paredes invalidam pela versão.
        // `fresca` marca quem recalculou, para a exploração não revarrer as
        // visões paradas a cada passo do arrasto.
        const calc = (f, ignoraParedes) => {
            let fresca = false;
            const poly = memoPolys.obter(
                ser(f) + '|' + (ignoraParedes ? 1 : 0), PERF.wallsVersion,
                () => { fresca = true; return visibilityPolygon(f, PERF.wallHash, ignoraParedes, alturaAndar); });
            return { poly, fresca };
        };
        const visao = fontesVisao.map(f => {
            const c = calc(f, f.sensor === 'tremorsense' || f.sensor === 'verdadeira');
            return {
                f, poly: c.poly, fresca: c.fresca,
                sensor: f.sensor || 'padrao',
                precisaLuz: pol.exigeLuz && (!f.sensor || f.sensor === 'padrao' || f.sensor === 'verInvisivel'),
            };
        });
        const luz = fontesLuz.map(f => { const c = calc(f, false); return { f, poly: c.poly, fresca: c.fresca }; });
        PERF.fogPolys = { visao, luz };
        PERF.fogKey = key;
        T.visiveisAgora = visao;
        T._litPolys = dia ? 'dia' : luz.map(e => e.poly);
        // Memória de exploração (público): registra células vistas. Só as
        // visões recalculadas — as paradas já registraram as suas. Exceção:
        // luz mudou (acendeu/moveu) → célula antes escura pode ter ficado
        // visível dentro de uma visão parada, então revarre todas.
        if (T.mode === 'public') {
            const luzMudou = !dia && luz.some(e => e.fresca);
            registrarExploracaoCelulas(luzMudou ? visao : visao.filter(e => e.fresca), T._litPolys);
        }
    });
    if (!PERF.fogPolys) return;

    const { visao, luz } = PERF.fogPolys;
    // Só fonte animada QUE APARECE NO ENQUADRAMENTO conta: uma fora da tela não
    // muda um pixel (o cortarPoly a descarta pelo mesmo culling) e mesmo assim
    // mantinha a cena inteira redesenhando a 60fps em todos os clientes.
    _fontesAnim = [...fontesVisao, ...fontesLuz]
        .filter(f => f.animacao && f.animacao !== 'nenhuma' && !foraDaTela(f));
    T._luzAnimada = _fontesAnim.length > 0;

    // ===== FOG COMPOSTO EM CACHE =====
    // Compor o fog custa três passes de tela cheia por quadro (limpar, pintar,
    // rasterizar a exploração, cortar os polígonos) e isso rodava a CADA frame,
    // mesmo com os polígonos já em cache — era o peso do arrasto no celular.
    // Entre um passo da visão e outro, com a câmera parada, o resultado é idêntico
    // pixel a pixel: então basta reaproveitar o canvas e blitar.
    // Luz animada entra pela ASSINATURA quantizada: recompõe só quando o fator
    // de animação dá um passo visível, em vez de anular o cache por inteiro.
    const chaveComposta = [
        PERF.fogKey, cv.width, cv.height, op, escopo, dia ? 'd' : 'n',
        T.cam.x.toFixed(1), T.cam.y.toFixed(1), T.cam.z.toFixed(4),
        T.mode === 'public' ? versaoExploracao() : 0,
        assinaturaAnim(),
    ].join('|');
    if (chaveComposta === _fogComposto) {
        medir('fog.blit', () => aplicarFogNaTela(luz));
        return;
    }
    _fogComposto = chaveComposta;
    medir('fog.compor', () => comporFog(visao, luz, pol, op));
}

/** Recompõe o fog no fogCv (3 passes de tela cheia) e aplica na tela. */
function comporFog(visao, luz, pol, op) {
    // 1) base preta
    // De DIA não existe escuridão, mas parede continua tapando a vista: o véu
    // leve é só para o MESTRE enxergar o alcance das visões na tela dele. Para o
    // jogador, o que está fora da linha de visão fica oculto de verdade — antes
    // o público simplesmente pulava o fog de dia e via o mapa inteiro.
    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.clearRect(0, 0, fogCv.width, fogCv.height);
    fogCtx.fillStyle = `rgba(2,4,10,${pol.veuLeve ? Math.min(op, 0.35) : op})`;
    fogCtx.fillRect(0, 0, fogCv.width, fogCv.height);

    // 2) memória explorada (recorte parcial) — só faz sentido no público
    // (o "dpr" dos canvases de fog embute a meia resolução; o aplicarCamera
    // trabalha em px de CSS e vale igual para qualquer densidade)
    const dprFog = dpr * FOG_ESCALA;
    fogCtx.setTransform(dprFog, 0, 0, dprFog, 0, 0);
    aplicarCamera(fogCtx, T.cam);
    if (T.mode === 'public') {
        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.fillStyle = 'rgba(0,0,0,0.55)';
        desenharExploracao(fogCtx, viewRect);
        fogCtx.globalCompositeOperation = 'source-over';
    }

    // 3) visível agora (recorte total)
    if (pol.recortaLuzes) {
        // Mestre: recorte direto por fonte (visões + luzes), com gradiente e flicker
        fogCtx.globalCompositeOperation = 'destination-out';
        for (const e of [...visao, ...luz]) cortarPoly(fogCtx, e.f, e.poly);
        fogCtx.globalCompositeOperation = 'source-over';
    } else {
        // Jogador: LoS ∩ luz p/ sensores que precisam de luz; sensores autônomos direto.
        // De dia todas as visões entram como autônomas (precisaLuz = false), então
        // o recorte sai por linha de visão pura — sem exigir luz nenhuma.
        const precisam = visao.filter(e => e.precisaLuz);
        const autonomos = visao.filter(e => !e.precisaLuz);
        if (precisam.length) {
            // union(LoS) na máscara principal
            maskCtx.setTransform(1, 0, 0, 1, 0, 0);
            maskCtx.clearRect(0, 0, maskCv.width, maskCv.height);
            maskCtx.setTransform(dprFog, 0, 0, dprFog, 0, 0);
            aplicarCamera(maskCtx, T.cam);
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.fillStyle = '#fff';
            for (const e of precisam) fillPoly(maskCtx, e.poly);

            // union(luz) num canvas SEPARADO. Aplicar 'destination-in' luz a
            // luz aqui daria LoS ∩ luz1 ∩ luz2 ∩ … — interseção, não união:
            // com duas luzes que não se tocam o resultado é vazio e o jogador
            // vê tudo preto por mais luzes que o mestre acenda.
            luzCtx.setTransform(1, 0, 0, 1, 0, 0);
            luzCtx.clearRect(0, 0, luzCv.width, luzCv.height);
            luzCtx.setTransform(dprFog, 0, 0, dprFog, 0, 0);
            aplicarCamera(luzCtx, T.cam);
            luzCtx.globalCompositeOperation = 'source-over';
            for (const e of luz) cortarPoly(luzCtx, e.f, e.poly, true);

            // agora sim: union(LoS) ∩ union(luz), numa única operação
            maskCtx.setTransform(1, 0, 0, 1, 0, 0);
            maskCtx.globalCompositeOperation = 'destination-in';
            maskCtx.drawImage(luzCv, 0, 0);
            maskCtx.globalCompositeOperation = 'source-over';

            fogCtx.setTransform(1, 0, 0, 1, 0, 0);
            fogCtx.globalCompositeOperation = 'destination-out';
            fogCtx.drawImage(maskCv, 0, 0);
            fogCtx.setTransform(dprFog, 0, 0, dprFog, 0, 0);
            aplicarCamera(fogCtx, T.cam);
        }
        fogCtx.globalCompositeOperation = 'destination-out';
        for (const e of autonomos) cortarPoly(fogCtx, e.f, e.poly);
        fogCtx.globalCompositeOperation = 'source-over';
    }

    aplicarFogNaTela(luz);
}

/** Passa o fog já composto para a tela e acende o brilho das luzes coloridas. */
function aplicarFogNaTela(luz) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fogCv, 0, 0, cv.width, cv.height);   // estica a meia resolução
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    aplicarCamera(ctx, T.cam);
    desenharLuzesColoridasWorld(luz);
    ctx.restore();
}

/**
 * Avisos de fog — só o mestre vê. Os dois estados abaixo são legítimos pelas
 * regras, mas indiagnosticáveis da cadeira do mestre, porque a tela DELE mostra
 * fog translúcido nas duas situações:
 *   'escuro'  → noite sem nenhuma luz acesa: o jogador vê tudo PRETO.
 *   'semFog'  → o jogador vê o mapa TODO apesar do cenário de fog montado
 *               (modo ☀️ Dia não aplica fog no público, e luz desligada também não).
 */
let _avisoAtual = null;
function avisoFog(estado) {
    if (T.mode !== 'secret') return;
    if (estado === _avisoAtual) return;
    _avisoAtual = estado;
    const antigo = document.getElementById('tbAvisoLuz');
    if (antigo) antigo.remove();
    if (!estado) return;
    const el = document.createElement('div');
    el.id = 'tbAvisoLuz';
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;' +
        'background:rgba(139,30,45,.94);color:#fff;padding:8px 14px;border-radius:8px;font-size:.8rem;' +
        'cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);max-width:min(92vw,560px);text-align:center';
    el.innerHTML = estado === 'escuro'
        ? '🌙 <b>Noite sem nenhuma luz acesa</b> — jogadores com visão padrão estão vendo tudo PRETO. ' +
          'Acenda uma luz, dê visão noturna ao token ou mude para ☀️ Dia. <u>Abrir configuração</u>'
        : '👁️ <b>Os jogadores estão vendo o mapa TODO</b> — este canvas tem paredes de visão montadas, mas a ' +
          'iluminação dinâmica está DESLIGADA, então nenhum fog é aplicado no público. <u>Abrir configuração</u>';
    el.onclick = () => { if (typeof window.tbAbrirConfig === 'function') window.tbAbrirConfig(); };
    document.body.appendChild(el);
}

/** Existe cenário de fog montado neste canvas? (paredes, portas ou janelas na camada de luz) */
function temCenarioDeFog() {
    for (const o of T.objects.values()) {
        if (o.layerId !== 'luz') continue;
        if (o.tipo === 'desenho' || o.tipo === 'porta' || o.tipo === 'janela') return true;
    }
    return false;
}

function algumTokenPrecisaDeLuz() {
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char' || !o.visao?.ativa) continue;
        const s = o.visao.tipo || 'padrao';
        if (s === 'padrao' || s === 'verInvisivel') return true;
    }
    return false;
}

function desenharLuzesColoridasWorld(luz) {
    for (const e of luz) {
        const f = e.f;
        if (!f.cor || f.cor === '#ffdd99' || !e.poly?.length) continue;
        const fator = fatorAnim(f.animacao, f.intensidadeAnim);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 * fator;
        const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
        g.addColorStop(0, f.cor);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        fillPoly(ctx, e.poly);
        ctx.restore();
    }
}

function fillPoly(c, poly) {
    if (!poly?.length) return;
    c.beginPath();
    c.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y);
    c.closePath();
    c.fill();
}

/** A fonte (círculo x,y,r) está inteiramente fora do enquadramento? */
function foraDaTela(f) {
    return f.x + f.r < viewRect.x0 || f.x - f.r > viewRect.x1 ||
           f.y + f.r < viewRect.y0 || f.y - f.r > viewRect.y1;
}

/**
 * Assinatura das animações de luz visíveis, com o fator quantizado em passos
 * de 0.04. É o que decide "este quadro é igual ao anterior?" — tanto no loop
 * (pular o redesenho) quanto na chave do fog composto (pular a recomposição).
 * O passo é invisível num flicker e transforma estrobo/pulso, que passam a
 * maior parte do tempo parados num degrau, em quase-repouso.
 */
function assinaturaAnim() {
    let s = '';
    for (const f of _fontesAnim) s += Math.round(fatorAnim(f.animacao, f.intensidadeAnim) * 25) + ',';
    return s;
}

function cortarPoly(c, f, poly, semGradiente) {
    if (!poly?.length) return;
    if (foraDaTela(f)) return;   // culling
    const fator = fatorAnim(f.animacao, f.intensidadeAnim);
    if (semGradiente) {
        c.fillStyle = `rgba(0,0,0,${Math.min(1, fator)})`;
    } else {
        const g = c.createRadialGradient(f.x, f.y, Math.max(1, f.r * 0.55 * fator), f.x, f.y, f.r * Math.min(1, 0.9 + 0.1 * fator));
        g.addColorStop(0, `rgba(0,0,0,${Math.min(1, fator)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
    }
    fillPoly(c, poly);
}

/** Fator de animação de luz (F3.4): tocha, pulso, estroboscópica. */
function fatorAnim(tipo, intensidade = 0.5) {
    if (!tipo || tipo === 'nenhuma') return 1;
    const t = Date.now() / 1000;
    if (tipo === 'tocha') return 1 - intensidade * 0.35 * (0.5 + 0.35 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23.7));
    if (tipo === 'pulso') return 1 - intensidade * 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2));
    if (tipo === 'estrobo') return (Math.floor(t * 6) % 2 === 0) ? 1 : 0.25;
    return 1;
}

function coletarParedes() {
    const segs = [];
    for (const o of T.objects.values()) {
        if (o.layerId !== 'luz') continue;
        const elev = o.elev || 0;
        if (o.tipo === 'porta') { if (!o.aberta && o.pontos?.length >= 2) segs.push({ a: o.pontos[0], b: o.pontos[1], elev }); continue; }
        if (o.tipo === 'janela') continue; // não bloqueia luz
        if (o.tipo === 'desenho') {
            const pts = o.pontos || [];
            if (o.forma === 'ret' && pts.length >= 2) {
                const p = pts[0], q = pts[pts.length-1];
                const c = [{x:p.x,y:p.y},{x:q.x,y:p.y},{x:q.x,y:q.y},{x:p.x,y:q.y}];
                for (let i=0;i<4;i++) segs.push({ a: c[i], b: c[(i+1)%4], elev });
            } else {
                for (let i=0;i<pts.length-1;i++) segs.push({ a: pts[i], b: pts[i+1], elev });
            }
        }
    }
    return segs;
}

/** VDs da ficha vinculada ao token (null para NPC/custom). */
export function derivedDoToken(o) {
    if (o?.vinculo?.tipo !== 'char') return null;
    return T.chars.find(c => c.id === o.vinculo.id)?.derivedTotals || null;
}

function coletarFontesDeVisao(escopo) {
    const fontes = [];
    const dia = T.canvas?.luzDinamica?.modo === 'dia';
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || !o.visao?.ativa) continue;
        if (escopo === 'jogador') {
            const meu = (T._meusTokens || []).some(t => t.id === o.id);
            if (!meu) {
                // fallback: sem token próprio (espectador) vê pela visão do GRUPO —
                // só tokens de personagem: pela visão do NPC era o vazamento da TV
                if ((T._meusTokens || []).length) continue;
                if (o.vinculo?.tipo !== 'char' || !objVisivel(o)) continue;
            }
        } else {
            if (T.mode === 'public' && !objVisivel(o)) continue;
        }
        const p = posConfirmada(o);
        fontes.push({
            x: p.x, y: p.y,
            r: unidadesParaPx(alcanceDeVisaoDoToken(o, derivedDoToken(o), dia), p),
            ang: o.visao.angulo, dir: rotParaCanvas(o.rot),
            sensor: o.visao.tipo || 'padrao', elev: o.elev || 0,
        });
    }
    return fontes;
}

function coletarFontesDeLuz() {
    const fontes = [];
    for (const o of T.objects.values()) {
        if (o.tipo === 'luz') {
            if (o.apagada) continue;
            const ok = T.mode === 'public' ? (o.visivelPublico !== false) : true;
            if (ok) fontes.push({ x: o.x, y: o.y, r: unidadesParaPx(o.alcance || 6, o), cor: o.cor, animacao: o.animacao, intensidadeAnim: o.intensidadeAnim, elev: o.elev || 0 });
        }
        if (o.tipo === 'token' && o.luz?.ativa) {
            if (T.mode === 'public' && !objVisivel(o)) continue;
            const p = posConfirmada(o);
            fontes.push({
                x: p.x, y: p.y, r: unidadesParaPx(o.luz.alcance || 3, p),
                ang: o.luz.angulo && o.luz.angulo < 360 ? o.luz.angulo : undefined,
                dir: rotParaCanvas(o.rot),
                cor: o.luz.cor, animacao: o.luz.animacao, intensidadeAnim: o.luz.intensidadeAnim,
                elev: o.elev || 0,
            });
        }
    }
    return fontes;
}

// ===== RAYCASTING (F1 + elevação F3.6) =====
const ARC_PASSO = Math.PI / 15;

function visibilityPolygon(src, hash, ignoraParedes, alturaAndar) {
    const { x, y, r } = src;
    let near = ignoraParedes ? [] : paredesProximas(hash, x, y, r)
        .filter(s => mesmaFaixaElev(s.elev || 0, src.elev || 0, alturaAndar))
        .filter(s => distSegPt(s.a, s.b, src) <= r + 2);
    const temCone = !!(src.ang && src.ang < 360);
    const dir = (src.dir || 0) * Math.PI / 180;
    const meia = temCone ? (src.ang * Math.PI / 180) / 2 : Math.PI;

    if (!near.length) return arcoPuro(x, y, r, temCone, dir, meia);

    const EPS = 0.00001;
    const angs = [];
    for (const s of near) for (const p of pontosCandidatos(s, x, y, r)) {
        const a = Math.atan2(p.y - y, p.x - x);
        if (temCone) {
            const rel = norm(a - dir);
            if (Math.abs(rel) > meia + EPS) continue;
            angs.push(rel - EPS, rel, rel + EPS);
        } else {
            angs.push(a - EPS, a, a + EPS);
        }
    }
    if (temCone) { angs.push(-meia, meia); }
    if (!angs.length) return arcoPuro(x, y, r, temCone, dir, meia);

    const hits = [];
    for (const rel of angs) {
        const a = temCone ? dir + rel : rel;
        const dx = Math.cos(a), dy = Math.sin(a);
        let t = r, hit = false;
        for (const s of near) {
            const h = rayVsSeg(x, y, dx, dy, s.a, s.b);
            if (h != null && h < t) { t = h; hit = true; }
        }
        hits.push({ rel: temCone ? rel : norm(a), t, hit });
    }
    hits.sort((p, q) => p.rel - q.rel);

    const poly = [];
    const abs = rel => temCone ? dir + rel : rel;
    const n = hits.length;
    for (let i = 0; i < n; i++) {
        const h = hits[i];
        poly.push(pt(abs(h.rel), h.t));
        const ultimo = i === n - 1;
        if (temCone && ultimo) break;
        const prox = hits[ultimo ? 0 : i + 1];
        let gap = (ultimo ? prox.rel + 2 * Math.PI : prox.rel) - h.rel;
        if (gap > ARC_PASSO && !h.hit && !prox.hit && h.t >= r - 0.5 && prox.t >= r - 0.5) {
            for (let a = h.rel + ARC_PASSO; a < h.rel + gap - 1e-9; a += ARC_PASSO) {
                poly.push(pt(abs(a), r));
            }
        }
    }
    if (temCone) poly.unshift({ x, y });
    return poly;

    function pt(a, t) { return { x: x + Math.cos(a) * t, y: y + Math.sin(a) * t }; }
}

function pontosCandidatos(s, x, y, r) {
    const pts = [];
    const r2 = r * r;
    if ((s.a.x-x)**2 + (s.a.y-y)**2 <= r2) pts.push(s.a);
    if ((s.b.x-x)**2 + (s.b.y-y)**2 <= r2) pts.push(s.b);
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const fx = s.a.x - x, fy = s.a.y - y;
    const a = dx*dx + dy*dy;
    if (a > 1e-12) {
        const b = 2 * (fx*dx + fy*dy);
        const c = fx*fx + fy*fy - r2;
        const disc = b*b - 4*a*c;
        if (disc > 0) {
            const sq = Math.sqrt(disc);
            const t1 = (-b - sq) / (2*a), t2 = (-b + sq) / (2*a);
            if (t1 > 0 && t1 < 1) pts.push({ x: s.a.x + dx*t1, y: s.a.y + dy*t1 });
            if (t2 > 0 && t2 < 1) pts.push({ x: s.a.x + dx*t2, y: s.a.y + dy*t2 });
        }
    }
    return pts;
}

function arcoPuro(x, y, r, temCone, dir, meia) {
    const poly = [];
    const ini = temCone ? dir - meia : -Math.PI;
    const fim = temCone ? dir + meia : Math.PI;
    for (let a = ini; a <= fim + 1e-9; a += ARC_PASSO) {
        poly.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    if (temCone) poly.unshift({ x, y });
    return poly;
}

function norm(a) { while (a < -Math.PI) a += Math.PI*2; while (a > Math.PI) a -= Math.PI*2; return a; }

function rayVsSeg(px, py, dx, dy, a, b) {
    const sx = b.x - a.x, sy = b.y - a.y;
    const den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((a.x - px) * sy - (a.y - py) * sx) / den;
    const u = ((a.x - px) * dy - (a.y - py) * dx) / den;
    if (t >= 0 && u >= 0 && u <= 1) return t;
    return null;
}
function distSegPt(a, b, p) {
    const l2 = (b.x-a.x)**2 + (b.y-a.y)**2;
    if (!l2) return Math.hypot(p.x-a.x, p.y-a.y);
    let t = ((p.x-a.x)*(b.x-a.x) + (p.y-a.y)*(b.y-a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t*(b.x-a.x)), p.y - (a.y + t*(b.y-a.y)));
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
}
function hexA(hex, a) {
    const n = parseInt((hex || '#ffffff').replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/** Paredes que bloqueiam MOVIMENTO (janelas e portas fechadas; abertas passam). F4.6 */
export function paredesDeMovimento(elevToken) {
    const alturaAndar = T.canvas?.andarAltura || 5;
    const segs = [];
    for (const o of T.objects.values()) {
        if (o.layerId !== 'luz') continue;
        const elev = o.elev || 0;
        if (!mesmaFaixaElev(elev, elevToken || 0, alturaAndar)) continue;
        if (o.tipo === 'porta') { if (!o.aberta && o.pontos?.length >= 2) segs.push({ a: o.pontos[0], b: o.pontos[1] }); continue; }
        if (o.tipo === 'janela') { if (!o.aberta && o.pontos?.length >= 2) segs.push({ a: o.pontos[0], b: o.pontos[1] }); continue; }
        if (o.tipo === 'desenho') {
            const pts = o.pontos || [];
            if (o.forma === 'ret' && pts.length >= 2) {
                const p = pts[0], q = pts[pts.length-1];
                const c = [{x:p.x,y:p.y},{x:q.x,y:p.y},{x:q.x,y:q.y},{x:p.x,y:q.y}];
                for (let i=0;i<4;i++) segs.push({ a: c[i], b: c[(i+1)%4] });
            } else {
                for (let i=0;i<pts.length-1;i++) segs.push({ a: pts[i], b: pts[i+1] });
            }
        }
    }
    return segs;
}
