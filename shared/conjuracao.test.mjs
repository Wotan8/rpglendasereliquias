// Rodar: node shared/conjuracao.test.mjs
// O caso que originou tudo: Vespa, a Voz Dourada, com Rabeca equipada, usando
// GRITO DISSONANTE [V, S]. O Tabuleiro oferecia Estilete, Cabeça, Pernas, Pé e
// Braço — nenhum deles conjura, e o Acerto de todos era 0. O que decide agora
// é isto aqui.
import assert from 'node:assert/strict';
import { avaliarFormas, formaDoVd } from './conjuracao.js';

/* ═══ o cadastro, como o Criador grava ═══ */
const VOCAL = 'vd_vocal', CORDA = 'vd_corda', PERC = 'vd_perc', SOPRO = 'vd_sopro';

const FORMAS = [
    {
        id: 'f_vocal', nome: 'Vocal', icone: '🗣️', derivedValueIds: [VOCAL],
        requisito: 'parte_corpo', partesDoCorpoNomes: ['Cabeça'],
        condicoesBloqueiam: ['c_afogando', 'c_silenciado'],
    },
    {
        id: 'f_sopro', nome: 'Inst. Sopro', icone: '🎺', derivedValueIds: [SOPRO],
        requisito: 'item_tag', itemTags: ['instrumento-sopro'],
    },
    {
        id: 'f_corda', nome: 'Inst. Corda', icone: '🪕', derivedValueIds: [CORDA],
        requisito: 'item_tag', itemTags: ['instrumento-corda'],
    },
    { id: 'f_bencao', nome: 'Bênção', icone: '✨', derivedValueIds: ['vd_bencao'], requisito: 'nenhum' },
];

const COND_NOME = { c_afogando: 'Afogando', c_silenciado: 'Silenciado' };

// GRITO DISSONANTE [V, S] — as colunas Vocal e Sopro preenchidas, Corda e
// Percussão vazias. É exatamente o que está gravado no módulo sonoro_c1.
const GRITO = [
    { vdId: VOCAL, label: 'Vocal', vdNome: 'Vocal' },
    { vdId: SOPRO, label: 'Inst. Sopro', vdNome: 'Inst. Sopro' },
];

const ACERTOS = { Vocal: 7, 'Inst. Sopro': 6, 'Inst. Cordas': 5, Bênção: 8 };

/** Contexto de mesa. Por padrão: Vespa com Rabeca (corda) e Flauta (sopro). */
function ctx(over = {}) {
    return {
        acertoDoVd: n => ACERTOS[n] ?? null,
        condicoes: [],
        condicaoPorId: id => COND_NOME[id] || null,
        itensEquipados: [
            { nome: 'Rabeca', tags: ['instrumento-corda'] },
            { nome: 'Flauta de Osso', tags: ['instrumento-sopro'] },
            { nome: 'Estilete', tags: ['arma', 'perfurante'] },
        ],
        partesInteiras: ['Cabeça', 'Braço', 'Perna', 'Pé'],
        ...over,
    };
}

/* ═══ o bug original ═══ */
const base = avaliarFormas(GRITO, FORMAS, ctx());
assert.equal(base.length, 2, 'a magia [V, S] oferece DUAS formas, não cinco partes do corpo');
assert.deepEqual(base.map(f => f.nome), ['Vocal', 'Inst. Sopro']);
assert.equal(base.every(f => !f.indisponivel), true, 'com boca e flauta, as duas valem');
// e o Acerto deixa de ser 0: sai do VD da forma
assert.equal(base[0].acerto, 7);
assert.equal(base[1].acerto, 6);

/* ═══ condição que cala a voz — o Afogando virando regra ═══ */
const afogada = avaliarFormas(GRITO, FORMAS, ctx({ condicoes: ['Afogando'] }));
assert.equal(afogada[0].indisponivel, 'Afogando impede', 'sem poder falar não há componente verbal');
assert.equal(afogada[1].indisponivel, '', 'mas o sopro continua — é [V, S], não [V]');
assert.equal(afogada.filter(f => !f.indisponivel).length, 1, 'sobra uma: o picker escolhe sozinho');

// nome da condição casa sem ligar para acento/caixa
assert.equal(avaliarFormas(GRITO, FORMAS, ctx({ condicoes: ['afogando'] }))[0].indisponivel, 'Afogando impede');

/* ═══ item exigido ═══ */
const semFlauta = avaliarFormas(GRITO, FORMAS, ctx({
    itensEquipados: [{ nome: 'Rabeca', tags: ['instrumento-corda'] }],
}));
assert.equal(semFlauta[1].indisponivel, 'sem instrumento-sopro equipado');
assert.equal(semFlauta[0].indisponivel, '', 'a voz não depende de item');

// o item que serve fica registrado, para a tela dizer com o quê
const comItem = avaliarFormas([{ vdId: CORDA, label: 'Inst. Corda', vdNome: 'Inst. Cordas' }], FORMAS, ctx());
assert.equal(comItem[0].comItem, 'Rabeca');
assert.equal(comItem[0].acerto, 5);

/* ═══ parte do corpo exigida ═══ */
const semCabeca = avaliarFormas(GRITO, FORMAS, ctx({ partesInteiras: ['Braço', 'Pé'] }));
assert.equal(semCabeca[0].indisponivel, 'sem Cabeça');

/* ═══ tudo bloqueado: as duas explicam o motivo, nenhuma some ═══ */
const nada = avaliarFormas(GRITO, FORMAS, ctx({ condicoes: ['Afogando'], itensEquipados: [] }));
assert.equal(nada.length, 2, 'forma bloqueada continua na lista — o jogador precisa ver o porquê');
assert.equal(nada.every(f => f.indisponivel), true);

/* ═══ sem cadastro de Forma, a coluna ainda funciona ═══ */
const semCadastro = avaliarFormas(GRITO, [], ctx());
assert.deepEqual(semCadastro.map(f => f.nome), ['Vocal', 'Inst. Sopro'], 'cai no label da coluna');
assert.equal(semCadastro.every(f => !f.indisponivel), true, 'sem Forma cadastrada nada bloqueia');
assert.equal(semCadastro[0].acerto, 7, 'o Acerto vem do VD, não do cadastro de Forma');

/* ═══ requisito "nenhum" nunca trava ═══ */
const bencao = avaliarFormas([{ vdId: 'vd_bencao', label: 'Teste:', vdNome: 'Bênção' }], FORMAS,
    ctx({ itensEquipados: [], partesInteiras: [] }));
assert.equal(bencao[0].indisponivel, '', 'Palla conjura de mãos vazias');
assert.equal(bencao[0].nome, 'Bênção', 'o nome da Forma vence o label genérico "Teste:" da coluna');

/* ═══ bordas ═══ */
assert.deepEqual(avaliarFormas([], FORMAS, ctx()), [], 'magia sem veículo declarado não inventa opção');
assert.deepEqual(avaliarFormas(null, FORMAS, ctx()), []);
assert.equal(avaliarFormas(GRITO, FORMAS, {})[0].acerto, null, 'sem ficha, Acerto nulo — não zero');
assert.equal(formaDoVd(FORMAS, VOCAL)?.nome, 'Vocal');
assert.equal(formaDoVd(FORMAS, 'vd_inexistente'), null);
assert.equal(formaDoVd(null, VOCAL), null);

console.log('✅ conjuracao: veículos da magia, Acerto do VD, condição que cala, item e parte exigidos, tudo bloqueado e ausência de cadastro OK');
