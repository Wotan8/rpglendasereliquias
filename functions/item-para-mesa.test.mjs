// Rodar: node functions/item-para-mesa.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { itemParaCaixa, pecaParaAviso, retirarDoRepertorio, devolverAoRepertorio, idDaCaixa, PREFIXO_CAIXA } = require('./item-para-mesa.js');

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

// ===== a peca que o aviso guarda =====
// E dela que a recusa devolve. O doc de `items` nao serve: o jogador edita.
const pAviso = pecaParaAviso({ nome: 'Informação x1', descricao: 'pista', imagem: 'http://x/y.png' }, 2);
assert.deepEqual(pAviso, { nome: 'Informação x1', quantidade: 2, descricao: 'pista', imagem: 'http://x/y.png' });
assert.equal(pecaParaAviso({}, 0).quantidade, 1, 'quantidade nunca nasce menor que 1');
assert.equal(pecaParaAviso({}, -9).quantidade, 1);
assert.equal(pecaParaAviso({}, '3').quantidade, 3, 'aceita texto, como o resto do projeto');
assert.equal(pecaParaAviso({}, 1).nome, 'Item sem nome');

// ===== a volta: recusa devolve ao Reperterio =====
const naCaixa = { nome: 'Informação x1 (teste)', origemItemNome: 'Informação x1', quantidade: 2, descricao: 'pista', imagem: 'http://x/y.png' };

// a linha ainda existe (mandou so parte): soma nela
const v1 = devolverAoRepertorio([{ nome: 'Informação x1', quantidade: 1 }], naCaixa);
assert.equal(v1.length, 1, 'nao duplica a linha');
assert.equal(v1[0].quantidade, 3, '1 que sobrou + 2 devolvidos');

// a linha sumiu (mandou tudo): renasce com descricao e imagem
const v2 = devolverAoRepertorio([{ nome: 'Outro' }], naCaixa);
assert.equal(v2.length, 2);
const renascida = v2.find(i => i.nome === 'Informação x1');
assert.equal(renascida.quantidade, 2);
assert.equal(renascida.descricao, 'pista');
assert.equal(renascida.imagem, 'http://x/y.png');
assert.equal(renascida.formaRecebimento, 'Devolvido pelo mestre');

// o nome que vale e o de ORIGEM, nao o da caixa — e o merge e por ele
assert.equal(v2.some(i => i.nome === 'Informação x1 (teste)'), false);

// inventario vazio ou nulo nao explode
assert.equal(devolverAoRepertorio([], naCaixa).length, 1);
assert.equal(devolverAoRepertorio(null, naCaixa).length, 1);

// sem origemItemNome cai no nome da caixa; sem quantidade vale 1
const v3 = devolverAoRepertorio([], { nome: 'Peça' });
assert.equal(v3[0].nome, 'Peça');
assert.equal(v3[0].quantidade, 1);

// o array original nao e tocado
const antes = [{ nome: 'Informação x1', quantidade: 1 }];
devolverAoRepertorio(antes, naCaixa);
assert.equal(antes[0].quantidade, 1);

console.log('✅ item-para-mesa: todos os casos passaram');

// ===== A FORJA (item 3 da varredura) =====
// O jogador manda 1 bugiganga para a mesa, vira dono do doc da caixa criando
// `char/__caixa_mestre__<mesaId>`, e reescreve o doc para 999 unidades com o
// nome da linha mais cara do Repertorio. A recusa NAO pode olhar para isso.
const forjado = {
    nome: 'Bugiganga', origemItemNome: 'Pacote de 500 EXP', quantidade: 999,
    descricao: 'forjado', imagem: '',
};
const repertorio = [{ nome: 'Pacote de 500 EXP', quantidade: 1, isExp: true, expAmount: 500 }];

// o que a recusa usa hoje: a peca do aviso, gravada no envio
const pecaReal = pecaParaAviso({ nome: 'Bugiganga', descricao: 'nada', imagem: '' }, 1);
const depois = devolverAoRepertorio(repertorio, pecaReal);
assert.equal(depois.find(i => i.nome === 'Pacote de 500 EXP').quantidade, 1,
    'a linha cara nao encosta: o aviso diz que foi 1x Bugiganga');
assert.equal(depois.find(i => i.nome === 'Bugiganga').quantidade, 1);

// e a prova de que o caminho antigo creditava a forja
const seLesseODoc = devolverAoRepertorio(repertorio, forjado);
assert.equal(seLesseODoc.find(i => i.nome === 'Pacote de 500 EXP').quantidade, 1000,
    'era isto que acontecia lendo o documento de items: 500 mil EXP de graca');

console.log('item-para-mesa.test.mjs: OK');
