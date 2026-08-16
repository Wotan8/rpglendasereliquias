/**
 * Torneio Famélia — a dupla adversária da arena.
 *
 * Cria (ou atualiza pelo nome) dois NPCs em modo mecânico, vinculados à mesa
 * "Torneio Famélia", mais o inventário deles na coleção `items`.
 *
 * Os dois são construídos pela criação padrão do sistema (ponto-a-ponto de
 * atributos 5/4/3 e perícias 6/4/3/2) e gastam 180 EXP cada:
 * 100 da mesa (`config.expInicial`) + 80 de bônus. O ledger de cada um está
 * abaixo, e os asserts conferem que fecha exatamente em 180.
 *
 * O espelho legado de `valoresDer` (VIT/ENER/SAN/PERC/INI/REA/BLD) é gerado
 * pelo MOTOR DE VERDADE — `painel-mestre/js/npc-calc-engine.js`, o mesmo que o
 * Painel do Mestre usa — e não à mão. O Tabuleiro lê esse espelho; recalcular
 * por fora era a única forma de a ficha e o token discordarem.
 *
 *   node functions/cadastrar-torneio-famelia.mjs            (dry-run)
 *   node functions/cadastrar-torneio-famelia.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calcularNpc } from '../painel-mestre/js/npc-calc-engine.js';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const MESA_ID = 'd4Oi7KmowQ2gY4OU0Im8';          // Torneio Famélia
const EXP_MESA = 100, EXP_BONUS = 80;
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

/* ═══════════════ IDs do registro (system/data/*) ═══════════════ */
const RACA   = { yotun: 'IHEYo8mAvDJD22RYkZyd', picxi: '5pmKmVFFm3LIUxFNRsm2' };
const CLASSE = { guerreiro: 'sdK6iRkZDWXBuzffDyoL', bardo: 'HY7zCANhrHNwX8aqA6Nb' };
const TRIBO  = { uqata: 'cU4qtqIKlRbWn6tWeNRg', forasteiro: 'Simp9zHn6nLBP2IQoTYk' };

const SK = {
    aparar: 'H1gCTVoFhkmokwT7GbRZ', contraAtaque: 't9dDFqgcYKqP1kUdwIGc',
    esquiva: '6XaUJvRYMDnoFir8EVbd', evadir: 'yc1ZtkDV8xjGa3bYfu8t',
    arma: 'Sp5NF14TrPc0KULjc5UJ', briga: 'neQL0zXMvL1bNQyT5yPg',
    intimidacao: 'LTNv4IA7OjM1lgxqZGyl', resiliencia: 'vmGgjukW0qVyAYvD43kB',
    impeto: 'Ocg0SYEjF117kcJD5kAc', controle: 'c1uAn8nsuP6QVhHATJMm',
    posturaCombate: 'gajtoJSV8GxCgpVEFWfz', atletismo: 'X9YAuh9fF9H1LUSeiuTc',
    observacao: 'Jco4d1DhmVRRNYA7t8wu', performance: 'fTXvbMPc8RRDJSFMnFh8',
    lideranca: 'WxiDQbbjUVp8d3DvBzZ1', seducao: 'nTVYDNNrDeZUvGiMdBkT',
    diplomacia: 'UdytU8GAUtegaiTulHWj', fluxomancia: 'gb5hWgLFSy25Jw9GQlPR',
    erudicao: 'KJNhM6DkPtSvQrCQ6CQG', agilidade: 'fIzydbVAsvy79lO5G2vb',
    contracanto: 'y7LwFdWXIxZTIzhVs0kX', canto: 'XbexGgOVSIhYwMW7R8SI',
    composicao: 'PkuMe2ZdRrMtWFZnQi04', instCorda: 'gQC3zlbeii3sHBL1csyX',
    leituraPublico: '7E5HBvlQYHt7JWThhwcy',
};

const PEC = {
    // Yotun
    altaCarga: 'OXgSZ5wYBkE63slVKh1D', blindagemNatural: 'Iia3jwhtMRDwc65Yozwf',
    forcaColossal: 'XUx0gsIYA2udDwnzCfpk', golpeTitanico: 'hJVwHlsTgLlltoeY2zaO',
    guardiaoImponente: '6k6aNM0hL9RRjztpU9BZ', mentePequena: 'go9a5QjKWYI3xt9i3pVg',
    // Uqatá
    uqPericias: 'cQgcWQzpHiIjDw7qix2Y', uqFuria: 'T2n7ODPwKsMucj7Y9vu8',
    uqFarpa: '2Lc5BmK4tEfku6r3z8D9', uqRecusa: 'VVwBlygQLgNFHmUciZbd',
    uqCicatriz: '2S0dmEdyCseFumtrvhKq',
    // Guerreiro
    guPericias: 'rveqHBbvx4cG1AR5nSAt', guMestreArmas: 'TVBGDgjL3NMVSIMUPLY1',
    // Picxi
    luxiana: 'fLXECblWWKLM9Z0LibSm', levitacao: 'CtBAhvEhFgRGZ9ZyIslY',
    corpoFragil: 'xt6mlizeRwG3B3Nlucgz', brilho: '2GLWE5gIAxNufnam5ZxY',
    // Forasteiro
    foPericias: 'kROLrJ0O27jK3PK9OQmA', foRixa: 'EL5NAL0MlZDF966UCpxk',
    foSemPovo: '18DdTPYfV7Wpc8fQwIiN',
    // Bardo
    baPericias: 'BCuyLLXNLi4HvSvan6LE', baSonoromancia: '1WpcMGanUQNoEtwzXuL2',
    // Avulsas
    gigantismo: '79w8G9cPFpBE9NzlTaNY', veterano: 'jV8IGHNMQUgww4GQNQBv',
    cicatriz: '1LotEGqT4Zw8Tx27MQJ1', feio: 'sJLGq31pseo9lJuxVVNC',
    vozMarcante: 'rdNt8zyiXqTz2HT8JkZt', bonito: 'ye1QIuKPw3XLIFYGau21',
    franzino: 'azYOAixFAWc9g3481ksO', medroso: 'K3xEf81mSV7aPYE5Pxwh',
    gago: 'tejrCWYVrRVV1u4wuGTy',
};

