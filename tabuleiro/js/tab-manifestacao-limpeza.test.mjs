/**
 * 🧱 O que a runa manifestou tem de sumir sozinho.
 *
 * Sem isto, a primeira parede de uma campanha fica no mapa para sempre: o
 * objeto existe, o motor de visão o respeita, e ninguém lembra de apagar três
 * sessões depois. Pior que não construir é construir e não desconstruir.
 *
 * Duas garantias, e as duas são testadas:
 *   · prazo curto vence na virada da rodada (o escudo de 1 turno);
 *   · o fim da cena leva TUDO, inclusive o que duraria a cena inteira.
 *
 * Roda com: node tabuleiro/js/tab-manifestacao-limpeza.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const turno = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const comb = readFileSync(new URL('./tab-combat.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ===== 1) o objeto nasce com PRAZO, não com prosa ===== */
assert.match(turno, /expiraNaRodada: dura \? rodadaAtual \+ dura : null/,
    '🔒 o prazo entra em rodada absoluta: guardar "1 turno" como texto obrigaria quem limpa a interpretar prosa');
assert.match(turno, /const rodadasDe = \(txt\) =>/, 'a tradução do texto do cadastro para rodadas');

/* a tradução, exercitada — é ela que decide quanto tempo a parede fica de pé */
const sb = {};
vm.createContext(sb);
const ini = turno.indexOf('    const rodadasDe =');
vm.runInContext(turno.slice(ini, turno.indexOf('\n', turno.indexOf(';', ini))), sb);
const rd = (t) => { sb.t = t; vm.runInContext('x = rodadasDe(t)', sb); return sb.x; };
assert.equal(rd('1 turno sem fluxo'), 1, 'Manifestador Nv1: some na rodada seguinte');
assert.equal(rd('1 minuto sem fluxo'), 10, 'Nv2: um minuto são dez rodadas');
assert.equal(rd('1 cena sem fluxo'), 0, '🔒 Nv3 dura a cena — 0 quer dizer "só o fim da cena leva"');
assert.equal(rd(''), 0, 'sem duração declarada, dura a cena');

/* ===== 2) a varredura ===== */
assert.match(comb, /async function limparManifestacoes/);
assert.match(comb, /if \(!T\.isMaster\) return;/,
    '🔒 só o mestre varre: dois clientes apagando o mesmo objeto dariam dois deletes');
assert.match(comb, /if \(tudo \|\| \(mf\.expiraNaRodada != null && rodada >= mf\.expiraNaRodada\)\)/,
    'com `tudo` varre geral; sem ele, só o que venceu');
assert.match(comb, /const mf = o\.manifestacao;\s*\n\s*if \(!mf\) continue;/,
    'varre pela marca — e é ela que pega a laje e o bloqueio da mesma parede juntos');

/* ===== 3) os dois ganchos ===== */
assert.match(comb, /await limparManifestacoes\(\{ tudo: true \}\)/, 'o fim da cena leva tudo');
assert.match(comb, /logChat\('🕊️ Combate encerrado pelo mestre'\);\s*\n\s*\/\/[\s\S]{0,140}await limparManifestacoes/,
    '🔒 a varredura tem de estar DENTRO do encerrar da cena');
assert.match(comb, /if \(rodada > rodadaAntes\) \{[\s\S]{0,220}limparManifestacoes\(\)/,
    'e a virada de rodada vence o que era de prazo curto');

/* ===== 4) a laje e o bloqueio carregam a MESMA marca ===== */
const iniM = turno.indexOf('async function manifestarNoMapa');
const corpo = turno.slice(iniM, turno.indexOf('\n}\n', iniM));
assert.equal((corpo.match(/\.\.\.base/g) || []).length, 3,
    '🔒 os TRÊS addObj partem de `base` — laje, bloqueio e loot. (O escudo não cria objeto: '
    + 'ele veste o alvo.) É o spread que garante que a laje e o bloqueio da mesma parede '
    + 'levem a mesma marca, e portanto sumam juntos.');
assert.doesNotMatch(corpo, /manifestacao: \{[^}]*\}\s*,\s*\n[\s\S]{0,80}manifestacao:/,
    'a marca é montada uma vez só, em `base`');

console.log('✅ limpeza da manifestação OK — prazo em rodada, o curto vence sozinho, e a cena leva o resto');
