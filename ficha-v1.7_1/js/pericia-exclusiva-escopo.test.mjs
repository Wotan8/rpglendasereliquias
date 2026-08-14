/**
 * Regra: perícia de categoria "exclusivo" só vale para quem a classe vincula em
 * `pericClasse`. Sem o flag `todoPersonagem`, ela é de NINGUÉM — nunca de todos.
 * Nas categorias base (mental/físico/social/combate) a omissão continua valendo
 * como universal.
 *
 * REGRESSÃO: as 3 perícias rúnicas do Runimago foram cadastradas por script sem
 * `todoPersonagem`; o filtro da ficha (`!== false`) as mostrava para todo
 * personagem no bloco Exclusivo.
 *
 * Roda com: node ficha-v1.7_1/js/pericia-exclusiva-escopo.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// normaliza CRLF: o recorte procura uma linha "}" isolada e o arquivo é salvo
// com quebra do Windows — sem isso o indexOf('\n}\n') nunca acha nada.
const src = readFileSync(new URL('./system-data-loader.js', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const trecho = (assinatura) => {
  const ini = src.indexOf(assinatura);
  assert.ok(ini > 0, `${assinatura} não encontrada`);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 3);
};

const SKILLS_FAKE = [
  { id: 's1', nome: 'Talha Rúnica', categoria: 'exclusivo', atributoBase: ['FOR', 'DES'] },        // sem flag
  { id: 's2', nome: 'Selo Abissal', categoria: 'exclusivo', atributoBase: ['RAC'], todoPersonagem: false },
  { id: 's3', nome: 'Hemomancia', categoria: 'exclusivo', atributoBase: ['INT'], todoPersonagem: true }, // exceção declarada
  { id: 's4', nome: 'Erudição', categoria: 'mental', atributoBase: ['INT'] },                      // sem flag
  { id: 's5', nome: 'Esquiva', categoria: 'combate', atributoBase: ['DES'], todoPersonagem: false },
];

const sandbox = { console, window: { _systemData: { skills: SKILLS_FAKE } } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  `${trecho('function _stripAccents(')}\n${trecho('function buildSkillsFromFirebase()')}\nbuildSkillsFromFirebase();`,
  sandbox);

const S = sandbox.window.SKILLS;
// mesmo filtro de core.js → initSkills()
// (spread para sair do realm do vm — Array de outro contexto quebra deepEqual)
const naFicha = (cat) => [...S[cat].filter(s => s.todoPersonagem !== false).map(s => s.name)];

assert.deepEqual(naFicha('exclusivo'), ['Hemomancia'],
  'só a exclusiva com todoPersonagem:true explícito entra para todo personagem');
assert.ok(!naFicha('exclusivo').includes('Talha Rúnica'),
  'exclusiva sem flag NÃO pode aparecer para todo personagem');
assert.deepEqual(naFicha('mental'), ['Erudição'],
  'categoria base sem flag continua universal');
assert.deepEqual(naFicha('combate'), [],
  'todoPersonagem:false continua escondendo em qualquer categoria');

console.log('✅ Perícia exclusiva sem flag não vaza para todo personagem');
