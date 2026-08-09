// Rodar: node tabuleiro/js/tab-state.test.mjs
// Cobre a escala do canvas: larguraReal ⇄ px, régua sobre mapa e unidadesParaPx.
import assert from 'node:assert/strict';
import {
    T, UNIDADES, optsUnidade, CAMADAS_PADRAO, PERMISSOES_LISTA,
    pxDeLarguraReal, larguraRealDePx, sincLarguraReal,
    upcEm, unidadeEm, unidadesParaPx, pxParaUnidades, gridSize,
    camadasVisiveis, objVisivel, tokensDaVisao, mesclarCamadasPadrao, popNavegacaoValida,
    fmtViagem, fmtDuracao, refViagemPorDia, camposRevelados, selecionar, politicaDeFog,
    alcanceDeVisao, fonteDoAlcance, DV_PERCEPCAO, DV_PERCEPCAO_VISUAL,
    bonusIniciativa, DV_INICIATIVA, DADO_INICIATIVA,
    rotParaCanvas, anguloDoMovimento, deveAtualizarPasso, FOG_PASSO_CELULA, FOG_INTERVALO_MS,
    DRAG_WRITE_MS, DRAG_PASSO_CELULA, LERP_TOKEN_MS, LERP_MIN_MS, LERP_MAX_MS, duracaoLerp,
    ehEcoAtrasado, mapaSobPonto, T as TT,
} from './tab-state.js';
import { trajetoColide } from './tab-grid.js';
import { comMesa, npcNaMesa, mesasDoNpc, espelhoMesaId, patchVinculoMesa } from '../../shared/npc-mesas.js';

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

// --- 🖼️ camada Mostrar: visível ao público, mas objeto a objeto ---
assert.equal(camadasVisiveis().some(c => c.tipo === 'mostrar'), true, 'a vitrine existe para o jogador');
assert.equal(objVisivel({ tipo: 'mostrar', layerId: 'mostrar' }), true, 'liberado por padrão na camada');
assert.equal(objVisivel({ tipo: 'mostrar', layerId: 'mostrar', visivelPublico: false }), false,
    '🔒 é o 👁️ do objeto que decide — o que o mestre coloca nasce oculto');
assert.equal(CAMADAS_PADRAO.find(c => c.tipo === 'mostrar').abaixoDaLuz, false,
    '🔒 abaixoDaLuz falso é o que joga a vitrine para o passe ACIMA do fog');

// canvas antigo (sem a camada nova) ganha ela ao carregar, sem migrar o banco
const velho = CAMADAS_PADRAO.filter(c => c.id !== 'mostrar');
assert.equal(mesclarCamadasPadrao(velho).length, CAMADAS_PADRAO.length);
assert.equal(mesclarCamadasPadrao(velho).some(c => c.id === 'mostrar'), true);
assert.equal(mesclarCamadasPadrao(CAMADAS_PADRAO), CAMADAS_PADRAO, 'nada faltando: devolve o mesmo array');
assert.equal(mesclarCamadasPadrao(undefined).length, CAMADAS_PADRAO.length, 'canvas sem camadas não quebra');
// camada custom do mestre sobrevive à mesclagem
const comCustom = [...velho, { id: 'x1', nome: 'Minha', tipo: 'custom', ordem: 9 }];
assert.equal(mesclarCamadasPadrao(comCustom).some(c => c.id === 'x1'), true);

// --- mestre no secreto vê tudo ---
T.mode = 'secret'; T.isMaster = true;
assert.equal(objVisivel(naLuz('desenho')), true);
assert.equal(camadasVisiveis().length, CAMADAS_PADRAO.length);

// =====================================================================
// QUEM DITA A VISÃO DA TELA (tokensDaVisao)
// 🔴 A regressão trancada: no MODO PÚBLICO (a TV da sessão) o mestre entrava
// como "mestre" — a tela recortava por TODA luz e por visão de NPC, e a TV
// entregava sala iluminada vazia e inimigo que nenhum jogador estava vendo.
// =====================================================================
T.canvas = { camadas: CAMADAS_PADRAO };
T.chars = [{ id: 'c1', ownerUid: 'j1' }, { id: 'c2', ownerUid: 'j2' }];
T.objects = new Map(Object.entries({
    t1:  { id: 't1', tipo: 'token', layerId: 'tokens', vinculo: { tipo: 'char', id: 'c1' } },
    t2:  { id: 't2', tipo: 'token', layerId: 'tokens', vinculo: { tipo: 'char', id: 'c2' } },
    npc: { id: 'npc', tipo: 'token', layerId: 'tokens', vinculo: { tipo: 'npc', id: 'n1' } },
    esc2:{ id: 'esc2', tipo: 'token', layerId: 'tokens', visivelPublico: false, vinculo: { tipo: 'char', id: 'c2' } },
    luz: { id: 'luz', tipo: 'luz', layerId: 'luz' },
}));
const idsDaVisao = () => tokensDaVisao().map(o => o.id);

T.mode = 'public'; T.isMaster = true; T.user = { uid: 'mestre' };
assert.deepEqual(idsDaVisao(), ['t1', 't2'], '🔒 mestre na TV enxerga pela união do GRUPO');
assert.equal(idsDaVisao().includes('npc'), false, '🔒 visão de NPC nunca entra no público');
assert.equal(idsDaVisao().includes('esc2'), false, 'token escondido do público não dá visão na TV');

T.mode = 'public'; T.isMaster = false; T.user = { uid: 'j1' };
assert.deepEqual(idsDaVisao(), ['t1'], 'jogador enxerga só pelos tokens dele');
T.user = { uid: 'espectador' };
assert.deepEqual(idsDaVisao(), [], 'sem token próprio a lista é vazia (o fallback do grupo é do render)');

