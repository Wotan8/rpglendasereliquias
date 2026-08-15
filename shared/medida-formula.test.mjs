/**
 * Medida que pode ser fórmula (raio, alcance, comprimento, largura).
 *
 * O caso que motivou: ERGUER FANTOCHES tem "Raio: (Liderança + PRE) metros" —
 * uma medida que depende da ficha de quem conjura. O que se trava aqui:
 *   · número puro continua funcionando igual (é o caso de 99% dos cadastros);
 *   · fórmula resolve contra a ficha, com + − × ÷ e parênteses;
 *   · caractere fora da gramática recusa a medida INTEIRA em vez de virar um
 *     número torto — e nada de texto de banco entrando em eval solto.
 *
 * Roda com: node shared/medida-formula.test.mjs
 */
import assert from 'node:assert/strict';
import {
    ehNumero, ehFormula, componentesDaMedida, resolverMedida, conferirMedida, tokensDaMedida,
} from './medida-formula.js';

/** Ficha de mentira: só estes nomes existem. */
const ficha = { 'Liderança': 4, 'PRE': 3, 'Percepção': 2, 'Blindagem': 5 };
const valorDe = (n) => (n in ficha ? ficha[n] : null);

/* ===== número puro: o caminho de sempre ===== */
assert.equal(ehNumero('4'), true);
assert.equal(ehNumero('3.5'), true);
assert.equal(ehNumero('2,5'), true, 'vírgula é decimal na mesa brasileira');
assert.equal(ehNumero(4), true);
assert.equal(ehNumero(''), false);
assert.equal(ehFormula('4'), false);
assert.equal(resolverMedida('4', valorDe), 4);
assert.equal(resolverMedida('2,5', valorDe), 2.5);
assert.equal(resolverMedida(7, valorDe), 7);
assert.equal(resolverMedida('', valorDe), 0, 'vazio vale o padrão');
assert.equal(resolverMedida('', valorDe, { padrao: 60 }), 60);
assert.equal(resolverMedida(null, valorDe), 0);

/* ===== o caso do Adepto ===== */
assert.equal(ehFormula('(Liderança + PRE)'), true);
assert.deepEqual(componentesDaMedida('(Liderança + PRE)'), ['Liderança', 'PRE']);
assert.equal(resolverMedida('(Liderança + PRE)', valorDe), 7, '4 + 3');
assert.equal(resolverMedida('Liderança + PRE', valorDe), 7, 'parênteses são opcionais');
assert.equal(resolverMedida('Liderança + PRE + 2', valorDe), 9, 'constante entra na conta');

/* ===== o resto da aritmética ===== */
assert.equal(resolverMedida('Percepção * 2', valorDe), 4);
assert.equal(resolverMedida('Percepção × 2', valorDe), 4, '× do teclado vale como *');
assert.equal(resolverMedida('Blindagem ÷ 2', valorDe), 2.5);
assert.equal(resolverMedida('Blindagem - Percepção', valorDe), 3);
assert.equal(resolverMedida('(Liderança + PRE) * 2', valorDe), 14);
assert.equal(resolverMedida('2 * (Liderança + 1)', valorDe), 10, 'precedência com parênteses');
assert.equal(resolverMedida('Liderança + PRE * 2', valorDe), 10, 'multiplicação antes da soma');

/* ===== nome que a ficha não tem ===== */
assert.equal(resolverMedida('Liderança + Inexistente', valorDe), 4,
    'componente não achado vale 0 — a medida não some por causa de um nome');
assert.equal(resolverMedida('Liderança + Inexistente', valorDe, { faltaZero: false, padrao: 0 }), 0,
    'com faltaZero:false a fórmula inteira é recusada');

/* ===== gramática: o que NÃO passa ===== */
for (const veneno of [
    'alert(1)',                       // parêntese até passa, mas o nome vira 0
    '4; drop',
    'Liderança + [PRE]',
    'this.constructor',
    '`x`',
    '4 ** 2',
]) {
    const r = resolverMedida(veneno, valorDe);
    assert.ok(Number.isFinite(r), `${veneno}: nunca pode explodir, devolve número`);
}
assert.equal(tokensDaMedida('Liderança + [PRE]'), null, 'colchete não está na gramática');
assert.equal(tokensDaMedida('4; drop'), null, 'ponto e vírgula não está na gramática');
assert.equal(resolverMedida('Liderança + [PRE]', valorDe), 0, 'medida inválida cai no padrão');
assert.equal(resolverMedida('this.constructor', valorDe), 0);

/* ===== conferência para o Painel do Criador ===== */
assert.deepEqual(conferirMedida(''), { ok: true, vazio: true, formula: false, componentes: [] });
assert.deepEqual(conferirMedida('4'), { ok: true, vazio: false, formula: false, componentes: [] });

const bom = conferirMedida('(Liderança + PRE)');
assert.equal(bom.ok, true);
assert.equal(bom.formula, true);
assert.deepEqual(bom.componentes, ['Liderança', 'PRE']);

assert.equal(conferirMedida('Liderança + [PRE]').ok, false, 'caractere proibido reprova');
assert.equal(conferirMedida('(Liderança + PRE').ok, false, 'parêntese aberto reprova');
assert.match(conferirMedida('(Liderança + PRE').erro, /Parênteses/);
assert.equal(conferirMedida('+ + +').ok, false, 'fórmula sem componente reprova');

console.log('✅ medida-formula OK — número puro, fórmula da ficha, aritmética e gramática fechada');

/* ===== unidade colada no fim (o jeito que se copia do texto do cadastro) ===== */
assert.equal(resolverMedida('(Liderança + PRE) metros', valorDe), 7,
    '"metros" no fim é unidade, não componente');
assert.equal(resolverMedida('4 m', valorDe), 4);
assert.equal(resolverMedida('Percepção * 2 m', valorDe), 4);
assert.equal(ehNumero('4m'), true, '"4m" continua sendo número puro');
assert.deepEqual(componentesDaMedida('(Liderança + PRE) metros'), ['Liderança', 'PRE']);

/* ===== nome com mais de uma palavra e com hífen ===== */
const ficha2 = { 'Bolha de Sangue': 3, 'Blindagem-Cortante': 2 };
const v2 = (n) => (n in ficha2 ? ficha2[n] : null);
assert.equal(resolverMedida('Bolha de Sangue + 1', v2), 4, 'nome com espaço é um componente só');
assert.equal(resolverMedida('Blindagem-Cortante * 2', v2), 4, 'hífen grudado faz parte do nome');

console.log('✅ medida-formula: unidade no fim e nomes compostos OK');
