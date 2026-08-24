// Rodar: node shared/parse-custo.test.mjs
// Os casos vieram do self-test que morava dentro do próprio parse-custo, e que
// saiu de lá quando o arquivo passou a ser carregado pelo navegador: `process`
// não existe no browser e o bloco derrubava a aba Sanidade inteira.
import assert from 'node:assert/strict';
import { recursoDoPredef, ACAO, MOEDA } from './parse-custo.js';

const T = (tipo, label, key) => ({ tipo, label, key });
const texto = [T('text', 'Custo:', '4')];

assert.equal(recursoDoPredef(texto, { 4: '1 Energia' }), 1.0);
assert.equal(recursoDoPredef(texto, { 4: '1 Energia ou 1 Graça' }), 1.0, '"ou" escolhe, não soma');
assert.equal(recursoDoPredef(texto, { 4: '2 Energia ou 1 Energia + 2 Sanidade' }), 1.58,
    'a alternativa mais barata é 1 Energia + 2 Sanidade');
assert.equal(recursoDoPredef(texto, { 4: '3 ENER' }), 3.0, 'abreviatura do cadastro');
assert.equal(recursoDoPredef(texto, { 4: '2 Cargas' }), 1.742);
assert.equal(recursoDoPredef(texto, { 4: '2 Cargas + 1 Energia' }), 2.742, '"+" soma na mesma alternativa');
assert.equal(recursoDoPredef(texto, { 4: '1 Energia (raio 3m)' }), 1.0, 'parêntese não é moeda');
assert.equal(recursoDoPredef(texto, { 4: '' }), 0);

// Invocador: dois campos numéricos, somam
const nums = [T('number', 'Custo Sanidade:', '5'), T('number', 'Custo em Energia', '6')];
assert.equal(recursoDoPredef(nums, { 5: '1', 6: '2' }), 2.29, '2 Energia + 1 Sanidade');
assert.equal(recursoDoPredef(nums, { 5: '0', 6: '1' }), 1.0);

// As duas tabelas são régua: se um valor mudar sem passar pelo livro, quebra aqui.
assert.equal(ACAO['Ação Padrão'], 1.0);
assert.equal(ACAO['Ação Livre'], 0);
assert.equal(MOEDA.energia, 1.0);
assert.equal(MOEDA.sanidade, 0.290);

console.log('✅ parse-custo: "ou" escolhe, "+" soma, campos numéricos somam, abreviatura e parêntese OK');
