/**
 * Torneio Famélia — sessão 2. A segunda dupla adversária.
 *
 * A primeira dupla (Grakkun/Vespa) caiu na sessão 1: o Yotun morreu, a Picxi
 * fugiu viva. Estes dois assistiram àquilo e vieram preparados — é o eixo da
 * cena, e está escrito em `rolePlay.segredos`.
 *
 * Mesma régua da sessão 1: criação padrão por pontos (atributos 5/4/3,
 * perícias 6/4/3/2) + 180 EXP cada (100 da mesa + 80 de bônus), gastos até o
 * último ponto. Ledger conferido por assert.
 *
 * DESENHO — a luta tem que ser diferente EM ESPÉCIE, não só em número:
 *   Sessão 1 era muro + apoio voador. O grupo tinha a rodada 1 de graça
 *   (Grakkun com Iniciativa −1) e o problema era alcançar quem voava.
 *   Sessão 2 inverte tudo: os DOIS são frágeis, os DOIS batem forte e nenhum
 *   dos dois fica parado. O Hesk age praticamente sempre primeiro (INI 10) e
 *   o problema deixa de ser "alcançar" e passa a ser "prender".
 *
 *   node functions/cadastrar-torneio-famelia-s2.mjs            (dry-run)
 *   node functions/cadastrar-torneio-famelia-s2.mjs --apply
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

const MESA_ID = 'd4Oi7KmowQ2gY4OU0Im8';
const EXP_MESA = 100, EXP_BONUS = 80;
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

/* ═══════════════ IDs do registro ═══════════════ */
const RACA   = { elorin: '90e0yn09aDKrIZ3fHXpd', karuSelvagem: 'pu3asemYF7e65IZQsnDm' };
const CLASSE = { cacador: 'Ja6ULaEcRNEANKy1ywvW', ladino: 'M2BxwIObozo8q17uwlLE' };
const TRIBO  = { famo: 'D7sTexmRIWVPI81mBxBm', forasteiro: 'Simp9zHn6nLBP2IQoTYk' };

const SK = {
    disparo: 'JSRMR8LODaVNuFHzJ8u4', furtividade: 'zReRsG9Ch9To4Og1M1BD',
    atletismo: 'X9YAuh9fF9H1LUSeiuTc', esquiva: '6XaUJvRYMDnoFir8EVbd',
    cobertura: '58aOGBkoBvliY2yUfmkY', investigacao: 'yV7Y7PvHjbyFIZlaAo4t',
    herbalismo: 'zEa49LJzTXmnKj3YALma', erudicao: 'KJNhM6DkPtSvQrCQ6CQG',
    observacao: 'Jco4d1DhmVRRNYA7t8wu', arma: 'Sp5NF14TrPc0KULjc5UJ',
    pontaria: 'QLptJaQpk4Mfu3j6pjLw', marcarPresa: 'zwEHQrWAjCdKfVrdSKRN',
    reflexo: 'jgPUEPXaXLLT97XD94za', contraAtaque: 't9dDFqgcYKqP1kUdwIGc',
    agilidade: 'fIzydbVAsvy79lO5G2vb', malandragem: 'NCE01BoA4IFPuQAZBlJP',
    intimidacao: 'LTNv4IA7OjM1lgxqZGyl', anatomia: 'p05TPY9EKnKP8miTXUY1',
    precisao: '8gWqQXEgffLnWE0h1X5X', subterfugio: 'BPr7IHh7sLkqiopyyWpK',
    briga: 'neQL0zXMvL1bNQyT5yPg',
};

const PEC = {
    // Elorin
    elConexao: 'SXkVvXAEPzp2cXboZV0y', elVenenos: 'kqENTDGq6jmfsLkwTnjt',
    elSaciedade: 'WayNNzaG7bPrZUsCRNMd', elVisaoEssencia: 'SOQ5qJwMjBTvssFeSjfo',
    // Karu-Selvagem
    kaCabecaQuente: 'oaHKYhf5yOjWsLeoL9Y2', kaPesInvertidos: 'GLeOmhpiZbEUAGx0rjvL',
    kaSangueImpuro: '7YkObFXv0PVjvAg87tPQ',
    // Famo
    faPericias: '04jvmyYwz995nYPPI7nB', faNuncaSozinho: '6XHeEo2jtTWNCshwNnfp',
    faOrdemAntes: 'xRPo4x84l52nKATML4x0',
    // Forasteiro
    foPericias: 'kROLrJ0O27jK3PK9OQmA', foRixa: 'EL5NAL0MlZDF966UCpxk',
    foSemPovo: '18DdTPYfV7Wpc8fQwIiN',
    // Caçador
    caAlquimancia: 'mWunLe957F7B43ecLjo2', caArmasDistancia: 'rAU1MPjcbGE5UFVDmZIb',
    caPericias: 'xD7Hg2MATXrw7dAxu9tE', caDominioDisparo: 'IsH5ccmMl5rdRtAQgG5L',
    // Ladino
    laPericias: 'QfqFS9ZVskPF8rz3kWWh', laFragilidade: '2qbLhnYo0isyrmg4UFZ7',
    laDominioPrecisao: 'Pe11wtDDa2yvSRtr4rva',
    // Avulsas
    memoria: 'LHS2j2967lCetPWaDOiU', sonoLeve: 'TTRc0zlmej8hzoJSDMGU',
    vegetariano: 'iLiv4XDCvNnrHwg2oqwn', alergico: 'rwcFOPuLi5AAqpheMnVW',
    hipermovel: 'iLmStxXBfcQGqwRJW25k', duplaFace: 'IJi4Fsjc5Dp4fhm4m7th',
    cicatriz: '1LotEGqT4Zw8Tx27MQJ1', feio: 'sJLGq31pseo9lJuxVVNC',
};

