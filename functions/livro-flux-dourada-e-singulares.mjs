/**
 * Compêndio de Fluxomancia — "As Treze Essências". Segunda passada de correção,
 * ditada pelo dono do mundo:
 *
 *   1) A Dourada IMITA. Pode mimetizar outra essência e se parecer com ela, mas
 *      as duas não se misturam — não é transformação verdadeira.
 *   2) A abertura de "As Singulares" só dizia que o Abissal consome. Ela também
 *      CRIA as demais (o parágrafo da própria Abissal já dizia "capaz de criar";
 *      era a linha de abertura que estava incompleta).
 *
 * Fora do escopo desta passada: o som na Água. A premissa "perde velocidade" é
 * falsa — o som viaja ~4,3× mais rápido na água (≈1480 m/s contra ≈343 m/s no
 * ar) — e o dono do mundo mandou ignorar em vez de gravar algo errado.
 *
 *   node functions/livro-flux-dourada-e-singulares.mjs            (dry-run)
 *   node functions/livro-flux-dourada-e-singulares.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ref = db.collection('worldbuilding-articles').doc('art-fluxomancia-13-essencias');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não encontrado.'); process.exit(1); }
const original = snap.data().contentHTML || '';

const TROCAS = [
    ['Abertura das Singulares',
     'O Cristal serve de recipiente às outras, o Abissal consome e corrompe todas, e a Dourada é a única capaz de canalizá-las sem se alterar.',
     'O Cristal serve de recipiente às outras, o Abissal cria as demais e também as consome e corrompe, e a Dourada é a única capaz de canalizá-las sem se alterar.'],

    ['Mimetismo da Dourada',
     '<p><strong>Onde se encontra:</strong> no Erídio,',
     '<p><strong>Mimetismo:</strong> pode imitar qualquer outra essência e se parecer com ela. As duas não se misturam, porém — não é transformação verdadeira.</p>\n' +
     '<p><strong>Onde se encontra:</strong> no Erídio,'],
];

let html = original;
const erros = [];
for (const [rotulo, de] of TROCAS) {
    const n = html.split(de).length - 1;
    if (n !== 1) erros.push(`${rotulo}: âncora aparece ${n}× (esperado 1)`);
}
if (erros.length) {
    console.error('🔴 ABORTADO — o artigo não está no estado esperado:\n' + erros.map(e => '  - ' + e).join('\n'));
    process.exit(1);
}
for (const [, de, para] of TROCAS) html = html.replace(de, para);

const limpo = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('=== art-fluxomancia-13-essencias — 2 trocas ===\n');
for (const [rotulo, de, para] of TROCAS) {
    console.log(`── ${rotulo}`);
    console.log(`   ANTES: ${limpo(de).slice(0, 190)}`);
    console.log(`   DEPOIS: ${limpo(para).slice(0, 300)}\n`);
}
console.log(`${original.length} → ${html.length} chars (+${html.length - original.length})`);

/* assert rodável */
const deveTer = ['o Abissal cria as demais', 'não é transformação verdadeira'];
const naoDeveTer = ['o Abissal consome e corrompe todas, e a Dourada'];
const falhas = [...deveTer.filter(s => !html.includes(s)).map(s => `faltou: "${s}"`),
                ...naoDeveTer.filter(s => html.includes(s)).map(s => `sobrou: "${s}"`)];
if (falhas.length) { console.error('\n🔴 auto-verificação falhou:\n' + falhas.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('✅ auto-verificação passou (2 frases novas presentes, 1 desmentida removida).');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