const DV_ALTURA = 'XPv2i5GhoHfz2QSH3pCl';
const EQ = {
    marreta: 'OemmZAmIu76vCoaUDtFz', couroBatido: 'OPqT80DIhBtZDNJ3zuLd',
    luvas: 'jZ0i7FnUiUw2XxSUGNkq', bolsaLuns: 'TUjJU3tmhRqiK4OwhKxo',
    rabeca: 'hWBKRFGAwN60ZkfCKX5Q', estilete: '0B9kaEhyRF30FU4jXJxE',
    colete: 'XHGxem60dILwCa73x22n', faixa: 'DKQOnnFgwTJXwJOT5giA',
};
const BP = { mao: '6r4QB7jnlln8WpehKzS4', torso: 'X30m2EwEJ7j736kn3VFQ', cintura: 'P881bM97Ahm1No9dTGAX' };

/* ═══════════════ Ledgers de EXP — 100 (mesa) + 80 (bônus) ═══════════════ */
/* custo positivo = gasta; negativo = desvantagem que rende. */
const LEDGER_GRAKKUN = [
    ['Avulsa: Gigantismo Nv1', 8], ['Avulsa: Veterano de Guerra Nv1', 4],
    ['Avulsa: Cicatriz Notável Nv2 (rende)', -8], ['Avulsa: Feio Nv1 (rende)', -2],
    ['Manobras de Guerreiro (8 × 1 EXP; Romper Defesa é grátis)', 8],
    ['FOR 3→4', 20], ['FOR 4→5', 25], ['DES 2→3', 15], ['VIG 3→4', 20],
    ['PRS 2→3', 15], ['AUT 2→3', 15],
    ['Perícia: Arma 2→3', 12],
    ['Perícia: Ímpeto 0→2', 12], ['Perícia: Controle 0→2', 12],
    ['Perícia: Postura de Combate 0→1', 4],
    ['Blindagem Natural Nv2→3', 10], ['Golpe Titânico Nv1→2', 5],
    ['Guardião Imponente Nv1→2', 5],
];
const LEDGER_VESPA = [
    ['Avulsa: Voz Marcante Nv2', 11], ['Avulsa: Bonito Nv1', 4],
    ['Avulsa: Franzino Nv2 (rende)', -4], ['Avulsa: Medroso Nv1 (rende)', -2],
    ['Avulsa: Gago Nv1 (rende)', -4],
    ['PRS 2→3', 15], ['AUT 2→3', 15], ['PRE 3→4', 20], ['DES 3→4', 20],
    ['VIG 2→3', 15], ['VIG 3→4', 20],
    ['Perícia: Composição 0→3', 24], ['Perícia: Inst. de Corda 0→2', 12],
    ['Perícia: Performance 2→3', 12], ['Perícia: Esquiva 2→3', 12],
    ['Toque de Levitação Nv1→2', 10],
];
const soma = l => l.reduce((s, [, v]) => s + v, 0);
const ganhoDesvantagens = l => l.filter(([, v]) => v < 0).reduce((s, [, v]) => s - v, 0);

assert.equal(soma(LEDGER_GRAKKUN), EXP_MESA + EXP_BONUS, 'Grakkun tem que gastar os 180 EXP');
assert.equal(soma(LEDGER_VESPA), EXP_MESA + EXP_BONUS, 'Vespa tem que gastar os 180 EXP');
assert.ok(ganhoDesvantagens(LEDGER_GRAKKUN) <= 30, 'teto de 30 EXP em desvantagens (Grakkun)');
assert.ok(ganhoDesvantagens(LEDGER_VESPA) <= 30, 'teto de 30 EXP em desvantagens (Vespa)');

/* ═══════════════ Valores derivados esperados ═══════════════
 * Calculados aqui pelas fórmulas dos registros, porque o npc-calc-engine erra
 * DOIS pontos que atingem exatamente estes NPCs (ambos reportados ao usuário):
 *
 *   1. `buildTargetMap` indexa perícia pelo nome puro ("Resiliência"), mas as
 *      mecânicas referenciam com o prefixo ("Perícia: Resiliência"). Nenhuma
 *      perícia entra em conta nenhuma de NPC — some silenciosamente em
 *      Sanidade (+Resiliência), Iniciativa/Reação/Deslocamento (+Agilidade) e
 *      no Dano da "Fúria que Fere" dos Uqatá (+Ímpeto).
 *   2. A estabilização de referências cruzadas roda 2 passadas, e os status
 *      vitais são sempre os PRIMEIROS da lista. A cadeia Altura → Tamanho →
 *      Vitalidade tem 3 níveis, então Vitalidade fica uma passada atrás e lê
 *      Tamanho = 0. É por isso que o Grakkun saía com 12 de Vitalidade.
 *
 * O que diverge do motor vira `override` (o mecanismo que o próprio schema
 * chama de "travar manualmente"), e é ele que alimenta o espelho legado que o
 * Tabuleiro lê. Onde o motor acerta, deixamos vivo — sem override. */
