// Rodar: node functions/item-para-mesa.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { itemParaCaixa, retirarDoRepertorio, idDaCaixa, PREFIXO_CAIXA } = require('./item-para-mesa.js');

// ===== o dono virtual da caixa =====
assert.equal(idDaCaixa('mesa7'), '__caixa_mestre__mesa7');
assert.ok(idDaCaixa('x').startsWith(PREFIXO_CAIXA), 'o painel encontra a caixa por este prefixo');

// ===== retirar do Reperterio =====
const inv = () => ([
    { nome: 'Informação x1', quantidade: 3, descricao: 'pista' },
    { nome: 'Amuleto', quantidade: 1 },
]);

const r1 = retirarDoRepertorio(inv(), 'Informação x1', 2);
assert.equal(r1.restante, 1);
assert.equal(r1.inventario.find(i => i.nome === 'Informação x1').quantidade, 1);
assert.equal(r1.inventario.length, 2, 'a outra linha continua');
assert.equal(r1.item.descricao, 'pista', 'devolve o item original, para copiar os dados');

const r2 = retirarDoRepertorio(inv(), 'Informação x1', 3);
assert.equal(r2.restante, 0);
assert.equal(r2.inventario.some(i => i.nome === 'Informação x1'), false, 'zerou: a linha sai');
assert.equal(r2.inventario.length, 1);

const original = inv();
retirarDoRepertorio(original, 'Amuleto', 1);
assert.equal(original.length, 2, 'nao altera o array original');

// recusas
const recusa = (fn, codigo, re) => {
    try { fn(); assert.fail('deveria recusar: ' + codigo); }
    catch (e) {
        assert.equal(e.codigo, codigo, `codigo errado (${e.codigo}): ${e.message}`);
        if (re) assert.match(e.message, re);
    }
};
recusa(() => retirarDoRepertorio(inv(), 'Nao existe', 1), 'not-found', /Repertório/);
recusa(() => retirarDoRepertorio(inv(), 'Amuleto', 2), 'failed-precondition', /tem 1 .* mandar 2/);
recusa(() => retirarDoRepertorio(inv(), 'Amuleto', 0), 'invalid-argument');
recusa(() => retirarDoRepertorio(inv(), 'Amuleto', -1), 'invalid-argument');
recusa(() => retirarDoRepertorio(inv(), 'Amuleto', 'x'), 'invalid-argument');
recusa(() => retirarDoRepertorio(null, 'Amuleto', 1), 'not-found');
recusa(() => retirarDoRepertorio([null, undefined], 'Amuleto', 1), 'not-found');

// ===== o documento que vai para a caixa =====
const doc = itemParaCaixa(
    { nome: 'Informação x1', descricao: 'uma pista', imagem: 'http://x/y.png' },
    { mesaId: 'mesa7', quantidade: 2, jogadorUid: 'uid1', jogador: 'Igor', agora: '2026-01-01T00:00:00Z' }
);

assert.equal(doc.characterId, '__caixa_mestre__mesa7', 'cai na caixa da mesa certa');
assert.equal(doc.ownerType, 'caixa');
assert.equal(doc.ownerUid, '', 'a caixa nao tem dono pessoal');
assert.equal(doc.nome, 'Informação x1');
assert.equal(doc.descricao, 'uma pista');
assert.equal(doc.imagem, 'http://x/y.png');
assert.equal(doc.quantidade, 2);
assert.ok(doc.id.startsWith('item-'), 'id no mesmo padrao do painel');

// medidas minimas: o motor de inventario faz conta com elas
assert.equal(doc.peso, 1);
assert.equal(doc.tamanho, 1);
assert.equal(doc.pressaoBase, 1);
for (const campo of ['peso', 'tamanho', 'pressaoBase', 'quantidade']) {
    assert.equal(typeof doc[campo], 'number', campo + ' tem de ser numero, nao texto');
}

// nasce desarmado
assert.equal(doc.equipado, false);
assert.equal(doc.slotAnatomico, null);
assert.equal(doc.parentItemId, null);
assert.equal(doc.ehContainer, false);
assert.equal(doc.equipavelEm, null);

// a marca de origem, que e o ponto
assert.equal(doc.criadoPor, 'jogador');
assert.equal(doc.origemRepertorio, true);
assert.equal(doc.origemJogador, 'Igor');
assert.equal(doc.origemJogadorUid, 'uid1');

// quantidade ausente ou lixo vira 1
assert.equal(itemParaCaixa({ nome: 'x' }, { mesaId: 'm' }).quantidade, 1);
assert.equal(itemParaCaixa({ nome: 'x' }, { mesaId: 'm', quantidade: 0 }).quantidade, 1);
assert.equal(itemParaCaixa({ nome: 'x' }, { mesaId: 'm', quantidade: -5 }).quantidade, 1);

// item sem nome nao vira doc anonimo
assert.equal(itemParaCaixa({}, { mesaId: 'm' }).nome, 'Item sem nome');

// dois envios seguidos nao colidem de id
const a = itemParaCaixa({ nome: 'x' }, { mesaId: 'm' });
const b = itemParaCaixa({ nome: 'x' }, { mesaId: 'm' });
assert.notEqual(a.id, b.id);

console.log('✅ item-para-mesa: todos os casos passaram');
