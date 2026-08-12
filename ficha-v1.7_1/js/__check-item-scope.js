/* Autoteste do cálculo de valores escopados por item.
 * Roda com: node ficha-v1.7_1/js/__check-item-scope.js
 * Sem framework — só assert. Falha ruidosamente se a lógica quebrar. */

const assert = require('assert');
const { computeItemScopedTotals, computeGolpesDesarmados, applyItemBag, getItemFormulaDano, getItemTipoGolpe } = require('./item-scope-calc.js');

// --- 0) Tipo de golpe: diz qual Blindagem tipada do alvo barra o dano ---
{
    const cat = [{ id: 'tpl-maca', nome: 'Maça', formulaDano: '1d6', tipoGolpe: 'contundente' }];
    const ctx0 = { derivedValues: [], derived: {}, itemBonuses: {}, catalog: cat };

    assert.strictEqual(getItemTipoGolpe({ tipoGolpe: 'cortante' }, cat).nome, 'Cortante');
    assert.strictEqual(getItemTipoGolpe({ tipoGolpe: 'PERFURANTE' }, cat).nome, 'Perfurante');
    assert.strictEqual(getItemTipoGolpe({ tipoGolpe: 'laser' }, cat), null, 'tipo inválido não vira rótulo');
    assert.strictEqual(getItemTipoGolpe({}, cat), null, 'item sem tipo não inventa um');
    // herda do modelo do catálogo
    assert.strictEqual(getItemTipoGolpe({ modeloId: 'tpl-maca' }, cat).chave, 'contundente');
    // a instância vence o modelo
    assert.strictEqual(getItemTipoGolpe({ modeloId: 'tpl-maca', tipoGolpe: 'cortante' }, cat).chave, 'cortante');

    // Sem fórmula de dano não há golpe onde pendurar o tipo.
    const semDado = computeItemScopedTotals({ id: 'x', tipoGolpe: 'cortante' }, ctx0);
    assert.strictEqual(semDado.tipoGolpe, null, 'sem fórmula de dano o tipo não aparece');
    const comDado = computeItemScopedTotals({ id: 'y', modeloId: 'tpl-maca' }, ctx0);
    assert.strictEqual(comDado.tipoGolpe.nome, 'Contundente');
    assert.strictEqual(comDado.dano, '1d6');
}

