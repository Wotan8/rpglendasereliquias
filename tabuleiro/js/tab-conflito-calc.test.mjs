/**
 * Conta do conflito (combate v3). Roda com:
 *   node tabuleiro/js/tab-conflito-calc.test.mjs
 */
import assert from 'node:assert/strict';
import { grausDoAtaque, golpePassa, abriuGuarda, rolarFormula, danoFinal,
         defesasLivres, custoDaDefesa, soODado, podeContraAtacar } from './tab-conflito-calc.js';

// --- Graus ---
assert.equal(grausDoAtaque(7, 4), 3, 'Alvo 7, dado 4 → 3 Graus');
assert.equal(grausDoAtaque(7, 1), 7, 'crítico: Graus máximos = Alvo');
assert.equal(grausDoAtaque(7, 10), -3, 'falha crítica: Alvo − 10');
assert.equal(grausDoAtaque(12, 10), -1, 'Alvo alto no 10 ainda é falha (teto −1)');

// --- Passa ou não (o exemplo do Livro §6.4) ---
assert.equal(golpePassa(3, 2, 4), true, '3 Graus contra Aparar 2: passa');
assert.equal(golpePassa(1, 2, 6), false, '1 Grau contra Aparar 2: aparou');
assert.equal(golpePassa(2, 2, 5), true, 'empate passa (iguais OU maiores)');
assert.equal(golpePassa(-1, 9, 1), true, 'crítico passa por qualquer Defesa');
assert.equal(golpePassa(99, 0, 10), false, '10 nunca passa');
assert.equal(golpePassa(1, 0, 5), true, 'sem defesa declarada, qualquer sucesso passa');

// --- Abertura para contra-ataque (§6.8) ---
assert.equal(abriuGuarda(0, 5), true, 'Graus 0 abre a guarda');
assert.equal(abriuGuarda(-2, 8), true, 'Graus negativos abrem a guarda');
assert.equal(abriuGuarda(5, 10), true, '10 abre a guarda mesmo com Alvo alto');
assert.equal(abriuGuarda(1, 4), false, 'acerto raspando não abre a guarda');

// --- Fórmula de dano ---
const fixo = (v) => () => v;
assert.equal(rolarFormula('1d8+3', { rng: fixo(5) }).total, 8, '1d8+3 com dado 5');
assert.equal(rolarFormula('2d6-1', { rng: fixo(4) }).total, 7, '2d6−1 com dois 4');
assert.equal(rolarFormula('1d8+3', { critico: true }).total, 11, 'crítico: dado cheio 8+3');
assert.equal(rolarFormula('1d8', { critico: true }).dados[0], 8, 'dado cheio não rola');
assert.equal(rolarFormula('4').total, 4, 'fórmula sem dado é dano fixo');
assert.equal(rolarFormula('').total, 0, 'sem fórmula, sem dano');
assert.equal(rolarFormula('1d4', { rng: fixo(1) }).total, 1, 'mínimo do dado');
assert.equal(rolarFormula('1d6-10', { rng: fixo(2) }).total, 0, 'dano nunca fica negativo');

// --- Blindagem, Absorver e o piso 1 ---
assert.equal(danoFinal(9, 2, false), 7, 'dano menos Blindagem');
assert.equal(danoFinal(3, 5, false), 1, 'Blindagem maior que o dano ainda machuca 1');
assert.equal(danoFinal(9, 2, true), 3.5, 'Absorver recebe metade (meio ponto vale)');
assert.equal(danoFinal(3, 2, true), 1, 'metade de 1 ainda respeita o piso');