const DV_ALTURA = 'XPv2i5GhoHfz2QSH3pCl';
const DV_MARCA_CACA = 'uoapJGdcUgYtBuyU9B9q';
const BP = { mao: '6r4QB7jnlln8WpehKzS4', torso: 'X30m2EwEJ7j736kn3VFQ',
    costas: 'LlkbcV44ucq3bu0qT8fd', cabeca: 'D4SUWu7uMrvZttWC4E2B',
    cintura: 'P881bM97Ahm1No9dTGAX' };

/* ═══════════════ Ledgers — 100 (mesa) + 80 (bônus) ═══════════════ */
const LEDGER_VIREU = [
    ['Avulsa: Memória Prodigiosa Nv3', 10], ['Avulsa: Sono Leve Nv2', 6],
    ['Avulsa: Vegetariano Nv1 (rende)', -2], ['Avulsa: Alérgico Nv3 (rende)', -10],
    ['DES 3→4', 20], ['DES 4→5', 25], ['RAC 3→4', 20], ['VIG 3→4', 20], ['PRS 2→3', 15],
    ['Perícia: Disparo 3→4', 16], ['Perícia: Pontaria 0→3', 24],
    ['Perícia: Marcar Presa 0→2', 12], ['Perícia: Furtividade 2→3', 12],
    ['Perícia: Observação 2→3', 12],
];
const LEDGER_HESK = [
    ['Avulsa: Hipermóvel Nv2', 9], ['Avulsa: Dupla-Face Nv2', 9],
    ['Avulsa: Cicatriz Notável Nv1 (rende)', -4], ['Avulsa: Feio Nv2 (rende)', -6],
    ['DES 3→4', 20], ['DES 4→5', 25], ['AUT 3→4', 20],
    ['Perícia: Furtividade 3→4', 16], ['Perícia: Precisão 1→3', 20],
    ['Perícia: Arma 1→3', 20], ['Perícia: Subterfúgio 0→2', 12],
    ['Perícia: Reflexo 2→3', 12], ['Perícia: Malandragem 2→3', 12],
    ['Perícia: Agilidade 1→2', 8],
    ['Manobras de Ladino (7 × 1 EXP)', 7],
];
const soma = l => l.reduce((s, [, v]) => s + v, 0);
const ganhoDesvantagens = l => l.filter(([, v]) => v < 0).reduce((s, [, v]) => s - v, 0);

assert.equal(soma(LEDGER_VIREU), EXP_MESA + EXP_BONUS, 'Vireu tem que gastar os 180 EXP');
assert.equal(soma(LEDGER_HESK), EXP_MESA + EXP_BONUS, 'Hesk tem que gastar os 180 EXP');
assert.ok(ganhoDesvantagens(LEDGER_VIREU) <= 30, 'teto de 30 EXP em desvantagens (Vireu)');
assert.ok(ganhoDesvantagens(LEDGER_HESK) <= 30, 'teto de 30 EXP em desvantagens (Hesk)');

/* ═══════════════ Valores derivados esperados ═══════════════
 * Calculados aqui pelas fórmulas dos registros. Ver o cabeçalho do script da
 * sessão 1: o npc-calc-engine ignora toda perícia (prefixo "Perícia:" não bate
 * no targetMap) e lê Tamanho = 0 na Vitalidade (2 passadas para uma cadeia de
 * 3 níveis). O que diverge vira `override`, que é o que o Tabuleiro lê. */
