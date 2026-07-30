/**
 * Flag `escopo: 'global'` no vínculo de Valor Derivado do equipamento.
 *
 * Regras verificadas:
 *  • VD já global (sem escopoItem) sempre cai no bag do personagem;
 *  • VD escopado (Acerto/Dano) cai no bag do item por padrão;
 *  • o mesmo VD escopado com escopo:'global' cai no bag do personagem;
 *  • a flag não vaza para VD não escopado nem entre itens;
 *  • dois itens com escopo global acumulam no mesmo alvo.
 *
 * Roda com: node ficha-v1.7_1/js/vd-escopo-global.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./inventory.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Recorta só o laço que decide o bag — o resto de applyEquippedItemsMechanics
// depende de DOM, catálogo e do motor de mecânicas.
const ini = src.indexOf('if (dvList && dvList.length > 0 && window.DERIVED_VALUES) {');
assert.ok(ini > 0, 'bloco de VD não encontrado');
const MARCADOR = '\n            }';   // fecha o `if (dvList …)`, 12 espaços
const fim = src.indexOf(MARCADOR, src.indexOf('bag[targetKey]', ini));
assert.ok(fim > ini, 'fim do bloco de VD não encontrado');
const BLOCO = src.slice(ini, fim + MARCADOR.length);

const DVS = [
    { id: 'dv-blind', key: 'BLINDAGEM', escopoItem: '' },
    { id: 'dv-acerto', key: 'ACERTO', escopoItem: 'coluna' },
    { id: 'dv-dano', key: 'DANO', escopoItem: 'dano' },
];

/** Objetos criados dentro do vm têm outro Object.prototype; deepStrictEqual
 *  rejeitaria mesmo sendo idênticos. Normaliza para o realm do teste. */
const plain = o => JSON.parse(JSON.stringify(o));

/** Roda o bloco para um item e devolve os dois sacos. */
function aplicar(item, dvList) {
    const ctx = { console: { warn() {}, log() {} } };
    ctx.window = ctx;
    ctx.state = { mechanicBonuses: {}, itemBonuses: {} };
    ctx.DERIVED_VALUES = DVS;
    ctx.item = item;
    ctx.dvList = dvList;
    vm.createContext(ctx);
    vm.runInContext(BLOCO, ctx);
    return { global: plain(ctx.state.mechanicBonuses), porItem: plain(ctx.state.itemBonuses) };
}

const escudo = { id: 'escudo1', nome: 'Escudo Grande' };

// --- VD já global: sempre no personagem ------------------------------------
{
    const r = aplicar(escudo, [{ id: 'dv-blind', modificador: 3 }]);
    assert.deepEqual(r.global, { 'DERIVED:BLINDAGEM': 3 });
    assert.deepEqual(r.porItem, {}, 'VD global nunca vai para o bag do item');
}

// --- VD escopado sem flag: bag do item (comportamento atual preservado) -----
{
    const r = aplicar(escudo, [{ id: 'dv-acerto', modificador: -1 }]);
    assert.deepEqual(r.porItem, { escudo1: { 'DERIVED:ACERTO': -1 } },
        'sem a flag, Acerto continua na coluna do próprio item');
    assert.deepEqual(r.global, {});
}

// --- VD escudo com escopo global: bag do personagem ------------------------
{
    const r = aplicar(escudo, [{ id: 'dv-acerto', modificador: -1, escopo: 'global' }]);
    assert.deepEqual(r.global, { 'DERIVED:ACERTO': -1 },
        'com a flag, a penalidade do escudo atinge o Acerto do personagem');
    assert.deepEqual(r.porItem, {}, 'e não cria coluna no próprio escudo');
}

// --- a flag vale por vínculo, não contamina os vizinhos --------------------
{
    const r = aplicar(escudo, [
        { id: 'dv-acerto', modificador: -2, escopo: 'global' },
        { id: 'dv-dano', modificador: 5 },
        { id: 'dv-blind', modificador: 4 },
    ]);
    assert.deepEqual(r.global, { 'DERIVED:ACERTO': -2, 'DERIVED:BLINDAGEM': 4 });
    assert.deepEqual(r.porItem, { escudo1: { 'DERIVED:DANO': 5 } },
        'Dano sem flag segue escopado, mesmo com Acerto global no mesmo item');
}

// --- escopo diferente de 'global' não ativa nada ---------------------------
{
    const r = aplicar(escudo, [{ id: 'dv-acerto', modificador: -1, escopo: 'item' }]);
    assert.deepEqual(r.porItem, { escudo1: { 'DERIVED:ACERTO': -1 } },
        "só a string 'global' liga a flag");
}

// --- modificador 0 não cria entrada ----------------------------------------
{
    const r = aplicar(escudo, [{ id: 'dv-acerto', modificador: 0, escopo: 'global' }]);
    assert.deepEqual(r.global, {});
    assert.deepEqual(r.porItem, {});
}

// --- dois escudos acumulam no mesmo alvo global ----------------------------
{
    const ctx = { console: { warn() {}, log() {} } };
    ctx.window = ctx;
    ctx.state = { mechanicBonuses: {}, itemBonuses: {} };
    ctx.DERIVED_VALUES = DVS;
    vm.createContext(ctx);
    for (const [id, mod] of [['e1', -1], ['e2', -2]]) {
        ctx.item = { id };
        ctx.dvList = [{ id: 'dv-acerto', modificador: mod, escopo: 'global' }];
        vm.runInContext(BLOCO, ctx);
    }
    assert.deepEqual(plain(ctx.state.mechanicBonuses), { 'DERIVED:ACERTO': -3 },
        'dois itens com escopo global somam');
}

console.log('✅ vd-escopo-global: todos os casos passaram');
