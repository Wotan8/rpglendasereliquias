// =============================================
// TABULEIRO — Motor de Renderização
// Canvas infinito + camadas + fog / iluminação dinâmica
// =============================================
import { T, gridSize, camadasVisiveis, objVisivel, markDirty, unidadesParaPx, esc, fmtDist } from './tab-state.js';

let cv, ctx, fogCv, fogCtx;
let dpr = 1;

export function startRenderLoop() {
    cv = document.getElementById('tbCanvas');
    ctx = cv.getContext('2d');
    fogCv = document.createElement('canvas');
    fogCtx = fogCv.getContext('2d');
    resize();
    window.addEventListener('resize', () => { resize(); markDirty(); });
    requestAnimationFrame(loop);
}

function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    fogCv.width = cv.width; fogCv.height = cv.height;
}

function loop() {
    if (T.dirty) { T.dirty = false; draw(); }
    requestAnimationFrame(loop);
}

// ===== Transformações =====
export function worldToScreen(p) { return { x: (p.x - T.cam.x) * T.cam.z + cv.width / (2 * dpr), y: (p.y - T.cam.y) * T.cam.z + cv.height / (2 * dpr) }; }
export function screenToWorld(p) { return { x: (p.x - cv.width / (2 * dpr)) / T.cam.z + T.cam.x, y: (p.y - cv.height / (2 * dpr)) / T.cam.z + T.cam.y }; }

export function centerCamera() {
    // Centraliza no conteúdo (prioriza mapas)
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

export function bboxOf(o) {
    const gs = gridSize();
    switch (o.tipo) {
        case 'imagem': case 'mostrar': return { x: o.x, y: o.y, w: o.w || 200, h: o.h || 200 };
        case 'texto': return medirTexto(o);
        case 'token': { const s = (o.tamanhoCelulas || 1) * gs; return { x: o.x - s/2, y: o.y - s/2, w: s, h: s }; }
        case 'alfinete': return { x: o.x - 14, y: o.y - 30, w: 28, h: 34 };
        case 'luz': return { x: o.x - 14, y: o.y - 14, w: 28, h: 28 };
        case 'desenho': case 'medida': case 'porta': case 'janela': {
            const pts = o.pontos || [];
            if (!pts.length) return { x: o.x||0, y: o.y||0, w: 10, h: 10 };
            let minX=1e12,minY=1e12,maxX=-1e12,maxY=-1e12;
            pts.forEach(p => { minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y); });
            const pad = (o.grossura||4) + 4;
            return { x: minX-pad, y: minY-pad, w: maxX-minX+pad*2, h: maxY-minY+pad*2 };
        }
        default: return { x: o.x||0, y: o.y||0, w: 50, h: 50 };
    }
}

function medirTexto(o) {
    const c = document.createElement('canvas').getContext('2d');
    c.font = fontOf(o);
    const linhas = String(o.texto || '').split('\n');
    let w = 10; linhas.forEach(l => w = Math.max(w, c.measureText(l).width));
    return { x: o.x, y: o.y, w, h: linhas.length * (o.tamanho || 28) * 1.25 };
}
function fontOf(o) { return `${o.italico?'italic ':''}${o.bold?'bold ':''}${o.tamanho||28}px ${o.fonte||'Arial'}`; }

export function getImg(url) {
    if (!url) return null;
    let e = T.imgCache.get(url);
    if (e) return e.ok ? e.img : null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    e = { img, ok: false };
    img.onload = () => { e.ok = true; markDirty(); };
    img.onerror = () => { e.ok = false; };
    img.src = url;
    T.imgCache.set(url, e);
    return null;
}

// ===== DRAW PRINCIPAL =====
function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);

    ctx.save();
    ctx.translate(cv.width / (2*dpr), cv.height / (2*dpr));
    ctx.scale(T.cam.z, T.cam.z);
    ctx.translate(-T.cam.x, -T.cam.y);

    if (T.canvas?.grid?.show !== false) drawGrid();

    const camadas = camadasVisiveis();
    const abaixo = camadas.filter(c => c.abaixoDaLuz !== false || c.tipo === 'mapa' || c.tipo === 'tokens' || c.tipo === 'dm');
    const acima = camadas.filter(c => !abaixo.includes(c) && c.tipo !== 'luz');

    for (const cam of abaixo) drawCamada(cam);
    ctx.restore();

    // FOG / Iluminação dinâmica
    drawFog();

    ctx.save();
    ctx.translate(cv.width / (2*dpr), cv.height / (2*dpr));
    ctx.scale(T.cam.z, T.cam.z);
    ctx.translate(-T.cam.x, -T.cam.y);

    for (const cam of acima) drawCamada(cam);
    // Camada luz (paredes/portas/pontos) — apenas no secreto
    if (T.mode === 'secret') {
        const luz = camadas.find(c => c.tipo === 'luz');
        if (luz) drawCamada(luz);
    }

    drawSelecao();
    drawTemp();
    drawReguasRemotas();
    ctx.restore();
}

