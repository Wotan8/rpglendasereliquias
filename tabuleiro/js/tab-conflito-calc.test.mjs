/**
 * Conta do conflito (combate v3). Roda com:
 *   node tabuleiro/js/tab-conflito-calc.test.mjs
 */
import assert from 'node:assert/strict';
import { grausDoAtaque, golpePassa, abriuGuarda, rolarFormula, danoFinal,
         defesasLivres, custoDaDefesa, soODado } from './tab-conflito-calc.js';

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

console.log('✅ conta do conflito OK — graus, defesa, crítico, blindagem, orçamento e piso');
