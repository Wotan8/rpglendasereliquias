/**
 * Rótulo de Ação do cadastro → custo de ação do turno (acaoDoRotulo).
 *
 * O select "Ação:" dos módulos de classe tem sete opções, e uma delas é
 * "Fora de combate". O painel do turno ignorava essa: um ritual de oito horas
 * caía como Ação Padrão, gastava a ação da rodada e ainda abria o diálogo de
 * mira pedindo raio e ângulo. Agora vira 'fora' — não gasta ação e não mira.
 *
 * Roda com: node tabuleiro/js/tab-acao-do-rotulo.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function acaoDoRotulo(');
assert.ok(ini > 0, 'acaoDoRotulo não encontrada');
const sb = {}; vm.createContext(sb);
vm.runInContext(src.slice(ini, src.indexOf('\n}\n', ini) + 3), sb);
const acao = (r) => { sb.r = r; vm.runInContext('x = acaoDoRotulo(r)', sb); return sb.x; };

// As sete opções do select, como estão cadastradas
assert.equal(acao('Ação Padrão'), 'padrao');
assert.equal(acao('Ação de Movimento'), 'movimento');
assert.equal(acao('Ação Livre'), 'livre');
assert.equal(acao('Ação Completa (turno inteiro)'), 'completa');
assert.equal(acao('Reação'), 'padrao', 'Reação ainda não tem trilho próprio: cai em Padrão');
assert.equal(acao('Sustentada (1 Padrão/turno)'), 'padrao');
assert.equal(acao('Fora de combate'), 'fora', 'era isto que virava Ação Padrão por engano');

// O texto de custo do Xamã ("1 Ação Prolongada (10 min)") também não é turno
assert.equal(acao('1 Ação Prolongada (10 min)'), 'fora');

// Vazio/ausente continua sendo Ação Padrão — é o padrão de quem não cadastrou
assert.equal(acao(''), 'padrao');
assert.equal(acao(null), 'padrao');
assert.equal(acao(undefined), 'padrao');

// "Fora de combate" tem de vencer as outras palavras se aparecerem juntas
assert.equal(acao('Ação Padrão, fora de combate'), 'fora');

// E o painel não pode gastar ação de quem faz ritual
const gastar = src.slice(src.indexOf('async function gastar('), src.indexOf('\n}\n', src.indexOf('async function gastar(')));
assert.match(gastar, /custo === 'livre' \|\| custo === 'fora'/,
    'ritual e ação livre não consomem ação do turno');

console.log('✅ rótulo de Ação OK — "Fora de combate" vira ritual, não Ação Padrão');
