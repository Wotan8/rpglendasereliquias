/**
 * ᛟ A runa como ação do turno, e a Lei do Relógio na janela de conflito.
 *
 * A aposta desta etapa é que a runa NÃO precisa de motor novo: ela vira uma
 * entrada com o mesmo formato das habilidades de classe e atravessa os trilhos
 * que já existem. Se alguém quebrar esse formato, a runa some do painel sem
 * erro nenhum — por isso a fiação é testada aqui, elo a elo.
 *
 * E a Lei do Relógio é o único ponto do sistema onde um ataque não rola dado:
 * sem Defesa declarada a runa entrega. Se a fase voltar a nascer em 'acerto',
 * a janela vai pedir um d10 que a Runomancia não tem.
 *
 * Roda com: node tabuleiro/js/tab-runa-turno.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { miraDaRuna, gastarUso } from '../../shared/runa-em-jogo.js';

const turno = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const confl = readFileSync(new URL('./tab-conflito.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ===== elo 1: a runa entra na MESMA lista das habilidades ===== */
assert.match(turno, /async function runasDe\(p\)/, 'a leitura das runas do participante');
assert.match(turno, /lista\.push\(\.\.\.await runasDe\(p\)\)/,
    '🔒 as runas têm de entrar na lista de skills — é o que dispensa motor novo');
assert.match(turno, /if \(b\.ativacao\?\.modo === 'automatica'\) continue/,
    'runa de Gatilho/Sensor dispara sozinha: não é ação de quem carrega');
assert.match(turno, /acao: 'padrao'/, 'Parte XIV: qualquer um ativa com 1 Ação Padrão');

/* ===== elo 2: peça gasta não aparece ===== */
assert.match(turno, /Number\(restam\) <= 0\) continue/, 'runa sem uso não é opção no painel');

/* ===== elo 3: o marcador viaja até o conflito ===== */
assert.match(turno, /cfg\.meta\.runaItemId = s\._runa\.itemId/);
assert.match(turno, /cfg\.meta\.semRolagem = true/);
assert.match(turno, /semRolagem: !!meta\.semRolagem, runaItemId: meta\.runaItemId \|\| null/,
    'a aplicação da mira repassa os dois para a janela');

/* ===== elo 4: o uso é gasto ao confirmar ===== */
assert.match(turno, /if \(meta\.runaItemId\) await gastarUsoDaRuna\(meta\.runaItemId\)/);
assert.match(turno, /async function gastarUsoDaRuna\(itemId\)/);
assert.match(turno, /await _del\(_doc\(_db, 'items', itemId\)\)/,
    '🔒 zerou os usos, a INSTÂNCIA some — o modelo fica no catálogo');

/* ===== elo 5: A LEI DO RELÓGIO ===== */
assert.match(confl, /fase: acao\.semRolagem \? 'defesa' : 'acerto'/,
    '🔒 a runa nasce na fase de DEFESA: não existe rolagem de acerto para ela');
assert.match(confl, /rolagem: acao\.semRolagem/, 'e já nasce com os Graus resolvidos');
assert.match(confl, /graus: Number\(acao\.alvoAcerto\) \|\| 0/,
    'os Graus da runa SÃO o Alvo gravado nela');
assert.match(confl, /r\?\.semRolagem \?/, 'o cabeçalho não pode mostrar "d10 null"');

/* ===== a conversão pura: bloco → mira do Tabuleiro ===== */
const blocoProjetor = {
    nome: 'Lança de Lava', alvo: 11, dano: '2d6+2', canal: 'Dano Ígneo',
    mira: { tipo: 'alvos', alcanceM: 15, maxAlvos: 1 },
    condicoesAplicadas: [{ condicao: 'Queimadura', nivel: 2, chance: 40, portao: 'chance', rodadas: 5 }],
    usos: 3, permanente: false, ativacao: { modo: 'manual' },
};
const mp = miraDaRuna(blocoProjetor);
assert.equal(mp.tipo, 'alvos');
assert.equal(mp.alcanceM, 15);
assert.equal(mp.afeta, 'inimigos');
assert.equal(mp.semRolagem, true, '🔒 a mira carrega a Lei do Relógio');
assert.equal(mp.alvoFixo, 11);
assert.deepEqual(mp.condicoes, blocoProjetor.condicoesAplicadas, 'as condições atravessam inteiras');