const DVS = [
    { key: 'ACERTO', nome: 'Acerto', icone: '🎯', escopoItem: 'coluna' },
    { key: 'BONUS_DANO', nome: 'Bônus de Dano', icone: '💥', escopoItem: 'dano' },
    { key: 'APARAR', nome: 'Teste de Aparar', icone: '🛡️', escopoItem: 'coluna' },
    { key: 'CARGA', nome: 'Carga', icone: '⚖️', escopoItem: '' },   // global, deve ser ignorado
    { key: 'DANO_VERMELHA', nome: 'Dano Vermelha', icone: '🔥', escopoItem: 'dano-canal' },
    { key: 'DANO_VERDE', nome: 'Dano Verde', icone: '🌿', escopoItem: 'dano-canal' },
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

// --- 7b) Canal de Essência NÃO entra na fórmula física ---
// Era o bug: todo escopoItem 'dano' caía num somaDano único, então a Blindagem
// comum do alvo absorvia o dano elemental.
{
    const derived = { ...DERIVED, DANO_VERMELHA: 4, DANO_VERDE: 2 };
    const ctx = { derivedValues: DVS, derived, itemBonuses: {}, catalog: CATALOG };
    const r = computeItemScopedTotals({ id: 'espada', modeloId: 'tpl-espada' }, ctx);

    assert.strictEqual(r.dano, '1d10+2', `físico só com o Dano genérico, veio ${r.dano}`);
    assert.strictEqual(r.canais.length, 2, 'dois canais separados');
    assert.strictEqual(r.canais.find(c => c.key === 'DANO_VERMELHA').total, 4, 'Vermelha 4 isolada');
    assert.strictEqual(r.canais.find(c => c.key === 'DANO_VERDE').total, 2, 'Verde 2 isolada');
}

// --- 7c) Canal recebe o delta do item, e canal zerado não aparece ---
{
    const derived = { ...DERIVED, DANO_VERMELHA: 0, DANO_VERDE: 0 };
    const itemBonuses = { tocha: { 'DERIVED:DANO_VERMELHA': 3 } };
    const ctx = { derivedValues: DVS, derived, itemBonuses, catalog: [] };
    const r = computeItemScopedTotals({ id: 'tocha', formulaDano: '1d4' }, ctx);

    assert.strictEqual(r.canais.length, 1, 'canal zerado fica fora');
    assert.strictEqual(r.canais[0].key, 'DANO_VERMELHA', 'sobrou a Vermelha do item');
    assert.strictEqual(r.canais[0].total, 3, 'base 0 + 3 do item');
}

// --- 7d) Sem fórmula de dano não há canal (mesma regra do dano genérico) ---
{
    const derived = { ...DERIVED, DANO_VERMELHA: 4 };
    const ctx = { derivedValues: DVS, derived, itemBonuses: {}, catalog: [] };
    const r = computeItemScopedTotals({ id: 'anel' }, ctx);

    assert.deepStrictEqual(r.canais, [], 'anel sem dado não carrega canal');
    assert.strictEqual(r.temAlgo, false, 'e não entra na tabela');
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

// --- 10) Golpe desarmado: parte que golpeia e está livre vira linha de ataque ---
{
    const SLOTS = {
        mao_1: { label: 'Mão 1', parte: 'Mão', partId: 'mao', icon: '🖐️', podeGolpear: true },
        mao_2: { label: 'Mão 2', parte: 'Mão', partId: 'mao', icon: '🖐️', podeGolpear: true },
        pe: { label: 'Pé', parte: 'Pé', partId: 'pe', icon: '🥾', podeGolpear: true },
        torso: { label: 'Torso', parte: 'Torso', partId: 'torso', icon: '👕', podeGolpear: false },
    };
    const base = { derivedValues: DVS, derived: DERIVED, bodySlots: SLOTS };

    // Nada equipado: as duas mãos socam igual e viram UMA linha; o torso nunca entra.
    const todas = computeGolpesDesarmados({ ...base, slotsOcupados: [] });
    assert.deepStrictEqual(todas.map(l => l.nome), ['Mão', 'Pé'], 'partes iguais colapsam');
    assert.deepStrictEqual(todas.map(l => l.qtd), [2, 1], 'e a linha diz quantas são');
    assert.ok(todas.every(l => l.desarmado), 'linha marcada como desarmada');

    // Dado 1d4 + o Dano do personagem (BONUS_DANO base 2).
    assert.strictEqual(todas[0].dano, '1d4+2', `dano desarmado errado: ${todas[0].dano}`);
    assert.strictEqual(todas[0].tipoGolpe.nome, 'Contundente', 'punho é barrado pela Blindagem Contundente');

    // Acerto sai da base do personagem, sem bônus de item.
    const ac = todas[0].colunas.find(c => c.key === 'ACERTO');
    assert.strictEqual(ac.total, 5, 'acerto = base global');
    assert.strictEqual(ac.bonus, 0, 'parte sem vínculo não altera nada');
    assert.ok(!todas[0].colunas.some(c => c.key === 'BONUS_DANO'), 'DV de dano vira fórmula, não coluna');
    assert.deepStrictEqual(todas[0].canais, [], 'canal de Essência é da arma, não do punho');

    // Qualquer item equipado ocupa a parte — a mão com escudo não soca.
    // Sobrando uma mão só, a linha volta a dizer QUAL mão.
    const comEscudo = computeGolpesDesarmados({ ...base, slotsOcupados: ['mao_1'] });
    assert.deepStrictEqual(comEscudo.map(l => l.nome), ['Mão 2', 'Pé']);
    assert.deepStrictEqual(comEscudo.map(l => l.qtd), [1, 1]);

    // Espada de duas mãos toma as duas.
    const duasMaos = computeGolpesDesarmados({ ...base, slotsOcupados: ['mao_1', 'mao_2'] });
    assert.deepStrictEqual(duasMaos.map(l => l.slotKey), ['pe']);

    // --- VD vinculado à parte: muda o golpe DAQUELA parte, como um equipamento ---
    const comVinculo = computeGolpesDesarmados({
        ...base, slotsOcupados: [],
        parteBonuses: { pe: { 'DERIVED:BONUS_DANO': 3, 'DERIVED:ACERTO': -1 } },
    });
    const pe = comVinculo.find(l => l.parte === 'Pé');
    const mao = comVinculo.find(l => l.parte === 'Mão');
    assert.strictEqual(pe.dano, '1d4+5', 'chute: Dano 2 do personagem + 3 da Perna');
    assert.strictEqual(pe.colunas.find(c => c.key === 'ACERTO').total, 4, 'acerto 5 − 1 da parte');
    assert.strictEqual(pe.colunas.find(c => c.key === 'ACERTO').bonus, -1, 'delta da parte isolado');
    assert.strictEqual(mao.dano, '1d4+2', 'o vínculo do Pé não vaza para a Mão');

    // Parte com nome igual mas número diferente NÃO colapsa.
    const maoTorta = computeGolpesDesarmados({
        ...base, slotsOcupados: [],
        bodySlots: { ...SLOTS, mao_2: { ...SLOTS.mao_2, partId: 'mao_protese' } },
        parteBonuses: { mao_protese: { 'DERIVED:BONUS_DANO': 1 } },
    });
    assert.deepStrictEqual(maoTorta.map(l => l.nome), ['Mão 1', 'Mão 2', 'Pé'], 'valores diferentes, linhas separadas');
    assert.deepStrictEqual(maoTorta.map(l => l.qtd), [1, 1, 1]);

    // Sem bônus de dano o dado sai limpo, sem "+0".
    const semBonus = computeGolpesDesarmados({ ...base, derived: { ACERTO: 5 }, slotsOcupados: [] });
    assert.strictEqual(semBonus[0].dano, '1d4');

    // Personagem sem nenhuma parte que golpeia não gera linha nenhuma.
    assert.deepStrictEqual(
        computeGolpesDesarmados({ ...base, bodySlots: { torso: SLOTS.torso }, slotsOcupados: [] }), []);
    assert.deepStrictEqual(computeGolpesDesarmados({}), [], 'contexto vazio não quebra');
}

console.log('✅ item-scope-calc: 13 grupos de asserções passaram.');
