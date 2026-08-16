/**
 * Torneio Famélia — a dupla "A Luz e o Furo".
 *
 * Mesma régua de sempre: criação padrão por pontos (atributos 5/4/3, perícias
 * 6/4/3/2) + 180 EXP cada (100 da mesa + 80 de bônus), gastos até o último
 * ponto, ledger conferido por assert.
 *
 * DESENHO — terceira forma de luta, de novo diferente em espécie:
 *   S1: muro + apoio voador   → o problema era ALCANÇAR.
 *   S2: dois frágeis e móveis → o problema era PRENDER.
 *   S3: o Xamã e o Eco        → o problema era o TOTEM (e havia saída sem luta).
 *   Aqui: cura + invocação    → o problema é ECONOMIA. Não dá para vencer no
 *   dano: a Aurenna cura 20 de Vitalidade por conjuração e o Vint transforma
 *   2 inimigos em 3, 4, 5. Ou o grupo estoura um dos dois rápido, ou afunda.
 *
 * A alavanca social está embutida na raça dela: Orgulho Inflexível dá −2 no
 * Alvo de AUT para resistir a provocação contra a honra ou a linhagem. Os
 * jogadores podem QUEBRAR a dupla pela boca — e a dupla já se odeia.
 *
 * FORMATO: item de módulo é PLANO (`itemDePredefinido`), nunca aninhado em
 * `valores`, e `sys.derivedValues` vai ORDENADO — as duas lições dos anteriores.
 *
 *   node functions/cadastrar-torneio-famelia-s4.mjs            (dry-run)
 *   node functions/cadastrar-torneio-famelia-s4.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calcularNpc } from '../painel-mestre/js/npc-calc-engine.js';
import { itemDePredefinido } from './corrigir-modulos-npcs-torneio.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const MESA_ID = 'd4Oi7KmowQ2gY4OU0Im8';
const EXP_MESA = 100, EXP_BONUS = 80;
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const DV_ALTURA = 'XPv2i5GhoHfz2QSH3pCl';
const BP = { mao: '6r4QB7jnlln8WpehKzS4', torso: 'X30m2EwEJ7j736kn3VFQ',
    costas: 'LlkbcV44ucq3bu0qT8fd', cabeca: 'D4SUWu7uMrvZttWC4E2B',
    pescoco: 'N9Edzg351d084HWjZRHU', cintura: 'P881bM97Ahm1No9dTGAX' };
const SLOTS_PARES = { [BP.mao]: 2, kc9p3jiFtOJJ5qiOElFq: 2, l668esm4kmmyvSfMN4L3: 2,
    epAss2ikwrSiMvd0Egid: 2, gFkuXKCVJ5WLhuvFD4P0: 2 };

const SK = {
    lideranca: 'WxiDQbbjUVp8d3DvBzZ1', diplomacia: 'UdytU8GAUtegaiTulHWj',
    tradicao: 'eeSFxay9lmwN4gtaVm28', erudicao: 'KJNhM6DkPtSvQrCQ6CQG',
    resiliencia: 'vmGgjukW0qVyAYvD43kB', bloquear: 'KV4sIXGx09GmTtpCdkIx',
    proteger: 'QMPYufyZvvi5odTc3ciQ', labuta: 'CdlC75JYSv0spqFANmCw',
    atletismo: 'X9YAuh9fF9H1LUSeiuTc', anatomia: 'p05TPY9EKnKP8miTXUY1',
    investigacao: 'yV7Y7PvHjbyFIZlaAo4t', devocaoPalla: 'nW2nZq0cguayj2o9Aslu',
    simboloSagrado: 'aQOg5YKAARgyCNKku31q', erudicaoLiturgica: 'DkrwldHzuphUosDRxgYU',
    abismancia: 'ObShLQBLQIEDH617g77n', seloAbissal: 'vXjs1l1fNDZb78UXyhLX',
    contatoOitavo: 'KrtqrgaEThXEgmJGXl4k', resistenciaLoucura: 'Cv98lI7GViXYnzruTZRi',
    malandragem: 'NCE01BoA4IFPuQAZBlJP', observacao: 'Jco4d1DhmVRRNYA7t8wu',
    esquiva: '6XaUJvRYMDnoFir8EVbd', furtividade: 'zReRsG9Ch9To4Og1M1BD',
    herbalismo: 'zEa49LJzTXmnKj3YALma', sobrevivencia: 'sBKfM7ghyrzyVJIaxPo5',
    prestidigitacao: 'rEpGHl0iMIRc7mgEf292', agilidade: 'fIzydbVAsvy79lO5G2vb',
};
const PEC = {
    // Karu-Real
    krEducacao: 'dC80iIsvK6aJlrPFf614', krLinhagem: '0GGIOusckz7Py4kQEs1G',
    krOrgulho: 'Qo22m8ODDNliVVDJ0mhw', krPes: 'GLeOmhpiZbEUAGx0rjvL',
    // Pogo
    pgAprendizado: 'VTAgZ9vVA7m9uR5MedAg', pgFragil: 'xt6mlizeRwG3B3Nlucgz',
    pgSangue: 'qA3usthlj7u2fHVH4cso', pgVampirismo: 'x005r992kEi3XXtwv72A',
    // Muraté
    muPericias: 'Xo1U1ULoCovjtbma93pN', muMuralha: 'sml7y8ZNqzyvJSYAQA1O',
    muPeFirme: '3erryDYGXOMRgzCnXtvu', muBracoEscudo: 'ew9h36ADZ9o4fIWYz2JS',
    // Forasteiro
    foPericias: 'kROLrJ0O27jK3PK9OQmA', foRixa: 'EL5NAL0MlZDF966UCpxk',
    foSemPovo: '18DdTPYfV7Wpc8fQwIiN',
    // Pallacerdote
    paPericias: 'xbmEc1JEDOoUGj7qlBtJ', paPallomancia: 'jxTlYDz8EPoHlSSNsyBc',
    paDominio: 'dTMyc096BNZn50cHiwUK',
    // Invocador
    ivAbismancia: 'rtdK823VypC8FGvyByJw', ivPericias: 'cJcUESjAtUqNJV9Ps1Ua',
    ivDominio: 'XMEBJ2bng8uMFySzFX4c',
    // Avulsas
    bonito: 'ye1QIuKPw3XLIFYGau21', sortudo: 'ByribV7BwY5emzPfXd5a',
    desajeitado: 'Cu8YLarZoZtHTTmPmdud', roncador: 'Lrs1PU39ffoL6ZLx4PI7',
    vegetariano: 'iLiv4XDCvNnrHwg2oqwn', memoria: 'LHS2j2967lCetPWaDOiU',
    duplaFace: 'IJi4Fsjc5Dp4fhm4m7th', medroso: 'K3xEf81mSV7aPYE5Pxwh',
};

/* ═══════════════ Ledgers — 100 (mesa) + 80 (bônus) ═══════════════ */
const LEDGER_AURENNA = [
    ['Avulsa: Bonito Nv2', 6], ['Avulsa: Sortudo Nv1', 14],
    ['Avulsa: Desajeitado Nv2 (rende)', -8], ['Avulsa: Roncador Nv1 (rende)', -2],
    ['Avulsa: Vegetariano Nv1 (rende)', -2],
    ['PRE 3→4', 20], ['PRE 4→5', 25], ['AUT 3→4', 20], ['PRS 2→3', 15], ['VIG 3→4', 20],
    ['Perícia: Devoção em Palla 1→3', 20], ['Perícia: Símbolo Sagrado 1→3', 20],
    ['Perícia: Resiliência 2→3', 12], ['Perícia: Erudição Litúrgica 0→2', 12],
    ['Perícia: Proteger 1→2', 8],
];
const LEDGER_VINT = [
    ['Avulsa: Memória Prodigiosa Nv2', 6], ['Avulsa: Dupla-Face Nv2', 9],
    ['Avulsa: Medroso Nv1 (rende)', -2], ['Avulsa: Desajeitado Nv1 (rende)', -4],
    ['PRS 3→4', 20], ['PRS 4→5', 25], ['VIG 2→3', 15], ['VIG 3→4', 20],
    ['AUT 3→4', 20], ['RAC 2→3', 15],
    ['Perícia: Abismancia 3→4', 16], ['Perícia: Selo Abissal 1→3', 20],
    ['Perícia: Resistência à Loucura 1→3', 20],
];
const soma = l => l.reduce((s, [, v]) => s + v, 0);
const ganho = l => l.filter(([, v]) => v < 0).reduce((s, [, v]) => s - v, 0);
assert.equal(soma(LEDGER_AURENNA), EXP_MESA + EXP_BONUS, 'Aurenna tem que gastar os 180 EXP');
assert.equal(soma(LEDGER_VINT), EXP_MESA + EXP_BONUS, 'Vint tem que gastar os 180 EXP');
assert.ok(ganho(LEDGER_AURENNA) <= 30 && ganho(LEDGER_VINT) <= 30, 'teto de 30 EXP em desvantagens');

