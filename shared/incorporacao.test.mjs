/**
 * Incorporação — Receptor e Projetor, do Druida e do Xamã.
 *
 * O que se trava aqui:
 *   · não há seletor de aliado: o alvo é um TOKEN mirado, e a validação recusa
 *     com motivo — vínculo com a ficha e tipo certo (Criatura para a Fusão
 *     Selvagem, Eco para a Transcendência);
 *   · o custo é escalonado pelo que a Dádiva ENTREGOU: quem funde com um lobo
 *     paga pouco, quem funde com um urso ancião paga o que tirou;
 *   · quem fica Em Transe é o corpo deixado para trás, e ele depende do modo.
 *
 * Roda com: node shared/incorporacao.test.mjs
 */
import assert from 'node:assert/strict';
import { DADIVAS } from './dadiva.js';
import {
    porqueNaoPodeIncorporar, custoEscalonado, dadivasDoHospede, ehAncestral,
    quemFicaInerte, ORCAMENTO_BASE, UNIDADES_POR_SANIDADE, CONDICAO_TRANSE,
    poderDoHospede, custoDaProjecao,
} from './incorporacao.js';

const CHAR = 'char_druida_1';
const vinculado = [{ tipo: 'personagem', id: CHAR, relacao: 'Aliado' }];

/* ===== validação do alvo mirado ===== */
const urso = { nome: 'Urso Pardo', tipo: 'criatura', vinculos: vinculado };
assert.equal(porqueNaoPodeIncorporar({ hospede: urso, charId: CHAR, exige: 'aliado-animal' }), '',
    'aliado animal vinculado e na cena: pode');

// o mesmo urso, mas de outro personagem
assert.match(porqueNaoPodeIncorporar({ hospede: urso, charId: 'char_outro', exige: 'aliado-animal' }),
    /vinculado/, 'animal de outro druida não serve');

// aliado humano é aliado, não manada
const capitao = { nome: 'Ebrus', tipo: 'npc', vinculos: vinculado };
assert.match(porqueNaoPodeIncorporar({ hospede: capitao, charId: CHAR, exige: 'aliado-animal' }),
    /Aliado Animal/, 'a Fusão Selvagem é com bicho');

// Eco não serve para a Fusão, e criatura não serve para a Transcendência
const eco = { nome: 'Eco do Ferreiro', tipo: 'eco', vinculos: vinculado, ecoDadiva: 'braco', ecoEstado: 'sereno' };
assert.match(porqueNaoPodeIncorporar({ hospede: eco, charId: CHAR, exige: 'aliado-animal' }), /Aliado Animal/);
assert.match(porqueNaoPodeIncorporar({ hospede: urso, charId: CHAR, exige: 'eco' }), /Eco da Alma/);
assert.equal(porqueNaoPodeIncorporar({ hospede: eco, charId: CHAR, exige: 'eco' }), '');

// token que não é ficha nenhuma
assert.match(porqueNaoPodeIncorporar({ hospede: null, charId: CHAR, exige: 'eco' }), /incorporar/);
assert.match(porqueNaoPodeIncorporar({ hospede: { tipo: 'criatura', vinculos: [] }, charId: CHAR, exige: 'aliado-animal' }),
    /vinculado/, 'criatura sem vínculo nenhum não entra');

/* ===== custo escalonado ===== */
assert.equal(ORCAMENTO_BASE, 2);
assert.equal(UNIDADES_POR_SANIDADE, 2);

// dentro do orçamento: o custo fixo da habilidade já cobre
assert.deepEqual(custoEscalonado(0), { excedente: 0, sanidade: 0 });
assert.deepEqual(custoEscalonado(2), { excedente: 0, sanidade: 0 }, 'exatamente no orçamento não cobra a mais');
assert.deepEqual(custoEscalonado(1.5), { excedente: 0, sanidade: 0 });

// acima do orçamento, 1 de Sanidade a cada 2 unidades
assert.deepEqual(custoEscalonado(4), { excedente: 2, sanidade: 1 });
assert.deepEqual(custoEscalonado(5.9), { excedente: 3.9, sanidade: 1 }, 'só o degrau fechado cobra');
assert.deepEqual(custoEscalonado(6), { excedente: 4, sanidade: 2 });
assert.deepEqual(custoEscalonado(12), { excedente: 10, sanidade: 5 }, 'urso ancião: o preço acompanha');

// o divisor é ajustável sem mexer no código do Tabuleiro
assert.equal(custoEscalonado(12, { porSanidade: 4 }).sanidade, 2);
assert.equal(custoEscalonado(12, { orcamento: 0 }).sanidade, 6);

/* ===== 🌫️ a Sanidade do PROJETOR =====
 * Ela NAO vem das unidades da Dádiva. Aquela conta e cortada pelo teto de quem
 * recebe, entao mede o espaco que sobrava na ficha do Xama, nao a forca do
 * hospede: mesmo Eco, mesmo beneficio, e o veterano no teto pagava ZERO
 * enquanto o iniciante pagava caro. Aqui e o Poder do hospede + o Veu. */
