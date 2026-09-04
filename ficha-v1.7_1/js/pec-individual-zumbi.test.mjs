// node ficha-v1.7_1/js/pec-individual-zumbi.test.mjs
// Peculiaridade individual que o Mestre apagou não pode voltar sozinha. O
// dot 'pec_<id>' guarda só o NÍVEL e é escrito por qualquer fonte que renderize
// a pec — reconstruir a lista a partir dele ressuscitava o que foi removido e
// inventava uma cópia avulsa de toda pec herdada de raça/classe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
let renderizadas = null;

const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    document: {
        getElementById: () => ({ querySelectorAll: () => [] }),
        querySelectorAll: () => [],
        addEventListener() {},
        createElement: () => ({ classList: { add() {}, toggle() {} }, dataset: {}, style: {}, appendChild() {}, addEventListener() {}, querySelectorAll: () => [] }),
    },
    state: { dots: {}, peculiaridadesIndividuais: [] },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'race-peculiarities.js'), 'utf8'), ctx);

// dublês (as declarações reais sobrescreveriam se postas antes da carga)
ctx._clearPeculiaridadeBlocksByFonte = () => {};
ctx._renderSingleSourceBlock = lista => { renderizadas = lista; };
ctx._resolvePeculiaridade = p => ({ id: typeof p === 'object' ? p.id : p, mecanicas: [] });

const render = vm.runInContext('renderIndividualPeculiaridades', ctx);

// "Mestre em Armas": herdada da classe, catálogo diz fonte 'individual'.
// A classe já rendeu a pill e deixou o dot para trás.
ctx._systemData = { peculiarities: [{ id: 'dom1', nome: 'Mestre em Armas', fonte: 'individual' }] };
ctx.state.dots = { pec_dom1: 1 };
ctx.state.peculiaridadesIndividuais = [];

render();
assert.deepEqual(ctx.state.peculiaridadesIndividuais, [], 'dot solto não inventa peculiaridade individual');
assert.deepEqual(renderizadas, [], 'e nada é desenhado no bloco de individuais');

// O que está na lista continua sendo renderizado normalmente.
ctx.state.peculiaridadesIndividuais = [{ id: 'cicatriz', nivel: 3 }];
render();
assert.deepEqual(renderizadas.map(p => p.id), ['cicatriz']);

console.log('OK');