/* ═══════════════ Os dois ═══════════════ */
const AURENNA = {
    nome: 'Aurenna, a Luz de Aluguel',
    tipo: 'npc', nivel: 5, porte: 'Médio',
    papel: 'Pallacerdote de arena — cura por contrato, e sabe o que isso parece',
    local: 'Arena de Famélia',
    tamanho: '1,75m — Karu-Real ruiva, meia-armadura polida, escudo maior que o bom senso',
    tags: 'torneio famélia, arena, pallacerdote, karu-real, muraté, cura, chefe, dupla, sessão 4, a luz e o furo',
    racaRef: { refId: 'ajhYeKDV9oSmT7Sku99x', custom: '' }, raca: 'Karu-Real',
    classeRef: { refId: 'joXBGPu2sdBvnhZ8OsCh', custom: '' }, classe: 'Pallacerdote',
    triboRef: { refId: 'DshuQHh9e5koMpchgAxH', custom: '' }, tribo: 'Muraté',
    atributos: { INT: 3, RAC: 2, PRS: 3, FOR: 2, DES: 1, VIG: 4, PRE: 5, MAN: 2, AUT: 4 },
    peculiaridades: [
        { refId: PEC.krEducacao, nivel: 3, fonte: 'raca' },
        { refId: PEC.krLinhagem, nivel: 1, fonte: 'raca' },
        { refId: PEC.krOrgulho, nivel: 1, fonte: 'raca' },
        { refId: PEC.krPes, nivel: 1, fonte: 'raca' },
        { refId: PEC.muPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.muMuralha, nivel: 1, fonte: 'tribo' },
        { refId: PEC.muPeFirme, nivel: 1, fonte: 'tribo' },
        { refId: PEC.muBracoEscudo, nivel: 1, fonte: 'tribo' },
        { refId: PEC.paPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.paPallomancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.paDominio, nivel: 1, fonte: 'classe' },
        { refId: PEC.bonito, nivel: 2, fonte: null },
        { refId: PEC.sortudo, nivel: 1, fonte: null },
        { refId: PEC.desajeitado, nivel: 2, fonte: null },
        { refId: PEC.roncador, nivel: 1, fonte: null },
        { refId: PEC.vegetariano, nivel: 1, fonte: null },
    ],
    /* Somam sozinhas por cima: classe +1 Performance e +1 Fluxomancia;
       tribo Muraté +1 Bloquear; raça Pés Invertidos +1 Briga e +1 Esquiva.
       Escolhas de `distribuir` já embutidas — classe: +1 Devoção em Palla e
       +1 Símbolo Sagrado; Educação Aristocrática Nv3: +1 Erudição, +1 Anatomia,
       +1 Investigação (3 perícias mentais diferentes). */
    periciasEstruturadas: [
        { refId: SK.devocaoPalla, nivel: 3 }, { refId: SK.simboloSagrado, nivel: 3 },
        { refId: SK.lideranca, nivel: 3 }, { refId: SK.erudicao, nivel: 3 },
        { refId: SK.resiliencia, nivel: 3 }, { refId: SK.diplomacia, nivel: 2 },
        { refId: SK.erudicaoLiturgica, nivel: 2 }, { refId: SK.bloquear, nivel: 2 },
        { refId: SK.proteger, nivel: 2 }, { refId: SK.tradicao, nivel: 1 },
        { refId: SK.labuta, nivel: 1 }, { refId: SK.atletismo, nivel: 1 },
        { refId: SK.anatomia, nivel: 1 }, { refId: SK.investigacao, nivel: 1 },
    ],
    modulosClasse: [
        { refId: 'mod_palla_c1', fonte: 'classe', predefinidos: [
            'Luz Cauterizante I', 'Luz Revigorante I', 'Cegueira da Fé I',
            'Distração da Fé I', 'Penitência da Fé I', 'Luz Reveladora I'] },
        { refId: 'rituais_palla', fonte: 'classe', predefinidos: ['Peregrinação do Amanhecer'] },
    ],
    altura: 1.75,
    itens: [
        { modelo: 'Maça de Armas', slot: `${BP.mao}_1`, estado: 'empunhado' },
        { modelo: 'Escudo Médio', slot: `${BP.mao}_2`, estado: 'segurar' },
        { modelo: 'Meia-Armadura', slot: BP.torso, estado: 'vestido' },
        { modelo: 'Elmo de Placas', slot: BP.cabeca, estado: 'vestido' },
        { modelo: 'Símbolo Sagrado de Madeira', slot: BP.pescoco, estado: 'vestido' },
        { modelo: 'Incenso Consagrado', slot: BP.cintura, estado: 'fixado' },
    ],
    ataques: [
        'Maça de Armas — Alvo 2 (DES 1 + Arma 0 … ela não é lutadora) · 1d8+2',
        '  ⚠ Braço de Escudo (Muraté): −2 de Dano. Ela bate para empurrar, não para matar.',
        'Pé Firme (Muraté): se NÃO se deslocar no turno, +1 na rolagem de defesa.',
        'Muralha Viva (Muraté): Blindagem += Bloquear ÷ 3.',
        '',
        '⭐⭐ CÍRCULO DO DIÁCONO DA LUZ — Energia 7 (+ Graça). 1 Energia ou 1 Graça cada.',
        '',
        'LUZ CAUTERIZANTE I (Ação Padrão, Redutor −2) — CURA 20 DE VITALIDADE num aliado',
        '  a 15m, ou remove 1 condição leve. ← é ISTO que quebra a luta pelo dano.',
        '  Com 7 de Energia ela desfaz, sozinha, mais de 100 de dano ao longo da cena.',
        'LUZ REVIGORANTE I (−3) — 1 aliado a 15m fica Fortalecido 8 por 1 cena',
        '  (+8 no Alvo de VIG e AUT). Ela põe isso no Vint para ele aguentar a Sanidade.',
        'CEGUEIRA DA FÉ I — cone de 6m: Cego por 1 cena se os Graus alcançarem a AUT.',
        'DISTRAÇÃO DA FÉ I — cone de 9m: Exposto 3 (−3 na Defesa) por 1 cena.',
        'PENITÊNCIA DA FÉ I — cone de 9m: Abalado 4 numa perícia escolhida por ela.',
        'LUZ REVELADORA I — raio de 4,5m: revela ocultos e invisíveis; quem for revelado',
        '  PERDE Furtividade até o fim da cena. ← se o Hesk voltar, é o antídoto dele.',
        '',
        'PEREGRINAÇÃO DO AMANHECER (fora de combate, ao nascer do sol) — recarga TOTAL',
        '  de Graça. Se a luta for de manhã, ela entra cheia. Se for à noite, não.',
    ].join('\n'),
    skills: [
        'Devoção em Palla 3 · Símbolo Sagrado 3 · Liderança 3 · Erudição 3 · Resiliência 3',
        'Bloquear 3 · Proteger 2 · Diplomacia 2 · Erudição Litúrgica 2 · Fluxomancia 1 · Performance 1',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Impecável em público e amarga em particular',
            'Trata o Vint como se ele fosse mobília, e ele deixa',
            'Não aguenta uma piada sobre a linhagem dela. Nenhuma.',
        ],
        trejeitos: '• Limpa o símbolo sagrado com o polegar antes de cada conjuração. Sempre o mesmo gesto.\n'
            + '• Planta os pés e NÃO se move — Pé Firme é postura de tribo, não tática do momento.\n'
            + '• Derruba coisas. Muitas coisas. Desajeitada de um jeito que destoa de tudo nela.\n'
            + '• Chama todo mundo de "senhor" e "senhora", inclusive no meio do golpe.\n'
            + '• Quando cura alguém, pede desculpa pela dor. Em voz baixa, para o ferido, não para a plateia.',
        motivacao: 'Precisa do dinheiro e não vai dizer para quê. Curar por contrato numa arena é '
            + 'o tipo de coisa que ela mesma condenaria em outra pessoa, e ela sabe disso a cada '
            + 'conjuração. É por isso que pede desculpa.',
        segredos: '⚠ FRAQUEZAS DE MESA:\n'
            + '• Alvo 2 no ataque. Ela não ameaça ninguém sozinha — a ameaça é o que ela SUSTENTA.\n'
            + '• Deslocamento baixo e Pé Firme: ela não persegue. Sair do alcance dela funciona.\n'
            + '• Energia 7 é o relógio da luta. Cada Luz Cauterizante é 1. Contem.\n\n'
            + '★★ O ORGULHO INFLEXÍVEL É A PORTA DOS FUNDOS:\n'
            + 'Peculiaridade racial dos Karu-Real: −2 no Alvo de AUT para resistir a provocação '
            + 'que ataque a honra ou a linhagem, e falhando ela REAGE AGRESSIVAMENTE.\n'
            + 'Um jogador que a chame de mercenária, de sacerdotisa alugada, ou que compare a '
            + 'linhagem dela com a do Karu-SELVAGEM mascarado da rodada passada, força o teste.\n'
            + 'Falhou: ela larga a posição, sai do Pé Firme e vai atrás do provocador com a maça —\n'
            + 'que é a pior coisa que ela pode fazer, e a melhor coisa que pode acontecer ao grupo.\n'
            + 'ISTO É UMA CONDIÇÃO DE VITÓRIA SOCIAL. Deixe funcionar.\n\n'
            + '★ ELA E O VINT SE ODEIAM. Uma sacerdotisa de Palla e um invocador do Abismo '
            + 'na mesma dupla é escândalo dos dois lados; foi sorteio de chave, não escolha. '
            + 'Ela cura ele porque o contrato manda. Se o grupo der a ela um motivo bom o '
            + 'bastante, ela PARA de curar. Não precisa nem virar aliada — basta parar.',
        relacoes: {
            aliado: 'Vint, o Furo — por contrato, e ela faz questão de que se saiba disso',
            rival: 'Ela mesma, mais que qualquer adversário',
            devedor: 'Alguém que ela não nomeia, e é para essa pessoa que vai a bolsa',
        },
        frases: '"Perdão pela dor, senhor. Vai passar."\n'
            + '"Eu não escolhi o parceiro. Eu escolhi a bolsa. São coisas diferentes."\n'
            + '"Repita isso. Repita olhando para mim."\n'
            + '"Palla ainda escuta. Só está longe."',
        historia: 'Karu-Real de linhagem boa e cofre vazio, ordenada cedo e educada demais para '
            + 'o que a vida acabou exigindo dela. Aprendeu a luz de verdade, e é boa nisso: '
            + 'cura melhor do que a maioria dos que curam de graça. Entrou no circuito de arena '
            + 'porque paga, e porque na areia ninguém pergunta de onde vem o dinheiro do dízimo. '
            + 'Faz o sinal antes de cada luta e não consegue mais decidir se é oração ou desculpa.',
    },
    loot: {
        itens: 'Meia-armadura polida\nElmo de placas\nEscudo médio (com a tinta descascando)\n'
            + 'Maça de armas quase sem uso\nSímbolo sagrado de madeira, gasto no polegar\n'
            + 'Incenso consagrado\nUm recibo dobrado, do valor exato da bolsa da luta',
        luns: '5d10+70',
        pistas: 'O recibo tem um nome e um valor. É para onde vai o dinheiro dela — '
            + 'e é o gancho de quem realmente manda no torneio, se o Mestre quiser puxar.',
        complicacoes: 'Matar uma sacerdotisa de Palla em praça pública é assunto para depois '
            + 'do torneio, e o "depois" tem gente com símbolo no peito.',
    },
};

