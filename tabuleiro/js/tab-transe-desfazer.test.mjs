/**
 * 🌀 Sair do transe devolve o emprestado.
 *
 * `tbTurnoDesfazerIncorporacao` existia desde que a Fusão Selvagem e a
 * Transcendência foram feitas, e NINGUÉM a chamava. Na prática: o Xamã entrava
 * no Eco, ganhava os bônus da Dádiva e o controle do token do hóspede, e ficava
 * assim para sempre — a condição "Em Transe" saía e o empréstimo não voltava.
 * Bônus permanente por engano é o tipo de bug que a mesa demora meses a notar,
 * e quando nota já virou expectativa.
 *
 * Dois ganchos, e o teste cobra os dois: tirar a condição, e encerrar a cena.
 *
 * Roda com: node tabuleiro/js/tab-transe-desfazer.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONDICAO_TRANSE } from '../../shared/incorporacao.js';

const comb = readFileSync(new URL('./tab-combat.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const turno = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ===== a função que devolve continua existindo e limpando os DOIS lados ===== */
assert.match(turno, /window\.tbTurnoDesfazerIncorporacao = async \(pid\)/);
assert.match(turno, /if \(x\.id !== pid && x\.id !== parceiro\) return x;/,
    '🔒 limpa quem entrou E o hóspede: metade limpa é pior que nada');
assert.match(turno, /const \{ incorporacao, bonusTemp, modulosEmprestados, controladoPor, \.\.\.limpo \} = x;/,
    'o que volta: a marca, os bônus da Dádiva, os módulos emprestados e o controle do token');

/* ===== gancho 1: tirar "Em Transe" ===== */
assert.match(comb, /async function aposRemoverCondicao\(p, nome\)/,
    'o gancho mora em função própria, não escondido dentro do sincronismo de ficha');
assert.match(comb, /norm\(nome\) !== norm\(CONDICAO_TRANSE\)/,
    '🔒 a comparação usa a CONSTANTE — "Em Transe" digitado à mão aqui viraria bug mudo no dia que o nome mudasse');
assert.match(comb, /await window\.tbTurnoDesfazerIncorporacao\?\.\(p\.id\)/);
assert.match(comb, /import \{ CONDICAO_TRANSE \} from '\.\.\/\.\.\/shared\/incorporacao\.js\?v=1'/,
    'e a versão do import tem de bater com a de tab-turno: duas instâncias dariam duas constantes');

/* ===== os TRÊS caminhos de remoção passam pelo gancho ===== */
assert.equal((comb.match(/aposRemoverCondicao\(/g) || []).length, 4,
    '🔒 a declaração + os três pontos que removem condição: expirar na rodada, '
    + 'o mestre tirar na mão, e o alvo se livrar num teste. Um deles de fora = transe que não desfaz.');
assert.equal((comb.match(/await sincRemocaoFicha\(/g) || []).length, 1,
    'só o gancho chama o sincronismo direto — os outros passam por ele');

/* ===== gancho 2: fim de cena ===== */
assert.match(comb, /async function desfazerIncorporacoes\(\)/);
assert.match(comb, /await desfazerIncorporacoes\(\);\s*\n\};/,
    '🔒 encerrar a cena tem de devolver: ninguém sai do combate preso dentro de outro corpo');
assert.match(comb, /p\.incorporacao && p\.incorporacao\.modo !== 'hospedeiro'/,
    '🔒 só o lado que TEM o empréstimo entra na varredura — o hospedeiro é limpo junto, '
    + 'e desfazer pelos dois lados desfaria o mesmo par duas vezes');

/* ===== a constante é o que o cadastro usa ===== */
assert.equal(CONDICAO_TRANSE, 'Em Transe',
    'se este nome mudar, a condição no banco tem de mudar junto — é ela que segura o transe de pé');

console.log('✅ desfazer do transe OK — sai a condição, volta o emprestado; e a cena não deixa ninguém preso');
