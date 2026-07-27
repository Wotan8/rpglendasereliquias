// Rodar: node tabuleiro/js/tab-state.test.mjs
// Cobre a escala do canvas: larguraReal ⇄ px, régua sobre mapa e unidadesParaPx.
import assert from 'node:assert/strict';
import {
    T, UNIDADES, optsUnidade, CAMADAS_PADRAO, PERMISSOES_LISTA,
    pxDeLarguraReal, larguraRealDePx, sincLarguraReal,
    upcEm, unidadeEm, unidadesParaPx, pxParaUnidades, gridSize,
    camadasVisiveis, objVisivel, vinculosComMesa,
} from './tab-state.js';
import { trajetoColide } from './tab-grid.js';

function canvas({ size = 70, valorPorCelula = 1.5, unidade = 'm' } = {}) {
    T.canvas = { grid: { size }, escala: { valorPorCelula, unidade } };
    T.objects = new Map();
}
function mapa(o) { const m = { id: 'm1', tipo: 'imagem', layerId: 'mapa', x: 0, y: 0, ...o }; T.objects.set(m.id, m); return m; }

// --- unidades disponíveis ---
assert.deepEqual(UNIDADES.map(u => u.id), ['m', 'cm', 'km', 'ft', 'mi', 'passos']);
assert.ok(optsUnidade('km').includes('value="km" selected'), 'a unidade salva vem selecionada');
assert.ok(optsUnidade('m').includes('value="mi" '), 'milhas aparecem na lista');

// --- larguraReal ⇄ px: um mapa de 30 m com 1,5 m/célula ocupa 20 células ---
canvas();
assert.equal(pxDeLarguraReal(30), 20 * 70);
assert.equal(larguraRealDePx(20 * 70), 30);
assert.equal(larguraRealDePx(pxDeLarguraReal(42)), 42, 'ida e volta não perde valor');

// --- editar a largura real redimensiona o mapa (era o bug: mudava o número, não o canva) ---
canvas({ valorPorCelula: 5, unidade: 'ft' });
const m = mapa({ larguraReal: 100, w: pxDeLarguraReal(100), h: 700, unidade: 'ft' });
assert.equal(m.w, (100 / 5) * 70);

// --- redimensionar na mão reencaixa a largura real (o outro lado do mesmo bug) ---
m.w = m.w * 2;
assert.deepEqual(sincLarguraReal(m), { larguraReal: 200 });
assert.equal(m.larguraReal, 200);
assert.deepEqual(sincLarguraReal(m), {}, 'sem mudança, sem write');
assert.deepEqual(sincLarguraReal({ tipo: 'token', larguraReal: 3, w: 70 }), {}, 'só vale para imagem');
assert.deepEqual(sincLarguraReal({ tipo: 'imagem', larguraReal: 0, w: 70 }), {}, 'imagem que não é mapa fica de fora');

// --- com o mapa encaixado, a régua e o grid concordam ---
canvas();
const dentro = { x: 10, y: 10 };
mapa({ larguraReal: 30, w: pxDeLarguraReal(30), h: 500, unidade: 'm' });
assert.equal(upcEm(dentro), 1.5, 'uma célula no mapa vale o valorPorCelula do canvas');
assert.equal(pxParaUnidades(70, dentro).valor, 1.5, 'uma célula medida = 1,5 m');

// --- mapa em outra escala: a régua segue o mapa, não o canvas ---
canvas();
T.objects = new Map();
mapa({ larguraReal: 60, w: pxDeLarguraReal(30), h: 500, unidade: 'km' });  // 2x maior que o grid
assert.equal(upcEm(dentro), 3);
assert.equal(unidadeEm(dentro), 'km');
assert.equal(pxParaUnidades(70, dentro).valor, 3);

// --- unidadesParaPx segue a MESMA escala da régua (visão/luz batiam com o canvas, não com o mapa) ---
assert.equal(unidadesParaPx(3, dentro), 70, '3 km sobre esse mapa = 1 célula');
assert.equal(unidadesParaPx(1.5), 70, 'fora de qualquer mapa, vale a escala do canvas');
assert.equal(unidadesParaPx(9, { x: -999, y: -999 }), (9 / 1.5) * gridSize(), 'ponto fora do mapa usa o canvas');

// =====================================================================
// CENÁRIO INTERATIVO — o que o jogador vê da camada de luz
// =====================================================================
function comoJogador(perms) {
    T.mode = 'public'; T.isMaster = false; T.user = { uid: 'j1' };
    T.canvas = { camadas: CAMADAS_PADRAO };
    T.perms = perms || {};
}
const naLuz = (tipo) => ({ tipo, layerId: 'luz' });

