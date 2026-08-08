/**
 * Mentalização não existe mais — decisão do dono do mundo: Runomancia é lógica
 * pura, e circuito imaginado não tem credibilidade de circuito.
 *
 * O papelEmCena do Runimago prometia "Mentaliza runas de combate para efeitos
 * rápidos (requer perícia 3+)". A linha vira o improviso verdadeiro da classe:
 * a Escripta — gravação rápida, barata e gasta.
 *
 *   node functions/runimago-remove-mentalizacao.mjs            (dry-run)
 *   node functions/runimago-remove-mentalizacao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = '•  Mentaliza runas de combate para efeitos rápidos (requer perícia 3+)';
const PARA = '•  Grava runas de Escripta às pressas — rápidas, baratas e de poucos usos';

const snap = await db.collection('system/data/classes').where('nome', '==', 'Runimago').get();
if (snap.docs.length !== 1) { console.error(`🔴 ${snap.docs.length} Runimagos (esperado 1).`); process.exit(1); }
const doc = snap.docs[0];
const papel = doc.data().papelEmCena;
if (!Array.isArray(papel) || !papel[0]?.combate) { console.error('🔴 papelEmCena fora do formato.'); process.exit(1); }
const combate = String(papel[0].combate);
if (combate.split(DE).length - 1 !== 1) {
    console.error('🔴 âncora não única no texto de combate:\n' + combate); process.exit(1);
}
const novo = [...papel];
novo[0] = { ...papel[0], combate: combate.replace(DE, PARA) };

console.log('=== Runimago: papelEmCena ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await doc.ref.update({ papelEmCena: novo, atualizadoEm: admin.firestore.Timestamp.now() });
console.log('\n✅ Gravado.');
process.exit(0);
