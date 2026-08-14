/**
 * Que tags os instrumentos/focos já têm no catálogo de equipamentos?
 * Decide se dá para exigir tag nas Formas de Conjuração sem travar ninguém.
 * Só leitura.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const snap = await db.collection('system/data/equipment').get();
const eqs = [];
snap.forEach(d => eqs.push({ id: d.id, ...d.data() }));

const RE = /rabeca|alaude|alaúde|flauta|tambor|lira|harpa|instrumento|corneta|trompa|gaita|pandeiro|sino|apito|foco/i;
const musicais = eqs.filter(e => RE.test(e.nome || '') || RE.test((e.tags || []).join(' ')) || RE.test(e.tipo || ''));

console.log(`${eqs.length} equipamentos · ${musicais.length} parecem instrumento/foco\n`);
for (const e of musicais) {
    console.log(`${(e.nome || '?').padEnd(34)} tipo=${String(e.tipo || '—').padEnd(12)} tags=[${(e.tags || []).join(', ')}]`);
}

const todasTags = new Set();
for (const e of eqs) for (const t of e.tags || []) todasTags.add(t);
console.log(`\nTODAS as tags em uso no catálogo (${todasTags.size}):`);
console.log([...todasTags].sort().join(' · '));
process.exit(0);
