// node ficha-v1.7_1/js/atk-desarmado.test.mjs
// A tabela "Ataques e Efeitos Ativos" lista as partes do corpo que golpeiam e
// estão livres. Aqui a ligação: quais slots o item equipado ocupa, e de onde
// vem o podeGolpear. As regras do golpe em si estão em __check-item-scope.js.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(dir, '../..');
const tabela = { innerHTML: '' };
const secao = { style: {} };
const noh = () => ({ style: {}, dataset: {}, querySelectorAll: () => [], appendChild() {}, addEventListener() {}, classList: { add() {}, toggle() {}, remove() {} } });

const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    document: {
        getElementById: id => id === 'activeEffectsTable' ? tabela : id === 'activeEffectsSection' ? secao : noh(),
        querySelectorAll: () => [], addEventListener() {}, createElement: noh, body: noh(),
    },
    setTimeout: () => {}, alert: () => {},
    /* A cópia do personagem NÃO tem podeGolpear — a flag é nova. Quem responde
       é o catálogo, senão nenhum personagem existente veria o golpe. */
    state: {
        derived: { ACERTO_DESARMADO: 1, DANO: 5 }, itemBonuses: {},
        partesDoCorpo: [
            { id: 'mao', nome: 'Mão', icone: '🖐️', slots: 2 },
            { id: 'torso', nome: 'Torso', icone: '👕', slots: 1 },
        ],
    },
});
ctx.window = ctx;
for (const f of ['ficha-v1.7_1/js/item-scope-calc.js', 'shared/equip-slots.js', 'ficha-v1.7_1/js/inventory.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx);
}
ctx._systemData = { bodyParts: [{ id: 'mao', podeGolpear: true }, { id: 'torso', podeGolpear: false }] };
ctx.DERIVED_VALUES = [
    { key: 'ACERTO_DESARMADO', nome: 'Acerto Desarmado', icone: '👊', escopoItem: 'coluna' },
    { key: 'DANO', nome: 'Dano', icone: '💥', escopoItem: 'dano' },
];

const render = itens => {
    ctx._inventoryState = { catalog: [], items: itens };
    vm.runInContext('renderActiveEffects()', ctx);
    return tabela.innerHTML;
};
const linhasDesarmadas = html => [...html.matchAll(/atk-item-name">([^<]+)<\/span>\s*<small class="atk-item-state" title="[^"]*Parte do corpo/g)].map(m => m[1].trim());

// --- Mãos livres: socam igual, então saem numa linha só com ×2 ---
let html = render([]);
assert.deepEqual(linhasDesarmadas(html), ['🖐️ Mão ×2'], 'partes iguais não se repetem');
assert.match(html, /1d4\+5/, 'dado 1d4 + o Dano do personagem');
assert.match(html, /Contundente/, 'punho é contundente');
assert.equal(secao.style.display, '', 'a seção aparece mesmo sem item nenhum');

// --- Qualquer item equipado ocupa a parte, arma ou não ---
html = render([{ id: 'escudo', nome: 'Escudo', equipado: true, slotAnatomico: 'mao_1' }]);
assert.deepEqual(linhasDesarmadas(html), ['🖐️ Mão 2'], 'sobrou uma mão: a linha diz qual');

// --- Item guardado no inventário não ocupa nada ---
html = render([{ id: 'escudo', nome: 'Escudo', equipado: false, slotAnatomico: 'mao_1' }]);
assert.deepEqual(linhasDesarmadas(html), ['🖐️ Mão ×2']);

// --- Arma de duas mãos toma os dois slots (slotsOcupados, não só o principal) ---
html = render([{ id: 'esp', nome: 'Espadão', equipado: true, slotAnatomico: 'mao_1', slotsOcupados: ['mao_2'], formulaDano: '1d12' }]);
assert.deepEqual(linhasDesarmadas(html), [], 'com as duas mãos ocupadas não sobra golpe desarmado');
assert.match(html, /1d12\+5/, 'e a arma continua na tabela');

// --- VD vinculado à parte, por modificador fixo ---
ctx._systemData.bodyParts[0].valoresDerivadosVinculados = [{ id: 'dv-dano', modificador: 2 }];
ctx.DERIVED_VALUES[1].id = 'dv-dano';
html = render([]);
assert.match(html, /1d4\+7/, 'Dano 5 do personagem + 2 da parte');

// --- ...e por equação, que vence o modificador fixo (igual ao item) ---
ctx.resolveEquation = () => 4;
ctx._systemData.bodyParts[0].valoresDerivadosVinculados = [{ id: 'dv-dano', modificador: 2, equacao: [{ tipo: 'fixo', valor: 4 }] }];
html = render([]);
assert.match(html, /1d4\+9/, 'equação (4) vence o modificador (2)');

// --- Vínculo em uma parte não vaza para as outras, e separa as linhas ---
ctx._systemData.bodyParts.push({ id: 'pe', podeGolpear: true });
ctx.state.partesDoCorpo.push({ id: 'pe', nome: 'Pé', icone: '🥾', slots: 1 });
html = render([]);
assert.deepEqual(linhasDesarmadas(html), ['🖐️ Mão ×2', '🥾 Pé'], 'Pé sem vínculo fica na sua própria linha');
assert.match(html, /1d4\+5/, 'e o Pé mantém o dano base');

console.log('OK');