function drawGrid() {
    const gs = gridSize();
    const tl = screenToWorld({ x: 0, y: 0 });
    const br = screenToWorld({ x: cv.width/dpr, y: cv.height/dpr });
    const x0 = Math.floor(tl.x / gs) * gs, y0 = Math.floor(tl.y / gs) * gs;
    ctx.strokeStyle = 'rgba(148,163,184,0.10)';
    ctx.lineWidth = 1 / T.cam.z;
    ctx.beginPath();
    for (let x = x0; x <= br.x; x += gs) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = y0; y <= br.y; y += gs) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();
}

function drawCamada(cam) {
    const objs = [...T.objects.values()]
        .filter(o => o.layerId === cam.id && objVisivel(o))
        .sort((a, b) => (a.z||0) - (b.z||0));
    for (const o of objs) drawObjeto(o, cam);
}

function drawObjeto(o, cam) {
    const secreto = T.mode === 'secret';
    const ocultoPub = o.visivelPublico === false || cam.visivelPublico === false || cam.tipo==='dm';
    ctx.save();
    if (secreto && ocultoPub && cam.tipo !== 'luz') ctx.globalAlpha = 0.45;
    switch (o.tipo) {
        case 'imagem': drawImagem(o); break;
        case 'mostrar': drawMostrar(o); break;
        case 'token': drawToken(o); break;
        case 'texto': drawTexto(o); break;
        case 'desenho': drawDesenho(o, cam); break;
        case 'medida': drawMedidaObj(o); break;
        case 'alfinete': drawAlfinete(o); break;
        case 'luz': if (secreto) drawLuzPonto(o); break;
        case 'porta': drawPorta(o); break;
        case 'janela': drawJanela(o); break;
    }
    ctx.restore();
}

