// Rodar: node shared/apoios-calc.test.mjs
import assert from 'node:assert/strict';
import { valorApoio, parseMetaIds, resolveMetaId, somarMetaTotais, somarApoiosDoJogador, chaveApoio } from './apoios-calc.js';

// --- valorApoio: regra de mesa da roleta ---
assert.equal(valorApoio({ montante: 5 }), 5);
assert.equal(valorApoio({}), 1, 'sem montante vale 1');
assert.equal(valorApoio({ montante: '7' }), 7, 'montante string');
assert.equal(valorApoio({ montante: 9, tipo: 'Roleta' }), 3, 'roleta múltipla de 3 conta 1 a cada 3');
assert.equal(valorApoio({ montante: 3, tipo: 'roleta' }), 1);
assert.equal(valorApoio({ montante: 4, tipo: 'roleta' }), 4, 'roleta não-múltipla conta cheia');
assert.equal(valorApoio({ montante: 9, tipo: 'Loja (Frag$)' }), 9, 'a regra é só da roleta');
assert.equal(valorApoio({ montante: 6, tipo: ' ROLETA ' }), 2, 'caixa/espaços não importam');

// --- somarApoiosDoJogador (o número grande do menu) ---
assert.equal(somarApoiosDoJogador([{ montante: 5 }, { montante: 9, tipo: 'roleta' }, {}]), 5 + 3 + 1);
assert.equal(somarApoiosDoJogador([]), 0);

const metas = [
    { id: 'm1', slug: 'classe', nome: 'Classe' },
    { id: 'm2', slug: 'raca',   nome: 'Raça' },
    { id: 'm3', slug: '',       nome: 'Lore' },   // meta SEM slug
];

// --- parseMetaIds ---
assert.deepEqual(parseMetaIds(''), []);
assert.deepEqual(parseMetaIds(null), []);
assert.deepEqual(parseMetaIds('m1'), ['m1']);
assert.deepEqual(parseMetaIds('m1, m2 ,'), ['m1', 'm2']);

// --- resolveMetaId: id, slug, nome e o legado "Raça"/"raca" ---
assert.equal(resolveMetaId('m1', metas), 'm1');
assert.equal(resolveMetaId('classe', metas), 'm1');
assert.equal(resolveMetaId('Classe', metas), 'm1');
assert.equal(resolveMetaId('Raça', metas), 'm2');
assert.equal(resolveMetaId('raca', metas), 'm2');
assert.equal(resolveMetaId('Lore', metas), 'm3');
// referência desconhecida é preservada, nunca descartada
assert.equal(resolveMetaId('meta-que-nao-existe', metas), 'meta-que-nao-existe');

// --- somarMetaTotais ---
const users = [
    { apoios: [
        { montante: 5, meta: 'm1' },
        { montante: 3, meta: 'm1,m2' },      // BUG ANTIGO: multi-meta não contava em nada
        { meta: 'm3' },                      // sem montante = 1
        { montante: 2, meta: 'Raça' },       // nome legado
        { montante: 4 },                     // sem meta: não conta em lugar nenhum
    ]},
    { apoios: [{ montante: '7', meta: 'classe' }] },  // montante string + slug
    { /* usuário sem apoios */ },
];

const t = somarMetaTotais(users, metas);
assert.equal(t.m1, 5 + 3 + 7, 'Classe: id + multi-meta + slug');
assert.equal(t.m2, 3 + 2, 'Raça: multi-meta + nome legado');
assert.equal(t.m3, 1, 'Lore (sem slug) tem que contar — antes ficava sempre em 0');
assert.equal(Object.values(t).reduce((s, v) => s + v, 0), 21);
assert.deepEqual(somarMetaTotais([], metas), {});

// Meta apagada do sistema: o apoio continua somando na própria referência,
// então o total não some do banco — só deixa de ter card para exibir.
assert.equal(somarMetaTotais([{ apoios: [{ montante: 9, meta: 'orfa' }] }], metas).orfa, 9);

// A regra da roleta vale também no progresso das metas (painel = menu)
assert.equal(somarMetaTotais([{ apoios: [{ montante: 9, tipo: 'roleta', meta: 'm1,m2' }] }], metas).m1, 3);
assert.equal(somarMetaTotais([{ apoios: [{ montante: 9, tipo: 'roleta', meta: 'm1,m2' }] }], metas).m2, 3);

// --- chaveApoio: identifica pelo conteúdo, não pela posição ---
const a = { nome: 'Apoio X', tipo: 'Loja (Frag$)', montante: 2, meta: 'm1', valor: '', dataInicio: '2026-01-01', recebido: true };
assert.equal(chaveApoio(a), chaveApoio({ ...a }), 'cópia idêntica tem a mesma chave');
assert.notEqual(chaveApoio(a), chaveApoio({ ...a, montante: 3 }));
assert.notEqual(chaveApoio(a), chaveApoio({ ...a, recebido: false }));
assert.equal(chaveApoio({ nome: 'A' }), chaveApoio({ nome: 'A', montante: 1, recebido: false }), 'defaults equivalem');

console.log('✅ apoios-calc: todos os casos passaram');
