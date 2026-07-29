/**
 * Desequipar automático: item que uma mecânica "Bloqueia Equipar" passou a
 * proibir sai do corpo no recálculo seguinte.
 *
 * Regras verificadas:
 *  • só mexe no que está de fato equipado no corpo — guardado em container,
 *    "armazenado" ou solto no inventário não são tocados;
 *  • sem nada bloqueado a função é inerte (nenhuma escrita, nenhum alerta);
 *  • a reentrância (unequipItem dispara outro recálculo, que cai aqui de novo)
 *    é cortada pelo flag, senão seria recursão infinita;
 *  • sem o motor de mecânicas carregado, não quebra.
 *
 * Roda com: node ficha-v1.7_1/js/desequipa-bloqueado.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./inventory.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function _desequipaItensBloqueados()');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0 && fim > ini, '_desequipaItensBloqueados não encontrada');
const CODIGO = src.slice(ini, fim);

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * Roda a função com um inventário forjado.
 * `bloqueia` decide quais itens estão proibidos (por nome).
 * `reentra` faz o unequipItem stub chamar a função de novo, simulando o
 * recálculo que unequipItem dispara de verdade.
 */
async function roda(items, bloqueia, { reentra = false } = {}) {
  const chamadas = [];
  const alertas = [];
  const sandbox = {
    console: { warn() {}, log() {} },
    alert: msg => alertas.push(msg),
    setTimeout,
    window: {
      _inventoryState: { items },
      equipBloqueioDoItem: bloqueia
        ? item => (bloqueia.includes(item.nome) ? { fonte: 'Voto de Paz', descricao: '' } : null)
        : undefined
    },
    async unequipItem(id) {
      chamadas.push(id);
      if (reentra) sandbox.rodar();   // o recálculo que unequipItem dispara
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`let _desequipandoBloqueados = false;\n${CODIGO}\nrodar = _desequipaItensBloqueados;`, sandbox);
  sandbox.rodar();
  await flush();
  await flush();
  return { chamadas, alertas };
}

const noCorpo = { id: 'i1', nome: 'Armadura Pesada', equipado: true, estadoEquip: 'vestir' };
const guardado = { id: 'i2', nome: 'Armadura Pesada', equipado: true, parentItemId: 'mochila', estadoEquip: 'vestir' };
const armazenado = { id: 'i3', nome: 'Armadura Pesada', equipado: true, estadoEquip: 'armazenado' };
const naMochila = { id: 'i4', nome: 'Armadura Pesada', equipado: false };
const permitido = { id: 'i5', nome: 'Túnica', equipado: true, estadoEquip: 'vestir' };

// --- nada bloqueado: função inerte ---
let r = await roda([noCorpo, permitido], []);
assert.deepEqual(r.chamadas, [], 'sem bloqueio não pode desequipar nada');
assert.deepEqual(r.alertas, [], 'sem bloqueio não pode alertar');

// --- item bloqueado e vestido: sai ---
r = await roda([noCorpo, permitido], ['Armadura Pesada']);
assert.deepEqual(r.chamadas, ['i1'], 'só o item bloqueado sai');
assert.equal(r.alertas.length, 1);
assert.ok(r.alertas[0].includes('Armadura Pesada'), 'o alerta nomeia o item');
assert.ok(r.alertas[0].includes('Voto de Paz'), 'o alerta nomeia a fonte da regra');

// --- o que não está no corpo não é tocado ---
r = await roda([guardado, armazenado, naMochila], ['Armadura Pesada']);
assert.deepEqual(r.chamadas, [], 'guardado/armazenado/solto no inventário ficam onde estão');

// --- vários de uma vez ---
const outro = { id: 'i6', nome: 'Escudo Torre', equipado: true, estadoEquip: 'segurar' };
r = await roda([noCorpo, outro, permitido], ['Armadura Pesada', 'Escudo Torre']);
assert.deepEqual(r.chamadas, ['i1', 'i6']);
assert.equal(r.alertas.length, 1, 'um alerta só, listando os dois');
assert.ok(r.alertas[0].includes('2 itens'), 'o alerta usa plural');

// --- reentrância: o recálculo disparado por unequipItem não pode recursar ---
r = await roda([noCorpo], ['Armadura Pesada'], { reentra: true });
assert.deepEqual(r.chamadas, ['i1'], 'a chamada aninhada é cortada pelo flag');

// --- motor de mecânicas ausente: não quebra ---
r = await roda([noCorpo], null);
assert.deepEqual(r.chamadas, [], 'sem equipBloqueioDoItem a função sai quieta');

console.log('✅ desequipar automático OK — só o que está no corpo, reentrância cortada, inerte sem bloqueio');