const VINT = {
    nome: 'Vint, o Furo',
    tipo: 'npc', nivel: 5, porte: 'Pequeno',
    papel: 'Invocador do Abismo — não luta, abre buracos e deixa sair',
    local: 'Arena de Famélia',
    tamanho: '1,10m — Pogo careca, encapuzado, giz nos dedos',
    tags: 'torneio famélia, arena, invocador do abismo, pogo, forasteiro, abismancia, chefe, dupla, sessão 4, a luz e o furo',
    racaRef: { refId: 'JosE6k1vjyjnYFlQn46e', custom: '' }, raca: 'Pogo',
    classeRef: { refId: '04qb3trzuds7elGM4eeP', custom: '' }, classe: 'Invocador do Abismo',
    triboRef: { refId: 'Simp9zHn6nLBP2IQoTYk', custom: '' }, tribo: 'Forasteiro',
    atributos: { INT: 3, RAC: 3, PRS: 5, FOR: 1, DES: 3, VIG: 4, PRE: 2, MAN: 2, AUT: 4 },
    peculiaridades: [
        { refId: PEC.pgAprendizado, nivel: 5, fonte: 'raca' },
        { refId: PEC.pgFragil, nivel: 2, fonte: 'raca' },
        { refId: PEC.pgSangue, nivel: 1, fonte: 'raca' },
        { refId: PEC.pgVampirismo, nivel: 1, fonte: 'raca' },
        { refId: PEC.foPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foRixa, nivel: 1, fonte: 'tribo' },
        { refId: PEC.foSemPovo, nivel: 1, fonte: 'tribo' },
        { refId: PEC.ivAbismancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.ivPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.ivDominio, nivel: 1, fonte: 'classe' },
        { refId: PEC.memoria, nivel: 2, fonte: null },
        { refId: PEC.duplaFace, nivel: 2, fonte: null },
        { refId: PEC.medroso, nivel: 1, fonte: null },
        { refId: PEC.desajeitado, nivel: 1, fonte: null },
    ],
    /* Somam sozinhas por cima: classe +1 Abismancia, +1 Fluxomancia, +1 Performance.
       Escolhas de `distribuir` já embutidas — classe: +1 Selo Abissal;
       Forasteiro: +1 Contato com o Oitavo; Aprendizado Acelerado Nv5: 6 perícias
       DIFERENTES com +1 (Resistência à Loucura, Anatomia, Herbalismo,
       Sobrevivência, Prestidigitação, Agilidade). */
    periciasEstruturadas: [
        { refId: SK.abismancia, nivel: 4 }, { refId: SK.seloAbissal, nivel: 3 },
        { refId: SK.resistenciaLoucura, nivel: 3 }, { refId: SK.esquiva, nivel: 3 },
        { refId: SK.erudicao, nivel: 2 }, { refId: SK.malandragem, nivel: 2 },
        { refId: SK.observacao, nivel: 2 }, { refId: SK.furtividade, nivel: 2 },
        { refId: SK.contatoOitavo, nivel: 1 }, { refId: SK.investigacao, nivel: 1 },
        { refId: SK.anatomia, nivel: 1 }, { refId: SK.herbalismo, nivel: 1 },
        { refId: SK.sobrevivencia, nivel: 1 }, { refId: SK.prestidigitacao, nivel: 1 },
        { refId: SK.agilidade, nivel: 1 },
    ],
    modulosClasse: [{ refId: 'TbRKh68m2hvr9KUVrOXb', fonte: 'classe', predefinidos: [
        'Invocação Abissal', 'Selo Negativo', 'Laço de Nome', 'Plano Inferior'] }],
    altura: 1.10,
    itens: [
        { modelo: 'Talismã Abissal Rústico', slot: BP.pescoco, estado: 'vestido' },
        { modelo: 'Giz de Selos', slot: `${BP.mao}_1`, estado: 'segurar' },
        { modelo: 'Adaga', slot: `${BP.mao}_2`, estado: 'empunhado' },
        { modelo: 'Roupas Escuras Simples', slot: BP.torso, estado: 'vestido' },
        { modelo: 'Capa com Capuz Puída', slot: BP.costas, estado: 'vestido' },
        { modelo: 'Diário de Rituais em Branco', slot: BP.cintura, estado: 'fixado' },
    ],
    ataques: [
        'Adaga — Alvo 3 (DES 3 + Arma 0) · 1d4+1. É piada. Ele sabe que é piada.',
        '',
        '⭐⭐ RITUAIS DE INVOCAÇÃO ABISSAL — Energia 9, SANIDADE 16.',
        '  O recurso dele NÃO é Energia, é SANIDADE. Conte a Sanidade, não a Energia.',
        '  (A Sanidade dele já nasce baixa de propósito: a fórmula do sistema desconta',
        '   Abismancia × 2. Quanto melhor ele é no Abismo, menos cabeça lhe sobra.)',
        '',
        'INVOCAÇÃO ABISSAL (Ação Padrão · 1 Energia + 4 SANIDADE · CA mínimo 2 · Sacrifício)',
        '  ⭐ O CORAÇÃO DA LUTA. Chama uma entidade abissal. A regra do módulo manda',
        '  reportar o CA atual e os Graus de Sucesso ao Mestre, que GERA A CRIATURA EM',
        '  SEGREDO. Quanto mais alto o CA, maior e mais indócil o que responde.',
        '  ⚠ 4 de Sanidade por invocação sobre 16 = QUATRO invocações no total, e a',
        '  quarta o zera. Na prática ele faz duas, no máximo três, e passa a luta',
        '  inteira decidindo se vale a terceira. Faça a primeira na rodada 1 —',
        '  deixe a arena ver o buraco abrir.',
        '',
        'LAÇO DE NOME (1 Energia OU 1 Sanidade · CA 3+ · Redutor −(3 + Risco + AI))',
        '  +1 na Disposição da criatura invocada. É como ele evita que a coisa se vire',
        '  contra ele. Se FALHAR, a criatura aprende o nome verdadeiro dele e −1 Disposição.',
        '  ⚠ ISTO É O RELÓGIO DE PERIGO DA CENA. Role na frente dos jogadores.',
        '',
        'SELO NEGATIVO (2 Energia + 1 Sanidade, ou 3 Sanidade · CA 6+ · Redutor −(3 + AI))',
        '  Jaula de Tecido Espacial de 2–4m. O preso testa (FOR/PRS + AUT) vs os Graus.',
        '  É assim que ele tira UM jogador da luta enquanto a criatura come os outros.',
        '  Falha: o selo inverte e a área vira limiar — Fenda Menor por 1 turno.',
        '',
        'PLANO INFERIOR (1 Energia OU 1 Sanidade · CA 4+ · Redutor −2) — passagem de 4m',
        '  para a bolha inferior, 1 cena. A rota de fuga dele, e a dela, se ele quiser.',
        '',
        'VAMPIRISMO (Pogo) — 3 de Vitalidade consumida = 1 Sanidade de volta.',
        '  ⚠⚠ Com sangue no chão da arena, ele TEM COMO recarregar a Sanidade.',
        '  É o que faz dele um problema de atrito e não de matemática fechada.',
    ].join('\n'),
    skills: [
        'Abismancia 5 · Selo Abissal 3 · Resistência à Loucura 3 · Esquiva 3 · Erudição 2',
        'Malandragem 2 · Observação 2 · Furtividade 2 · Fluxomancia 1 · Contato com o Oitavo 1',
        '+1 em Anatomia, Herbalismo, Sobrevivência, Prestidigitação e Agilidade (Aprendizado Acelerado)',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Simpático de um jeito que não combina com o que ele faz',
            'Pede desculpa às coisas que invoca, nunca a quem elas machucam',
            'Aterrorizado o tempo todo, e trabalha assim mesmo',
        ],
        trejeitos: '• Desenha o selo no chão com giz, ajoelhado, e sopra o pó antes de abrir.\n'
            + '• Fala COM a criatura, em voz baixa, o tempo todo — negociando, pedindo, prometendo.\n'
            + '• Cutuca o próprio braço com a adaga quando precisa de Sanidade. Não hesita.\n'
            + '• Derruba o giz. Sempre derruba o giz. Tem três de reserva por causa disso.\n'
            + '• Se alguém encosta nele, ele grita antes de qualquer dano acontecer.',
        motivacao: 'Sobreviver ao contrato e sumir. Invocador é caçado onde é conhecido, e a arena '
            + 'é o único lugar onde fazer isso na frente de quatro mil pessoas é ESPETÁCULO em vez '
            + 'de sentença. Ele odeia que isso seja verdade.',
        segredos: '⚠ FRAQUEZAS DE MESA — ele é vidro:\n'
            + '• Vitalidade ~10 (Corpo Frágil Nv2 tira 4 ANTES do ×3). Blindagem 0. FOR 1.\n'
            + '  Um golpe bom o mata. Encostar nele é a vitória inteira.\n'
            + '• Toda invocação é uma AÇÃO PADRÃO com Redutor. Enquanto conjura, não se defende.\n'
            + '• A Sanidade é o relógio: 24, a 4 por invocação. Pressionar o ritmo o quebra.\n'
            + '• Medroso: ameaça crível funciona de verdade nele.\n\n'
            + '★★ O LAÇO DE NOME É A BOMBA-RELÓGIO. Se ele falhar no teste, a criatura aprende '
            + 'o nome verdadeiro dele e perde 1 de Disposição. Duas falhas e a coisa que ele '
            + 'chamou vira o terceiro lado da luta — e ela vai atrás DELE primeiro.\n'
            + 'Se os jogadores perceberem isso, a jogada certa deixa de ser matá-lo: é ATRAPALHAR '
            + 'o Laço de Nome e esperar. Deixe essa leitura disponível.\n\n'
            + '★ SE A AURENNA CAIR: ele não revida. Abre Plano Inferior e some no meio da areia, '
            + 'deixando a criatura para trás — solta, sem laço, no meio da arena cheia. '
            + 'Isso não encerra a cena, ESCALA a cena, e o público deixa de ser plateia.',
        relacoes: {
            aliado: 'Aurenna, a Luz de Aluguel — ela o despreza e ele acha justo',
            rival: 'Todo mundo que já tentou matá-lo por ser o que é',
            devedor: 'Deve às coisas que chamou e não conseguiu mandar de volta',
        },
        frases: '"Desculpa. Desculpa. Já te levo de volta, eu prometo."\n'
            + '"Não é comigo que vocês vão ter problema."\n'
            + '"Ela não gosta de mim, mas ela cura. É um bom acordo."\n'
            + '"Por favor não encosta em mim, por favor, por favor —"',
        historia: 'Pogo criado em cidade grande, aprendeu Abismancia sozinho e cedo demais, do '
            + 'jeito errado, e teve sorte de sobreviver ao primeiro selo. Foi expulso de três '
            + 'lugares antes de descobrir que numa arena o que ele faz vira número de circo: '
            + 'a mesma coisa que dá forca lá fora vende ingresso aqui dentro. Guarda um diário '
            + 'de rituais em branco desde o começo — nunca escreveu nada, porque diário escrito '
            + 'é prova.',
    },
    loot: {
        itens: 'Talismã abissal rústico\nGiz de selos (três barras)\nAdaga pequena, com a ponta suja\n'
            + 'Roupas escuras\nCapa com capuz puída\nDiário de rituais EM BRANCO — nem uma palavra',
        luns: '3d10+35',
        pistas: 'O diário em branco é a pista: ele nunca escreveu nada porque tem medo de prova. '
            + 'Quem tem medo de prova está fugindo de alguém com autoridade para usá-la.',
        complicacoes: 'Se ele morrer com uma criatura invocada em campo, o laço morre junto. '
            + 'O que estiver solto continua solto — e não tem mais com quem negociar.',
    },
};

