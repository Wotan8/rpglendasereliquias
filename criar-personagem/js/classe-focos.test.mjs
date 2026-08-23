/**
 * classeFocos() — o ranking de atributos e perícias do modal de classe.
 * Roda com os dados reais de __check-data.json:
 *   node criar-personagem/js/classe-focos.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);
const dados = JSON.parse(readFileSync(new URL('__check-data.json', raiz), 'utf8'));

/* SKILLS não vem no snapshot — o que o ranking precisa é nome + atributo. */
const SKILLS = {
  combate: [
    { name: 'Arma', key: 'arma', attr: 'FOR', attrLabel: 'FOR' },
    { name: 'Briga', key: 'briga', attr: 'FOR', attrLabel: 'FOR' },
    { name: 'Esquiva', key: 'esquiva', attr: 'DES', attrLabel: 'DES' },
    { name: 'Aparar', key: 'aparar', attr: 'DES', attrLabel: 'DES' },
    { name: 'Bloquear', key: 'bloquear', attr: 'VIG', attrLabel: 'VIG' },
  ],
  fisico: [{ name: 'Atletismo', key: 'atletismo', attr: 'FOR', attrLabel: 'FOR' }],
};

const ctx = {
  console,
  window: {
    _systemData: dados,
    SKILLS,
    CLASS_SKILLS: { Guerreiro: ['Arma', 'Briga', 'Atletismo', 'Esquiva'] },
  },
};
ctx.window.window = ctx.window;
vm.createContext(ctx);

/* data.js traz ATRIBUTOS; race-module.js traz classeFocos e ajudantes. */
vm.runInContext(readFileSync(new URL('js/data.js', raiz), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('js/race-module.js', raiz), 'utf8'), ctx);

const focos = vm.runInContext('classeFocos("Guerreiro")', ctx);

const nomes = l => l.map(x => x.nome);
assert.ok(focos.atributos.length, 'Guerreiro precisa ter atributos de foco');
assert.equal(focos.atributos[0].nome, 'Força',
  `Guerreiro se apoia em Força primeiro, veio ${JSON.stringify(focos.atributos)}`);
// join(): os arrays vêm de outro realm, comparação estrita de objeto não serve.
assert.equal(nomes(focos.pericias).slice(0, 2).join(','), 'Arma,Briga',
  `Arma e Briga vêm de mecânica + lista de classe, veio ${JSON.stringify(focos.pericias)}`);

// Pool de "distribuir" pesa menos: Esquiva (lista + pool) fica abaixo de Arma.
const peso = (l, n) => l.find(x => x.nome === n)?.peso ?? 0;
assert.ok(peso(focos.pericias, 'Arma') > peso(focos.pericias, 'Esquiva'),
  'perícia citada por mecânica pesa mais que opção de pool');
// Bloquear só existe no pool — entra, mas por último.
assert.ok(peso(focos.pericias, 'Bloquear') > 0, 'opção de pool ainda conta');
assert.ok(peso(focos.pericias, 'Bloquear') < peso(focos.pericias, 'Esquiva'),
  'quem só está no pool fica atrás de quem também é perícia de classe');

// Classe inexistente não explode.
const vazio = vm.runInContext('classeFocos("Não Existe")', ctx);
assert.equal(vazio.atributos.length + vazio.pericias.length, 0, 'classe inexistente sai vazia');

console.log('✅ classeFocos ok — atributos', nomes(focos.atributos), '| perícias', nomes(focos.pericias));