const ESPERADO = {
    'Grakkun, o Trinca-Muros': {
        // Altura 3,19 (2,90 × 1,10 do Gigantismo Nv1) → Tamanho 9,57
        VIT: 41,   // (VIG 4 + Tamanho 9,57) × 3 = 40,71
        ENER: 6,   // PRS 3 + AUT 3
        SAN: 18,   // (INT 1 + AUT 3 + PRS 3 + Resiliência 2) × 2
        PERC: 3,   // RAC 3 + Observação 0
        INI: -1,   // AUT 3 + RAC 3 + DES 3 + Agilidade 0 − Tamanho 9,57 = −0,57
        REA: 3,    // mín(DES 3, RAC 3) + Agilidade 0
        BLD: 4,    // Blindagem Natural Nv3 (+3) + Couro Batido (+1)
        DESLOCAMENTO: '18m',  // FOR 5 + DES 3 + Agilidade 0 + Tamanho 9,57 = 17,57
    },
    'Vespa, a Voz Dourada': {
        // Altura 0,75 → Tamanho 2,25
        VIT: 13,   // (VIG 4 + Tamanho 2,25 − 2 do Corpo Frágil) × 3 = 12,75
        ENER: 6,   // PRS 3 + AUT 3
        SAN: 18,   // (INT 3 + AUT 3 + PRS 3 + Resiliência 0) × 2
        PERC: 2,   // RAC 2 + Observação 0
        INI: 9,    // AUT 3 + RAC 2 + DES 4 + Agilidade 2 − Tamanho 2,25 = 8,75
        REA: 4,    // mín(DES 4, RAC 2) + Agilidade 2
        BLD: 0,    // Corpo Frágil, sem armadura
        DESLOCAMENTO: '9m (Aéreo 22m)', // terrestre 9,25 · aéreo (1+4+2,25)×3 = 21,75
    },
};

/* ═══════════════ Partes do corpo ═══════════════ */
const SLOTS_PARES = { [BP.mao]: 2, kc9p3jiFtOJJ5qiOElFq: 2, l668esm4kmmyvSfMN4L3: 2,
    epAss2ikwrSiMvd0Egid: 2, gFkuXKCVJ5WLhuvFD4P0: 2 };

