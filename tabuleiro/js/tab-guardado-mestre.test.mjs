/**
 * 🛡️ O MESTRE tem de ver "⚡ agir agora" de quem guardou o turno.
 *
 * O furo: a tira de turnos guardados só era desenhada no ramo "não é a minha
 * vez". O mestre no modo secreto controla TODO MUNDO, então esse ramo nunca
 * roda para ele — e o NPC que guardava o turno ficava sem botão nenhum. Não
 * havia como o mestre mandar o guardado interromper.
 *
 * A tira agora aparece também embaixo do painel normal, e esta é a decisão de
 * quem entra nela.
 *
 * Roda com: node tabuleiro/js/tab-guardado-mestre.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guardadoValido } from '../../shared/combate-cenas.js';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function guardadosQuePossoAgir(');
assert.ok(ini > 0, 'guardadosQuePossoAgir não encontrada');

const sb = { T: {}, guardadoValido, participanteDaVez: (c) => (c.participantes || [])[c.turnoAtual || 0] || null };
vm.createContext(sb);
// controlaVez é a regra de quem joga por quem: mestre secreto joga por todos,
// jogador só pelo personagem dele.
vm.runInContext(`
    function controlaVez(p) {
        if (!p) return false;
        if (T.isMaster && T.mode === 'secret') return true;
        return p.donoUid && p.donoUid === T.uid;
    }
`, sb);
vm.runInContext(src.slice(ini, src.indexOf('\n}\n', ini) + 3), sb);

const CENA = {
    iniciado: true, rodada: 3, turnoAtual: 0, retomar: null,
    participantes: [
        { id: 'p1', name: 'Vireu',  donoUid: 'u-jog' },                            // é a vez dela
        { id: 'p2', name: 'Vespa',  donoUid: 'u-jog', guardadoNaRodada: 3 },       // jogador guardou
        { id: 'p3', name: 'Umbe',   npcId: 'n1',      guardadoNaRodada: 3 },       // NPC guardou
        { id: 'p4', name: 'Corvo',  npcId: 'n2',      guardadoNaRodada: 1 },       // guardou em OUTRA rodada
        { id: 'p5', name: 'Larva',  npcId: 'n3' },                                  // não guardou
    ],
};
const nomes = (c, T) => { sb.T = T; sb.c = c; vm.runInContext('x = JSON.stringify(guardadosQuePossoAgir(c).map(g => g.name))', sb); return JSON.parse(sb.x); };

const MESTRE  = { isMaster: true,  mode: 'secret', uid: 'u-mestre' };
const PUBLICO = { isMaster: true,  mode: 'public', uid: 'u-mestre' };
const JOGADOR = { isMaster: false, mode: 'public', uid: 'u-jog' };
const OUTRO   = { isMaster: false, mode: 'public', uid: 'u-zzz' };

/* ===== o caso do relato ===== */
assert.deepEqual(nomes(CENA, MESTRE), ['Vespa', 'Umbe'],
    '🔒 o mestre vê TODOS os guardados válidos — personagem e NPC');

/* ===== o jogador continua vendo só o dele ===== */
assert.deepEqual(nomes(CENA, JOGADOR), ['Vespa'], 'jogador não manda o NPC agir');
assert.deepEqual(nomes(CENA, OUTRO), [], 'quem não controla ninguém não vê botão');

/* ===== rodada velha não vale: guardado expira no fim da rodada ===== */
assert.ok(!nomes(CENA, MESTRE).includes('Corvo'), 'guardado da rodada 1 não vale na rodada 3');
assert.ok(!nomes(CENA, MESTRE).includes('Larva'), 'quem não guardou não aparece');

/* ===== quem está na vez não "age agora": já está agindo ===== */
const vezDoGuardado = { ...CENA, turnoAtual: 1 };   // agora é a vez da Vespa
assert.deepEqual(nomes(vezDoGuardado, MESTRE), ['Umbe'], 'o dono da vez sai da lista');

/* ===== não se encadeia interrupção ===== */
assert.deepEqual(nomes({ ...CENA, retomar: { turnoAtual: 0 } }, MESTRE), [],
    'com uma interrupção em curso, ninguém interrompe por cima');

/* ===== combate não iniciado não tem turno a guardar ===== */
assert.deepEqual(nomes({ ...CENA, iniciado: false }, MESTRE), []);

/* ===== o mestre espiando o modo público não age por ninguém ===== */
assert.deepEqual(nomes(CENA, PUBLICO), [], 'no modo público o mestre está de fora');

/* ===== a tira é desenhada nos DOIS lugares (era só num) ===== */
assert.equal((src.match(/htmlGuardados\(/g) || []).length, 3,
    'htmlGuardados: a declaração + o ramo "não é minha vez" + o painel normal');
assert.match(src, /\$\{body\}\$\{htmlGuardados\(guardadosQuePossoAgir\(c\)\)\}/,
    '🔒 a tira tem de sair TAMBÉM embaixo do painel normal — é o que o mestre enxerga');

console.log('✅ turno guardado OK — o mestre vê e manda agir, o jogador só o dele');