const ESPERADO = {
    'Vireu, a Contadora': {
        // Altura 1,80 → Tamanho 5,4
        VIT: 28,   // (VIG 4 + Tamanho 5,4) × 3 = 28,2
        ENER: 5,   // PRS 3 + AUT 2
        SAN: 14,   // (INT 2 + AUT 2 + PRS 3 + Resiliência 0) × 2
        PERC: 7,   // RAC 4 + Observação 3
        INI: 3,    // AUT 2 + RAC 4 + DES 5 + Agilidade 0 − Tamanho 5,4 − 3 (Famo) = 2,6
        REA: 4,    // mín(DES 5, RAC 4) + Agilidade 0
        BLD: 1,    // Armadura Leve
        DESLOCAMENTO: '12m',  // FOR 2 + DES 5 + Agilidade 0 + Tamanho 5,4 = 12,4
    },
    'Hesk, o Cinza': {
        // Altura 1,75 → Tamanho 5,25
        VIT: 22,   // (VIG 2 + Tamanho 5,25) × 3 = 21,75 — mas ver Fragilidade Letal
        ENER: 6,   // PRS 2 + AUT 4
        SAN: 14,   // (INT 1 + AUT 4 + PRS 2 + Resiliência 0) × 2
        PERC: 3,   // RAC 3 + Observação 0
        INI: 10,   // AUT 4 + RAC 3 + DES 5 + Agilidade 3 − Tamanho 5,25 = 9,75
        REA: 6,    // mín(DES 5, RAC 3) + Agilidade 3
        BLD: 1,    // Couro Batido sob a capa
        DESLOCAMENTO: '16m',  // FOR 3 + DES 5 + Agilidade 3 + Tamanho 5,25 = 16,25
    },
};

const SLOTS_PARES = { [BP.mao]: 2, kc9p3jiFtOJJ5qiOElFq: 2, l668esm4kmmyvSfMN4L3: 2,
    epAss2ikwrSiMvd0Egid: 2, gFkuXKCVJ5WLhuvFD4P0: 2 };

