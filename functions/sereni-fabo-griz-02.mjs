/**
 * Fabo Griz — correção: GRIZ É O SOBRENOME DA FAMÍLIA, e o Mercado Griz leva o
 * nome dela. Meu texto anterior dizia as duas coisas ao mesmo tempo e não
 * decidia nenhuma.
 *
 * Isso muda o peso do personagem, não só uma frase: ele não é um lojista
 * qualquer no mercado. Ele é o Griz do Mercado Griz. A praça tem o sobrenome
 * dele, e ele é o último que sobrou para carregá-lo.
 *
 * Toca apenas rolePlay.historia, .motivacao, .personalidade e .frases.
 *
 *   node functions/sereni-fabo-griz-02.mjs            (dry-run)
 *   node functions/sereni-fabo-griz-02.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const PERSONALIDADE = [
    'Honesto por cálculo — freguês que volta vale mais que freguês tosquiado',
    'Carrega o sobrenome que está escrito na praça, e sabe o peso disso todo dia',
    'Nunca saiu de Sereni; vende a vida que não viveu',
];

const MOTIVACAO = 'Manter a loja de pé e o nome limpo numa praça que se chama como ele. Enquanto houver um '
    + 'Griz atrás daquele balcão, o Mercado Griz é um lugar; no dia em que não houver, vira só um nome '
    + 'que ninguém sabe de onde veio.\n\nE — isto ele não diz — que a conta do caderno pare de crescer.';

const HISTORIA = 'Griz é o sobrenome, e o mercado leva o nome da família. Não porque os Griz mandem em '
    + 'alguma coisa: porque estavam lá antes de haver mercado. O bisavô montou banca no cruzamento das '
    + 'duas estradas, a praça cresceu em volta dela, e quando precisaram chamar aquilo de alguma coisa já '
    + 'chamavam de "lá no Griz". A loja passou de pai para filho três vezes. Fabo é o quarto, e não tem filho.\n\n'
    + 'Ele nunca passou da estrada norte.\n\n'
    + 'Vende o que aventureiro precisa e ninguém fabrica em Sereni: mochila, corda, tocha, pederneira, '
    + 'óleo, saco de dormir, pergaminho em branco, tinta, giz, estaca, cantil. Não vende arma nem '
    + 'armadura — isso é do Velmir Trok, e os dois respeitam a linha.\n\n'
    + 'Sabe ler e escrever, o que na vila é quase ofício. É por isso que vende pergaminho — e é por isso '
    + 'que não sabe dizer se o pergaminho ESCRITO que às vezes aparece no balcão vale alguma coisa. Ele '
    + 'vende assim mesmo, e avisa que não garante.';

const FRASES = '"Corda boa é a que você não lembra de ter comprado."\n'
    + '"Leva a de vinte metros. A de dez sempre falta três."\n'
    + '"Pergaminho em branco eu garanto. Pergaminho escrito, quem garante é quem escreveu."\n'
    + '"O mercado não tem meu nome. Eu é que tenho o nome do mercado — foi antes de mim."\n'
    + '"Volta e me conta se prestou."';

const npcs = (await db.collection('npcs').get()).docs;
const d = npcs.filter(x => (x.data().nome || '') === 'Fabo Griz');
if (d.length !== 1) { console.error(`🔴 Fabo Griz: ${d.length} docs`); process.exit(1); }
const n = d[0].data();
const antes = n.rolePlay || {};

console.log('\n=== Fabo Griz · o nome da família ===\n');
console.log('personalidade[1]');
console.log(`   de:   ${antes.personalidade?.[1]}`);
console.log(`   para: ${PERSONALIDADE[1]}`);
console.log('\nhistória — primeiro parágrafo');
console.log(`   de:   ${String(antes.historia || '').split('\n\n')[0]}`);
console.log(`   para: ${HISTORIA.split('\n\n')[0]}`);
console.log('\nmotivação');
console.log(`   de:   ${String(antes.motivacao || '').split('\n\n')[0]}`);
console.log(`   para: ${MOTIVACAO.split('\n\n')[0]}`);
console.log('\nfrase nova');
console.log(`   "O mercado não tem meu nome. Eu é que tenho o nome do mercado — foi antes de mim."`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await d[0].ref.update({
    'rolePlay.personalidade': PERSONALIDADE,
    'rolePlay.motivacao': MOTIVACAO,
    'rolePlay.historia': HISTORIA,
    'rolePlay.frases': FRASES,
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
});
console.log('\n✅ gravado.');
process.exit(0);
