// Rodar: node functions/narrativo-uso.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { aplicacoesPorUnidade, usosRestantes, acharLinhaNarrativa, gastarAplicacao } =
    require('./narrativo-uso.js');

const desejo = (extra = {}) => ({
    nome: 'Desejo Narrativo', itemId: 'MG2Nb', isNarrativo: true, quantidade: 1, ...extra,
});

// ===== aplicacoes por unidade =====
assert.equal(aplicacoesPorUnidade(desejo()), 1, 'campo ausente vale 1 uso, nao zero');
assert.equal(aplicacoesPorUnidade(desejo({ narrativoAplicacoes: 0 })), 1, 'zero tambem vale 1');
assert.equal(aplicacoesPorUnidade(desejo({ narrativoAplicacoes: 3 })), 3);
assert.equal(aplicacoesPorUnidade(desejo({ narrativoAplicacoes: '3' })), 3, 'o painel grava texto');
assert.equal(aplicacoesPorUnidade(desejo({ narrativoAplicacoes: -2 })), 1, 'negativo nao tira uso');
assert.equal(aplicacoesPorUnidade(null), 1);

// ===== usos restantes =====
assert.equal(usosRestantes(desejo({ quantidade: 2 })), 2, 'duas unidades, um uso cada');
assert.equal(usosRestantes(desejo({ quantidade: 2, narrativoAplicacoes: 3 })), 6);
assert.equal(usosRestantes(desejo({ quantidade: 2, narrativoAplicacoes: 3, narrativoUsadas: 5 })), 1);
assert.equal(usosRestantes(desejo({ quantidade: 1, narrativoUsadas: 9 })), 0, 'nunca fica negativo');
assert.equal(usosRestantes({ nome: 'Poção', quantidade: 5 }), 0, 'item que nao e narrativo nao tem uso');
assert.equal(usosRestantes(null), 0);

// ===== achar a linha =====
const inv = [
    { nome: 'Poção', quantidade: 3 },
    desejo({ quantidade: 2 }),
    { nome: 'Desejo Narrativo 1x', itemId: 'vCbXi', isNarrativo: true, quantidade: 1 },
];
assert.equal(acharLinhaNarrativa(inv, { itemId: 'vCbXi' }), 2, 'o id manda quando os dois tem');
assert.equal(acharLinhaNarrativa(inv, { nome: 'Desejo Narrativo' }), 1, 'sem id, cai no nome');
assert.equal(acharLinhaNarrativa(inv, { itemId: 'xxx' }), -1);
assert.equal(acharLinhaNarrativa(inv, { nome: 'Poção' }), -1, 'so olha linha narrativa');
// Linha antiga sem `itemId` — 30% do inventario real esta assim.
assert.equal(
    acharLinhaNarrativa([{ nome: 'Desejo Narrativo', isNarrativo: true, quantidade: 1 }],
        { itemId: 'MG2Nb', nome: 'Desejo Narrativo' }),
    0, 'id de um lado so nao pode furar a busca');

// ===== gastar =====
const r1 = gastarAplicacao(inv, { itemId: 'MG2Nb' });
assert.equal(r1.restantes, 1);
assert.equal(r1.inventario[1].narrativoUsadas, 1, 'marca a aplicacao gasta');
assert.equal(r1.inventario[1].quantidade, 2, 'a unidade continua la ate o ultimo uso sair');
assert.equal(r1.inventario.length, 3, 'nada sumiu ainda');
assert.equal(inv[1].narrativoUsadas, undefined, 'o array original nao e tocado');

const r2 = gastarAplicacao(r1.inventario, { itemId: 'MG2Nb' });
assert.equal(r2.restantes, 0);
assert.equal(r2.inventario.length, 2, 'no ultimo uso a linha sai do Repertorio');
assert.equal(r2.inventario.find(l => l.itemId === 'MG2Nb'), undefined);
assert.equal(r2.inventario[0].nome, 'Poção', 'as outras linhas ficam onde estavam');

assert.throws(() => gastarAplicacao(r2.inventario, { itemId: 'MG2Nb' }),
    /não tem esse benefício/i, 'gastar o que nao existe explica, nao estoura');
assert.throws(() => gastarAplicacao([desejo({ quantidade: 1, narrativoUsadas: 1 })], { itemId: 'MG2Nb' }),
    /já foi todo usado/i);
assert.throws(() => gastarAplicacao([], { itemId: 'MG2Nb' }), /não tem esse benefício/i);

// Duas abas abertas gastando o mesmo saldo: a segunda conta em cima do
// resultado da primeira, e a terceira nao acha mais o que gastar.
let inv2 = [desejo({ quantidade: 1, narrativoAplicacoes: 2 })];
inv2 = gastarAplicacao(inv2, { nome: 'Desejo Narrativo' }).inventario;
const ult = gastarAplicacao(inv2, { nome: 'Desejo Narrativo' });
assert.equal(ult.restantes, 0);
assert.throws(() => gastarAplicacao(ult.inventario, { nome: 'Desejo Narrativo' }), /não tem/i);

console.log('narrativo-uso: ok');
