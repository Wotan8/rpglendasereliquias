/**
 * Onde está escrita a regra de ganho de Harmonia do Bardo?
 * Varre classes, módulos (descrição/cabeçalho), VDs e status vitais.
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

const ALVO = /harmonia/i;
const COLS = ['classes', 'classModules', 'derivedValues', 'vitalStats', 'mechanics'];

for (const c of COLS) {
    const snap = await db.collection(`system/data/${c}`).get();
    for (const d of snap.docs) {
        const x = d.data();
        const txt = JSON.stringify(x);
        if (!ALVO.test(txt)) continue;
        console.log('═'.repeat(78));
        console.log(`[${c}] ${x.nome || d.id}   (${d.id})`);
        // mostra só os campos que citam Harmonia
        for (const [k, v] of Object.entries(x)) {
            if (typeof v === 'string' && ALVO.test(v)) {
                console.log(`   ${k}: ${v.replace(/\s+/g, ' ').slice(0, 600)}`);
            }
            if (Array.isArray(v)) {
                v.forEach((el, i) => {
                    const s = typeof el === 'string' ? el : JSON.stringify(el);
                    if (ALVO.test(s)) console.log(`   ${k}[${i}]: ${s.replace(/\s+/g, ' ').slice(0, 600)}`);
                });
            }
            if (v && typeof v === 'object' && !Array.isArray(v) && ALVO.test(JSON.stringify(v))) {
                console.log(`   ${k}: ${JSON.stringify(v).slice(0, 600)}`);
            }
        }
    }
}
process.exit(0);
