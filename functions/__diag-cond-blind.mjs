/**
 * Condições Fortalecido/Abalado e as Blindagens tipadas — para saber o que já
 * existe antes de mexer em Composição de Batalha e no golpe de instrumento.
 *
 *   node functions/__diag-cond-blind.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const [condSnap, dvSnap] = await Promise.all([
    db.collection('system/data/conditions').get(),
    db.collection('system/data/derivedValues').get(),
]);

console.log('\n═══ CONDIÇÕES com "Fortalecid" ou "Abalad" ═══');
for (const d of condSnap.docs) {
    const c = d.data();
    if (!/fortalecid|abalad/i.test(c.nome || '')) continue;
    console.log(`  ${d.id}  ${String(c.nome).padEnd(20)} níveis=${JSON.stringify(c.niveis || c.nivelMax || null)}`);
    console.log(`     ${String(c.descricao || '').slice(0, 160)}`);
    for (const k of ['temNivel', 'nivelMax', 'efeitoPorNivel', 'valoresDerivadosVinculados']) {
        if (c[k] !== undefined) console.log(`     ${k}: ${JSON.stringify(c[k]).slice(0, 200)}`);
    }
}

console.log('\n═══ Todas as condições (nome) ═══');
console.log('  ' + condSnap.docs.map(d => d.data().nome).sort().join(' · '));

console.log('\n═══ VDs de BLINDAGEM ═══');
for (const d of dvSnap.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => /blindagem/i.test(x.nome || ''))) {
    console.log(`  ${String(d.nome).padEnd(34)} bloco=${d.blocoNome || '—'}`);
}

process.exit(0);
