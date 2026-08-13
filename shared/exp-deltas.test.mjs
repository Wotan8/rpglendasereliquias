/**
 * EXP de log de sessão: editar não pode dobrar nem pendurar.
 * Roda com: node shared/exp-deltas.test.mjs
 */
import assert from 'node:assert/strict';
import { expDeltas } from './exp-deltas.js';

const P = (id, amount, type = 'add') => ({ characterId: id, expAmount: amount, expType: type });
const par = (r) => r.map(v => [v.p.characterId, v.delta]);

// log novo: aplica tudo
assert.deepEqual(par(expDeltas([], [P('a', 5)])), [['a', 5]]);
// reabrir e salvar sem mexer: ficha não anda
assert.deepEqual(expDeltas([P('a', 5)], [P('a', 5)]), []);
// corrigir 5 → 8: só os 3 que faltam
assert.deepEqual(par(expDeltas([P('a', 5)], [P('a', 8)])), [['a', 3]]);
// desmarcar da lista: devolve o que tinha dado
assert.deepEqual(par(expDeltas([P('a', 5)], [])), [['a', -5]]);
// menos vira negativo, e trocar o sinal move o dobro
assert.deepEqual(par(expDeltas([], [P('a', 3, 'sub')])), [['a', -3]]);
assert.deepEqual(par(expDeltas([P('a', 3, 'sub')], [P('a', 3)])), [['a', 6]]);

console.log('ok');
