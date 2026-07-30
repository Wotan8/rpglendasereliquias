// =============================================
// TABULEIRO — Grid & Medição (FASE 4)
// Grid quadrada / hexagonal (pointy/flat) / sem grid,
// regras de diagonal, custo de trajeto (terreno difícil),
// colisão de movimento e detecção automática de grade.
// Módulo "folha", sem DOM (exceto detectarGradeDeImagem) — testável em Node.
// =============================================

// ---------- HEX (coordenadas axiais) ----------
// pointy-top: largura √3·s, altura 2s · flat-top: largura 2s, altura √3·s
// s (tamanho do hex) = gridSize/2 para manter células na mesma ordem de grandeza.
const SQ3 = Math.sqrt(3);

export function hexSize(gs) { return gs / 2; }

export function pixelParaAxial(p, gs, tipo) {
    const s = hexSize(gs);
    if (tipo === 'hexF') {
        return { q: (2 / 3 * p.x) / s, r: (-1 / 3 * p.x + SQ3 / 3 * p.y) / s };
    }
    // pointy (hexP)
    return { q: (SQ3 / 3 * p.x - 1 / 3 * p.y) / s, r: (2 / 3 * p.y) / s };
}

export function axialParaPixel(h, gs, tipo) {
    const s = hexSize(gs);
    if (tipo === 'hexF') {
        return { x: s * (3 / 2 * h.q), y: s * (SQ3 / 2 * h.q + SQ3 * h.r) };
    }
    return { x: s * (SQ3 * h.q + SQ3 / 2 * h.r), y: s * (3 / 2 * h.r) };
}

export function axialRound(h) {
    let x = h.q, z = h.r, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
}

/** Distância hexagonal (métrica axial), aceita coordenadas fracionárias. */
export function distAxial(a, b) {
    const dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// ---------- SNAP ----------
/**
 * Encaixa um ponto no grid conforme o tipo e o modo.
 * @param p ponto de mundo
 * @param cfg { gs, tipo: 'quad'|'hexP'|'hexF'|'none' }
 * @param modo 'centro' | 'canto' | 'livre'
 */
export function snapPonto(p, cfg, modo = 'centro') {
    const { gs, tipo } = cfg;
    if (modo === 'livre' || tipo === 'none') return { x: p.x, y: p.y };
    if (tipo === 'hexP' || tipo === 'hexF') {
        const h = axialRound(pixelParaAxial(p, gs, tipo));
        return axialParaPixel(h, gs, tipo); // hex: sempre no centro
    }
    if (modo === 'canto') return { x: Math.round(p.x / gs) * gs, y: Math.round(p.y / gs) * gs };
    return { x: Math.floor(p.x / gs) * gs + gs / 2, y: Math.floor(p.y / gs) * gs + gs / 2 };
}

// ---------- DISTÂNCIA EM CÉLULAS ----------
/**
 * Distância entre dois pontos em CÉLULAS conforme o grid/diagonal.
 * @param cfg { gs, tipo, diagonal: 'eucl'|'cheb'|'alt' }
 */
export function distCelulas(a, b, cfg) {
    const { gs, tipo, diagonal } = cfg;
    if (tipo === 'hexP' || tipo === 'hexF') {
        return distAxial(pixelParaAxial(a, gs, tipo), pixelParaAxial(b, gs, tipo));
    }
    const dx = Math.abs(b.x - a.x) / gs, dy = Math.abs(b.y - a.y) / gs;
    if (tipo === 'none' || diagonal === 'eucl' || !diagonal) return Math.hypot(dx, dy);
    if (diagonal === 'cheb') return Math.max(dx, dy);           // 5-5-5
    // 'alt' (5-10-5): diagonais alternam custo 1 e 2 → média 1.5
    return Math.max(dx, dy) + Math.min(dx, dy) * 0.5;
}

// ---------- POLÍGONOS / TERRENO DIFÍCIL ----------
export function pontoEmPoligono(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) &&
            p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
}

function multTerreno(p, terrenos) {
    let m = 1;
    for (const t of terrenos || []) {
        if (t.pontos?.length >= 3 && pontoEmPoligono(p, t.pontos)) m = Math.max(m, t.mult || 2);
    }
    return m;
}

