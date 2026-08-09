import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection('system/data/equipment').get();
const semImagem = snap.docs.filter(d => !d.data().imagem);

const porTipo = {};
semImagem.forEach(d => (porTipo[d.data().tipo || '(sem tipo)'] ||= []).push(d.data().nome || d.id));

for (const [tipo, nomes] of Object.entries(porTipo).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n### ${tipo} (${nomes.length})`);
    nomes.sort().forEach(n => console.log('   - ' + n));
}

console.log(`\nTotal: ${semImagem.length} de ${snap.size} equipamentos não possuem imagem.`);
process.exit();
