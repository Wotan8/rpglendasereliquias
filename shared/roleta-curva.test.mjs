import assert from 'node:assert';
import { curvaGiro, forcaGiro, _curvaInterna } from './roleta-curva.js';

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


/* 7) O ATRITO SECO TEM DE EXISTIR — sem ele a roda morre por assíntota e nunca
      dá o clique final. Com ele a velocidade zera em tempo FINITO: em t=1 ela
      está parada de verdade, não "quase". */
assert.ok(_curvaInterna.C > 0, 'o atrito seco sumiu da conta');
assert.ok(Math.abs(_curvaInterna.velocidade(1)) < 1e-12,
    `em t=1 a roda tinha de estar parada, mas ainda anda ${_curvaInterna.velocidade(1)}`);

/* 8) e não pode parar ANTES do fim: roda que trava faltando tempo deixa a
      animação rodando parada, o que se lê como travamento. */
assert.ok(_curvaInterna.velocidade(0.97) > 0, 'parou antes da hora');

/* 9) O COMEÇO PRECISA SER LEGÍVEL. A versão só-viscosa despejava metade do
      percurso em 12% do tempo — isso é borrão, não roda girando. */
assert.ok(curvaGiro(0.15) < 0.5,
    `em 15% do tempo já andou ${(curvaGiro(0.15) * 100).toFixed(0)}% do caminho — rápido demais para o olho`);
assert.ok(curvaGiro(0.30) > 0.5, 'e em 30% do tempo já tinha de ter passado da metade');

/* 10) forcaGiro é a régua da encenação: 0 parada, 1 no pico. O rastro e o tic
       penduram nela, então ela tem de bater com a curva, não flutuar solta. */
assert.equal(forcaGiro(0), 0, 'parada no instante zero');
assert.equal(forcaGiro(1), 0, 'parada no fim');
let picoForca = 0;
for (let i = 0; i <= 200; i++) picoForca = Math.max(picoForca, forcaGiro(i / 200));
assert.ok(Math.abs(picoForca - 1) < 0.01, `o pico da força tinha de ser 1, deu ${picoForca.toFixed(3)}`);
assert.ok(forcaGiro(0.5) > forcaGiro(0.8) && forcaGiro(0.8) > forcaGiro(0.95),
    'a força tem de cair sem recuperar');

console.log('ok — curva da roleta: pontas, monotonia, pico cedo, queda contínua, parada em tempo finito e régua de força');
