/** Publica o Bestiário (livro + 5 capítulos). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const BOOK = 'book_mrs9ur4aw1m6a';
const caps = (await db.collection('worldbuilding-articles').where('bookId','==',BOOK).get()).docs;
const livro = await db.collection('worldbuilding-books').doc(BOOK).get();
console.log(`Livro "${livro.data()?.title}" · public=${livro.data()?.public}`);
for (const c of caps.sort((a,b)=>(a.data().order??0)-(b.data().order??0)))
    console.log(`  [${c.data().order}] ${c.data().title} · public=${c.data().public}`);
if (caps.length !== 5) { console.error(`🔴 esperava 5 capítulos, achei ${caps.length}`); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. --apply para publicar.'); process.exit(0); }
const b = db.batch();
b.update(livro.ref, { public: true, updatedAt: Date.now() });
caps.forEach(c => b.update(c.ref, { public: true, status: 'publicado', updatedAt: Date.now() }));
await b.commit();
console.log('\n✅ Bestiário público.');
process.exit(0);