T.mode = 'secret'; T.isMaster = true;
assert.deepEqual(idsDaVisao(), [], 'no secreto o mestre não tem visão limitada');

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
// VÍNCULO DE NPC COM A MESA — um NPC pode servir VÁRIAS mesas ao mesmo tempo
// `vinculos` é a lista do editor de NPCs; perder um item aqui apaga o vínculo lá.
// =====================================================================
assert.deepEqual(comMesa(undefined, 'M1', true), [{ tipo: 'mesa', id: 'M1' }], 'NPC sem vínculo nenhum');
assert.deepEqual(comMesa([], 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(comMesa([{ tipo: 'mesa', id: 'M1' }], 'M1', false), [], 'desvincular limpa');

// 🔒 entrar numa mesa nova NÃO tira o NPC das outras (era o bug do vinculosComMesa)
assert.deepEqual(comMesa([{ tipo: 'mesa', id: 'M0' }], 'M1', true),
    [{ tipo: 'mesa', id: 'M0' }, { tipo: 'mesa', id: 'M1' }], 'duas mesas ao mesmo tempo');
assert.deepEqual(comMesa([{ tipo: 'mesa', id: 'M0' }, { tipo: 'mesa', id: 'M1' }], 'M0', false),
    [{ tipo: 'mesa', id: 'M1' }], 'sair de uma mesa mantém a outra');
// vincular de novo não duplica
assert.deepEqual(comMesa([{ tipo: 'mesa', id: 'M1' }], 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);

// 🔒 o que não é mesa TEM que sobreviver
const outros = [{ tipo: 'char', id: 'c1' }, { tipo: 'mesa', id: 'M0' }, { tipo: 'npc', id: 'n9' }];
assert.deepEqual(comMesa(outros, 'M1', true),
    [{ tipo: 'char', id: 'c1' }, { tipo: 'mesa', id: 'M0' }, { tipo: 'npc', id: 'n9' }, { tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(outros.length, 3, 'não muta a lista original');

// lixo no campo não derruba
assert.deepEqual(comMesa('nao-e-array', 'M1', true), [{ tipo: 'mesa', id: 'M1' }]);
assert.deepEqual(comMesa([null, { tipo: 'char', id: 'c1' }], 'M1', false), [{ tipo: 'char', id: 'c1' }]);

// pertencimento: vínculos OU espelho legado (docs antigos só têm mesaId)
assert.equal(npcNaMesa({ vinculos: [{ tipo: 'mesa', id: 'M1' }] }, 'M1'), true);
assert.equal(npcNaMesa({ vinculos: [{ tipo: 'mesa', id: 'M0' }, { tipo: 'mesa', id: 'M1' }] }, 'M1'), true, 'multi-mesa');
assert.equal(npcNaMesa({ mesaId: 'M1' }, 'M1'), true, 'doc legado sem vinculos');
assert.equal(npcNaMesa({ mesaId: 'M0' }, 'M1'), false);
assert.equal(npcNaMesa({}, 'M1'), false, 'NPC solto');
assert.equal(npcNaMesa({ mesaId: 'M1' }, ''), false, 'mesa vazia nunca casa');
assert.deepEqual(mesasDoNpc({ mesaId: 'M1', vinculos: [{ tipo: 'mesa', id: 'M1' }, { tipo: 'mesa', id: 'M2' }] }),
    ['M1', 'M2'], 'espelho não duplica');

// espelho legado = primeira mesa da lista
assert.equal(espelhoMesaId([{ tipo: 'char', id: 'c1' }, { tipo: 'mesa', id: 'M2' }]), 'M2');
assert.equal(espelhoMesaId([]), '');
assert.deepEqual(patchVinculoMesa({ vinculos: [{ tipo: 'mesa', id: 'M0' }] }, 'M1', true),
    { vinculos: [{ tipo: 'mesa', id: 'M0' }, { tipo: 'mesa', id: 'M1' }], mesaId: 'M0' },
    'patch mantém as duas e espelha a primeira');

// =====================================================================
// NAVEGAÇÃO ENTRE MAPAS — o "Voltar" pula canvases excluídos
// =====================================================================
const vivos = new Set(['a', 'b']);
const existe = id => vivos.has(id);

let trilha = [{ id: 'a', nome: 'Continente' }, { id: 'b', nome: 'Região' }];
assert.deepEqual(popNavegacaoValida(trilha, existe), { id: 'b', nome: 'Região' }, 'volta um nível');
assert.equal(trilha.length, 1, 'consome só o topo');

trilha = [{ id: 'a', nome: 'Continente' }, { id: 'x', nome: 'Excluído' }];
assert.deepEqual(popNavegacaoValida(trilha, existe), { id: 'a', nome: 'Continente' }, 'canvas excluído: sobe mais um nível');
assert.equal(trilha.length, 0);

assert.equal(popNavegacaoValida([], existe), null, 'trilha vazia');
assert.equal(popNavegacaoValida([{ id: 'x' }, { id: 'y' }], existe), null, 'só entradas mortas');

// =====================================================================
// ROTA DE VIAGEM — distância + dias/horas/minutos
// Um "dia" vale 8 h de marcha, não 24 h — é o que casa com km/dia.
// =====================================================================
assert.equal(fmtDuracao(8), '1 dia', '8 h de marcha = 1 dia cheio');
assert.equal(fmtDuracao(13.6), '1 dia 5h 36min');
assert.equal(fmtDuracao(0.5), '30min');
assert.equal(fmtDuracao(2), '2h');
assert.equal(fmtDuracao(16), '2 dias', 'plural');
assert.equal(fmtDuracao(0), 'menos de 1min', 'distância zero não vira NaN');
assert.equal(fmtDuracao(0.004), 'menos de 1min', 'arredondar para 0 min também');
assert.equal(fmtDuracao(24, 24), '1 dia', 'dá para usar outra jornada');

assert.equal(fmtViagem({ valor: 34, unidade: 'km' }, 20), '🛤️ 34 km · ⏱️ 1 dia 5h 36min a 20 km/dia');
assert.equal(fmtViagem({ valor: 34, unidade: 'km' }, 0), '🛤️ 34 km', 'sem velocidade configurada, só a distância');
assert.equal(fmtViagem({ valor: 300, unidade: 'km' }, 25), '🛤️ 300 km · ⏱️ 12 dias a 25 km/dia');
// o caso do print: 20 km a 880 km/dia mostrava "0 dia(s)" — agora sai em minutos
assert.equal(fmtViagem({ valor: 20, unidade: 'km' }, 880), '🛤️ 20 km · ⏱️ 11min a 880 km/dia');

// --- referência de deslocamento por unidade (placeholder da config) ---
assert.equal(refViagemPorDia('km'), 25, '~25 km/dia a pé');
assert.equal(refViagemPorDia('m'), 25000);
assert.equal(refViagemPorDia('mi'), 15.5);
assert.equal(refViagemPorDia('passos'), 33000);
assert.equal(refViagemPorDia('bugiganga'), 25000, 'unidade desconhecida cai em metros');

// =====================================================================
// SELEÇÃO — o único e o conjunto andam juntos
// =====================================================================
selecionar('a1');
assert.equal(TT.selection, 'a1');
assert.deepEqual(TT.selecionados, ['a1'], 'selecionar um popula o conjunto');
selecionar(null);
assert.equal(TT.selection, null);
assert.deepEqual(TT.selecionados, [], 'limpar limpa os dois');

// =====================================================================
// CARD DE GEOGRAFIA/PROPRIEDADE — permissão por campo
// =====================================================================
const cartao = [['descricao', 'Descrição'], ['notas', 'Notas'], ['linkedNpcs', 'NPCs']];
const ficha = { descricao: 'Um porto', notas: 'segredo do mestre', linkedNpcs: [] };
assert.deepEqual(camposRevelados(cartao, ficha, {}, true).map(c => c[0]), ['descricao', 'notas'],
    'mestre vê tudo que tem conteúdo; lista vazia fica de fora');
assert.deepEqual(camposRevelados(cartao, ficha, {}, false), [], 'nada liberado: jogador não vê nada');
assert.deepEqual(camposRevelados(cartao, ficha, { descricao: true }, false).map(c => c[0]), ['descricao'],
    'só o campo liberado aparece');
assert.deepEqual(camposRevelados(cartao, ficha, { descricao: true, notas: false }, false).map(c => c[0]), ['descricao'],
    'revogar volta a esconder');
assert.deepEqual(camposRevelados(cartao, ficha, { linkedNpcs: true }, false), [], 'liberar campo vazio não mostra nada');
assert.deepEqual(camposRevelados(cartao, null, { descricao: true }, false), [], 'ficha ausente não quebra');

// =====================================================================
// POLÍTICA DE FOG
// 🔴 A regressão trancada aqui: com luz dinâmica LIGADA em modo ☀️ Dia, o
// jogador via o mapa INTEIRO — o fog era pulado no público e as paredes
// deixavam de tapar a vista. Invariante: luz ligada => jogador recebe fog.
// =====================================================================
const jogadorDia   = politicaDeFog({ luzAtiva: true,  modo: 'dia',   ehMestre: false });
const jogadorNoite = politicaDeFog({ luzAtiva: true,  modo: 'noite', ehMestre: false });
const mestreDia    = politicaDeFog({ luzAtiva: true,  modo: 'dia',   ehMestre: true  });
const mestreNoite  = politicaDeFog({ luzAtiva: true,  modo: 'noite', ehMestre: true  });
const desligada    = politicaDeFog({ luzAtiva: false, modo: 'noite', ehMestre: false });

assert.equal(jogadorDia.aplica, true, '🔒 DIA TAMBÉM aplica fog no jogador — parede tapa a vista de dia');
assert.equal(jogadorNoite.aplica, true);
assert.equal(desligada.aplica, false, 'luz dinâmica desligada = comportamento clássico, sem fog');

// De dia não se exige luz: a linha de visão é o único limite
assert.equal(jogadorDia.exigeLuz, false, 'de dia a visão não depende de lampião');
assert.equal(jogadorNoite.exigeLuz, true, 'de noite o sensor padrão precisa de luz');

// O jogador nunca enxerga pelas luzes do mestre, só pelas próprias visões
assert.equal(jogadorDia.recortaLuzes, false, 'jogador não ganha visão de área só por estar iluminada');
assert.equal(jogadorNoite.recortaLuzes, false);
assert.equal(mestreDia.recortaLuzes, true, 'mestre enxerga visões + luzes na tela dele');
assert.equal(mestreNoite.recortaLuzes, true);

// O véu leve de 35% é ajuda visual do mestre; para o jogador o oculto é opaco
assert.equal(mestreDia.veuLeve, true);
assert.equal(jogadorDia.veuLeve, false, '🔒 véu leve no jogador entregaria o mapa por transparência');
assert.equal(mestreNoite.veuLeve, false);

// Luz desligada zera tudo, sem sobra de flag
assert.deepEqual(desligada, { aplica: false, exigeLuz: false, veuLeve: false, recortaLuzes: false });

// =====================================================================
// ALCANCE DE VISÃO — valor fixo ou Percepção, e ×3 de dia
// =====================================================================
const semFicha = null;
const comVisual = { [DV_PERCEPCAO_VISUAL]: 7, [DV_PERCEPCAO]: 4 };
const soGeral   = { [DV_PERCEPCAO_VISUAL]: 0, [DV_PERCEPCAO]: 4 };  // ficha calcula 0 p/ quem não tem o VD
const zerado    = { [DV_PERCEPCAO_VISUAL]: 0, [DV_PERCEPCAO]: 0 };

// --- valor fixo ---
assert.equal(alcanceDeVisao({ alcance: 9 }, semFicha, false), 9);
assert.equal(alcanceDeVisao({ alcance: 9, alcanceFonte: 'fixo' }, comVisual, false), 9,
    'fonte fixa ignora a percepção da ficha');
assert.equal(alcanceDeVisao({}, null, false), 6, 'sem alcance definido cai no padrão 6');

// --- por percepção ---
const porPerc = (der) => alcanceDeVisao({ alcance: 9, alcanceFonte: 'percepcao' }, der, false);
assert.equal(porPerc(comVisual), 9, 'Percepção Visual 7 + 2');
assert.equal(porPerc(soGeral), 6, '🔒 sem Percepção Visual (0) cai para Percepção 4 + 2');
assert.equal(porPerc(zerado), 9, 'sem percepção nenhuma volta ao valor fixo, não cega o token');
assert.equal(porPerc(semFicha), 9, 'NPC/custom sem ficha volta ao valor fixo');
assert.equal(porPerc({}), 9, 'ficha ainda sem os VDs espelhados volta ao valor fixo');
assert.equal(fonteDoAlcance({ alcanceFonte: 'percepcao' }, {}), 'fixo',
    'espelho vazio não pode ser confundido com percepção zerada de verdade');

// --- ×3 de DIA, venha de onde vier ---
assert.equal(alcanceDeVisao({ alcance: 9 }, semFicha, true), 27, 'valor fixo triplica de dia');
assert.equal(alcanceDeVisao({ alcance: 9, alcanceFonte: 'percepcao' }, comVisual, true), 27,
    'percepção também triplica de dia (9 × 3)');
assert.equal(alcanceDeVisao({ alcance: 9, alcanceFonte: 'percepcao' }, soGeral, true), 18, '(4+2) × 3');

// --- borda: alcance negativo ou lixo não vira NaN nem visão infinita ---
assert.equal(alcanceDeVisao({ alcance: -5 }, null, false), 0);
assert.equal(alcanceDeVisao({ alcance: 'abc' }, null, false), 6, 'texto inválido cai no padrão');
assert.equal(alcanceDeVisao({ alcance: 0 }, null, true), 0, 'zero segue zero mesmo de dia');

// --- de onde o número veio (rótulo da UI) ---
assert.equal(fonteDoAlcance({ alcance: 9 }, comVisual), 'fixo');
assert.equal(fonteDoAlcance({ alcanceFonte: 'percepcao' }, comVisual), 'visual');
assert.equal(fonteDoAlcance({ alcanceFonte: 'percepcao' }, soGeral), 'geral');
assert.equal(fonteDoAlcance({ alcanceFonte: 'percepcao' }, zerado), 'fixo');
assert.equal(fonteDoAlcance({ alcanceFonte: 'percepcao' }, null), 'fixo');

// as chaves têm que casar com o que a ficha grava (nome sem acento, maiúsculas)
assert.equal(DV_PERCEPCAO, 'PERCEPCAO');
assert.equal(DV_PERCEPCAO_VISUAL, 'PERCEPCAO_VISUAL');

// =====================================================================
// DIREÇÃO DO CONE — `rot` (0° = cima) → canvas (0° = direita)
// 🔴 A regressão trancada: o indicador da bússola convertia com -90 e o
// raycasting do cone NÃO, então a visão saía 90° torta da frente do token e,
// ao arrastar, apontava para o lado do movimento.
// =====================================================================
// O que importa é o VETOR resultante, não o número — é isso que pega erro de sinal.
const aponta = (rot) => {
    const a = rotParaCanvas(rot) * Math.PI / 180;
    return [Math.round(Math.cos(a)), Math.round(Math.sin(a))];   // y cresce para BAIXO no canvas
};
assert.deepEqual(aponta(0),   [0, -1], 'rot 0 aponta para CIMA');
assert.deepEqual(aponta(90),  [1, 0],  'rot 90 aponta para a DIREITA');
assert.deepEqual(aponta(180), [0, 1],  'rot 180 aponta para BAIXO');
assert.deepEqual(aponta(270), [-1, 0], 'rot 270 aponta para a ESQUERDA');
assert.deepEqual(aponta(undefined), [0, -1], 'sem rot, aponta para cima');

// --- ida e volta: arrastar numa direção tem que mirar NAQUELA direção ---
// (era exatamente o caso relatado: "ao arrastar, a visão fica de lado")
const mirandoAoAndar = (dx, dy) => aponta(anguloDoMovimento(dx, dy));
assert.deepEqual(mirandoAoAndar(0, -50), [0, -1], 'andar para cima mira para cima');
assert.deepEqual(mirandoAoAndar(50, 0),  [1, 0],  'andar para a direita mira para a direita');
assert.deepEqual(mirandoAoAndar(0, 50),  [0, 1],  'andar para baixo mira para baixo');
assert.deepEqual(mirandoAoAndar(-50, 0), [-1, 0], 'andar para a esquerda mira para a esquerda');

// piso do movimento: passo curto não gira o token (senão treme a cada pixel)
assert.equal(anguloDoMovimento(1, 1), null);
assert.equal(anguloDoMovimento(0, 0), null);
assert.equal(anguloDoMovimento(50, 0), 90, 'direita = 90 no referencial do token');

// =====================================================================
// VISÃO ACOMPANHANDO O ARRASTO — passo mínimo do fog
// A visão segue o token durante o arrasto, mas em saltos: mover 1 token
// invalida o polígono de TODAS as visões e luzes, e fazer isso a cada pixel é
// o gargalo do ADR-001.
// =====================================================================
const passo = 70 * FOG_PASSO_CELULA;   // célula de 70px → 17.5px
assert.equal(FOG_PASSO_CELULA, 0.25, 'passo de 1/4 de célula');

assert.equal(deveAtualizarPasso(null, { x: 10, y: 10 }, passo), true, 'primeira posição sempre entra');
assert.equal(deveAtualizarPasso(undefined, { x: 0, y: 0 }, passo), true);
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 0, y: 0 }, passo), false, 'parado não recalcula');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 5, y: 0 }, passo), false, 'pixel a pixel não recalcula');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: passo, y: 0 }, passo), true, 'no passo exato, anda');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 100, y: 0 }, passo), true, 'salto grande anda');

