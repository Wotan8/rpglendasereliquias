// Rodar: node functions/entrega-calc.test.mjs
import assert from 'node:assert/strict';
import { aplicarCompra, rerolagensDoItem, MAX_LOGS_COMPRA } from './entrega-calc.js';

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
// A linha existente precisa ser a MESMA COISA: mesmo nome nao basta, o que o
// item faz tem de bater. Ver functions/repertorio.js — juntar por nome fazia a
// peca barata herdar o EXP da cara quando as duas tinham o mesmo nome.
const r2 = aplicarCompra(
    { inventario: [{ nome: item.nome, isExp: true, expAmount: 50, quantidade: 3 }] },
    item, pending, 'Mercado Pago'
);
assert.equal(r2.inventario.length, 1, 'não duplica a linha do inventário');
assert.equal(r2.inventario[0].quantidade, 5, '3 + 2');
assert.equal(r2.apoios[0].tipo, 'Loja (Mercado Pago)');

// --- carrinho: duas linhas em sequência, a segunda parte do estado da primeira ---
const l1 = aplicarCompra({}, item, pending, 'Mercado Pago');
const l2 = aplicarCompra(
    { inventario: l1.inventario, logsCompra: l1.logsCompra, apoios: l1.apoios, notifications: l1.notifications },
    { nome: 'Outra Peça', descricao: 'y' },
    { itemId: 'it2', compraId: 'c1', quantidade: 1, valorCentavos: 500, totalCentavos: 500 },
    'Mercado Pago'
);
assert.equal(l2.inventario.length, 2, 'as duas peças do carrinho entram');
assert.equal(l2.logsCompra.length, 2);
assert.equal(l2.apoios.length, 2);

// --- peso na producao: a compra grava quanto vale na meta ---
const pesado = { nome: 'Roleta 3x', isRoleta: true, roletaGiros: 3, pesoProducao: 3 };
const p1 = aplicarCompra({}, pesado, { ...pending, quantidade: 1 }, 'Mercado Pago');
assert.equal(p1.apoios[0].peso, 3, 'o peso do item vai para o apoio');
assert.equal(p1.apoios[0].montante, 1, 'e o montante continua sendo a quantidade comprada');

const p2 = aplicarCompra({}, item, pending, 'Mercado Pago');
assert.equal('peso' in p2.apoios[0], false, 'item de peso 1 nao suja o apoio com o padrao');

const p3 = aplicarCompra({}, { ...item, pesoProducao: 'abc' }, pending, 'Mercado Pago');
assert.equal('peso' in p3.apoios[0], false, 'peso invalido vira 1 e nao e gravado');

// --- item de roleta credita giros; item comum nao mexe no saldo ---
const roleta3x = { nome: 'Roleta 3x', isRoleta: true, roletaGiros: 3 };
const g1 = aplicarCompra({}, roleta3x, { ...pending, quantidade: 2 }, 'Mercado Pago');
assert.equal(g1.giros, 6, '3 giros x 2 unidades');

const g2 = aplicarCompra({ giros: 4 }, roleta3x, { ...pending, quantidade: 1 }, 'Mercado Pago');
assert.equal(g2.giros, 7, 'soma ao saldo que ja existia');

const g3 = aplicarCompra({ giros: 4 }, item, pending, 'Mercado Pago');
assert.equal(g3.giros, 4, 'item comum nao altera o saldo de giros');

const g4 = aplicarCompra({}, item, pending, 'Mercado Pago');
assert.equal(g4.giros, 0, 'sem saldo e sem item de roleta, fica zero');

// --- item de re-rolagem credita o contador, igualzinho aos giros ---
assert.equal(rerolagensDoItem({ isRerolagem: true, rerolagensAmount: 5 }, 2), 10, '5 re-rolls x 2 unidades');
assert.equal(rerolagensDoItem({ isRerolagem: true, rerolagensAmount: 1 }), 1, 'quantidade ausente vale 1');
assert.equal(rerolagensDoItem({ isRerolagem: false, rerolagensAmount: 9 }, 5), 0, 'sem a flag nao credita');
assert.equal(rerolagensDoItem({ isRerolagem: true }, 3), 0, 'flag sem quantidade nao credita');
assert.equal(rerolagensDoItem({ isRerolagem: true, rerolagensAmount: -2 }), 0, 'negativo nao vira credito');

const reroll5x = { nome: '5x Re-rolagem', isRerolagem: true, rerolagensAmount: 5 };
assert.equal(aplicarCompra({}, reroll5x, { ...pending, quantidade: 2 }, 'Mercado Pago').rerolagens, 10);
assert.equal(aplicarCompra({ rerolagens: 3 }, reroll5x, { ...pending, quantidade: 1 }, 'Dinheiro').rerolagens, 8);
assert.equal(aplicarCompra({ rerolagens: 3 }, item, pending, 'Dinheiro').rerolagens, 3, 'item comum nao mexe');

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

// ===== TETO DE logsCompra (item 14) =====
// Documento de usuario morre em 1 MB — e morrer ali significa nao conseguir
// mais NEM COMPRAR. `logsCompra` e a unica lista do doc que so cresce.
const cheio = { logsCompra: Array.from({ length: MAX_LOGS_COMPRA }, (_, i) => ({ nome: 'antiga ' + i })) };
const r = aplicarCompra(cheio, { nome: 'Nova' }, { itemId: 'x', quantidade: 1, totalCentavos: 100 }, 'Mercado Pago');
assert.equal(r.logsCompra.length, MAX_LOGS_COMPRA, 'nao passa do teto');
assert.equal(r.logsCompra[r.logsCompra.length - 1].nome, 'Nova', 'a compra nova entra');
assert.equal(r.logsCompra[0].nome, 'antiga 1', 'quem sai e a mais ANTIGA');

// muito acima do teto (documento legado) volta para o teto de uma vez
const estourado = { logsCompra: Array.from({ length: MAX_LOGS_COMPRA + 50 }, (_, i) => ({ nome: 'a' + i })) };
assert.equal(aplicarCompra(estourado, { nome: 'N' }, { itemId: 'x', quantidade: 1, totalCentavos: 1 }, 'x').logsCompra.length, MAX_LOGS_COMPRA);

// abaixo do teto nao perde nada
const poucas = { logsCompra: [{ nome: 'so uma' }] };
assert.equal(aplicarCompra(poucas, { nome: 'N' }, { itemId: 'x', quantidade: 1, totalCentavos: 1 }, 'x').logsCompra.length, 2);

console.log('entrega-calc: teto de logsCompra OK');

// ===== nao herda efeito de item homonimo (item 11 da varredura) =====
// Mestre cadastra uma bugiganga com o mesmo nome de um pacote de EXP.
// Comprar a bugiganga NAO pode somar unidade na linha do pacote.
const bugiganga = { nome: 'Bênção do Cronista' };   // mesmo nome, sem efeito
const invComPacote = [{ nome: 'Bênção do Cronista', isExp: true, expAmount: 500, quantidade: 1 }];
const r9 = aplicarCompra({ inventario: invComPacote }, bugiganga,
    { itemId: 'outro', quantidade: 1, totalCentavos: 500 }, 'Mercado Pago');
assert.equal(r9.inventario.length, 2, 'a bugiganga abre linha propria');
assert.equal(r9.inventario[0].quantidade, 1, 'a linha do pacote de 500 EXP nao encostou');
assert.equal(r9.inventario[1].expAmount, undefined, 'e a linha nova nao nasce com EXP');

console.log('entrega-calc: nao herda efeito de homonimo OK');