/* ═══════════════ Montagem ═══════════════ */
const cols = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics', 'skills',
    'derivedValues', 'vitalStats', 'classModules', 'equipment', 'bodyParts'];
const sd = {};
await Promise.all(cols.map(async col => {
    const snap = await db.collection(`system/data/${col}`).get();
    const arr = []; snap.forEach(d => { const x = d.data(); if (x.publicado !== false) arr.push({ id: d.id, ...x }); });
    sd[col] = arr;
}));
const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
const sys = {
    races: sd.races, classes: sd.classes, tribes: sd.tribes, peculiarities: sd.peculiarities,
    mechanics: sd.mechanics, skills: sd.skills,
    derivedValues: sd.derivedValues.slice()          // ORDENADO — ver cabeçalho
        .sort((a, b) => (Number(a.blocoOrdem) || 999) - (Number(b.blocoOrdem) || 999)
                     || (a.ordem || 99) - (b.ordem || 99))
        .map(dv => ({ ...dv, key: dv.key || dv.id, escopoItem: dv.escopoItem || '' })),
    vitalStats: sd.vitalStats.slice().sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
        .map(vs => ({ ...vs, key: vs.key || vs.id })),
    classModules: sd.classModules, equipment: sd.equipment, bodyParts: sd.bodyParts,
    norm: s => String(s || '').trim().toLowerCase(),
};
sys.pecsById = byId(sys.peculiarities); sys.mechsById = byId(sys.mechanics);
sys.racesById = byId(sys.races); sys.classesById = byId(sys.classes);
sys.tribesById = byId(sys.tribes); sys.classModulesById = byId(sys.classModules);

