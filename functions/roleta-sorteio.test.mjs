// Rodar: node functions/roleta-sorteio.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sortear, premiosValidos, randomFloat, girosDoItem, aplicarPremio } = require('./roleta-sorteio.js');

// ===== girosDoItem: o cadastro da Loja virando saldo =====
assert.equal(girosDoItem({ isRoleta: true, roletaGiros: 3 }, 2), 6, '3 giros x 2 unidades');
assert.equal(girosDoItem({ isRoleta: true, roletaGiros: 1 }), 1, 'quantidade ausente vale 1');
assert.equal(girosDoItem({ isRoleta: false, roletaGiros: 9 }, 5), 0, 'sem a flag nao credita nada');
assert.equal(girosDoItem({ isRoleta: true }, 3), 0, 'flag sem quantidade de giros nao credita');
assert.equal(girosDoItem({ isRoleta: true, roletaGiros: -2 }, 1), 0, 'giro negativo nao vira credito');
assert.equal(girosDoItem(null, 1), 0);

// ===== aplicarPremio: entrega =====
const premioItem = { nome: 'Informacao x1', descricao: 'pista', isVendaAtiva: false };

// item novo entra com a origem certa
const p1 = aplicarPremio({}, premioItem);
assert.equal(p1.inventario.length, 1);
assert.equal(p1.inventario[0].quantidade, 1);
assert.equal(p1.inventario[0].formaRecebimento, 'Prêmio da Roleta');
assert.match(p1.notifications[0].message, /A roleta parou em: Informacao x1/);

// repetido empilha em vez de duplicar a linha
const p2 = aplicarPremio({ inventario: [{ nome: premioItem.nome, quantidade: 4 }] }, premioItem);
assert.equal(p2.inventario.length, 1);
assert.equal(p2.inventario[0].quantidade, 5);

// premio NAO mexe em apoios nem em logsCompra: senao move a Meta da mesa toda
const antes = { apoios: [{ nome: 'x' }], logsCompra: [{ nome: 'y' }] };
const p3 = aplicarPremio(antes, premioItem);
assert.equal(p3.apoios, undefined, 'aplicarPremio nao devolve apoios');
assert.equal(p3.logsCompra, undefined, 'aplicarPremio nao devolve logsCompra');
assert.equal(antes.apoios.length, 1, 'e nao mexe no array original');
assert.equal(antes.logsCompra.length, 1);

// a Re-roleta devolve giro sem caso especial
assert.equal(aplicarPremio({}, { nome: 'Re-roleta 1x', isRoleta: true, roletaGiros: 1 }).girosGanhos, 1);
assert.equal(aplicarPremio({}, premioItem).girosGanhos, 0);

// notificacoes nao crescem sem limite
const cem = Array.from({ length: 100 }, (_, i) => ({ id: 'n' + i }));
assert.equal(aplicarPremio({ notifications: cem }, premioItem).notifications.length, 100);


const PREMIOS = [
    { nome: 'comum', chance: 5 },
    { nome: 'raro', chance: 1 },
    { nome: 'lendario', chance: 0.3 },
    { nome: 'desligado', chance: 0 },
];

// --- fatias: o de chance 0 nunca entra ---
assert.equal(premiosValidos(PREMIOS).length, 3);
assert.equal(premiosValidos([]).length, 0);
assert.equal(premiosValidos(null).length, 0);

// --- o indice devolvido e o da lista ORIGINAL, nao o da filtrada ---
// (senao a animacao para na fatia errada quando ha premio desligado no meio)
const comBuraco = [{ chance: 0 }, { nome: 'certo', chance: 10 }];
assert.equal(sortear(comBuraco, () => 0.5).indice, 1, 'indice tem de ser o da lista original');

// --- rng nas bordas nunca escapa da lista ---
assert.equal(sortear(PREMIOS, () => 0).indice, 0, 'alvo 0 cai no primeiro');
assert.equal(sortear(PREMIOS, () => 0.9999999).indice, 2, 'alvo no teto cai no ultimo valido');

// --- fronteira exata entre dois premios ---
const total = 5 + 1 + 0.3;
assert.equal(sortear(PREMIOS, () => 5 / total).indice, 1, 'exatamente na borda vai para o proximo');
assert.equal(sortear(PREMIOS, () => (5 - 1e-9) / total).indice, 0);

// --- roleta vazia falha alto, em vez de entregar premio errado ---
assert.throws(() => sortear([], () => 0.5), /nenhum prêmio/);
assert.throws(() => sortear([{ chance: 0 }], () => 0.5), /nenhum prêmio/);
assert.throws(() => sortear([{ chance: 'abc' }], () => 0.5), /nenhum prêmio/);

// --- distribuicao: 200k giros com o rng real, tolerancia de 5% relativa ---
const REAL = [
    { nome: 'A', chance: 5 },
    { nome: 'B', chance: 3 },
    { nome: 'C', chance: 1 },
    { nome: 'D', chance: 0.3 },
];
const somaReal = REAL.reduce((s, p) => s + p.chance, 0);
const N = 200000;
const contagem = new Array(REAL.length).fill(0);
for (let i = 0; i < N; i++) contagem[sortear(REAL).indice]++;

REAL.forEach((p, i) => {
    const esperado = p.chance / somaReal;
    const obtido = contagem[i] / N;
    const erroRelativo = Math.abs(obtido - esperado) / esperado;
    assert.ok(erroRelativo < 0.05,
        `${p.nome}: esperado ${(esperado * 100).toFixed(2)}%, obtido ${(obtido * 100).toFixed(2)}% (erro ${(erroRelativo * 100).toFixed(1)}%)`);
});

// --- o rng real fica dentro de [0,1) ---
for (let i = 0; i < 10000; i++) {
    const v = randomFloat();
    assert.ok(v >= 0 && v < 1, 'randomFloat fora de [0,1): ' + v);
}

console.log('✅ roleta-sorteio: todos os casos passaram (' + N.toLocaleString('pt-BR') + ' giros simulados)');
