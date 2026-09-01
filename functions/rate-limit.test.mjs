// Rodar: node functions/rate-limit.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decidirLimite, esperaEmTexto } = require('./rate-limit.js');

const HORA = 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

// ===== primeira chamada =====
const p = decidirLimite(null, T0, 3, HORA);
assert.equal(p.permitido, true);
assert.deepEqual(p.estado, { janelaInicio: T0, contagem: 1 });
assert.equal(p.restam, 2);
assert.equal(decidirLimite({}, T0, 3, HORA).permitido, true, 'doc vazio conta como primeira');

// ===== dentro da janela, ate o limite =====
let est = { janelaInicio: T0, contagem: 1 };
const r2 = decidirLimite(est, T0 + 1000, 3, HORA);
assert.equal(r2.permitido, true);
assert.equal(r2.estado.contagem, 2);
assert.equal(r2.estado.janelaInicio, T0, 'a janela nao se move a cada chamada');
assert.equal(r2.restam, 1);

const r3 = decidirLimite(r2.estado, T0 + 2000, 3, HORA);
assert.equal(r3.permitido, true);
assert.equal(r3.restam, 0, 'a terceira e a ultima');

// ===== estourou =====
const r4 = decidirLimite(r3.estado, T0 + 3000, 3, HORA);
assert.equal(r4.permitido, false);
assert.equal(r4.estado.contagem, 3, 'chamada recusada NAO incrementa (senao a espera nunca acaba)');
assert.equal(r4.esperarMs, HORA - 3000);

// ===== a janela vira =====
const depois = decidirLimite(r3.estado, T0 + HORA, 3, HORA);
assert.equal(depois.permitido, true, 'exatamente no fim da janela ja libera');
assert.deepEqual(depois.estado, { janelaInicio: T0 + HORA, contagem: 1 });
assert.equal(decidirLimite(r3.estado, T0 + HORA - 1, 3, HORA).permitido, false, 'um milissegundo antes, nao');

// ===== relogio para tras nao tranca ninguem =====
// Um doc gravado "no futuro" (relogio do servidor ajustado) trancaria o
// usuario ate aquele instante chegar. Recomeca a janela em vez disso.
const futuro = decidirLimite({ janelaInicio: T0 + HORA, contagem: 99 }, T0, 3, HORA);
assert.equal(futuro.permitido, true);
assert.equal(futuro.estado.janelaInicio, T0);

// ===== limite 1 =====
const um = decidirLimite(null, T0, 1, HORA);
assert.equal(um.restam, 0);
assert.equal(decidirLimite(um.estado, T0 + 1, 1, HORA).permitido, false);

// ===== dado corrompido nao libera geral nem tranca =====
assert.equal(decidirLimite({ janelaInicio: 'lixo', contagem: 'lixo' }, T0, 3, HORA).permitido, true);
assert.equal(decidirLimite({ janelaInicio: T0, contagem: -5 }, T0 + 1, 3, HORA).permitido, true);

// ===== texto da espera =====
assert.equal(esperaEmTexto(1000), '1 segundo');
assert.equal(esperaEmTexto(2000), '2 segundos');
assert.equal(esperaEmTexto(59_000), '59 segundos');
assert.equal(esperaEmTexto(60_000), '1 minuto');
assert.equal(esperaEmTexto(HORA), '60 minutos');
assert.equal(esperaEmTexto(-5), '0 segundos', 'espera negativa nao vira texto quebrado');

console.log('rate-limit.test.mjs: OK');
