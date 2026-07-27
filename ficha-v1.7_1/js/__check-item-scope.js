/* Autoteste do cálculo de valores escopados por item.
 * Roda com: node ficha-v1.7_1/js/__check-item-scope.js
 * Sem framework — só assert. Falha ruidosamente se a lógica quebrar. */

const assert = require('assert');
const { computeItemScopedTotals, applyItemBag, getItemFormulaDano } = require('./item-scope-calc.js');

const DVS = [
    { key: 'ACERTO', nome: 'Acerto', icone: '🎯', escopoItem: 'coluna' },
    { key: 'BONUS_DANO', nome: 'Bônus de Dano', icone: '💥', escopoItem: 'dano' },
    { key: 'APARAR', nome: 'Teste de Aparar', icone: '🛡️', escopoItem: 'coluna' },
    { key: 'CARGA', nome: 'Carga', icone: '⚖️', escopoItem: '' },   // global, deve ser ignorado
];

// Base global do personagem (raça/classe/peculiaridade já somadas)
const DERIVED = { ACERTO: 5, BONUS_DANO: 2, APARAR: 3, CARGA: 40 };

const CATALOG = [{ id: 'tpl-espada', nome: 'Espada Longa', formulaDano: '1d10' }];

// --- 1) Duas armas equipadas NÃO somam no mesmo Acerto ---
{
    const itemBonuses = {
        espada: { 'DERIVED:ACERTO': 2 },
        adaga: { 'DERIVED:ACERTO': 1 },
    };
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses, catalog: CATALOG };

    const espada = computeItemScopedTotals({ id: 'espada', modeloId: 'tpl-espada' }, ctx);
    const adaga = computeItemScopedTotals({ id: 'adaga', formulaDano: '1d4' }, ctx);

    const acEspada = espada.colunas.find(c => c.key === 'ACERTO');
    const acAdaga = adaga.colunas.find(c => c.key === 'ACERTO');

    assert.strictEqual(acEspada.total, 7, 'espada: base 5 + 2 = 7');
    assert.strictEqual(acAdaga.total, 6, 'adaga: base 5 + 1 = 6');
    assert.strictEqual(acEspada.base, 5, 'base global preservada');
    assert.strictEqual(acEspada.bonus, 2, 'delta isolado do item');
}

// --- 2) DV global (sem escopoItem) nunca vira coluna ---
{
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses: {}, catalog: CATALOG };
    const r = computeItemScopedTotals({ id: 'x', formulaDano: '1d6' }, ctx);
    assert.ok(!r.colunas.some(c => c.key === 'CARGA'), 'Carga é global, não pode virar coluna');
}

// --- 3) Fórmula de dano concatena o total do DV marcado como 'dano' ---
{
    const itemBonuses = { espada: { 'DERIVED:BONUS_DANO': 3 } };
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses, catalog: CATALOG };
    const r = computeItemScopedTotals({ id: 'espada', modeloId: 'tpl-espada' }, ctx);
    // base 2 (global) + 3 (item) = 5  →  "1d10+5"
    assert.strictEqual(r.dano, '1d10+5', `dano composto errado: ${r.dano}`);
}

// --- 4) Bônus de dano negativo usa o próprio sinal ---
{
    const itemBonuses = { maca: { 'DERIVED:BONUS_DANO': -5 } };
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses, catalog: CATALOG };
    const r = computeItemScopedTotals({ id: 'maca', formulaDano: '2d6' }, ctx);
    assert.strictEqual(r.dano, '2d6-3', `esperado 2d6-3, veio ${r.dano}`);
}

// --- 5) Bônus zerado some da fórmula (sem "1d10+0") ---
{
    const ctx = { derivedValues: DVS, derived: { ...DERIVED, BONUS_DANO: 0 }, itemBonuses: {}, catalog: CATALOG };
    const r = computeItemScopedTotals({ id: 'espada', modeloId: 'tpl-espada' }, ctx);
    assert.strictEqual(r.dano, '1d10', `esperado 1d10 puro, veio ${r.dano}`);
}

