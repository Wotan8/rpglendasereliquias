/**
 * Interpretador de habilidade — o que faz a "Como aplicar" NÃO aparecer.
 *
 * A janela manual só pode aparecer quando a habilidade realmente não tem
 * cadastro. Toda outra causa é bug, e cada uma vira um caso aqui:
 *   · _predefId vazio (ficha antiga, item colado à mão) → acha pelo nome;
 *   · nome com sufixo de veículos ("[V, S]") divergindo do registro → acha
 *     pela base do nome;
 *   · o próprio item da ficha trazendo a mira → usa a do item;
 *   · registro fora do ar → NÃO é "sem cadastro", e o diagnóstico diz isso.
 *
 * Roda com: node shared/skill-runtime.test.mjs
 */
import assert from 'node:assert/strict';
import {
    indexarPredefs, acharPredef, miraDeCadastro, resolverMira,
    interpretarSkill, nomeDoItem, normSemSufixo,
} from './skill-runtime.js';
import { custosDaSkill } from './skill-custo.js';

const modBardo = {
    id: 'sonoro_c1', titulo: 'Custo 1 — Abertura', retornoRecurso: 'Harmonia', schema: [],
    itensPredefinidos: [
        { id: 'pdi_grito', nome: 'GRITO DISSONANTE [V, S]', formaArea: 'onda', tamanhoArea: 3,
          faccao: 'inimigo', condicoesAplicadas: [{ condicao: 'Atordoado', rodadas: 1, alvos: 2, portao: 'chance' }] },
        { id: 'pdi_sussurro', nome: 'SUSSURRO DE ALCANCE [V, S]', formaArea: 'ponto', alvosMax: 1, alcance: 0 },
    ],
};
const idx = indexarPredefs([modBardo]);
const ctx = { idx, custosDaSkill, mechPorId: () => null, custoDaMecanica: () => null, registroOk: true };

/* ===== a cadeia de recurso ===== */
assert.equal(acharPredef({ _predefId: 'pdi_grito' }, idx).como, 'id');
assert.equal(acharPredef({ _predefNome: 'GRITO DISSONANTE [V, S]' }, idx).como, 'nome',
    'ficha sem _predefId ainda acha pelo nome');
assert.equal(acharPredef({ nome: 'grito dissonante' }, idx).como, 'nome sem [veículos]',
    'nome sem o sufixo de veículos ainda acha');
assert.equal(acharPredef({ _predefId: 'não_existe', _predefNome: 'GRITO DISSONANTE [V, S]' }, idx).como, 'nome',
    'id que não bate não impede o nome de salvar');
assert.equal(acharPredef({ nome: 'Coisa que não existe' }, idx), null);

assert.equal(normSemSufixo('GRITO DISSONANTE [V, S]'), 'gritodissonante');
assert.equal(nomeDoItem({ '1': 'Vindo do schema' }), 'Vindo do schema', 'o nome pode estar na key do schema');

/* ===== o caso da mesa: o Bardo tem de sair interpretado ===== */
const grito = interpretarSkill({ _predefId: 'pdi_grito', _predefNome: 'GRITO DISSONANTE [V, S]' }, ctx);
assert.equal(grito.diagnostico.ok, true, 'GRITO DISSONANTE tem de ser interpretado sozinho');
assert.equal(grito.mira.tipo, 'geometria');
assert.equal(grito.mira.raioM, 3);
assert.equal(grito.mira.afeta, 'inimigos');
assert.deepEqual(grito.mira.condicoes,
    [{ nome: 'Atordoado', rodadas: 1, maxAlvos: 2, nivel: 1, faccao: '', rotulo: '' }],
    'cadastro sem nível nem facção continua saindo com os padrões (nível 1, sem facção)');
assert.equal(grito.custos[0].partes[0].alvo, 'Harmonia', 'o custo vem do degrau do título');
assert.equal(grito.custos[0].partes[0].qtd, 1);

// e sem _predefId nenhum (ficha antiga) continua saindo igual
const semId = interpretarSkill({ _predefNome: 'GRITO DISSONANTE [V, S]' }, ctx);
assert.equal(semId.diagnostico.ok, true, 'sem _predefId a habilidade NÃO pode cair no manual');
assert.equal(semId.mira.raioM, 3);
assert.equal(semId.diagnostico.como, 'nome');