assert.ok(PERMISSOES_LISTA.some(p => p.key === 'interagirCenario'), 'a permissão existe na lista do mestre');

// --- sem a permissão: camada de luz inteira fora do público (como era antes) ---
comoJogador({});
assert.equal(camadasVisiveis().some(c => c.tipo === 'luz'), false);
for (const t of ['porta', 'janela', 'luz', 'desenho']) assert.equal(objVisivel(naLuz(t)), false, t);

// --- com a permissão: só porta/janela/luz. A PAREDE continua invisível. ---
comoJogador({ interagirCenario: true });
assert.equal(camadasVisiveis().some(c => c.tipo === 'luz'), true);
assert.equal(objVisivel(naLuz('porta')), true);
assert.equal(objVisivel(naLuz('janela')), true);
assert.equal(objVisivel(naLuz('luz')), true);
assert.equal(objVisivel(naLuz('desenho')), false, '🔒 riscos de parede entregariam a planta do mapa');
assert.equal(objVisivel({ tipo: 'token', layerId: 'dm' }), false, 'camada DM segue fechada');

// --- a permissão não abre outras portas ---
assert.equal(camadasVisiveis().some(c => c.tipo === 'dm'), false);

// --- mestre no secreto vê tudo ---
T.mode = 'secret'; T.isMaster = true;
assert.equal(objVisivel(naLuz('desenho')), true);
assert.equal(camadasVisiveis().length, CAMADAS_PADRAO.length);

// =====================================================================
// PAREDE BLOQUEIA MOVIMENTO (a colisão que o clamp do arrasto usa)
// =====================================================================
const parede = [{ a: { x: 100, y: 0 }, b: { x: 100, y: 200 } }];
assert.ok(trajetoColide([{ x: 50, y: 100 }, { x: 150, y: 100 }], parede), 'atravessar a parede colide');
assert.equal(trajetoColide([{ x: 50, y: 100 }, { x: 90, y: 100 }], parede), null, 'chegar perto não colide');
assert.equal(trajetoColide([{ x: 50, y: 100 }, { x: 50, y: 180 }], parede), null, 'deslizar ao lado é livre');
assert.ok(trajetoColide([{ x: 50, y: 10 }, { x: 50, y: 190 }, { x: 150, y: 190 }], parede),
    'waypoint não é rota de fuga: qualquer trecho que cruza conta');
assert.equal(trajetoColide([{ x: 50, y: 100 }, { x: 150, y: 100 }], []), null, 'sem paredes, passa');

// =====================================================================
// VÍNCULO DE NPC COM A MESA
// `vinculos` é a lista do editor de NPCs; perder um item aqui apaga o vínculo lá.
// =====================================================================
assert.deepEqual(vinculosComMesa(undefined, 'M1', true), [{ tipo: 'mesa', id: 'M1' }], 'NPC sem vínculo nenhum');
assert.deepEqual(vinculosComMesa([], 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(vinculosComMesa([{ tipo: 'mesa', id: 'M1' }], 'M1', false), [], 'desvincular limpa');

// troca de mesa: sai da antiga, entra na nova (o espelho `mesaId` só cabe uma)
assert.deepEqual(vinculosComMesa([{ tipo: 'mesa', id: 'M0' }], 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);

// 🔒 o que não é mesa TEM que sobreviver
const outros = [{ tipo: 'char', id: 'c1' }, { tipo: 'mesa', id: 'M0' }, { tipo: 'npc', id: 'n9' }];
assert.deepEqual(vinculosComMesa(outros, 'M1', true),
    [{ tipo: 'char', id: 'c1' }, { tipo: 'npc', id: 'n9' }, { tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(vinculosComMesa(outros, 'M1', false),
    [{ tipo: 'char', id: 'c1' }, { tipo: 'npc', id: 'n9' }], 'desvincular não leva os outros junto');
assert.deepEqual(outros.length, 3, 'não muta a lista original');

// lixo no campo não derruba
assert.deepEqual(vinculosComMesa('nao-e-array', 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(vinculosComMesa([null, { tipo: 'char', id: 'c1' }], 'M1', false), [{ tipo: 'char', id: 'c1' }]);

console.log('✅ tab-state: escala, unidades, larguraReal, cenário, paredes e vínculo de NPC OK');