const mesa = await db.collection('mesas').doc(MESA_ID).get();
assert.ok(mesa.exists, 'mesa Torneio Famélia não encontrada');
assert.equal(mesa.data().config?.expInicial, EXP_MESA, `a mesa precisa estar com expInicial ${EXP_MESA}`);

const achaDv = nome => [...sys.vitalStats, ...sys.derivedValues].find(d => d.nome === nome);
const NOME_DV = { VIT: 'Vitalidade', ENER: 'Energia', SAN: 'Sanidade',
    PERC: 'Percepção', INI: 'Iniciativa', REA: 'Reação', BLD: 'Blindagem' };

function monta(spec, npcId) {
    const partes = sys.bodyParts.filter(bp => bp.ehPadrao)
        .map(bp => ({ ...bp, slots: SLOTS_PARES[bp.id] || 1 }));

    const modulos = spec.modulosClasse.map(v => {
        const def = sys.classModulesById[v.refId];
        assert.ok(def, `módulo "${v.refId}" não existe no registro`);
        const pre = def.itensPredefinidos || [];
        const itens = v.predefinidos.map(nome => {
            const p = pre.find(x => x.nome === nome);
            assert.ok(p, `item "${nome}" não existe no módulo ${v.refId}`);
            return itemDePredefinido(def, p);
        });
        itens.forEach(it => assert.ok(!('valores' in it) && it._predefNome,
            'item de módulo tem que ser PLANO com _predefNome'));
        return { refId: v.refId, snapshot: null, fonte: v.fonte, itens };
    });

    const items = spec.itens.map((it, i) => {
        const tpl = sys.equipment.find(e => e.nome === it.modelo);
        assert.ok(tpl, `equipamento "${it.modelo}" não existe no catálogo`);
        return {
            id: `item-s4-${npcId}-${i}`,
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
            equipado: true, slotAnatomico: it.slot, slotsOcupados: [],
            estadoEquip: it.estado, parentItemId: null,
            criadoPor: 'mestre', lastModified: new Date().toISOString(),
        };
    });

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
        modulosClasse: modulos,
        partesDoCorpo: JSON.parse(JSON.stringify(partes)),
        valoresDer: { overrides: { [DV_ALTURA]: spec.altura }, atual: {}, extras: [], vinculados: [] },
        ataques: spec.ataques, skills: spec.skills,
        rolePlay: spec.rolePlay, loot: spec.loot, criatura: null,
        vinculos: [{ tipo: 'mesa', id: MESA_ID }], mesaId: MESA_ID,
        lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
    };

    const calc = calcularNpc(npc, sys, { items });
    for (const [sigla, nomeDv] of Object.entries(NOME_DV)) {
        const dv = achaDv(nomeDv);
        assert.ok(dv && calc.derived[dv.key], `valor derivado "${nomeDv}" não computou`);
        npc.valoresDer[sigla] = calc.derived[dv.key].final;
    }
    const terr = calc.derived[achaDv('Desloc. Terrestre').key].final;
    npc.valoresDer.DESLOCAMENTO = `${terr}m`;
    npc.valoresDer.extras = [{ nome: 'Deslocamento', valor: `${terr}m` }];
    npc.valoresDer.atual = { VIT: npc.valoresDer.VIT, ENER: npc.valoresDer.ENER, SAN: npc.valoresDer.SAN };
    npc.valoresDer.vinculados = Object.values(NOME_DV).map(n => achaDv(n)?.key).filter(Boolean);

    /* Vitalidade tem que fechar com a fórmula do registro. Se não fechar, a
       ordenação do sys quebrou e eu não quero descobrir isso na mesa. */
    const tamanho = calc.derived[achaDv('Tamanho').key].final;
    const fragil = spec.peculiaridades.find(p => p.refId === PEC.pgFragil);
    const menos = fragil ? [0, 2, 4, 8][fragil.nivel] : 0;
    assert.ok(Math.abs(npc.valoresDer.VIT - (spec.atributos.VIG + tamanho - menos) * 3) < 0.01,
        `Vitalidade ${npc.valoresDer.VIT} não bate com (VIG ${spec.atributos.VIG} + Tamanho ${tamanho} − ${menos}) × 3`);

    return { npc, items, calc, tamanho };
}