/* ═══════════════ Os dois ═══════════════ */
const GRAKKUN = {
    nome: 'Grakkun, o Trinca-Muros',
    tipo: 'npc', nivel: 5, porte: 'Enorme',
    papel: 'Campeão de arena — o "Muro" da dupla',
    local: 'Arena de Famélia',
    tamanho: '3,19m — Yotun de gigantismo, torso nu e coberto de cicatrizes',
    tags: 'torneio famélia, arena, gladiador, yotun, uqatá, guerreiro, chefe, dupla, o muro e a vespa',
    racaRef: { refId: RACA.yotun, custom: '' }, raca: 'Yotun',
    classeRef: { refId: CLASSE.guerreiro, custom: '' }, classe: 'Guerreiro',
    triboRef: { refId: TRIBO.uqata, custom: '' }, tribo: 'Uqatá',
    atributos: { INT: 1, RAC: 3, PRS: 3, FOR: 5, DES: 3, VIG: 4, PRE: 3, MAN: 2, AUT: 3 },
    peculiaridades: [
        { refId: PEC.altaCarga, nivel: 1, fonte: 'raca' },
        { refId: PEC.blindagemNatural, nivel: 3, fonte: 'raca' },
        { refId: PEC.forcaColossal, nivel: 1, fonte: 'raca' },
        { refId: PEC.golpeTitanico, nivel: 2, fonte: 'raca' },
        { refId: PEC.guardiaoImponente, nivel: 2, fonte: 'raca' },
        { refId: PEC.mentePequena, nivel: 1, fonte: 'raca' },
        { refId: PEC.uqPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.uqFuria, nivel: 1, fonte: 'tribo' },
        { refId: PEC.uqFarpa, nivel: 1, fonte: 'tribo' },
        { refId: PEC.uqRecusa, nivel: 1, fonte: 'tribo' },
        { refId: PEC.uqCicatriz, nivel: 1, fonte: 'tribo' },
        { refId: PEC.guPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.guMestreArmas, nivel: 1, fonte: 'classe' },
        { refId: PEC.gigantismo, nivel: 1, fonte: null },
        { refId: PEC.veterano, nivel: 1, fonte: null },
        { refId: PEC.cicatriz, nivel: 2, fonte: null },
        { refId: PEC.feio, nivel: 1, fonte: null },
    ],
    /* Níveis GRAVADOS. A mecânica da classe soma +1 em Arma e Briga e a da
       tribo +1 em Ímpeto por cima disto — não somar aqui, dobraria. */
    periciasEstruturadas: [
        { refId: SK.aparar, nivel: 3 }, { refId: SK.contraAtaque, nivel: 3 },
        { refId: SK.esquiva, nivel: 2 }, { refId: SK.arma, nivel: 3 },
        { refId: SK.briga, nivel: 2 }, { refId: SK.intimidacao, nivel: 3 },
        { refId: SK.resiliencia, nivel: 2 }, { refId: SK.impeto, nivel: 2 },
        { refId: SK.controle, nivel: 2 }, { refId: SK.posturaCombate, nivel: 1 },
        { refId: SK.atletismo, nivel: 0 }, { refId: SK.observacao, nivel: 0 },
    ],
    modulosClasse: [{ refId: 'manobras_guerreiro', snapshot: null, fonte: 'classe', itens: 'TODAS' }],
    altura: 3.19,
    itens: [
        { modeloId: EQ.marreta, slot: `${BP.mao}_1`, estado: 'empunhado', extras: [`${BP.mao}_2`] },
        { modeloId: EQ.couroBatido, slot: BP.torso, estado: 'vestido' },
        { modeloId: EQ.luvas, slot: `${BP.mao}_1`, estado: 'vestido' },
        { modeloId: EQ.bolsaLuns, slot: BP.cintura, estado: 'fixado' },
    ],
    ataques: [
        'Marreta de Guerra (2 mãos) — Alvo 9 · Dano 1d10+8',
        '  (Dano = FOR 5 + Ímpeto 3 pela "Fúria que Fere" dos Uqatá)',
        'Desarmado — Alvo 8 (FOR 5 + Briga 3) · Dano 1d4+8',
        'Ritual da Farpa (Uqatá) — +1 na PRIMEIRA rolagem de ataque do combate.',
        '',
        'MANOBRAS — Energia 6 no total. Custo em Energia entre parênteses.',
        'Postura Ofensiva (1) — +2 de dano, −2 de Reação, até trocar de postura.',
        'Postura Defensiva (1) — +3 de Blindagem, −2 no Alvo, até trocar.',
        'Investida (1) — 4,5m em linha reta antes do golpe: +4 de dano.',
        'Romper Defesa (0) — ignora a Blindagem do alvo; se acertar, Prostrado.',
        'Golpe Giratório (2) — todos os adjacentes (2m), −2 no Alvo.',
        'Atordoar (1) — se acertar, alvo Atordoado por 1 turno.',
        'Imobilizar (1) — disputa (ataque vs FOR+Atletismo); vencendo, Agarrado.',
        'Inspirar (1) — aliados em 6m: +1 no Alvo de Ataque por 2 rodadas.',
        'Cólera (1) — se a Vespa cair, ativa pelo resto do combate: matou alguém,',
        '  +1 ação; foi atingido, devolve metade do dano com sucesso em Reação+Reflexo.',
        '',
        'Golpe Titânico Nv2 — o impacto sacode a área ao redor do alvo.',
        'Guardião Imponente Nv2 — +2 no Alvo de Intimidação.',
    ].join('\n'),
    skills: [
        'Arma 4 · Briga 3 · Ímpeto 3 · Aparar 3 · Contra-Ataque 3 · Esquiva 2',
        'Intimidação 3 · Controle 2 · Resiliência 2 · Postura de Combate 1',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Cordial fora da areia — cumprimenta quem vai matar',
            'Obediente à Vespa, e é a única coisa que ele obedece',
            'Não entende metáfora nenhuma, e responde a todas literalmente',
        ],
        trejeitos: '• Bate a marreta duas vezes no chão antes de cada investida — o público conta junto.\n'
            + '• Ergue o adversário caído pela nuca e mostra à arquibancada antes de decidir o que faz.\n'
            + '• Fala devagar, como quem escolhe pedra em pedreira.\n'
            + '• Recusa qualquer peça de armadura pesada e qualquer escudo: é Uqatá, e cicatriz de defesa se esconde.\n'
            + '• Procura a Vespa com os olhos antes de acertar o golpe final.',
        motivacao: 'Comprar a própria liberdade lutando. Falta pouco, e ele conta em voz alta '
            + 'quantas lutas faltam — o que faz dele um adversário que NÃO quer matar ninguém: '
            + 'morto não paga, e uma morte na areia queima o cartaz. Ele quer a rendição, não o cadáver.',
        segredos: '⚠ FRAQUEZAS DE MESA:\n'
            + '• Iniciativa negativa (Tamanho enorme): SEMPRE age por último. A primeira rodada é dos jogadores.\n'
            + '• Reação 3 e Percepção 3 — é lento de reagir e não repara em nada fora do alcance da marreta.\n'
            + '• Sem escudo e sem armadura pesada (proibição Uqatá): Blindagem 4, e só.\n'
            + '• INT 1. Qualquer ardil não-óbvio funciona: um blefe, uma finta, uma pergunta difícil o trava.\n'
            + '• Se a Vespa cair, ele entra em Cólera — e aí sim tenta matar.\n\n'
            + '★ SE PEDIREM RENDIÇÃO: ele aceita. Ele PREFERE. Levanta os braços para o público '
            + 'e cobra a plateia por uma luta boa em vez de uma luta curta.',
        relacoes: {
            aliado: 'Vespa (a Picxi) — ela fala por ele desde que se conheceram',
            rival: 'Qualquer um que traga escudo para a areia — ele considera insulto pessoal',
            devedor: 'Deve a própria compra: luta para pagar a si mesmo',
        },
        frases: '"Levanta. Ainda não valeu o dinheiro deles."\n'
            + '"Escudo. Trouxe escudo. Isso é feio."\n'
            + '"Se você deitar agora, você janta hoje."\n'
            + '"Vespa diz que eu sou o muro. Eu sou o muro."',
        historia: 'Yotun de gigantismo, nascido grande até para os grandes. Foi guardião de caminho '
            + 'até o dia em que o caminho valeu mais que ele. Chegou a Famélia amarrado e virou atração: '
            + 'o público paga para ver um gigante bater em gente. Aprendeu a lutar de verdade na areia, '
            + 'não em treino — e aprendeu que o público perdoa quem sangra e não perdoa quem mata rápido. '
            + 'Conta as lutas que faltam para a alforria em voz alta, no meio do combate, e erra a conta.',
    },
    loot: {
        itens: 'Marreta de Guerra (6 de peso — praticamente ninguém mais a ergue)\n'
            + 'Couro Batido cortado nas costelas\nLuvas de couro\n'
            + 'Bolsa de couro com a bolsa da luta',
        luns: '3d10+40',
        pistas: 'Ele sabe a conta exata de quanto ainda deve, e para quem. Dito em voz alta, '
            + 'é o nome de quem manda no cartaz da arena — informação que o Mestre define.',
        complicacoes: 'Matá-lo transforma a arquibancada contra os jogadores: era o favorito. '
            + 'Poupá-lo compra um gigante grato.',
    },
};

