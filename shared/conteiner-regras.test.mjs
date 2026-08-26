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
    assert.match(av, /30 kg de 20 kg/);
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

// ===== A BOCA DO CONTÊINER (tamanhoMaximoItem) =====

const aljava = { id: 'c3', nome: 'Aljava de Caça', ehContainer: true, tamanhoMaximoItem: 0.9, tagsAceitas: ['Flecha'] };
const flecha = { id: 'f1', nome: 'Flecha de Penacho', tipo: 'Projétil', peso: 0.05, tamanho: 0.7, tags: ['Flecha'] };
const lanca = { id: 'l1', nome: 'Lança', tipo: 'Arma', peso: 1.8, tamanho: 2, tags: ['Haste'] };

test('item maior que a boca não entra, por mais vazio que esteja', () => {
    const bolso = { id: 'c9', nome: 'Bolso', ehContainer: true, tamanhoMaximoItem: 0.6 };
    const r = cabeNoConteiner(lanca, bolso, [bolso, lanca]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /não passa na boca/i);
    assert.match(r.motivo, /2 m de 60 cm/);          // unidade adaptativa no aviso
});

test('item do tamanho exato da boca passa', () => {
    const c = { id: 'c9', nome: 'Bolso', ehContainer: true, tamanhoMaximoItem: 0.7 };
    assert.equal(cabeNoConteiner(flecha, c, [c, flecha]).ok, true);
});

test('sem tamanhoMaximoItem cadastrado, qualquer coisa entra', () => {
    assert.equal(cabeNoConteiner(lanca, mochila, [mochila, lanca]).ok, true);
});

test('item sem tamanho é presumido de 1 m, não minúsculo', () => {
    const c = { id: 'c9', nome: 'Bolso', ehContainer: true, tamanhoMaximoItem: 0.5 };
    const semMedida = { id: 'x', nome: 'Coisa', peso: 1 };
    assert.equal(cabeNoConteiner(semMedida, c, [c, semMedida]).ok, false);
});

// ===== CONTÊINER DE PROPÓSITO ÚNICO (tagsAceitas) =====

test('aljava aceita flecha e recusa o resto, dizendo o que aceita', () => {
    assert.equal(cabeNoConteiner(flecha, aljava, [aljava, flecha]).ok, true);
    // peça PEQUENA de tag errada: sem isto o teste mediria a boca, não a tag
    const faca = { id: 'k1', nome: 'Faca', tipo: 'Arma', peso: 0.2, tamanho: 0.25, tags: ['Adaga'] };
    const r = cabeNoConteiner(faca, aljava, [aljava, faca]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /só aceita Flecha/i);
});

test('a boca é conferida antes da tag — o motivo é o primeiro obstáculo', () => {
    const r = cabeNoConteiner(lanca, aljava, [aljava, lanca]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /não passa na boca/i);
});

test('a lista de tags é OU, não E', () => {
    const c = { id: 'c4', nome: 'Aljava mista', ehContainer: true, tagsAceitas: ['Flecha', 'Virote'] };
    const virote = { id: 'v1', nome: 'Virote', tipo: 'Projétil', peso: 0.08, tamanho: 0.4, tags: ['Virote'] };
    assert.equal(cabeNoConteiner(virote, c, [c, virote]).ok, true);
    assert.equal(cabeNoConteiner(flecha, c, [c, flecha]).ok, true);
});

test('tag confere sem ligar para maiúscula nem espaço', () => {
    const c = { id: 'c5', nome: 'Bolsa', ehContainer: true, tagsAceitas: [' moeda '] };
    const lunTag = { id: 'm1', nome: 'Lun', peso: 0.01, tamanho: 0.02, tags: ['Moeda'] };
    assert.equal(cabeNoConteiner(lunTag, c, [c, lunTag]).ok, true);
});

test('tagsAceitas em texto separado por vírgula também vale', () => {
    const c = { id: 'c6', nome: 'Bolsa', ehContainer: true, tagsAceitas: 'Moeda, Gema' };
    const lunTag = { id: 'm1', nome: 'Lun', peso: 0.01, tags: ['Moeda'] };
    assert.equal(cabeNoConteiner(lunTag, c, [c, lunTag]).ok, true);
    assert.equal(cabeNoConteiner(corda, c, [c, corda]).ok, false);
});

test('item sem tag nenhuma não entra em contêiner de propósito único', () => {
    assert.equal(cabeNoConteiner({ id: 'z', nome: 'Coisa', peso: 1 }, aljava, [aljava]).ok, false);
});

test('as travas novas herdam do modelo do catálogo', () => {
    const instancia = { id: 'c7', nome: 'Aljava', ehContainer: true };
    const modelo = { tamanhoMaximoItem: 0.9, tagsAceitas: ['Flecha'] };
    assert.equal(cabeNoConteiner(flecha, instancia, [instancia, flecha], modelo).ok, true);
    assert.equal(cabeNoConteiner(corda, instancia, [instancia, corda], modelo).ok, false);
});