// --- 6) Item que insere valor exclusivo de teste (base 0) ---
{
    const dvs = [{ key: 'EVADIR', nome: 'Teste de Evadir', icone: '💨', escopoItem: 'coluna' }];
    const ctx = { derivedValues: dvs, derived: {}, itemBonuses: { botas: { 'DERIVED:EVADIR': 4 } }, catalog: [] };
    const r = computeItemScopedTotals({ id: 'botas' }, ctx);
    assert.strictEqual(r.colunas[0].total, 4, 'base 0 + item 4 = 4');
    assert.strictEqual(r.temAlgo, true, 'item que só concede teste precisa aparecer');
}

// --- 6b) Item SEM fórmula de dano nunca exibe dano ---
// Um escudo não causa dano só porque o personagem tem bônus global de dano.
{
    const itemBonuses = { escudo: { 'DERIVED:APARAR': 4 } };
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses, catalog: [] };
    const r = computeItemScopedTotals({ id: 'escudo', nome: 'Escudo' }, ctx);
    assert.strictEqual(r.dano, '', `escudo sem fórmula não pode exibir dano, veio "${r.dano}"`);
    assert.strictEqual(r.temAlgo, true, 'mas entra na tabela pelo delta de Aparar');
    assert.strictEqual(r.colunas.find(c => c.key === 'APARAR').total, 7, 'Aparar 3 + 4 = 7');
}

// --- 6c) Bônus de dano sem fórmula: não exibe e não puxa o item pra tabela ---
{
    const itemBonuses = { manopla: { 'DERIVED:BONUS_DANO': 3 } };
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses, catalog: [] };
    const r = computeItemScopedTotals({ id: 'manopla', nome: 'Manopla' }, ctx);
    assert.strictEqual(r.dano, '', 'sem fórmula não há dano a exibir');
    assert.strictEqual(r.temAlgo, false, 'e o item não entra na tabela');
}

// --- 7) Armadura neutra fica fora da tabela ---
{
    const ctx = { derivedValues: DVS, derived: DERIVED, itemBonuses: {}, catalog: [] };
    const r = computeItemScopedTotals({ id: 'tunica' }, ctx);
    assert.strictEqual(r.temAlgo, false, 'item sem dano e sem delta não entra');
}

// --- 8) Operadores SET / MULT / DIV do bag do item ---
{
    assert.strictEqual(applyItemBag(5, 'ACERTO', { 'SET:DERIVED:ACERTO': 10 }), 10, 'SET sobrescreve a base');
    assert.strictEqual(applyItemBag(5, 'ACERTO', { 'SET:DERIVED:ACERTO': 10, 'DERIVED:ACERTO': 2 }), 12, 'SET e depois soma');
    assert.strictEqual(applyItemBag(5, 'ACERTO', { 'MULT:DERIVED:ACERTO': 2 }), 10, 'multiplicador');
    assert.strictEqual(applyItemBag(5, 'ACERTO', { 'DIV:DERIVED:ACERTO': 2 }), 2, 'divisor trunca (floor)');
    assert.strictEqual(applyItemBag(5, 'ACERTO', {}), 5, 'bag vazio não altera');
    assert.strictEqual(applyItemBag(5, 'ACERTO', null), 5, 'bag ausente não quebra');
}

// --- 9) Instância sobrescreve a fórmula do modelo ---
{
    assert.strictEqual(getItemFormulaDano({ modeloId: 'tpl-espada' }, CATALOG), '1d10', 'herda do modelo');
    assert.strictEqual(getItemFormulaDano({ modeloId: 'tpl-espada', formulaDano: '1d12' }, CATALOG), '1d12', 'instância vence');
    assert.strictEqual(getItemFormulaDano({}, CATALOG), '', 'sem fórmula = string vazia');
}

console.log('✅ item-scope-calc: 9 grupos de asserções passaram.');
