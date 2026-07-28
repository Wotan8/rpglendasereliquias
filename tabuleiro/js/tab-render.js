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
import { T, gridSize, camadasVisiveis, objVisivel, markDirty, unidadesParaPx, esc, cfgGrid } from './tab-state.js';
import { PERF, melhorBitmap, construirHashParedes, paredesProximas } from './tab-perf.js';
import { snapPonto, axialParaPixel, axialRound, pixelParaAxial, mesmaFaixaElev, faixaDe, pontoEmPoligono } from './tab-grid.js';
import { desenharExploracao, registrarExploracaoCelulas, tokenVisivelParaMim, carregarExploracao } from './tab-fog.js';
import { cursoresParaDesenhar, pingsParaDesenhar, haPingsAtivos, avancarTweenCamera, cursoresAtivados } from './tab-presenca.js';
import { vitaisDoToken, barrasVisiveis, tokenAtivoDoCombate } from './tab-hud.js';
import { desenharClima, climaAtivo, alphaTelhado } from './tab-clima.js';
import { temCone, podeGirarToken } from './tab-girar.js';

let cv, ctx, fogCv, fogCtx, maskCv, maskCtx, luzCv, luzCtx;
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
    resize();
    window.addEventListener('resize', () => { resize(); markDirty(); });
    requestAnimationFrame(loop);
}

function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    fogCv.width = cv.width; fogCv.height = cv.height;
    maskCv.width = cv.width; maskCv.height = cv.height;
    luzCv.width = cv.width; luzCv.height = cv.height;
    mapCache.w = Math.round(cv.width * mapCache.pad);
    mapCache.h = Math.round(cv.height * mapCache.pad);
    mapCache.cv.width = mapCache.w; mapCache.cv.height = mapCache.h;
    mapCache.version = -1;
    aplicarSmoothing(ctx); aplicarSmoothing(fogCtx); aplicarSmoothing(mapCache.ctx); aplicarSmoothing(maskCtx);
}
function aplicarSmoothing(c) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }

function loop() {
    // Animações contínuas → força redraw
    if (avancarTweenCamera()) T.dirty = true;
    if (T.anims && T.anims.size) T.dirty = true;
    if (haPingsAtivos()) T.dirty = true;
    if (climaAtivo()) T.dirty = true;
    if (T._luzAnimada) T.dirty = true;
    if (T._pulsoCombate) T.dirty = true;
    if (T.dirty) { T.dirty = false; draw(); }
    requestAnimationFrame(loop);
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
    const e = 1 - Math.pow(1 - k, 3);
    return { x: a.x0 + (o.x - a.x0) * e, y: a.y0 + (o.y - a.y0) * e };
}

/** Posição CONFIRMADA para o fog (F2.3: nada de recalcular durante arrasto). */
function posConfirmada(o) {
    if (o.__dragging && o.__fogPos) return o.__fogPos;
    if (o.movendo) { if (!o.__fogPos) o.__fogPos = { x: o.x, y: o.y }; return o.__fogPos; }
    o.__fogPos = { x: o.x, y: o.y };
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
    T._meusTokens = meusTokens();
    T._alvos = coletarAlvosDeTemplates();
    T._tokenAtivo = tokenAtivoDoCombate();
    T._pulsoCombate = !!T._tokenAtivo;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);

    desenharBaseEstatica();

    ctx.save();
    aplicarCamera(ctx, T.cam);
    const camadas = camadasVisiveis();
    const abaixo = camadas.filter(c => c.tipo !== 'mapa' && (c.abaixoDaLuz !== false || c.tipo === 'tokens' || c.tipo === 'dm'));
    const acima = camadas.filter(c => c.tipo !== 'mapa' && !abaixo.includes(c) && c.tipo !== 'luz');
    for (const cam of abaixo) drawCamada(cam, viewRect);
    // Público: o cenário interativo (porta/janela/luz) vai ANTES do fog — o jogador
    // só enxerga a porta que está no campo de visão dele. (No secreto, depois.)
    const camLuz = camadas.find(c => c.tipo === 'luz');
    if (camLuz && T.mode !== 'secret') drawCamada(camLuz, viewRect);
    ctx.restore();

    drawFog();

    ctx.save();
    aplicarCamera(ctx, T.cam);
    for (const cam of acima) drawCamada(cam, viewRect);
    if (camLuz && T.mode === 'secret') drawCamada(camLuz, viewRect);
    drawTelhados();
    drawSelecao();
    drawTemp();
    drawReguasRemotas();
    drawCursores();
    drawPings();
    ctx.restore();

    // Clima em espaço de tela
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenharClima(ctx, cv.width / dpr, cv.height / dpr);
}

