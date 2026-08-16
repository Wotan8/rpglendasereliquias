// Rodar: node shared/moral.test.mjs
//
// A moral é memória de mesa, e memória de mesa que mente é pior que nenhuma.
// O que este teste tranca: o valor não escapa da escala, o histórico não
// registra briga que não houve, e o degrau guarda o que REALMENTE andou — não
// o que o Mestre pediu.
import assert from 'node:assert/strict';
import { aplicarMoral, moralCom, faixaDe, limitar, linhasDeMoral,
         MORAL_MIN, MORAL_MAX, HISTORICO_MAX, FAIXAS } from './moral.js';

/* ===== a escala ===== */
assert.equal(faixaDe(0).nome, 'Neutro', 'nunca se falaram = Neutro');
assert.equal(faixaDe(10).nome, 'Leal');
assert.equal(faixaDe(-10).nome, 'Inimigo');
assert.equal(faixaDe(5).nome, 'Amistoso');
assert.equal(faixaDe(-1).nome, 'Desconfiado');
assert.equal(faixaDe(1).nome, 'Simpático', '🔒 +1 já é diferente de 0: o primeiro favor conta');
assert.equal(faixaDe(999).nome, 'Leal', 'fora da escala não quebra');
assert.equal(faixaDe(undefined).nome, 'Neutro');
// as faixas cobrem a escala inteira, sem buraco
for (let v = MORAL_MIN; v <= MORAL_MAX; v++) assert.ok(faixaDe(v), `faixa para ${v}`);
assert.equal(FAIXAS[FAIXAS.length - 1].min, MORAL_MIN, 'a última faixa começa no piso');

assert.equal(limitar(99), MORAL_MAX);
assert.equal(limitar(-99), MORAL_MIN);
assert.equal(limitar(2.6), 3, 'meio ponto de moral não existe');
assert.equal(limitar('abc'), 0);

/* ===== o degrau ===== */
const NPC = { nome: 'Taverneiro' };
let r = aplicarMoral(NPC, 'c1', 2, 'Pagou a conta do salão');
assert.equal(r.mudou, true);
assert.equal(r.depois, 2);
assert.equal(r.entrada.motivo, 'Pagou a conta do salão');
assert.deepEqual([r.entrada.de, r.entrada.para], [0, 2]);
assert.equal(r.moral.c1.valor, 2);
assert.equal(r.moral.c1.historico.length, 1);

// motivo é OPCIONAL: no meio da cena, clicar −1 e seguir tem de funcionar
const semMotivo = aplicarMoral({ moral: r.moral }, 'c1', -1);
assert.equal(semMotivo.mudou, true);
assert.equal(semMotivo.entrada.motivo, '', 'sem motivo continua sendo um registro válido');
assert.equal(semMotivo.depois, 1);

/* ===== 🔒 o histórico não registra briga que não houve ===== */
const noTeto = aplicarMoral({ moral: { c1: { valor: MORAL_MAX } } }, 'c1', 3, 'mais um favor');
assert.equal(noTeto.mudou, false, 'já estava no máximo: não mexeu');
assert.equal(noTeto.entrada, null, '🔒 e não entra no histórico — senão o Mestre leria um favor que não contou');
assert.equal(noTeto.depois, MORAL_MAX);
const noPiso = aplicarMoral({ moral: { c1: { valor: MORAL_MIN } } }, 'c1', -5, 'cuspiu nele');
assert.equal(noPiso.mudou, false);
assert.equal(aplicarMoral({ moral: { c1: { valor: 3 } } }, 'c1', 0).mudou, false, 'degrau zero não é degrau');

/* ===== o registro guarda o que ANDOU, não o que se pediu ===== */
const quaseTeto = aplicarMoral({ moral: { c1: { valor: 9 } } }, 'c1', 5, 'salvou a filha dele');
assert.equal(quaseTeto.depois, MORAL_MAX);
assert.equal(quaseTeto.entrada.delta, 1,
    '🔒 pediu +5 mas só cabia +1 — o histórico tem de contar a verdade');

/* ===== o histórico é memória, não log ===== */
let acc = {};
for (let i = 0; i < HISTORICO_MAX + 12; i++) {
    // alterna para nunca bater no teto e sempre registrar
    acc = aplicarMoral({ moral: acc }, 'c1', i % 2 ? 1 : -1, `evento ${i}`).moral;
}
assert.equal(acc.c1.historico.length, HISTORICO_MAX, 'o documento não cresce para sempre');
assert.equal(acc.c1.historico[0].motivo, `evento ${HISTORICO_MAX + 11}`,
    '🔒 mais recente PRIMEIRO: é o que o Mestre quer ver ao abrir');

/* ===== sem personagem não há moral ===== */
assert.equal(aplicarMoral(NPC, null, 3, 'x').mudou, false);
assert.equal(moralCom(NPC, null), 0);
assert.equal(moralCom({}, 'c9'), 0, 'NPC que nunca viu ninguém é Neutro com todos');

/* ===== as linhas da tela ===== */
const npc2 = { moral: {
    c1: { valor: 5, historico: [{ motivo: 'pagou a conta' }] },
    c2: { valor: -6, historico: [{ motivo: 'quebrou a janela' }] },
} };
const linhas = linhasDeMoral(npc2, [{ id: 'c1', nome: 'Vireu' }, { id: 'c2', nome: 'Vespa' }, { id: 'c3', nome: 'Umbe' }]);
assert.equal(linhas.length, 3, 'personagem sem histórico aparece igual, como Neutro');
assert.equal(linhas[0].nome, 'Vespa', '🔒 do pior para o melhor: quem odeia o grupo vem primeiro');
assert.equal(linhas[0].faixa.nome, 'Hostil');
assert.equal(linhas[0].ultimoMotivo, 'quebrou a janela');
assert.equal(linhas[2].nome, 'Vireu');
assert.equal(linhas[1].valor, 0, 'Umbe nunca cruzou com ele: Neutro');
assert.deepEqual(linhasDeMoral(npc2, []), []);

/* ===== não muta o NPC original ===== */
const original = { moral: { c1: { valor: 1, historico: [] } } };
const copia = JSON.parse(JSON.stringify(original));
aplicarMoral(original, 'c1', 4, 'algo');
assert.deepEqual(original, copia, '🔒 aplicar devolve o bloco novo, não mexe no que veio');

console.log('✅ moral OK — a escala segura, o histórico não mente, e quem odeia aparece primeiro');
