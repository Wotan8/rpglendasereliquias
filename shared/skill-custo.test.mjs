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
} from './skill-custo.js';

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

    const duas = custosDaSkill({ modulo: { titulo: 'Custo 2 — Desenvolvimento', custoRecurso: 'Harmonia ou Energia' } });
    assert.equal(duas.length, 2, 'duas moedas: duas formas, e quem usa escolhe');
    assert.deepEqual(duas[0].partes, [{ alvo: 'Harmonia', qtd: 2 }]);
    assert.deepEqual(duas[1].partes, [{ alvo: 'Energia', qtd: 2 }], 'o degrau vale para as DUAS moedas');
    assert.equal(duas[1].rotulo, '2 Energia');

    // sem degrau no título não há preço, mesmo com moeda declarada
    assert.deepEqual(custosDaSkill({ modulo: { titulo: 'Canções', custoRecurso: 'Harmonia ou Energia' } }), []);
}

console.log('✅ custo das skills OK — mecânica, texto com "ou"/"e", degrau do Bardo e o que não é moeda');
