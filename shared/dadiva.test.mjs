/**
 * Dádiva — o que o Receptor ganha de quem o habita.
 *
 * A regra travada aqui:
 *   · só entra o que o hóspede tem MAIOR que o personagem, e o que entra é a
 *     SOBRA (diferença), nunca o valor cheio;
 *   · uma coisa por Dádiva — a de maior sobra — com duas exceções: Braço leva
 *     Dano E Acerto, e Boca leva atributo social, perícia social e de bardo;
 *   · Pele é a única em que categorias DIFERENTES competem, e quem desempata
 *     é a régua (§1.1): Blindagem rende por rodada, Vitalidade é reserva de
 *     uma vez, então 1 de Blindagem vale mais que 1 de Vitalidade numa cena;
 *   · Habilidade não é número: libera os módulos do hóspede;
 *   · Ancestral dobra a entrega (§9.2).
 *
 * Roda com: node shared/dadiva.test.mjs
 */
import assert from 'node:assert/strict';
import { calcularDadiva, unidadesDaSobra, TAXA, RODADAS_POR_CENA, DADIVAS } from './dadiva.js';

/* Catálogo enxuto, com os blocos REAIS do cadastro. */
const catalogo = {
    derivedValues: [
        { key: 'DANO', nome: 'Dano', blocoNome: 'Modificadores de Ataque' },
        { key: 'DANO_NATURAL', nome: 'Dano Natural', blocoNome: 'Modificadores de Ataque' },
        { key: 'ACERTO', nome: 'Acerto', blocoNome: 'Modificadores de Ataque' },
        { key: 'ACERTO_CORPO_A_CORPO', nome: 'Acerto Corpo a Corpo', blocoNome: 'Modificadores de Ataque' },
        { key: 'BLINDAGEM', nome: 'Blindagem', blocoNome: 'Combate' },
        { key: 'BLINDAGEM_NATURAL', nome: 'Blindagem Natural', blocoNome: 'Blindagem por Essência' },
        { key: 'PERCEPCAO', nome: 'Percepção', blocoNome: 'Sentidos' },
        { key: 'PERCEPCAO_OLFATIVA', nome: 'Percepção Olfativa', blocoNome: 'Sentidos' },
        { key: 'DESLOC_TERRESTRE', nome: 'Desloc. Terrestre', blocoNome: 'Deslocamento' },
        { key: 'DESLOC_AEREO', nome: 'Desloc. Aéreo', blocoNome: 'Deslocamento' },
        { key: 'VOCAL', nome: 'Vocal', blocoNome: 'Sonoromancia' },
        { key: 'LER_PUBLICO', nome: 'Ler Público', blocoNome: 'Sonoromancia' },
    ],
    pericias: [
        { nome: 'Intimidação', categoria: 'social' },
        { nome: 'Empatia', categoria: 'social' },
        { nome: 'Atletismo', categoria: 'fisico' },
    ],
};

/** Um urso: forte de corpo, cego para o resto. */
const urso = {
    vds: { DANO: 5, DANO_NATURAL: 2, ACERTO: 3, ACERTO_CORPO_A_CORPO: 6, BLINDAGEM: 6, PERCEPCAO: 4, PERCEPCAO_OLFATIVA: 9, DESLOC_TERRESTRE: 12 },
    atributos: { PRE: 2, MAN: 1, AUT: 3 },
    pericias: { Intimidação: 5, Empatia: 0 },
    vitais: { vitMax: 30, enerMax: 2 },
};
/** O Druida: melhor de cabeça, pior de carne. */
const druida = {
    vds: { DANO: 2, DANO_NATURAL: 2, ACERTO: 4, ACERTO_CORPO_A_CORPO: 4, BLINDAGEM: 2, PERCEPCAO: 3, PERCEPCAO_OLFATIVA: 1, DESLOC_TERRESTRE: 9 },
    atributos: { PRE: 4, MAN: 3, AUT: 2 },
    pericias: { Intimidação: 2, Empatia: 4 },
    vitais: { vitMax: 18, enerMax: 6 },
};

