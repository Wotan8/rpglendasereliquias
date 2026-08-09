const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('system/data/equipment')
                         .where('tipo', '==', 'Arma')
                         .get();
    const semImagem = snap.docs.filter(d => !d.data().imagem)
                               .sort((a, b) => a.data().nome.localeCompare(b.data().nome));
    
    for (const doc of semImagem.slice(0, 5)) {
        console.log(`[ITEM] ${doc.data().nome}`);
        console.log(`[DESC] ${doc.data().descricao || ''}`);
        console.log('---');
    }
}
run().then(() => process.exit()).catch(console.error);
