// Rodar: node tabuleiro/js/tab-perf.test.mjs
// Cobre o memo por versão que sustenta o cache POR FONTE dos polígonos de
// visibilidade: mover um token deve recalcular só o polígono dele, e mudar
// as paredes (versão) deve invalidar todos.
import assert from 'node:assert/strict';
import { criarMemoPorVersao } from './tab-perf.js';

let calculos = 0;
const calcular = (v) => () => { calculos++; return v; };

const memo = criarMemoPorVersao(4);

// mesma chave, mesma versão: calcula uma vez só
assert.equal(memo.obter('a', 1, calcular('A')), 'A');
assert.equal(memo.obter('a', 1, calcular('A2')), 'A', 'segunda chamada vem do cache');
assert.equal(calculos, 1);

// chave nova (a fonte que se moveu) calcula; as antigas continuam em cache
assert.equal(memo.obter('b', 1, calcular('B')), 'B');
assert.equal(memo.obter('a', 1, calcular('A3')), 'A');
assert.equal(calculos, 2, 'só a fonte nova recalculou');

// versão nova (paredes mudaram): TUDO invalida
assert.equal(memo.obter('a', 2, calcular('A-v2')), 'A-v2');
assert.equal(calculos, 3);
assert.equal(memo.tamanho(), 1, 'o cache da versão velha foi esvaziado');

// valores "falsos" também são cache (um polígono pode ser vazio)
memo.obter('vazio', 2, calcular(null));
memo.obter('vazio', 2, calcular('não-deveria'));
assert.equal(calculos, 4, 'null cacheado não recalcula');

// estouro do limite: esvazia e segue funcionando (sem crescer sem teto)
memo.obter('c', 2, calcular('C'));
memo.obter('d', 2, calcular('D'));   // 4º item → cheio
memo.obter('e', 2, calcular('E'));   // estourou: limpa e recomeça
assert.ok(memo.tamanho() <= 4, 'nunca passa do teto');
assert.equal(memo.obter('e', 2, calcular('E2')), 'E', 'o item pós-limpeza fica em cache');

console.log('✅ tab-perf: memo por versão (cache por fonte do fog) OK');