/* ═══════════════ Os dois ═══════════════ */
const VIREU = {
    nome: 'Vireu, a Contadora',
    tipo: 'npc', nivel: 5, porte: 'Médio',
    papel: 'Arqueira de torneio — a favorita da casa',
    local: 'Arena de Famélia',
    tamanho: '1,80m — Elorin espigada, olhos que acendem quando lê essência',
    tags: 'torneio famélia, arena, arqueira, elorin, famo, caçador, chefe, dupla, sessão 2, a contadora e o cinza',
    racaRef: { refId: RACA.elorin, custom: '' }, raca: 'Elorin',
    classeRef: { refId: CLASSE.cacador, custom: '' }, classe: 'Caçador',
    triboRef: { refId: TRIBO.famo, custom: '' }, tribo: 'Famo',
    atributos: { INT: 2, RAC: 4, PRS: 3, FOR: 2, DES: 5, VIG: 4, PRE: 3, MAN: 1, AUT: 2 },
    peculiaridades: [
        { refId: PEC.elConexao, nivel: 1, fonte: 'raca' },
        { refId: PEC.elVenenos, nivel: 1, fonte: 'raca' },
        { refId: PEC.elSaciedade, nivel: 1, fonte: 'raca' },
        { refId: PEC.elVisaoEssencia, nivel: 1, fonte: 'raca' },
        { refId: PEC.faPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.faNuncaSozinho, nivel: 1, fonte: 'tribo' },
        { refId: PEC.faOrdemAntes, nivel: 1, fonte: 'tribo' },
        { refId: PEC.caAlquimancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.caArmasDistancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.caPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.caDominioDisparo, nivel: 1, fonte: 'classe' },
        { refId: PEC.memoria, nivel: 3, fonte: null },
        { refId: PEC.sonoLeve, nivel: 2, fonte: null },
        { refId: PEC.vegetariano, nivel: 1, fonte: null },
        { refId: PEC.alergico, nivel: 3, fonte: null },
    ],
    /* Níveis GRAVADOS. Por cima somam sozinhas: classe +1 Disparo e +1 Herbalismo;
       tribo Famo +1 Cobertura. As escolhas de `distribuir` já estão embutidas
       (classe: +1 Esquiva e +1 Cobertura; Famo: +1 Arma). */
    periciasEstruturadas: [
        { refId: SK.disparo, nivel: 4 }, { refId: SK.pontaria, nivel: 3 },
        { refId: SK.marcarPresa, nivel: 2 }, { refId: SK.furtividade, nivel: 3 },
        { refId: SK.observacao, nivel: 3 }, { refId: SK.esquiva, nivel: 3 },
        { refId: SK.cobertura, nivel: 3 }, { refId: SK.atletismo, nivel: 1 },
        { refId: SK.investigacao, nivel: 1 }, { refId: SK.herbalismo, nivel: 1 },
        { refId: SK.erudicao, nivel: 1 }, { refId: SK.arma, nivel: 1 },
    ],
    modulosClasse: [{ refId: 'marcar_presa', snapshot: null, fonte: 'classe', itens: [
        { nome: 'A Presa', valores: {
            1: 'Marca quem desferiu o golpe que matou o Grakkun na sessão passada. '
             + 'Ela viu, ela lembra, e faz questão de dizer o nome em voz alta antes de puxar a corda.',
            acao: 'Ação Padrão', 2: DV_MARCA_CACA } },
    ] }],
    altura: 1.80,
    itens: [
        { modelo: 'Arco Longo', slot: `${BP.mao}_1`, estado: 'empunhado', extras: [`${BP.mao}_2`] },
        { modelo: 'Aljava de Caça', slot: BP.costas, estado: 'fixado' },
        { modelo: 'Flecha de Penacho', qtd: 20, dentroDaAljava: true },
        { modelo: 'Flecha de Penacho Envenenada +1', qtd: 6, dentroDaAljava: true },
        { modelo: 'Armadura Leve', slot: BP.torso, estado: 'vestido' },
        { modelo: 'Faca celene', slot: `${BP.mao}_2`, estado: null },
        { modelo: 'Manto de Patrulha', slot: BP.cabeca, estado: 'vestido' },
    ],
    ataques: [
        'Arco Longo — Alvo 9 (DES 5 + Disparo 5, estourou o teto) · Dano 1d8+2',
        '  Flecha envenenada: 1d8+3 e o veneno por cima. Ela tem SEIS.',
        'Duas ações por turno = DOIS tiros por turno. É a ameaça real dela.',
        'Faca celene (se encostarem nela) — Alvo 6 · Dano 1d4+2. Ela não quer isto.',
        '',
        '⭐ A CONTAGEM — o coração da luta',
        'Ela entra com 26 flechas: 20 comuns + 6 envenenadas, e ANUNCIA O NÚMERO EM VOZ ALTA',
        'a cada disparo. "Vinte e cinco." "Vinte e quatro." A arquibancada conta junto.',
        'Recolher flecha do chão custa 1 ação. Flecha que erra e some, sumiu.',
        'Diga o número toda vez — é o relógio da cena, e é o que dá aos jogadores',
        'uma vitória que não é matar: fazer ela GASTAR.',
        '',
        'MARCAR PRESA — Ação Padrão, Marca de Caça sobre um alvo.',
        '  Ela marca quem matou o Grakkun. Diz o nome antes. É pessoal e é teatro,',
        '  porque a plateia quer sangue com nome.',
        '',
        'A ORDEM VEM ANTES (Famo) — Iniciativa −3, já embutida. Ela atira DEPOIS',
        '  de ver o que todo mundo fez. É treino, não lentidão.',
        'UM FAMO NUNCA ESTÁ SOZINHO — com o Hesk adjacente, +1 Cobertura e +1 Proteger.',
        'VISÃO DE ESSÊNCIA (Elorin) — enxerga essência: sabe quem está ferido,',
        '  sabe quem está conjurando, e mira nisso.',
    ].join('\n'),
    skills: [
        'Disparo 5 · Pontaria 3 · Cobertura 4 · Esquiva 3 · Furtividade 3 · Observação 3',
        'Marcar Presa 2 · Herbalismo 2 · Atletismo 1 · Investigação 1 · Erudição 1 · Arma 1',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Educada com todo mundo, inclusive com quem está matando',
            'Conta tudo em voz alta — flechas, passos, batidas de coração alheias',
            'Envergonhada do parceiro, e odeia estar envergonhada disso',
        ],
        trejeitos: '• ANUNCIA o número de flechas restantes a cada disparo. Sempre. Mesmo perdendo.\n'
            + '• Cumprimenta o adversário com o arco baixo antes de começar, e cumprimenta de novo se ele cair bem.\n'
            + '• Os olhos acendem devagar quando lê essência — dá para ver de longe quando ela está mirando alguém ferido.\n'
            + '• Não pisa em sangue. Contorna. Sempre.\n'
            + '• Chama o Hesk de "meu colega", nunca pelo nome, e nunca olha para ele ao dizer.',
        motivacao: 'A bolsa paga uma dívida que não é dela — é da família. Ela conta as flechas '
            + 'porque conta tudo: o que deve, o que falta, quantas lutas ainda. É a única forma '
            + 'que encontrou de a coisa caber na cabeça.',
        segredos: '⚠ FRAQUEZAS DE MESA:\n'
            + '• 28 de Vitalidade e Blindagem 1. Ela não aguenta corpo a corpo, e sabe.\n'
            + '• Iniciativa 3 — ela age DEPOIS da maioria. É a janela do grupo.\n'
            + '• MUNIÇÃO FINITA: 26 flechas, e ela conta em voz alta. Forçar ela a gastar '
            + 'é uma condição de vitória paralela. Sem flecha ela tem uma faca e vergonha.\n'
            + '• Alérgica Nv3 (o Mestre escolhe a propriedade alquímica com o grupo, ou sorteia). '
            + 'Se algum jogador tiver a loção certa, isso a tira da luta.\n'
            + '• Ela não pisa em sangue — dá para negar terreno a ela sujando o chão.\n\n'
            + '★ ELA É A FAVORITA DA CASA. Famo, de Famélia, uma dos deles. '
            + 'A arquibancada que jogou uma rede para os jogadores na sessão passada '
            + 'NÃO vai jogar nada desta vez. A plateia mudou de lado, e isso deve ficar '
            + 'óbvio na primeira rodada.\n\n'
            + '★ SE O HESK CAIR: ela não foge e não se rende. Termina a luta, educadamente, '
            + 'e é aí que fica perigosa — sem o parceiro ela para de se conter.',
        relacoes: {
            aliado: 'Hesk, o Cinza — parceria de contrato, não de amizade. Ela nem sabe a cara dele.',
            rival: 'Os jogadores, especificamente quem matou o Grakkun. Ela viu.',
            devedor: 'A própria família, que deve a alguém que o Mestre ainda pode escolher',
        },
        frases: '"Vinte e três."\n'
            + '"Você foi quem matou o gigante. Eu vi. Todo mundo viu."\n'
            + '"Não é pessoal, é conta."\n'
            + '"Meu colega vai por baixo. Eu vou por cima. Boa sorte."',
        historia: 'Elorin criada entre os Famo das planícies — floresta no sangue, legião na cabeça. '
            + 'Aprendeu a atirar num regime que ensina primeiro onde ficar e só depois onde acertar, '
            + 'e é por isso que ela dispara por último e quase nunca erra. Veio ao torneio pela bolsa, '
            + 'e como é da casa, a cidade adotou. Assistiu à luta da sessão passada da primeira fileira, '
            + 'contando os golpes.',
    },
    loot: {
        itens: 'Arco Longo\nAljava de Caça\nFlechas que sobrarem (conte de verdade — '
            + 'o que ela não gastou, o grupo leva)\n6 Flechas de Penacho Envenenadas +1 (menos as usadas)\n'
            + 'Armadura Leve\nFaca celene\nManto de Patrulha\n'
            + 'Um caderninho com colunas de números que não são flechas',
        luns: '4d10+50',
        pistas: 'O caderninho é a dívida da família dela, anotada em parcelas. '
            + 'Mesmo formato do contrato que a Vespa carregava — o Mestre decide se é coincidência.',
        complicacoes: 'Matar a favorita da casa em Famélia tem preço com a arquibancada, '
            + 'e a arquibancada é quem paga a bolsa.',
    },
};

