/**
 * Correção do Fenor. Eu o descrevi como bovino de couro e tração; o cânone diz
 * outra coisa e diz de três lugares diferentes na ficha do Julo:
 *
 *   motivacao: "Fornecer lã e leite para a vila"
 *   trejeitos: "Cheira a lã e campo"
 *   loot:      "Cordas de lã · Manta de lã · Queijo de fenor (caseiro)"
 *
 * FENOR É LANÍGERO. Dá lã, leite e queijo — não couro nem tração. Logo é menor
 * (0,85 e não 1,30), o chifre é enrolado e não de empurrar, e a Carne Dura sai:
 * um animal de velo e leite é o oposto de carne dura.
 *
 * O Cão-Pastor continua raça separada — e ganha a nota que faltava: o cão do
 * Julo se chama TROMBA e já estava no banco.
 *
 *   node functions/bestiario-racas-vale-02.mjs            (dry-run)
 *   node functions/bestiario-racas-vale-02.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl';

const FENOR = {
    subtitulo: 'O Rebanho de Sereni — Lã, Leite e Paciência',
    expectativaVida: '12',
    tendencia: 'Mansos — Gregários — Incapazes de decidir sozinhos',
    altura: 0.85, varia: 0.15,
    aparencia: 'Animal de velo, do tamanho de um cão grande, com o corpo largo escondido sob lã densa e '
        + 'encaracolada em creme sujo e cinza. Chifre enrolado para trás junto à cabeça, nos dois sexos — '
        + 'chifre de peso e de idade, não de briga. Casco fendido, perna curta, focinho estreito que alcança '
        + 'o capim entre as pedras. Sob a lã, o corpo é bem menor do que parece.',
    habitat: 'Pastos ao norte de Sereni e as encostas de capim curto do Vale de Silmarela. Precisa de '
        + 'pastor: sozinho, o rebanho anda até acabar o capim e depois fica.',
    historia: 'Fenor é o rebanho de Sereni e a base do que a vila vende. Dá lã — cordas, mantas, roupa de '
        + 'inverno — e dá leite, que vira o queijo de fenor que sai daqui para as outras vilas do Vale. '
        + 'Não dá tração e quase não dá carne: abater fenor jovem é desperdício, e todo mundo em Sereni '
        + 'sabe disso sem precisar de lei.\n\nÉ por causa dele que existe pastor na vila, e é por causa '
        + 'dele que existe o Cão-Pastor.',
    curiosidades: [
        'Tosquia uma vez por ano. Um velo bom paga o inverno de uma família.',
        'Fenor perdido para de andar e berra até alguém vir. É o motivo de o rebanho raramente se perder inteiro.',
        'Não decide nada sozinho: onde o primeiro põe a pata, os outros põem. Um cão bem treinado move quarenta movendo um.',
        'O queijo de fenor curado é a coisa mais cara que sai de Sereni sem passar pelo ferreiro.',
    ],
};

const CAO_EXTRA = 'O cão do Julo se chama Tromba, e é o exemplar que a vila usa de medida: quando alguém '
    + 'diz que um filhote "vai ficar bom", quer dizer que vai ficar como o Tromba.';

const grab = async c => (await db.collection(c).get()).docs;
const racas = await grab('system/data/races');
const erros = [];
const um = nome => { const d = racas.filter(x => (x.data().nome || '') === nome); if (d.length !== 1) erros.push(`raça "${nome}": ${d.length}`); return d[0]; };
const fenor = um('Fenor'), cao = um('Cão-Pastor');
if (fenor && !/Bovino/i.test(fenor.data().aparencia || '')) erros.push('o Fenor já não é o bovino que eu escrevi — pare e confira');

const partes = fenor?.data().partesDoCorpo || [];
const cur = cao?.data().curiosidades || [];

console.log('\n=== Fenor · de bovino para lanígero ===\n');
console.log(`   subtítulo   "${fenor?.data().subtitulo}"\n            →  "${FENOR.subtitulo}"`);
console.log(`\n   Altura      ${fenor?.data().derivedValueIds?.[0]?.valorInicial} ± ${Math.abs(fenor?.data().derivedValueIds?.[0]?.characterCreationMin)}  →  ${FENOR.altura} ± ${FENOR.varia}`);
console.log(`   Tamanho     ${(fenor?.data().derivedValueIds?.[0]?.valorInicial * 3).toFixed(2)}  →  ${(FENOR.altura * 3).toFixed(2)}`);
console.log(`   vida        ${fenor?.data().expectativaVida} anos  →  ${FENOR.expectativaVida} anos`);
console.log(`   peculiaridade  Carne Dura Nv1  →  nenhuma (velo e leite são o oposto de carne dura)`);
console.log(`   anatomia    inalterada — ${partes.length} partes; chifre e casco continuam, mudou o que eles são`);
console.log(`\n   aparência nova:\n      ${FENOR.aparencia}`);
console.log(`\n   o que o cânone da ficha do Julo obrigava:`);
console.log(`      · "Fornecer lã e leite para a vila"        (motivação)`);
console.log(`      · "Cheira a lã e campo"                    (trejeitos)`);
console.log(`      · "Cordas de lã · Manta de lã · Queijo de fenor"  (loot)`);
console.log(`\n=== Cão-Pastor · a nota que faltava ===\n      ${CAO_EXTRA}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
batch.update(fenor.ref, {
    subtitulo: FENOR.subtitulo, expectativaVida: FENOR.expectativaVida, tendencia: FENOR.tendencia,
    aparencia: FENOR.aparencia, habitat: FENOR.habitat, historia: FENOR.historia,
    curiosidades: FENOR.curiosidades, peculiaridadeIds: [],
    derivedValueIds: [{ id: ALTURA_VD, valorInicial: FENOR.altura,
        characterCreationMin: -FENOR.varia, characterCreationMax: FENOR.varia }],
    atualizadoEm: agora,
});
batch.update(cao.ref, { curiosidades: [...cur, CAO_EXTRA], atualizadoEm: agora });
await batch.commit();
console.log('\n✅ Fenor corrigido · Tromba anotado no Cão-Pastor.');
process.exit(0);