const VESPA = {
    nome: 'Vespa, a Voz Dourada',
    tipo: 'npc', nivel: 5, porte: 'Minúsculo',
    papel: 'A voz da dupla — bardo de arena, canta em cima do combate',
    local: 'Arena de Famélia',
    tamanho: '0,75m — Picxi dourada, asas de libélula, magra de doer',
    tags: 'torneio famélia, arena, bardo, picxi, forasteiro, sonoromancia, chefe, dupla, o muro e a vespa',
    racaRef: { refId: RACA.picxi, custom: '' }, raca: 'Picxi',
    classeRef: { refId: CLASSE.bardo, custom: '' }, classe: 'Bardo',
    triboRef: { refId: TRIBO.forasteiro, custom: '' }, tribo: 'Forasteiro',
    atributos: { INT: 3, RAC: 2, PRS: 3, FOR: 1, DES: 4, VIG: 4, PRE: 4, MAN: 3, AUT: 3 },
    peculiaridades: [
        { refId: PEC.luxiana, nivel: 1, fonte: 'raca' },
        { refId: PEC.levitacao, nivel: 2, fonte: 'raca' },
        { refId: PEC.corpoFragil, nivel: 1, fonte: 'raca' },
        { refId: PEC.brilho, nivel: 1, fonte: 'raca' },
        { refId: PEC.foPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foRixa, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foSemPovo, nivel: 1, fonte: 'tribo' },
        { refId: PEC.baPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.baSonoromancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.vozMarcante, nivel: 2, fonte: null },
        { refId: PEC.bonito, nivel: 1, fonte: null },
        { refId: PEC.franzino, nivel: 2, fonte: null },
        { refId: PEC.medroso, nivel: 1, fonte: null },
        { refId: PEC.gago, nivel: 1, fonte: null },
    ],
    /* A mecânica da classe soma +1 em Performance e Fluxomancia por cima. */
    periciasEstruturadas: [
        { refId: SK.performance, nivel: 3 }, { refId: SK.lideranca, nivel: 2 },
        { refId: SK.seducao, nivel: 1 }, { refId: SK.diplomacia, nivel: 1 },
        { refId: SK.fluxomancia, nivel: 2 }, { refId: SK.erudicao, nivel: 2 },
        { refId: SK.esquiva, nivel: 3 }, { refId: SK.evadir, nivel: 1 },
        { refId: SK.agilidade, nivel: 2 }, { refId: SK.contracanto, nivel: 2 },
        { refId: SK.canto, nivel: 1 }, { refId: SK.composicao, nivel: 3 },
        { refId: SK.instCorda, nivel: 2 }, { refId: SK.leituraPublico, nivel: 0 },
        { refId: SK.observacao, nivel: 0 },
    ],
    modulosClasse: [
        { refId: 'sonoro_c1', snapshot: null, fonte: 'classe',
          itens: ['GRITO DISSONANTE [V, S]', 'INTIMIDAÇÃO SÔNICA [V, P]', 'CANÇÃO DO VIGOR [V, C]'] },
        { refId: 'sonoro_c2', snapshot: null, fonte: 'classe',
          itens: ['RITMO DE GUERRA [P, V]', 'NANA DO ENTORPECIMENTO [V, C]', 'ACORDE DEBILITANTE [C, P]'] },
        { refId: 'sonoro_c3', snapshot: null, fonte: 'classe',
          itens: ['COMPOSIÇÃO DE BATALHA [Qualquer]', 'ONDA DE CHOQUE SONORAL [P, S]'] },
    ],
    altura: 0.75,
    asaExtra: true,
    itens: [
        { modeloId: EQ.rabeca, slot: `${BP.mao}_1`, estado: 'segurar' },
        { modeloId: EQ.estilete, slot: `${BP.mao}_2`, estado: 'empunhado' },
        { modeloId: EQ.colete, slot: BP.torso, estado: 'vestido' },
        { modeloId: EQ.faixa, slot: BP.cintura, estado: 'vestido' },
    ],
    ataques: [
        'Estilete — Alvo 4 (DES 4 + Arma 0) · Dano 1d4+1. Arma de desespero, não de plano.',
        'Acerto Mágico (Rabeca) = DES 4 + Inst. de Corda 2 = ALVO 6.',
        '  ⚠ O motor não soma bônus de item "segurado" — este 6 é fixo, use-o direto.',
        '',
        'COMPOSIÇÕES — Energia 6. Redutor da conjuração já embutido no Alvo abaixo.',
        'CUSTO 1',
        '  GRITO DISSONANTE [V,S] (Alvo 5) — 1 inimigo em 6m Atordoado 1 turno (Chance 8).',
        '  INTIMIDAÇÃO SÔNICA [V,P] (Alvo 5) — 2 inimigos em 6m testam AUT; falha = Amedrontado 1 cena.',
        '  CANÇÃO DO VIGOR [V,C] (Alvo 5) — 1 aliado em 6m recupera 1 Energia. ← recarrega o Grakkun.',
        'CUSTO 2',
        '  RITMO DE GUERRA [P,V] (Alvo 4) — aliados em 6m: +1 no Alvo de Ataque. Exige manter o ritmo.',
        '  NANA DO ENTORPECIMENTO [V,C] (Alvo 4) — 1 alvo em 6m testa AUT; falha = Lento e Ofuscado 1 cena.',
        '  ACORDE DEBILITANTE [C,P] (Alvo 4) — 1 inimigo: −2 no Alvo. Falha em AUT: perde 1 Energia.',
        'CUSTO 3',
        '  COMPOSIÇÃO DE BATALHA (Alvo 3) — a cena inteira, sem manter ritmo: +1 no Alvo dos aliados',
        '    OU −1 no Alvo dos inimigos em 6m. Escolhe na conjuração. ← ela ABRE com esta.',
        '  ONDA DE CHOQUE SONORAL [P,S] (Alvo 3) — explosão de 5m: dano de impacto, empurra 1,5m',
        '    por Grau, teste de VIG ou Atordoado. ← o botão de pânico dela.',
    ].join('\n'),
    skills: [
        'Composição 3 · Performance 4 · Esquiva 3 · Fluxomancia 3 · Inst. de Corda 2',
        'Contracanto 2 · Liderança 2 · Erudição 2 · Agilidade 2 · Canto 1 · Evadir 1',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Trabalha a plateia antes de trabalhar o adversário',
            'Covarde de verdade, e disfarça com volume',
            'Fala pelo Grakkun em toda negociação, e cobra caro por isso',
        ],
        trejeitos: '• Nunca pousa. Fica a 4–6m do chão a luta inteira, arco da rabeca em riste como batuta.\n'
            + '• Brilha: uma Picxi não consegue esconder a aura dourada, e ela transformou isso em número de palco.\n'
            + '• Anuncia o golpe do Grakkun ANTES dele dar — e acerta, porque foi ela quem mandou.\n'
            + '• Quando se assusta, sobe. Quando sobe demais, perde o alcance de 6m das composições.\n'
            + '• Chama o público de "meu senhor" no singular, como se a arquibancada fosse uma pessoa só.\n'
            + '• GAGUEJA quando FALA — e não gagueja uma sílaba quando CANTA. Por isso canta tudo, '
            + 'inclusive ordem, ameaça e pedido de rendição. Sob pressão a gagueira volta e entrega o medo dela.',
        motivacao: 'A bolsa da luta, e o cartaz seguinte. Ela comprou o contrato do Grakkun a prazo '
            + 'e ainda deve as parcelas — cada vitória é uma parcela. Perder não é vergonha: é dívida.',
        segredos: '⚠ FRAQUEZAS DE MESA:\n'
            + '• Vitalidade ~12 e Blindagem 0. DOIS golpes bons a derrubam. Ela é o alvo certo, e sabe disso.\n'
            + '• As composições só alcançam 6m. Se ela subir alto para fugir, PARA de ajudar o Grakkun.\n'
            + '  Esse é o dilema dela a luta inteira — e o eixo tático da cena.\n'
            + '• Corpo Frágil + Franzino Nv2: agarrão, rede, tiro ou qualquer coisa que a prenda no chão a mata.\n'
            + '• Brilho Revelador: não tem como se esconder. Sempre visível, sempre mirável.\n'
            + '• Medrosa. Ameaça crível a faz recuar de verdade.\n\n'
            + '★ SE O GRAKKUN CAIR: ela se rende na hora, chorando, e tenta negociar. '
            + 'Não morre pela luta — a dívida não é essa.',
        relacoes: {
            aliado: 'Grakkun — meio sócio, meio propriedade, e ela não gosta de pensar em qual dos dois',
            rival: 'A própria plateia de Famélia, que torce contra dois forasteiros',
            devedor: 'Deve as parcelas do contrato do Grakkun a quem o vendeu',
        },
        frases: '"FAMÉLIA! Vocês vieram ver sangue ou vieram ver ARTE?"\n'
            + '"Grakkun, o da esquerda. A perna. Agora."\n'
            + '"Eu não luto, meu senhor. Eu rejo."\n'
            + '"Chega! Chega — a gente se rende, a gente se rende, abaixa isso!"',
        historia: 'Picxi sem povo — nem tribo, nem mestre, nem escola. Aprendeu Sonoromancia ouvindo '
            + 'e imitando, o que a deixou excelente em cima do palco e péssima em qualquer sala com regra. '
            + 'Encontrou o Grakkun sendo vaiado por lutar mal e percebeu o óbvio: o gigante não precisava '
            + 'aprender a lutar, precisava de alguém que lhe dissesse onde bater. Comprou o contrato dele '
            + 'a prazo. Desde então os dois não perderam — e ela ainda não terminou de pagar.',
    },
    loot: {
        itens: 'Rabeca (arco de crina dourada)\nEstilete\nColete de artista\n'
            + 'Faixa do trovador\nContrato do Grakkun, dobrado quatro vezes, com as parcelas anotadas atrás',
        luns: '4d10+60',
        pistas: 'O contrato traz o nome de quem vendeu o Grakkun e quanto ainda falta — '
            + 'gancho direto para depois do torneio.',
        complicacoes: 'Ela é a única das duas que sabe negociar. Matá-la deixa os jogadores '
            + 'com um gigante em Cólera e ninguém para dizer "chega".',
    },
};

