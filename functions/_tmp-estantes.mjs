/* SO LEITURA — lista as estantes e quais livros estao em cada uma. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const snap = await db.collection('worldbuilding-settings').doc('estantes').get();
const estantes = snap.exists ? (snap.data().lista || []) : [];
const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const das = (b) => b.estanteIds || (b.estanteId ? [b.estanteId] : []);

console.log(`doc worldbuilding-settings/estantes: ${snap.exists ? 'existe' : 'NAO existe'} — ${estantes.length} estante(s)`);
console.log(`${books.length} livros na base\n`);
for (const e of estantes) {
    const dentro = books.filter(b => das(b).includes(e.id));
    console.log(`${e.icone || '[]'} ${e.nome}  (${dentro.length})`);
    dentro.forEach(b => console.log(`   - ${b.title}`));
}
const multi = books.filter(b => das(b).length > 1);
console.log(`\nEm mais de uma estante: ${multi.length}`);
multi.forEach(b => console.log(`   - ${b.title} -> ${das(b).map(id => (estantes.find(e => e.id === id) || {}).nome || id).join(' + ')}`));
const sem = books.filter(b => das(b).length === 0);
console.log(`\nSem estante (so em "Todos os livros"): ${sem.length}`);
sem.forEach(b => console.log(`   - ${b.title}`));