function aplicarCamera(c, cam) {
    c.translate(cv.width / (2*dpr), cv.height / (2*dpr));
    c.scale(cam.z, cam.z);
    c.translate(-cam.x, -cam.y);
}

function meusTokens() {
    if (T.mode === 'secret' || T.isMaster) return [];
    const out = [];
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char') continue;
        const ch = T.chars.find(c => c.id === o.vinculo.id);
        if (ch?.ownerUid === T.user?.uid) out.push(o);
    }
    return out;
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
    if (o.invisivel) { ctx.globalAlpha *= (T.mode === 'secret' ? 0.5 : 0.65); }

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
    if (o.invisivel) ctx.setLineDash([hud(6), hud(5)]);
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
        if (v) drawBarras(pos, s, v);
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

function drawBarras(pos, s, v) {
    const w = Math.max(s, hud(44)), h = hud(4.5), gap = hud(1.5);
    const x = pos.x - w/2;
    let y = pos.y - s/2 - hud(8) - (h + gap) * 3;
    const barra = (cur, max, cor) => {
        ctx.fillStyle = 'rgba(10,14,22,.85)';
        roundRect(x - hud(1), y - hud(1), w + hud(2), h + hud(2), hud(2)); ctx.fill();
        const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
        ctx.fillStyle = cor;
        if (pct > 0) { roundRect(x, y, w * pct, h, hud(2)); ctx.fill(); }
        y += h + gap;
    };
    barra(v.hp, v.hpMax, '#34d399');
    barra(v.ener, v.enerMax, '#fbbf24');
    barra(v.san, v.sanMax, '#a78bfa');
}