/* ===== 🦾 Braço: o melhor Dano E o melhor Acerto ===== */
const braco = calcularDadiva('braco', urso, druida, catalogo);
assert.equal(braco.ganhos.length, 2, 'Braço entrega duas coisas: dano e acerto');
const dano = braco.ganhos.find(g => g.categoria === 'Dano');
assert.equal(dano.nome, 'Dano', 'entre Dano (5 vs 2) e Dano Natural (2 vs 2), ganha a maior sobra');
assert.equal(dano.sobra, 3, 'a SOBRA, não o valor cheio do urso');
const acerto = braco.ganhos.find(g => g.categoria === 'Acerto');
assert.equal(acerto.nome, 'Acerto Corpo a Corpo',
    'o Acerto geral do urso (3) é PIOR que o do druida (4) e fica de fora; o corpo a corpo (6 vs 4) entra');
assert.equal(acerto.sobra, 2);

// Hóspede pior em TODO Acerto não empresta acerto nenhum
const soDano = calcularDadiva('braco', { ...urso, vds: { ...urso.vds, ACERTO: 1, ACERTO_CORPO_A_CORPO: 1 } }, druida, catalogo);
assert.equal(soDano.ganhos.filter(g => g.categoria === 'Acerto').length, 0,
    'hóspede pior naquilo não empresta nada');
assert.equal(soDano.ganhos.length, 1, 'mas o Dano continua vindo');

/* ===== 🛡️ Pele: Vitalidade CONTRA Blindagem, decidido pela régua ===== */
const pele = calcularDadiva('pele', urso, druida, catalogo);
assert.equal(pele.ganhos.length, 1, 'Pele entrega UMA coisa só — as duas competem');
// A conta, em vez da intuição: VIT +12 = 3,48 un · Blindagem +4 = 3,08 un
const uVit = unidadesDaSobra(12, { taxa: 'vitalidade', porRodada: false });
const uBld = unidadesDaSobra(4, { taxa: 'blindagem', porRodada: true });
assert.equal(uVit, 3.48);
assert.equal(uBld, 3.08);
assert.equal(pele.ganhos[0].nome, 'Vitalidade Máxima', 'por 0,40 de unidade, a carne do urso ganha do couro');
assert.equal(pele.ganhos[0].sobra, 12);

// Um bicho de couro grosso e pouca carne inverte a escolha
const couro = { ...urso, vds: { ...urso.vds, BLINDAGEM: 12 }, vitais: { vitMax: 19, enerMax: 2 } };
const peleCouro = calcularDadiva('pele', couro, druida, catalogo);
assert.equal(peleCouro.ganhos[0].nome, 'Blindagem', 'Blindagem +10 supera Vitalidade +1');
assert.equal(peleCouro.ganhos[0].sobra, 10);

// Vitalidade escolhida sobe MÁXIMO e ATUAL (a regra pede os dois)
const soVit = calcularDadiva('pele', { ...urso, vds: { ...urso.vds, BLINDAGEM: 0 } }, druida, catalogo);
assert.equal(soVit.ganhos[0].nome, 'Vitalidade Máxima');
assert.equal(soVit.ganhos[0].subeAtual, true, 'Vitalidade recebida sobe o Atual junto');

/* ===== 👁️ Olho: a maior sobra entre os Sentidos ===== */
const olho = calcularDadiva('olho', urso, druida, catalogo);
assert.equal(olho.ganhos.length, 1);
assert.equal(olho.ganhos[0].nome, 'Percepção Olfativa', 'o faro do urso (9 vs 1) bate a Percepção (4 vs 3)');
assert.equal(olho.ganhos[0].sobra, 8);