// distância é euclidiana: diagonal curta nos dois eixos ainda pode somar o passo
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 13, y: 13 }, passo), true,
    'diagonal conta pela hipotenusa (18.4 > 17.5), não por eixo');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 12, y: 12 }, passo), false, '(17.0 < 17.5)');

// atravessar o mapa dá um número de recálculos proporcional à DISTÂNCIA,
// não à taxa de quadros — é isso que limita o custo
let recalcs = 0, atual = { x: 0, y: 0 };
for (let x = 0; x <= 1400; x += 2) {          // 20 células, 2px por frame
    if (deveAtualizarPasso(atual, { x, y: 0 }, passo)) { atual = { x, y: 0 }; recalcs++; }
}
assert.ok(recalcs <= 85 && recalcs >= 75, `~80 recálculos em 20 células (deu ${recalcs}), não 700`);

// --- piso de TEMPO: é o que segura o arrasto rápido ---
// Num arrasto veloz 1/4 de célula passa a cada quadro, e só a distância
// liberaria um recálculo por frame — o fog composto em cache nunca acertaria.
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 100, y: 0 }, passo, 10, 70), false,
    'andou muito, mas cedo demais: não recalcula');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 100, y: 0 }, passo, 70, 70), true,
    'no intervalo e com distância: recalcula');
