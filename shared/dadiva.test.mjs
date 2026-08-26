/**
 * Dádiva — o que o Receptor ganha de quem o habita.
 *
 * A regra travada aqui (reforma de 18/08/2026):
 *   · TODA Dádiva SORTEIA um candidato do seu grupo — o Eco não entrega o
 *     melhor dele, entrega o que calhou. Duas incorporações do mesmo Eco não
 *     são iguais;
 *   · o valor sorteado é SOMADO ao do personagem, inteiro, seja ele maior ou
 *     menor. Não há comparação e não há sobra: quem segura é só o teto;
 *   · TETO: o resultado não passa do teto do personagem naquele atributo ou
 *     perícia — 5 sem Aura, o que a Aura permitir com ela, e o teto racial
 *     vence tudo. O excedente descarta, não transborda nem fica guardado;
 *   · a Pele sorteia entre Vitalidade, Blindagem e Blindagem Arcana, e cada
 *     candidato carrega a SUA taxa na régua;
 *   · Habilidade não é número: libera os módulos do hóspede;
 *   · Ancestral dobra (§9.2), mas DEPOIS do teto — não passa por cima dele.
 *
 * E a regra de 25/08/2026, que fechou o buraco:
 *   · o hóspede entrega as NOVE Dádivas — a lista velha devolvia sete, sem Mente
 *     e sem Perícia, e ainda lia um campo que o Painel nunca gravou;
 *   · cada Dádiva rola UM dado com `n+1` saídas: os n candidatos e o NENHUM.
 *     Receber a Dádiva não é receber vantagem — a sorte pode anular.
 *
 * Roda com: node shared/dadiva.test.mjs
 */
import assert from 'node:assert/strict';
import { calcularDadiva, unidadesDaSobra, tetoDoAtributo, TAXA, RODADAS_POR_CENA, DADIVAS, ATRIBUTOS, TETO_SEM_AURA,
    dadoSugerido, candidatoDoDado, mesaDeSorteio, rolarSorteio } from './dadiva.js';
import { dadivasDoHospede, ehAncestral } from './incorporacao.js';

/* ═══ o teto sai da Aura, não de número solto ═══ */
const AURAS = [
    { id: 'aura_for1', propriedadeTipo: 'atributo', propriedadeVinculada: 'FOR' },
    { id: 'aura_for2', propriedadeTipo: 'atributo', propriedadeVinculada: 'FOR' },
    { id: 'aura_int1', propriedadeTipo: 'atributo', propriedadeVinculada: 'INT' },
];
assert.equal(tetoDoAtributo('FOR'), 5, 'sem Aura o teto é 5');
assert.equal(tetoDoAtributo('FOR', { catalogoAuras: AURAS, auras: { aura_for1: { grauDesbloqueado: 1 } } }), 6,
    'Yotun com Aura de Força I chega a 6');
assert.equal(tetoDoAtributo('FOR', {
    catalogoAuras: AURAS, auras: { aura_for1: { grauDesbloqueado: 1 }, aura_for2: { grauDesbloqueado: 3 } },
}), 8, 'duas Auras no mesmo atributo: vale o MAIOR grau, não a soma');
assert.equal(tetoDoAtributo('DES', { catalogoAuras: AURAS, auras: { aura_for1: { grauDesbloqueado: 1 } } }), 5,
    'Aura de Força não levanta a Destreza');
assert.equal(tetoDoAtributo('FOR', { tetoRacial: { FOR: 3 } }), 3, 'teto racial declarado vence (Pogo)');

/* Sorteio determinístico: escolhe o candidato de chave X, senão o primeiro. */
const escolhe = (chave) => (arr) => arr.find(c => c.chave === chave) || arr[0];

// Sem campo `key`: os docs reais de derivedValues não têm um, então a chave da
// ficha achatada é o próprio NOME (ver achatarFicha em tab-turno.js).
const catalogo = {
    derivedValues: [
        { nome: 'Blindagem', blocoNome: 'Combate' },
        { nome: 'Blindagem Arcana', blocoNome: 'Combate' },
        { nome: 'Percepção', blocoNome: 'Sentidos' },
        { nome: 'Percepção Olfativa', blocoNome: 'Sentidos' },
        { nome: 'Desloc. Terrestre', blocoNome: 'Deslocamento' },
    ],
    pericias: [
        { nome: 'Intimidação', categoria: 'social' },
        { nome: 'Empatia', categoria: 'social' },
        { nome: 'Atletismo', categoria: 'fisico' },
    ],
};

