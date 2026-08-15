/**
 * Bônus temporário — a sobra da Dádiva valendo só enquanto a cena durar.
 *
 * O que se trava aqui:
 *   · sem bônus, devolve a MESMA referência (é chamado a cada quadro do canvas;
 *     clonar a ficha à toa custa caro);
 *   · a ficha ORIGINAL nunca é tocada — o empréstimo não pode vazar para o doc
 *     do personagem, porque um urso emprestado por uma cena não é o personagem;
 *   · char e NPC guardam em lugares diferentes (derivedTotals/dots contra
 *     valoresDer), e os dois têm de sair somados;
 *   · Vitalidade e Energia sobem o Atual junto quando a Dádiva pede.
 *
 * Roda com: node shared/bonus-temporario.test.mjs
 */
import assert from 'node:assert/strict';
import { fichaComBonus, bonusDosGanhos, rotuloDoBonus } from './bonus-temporario.js';

/* ===== sem bônus não mexe em nada ===== */
const vazia = { derivedTotals: { blindagem: 2 } };
assert.equal(fichaComBonus(vazia, []), vazia, 'lista vazia devolve a mesma referência');
assert.equal(fichaComBonus(vazia, null), vazia);
assert.equal(fichaComBonus(null, [{ tipo: 'vd', chave: 'X', valor: 1 }]), null);
assert.equal(fichaComBonus(vazia, [{ tipo: 'vd', chave: 'X', valor: 0 }]).derivedTotals.blindagem, 2,
    'bônus de valor 0 não muda nada');

/* ===== ficha de PERSONAGEM (derivedTotals + dots) ===== */
const char = {
    derivedTotals: { blindagem: 2, percepcao: 3, vitalidade: 18 },
    dots: { attr_pre: 4, attr_aut: 2, sk_social_intimidacao: 2 },
};
const original = JSON.parse(JSON.stringify(char));

const comUrso = fichaComBonus(char, [
    { tipo: 'vd', chave: 'BLINDAGEM', nome: 'Blindagem', valor: 4 },
    { tipo: 'atributo', chave: 'AUT', valor: 1 },
    { tipo: 'pericia', chave: 'Intimidação', valor: 3 },
    { tipo: 'vital', chave: 'VIT', valor: 12, subeAtual: true },
]);

assert.equal(comUrso.derivedTotals.blindagem, 6, 'Blindagem 2 + 4 de sobra');
assert.equal(comUrso.dots.attr_aut, 3, 'AUT 2 + 1');
assert.equal(comUrso.dots.sk_social_intimidacao, 5, 'a perícia soma na chave que já existe');
assert.equal(comUrso.derivedTotals.vitalidade, 30, 'Vitalidade Máxima 18 + 12');

// 🔒 a ficha de verdade continua intacta
assert.deepEqual(char, original, 'o empréstimo NÃO pode vazar para a ficha do personagem');

/* ===== perícia que o personagem não tem ===== */
const semPericia = fichaComBonus(char, [{ tipo: 'pericia', chave: 'Sobrevivência', valor: 4 }]);
assert.equal(semPericia.dots.sk_exclusivo_sobreviv_ncia ?? semPericia.dots['sk_exclusivo_sobrevivencia'], 4,
    'perícia emprestada que o personagem não tinha entra do zero');

/* ===== ficha de NPC (valoresDer) ===== */
const npc = { valoresDer: { overrides: { BLINDAGEM: 3 }, atual: { VIT: 20, ENER: 4 } }, atributos: { PRE: 2 } };
const npcOriginal = JSON.parse(JSON.stringify(npc));
const npcComBonus = fichaComBonus(npc, [
    { tipo: 'vd', chave: 'BLINDAGEM', nome: 'Blindagem', valor: 2 },
    { tipo: 'atributo', chave: 'PRE', valor: 3 },
    { tipo: 'vital', chave: 'ENER', valor: 4, subeAtual: true },
]);
assert.equal(npcComBonus.valoresDer.overrides.BLINDAGEM, 5);
assert.equal(npcComBonus.atributos.PRE, 5);
assert.equal(npcComBonus.valoresDer.atual.ENER, 8, 'Energia recebida sobe o Atual');
assert.deepEqual(npc, npcOriginal, 'o doc do NPC também não pode ser tocado');

// Vital SEM subeAtual mexe só no máximo
const soMax = fichaComBonus(npc, [{ tipo: 'vital', chave: 'ENER', valor: 4 }]);
assert.equal(soMax.valoresDer.atual.ENER, 4, 'sem subeAtual, o Atual fica onde estava');

/* ===== ganhos da Dádiva viram bônus ===== */
const bonus = bonusDosGanhos([
    { chave: 'BLINDAGEM', nome: 'Blindagem', sobra: 4 },
    { chave: 'AUT', nome: 'AUT', sobra: 1, atributo: true },
    { chave: 'Intimidação', nome: 'Intimidação', sobra: 3, pericia: true },
    { chave: 'VIT', nome: 'Vitalidade Máxima', sobra: 12, subeAtual: true },
], 'Fusão Selvagem: Urso Pardo');

assert.deepEqual(bonus.map(b => b.tipo), ['vd', 'atributo', 'pericia', 'vital'],
    'cada ganho vira o tipo certo de bônus');
assert.equal(bonus[3].subeAtual, true);
assert.equal(bonus[0].fonte, 'Fusão Selvagem: Urso Pardo', 'a origem viaja junto — o HUD diz de onde veio');
assert.equal(rotuloDoBonus(bonus[0]), 'Blindagem +4');

/* ===== ponta a ponta: Dádiva → bônus → ficha ===== */
const aplicado = fichaComBonus(char, bonus);
assert.equal(aplicado.derivedTotals.blindagem, 6);
assert.equal(aplicado.dots.attr_aut, 3);
assert.deepEqual(char, original, 'e a ficha segue intacta no fim de tudo');

console.log('✅ bônus temporário OK — soma sem clonar à toa, char e NPC, e a ficha real nunca é tocada');
