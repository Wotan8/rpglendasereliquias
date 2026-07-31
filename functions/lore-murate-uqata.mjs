/**
 * Texto de lore fornecido/aprovado pelo usuário em 30/07/2026.
 * Fontes cruzadas: Cofre_Reliera (Introdução.md, CONTO DE AMOR.md, Tribos 1.md,
 * Rascunhos/Prompt.md), Cenário-Classes-Tribos v02.pdf e as cartas de campeão
 * do Tribo Soberana. NADA aqui foi inventado.
 *
 *   node functions/lore-murate-uqata.mjs            (dry-run)
 *   node functions/lore-murate-uqata.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* ===== MURATÉ ===== */
const MURATE_TEXTO = {
    cultura: 'A tribo Muraté — antigamente chamada Ymato, e também referida como Asfed/Ymadef — representa o extremo defensivo do mundo. Sua filosofia se baseia em que a força está em proteger os seus, e não em atacar os outros. Possuem uma grande rivalidade com a tribo Uqatá, que representa o extremo ofensivo.\n\nNomenclatura: os nomes masculinos da tribo terminam em "kan" (Zarkan, Thorkan, Valkan) e os femininos terminam em "a" (Eldara, Valka, Aurora).',
    militar: 'O militarismo Muraté foca em armaduras completas e durabilidade extrema. Suas cidades são muradas com pedra, com torres de vigia e posições defensivas estratégicas. Fora de seus muros eles não costumam ter tanta habilidade ofensiva, pois focam em táticas de resistência e proteção territorial.',
};

/* Karkan (não "Kankar" — a carta traz o nome trocado; o Prompt.md é a fonte). */
const MURATE_UNIDADES = [
    {
        nome: 'KARKAN',
        funcao: 'Unidade de defesa básica.',
        descricao: 'Utilizam armadura completa e um escudo maior que o escudo comum usado por outras tribos. É a tropa de linha dos Muraté — e mesmo a mais básica delas sai a campo coberta dos pés à cabeça.',
    },
    {
        nome: 'MURAKAR',
        funcao: 'Unidade de defesa de elite.',
        descricao: 'Utilizam armadura pesada completa e são equipados com Escudo Torre. Formam a muralha viva da tribo: onde um Murakar planta o escudo, a linha não recua.',
    },
    {
        nome: 'VALKAR',
        funcao: 'Unidade de elite.',
        descricao: 'Utilizam um escudo enorme combinado com uma espada larga. É a elite que não apenas segura a posição, mas responde de dentro dela.',
    },
];

/* ===== UQATÁ — só ACRESCENTA a nomenclatura, sem tocar no que já existe ===== */
const UQATA_NOMENCLATURA = 'Nomenclatura: os nomes masculinos da tribo terminam em "ak" (Urak, Zak, Rorak) e os femininos terminam em "ia" (Vexia, Kyia, Lylia).';

const acha = async nome => {
    const s = await db.collection('system/data/tribes').where('nome', '==', nome).limit(1).get();
    return s.empty ? null : s.docs[0];
};

console.log('=== MURATÉ ===');
const mur = await acha('Muraté');
if (!mur) { console.log('  ✖ não encontrada'); process.exit(1); }
const antes = (mur.data().unidadesMilitares || []).map(u => u.nome);
console.log(`  unidades: ${JSON.stringify(antes)} -> ${JSON.stringify(MURATE_UNIDADES.map(u => u.nome))}`);
for (const [k, v] of Object.entries(MURATE_TEXTO)) {
    const at = String(mur.data()[k] || '').trim();
    console.log(`\n  ${k}: ${at === '.' || !at ? '(vazio)' : '(tinha texto!)'} ->`);
    console.log(`    ${v.replace(/\n\n/g, '\n    ')}`);
}
console.log(`\n  governo / economia: NÃO tocados — sem fonte, seguem "."`);
if (APPLY) await mur.ref.update({ ...MURATE_TEXTO, unidadesMilitares: MURATE_UNIDADES, atualizadoEm: new Date() });

console.log('\n\n=== UQATÁ (acrescenta nomenclatura ao fim da cultura) ===');
const uq = await acha('Uqatá');
if (!uq) { console.log('  ✖ não encontrada'); process.exit(1); }
const culturaAtual = String(uq.data().cultura || '').trim();
if (culturaAtual.includes('Nomenclatura')) {
    console.log('  ~ já contém "Nomenclatura" — nada a fazer');
} else {
    const nova = `${culturaAtual}\n\n${UQATA_NOMENCLATURA}`;
    console.log(`  cultura: ${culturaAtual.length} chars -> ${nova.length} chars (preservado + acrescentado)`);
    console.log(`  acrescentado: ${UQATA_NOMENCLATURA}`);
    if (APPLY) await uq.ref.update({ cultura: nova, atualizadoEm: new Date() });
}

console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
