/* Vincula os Compendios a estante "Escolas Magicas". Escreve so estanteIds. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--aplicar');

const snap = await db.collection('worldbuilding-settings').doc('estantes').get();
const estantes = snap.data().lista || [];
const alvo = estantes.find(e => (e.nome || '').toLowerCase().includes('escolas'));
if (!alvo) { console.error('Estante "Escolas Magicas" nao encontrada.'); process.exit(1); }

const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const das = (b) => b.estanteIds || (b.estanteId ? [b.estanteId] : []);
const alvos = books.filter(b => /^Comp[êe]ndio de /i.test(b.title || ''));

console.log(`Estante: ${alvo.icone || ''} ${alvo.nome} (${alvo.id})`);
console.log(`${alvos.length} compendios encontrados:`);
for (const b of alvos) console.log(`   - ${b.title}  [estantes hoje: ${das(b).length}]`);
if (!APLICAR) { console.log('\nSIMULACAO. Rode com --aplicar para gravar.'); process.exit(0); }

for (const b of alvos) {
    const ids = [...new Set([...das(b), alvo.id])];
    await db.collection('worldbuilding-books').doc(b.id).set({ estanteIds: ids, estanteId: null }, { merge: true });
    console.log(`gravado: ${b.title} -> ${ids.length} estante(s)`);
}
