// Rodar: node functions/exp-item.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { aplicarExpDeItem, consumirUnidades, linhasDoItem, expDoItem, numero } = require('./exp-item.js');

// ===== numero: o campo da ficha e texto, as vezes vazio =====
assert.equal(numero('140'), 140);
assert.equal(numero(''), 0);
assert.equal(numero(undefined), 0);
assert.equal(numero(null), 0);
assert.equal(numero('abc'), 0);
assert.equal(numero(7), 7);
assert.equal(numero('12,5'), 12, 'parseInt para no separador');

// ===== expDoItem =====
assert.equal(expDoItem({ isExp: true, expAmount: 4 }), 4);
assert.equal(expDoItem({ isExp: true, expAmount: '5' }), 5, 'aceita texto');
assert.equal(expDoItem({ isExp: false, expAmount: 9 }), 0, 'sem a flag nao concede');
assert.equal(expDoItem({ isExp: true, expAmount: 0 }), 0);
assert.equal(expDoItem({ isExp: true, expAmount: -3 }), 0, 'negativo nao vira credito');
assert.equal(expDoItem({ isExp: true, expAmount: 2.9 }), 2, 'fracao trunca');
assert.equal(expDoItem(null), 0);

// ===== consumirUnidades =====
const inv = () => ([
    { nome: 'EXP+', quantidade: 3, isExp: true, expAmount: 4 },
    { nome: 'Amuleto', quantidade: 1 },
]);
assert.deepEqual(consumirUnidades(inv(), 'EXP+', 1)[0], { nome: 'EXP+', quantidade: 2, isExp: true, expAmount: 4 });
assert.equal(consumirUnidades(inv(), 'EXP+', 3).length, 1, 'zerou: a linha sai');
assert.equal(consumirUnidades(inv(), 'EXP+', 3)[0].nome, 'Amuleto', 'e a outra linha fica');
const original = inv();
consumirUnidades(original, 'EXP+', 2);
assert.equal(original[0].quantidade, 3, 'nao altera o array original');

// ===== aplicarExpDeItem: caminho feliz =====
const usuario = { inventario: inv() };
const r = aplicarExpDeItem(usuario, { exp: '10', exp_total: '50' }, 'EXP+', 2);
assert.equal(r.ganho, 8, '4 por unidade x 2');
assert.equal(r.porUnidade, 4);
assert.equal(r.exp, 18, '10 + 8');
assert.equal(r.expTotal, 58, '50 + 8');
assert.equal(r.restante, 1);
assert.equal(r.inventario.find(i => i.nome === 'EXP+').quantidade, 1);
assert.equal(usuario.inventario[0].quantidade, 3, 'o doc do usuario nao foi mexido');

// ficha zerada (campos vazios, que e o estado real de varias fichas)
const r2 = aplicarExpDeItem({ inventario: inv() }, { exp: '', exp_total: '' }, 'EXP+', 1);
assert.equal(r2.exp, 4);
assert.equal(r2.expTotal, 4);

// ficha sem o objeto fields
const r3 = aplicarExpDeItem({ inventario: inv() }, null, 'EXP+', 1);
assert.equal(r3.exp, 4);

// gastar tudo: a linha some
const r4 = aplicarExpDeItem({ inventario: inv() }, {}, 'EXP+', 3);
assert.equal(r4.restante, 0);
assert.equal(r4.inventario.some(i => i.nome === 'EXP+'), false);
assert.equal(r4.ganho, 12);

// o VIP e registrado (mesmo sem mudar a conta hoje)
assert.equal(aplicarExpDeItem({ inventario: [{ nome: 'V', quantidade: 1, isExp: true, expAmount: 2, isExpVip: true }] }, {}, 'V', 1).vip, true);
assert.equal(r.vip, false);