// ✨ CRÍTICO ATRAVESSA O ABSORVER: encaixar o golpe no corpo ampara uma
// estocada comum, não uma perfeita. A Blindagem continua aparando — ela é a
// peça de armadura, não a postura de quem se defende.
assert.equal(danoFinal(9, 2, true, true), 7, '🔒 no crítico o Absorver não parte o dano ao meio');
assert.equal(danoFinal(9, 2, true, false), 3.5, 'sem crítico, Absorver segue valendo metade');
assert.equal(danoFinal(9, 2, false, true), 7, 'crítico sem Absorver não muda nada');
assert.equal(danoFinal(9, 0, true, true), 9, 'sem blindagem, o crítico entra inteiro');
assert.equal(danoFinal(3, 5, true, true), 1, 'o piso de 1 vale até no crítico');
// chamada antiga (3 argumentos) não pode mudar de comportamento
assert.equal(danoFinal(9, 2, true), 3.5, 'sem o 4º argumento, Absorver parte como sempre partiu');

// --- Orçamento de defesas da rodada (§6.2) ---
assert.equal(defesasLivres(4), 3, 'Reflexo 4 → 3 defesas grátis');
assert.equal(defesasLivres(1), 1, 'Reflexo 1 → o mínimo de 1');
assert.equal(defesasLivres(0), 1, 'sem Reflexo ainda sobra 1 defesa');
assert.equal(custoDaDefesa(0, 3), 0, 'primeira defesa é grátis');
assert.equal(custoDaDefesa(2, 3), 0, 'a última grátis ainda é grátis');
assert.equal(custoDaDefesa(3, 3), 1, 'acabaram as grátis: 1 Energia');
assert.equal(custoDaDefesa(9, 1), 1, 'sempre 1 Energia por defesa extra');

// --- Dado cru da arma (contra-ataque não soma bônus) ---
assert.equal(soODado('1d8+3'), '1d8', 'o +3 fica de fora do contra-ataque');
assert.equal(soODado('2d6 - 1'), '2d6', 'espaço e menos não confundem');
assert.equal(soODado('4'), '', 'dano fixo não tem dado para o contra-ataque');

// --- Quem pode contra-atacar (§6.8) ---
const espada = { nome: 'Espada', alcanceM: 1.5, distancia: false };
const lanca  = { nome: 'Lança',  alcanceM: 3,   distancia: false };
const arco   = { nome: 'Arco',   alcanceM: 30,  distancia: true };
const base = { pericia: 2, energia: 5, jaContraAtacou: false, distanciaM: 1.5, golpes: [espada] };

assert.equal(podeContraAtacar(base).ok, true, 'perícia, energia e alcance: pode');
assert.equal(podeContraAtacar({ ...base, pericia: 0 }).ok, false, 'sem a perícia não contra-ataca');
assert.match(podeContraAtacar({ ...base, pericia: 0 }).motivo, /Contra-Ataque/, 'o motivo diz qual é a trava');
assert.equal(podeContraAtacar({ ...base, pericia: 1 }).ok, true, 'nível 1 já basta');
assert.equal(podeContraAtacar({ ...base, energia: 0 }).ok, false, 'sem Energia não contra-ataca');
assert.equal(podeContraAtacar({ ...base, energia: null }).ok, true, 'Energia desconhecida não bloqueia');
assert.equal(podeContraAtacar({ ...base, jaContraAtacou: true }).ok, false, 'um contra-ataque por golpe');

// alcance: é corpo a corpo, tem que CHEGAR no agressor
assert.equal(podeContraAtacar({ ...base, distanciaM: 4 }).ok, false, 'espada não alcança a 4 m');
assert.equal(podeContraAtacar({ ...base, distanciaM: 3, golpes: [espada, lanca] }).ok, true, 'a lança alcança');
assert.deepEqual(podeContraAtacar({ ...base, distanciaM: 3, golpes: [espada, lanca] }).linhas.map(g => g.nome),
    ['Lança'], 'só entram os golpes que realmente alcançam');
assert.equal(podeContraAtacar({ ...base, golpes: [arco] }).ok, false, 'arma a distância não contra-ataca');
assert.equal(podeContraAtacar({ ...base, golpes: [] }).ok, false, 'sem golpe físico não há contra-ataque');
assert.equal(podeContraAtacar({ ...base, distanciaM: null }).ok, false, 'sem distância medida não libera');

console.log('✅ conta do conflito OK — graus, defesa, crítico, blindagem, orçamento, piso e contra-ataque');
