import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
for (const [id, ini, fim] of [['0p00vfreClWjXlAGR9YM','1.1 Taxas','1.2 Confiab'],
                              ['0p00vfreClWjXlAGR9YM','1.5 Tabela','1.6 Espalh'],
                              ['gc3xRb9UpDWKq2CGjzh8','6.3 Valor cheio','6.4 A tabela'],
                              ['gc3xRb9UpDWKq2CGjzh8','6.7 Desvantagem','6.8 O que o motor']]) {
    const d = (await db.collection('worldbuilding-articles').doc(id).get()).data();
    const a = d.contentHTML.indexOf(ini), b = d.contentHTML.indexOf(fim);
    console.log(`\n========== ${ini} ==========`);
    console.log(d.contentHTML.slice(a - 10, b - 10));
}
process.exit(0);
