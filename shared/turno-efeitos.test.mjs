/**
 * Efeitos que atravessam o turno.
 *
 *  ⏪ Estilhaçar Causa desfaz o último turno do alvo: ele volta para onde
 *     estava e o dano que causou se recupera. O que NÃO pode acontecer é
 *     roubar cura que outro deu no meio — desfazer o turno do agressor não é
 *     desfazer a rodada inteira.
 *  🕯️ Invocação Abissal ocupa 2 rodadas, resolve metade no fim de cada uma, e
 *     enquanto dura quem conjura não se defende.
 *  🌀 Vórtice na Fenda mira em dois estágios: o tocado, depois o destino.
 *
 * Roda com: node shared/turno-efeitos.test.mjs
 */
import assert from 'node:assert/strict';
import {
    tirarRetrato, oQueDesfazer, comecarRitual, avancarRitual, progressoDoRitual,
    ritualProibeDefesa, precisaSegundoEstagio, miraDoSegundoEstagio,
} from './turno-efeitos.js';

/* ===================== ⏪ desfazer o turno ===================== */
const retrato = tirarRetrato({
    pid: 'p_bruto', rodada: 3,
    tokens: [{ id: 't_bruto', x: 100, y: 100 }, { id: 't_alvo', x: 300, y: 100 }],
    vitais: [{ pid: 'p_bruto', vit: 20, ener: 5, san: 8 }, { pid: 'p_alvo', vit: 18, ener: 4, san: 9 }],
});
assert.equal(retrato.pid, 'p_bruto');
assert.equal(retrato.tokens.length, 2);

// O bruto andou e bateu: desfazer devolve a posição dele e a vida de quem levou
const depois = {
    tokens: [{ id: 't_bruto', x: 260, y: 100 }, { id: 't_alvo', x: 300, y: 100 }],
    vitais: [{ pid: 'p_bruto', vit: 20, ener: 3, san: 8 }, { pid: 'p_alvo', vit: 11, ener: 4, san: 9 }],
};
const d = oQueDesfazer(retrato, depois);
assert.deepEqual(d.tokens, [{ id: 't_bruto', x: 100, y: 100 }], 'só o token que se moveu volta');
assert.deepEqual(d.vitais, [{ pid: 'p_alvo', vit: 18 }], 'a vida de quem levou o golpe volta ao que era');

// 🚫 quem foi CURADO no meio não é rebaixado
const comCura = {
    tokens: retrato.tokens.map(t => ({ ...t })),
    vitais: [{ pid: 'p_bruto', vit: 20 }, { pid: 'p_alvo', vit: 25 }],
};
assert.deepEqual(oQueDesfazer(retrato, comCura).vitais, [],
    'desfazer o turno do agressor não pode roubar a cura que outro deu');

// nada mudou = nada a desfazer
assert.deepEqual(oQueDesfazer(retrato, {
    tokens: retrato.tokens.map(t => ({ ...t })),
    vitais: retrato.vitais.map(v => ({ ...v })),
}), { tokens: [], vitais: [] });

// token que saiu do mapa no meio não quebra
assert.deepEqual(oQueDesfazer(retrato, { tokens: [{ id: 't_alvo', x: 300, y: 100 }], vitais: [] }),
    { tokens: [], vitais: [] });
assert.deepEqual(oQueDesfazer(null, depois), { tokens: [], vitais: [] });

/* ===================== 🕯️ ritual de N rodadas ===================== */
const r0 = comecarRitual({ nome: 'Invocação Abissal', rodadas: 2, rodadaAtual: 4, semDefesa: true });
assert.equal(r0.total, 2);
assert.equal(r0.feitas, 0);
assert.equal(r0.semDefesa, true);
assert.equal(r0.comecouNaRodada, 4);
assert.equal(ritualProibeDefesa({ ritual: r0 }), true, 'quem conjura não se defende enquanto dura');
assert.equal(ritualProibeDefesa({}), false);

// fim da 1ª rodada: metade dos passos
const a1 = avancarRitual(r0);
assert.equal(a1.completou, false);
assert.equal(a1.etapa, 1);
assert.equal(a1.total, 2);
assert.equal(a1.ritual.feitas, 1);
assert.equal(progressoDoRitual(a1.ritual).texto, '1/2');
assert.equal(progressoDoRitual(a1.ritual).fracao, 0.5);

// fim da 2ª: completa e o ritual some do participante
const a2 = avancarRitual(a1.ritual);
assert.equal(a2.completou, true, 'na segunda rodada o ritual se resolve');
assert.equal(a2.etapa, 2);
assert.equal(a2.ritual, null, 'ritual completo sai do participante');

// ritual de 1 rodada completa de primeira; sem ritual não quebra
assert.equal(avancarRitual(comecarRitual({ rodadas: 1, rodadaAtual: 1 })).completou, true);
assert.equal(avancarRitual(null).completou, false);
assert.equal(progressoDoRitual(null), null);
assert.equal(comecarRitual({ rodadas: 0 }).total, 1, 'ritual sempre tem ao menos uma rodada');

/* ===================== 🌀 mira em dois estágios ===================== */
const vortice = { tipo: 'alvos', maxAlvos: 2, alcanceM: 3, depoisLocais: 1, alcanceDestinoM: 200, afeta: 'aliados' };
assert.equal(precisaSegundoEstagio(vortice, []), false, 'sem alvo escolhido ainda não há segundo estágio');
assert.equal(precisaSegundoEstagio(vortice, ['t1']), true, 'escolhido o tocado, pede o destino');
assert.equal(precisaSegundoEstagio({ tipo: 'alvos', maxAlvos: 1 }, ['t1']), false,
    'mira comum de alvos não tem segundo estágio');
assert.equal(precisaSegundoEstagio({ tipo: 'locais', depoisLocais: 1 }, ['x']), false,
    'mira que já é de locais não encadeia outra');

const e2 = miraDoSegundoEstagio(vortice);
assert.equal(e2.tipo, 'locais');
assert.equal(e2.maxAlvos, 1, 'um destino');
assert.equal(e2.alcanceM, 200, 'o destino tem alcance próprio — o toque pegou o alvo, o vórtice leva longe');
assert.equal(e2._estagio, 2);
assert.equal(e2.afeta, 'aliados', 'o resto da mira segue igual');

console.log('✅ efeitos do turno OK — desfazer sem roubar cura, ritual por etapas e mira em dois estágios');