/**
 * Mede um trajeto (lista de pontos) com regra de grid, escala e terreno difícil.
 * @param pontos lista de pontos de mundo
 * @param cfg {
 *   gs, tipo, diagonal,
 *   upc: (ponto) => unidades por célula naquele ponto (escala do mapa/canvas),
 *   unidade: string,
 *   terrenos: [{ pontos, mult }]
 * }
 * @returns { celulas, valor, unidade }
 */
export function medirTrajeto(pontos, cfg) {
    if (!pontos || pontos.length < 2) return { celulas: 0, valor: 0, unidade: cfg.unidade };
    let celulas = 0, valor = 0;
    const passoPx = cfg.gs / 2; // amostragem: meia célula
    for (let i = 1; i < pontos.length; i++) {
        const a = pontos[i - 1], b = pontos[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.ceil(len / passoPx));
        for (let k = 0; k < n; k++) {
            const p0 = { x: a.x + (b.x - a.x) * (k / n),     y: a.y + (b.y - a.y) * (k / n) };
            const p1 = { x: a.x + (b.x - a.x) * ((k + 1) / n), y: a.y + (b.y - a.y) * ((k + 1) / n) };
            const meio = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
            const c = distCelulas(p0, p1, cfg) * multTerreno(meio, cfg.terrenos);
            celulas += c;
            valor += c * (cfg.upc ? cfg.upc(meio) : 1);
        }
    }
    return { celulas, valor, unidade: cfg.unidade };
}

// ---------- COLISÃO DE MOVIMENTO ----------
function orient(a, b, c) {
    const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    return Math.abs(v) < 1e-9 ? 0 : (v > 0 ? 1 : 2);
}
function noSegmento(a, b, c) {
    return Math.min(a.x, b.x) - 1e-9 <= c.x && c.x <= Math.max(a.x, b.x) + 1e-9 &&
           Math.min(a.y, b.y) - 1e-9 <= c.y && c.y <= Math.max(a.y, b.y) + 1e-9;
}
export function segmentosCruzam(p1, p2, p3, p4) {
    const o1 = orient(p1, p2, p3), o2 = orient(p1, p2, p4);
    const o3 = orient(p3, p4, p1), o4 = orient(p3, p4, p2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && noSegmento(p1, p2, p3)) return true;
    if (o2 === 0 && noSegmento(p1, p2, p4)) return true;
    if (o3 === 0 && noSegmento(p3, p4, p1)) return true;
    if (o4 === 0 && noSegmento(p3, p4, p2)) return true;
    return false;
}

/**
 * Testa se um trajeto (lista de pontos) cruza alguma parede.
 * @param segs [{ a, b }] paredes já filtradas por elevação/porta aberta
 */
export function trajetoColide(pontos, segs) {
    for (let i = 1; i < pontos.length; i++) {
        for (const s of segs) {
            if (segmentosCruzam(pontos[i - 1], pontos[i], s.a, s.b)) return s;
        }
    }
    return null;
}

// ---------- ELEVAÇÃO ----------
/** Dois valores de elevação estão na mesma faixa (andar)? */
export function mesmaFaixaElev(e1, e2, alturaAndar = 5) {
    return Math.floor((e1 || 0) / alturaAndar) === Math.floor((e2 || 0) / alturaAndar);
}
export function faixaDe(elev, alturaAndar = 5) {
    return Math.floor((elev || 0) / alturaAndar);
}

// ---------- RETÂNGULO DE SELEÇÃO ----------
/** Dois cantos quaisquer → retângulo normalizado {x,y,w,h}. */
export function normalizarRet(a, b) {
    return {
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
    };
}

/** A bbox cabe INTEIRA dentro do retângulo? (contenção, não interseção — senão
 *  laçar dois tokens levaria o mapa de fundo junto). */
export function bboxDentroDoRet(b, r) {
    return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
}

