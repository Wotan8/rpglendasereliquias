// node criar-personagem/js/teto-desvantagens.test.mjs
// O ganho de EXP das Desvantagens avulsas para no teto; vantagens (pec_ negativo)
// e as herdadas (inherited_pec_) continuam somando/subtraindo sem limite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error: console.error },
    document: { getElementById: () => null },
    setTimeout() {},
    wizardState: { expSources: {} },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'exp-tracker.js'), 'utf8'), ctx);

const TETO = vm.runInContext('TETO_GANHO_DESVANTAGENS', ctx);
const total = () => vm.runInContext('ExpTracker.getTotal()', ctx);
const totalGasto = () => vm.runInContext('ExpTracker.calcExpTotal()', ctx);
const src = (k, amount) => { ctx.wizardState.expSources[k] = { amount, label: k }; };

// EXP Inicial da mesa (15 + sessão 47) sozinha
src('exp_inicial', 15);
src('exp_sessao', 47);
assert.equal(total(), 62);

// Desvantagens abaixo do teto entram inteiras
src('pec_azarado', 10);
src('pec_caolho', 8);
assert.equal(total(), 62 + 18);

// Passando do teto, o excedente é descartado
src('pec_nanismo', 24);
assert.equal(total(), 62 + TETO, 'ganho de desvantagens fica travado no teto');

// Vantagem continua cobrando integralmente por cima do teto
src('pec_sortudo', -14);
assert.equal(total(), 62 + TETO - 14);

// Herdada de raça/classe/tribo não é escolha livre: fora do teto
src('inherited_pec_racial', -5);
assert.equal(total(), 62 + TETO - 14 - 5);

// A EXP Total exibida usa o mesmo teto (senão a tela mente sobre o poder do PJ)
ctx.wizardState.atributos = {};
ctx.wizardState.pericias = {};
assert.equal(totalGasto(), 62 + TETO, 'só as fontes positivas, com o teto aplicado');

console.log('OK');
