// node criar-personagem/js/avulsa-herdada.test.mjs
// Peculiaridade que a Raça/Classe/Tribo já concede não pode ficar também como
// avulsa: na ficha ela aplicaria as mecânicas duas vezes (o Guerreiro com
// "Domínio de Armas de Braço" e o Teto de Ofício somando [FOR] em dobro).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const removidas = [];
let salvou = 0;

const ctx = vm.createContext({
    console: { log() {}, warn() {}, error: console.error },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    wizardState: { peculiaridadesIndividuais: [], mesaVinculada: null },
    ExpTracker: { removeSource: k => removidas.push(k) },
    saveWizardToStorage: () => { salvou++; },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'peculiarities-module.js'), 'utf8'), ctx);

const purgar = ids => vm.runInContext('purgarAvulsasHerdadas', ctx)(new Set(ids));

// --- Nada herdado: não mexe no estado nem salva à toa ---
ctx.wizardState.peculiaridadesIndividuais = [{ id: 'v1', nivel: 1 }, { id: 'd1', nivel: 2 }];
purgar([]);
assert.equal(ctx.wizardState.peculiaridadesIndividuais.length, 2);
assert.equal(salvou, 0, 'sem duplicata não há por que gravar');

// --- Classe concede a mesma pec: a avulsa sai e o EXP dela volta ---
purgar(['v1']);
assert.deepEqual(ctx.wizardState.peculiaridadesIndividuais, [{ id: 'd1', nivel: 2 }]);
assert.deepEqual(removidas, ['pec_v1'], 'o EXP pago pela avulsa é devolvido');
assert.equal(salvou, 1);

// --- Entrada nula no estado não derruba a purga ---
ctx.wizardState.peculiaridadesIndividuais = [null, { id: 'd1', nivel: 2 }];
purgar(['d1']);
assert.deepEqual(ctx.wizardState.peculiaridadesIndividuais, [null]);

console.log('OK');
