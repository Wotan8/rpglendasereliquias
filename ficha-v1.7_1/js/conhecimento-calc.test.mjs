// Rodar: node ficha-v1.7_1/js/conhecimento-calc.test.mjs
import assert from 'node:assert/strict';
import { avaliarRequisito, avaliarRegra, statusDoCapitulo } from './conhecimento-calc.js';

const ficha = { 'FOR': 3, 'Perícia: Ocultismo': 1, 'Foco Arcano': 7 };
const leitor = {
    ficha: (ref) => ficha[ref] ?? 0,
    mecanica: (id) => ({ ok: id === 'mec_ok', label: id === 'mec_ok' ? 'FOR >= 2 ✅' : 'FOR >= 9 ❌' }),
    // `ok` só é verdadeiro com o item EQUIPADO — quem só carrega na mochila não passa.
    equipamento: (id) => ({ ok: id === 'eq_equipado', nome: id === 'eq_equipado' ? 'Tomo Rúnico' : 'Chave de Prata' }),
};

// --- requisito de ficha: atributo, perícia e valor derivado pelo mesmo caminho ---
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'FOR', op: '>=', valor: 3 }, leitor).ok, true);
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'FOR', op: '>=', valor: 4 }, leitor).ok, false);
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'Perícia: Ocultismo', op: '>', valor: 1 }, leitor).ok, false);
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'Foco Arcano', op: '>=', valor: 5 }, leitor).ok, true);
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'Não Existe', op: '>=', valor: 1 }, leitor).ok, false,
    'alvo desconhecido lê 0 — nunca libera por engano');
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'FOR', op: '<', valor: 5 }, leitor).ok, true);
assert.equal(avaliarRequisito({ tipo: 'ficha', ref: 'FOR', valor: 3 }, leitor).ok, true, 'sem op assume >=');
const detalhe = avaliarRequisito({ tipo: 'ficha', ref: 'FOR', op: '>=', valor: 5 }, leitor);
assert.equal(detalhe.atual, 3, 'o jogador precisa ver quanto tem');
assert.equal(detalhe.alvo, 5, 'e quanto falta');

// --- mecânica e equipamento ---
assert.equal(avaliarRequisito({ tipo: 'mecanica', mecanicaId: 'mec_ok' }, leitor).ok, true);
assert.equal(avaliarRequisito({ tipo: 'mecanica', mecanicaId: 'mec_nao' }, leitor).ok, false);
assert.equal(avaliarRequisito({ tipo: 'equipamento', equipamentoId: 'eq_equipado' }, leitor).ok, true);
assert.equal(avaliarRequisito({ tipo: 'equipamento', equipamentoId: 'eq_guardado' }, leitor).ok, false,
    'item só na mochila não desbloqueia');
assert.match(avaliarRequisito({ tipo: 'equipamento', equipamentoId: 'eq_guardado' }, leitor).label,
    /Chave de Prata equipado/, 'o jogador precisa entender que falta EQUIPAR');

// --- modo TODOS x QUALQUER ---
const r1 = { tipo: 'ficha', ref: 'FOR', op: '>=', valor: 3 };        // passa
const r2 = { tipo: 'ficha', ref: 'FOR', op: '>=', valor: 9 };        // falha
assert.equal(avaliarRegra({ modo: 'todos', requisitos: [r1, r2] }, leitor).liberado, false);
assert.equal(avaliarRegra({ modo: 'qualquer', requisitos: [r1, r2] }, leitor).liberado, true);
assert.equal(avaliarRegra({ modo: 'qualquer', requisitos: [r2, r2] }, leitor).liberado, false);
assert.equal(avaliarRegra({ modo: 'todos', requisitos: [r1, r1] }, leitor).liberado, true);
assert.equal(avaliarRegra({ requisitos: [] }, leitor).liberado, true, 'regra sem requisito libera');
assert.equal(avaliarRegra({}, leitor).modo, 'todos', 'modo ausente é TODOS (o mais restritivo)');
assert.equal(avaliarRegra({ modo: 'todos', requisitos: [r1, r2] }, leitor).resultados.length, 2,
    'o jogador vê a lista inteira, não só o primeiro que falhou');

// --- estado do capítulo: a regra vence, o flag Público decide o resto ---
assert.equal(statusDoCapitulo({ public: false }, { requisitos: [r1] }, leitor).estado, 'liberado');
assert.equal(statusDoCapitulo({ public: true }, { requisitos: [r2] }, leitor).estado, 'bloqueado',
    'capítulo público COM regra continua travado — a regra é a autoridade');
assert.equal(statusDoCapitulo({ public: true }, null, leitor).estado, 'liberado');
assert.equal(statusDoCapitulo({ public: false }, null, leitor).estado, 'oculto',
    'rascunho privado sem regra não vaza para o jogador');

console.log('✅ conhecimento-calc: todos os testes passaram.');
