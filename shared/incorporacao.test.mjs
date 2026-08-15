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
import {
    porqueNaoPodeIncorporar, custoEscalonado, dadivasDoHospede, ehAncestral,
    quemFicaInerte, ORCAMENTO_BASE, UNIDADES_POR_SANIDADE, CONDICAO_TRANSE,
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

/* ===== quais Dádivas o hóspede tem para dar ===== */
// o Eco declara UMA no cadastro, e ainda empresta o que sabe e o fôlego
assert.deepEqual(dadivasDoHospede(eco, 'eco'), ['braco', 'habilidade', 'energia']);
// um bicho não declara: empresta o que ele é, e vale o que render sobra
assert.deepEqual(dadivasDoHospede(urso, 'aliado-animal'),
    ['braco', 'pele', 'olho', 'passo', 'boca', 'habilidade', 'energia']);
// Eco sem Dádiva cadastrada cai na lista cheia em vez de não dar nada
assert.equal(dadivasDoHospede({ tipo: 'eco' }, 'eco').length, 7);

/* ===== Ancestral ===== */
assert.equal(ehAncestral({ ecoEstado: 'ancestral' }), true);
assert.equal(ehAncestral({ ecoEstado: 'Ancestral' }), true, 'caixa não importa');
assert.equal(ehAncestral({ ecoEstado: 'furioso' }), false);
assert.equal(ehAncestral(urso), false);

/* ===== quem fica para trás ===== */
assert.deepEqual(quemFicaInerte('receptor'), { inerte: 'hospede', age: 'personagem' },
    'Receptor: o hóspede entra no personagem e o corpo dele fica parado');
assert.deepEqual(quemFicaInerte('projetor'), { inerte: 'personagem', age: 'hospede' },
    'Projetor: o personagem sai de si — o corpo DELE é que fica parado');
assert.equal(CONDICAO_TRANSE, 'Em Transe');

console.log('✅ incorporação OK — alvo validado por vínculo e tipo, custo pelo que entregou, corpo certo em transe');
