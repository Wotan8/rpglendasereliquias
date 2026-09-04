/**
 * Leitura de custo das habilidades de classe.
 *
 * Os casos são os TEXTOS REAIS do cadastro (system/data/classModules), um por
 * geração de módulo. O que se trava aqui:
 *   · "ou" separa formas de pagar; "e"/"+"/"," somam dentro da mesma forma;
 *   · o degrau do título ("Custo 3 — Clímax") é o preço do Bardo, na moeda do
 *     módulo — a `regua.custo` NÃO é preço de mesa e não pode virar custo;
 *   · o que aparece com número mas não é moeda ("1 Ação Prolongada") não vira
 *     cobrança.
 *
 * Roda com: node shared/skill-custo.test.mjs
 */
import assert from 'node:assert/strict';
import {
    custosDaSkill, custoDoTexto, degrauDoTitulo, recursoDoRotulo, recursoDoModulo, rotuloDosCustos,
    bolsaFecha, reparticaoValida, partesDaReparticao, custoExpDaHabilidade } from './skill-custo.js';

/* ===== texto livre ===== */
assert.deepEqual(custoDoTexto('1 Energia')[0].partes, [{ alvo: 'Energia', qtd: 1 }]);
assert.deepEqual(custoDoTexto(' 1 Sanidade ')[0].partes, [{ alvo: 'Sanidade', qtd: 1 }],
    'espaço em volta não atrapalha (Adepto grava assim)');

// Adepto: "1 Energia e 1 Sanidade" é UMA forma composta, não duas alternativas
const composto = custoDoTexto(' 1 Energia e 1 Sanidade ');
assert.equal(composto.length, 1, '"e" não abre alternativa');
assert.deepEqual(composto[0].partes, [{ alvo: 'Energia', qtd: 1 }, { alvo: 'Sanidade', qtd: 1 }]);
assert.equal(composto[0].rotulo, '1 Energia + 1 Sanidade');

// Xamã: "2 Energia ou 1 Energia + 2 Sanidade" — duas formas, a 2ª composta
const alternativas = custoDoTexto('2 Energia ou 1 Energia + 2 Sanidade');
assert.equal(alternativas.length, 2, '"ou" abre alternativa');
assert.deepEqual(alternativas[0].partes, [{ alvo: 'Energia', qtd: 2 }]);
assert.deepEqual(alternativas[1].partes, [{ alvo: 'Energia', qtd: 1 }, { alvo: 'Sanidade', qtd: 2 }]);
assert.equal(rotuloDosCustos(alternativas), '2 Energia ou 1 Energia + 2 Sanidade');

// Xamã: "3 Energia + 10 Sanidade + oferenda" — a oferenda não tem número e não vira cobrança
assert.deepEqual(custoDoTexto('3 Energia + 10 Sanidade + oferenda')[0].partes,
    [{ alvo: 'Energia', qtd: 3 }, { alvo: 'Sanidade', qtd: 10 }]);

// Xamã: "1 Ação Prolongada (10 min)" — tempo não é moeda
assert.deepEqual(custoDoTexto('1 Ação Prolongada (10 min)'), [],
    'ação/tempo com número não pode virar débito de recurso');

// número solto herda a moeda que o rótulo (ou o módulo) indica
assert.deepEqual(custoDoTexto('4', 'Energia')[0].partes, [{ alvo: 'Energia', qtd: 4 }]);
assert.deepEqual(custoDoTexto('4'), [], 'número sem moeda nenhuma não cobra nada');
assert.deepEqual(custoDoTexto('0'), [], 'zero não é custo');
assert.deepEqual(custoDoTexto(''), []);

// parênteses grudados no nome não viram parte do recurso
assert.deepEqual(custoDoTexto('2 Sanidade (por rodada)')[0].partes, [{ alvo: 'Sanidade', qtd: 2 }]);

/* ===== rótulo do campo ===== */
assert.equal(recursoDoRotulo('Custo em Energia'), 'Energia');
assert.equal(recursoDoRotulo('Custo Sanidade:'), 'Sanidade');
assert.equal(recursoDoRotulo('Custo:'), '', 'rótulo genérico não escolhe moeda');
assert.equal(recursoDoRotulo('Custo'), '');

/* ===== degrau do título (Bardo) ===== */
assert.equal(degrauDoTitulo('Custo 1 — Abertura'), 1);
assert.equal(degrauDoTitulo('Custo 5 — Opus Magnum'), 5);
assert.equal(degrauDoTitulo('Manobras de Guerreiro'), 0);
assert.equal(recursoDoModulo({ retornoRecurso: 'Harmonia' }), 'Harmonia');
assert.equal(recursoDoModulo({ custoRecurso: 'Graça', retornoRecurso: 'Harmonia' }), 'Graça',
    'custoRecurso explícito vence o recurso de retorno');

/* ===== a habilidade inteira ===== */
const leitorMec = (m) => m && m.tipo === 'modificar'
    ? { rotulo: m.nome, alvo: m.alvo, qtd: m.qtd } : null;

