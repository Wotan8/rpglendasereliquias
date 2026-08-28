/**
 * Botão "Usar" de item consumível.
 *
 * Regras verificadas:
 *  • status vital "Atual" soma e subtrai, sempre com clamp em [0, Máximo];
 *  • cura quebrada fecha para CIMA (mesma régua de derived-values.js);
 *  • Máximo 0 (ficha que ainda não calculou os vitais) não vira teto;
 *  • "_MAX" é ignorado no uso (é bônus de equipar, não efeito de consumo);
 *  • condição vinculada entra em state.conditions e não duplica;
 *  • consumir decrementa a quantidade e remove o item na última unidade;
 *  • vínculo do modelo do catálogo vale quando a instância não tem o seu;
 *  • item que não é Consumível é recusado.
 *
 * Roda com: node ficha-v1.7_1/js/usar-item.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./inventory.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Recorta um trecho do módulo (o resto depende do DOM e do state da ficha). */
function pega(inicio, fimMarcador) {
  const ini = src.indexOf(inicio);
  assert.ok(ini > 0, `"${inicio}" não encontrado`);
  const fim = src.indexOf(fimMarcador, ini + inicio.length);
  assert.ok(fim > ini, `fim de "${inicio}" não encontrado`);
  return src.slice(ini, fim + fimMarcador.length);
}

const CODIGO = [
  pega('function _campoDoItem(item, key)', "return (tpl && Array.isArray(tpl[key])) ? tpl[key] : [];\n}"),
  pega('const _statusVitaisDoItem = item =>', "{ id: sv, modificador: 0 }));"),
  pega('const VITAL_CAMPOS = {', "nome: 'Sanidade' },\n};"),
  pega('function _mecanicasDoItem(item)', 'return [...ids];\n}'),
  pega('window.podeUsarItem = function(item)', '_mecanicasDoItem(item).length > 0;\n};'),
  pega('window.usarItem = async function(itemId)', "'sem efeito'}`);\n};"),
].join('\n');

/** Sandbox: campos da ficha viram objetos simples; Firestore vira um log. */
function montaAmbiente({ items, catalog = [], vitais, conditions = [], systemConditions = [], mechanics = [] }) {
  // Como a ficha realmente endereça os dois campos (ficha-v1.7_1.html):
  //   Atual  → <input data-key="vit_atual">      (SEM id)
  //   Máximo → <input id="vit_max_display">      (número em .value)
  // O mock separa os dois caminhos de propósito: se o código voltar a procurar
  // o Atual por getElementById, ou a ler o Máximo em .textContent, ele acha
  // null/undefined aqui e o teste quebra — foi exatamente esse o bug.
  const DISPLAY = { vit_atual: 'vit_max_display', ener_atual: 'ener_max_display', san_atual: 'san_max_display' };
  const campos = {};        // tudo junto, só para as asserções lerem
  const porId = {};         // o que a ficha expõe por id
  const porDataKey = {};    // o que a ficha expõe por data-key
  for (const [id, v] of Object.entries(vitais)) {
    campos[id] = porDataKey[id] = { value: String(v.atual), dispatchEvent() {} };
    campos[DISPLAY[id]] = porId[DISPLAY[id]] = { value: String(v.max) };
  }

  const gravado = [];
  const state = { conditions };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    LRDialogo: { toast: (msg) => gravado.push({ op: 'alert', msg }) },
    Event: class { constructor(t) { this.type = t; } },
    state,
    document: {
      getElementById: id => porId[id] || null,
      querySelector: (sel) => {
        const m = /^\[data-key="([^"]+)"\]$/.exec(sel);
        return m ? (porDataKey[m[1]] || null) : null;
      },
    },
    _firestoreSetDoc: async (col, id, data) => { gravado.push({ op: 'set', id, data }); },
    _firestoreDeleteDoc: async (col, id) => { gravado.push({ op: 'del', id }); },
    renderEquippedItems() {}, renderInventoryTab() {}, recalcInventoryPressure() {},
    applyMechanicToSheet: (mech, pec, isOneOff) => { gravado.push({ op: 'mech', id: mech.id, isOneOff }); },
  };
  ctx.window = ctx;
  ctx._inventoryState = { items, catalog };
  ctx._systemData = { conditions: systemConditions, mechanics };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  return { ctx, campos, gravado, state };
}

const CURA = { id: 'VIT_ATUAL', modificador: 4 };
const item = extra => ({ id: 'i1', nome: 'Loção', tipo: 'Consumível', quantidade: 1, ...extra });

// --- clamp no teto ---------------------------------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 8, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 10, 'cura de +4 em 8/10 deve parar no Máximo');
}

// --- cura normal, sem encostar no teto -------------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 3, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 7, '3 + 4 = 7');
}

// --- cura quebrada fecha para cima -----------------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [{ id: 'VIT_ATUAL', modificador: 1.5 }] })],
    vitais: { vit_atual: { atual: 3, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 5, '3 + 1,5 = 4,5 → 5: meia Vitalidade não existe na mesa');
}