const existentes = await db.collection('npcs').get();
const planos = [];
for (const spec of [AURENNA, VINT]) {
    const ja = existentes.docs.find(d => (d.data().nome || '').trim() === spec.nome);
    const npcId = ja ? ja.id : db.collection('npcs').doc().id;
    planos.push({ spec, npcId, novo: !ja, ...monta(spec, npcId) });
}

console.log(`\n✅ ${LEDGER_AURENNA.length + LEDGER_VINT.length} linhas de ledger e todos os asserts passaram.`);
console.log(`   Cada um gasta ${EXP_MESA}+${EXP_BONUS} = ${EXP_MESA + EXP_BONUS} EXP, e gasta todos.\n`);
for (const p of planos) {
    const v = p.npc.valoresDer;
    console.log('─'.repeat(74));
    console.log(`${p.novo ? '🆕' : '♻️ '} ${p.npc.nome}  [${p.npcId}]`);
    console.log(`   ${p.npc.raca} · ${p.npc.tribo} · ${p.npc.classe}`);
    console.log('   Atributos:', Object.entries(p.npc.atributos).map(([k, x]) => `${k}${x}`).join(' '));
    console.log(`   VIT ${v.VIT} · ENER ${v.ENER} · SAN ${v.SAN} · BLD ${v.BLD} · INI ${v.INI} · REA ${v.REA} · PERC ${v.PERC}`);
    console.log(`   Deslocamento: ${v.DESLOCAMENTO}  (Tamanho ${p.tamanho})`);
    console.log(`   ${p.npc.peculiaridades.length} peculiaridades · ${p.npc.periciasEstruturadas.length} perícias · `
        + `${p.npc.modulosClasse.reduce((s, m) => s + m.itens.length, 0)} itens de módulo · ${p.items.length} equipamentos`);
    for (const m of p.npc.modulosClasse) {
        console.log(`     ${sys.classModulesById[m.refId].titulo}: ${m.itens.map(i => i._predefNome).join(' · ')}`);
    }
    const ledger = p.spec === AURENNA ? LEDGER_AURENNA : LEDGER_VINT;
    console.log('   EXP:', ledger.map(([n, c]) => `${n} ${c > 0 ? '−' : '+'}${Math.abs(c)}`).join(' | '));
}
console.log('─'.repeat(74));

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
console.log('\n🏟️  A Luz e o Furo estão na mesa Torneio Famélia.\n');
process.exit(0);
