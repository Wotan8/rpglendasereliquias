const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('system/data/equipment').get();
    const semImagem = snap.docs.filter(d => !d.data().imagem)
                               .map(d => d.data().nome || d.id)
                               .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
    console.log(`TOTAL FALTANDO: ${semImagem.length}`);
    console.log(JSON.stringify(semImagem, null, 2));
}

run().then(() => process.exit()).catch(console.error);