// BARDO — o caso da mesa: schema sem campo de custo, preço no título
const bardo = {
    titulo: 'Custo 1 — Abertura', retornoRecurso: 'Harmonia',
    schema: [{ key: '1', tipo: 'text', label: 'Nome' }, { key: '10', tipo: 'textarea', label: 'Efeito' }],
};
const cBardo = custosDaSkill({
    modulo: bardo,
    predef: { nome: 'GRITO DISSONANTE [V, S]', valores: { 1: 'GRITO DISSONANTE [V, S]' }, regua: { custo: 2 } },
    item: {}, mechPorId: () => null, custoDaMecanica: leitorMec,
});
assert.deepEqual(cBardo.length, 1);
assert.deepEqual(cBardo[0].partes, [{ alvo: 'Harmonia', qtd: 1 }],
    'a canção custa o degrau do módulo em Harmonia — nunca a regua.custo em ENER');
assert.equal(rotuloDosCustos(cBardo), '1 Harmonia');

const cBardo5 = custosDaSkill({
    modulo: { ...bardo, titulo: 'Custo 5 — Opus Magnum' },
    predef: { valores: {}, regua: { custo: 6 } }, item: {},
    mechPorId: () => null, custoDaMecanica: leitorMec,
});
assert.deepEqual(cBardo5[0].partes, [{ alvo: 'Harmonia', qtd: 5 }], 'o degrau 5 cobra 5, não 6');

// SANGRAL/GUERREIRO — duas mecânicas de custo = duas formas de pagar
const mecs = {
    m_ener: { tipo: 'modificar', nome: '−2 Energia', alvo: 'Energia', qtd: 2 },
    m_bolha: { tipo: 'modificar', nome: '−1 Bolha de Sangue', alvo: 'Bolha de Sangue', qtd: 1 },
};
const cDuas = custosDaSkill({
    modulo: {
        titulo: 'Círculo Sanguíneo Básico',
        schema: [
            { key: 'a', tipo: 'select_botao', label: 'Pagar Custo' },
            { key: 'b', tipo: 'select_botao', label: 'Pagar em Sangue' },
        ],
    },
    predef: { valores: { a: 'm_ener', b: 'm_bolha' } }, item: {},
    mechPorId: (id) => mecs[id], custoDaMecanica: leitorMec,
});
assert.equal(cDuas.length, 2, 'dois botões de custo = duas formas de pagar');
assert.equal(cDuas[0].rotulo, '−2 Energia');
assert.equal(cDuas[1].partes[0].alvo, 'Bolha de Sangue');

// A instância na ficha vence o pré-definido (o Mestre trocou a moeda daquela cópia)
const cInstancia = custosDaSkill({
    modulo: { titulo: 'X', schema: [{ key: 'a', tipo: 'select_botao', label: 'Pagar Custo' }] },
    predef: { valores: { a: 'm_ener' } }, item: { a: 'm_bolha' },
    mechPorId: (id) => mecs[id], custoDaMecanica: leitorMec,
});
assert.equal(cInstancia[0].partes[0].alvo, 'Bolha de Sangue');

// A mecânica manda: existindo botão de custo, o campo de texto não é lido
const cPrioridade = custosDaSkill({
    modulo: {
        titulo: 'Rituais',
        schema: [
            { key: 'a', tipo: 'select_botao', label: 'Pagar Custo' },
            { key: 'c', tipo: 'text', label: 'Custo:' },
        ],
    },
    predef: { valores: { a: 'm_ener', c: '99 Sanidade' } }, item: {},
    mechPorId: (id) => mecs[id], custoDaMecanica: leitorMec,
});
assert.deepEqual(cPrioridade[0].partes, [{ alvo: 'Energia', qtd: 2 }]);

// INVOCADOR — campo "Custo em Energia" com número solto pega a moeda do rótulo
const cInvocador = custosDaSkill({
    modulo: { titulo: 'Rituais de Invocação Abissal', schema: [{ key: 'q', tipo: 'text', label: 'Custo em Energia' }] },
    predef: { valores: { q: '4' } }, item: {}, mechPorId: () => null, custoDaMecanica: leitorMec,
});
assert.deepEqual(cInvocador[0].partes, [{ alvo: 'Energia', qtd: 4 }]);

// DRUIDA (loção pronta) — sem custo nenhum, e sem inventar um
assert.deepEqual(custosDaSkill({
    modulo: { titulo: 'Receita de Loções Ofensiva', schema: [] },
    predef: { valores: {}, regua: { custo: 3 } }, item: {},
    mechPorId: () => null, custoDaMecanica: leitorMec,
}), [], 'habilidade sem custo cadastrado continua sem custo — a Régua não vira preço');

