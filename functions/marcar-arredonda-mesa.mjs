/**
 * Marca `arredondaMesa: true` na Blindagem física e nas 13 tipadas.
 *
 * A ficha passa a exibir o valor de mesa (para baixo, mínimo 1 se for maior que
 * zero — Livro, 5.4) e mostra a fração exata no tooltip do nome. O valor cheio
 * continua guardado: só a exibição muda.
 *
 *   node functions/marcar-arredonda-mesa.mjs            (dry-run)
 *   node functions/marcar-arredonda-mesa.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const col = db.collection('system/data/derivedValues');
const docs = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const alvos = docs.filter(d => /^Blindagem($| )/.test(String(d.nome || '')));
const pendentes = alvos.filter(d => d.arredondaMesa !== true);

console.log(`\n${alvos.length} Blindagens encontradas · ${pendentes.length} a marcar\n`);
for (const d of alvos) console.log(`   ${d.nome.padEnd(24)} ${d.arredondaMesa === true ? 'ok' : '→ arredondaMesa: true'}`);

if (alvos.length !== 14) {
    console.log(`\n🔴 Esperava 14 (1 física + 13 tipadas), achei ${alvos.length}. Confira antes de gravar.`);
    process.exit(1);
}
if (!pendentes.length) { console.log('\nNada a fazer.'); process.exit(0); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const batch = db.batch();
for (const d of pendentes) batch.update(col.doc(d.id), { arredondaMesa: true, updatedAt: new Date() });
await batch.commit();
console.log(`\n✅ ${pendentes.length} marcadas.`);
process.exit(0);
