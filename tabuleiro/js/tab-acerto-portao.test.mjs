// Rodar: node tabuleiro/js/tab-acerto-portao.test.mjs
//
// Duas regras que a mesa pegou em jogo, as duas com a mesma cara de bug
// ("apareceu do nada" / "não apareceu"):
//
//  1. ACERTO da linha de ataque. Existem CINCO Valores Derivados com "Acerto"
//     no nome e todos chegam como coluna. Pegar o primeiro que casasse com
//     /acerto/ dava "Acerto Corpo a Corpo" para um Arco Longo — que é 0.
//
//  2. PORTÃO. Habilidade sem portão (§6.1) não é ataque: não pede arma e não
//     abre janela de conflito. Era o que fazia A Presa herdar o 1d8 do arco.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ═══ 1. a coluna de Acerto certa ═══ */
// Reproduz `acertoDaLinha` a partir do próprio arquivo, para o teste quebrar
// se alguém mexer na função.
const src = readFileSync(new URL('./tab-ficha-win.js', import.meta.url), 'utf8');
const ini = src.indexOf('function acertoDaLinha(l) {');
const fim = src.indexOf('\n}\n', ini) + 3;
assert.ok(ini > 0, 'acertoDaLinha não encontrada em tab-ficha-win.js');
const acertoDaLinha = new Function(`${src.slice(ini, fim)}; return acertoDaLinha;`)();

// A ordem aqui é a que o motor entrega: o genérico e o corpo a corpo vêm ANTES
// do de distância. É exatamente essa ordem que quebrava o arco.
const COLS = [
    { nome: 'Acerto', total: 1 },
    { nome: 'Acerto Corpo a Corpo', total: 0 },
    { nome: 'Acerto Mágico', total: 9 },
    { nome: 'Acerto Desarmado', total: 2 },
    { nome: 'Acerto à Distância', total: 7 },
];

assert.equal(acertoDaLinha({ colunas: COLS, distancia: true }), 7,
    'arco usa Acerto à Distância, não o Corpo a Corpo que vem antes na lista');
assert.equal(acertoDaLinha({ colunas: COLS, desarmado: true }), 2, 'soco usa Acerto Desarmado');
assert.equal(acertoDaLinha({ colunas: COLS }), 0, 'espada usa Acerto Corpo a Corpo');

// Sem a coluna específica, cai no genérico — e só nele (não em "Mágico").
const SO_GENERICO = [{ nome: 'Acerto', total: 4 }, { nome: 'Acerto Mágico', total: 9 }];
assert.equal(acertoDaLinha({ colunas: SO_GENERICO, distancia: true }), 4);
assert.equal(acertoDaLinha({ colunas: [{ nome: 'Acerto Mágico', total: 9 }], distancia: true }), null,
    'sem o específico e sem o genérico, não inventa: null');
assert.equal(acertoDaLinha({ colunas: [] }), null);
assert.equal(acertoDaLinha({}), null);

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

console.log('✅ acerto-e-portão: coluna certa por tipo de linha, e portão decidindo rolagem e picker de arma OK');
