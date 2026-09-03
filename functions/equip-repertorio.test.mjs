// Rodar: node functions/equip-repertorio.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { equipamentosDoItem, planejarEntrega } = require('./equip-repertorio.js');

const kit = (extra = {}) => ({
    nome: 'Kit do Batedor', isItemPersonagem: true, quantidade: 1,
    personagemItensVinculados: [{ itemId: 'eq-corda', quantidade: 2 }, { itemId: 'eq-lanterna' }],
    ...extra,
});

// ===== o que o pacote entrega =====
assert.deepEqual(equipamentosDoItem(kit()), [
    { equipId: 'eq-corda', porUnidade: 2 },
    { equipId: 'eq-lanterna', porUnidade: 1 },
], 'quantidade ausente vale 1');

// O cadastro antigo guardava so o id. O assistente de criacao ja lia as duas
// formas; ler so a nova aqui faria o pacote antigo entregar zero, em silencio.
assert.deepEqual(equipamentosDoItem({ personagemItensVinculados: ['eq-a', 'eq-b'] }), [
    { equipId: 'eq-a', porUnidade: 1 }, { equipId: 'eq-b', porUnidade: 1 },
], 'forma legada (string) continua valendo');
assert.deepEqual(equipamentosDoItem({ personagemItensVinculados: [{ id: 'eq-c', quantidade: 3 }] }),
    [{ equipId: 'eq-c', porUnidade: 3 }], '`id` tambem serve de chave');
assert.deepEqual(equipamentosDoItem({ personagemItensVinculados: [null, {}, { itemId: '' }] }), [],
    'entrada sem id nao vira entrega fantasma');
assert.deepEqual(equipamentosDoItem({}), []);
assert.deepEqual(equipamentosDoItem(null), []);
assert.deepEqual(equipamentosDoItem({ personagemItensVinculados: 'nao e lista' }), []);
assert.deepEqual(equipamentosDoItem({ personagemItensVinculados: [{ itemId: 'eq-d', quantidade: 0 }] }),
    [{ equipId: 'eq-d', porUnidade: 1 }], 'zero vale 1, senao o pacote entrega nada');

// ===== o plano de entrega =====
const usuario = { inventario: [{ nome: 'Poção', quantidade: 4 }, kit({ quantidade: 3 })] };

const p1 = planejarEntrega(usuario, 'Kit do Batedor', 1);
assert.deepEqual(p1.entregas, [
    { equipId: 'eq-corda', quantidade: 2 }, { equipId: 'eq-lanterna', quantidade: 1 }]);
assert.equal(p1.restante, 2);
assert.equal(p1.inventario[1].quantidade, 2, 'gasta uma unidade do pacote');
assert.equal(usuario.inventario[1].quantidade, 3, 'o inventario original nao e tocado');

// Duas unidades multiplicam CADA equipamento vinculado.
const p2 = planejarEntrega(usuario, 'Kit do Batedor', 2);
assert.deepEqual(p2.entregas, [
    { equipId: 'eq-corda', quantidade: 4 }, { equipId: 'eq-lanterna', quantidade: 2 }]);
assert.equal(p2.restante, 1);

// A ultima unidade leva a linha embora: pacote com quantidade 0 no Repertorio
// e entulho que o jogador nao distingue do que ele ainda tem.
const p3 = planejarEntrega(usuario, 'Kit do Batedor', 3);
assert.equal(p3.restante, 0);
assert.equal(p3.inventario.length, 1);
assert.equal(p3.inventario[0].nome, 'Poção');

// Linhas iguais sao UM poco so — o painel do mestre acrescenta sem empilhar.
const duasLinhas = { inventario: [kit({ quantidade: 1 }), kit({ quantidade: 2 })] };
const p4 = planejarEntrega(duasLinhas, 'Kit do Batedor', 3);
assert.deepEqual(p4.entregas, [
    { equipId: 'eq-corda', quantidade: 6 }, { equipId: 'eq-lanterna', quantidade: 3 }]);
assert.equal(p4.inventario.length, 0, 'as duas linhas se esvaziam juntas');

// ===== o que tem de ser recusado =====
assert.throws(() => planejarEntrega(usuario, 'Kit do Batedor', 4),
    /Você tem 3 .* e tentou usar 4/, 'nao entrega mais do que ele tem');
assert.throws(() => planejarEntrega(usuario, 'Kit do Batedor', 0), /quantas unidades/);
assert.throws(() => planejarEntrega(usuario, 'Kit do Batedor', -1), /quantas unidades/);
assert.throws(() => planejarEntrega(usuario, 'Kit Inexistente', 1), /não está no seu Repertório/);
assert.throws(() => planejarEntrega({ inventario: [{ nome: 'Poção', quantidade: 1 }] }, 'Poção', 1),
    /não traz equipamento nenhum/, 'poção não vira equipamento por engano');
assert.throws(() => planejarEntrega({}, 'Kit do Batedor', 1), /não está no seu Repertório/);

// Cada erro carrega o codigo que a callable traduz em HttpsError.
try { planejarEntrega(usuario, 'Kit Inexistente', 1); } catch (e) {
    assert.equal(e.codigo, 'not-found');
}
try { planejarEntrega(usuario, 'Kit do Batedor', 0); } catch (e) {
    assert.equal(e.codigo, 'invalid-argument');
}

console.log('equip-repertorio: ok');