// --- Máximo ainda não calculado não vira teto ------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 2, max: 0 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 6, 'Máximo 0 é ficha sem vitais calculados, não teto zero');
}

// --- clamp no piso (modificador negativo) ----------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [{ id: 'SAN_ATUAL', modificador: -9 }] })],
    vitais: { san_atual: { atual: 5, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.san_atual.value, 0, 'não existe status vital negativo');
}

// --- "_MAX" não é efeito de uso --------------------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ statusVitaisVinculados: [{ id: 'VIT_MAX', modificador: 5 }], condicaoIds: ['c1'] })],
    vitais: { vit_atual: { atual: 2, max: 10 } },
    systemConditions: [{ id: 'c1', nome: 'Atordoado' }],
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, '2', 'VIT_MAX é bônus de equipar, não altera o Atual ao usar');
}

// --- condição entra e não duplica ------------------------------------------
{
  const base = () => ({
    items: [item({ quantidade: 3, condicaoIds: ['c1'] })],
    vitais: { vit_atual: { atual: 5, max: 10 } },
    systemConditions: [{ id: 'c1', nome: 'Atordoado', duracao: '2', icone: '💫' }],
  });
  const { ctx, state } = montaAmbiente(base());
  await ctx.usarItem('i1');
  assert.equal(state.conditions.length, 1, 'condição vinculada deve ser aplicada');
  assert.equal(state.conditions[0].modeloId, 'c1');
  await ctx.usarItem('i1');
  assert.equal(state.conditions.length, 1, 'usar de novo não duplica a condição ativa');
}

// --- consumo: decrementa e some na última unidade --------------------------
{
  const { ctx, gravado } = montaAmbiente({
    items: [item({ quantidade: 3, statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.deepEqual(gravado.filter(g => g.op === 'set').map(g => g.data.quantidade), [2], '3 → 2');
}
{
  const { ctx, gravado } = montaAmbiente({
    items: [item({ quantidade: 1, statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.deepEqual(gravado.filter(g => g.op === 'del').map(g => g.id), ['i1'], 'última unidade remove o item');
  assert.equal(ctx._inventoryState.items.length, 0, 'e sai da lista em memória');
}

// --- vínculo herdado do modelo do catálogo ---------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ modeloId: 'm1' })],
    catalog: [{ id: 'm1', statusVitaisVinculados: [CURA] }],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 5, 'item sem vínculo próprio herda o do modelo');
}

// --- instância vence modelo ------------------------------------------------
{
  const { ctx, campos } = montaAmbiente({
    items: [item({ modeloId: 'm1', statusVitaisVinculados: [{ id: 'VIT_ATUAL', modificador: 1 }] })],
    catalog: [{ id: 'm1', statusVitaisVinculados: [CURA] }],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, 2, 'vínculo próprio da instância vence o do modelo');
}

// --- só consumível pode ser usado ------------------------------------------
{
  const { ctx, campos, gravado } = montaAmbiente({
    items: [item({ tipo: 'Arma', statusVitaisVinculados: [CURA] })],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.equal(campos.vit_atual.value, '1', 'arma não cura ao ser "usada"');
  assert.ok(gravado.some(g => g.op === 'alert'), 'e avisa o jogador');
}

// --- mecânica do item dispara como ONE-OFF ---------------------------------
// É o que destrava alvos "ATUAL:" (Vitalidade Atual etc.): o motor descarta
// esses alvos quando isOneOff é falso.
{
  const { ctx, gravado } = montaAmbiente({
    items: [item({ modeloId: 'm1' })],
    catalog: [{ id: 'm1', mecanicaIds: ['k1'] }],
    mechanics: [{ id: 'k1', nome: 'Loção de Cura 2 (+4 VIT)' }],
    vitais: { vit_atual: { atual: 1, max: 10 } },
  });
  await ctx.usarItem('i1');
  assert.deepEqual(gravado.filter(g => g.op === 'mech'), [{ op: 'mech', id: 'k1', isOneOff: true }],
    'mecânica do modelo deve disparar com isOneOff=true');
}

// --- podeUsarItem: o botão só aparece quando há efeito ---------------------
{
  const { ctx } = montaAmbiente({ items: [], vitais: { vit_atual: { atual: 1, max: 10 } } });
  assert.equal(ctx.podeUsarItem({ tipo: 'Consumível', statusVitaisVinculados: [CURA] }), true);
  assert.equal(ctx.podeUsarItem({ tipo: 'Consumível', condicaoIds: ['c1'] }), true);
  assert.equal(ctx.podeUsarItem({ tipo: 'Consumível' }), false, 'consumível sem efeito não mostra Usar');
  assert.equal(ctx.podeUsarItem({ tipo: 'Consumível', statusVitaisVinculados: [{ id: 'VIT_MAX', modificador: 5 }] }), false,
    'só _MAX não é efeito de uso');
  assert.equal(ctx.podeUsarItem({ tipo: 'Arma', statusVitaisVinculados: [CURA] }), false);
  assert.equal(ctx.podeUsarItem(null), false);
}

console.log('✅ usar-item: todos os casos passaram');
