// Rodar: node functions/cargo.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decidirCargo } = require('./cargo.js');

const pediuMestre = { role: 'jogador', cargoSolicitado: 'mestre' };

// ===== Aprovar: o pedido vira cargo e some =====
const ok = decidirCargo(pediuMestre, 'mestre');
assert.equal(ok.role, 'mestre');
assert.equal(ok.decisao, 'aprovado');
assert.equal(ok.cargoAntes, 'jogador');
assert.equal(ok.cargoDepois, 'mestre');
assert.equal(ok.pedido, 'mestre');

// ===== Recusar: NAO rebaixa, so apaga o pedido =====
const nao = decidirCargo({ role: 'mestre', cargoSolicitado: 'criador' }, null);
assert.equal(nao.role, null, 'recusa nao escreve role');
assert.equal(nao.decisao, 'recusado');
assert.equal(nao.cargoDepois, 'mestre', 'quem ja era mestre continua mestre');
assert.match(nao.mensagem, /Criador/, 'a mensagem diz o que foi pedido');

// Recusa de conta sem pedido nenhum tambem nao quebra
assert.equal(decidirCargo({}, null).cargoDepois, 'jogador');
assert.equal(decidirCargo(null, null).cargoDepois, 'jogador');

// ===== Cargo invalido nao passa =====
for (const lixo of ['admin', 'CRIADOR', '', 'jogador ', 0, {}]) {
    assert.throws(() => decidirCargo(pediuMestre, lixo), /Cargo inválido/,
        `"${JSON.stringify(lixo)}" nao pode virar cargo`);
}

// ===== Criador nao e rebaixado por outro Criador =====
const criador = { role: 'criador' };
assert.throws(() => decidirCargo(criador, 'jogador'), /outro Criador/);
assert.throws(() => decidirCargo(criador, 'mestre'), /outro Criador/);
assert.throws(() => decidirCargo(criador, null), /outro Criador/,
    'nem recusando: recusa em criador seria rebaixamento silencioso');
assert.equal(decidirCargo(criador, 'criador').role, 'criador', 'reafirmar o cargo passa');

// ===== Conta sem role e jogador =====
assert.equal(decidirCargo({ cargoSolicitado: 'criador' }, 'criador').cargoAntes, 'jogador');

console.log('cargo.test.mjs: OK');