/** Um urso: forte de corpo, cego para o resto. */
const urso = {
    vds: { 'Blindagem': 6, 'Percepção': 4, 'Percepção Olfativa': 9, 'Desloc. Terrestre': 12 },
    atributos: { FOR: 6, DES: 2, VIG: 5, INT: 1, RAC: 1, PRS: 2, PRE: 2, MAN: 1, AUT: 3 },
    pericias: { Intimidação: 5, Empatia: 0, Atletismo: 6 },
    vitais: { vitMax: 30, enerMax: 2 },
};
/** O Druida: melhor de cabeça, pior de carne. */
const druida = {
    vds: { 'Blindagem': 2, 'Percepção': 3, 'Percepção Olfativa': 1, 'Desloc. Terrestre': 9 },
    atributos: { FOR: 2, DES: 3, VIG: 2, INT: 4, RAC: 4, PRS: 3, PRE: 4, MAN: 3, AUT: 2 },
    pericias: { Intimidação: 2, Empatia: 4, Atletismo: 3 },
    vitais: { vitMax: 18, enerMax: 6 },
};

/* ═══ os três grupos de atributo ═══ */
assert.deepEqual(ATRIBUTOS.fisico, ['FOR', 'DES', 'VIG']);
assert.deepEqual(ATRIBUTOS.mental, ['INT', 'RAC', 'PRS']);
assert.deepEqual(ATRIBUTOS.social, ['PRE', 'MAN', 'AUT']);

/* ═══ 🦾 Braço sorteia UM atributo físico — e SOMA o valor do Eco ═══ */
const forca = calcularDadiva('braco', urso, druida, catalogo, { sorteio: escolhe('FOR') });
assert.equal(forca.ganhos.length, 1, 'uma coisa só: o que foi sorteado');
assert.equal(forca.ganhos[0].nome, 'FOR');
// 🔒 No sorteio NÃO existe sobra: soma-se o valor cheio do Eco.
// urso FOR 6 sobre druida FOR 2 daria 8; o teto padrão de 5 corta em 3.
assert.equal(forca.ganhos[0].sobra, 3, 'somaria 6, o teto de 5 deixa entrar 3');
assert.equal(forca.ganhos[0].doHospede, 6);
assert.equal(forca.ganhos[0].cortadoPeloTeto, true);

// 🔒 sorteou DES, em que o urso é PIOR — ENTRA ASSIM MESMO.
// É o que separa a Dádiva sorteada da escolhida: aqui não há comparação.
const des = calcularDadiva('braco', urso, druida, catalogo, { sorteio: escolhe('DES') });
assert.equal(des.ganhos.length, 1, 'hóspede pior no atributo sorteado entrega mesmo assim');
assert.equal(des.ganhos[0].nome, 'DES');
assert.equal(des.ganhos[0].sobra, 2, 'DES 3 do druida + DES 2 do urso = 5, exatamente o teto');
assert.equal(des.ganhos[0].doPersonagem + des.ganhos[0].sobra, 5);

// Eco com 0 naquilo não tem o que somar
const vazio = calcularDadiva('braco', { ...urso, atributos: { ...urso.atributos, VIG: 0 } },
    druida, catalogo, { sorteio: escolhe('VIG') });
assert.deepEqual(vazio.ganhos, [], 'Eco com 0 no atributo sorteado não soma nada');

/* ═══ 🧠 Mente é nova — o urso é burro, e ainda assim soma ═══ */
assert.ok(DADIVAS.mente, 'a Dádiva Mente existe');
const mente = calcularDadiva('mente', urso, druida, catalogo, { sorteio: escolhe('RAC') });
assert.equal(mente.ganhos[0].nome, 'RAC');
assert.equal(mente.ganhos[0].sobra, 1, 'druida RAC 4 + urso RAC 1 = 5, o teto');
assert.equal(mente.ganhos[0].cortadoPeloTeto, false, 'coube exatamente, sem corte');
// INT: druida 4 + urso 1 = 5, também no teto
assert.equal(calcularDadiva('mente', urso, druida, catalogo, { sorteio: escolhe('INT') }).ganhos[0].sobra, 1);
// PRS: druida 3 + urso 2 = 5
assert.equal(calcularDadiva('mente', urso, druida, catalogo, { sorteio: escolhe('PRS') }).ganhos[0].sobra, 2);

