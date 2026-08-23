// Rodar: node shared/alcance-disparo.test.mjs
// A arma tem capacidade; o atirador tem braço. Vale o menor dos dois — menos
// para a besta, que é armada por manivela antes do tiro.
import assert from 'node:assert/strict';
import { alcanceDeDisparo, melhorDisparo, linhasDeDisparo, bracoDeArremesso, METROS_POR_FOR } from './alcance-disparo.js';

const ARCO_LONGO = { nome: 'Arco Longo', alcanceM: 60, distancia: true };
const ARCO_SIMPLES = { nome: 'Arco Simples', alcanceM: 30, distancia: true };
const BESTA_PESADA = { nome: 'Besta Pesada', alcanceM: 45, distancia: true, ignoraLimiteForDisparo: true };

/* ═══ a âncora ═══ */
assert.equal(METROS_POR_FOR, 10, '1 ponto de FOR = 1 Deslocamento terrestre da linha de base');

/* ═══ o braço é o gargalo ═══ */
// FOR 1 com Arco Longo: a arma alcança 60, o sujeito arma 10.
const fraco = alcanceDeDisparo(ARCO_LONGO, 1);
assert.equal(fraco.metros, 10);
assert.equal(fraco.limitadoPorFor, true, 'a tela precisa saber que quem cortou foi a FOR');
assert.equal(fraco.capacidadeDaArma, 60);

// FOR 3 (a mediana das fichas) com Arco Simples: 30 de arma vs 30 de braço.
assert.equal(alcanceDeDisparo(ARCO_SIMPLES, 3).metros, 30);
assert.equal(alcanceDeDisparo(ARCO_SIMPLES, 3).limitadoPorFor, false, 'empate não é limite');

/* ═══ a arma é o gargalo ═══ */
// FOR 10 com Arco Simples: o braço daria 100, a arma só entrega 30.
const forte = alcanceDeDisparo(ARCO_SIMPLES, 10);
assert.equal(forte.metros, 30);
assert.equal(forte.limitadoPorFor, false, 'aqui quem cortou foi a arma, não a FOR');

/* ═══ a besta ignora o braço ═══ */
// É o que dá identidade: a arma de tiro de quem não tem Força.
assert.equal(alcanceDeDisparo(BESTA_PESADA, 1).metros, 45, 'manivela não depende de FOR');
assert.equal(alcanceDeDisparo(BESTA_PESADA, 1).limitadoPorFor, false);
assert.equal(alcanceDeDisparo(BESTA_PESADA, 10).metros, 45, 'nem FOR alta passa da arma');
// e o FOR 1 de besta bate o FOR 3 de arco simples — a troca é essa, de propósito
assert.ok(alcanceDeDisparo(BESTA_PESADA, 1).metros > alcanceDeDisparo(ARCO_SIMPLES, 3).metros);

/* ═══ arma sem alcance cadastrado não vira alcance infinito ═══ */
// Era o estado do catálogo inteiro antes desta frente: 13 armas com o campo
// vazio. Tem que dar 0 e a mira não abrir, nunca "ilimitado".
assert.equal(alcanceDeDisparo({ alcanceM: null }, 5).metros, 0);
assert.equal(alcanceDeDisparo({}, 5).metros, 0);
assert.equal(alcanceDeDisparo({ alcanceM: 0, ignoraLimiteForDisparo: true }, 5).metros, 0,
    'nem a besta escapa: sem capacidade cadastrada não há tiro');

/* ═══ o melhor disparo em mãos ═══ */
const linhas = [
    { nome: 'Estilete', distancia: false, alcanceM: 0.5 },
    ARCO_SIMPLES,
    BESTA_PESADA,
];
assert.deepEqual(melhorDisparo(linhas, 2), { metros: 45, arma: 'Besta Pesada', limitadoPorFor: false },
    'FOR 2: o arco cai para 20, a besta mantém 45');
// Com FOR 2 os DOIS arcos caem para 20: o braço corta antes da arma, e o arco
// caro não rende nada a mais na mão de quem não tem Força. É o efeito que a
// escolha de 10 m/FOR compra — e o motivo de a besta existir.
const doisArcos = melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 2);
assert.equal(doisArcos.metros, 20);
assert.equal(doisArcos.limitadoPorFor, true);
assert.equal(alcanceDeDisparo(ARCO_LONGO, 2).metros, alcanceDeDisparo(ARCO_SIMPLES, 2).metros,
    'FOR 2: Arco Longo e Arco Simples empatam — a FOR apagou a diferença entre eles');
// e basta FOR 4 para o Longo voltar a valer mais que o Simples
assert.equal(melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 4).arma, 'Arco Longo');
assert.equal(melhorDisparo([ARCO_LONGO, ARCO_SIMPLES], 4).metros, 40);
assert.equal(melhorDisparo([{ nome: 'Adaga', distancia: false, alcanceM: 0.5 }], 5).metros, 0,
    'só arma de corpo a corpo: não há disparo');

/* ═══ bordas ═══ */
assert.equal(alcanceDeDisparo(ARCO_LONGO, 0).metros, 0, 'FOR 0 não atira');
assert.equal(alcanceDeDisparo(ARCO_LONGO, -3).metros, 0, 'FOR negativa não vira alcance');
assert.equal(alcanceDeDisparo(null, 5).metros, 0);
assert.equal(melhorDisparo(null, 5).metros, 0);
assert.equal(melhorDisparo([], 5).arma, null);

