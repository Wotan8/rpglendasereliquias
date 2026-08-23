// Rodar: node --test shared/equip-guarda.test.mjs
//
// EQUIPAR versus GUARDAR. Uma peça tem duas listas de partes: onde é usada
// (`equipavelEm`, na Forma de Equipar dela) e onde é só carregada
// (`equipavelEmGuardado`, sempre Fixado, sempre sem efeito).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// equip-slots.js é script CLÁSSICO (dois dos três consumidores não são módulos).
const raiz = dirname(fileURLToPath(import.meta.url));
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(raiz, 'equip-slots.js'), 'utf8'), sandbox);
const ES = sandbox.window.EquipSlots;
/* O vm cria os objetos em outro realm, e deepEqual estrito compara protótipo.
   `plain` traz o valor de volta para este realm antes de comparar. */
const plain = (v) => JSON.parse(JSON.stringify(v));

// Partes reais do banco, com as flags que elas têm de verdade
const MAO = { id: 'bp-mao', nome: 'Mão', podeSegurar: true, podeEmpunhar: true, podeVestir: true, podeFixar: true };
const COSTAS = { id: 'bp-costas', nome: 'Costas', podeVestir: true, podeFixar: true };
const BRACO = { id: 'bp-braco', nome: 'Braço', podeVestir: true, podeFixar: true };
const CABECA = { id: 'bp-cabeca', nome: 'Cabeça', podeVestir: true };

// O caso que motivou tudo: Arco Curto, "Mão, Costas" com forma empunhar
const arco = { nome: 'Arco Curto', formaEquipar: 'empunhar', equipavelEm: ['bp-mao'], equipavelEmGuardado: ['bp-costas'] };

test('na parte de uso vale a Forma de Equipar da peça', () => {
    assert.deepEqual(plain(ES.formaNoSlot(arco, 'bp-mao')), { guarda: false, forma: 'empunhar' });
    assert.deepEqual(plain(ES.estadosNoSlot(arco, MAO)), ['empunhado']);
});

test('na parte de guarda a peça só pode ser Fixada', () => {
    assert.deepEqual(plain(ES.formaNoSlot(arco, 'bp-costas')), { guarda: true, forma: 'fixar' });
    assert.deepEqual(plain(ES.estadosNoSlot(arco, COSTAS)), ['fixado']);
});

test('parte fora das duas listas não recebe a peça', () => {
    assert.equal(ES.aceitaSlot(arco, 'bp-cabeca'), false);
    assert.deepEqual(plain(ES.estadosNoSlot(arco, CABECA)), []);
});

test('guardar em MAIS DE UMA parte', () => {
    // Alaúde: tocado na mão, carregado no pescoço OU nas costas
    const alaude = { formaEquipar: 'empunhar', equipavelEm: ['bp-mao'], equipavelEmGuardado: ['bp-costas', 'bp-braco'] };
    assert.deepEqual(plain(ES.estadosNoSlot(alaude, COSTAS)), ['fixado']);
    assert.deepEqual(plain(ES.estadosNoSlot(alaude, BRACO)), ['fixado']);
    assert.deepEqual(plain(ES.estadosNoSlot(alaude, MAO)), ['empunhado']);
});

test('parte de guarda que não sabe fixar cai para segurar, e senão recusa', () => {
    const semFixar = { id: 'bp-x', nome: 'X', podeSegurar: true };
    const soVestir = { id: 'bp-y', nome: 'Y', podeVestir: true };
    const peca = { formaEquipar: 'empunhar', equipavelEm: ['bp-mao'], equipavelEmGuardado: ['bp-x', 'bp-y'] };
    assert.deepEqual(plain(ES.estadosNoSlot(peca, semFixar)), ['segurar']);
    assert.deepEqual(plain(ES.estadosNoSlot(peca, soVestir)), [], 'parte que só veste não guarda nada');
});

test('sem restrição nenhuma, a Forma de Equipar continua mandando', () => {
    const solto = { formaEquipar: 'vestir' };
    assert.deepEqual(plain(ES.estadosNoSlot(solto, COSTAS)), ['vestido']);
    assert.deepEqual(plain(ES.estadosNoSlot(solto, MAO)), ['vestido']);
    assert.equal(ES.aceitaSlot(solto, 'bp-cabeca'), true);
});

test('peça sem Forma de Equipar aceita o que a parte souber fazer', () => {
    const legado = { equipavelEm: ['bp-mao'] };
    assert.deepEqual(plain(ES.estadosNoSlot(legado, MAO)).sort(), ['empunhado', 'fixado', 'segurar', 'vestido']);
});

test('a lista de guarda também herda do modelo do catálogo', () => {
    const catalogo = [{ id: 'tpl1', equipavelEm: ['bp-mao'], equipavelEmGuardado: ['bp-costas'] }];
    const instancia = { modeloId: 'tpl1', formaEquipar: 'empunhar' };
    assert.deepEqual(plain(ES.partesDeGuarda(instancia, catalogo)), ['bp-costas']);
    assert.deepEqual(plain(ES.estadosNoSlot(instancia, COSTAS, catalogo)), ['fixado']);
});

test('a instância vence o modelo', () => {
    const catalogo = [{ id: 'tpl1', equipavelEmGuardado: ['bp-costas'] }];
    const instancia = { modeloId: 'tpl1', equipavelEmGuardado: ['bp-braco'] };
    assert.deepEqual(plain(ES.partesDeGuarda(instancia, catalogo)), ['bp-braco']);
});

test('parte SEM flag nenhuma e dado legado, nao proibicao', () => {
    // Copia velha de personagem, NPC importado, semeadura de teste: bloquear
    // tudo ali trancaria a ficha antiga fora do proprio corpo.
    const crua = { id: 'bp-crua', nome: 'Mao (copia velha)' };
    assert.deepEqual(plain(ES.estadosNoSlot({ formaEquipar: 'empunhar' }, crua)), ['empunhado']);
    assert.deepEqual(plain(ES.estadosNoSlot({}, crua)), ['segurar'], 'sem forma cadastrada, o minimo');
    const guardado = { formaEquipar: 'empunhar', equipavelEm: ['bp-mao'], equipavelEmGuardado: ['bp-crua'] };
    assert.deepEqual(plain(ES.estadosNoSlot(guardado, crua)), ['fixado'], 'guarda continua sendo guarda');
});

test('o legado slotRestrito continua valendo como parte de uso', () => {
    const velho = { formaEquipar: 'empunhar', slotRestrito: ['bp-mao'] };
    assert.deepEqual(plain(ES.partesDeUso(velho)), ['bp-mao']);
    assert.equal(ES.aceitaSlot(velho, 'bp-costas'), false);
});
