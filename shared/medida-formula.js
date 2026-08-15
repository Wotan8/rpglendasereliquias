/* ===== MEDIDA QUE PODE SER FÓRMULA =====
 *
 * Raio, alcance, comprimento e largura de uma habilidade nem sempre são um
 * número fixo. "Raio: (Liderança + PRE) metros" é regra de mesa do Adepto, e
 * até aqui não havia campo para ela: o cadastro guardava a fórmula na prosa e
 * o Tabuleiro não tinha o que ler.
 *
 * Este arquivo aceita as duas coisas no MESMO campo:
 *   "4"                    → 4
 *   "(Liderança + PRE)"    → soma os dois na ficha de quem conjura
 *   "Liderança + PRE + 2"  → idem, com constante
 *   "Percepção * 2"        → múltiplo de um componente
 *
 * O que é permitido, e nada além: números, nomes de componente (atributo,
 * perícia ou Valor Derivado), + − × ÷ e parênteses. Qualquer outro caractere
 * invalida a fórmula inteira — sem `eval` de texto de banco a esmo.
 *
 * O resolvedor de nome entra por parâmetro (`valorDe`): no Tabuleiro é o
 * valorComponente() de tab-state, que já sabe achar atributo, perícia e VD na
 * ficha e no NPC. Aqui não se sabe de onde vem número nenhum — é o que
 * mantém este arquivo testável no node.
 */

/** Só o que pode aparecer numa medida. Nome aceita acento, espaço e hífen.
 *  A faixa das letras pula × (U+00D7) e ÷ (U+00F7) de propósito: os dois caem
 *  no meio de À-ÿ e seriam engolidos como letra do nome em vez de operador. */
// Um nome é uma sequência de palavras coladas por UM separador que vem grudado
// na palavra seguinte: "Bolha de Sangue" e "Blindagem-Cortante" são nomes, mas
// "Blindagem - Percepção" é subtração — o hífen solto entre espaços é operador.
const LETRA = 'A-Za-zÀ-ÖØ-öø-ÿ';
const NOME = `[${LETRA}]+(?:[ .'-][${LETRA}]+)*`;
const TOKEN = new RegExp(`\\s*(\\d+(?:[.,]\\d+)?|${NOME}|[()+\\-*/×÷])`, 'gy');

/**
 * Tira a unidade do fim: o campo já é em metros, e quem copia do texto do
 * cadastro cola "(Liderança + PRE) metros". Sem isto, "metros" viraria um
 * componente valendo 0 e quebraria a conta inteira.
 */
const semUnidade = (v) => String(v ?? '').trim().replace(/\s*(m|metros?|mts?)\.?$/i, '').trim();

/** É um número puro? ("4", "3.5", "2,5") */
export function ehNumero(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    const s = semUnidade(v).replace(',', '.');
    return s !== '' && Number.isFinite(Number(s));
}

/** Tem fórmula (não é número puro nem vazio)? */
export function ehFormula(v) {
    const s = semUnidade(v);
    return s !== '' && !ehNumero(s);
}

/**
 * Quebra a medida em tokens. Devolve null se aparecer qualquer coisa fora da
 * gramática — o campo inteiro é recusado em vez de virar um número torto.
 */
export function tokensDaMedida(v) {
    const s = semUnidade(v);
    if (s === '') return [];
    const out = [];
    TOKEN.lastIndex = 0;
    let pos = 0;
    while (pos < s.length) {
        TOKEN.lastIndex = pos;
        const m = TOKEN.exec(s);
        if (!m) return null;                       // caractere proibido
        const t = m[1].trim();
        if (t) out.push(t);
        pos = TOKEN.lastIndex;
    }
    return out;
}

const OPERADOR = /^[()+\-*/×÷]$/;
const ehNum = (t) => /^\d/.test(t);

/** Os nomes de componente citados na medida, na ordem, sem repetir. */
export function componentesDaMedida(v) {
    const ts = tokensDaMedida(v);
    if (!ts) return [];
    const out = [];
    for (const t of ts) {
        if (OPERADOR.test(t) || ehNum(t)) continue;
        const nome = t.trim();
        if (nome && !out.includes(nome)) out.push(nome);
    }
    return out;
}

/**
 * Resolve a medida em metros.
 *
 * @param {string|number} v        "4" ou "(Liderança + PRE) "
 * @param {Function} valorDe       nome → número (null/undefined = não achou)
 * @param {object}  [o]
 * @param {number}  [o.padrao=0]   devolvido quando a medida é vazia/inválida
 * @param {boolean} [o.faltaZero]  componente não achado vale 0 (padrão) —
 *                                 com false, a fórmula inteira vira `padrao`
 * @returns {number}
 */
export function resolverMedida(v, valorDe, o = {}) {
    const padrao = Number(o.padrao) || 0;
    if (v == null || semUnidade(v) === '') return padrao;
    if (ehNumero(v)) return Number(semUnidade(v).replace(',', '.'));

    const ts = tokensDaMedida(v);
    if (!ts || !ts.length) return padrao;

    // nome → valor; o resto vira símbolo para a conta
    const expr = [];
    for (const t of ts) {
        if (OPERADOR.test(t)) { expr.push(t === '×' ? '*' : t === '÷' ? '/' : t); continue; }
        if (ehNum(t)) { expr.push(t.replace(',', '.')); continue; }
        const n = valorDe ? valorDe(t) : null;
        if (n == null || !Number.isFinite(Number(n))) {
            if (o.faltaZero === false) return padrao;
            expr.push('0');
        } else expr.push(String(Number(n)));
    }

    const conta = expr.join(' ');
    // Cinto de segurança: depois da substituição só pode ter número e operador.
    if (!/^[\d\s.()+\-*/]+$/.test(conta)) return padrao;
    try {
        // eslint-disable-next-line no-new-func
        const r = Function(`"use strict";return (${conta});`)();
        return Number.isFinite(r) ? r : padrao;
    } catch { return padrao; }
}

/**
 * Diagnóstico para o Painel do Criador: a medida é válida, e quais nomes ela
 * cita. `erro` preenchido = o campo tem caractere que a gramática não aceita.
 */
export function conferirMedida(v) {
    const s = semUnidade(v);
    if (s === '') return { ok: true, vazio: true, formula: false, componentes: [] };
    if (ehNumero(s)) return { ok: true, vazio: false, formula: false, componentes: [] };
    const ts = tokensDaMedida(s);
    if (!ts) return { ok: false, vazio: false, formula: true, componentes: [], erro: 'Caractere não permitido — use números, nomes, + − × ÷ e parênteses.' };
    const comps = componentesDaMedida(s);
    if (!comps.length) return { ok: false, vazio: false, formula: true, componentes: [], erro: 'Fórmula sem nenhum componente reconhecível.' };
    // parênteses equilibrados
    let n = 0;
    for (const t of ts) { if (t === '(') n++; else if (t === ')') n--; if (n < 0) break; }
    if (n !== 0) return { ok: false, vazio: false, formula: true, componentes: comps, erro: 'Parênteses não fecham.' };
    return { ok: true, vazio: false, formula: true, componentes: comps };
}