const mCone = miraDaRuna({ ...blocoProjetor, mira: { tipo: 'geometria', forma: 'cone', alcanceM: 5, comprimentoM: 5, angGraus: 15 } });
assert.equal(mCone.origem, 'token', 'cone nasce no token de quem ativa');
assert.equal(mCone.angGraus, 15, 'a amplitude é a do Foco, não a do arco de golpe');
assert.equal(mCone.larguraM, 5 / 3, 'largura derivada do comprimento, como nas skills');

const mParede = miraDaRuna({ ...blocoProjetor, mira: { tipo: 'locais', alcanceM: 10, maxAlvos: 1 } });
assert.equal(mParede.afeta, 'todos', 'Manifestador constrói: não escolhe facção');

assert.equal(miraDaRuna({ nome: 'auxiliar' }), null, 'runa sem Emissor não vira ação de turno');

/* ===== o consumo ===== */
assert.deepEqual(gastarUso({ usosRestantes: 3 }), { permanente: false, acabou: false, restante: 2 });
assert.deepEqual(gastarUso({ usosRestantes: 1 }), { permanente: false, acabou: true, restante: 0 });
assert.deepEqual(gastarUso({ runa: { usos: 2 } }), { permanente: false, acabou: false, restante: 1 },
    'peça antiga sem usosRestantes cai no que o bloco declarou');
assert.equal(gastarUso({ runa: { permanente: true } }).permanente, true, 'tatuagem não conta usos');
assert.equal(gastarUso({ usosRestantes: 0 }).acabou, true, 'zerada continua zerada, nunca negativa');

/* ===== elo 6: o Manifestador CONSTRÓI ===== */
assert.match(turno, /cfg\.meta\.manifestacao = s\._runa\.bloco\.manifestacao/,
    'a escolha do projeto tem de viajar até a mira');
assert.match(turno, /if \(meta\.manifestacao\) await manifestarNoMapa/,
    '🔒 confirmar a mira tem de pôr a coisa no mapa — era aqui que a escolha morria');
assert.match(turno, /async function manifestarNoMapa/);

// parede bloqueia; plataforma não. É a única diferença mecânica entre as duas.
assert.match(turno, /if \(chave === 'parede'\) \{\s*await addObj\(\{[\s\S]{0,120}layerId: 'luz'/,
    "🔒 o bloqueio TEM de ir na camada 'luz': coletarParedes() filtra por layerId, e desenho "
    + 'em qualquer outra camada é pintura, não parede. Plataforma não ganha esse segundo objeto — '
    + 'é chão onde não havia, dá para enxergar por cima.');
assert.doesNotMatch(turno, /bloqueiaVisao|bloqueiaPassagem/,
    'essas flags não existem no motor: quem decide bloqueio é a CAMADA');
assert.match(turno, /tipo: 'desenho', forma: 'ret'/,
    'parede e plataforma viram desenho — é o que o motor de visão já lê como obstáculo');
assert.match(turno, /tipo: 'loot'/, 'objeto e forma orgânica viram loot, que o mapa já anuncia');
assert.match(turno, /aplicarCondicaoEmVarios\(alvos, 'Blindado'/,
    'escudo não vai ao chão: veste quem foi mirado');
assert.match(turno, /unidadesParaPx\(arestaM, ref\)/,
    '🔒 o tamanho sai da escala do MAPA, não de um número fixo — senão a parede erra em mapa de escala diferente');
assert.match(turno, /Math\.cbrt\(Number\(cfgM\.volumeM3\)/, 'a aresta é a raiz cúbica do volume do nível');
assert.match(turno, /if \(!locais\.length\)/, 'sem ponto no mapa não há o que construir');

console.log('✅ runa no turno OK — entra como habilidade, entrega sem dado, e gasta o uso');
