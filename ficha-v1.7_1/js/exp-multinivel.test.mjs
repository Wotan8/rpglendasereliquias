/**
 * Subir/descer VÁRIOS níveis de uma vez.
 *
 * O custo é por nível (5×N para atributo, 4×N para perícia), então pular de 2
 * para 5 tem de cobrar a SOMA dos degraus 3+4+5 — nunca só o do último. O
 * retrocesso do mestre usa a mesma soma para devolver, e o EXP volta apenas em
 * "Restante": o Total é o histórico do que a mesa já deu ao personagem.
 *
 * Roda com: node ficha-v1.7_1/js/exp-multinivel.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const exp = readFileSync(new URL('./exp-upgrade.js', import.meta.url), 'utf8');
const pec = readFileSync(new URL('./race-peculiarities.js', import.meta.url), 'utf8');

// A ficha inteira não roda no node; recorta-se só o que se quer medir.
const recorta = (src, assinatura) => {
    const ini = src.indexOf(assinatura);
    assert.ok(ini > 0, `${assinatura} não encontrado`);
    const fim = src.indexOf('\n}\n', ini) + 3;
    return src.slice(ini, fim);
};

// EXP restante e total vivem em inputs; aqui um DOM de mentira com os dois.
const campos = { exp: { value: '100' }, exp_total: { value: '100' } };
const sandbox = {
    window: {},
    state: { dots: {}, mechanicBonuses: {}, mechanicLimits: {} },
    document: { querySelector: (s) => campos[s.match(/"(.+)"/)[1]] || null },
    scheduleAutosave: () => {},
    r: null,
};
vm.createContext(sandbox);
vm.runInContext([
    recorta(exp, 'function getExpCost('),
    recorta(exp, 'function somaCustoDegraus('),
    recorta(exp, 'function getCurrentExp('),
    recorta(exp, 'function setCurrentExp('),
    recorta(exp, 'function refundExp('),
    recorta(exp, 'function concederSemGastar('),
    recorta(exp, 'function podeGastarDeGraca('),
    recorta(exp, 'function canUpgrade('),
    recorta(pec, 'function _pecCustoLiquido('),
].join('\n'), sandbox);

const roda = (js) => { vm.runInContext(`r = ${js}`, sandbox); return sandbox.r; };

/* ----- soma dos degraus ----- */
assert.equal(roda(`somaCustoDegraus('attr', 'attr_for', 2, 5)`), 15 + 20 + 25,
    'atributo 2→5 custa 15+20+25 = 60, não 25');
assert.equal(roda(`somaCustoDegraus('skill', 'sk_fisico_x', 0, 3)`), 4 + 8 + 12,
    'perícia 0→3 custa 4+8+12 = 24');
assert.equal(roda(`somaCustoDegraus('attr', 'attr_for', 3, 3)`), 0, 'mesmo nível não cobra nada');

/* ----- canUpgrade: 1 degrau (padrão) x vários ----- */
assert.equal(roda(`canUpgrade('attr_for', 3, 'attr', null, 0).cost`), 15,
    'sem fromLevel, continua cobrando só o degrau — o comportamento antigo');
assert.equal(roda(`canUpgrade('attr_for', 3, 'attr', null, 0, 0).cost`), 5 + 10 + 15,
    'com fromLevel 0, cobra os três degraus de uma vez');

// O piso da ficha desloca o nível efetivo: quem tem piso 2 e compra o raw 1
// está pagando o nível 3, não o 1.
assert.equal(roda(`canUpgrade('attr_for', 1, 'attr', null, 2, 0).cost`), 15,
    'piso 2 + raw 1 = nível efetivo 3 → 15 EXP');

// Teto de 5: pular direto para 6 tem de ser recusado, não cobrado.
assert.equal(roda(`canUpgrade('attr_for', 6, 'attr', null, 0, 0).allowed`), false,
    'não dá para pular acima do máximo');

// EXP insuficiente é medido contra a soma, não contra o último degrau.
campos.exp.value = '30';
assert.equal(roda(`canUpgrade('attr_for', 3, 'attr', null, 0, 0).allowed`), true,
    '30 EXP pagam exatamente os 5+10+15 dos três degraus');
campos.exp.value = '29';
assert.equal(roda(`canUpgrade('attr_for', 3, 'attr', null, 0, 0).allowed`), false,
    'com 29 EXP a compra de 30 é recusada');

/* ----- mestre/criador: o custo é opcional, então falta de EXP não barra ----- */
sandbox.window.isMestre = true;
const comMestre = roda(`canUpgrade('attr_for', 3, 'attr', null, 0, 0)`);
assert.equal(comMestre.allowed, true,
    'mestre sobe nível mesmo sem o EXP — para ele o custo é escolha');
assert.equal(comMestre.semExp, true,
    'semExp avisa o confirm para não oferecer o botão de pagar');
assert.equal(comMestre.cost, 30, 'o custo continua sendo calculado e mostrado');

campos.exp.value = '100';
assert.equal(roda(`canUpgrade('attr_for', 3, 'attr', null, 0, 0).semExp`), false,
    'com EXP sobrando, o mestre recebe as duas opções');
sandbox.window.isMestre = false;
campos.exp.value = '29';

/* ----- devolução: só "Restante", nunca o Total ----- */
campos.exp.value = '10';
campos.exp_total.value = '100';
roda(`refundExp(60)`);
assert.equal(campos.exp.value, 70, 'o EXP devolvido entra em Restante');
assert.equal(campos.exp_total.value, '100', 'o Total é histórico e não muda no retrocesso');

/* ----- peculiaridade: cada nível tem preço próprio, e "ganho" é negativo ----- */
const pecMock = {
    niveis: {
        1: { custo: '—' },
        2: { custo: '5 EXP' },
        3: { custo: '8 EXP' },
        4: { custo: '10 EXP', tipoExp: 'ganho' },
    },
};
sandbox.p = pecMock;
assert.equal(roda(`_pecCustoLiquido(p, 1, 3)`), 13, 'níveis 2 e 3 somam 5+8');
assert.equal(roda(`_pecCustoLiquido(p, 1, 4)`), 3, 'o nível de "ganho" abate: 5+8−10');
assert.equal(roda(`_pecCustoLiquido(p, 3, 3)`), 0, 'sem degrau, sem custo');

/* ----- concessão do mestre: não tira de Restante, mas soma no Total ----- */
campos.exp.value = '10';
campos.exp_total.value = '100';
roda(`concederSemGastar(30)`);
assert.equal(campos.exp.value, '10',
    'concessão gratuita não pode encostar no EXP Restante');
assert.equal(campos.exp_total.value, 130,
    'o custo do nível concedido entra no Total — é ele que diz quanto o personagem vale');

// Desvantagem que RENDERIA EXP e o mestre optou por não dar: nada a registrar.
roda(`concederSemGastar(-20)`);
assert.equal(campos.exp_total.value, 130, 'custo negativo não pode reduzir o Total');
roda(`concederSemGastar(0)`);
assert.equal(campos.exp_total.value, 130, 'custo zero não mexe no Total');

console.log('✅ EXP multinível OK — soma degrau a degrau, respeita piso/teto e devolve só em Restante');