// ===== recusas =====
const recusa = (fn, codigo, re) => {
    try { fn(); assert.fail('deveria ter recusado: ' + codigo); }
    catch (e) {
        assert.equal(e.codigo, codigo, `codigo errado (${e.codigo}): ${e.message}`);
        if (re) assert.match(e.message, re);
    }
};
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'Nao existe', 1), 'not-found', /Repertório/);
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'Amuleto', 1), 'failed-precondition', /não concede EXP/);
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'EXP+', 4), 'failed-precondition', /tem 3 .* usar 4/);
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'EXP+', 0), 'invalid-argument');
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'EXP+', -2), 'invalid-argument');
recusa(() => aplicarExpDeItem({ inventario: inv() }, {}, 'EXP+', 'abc'), 'invalid-argument');
recusa(() => aplicarExpDeItem({}, {}, 'EXP+', 1), 'not-found');   // inventário ausente
recusa(() => aplicarExpDeItem(null, {}, 'EXP+', 1), 'not-found');

// linha corrompida no inventario nao derruba a busca
recusa(() => aplicarExpDeItem({ inventario: [null, undefined, { nome: 'x' }] }, {}, 'EXP+', 1), 'not-found');

console.log('✅ exp-item: todos os casos passaram');

// ===== LINHAS REPETIDAS SAO UM POCO SO =====
// O painel do mestre acrescenta item sem empilhar: em 01/09/2026 uma conta
// tinha TRES linhas "EXP" (2, 1 e 1). A versao anterior lia a quantidade so da
// primeira (2 de 4 disponiveis) e subtraia o pedido de CADA uma — gastar 1
// unidade apagava as outras duas. EXP e comprado com dinheiro.
const tres = () => ([
    { nome: 'EXP', quantidade: 2, isExp: true, expAmount: 2 },
    { nome: 'Amuleto', quantidade: 1 },
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
]);

assert.deepEqual(linhasDoItem(tres(), 'EXP'), [0, 2, 3]);
assert.deepEqual(linhasDoItem(tres(), 'Amuleto'), [1]);
assert.deepEqual(linhasDoItem(tres(), 'Nao existe'), []);

// gastar 1: sai da primeira linha, e SO dela
const g1 = consumirUnidades(tres(), 'EXP', 1);
assert.equal(g1.filter(l => l.nome === 'EXP').reduce((s, l) => s + l.quantidade, 0), 3,
    'sobram 3 das 4 unidades');
assert.equal(g1.filter(l => l.nome === 'EXP').length, 3, 'nenhuma linha foi apagada a toa');
assert.equal(g1.find(l => l.nome === 'Amuleto').quantidade, 1, 'o resto do inventario nao encosta');

// gastar 3: esvazia a primeira e a segunda
const g3 = consumirUnidades(tres(), 'EXP', 3);
assert.equal(g3.filter(l => l.nome === 'EXP').reduce((s, l) => s + l.quantidade, 0), 1);
assert.equal(g3.filter(l => l.nome === 'EXP').length, 1, 'as linhas zeradas saem');

// gastar tudo
assert.equal(consumirUnidades(tres(), 'EXP', 4).some(l => l.nome === 'EXP'), false);

// aplicarExpDeItem enxerga as 4 unidades, nao 2
const rPoco = aplicarExpDeItem({ inventario: tres() }, { exp: '10', exp_total: '10' }, 'EXP', 4);
assert.equal(rPoco.ganho, 8, '4 unidades x 2 EXP');
assert.equal(rPoco.exp, 18);
assert.equal(rPoco.restante, 0);
assert.equal(rPoco.inventario.some(l => l.nome === 'EXP'), false);

// pedir mais do que o total continua sendo recusado
assert.throws(() => aplicarExpDeItem({ inventario: tres() }, {}, 'EXP', 5), /tentou usar 5/);

// homonimo com OUTRO efeito nao entra no poco
const homonimo = [
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
    { nome: 'EXP', quantidade: 9, isExp: true, expAmount: 500 },
];
assert.deepEqual(linhasDoItem(homonimo, 'EXP'), [0], 'so a linha de mesmo efeito');
assert.equal(consumirUnidades(homonimo, 'EXP', 1).find(l => l.expAmount === 500).quantidade, 9,
    'a linha de 500 EXP nao foi tocada');

console.log('exp-item: linhas repetidas OK');
