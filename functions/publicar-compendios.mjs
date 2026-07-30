/**
 * Marca como 🌐 públicos os Compêndios de mancia (worldbuilding-books).
 * Mexe SÓ no flag do livro — os capítulos têm marcação própria e ficam
 * como estão (relatados abaixo para você decidir).
 *
 *   node functions/publicar-compendios.mjs           → só mostra o plano
 *   node functions/publicar-compendios.mjs --apply   → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');

const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const chapters = (await db.collection('worldbuilding-articles').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const regras = (await db.collection('system/data/knowledge').get()).docs.map(d => ({ id: d.id, ...d.data() }));

// Só os compêndios de mancia — o Bestiario não entra.
const alvos = books.filter(b => /mancia/i.test(b.title || ''));

console.log(`===== ${alvos.length} compêndios =====`);
for (const b of alvos) {
  const caps = chapters.filter(c => c.bookId === b.id);
  const pub = caps.filter(c => c.public === true).length;
  const comRegra = caps.filter(c => regras.some(r => r.capituloId === c.id)).length;
  console.log(`• ${(b.title || '').padEnd(28)} livro.public=${b.public === true ? 'SIM' : 'não → vira SIM'}` +
    `  | capítulos: ${caps.length} (públicos: ${pub}, com regra de Conhecimento: ${comRegra})`);
}

const mudar = alvos.filter(b => b.public !== true);
console.log(`\n${mudar.length} livro(s) a marcar como público: ${mudar.map(b => b.title).join(', ') || '—'}`);

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(); }

for (const b of mudar) {
  await db.doc(`worldbuilding-books/${b.id}`).update({ public: true });
  console.log(`✅ ${b.title} → público`);
}
console.log(`\n${mudar.length} livro(s) atualizado(s).`);
process.exit();
