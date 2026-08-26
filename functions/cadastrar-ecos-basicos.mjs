/**
 * ECOS BÁSICOS — seis Ecos genéricos para o mestre pegar na hora.
 *
 * Existem porque a tabela de sorte de Ecos (material de mestre) manda rolar na
 * mesa, e sem um conjunto pronto o mestre trava. São FUNÇÕES, não pessoas: o
 * Ancestral e o Ancestral poderoso da tabela são figuras nomeadas do mundo e
 * não entram aqui.
 *
 * O QUE DIFERENCIA UM ECO DO OUTRO, depois da reforma das Dádivas de 18/08:
 * os atributos quase não diferenciam. Com a soma e o teto de 5, um Xamã de
 * atributos ~3 chega ao teto com qualquer Eco que tenha 2 naquilo. O que NÃO
 * tem teto é Vitalidade, Blindagem, Blindagem Arcana, Sentidos, Deslocamento e
 * os módulos — é aí que a força de um Eco aparece, e é isso que varia aqui.
 *
 * Poder do Eco = PRS (memória de design 01/08): serve à resistência nos testes
 * "vs PRS do Eco", ao bônus no Receptor e ao teto do totem.
 *
 *   node functions/cadastrar-ecos-basicos.mjs            (dry-run)
 *   node functions/cadastrar-ecos-basicos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const P = {};
for (const s of (await db.collection('system').doc('data').collection('skills').get()).docs) P[s.data().nome] = s.id;
const per = (nome, nivel) => {
    if (!P[nome]) throw new Error(`perícia "${nome}" não existe no cadastro`);
    return { refId: P[nome], nivel };
};

const A = (INT, RAC, PRS, FOR, DES, VIG, PRE, MAN, AUT) => ({ INT, RAC, PRS, FOR, DES, VIG, PRE, MAN, AUT });

const ECOS = [
    {
        nome: 'Eco do Servo', papel: 'Quem carregou peso a vida toda e não foi lembrado',
        atributos: A(2, 2, 2, 2, 2, 2, 2, 2, 2),
        pericias: [per('Labuta', 3)],
        vd: { VIT: 12, ENER: 4, PERC: 2, INI: 4, BLD: 0, DESLOCAMENTO: '6m' },
        extras: [],
        resumo: 'O quase-nada. Serve quando a rolagem é ruim e o mestre não quer dizer "não achou".',
    },
    {
        nome: 'Eco do Soldado Raso', papel: 'Morreu numa linha de frente que não escolheu',
        atributos: A(2, 2, 3, 4, 3, 4, 2, 2, 3),
        pericias: [per('Arma', 3), per('Esquiva', 2)],
        vd: { VIT: 26, ENER: 4, PERC: 3, INI: 5, BLD: 3, DESLOCAMENTO: '8m' },
        extras: [],
        resumo: 'Corpo e couro. É o Eco que salva o Xamã que está morrendo — VIT 26 e Blindagem 3 não têm teto.',
    },
    {
        nome: 'Eco do Batedor', papel: 'Conheceu trilha que ninguém mais conhecia',
        atributos: A(3, 3, 4, 3, 5, 3, 2, 3, 3),
        pericias: [per('Sobrevivência', 4), per('Furtividade', 3)],
        vd: { VIT: 16, ENER: 5, PERC: 5, INI: 7, BLD: 1, DESLOCAMENTO: '14m' },
        extras: [{ nome: 'Percepção Olfativa', valor: 7 }, { nome: 'Desloc. Terrestre', valor: 14 }],
        resumo: 'O único que dá Olho e Passo de verdade. Rende mais fora de combate que dentro.',
    },
    {
        nome: 'Eco da Parteira', papel: 'Trouxe gente ao mundo e viu muita gente sair dele',
        atributos: A(3, 4, 5, 2, 3, 3, 4, 3, 3),
        pericias: [per('Anatomia', 4), per('Empatia', 4)],
        vd: { VIT: 20, ENER: 6, PERC: 4, INI: 4, BLD: 1, DESLOCAMENTO: '8m' },
        extras: [{ nome: 'Blindagem Arcana', valor: 3 }],
        resumo: 'Cobre mental e social ao mesmo tempo, e é a única fonte de Blindagem Arcana da lista.',
    },
    {
        nome: 'Eco do Velho de Muitas Vidas', papel: 'Fez de tudo um pouco e nada até o fim',
        atributos: A(3, 3, 6, 3, 3, 3, 3, 3, 3),
        // uma perícia de CADA categoria: a Dádiva de Perícia sorteia uma por tipo
        pericias: [per('Atletismo', 3), per('Erudição', 3), per('Esquiva', 3), per('Diplomacia', 3), per('Submundo', 3)],
        vd: { VIT: 18, ENER: 6, PERC: 4, INI: 5, BLD: 2, DESLOCAMENTO: '8m' },
        extras: [],
        resumo: 'Nenhum pico, nenhum buraco. O único que entrega as CINCO perícias da Dádiva. '
            + 'É o Eco de baixa variância — o mestre usa quando não quer que o sorteio decida a sessão.',
    },
    {
        nome: 'Eco do Mestre de Armas', papel: 'Ensinou a matar e morreu ensinando',
        atributos: A(3, 4, 8, 5, 5, 4, 4, 3, 4),
        pericias: [per('Arma', 5), per('Aparar', 4)],
        vd: { VIT: 34, ENER: 7, PERC: 4, INI: 8, BLD: 5, DESLOCAMENTO: '10m' },
        extras: [],
        modulos: ['manobras_guerreiro'],
        resumo: 'O topo da lista, e o único com módulo — é o que faz a Dádiva Habilidade existir na prática.',
    },
];

const doc = (e) => ({
    nome: e.nome, tipo: 'npc', schemaVersion: 2, modoFicha: 'mecanico', nivel: 1,
    papel: e.papel, funcao: [], visibilidade: 'secreto', porte: '',
    // `tags` é STRING separada por vírgula neste banco, não array.
    tags: `Eco, Eco Básico, Espiritismo, Totemancia`,
    atributos: e.atributos,
    periciasEstruturadas: e.pericias,
    valoresDer: { ...e.vd, atual: {}, extras: e.extras, vinculados: [] },
    modulosClasse: (e.modulos || []).map(refId => ({ refId })),
    peculiaridades: [], partesDoCorpo: [], skills: [], loot: [], vinculos: [],
    rolePlay: e.resumo,
    criatura: null, raca: '', classe: '', tribo: '',
    lastUpdate: Date.now(),
});

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — ${ECOS.length} Ecos\n`);
for (const e of ECOS) {
    const a = e.atributos;
    console.log(`  ${e.nome}  ·  Poder ${a.PRS}`);
    console.log(`     FOR ${a.FOR} DES ${a.DES} VIG ${a.VIG} · INT ${a.INT} RAC ${a.RAC} PRS ${a.PRS} · PRE ${a.PRE} MAN ${a.MAN} AUT ${a.AUT}`);
    console.log(`     VIT ${e.vd.VIT} · BLD ${e.vd.BLD} · ENER ${e.vd.ENER} · ${e.pericias.length} perícia(s)`
        + (e.extras.length ? ` · extras: ${e.extras.map(x => `${x.nome} ${x.valor}`).join(', ')}` : '')
        + (e.modulos ? ` · módulos: ${e.modulos.join(', ')}` : ''));
}

const jaTem = (await db.collection('npcs').get()).docs.filter(d => /^Eco d/.test(d.data().nome || ''));
if (jaTem.length) { console.log(`\nABORTA: já existem ${jaTem.length} Ecos — ${jaTem.map(d => d.data().nome).join(', ')}`); process.exit(1); }

if (APPLY) {
    for (const e of ECOS) {
        const r = await db.collection('npcs').add(doc(e));
        console.log(`  criado ${r.id}  ${e.nome}`);
    }
    console.log('\nAPLICADO');
} else console.log('\nDRY-RUN — rode com --apply');
process.exit(0);