/* ===== 🦶 Passo: a maior sobra entre os Deslocamentos ===== */
const passo = calcularDadiva('passo', urso, druida, catalogo);
assert.equal(passo.ganhos.length, 1);
assert.equal(passo.ganhos[0].nome, 'Desloc. Terrestre');
assert.equal(passo.ganhos[0].sobra, 3);
assert.equal(passo.ganhos[0].unidades, null, 'Deslocamento está fora da régua de combate (§3.3)');

/* ===== 🗣️ Boca: atributo social + perícia social + perícia de bardo ===== */
const boca = calcularDadiva('boca', urso, druida, catalogo);
const cats = boca.ganhos.map(g => g.categoria);
assert.ok(cats.includes('Atributo social'), 'AUT do urso (3) supera o do druida (2)');
assert.equal(boca.ganhos.find(g => g.categoria === 'Atributo social').nome, 'AUT');
assert.ok(cats.includes('Perícia social'), 'Intimidação 5 vs 2');
assert.equal(boca.ganhos.find(g => g.categoria === 'Perícia social').sobra, 3);
assert.ok(!cats.includes('Perícia de bardo'), 'o urso não tem perícia de bardo — nada a emprestar');

// Um Eco de trovador empresta a de bardo também
const trovador = { vds: { VOCAL: 6, LER_PUBLICO: 2 }, atributos: { PRE: 6 }, pericias: { Empatia: 7 }, vitais: {} };
const bocaTrovador = calcularDadiva('boca', trovador, druida, catalogo);
assert.equal(bocaTrovador.ganhos.length, 3, 'as três categorias da Boca entregam');
assert.equal(bocaTrovador.ganhos.find(g => g.categoria === 'Perícia de bardo').nome, 'Vocal');

/* ===== ⚡ Energia: só a sobra do Máximo, e sobe o Atual ===== */
assert.deepEqual(calcularDadiva('energia', urso, druida, catalogo).ganhos, [],
    'urso com ENER 2 contra druida 6: não empresta fôlego nenhum');
const gordo = { ...urso, vitais: { vitMax: 30, enerMax: 10 } };
const ener = calcularDadiva('energia', gordo, druida, catalogo);
assert.equal(ener.ganhos[0].sobra, 4);
assert.equal(ener.ganhos[0].subeAtual, true);

/* ===== ✨ Habilidade: não é número, são os módulos do hóspede ===== */
const hab = calcularDadiva('habilidade', { ...urso, modulos: ['mod_urso'] }, druida, catalogo);
assert.deepEqual(hab.ganhos, [], 'Habilidade não move número');
assert.deepEqual(hab.modulos, ['mod_urso'], 'libera os módulos de classe do hóspede');
assert.equal(hab.unidades, null);

/* ===== Ancestral dobra a entrega (§9.2) ===== */
const dobro = calcularDadiva('olho', urso, druida, catalogo, { ancestral: true });
assert.equal(dobro.ganhos[0].sobra, 16, 'Ancestral dobra a sobra');
assert.equal(dobro.ganhos[0].ancestral, true);

/* ===== Nada a dar: hóspede pior em tudo ===== */
const filhote = { vds: { DANO: 0, ACERTO: 0, BLINDAGEM: 0, PERCEPCAO: 0 }, atributos: {}, pericias: {}, vitais: { vitMax: 4, enerMax: 1 } };
for (const k of ['braco', 'pele', 'olho', 'passo', 'boca', 'energia']) {
    assert.deepEqual(calcularDadiva(k, filhote, druida, catalogo).ganhos, [], `${k}: hóspede fraco não empresta nada`);
}

/* ===== As sete Dádivas existem e são as do canon ===== */
assert.deepEqual(Object.keys(DADIVAS), ['braco', 'pele', 'olho', 'passo', 'boca', 'habilidade', 'energia']);
assert.equal(TAXA.blindagem * RODADAS_POR_CENA > TAXA.vitalidade, true,
    '1 de Blindagem numa cena vale mais que 1 de Vitalidade — é o que decide a Pele');

console.log('✅ Dádiva OK — sobra e só a sobra, uma por Dádiva, Pele decidida pela régua, Ancestral dobrando');
