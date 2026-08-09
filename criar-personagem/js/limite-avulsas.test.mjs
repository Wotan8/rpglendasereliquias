// node criar-personagem/js/limite-avulsas.test.mjs
// A mesa limita QUANTAS avulsas de cada tipo o jogador pega na criação
// (Painel do Mestre → Configurações da Campanha). Sem mesa, ou mesa antiga sem
// o campo, vale o padrão 3 — o mesmo que o painel mostra.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error: console.error },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    wizardState: { peculiaridadesIndividuais: [], mesaVinculada: null },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'peculiarities-module.js'), 'utf8'), ctx);

const limite = e => vm.runInContext(`limiteAvulsas(${e})`, ctx);
const contar = e => vm.runInContext(`contarAvulsas(${e})`, ctx);
const rotulo = e => vm.runInContext(`rotuloContagemAvulsas(${e})`, ctx);

ctx.INDIVIDUAL_PECULIARITIES = [
    { id: 'v1', nome: 'Sortudo', ehVantagem: true },
    { id: 'v2', nome: 'Teimoso', ehVantagem: true },
    { id: 'd1', nome: 'Azarado', ehVantagem: false },
    { id: 'd2', nome: 'Feio', ehVantagem: false },
];

// --- Criação avulsa (sem mesa): livre, não há Mestre para configurar teto ---
assert.equal(limite(true), Infinity);
assert.equal(limite(false), Infinity);
assert.equal(rotulo(true), '0', 'sem teto o contador não mostra "/N"');

// --- Mesa antiga, sem os campos: também cai no padrão ---
ctx.wizardState.mesaVinculada = { id: 'm1', nome: 'Reliera', expInicial: 15 };
assert.equal(limite(true), 3, 'mesa sem o campo não trava o jogador em 0');

// --- Mesa configurada ---
ctx.wizardState.mesaVinculada = { id: 'm1', maxPecVantagens: 2, maxPecDesvantagens: 4 };
assert.equal(limite(true), 2);
assert.equal(limite(false), 4);

// --- 0 é um valor válido, não "não configurado" ---
ctx.wizardState.mesaVinculada = { id: 'm1', maxPecVantagens: 0, maxPecDesvantagens: 3 };
assert.equal(limite(true), 0, 'mesa que proíbe vantagens avulsas é configuração legítima');

// --- Contagem separa vantagem de desvantagem ---
ctx.wizardState.peculiaridadesIndividuais = [
    { id: 'v1', nivel: 1 }, { id: 'd1', nivel: 1 }, { id: 'd2', nivel: 2 },
];
assert.equal(contar(true), 1);
assert.equal(contar(false), 2);
assert.equal(rotulo(false), '2/3', 'com mesa, o contador mostra o teto');

// --- Peculiaridade escolhida que sumiu do catálogo não conta nem quebra ---
ctx.wizardState.peculiaridadesIndividuais.push({ id: 'fantasma', nivel: 1 });
assert.equal(contar(true) + contar(false), 3, 'id órfão é ignorado');

console.log('OK');