/* ═══════════════ Montagem ═══════════════ */
async function carregarSys() {
    const cols = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics', 'skills',
        'derivedValues', 'vitalStats', 'classModules', 'equipment', 'bodyParts'];
    const sd = {};
    await Promise.all(cols.map(async col => {
        const snap = await db.collection(`system/data/${col}`).get();
        const arr = [];
        snap.forEach(d => { const x = d.data(); if (x.publicado !== false) arr.push({ id: d.id, ...x }); });
        sd[col] = arr;
    }));
    const byId = arr => Object.fromEntries((arr || []).map(x => [x.id, x]));
    const norm = s => String(s || '').trim().toLowerCase();
    const sys = {
        races: sd.races, classes: sd.classes, tribes: sd.tribes,
        peculiarities: sd.peculiarities, mechanics: sd.mechanics, skills: sd.skills,
        derivedValues: sd.derivedValues.map(dv => ({ ...dv, key: dv.key || dv.id,
            escopoItem: dv.escopoItem || '' })),
        vitalStats: sd.vitalStats.map(vs => ({ ...vs, key: vs.key || vs.id })),
        classModules: sd.classModules, equipment: sd.equipment, bodyParts: sd.bodyParts,
    };
    sys.pecsById = byId(sys.peculiarities); sys.mechsById = byId(sys.mechanics);
    sys.racesById = byId(sys.races); sys.classesById = byId(sys.classes);
    sys.tribesById = byId(sys.tribes); sys.classModulesById = byId(sys.classModules);
    sys.norm = norm;
    return sys;
}