assert.equal(deveAtualizarPasso({ x: 0, y: 0 }, { x: 5, y: 0 }, passo, 500, 70), false,
    'tempo de sobra mas não andou: não recalcula');
assert.equal(deveAtualizarPasso(null, { x: 0, y: 0 }, passo, 0, 70), true,
    'primeira posição ignora o piso de tempo');
assert.equal(FOG_INTERVALO_MS, 70);

// arrasto rápido de 1s a 60fps: o tempo limita a ~14 passos, não 60
let rapidos = 0, pos = { x: 0, y: 0 }, ultimoT = 0;
for (let f = 1; f <= 60; f++) {
    const t = f * 16.7, alvo = { x: f * 30, y: 0 };        // 30px por quadro = bem rápido
    if (deveAtualizarPasso(pos, alvo, passo, t - ultimoT, FOG_INTERVALO_MS)) { pos = alvo; ultimoT = t; rapidos++; }
}
assert.ok(rapidos <= 16 && rapidos >= 12, `~14 passos em 1s de arrasto rápido (deu ${rapidos}), não 60`);

// =====================================================================
// TAXA DE ESCRITA NO ARRASTO
// 🔴 A regressão trancada: o Firestore aguenta ~1 escrita sustentada por
// segundo em cada documento. A 100ms o arrasto fazia 10/s no MESMO doc do
// token; a fila no servidor era o atraso de vários segundos no outro aparelho.
// =====================================================================
assert.ok(DRAG_WRITE_MS >= 300, `intervalo de escrita não pode voltar a ser curto (está ${DRAG_WRITE_MS}ms)`);
assert.ok(LERP_TOKEN_MS >= DRAG_WRITE_MS,
    'o lerp remoto tem de cobrir o intervalo entre escritas, senão o token chega e para');