const HESK = {
    nome: 'Hesk, o Cinza',
    tipo: 'npc', nivel: 5, porte: 'Médio',
    papel: 'Duelista de becos — o mascarado que ninguém viu lutar antes',
    local: 'Arena de Famélia',
    tamanho: '1,75m — encapuzado dos pés à cabeça, nenhum fio de cabelo à mostra',
    tags: 'torneio famélia, arena, ladino, karu-selvagem, forasteiro, mascarado, chefe, dupla, sessão 2, a contadora e o cinza',
    racaRef: { refId: RACA.karuSelvagem, custom: '' }, raca: 'Karu-Selvagem',
    classeRef: { refId: CLASSE.ladino, custom: '' }, classe: 'Ladino',
    triboRef: { refId: TRIBO.forasteiro, custom: '' }, tribo: 'Forasteiro',
    atributos: { INT: 1, RAC: 3, PRS: 2, FOR: 3, DES: 5, VIG: 2, PRE: 2, MAN: 2, AUT: 4 },
    peculiaridades: [
        { refId: PEC.kaCabecaQuente, nivel: 1, fonte: 'raca' },
        { refId: PEC.kaPesInvertidos, nivel: 2, fonte: 'raca' },
        { refId: PEC.kaSangueImpuro, nivel: 1, fonte: 'raca' },
        { refId: PEC.foPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foRixa, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foSemPovo, nivel: 1, fonte: 'tribo' },
        { refId: PEC.laPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.laFragilidade, nivel: 1, fonte: 'classe' },
        { refId: PEC.laDominioPrecisao, nivel: 1, fonte: 'classe' },
        { refId: PEC.hipermovel, nivel: 2, fonte: null },
        { refId: PEC.duplaFace, nivel: 2, fonte: null },
        { refId: PEC.cicatriz, nivel: 1, fonte: null },
        { refId: PEC.feio, nivel: 2, fonte: null },
    ],
    /* Somam sozinhas por cima: classe +1 em Arma, Furtividade, Malandragem e
       Agilidade; raça Pés Invertidos Nv2 dá +2 em Briga e +2 em Esquiva.
       A escolha livre do Forasteiro (1 ponto) já está em Precisão. */
    periciasEstruturadas: [
        { refId: SK.furtividade, nivel: 4 }, { refId: SK.precisao, nivel: 3 },
        { refId: SK.arma, nivel: 3 }, { refId: SK.reflexo, nivel: 3 },
        { refId: SK.malandragem, nivel: 3 }, { refId: SK.subterfugio, nivel: 2 },
        { refId: SK.esquiva, nivel: 2 }, { refId: SK.contraAtaque, nivel: 2 },
        { refId: SK.agilidade, nivel: 2 }, { refId: SK.intimidacao, nivel: 1 },
        { refId: SK.investigacao, nivel: 1 }, { refId: SK.anatomia, nivel: 1 },
        { refId: SK.briga, nivel: 0 },
    ],
    modulosClasse: [{ refId: 'manobras_ladino', snapshot: null, fonte: 'classe', itens: [
        'Golpe pelas Costas', 'Golpe Preciso', 'Salto Predatório', 'Retirada Ágil',
        'Passos Sombrios', 'Sombra Acelerada', 'Ataque Mudo',
    ] }],
    altura: 1.75,
    itens: [
        { modelo: 'Punhal', slot: `${BP.mao}_1`, estado: 'empunhado' },
        { modelo: 'Adaga de Lastro', slot: `${BP.mao}_2`, estado: 'empunhado' },
        { modelo: 'Couro Batido', slot: BP.torso, estado: 'vestido' },
        { modelo: 'Capa com Capuz Puída', slot: BP.costas, estado: 'vestido' },
        { modelo: 'Máscara de Furtividade Noturna', slot: BP.cabeca, estado: 'vestido' },
        { modelo: 'Kit de Larápio Simples', slot: BP.cintura, estado: 'fixado' },
    ],
    ataques: [
        'Punhal — Alvo 9 (DES 5 + Arma 4) · Dano 1d6+3',
        '  ⚠⚠ ADAGA CONTRA ALVO VIVO E ORGÂNICO: O DANO DOBRA. 2×(1d6+3) ≈ 13.',
        'Adaga de Lastro (mão ruim) — Alvo 9 · 1d4+3, também dobra.',
        'Duas ações por turno, e a Sombra Acelerada compra uma terceira.',
        '',
        '⚠⚠ FRAGILIDADE LETAL (Ladino): TODO dano físico contra ele é DOBRADO.',
        '  22 de Vitalidade que valem 11. Dois golpes bons e ele acaba.',
        '  A luta inteira dele é: nunca estar onde a mão do jogador vai.',
        '',
        'MANOBRAS — Energia 6.',
        'Passos Sombrios (1, movimento) — anda o deslocamento INTEIRO (16m) e entra em',
        '  furtivo. Quem não quiser perdê-lo testa Percepção com Desvantagem. ← o loop dele',
        'Golpe pelas Costas (1) — estando furtivo: Alvo = + Furtividade (5), ignora Blindagem,',
        '  +1 de dano por Grau de Sucesso. É o pagamento do Passos Sombrios.',
        'Golpe Preciso (1) — Alvo = + Precisão (3), ignora a Blindagem do alvo.',
        'Retirada Ágil (1) — depois de atacar, move metade do deslocamento sem provocar',
        '  contra-ataque E sem gastar a defesa da rodada.',
        'Salto Predatório (turno inteiro) — atravessa obstáculos até o deslocamento máximo',
        '  sem provocar contra-ataques e ataca no fim. Com 5+ Graus, ignora a Defesa.',
        'Sombra Acelerada (1, livre) — zera a própria Defesa até o próximo turno por 1 ação extra.',
        'ATAQUE MUDO (1) — ignora Defesa E Blindagem. 1× por cena no mesmo alvo.',
        '  Só contra alvo vivo e orgânico. Exige estar furtivo. ← o momento dele. Guarde.',
        '',
        'PÉS INVERTIDOS Nv2 (Karu) — +2 Briga e +2 Esquiva, já embutidos. Os passos dele',
        '  apontam para o lado errado: quem o rastreia pela areia rastreia ao contrário.',
        'CABEÇA QUENTE (Karu) — pode INCENDIAR O PRÓPRIO CABELO. Teste de AUT + Resiliência',
        '  por cena. Sucesso: +1 no Alvo em qualquer teste de Atributo Físico, RAC ou PRE.',
        '  Falha: 1d4 de dano de sanidade e perde parcialmente os sentidos pelo resto da cena.',
    ].join('\n'),
    skills: [
        'Furtividade 5 · Malandragem 4 · Arma 4 · Esquiva 4 · Precisão 3 · Reflexo 3',
        'Agilidade 3 · Subterfúgio 2 · Contra-Ataque 2 · Briga 2 · Anatomia 1 · Intimidação 1',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Não fala. Nem uma palavra, a luta inteira',
            'Cumpre o contrato à risca e nem um passo além dele',
            'Aterrorizado de ser reconhecido, e é isso que o move',
        ],
        trejeitos: '• SILÊNCIO ABSOLUTO. Não grita, não provoca, não geme quando apanha. '
            + 'A arquibancada acha isso arrepiante e é por isso que gostam dele.\n'
            + '• Máscara e capuz o tempo todo, mesmo no calor. Nunca tira. Nunca.\n'
            + '• Anda com o peso na ponta do pé — pés invertidos, pegada apontando para trás.\n'
            + '• Aponta com o punhal em vez de falar. É toda a comunicação dele com a Vireu.\n'
            + '• Encosta na parede antes de decidir qualquer coisa.',
        motivacao: 'A bolsa, e o anonimato que ela compra. Ele luta mascarado porque é '
            + 'Karu-Selvagem — e Sangue Impuro não é só uma peculiaridade na ficha dele, '
            + 'é o motivo de nunca ter sido aceito em lugar nenhum. Ganhar mascarado é '
            + 'a única forma de ganhar.',
        segredos: '⚠ FRAQUEZAS DE MESA:\n'
            + '• FRAGILIDADE LETAL dobra o dano físico contra ele. 22 de Vitalidade valem 11. '
            + 'Se os jogadores conseguirem ENCOSTAR, acabou. A luta é sobre isso.\n'
            + '• Blindagem 1, Vigor 2. Nenhuma resistência a nada.\n'
            + '• Percepção 3 e sem Observação: ele não repara em armadilha, em preparação, '
            + 'em ninguém se posicionando. Só olha para o alvo.\n'
            + '• Área e empurrão o quebram: ele depende de escolher o ângulo. '
            + 'Rede, agarrão, terreno estreito e qualquer coisa que negue movimento valem '
            + 'mais contra ele do que dano.\n\n'
            + '★★ O MOMENTO DA CENA — A MÁSCARA:\n'
            + 'Quando ele estiver perdendo (metade da Vitalidade, ou quando a Vireu cair), '
            + 'ele usa CABEÇA QUENTE: incendeia o próprio cabelo. O capuz queima junto.\n'
            + 'A arena inteira vê a juba vermelha de um Karu-Selvagem pela primeira vez.\n'
            + 'Como Famélia reage a isso é DECISÃO SUA — o sistema só diz que Karu-Selvagem '
            + 'sofrem exclusão, não diz o que esta cidade faz. Escolha antes da sessão, '
            + 'porque é a cena que os jogadores vão lembrar.\n'
            + 'Depois disso ele fala pela primeira vez, ou não fala nunca mais. Sua escolha.\n\n'
            + '★ SE A VIREU CAIR: ele não vinga e não negocia. Vai embora pela grade, '
            + 'se conseguir. O contrato acabou quando a parceira caiu.',
        relacoes: {
            aliado: 'Vireu, a Contadora — ela nunca olhou para ele. Ele prefere assim.',
            rival: 'Qualquer um que tente tirar a máscara dele',
            devedor: 'Ninguém. É a única coisa de que ele se orgulha.',
        },
        frases: '(nada)\n(nada)\n(aponta o punhal para o jogador mais ferido)\n'
            + '— e, se o Mestre quiser, uma única frase depois que a máscara queimar.',
        historia: 'Karu-Selvagem sem tribo, sem cidade e sem nome que ele use em público. '
            + '"Hesk" é o que está escrito no contrato; "o Cinza" é o que a arena grita. '
            + 'Aprendeu a lutar em beco, não em treino, e aprendeu que a máscara vale mais '
            + 'que a arma. Nunca perdeu uma luta em Famélia — e ninguém em Famélia sabe '
            + 'que cor de cabelo tem por baixo do capuz.',
    },
    loot: {
        itens: 'Punhal\nAdaga de Lastro\nCouro Batido\nCapa com capuz puída (queimada, se ele usou Cabeça Quente)\n'
            + 'Máscara de Furtividade Noturna\nKit de larápio simples\n'
            + 'Nenhum documento. Nenhum nome. Nada escrito.',
        luns: '3d10+40',
        pistas: 'A ausência é a pista: nenhum papel, nenhuma marca de tribo, nada. '
            + 'Alguém sem passado nenhum é alguém que pagou caro para não ter.',
        complicacoes: 'Se a máscara cair e ele sobreviver, ele passa a dever aos jogadores '
            + 'o silêncio deles — ou a temê-los. As duas coisas dão gancho.',
    },
};

