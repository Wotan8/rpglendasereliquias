/**
 * Refs "Projétil: ..." — o maço apontado pela arma em escopo.
 *
 * Regras verificadas:
 *  • Qualidade/Afiação vêm do projétil apontado (projetilId), não da arma;
 *  • instância do projétil vence o modelo; modelo cobre a instância;
 *  • campo antigo `fio` no projétil ainda alimenta a Qualidade (alias);
 *  • sem projetilId, com id pendurado em item deletado, ou sem escopo → 0.
 *
 * Roda com: node ficha-v1.7_1/js/projetil-props.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./mechanics-engine.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('const _ME_ITEM_PROPS = {');
const fim = src.indexOf('\n}\n', src.indexOf('function _meProjetilProp(prop)')) + 3;
assert.ok(ini > 0 && fim > ini, '_ME_ITEM_PROPS / _meProjetilProp não encontrados');

function prop(nome, { escopo = 'w1', items = [], catalog = [] } = {}) {
    const sandbox = { window: { _inventoryState: { items, catalog } }, resultado: null };
    vm.createContext(sandbox);
    vm.runInContext(`let _meItemScope = ${JSON.stringify(escopo)};\n${src.slice(ini, fim)}\nresultado = _meProjetilProp(${JSON.stringify(nome)});`, sandbox);
    return sandbox.resultado;
}

const TPL_FLECHA = { id: 'tplFlecha', nome: 'Flecha de Guerra', qualidade: '2', afiacao: 2 };
const arco = { id: 'w1', nome: 'Arco Longo', projetilId: 'p1' };
const flecha = { id: 'p1', nome: 'Flecha de Guerra', modeloId: 'tplFlecha', quantidade: 20 };

// O maço alimenta a arma: Qualidade e Afiação são da flecha
assert.equal(prop('Qualidade', { items: [arco, flecha], catalog: [TPL_FLECHA] }), 2, 'Qualidade vem do modelo do maço');
assert.equal(prop('Afiação', { items: [arco, flecha], catalog: [TPL_FLECHA] }), 2, 'Afiação idem');

// Instância do maço vence o modelo (um maço reafiado não muda o catálogo)
assert.equal(prop('Qualidade', { items: [arco, { ...flecha, qualidade: 1 }], catalog: [TPL_FLECHA] }), 1, 'instância vence');

// Maço antigo com campo `fio` continua valendo (alias da migração)
assert.equal(prop('Qualidade', { items: [arco, { ...flecha, modeloId: 'tplVelho' }], catalog: [{ id: 'tplVelho', fio: '3' }] }), 3, 'fio antigo alimenta');

// Sem vínculo não há poder — e nunca NaN
assert.equal(prop('Qualidade', { items: [{ id: 'w1', nome: 'Arco' }, flecha], catalog: [TPL_FLECHA] }), 0, 'arma sem projetilId vale 0');
assert.equal(prop('Qualidade', { items: [arco], catalog: [TPL_FLECHA] }), 0, 'projétil deletado vale 0');
assert.equal(prop('Qualidade', { escopo: null, items: [arco, flecha], catalog: [TPL_FLECHA] }), 0, 'sem escopo vale 0');
assert.equal(prop('Cor', { items: [arco, flecha], catalog: [TPL_FLECHA] }), 0, 'propriedade inexistente vale 0');

console.log('✅ refs "Projétil: ..." OK — maço apontado, aliases e ausências');