// 1s de arrasto rápido: o portão de distância + intervalo limita a ~3 escritas
const passoWrite = 70 * DRAG_PASSO_CELULA;   // meia célula = 35px
let writes = 0, ultPos = { x: 0, y: 0 }, ultT = -Infinity;
for (let f = 1; f <= 60; f++) {
    const t = f * 16.7, alvo = { x: f * 30, y: 0 };
    if (deveAtualizarPasso(ultPos, alvo, passoWrite, t - ultT, DRAG_WRITE_MS)) {
        ultPos = alvo; ultT = t; writes++;
    }
}
assert.ok(writes <= 4, `no máximo ~3 escritas por segundo de arrasto (deu ${writes}), não 10`);

// ajuste fino de posição (menos de meia célula) não gera escrita nenhuma
let semWrite = 0;
for (let f = 1; f <= 60; f++) {
    if (deveAtualizarPasso({ x: 0, y: 0 }, { x: 10, y: 0 }, passoWrite, f * 16.7, DRAG_WRITE_MS)) semWrite++;
}
assert.equal(semWrite, 0, 'encostar o token uns pixels não fala com o servidor');

// =====================================================================
// DURAÇÃO DO LERP REMOTO — o token do outro lado tem que DESLIZAR
// 🔴 A regressão trancada: a duração era FIXA (320ms) mas o intervalo entre as
// escritas varia (o portão é meia célula). Arrasto devagar = escrita a cada
// ~800ms: o token remoto andava 320ms e ficava 480ms PARADO esperando a
// próxima posição. Era o "fica pulando" de quem assiste o arrasto.
// =====================================================================
assert.equal(duracaoLerp(0), LERP_TOKEN_MS, '1º trecho não tem ritmo para medir: cai no padrão');
assert.equal(duracaoLerp(320), 320, 'ritmo normal: o trecho dura exatamente o intervalo medido');
assert.equal(duracaoLerp(50), LERP_MIN_MS, 'rajada não vira teleporte');
assert.equal(duracaoLerp(5000), LERP_MAX_MS, 'pausa longa não vira token em câmera lenta');
assert.equal(duracaoLerp(-5), LERP_TOKEN_MS, 'relógio torto não vira duração negativa');
assert.ok(LERP_MIN_MS < DRAG_WRITE_MS && DRAG_WRITE_MS < LERP_MAX_MS,
    'o intervalo típico de escrita tem de caber ENTRE o piso e o teto, senão sempre grampeia');

// tempo ocioso entre um trecho e o próximo: é ele que aparece como solavanco
const ocioso = (intervalo, dur) => Math.max(0, intervalo - dur);
assert.ok(ocioso(800, LERP_TOKEN_MS) > 400, 'era isso que acontecia com duração fixa');
assert.equal(ocioso(800, duracaoLerp(800)), 0, 'arrasto devagar: anda o trecho inteiro');
assert.equal(ocioso(300, duracaoLerp(300)), 0, 'arrasto normal: idem');
assert.equal(ocioso(2000, duracaoLerp(2000)), 1000,
    'pausa de verdade ainda deixa o token parado — e deve mesmo, ninguém está arrastando');

// =====================================================================
// 📖 CAPÍTULOS EXIBIDOS — vários ao mesmo tempo, sem migrar doc antigo
// =====================================================================
import { capsExibidos, focoExibido } from './tab-state.js';

assert.deepEqual(capsExibidos({ caps: ['a', 'b'], foco: 'b' }), ['a', 'b']);
assert.equal(focoExibido({ caps: ['a', 'b'], foco: 'b' }), 'b', 'o foco é o que abre sozinho na mesa');
assert.deepEqual(capsExibidos({ caps: [], foco: null }), [], 'lista vazia = nada no ar');