/* ═══════════════ Montagem (mesma da sessão 1) ═══════════════ */
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
        derivedValues: sd.derivedValues.map(dv => ({ ...dv, key: dv.key || dv.id, escopoItem: dv.escopoItem || '' })),
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

function partesDoCorpo(sys) {
    return JSON.parse(JSON.stringify(sys.bodyParts.filter(bp => bp.ehPadrao)
        .map(bp => ({ ...bp, slots: SLOTS_PARES[bp.id] || 1 }))));
}

function montaModulos(spec, sys) {
    return (spec.modulosClasse || []).map(v => {
        const def = sys.classModulesById[v.refId];
        assert.ok(def, `módulo "${v.refId}" não existe no registro`);
        const pre = def.itensPredefinidos || [];
        const itens = v.itens.map(x => {
            if (typeof x === 'string') {
                const hit = pre.find(p => p.nome === x);
                assert.ok(hit, `item "${x}" não existe no módulo ${v.refId}`);
                return { id: 'mi-' + hit.id, predefinidoId: hit.id, nome: hit.nome, valores: { ...hit.valores } };
            }
            return { id: 'mi-' + v.refId + '-' + sys.norm(x.nome).replace(/\W+/g, ''), predefinidoId: null,
                nome: x.nome, valores: x.valores };
        });
        return { refId: v.refId, snapshot: null, fonte: v.fonte, itens };
    });
}

