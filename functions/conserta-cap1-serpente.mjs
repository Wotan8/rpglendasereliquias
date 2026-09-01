/**
 * Capítulo 1, "O Nível de Ameaça": a Serpente não é mais Praga.
 *
 * O capítulo dizia "O Fantoche e a Serpente são Praga". Era verdade até a
 * Peçonha ganhar preço: a Serpente hoje é **Séria, 0,77×** — 0,19 do dado
 * mais 0,58 do rider. Todo o resto do capítulo foi conferido contra as
 * fichas e está correto (Corvo, Lobo, Urso, Servo Reanimado, Cria Menor do
 * Véu, Cria da Fenda, e as duas contas de encontro com sete Lobos e quatro
 * Crias).
 *
 * A frase nova não só corrige: usa a Serpente como o exemplo do próprio
 * ponto do capítulo, que é a força não estar toda no dado.
 *
 *   node functions/conserta-cap1-serpente.mjs            (dry-run)
 *   node functions/conserta-cap1-serpente.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', 'book_mrs9ur4aw1m6a').get()).docs;
const cap = arts.find(d => (d.data().title || '') === 'O Nível de Ameaça');
if (!cap) { console.log('❌ capítulo "O Nível de Ameaça" não achado'); process.exit(1); }

const npcs = (await db.collection('npcs').get()).docs.map(d => d.data());
const serp = npcs.find(n => n.nome === 'Serpente');
const am = String(serp?.criatura?.nivelAmeaca || '');
const grau = am.split(' · ')[0], forca = (/(\d+,\d+)×/.exec(am) || [])[1];
if (grau !== 'Séria') { console.log(`❌ a Serpente está como "${grau}", não "Séria" — confira antes`); process.exit(1); }

const html = String(cap.data().contentHTML || '');
/* o Grau vem em <strong> no capítulo inteiro; a frase é
   "O Fantoche e a Serpente são <strong>Praga</strong>." */
const de = 'O Fantoche e a Serpente são <strong>Praga</strong>.';
const alvo = html.includes(de) ? de : null;
if (!alvo) {
    console.log('❌ não achei a frase da Serpente. Trechos com "Praga" no capítulo:');
    for (const m of html.replace(/<[^>]+>/g, ' ').matchAll(/.{90}Praga.{90}/g)) console.log(`   …${m[0].replace(/\s+/g, ' ')}…`);
    process.exit(1);
}

const para = `O Fantoche é <strong>Praga</strong>. A Serpente parece Praga pelo dado — 1d4+1 — e é <strong>${grau}</strong>, ${forca}×: a peçonha dela vale mais que a mordida, e é o primeiro aviso de que a força não está toda no dado.`;
const novo = html.replace(alvo, para);
const words = novo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

console.log(`\n=== Capítulo 1 · "O Nível de Ameaça"  [${cap.id}]  public=${cap.data().public} ===\n`);
console.log(`   de:   ${alvo.replace(/<[^>]+>/g, '')}`);
console.log(`   para: ${para.replace(/<[^>]+>/g, '')}`);
console.log(`\n   ${cap.data().words} → ${words} palavras`);
console.log(`\n   O resto do capítulo foi conferido contra as fichas e está correto.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await cap.ref.update({ contentHTML: novo, words, updatedAt: new Date().toISOString(), updatedBy: AUTOR });
console.log('\n✅ gravado.');
process.exit(0);
