// Rodar: node shared/combate-cenas.test.mjs
// O que está trancado aqui: o ESPELHO. O painel de combate da ficha lê
// `participantes` direto do doc — se um write montado na mão deixar o espelho
// para trás, o jogador vê a iniciativa da cena errada (ou nenhuma).
import assert from 'node:assert/strict';
import {
    CENA_PADRAO, novaCena, cenasDoDoc, cenaAtiva, idCenaAtiva,
    docDeCenas, comCena, comCenaAtivaPatch, comCenaNova, semCena, comTrocaDeCena,
} from './combate-cenas.js';

const p = (n) => ({ id: n, name: n, initiative: 1 });

// --- doc ANTIGO (participantes soltos) vira uma cena, sem migração ---
const antigo = { participantes: [p('a'), p('b')], turnoAtual: 1, rodada: 3 };
assert.equal(cenasDoDoc(antigo).length, 1);
assert.equal(cenaAtiva(antigo).nome, CENA_PADRAO.nome);
assert.deepEqual(cenaAtiva(antigo).participantes.map(x => x.id), ['a', 'b']);
assert.equal(cenaAtiva(antigo).turnoAtual, 1, 'turno e rodada do doc antigo entram na cena');
assert.equal(cenaAtiva(antigo).rodada, 3);

// doc vazio/inexistente também dá uma cena utilizável
assert.equal(cenasDoDoc(null).length, 1);
assert.deepEqual(cenaAtiva(undefined).participantes, []);

// --- espelho: o que a ficha lê é SEMPRE a cena aberta ---
const duas = docDeCenas([
    { ...novaCena('c1', 'Emboscada'), participantes: [p('a')], turnoAtual: 2, rodada: 5 },
    { ...novaCena('c2', 'Taverna'), participantes: [p('z')] },
], 'c1');
assert.equal(duas.cenaAtiva, 'c1');
assert.deepEqual(duas.participantes.map(x => x.id), ['a'], '🔒 espelho = participantes da cena ativa');
assert.equal(duas.turnoAtual, 2);
assert.equal(duas.rodada, 5);

const trocado = comTrocaDeCena(duas, 'c2');
assert.equal(trocado.cenaAtiva, 'c2');
assert.deepEqual(trocado.participantes.map(x => x.id), ['z'], '🔒 trocar de cena move o espelho junto');
assert.equal(trocado.turnoAtual, 0, 'cada cena tem o próprio turno');
assert.equal(trocado.cenas.length, 2, 'trocar não perde a outra cena');

// --- id que não existe mais (cena apagada em outro aparelho) cai na primeira ---
assert.equal(idCenaAtiva({ cenas: duas.cenas, cenaAtiva: 'sumiu' }), 'c1');

// --- alterar a cena ativa não encosta nas outras ---
const mexido = comCenaAtivaPatch(duas, { participantes: [p('a'), p('novo')], turnoAtual: 0 });
assert.deepEqual(mexido.cenas.find(c => c.id === 'c1').participantes.map(x => x.id), ['a', 'novo']);
assert.deepEqual(mexido.cenas.find(c => c.id === 'c2').participantes.map(x => x.id), ['z'], '🔒 a outra cena fica intacta');
assert.deepEqual(mexido.participantes.map(x => x.id), ['a', 'novo'], 'espelho acompanha');

// alterar uma cena que NÃO está aberta não mexe no espelho
const noFundo = comCena(duas, 'c2', { participantes: [] });
assert.deepEqual(noFundo.participantes.map(x => x.id), ['a'], 'espelho continua na cena aberta');
assert.deepEqual(noFundo.cenas.find(c => c.id === 'c2').participantes, []);

// --- cena nova entra já aberta e vazia ---
const comNova = comCenaNova(duas, 'c3', 'Ponte');
assert.equal(comNova.cenaAtiva, 'c3');
assert.equal(comNova.cenas.length, 3);
assert.deepEqual(comNova.participantes, [], 'cena nova começa sem ninguém');
assert.equal(comNova.rodada, 1);
assert.equal(comCenaNova(duas, 'c4').cenas.find(c => c.id === 'c4').nome, 'Nova cena', 'sem nome tem padrão');

// --- apagar ---
const semC1 = semCena(duas, 'c1');
assert.equal(semC1.cenas.length, 1);
assert.equal(semC1.cenaAtiva, 'c2', 'apagar a aberta abre a que sobrou');
assert.deepEqual(semC1.participantes.map(x => x.id), ['z']);
const semC2 = semCena(duas, 'c2');
assert.equal(semC2.cenaAtiva, 'c1', 'apagar outra não muda a que está aberta');

// 🔒 apagar a ÚLTIMA cena não pode deixar o doc sem cena nenhuma
const semNada = semCena(docDeCenas([novaCena('unica', 'Só essa')], 'unica'), 'unica');
assert.equal(semNada.cenas.length, 1, 'sempre sobra uma cena para o combate existir');
assert.deepEqual(semNada.participantes, []);

console.log('✅ combate-cenas: doc antigo, espelho da cena ativa, troca, patch isolado, criar e apagar OK');
