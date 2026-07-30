/**
 * O prefixo "Perícia: " existe para desambiguar nomes que vivem nos dois lados.
 * No banco real colidem: Exorcismo, Transcendência, Alquimancia, Dosagem,
 * Contracanto, Empatia Sanguínea... — todos são VD E perícia ao mesmo tempo.
 *
 * Sem tratar o prefixo, getRefValue casa primeiro com o VD homônimo e a
 * mecânica lê o número errado, silenciosamente.
 *
 * Roda com: node criar-personagem/js/skill-ref-prefix.test.mjs
 */
import assert from 'node:assert/strict';

const DV = {
  // VD homônimo de uma perícia — a armadilha
  exorcismo: { id: 'dvExorcismo', key: 'exorcismo', nome: 'Exorcismo', mecanicaIds: ['mExorcismo'] },
  alvo: { id: 'dvAlvo', key: 'alvo', nome: 'Alvo', mecanicaIds: ['mLePericia', 'mLeVd'] },
  soVd: { id: 'dvSoVd', key: 'soVd', nome: 'Só VD', mecanicaIds: ['mSoVd'] },
};

const modificar = (id, nome, calculos) => ({
  id, nome, tipo: 'modificar', duracao: 'permanente', config: { calculos },
});

const MECHANICS = [
  // O VD "Exorcismo" vale 9. A perícia "Exorcismo" vale 2 (ver wizardState).
  modificar('mExorcismo', 'Exorcismo (VD)', [
    { alvo: 'Exorcismo', operacao: '+', equacao: [{ tipo: 'fixo', valor: 9 }] },
  ]),
  // Com prefixo -> tem que ler a PERÍCIA (2), nunca o VD (9).
  modificar('mLePericia', 'Lê perícia', [
    { alvo: 'Alvo', operacao: '+', equacao: [{ tipo: 'ficha', ref: 'Perícia: Exorcismo' }] },
  ]),
  modificar('mLeVd', 'nada', [{ alvo: 'Alvo', operacao: '+', equacao: [{ tipo: 'fixo', valor: 0 }] }]),
  // Sem prefixo -> continua sendo o VD, como sempre foi.
  modificar('mSoVd', 'Lê VD', [
    { alvo: 'Só VD', operacao: '+', equacao: [{ tipo: 'ficha', ref: 'Exorcismo' }] },
  ]),
];

globalThis.window = {
  DERIVED_VALUES: Object.values(DV),
  SKILLS: { exclusivo: [{ name: 'Exorcismo', key: 'exorcismo', mecanicaIds: [] }] },
  REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
  _systemData: { mechanics: MECHANICS, races: [], classes: [], tribes: [], peculiarities: [] },
  _adjustMechanicForLevel: (m) => m,
};
Object.assign(globalThis, { DERIVED_VALUES: window.DERIVED_VALUES, REGRAS_CRIACAO: window.REGRAS_CRIACAO });

const { simulateDerivedValues } = await import('./mechanics-simulator.js');

window.wizardState = {
  racaSelecionada: null,
  atributos: { attr_for: 1, attr_des: 1, attr_vig: 1 },
  pericias: { sk_exorcismo: 2 },
  peculiaridadesIndividuais: [],
};

const r = simulateDerivedValues();

assert.equal(r.dvExorcismo, 9, 'setup: o VD homônimo vale 9');
// REGRESSÃO: sem o tratamento do prefixo isto vinha 9 (o VD) em vez de 2.
assert.equal(r.dvAlvo, 2, `"Perícia: Exorcismo" tem que ler a perícia (2), veio ${r.dvAlvo}`);
assert.equal(r.dvSoVd, 9, `"Exorcismo" sem prefixo continua lendo o VD (9), veio ${r.dvSoVd}`);

// Perícia com prefixo que não existe não pode virar valor de VD por acidente.
window.wizardState.pericias = {};
assert.equal(simulateDerivedValues().dvAlvo, 0, 'perícia sem pontos = 0, não o VD homônimo');

console.log('✅ prefixo "Perícia: " desambigua VD × perícia — Alvo 2, Só VD 9');
