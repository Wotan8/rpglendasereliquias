import assert from 'node:assert';
import { curvaGiro, _curvaInterna } from './roleta-curva.js';

const { ARRANQUE } = _curvaInterna;

// --- as pontas ---
assert.equal(curvaGiro(0), 0, 'tem de sair do zero');
assert.equal(curvaGiro(1), 1, 'tem de chegar exatamente em 1');
assert.equal(curvaGiro(-0.5), 0, 'antes do início não anda');
assert.equal(curvaGiro(9), 1, 'depois do fim não passa de 1');
assert.equal(curvaGiro(NaN), 0, 'lixo não vira ângulo maluco');

// --- nunca volta atrás: roda que anda para trás no meio do giro é bug visível ---
let ant = -1;
for (let i = 0; i <= 500; i++) {
    const v = curvaGiro(i / 500);
    assert.ok(v >= ant - 1e-12, `andou para trás em t=${i / 500}`);
    ant = v;
}

/* --- o formato do movimento ---
   Velocidade = quanto de ângulo anda por fatia de tempo. É nela que mora o
   pedido: "vai perdendo a força aos poucos e para bem suave". */
const PASSO = 1 / 400;
const vel = (t) => (curvaGiro(t + PASSO) - curvaGiro(t)) / PASSO;

// 1) arranca: no primeiro instante ainda está lenta, não no talo
assert.ok(vel(0) < vel(ARRANQUE) * 0.5,
    `devia sair devagar, mas v(0)=${vel(0).toFixed(3)} contra pico ~${vel(ARRANQUE).toFixed(3)}`);

// 2) o pico é CEDO — é uma roda empurrada, não um motor que acelera até o fim
let tPico = 0, vPico = 0;
for (let i = 0; i < 400; i++) {
    const t = i / 400, v = vel(t);
    if (v > vPico) { vPico = v; tPico = t; }
}
assert.ok(tPico <= 0.2, `o pico devia vir cedo, veio em t=${tPico.toFixed(2)}`);

// 3) depois do pico só perde força, sem recuperar em nenhum trecho
for (let i = Math.ceil(tPico * 400) + 1; i < 399; i++) {
    assert.ok(vel(i / 400) <= vel((i - 1) / 400) + 1e-9,
        `recuperou força em t=${(i / 400).toFixed(3)}`);
}

// 4) para suave: o último trecho anda uma fração mínima do que andou no pico
assert.ok(vel(0.98) < vPico * 0.02,
    `o fim devia ser um sussurro, mas anda ${(vel(0.98) / vPico * 100).toFixed(1)}% do pico`);

/* 5) e o último décimo do TEMPO tem de valer pouquíssimo do percurso — é o que
      separa "parou suave" de "travou de repente". */
const ultimoDecimo = 1 - curvaGiro(0.9);
assert.ok(ultimoDecimo > 0 && ultimoDecimo < 0.01,
    `o último décimo do tempo levou ${(ultimoDecimo * 100).toFixed(2)}% do giro`);

/* 6) contraste com a curva antiga, que era o motivo da troca: a easeOutQuart
      já tinha comido 93% do caminho na metade do tempo — daí a sensação de
      "travou e depois escorregou". */
const antiga = (t) => 1 - Math.pow(1 - t, 4);
assert.ok(curvaGiro(0.5) < antiga(0.5),
    'na metade do tempo a curva nova tem de ter andado MENOS que a antiga');

console.log('ok — curva da roleta: pontas, monotonia, pico cedo, queda contínua e parada suave');
