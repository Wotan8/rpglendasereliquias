import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

console.log('══ mecânica do VD Marca de Caça ══');
const mec = await db.doc('system/data/mechanics/6WS6SdLth8yrLue1rTnE').get();
console.log(JSON.stringify(mec.data(), null, 1));

console.log('\n══ doc completo do módulo marcar_presa ══');
const mp = await db.doc('system/data/classModules/marcar_presa').get();
console.log(JSON.stringify(mp.data(), null, 1).slice(0, 2000));

console.log('\n══ como um módulo se liga à classe (exemplo do Bardo) ══');
const so = await db.doc('system/data/classModules/sonoro_c1').get();
const d = so.data();
for (const [k, v] of Object.entries(d)) {
    if (k === 'itensPredefinidos' || k === 'schema') continue;
    console.log(`  ${k}: ${JSON.stringify(v)?.slice(0, 200)}`);
}

console.log('\n══ doc da classe Caçador ══');
const cl = await db.doc('system/data/classes/Ja6ULaEcRNEANKy1ywvW').get();
const c = cl.data();
for (const [k, v] of Object.entries(c)) {
    console.log(`  ${k}: ${JSON.stringify(v)?.slice(0, 300)}`);
}
process.exit(0);