/* ═══ ⛔ TETO: o herdado não passa de 5 sem Aura ═══ */
assert.equal(TETO_SEM_AURA, 5);
assert.equal(forca.ganhos[0].doPersonagem + forca.ganhos[0].sobra, 5,
    'o resultado para EXATAMENTE no teto, nunca acima');

// Aura de Força abre espaço: Yotun chega a 6
const yotun = calcularDadiva('braco', urso, druida, catalogo,
    { sorteio: escolhe('FOR'), teto: (s) => (s === 'FOR' ? 6 : 5) });
assert.equal(yotun.ganhos[0].sobra, 4, 'teto 6: 2 + 4 = 6');
assert.equal(yotun.ganhos[0].cortadoPeloTeto, true, 'somaria 6 do urso, coube 4');

// Pogo tem teto 3: personagem já em 2 só recebe 1
const pogo = calcularDadiva('braco', urso, druida, catalogo,
    { sorteio: escolhe('FOR'), teto: () => 3 });
assert.equal(pogo.ganhos[0].sobra, 1);

// personagem JÁ no teto não recebe nada
const noTeto = { ...druida, atributos: { ...druida.atributos, FOR: 5 } };
assert.deepEqual(calcularDadiva('braco', urso, noTeto, catalogo,
    { sorteio: escolhe('FOR'), teto: () => 5 }).ganhos, [], 'no teto, o excedente descarta');

/* ═══ 🎓 Perícia: uma sorteada de CADA TIPO ═══ */
// O catálogo tem duas categorias (social, fisico), então saem até dois ganhos.
const per = calcularDadiva('pericia', urso, druida, catalogo, { sorteio: escolhe('Atletismo') });
assert.equal(per.ganhos.length, 2, 'uma por categoria de perícia do cadastro');
assert.deepEqual(per.ganhos.map(g => g.categoria).sort(), ['Perícia fisico', 'Perícia social']);
const atl = per.ganhos.find(g => g.nome === 'Atletismo');
assert.equal(atl.sobra, 2, 'druida 3 + urso 6 = 9, o teto de 5 deixa 2');

// categoria em que o Eco não tem NADA simplesmente não aparece
const soFisico = calcularDadiva('pericia',
    { ...urso, pericias: { Intimidação: 0, Empatia: 0, Atletismo: 6 } },
    druida, catalogo, { sorteio: escolhe('Atletismo') });
assert.equal(soFisico.ganhos.length, 1, 'Eco sem perícia social não entrega a social');
assert.equal(soFisico.ganhos[0].nome, 'Atletismo');

// 🔒 O sorteio é entre as perícias que o ECO TEM, não entre todas do catálogo.
// Com `a[0]` (sempre o primeiro candidato) um Eco que só tem Empatia ainda
// entrega Empatia — porque Intimidação nem entra na urna.
const soEmpatia = calcularDadiva('pericia',
    { ...urso, pericias: { Intimidação: 0, Empatia: 5, Atletismo: 0 } },
    druida, catalogo, { sorteio: a => a[0] });
assert.equal(soEmpatia.ganhos.length, 1);
assert.equal(soEmpatia.ganhos[0].nome, 'Empatia',
    'sortear no catálogo inteiro daria Intimidação, que o Eco não tem');
// perícia também respeita o teto (Livro: perícia vai até 5, acima só com Aura)
const perAlta = calcularDadiva('pericia', { ...urso, pericias: { ...urso.pericias, Atletismo: 20 } },
    druida, catalogo, { sorteio: escolhe('Atletismo'), teto: () => 5 });
assert.equal(perAlta.ganhos.find(g => g.nome === 'Atletismo').sobra, 2,
    'Eco de Atletismo 20 não fura o teto de perícia: druida 3 → cabem 2');

/* ═══ 🛡️ Pele sorteia entre carne, couro e couro arcano — e SOMA ═══ */
const carne = calcularDadiva('pele', urso, druida, catalogo, { sorteio: escolhe('VIT') });
assert.equal(carne.ganhos[0].nome, 'Vitalidade Máxima');
assert.equal(carne.ganhos[0].sobra, 30, 'soma a Vitalidade CHEIA do urso, não a sobra');
assert.equal(carne.ganhos[0].subeAtual, true, 'Vitalidade recebida sobe o Atual junto');
assert.equal(carne.ganhos[0].unidades, 7.68, '30 × 0,256 — Vitalidade é reserva, não rende por rodada');

