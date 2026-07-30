/**
 * Publica todo equipamento com publicado=false.
 * Item não publicado é filtrado do catálogo da ficha (inventory.js:149),
 * então não dá para adicionar no personagem.
 *
 * node functions/publicar-equipamentos.mjs          → dry-run
 * node functions/publicar-equipamentos.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const snap = await db.collection('system/data/equipment').get();
const ocultos = snap.docs.filter(d => d.data().publicado === false);

const porTipo = {};
ocultos.forEach(d => (porTipo[d.data().tipo || '(sem tipo)'] ||= []).push(d.data().nome || d.id));

for (const [tipo, nomes] of Object.entries(porTipo).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n### ${tipo} — ${nomes.length}`);
    nomes.sort().forEach(n => console.log('   ' + n));
}

console.log(`\n${ocultos.length} de ${snap.size} serão publicados.`);
if (!ocultos.length) { console.log('Nada a fazer.'); process.exit(); }

if (!WRITE) { console.log('\n(dry-run — rode com --write para gravar)'); process.exit(); }

const lote = db.batch();
ocultos.forEach(d => lote.update(d.ref, { publicado: true }));
await lote.commit();
console.log(`\n✅ ${ocultos.length} publicados.`);
process.exit();
