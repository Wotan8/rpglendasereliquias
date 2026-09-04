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

/** Atributos: todos começam em 1; cada nível novo custou 5 × N. */
export function poderDeAtributos(niveis, regras = null) {
    const por = regra(regras, 'exp', 'atributoPorNivel');
    return (niveis || []).reduce((s, n) => s + custoAcumulado(n, por, 2), 0);
}

/** Perícias: cada nível custou custoEvolucao × N (padrão exp.periciaPorNivel). */
export function poderDePericias(pericias, regras = null) {
    const padrao = regra(regras, 'exp', 'periciaPorNivel');
    return (pericias || []).reduce((s, p) => s + custoAcumulado(p?.nivel, num(p?.custoEvolucao) || padrao), 0);
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
    globalThis.LR_PODER = { custoAcumulado, poderDeAtributos, poderDePericias, poderDeItem, poderTotal, patamarDoPoder };
}

// ---- auto-teste: node shared/poder.js ----
const ehMain = typeof process !== 'undefined' && process.argv?.[1] && /poder\.js$/.test(process.argv[1].replace(/\\/g, '/'));
if (ehMain) {
    const assert = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } };
    assert(custoAcumulado(3, 4) === 4 + 8 + 12, 'perícia 3 = 24');
    assert(custoAcumulado(3, 5, 2) === 10 + 15, 'atributo 3 = 25 (o 1 é de graça)');
    assert(poderDeAtributos([1, 1, 3]) === 25, 'só o que passou de 1 custa');
    assert(poderDePericias([{ nivel: 2 }, { nivel: 1, custoEvolucao: 2 }]) === 12 + 2, 'custoEvolucao próprio vence o padrão');
    assert(poderDeItem({ qualidade: 3, afiacao: 2, encantamento: 'Sangrando' }) === 25 + 10, 'Q3 + Afiação 2 = 25, +10 do Encantamento');
    assert(poderDeItem({ qualidade: 5, aura: 2 }) === 25 + 50, 'Aura da peça: 25 por ponto');
    assert(poderDeItem({ qualidade: 1 }, { poder: { itemPorPonto: 7 } }) === 7, 'o multiplicador vem de config/regras');
    const t = poderTotal({ atributos: [3], pericias: [{ nivel: 2 }], dons: 2, habilidades: [12], itens: [{ qualidade: 1 }], auraPontos: 1, aliados: [100] });
    assert(t.total === 25 + 12 + 20 + 12 + 5 + 25 + 50, `total ${t.total}`);
    assert(patamarDoPoder(t.total).nome === 'Inicial' && patamarDoPoder(900).nome === 'Especialista' && patamarDoPoder(9999).nome === 'Graal', 'patamar');
    console.log('poder: ok');
}