// ---------- SIMPLIFICAÇÃO DE TRAÇADO (Ramer–Douglas–Peucker) ----------
function distPerp(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Reduz os vértices de um traçado livre preservando a forma (tolerância em px
 * de mundo). Um arrasto de rota gera um ponto a cada poucos px — sem isso a
 * rota de viagem incha o documento no Firestore à toa.
 */
export function simplificarPontos(pontos, tol) {
    if (!pontos || pontos.length <= 2) return pontos || [];
    let maxD = 0, idx = 0;
    const a = pontos[0], b = pontos[pontos.length - 1];
    for (let i = 1; i < pontos.length - 1; i++) {
        const d = distPerp(pontos[i], a, b);
        if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= tol) return [a, b];
    return simplificarPontos(pontos.slice(0, idx + 1), tol).slice(0, -1)
        .concat(simplificarPontos(pontos.slice(idx), tol));
}

// ---------- DETECÇÃO AUTOMÁTICA DE GRADE ----------
/**
 * Encontra o período dominante de um sinal 1D por autocorrelação normalizada.
 * (usado com a soma de gradientes por coluna/linha da imagem)
 * @returns { periodo, forca } ou null
 */
export function periodoDominante(sinal, minP = 24, maxP = 260) {
    const n = sinal.length;
    if (n < minP * 3) return null;
    const media = sinal.reduce((s, v) => s + v, 0) / n;
    const s = sinal.map(v => v - media);
    let var0 = 0;
    for (const v of s) var0 += v * v;
    if (var0 < 1e-9) return null;
    let melhor = null;
    for (let p = minP; p <= Math.min(maxP, Math.floor(n / 3)); p++) {
        let acc = 0;
        for (let i = 0; i + p < n; i++) acc += s[i] * s[i + p];
        const corr = acc / var0;
        if (!melhor || corr > melhor.forca) melhor = { periodo: p, forca: corr };
    }
    // refina: períodos múltiplos costumam ter picos; escolhe o menor pico forte
    if (melhor && melhor.forca > 0.15) {
        for (let d = 2; d <= 4; d++) {
            const sub = Math.round(melhor.periodo / d);
            if (sub < minP) break;
            let acc = 0;
            for (let i = 0; i + sub < n; i++) acc += s[i] * s[i + sub];
            if (acc / var0 > melhor.forca * 0.82) melhor = { periodo: sub, forca: acc / var0 };
        }
        return melhor;
    }
    return null;
}

/**
 * (Browser) Detecta o tamanho de célula de um mapa a partir do ARQUIVO local
 * (antes do upload — imagens do Storage são "tainted" e não podem ser lidas).
 * @param {File|Blob} file
 * @returns {Promise<{cell: number, forca: number}|null>}
 */
export async function detectarGradeDeArquivo(file) {
    try {
        const bmp = await createImageBitmap(file);
        const alvo = 900; // reduz p/ análise barata
        const esc = Math.min(1, alvo / Math.max(bmp.width, bmp.height));
        const w = Math.max(64, Math.round(bmp.width * esc));
        const h = Math.max(64, Math.round(bmp.height * esc));
        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const c = cvs.getContext('2d', { willReadFrequently: true });
        c.drawImage(bmp, 0, 0, w, h);
        const d = c.getImageData(0, 0, w, h).data;
        const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // gradiente horizontal somado por coluna / vertical somado por linha
        const cols = new Array(w).fill(0), rows = new Array(h).fill(0);
        for (let y = 1; y < h - 1; y += 2) {
            for (let x = 1; x < w - 1; x += 2) {
                const i = (y * w + x) * 4;
                cols[x] += Math.abs(lum(i + 4) - lum(i - 4));
                rows[y] += Math.abs(lum(i + w * 4) - lum(i - w * 4));
            }
        }
        const minP = Math.round(24 * esc) || 8;
        const pc = periodoDominante(cols, Math.max(8, minP), Math.round(300 * esc));
        const pr = periodoDominante(rows, Math.max(8, minP), Math.round(300 * esc));
        const cand = [pc, pr].filter(Boolean).sort((a, b) => b.forca - a.forca)[0];
        if (!cand) return null;
        return { cell: Math.round(cand.periodo / esc), forca: cand.forca, propW: bmp.width, propH: bmp.height };
    } catch (e) { return null; }
}