// 🔒 formato antigo (um capítulo só) continua valendo — mesa parada há meses
assert.deepEqual(capsExibidos({ capId: 'x', t: 1 }), ['x'], 'doc antigo vira lista de um');
assert.equal(focoExibido({ capId: 'x', t: 1 }), 'x', 'e o antigo abre sozinho como antes');

// nada exibido / lixo no campo não vira capítulo fantasma
assert.deepEqual(capsExibidos(null), []);
assert.deepEqual(capsExibidos(undefined), []);
assert.deepEqual(capsExibidos({ caps: ['a', null, ''] }), ['a'], 'buraco na lista não abre leitor vazio');
assert.equal(focoExibido(null), null);
assert.equal(focoExibido({ caps: ['a'] }), null, 'lista sem foco não arranca ninguém para a leitura');

// =====================================================================
// ECO ATRASADO DO PRÓPRIO ARRASTO
// 🔴 A regressão trancada: um write intermediário do arrasto aterrissando
// depois do final jogava o token de volta ao meio do caminho — o tremor ao
// soltar e o "não termina o percurso".
// =====================================================================
const EU = 'uid-eu', OUTRO = 'uid-outro';
const meuLocal = { __meuWrite: 1000 };

assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: EU, atualizadoEm: 900 }, EU), true,
    'meu write antigo chegando tarde é descartado');
assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: EU, atualizadoEm: 1000 }, EU), false,
    'o eco do meu write mais recente é aplicado');
assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: EU, atualizadoEm: 1500 }, EU), false,
    'write meu mais novo (ex.: outra aba minha) é aplicado');
assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: OUTRO, atualizadoEm: 900 }, EU), false,
    '🔒 write de OUTRO usuário nunca é descartado, mesmo antigo');
assert.equal(ehEcoAtrasado(null, { lastWriter: EU, atualizadoEm: 900 }, EU), false,
    'objeto novo (sem local) sempre entra');
assert.equal(ehEcoAtrasado({}, { lastWriter: EU, atualizadoEm: 900 }, EU), false,
    'sem __meuWrite não há o que comparar');
assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: EU }, EU), true,
    'doc sem atualizadoEm conta como antigo');
assert.equal(ehEcoAtrasado(meuLocal, { lastWriter: EU, atualizadoEm: 900 }, undefined), false,
    'sem uid (deslogado) não filtra nada');

// =====================================================================
// mapaSobPonto — cache por versão, e o de cima ganha
// (é chamado uma vez por amostra dentro de medirTrajeto; varrer tudo travava)
// =====================================================================
canvas();
const baixo = mapa({ id: 'baixo', x: 0, y: 0, w: 500, h: 500, z: 1, larguraReal: 10, unidade: 'km' });
const cima  = mapa({ id: 'cima',  x: 0, y: 0, w: 500, h: 500, z: 9, larguraReal: 20, unidade: 'km' });
assert.equal(mapaSobPonto({ x: 10, y: 10 })?.id, 'cima', 'z maior ganha');
assert.equal(mapaSobPonto({ x: 900, y: 900 }), null, 'fora de qualquer mapa');
// objeto que não é imagem de mapa não entra
T.objects.set('tk', { id: 'tk', tipo: 'token', layerId: 'tokens', x: 10, y: 10 });
assert.equal(mapaSobPonto({ x: 10, y: 10 })?.id, 'cima', 'token no mesmo ponto não é mapa');

// 🔒 invalidação: trocar o Map (troca de canvas) não pode servir o mapa do anterior
T.objects = new Map();
assert.equal(mapaSobPonto({ x: 10, y: 10 }), null, 'canvas novo começa sem mapa');
mapa({ id: 'novo', x: 0, y: 0, w: 500, h: 500, z: 1, larguraReal: 5, unidade: 'km' });
assert.equal(mapaSobPonto({ x: 10, y: 10 })?.id, 'novo', 'e passa a ver o mapa do canvas novo');

// =====================================================================
// marcarRecebimentoReguas — expiracao da regua remota SEM relogio cruzado
// (o t vem do relogio do outro aparelho; um celular minutos fora de hora
// fazia a regua nascer "expirada" e nunca aparecer)
// =====================================================================
import { marcarRecebimentoReguas, REGUA_TTL_MS, reguaVisivelAqui } from './tab-state.js';

const AGORA = 1_000_000;
// regua nova: carimba o relogio LOCAL, ignorando o quao torto o t remoto esteja
const atrasado = { pontos: [], t: AGORA - 10 * 60_000 };   // celular 10min atrasado
let rec = marcarRecebimentoReguas({}, { a: atrasado }, {}, AGORA);
assert.equal(rec.a, AGORA, 'regua de relogio atrasado carimba o relogio local');
const adiantado = { pontos: [], t: AGORA + 10 * 60_000 };  // celular 10min adiantado
rec = marcarRecebimentoReguas({}, { b: adiantado }, {}, AGORA);
assert.equal(rec.b, AGORA, 'relogio adiantado tambem');

// atualizacao da MESMA regua (t mudou): recarimba — e a regua nao expira enquanto chegam updates
rec = marcarRecebimentoReguas({ a: atrasado }, { a: { ...atrasado, t: atrasado.t + 300 } }, { a: AGORA }, AGORA + 300);
assert.equal(rec.a, AGORA + 300, 't novo = chegada nova');

// snapshot repetido sem mudanca (outro uid mudou no mesmo doc): mantem o carimbo antigo
rec = marcarRecebimentoReguas({ a: atrasado, b: adiantado }, { a: atrasado, b: { ...adiantado, t: 9 } }, { a: AGORA, b: AGORA }, AGORA + 5000);
assert.equal(rec.a, AGORA, 'regua inalterada nao ganha sobrevida');
assert.equal(rec.b, AGORA + 5000, 'so a que mudou recarimba');