const couro = calcularDadiva('pele', urso, druida, catalogo, { sorteio: escolhe('Blindagem') });
assert.equal(couro.ganhos[0].sobra, 6, 'a Blindagem cheia do urso');
assert.equal(couro.ganhos[0].unidades, 4.62, '6 × 0,154 × 5 rodadas — taxa PRÓPRIA do candidato');

// 🔒 vitalidade e blindagem têm taxas diferentes e cada candidato carrega a sua
assert.notEqual(carne.ganhos[0].unidades, couro.ganhos[0].unidades);
assert.equal(unidadesDaSobra(12, { taxa: 'vitalidade', porRodada: false }), 3.072, 'base 3,90');
assert.equal(unidadesDaSobra(4, { taxa: 'blindagem', porRodada: true }), 3.08);

// a terceira via: Blindagem Arcana, que não existe na ficha do urso
assert.deepEqual(calcularDadiva('pele', urso, druida, catalogo,
    { sorteio: escolhe('Blindagem Arcana') }).ganhos, [], 'urso sem Blindagem Arcana não soma nada');

/* ═══ 👁️ Olho e 🦶 Passo também sorteiam ═══ */
const faro = calcularDadiva('olho', urso, druida, catalogo, { sorteio: escolhe('Percepção Olfativa') });
assert.equal(faro.ganhos[0].sobra, 9, 'o faro cheio do urso, não a diferença');
const passo = calcularDadiva('passo', urso, druida, catalogo, { sorteio: escolhe('Desloc. Terrestre') });
assert.equal(passo.ganhos[0].sobra, 12);
assert.equal(passo.ganhos[0].unidades, null, 'Deslocamento está fora da régua de combate (§3.3)');

/* ═══ ⚡ Energia: §11.3 — devolvido ≤ gasto ═══ */
// 🔒 FALHA FECHADA: sem custoRecurso informado, nada é devolvido. Devolver por
// omissão reabriria o motor perpétuo (custo 2, Eco com pool 7 → +7).
assert.deepEqual(calcularDadiva('energia', urso, druida, catalogo, { sorteio: a => a[0] }).ganhos, [],
    'sem custoRecurso o teto é 0 — não devolve nada');

const gordo = { ...urso, vitais: { vitMax: 30, enerMax: 7 } };
const cai1 = { sorteio: a => a[0] };   // o dado nao e o assunto aqui: mede o teto do §11.3
const ener = calcularDadiva('energia', gordo, druida, catalogo, { custoRecurso: 2, ...cai1 });
assert.equal(ener.ganhos[0].sobra, 2, 'Eco com pool 7, habilidade custou 2: devolve 2, não 7');
assert.equal(ener.ganhos[0].cortadoPeloTeto, true);
assert.equal(ener.ganhos[0].subeAtual, true, 'Energia recebida sobe o Atual junto');

// Eco pobre devolve menos que o custo — o teto é máximo, não piso
const magro = { ...urso, vitais: { vitMax: 30, enerMax: 1 } };
assert.equal(calcularDadiva('energia', magro, druida, catalogo, { custoRecurso: 2, ...cai1 }).ganhos[0].sobra, 1);

/* ═══ ✨ Habilidade não é número ═══ */
const hab = calcularDadiva('habilidade', { ...urso, modulos: ['mod_urso'] }, druida, catalogo);
assert.deepEqual(hab.modulos, ['mod_urso']);

/* ═══ ✨ Ancestral dobra, mas o teto vem DEPOIS ═══ */
const dobro = calcularDadiva('olho', urso, druida, catalogo,
    { sorteio: escolhe('Percepção Olfativa'), ancestral: true });
assert.equal(dobro.ganhos[0].sobra, 18, 'faro 9 do urso, dobrado — Sentidos não têm teto');
const dobroCapado = calcularDadiva('braco', urso, druida, catalogo,
    { sorteio: escolhe('FOR'), teto: () => 5, ancestral: true });
assert.equal(dobroCapado.ganhos[0].sobra, 3,
    '🔒 o dobro do Ancestral NÃO fura o teto — 2 + 3 = 5, e para aí');

/* ═══ as oito Dádivas ═══ */
assert.deepEqual(Object.keys(DADIVAS),
    ['braco', 'mente', 'pele', 'olho', 'passo', 'boca', 'pericia', 'habilidade', 'energia']);
assert.equal(TAXA.blindagem * RODADAS_POR_CENA > TAXA.vitalidade, true);

