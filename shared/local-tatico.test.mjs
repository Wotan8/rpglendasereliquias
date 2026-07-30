// Rodar: node shared/local-tatico.test.mjs
import assert from 'node:assert/strict';
import { localPronto, resumoDoLocal, objetosDoLocal, pontosDaForma, comprimentoDaLinha } from './local-tatico.js';

// --- pontosDaForma: retângulo e elipse viram polilinha fechada ---
const ret = pontosDaForma('ret', { x: 0, y: 0 }, { x: 10, y: 4 });
assert.equal(ret.length, 5, 'retângulo tem 5 pontos (fecha no início)');
assert.deepEqual(ret[0], ret[4], 'primeiro e último coincidem — polígono fechado');
assert.deepEqual(ret[1], { x: 10, y: 0 });
assert.deepEqual(ret[3], { x: 0, y: 4 });

const eli = pontosDaForma('elipse', { x: 0, y: 0 }, { x: 100, y: 50 }, 8);
assert.equal(eli.length, 9, 'N lados + o ponto de fechamento');
assert.deepEqual(eli[0], eli[8], 'elipse também fecha');
assert.deepEqual(eli[0], { x: 100, y: 25 }, 'começa na direita, no centro vertical');
assert.deepEqual(eli[2], { x: 50, y: 50 }, 'um quarto de volta = topo/base');
// Arrastar "para trás" (canto final acima/à esquerda) tem de dar a MESMA elipse
assert.deepEqual(pontosDaForma('elipse', { x: 100, y: 50 }, { x: 0, y: 0 }, 8), eli);

assert.deepEqual(pontosDaForma('linha', { x: 1, y: 2 }, { x: 3, y: 4 }), [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
assert.deepEqual(pontosDaForma('ret', null, { x: 1, y: 1 }), [], 'sem âncora não desenha');

// --- comprimentoDaLinha: separa clique seco de arrasto de verdade ---
assert.equal(comprimentoDaLinha([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5);
assert.equal(comprimentoDaLinha([{ x: 5, y: 5 }]), 0, 'um ponto só = clique seco');
assert.equal(comprimentoDaLinha([]), 0);
assert.equal(comprimentoDaLinha(null), 0);

const mt = {
    url: 'https://x/mapa.png', imgW: 1000, imgH: 500,
    larguraReal: 30, unidade: 'm', ambiente: 'noite', luzAtiva: true,
    objetos: [
        { tipo: 'parede', pontos: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] },
        { tipo: 'porta', pontos: [{ x: 100, y: 0 }, { x: 200, y: 0 }] },
        { tipo: 'janela', pontos: [{ x: 300, y: 0 }, { x: 400, y: 0 }] },
        { tipo: 'luz', x: 500, y: 250, alcance: 9, cor: '#ffaa00', animacao: 'tocha' },
        { tipo: 'npc', npcId: 'npc1', nome: 'Zathro', url: 'https://x/z.png', camada: 'tokens', x: 800, y: 100 },
        { tipo: 'npc', npcId: 'npc2', nome: 'Espião', url: '', camada: 'dm', x: 900, y: 400 },
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
assert.match(resumoDoLocal(mt), /2 NPCs/);
assert.match(resumoDoLocal({ ...mt, luzAtiva: false }), /sem luz dinâmica/);
assert.equal(resumoDoLocal(null), '');

// --- objetosDoLocal: imagem colocada a 2000px de largura → escala 2× ---
const objs = objetosDoLocal(mt, { x: 100, y: 200, w: 2000 });
assert.equal(objs.length, 7);

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

// --- NPCs vinculados viram tokens na camada escolhida ---
const npcPub = objs[5];
assert.equal(npcPub.tipo, 'token');
assert.equal(npcPub.layerId, 'tokens');
assert.deepEqual(npcPub.vinculo, { tipo: 'npc', id: 'npc1' }, 'token liga na ficha do NPC');
assert.equal(npcPub.nome, 'Zathro');
assert.equal(npcPub.url, 'https://x/z.png');
assert.deepEqual({ x: npcPub.x, y: npcPub.y }, { x: 100 + 1600, y: 200 + 200 }, 'posição escalada');
assert.equal(npcPub.visivelPublico, true);
assert.equal(npcPub.visao.ativa, false, 'NPC não revela o mapa para os jogadores');

const npcDm = objs[6];
assert.equal(npcDm.layerId, 'dm', 'camada DM respeitada');
assert.equal(npcDm.visivelPublico, false, 'NPC do mestre nunca vaza para o jogador');

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