// regua apagada (null) sai do mapa; e o TTL existe
rec = marcarRecebimentoReguas({ a: atrasado }, { a: null }, { a: AGORA }, AGORA + 100);
assert.equal('a' in rec, false, 'null limpa o carimbo');
assert.ok(REGUA_TTL_MS >= 1000, 'TTL em ms, contado do recebimento local');

// --- quem desenha a regua de quem (o Publico do Mestre e a MESMA conta) ---
T.user = { uid: 'EU' }; T.temp = null;
T.mode = 'secret';
assert.equal(reguaVisivelAqui('OUTRO'), true, 'regua dos outros sempre entra');
assert.equal(reguaVisivelAqui('EU'), false, 'a janela que mede ja desenha a propria em T.temp');
T.mode = 'public';
assert.equal(reguaVisivelAqui('EU'), true, '🔒 o publico do mestre TEM de mostrar a regua do arrasto dele');
T.temp = { tipo: 'medida' };
assert.equal(reguaVisivelAqui('EU'), false, 'se o publico e quem esta medindo, nao desenha duas vezes');
assert.equal(reguaVisivelAqui('OUTRO'), true);
T.temp = null; T.user = null;
assert.equal(reguaVisivelAqui('OUTRO'), true, 'sem usuario carregado ainda, regua alheia entra');

// =====================================================================
// configDoCanvasMudou — save de exploracao nao pode invalidar o mundo
// (cada save, ~1 a cada 3s de arrasto publico, re-renderizava mapa, paredes,
// fog e paineis em TODOS os aparelhos: o token remoto congelava por segundos)
// =====================================================================
import { configDoCanvasMudou } from './tab-state.js';

const base = { id: 'c1', grid: { size: 70, tipo: 'quad' }, escala: { valorPorCelula: 1.5 },
    camadas: [{ id: 'mapa', ordem: 0 }], luzDinamica: { ativa: true, modo: 'dia' },
    exploracao: { x0: 0, y0: 0, cols: 10, rows: 10, dados: 'AAAA' } };
const com = (patch) => ({ ...base, ...patch });

assert.equal(configDoCanvasMudou(base, com({ exploracao: { ...base.exploracao, dados: 'BBBB' } })), false,
    'so a exploracao mudou: sem invalidacao geral');
assert.equal(configDoCanvasMudou(base, com({})), false, 'snapshot identico: nada a invalidar');
assert.equal(configDoCanvasMudou(base, com({ grid: { size: 100, tipo: 'quad' } })), true,
    'grid mudou: invalida');
assert.equal(configDoCanvasMudou(base, com({ luzDinamica: { ativa: true, modo: 'noite' } })), true,
    'config aninhada (luz) mudou: invalida');
assert.equal(configDoCanvasMudou(base, com({ exploracao: null, grid: { size: 100 } })), true,
    'exploracao E config juntas: invalida');
assert.equal(configDoCanvasMudou(null, base), true, 'primeira carga: invalida');
assert.equal(configDoCanvasMudou({ ...base, id: 'outro' }, base), true, 'trocou de canvas: invalida');

// ===== INICIATIVA (1d10 + VD) =====
assert.equal(DADO_INICIATIVA, 10, 'a rolagem do mapa usa 1d10');
// ficha do personagem: derivedTotals com a key do sistema
assert.equal(bonusIniciativa({ [DV_INICIATIVA]: 4, PERCEPCAO: 9 }), 4);
// NPC v2: espelho legado `INI` (mesma fonte de onde saem VIT/ENER/SAN)
assert.equal(bonusIniciativa({ VIT: 30, INI: 3 }), 3, 'NPC usa o espelho legado INI');
assert.equal(bonusIniciativa({ overrides: { [DV_INICIATIVA]: 5 } }), 5, 'NPC sem espelho cai no override');
assert.equal(bonusIniciativa({ [DV_INICIATIVA]: 2, INI: 99 }), 2, 'key do sistema tem prioridade sobre o legado');
// sem ficha / sem o VD / lixo: rola o dado puro, nunca NaN
assert.equal(bonusIniciativa(null), 0, 'token custom não tem VD');
assert.equal(bonusIniciativa({}), 0);
assert.equal(bonusIniciativa({ [DV_INICIATIVA]: 'abc' }), 0, 'valor não numérico não vira NaN');
assert.equal(bonusIniciativa({ [DV_INICIATIVA]: 0, INI: 7 }), 0, 'zero é um bônus válido, não "vazio"');
assert.equal(bonusIniciativa({ [DV_INICIATIVA]: -2 }), -2, 'bônus negativo é respeitado');

// =====================================================================
// 🎯 Testes da cena — Alvo pela ficha, Graus do d10, formato +2/0/-1
// =====================================================================
import { normChave, valorComponente, alvoDoTeste, grausDoDado, fmtGraus,
         deslocamentosDoToken, limiteDeslocamento, melhorGrauDoUsuario, lootOculto } from './tab-state.js';

assert.equal(normChave('Percepção Visual'), 'PERCEPCAO_VISUAL', 'normaliza como as chaves de derivedTotals');

// char real: derivedTotals (VD) + dots (atributos attr_* e pericias sk_*)
const fichaChar = {
    derivedTotals: { PERCEPCAO: 3, PERCEPCAO_VISUAL: 7, INICIATIVA: 2 },
    dots: { attr_rac: 3, attr_for: 10, sk_mental_alquimancia: 3, sk_classe_precis_o: 2, sk_classe_marcar_presa: 1, sk_classe_erudi__o_ofensiva: 4 },
};
assert.equal(valorComponente('Percepção', fichaChar), 3, 'VD ganha do resto');
assert.equal(valorComponente('Raciocínio', fichaChar), 3, 'atributo por nome completo');
assert.equal(valorComponente('FOR', fichaChar), 10, 'atributo por sigla');
assert.equal(valorComponente('Alquimancia', fichaChar), 3, 'pericia direta');
assert.equal(valorComponente('Precisão', fichaChar), 2, 'pericia com acento (o _ da chave e curinga)');
assert.equal(valorComponente('Marcar Presa', fichaChar), 1, 'pericia com espaco no nome');
assert.equal(valorComponente('Erudição Ofensiva', fichaChar), 4, 'pericia com 2 chars especiais');
assert.equal(valorComponente('Inexistente', fichaChar), null, 'nao achou = null (Alvo manual)');

