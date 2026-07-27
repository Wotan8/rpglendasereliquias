// Rodar: node tabuleiro/js/tab-musica-calc.test.mjs
import assert from 'node:assert/strict';
import { planoDeReproducao, posicaoInicial } from './tab-musica-calc.js';

const existe = new Set(['a', 'b', 'c']);
const temFaixa = (fid) => existe.has(fid);

// --- nada tocando, nada acontece ---
assert.deepEqual(planoDeReproducao({}, temFaixa, []), { parar: [], iniciar: [] });

// --- mestre deu play em duas: o jogador entra nas duas ---
assert.deepEqual(planoDeReproducao({ a: 1, b: 2 }, temFaixa, []).iniciar, ['a', 'b']);

// --- já estou nas duas: nada a fazer (não reinicia a música a cada snapshot) ---
assert.deepEqual(planoDeReproducao({ a: 1, b: 2 }, temFaixa, ['a', 'b']), { parar: [], iniciar: [] });

// --- mestre parou uma: paro só ela ---
assert.deepEqual(planoDeReproducao({ a: 1 }, temFaixa, ['a', 'b']), { parar: ['b'], iniciar: [] });

// --- faixa apagada da playlist enquanto tocava: para mesmo constando em `tocando` ---
assert.deepEqual(planoDeReproducao({ a: 1, z: 5 }, temFaixa, ['a', 'z']), { parar: ['z'], iniciar: [] });
assert.deepEqual(planoDeReproducao({ z: 5 }, temFaixa, []).iniciar, [], 'não tento iniciar faixa sem arquivo');

// --- t0 = 0 é instante válido? não: 0 significa "sem carimbo" e não deve travar o play ---
assert.deepEqual(planoDeReproducao({ a: 0 }, temFaixa, []).iniciar, ['a']);

// --- entrar em fase ---
const agora = 1_000_000;
assert.equal(posicaoInicial(agora - 30_000, agora, 100, true), 30, 'entro no segundo 30');
assert.equal(posicaoInicial(agora - 250_000, agora, 100, true), 50, 'com loop, dá a volta');
assert.equal(posicaoInicial(agora - 250_000, agora, 100, false), 99.9, 'sem loop, já acabou');
assert.equal(posicaoInicial(agora - 200, agora, 100, true), null, 'começou agora: não mexe');
assert.equal(posicaoInicial(agora - 30_000, agora, NaN, true), null, 'sem duração conhecida, não mexe');
assert.equal(posicaoInicial(agora - 30_000, agora, Infinity, true), null, 'stream ao vivo, não mexe');
assert.equal(posicaoInicial(0, agora, 100, true), null, 'sem carimbo de início, toca do começo');

console.log('✅ tab-musica-calc: sincronia de reprodução OK');