function montaItens(spec, sys, npcId) {
    const feitos = [];
    let aljavaId = null;
    spec.itens.forEach((it, i) => {
        const tpl = sys.equipment.find(e => e.nome === it.modelo);
        assert.ok(tpl, `equipamento "${it.modelo}" não existe no catálogo`);
        const id = `item-s2-${npcId}-${i}`;
        const doc = {
            id, nome: tpl.nome, tipo: tpl.tipo, modeloId: tpl.id,
            categoriaArma: tpl.categoriaArma || null,
            peso: tpl.peso ?? 1, pressaoBase: tpl.peso ?? 1, tamanho: tpl.tamanho ?? 1,
            quantidade: it.qtd ?? 1, descricao: '', formulaDano: '', imagem: tpl.imagemUrl || '',
            equipavelEm: tpl.equipavelEm || null, formaEquipar: tpl.formaEquipar || null,
            mecanicaIdsProprias: [],
            characterId: npcId, ownerType: 'npc', ownerUid: '', ownerId: '',
            ehContainer: !!tpl.ehContainer,
            pesoMaximoContainer: tpl.ehContainer ? (tpl.pesoMaximoContainer ?? 10) : null,
            multiplicadorPressao: tpl.ehContainer ? (tpl.multiplicadorPressao ?? 1) : null,
            equipado: !!it.slot, slotAnatomico: it.slot || null, slotsOcupados: it.extras || [],
            estadoEquip: it.estado || null, parentItemId: null,
            criadoPor: 'mestre', lastModified: new Date().toISOString(),
        };
        if (tpl.ehContainer) aljavaId = id;
        if (it.dentroDaAljava) {
            assert.ok(aljavaId, 'a aljava tem que vir ANTES das flechas na lista');
            doc.parentItemId = aljavaId;
        }
        feitos.push(doc);
    });
    return feitos;
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
        partesDoCorpo: partesDoCorpo(sys),
        valoresDer: { overrides: { [DV_ALTURA]: spec.altura }, atual: {}, extras: [], vinculados: [] },
        ataques: spec.ataques, skills: spec.skills,
        rolePlay: spec.rolePlay, loot: spec.loot, criatura: null,
        vinculos: [{ tipo: 'mesa', id: MESA_ID }], mesaId: MESA_ID,
        lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
    };
    const items = montaItens(spec, sys, npcId);

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
    npc.valoresDer.vinculados = Object.values(NOME_DV).map(n => findDvKeyLike(n, sys)).filter(Boolean);

    return { npc, items, calc, divergencias };
}