function drawCondicoes(pos, s, conds) {
    const fs = hud(13);
    ctx.font = `${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const max = Math.min(conds.length, 6);
    for (let i = 0; i < max; i++) {
        const ang = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
        const cx = pos.x + Math.cos(ang) * (s/2 + hud(11));
        const cy = pos.y + Math.sin(ang) * (s/2 + hud(11));
        ctx.fillStyle = 'rgba(17,24,39,.9)';
        ctx.beginPath(); ctx.arc(cx, cy, fs * 0.72, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(conds[i].icone || '☠️', cx, cy + fs*0.05);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawLoot(o) {
    const gs = gridSize();
    const s = gs * 0.8;
    const img = getImg(o.url);
    ctx.save();
    ctx.fillStyle = 'rgba(120,53,15,.9)';
    roundRect(o.x - s/2, o.y - s/2, s, s, s*0.15); ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = hud(2); ctx.stroke();
    if (img) {
        ctx.save();
        roundRect(o.x - s/2 + 3, o.y - s/2 + 3, s - 6, s - 6, s*0.1); ctx.clip();
        ctx.drawImage(img, o.x - s/2 + 3, o.y - s/2 + 3, s - 6, s - 6);
        ctx.restore();
    } else {
        ctx.font = `${s*0.55}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('📦', o.x, o.y);
    }
    const fs = hud(11);
    ctx.font = `bold ${fs}px Arial`; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.lineWidth = hud(3); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(o.nome || 'Loot', o.x, o.y + s/2 + hud(3));
    ctx.fillStyle = '#fde68a'; ctx.fillText(o.nome || 'Loot', o.x, o.y + s/2 + hud(3));
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
    const fatias = o.fatias || 6, cheias = Math.min(o.cheias || 0, fatias);
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
    if (o.nome) {
        const fs = hud(13);
        ctx.font = `bold ${fs}px Arial`; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.lineWidth = hud(3); ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(o.nome, o.x, o.y + r + hud(4));
        ctx.fillStyle = '#f8fafc'; ctx.fillText(o.nome, o.x, o.y + r + hud(4));
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
    ctx.fillText('🚪', (p[0].x+p[1].x)/2, (p[0].y+p[1].y)/2); ctx.textAlign='left';
}
function drawJanela(o) {
    const p = o.pontos || []; if (p.length < 2) return;
    ctx.strokeStyle = o.aberta ? '#22c55e' : '#38bdf8'; ctx.lineWidth = Math.max(3, 4/T.cam.z);
    ctx.setLineDash(o.aberta ? [10, 12] : [4, 6]);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${14/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🪟', (p[0].x+p[1].x)/2, (p[0].y+p[1].y)/2); ctx.textAlign='left';
}

function drawSelecao() {
    syncLockBtn();
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
 * Token com visão/luz em CONE: mostra para onde ele olha e ensina a girar.
 * Sem isto o jogador não tem como descobrir que dá para mirar — e um cone
 * de 220° travado em 0° parece um bug de visão.
 */
function desenharBussola(o, b) {
    if (!temCone(o) || !podeGirarToken(o)) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const r = Math.max(b.w, b.h) / 2 + hud(10);
    const a = ((o.rot || 0) - 90) * Math.PI / 180;   // 0° = para cima

    ctx.save();
    ctx.strokeStyle = '#22d3ee'; ctx.fillStyle = '#22d3ee';
    ctx.lineWidth = hud(2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    // ponta da seta
    ctx.beginPath();
    for (const d of [0, 2.5, -2.5]) {
        const t = a + d;
        const raio = d === 0 ? r + hud(7) : r - hud(1);
        ctx.lineTo(cx + Math.cos(t) * raio, cy + Math.sin(t) * raio);
    }
    ctx.closePath(); ctx.fill();

    ctx.font = `${hud(11)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Q ↺  E ↻', cx, b.y + b.h + hud(4));
    ctx.restore();
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
        if (!r || u === T.user?.uid) continue;
        if (!r.t || agora - r.t > 6000) continue;
        drawLinhaMedida(r.pontos || [], r.cor || '#f472b6', r.label, r.nome);
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
    if (!l?.ativa) { T.visiveisAgora = null; T._litPolys = null; avisoEscuridao(false); return; }
    const dia = l.modo === 'dia';
    const op = T.mode === 'public' ? 1 : (l.fogSecretOpacity ?? 0.6);
    if (op <= 0 && T.mode === 'secret') { T.visiveisAgora = null; return; }

    if (PERF.wallHashVersion !== PERF.wallsVersion) {
        PERF.wallHash = construirHashParedes(coletarParedes());
        PERF.wallHashVersion = PERF.wallsVersion;
        PERF.fogKey = '';
    }

    const escopo = (T.mode === 'secret' || T.isMaster) ? 'mestre' : 'jogador';
    const fontesVisao = coletarFontesDeVisao(escopo);
    const fontesLuz = coletarFontesDeLuz();
    avisoEscuridao(!dia && fontesLuz.length === 0);
    const alturaAndar = T.canvas?.andarAltura || 5;

    const ser = f => `${f.x|0},${f.y|0},${f.r|0},${f.ang||360},${(f.dir||0)|0},${f.sensor||'p'},${faixaDe(f.elev||0, alturaAndar)}`;
    const key = PERF.wallsVersion + '|' + escopo + '|' + (dia?'d':'n') + '|' +
        fontesVisao.map(ser).join(';') + '#' + fontesLuz.map(ser).join(';');
    if (key !== PERF.fogKey || !PERF.fogPolys) {
        const calc = (f, ignoraParedes) => visibilityPolygon(f, PERF.wallHash, ignoraParedes, alturaAndar);
        const visao = fontesVisao.map(f => ({
            f, poly: calc(f, f.sensor === 'tremorsense' || f.sensor === 'verdadeira'),
            sensor: f.sensor || 'padrao',
            precisaLuz: !dia && (!f.sensor || f.sensor === 'padrao' || f.sensor === 'verInvisivel'),
        }));
        const luz = fontesLuz.map(f => ({ f, poly: calc(f, false) }));
        PERF.fogPolys = { visao, luz };
        PERF.fogKey = key;
        T.visiveisAgora = visao;
        T._litPolys = dia ? 'dia' : luz.map(e => e.poly);
        // Memória de exploração (público): registra células vistas
        if (T.mode === 'public') {
            registrarExploracaoCelulas(visao, T._litPolys);
        }
    }
    if (!PERF.fogPolys) return;

    const { visao, luz } = PERF.fogPolys;
    T._luzAnimada = fontesLuz.some(f => f.animacao && f.animacao !== 'nenhuma') ||
                    fontesVisao.some(f => f.animacao && f.animacao !== 'nenhuma');

    if (dia && T.mode === 'public') {
        // Dia: sem fog no público (mas luzes coloridas ainda brilham)
        desenharLuzesColoridas(luz);
        return;
    }

    // 1) base preta
    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.clearRect(0, 0, fogCv.width, fogCv.height);
    fogCtx.fillStyle = `rgba(2,4,10,${dia ? Math.min(op, 0.35) : op})`;
    fogCtx.fillRect(0, 0, fogCv.width, fogCv.height);

    // 2) memória explorada (recorte parcial) — só faz sentido no público
    fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    aplicarCamera(fogCtx, T.cam);
    if (T.mode === 'public') {
        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.fillStyle = 'rgba(0,0,0,0.55)';
        desenharExploracao(fogCtx, viewRect);
        fogCtx.globalCompositeOperation = 'source-over';
    }

    // 3) visível agora (recorte total)
    if (escopo === 'mestre' || dia) {
        // Mestre: recorte direto por fonte (visões + luzes), com gradiente e flicker
        fogCtx.globalCompositeOperation = 'destination-out';
        for (const e of [...visao, ...luz]) cortarPoly(fogCtx, e.f, e.poly);
        fogCtx.globalCompositeOperation = 'source-over';
    } else {
        // Jogador: LoS ∩ luz p/ sensores que precisam de luz; sensores autônomos direto
        const precisam = visao.filter(e => e.precisaLuz);
        const autonomos = visao.filter(e => !e.precisaLuz);
        if (precisam.length) {
            // union(LoS) na máscara principal
            maskCtx.setTransform(1, 0, 0, 1, 0, 0);
            maskCtx.clearRect(0, 0, maskCv.width, maskCv.height);
            maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            luzCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            aplicarCamera(fogCtx, T.cam);
        }
        fogCtx.globalCompositeOperation = 'destination-out';
        for (const e of autonomos) cortarPoly(fogCtx, e.f, e.poly);
        fogCtx.globalCompositeOperation = 'source-over';
    }

    // 4) aplica o fog
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fogCv, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 5) brilho de luzes coloridas
    ctx.save();
    aplicarCamera(ctx, T.cam);
    desenharLuzesColoridasWorld(luz);
    ctx.restore();
}

/**
 * Aviso de cegueira (só o mestre vê): luz dinâmica em NOITE sem nenhuma
 * fonte de luz acesa = jogadores com visão padrão veem o canvas 100% preto.
 * O estado é legítimo pelas regras (escuro é escuro), mas é indiagnosticável
 * da cadeira do mestre — a tela DELE mostra o fog translúcido.
 */
let _avisoLuzVisivel = false;
function avisoEscuridao(escuroSemLuz) {
    if (T.mode !== 'secret') return;
    const mostrar = !!escuroSemLuz && algumTokenPrecisaDeLuz();
    if (mostrar === _avisoLuzVisivel) return;
    _avisoLuzVisivel = mostrar;
    let el = document.getElementById('tbAvisoLuz');
    if (!mostrar) { if (el) el.remove(); return; }
    el = document.createElement('div');
    el.id = 'tbAvisoLuz';
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;' +
        'background:rgba(139,30,45,.94);color:#fff;padding:8px 14px;border-radius:8px;font-size:.8rem;' +
        'cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);max-width:min(92vw,560px);text-align:center';
    el.innerHTML = '🌙 <b>Noite sem nenhuma luz acesa</b> — jogadores com visão padrão estão vendo tudo PRETO. ' +
        'Acenda uma luz, dê visão noturna ao token ou mude para ☀️ Dia. <u>Abrir configuração</u>';
    el.onclick = () => { if (typeof window.tbAbrirConfig === 'function') window.tbAbrirConfig(); };
    document.body.appendChild(el);
}

function algumTokenPrecisaDeLuz() {
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || o.vinculo?.tipo !== 'char' || !o.visao?.ativa) continue;
        const s = o.visao.tipo || 'padrao';
        if (s === 'padrao' || s === 'verInvisivel') return true;
    }
    return false;
}

function desenharLuzesColoridas(luz) {
    ctx.save();
    aplicarCamera(ctx, T.cam);
    desenharLuzesColoridasWorld(luz);
    ctx.restore();
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

function cortarPoly(c, f, poly, semGradiente) {
    if (!poly?.length) return;
    // culling
    if (f.x + f.r < viewRect.x0 || f.x - f.r > viewRect.x1 || f.y + f.r < viewRect.y0 || f.y - f.r > viewRect.y1) return;
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

function coletarFontesDeVisao(escopo) {
    const fontes = [];
    for (const o of T.objects.values()) {
        if (o.tipo !== 'token' || !o.visao?.ativa) continue;
        if (escopo === 'jogador') {
            const meu = (T._meusTokens || []).some(t => t.id === o.id);
            if (!meu) {
                // fallback: jogador sem token próprio vê pela visão pública do grupo
                if ((T._meusTokens || []).length) continue;
                if (!objVisivel(o)) continue;
            }
        } else {
            if (T.mode === 'public' && !objVisivel(o)) continue;
        }
        const p = posConfirmada(o);
        fontes.push({
            x: p.x, y: p.y, r: unidadesParaPx(o.visao.alcance || 6, p),
            ang: o.visao.angulo, dir: o.rot || 0,
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
                dir: o.rot || 0,
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
