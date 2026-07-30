/**
 * Lista livros do Escritório do Cronista e classes, para casar
 * "livro de mancia" ↔ "classe que usa a mancia".
 * node functions/audit-mancias.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const chapters = (await db.collection('worldbuilding-articles').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const classes = (await db.collection('system/data/classes').get()).docs.map(d => ({ id: d.id, ...d.data() }));

console.log('===== LIVROS (worldbuilding-books) =====');
for (const b of books.sort((a, b2) => (a.order ?? 0) - (b2.order ?? 0))) {
  const caps = chapters.filter(c => c.bookId === b.id);
  console.log(`• "${b.title}"  id=${b.id}  public=${b.public === true}  caps=${caps.length}`);
  if (b.description) console.log(`    desc: ${String(b.description).replace(/\s+/g, ' ').slice(0, 160)}`);
}

console.log('\n===== CLASSES (system/data/classes) =====');
for (const c of classes.sort((a, b2) => (a.nome || '').localeCompare(b2.nome || ''))) {
  const v = c.livroVinculado;
  console.log(`• "${c.nome}"  id=${c.id}  publicado=${c.publicado !== false}  usaRunomancia=${c.usaRunomancia === true}`);
  console.log(`    arquetipo: ${c.arquetipo || '—'} | especialidade: ${String(c.especialidade || '—').replace(/\s+/g, ' ').slice(0, 120)}`);
  console.log(`    livroVinculado: ${v ? `${v.bookId} (caps: ${(v.capituloIds || []).length || 'todos'})` : '—'}`);
}
process.exit();
