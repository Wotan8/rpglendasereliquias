// Rodar: node functions/push-aviso.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { avisoNovo, tokensMortos } = require('./push-aviso.js');

const n = (id, extra = {}) => ({ id, message: 'Compra aprovada', type: 'master_message', ...extra });

// ===== chegou coisa nova =====
assert.deepEqual(
    avisoNovo(null, { notifications: [n('a')] }),
    { texto: 'Compra aprovada', tag: 'master_message' },
    'doc que nasce com aviso avisa');

assert.deepEqual(
    avisoNovo({ notifications: [n('a')] }, { notifications: [n('b'), n('a')] }),
    { texto: 'Compra aprovada', tag: 'master_message' },
    'topo novo empurra o antigo e avisa');

// ===== nao chegou nada =====
assert.equal(avisoNovo({ notifications: [n('a')] }, { notifications: [n('a')] }), null,
    'mesmo topo: a escrita foi de outra coisa (saldo, apoio, o proprio token)');
assert.equal(avisoNovo({}, {}), null, 'sem notificacao nenhuma');
assert.equal(avisoNovo(null, { notifications: [{ message: 'sem id' }] }), null,
    'sem id nao da para saber se e nova');
assert.equal(avisoNovo(null, { notifications: [n('a', { isNew: false })] }), null,
    'aviso ja lido nao acorda ninguem');
assert.equal(avisoNovo(null, { notifications: [n('a', { message: '   ' })] }), null,
    'notificacao sem texto nao vira push vazio');

// A pilha estoura em 100 e a ultima cai. Comparar o array inteiro acharia
// que "mudou" e avisaria de novo pelo MESMO aviso do topo.
const cheia = Array.from({ length: 100 }, (_, i) => n('id' + i));
assert.equal(avisoNovo({ notifications: cheia }, { notifications: cheia.slice(0, 99) }), null,
    'perder o fim da pilha nao e aviso novo');

// ===== corte do texto =====
const longo = avisoNovo(null, { notifications: [n('a', { message: 'x'.repeat(400) })] });
assert.equal(longo.texto.length, 240, 'mensagem longa e cortada, nao rejeitada');

// ===== poda de token =====
const tk = ['t1', 't2', 't3', 't4'];
const respostas = [
    { success: true },
    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
    { success: false, error: { code: 'messaging/server-unavailable' } },
    { success: false, error: { code: 'messaging/invalid-registration-token' } },
];
assert.deepEqual(tokensMortos(tk, respostas), ['t2', 't4'],
    'so sai o que o FCM declarou invalido');
assert.deepEqual(tokensMortos(tk, [{ success: false, error: { code: 'messaging/internal-error' } }]), [],
    'falha de rede nao tira o aparelho de ninguem');
assert.deepEqual(tokensMortos(tk, []), [], 'sem resposta, sem poda');
assert.deepEqual(tokensMortos(tk, undefined), [], 'resposta ausente nao estoura');
assert.deepEqual(tokensMortos([], respostas), [], 'indice sem token correspondente e ignorado');

console.log('push-aviso: ok');