assert.equal(poderDoHospede({ atributos: { PRS: 8 } }), 8, 'o Poder e a PRS da ficha');
// Uma fonte so. O campo `eco.prs` do Painel saiu em 25/08/2026: duas entradas
// para o mesmo numero deixavam o Mestre preencher a escala de RESISTENCIA do
// §9.9 num campo que precifica PODER, e a projecao cobrava o numero errado.
assert.equal(poderDoHospede({ eco: { prs: 10 }, atributos: { PRS: 8 } }), 8,
    'campo antigo do Painel NAO vence mais a ficha');
assert.equal(poderDoHospede({}), 0);

const servo = { atributos: { PRS: 2 } };       // Eco do Servo
const mestre = { atributos: { PRS: 8 } };      // Eco do Mestre de Armas
assert.equal(custoDaProjecao(servo, 'material').sanidade, 1,
    'o Eco mais banal ainda cobra 1 - sair do corpo custa SEMPRE');
assert.equal(custoDaProjecao(mestre, 'material').sanidade, 3, '1 + 8/3');
assert.equal(custoDaProjecao(mestre, 'eterico').sanidade, 4, 'o Eterico soma 1');
assert.equal(custoDaProjecao(mestre, 'astral').sanidade, 5, 'o Astral soma 2');
assert.equal(custoDaProjecao({ atributos: { PRS: 10 } }, 'Astral').sanidade, 6,
    'caixa e acento nao importam no Veu');
assert.equal(custoDaProjecao(mestre, 'lugar nenhum').degrau, 0, 'Veu desconhecido nao inventa degrau');
assert.equal(custoDaProjecao(mestre, 'astral', { piso: 0, poderPorSanidade: 4 }).sanidade, 4,
    'os dois botoes sao ajustaveis sem mexer no Tabuleiro');

// O Redutor do Veu: regra que ja estava escrita no predef e ninguem aplicava.
// Redutor NAO tem sinal - `Alvo = ... - Redutor`, entao o numero ja e a subtracao.
assert.equal(custoDaProjecao(mestre, 'material').redutor, 0, 'o Material nao dificulta');
assert.equal(custoDaProjecao(mestre, 'eterico').redutor, 2);
assert.equal(custoDaProjecao(mestre, 'astral').redutor, 4);
assert.equal(custoDaProjecao(mestre, 'lugar nenhum').redutor, 0, 'Veu desconhecido nao inventa Redutor');
// Sanidade e Redutor sobem juntos, mas em reguas diferentes - nao derivar um do outro
assert.deepEqual(['material', 'eterico', 'astral'].map(v => {
    const c = custoDaProjecao(mestre, v);
    return [c.sanidade, c.redutor];
}), [[3, 0], [4, 2], [5, 4]]);

// o bicho do Druida tambem paga: cai na PRS da ficha, sem bloco `eco`
assert.equal(custoDaProjecao({ atributos: { PRS: 6 } }, 'material').sanidade, 3);

/* ===== quais Dádivas o hóspede tem para dar: TODAS =====
 * Correção de 25/08/2026. A versão antiga travada aqui devolvia uma lista fixa
 * de sete — sem Mente e sem Perícia — e tentava ler `hospede.ecoDadiva`, campo
 * que o Painel nunca gravou com esse nome (ele grava `eco.dadiva`). Resultado
 * em mesa: duas Dádivas nunca saíam e o cadastro do Mestre não chegava a lugar
 * nenhum. Quem filtra é o DADO de cada Dádiva, não uma lista no código. */
assert.deepEqual(dadivasDoHospede(eco, 'eco'), Object.keys(DADIVAS),
    'o Eco entrega as NOVE');
assert.deepEqual(dadivasDoHospede(urso, 'aliado-animal'), Object.keys(DADIVAS),
    'o bicho também — a ficha dele é que decide o que rende');
assert.equal(dadivasDoHospede({ tipo: 'eco' }, 'eco').length, 9);

/* ===== Ancestral ===== */
assert.equal(ehAncestral({ ecoEstado: 'ancestral' }), true);
assert.equal(ehAncestral({ ecoEstado: 'Ancestral' }), true, 'caixa não importa');
assert.equal(ehAncestral({ ecoEstado: 'furioso' }), false);
assert.equal(ehAncestral(urso), false);
// o Painel grava ANINHADO; ler só o raso é por que o dobro nunca disparou
assert.equal(ehAncestral({ eco: { estado: 'ancestral' } }), true);
assert.equal(ehAncestral({ eco: { estado: 'sereno' } }), false);

/* ===== quem fica para trás ===== */
assert.deepEqual(quemFicaInerte('receptor'), { inerte: 'hospede', age: 'personagem' },
    'Receptor: o hóspede entra no personagem e o corpo dele fica parado');
assert.deepEqual(quemFicaInerte('projetor'), { inerte: 'personagem', age: 'hospede' },
    'Projetor: o personagem sai de si — o corpo DELE é que fica parado');
assert.equal(CONDICAO_TRANSE, 'Em Transe');

console.log('✅ incorporação OK — alvo validado por vínculo e tipo, custo pelo que entregou, corpo certo em transe');
