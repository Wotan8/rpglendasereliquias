/**
 * 🛡️ POSTURA: a guarda cai quando quem está de guarda parte para cima.
 *
 * A Postura Defensiva dava Blindado 5 E Abalado 2 — quem se defendia ficava
 * ruim de tudo, o que não se sustenta na mesa. O Abalado saiu do cadastro e a
 * troca virou esta: a postura arrebenta na primeira Ação Padrão.
 *
 * O que se tranca aqui é a REGRA de quem cai: só a condição marcada com
 * `saiComAcaoPadrao`. Blindado vindo de armadura NÃO cai — a marca é da
 * aplicação (a postura), não da condição.
 *
 * Roda com: node tabuleiro/js/tab-postura.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function semPosturaDeQuemAgiu(pid) {');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0, 'semPosturaDeQuemAgiu não encontrada em tab-turno.js');

// A função fala com a cena, o chat e o toast: todos injetados.
const monta = (participantes) => {
    const logs = [];
    const fn = new Function('cena', 'logChat', 'toast', `${src.slice(ini, fim)}; return semPosturaDeQuemAgiu;`)(
        () => ({ participantes }), (t) => logs.push(t), () => {});
    return { fn, logs };
};

const postura = { nome: 'Blindado', icone: '🛡️', saiComAcaoPadrao: true };
const armadura = { nome: 'Blindado', icone: '🛡️' };            // mesma condição, outra origem
const veneno = { nome: 'Envenenado', icone: '🤢' };

// --- cai só a da postura ---
{
    const parts = [{ id: 'p1', name: 'Amamoia', condicoes: [postura, veneno] }, { id: 'p2', name: 'Umbe', condicoes: [postura] }];
    const { fn, logs } = monta(parts);
    const novo = fn('p1');
    assert.ok(novo, 'havia postura: devolve a lista nova');
    assert.deepEqual(novo[0].condicoes.map(c => c.nome), ['Envenenado'], 'a postura caiu, o veneno ficou');
    assert.deepEqual(novo[1].condicoes.map(c => c.nome), ['Blindado'], '🔒 a postura de OUTRO participante não cai');
    assert.equal(parts[0].condicoes.length, 2, '🔒 função pura: a lista original fica intacta');
    assert.match(logs[0], /largou a guarda/, 'a mesa fica sabendo pelo chat');
    assert.match(logs[0], /Blindado/);
}

// --- Blindado de armadura NÃO cai ao atacar ---
{
    const { fn } = monta([{ id: 'p1', name: 'Amamoia', condicoes: [armadura] }]);
    assert.equal(fn('p1'), null, '🔒 sem a marca da postura, nada cai — armadura não se perde atacando');
}

// --- nada a fazer: não escreve participantes à toa ---
{
    assert.equal(monta([{ id: 'p1', condicoes: [] }]).fn('p1'), null, 'sem condição nenhuma');
    assert.equal(monta([{ id: 'p1', condicoes: [veneno] }]).fn('p1'), null, 'só condição comum');
    assert.equal(monta([{ id: 'p1', condicoes: ['Caído'] }]).fn('p1'), null, 'condição em string legada não explode');
    assert.equal(monta([{ id: 'p1', condicoes: [postura] }]).fn('outro'), null, 'pid que não está na cena');
    assert.equal(monta([{ id: 'p1', condicoes: [postura] }]).fn(null), null, 'sem pid');
}

// --- várias posturas caem juntas ---
{
    const outra = { nome: 'Concentrado', icone: '🎯', saiComAcaoPadrao: true };
    const { fn, logs } = monta([{ id: 'p1', name: 'X', condicoes: [postura, outra, veneno] }]);
    assert.deepEqual(fn('p1')[0].condicoes.map(c => c.nome), ['Envenenado']);
    assert.match(logs[0], /Blindado.*Concentrado/, 'o chat lista as duas');
}

console.log('✅ postura OK — cai com a Ação Padrão, e só a que veio da postura');