// NPC real: valoresDer (siglas legadas + extras) + atributos + pericias em texto
const fichaNpc = {
    valoresDer: { PERC: 5, INI: 1, extras: [{ nome: 'Conexão com Raízes', valor: '4' }] },
    atributos: { INT: 4, RAC: 3 },
    pericias: 'Cura Mística 5 = 10d10\nHerbalismo 4 = 8d10',
};
assert.equal(valorComponente('Percepção', fichaNpc), 5, 'sigla legada PERC resolve Percepcao');
assert.equal(valorComponente('INT', fichaNpc), 4, 'atributo do NPC');
assert.equal(valorComponente('Herbalismo', fichaNpc), 4, 'pericia parseada da linha');
assert.equal(valorComponente('Cura Mística', fichaNpc), 5, 'pericia com espaco e acento');
assert.equal(valorComponente('Conexão com Raízes', fichaNpc), 4, 'extra nomeado');

// Alvo composto: Atributo + Pericia + numero, com modificador
const r1 = alvoDoTeste('Raciocínio + Alquimancia + 2', fichaChar, -1);
assert.equal(r1.alvo, 3 + 3 + 2 - 1); assert.equal(r1.incompleto, false);
const r2 = alvoDoTeste('Raciocínio + NadaDisso', fichaChar);
assert.equal(r2.incompleto, true, 'componente nao resolvido marca incompleto');
assert.equal(r2.alvo, 3, 'e o resolvido ainda soma');

// Graus: Roll Under d10 — Alvo - dado; 1 critico, 10 falha critica
assert.equal(grausDoDado(6, 4), 2);
assert.equal(grausDoDado(6, 6), 0, 'igual ao Alvo = sucesso sem Graus');
assert.equal(grausDoDado(6, 8), -2);
assert.equal(grausDoDado(0, 1), 0, 'dado 1 = sucesso automatico mesmo com Alvo 0');
assert.equal(grausDoDado(9, 1), 8, 'critico mantem os Graus');
assert.equal(grausDoDado(12, 10), -1, 'dado 10 = falha mesmo com Alvo acima de 10');
assert.equal(fmtGraus(2), '+2'); assert.equal(fmtGraus(0), '0'); assert.equal(fmtGraus(-1), '-1');

// =====================================================================
// 👣 Deslocamentos da ficha + limite do arrasto
// =====================================================================
const chars = [{ id: 'c1', derivedTotals: { DESLOC_TERRESTRE: 13.1, DESLOC_AQUATICO: 7.45, DESLOC_AEREO: 0, DESLOC_VERTICAL: 0 } }];
const npcs = [{ id: 'n1', valoresDer: { DESLOCAMENTO: '8m, Carga 12m', extras: [{ nome: 'Deslocamento', valor: '8m' }, { nome: 'Desloc. Aéreo', valor: '15m' }] } }];
const dc = deslocamentosDoToken({ vinculo: { tipo: 'char', id: 'c1' } }, chars, npcs);
assert.deepEqual(dc, [{ tipo: 'Terrestre', metros: 13.1 }, { tipo: 'Aquático', metros: 7.5 }], 'zeros ficam de fora, maior primeiro');
const dn = deslocamentosDoToken({ vinculo: { tipo: 'npc', id: 'n1' } }, chars, npcs);
assert.deepEqual(dn, [{ tipo: 'Terrestre', metros: 8 }, { tipo: 'Aéreo', metros: 15 }], 'extra + legado sem duplicar o Terrestre');

assert.equal(limiteDeslocamento(13.1, 1.5, true), 13.5, 'snap: arredonda P/ CIMA ate a celula cheia');
assert.equal(limiteDeslocamento(13.5, 1.5, true), 13.5, 'multiplo exato nao ganha celula extra');
assert.equal(limiteDeslocamento(13.1, 1.5, false), 13.1, 'sem snap o limite e cru');
assert.equal(limiteDeslocamento(0, 1.5, true), 0);

// =====================================================================
// 📦 Loot oculto por teste
// =====================================================================
const combate = { cenas: [{ id: 'c', participantes: [
        { id: 'p1', characterId: 'c1' }, { id: 'p2', characterId: 'c2' }],
    testes: [
        { id: 't1', nome: 'Percepção', resultados: { p1: { graus: -1 }, p2: { graus: 3 } } },
        { id: 't2', nome: 'Raciocínio', resultados: { p1: { graus: 2 } } },
    ] }], cenaAtiva: 'c' };
assert.equal(melhorGrauDoUsuario(combate, ['c1']), 2, 'melhor resultado entre os testes');
assert.equal(melhorGrauDoUsuario(combate, ['c9']), null, 'sem participante = nunca testou');
assert.equal(melhorGrauDoUsuario(null, ['c1']), null);

const item = (t, extra) => ({ tipo: 'loot', testeGraus: t, ...extra });
assert.equal(lootOculto(item(null), 5), false, 'sem teste configurado = visivel normal');
assert.equal(lootOculto(item(2), 2), false, 'bateu os Graus = ve');
assert.equal(lootOculto(item(2), 1), true, 'ficou abaixo = nao ve');
assert.equal(lootOculto(item(0), null), true, 'limiar 0 SEM teste feito continua oculto');
assert.equal(lootOculto(item(0), 0), false, 'limiar 0 com sucesso sem Graus = ve');
assert.equal(lootOculto(item(0), -1), true, 'falha nao revela nem com limiar 0');
assert.equal(lootOculto(item(5, { reveladoPublico: true }), null), false, 'interagido = todos veem');
assert.equal(lootOculto({ tipo: 'token', testeGraus: 3 }, null), false, 'so vale para loot');

console.log('✅ tab-state: escala, unidades, larguraReal, cenário, paredes, vínculo de NPC, navegação, viagem, card, fog, alcance, cone, passo do fog, iniciativa, eco atrasado e cache de mapas OK');