/* ═══ 🎲 O DADO TEM FACE DE NENHUM (regra de 25/08/2026) ═══
 * Receber a Dádiva não é receber vantagem. O dado é o MENOR padrão com mais
 * faces que candidatos, e toda face acima do último candidato ANULA. */
assert.deepEqual(dadoSugerido(3), { faces: 4, rotulo: '1d4', candidatos: 3, nenhumEm: 4, rerrolaAcimaDe: null },
    '3 atributos → 1d4, e o 4 não é nenhum dos três');
assert.deepEqual(dadoSugerido(5), { faces: 6, rotulo: '1d6', candidatos: 5, nenhumEm: 6, rerrolaAcimaDe: null });
assert.equal(dadoSugerido(6).rotulo, '1d8', '6 Sentidos não cabem em d7');
assert.equal(dadoSugerido(6).nenhumEm, 7, 'o 7 é o nenhum');
assert.equal(dadoSugerido(6).rerrolaAcimaDe, 7, '🔒 e o 8 RERROLA — o nenhum vale uma saída só, nunca 25%');
assert.equal(dadoSugerido(1).nenhumEm, 2, 'candidato único é cara ou coroa: 1d4 rerrolando acima de 2');

const tresAtributos = [{ chave: 'FOR' }, { chave: 'DES' }, { chave: 'VIG' }];
assert.equal(candidatoDoDado(tresAtributos, 1).chave, 'FOR', 'face 1 = primeiro da lista');
assert.equal(candidatoDoDado(tresAtributos, 3).chave, 'VIG');
assert.equal(candidatoDoDado(tresAtributos, 4), null, '🔒 a face que sobra ANULA a Dádiva');
assert.equal(candidatoDoDado(tresAtributos, 0), null, 'fora de faixa também é nenhum');

/* a chance de anular é sempre 1 em (n+1), nunca refem do dado disponível */
for (const k of [1, 2, 3, 5, 6, 9, 11]) {
    const d = dadoSugerido(k);
    const saidas = d.rerrolaAcimaDe ?? d.faces;
    assert.equal(saidas, k + 1, `🔒 ${k} candidatos → ${k + 1} saídas, uma delas nenhum`);
}

/* rolarSorteio nunca devolve face que a mesa mandaria rerrolar */
for (const k of [0, 1, 3, 6, 11]) {
    const vistos = new Set();
    for (let i = 0; i < 400; i++) vistos.add(rolarSorteio(k));
    assert.equal(Math.min(...vistos), 1, k + ': face minima 1');
    assert.equal(Math.max(...vistos), k + 1,
        k + ': nunca passa de ' + (k + 1) + ' - o rerrolar ja esta embutido');
}

/* dado que anula → a Dádiva vem VAZIA, e isso não é erro */
const anulada = calcularDadiva('braco', urso, druida, catalogo, { sorteio: () => null });
assert.deepEqual(anulada.ganhos, [], 'sorteio nulo devolve Dádiva sem ganho, sem estourar');

/* ═══ a mesa de sorteio que o Mestre vê ═══ */
const mesa = mesaDeSorteio(['braco', 'habilidade'], urso, catalogo);
assert.equal(mesa.length, 1, 'Habilidade não entra na mesa: vem inteira, não rola');
assert.equal(mesa[0].dado.rotulo, '1d4');
assert.deepEqual(mesa[0].candidatos.map(c => c.n), [1, 2, 3], 'candidatos numerados a partir de 1');

/* ═══ 🔒 TODAS as nove chegam ao hóspede ═══
 * A versão antiga devolvia sete (sem Mente e sem Perícia) e ainda lia um campo
 * que o Painel nunca gravou. Se este assert cair, duas Dádivas sumiram de novo. */
assert.deepEqual(dadivasDoHospede({}, 'eco'), Object.keys(DADIVAS),
    '🔒 o hóspede entrega as NOVE — quem filtra é o dado, não uma lista no código');
assert.equal(dadivasDoHospede({}, 'aliado-animal').length, 9, 'o bicho também: o sorteio decide');

/* ═══ Ancestral: o Painel grava aninhado ═══ */
assert.equal(ehAncestral({ eco: { estado: 'ancestral' } }), true, '🔒 lê `eco.estado` do Painel');
assert.equal(ehAncestral({ ecoEstado: 'Ancestral' }), true, 'e o raso antigo continua valendo');
assert.equal(ehAncestral({ eco: { estado: 'sereno' } }), false);

console.log('✅ Dádiva OK — tudo por sorteio, valor SOMADO (não sobra), teto cortando inclusive o Ancestral');
