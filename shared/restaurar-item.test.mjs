// Rodar: node shared/restaurar-item.test.mjs
//
// O risco desta função não é ela deixar de copiar o cadastro — é ela copiar
// DEMAIS: se o patch encostar em quantidade, dono ou slot, restaurar um item
// equipado o tira da mão do personagem, ou duplica pilha. Por isso metade dos
// casos aqui é sobre o que o patch NÃO pode conter.
import assert from 'node:assert/strict';
import { patchRestauracao, modeloDoItem, textoConfirmacao, botaoRestaurarHTML } from './restaurar-item.js';

const RABECA = {
    id: 'eq_rabeca', nome: 'Rabeca', tipo: 'Objeto',
    tags: ['Instrumento', 'Corda'], descricao: 'Violino rústico do interior.',
    peso: 1.2, tamanho: 2, imagemUrl: 'rabeca.png',
    equipavelEm: ['mao'], formaEquipar: 'empunhar',
    mecanicaIds: ['mec_harmonia'], valoresDerivadosVinculados: [{ id: 'vd1', modificador: 2 }],
};

// A peça na mesa: renomeada, sem as tags, com dano inventado e equipada na mão.
const ITEM = {
    id: 'item-123', modeloId: 'eq_rabeca',
    nome: 'Vespa, a Voz Dourada', tipo: 'Objeto', tags: [],
    formulaDano: '2d20', peso: 99, quantidade: 3,
    characterId: 'npc_bardo', ownerUid: 'u1', ownerType: 'npc',
    equipado: true, slotAnatomico: 'mao_1', estadoEquip: 'empunhado', parentItemId: null,
};

/* ===== 1) traz o cadastro de volta ===== */
const p = patchRestauracao(RABECA);
assert.equal(p.nome, 'Rabeca');
assert.deepEqual(p.tags, ['Instrumento', 'Corda'], 'as tags do catálogo voltam (é delas que sai o foco de conjuração)');
assert.equal(p.imagem, 'rabeca.png', 'a instância guarda a imagem em `imagem`, não em `imagemUrl`');
assert.equal(p.imagemUrl, undefined, 'e não pode gravar a chave do catálogo na instância');
assert.deepEqual(p.mecanicaIdsProprias, ['mec_harmonia'], 'mecanicaIds do modelo → mecanicaIdsProprias da peça');
assert.equal(p.mecanicaIds, undefined);
assert.equal(p.peso, 1.2, 'o peso inventado na peça some');
assert.equal(p.modeloId, 'eq_rabeca', 'a procedência fica');

/* ===== 2) o que o modelo NÃO define vira null (senão o merge preserva a gambiarra) ===== */
assert.equal(p.formulaDano, null, 'o dano inventado tem de ser APAGADO, não apenas ignorado');
assert.ok('condicaoIds' in p && p.condicaoIds === null, 'todo campo de cadastro aparece no patch');

/* ===== 3) o que é do DONO não se toca ===== */
for (const k of ['quantidade', 'characterId', 'ownerUid', 'ownerId', 'ownerType',
                 'equipado', 'slotAnatomico', 'slotsOcupados', 'estadoEquip',
                 'parentItemId', 'containerId', 'criadoPor', 'id']) {
    assert.ok(!(k in p), `restaurar não pode mexer em "${k}" — é posse, não cadastro`);
}

/* ===== 4) as normalizações que os formulários já faziam ===== */
const semContainer = patchRestauracao({ id: 'x', nome: 'Saco', tipo: 'Objeto', pesoMaximoContainer: 8 });
assert.equal(semContainer.ehContainer, false);
assert.equal(semContainer.pesoMaximoContainer, null, 'campo de container morre em item que não é container');
assert.equal(semContainer.peso, 1, 'peso ausente cai em 1');
assert.equal(semContainer.pressaoBase, 1, 'sem Pressão Base cadastrada, vale o peso');

const container = patchRestauracao({ id: 'x', nome: 'Mochila', tipo: 'Container', pesoMaximoContainer: 8 });
assert.equal(container.ehContainer, true, 'tipo Container é container mesmo sem a caixinha marcada');
assert.equal(container.pesoMaximoContainer, 8);

const naoArma = patchRestauracao({ id: 'x', nome: 'Corda', tipo: 'Objeto', categoriaArma: 'uma_mao' });
assert.equal(naoArma.categoriaArma, null, 'categoria de arma só vale em Arma');

const livre = patchRestauracao({ id: 'x', nome: 'Moeda', tipo: 'Objeto', equipavelEm: [] });
assert.equal(livre.equipavelEm, null, 'lista vazia é item Livre, e o motor espera null');

// "Segurar" desliga todo efeito: arma cadastrada assim ficaria muda na ficha.
const espada = patchRestauracao({ id: 'x', nome: 'Espada', tipo: 'Arma', formaEquipar: 'segurar', formulaDano: '1d8' });
assert.equal(espada.formaEquipar, 'empunhar');
const erva = patchRestauracao({ id: 'x', nome: 'Erva', tipo: 'Objeto', formaEquipar: 'segurar' });
assert.equal(erva.formaEquipar, 'segurar', 'peça inerte continua Segurar');

// A checagem tem de enxergar as mecânicas do MODELO, que ainda se chamam mecanicaIds.
const tocha = patchRestauracao({ id: 'x', nome: 'Tocha', tipo: 'Objeto', formaEquipar: 'segurar', mecanicaIds: ['m1'] });
assert.equal(tocha.formaEquipar, 'empunhar', 'item com mecânica aplica efeito → Empunhar');

/* ===== 5) legado das telas antigas ===== */
assert.equal(p.name, 'Rabeca', 'o repertório do Mestre lê `name`');
assert.equal(p.description, 'Violino rústico do interior.');

/* ===== 6) sem modelo, não há a que restaurar ===== */
assert.equal(patchRestauracao(null), null);
assert.equal(patchRestauracao({ nome: 'sem id' }), null);
assert.equal(modeloDoItem({ nome: 'avulso' }, [RABECA]), null);
assert.equal(modeloDoItem(ITEM, [RABECA]), RABECA);
assert.equal(modeloDoItem({ origemTemplateId: 'eq_rabeca' }, [RABECA]), RABECA, 'o vínculo legado também conta');
assert.equal(modeloDoItem(ITEM, []), null, 'modelo apagado do catálogo = nada a restaurar');

/* ===== 7) o aviso e o botão ===== */
const txt = textoConfirmacao(ITEM, RABECA);
assert.match(txt, /Vespa, a Voz Dourada/);
assert.match(txt, /Rabeca/);
assert.match(txt, /NÃO mudam/, 'o Mestre precisa ler que a posse não muda antes de confirmar');
assert.match(botaoRestaurarHTML('window.x()'), /onclick="window\.x\(\)"/);

console.log('✅ restaurar-item OK — o cadastro volta inteiro e a posse fica intacta');
