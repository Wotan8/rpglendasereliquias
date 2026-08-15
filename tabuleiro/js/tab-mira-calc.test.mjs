// Rodar: node tabuleiro/js/tab-mira-calc.test.mjs
// O que está trancado aqui: o alcance conta a partir da BORDA do token
// (regra da mesa), em todo tipo de mira — golpe, geometria e alvos.
import assert from 'node:assert/strict';
import { direcaoAte, origemNaBorda, clampAoAlcance, alvoAoAlcance, shapeDaMira,
         fracaoCoberta, COBERTURA_MINIMA_CONJURADOR } from './tab-mira-calc.js';

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

// ⛔ cobertura do próprio token: o conjurador só entra na área se boa parte
// do corpo dele estiver dentro (senão todo cone pegava quem o lançou).
const disco = (cx, cy, r) => (p) => Math.hypot(p.x - cx, p.y - cy) <= r;
aprox(fracaoCoberta({ x: 100, y: 100 }, 35, disco(100, 100, 200)), 1, 'token inteiro dentro');
assert.equal(fracaoCoberta({ x: 100, y: 100 }, 35, disco(900, 900, 50)), 0, 'token inteiro fora');
const meio = fracaoCoberta({ x: 100, y: 100 }, 35, (p) => p.x >= 100);
assert.ok(meio > 0.4 && meio < 0.7, `metade coberta fica perto de 0,5 (deu ${meio})`);
// só a borda encostando (o caso do cone que nasce na borda) não conta
const soEncosta = fracaoCoberta({ x: 100, y: 100 }, 35, (p) => p.x >= 134);
assert.ok(soEncosta < COBERTURA_MINIMA_CONJURADOR, 'encostar na borda não põe o conjurador na área');
assert.equal(fracaoCoberta({ x: 5, y: 5 }, 0, disco(5, 5, 1)), 1, 'token sem raio cai no teste do centro');

console.log('✅ tab-mira-calc: borda como eixo, clamp de alcance, borda-a-borda, shapes e cobertura OK');

/* ===== 📍 mira por LOCAIS (a manada chega no chão vazio) ===== */
import { porqueLocalInvalido, localSob } from './tab-mira-calc.js';

const conj = { x: 0, y: 0 }, rConj = 10, alc = 100;
const tokens = [{ x: 50, y: 0, r: 12 }, { x: -80, y: 0, r: 20 }];

// ponto livre dentro do alcance passa
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 0, y: 60 }, tokens), '');

// a borda do conjurador conta: 110 px do centro é o limite (10 + 100)
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 110, y: 0 }, []), '',
    'exatamente no limite ainda vale');
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 111, y: 0 }, []), 'fora do alcance');

// ponto em cima de token é recusado — o local é o chão, não a criatura
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 50, y: 0 }, tokens), 'já tem alguém aí');
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 56, y: 0 }, tokens), 'já tem alguém aí',
    'dentro do raio do token ainda é "em cima dele"');
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 70, y: 0 }, tokens), '',
    'passando do raio do token, o chão está livre');

// dois locais não se empilham quando há folga pedida
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 0, y: 60 }, [], 30, [{ x: 0, y: 70 }]),
    'perto demais de outro local');
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 0, y: 60 }, [], 30, [{ x: 0, y: 95 }]), '',
    'com a folga respeitada, entra');
assert.equal(porqueLocalInvalido(conj, rConj, alc, { x: 0, y: 60 }, [], 0, [{ x: 0, y: 60 }]), '',
    'folga 0 = pode empilhar (o cadastro é que decide)');

// desmarcar: achar o local sob o clique
const marcados = [{ x: 0, y: 60 }, { x: 30, y: -20 }];
assert.equal(localSob(marcados, { x: 2, y: 62 }, 12), 0);
assert.equal(localSob(marcados, { x: 30, y: -20 }, 12), 1);
assert.equal(localSob(marcados, { x: 200, y: 200 }, 12), -1, 'longe de todos = nenhum');
assert.equal(localSob([], { x: 0, y: 0 }, 12), -1);

// e a mira de locais não desenha forma seguindo o cursor
assert.equal(shapeDaMira({ tipo: 'locais', maxAlvos: 3 }, { x: 0, y: 0, r: 10 }, { x: 50, y: 0 }), null);

console.log('✅ mira por locais OK — alcance da borda, chão vazio, folga e desmarcar');