function findDvKeyLike(sigla, sys) {
    const all = [...sys.vitalStats, ...sys.derivedValues];
    const s = sys.norm(sigla);
    return (all.find(d => sys.norm(d.key) === s || sys.norm(d.nome) === s)
        || all.find(d => sys.norm(d.key).startsWith(s) || sys.norm(d.nome).startsWith(s)))?.key || null;
}

function partesDoCorpo(sys, comAsa) {
    const partes = sys.bodyParts.filter(bp => bp.ehPadrao)
        .map(bp => ({ ...bp, slots: SLOTS_PARES[bp.id] || 1 }));
    if (comAsa) {
        const asa = sys.bodyParts.find(bp => bp.nome === 'Asa de Libélula');
        if (asa) partes.push({ ...asa, slots: 2 });
    }
    return JSON.parse(JSON.stringify(partes));
}

function montaModulos(spec, sys) {
    return (spec.modulosClasse || []).map(v => {
        const def = sys.classModulesById[v.refId];
        if (!def) throw new Error(`módulo "${v.refId}" não existe no registro`);
        const pre = def.itensPredefinidos || [];
        const escolhidos = v.itens === 'TODAS' ? pre
            : v.itens.map(nome => {
                const hit = pre.find(p => p.nome === nome);
                if (!hit) throw new Error(`item "${nome}" não existe no módulo ${v.refId}`);
                return hit;
            });
        return { refId: v.refId, snapshot: null, fonte: v.fonte,
            itens: escolhidos.map(p => ({ id: 'mi-' + p.id, predefinidoId: p.id,
                nome: p.nome, valores: { ...p.valores } })) };
    });
}

function montaItens(spec, sys, npcId) {
    return spec.itens.map((it, i) => {
        const tpl = sys.equipment.find(e => e.id === it.modeloId);
        if (!tpl) throw new Error(`equipamento "${it.modeloId}" não existe no catálogo`);
        return {
            id: `item-torneio-${npcId}-${i}`,
            nome: tpl.nome, tipo: tpl.tipo, modeloId: tpl.id,
            categoriaArma: tpl.categoriaArma || null,
            peso: tpl.peso ?? 1, pressaoBase: tpl.peso ?? 1, tamanho: tpl.tamanho ?? 1,
            quantidade: 1, descricao: '', formulaDano: '', imagem: tpl.imagemUrl || '',
            equipavelEm: tpl.equipavelEm || null, formaEquipar: tpl.formaEquipar || null,
            mecanicaIdsProprias: [],
            characterId: npcId, ownerType: 'npc', ownerUid: '', ownerId: '',
            ehContainer: !!tpl.ehContainer,
            pesoMaximoContainer: tpl.ehContainer ? (tpl.pesoMaximoContainer ?? 10) : null,
            multiplicadorPressao: tpl.ehContainer ? (tpl.multiplicadorPressao ?? 1) : null,
            equipado: true, slotAnatomico: it.slot, slotsOcupados: it.extras || [],
            estadoEquip: it.estado, parentItemId: null, criadoPor: 'mestre',
            lastModified: new Date().toISOString(),
        };
    });
}

