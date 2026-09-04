/**
 * "fica Fortalecido 2" tem de entrar em 2, não em 1.
 *
 * `condicoesAplicadas` ganhou o campo `nivel`, mas a pilha de condições sempre
 * subia de um em um — o nível do cadastro morria no caminho e uma habilidade
 * que promete Abalado 2 entregava Abalado 1, metade do que a Régua cobrou.
 *
 * Roda com: node tabuleiro/js/tab-condicao-nivel.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./tab-combat.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function empilharCondicao(');
assert.ok(ini > 0, 'empilharCondicao não encontrada');

const sb = {};
vm.createContext(sb);
// condDoParticipante vive em shared/combate-cenas.js: aqui basta o formato duplo
// (string legada ou objeto), que é o contrato que a função consome.
vm.runInContext(`
    function condDoParticipante(c) {
        if (typeof c === 'string') return { nome: c, nivel: 1 };
        return { ...c, nivel: Number(c?.nivel) || 1 };
    }
`, sb);
vm.runInContext(src.slice(ini, src.indexOf('\n}\n', ini) + 3), sb);

const emp = (lista, cond, tpl, niveis) => {
    sb.a = lista; sb.b = cond; sb.c = tpl; sb.d = niveis;
    vm.runInContext('x = JSON.stringify(empilharCondicao(a, b, c, d))', sb);
    return JSON.parse(sb.x);
};

const FORTALECIDO = { nome: 'Fortalecido', acumulaNiveis: true, nivelMaximo: 3 };
const CEGO = { nome: 'Cego' };   // não acumula

/* ===== o caso do relato ===== */
let r = emp([], { nome: 'Fortalecido' }, FORTALECIDO, 2);
assert.equal(r.nivel, 2, '🔒 "Fortalecido 2" entra em 2');
assert.equal(r.condicoes[0].nivel, 2);
assert.equal(r.subiu, false, 'primeira aplicação não é "subiu de nível"');

/* ===== o comportamento antigo continua igual (nível ausente = 1) ===== */
assert.equal(emp([], { nome: 'Fortalecido' }, FORTALECIDO).nivel, 1, 'sem nível pedido, entra em 1');
assert.equal(emp([], { nome: 'Fortalecido' }, FORTALECIDO, 1).nivel, 1);
assert.equal(emp([{ nome: 'Fortalecido', nivel: 1 }], { nome: 'Fortalecido' }, FORTALECIDO).nivel, 1,
    '🔒 Livro p. 9: mesma condição de duas fontes vale o MAIOR N — 1 sobre 1 fica 1');
assert.equal(emp([{ nome: 'Fortalecido', nivel: 1 }], { nome: 'Fortalecido' }, FORTALECIDO, 2).nivel, 2, 'o maior N vence');
const PECONHA = { nome: 'Peçonha', acumulaNiveis: true, nivelMaximo: 5, aflicao: true };
assert.equal(emp([{ nome: 'Peçonha', nivel: 1 }], { nome: 'Peçonha' }, PECONHA).nivel, 2, '🔒 Aflição PIORA: mordida nova sobe +1');

/* ===== acumular respeita o teto ===== */
r = emp([{ nome: 'Peçonha', nivel: 2 }], { nome: 'Peçonha' }, { ...PECONHA, nivelMaximo: 3 }, 2);
assert.equal(r.nivel, 3, 'teto 3: Aflição 2 + 2 para em 3');
assert.equal(r.noTeto, false, 'ainda subiu — só não foi tudo');
r = emp([{ nome: 'Fortalecido', nivel: 3 }], { nome: 'Fortalecido' }, FORTALECIDO, 2);
assert.equal(r.nivel, 3);
assert.equal(r.noTeto, true, 'não subiu: a tela avisa em vez de fingir que aplicou');

// entrar direto acima do teto também para nele
assert.equal(emp([], { nome: 'Fortalecido' }, FORTALECIDO, 9).nivel, 3, 'nível pedido não fura o teto');

/* ===== condição que NÃO acumula ignora o nível e vira outra linha ===== */
r = emp([{ nome: 'Cego' }], { nome: 'Cego' }, CEGO, 2);
assert.equal(r.condicoes.length, 2, 'sem acumulaNiveis, entra como sempre entrou');
assert.equal(r.nivel, 1);

/* ===== nível inválido nunca zera a condição ===== */
assert.equal(emp([], { nome: 'Fortalecido' }, FORTALECIDO, 0).nivel, 1);
assert.equal(emp([], { nome: 'Fortalecido' }, FORTALECIDO, -3).nivel, 1);

console.log('✅ nível da condição OK — o "2" do cadastro chega ao participante e respeita o teto');
