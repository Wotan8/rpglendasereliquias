/**
 * Piso 0 das Defesas (tipoLimite 'clamp').
 *
 * "Reação + perícia − 1" deixa quem não treinou a defesa com −1 na ficha, e
 * defesa negativa não significa nada na mesa. O limite das Defesas é clamp:
 * teto = menor(DES,RAC), piso = 0 — os dois no MESMO limite, porque o engine
 * só guarda um limite por alvo.
 *
 * Roda com: node ficha-v1.7_1/js/piso-defesa.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./derived-values.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function _applyMechanicModifiers(');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0 && fim > ini, '_applyMechanicModifiers não encontrado');

const sandbox = { state: { mechanicBonuses: {}, mechanicLimits: {} }, resultado: null };
vm.createContext(sandbox);
const K = 'DERIVED:DEFESA_ESQUIVA';
const aplica = (total, limit) => {
    vm.runInContext(`${src.slice(ini, fim)}\nresultado = _applyMechanicModifiers('DEFESA_ESQUIVA', 0, `
        + `${JSON.stringify({ [K]: total })}, ${JSON.stringify({ [K]: limit })});`, sandbox);
    return sandbox.resultado;
};

const clamp = { tipo: 'clamp', min: 0, max: 3 };
assert.equal(aplica(-1, clamp), 0, 'sem a perícia, a defesa para em 0 e não em −1');
assert.equal(aplica(2, clamp), 2, 'dentro da faixa, o valor passa intacto');
assert.equal(aplica(5, clamp), 3, 'o teto continua valendo com o piso ligado');

// As mecânicas antigas (só teto, só piso) não podem ter mudado de comportamento.
assert.equal(aplica(5, { tipo: 'maximo', min: null, max: 3 }), 3, 'teto puro');
assert.equal(aplica(-2, { tipo: 'minimo', min: 0, max: null }), 0, 'piso puro');
assert.equal(aplica(7, { tipo: 'bloqueio', min: 0, max: 0 }), 0, 'bloqueio zera');

console.log('✅ piso das Defesas OK — 0 no chão, teto de pé');
