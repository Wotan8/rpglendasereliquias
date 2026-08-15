/**
 * Perícias e "Teto de Ofício" — para montar a equação do instrumento com as
 * MESMAS peças que as armas usam. Só lê.
 *
 *   node functions/__diag-pericia-teto.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const [skSnap, dvSnap, eqSnap] = await Promise.all([
    db.collection('system/data/skills').get(),
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/equipment').get(),
]);

console.log('\n═══ PERÍCIAS ═══');
console.log('  ' + skSnap.docs.map(d => d.data().nome).sort().join(' · '));

console.log('\n═══ "Teto de Ofício: …" ═══');
for (const d of dvSnap.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => /teto de of/i.test(x.nome || ''))) {
    console.log(`  ${d.id}  ${d.nome}`);
}

console.log('\n═══ Partes do corpo usadas em equipavelEm de arma ═══');
const bp = await db.collection('system/data/bodyParts').get();
for (const d of bp.docs) console.log(`  ${d.id}  ${d.data().icone || ''} ${d.data().nome}`);

console.log('\n═══ Instrumentos: peso/preço/tamanho de hoje ═══');
for (const e of eqSnap.docs.map(x => ({ id: x.id, ...x.data() }))
    .filter(e => (e.tags || []).some(t => /instrument/i.test(t)))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))) {
    const familia = (e.tags || []).find(t => /corda|sopro|percuss/i.test(t)) || '?';
    console.log(`  ${String(e.nome).padEnd(24)} ${String(familia).padEnd(10)} peso=${String(e.peso ?? '—').padEnd(5)} tam=${String(e.tamanho ?? '—').padEnd(4)} preço=${String(e.preco ?? '—').padEnd(6)} liga=${e.liga ?? '—'} equipavelEm=${JSON.stringify(e.equipavelEm || null)} forma=${e.formaEquipar || '—'}`);
}

process.exit(0);
