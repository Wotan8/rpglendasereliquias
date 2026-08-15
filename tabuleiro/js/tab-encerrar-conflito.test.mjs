/**
 * ⏭️ Com janela de conflito no ar, o jogador não passa a vez.
 *
 * Isto já travava durante a troca de golpes, mas soltava cedo demais: na fase
 * 'fim' o resultado ainda está na tela esperando o "✅ Fechar", e encerrar ali
 * some com o placar antes de a mesa ler. Agora vale até a janela ser FECHADA
 * (`tbConfFechar` apaga o conflito da cena), que é o que foi pedido.
 *
 * O mestre no modo secreto segue isento: é ele quem conduz a mesa.
 *
 * Roda com: node tabuleiro/js/tab-encerrar-conflito.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sb = { T: {}, _cena: null };
vm.createContext(sb);
vm.runInContext('function cena() { return _cena; }', sb);
for (const nome of ['function conflitoPendente(', 'function motivoConflito(']) {
    const i = src.indexOf(nome);
    assert.ok(i > 0, `${nome} não encontrada`);
    vm.runInContext(src.slice(i, src.indexOf('\n}\n', i) + 3), sb);
}
const trava = (conflito, T) => {
    sb.T = T; sb._cena = conflito === undefined ? null : { conflito };
    vm.runInContext('x = JSON.stringify([conflitoPendente(), motivoConflito()])', sb);
    return JSON.parse(sb.x);
};

const JOGADOR = { isMaster: false, mode: 'public' };
const MESTRE  = { isMaster: true,  mode: 'secret' };
const ESPIA   = { isMaster: true,  mode: 'public' };

/* ===== o jogador fica travado a janela inteira ===== */
for (const fase of ['acerto', 'defesa', 'dano', 'aplicar']) {
    const [travado, motivo] = trava({ fase }, JOGADOR);
    assert.equal(travado, true, `fase "${fase}" trava o Encerrar Turno`);
    assert.match(motivo, /Termine o conflito/, 'e a tela diz o que falta fazer');
}

/* ===== 🔒 e continua travado no 'fim', até fechar a janela ===== */
const [travadoFim, motivoFim] = trava({ fase: 'fim' }, JOGADOR);
assert.equal(travadoFim, true, '🔒 resolvido não é fechado: o placar ainda está na tela');
assert.match(motivoFim, /Feche a janela/, 'o motivo muda: agora o que falta é clicar em Fechar');

/* ===== sem conflito, passa ===== */
assert.deepEqual(trava(undefined, JOGADOR), [false, ''], 'sem janela nenhuma o botão solta');
assert.deepEqual(trava(null, JOGADOR), [false, ''], 'tbConfFechar grava null — é isso que solta');

/* ===== o mestre secreto conduz a mesa e não é travado ===== */
assert.deepEqual(trava({ fase: 'defesa' }, MESTRE), [false, '']);
assert.deepEqual(trava({ fase: 'fim' }, MESTRE), [false, '']);

/* ===== o mestre espiando o público joga pelas mesmas regras da tela pública ===== */
assert.equal(trava({ fase: 'defesa' }, ESPIA)[0], true);

/* ===== e o botão de fato usa isso ===== */
assert.match(src, /conflitoPendente\(\)\s*\?\s*'disabled'\s*:\s*''/,
    'o Encerrar Turno tem de nascer disabled com conflito no ar');
assert.match(src, /if \(conflitoPendente\(\)\) \{ toast\('⚠️ ' \+ motivoConflito\(\)/,
    'e o handler tem de recusar também — botão desabilitado não é trava de verdade');

console.log('✅ encerrar turno OK — travado até a janela de conflito ser fechada');
