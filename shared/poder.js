/**
 * ⚡ PODER — tudo que a ficha tem, em EXP (Livro de 12 Páginas, p. 12).
 *
 * "Poder é a medida que o site calcula para personagem, NPC, criatura e item:
 * tudo que a ficha tem, convertido em EXP pela tabela da Página 3, pago ou
 * concedido. Item vale (Qualidade + Afiação) × 5, mais 10 por Encantamento;
 * Aura, do personagem ou da peça, vale 25 por ponto; aliado que fica de pé
 * vale metade do Poder dele. Poder nunca trava nada: é régua para o Narrador."
 *
 * Módulo puro: recebe números, devolve números. Os multiplicadores vêm de
 * config/regras (`exp.*` e `poder.*`), com o padrão de regras-padrao.js por
 * baixo. ES module + global (`globalThis.LR_PODER`) para os scripts clássicos.
 * Auto-teste: `node shared/poder.js`.
 */
import { REGRAS_PADRAO, patamarDoPoder as _patamar } from './regras-padrao.js';

const num = (v) => Number(v) || 0;
const regra = (regras, grupo, chave) => {
    const v = regras?.[grupo]?.[chave];
    return v === undefined || v === null ? REGRAS_PADRAO[grupo][chave] : v;
};

/** Σ de `desde` até `nivel` de (i × porNivel): o que a escada da Página 3 cobrou. */
export function custoAcumulado(nivel, porNivel, desde = 1) {
    const n = Math.max(0, Math.floor(num(nivel)));
    let total = 0;
    for (let i = Math.max(1, desde); i <= n; i++) total += i * num(porNivel);
    return total;
}

/** Atributos: cada nível N vale 5 × N, o 1 incluído — foi concedido na criação, e é assim que o
 *  EXP Total do assistente (calcAttrExpTotal) e o ⚡ Poder do NPC (npc-poder.js) já contam. */
export function poderDeAtributos(niveis, regras = null) {
    const por = regra(regras, 'exp', 'atributoPorNivel');
    return (niveis || []).reduce((s, n) => s + custoAcumulado(n, por, 1), 0);
}

/** Perícias: cada nível custou custoEvolucao × N (padrão exp.periciaPorNivel). */
export function poderDePericias(pericias, regras = null) {
    const padrao = regra(regras, 'exp', 'periciaPorNivel');
    return (pericias || []).reduce((s, p) => s + custoAcumulado(p?.nivel, num(p?.custoEvolucao) || padrao), 0);
}

/**
 * Um Dom (peculiaridade individual) até o nível `nivel`, em EXP, pelo cadastro:
 *  - nível 1: a mecânica de EXP da criação (`mecanicaExpCriacao`, alvo EXP: '-' custou, '+' devolveu);
 *    sem ela e sem escada, vale exp.domSemNivel (Livro: Dom extra custa ou devolve 10);
 *  - níveis 2+: `progressao[i].custoExp` das mecânicas evoluíveis (progressaoTipoExp 'ganho' = desvantagem, negativa);
 *  - registro antigo com `niveis` à mão: lê o número do texto do custo.
 * Negativo = desvantagem (rendeu EXP). `mecsById` é { id: mecânica } ou um Map.
 */
export function custoDeDom(reg, nivel, mecsById = {}, regras = null) {
    if (!reg) return 0;
    const n = Math.max(1, Math.floor(num(nivel) || 1));
    const porId = (id) => (typeof mecsById?.get === 'function' ? mecsById.get(id) : mecsById?.[id]) || null;
    let base = null;
    for (const m of (reg.mecanicaExpCriacao || []).map(porId).filter(Boolean)) {
        for (const c of m.config?.calculos || []) {
            if (String(c.alvo || '').toUpperCase() !== 'EXP') continue;
            const v = (c.equacao || []).reduce((s, t) => s + (t.tipo === 'fixo' ? num(t.valor) : 0), 0);
            base = (base || 0) + (c.operacao === '+' ? -v : v);
        }
    }
    const evoluiveis = (reg.mecanicaIds || []).map(porId).filter(m => m && m.evoluivel === true);
    if (evoluiveis.length) {
        const ganho = evoluiveis.some(m => m.progressaoTipoExp === 'ganho');
        let escada = 0;
        for (let i = base === null ? 1 : 2; i <= n; i++)
            for (const m of evoluiveis) escada += num(m.progressao?.[String(i)]?.custoExp);
        return (base || 0) + (ganho ? -escada : escada);
    }
    if (reg.niveis && typeof reg.niveis === 'object') {
        let total = 0;
        for (let i = 1; i <= n; i++) {
            const nv = reg.niveis[i] || reg.niveis[String(i)];
            if (!nv) continue;
            const m = String(nv.custo ?? nv.custoExp ?? '').match(/(\d+)/);
            const c = m ? parseInt(m[1], 10) : num(nv.custoExp);
            total += nv.tipoExp === 'ganho' ? -c : c;
        }
        return total;
    }
    return base === null ? regra(regras, 'exp', 'domSemNivel') : base;
}

/** Uma peça: (Qualidade + Afiação comum + arcana) × 5, +10 por Encantamento, +25 por ponto de Aura. */
export function poderDeItem(item, regras = null) {
    if (!item) return 0;
    const pontos = num(item.qualidade) + num(item.afiacao) + num(item.afiacaoArcana);
    const enc = item.encantamento ? (Array.isArray(item.encantamento) ? item.encantamento.length : 1) : 0;
    return pontos * regra(regras, 'poder', 'itemPorPonto')
        + enc * regra(regras, 'poder', 'encantamento')
        + num(item.aura) * regra(regras, 'poder', 'auraPorPonto');
}