// 🎵 MOEDA DO MÓDULO COM ALTERNATIVA: o degrau vale para cada moeda listada.
// A barda ficava com todas as canções travadas em "não tem Harmonia" mesmo
// tendo Energia — agora o cadastro consegue DIZER que uma paga pela outra.
{
    const umaMoeda = custosDaSkill({ modulo: { titulo: 'Custo 2 — Desenvolvimento', retornoRecurso: 'Harmonia' } });
    assert.equal(umaMoeda.length, 1, 'uma moeda: uma forma de pagar, como sempre foi');
    assert.deepEqual(umaMoeda[0].partes, [{ alvo: 'Harmonia', qtd: 2 }]);

    // 🎵 Duas moedas viram uma BOLSA: a cancao custa 3, nao "3 Harmonia".
    const bolsa = custosDaSkill({ modulo: { titulo: 'Custo 3 — Clímax', custoRecurso: 'Harmonia ou Energia' } });
    assert.equal(bolsa.length, 1, 'a bolsa é UMA forma de pagar, repartida na hora');
    assert.equal(bolsa[0].pool, true);
    assert.equal(bolsa[0].total, 3);
    assert.deepEqual(bolsa[0].moedas, ['Harmonia', 'Energia']);
    assert.equal(bolsa[0].rotulo, '3 · Harmonia e/ou Energia');
    assert.deepEqual(bolsa[0].partes, [{ alvo: 'Harmonia', qtd: 3 }],
        'partes trazem a repartição padrão — quem só lê forma simples não quebra');

    // a bolsa fecha somando as moedas, não uma de cada vez
    const tem = (h, e) => (m) => (m === 'Harmonia' ? h : m === 'Energia' ? e : null);
    assert.equal(bolsaFecha(bolsa[0], tem(0, 5)).ok, true, 'sem Harmonia mas com Energia: paga');
    assert.equal(bolsaFecha(bolsa[0], tem(2, 1)).ok, true, '2 + 1 = 3: paga misturado');
    assert.equal(bolsaFecha(bolsa[0], tem(1, 1)).ok, false, '1 + 1 = 2: não fecha');
    assert.equal(bolsaFecha(bolsa[0], tem(1, 1)).disponivel, 2, 'e diz quanto tem no total');
    assert.equal(bolsaFecha(bolsa[0], () => null).ok, true, 'moeda desconhecida não bloqueia');

    // a repartição tem que dar o total exato e caber no que existe
    const vale = (split, h, e) => reparticaoValida(bolsa[0], split, tem(h, e));
    assert.equal(vale({ Harmonia: 2, Energia: 1 }, 5, 5).ok, true, '2+1 fecha os 3');
    assert.equal(vale({ Harmonia: 0, Energia: 3 }, 0, 5).ok, true, 'tudo de uma moeda é repartição válida');
    assert.equal(vale({ Harmonia: 1, Energia: 1 }, 5, 5).ok, false, 'faltou 1');
    assert.equal(vale({ Harmonia: 3, Energia: 1 }, 5, 5).ok, false, 'sobrou 1 — ninguém paga a mais');
    assert.equal(vale({ Harmonia: 3, Energia: 0 }, 1, 5).ok, false, 'pediu 3 de Harmonia e só tem 1');
    assert.match(vale({ Harmonia: 3, Energia: 0 }, 1, 5).porque, /só tem 1 de Harmonia/);
    assert.equal(vale({ Harmonia: -1, Energia: 4 }, 5, 5).ok, false, 'negativo não é repartição');
    assert.deepEqual(partesDaReparticao(bolsa[0], { Harmonia: 2, Energia: 1 }),
        [{ alvo: 'Harmonia', qtd: 2 }, { alvo: 'Energia', qtd: 1 }]);
    assert.deepEqual(partesDaReparticao(bolsa[0], { Harmonia: 0, Energia: 3 }),
        [{ alvo: 'Energia', qtd: 3 }], 'moeda com 0 não vira débito');

    // sem degrau no título não há preço, mesmo com moeda declarada
    assert.deepEqual(custosDaSkill({ modulo: { titulo: 'Canções', custoRecurso: 'Harmonia ou Energia' } }), []);
}

console.log('✅ custo das skills OK — mecânica, texto com "ou"/"e", degrau do Bardo e o que não é moeda');

// ⭐ Livro, p. 7: comprar uma habilidade de ramo custa Qualidade × 4 EXP
{
    const ramo = { escolaId: 'escola_hemomancia', custoExpPorItem: 1 };
    assert.equal(custoExpDaHabilidade(ramo, { qualidade: 3 }), 12, 'Q3 = 12 EXP');
    assert.equal(custoExpDaHabilidade(ramo, { qualidade: 3 }, { exp: { habilidadePorQualidade: 5 } }), 15, 'o multiplicador vem de config/regras');
    assert.equal(custoExpDaHabilidade(ramo, { qualidade: 3, custoExpProprio: 2 }), 2, 'custo fixo do predef vence');
    assert.equal(custoExpDaHabilidade(ramo, { qualidade: 0 }), 1, 'sem Qualidade cai no custo do módulo');
    assert.equal(custoExpDaHabilidade({ custoExpPorItem: 1 }, { qualidade: 3 }), 1, 'módulo sem Escola não é ramo: custo do módulo');
}
console.log('✅ custo da habilidade de ramo: Qualidade × 4 OK');
