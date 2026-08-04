/**
 * Refs "Item: ..." das Equações de Valor — leem o item em escopo.
 *
 * Regras verificadas:
 *  • sem item em escopo (ou item inexistente) → 0, como qualquer ref desconhecida;
 *  • preço/liga/capacidade vêm do modelo do catálogo (a instância não os copia);
 *  • liga é string ('3') no cadastro e precisa sair numérica;
 *  • ausente/vazio → 0 (92 dos 155 equipamentos não têm preço nem liga);
 *  • peso usa pressaoOverride > pressaoBase > peso.
 *
 * Roda com: node ficha-v1.7_1/js/item-props.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* Extrai o bloco _ME_ITEM_PROPS + _meItemProp (o resto do módulo depende do DOM). */
const src = readFileSync(new URL('./mechanics-engine.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('const _ME_ITEM_PROPS = {');
const fim = src.indexOf('\n}\n', src.indexOf('function _meItemProp(prop)')) + 3;
assert.ok(ini > 0 && fim > ini, '_ME_ITEM_PROPS / _meItemProp não encontrados');

const ADAGA_TPL = { id: 'tplAdaga', nome: 'Adaga', preco: 300, liga: '3', capacidadeContainer: 0, multiplicadorPressao: 1 };
const MOCHILA_TPL = { id: 'tplMochila', nome: 'Mochila', capacidadeContainer: 12, multiplicadorPressao: 0.5 };
const SEM_PRECO_TPL = { id: 'tplSimples', nome: 'Roupas Simples' };   // como 92/155 do catálogo

/** Roda _meItemProp com um escopo e um inventário forjados. */
function prop(nome, { escopo = 'i1', items = [], catalog = [] } = {}) {
  const sandbox = {
    window: { _inventoryState: { items, catalog } },
    _meItemScope: escopo,
    resultado: null
  };
  vm.createContext(sandbox);
  vm.runInContext(`let _meItemScope = ${JSON.stringify(escopo)};\n${src.slice(ini, fim)}\nresultado = _meItemProp(${JSON.stringify(nome)});`, sandbox);
  return sandbox.resultado;
}

const adaga = { id: 'i1', nome: 'Adaga', modeloId: 'tplAdaga', peso: 1, tamanho: 1, quantidade: 2 };
const inv = { items: [adaga], catalog: [ADAGA_TPL, MOCHILA_TPL, SEM_PRECO_TPL] };

// --- campos da própria instância ---
assert.equal(prop('Peso/Pressão', inv), 1);
assert.equal(prop('Tamanho', inv), 1);
assert.equal(prop('Quantidade', inv), 2);

// --- campos que só existem no catálogo ---
assert.equal(prop('Preço', inv), 300, 'preço deve vir do modelo');
assert.equal(prop('Liga', inv), 3, 'liga é string no cadastro e sai numérica');

// --- pressão: override > base > peso ---
assert.equal(prop('Peso/Pressão', { items: [{ ...adaga, pressaoBase: 4 }], catalog: inv.catalog }), 4);
assert.equal(prop('Peso/Pressão', { items: [{ ...adaga, pressaoBase: 4, pressaoOverride: 0.5 }], catalog: inv.catalog }), 0.5);

// --- ausência vale 0, nunca NaN ---
const simples = { id: 'i1', nome: 'Roupas', modeloId: 'tplSimples', peso: 1 };
assert.equal(prop('Preço', { items: [simples], catalog: inv.catalog }), 0);
assert.equal(prop('Liga', { items: [simples], catalog: inv.catalog }), 0);
assert.equal(prop('Tamanho', { items: [simples], catalog: inv.catalog }), 0);

// --- Qualidade e Afiação: entram na Equação de Dano (`FOR + Item: Qualidade + Item: Afiação`) ---
const GRAAL_TPL = { id: 'tplGraal', nome: 'Espada Longa', liga: '5', qualidade: '5', afiacao: 5 };
const espada = { id: 'i1', nome: 'Espada Longa', modeloId: 'tplGraal', peso: 2 };
const invGraal = { items: [espada], catalog: [GRAAL_TPL] };
assert.equal(prop('Qualidade', invGraal), 5, 'Qualidade vem do modelo e sai numérica');
assert.equal(prop('Afiação', invGraal), 5, 'Afiação idem');
// Peça sem Qualidade precisa dar 0 — undefined faria a equação inteira virar NaN.
assert.equal(prop('Qualidade', { items: [simples], catalog: inv.catalog }), 0, 'sem Qualidade vale 0');
assert.equal(prop('Afiação', { items: [simples], catalog: inv.catalog }), 0, 'sem Afiação vale 0');
// A instância vence o modelo: uma lâmina refeita não muda o catálogo inteiro.
assert.equal(prop('Qualidade', { items: [{ ...espada, qualidade: 2 }], catalog: [GRAAL_TPL] }), 2, 'instância sobrepõe o modelo');
// Migração: o campo antigo `fio` e a ref antiga 'Fio' seguem valendo enquanto
// houver instância antiga em ficha — item não migrado não pode virar 0.
const LEGADO_TPL = { id: 'tplLegado', nome: 'Machado', liga: '4', fio: '3' };
assert.equal(prop('Qualidade', { items: [{ id: 'i1', nome: 'Machado', modeloId: 'tplLegado', peso: 2 }], catalog: [LEGADO_TPL] }), 3, 'campo antigo fio alimenta a Qualidade');
assert.equal(prop('Fio', invGraal), 5, "ref antiga 'Fio' é alias da Qualidade");
// Trava do Livro (5.5): Qualidade ≤ Liga, não estrito. Aqui só o dado; quem valida é o audit.
assert.ok(prop('Qualidade', invGraal) <= prop('Liga', invGraal), 'Qualidade 5 cabe na Liga 5');

// --- container: multiplicador cai no modelo, com default 1 ---
const mochila = { id: 'i1', nome: 'Mochila', modeloId: 'tplMochila', peso: 2, ehContainer: true };
assert.equal(prop('Multiplicador de Pressão', { items: [mochila], catalog: inv.catalog }), 0.5);
assert.equal(prop('Capacidade do Container', { items: [mochila], catalog: inv.catalog }), 12);
assert.equal(prop('Multiplicador de Pressão', { items: [simples], catalog: inv.catalog }), 1, 'sem multiplicador = 1');

// --- item avulso (sem modelo) não explode ---
assert.equal(prop('Preço', { items: [{ id: 'i1', nome: 'Achado', peso: 3 }], catalog: [] }), 0);
assert.equal(prop('Peso/Pressão', { items: [{ id: 'i1', nome: 'Achado', peso: 3 }], catalog: [] }), 3);

// --- sem escopo / item sumido / prop inexistente → 0 ---
assert.equal(prop('Preço', { ...inv, escopo: null }), 0, 'sem item em escopo vale 0');
assert.equal(prop('Preço', { ...inv, escopo: 'iX' }), 0, 'item fora do inventário vale 0');
assert.equal(prop('Cor', inv), 0, 'propriedade inexistente vale 0');

// --- o prefixo cortado em _resolveSheetRef bate com as chaves do mapa ---
assert.equal('Item: Peso/Pressão'.slice(6), 'Peso/Pressão');
assert.ok(src.includes("ref.startsWith('Item: ')"), 'branch de Item: some do _resolveSheetRef');
for (const chave of ['Peso/Pressão', 'Tamanho', 'Preço', 'Liga', 'Qualidade', 'Fio', 'Afiação', 'Quantidade', 'Multiplicador de Pressão', 'Capacidade do Container']) {
  assert.equal(prop(chave, inv) === 0 || typeof prop(chave, inv) === 'number', true);
}

console.log('✅ refs "Item: ..." OK — instância, catálogo, defaults e escopo ausente');
