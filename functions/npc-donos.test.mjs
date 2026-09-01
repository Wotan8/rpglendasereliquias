// Rodar: node functions/npc-donos.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { charIdsVinculados, normalizarDonos, mudou } = require('./npc-donos.js');

// ===== charIdsVinculados =====
assert.deepEqual(charIdsVinculados({ vinculos: [{ tipo: 'personagem', id: 'c1' }] }), ['c1']);

// so 'personagem' conta: vinculo de mesa nao faz ninguem dono do NPC
assert.deepEqual(charIdsVinculados({ vinculos: [
    { tipo: 'mesa', id: 'm1' },
    { tipo: 'personagem', id: 'c1' },
    { tipo: 'faccao', id: 'f1' },
] }), ['c1']);

// aliado de dois personagens (dois jogadores) — os dois entram
assert.deepEqual(charIdsVinculados({ vinculos: [
    { tipo: 'personagem', id: 'c1' },
    { tipo: 'personagem', id: 'c2' },
] }), ['c1', 'c2']);

// repetido nao duplica
assert.deepEqual(charIdsVinculados({ vinculos: [
    { tipo: 'personagem', id: 'c1' }, { tipo: 'personagem', id: 'c1' },
] }), ['c1']);

// lixo nao vira dono
assert.deepEqual(charIdsVinculados({ vinculos: [
    { tipo: 'personagem' },            // sem id
    { tipo: 'personagem', id: '' },    // id vazio
    null, undefined, 'texto solto',
    { tipo: 'PERSONAGEM', id: 'c9' },  // caixa diferente NAO conta
] }), []);

// npc sem vinculos, ou com vinculos de outro tipo de dado
assert.deepEqual(charIdsVinculados({}), []);
assert.deepEqual(charIdsVinculados(null), []);
assert.deepEqual(charIdsVinculados({ vinculos: 'mesa1' }), []);
assert.deepEqual(charIdsVinculados({ vinculos: {} }), []);

// ===== normalizarDonos =====
assert.deepEqual(normalizarDonos(['b', 'a', 'b']), ['a', 'b'], 'ordena e tira repetido');
assert.deepEqual(normalizarDonos(['a', '', null, undefined]), ['a'], 'vazio nao vira dono');
assert.deepEqual(normalizarDonos([]), []);
assert.deepEqual(normalizarDonos(null), []);

// ===== mudou (a trava do laço infinito) =====
// O gatilho grava no MESMO documento que o disparou. Sem esta comparação, ele
// se chama de novo a cada gravacao, para sempre.
assert.equal(mudou(['a'], ['a']), false);
assert.equal(mudou(['a', 'b'], ['b', 'a']), false, 'mesma lista em outra ordem NAO e mudanca');
assert.equal(mudou(undefined, []), false, 'campo ausente e lista vazia sao a mesma coisa');
assert.equal(mudou([], []), false);
assert.equal(mudou(['a'], ['b']), true);
assert.equal(mudou(['a'], ['a', 'b']), true, 'ganhou um dono');
assert.equal(mudou(['a', 'b'], ['a']), true, 'perdeu um dono');
assert.equal(mudou([], ['a']), true);
assert.equal(mudou(['a'], []), true, 'desvincular tem de tirar o acesso');

console.log('npc-donos.test.mjs: OK');
