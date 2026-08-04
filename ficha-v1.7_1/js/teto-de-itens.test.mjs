/**
 * Teto sobre a parcela de ITENS (tipoLimite 'maximo_itens').
 *
 * O bag geral de um Valor Derivado mistura peculiaridade, condição e item no
 * mesmo número. O Domínio de proteção precisa limitar SÓ o que veio das peças
 * — capar o total puniria quem tem Blindagem de raça ou de bênção.
 *
 * Este teste protege as duas metades da regra:
 *   • a parcela de peças é cortada no teto;
 *   • o que não veio de peça passa inteiro, por cima do teto.
 *
 * Roda com: node ficha-v1.7_1/js/teto-de-itens.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./derived-values.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function _applyMechanicModifiers(');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0 && fim > ini, '_applyMechanicModifiers não encontrado');

const sandbox = { state: { mechanicBonuses: {}, mechanicLimits: {} }, resultado: null };
vm.createContext(sandbox);
const aplica = (bonuses, limits = {}) => {
    vm.runInContext(`${src.slice(ini, fim)}\nresultado = _applyMechanicModifiers('BLINDAGEM', 0, ${JSON.stringify(bonuses)}, ${JSON.stringify(limits)});`, sandbox);
    return sandbox.resultado;
};

const K = 'DERIVED:BLINDAGEM';

// Sem teto: tudo soma normalmente
assert.equal(aplica({ [K]: 5, [`ITEM:${K}`]: 5 }), 5, 'sem teto, a Blindagem das peças passa inteira');

// Com teto 2: as peças rendem 5 mas param em 2
assert.equal(aplica({ [K]: 5, [`ITEM:${K}`]: 5, [`ITEMCAP:${K}`]: 2 }), 2,
    'o teto corta a parcela de peças');

// Peças abaixo do teto não são tocadas
assert.equal(aplica({ [K]: 1, [`ITEM:${K}`]: 1, [`ITEMCAP:${K}`]: 3 }), 1,
    'peça abaixo do teto passa inteira');

// A METADE QUE IMPORTA: 5 de peças (teto 2) + 4 que não vieram de peça.
// O certo é 2 + 4 = 6 — o teto não pode encostar nos 4.
assert.equal(aplica({ [K]: 9, [`ITEM:${K}`]: 5, [`ITEMCAP:${K}`]: 2 }), 6,
    'o teto só morde a parcela de itens; peculiaridade e condição passam por cima dele');

// Teto 0 (sem VIG nenhum) zera o aço, mas não o resto
assert.equal(aplica({ [K]: 7, [`ITEM:${K}`]: 3, [`ITEMCAP:${K}`]: 0 }), 4,
    'teto 0 anula o que veio de peça e preserva o que não veio');

// Nada de peça equipada: o teto é inócuo
assert.equal(aplica({ [K]: 4, [`ITEMCAP:${K}`]: 1 }), 4,
    'sem parcela de item, o teto não faz nada');

// Convive com a base vinda de mecânica (BASE:) sem comê-la
assert.equal(aplica({ [`BASE:${K}`]: 2, [K]: 5, [`ITEM:${K}`]: 5, [`ITEMCAP:${K}`]: 1 }), 3,
    'a base da fórmula não é parcela de item');

console.log('✅ teto de itens OK — corta a peça, poupa o resto');