/* ===== a mira do ITEM vence a do pré-definido ===== */
const ajustado = interpretarSkill(
    { _predefId: 'pdi_grito', formaArea: 'onda', tamanhoArea: 8, faccao: 'inimigo' }, ctx);
assert.equal(ajustado.mira.raioM, 8, 'o Mestre ajustou a cópia desta ficha e é ela que vale');

/* ===== registro fora do ar NÃO é "sem cadastro" ===== */
const semRegistro = interpretarSkill({ _predefId: 'pdi_grito' }, { ...ctx, registroOk: false });
assert.equal(semRegistro.diagnostico.registroIndisponivel, true);
assert.equal(semRegistro.diagnostico.ok, false);
assert.match(semRegistro.diagnostico.faltas[0].porque, /não carregou/,
    'a tela precisa dizer que é falha de leitura, não falta de cadastro');

/* ===== o diagnóstico explica o que falta, campo a campo ===== */
const semNada = interpretarSkill({ nome: 'Habilidade Crua' }, ctx);
assert.equal(semNada.diagnostico.ok, false);
assert.equal(semNada.diagnostico.achouPredef, false);
const campos = semNada.diagnostico.faltas.map(f => f.campo);
assert.ok(campos.includes('_predefId'), 'diz que não achou o pré-definido');
assert.ok(campos.some(c => /formaArea/.test(c)), 'diz que falta a mira');
assert.ok(campos.includes('custo'), 'diz que falta o custo');
for (const f of semNada.diagnostico.faltas) {
    assert.ok(f.porque && f.porque.length > 20, `a falta "${f.campo}" tem de explicar o porquê`);
}

// mira de alvos com alcance 0 é armadilha e o diagnóstico acusa
const sussurro = interpretarSkill({ _predefId: 'pdi_sussurro' }, ctx);
assert.ok(sussurro.mira, 'tem mira...');
assert.equal(sussurro.mira.raioM, 0, '...mas é "só em si"');

// "nenhuma"/"proprio" com alcance 0 é auto-alvo de propósito, e não falta nada
assert.equal(interpretarSkill({ nome: 'Postura', formaArea: 'proprio', alvosMax: 1, alcance: 0 }, ctx)
    .diagnostico.faltas.some(f => f.campo === 'alcance'), false,
    'auto-alvo declarado não é armadilha — é a intenção');

// já uma mira de ALVOS de verdade, com alcance 0, é armadilha e o diagnóstico acusa
const alvo0 = interpretarSkill({ nome: 'X', formaArea: 'alvo', alvosMax: 2, alcance: 0 }, ctx);
assert.equal(alvo0.mira.tipo, 'alvos');
assert.ok(alvo0.diagnostico.faltas.some(f => f.campo === 'alcance'),
    'mira de alvos a 0 m avisa que só alcança a si mesmo');

/* ===== miraDeCadastro devolve null quando não há mira mesmo ===== */
assert.equal(miraDeCadastro({ nome: 'Ritual' }), null);
assert.equal(miraDeCadastro(null), null);
assert.equal(resolverMira({}, null), null);

/* ===== índice conta o que indexou ===== */
assert.equal(idx.total, 2);
assert.equal(indexarPredefs([]).total, 0);
assert.equal(indexarPredefs(null).total, 0);

console.log('✅ interpretador OK — cadeia de recurso, item vence predef, e "sem registro" ≠ "sem cadastro"');

/* ===== gratuidade: DECLARADA e por DESENHO ===== */
import { moduloDeclaraCusto, custoDeclaradoZero } from './skill-custo.js';

