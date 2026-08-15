/**
 * De onde sai o número das colunas Vocal / Inst. Cordas / Inst. Sopro /
 * Inst. Percussão — é a equação que o instrumento-arma tem de espelhar.
 *
 *   node functions/__diag-vd-sonoro-eq.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const dvSnap = await db.collection('system/data/derivedValues').get();
for (const d of dvSnap.docs) {
    const v = d.data();
    if (!/^(vocal|inst\. cordas|inst\. sopro|inst\. percuss|sonoromancia|acerto m[áa]gico|dano e[óo]lico|harmonia)$/i.test(v.nome || '')) continue;
    console.log(`\n═══ ${v.nome}  (${d.id}) ═══`);
    for (const [k, val] of Object.entries(v)) {
        if (k === 'descricao') { console.log(`  ${k}: ${String(val).slice(0, 120)}…`); continue; }
        console.log(`  ${k}: ${JSON.stringify(val)}`);
    }
}
process.exit(0);
