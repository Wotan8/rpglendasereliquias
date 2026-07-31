// Rodar: node shared/local-tatico.test.mjs
import assert from 'node:assert/strict';
import { localPronto, resumoDoLocal, objetosDoLocal, pontosDaForma, comprimentoDaLinha, importarDungeonAlchemist, importarUVTT } from './local-tatico.js';

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

// --- itens dropados viram loot no tabuleiro (contrato do tab-mostrar) ---
const mtItens = {
    ...mt, objetos: [
        { tipo: 'item', itemId: 'adaga', nome: 'Adaga', url: 'https://x/a.png', quantidade: 3, item: { nome: 'Adaga', peso: 0.5 }, x: 100, y: 50 },
        {
            tipo: 'item', itemId: 'bau1', nome: 'Baú', url: '', quantidade: 1, fixo: true,
            item: { nome: 'Baú', ehContainer: true },
            itensDentro: [{ id: 'wb1', nome: 'Poção', quantidade: 2 }],
            x: 200, y: 100,
        },
        { tipo: 'item', x: 1, y: 1 },   // sem `item` embutido = inválido, pulado
    ],
};
const lootObjs = objetosDoLocal(mtItens, { x: 0, y: 0, w: 2000 });
assert.equal(lootObjs.length, 3, 'imagem + 2 loots');

const lootSimples = lootObjs[1];
assert.equal(lootSimples.tipo, 'loot');
assert.equal(lootSimples.layerId, 'tokens');
assert.deepEqual({ x: lootSimples.x, y: lootSimples.y }, { x: 200, y: 100 }, 'posição escalada 2×');
assert.equal(lootSimples.quantidade, 3);
assert.deepEqual(lootSimples.item, { nome: 'Adaga', peso: 0.5 }, 'item embutido segue intacto');
assert.equal(lootSimples.visivelPublico, true);
assert.equal('fixo' in lootSimples, false, 'fixo/itensDentro são contrato só de contêiner');
assert.equal('itensDentro' in lootSimples, false);

const lootBau = lootObjs[2];
assert.equal(lootBau.fixo, true, 'baú fixo: jogador pega só o conteúdo');
assert.deepEqual(lootBau.itensDentro, [{ id: 'wb1', nome: 'Poção', quantidade: 2 }]);
assert.equal('trancado' in lootBau, false, 'sem tranca configurada, o loot não carrega o campo');

// --- baú trancado: tranca passa intacta para o loot ---
const tranca = { tipo: 'tag', tag: 'chave-velmora', consumo: 'chance', chance: 30 };
const mtTrancado = {
    ...mt, objetos: [{
        tipo: 'item', itemId: 'bau2', nome: 'Cofre', quantidade: 1,
        item: { nome: 'Cofre', ehContainer: true }, trancado: true, tranca,
        itensDentro: [], x: 10, y: 10,
    }, {
        // trancado sem o objeto `tranca` = estado inválido, cai como livre
        tipo: 'item', itemId: 'bau3', nome: 'Caixote', quantidade: 1,
        item: { nome: 'Caixote', ehContainer: true }, trancado: true, x: 20, y: 20,
    }],
};
const [, cofre, caixote] = objetosDoLocal(mtTrancado, { x: 0, y: 0, w: 1000 });
assert.equal(cofre.trancado, true);
assert.deepEqual(cofre.tranca, tranca, 'a config da tranca chega inteira ao Tabuleiro');
assert.equal('trancado' in caixote, false, 'trancado sem tranca não viaja');

assert.match(resumoDoLocal(mtItens), /3 itens/, 'o resumo conta por tipo, sem validar');

// --- importarDungeonAlchemist: export Roll20 (.txt) vira mapaTatico ---
const wall = (x1, y1, x2, y2, type, h = 1.8) => ({
    wall3D: { p1: { bottom: { x: x1, y: y1 }, top: { x: x1, y: y1 } }, p2: { bottom: { x: x2, y: y2 }, top: { x: x2, y: y2 } }, wallHeight: h },
    type, open: false,
});
const daTxt = '!dungeonalchemist ' + JSON.stringify({
    version: 3,
    walls: [
        wall(0, 0, 300, 0, 0),          // parede
        wall(300, 0, 300, 300, 0),      // emenda na anterior → mesma polilinha
        wall(600, 0, 750, 0, 1),        // porta (1 tile)
        wall(900, 0, 1050, 0, 2),       // janela
        wall(0, 600, 30, 600, 3),       // contorno de objeto…
        wall(30, 600, 60, 630, 3),      // …encadeia
        wall(0, 900, 150, 900, 4),      // muro baixo = parede
        wall(500, 500, 500, 500, 0, 0), // marcador de ponta (p1==p2) — fora
    ],
    lights: [{ color: '#FF9800FF', intensity: 2.5, range: 750, position: { x: 150, y: 150 } }],
    pixelsPerTile: 150,
    grid: '10 8',                        // fonte = 1500×1200 px
});

