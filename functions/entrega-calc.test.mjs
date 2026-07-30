// Rodar: node functions/entrega-calc.test.mjs
import assert from 'node:assert/strict';
import { aplicarCompra } from './entrega-calc.js';

const item = { nome: 'Bênção do Cronista', descricao: 'x', isExp: true, expAmount: 50 };
const pending = {
    itemId: 'it1',
    compraId: 'c1',
    quantidade: 2,
    valorCentavos: 1500,
    totalCentavos: 3000,
    selectedMetas: ['m1', 'm2'],
};

// --- item novo: entra no inventário com a origem certa ---
const r1 = aplicarCompra({}, item, pending, 'Dinheiro');
assert.equal(r1.inventario.length, 1);
assert.equal(r1.inventario[0].quantidade, 2);
assert.equal(r1.inventario[0].formaRecebimento, 'Comprado na Loja (Dinheiro)');
assert.equal(r1.inventario[0].expAmount, 50, 'o item vai inteiro, com os benefícios');
assert.equal(r1.valorReais, '30,00', 'centavos viram reais com vírgula');
assert.equal(r1.apoios[0].tipo, 'Loja (Dinheiro)');
assert.equal(r1.apoios[0].meta, 'm1,m2');
assert.equal(r1.apoios[0].montante, 2);
assert.equal(r1.logsCompra[0].valorPago, 3000);
assert.equal(r1.logsCompra[0].moeda, 'BRL');
assert.match(r1.notifications[0].message, /2x Bênção do Cronista por R\$ 30,00/);

// --- item repetido: soma a quantidade em vez de duplicar a linha ---
const r2 = aplicarCompra(
    { inventario: [{ nome: item.nome, quantidade: 3 }] },
    item, pending, 'PagBank'
);
assert.equal(r2.inventario.length, 1, 'não duplica a linha do inventário');
assert.equal(r2.inventario[0].quantidade, 5, '3 + 2');
assert.equal(r2.apoios[0].tipo, 'Loja (PagBank)');

// --- fallbacks: sem quantidade e sem totalCentavos ---
const r3 = aplicarCompra({}, item, { itemId: 'it1', valorCentavos: 990 }, 'Dinheiro');
assert.equal(r3.quantidade, 1);
assert.equal(r3.totalCentavos, 990);
assert.equal(r3.valorReais, '9,90');
assert.equal(r3.apoios[0].meta, '', 'sem metas não quebra');

// --- notificações não crescem sem limite ---
const antigas = Array.from({ length: 100 }, (_, i) => ({ id: 'n' + i }));
const r4 = aplicarCompra({ notifications: antigas }, item, pending, 'Dinheiro');
assert.equal(r4.notifications.length, 100);
assert.match(r4.notifications[0].message, /Compra Aprovada/, 'a nova entra no topo');

console.log('✅ entrega-calc: todos os casos passaram');
