/**
 * Censo do banco: quantos documentos há em cada coleção (raiz, system/data/*, config/*),
 * e quantos publicados/despublicados nos cadastros do sistema. Só leitura.
 *
 *   node functions/v2-censo.mjs            (imprime)
 *   node functions/v2-censo.mjs --json > censo.json
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const JSON_OUT = process.argv.includes('--json');

const out = { geradoEm: new Date().toISOString(), raiz: {}, systemData: {}, config: [] };

for (const c of await db.listCollections()) {
    const snap = await c.get();
    out.raiz[c.id] = snap.size;
}
for (const c of await db.doc('system/data').listCollections()) {
    const snap = await c.get();
    let pub = 0, despub = 0;
    snap.forEach(d => { const p = d.data().publicado; if (p === false) despub++; else pub++; });
    out.systemData[c.id] = { total: snap.size, publicados: pub, despublicados: despub };
}
out.config = (await db.collection('config').listDocuments()).map(r => r.id);

if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log('RAIZ');
for (const [k, v] of Object.entries(out.raiz).sort()) console.log(`  ${k.padEnd(28)} ${v}`);
console.log('SYSTEM/DATA (total · publicados · despublicados)');
for (const [k, v] of Object.entries(out.systemData).sort()) console.log(`  ${k.padEnd(20)} ${String(v.total).padStart(4)} · ${String(v.publicados).padStart(4)} · ${v.despublicados}`);
console.log('CONFIG: ' + out.config.join(', '));
process.exit(0);