// Imagem exportada em metade da resolução (750×600) → escala 0.5
const da = importarDungeonAlchemist(daTxt, 750, 600);
assert.ok(da, 'export válido é aceito');
assert.equal(da.larguraReal, 15, '10 tiles × 1,5 m');
assert.equal(da.unidade, 'm');
assert.deepEqual(da.avisos, [], 'proporção bate — sem aviso');

const tipos = da.objetos.map(o => o.tipo);
assert.deepEqual(tipos, ['parede', 'porta', 'janela', 'parede', 'parede', 'luz']);

const [par1, porta1, jan1, contorno, muro, luz1] = da.objetos;
assert.deepEqual(par1.pontos, [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 150 }],
    'segmentos emendados viram uma polilinha, já na escala da imagem');
assert.deepEqual(porta1.pontos, [{ x: 300, y: 0 }, { x: 375, y: 0 }], 'type 1 = porta');
assert.deepEqual(jan1.pontos, [{ x: 450, y: 0 }, { x: 525, y: 0 }], 'type 2 = janela');
assert.equal(contorno.pontos.length, 3, 'contorno de objeto (type 3) também encadeia');
assert.equal(muro.pontos.length, 2, 'type 4 vira parede comum');
assert.deepEqual({ x: luz1.x, y: luz1.y }, { x: 75, y: 75 }, 'luz reescalada');
assert.equal(luz1.alcance, 7.5, '750px ÷ 150px/tile × 1,5 m = 7,5 m');
assert.equal(luz1.cor, '#FF9800', 'alpha do #RRGGBBAA cai fora');

// Imagem cortada (proporção diferente do grid) gera aviso
assert.equal(importarDungeonAlchemist(daTxt, 750, 350).avisos.length, 1);

// Lixo não derruba
assert.equal(importarDungeonAlchemist('qualquer coisa', 100, 100), null);
assert.equal(importarDungeonAlchemist('!dungeonalchemist {"foo":1}', 100, 100), null);
assert.equal(importarDungeonAlchemist('', 100, 100), null);

// --- importarUVTT: export UniversalVTT (.dd2vtt) — coordenadas em quadrados ---
const uvttTxt = JSON.stringify({
    format: 0.2,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 150 },
    line_of_sight: [[{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }]],
    objects_line_of_sight: [[{ x: 5, y: 5 }, { x: 5.2, y: 5.2 }]],
    portals: [{ position: { x: 4, y: 1 }, bounds: [{ x: 3.5, y: 1 }, { x: 4.5, y: 1 }], rotation: 0, closed: false, freestanding: false }],
    lights: [{ position: { x: 2, y: 2 }, range: 4, intensity: 2.8, color: 'ffFFAD00', shadows: true }],
    environment: { baked_lighting: true, ambient_light: 'ffffffff' },
    image: 'iVBORfake',
});
const uv = importarUVTT(uvttTxt);
assert.ok(uv, 'export UVTT válido é aceito');
assert.equal(uv.larguraReal, 15, '10 quadrados × 1,5 m');
assert.deepEqual({ w: uv.imgW, h: uv.imgH }, { w: 1500, h: 1200 }, 'dimensões = grid × pixels_per_grid');
assert.equal(uv.imagemBase64, 'iVBORfake', 'imagem embutida sai para o chamador subir');
assert.deepEqual(uv.objetos.map(o => o.tipo), ['parede', 'parede', 'porta', 'luz'],
    'line_of_sight e objects_line_of_sight viram parede; portal vira porta');
assert.deepEqual(uv.objetos[0].pontos, [{ x: 150, y: 150 }, { x: 450, y: 150 }, { x: 450, y: 300 }],
    'quadrados → px multiplicando por pixels_per_grid');
assert.deepEqual(uv.objetos[2].pontos, [{ x: 525, y: 150 }, { x: 675, y: 150 }], 'porta usa os bounds');
const luzUv = uv.objetos[3];
assert.equal(luzUv.alcance, 6, 'range 4 quadrados × 1,5 m');
assert.equal(luzUv.cor, '#FFAD00', 'cor AARRGGBB perde o alpha da FRENTE');
assert.equal(uv.avisos.length, 1, 'baked_lighting gera aviso');

assert.equal(importarUVTT('não é json'), null);
assert.equal(importarUVTT('{"format":0.2}'), null, 'sem resolution/imagem não é UVTT');

console.log('✅ local-tatico: todos os testes passaram.');
