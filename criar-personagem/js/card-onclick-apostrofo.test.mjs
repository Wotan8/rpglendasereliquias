/**
 * Nome com apóstrofo (Liu'r, Ragh'mar) não pode entrar cru dentro de um onclick.
 *
 * escHtml vira ' em &#39;, mas o parser de HTML decodifica a entidade ANTES do
 * JS ler o atributo — o argumento vira uma string quebrada e o card morre:
 * não seleciona e não abre o modal. Por isso o nome só trafega via data-*,
 * lido com this.dataset no handler.
 *
 * Roda com: node criar-personagem/js/card-onclick-apostrofo.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// onclick="fn('${...}')" — nome interpolado dentro de string JS
const INTERPOLADO = /onclick="[^"]*\('\$\{/;

for (const arquivo of ['tribe-module.js', 'race-module.js']) {
  const src = readFileSync(join(dir, arquivo), 'utf8');
  assert.ok(!INTERPOLADO.test(src), `${arquivo}: onclick com nome interpolado em string JS — quebra com apóstrofo`);
}

// E o caminho seguro continua no lugar, um por card (tribo, raça, classe).
const tribe = readFileSync(join(dir, 'tribe-module.js'), 'utf8');
const race = readFileSync(join(dir, 'race-module.js'), 'utf8');
assert.match(tribe, /onclick="selectTribe\(this\.dataset\.tribe\)"/);
assert.match(race, /onclick="selectRace\(this\.dataset\.race\)"/);
assert.match(race, /onclick="selectClass\(this\.dataset\.class\)"/);

console.log('ok — nenhum nome de raça/classe/tribo interpolado em onclick');