/* ═══════════════ Execução ═══════════════ */
const sys = await carregarSys();

const mesa = await db.collection('mesas').doc(MESA_ID).get();
assert.ok(mesa.exists, 'mesa Torneio Famélia não encontrada');
assert.equal(mesa.data().config?.expInicial, EXP_MESA,
    `a mesa precisa estar com expInicial ${EXP_MESA} — o ledger foi construído em cima disso`);

const existentes = await db.collection('npcs').get();
const planos = [];
for (const spec of [VIREU, HESK]) {
    const ja = existentes.docs.find(d => (d.data().nome || '').trim() === spec.nome);
    const npcId = ja ? ja.id : db.collection('npcs').doc().id;
    planos.push({ spec, npcId, ...montaNpc(spec, sys, npcId), novo: !ja });
}

console.log(`\n✅ ${LEDGER_VIREU.length + LEDGER_HESK.length} linhas de ledger e 4 asserts passaram.`);
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
    const ledger = p.spec === VIREU ? LEDGER_VIREU : LEDGER_HESK;
    console.log('   EXP:', ledger.map(([n, c]) => `${n} ${c > 0 ? '−' : '+'}${Math.abs(c)}`).join(' | '));
    if (p.divergencias.length) console.log('   🔒 travados por override:', p.divergencias.join(' · '));
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
console.log('\n🏟️  A segunda dupla está na mesa Torneio Famélia.\n');
process.exit(0);
