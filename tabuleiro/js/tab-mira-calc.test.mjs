// Rodar: node tabuleiro/js/tab-mira-calc.test.mjs
// O que está trancado aqui: o alcance conta a partir da BORDA do token
// (regra da mesa), em todo tipo de mira — golpe, geometria e alvos.
import assert from 'node:assert/strict';
import { direcaoAte, origemNaBorda, clampAoAlcance, alvoAoAlcance, shapeDaMira } from './tab-mira-calc.js';

const aprox = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg} (${a} ≠ ${b})`);

// direção e borda
aprox(direcaoAte({ x: 0, y: 0 }, { x: 10, y: 0 }), 0, 'leste = 0 rad');
aprox(direcaoAte({ x: 0, y: 0 }, { x: 0, y: 10 }), Math.PI / 2, 'sul (y cresce p/ baixo) = π/2');
assert.equal(direcaoAte({ x: 5, y: 5 }, { x: 5, y: 5 }), 0, 'cursor no centro não explode');
const borda = origemNaBorda({ x: 100, y: 100 }, 35, 0);
aprox(borda.x, 135, 'borda leste = centro + raio');
aprox(borda.y, 100, 'sem desvio em y');

// clamp ao alcance (borda + alcance)
const perto = clampAoAlcance({ x: 0, y: 0 }, 35, 100, { x: 50, y: 0 });
aprox(perto.x, 50, 'dentro do alcance: não mexe');
const longe = clampAoAlcance({ x: 0, y: 0 }, 35, 100, { x: 500, y: 0 });
aprox(longe.x, 135, '🔒 clampa em borda(35) + alcance(100)');

// alvo borda a borda
assert.equal(alvoAoAlcance({ x: 0, y: 0 }, 35, { x: 200, y: 0 }, 35, 130), true, '200 − 35 − 35 = 130: exato no alcance');
assert.equal(alvoAoAlcance({ x: 0, y: 0 }, 35, { x: 201, y: 0 }, 35, 130), false, '1px além: fora');
assert.equal(alvoAoAlcance({ x: 0, y: 0 }, 35, { x: 40, y: 0 }, 35, 0), true, 'tokens encostados: alcance 0 pega');

// shape: golpe CaC nasce na borda
const tok = { x: 100, y: 100, r: 35 };
const cac = shapeDaMira({ tipo: 'cac', alcancePx: 70, angGraus: 90 }, tok, { x: 300, y: 100 });
assert.equal(cac.forma, 'cone');
aprox(cac.origem.x, 135, '🔒 origem do golpe = borda, não centro');
aprox(cac.destino.x, 205, 'comprimento = alcance a partir da borda');
assert.equal(cac.ang, 90);

// círculo centrado no token: raio soma a borda
const circToken = shapeDaMira({ tipo: 'geometria', forma: 'circulo', raioPx: 90, origem: 'token' }, tok, null);
aprox(circToken.raio, 125, '🔒 raio da área = raio do token + raio da skill');
aprox(circToken.origem.x, 100, 'centrado no token');

// círculo livre: posição clampada ao alcance, raio puro
const circLivre = shapeDaMira({ tipo: 'geometria', forma: 'circulo', raioPx: 90, alcancePx: 100, origem: 'livre' }, tok, { x: 900, y: 100 });
aprox(circLivre.origem.x, 235, 'clampou em borda + alcance');
aprox(circLivre.raio, 90, 'raio da área livre não soma token');

// cone e linha sempre nascem na borda
const cone = shapeDaMira({ tipo: 'geometria', forma: 'cone', comprimentoPx: 140, angGraus: 60 }, tok, { x: 100, y: 400 });
aprox(cone.origem.y, 135, 'cone nasce na borda (sul)');
aprox(cone.destino.y, 275, 'comprimento a partir da borda');
const linha = shapeDaMira({ tipo: 'geometria', forma: 'linha', comprimentoPx: 200, larguraPx: 30 }, tok, { x: -100, y: 100 });
aprox(linha.origem.x, 65, 'linha nasce na borda (oeste)');
aprox(linha.destino.x, -135, 'comprimento a partir da borda');
assert.equal(linha.raio, 30, 'largura vira o `raio` do template de linha');

// mira de alvos não tem shape
assert.equal(shapeDaMira({ tipo: 'alvos', alcancePx: 100 }, tok, { x: 0, y: 0 }), null);

console.log('✅ tab-mira-calc: borda como eixo, clamp de alcance, borda-a-borda e shapes OK');
