/**
 * O fold do resolveEquation com min — a conta do Domínio.
 *
 * A equação de Dano das armas é [Qualidade, +Afiação, min Teto, +FOR], que
 * só funciona porque resolveEquation aplica os ops EM SEQUÊNCIA:
 *   min(Q + A, teto) + FOR
 * Se alguém "otimizar" o min para valer da equação inteira, isto quebra.
 *
 * Roda com: node ficha-v1.7_1/js/equacao-min.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./mechanics-engine.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function resolveEquation(');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0 && fim > ini, 'resolveEquation não encontrado');

const FICHA = {
    'Item: Qualidade': 5, 'Item: Afiação': 5,
    'FOR': 2, 'DES': 3,
    'Teto de Ofício: Braço': 2,        // FOR 2, sem Domínio
    'Teto de Ofício: Braço +10': 12,   // FOR 2, com Domínio
};
const sandbox = { _resolveTermValue: t => (t.valor !== undefined ? t.valor : (FICHA[t.ref] ?? 0)), resultado: null };
vm.createContext(sandbox);
const roda = eq => { vm.runInContext(`resultado = (${src.slice(ini, fim)})(${JSON.stringify(eq)});`, sandbox); return sandbox.resultado; };

const Q = { tipo: 'ficha', ref: 'Item: Qualidade' };
const A = { op: '+', tipo: 'ficha', ref: 'Item: Afiação' };

// Mago FOR 2 segura a espada Graal (Q5 A5): rende min(10, 2) + 2 = 4
assert.equal(roda([Q, A, { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Braço' }, { op: '+', tipo: 'ficha', ref: 'FOR' }]), 4,
    'sem Domínio o Ofício rende até o atributo');

// Com o Domínio (+10 no teto): rende tudo — min(10, 12) + 2 = 12
assert.equal(roda([Q, A, { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Braço +10' }, { op: '+', tipo: 'ficha', ref: 'FOR' }]), 12,
    'com Domínio rende inteiro');

// Besta: potência fixa no lugar do atributo — min(10, 2) + 3 = 5
assert.equal(roda([Q, A, { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Braço' }, { op: '+', valor: 3 }]), 5,
    'besta preserva a potência fora do cap');

// Arma sem Ofício nenhum (Q0 A0): min(0, teto) + FOR = FOR — o gate não pune o comum
assert.equal(roda([{ tipo: 'ficha', ref: 'nada' }, { op: '+', tipo: 'ficha', ref: 'nada2' },
    { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Braço' }, { op: '+', tipo: 'ficha', ref: 'FOR' }]), 2,
    'arma comum rende FOR puro');

// A forma pura menor(A, B) continua valendo (Reação usa isso)
assert.equal(roda([{ tipo: 'ficha', ref: 'DES' }, { op: 'min', tipo: 'ficha', ref: 'FOR' }]), 2,
    'min puro entre dois termos');

console.log('✅ fold do min OK — o Domínio calcula min(Q+A, teto) + atributo');