function montaNpc(spec, sys, npcId) {
    const npc = {
        schemaVersion: 2, modoFicha: 'mecanico',
        nome: spec.nome, tipo: spec.tipo, imagem: '', nivel: spec.nivel, ai: spec.nivel,
        porte: spec.porte, papel: spec.papel, local: spec.local,
        tamanho: spec.tamanho, tags: spec.tags,
        funcao: [], aliadoProprio: false, visibilidade: 'secreto',
        racaRef: spec.racaRef, classeRef: spec.classeRef, triboRef: spec.triboRef,
        raca: spec.raca, classe: spec.classe, tribo: spec.tribo,
        atributos: spec.atributos,
        peculiaridades: spec.peculiaridades,
        periciasEstruturadas: spec.periciasEstruturadas,
        modulosClasse: montaModulos(spec, sys),
        partesDoCorpo: partesDoCorpo(sys, spec.asaExtra),
        valoresDer: { overrides: { [DV_ALTURA]: spec.altura }, atual: {}, extras: [], vinculados: [] },
        ataques: spec.ataques, skills: spec.skills,
        rolePlay: spec.rolePlay, loot: spec.loot, criatura: null,
        vinculos: [{ tipo: 'mesa', id: MESA_ID }], mesaId: MESA_ID,
        lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
    };
    const items = montaItens(spec, sys, npcId);

    // Passa o motor de verdade e compara com as fórmulas. Onde ele diverge,
    // trava com override — assim ficha e token nunca discordam.
    const calc = calcularNpc(npc, sys, { items });
    const esperado = ESPERADO[spec.nome];
    assert.ok(esperado, `sem valores esperados para "${spec.nome}"`);

    const NOME_DV = { VIT: 'Vitalidade', ENER: 'Energia', SAN: 'Sanidade',
        PERC: 'Percepção', INI: 'Iniciativa', REA: 'Reação', BLD: 'Blindagem' };
    const divergencias = [];
    for (const [sigla, nomeDv] of Object.entries(NOME_DV)) {
        const key = findDvKeyLike(nomeDv, sys);
        assert.ok(key, `valor derivado "${nomeDv}" sumiu do registro`);
        const doMotor = calc.derived[key]?.final;
        npc.valoresDer[sigla] = esperado[sigla];
        if (Math.abs(Number(doMotor) - esperado[sigla]) > 0.5) {
            npc.valoresDer.overrides[key] = esperado[sigla];
            divergencias.push(`${sigla}: motor ${doMotor} → travado em ${esperado[sigla]}`);
        }
    }
    npc.valoresDer.DESLOCAMENTO = esperado.DESLOCAMENTO;
    npc.valoresDer.extras = [{ nome: 'Deslocamento', valor: esperado.DESLOCAMENTO }];
    npc.valoresDer.atual = { VIT: esperado.VIT, ENER: esperado.ENER, SAN: esperado.SAN };
    npc.valoresDer.vinculados = Object.values(NOME_DV)
        .map(n => findDvKeyLike(n, sys)).filter(Boolean);

    return { npc, items, calc, divergencias };
}

/* ═══════════════ Execução ═══════════════ */
const sys = await carregarSys();

const mesa = await db.collection('mesas').doc(MESA_ID).get();
assert.ok(mesa.exists, 'mesa Torneio Famélia não encontrada');
assert.equal(mesa.data().config?.expInicial, EXP_MESA,
    `a mesa precisa estar com expInicial ${EXP_MESA} — o ledger foi construído em cima disso`);

const existentes = await db.collection('npcs').get();
const acharPorNome = nome => existentes.docs.find(d => (d.data().nome || '').trim() === nome);

const planos = [];
for (const spec of [GRAKKUN, VESPA]) {
    const ja = acharPorNome(spec.nome);
    const npcId = ja ? ja.id : db.collection('npcs').doc().id;
    const { npc, items, calc, divergencias } = montaNpc(spec, sys, npcId);
    planos.push({ spec, npcId, npc, items, calc, divergencias, novo: !ja });
}

console.log(`\n✅ ${LEDGER_GRAKKUN.length + LEDGER_VESPA.length} linhas de ledger e 4 asserts passaram.`);
console.log(`   Cada NPC gasta ${EXP_MESA}+${EXP_BONUS} = ${EXP_MESA + EXP_BONUS} EXP, e gasta todos.\n`);

for (const p of planos) {
    const v = p.npc.valoresDer;
    console.log('─'.repeat(72));
    console.log(`${p.novo ? '🆕' : '♻️ '} ${p.npc.nome}  [${p.npcId}]`);
    console.log(`   ${p.npc.raca} · ${p.npc.tribo} · ${p.npc.classe}`);
    console.log('   Atributos:', Object.entries(p.npc.atributos).map(([k, x]) => `${k}${x}`).join(' '));
    console.log(`   VIT ${v.VIT} · ENER ${v.ENER} · SAN ${v.SAN} · BLD ${v.BLD} · INI ${v.INI} · REA ${v.REA} · PERC ${v.PERC}`);
    console.log(`   Deslocamento: ${v.DESLOCAMENTO}`);
    console.log(`   ${p.npc.peculiaridades.length} peculiaridades · ${p.npc.periciasEstruturadas.length} perícias · `
        + `${p.npc.modulosClasse.reduce((s, m) => s + m.itens.length, 0)} itens de módulo · ${p.items.length} equipamentos`);
    const ledger = p.spec === GRAKKUN ? LEDGER_GRAKKUN : LEDGER_VESPA;
    console.log('   EXP:', ledger.map(([n, c]) => `${n} ${c > 0 ? '−' : '+'}${Math.abs(c)}`).join(' | '));
    if (p.divergencias.length) console.log('   🔒 travados por override:', p.divergencias.join(' · '));
    if (process.argv.includes('--debug')) {
        for (const nome of ['Altura', 'Tamanho', 'Vitalidade', 'Peso', 'Blindagem', 'Percepção']) {
            const k = findDvKeyLike(nome, sys);
            const d = k && p.calc.derived[k];
            if (d) console.log(`   [dbg] ${nome} = ${d.final} (auto ${d.auto}, ov ${d.override})`,
                JSON.stringify(d.fontes));
        }
    }
}
console.log('─'.repeat(72));

if (!APLICAR) {
    console.log('\n🔍 DRY-RUN. Rode com --apply para gravar.\n');
    process.exit(0);
}

for (const p of planos) {
    await db.collection('npcs').doc(p.npcId).set(p.npc, { merge: true });
    const antigos = await db.collection('items').where('characterId', '==', p.npcId).get();
    for (const d of antigos.docs) await d.ref.delete();
    for (const it of p.items) await db.collection('items').doc(it.id).set(it);
    console.log(`✅ ${p.npc.nome} gravado (${p.items.length} itens).`);
}
console.log('\n🏟️  A dupla está na mesa Torneio Famélia.\n');
process.exit(0);
