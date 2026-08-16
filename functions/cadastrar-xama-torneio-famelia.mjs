/**
 * Torneio Famélia — o Xamã.
 *
 * Mesma régua dos outros: criação padrão por pontos (atributos 5/4/3, perícias
 * 6/4/3/2) + 180 EXP (100 da mesa + 80 de bônus), gastos até o último ponto.
 *
 * DUAS LIÇÕES DOS ANTERIORES, APLICADAS AQUI:
 *
 * 1. ITEM DE MÓDULO É PLANO. Os valores do schema vão na RAIZ do objeto, com
 *    `_predefId`/`_predefNome` ao lado — é o que `addNpcModuleItem` monta e o
 *    que `renderNpcClassModules` lê (`item[field.key]`). Aninhar em
 *    `valores: {…}` faz o painel mostrar o módulo com todos os campos VAZIOS.
 *    Foi o que aconteceu com os quatro primeiros; `itemDePredefinido` vem do
 *    script de conserto para não haver duas versões da mesma regra.
 *
 * 2. `sys.derivedValues` PRECISA VIR ORDENADO por blocoOrdem/ordem, como
 *    `ensureNpcSystemData` entrega ao painel. O motor faz 2 passadas de
 *    estabilização; fora de ordem, a cadeia Altura → Tamanho → Vitalidade não
 *    fecha e a Vitalidade sai errada. Ordenado, o motor acerta sozinho e não
 *    é preciso travar nada na mão além da Altura, que é dado de entrada.
 *
 *   node functions/cadastrar-xama-torneio-famelia.mjs            (dry-run)
 *   node functions/cadastrar-xama-torneio-famelia.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calcularNpc } from '../painel-mestre/js/npc-calc-engine.js';
import { itemDePredefinido, itemLivre } from './corrigir-modulos-npcs-torneio.mjs';

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
    costas: 'LlkbcV44ucq3bu0qT8fd', cintura: 'P881bM97Ahm1No9dTGAX',
    lingua: 'ieQULZLBB1MTV9Z3HSXk' };
const SLOTS_PARES = { [BP.mao]: 2, kc9p3jiFtOJJ5qiOElFq: 2, l668esm4kmmyvSfMN4L3: 2,
    epAss2ikwrSiMvd0Egid: 2, gFkuXKCVJ5WLhuvFD4P0: 2 };

const SK = {
    observacao: 'Jco4d1DhmVRRNYA7t8wu', tradicao: 'eeSFxay9lmwN4gtaVm28',
    empatia: '5fTBuNhwO2leomLjNBxP', herbalismo: 'zEa49LJzTXmnKj3YALma',
    fluxomancia: 'gb5hWgLFSy25Jw9GQlPR', sobrevivencia: 'sBKfM7ghyrzyVJIaxPo5',
    furtividade: 'zReRsG9Ch9To4Og1M1BD', esquiva: '6XaUJvRYMDnoFir8EVbd',
    totemismo: 'wVX5Vvjrd3TEUrb690mu', comunhaoEcos: 'ztOwwYi6UizpNxQZVT60',
    transcendencia: 'O30QQUMyMJlC4YVI1qrb', sextoSentido: 'YC0EPxOLLpVnE6269uOt',
    exorcismo: 'aenobnpVJKrpgj5SLpLH',
};
const PEC = {
    // Tamano
    taLingua: 'RkAOc6hxBvMP20b5zp4v', taGarras: 'qmbGuQiEd861aFJ9gJFa',
    taOlfato: 'RX84yLkhaxJ0wpCta3bX', taVisao: 'egoCMJ4hh1cjFao5gLd8',
    // Pogtara
    pgPericias: 'FCLxt0tsi1G9CbOHvhux', pgTunel: 'TQk17HmGgqoqiSZF4c3U',
    pgOlhos: 'bn1tlIEF4MBuUtzBc99G',
    // Xamã
    xaPericias: 'bNnNYxJVVgTYBosrlIJn', xaTotemancia: 'ekws3sw5gzCvu6Th6Edo',
    xaDominio: 'N3kbzmoORgyDB1NITyJY',
    // Avulsas
    teimoso: 'xZLI2K6SmQHNVMEOyDZa', resistenteDor: '1wNfDxhhyjUtQuEhnFxd',
    manco: '5lDEw6vtUzzXkbouSSig', glutao: 'YnXo6GHu6xuqf6X7jIHm',
};

/* ═══════════════ Ledger — 100 (mesa) + 80 (bônus) ═══════════════ */
const LEDGER = [
    ['Avulsa: Teimoso Nv3', 15], ['Avulsa: Resistente à Dor Nv1', 12],
    ['Avulsa: Manco Nv3 (rende)', -19], ['Avulsa: Glutão Nv2 (rende)', -3],
    ['PRE 3→4', 20], ['PRE 4→5', 25], ['AUT 3→4', 20], ['PRS 2→3', 15], ['RAC 2→3', 15],
    ['Perícia: Totemismo 1→3', 20], ['Perícia: Comunhão com Ecos 1→3', 20],
    ['Perícia: Transcendência 0→2', 12], ['Perícia: Sexto Sentido 0→2', 12],
    ['Perícia: Observação 3→4', 16],
];
assert.equal(LEDGER.reduce((s, [, v]) => s + v, 0), EXP_MESA + EXP_BONUS,
    'o Xamã tem que gastar os 180 EXP');
