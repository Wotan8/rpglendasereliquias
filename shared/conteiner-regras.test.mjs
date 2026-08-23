// Rodar: node --test shared/conteiner-regras.test.mjs
//
// O que cabe dentro de um contêiner. Capacidade é TRAVA (recusa a soltura),
// peso é AVISO (deixa guardar e marca). Vazio/zero = sem limite — a maioria dos
// contêineres vivos tem os campos em branco e não pode passar a recusar tudo.
import assert from 'node:assert/strict';
import test from 'node:test';
import { cabeNoConteiner, avisoDePeso, capacidadeDe, pesoMaxDe, pesoDentro } from './inventario-motor.js';

const saco = { id: 'c1', nome: 'Saco de Luns Simples', ehContainer: true, peso: 0.05, capacidadeContainer: 1, pesoMaximoContainer: 20 };
const lun = { id: 'i1', nome: 'Lun', tipo: 'Objeto', peso: 0.01, quantidade: 47 };
const corda = { id: 'i2', nome: 'Corda', tipo: 'Objeto', peso: 3, quantidade: 1 };
const mochila = { id: 'c2', nome: 'Mochila', ehContainer: true, peso: 1 };   // sem limites

test('capacidade livre aceita', () => {
    assert.equal(cabeNoConteiner(lun, saco, [saco, lun]).ok, true);
});

test('capacidade cheia recusa e diz quanto', () => {
    const dentro = { id: 'i9', nome: 'Pena', peso: 0.01, parentItemId: 'c1' };
    const r = cabeNoConteiner(lun, saco, [saco, lun, dentro]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /cheio: 1\/1/i);
});

test('contêiner sem capacidade cadastrada não tem limite', () => {
    const muitos = Array.from({ length: 50 }, (_, n) => ({ id: 'x' + n, peso: 1, parentItemId: 'c2' }));
    assert.equal(cabeNoConteiner(lun, mochila, [mochila, lun, ...muitos]).ok, true);
});

test('contêiner não entra em contêiner', () => {
    const r = cabeNoConteiner(mochila, saco, [saco, mochila]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /não entra/i);
});

test('item já dentro não reclama — recusa calada', () => {
    const dentro = { ...lun, parentItemId: 'c1' };
    const r = cabeNoConteiner(dentro, saco, [saco, dentro]);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, '');
});

test('o conteúdo atual nunca é revalidado — bolsa já estourada segue funcionando', () => {
    // 3 itens numa capacidade 1: dado real de mesa em andamento. O 4o é recusado
    // pela capacidade, mas nada trava sozinho e nada é expulso.
    const velhos = [1, 2, 3].map(n => ({ id: 'v' + n, peso: 0.1, parentItemId: 'c1' }));
    const r = cabeNoConteiner(lun, saco, [saco, lun, ...velhos]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /3\/1/);
});

test('peso avisa mas nunca trava', () => {
    // 47 Luns = 0,47 kg num teto de 20: passa sem aviso
    assert.equal(avisoDePeso(lun, saco, [saco, lun], null), null);
    // 10 cordas de 3 kg = 30 kg no mesmo teto: avisa, e cabeNoConteiner segue ok
    const pesado = { ...corda, quantidade: 10 };
    const av = avisoDePeso(pesado, saco, [saco, pesado], null);
    assert.match(av, /30\.00 kg de 20/);
    assert.equal(cabeNoConteiner(pesado, saco, [saco, pesado]).ok, true);
});

test('peso soma a pilha, não a unidade', () => {
    const dez = { ...corda, quantidade: 10, parentItemId: 'c1' };
    assert.equal(pesoDentro('c1', [dez]), 30);
});

test('o modelo do catálogo cobre a instância em branco', () => {
    const inst = { id: 'c3', ehContainer: true };
    const tpl = { capacidadeContainer: 4, pesoMaximoContainer: 12 };
    assert.equal(capacidadeDe(inst, tpl), 4);
    assert.equal(pesoMaxDe(inst, tpl), 12);
    // e a instância vence o modelo quando preenchida
    assert.equal(capacidadeDe({ ...inst, capacidadeContainer: 2 }, tpl), 2);
});

test('destino que não é contêiner recusa', () => {
    assert.equal(cabeNoConteiner(lun, corda, [corda, lun]).ok, false);
});
