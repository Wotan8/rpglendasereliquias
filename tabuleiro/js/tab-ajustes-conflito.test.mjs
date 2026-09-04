/**
 * 🧩 Os quatro ajustes do conflito: as três defesas do Núcleo v2, condição do
 * equipamento, a conta do dano à vista e a diferença de tamanho.
 *
 * A lógica pura já está trancada em tab-conflito-calc.test.mjs. O que este
 * arquivo cobra é a FIAÇÃO — cada um dos quatro tem um elo que, se cair, não
 * dá erro nenhum: o Absorver volta, a flecha envenenada não envenena,
 * a conta some da tela e o Tamanho não entra no Alvo.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = readFileSync(new URL('./tab-conflito.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const turno = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fwin = readFileSync(new URL('./tab-ficha-win.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const proj = readFileSync(new URL('../../shared/projeteis.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/tabuleiro.css', import.meta.url), 'utf8');

/* ===== 1) as três defesas (Núcleo v2) ===== */
assert.doesNotMatch(conf, /absorverResolve|ehAbsorver/, 'o Absorver saiu: só Esquiva, Aparar e Bloquear');
assert.match(conf, /const segurou = golpePassa\(c\.rolagem\.graus, Number\(valor\) \|\| 0, c\.rolagem\.dado\);/,
    'a decisão da defesa sai do módulo puro');
assert.match(conf, /const evadir = !segurou && \/esquiva\/i\.test\(nome \|\| ''\)/,
    '🔒 Evadir é o trunfo da Esquiva: só quando ela segura o golpe');
assert.match(conf, /const quem = a\.protetorPid \|\| a\.pid;/, '🔒 Proteger: o golpe que passa é do protetor');
assert.match(conf, /orcamentoDefesa\(quemDefende, ehBloquear\)/, 'a 2ª defesa grátis só com escudo E Bloquear');
assert.match(conf, /valorComponente\('Aparar', fonteDoParticipante\(p\)\)/, 'o contra-ataque é o trunfo do Aparar');

/* ===== 2) condição do equipamento ===== */
assert.match(fwin, /l\.condicaoIds = i\?\.condicaoIds\?\.length/, 'a arma carrega o que aplica');
assert.match(proj, /condicaoIds: campo\(i, catalog, 'condicaoIds'\) \|\| \[\]/, 'e a munição também');
assert.match(turno, /function condicoesDoEquipamento\(golpe, projetil\)/);
assert.match(turno, /\[\.\.\.\(golpe\?\.condicaoIds \|\| \[\]\), \.\.\.\(projetil\?\.condicaoIds \|\| \[\]\)\]/,
    '🔒 arma E munição somam: as duas encostaram no alvo');
assert.equal((turno.match(/condicoesDoEquipamento\(/g) || []).length, 3,
    'a declaração + o ataque comum + a habilidade que usa golpe');
assert.match(conf, /\.\.\.\(c\.acao\.condicoesItem \|\| \[\]\)/,
    'e elas entram na MESMA lista das condições da ação — a régua é a mesma');

/* ===== 3) a conta do dano ===== */
assert.match(conf, /function contaDoDano\(a\)/);
assert.match(conf, /\$\{contaDoDano\(a\)\}<\/span> <b class="tb-conflito-vit">−\$\{a\.dano\} VIT<\/b>/,
    '🔒 a conta vem antes e o −N VIT em destaque depois');
assert.match(css, /\.tb-conflito-vit\s*\{/, 'com estilo próprio');
assert.doesNotMatch(conf, /após blindagem \$\{a\.blindagem\}/,
    'o texto antigo dizia só "após blindagem N" — a conta inteira substituiu');

/* ===== 4) tamanho ===== */
assert.match(conf, /function modTamanho\(c\)/);
assert.match(conf, /return vs\.length \? Math\.min\(\.\.\.vs\) : 0;/,
    '🔒 com vários alvos vale o MENOR: o d10 é um só, e a régua tem de ser a do alvo mais difícil');
assert.match(conf, /\+ modTamanho\(c\)/, 'entra no Alvo que o mestre vê E na rolagem');
assert.match(conf, /tamanho: \(\(\) => \{/, 'medido na abertura, como a Marca de Caça');
assert.match(conf, /const tam = \(!c\.acao\.distancia && c\.tamanho\)/,
    '🔒 peso entra no braço, não no tiro: só corpo a corpo');
assert.match(conf, /Math\.max\(0, total \+ \(Number\(c\.marca\?\.danoPorPid\?\.\[a\.pid\]\) \|\| 0\) \+ tam\)/,
    'e o bruto nunca fica negativo por causa do tamanho');

console.log('✅ os quatro ajustes OK — três defesas, a peça marca, a conta aparece e o tamanho pesa');
