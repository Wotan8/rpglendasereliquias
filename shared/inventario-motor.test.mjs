// Rodar: node shared/inventario-motor.test.mjs
// Cobre a metade PURA do motor de inventário (conta de pressão, pilha, HTML da
// lista). A metade que depende de DOM — arrasto, alvo sob o ponteiro, cliques —
// é coberta ao vivo por tabuleiro/__check-ficha-win.html (T11–T17d).
import assert from 'node:assert/strict';
import {
    qtdDe, ehContainer, itensIdenticos, dividirPilha, pressaoItem, htmlInventario, esc,
} from './inventario-motor.js';

const ctx = (itens, extra = {}) => ({
    itens, abertos: new Set(), contAbertos: new Set(), sys: null, ...extra,
});

// ===== quantidade e contêiner =====
assert.equal(qtdDe({ quantidade: 7 }), 7);
assert.equal(qtdDe({}), 1, 'sem quantidade = pilha de 1');
assert.equal(qtdDe({ quantidade: 0 }), 1, 'zero nunca some da lista');
assert.equal(ehContainer({ tipo: 'Container' }), true);
assert.equal(ehContainer({ ehContainer: true }), true);
assert.equal(ehContainer({ tipo: 'Arma' }), false);

// ===== pilhas idênticas =====
const poc = { id: 'a', nome: 'Poção Vermelha', tipo: 'Consumível' };
assert.equal(itensIdenticos(poc, { id: 'b', nome: ' poção vermelha ', tipo: 'Consumível' }), true,
    'nome sem caixa nem espaço sobrando');
assert.equal(itensIdenticos(poc, { id: 'b', nome: 'Poção Vermelha', tipo: 'Relíquia' }), false, 'tipo diferente');
assert.equal(itensIdenticos(poc, { id: 'a', nome: 'Poção Vermelha', tipo: 'Consumível' }), false, 'ele mesmo');
assert.equal(itensIdenticos({ ...poc, modeloId: 'm1' }, { id: 'b', nome: 'Poção Vermelha', tipo: 'Consumível', modeloId: 'm2' }),
    false, 'modelos de catálogo diferentes não empilham');
assert.equal(itensIdenticos({ id: 'c', nome: 'Mochila', tipo: 'Container' }, { id: 'd', nome: 'Mochila', tipo: 'Container' }),
    false, 'contêiner nunca funde — o conteúdo se perderia');

// ===== divisão de pilha =====
assert.deepEqual(dividirPilha({ quantidade: 12 }, 5), { move: false, qtd: 5, restante: 7 });
assert.deepEqual(dividirPilha({ quantidade: 12 }, 12), { move: true, qtd: 12 });
assert.deepEqual(dividirPilha({ quantidade: 12 }, 99), { move: true, qtd: 12 }, 'pedir mais do que tem move tudo');
assert.deepEqual(dividirPilha({ quantidade: 1 }, 1), { move: true, qtd: 1 });

// ===== pressão =====
const mochila = { id: 'c1', nome: 'Mochila', tipo: 'Container', peso: 1, multiplicadorPressao: 0.5 };
const dentro = [{ id: 'f1', nome: 'Flechas', peso: 0.05, quantidade: 12, parentItemId: 'c1' }];
assert.equal(pressaoItem({ peso: 0.5, quantidade: 4 }, []), 2, 'pilha multiplica o peso');
assert.equal(pressaoItem(mochila, [mochila, ...dentro]), 1 + (0.6 * 0.5),
    'contêiner: base + conteúdo pelo multiplicador');
assert.equal(pressaoItem({ peso: 9, pressaoOverride: 0, quantidade: 3 }, []), 0,
    'override manda em cima do peso (item que não pesa nas costas)');

// ===== HTML da lista =====
const itens = [
    { id: 'i1', nome: 'Punhal', tipo: 'Arma', peso: 1, equipado: true, estadoEquip: 'empunhado', slotAnatomico: 'bp-mao_1' },
    { id: 'i2', nome: 'Poção', tipo: 'Consumível', peso: 0.5, quantidade: 4 },
    mochila, ...dentro,
];
const base = ctx(itens, { rotuloSlot: (k) => (k === 'bp-mao_1' ? 'Mão 1' : k) });
const html = htmlInventario(base);

assert.match(html, /data-drop="root"/, 'raiz é alvo de soltar');
assert.match(html, /data-sec="eq"[\s\S]*data-sec="soltos"/, 'Equipados vem antes de Soltos');
assert.match(html, /🎽 Equipados <span class="lr-inv-count">1<\/span>/);
assert.match(html, /📋 Soltos <span class="lr-inv-count">2<\/span>/, 'o que está DENTRO do contêiner não conta como solto');
assert.match(html, /data-grab="i1"/, 'toda linha tem alça de arrasto');
assert.match(html, /Empunhado · Mão 1/, 'linha equipada mostra estado e slot legível');
assert.equal(html.includes('data-toggleitem="f1"'), false, 'contêiner fechado esconde o conteúdo');
assert.match(html, /data-conttoggle="c1"/, 'contêiner tem chevron');
assert.equal((html.match(/data-qdelta/g) || []).length, 2, 'só a Poção tem stepper — Arma e contêiner não');
assert.match(html, /Pressão \(equipados\): <b>1<\/b>/, 'pressão soma só os equipados');

// contêiner aberto revela os filhos, indentados
const aberto = htmlInventario(ctx(itens, { contAbertos: new Set(['c1']), abertos: new Set() }));
assert.match(aberto, /class="lr-inv-item[^"]*dentro" data-toggleitem="f1"/, 'filho sai marcado como dentro');
const vazio = htmlInventario(ctx([mochila], { contAbertos: new Set(['c1']), abertos: new Set() }));
assert.match(vazio, /vazio — arraste um item para cá/);

// detalhe expandido
const det = htmlInventario(ctx(itens, { abertos: new Set(['i1']), contAbertos: new Set(), rotuloSlot: () => 'Mão 1' }));
assert.match(det, /lr-inv-item-det/);
assert.match(det, /<b>🎽 Equipado:<\/b> Empunhado · Mão 1/);

// lista vazia não quebra
assert.match(htmlInventario(ctx([])), /Nada aqui/);

// escape: nome de item é dado do usuário, nunca HTML
assert.match(htmlInventario(ctx([{ id: 'x', nome: '<img onerror=1>' }])), /&lt;img onerror=1&gt;/);
assert.equal(esc(null), '');

console.log('✅ motor de inventário: pressão, pilha, contêiner e HTML da lista OK');