/* ═══ inventário cru → linhas de disparo (ficha e NPC usam o mesmo) ═══ */
const CAT = [
    { id: 'tpl_arco', categoriaArma: 'distancia', alcanceM: 60 },
    { id: 'tpl_besta', categoriaArma: 'distancia', alcanceM: 30, ignoraLimiteForDisparo: true },
    { id: 'tpl_adaga', categoriaArma: 'leve', alcanceM: 0.5 },
];
const INV = [
    { nome: 'Arco Longo', modeloId: 'tpl_arco', equipado: true },
    { nome: 'Adaga', modeloId: 'tpl_adaga', equipado: true },          // não é disparo
    { nome: 'Besta guardada', modeloId: 'tpl_besta', equipado: false }, // na mochila
    { nome: 'Besta velha', origemTemplateId: 'tpl_besta', equipado: true }, // item LEGADO
];
const ls = linhasDeDisparo(INV, CAT);
assert.deepEqual(ls.map(l => l.nome), ['Arco Longo', 'Besta velha'],
    'só arma de disparo EQUIPADA entra');
assert.equal(ls[1].alcanceM, 30, 'item legado acha o modelo por origemTemplateId');
assert.equal(ls[1].ignoraLimiteForDisparo, true, 'e herda o "ignora FOR" do modelo');

// instância vence modelo (arco encantado com alcance próprio)
assert.equal(linhasDeDisparo([{ nome: 'Arco+', modeloId: 'tpl_arco', equipado: true, alcanceM: 80 }], CAT)[0].alcanceM, 80);
// sem catálogo não explode
assert.deepEqual(linhasDeDisparo([{ nome: 'X', modeloId: 'tpl_arco', equipado: true }], null), []);
assert.deepEqual(linhasDeDisparo(null, CAT), []);

// e o fim a fim: esse inventário com FOR 2 rende a besta legada (30), não o arco
assert.equal(melhorDisparo(ls, 2).arma, 'Besta velha');
assert.equal(melhorDisparo(ls, 2).metros, 30);

/* ═══ 🤾 arremesso: quem tem alcance é o braço, não a peça ═══ */
// N por grupo: 0,75 curto (machadinha, boleadeira, frasco), 1,0 adaga/faca,
// 1,5 haste. O braço é FOR + Atletismo + Arremessar.
const ADAGA_ARR = { nome: 'Adaga', distancia: false, alcanceM: 0, alcanceFator: 1 };
const LANCA_ARR = { nome: 'Lança', distancia: false, alcanceM: 0, alcanceFator: 1.5 };
const MACHADINHA = { nome: 'Machadinha', distancia: false, alcanceM: 0, alcanceFator: 0.75 };

assert.equal(bracoDeArremesso(4, 2, 3), 9, 'FOR + Atletismo + Arremessar');
assert.equal(bracoDeArremesso(2, null, undefined), 2, 'perícia faltando não vira NaN');

// competente (braço 9): a ordem que o design pediu — haste > adaga > machadinha
assert.equal(alcanceDeDisparo(ADAGA_ARR, 4, 9).metros, 9);
assert.equal(alcanceDeDisparo(LANCA_ARR, 4, 9).metros, 13.5);
assert.equal(alcanceDeDisparo(MACHADINHA, 4, 9).metros, 6.75);

// o teto do catálogo: nem o veterano (braço 13) passa a Funda, que tem 20 m
assert.ok(alcanceDeDisparo(LANCA_ARR, 4, 13).metros < 20,
    'lança arremessada não pode bater arma de disparo');

// FOR × 10 NÃO corta o arremesso: a Força já está dentro do braço
assert.equal(alcanceDeDisparo(LANCA_ARR, 1, 9).limitadoPorFor, false);
assert.equal(alcanceDeDisparo(LANCA_ARR, 1, 9).metros, 13.5, 'FOR 1 não corta em 10 m');

// braço zerado é 0 m, nunca "ilimitado" — mesma regra do alcance não cadastrado
assert.equal(alcanceDeDisparo(ADAGA_ARR, 4, 0).metros, 0);
assert.equal(alcanceDeDisparo(ADAGA_ARR, 4).metros, 0, 'sem braço informado não inventa alcance');

// entra no melhor disparo mesmo sendo linha corpo a corpo (distancia: false)
assert.equal(melhorDisparo([ADAGA_ARR], 4, 9).arma, 'Adaga');
// mas o arco continua ganhando de qualquer arremesso, que é o desenho
assert.equal(melhorDisparo([ADAGA_ARR, ARCO_SIMPLES], 4, 9).arma, 'Arco Simples');

// nada disso mexe em quem não tem alcanceFator
assert.equal(alcanceDeDisparo(ARCO_SIMPLES, 3, 99).metros, 30, 'braço não afeta arma de disparo');
assert.equal(melhorDisparo([{ nome: 'Adaga', distancia: false, alcanceM: 0.5 }], 5, 9).metros, 0,
    'adaga SEM alcanceFator continua sem disparo');

// inventário cru: peça de arremesso equipada entra, guardada não
const CAT_ARR = [...CAT, { id: 'tpl_adaga_arr', categoriaArma: 'uma_mao', alcanceFator: 1 }];
const lsArr = linhasDeDisparo([
    { nome: 'Adaga de Arremesso', modeloId: 'tpl_adaga_arr', equipado: true },
    { nome: 'Adaga na bota', modeloId: 'tpl_adaga_arr', equipado: false },
    { nome: 'Adaga comum', modeloId: 'tpl_adaga', equipado: true },
], CAT_ARR);
assert.deepEqual(lsArr.map(l => l.nome), ['Adaga de Arremesso']);
assert.equal(lsArr[0].alcanceFator, 1, 'o fator desce do modelo para a linha');

console.log('✅ alcance-disparo: braço e arma como gargalo, besta livre da FOR, campo vazio = sem tiro, melhor arma em mãos, arremesso pelo braço OK');
