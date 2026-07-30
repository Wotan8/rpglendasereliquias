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
    // `tipo === 'imagem'` também conta: mover uma imagem PARA FORA da camada de
    // mapa precisa invalidar o cache de mapas, e nesse write o layerId já é o novo.
    if (o.layerId === 'mapa' || o.tipo === 'imagem') PERF.mapVersion++;
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
// MEMO POR VERSÃO — cache dos polígonos de visibilidade, UM POR FONTE
// Medido no __check-perf-arrasto: a chave única do fog fazia mover UM token
// recalcular o raycast das 14 fontes (~1ms no desktop, vários ms no celular),
// ~14x/s durante o arrasto. Com um memo por fonte, só a fonte que mudou
// recalcula; mudar de versão (paredes/portas/config) invalida tudo.
// =============================================
export function criarMemoPorVersao(max = 256) {
    let versaoAtual = -1;
    const cache = new Map();
    return {
        obter(chave, versao, calcular) {
            if (versao !== versaoAtual) { cache.clear(); versaoAtual = versao; }
            if (cache.has(chave)) return cache.get(chave);
            // ponytail: cheio = esvazia tudo; LRU só se aparecer thrashing real
            if (cache.size >= max) cache.clear();
            const v = calcular();
            cache.set(chave, v);
            return v;
        },
        tamanho() { return cache.size; },
    };
}

// =============================================
// MEDIÇÃO POR ETAPA
// Liga com ?perf=1 (HUD na tela, serve para perfilar NO CELULAR) ou setando
// MEDIR.ativo nos harness. Desligada, o custo é um if por chamada.
// =============================================
export const MEDIR = { ativo: false, etapas: new Map() }; // nome -> { ms, n, max }

/** Executa `fn` cronometrando na etapa `nome` (no-op com a medição desligada). */
export function medir(nome, fn) {
    if (!MEDIR.ativo) return fn();
    const t0 = performance.now();
    try { return fn(); }
    finally {
        const dt = performance.now() - t0;
        let e = MEDIR.etapas.get(nome);
        if (!e) MEDIR.etapas.set(nome, e = { ms: 0, n: 0, max: 0 });
        e.ms += dt; e.n++; if (dt > e.max) e.max = dt;
    }
}

/** Só conta ocorrências (ex.: pointermove/s), sem cronometrar. */
export function contar(nome) {
    if (!MEDIR.ativo) return;
    let e = MEDIR.etapas.get(nome);
    if (!e) MEDIR.etapas.set(nome, e = { ms: 0, n: 0, max: 0 });
    e.n++;
}

export function zerarMedicao() { MEDIR.etapas.clear(); }

/** [{ nome, ms, n, max, mediaMs }] ordenado por tempo total. */
export function relatorioMedicao() {
    return [...MEDIR.etapas.entries()]
        .map(([nome, e]) => ({ nome, ms: e.ms, n: e.n, max: e.max, mediaMs: e.n ? e.ms / e.n : 0 }))
        .sort((a, b) => b.ms - a.ms);
}

/** HUD de medição no aparelho real: abra o tabuleiro com ?perf=1. */
export function iniciarHudMedicaoSePedido() {
    if (!/[?&]perf=1/.test(location.search)) return;
    MEDIR.ativo = true;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;background:rgba(10,14,22,.88);' +
        'color:#7dd3fc;font:11px/1.5 ui-monospace,monospace;padding:6px 8px;border-radius:6px;' +
        'pointer-events:none;white-space:pre;max-width:92vw;overflow:hidden';
    document.body.appendChild(el);
    setInterval(() => {
        const linhas = relatorioMedicao()
            .map(r => `${r.nome.padEnd(12)} ${r.ms.toFixed(1).padStart(6)}ms/s  n=${String(r.n).padStart(4)}  max=${r.max.toFixed(1)}`);
        el.textContent = linhas.join('\n') || 'perf: aguardando…';
        zerarMedicao();
    }, 1000);
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
