// =============================================
// TABULEIRO — Performance (FASE 1)
// Versões de invalidação, mipmaps manuais e hash espacial de paredes.
// Módulo "folha": não importa outros módulos do tabuleiro.
// =============================================

export const PERF = {
    // Versões de invalidação (contadores monotônicos)
    mapVersion: 0,        // muda quando objetos da camada 'mapa' (ou grid/escala) mudam
    wallsVersion: 0,      // muda quando paredes/portas/janelas/pontos de luz mudam

    // Cache do fog (polígonos de visibilidade)
    fogKey: '',
    fogPolys: null,

    // Hash espacial de paredes (reconstruído quando wallsVersion muda)
    wallHash: null,
    wallHashVersion: -1,
};

/**
 * Notifica que um objeto mudou (criado, movido, editado ou excluído),
 * para invalidar apenas os caches afetados.
 */
export function notifyObjectChange(o) {
    if (!o) { PERF.mapVersion++; PERF.wallsVersion++; return; }
    if (o.layerId === 'mapa') PERF.mapVersion++;
    if (o.layerId === 'luz' || o.tipo === 'luz' || o.tipo === 'porta' || o.tipo === 'janela') {
        PERF.wallsVersion++;
    }
    // Tokens (fontes de visão/luz) não precisam de flag: a posição deles
    // entra na chave do cache do fog (fogKey) e invalida sozinha.
}

/** Notifica mudança de configuração do canvas (grid, escala, luz dinâmica, camadas). */
export function notifyCanvasConfigChange() {
    PERF.mapVersion++;
    PERF.wallsVersion++;
    PERF.fogKey = '';
}

// =============================================
// MIPMAPS MANUAIS
// Para mapas gigantes, desenhar o bitmap original em zoom-out é caro e
// gera aliasing. Geramos versões reduzidas (1/2, 1/4, 1/8, 1/16) uma única
// vez e escolhemos a melhor pela escala na tela.
// =============================================
const _mipCache = new WeakMap(); // HTMLImageElement -> [{ scale, cv }]
const MIP_AREA_MINIMA = 2_000_000; // só gera mips p/ imagens > 2MP

/**
 * Retorna o melhor bitmap (imagem original ou mip) para desenhar.
 * @param {HTMLImageElement} img imagem original carregada
 * @param {number} escalaTela pixels na tela por pixel da imagem (ex.: 0.2 = bem reduzida)
 */
export function melhorBitmap(img, escalaTela) {
    if (!img || escalaTela >= 0.5 || (img.width * img.height) < MIP_AREA_MINIMA) return img;
    let mips = _mipCache.get(img);
    if (!mips) { mips = gerarMips(img); _mipCache.set(img, mips); }
    let melhor = img;
    for (const m of mips) {
        if (m.scale >= escalaTela) melhor = m.cv; // menor mip que ainda não faz upscale
        else break;
    }
    return melhor;
}

function gerarMips(img) {
    const mips = [];
    let w = img.width, h = img.height, src = img, scale = 1;
    while (w > 512 && h > 512 && mips.length < 4) {
        w = Math.max(1, Math.round(w / 2));
        h = Math.max(1, Math.round(h / 2));
        scale /= 2;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(src, 0, 0, w, h);
        mips.push({ scale, cv });
        src = cv; // downscale em cascata (melhor qualidade que pular direto)
    }
    return mips;
}

// =============================================
// HASH ESPACIAL DE PAREDES
// Grade de células; cada célula guarda os índices dos segmentos que a
// atravessam (aproximado pelo bbox do segmento). Reduz drasticamente os
// testes raio×segmento no raycasting do fog.
// =============================================
const CELULA_HASH = 300; // px de mundo

export function construirHashParedes(segs, cell = CELULA_HASH) {
    // segs: [{ a:{x,y}, b:{x,y}, elev }]
    const map = new Map();
    segs.forEach((s, i) => {
        const x0 = Math.floor(Math.min(s.a.x, s.b.x) / cell);
        const x1 = Math.floor(Math.max(s.a.x, s.b.x) / cell);
        const y0 = Math.floor(Math.min(s.a.y, s.b.y) / cell);
        const y1 = Math.floor(Math.max(s.a.y, s.b.y) / cell);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = cx + ',' + cy;
                let arr = map.get(k);
                if (!arr) map.set(k, arr = []);
                arr.push(i);
            }
        }
    });
    return { map, segs, cell };
}

/** Retorna os segmentos possivelmente dentro do círculo (x, y, r). */
export function paredesProximas(hash, x, y, r) {
    if (!hash || !hash.segs.length) return [];
    const { map, segs, cell } = hash;
    const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
    const y0 = Math.floor((y - r) / cell), y1 = Math.floor((y + r) / cell);
    const idx = new Set();
    for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
            const arr = map.get(cx + ',' + cy);
            if (arr) for (const i of arr) idx.add(i);
        }
    }
    const out = [];
    idx.forEach(i => out.push(segs[i]));
    return out;
}
