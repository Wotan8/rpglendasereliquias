/** Varre coleções atrás de menções às tribos. node functions/_tmp-scan-tribos.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const COLS = ['npcs', 'worldbuilding-articles', 'worldbuilding-books', 'worldbuilding-cultures',
  'worldbuilding-factions', 'worldbuilding-geography', 'worldbuilding-lineages',
  'worldbuilding-properties', 'worldbuilding-relations', 'items', 'economy-locations'];

const tribes = (await db.collection('system/data/tribes').get()).docs.map(d => d.data().nome);
const rx = n => new RegExp(`(?<![\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![\\p{L}])`, 'giu');

const hits = {};
for (const col of COLS) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) {
    const data = d.data();
    const blob = JSON.stringify(data);
    for (const t of tribes) {
      const m = blob.match(rx(t));
      if (!m) continue;
      (hits[t] ||= []).push({ col, id: d.id, nome: data.nome || data.titulo || data.name || d.id, n: m.length });
    }
  }
  console.error(`${col}: ${snap.size} docs`);
}
console.log(JSON.stringify(hits, null, 1));
process.exit();