/**
 * O Poder inteiro, em partes nomeadas (para o tooltip abrir a conta).
 * @param f { atributos:[nível], pericias:[{nivel,custoEvolucao}], dons:número|[custo], habilidades:[exp],
 *            itens:[item], auraPontos:número, aliados:[poder] }
 */
export function poderTotal(f = {}, regras = null) {
    const partes = [];
    const push = (chave, icone, label, exp) => partes.push({ chave, icone, label, exp: Math.round(num(exp)) });
    push('atributos', '💪', 'Atributos', poderDeAtributos(f.atributos, regras));
    push('pericias', '🎯', 'Perícias', poderDePericias(f.pericias, regras));
    const dons = Array.isArray(f.dons) ? f.dons.reduce((s, c) => s + num(c), 0) : num(f.dons) * regra(regras, 'exp', 'domSemNivel');
    push('dons', '🧬', 'Dons', dons);
    push('habilidades', '🧩', 'Habilidades', (f.habilidades || []).reduce((s, e) => s + num(e), 0));
    push('itens', '🗡️', 'Itens', (f.itens || []).reduce((s, i) => s + poderDeItem(i, regras), 0));
    push('aura', '🌟', 'Aura', num(f.auraPontos) * regra(regras, 'poder', 'auraPorPonto'));
    push('aliados', '🤝', 'Aliados', (f.aliados || []).reduce((s, p) => s + num(p) * regra(regras, 'poder', 'aliadoFracao'), 0));
    const total = partes.reduce((s, p) => s + p.exp, 0);
    return { total, partes: partes.filter(p => p.exp) };
}

/** O nome do Poder: Inicial, Veterano… Graal (tabela poder.patamares de config/regras). */
export function patamarDoPoder(poder, regras = null) {
    return _patamar(num(poder), regras || REGRAS_PADRAO);
}

if (typeof globalThis !== 'undefined') {
    globalThis.LR_PODER = { custoAcumulado, poderDeAtributos, poderDePericias, custoDeDom, poderDeItem, poderTotal, patamarDoPoder };
}

// ---- auto-teste: node shared/poder.js ----
const ehMain = typeof process !== 'undefined' && process.argv?.[1] && /poder\.js$/.test(process.argv[1].replace(/\\/g, '/'));
if (ehMain) {
    const assert = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } };
    assert(custoAcumulado(3, 4) === 4 + 8 + 12, 'perícia 3 = 24');
    assert(custoAcumulado(3, 5, 2) === 10 + 15, 'atributo 3 = 25 (o 1 é de graça)');
    assert(poderDeAtributos([1, 1, 3]) === 5 + 5 + 30, 'o nível 1 conta: foi concedido (igual ao EXP Total do assistente)');
    const mecs = { cria: { config: { calculos: [{ alvo: 'EXP', operacao: '-', equacao: [{ tipo: 'fixo', valor: 12 }] }] } },
                   dev: { config: { calculos: [{ alvo: 'EXP', operacao: '+', equacao: [{ tipo: 'fixo', valor: 10 }] }] } },
                   esc: { evoluivel: true, progressaoTipoExp: 'custo', progressao: { 1: { custoExp: 0 }, 2: { custoExp: 14 }, 3: { custoExp: 8 } } },
                   ganho: { evoluivel: true, progressaoTipoExp: 'ganho', progressao: { 1: { custoExp: 0 }, 2: { custoExp: 5 } } } };
    assert(custoDeDom({ mecanicaExpCriacao: ['cria'], mecanicaIds: ['esc'] }, 3, mecs) === 12 + 14 + 8, 'nível 1 da criação + escada');
    assert(custoDeDom({ mecanicaExpCriacao: ['dev'], mecanicaIds: ['ganho'] }, 2, mecs) === -10 - 5, 'desvantagem entra negativa');
    assert(custoDeDom({ mecanicaIds: ['esc'] }, 2, mecs) === 14, 'sem mecânica de criação a escada começa no 1');
    assert(custoDeDom({ nome: 'Dom simples' }, 1, mecs) === 10, 'Dom sem preço no cadastro vale exp.domSemNivel');
    assert(custoDeDom({ niveis: { 1: { custo: '6 EXP' }, 2: { custo: '9 EXP', tipoExp: 'ganho' } } }, 2, {}) === 6 - 9, 'registro antigo por texto');
    assert(poderDePericias([{ nivel: 2 }, { nivel: 1, custoEvolucao: 2 }]) === 12 + 2, 'custoEvolucao próprio vence o padrão');
    assert(poderDeItem({ qualidade: 3, afiacao: 2, encantamento: 'Sangrando' }) === 25 + 10, 'Q3 + Afiação 2 = 25, +10 do Encantamento');
    assert(poderDeItem({ qualidade: 5, aura: 2 }) === 25 + 50, 'Aura da peça: 25 por ponto');
    assert(poderDeItem({ qualidade: 1 }, { poder: { itemPorPonto: 7 } }) === 7, 'o multiplicador vem de config/regras');
    const t = poderTotal({ atributos: [3], pericias: [{ nivel: 2 }], dons: 2, habilidades: [12], itens: [{ qualidade: 1 }], auraPontos: 1, aliados: [100] });
    assert(t.total === 30 + 12 + 20 + 12 + 5 + 25 + 50, `total ${t.total}`);
    assert(patamarDoPoder(t.total).nome === 'Inicial' && patamarDoPoder(900).nome === 'Especialista' && patamarDoPoder(9999).nome === 'Graal', 'patamar');
    console.log('poder: ok');
}