assert.ok(LEDGER.filter(([, v]) => v < 0).reduce((s, [, v]) => s - v, 0) <= 30,
    'teto de 30 EXP em desvantagens');

const UMBE = {
    nome: 'Umbe, o Que Empresta a Pele',
    tipo: 'npc', nivel: 5, porte: 'Médio',
    papel: 'Xamã de arena — não luta; empresta o corpo a quem já lutou',
    local: 'Arena de Famélia',
    tamanho: '1,65m — Tamano encurvado, olhos leitosos, língua sempre meio de fora',
    tags: 'torneio famélia, arena, xamã, tamano, pogtara, totemancia, espiritismo, ecos, chefe, sessão 3',
    racaRef: { refId: 'o0r30m1ewErZK5TGslJc', custom: '' }, raca: 'Tamano',
    classeRef: { refId: 'sNk4fBoUt4DGxUQThIZb', custom: '' }, classe: 'Xamã',
    triboRef: { refId: 'Ebj7s03ROFSXJpNXAEpv', custom: '' }, tribo: 'Pogtara',
    atributos: { INT: 3, RAC: 3, PRS: 3, FOR: 1, DES: 2, VIG: 3, PRE: 5, MAN: 2, AUT: 4 },
    peculiaridades: [
        { refId: PEC.taLingua, nivel: 1, fonte: 'raca' },
        { refId: PEC.taGarras, nivel: 1, fonte: 'raca' },
        { refId: PEC.taOlfato, nivel: 1, fonte: 'raca' },
        { refId: PEC.taVisao, nivel: 1, fonte: 'raca' },
        { refId: PEC.pgPericias, nivel: 1, fonte: 'tribo' },
        { refId: PEC.pgTunel, nivel: 1, fonte: 'tribo' },
        { refId: PEC.pgOlhos, nivel: 1, fonte: 'tribo' },
        { refId: PEC.xaPericias, nivel: 1, fonte: 'classe' },
        { refId: PEC.xaTotemancia, nivel: 1, fonte: 'classe' },
        { refId: PEC.xaDominio, nivel: 1, fonte: 'classe' },
        { refId: PEC.teimoso, nivel: 3, fonte: null },
        { refId: PEC.resistenteDor, nivel: 1, fonte: null },
        { refId: PEC.manco, nivel: 3, fonte: null },
        { refId: PEC.glutao, nivel: 2, fonte: null },
    ],
    /* Somam sozinhas por cima: classe +1 Performance e +1 Fluxomancia;
       tribo Pogtara +1 Furtividade. As escolhas de `distribuir` já estão
       embutidas (classe: +1 Totemismo e +1 Comunhão com Ecos;
       Pogtara: +1 Sobrevivência). */
    periciasEstruturadas: [
        { refId: SK.observacao, nivel: 4 }, { refId: SK.totemismo, nivel: 3 },
        { refId: SK.comunhaoEcos, nivel: 3 }, { refId: SK.sobrevivencia, nivel: 3 },
        { refId: SK.transcendencia, nivel: 2 }, { refId: SK.sextoSentido, nivel: 2 },
        { refId: SK.tradicao, nivel: 2 }, { refId: SK.herbalismo, nivel: 2 },
        { refId: SK.fluxomancia, nivel: 2 }, { refId: SK.esquiva, nivel: 2 },
        { refId: SK.empatia, nivel: 1 }, { refId: SK.furtividade, nivel: 1 },
        { refId: SK.exorcismo, nivel: 0 },
    ],
    modulosClasse: [{ refId: 'mod_totem', fonte: 'classe', predefinidos: [
        'Cravar Totem', 'Buscar Vestígio', 'Comunhão Simples',
        'Transcendência — Receptor', 'Transcendência — Projetor', 'Exorcismo',
    ] }],
    altura: 1.65,
    itens: [
        { modelo: 'Totem Pessoal Entalhado', slot: `${BP.mao}_1`, estado: 'segurar' },
        { modelo: 'Bordão', slot: `${BP.mao}_2`, estado: 'empunhado' },
        { modelo: 'Vestes Tribais Simples', slot: BP.torso, estado: 'vestido' },
        { modelo: 'Bolsa de Ervas Rituais', slot: BP.cintura, estado: 'fixado' },
        { modelo: 'Chocalho Cerimonial', slot: BP.costas, estado: 'fixado' },
    ],
    ataques: [
        '⚠ O UMBE NÃO É UM LUTADOR. Bordão: Alvo 2 (DES 2 + Arma 0) · 1d6+1. Ele erra.',
        'Garras Escavadoras (Tamano) — desarmado causa 1d6 em vez de 1d4. Ainda é ruim.',
        'Deslocamento 3m. Ele NÃO atravessa a arena. Onde crava o totem, fica.',
        '',
        '⭐⭐ O QUE ELE FAZ DE VERDADE — RITUAIS DA TOTEMANCIA (Energia 7)',
        '',
        'ANTES DA LUTA (10 min, fora de combate):',
        '  CRAVAR TOTEM — conecta o totem ao chão da arena. Pré-requisito de todo o resto.',
        '  Se os jogadores chegarem cedo, dá para VER ele fazendo isso. E dá para impedir.',
        '',
        'RODADA 1:',
        '  BUSCAR VESTÍGIO (1 Energia, Ação Padrão) — procura Ecos da Alma na essência',
        '  verde local. A areia da Arena de Famélia está encharcada de gente que morreu ali.',
        '  Os Graus de Sucesso definem a clareza e o PODER do Eco encontrado.',
        '',
        'RODADA 2 — O GOLPE:',
        '  TRANSCENDÊNCIA — RECEPTOR (2 Energia, ou 1 Energia + 2 Sanidade) — dura 1 CENA.',
        '  O Eco divide a carne com ele. Empresta a DÁDIVA da vida que teve E uma',
        '  PERÍCIA sua em 3 (Eco Comum) ou 5 (Ancestral).',
        '',
        '  ★★ O ECO QUE ELE VAI ACHAR É O DO GRAKKUN. ★★',
        '  O Yotun morreu nessa areia na sessão 1, pelas mãos deste grupo. É o Eco mais',
        '  recente e mais forte do chão. Perícia emprestada: Arma 5. Dádiva: a do gigante.',
        '  Um Tamano de 1,65m e 3m de deslocamento passa a bater como o Trinca-Muros —',
        '  e passa a FALAR como ele. Deixe o jogador reconhecer a frase.',
        '',
        'SE PRECISAR:',
        '  COMUNHÃO SIMPLES (1 Energia) — conversa com um Eco sem incorporar.',
        '  EXORCISMO (2 Energia) — expulsa espírito invasor vs PRS. Contra invocador.',
        '  TRANSCENDÊNCIA — PROJETOR (2 Energia) — projeta a consciência; o corpo fica',
        '    INERTE E VULNERÁVEL. Em arena é suicídio. Está aqui para o caso de fugir.',
        '',
        'SEXTO SENTIDO 2 · COMUNHÃO COM ECOS 4 · TOTEMISMO 3 · TRANSCENDÊNCIA 2',
    ].join('\n'),
    skills: [
        'Observação 4 · Comunhão com Ecos 4 · Totemismo 3 · Sobrevivência 3 · Fluxomancia 3',
        'Transcendência 2 · Sexto Sentido 2 · Tradição 2 · Herbalismo 2 · Esquiva 2 · Furtividade 2',
    ].join('\n'),
    rolePlay: {
        personalidade: [
            'Fala com quem não está na sala, no meio da frase, sem se desculpar',
            'Educado com os mortos e impaciente com os vivos',
            'Não tem nenhum interesse em vencer — tem interesse em ouvir',
        ],
        trejeitos: '• Olhos leitosos: enxerga muito mal. Vira a cabeça de LADO para focar, como bicho.\n'
            + '• Cheira o ar antes de responder qualquer pergunta — e responde ao cheiro, não à pergunta.\n'
            + '• A língua sai sozinha quando ele se concentra. Ele não percebe.\n'
            + '• Manca pesado do lado direito, apoiado no bordão. Não corre. Não tenta.\n'
            + '• Come o tempo todo, inclusive durante o ritual, inclusive durante a luta.\n'
            + '• Quando um Eco entra nele, a voz muda ANTES do corpo.',
        motivacao: 'Não veio pela bolsa. Veio pelo CHÃO. A areia da Arena de Famélia é o solo mais '
            + 'denso de Ecos que ele já cheirou — décadas de gente morrendo no mesmo quadrado, '
            + 'sem enterro e sem rito. Ele entrou no torneio porque é a única forma de conseguir '
            + 'dez minutos ajoelhado naquele chão sem ser expulso.',
        segredos: '⚠ FRAQUEZAS DE MESA — ele é o adversário mais frágil que esta mesa já viu:\n'
            + '• Deslocamento 3m (Manco Nv3 + Glutão Nv2). Ele é um alvo parado.\n'
            + '• Reação 2, Esquiva 2, Blindagem 0. Qualquer golpe que encoste, entra inteiro.\n'
            + '• Visão Limitada + Olhos de Ninho: enxerga MAL, e a arena é aberta e clara. '
            + 'Furtividade contra ele é quase automática — mas o olfato o compensa a curta distância.\n'
            + '• O TOTEM É O PONTO FRACO REAL. Sem totem cravado não há Buscar Vestígio, '
            + 'e sem Vestígio não há Eco. Arrancar, quebrar ou cobrir o totem DESARMA a luta inteira.\n'
            + '  Deixe isso visível: ele o crava em cena, com cuidado, antes de tudo começar.\n\n'
            + '★★ A REVIRAVOLTA — O ECO DO GRAKKUN:\n'
            + 'Na rodada 2 ele incorpora o Yotun que este grupo matou. Perícia emprestada Arma 5, '
            + 'mais a Dádiva. O corpo continua sendo o do Umbe (3m de deslocamento, Vitalidade '
            + 'baixa, Blindagem 0) — mas a técnica é a do campeão.\n'
            + 'Se algum jogador chamar o Grakkun pelo nome, o Eco RESPONDE. E o Grakkun não '
            + 'tinha rancor de ninguém: ele queria a rendição, não o cadáver. Um grupo que '
            + 'perceber isso pode CONVERSAR com o Eco e encerrar a luta sem golpe nenhum.\n'
            + 'Essa é a saída boa, e ela existe de propósito.\n\n'
            + '★ SE PERDER O ECO (exorcismo, totem quebrado, fim da cena): ele se ajoelha, '
            + 'pede desculpa ao chão em voz alta, e desiste. Não tem segunda linha.',
        relacoes: {
            aliado: 'Os mortos da arena. Literalmente. É a única companhia que ele reconhece.',
            rival: 'Quem enterra mal, quem mata sem rito, quem constrói em cima de cova',
            devedor: 'Deve rito a todo Eco que já usou — e usou muitos',
        },
        frases: '"Você está pisando em alguém. Não, mais à esquerda. Ali."\n'
            + '"Não vim brigar com vocês. Vim ouvir o chão. Vocês é que estão no meio."\n'
            + '"Ele lembra de você. Ele lembra da última coisa que você disse."\n'
            + '— e, quando o Eco entrar: "Levanta. Ainda não valeu o dinheiro deles."',
        historia: 'Tamano dos túneis, criado por Pogtara no escuro, onde os olhos não servem '
            + 'para nada e o nariz serve para tudo. Aprendeu Espiritismo cedo porque nas galerias '
            + 'os mortos ficam perto — não há vento que os leve. Anda de arena em arena, de campo '
            + 'de batalha em campo de batalha, cravando o totem onde morreu muita gente e ouvindo '
            + 'o que sobrou. Nunca venceu uma luta. Já venceu treze torneios, porque em doze deles '
            + 'o adversário parou para conversar com o próprio pai.',
    },
    loot: {
        itens: 'Totem Pessoal Entalhado (o objeto mais valioso e o mais frágil)\nBordão\n'
            + 'Vestes tribais\nBolsa de ervas rituais\nChocalho cerimonial\n'
            + 'Comida. Muita comida, em todos os bolsos.',
        luns: '2d10+20',
        pistas: 'Ele sabe quem está enterrado embaixo da Arena de Famélia, e sabe quantos. '
            + 'É a melhor fonte de informação que este grupo pode encontrar na cidade — '
            + 'e ela fala de graça, se perguntarem com educação.',
        complicacoes: 'Matar o Umbe apaga a única testemunha que consegue ouvir o Grakkun. '
            + 'Se o grupo tem qualquer pendência com o gigante que matou, é aqui que resolve — '
            + 'ou é aqui que perde a chance para sempre.',
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
    // ORDENADO — ver o item 2 do cabeçalho.
    derivedValues: sd.derivedValues.slice()
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

const existentes = await db.collection('npcs').get();
const ja = existentes.docs.find(d => (d.data().nome || '').trim() === UMBE.nome);
const npcId = ja ? ja.id : db.collection('npcs').doc().id;

/* Partes do corpo: humanoide padrão + a Língua Longa dos Tamano (segura e empunha). */
const partes = sys.bodyParts.filter(bp => bp.ehPadrao)
    .map(bp => ({ ...bp, slots: SLOTS_PARES[bp.id] || 1 }));
const lingua = sys.bodyParts.find(bp => bp.id === BP.lingua);
assert.ok(lingua, 'a parte "Língua Longa" sumiu do registro de bodyParts');
partes.push({ ...lingua, slots: 1 });

const modulos = UMBE.modulosClasse.map(v => {
    const def = sys.classModulesById[v.refId];
    assert.ok(def, `módulo "${v.refId}" não existe no registro`);
    const pre = def.itensPredefinidos || [];
    const itens = v.predefinidos.map(nome => {
        const p = pre.find(x => x.nome === nome);
        assert.ok(p, `item "${nome}" não existe no módulo ${v.refId}`);
        return itemDePredefinido(def, p);
    });
    // trava o formato: se voltar a aninhar, quebra aqui e não no painel do usuário
    itens.forEach(it => assert.ok(!('valores' in it) && it._predefNome,
        'item de módulo tem que ser PLANO com _predefNome'));
    return { refId: v.refId, snapshot: null, fonte: v.fonte, itens };
});

const items = UMBE.itens.map((it, i) => {
    const tpl = sys.equipment.find(e => e.nome === it.modelo);
    assert.ok(tpl, `equipamento "${it.modelo}" não existe no catálogo`);
    return {
        id: `item-xama-${npcId}-${i}`,
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
    nome: UMBE.nome, tipo: UMBE.tipo, imagem: '', nivel: UMBE.nivel, ai: UMBE.nivel,
    porte: UMBE.porte, papel: UMBE.papel, local: UMBE.local,
    tamanho: UMBE.tamanho, tags: UMBE.tags,
    funcao: [], aliadoProprio: false, visibilidade: 'secreto',
    racaRef: UMBE.racaRef, classeRef: UMBE.classeRef, triboRef: UMBE.triboRef,
    raca: UMBE.raca, classe: UMBE.classe, tribo: UMBE.tribo,
    atributos: UMBE.atributos,
    peculiaridades: UMBE.peculiaridades,
    periciasEstruturadas: UMBE.periciasEstruturadas,
    modulosClasse: modulos,
    partesDoCorpo: JSON.parse(JSON.stringify(partes)),
    // Só a Altura é travada: é dado de entrada, não resultado de conta.
    valoresDer: { overrides: { [DV_ALTURA]: UMBE.altura }, atual: {}, extras: [], vinculados: [] },
    ataques: UMBE.ataques, skills: UMBE.skills,
    rolePlay: UMBE.rolePlay, loot: UMBE.loot, criatura: null,
    vinculos: [{ tipo: 'mesa', id: MESA_ID }], mesaId: MESA_ID,
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
};

const calc = calcularNpc(npc, sys, { items });
const achaDv = nome => [...sys.vitalStats, ...sys.derivedValues].find(d => d.nome === nome);
const NOME_DV = { VIT: 'Vitalidade', ENER: 'Energia', SAN: 'Sanidade',
    PERC: 'Percepção', INI: 'Iniciativa', REA: 'Reação', BLD: 'Blindagem' };
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

/* A Vitalidade tem que fechar com a fórmula do registro; se não fechar, a
   ordenação do sys quebrou de novo e eu não quero descobrir isso na mesa. */
const tamanho = calc.derived[achaDv('Tamanho').key].final;
assert.ok(Math.abs(npc.valoresDer.VIT - (UMBE.atributos.VIG + tamanho) * 3) < 0.01,
    `Vitalidade ${npc.valoresDer.VIT} não bate com (VIG + Tamanho ${tamanho}) × 3`);

console.log(`\n✅ ${LEDGER.length} linhas de ledger e todos os asserts passaram.`);
console.log(`   Gasta ${EXP_MESA}+${EXP_BONUS} = ${EXP_MESA + EXP_BONUS} EXP, e gasta todos.\n`);
console.log('─'.repeat(72));
console.log(`${ja ? '♻️ ' : '🆕'} ${npc.nome}  [${npcId}]`);
console.log(`   ${npc.raca} · ${npc.tribo} · ${npc.classe}`);
console.log('   Atributos:', Object.entries(npc.atributos).map(([k, x]) => `${k}${x}`).join(' '));
const v = npc.valoresDer;
console.log(`   VIT ${v.VIT} · ENER ${v.ENER} · SAN ${v.SAN} · BLD ${v.BLD} · INI ${v.INI} · REA ${v.REA} · PERC ${v.PERC}`);
console.log(`   Deslocamento: ${v.DESLOCAMENTO}  (Tamanho ${tamanho})`);
console.log(`   overrides: só Altura — o motor computou o resto sozinho`);
console.log(`   ${npc.peculiaridades.length} peculiaridades · ${npc.periciasEstruturadas.length} perícias · `
    + `${modulos[0].itens.length} rituais · ${items.length} equipamentos · ${partes.length} partes do corpo`);
console.log('   Rituais:', modulos[0].itens.map(i => i._predefNome).join(' · '));
console.log('   EXP:', LEDGER.map(([n, c]) => `${n} ${c > 0 ? '−' : '+'}${Math.abs(c)}`).join(' | '));
console.log('─'.repeat(72));

if (!APLICAR) {
    console.log('\n🔍 DRY-RUN. Rode com --apply para gravar.\n');
    process.exit(0);
}

await db.collection('npcs').doc(npcId).set(npc, { merge: true });
const antigos = await db.collection('items').where('characterId', '==', npcId).get();
for (const d of antigos.docs) await d.ref.delete();
for (const it of items) await db.collection('items').doc(it.id).set(it);
console.log(`\n✅ ${npc.nome} gravado (${items.length} itens).\n`);
process.exit(0);