function drawImagem(o) {
    const img = getImg(o.url);
    if (img) ctx.drawImage(img, o.x, o.y, o.w || img.width, o.h || img.height);
    else { ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(o.x, o.y, o.w||200, o.h||200); ctx.fillStyle='#94a3b8'; ctx.font='16px Arial'; ctx.fillText('carregando...', o.x+10, o.y+24); }
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

function drawToken(o) {
    const gs = gridSize();
    const s = (o.tamanhoCelulas || 1) * gs;
    const img = getImg(o.url);
    ctx.save();
    ctx.beginPath(); ctx.arc(o.x, o.y, s/2, 0, Math.PI*2); ctx.closePath();
    ctx.save(); ctx.clip();
    if (img) ctx.drawImage(img, o.x - s/2, o.y - s/2, s, s);
    else { ctx.fillStyle = '#1f2937'; ctx.fillRect(o.x - s/2, o.y - s/2, s, s); ctx.fillStyle = '#94a3b8'; ctx.font = `bold ${s*0.4}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((o.nome||'?')[0].toUpperCase(), o.x, o.y); }
    ctx.restore();
    const cor = o.vinculo?.tipo === 'char' ? '#22c55e' : o.vinculo?.tipo === 'npc' ? '#ef4444' : '#8b5cf6';
    ctx.lineWidth = Math.max(2, s * 0.045); ctx.strokeStyle = cor; ctx.stroke();
    if (o.mostrarNome !== false && o.nome) {
        ctx.font = `bold ${Math.max(12, gs*0.22)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(o.nome, o.x, o.y + s/2 + 4);
        ctx.fillStyle = '#f8fafc'; ctx.fillText(o.nome, o.x, o.y + s/2 + 4);
    }
    // Indicador de visão (secreto)
    if (T.mode === 'secret' && o.visao?.ativa) {
        ctx.beginPath(); ctx.arc(o.x, o.y, unidadesParaPx(o.visao.alcance || 6), 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(250,204,21,.25)'; ctx.setLineDash([6,6]); ctx.lineWidth = 1.5/T.cam.z; ctx.stroke(); ctx.setLineDash([]);
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
}

function drawMedidaObj(o) {
    drawLinhaMedida(o.pontos || [], o.cor || '#22d3ee', o.label);
}

export function drawLinhaMedida(pts, cor, label, labelSub) {
    if (pts.length < 2) return;
    ctx.strokeStyle = cor; ctx.lineWidth = Math.max(2.5, 3/T.cam.z); ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    pts.forEach((p,i) => { if (i===0||i===pts.length-1) return; ctx.beginPath(); ctx.arc(p.x,p.y,4/T.cam.z,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill(); });
    // seta
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
    const s = 16 / Math.max(0.35, Math.min(1.4, T.cam.z));
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = o.cor || '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -s, s*0.75, Math.PI*0.85, Math.PI*2.15);
    ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s, s*0.3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    if (o.titulo && T.cam.z > 0.4) {
        ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline='top';
        ctx.lineWidth = 3; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.strokeText(o.titulo, o.x, o.y + 4);
        ctx.fillStyle = '#fde68a'; ctx.fillText(o.titulo, o.x, o.y + 4);
        ctx.textAlign = 'left';
    }
}

function drawLuzPonto(o) {
    const r = unidadesParaPx(o.alcance || 6);
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(253,224,71,.3)'; ctx.setLineDash([8,8]); ctx.lineWidth = 1.5/T.cam.z; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${22/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('💡', o.x, o.y); ctx.textAlign='left';
}

function drawPorta(o) {
    const p = o.pontos || []; if (p.length < 2) return;
    ctx.strokeStyle = o.aberta ? '#22c55e' : '#eab308';
    ctx.lineWidth = Math.max(4, 5/T.cam.z);
    if (o.aberta) ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.setLineDash([]);
    const mx = (p[0].x+p[1].x)/2, my = (p[0].y+p[1].y)/2;
    ctx.font = `${18/T.cam.z}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🚪', mx, my); ctx.textAlign='left';
}
function drawJanela(o) {
    const p = o.pontos || []; if (p.length < 2) return;
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = Math.max(3, 4/T.cam.z);
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.setLineDash([]);
}

function drawSelecao() {
    if (!T.selection) return;
    const o = T.objects.get(T.selection); if (!o) return;
    const b = bboxOf(o);
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2/T.cam.z; ctx.setLineDash([6/T.cam.z, 4/T.cam.z]);
    ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
    // Handles de redimensionar (imagens/mostrar/texto por tamanho)
    if (['imagem','mostrar'].includes(o.tipo)) {
        for (const h of handlesOf(b)) {
            ctx.fillStyle = '#8b5cf6';
            ctx.fillRect(h.x - 6/T.cam.z, h.y - 6/T.cam.z, 12/T.cam.z, 12/T.cam.z);
        }
    }
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
    if (t.tipo === 'medida') drawLinhaMedida(t.pontos.concat(t.atual ? [t.atual] : []), '#22d3ee', t.label, t.labelSub);
    if (t.tipo === 'segmento' && t.pontos.length) {
        const fim = t.atual || t.pontos[0];
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4/T.cam.z;
        ctx.beginPath(); ctx.moveTo(t.pontos[0].x, t.pontos[0].y); ctx.lineTo(fim.x, fim.y); ctx.stroke();
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

// ===== FOG / ILUMINAÇÃO DINÂMICA =====
function drawFog() {
    const l = T.canvas?.luzDinamica;
    if (!l?.ativa || l.modo === 'dia') return;
    const op = T.mode === 'public' ? 1 : (l.fogSecretOpacity ?? 0.6);
    if (op <= 0) return;

    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.clearRect(0, 0, fogCv.width, fogCv.height);
    fogCtx.fillStyle = `rgba(2,4,10,${op})`;
    fogCtx.fillRect(0, 0, fogCv.width, fogCv.height);

    // transform mundo -> fog canvas (px reais)
    fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fogCtx.translate(cv.width/(2*dpr), cv.height/(2*dpr));
    fogCtx.scale(T.cam.z, T.cam.z);
    fogCtx.translate(-T.cam.x, -T.cam.y);
    fogCtx.globalCompositeOperation = 'destination-out';

    const walls = coletarParedes();
    const fontes = coletarFontesDeLuz();
    for (const f of fontes) {
        const poly = visibilityPolygon(f, walls);
        if (!poly.length) continue;
        const g = fogCtx.createRadialGradient(f.x, f.y, Math.max(1, f.r*0.55), f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        fogCtx.fillStyle = g;
        fogCtx.beginPath();
        fogCtx.moveTo(poly[0].x, poly[0].y);
        for (let i=1;i<poly.length;i++) fogCtx.lineTo(poly[i].x, poly[i].y);
        fogCtx.closePath(); fogCtx.fill();
    }
    fogCtx.globalCompositeOperation = 'source-over';

    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(fogCv, 0, 0);
    ctx.setTransform(dpr,0,0,dpr,0,0);
}

function coletarParedes() {
    const segs = [];
    for (const o of T.objects.values()) {
        if (o.layerId !== 'luz') continue;
        if (o.tipo === 'porta') { if (!o.aberta && o.pontos?.length >= 2) segs.push([o.pontos[0], o.pontos[1]]); continue; }
        if (o.tipo === 'janela') continue; // janela não bloqueia luz
        if (o.tipo === 'desenho') {
            const pts = o.pontos || [];
            if (o.forma === 'ret' && pts.length >= 2) {
                const a = pts[0], b = pts[pts.length-1];
                const c = [{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y},{x:a.x,y:b.y}];
                for (let i=0;i<4;i++) segs.push([c[i], c[(i+1)%4]]);
            } else {
                for (let i=0;i<pts.length-1;i++) segs.push([pts[i], pts[i+1]]);
            }
        }
    }
    return segs;
}

function coletarFontesDeLuz() {
    const fontes = [];
    for (const o of T.objects.values()) {
        if (o.tipo === 'luz') {
            const cam = T.mode === 'public' ? (o.visivelPublico !== false) : true;
            if (cam) fontes.push({ x: o.x, y: o.y, r: unidadesParaPx(o.alcance || 6) });
        }
        if (o.tipo === 'token') {
            if (T.mode === 'public' && !objVisivel(o)) continue;
            if (o.visao?.ativa) fontes.push({ x: o.x, y: o.y, r: unidadesParaPx(o.visao.alcance || 6), ang: o.visao.angulo, dir: o.rot || 0 });
            if (o.luz?.ativa) fontes.push({ x: o.x, y: o.y, r: unidadesParaPx(o.luz.alcance || 3) });
        }
    }
    return fontes;
}

/** Polígono de visibilidade por raycasting contra segmentos, limitado por raio (e cone opcional). */
function visibilityPolygon(src, segs) {
    const { x, y, r } = src;
    // Só considera segmentos próximos
    const near = segs.filter(s => distSegPt(s[0], s[1], src) <= r + 5);
    const angulos = [];
    const N = 48;
    for (let i = 0; i < N; i++) angulos.push((i / N) * Math.PI * 2);
    for (const s of near) for (const p of s) {
        const a = Math.atan2(p.y - y, p.x - x);
        angulos.push(a - 0.0004, a, a + 0.0004);
    }
    let temCone = src.ang && src.ang < 360;
    let a0 = 0, a1 = 0;
    if (temCone) {
        const dir = (src.dir || 0) * Math.PI / 180;
        a0 = dir - (src.ang * Math.PI / 180) / 2;
        a1 = dir + (src.ang * Math.PI / 180) / 2;
        angulos.push(a0, a1);
    }
    const pts = [];
    const norm = a => { while (a < -Math.PI) a += Math.PI*2; while (a > Math.PI) a -= Math.PI*2; return a; };
    for (const a of angulos) {
        if (temCone) {
            const rel = norm(a - (a0 + a1)/2);
            if (Math.abs(rel) > (a1 - a0)/2 + 0.001) continue;
        }
        const dx = Math.cos(a), dy = Math.sin(a);
        let t = r;
        for (const s of near) {
            const hit = rayVsSeg(x, y, dx, dy, s[0], s[1]);
            if (hit != null && hit < t) t = hit;
        }
        pts.push({ a, x: x + dx * t, y: y + dy * t });
    }
    pts.sort((p, q) => p.a - q.a);
    const poly = pts.map(p => ({ x: p.x, y: p.y }));
    if (temCone) poly.unshift({ x, y });
    return poly;
}

function rayVsSeg(px, py, dx, dy, a, b) {
    const rx = dx, ry = dy;
    const sx = b.x - a.x, sy = b.y - a.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((a.x - px) * sy - (a.y - py) * sx) / den;
    const u = ((a.x - px) * ry - (a.y - py) * rx) / den;
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
    const n = parseInt(hex.replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