// Módulo sem NENHUM campo de custo (Receita de Loções): grátis por desenho.
// A loção já foi preparada — usar é beber, e cobrar isso seria ruído.
const modLocoes = {
    titulo: 'Receita de Loções Ofensiva', schema: [{ key: '1', tipo: 'text', label: 'Nome' }],
    itensPredefinidos: [{ id: 'pdi_locao', nome: 'Loção de Veneno', formaArea: 'unico', alvosMax: 1, alcance: 0 }],
};
assert.equal(moduloDeclaraCusto(modLocoes), false, 'módulo sem campo de custo não declara custo');
assert.equal(moduloDeclaraCusto({ titulo: 'X', schema: [{ tipo: 'select_botao', label: 'Pagar' }] }), true);
assert.equal(moduloDeclaraCusto({ titulo: 'X', schema: [{ tipo: 'text', label: 'Custo:' }] }), true);
assert.equal(moduloDeclaraCusto({ titulo: 'Custo 3 — Clímax', retornoRecurso: 'Harmonia', schema: [] }), true,
    'o degrau no título é declaração de custo');

const ctxLocao = {
    idx: indexarPredefs([modLocoes]), custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero,
    mechPorId: () => null, custoDaMecanica: () => null, registroOk: true,
};
const locao = interpretarSkill({ _predefId: 'pdi_locao' }, ctxLocao);
assert.equal(locao.semCusto, true);
assert.equal(locao.diagnostico.ok, true, 'loção pronta não pode ser acusada de falta de custo');

// "—" e "Gatilho" no campo de custo são gratuidade DECLARADA (o Ladino usa)
const modLadino = {
    titulo: 'Manobras de Ladino', schema: [{ key: 'c', tipo: 'text', label: 'Custo:' }],
    itensPredefinidos: [
        { id: 'pdi_salto', nome: 'Salto Predatório', valores: { c: '—' }, formaArea: 'proprio', alvosMax: 1, alcance: 0 },
        { id: 'pdi_troca', nome: 'Troca de Mãos', valores: { c: 'Gatilho' }, formaArea: 'proprio', alvosMax: 1, alcance: 0 },
    ],
};
const ctxLadino = { ...ctxLocao, idx: indexarPredefs([modLadino]) };
for (const id of ['pdi_salto', 'pdi_troca']) {
    const r = interpretarSkill({ _predefId: id }, ctxLadino);
    assert.equal(r.diagnostico.ok, true, `${id}: custo declarado como zero não é falta`);
}
// mas campo de custo VAZIO num módulo que declara custo continua sendo falta
const vazio = interpretarSkill({ _predefId: 'pdi_x' }, {
    ...ctxLocao,
    idx: indexarPredefs([{ ...modLadino, itensPredefinidos: [
        { id: 'pdi_x', nome: 'Manobra Esquecida', valores: {}, formaArea: 'proprio', alvosMax: 1, alcance: 0 }] }]),
});
assert.ok(vazio.diagnostico.faltas.some(f => f.campo === 'custo'),
    'campo de custo vazio num módulo que cobra continua sendo falta');

/* ===== ritual "Fora de combate" não precisa de mira nem de custo ===== */
const modRito = {
    titulo: 'Rituais', schema: [{ key: 'acao', tipo: 'select', label: 'Ação:' }, { key: 'c', tipo: 'text', label: 'Custo:' }],
    itensPredefinidos: [{ id: 'pdi_rito', nome: 'Rito Longo', valores: { acao: 'Fora de combate' } }],
};
const rito = interpretarSkill({ _predefId: 'pdi_rito' }, { ...ctxLocao, idx: indexarPredefs([modRito]) });
assert.equal(rito.diagnostico.foraDeCombate, true);
assert.equal(rito.diagnostico.ok, true, 'rito fora de combate não tem alvo no mapa — e isso não é falta');
assert.deepEqual(rito.diagnostico.faltas, []);

// a MESMA habilidade como Ação Padrão volta a ser cobrada
const mesmoComoAcao = interpretarSkill({ _predefId: 'pdi_rito2' }, {
    ...ctxLocao,
    idx: indexarPredefs([{ ...modRito, itensPredefinidos: [
        { id: 'pdi_rito2', nome: 'Rito Longo', valores: { acao: 'Ação Padrão' } }] }]),
});
assert.equal(mesmoComoAcao.diagnostico.ok, false, 'como Ação Padrão, a falta de mira volta a valer');

console.log('✅ gratuidade e ritos OK — o diagnóstico só acusa o que É falta');
