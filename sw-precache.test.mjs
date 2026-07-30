// Rodar: node sw-precache.test.mjs
// Guarda contra o erro de adicionar um módulo novo e esquecer de registrá-lo no
// PRECACHE_URLS do sw.js: no PWA offline o import quebra, e mesmo online o
// arquivo fica fora do cache versionado (fica preso no stale-while-revalidate).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = dirname(fileURLToPath(import.meta.url));
const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');

// --- VERSION existe e tem o formato esperado ---
const mv = sw.match(/const VERSION = '([^']+)'/);
assert.ok(mv, 'sw.js precisa declarar VERSION');
assert.match(mv[1], /^v\d+$/, `VERSION deve ser vN (achei "${mv[1]}")`);

// --- todo módulo do Tabuleiro tem que estar no precache ---
const precache = new Set([...sw.matchAll(/'(\/[^']+)'/g)].map(m => m[1]));
const dir = join(raiz, 'tabuleiro', 'js');
const modulos = readdirSync(dir).filter(f => f.endsWith('.js'));   // .test.mjs fica fora por extensão

const faltando = modulos
    .map(f => `/tabuleiro/js/${f}`)
    .filter(u => !precache.has(u));

assert.deepEqual(faltando, [],
    `módulo(s) do Tabuleiro fora do PRECACHE_URLS do sw.js:\n  ${faltando.join('\n  ')}\n` +
    `Adicione a linha e incremente o VERSION.`);

// --- e nada de entrada apontando para arquivo que não existe mais ---
const existentes = new Set(modulos.map(f => `/tabuleiro/js/${f}`));
const orfas = [...precache].filter(u => u.startsWith('/tabuleiro/js/') && !existentes.has(u));
assert.deepEqual(orfas, [], `entrada(s) do precache sem arquivo correspondente:\n  ${orfas.join('\n  ')}`);

console.log(`✅ sw-precache: VERSION=${mv[1]} · ${modulos.length} módulos do Tabuleiro todos no precache, sem órfãos`);
