/**
 * Encontra quais tags de equipamento são realmente referenciadas por mecânicas
 * (target.kind === 'tag'). Tag referenciada = não pode ser renomeada à toa.
 * node functions/audit-tags-usadas.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection('system/data/mechanics').get();
const refs = {};
const walk = (node, mecNome) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(x => walk(x, mecNome));
  if (node.kind === 'tag' && node.value) (refs[node.value] ||= new Set()).add(mecNome);
  for (const v of Object.values(node)) walk(v, mecNome);
};
snap.docs.forEach(d => walk(d.data(), d.data().nome || d.id));

console.log(`Mecânicas: ${snap.size}\n\n########## TAGS REFERENCIADAS POR MECÂNICAS ##########`);
for (const [t, s] of Object.entries(refs).sort()) console.log(`  "${t}"  ←  ${[...s].join(' | ')}`);
if (!Object.keys(refs).length) console.log('  (nenhuma)');
process.exit();
