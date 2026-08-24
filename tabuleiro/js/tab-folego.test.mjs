/**
 * 😮‍💨 RECUPERAR FÔLEGO (Livro §6.2, playtest 18/08): turno inteiro parado
 * devolve 1 Energia, dentro do combate, com teto no máximo da ficha.
 *
 * Este teste lê o FONTE porque a feature já morreu uma vez exatamente assim:
 * outra frente reescreveu tab-turno.js e o botão sumiu em silêncio. O que se
 * tranca aqui é a presença e a forma da regra, não o DOM.
 *
 * Roda com: node tabuleiro/js/tab-folego.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ═══ 1. O handler existe e cobra o preço certo ═══ */
const ini = src.indexOf('window.tbTurnoFolego = async () => {');
assert.ok(ini > 0, 'tbTurnoFolego não encontrado em tab-turno.js — o botão do painel chama exatamente este nome');
const corpo = src.slice(ini, src.indexOf('\n};', ini));
assert.ok(corpo.includes("podeGastar(c.acoesTurno, 'completa')"),
    'o Fôlego exige o turno INTEIRO disponível (Ação Completa)');
assert.ok(corpo.includes("await gastar('completa')"),
    'o Fôlego consome as DUAS ações — gastar(completa), que também derruba postura');
assert.ok(corpo.includes("temDoRecurso(p, 'Energia')"),
    'o crédito é de Energia, lido pelo mesmo helper dos custos');
assert.ok(corpo.includes('Math.min(Number(r.max), Number(r.tem) + 1)'),
    '+1 com teto no máximo da ficha — Energia não passa do cheio');
assert.ok(corpo.includes('creditarRecurso(p, '),
    'o crédito sai pelo caminho canônico (creditarRecurso → tbCombSetVital)');

/* ═══ 2. O botão está no painel e só com o turno cheio ═══ */
const btn = src.indexOf('tbTurnoFolego()');
assert.ok(btn > 0 && btn < ini, 'o painel do turno tem um botão que chama tbTurnoFolego');
const antes = src.slice(src.lastIndexOf('const folegoHtml', btn), btn);
assert.ok(antes.includes('acoes.padrao && acoes.movimento'),
    'o botão só é montado com as duas ações intactas — meio turno não recupera fôlego');
assert.ok(src.includes("porqueCondicao(efCond, 'bloqueia_completa')"),
    'condição que bloqueia Ação Completa trava o Fôlego com o motivo no title');

console.log('✅ tab-folego: handler, custo completa, teto no máximo e botão no painel');
