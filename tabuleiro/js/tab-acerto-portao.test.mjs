// Rodar: node tabuleiro/js/tab-acerto-portao.test.mjs
//
// Duas regras que a mesa pegou em jogo, as duas com a mesma cara de bug
// ("apareceu do nada" / "não apareceu"):
//
//  1. ACERTO da linha de ataque. Existem CINCO Valores Derivados com "Acerto"
//     no nome e todos chegam como coluna. Pegar o primeiro que casasse com
//     /acerto/ dava "Acerto Corpo a Corpo" para um Arco Longo — que é 0. E a
//     janela de conflito precisa do NOME da coluna, não só do número: dizer
//     "Acerto" para um arqueiro não corresponde a VD nenhum da ficha dele.
//
//  2. PORTÃO. Habilidade sem portão (§6.1) não é ataque: não pede arma e não
//     abre janela de conflito. Era o que fazia A Presa herdar o 1d8 do arco.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ═══ 1. a coluna de Acerto certa ═══ */
// Extrai `colunaDeAcerto` do próprio arquivo, para o teste quebrar se alguém
// mexer na função.
const src = readFileSync(new URL('./tab-ficha-win.js', import.meta.url), 'utf8');
const ini = src.indexOf('function colunaDeAcerto(l) {');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0, 'colunaDeAcerto não encontrada em tab-ficha-win.js');
const colunaDeAcerto = new Function(`${src.slice(ini, fim)}; return colunaDeAcerto;`)();
const valor = l => colunaDeAcerto(l)?.total ?? null;
const nome = l => colunaDeAcerto(l)?.nome || '';

// A ordem aqui é a que o motor entrega: o genérico e o corpo a corpo vêm ANTES
// do de distância. É exatamente essa ordem que quebrava o arco.
const COLS = [
    { nome: 'Acerto', total: 1, icone: '🎯' },
    { nome: 'Acerto Corpo a Corpo', total: 0, icone: '🗡️' },
    { nome: 'Acerto Mágico', total: 9, icone: '✨' },
    { nome: 'Acerto Desarmado', total: 2, icone: '👊' },
    { nome: 'Acerto à Distância', total: 7, icone: '🏹' },
];

assert.equal(valor({ colunas: COLS, distancia: true }), 7,
    'arco usa Acerto à Distância, não o Corpo a Corpo que vem antes na lista');
assert.equal(valor({ colunas: COLS, desarmado: true }), 2, 'soco usa Acerto Desarmado');
assert.equal(valor({ colunas: COLS }), 0, 'espada usa Acerto Corpo a Corpo');

// O NOME viaja junto: é ele que a janela de conflito mostra.
assert.equal(nome({ colunas: COLS, distancia: true }), 'Acerto à Distância');
assert.equal(nome({ colunas: COLS, desarmado: true }), 'Acerto Desarmado');
assert.equal(nome({ colunas: COLS }), 'Acerto Corpo a Corpo');
assert.equal(colunaDeAcerto({ colunas: COLS, distancia: true }).icone, '🏹');

// Sem a coluna específica, cai no genérico — e só nele (não em "Mágico").
const SO_GENERICO = [{ nome: 'Acerto', total: 4 }, { nome: 'Acerto Mágico', total: 9 }];
assert.equal(valor({ colunas: SO_GENERICO, distancia: true }), 4);
assert.equal(valor({ colunas: [{ nome: 'Acerto Mágico', total: 9 }], distancia: true }), null,
    'sem o específico e sem o genérico, não inventa: null');
assert.equal(nome({ colunas: [] }), '', 'sem coluna não inventa nome');
assert.equal(valor({ colunas: [] }), null);
assert.equal(valor({}), null);

/* ═══ 1b. a Marca de Caça tem que entrar no Alvo QUE APARECE ═══ */
// O campo "Alvo" da janela de conflito nasce PREENCHIDO, e a rolagem lê o que
// está nele. Somar a marca só na hora de rolar fazia o valor digitado (o
// próprio preenchimento) vencer sempre: o mestre via 9, rolava contra 9, e a
// marca não valia nada. Por isso a soma mora no `alvoComMarca`, que alimenta
// os DOIS — o campo e a rolagem.
const srcC = readFileSync(new URL('./tab-conflito.js', import.meta.url), 'utf8');
const iniC = srcC.indexOf('function alvoComMarca(c) {');
const fimC = srcC.indexOf('\n}\n', iniC) + 3;
assert.ok(iniC > 0, 'alvoComMarca não encontrada em tab-conflito.js');
const alvoComMarca = new Function(`${srcC.slice(iniC, fimC)}; return alvoComMarca;`)();

assert.equal(alvoComMarca({ acao: { alvoAcerto: 9 }, marca: { acerto: 3 } }), 12,
    'Acerto 9 + Marca 3 = 12, e é ISSO que o campo mostra e a rolagem usa');
assert.equal(alvoComMarca({ acao: { alvoAcerto: 9 }, marca: { acerto: 0 } }), 9, 'sem marca, o Alvo é o da arma');
assert.equal(alvoComMarca({ acao: { alvoAcerto: 9 } }), 9, 'conflito sem marca nenhuma');
assert.equal(alvoComMarca({ acao: { alvoAcerto: 0 }, marca: { acerto: 3 } }), 3, 'Acerto 0 continua somando');
assert.equal(alvoComMarca({ acao: { alvoAcerto: null }, marca: { acerto: 3 } }), null,
    'sem Acerto na ficha não inventa número: o mestre digita');
assert.equal(alvoComMarca({}), null);
assert.equal(alvoComMarca(null), null);

/* ═══ 2. o portão decide se há rolagem ═══ */
// Mesma expressão do tab-turno, nos casos que importam.
const semRolagem = (dano, portao) => !dano && (!portao || portao === 'nenhum');

assert.equal(semRolagem('', 'nenhum'), true, 'A Presa: marca e pronto');
assert.equal(semRolagem('', null), true, 'buff sem portão nem dano');
assert.equal(semRolagem('', 'resistencia'), false, 'o portão é contestado: abre conflito');
assert.equal(semRolagem('', 'chance'), false);
assert.equal(semRolagem('1d8', 'nenhum'), false,
    'com dano SEMPRE há Acerto a rolar — foi o furo de precedência da 1ª escrita');
assert.equal(semRolagem('1d8', null), false);

// E o picker de arma segue a MESMA regra: portão 'nenhum' não pergunta com o
// que bate, senão a ação herda o dado de dano da arma escolhida.
const pedeArma = portao => portao !== 'nenhum';
assert.equal(pedeArma('nenhum'), false, 'A Presa não pede arma');
assert.equal(pedeArma(null), true, 'ataque comum com arma continua perguntando');
assert.equal(pedeArma('chance'), true);

console.log('✅ acerto-e-portão: coluna e NOME certos por tipo de linha, e portão decidindo rolagem e picker de arma OK');
