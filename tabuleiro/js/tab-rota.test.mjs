// Rodar: node tabuleiro/js/tab-rota.test.mjs
// Cobre a rota com vértices do arrasto de token: a soma tem que ser trecho a
// trecho (o desvio custa mais que a linha reta), senão o vértice não serve p/ nada.
import assert from 'node:assert/strict';
import { medirTrajeto, simplificarPontos, normalizarRet, bboxDentroDoRet } from './tab-grid.js';

const gs = 70;
const quad = { gs, tipo: 'quad', diagonal: 'cheb', unidade: 'm' };
const cel = (pts, cfg = quad) => Math.round(medirTrajeto(pts, cfg).celulas * 100) / 100;

// Trajeto sem vértice: reta de 3 células.
const A = { x: 0, y: 0 }, B = { x: 3 * gs, y: 0 };
assert.equal(cel([A, B]), 3);

// Mesmo destino, mas com um vértice desviando 2 células para baixo:
// 2 (descer) + 3 (atravessar) + 2 (subir) = 7. A rota soma o desvio, não corta caminho.
const desvio = [A, { x: 0, y: 2 * gs }, { x: 3 * gs, y: 2 * gs }, B];
assert.equal(cel(desvio), 7, 'cada trecho entre vértices entra na conta');
assert.ok(cel(desvio) > cel([A, B]), 'desviar nunca pode sair mais barato que a reta');

// Vértice repetido no mesmo ponto (dedo tremido) não infla o total.
assert.equal(cel([A, { x: 3 * gs, y: 0 }, B]), 3, 'vértice parado custa zero');

// Menos de 2 pontos: token que ainda não saiu do lugar mede zero, não NaN.
assert.equal(medirTrajeto([A], quad).celulas, 0);
assert.equal(medirTrajeto([], quad).celulas, 0);

// A escala do mapa entra no valor, mas não no número de células.
const comEscala = medirTrajeto(desvio, { ...quad, upc: () => 1.5 });
assert.equal(Math.round(comEscala.celulas), 7);
assert.equal(Math.round(comEscala.valor * 10) / 10, 10.5, '7 células × 1,5 m');

// Terreno difícil num dos trechos dobra só aquele trecho.
const lodo = [{ pontos: [{ x: -gs, y: 1.5 * gs }, { x: 4 * gs, y: 1.5 * gs }, { x: 4 * gs, y: 3 * gs }, { x: -gs, y: 3 * gs }], mult: 2 }];
assert.ok(cel(desvio, { ...quad, terrenos: lodo }) > 7, 'terreno difícil encarece a rota');

// =====================================================================
// SIMPLIFICAÇÃO (RDP) — a rota de viagem perde o tremido, não a forma
// =====================================================================
assert.deepEqual(simplificarPontos([A, { x: gs, y: 0 }, { x: 2 * gs, y: 0 }, B], 3), [A, B],
    'pontos colineares somem');
const cotovelo = [A, { x: 3 * gs, y: 0 }, { x: 3 * gs, y: 3 * gs }];
assert.deepEqual(simplificarPontos(cotovelo, 3), cotovelo, 'o vértice do cotovelo fica');
assert.equal(cel(simplificarPontos(desvio, 3)), cel(desvio), 'simplificar não muda a medida da rota');
assert.deepEqual(simplificarPontos([A], 3), [A], 'um ponto só passa reto');
assert.deepEqual(simplificarPontos([], 3), [], 'vazio não quebra');
assert.deepEqual(simplificarPontos([A, { x: 1, y: 1 }, A], 3), [A, A],
    'traçado que volta ao início (extremos iguais) não divide por zero');

// =====================================================================
// RETÂNGULO DE SELEÇÃO (laço)
// =====================================================================
// arrastar em qualquer direção dá o mesmo retângulo
assert.deepEqual(normalizarRet({ x: 10, y: 10 }, { x: 40, y: 50 }), { x: 10, y: 10, w: 30, h: 40 });
assert.deepEqual(normalizarRet({ x: 40, y: 50 }, { x: 10, y: 10 }), { x: 10, y: 10, w: 30, h: 40 },
    'arrastar de baixo p/ cima e da direita p/ esquerda vale igual');

const laco = { x: 0, y: 0, w: 100, h: 100 };
assert.equal(bboxDentroDoRet({ x: 10, y: 10, w: 20, h: 20 }, laco), true, 'inteiro dentro');
assert.equal(bboxDentroDoRet({ x: 0, y: 0, w: 100, h: 100 }, laco), true, 'encostado nas bordas conta');
assert.equal(bboxDentroDoRet({ x: 90, y: 90, w: 20, h: 20 }, laco), false, 'metade fora não conta');
assert.equal(bboxDentroDoRet({ x: -10, y: 10, w: 20, h: 20 }, laco), false, 'transbordar à esquerda não conta');
assert.equal(bboxDentroDoRet({ x: 200, y: 200, w: 5, h: 5 }, laco), false, 'longe não conta');
// 🔒 o mapa de fundo é maior que o laço — não pode ser arrastado junto por acidente
assert.equal(bboxDentroDoRet({ x: -500, y: -500, w: 2000, h: 2000 }, laco), false,
    'contenção (não interseção): laçar tokens sobre o mapa não leva o mapa');

console.log('ok — rota soma trecho a trecho; RDP preserva forma e medida; laço usa contenção');
