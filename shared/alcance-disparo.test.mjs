// Rodar: node shared/alcance-disparo.test.mjs
// A arma tem capacidade; o atirador tem braço. Vale o menor dos dois — menos
// para a besta, que é armada por manivela antes do tiro.
import assert from 'node:assert/strict';
import { alcanceDeDisparo, melhorDisparo, METROS_POR_FOR } from './alcance-disparo.js';

const ARCO_LONGO = { nome: 'Arco Longo', alcanceM: 60, distancia: true };
const ARCO_SIMPLES = { nome: 'Arco Simples', alcanceM: 30, distancia: true };
const BESTA_PESADA = { nome: 'Besta Pesada', alcanceM: 45, distancia: true, ignoraLimiteForDisparo: true };

/* ═══ a âncora ═══ */
assert.equal(METROS_POR_FOR, 10, '1 ponto de FOR = 1 Deslocamento terrestre da linha de base');

/* ═══ o braço é o gargalo ═══ */
// FOR 1 com Arco Longo: a arma alcança 60, o sujeito arma 10.
const fraco = alcanceDeDisparo(ARCO_LONGO, 1);
assert.equal(fraco.metros, 10);
assert.equal(fraco.limitadoPorFor, true, 'a tela precisa saber que quem cortou foi a FOR');
assert.equal(fraco.capacidadeDaArma, 60);

// FOR 3 (a mediana das fichas) com Arco Simples: 30 de arma vs 30 de braço.
assert.equal(alcanceDeDisparo(ARCO_SIMPLES, 3).metros, 30);
assert.equal(alcanceDeDisparo(ARCO_SIMPLES, 3).limitadoPorFor, false, 'empate não é limite');

/* ═══ a arma é o gargalo ═══ */
// FOR 10 com Arco Simples: o braço daria 100, a arma só entrega 30.
const forte = alcanceDeDisparo(ARCO_SIMPLES, 10);
assert.equal(forte.metros, 30);
assert.equal(forte.limitadoPorFor, false, 'aqui quem cortou foi a arma, não a FOR');

/* ═══ a besta ignora o braço ═══ */
// É o que dá identidade: a arma de tiro de quem não tem Força.
assert.equal(alcanceDeDisparo(BESTA_PESADA, 1).metros, 45, 'manivela não depende de FOR');
assert.equal(alcanceDeDisparo(BESTA_PESADA, 1).limitadoPorFor, false);
assert.equal(alcanceDeDisparo(BESTA_PESADA, 10).metros, 45, 'nem FOR alta passa da arma');
// e o FOR 1 de besta bate o FOR 3 de arco simples — a troca é essa, de propósito
assert.ok(alcanceDeDisparo(BESTA_PESADA, 1).metros > alcanceDeDisparo(ARCO_SIMPLES, 3).metros);

/* ═══ arma sem alcance cadastrado não vira alcance infinito ═══ */
// Era o estado do catálogo inteiro antes desta frente: 13 armas com o campo
// vazio. Tem que dar 0 e a mira não abrir, nunca "ilimitado".
assert.equal(alcanceDeDisparo({ alcanceM: null }, 5).metros, 0);
assert.equal(alcanceDeDisparo({}, 5).metros, 0);
assert.equal(alcanceDeDisparo({ alcanceM: 0, ignoraLimiteForDisparo: true }, 5).metros, 0,
    'nem a besta escapa: sem capacidade cadastrada não há tiro');

/* ═══ o melhor disparo em mãos ═══ */
const linhas = [
    { nome: 'Estilete', distancia: false, alcanceM: 0.5 },
    ARCO_SIMPLES,
    BESTA_PESADA,
];
assert.deepEqual(melhorDisparo(linhas, 2), { metros: 45, arma: 'Besta Pesada', limitadoPorFor: false },
    'FOR 2: o arco cai para 20, a besta mantém 45');
// Com FOR 2 os DOIS arcos caem para 20: o braço corta antes da arma, e o arco
// caro não rende nada a mais na mão de quem não tem Força. É o efeito que a
// escolha de 10 m/FOR compra — e o motivo de a besta existir.
const doisArcos = melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 2);
assert.equal(doisArcos.metros, 20);
assert.equal(doisArcos.limitadoPorFor, true);
assert.equal(alcanceDeDisparo(ARCO_LONGO, 2).metros, alcanceDeDisparo(ARCO_SIMPLES, 2).metros,
    'FOR 2: Arco Longo e Arco Simples empatam — a FOR apagou a diferença entre eles');
// e basta FOR 4 para o Longo voltar a valer mais que o Simples
assert.equal(melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 4).arma, 'Arco Longo');
assert.equal(melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 4).metros, 40);
assert.equal(melhorDisparo([{ nome: 'Adaga', distancia: false, alcanceM: 0.5 }], 5).metros, 0,
    'só arma de corpo a corpo: não há disparo');

/* ═══ bordas ═══ */
assert.equal(alcanceDeDisparo(ARCO_LONGO, 0).metros, 0, 'FOR 0 não atira');
assert.equal(alcanceDeDisparo(ARCO_LONGO, -3).metros, 0, 'FOR negativa não vira alcance');
assert.equal(alcanceDeDisparo(null, 5).metros, 0);
assert.equal(melhorDisparo(null, 5).metros, 0);
assert.equal(melhorDisparo([], 5).arma, null);

console.log('✅ alcance-disparo: braço e arma como gargalo, besta livre da FOR, campo vazio = sem tiro, melhor arma em mãos OK');
