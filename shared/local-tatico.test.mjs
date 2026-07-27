// Rodar: node shared/local-tatico.test.mjs
import assert from 'node:assert/strict';
import { localPronto, resumoDoLocal, objetosDoLocal } from './local-tatico.js';

const mt = {
    url: 'https://x/mapa.png', imgW: 1000, imgH: 500,
    larguraReal: 30, unidade: 'm', ambiente: 'noite', luzAtiva: true,
    objetos: [
        { tipo: 'parede', pontos: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] },
        { tipo: 'porta', pontos: [{ x: 100, y: 0 }, { x: 200, y: 0 }] },
        { tipo: 'janela', pontos: [{ x: 300, y: 0 }, { x: 400, y: 0 }] },
        { tipo: 'luz', x: 500, y: 250, alcance: 9, cor: '#ffaa00', animacao: 'tocha' },
    ],
};

// --- localPronto: só vai ao tabuleiro quem tem imagem E escala ---
assert.equal(localPronto(mt), true);
assert.equal(localPronto(null), false);
assert.equal(localPronto({ ...mt, url: '' }), false);
assert.equal(localPronto({ ...mt, larguraReal: 0 }), false, 'sem escala a régua não funciona');
assert.equal(localPronto({ ...mt, imgW: 0 }), false);

// --- resumoDoLocal ---
assert.match(resumoDoLocal(mt), /30 m/);
assert.match(resumoDoLocal(mt), /1 parede/);
assert.match(resumoDoLocal(mt), /🌙 noite/);
assert.match(resumoDoLocal({ ...mt, luzAtiva: false }), /sem luz dinâmica/);
assert.equal(resumoDoLocal(null), '');

// --- objetosDoLocal: imagem colocada a 2000px de largura → escala 2× ---
const objs = objetosDoLocal(mt, { x: 100, y: 200, w: 2000 });
assert.equal(objs.length, 5);

const img = objs[0];
assert.equal(img.tipo, 'imagem');
assert.equal(img.layerId, 'mapa');
assert.equal(img.w, 2000);
assert.equal(img.h, 1000, 'altura mantém a proporção da imagem');
assert.equal(img.larguraReal, 30, 'a régua herda a escala do Local');

const parede = objs[1];
assert.equal(parede.tipo, 'desenho');
assert.equal(parede.layerId, 'luz', 'parede vive na camada de luz — é ela que bloqueia visão');
assert.equal(parede.forma, 'livre');
assert.deepEqual(parede.pontos[1], { x: 100 + 100 * 2, y: 200 + 0 }, 'ponto escalado e transladado');
assert.equal(parede.pontos.length, 3);

const porta = objs[2];
assert.equal(porta.tipo, 'porta');
assert.equal(porta.aberta, false, 'porta importada nasce fechada (bloqueia luz)');
assert.equal(porta.x, porta.pontos[0].x, 'x/y espelham o primeiro ponto (contrato do tabuleiro)');

const janela = objs[3];
assert.equal(janela.tipo, 'janela');
assert.deepEqual(janela.pontos[0], { x: 100 + 600, y: 200 + 0 });

const luz = objs[4];
assert.equal(luz.tipo, 'luz');
assert.deepEqual({ x: luz.x, y: luz.y }, { x: 100 + 1000, y: 200 + 500 });
assert.equal(luz.alcance, 9, 'alcance fica em unidades — o tabuleiro converte pela escala do mapa');
assert.equal(luz.animacao, 'tocha');
assert.equal(luz.visivelPublico, true);

// --- casos degenerados não derrubam a importação ---
const sujo = { ...mt, objetos: [null, { tipo: 'parede', pontos: [{ x: 1, y: 1 }] }, { tipo: 'luz' }, { tipo: '???' }] };
assert.equal(objetosDoLocal(sujo, { x: 0, y: 0, w: 1000 }).length, 1, 'só a imagem — objetos inválidos são pulados');
assert.deepEqual(objetosDoLocal(mt, null), []);
assert.deepEqual(objetosDoLocal(mt, { x: 0, y: 0, w: 0 }), []);

// --- luz sem animação não carrega campo undefined (Firestore rejeita) ---
const luzSimples = objetosDoLocal({ ...mt, objetos: [{ tipo: 'luz', x: 1, y: 1, alcance: 3 }] }, { x: 0, y: 0, w: 1000 })[1];
assert.equal('animacao' in luzSimples, false);
assert.equal(luzSimples.cor, '#ffdd99', 'cor padrão de tocha');

console.log('✅ local-tatico: todos os testes passaram.');
