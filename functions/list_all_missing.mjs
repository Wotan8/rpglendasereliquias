import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function listMissing() {
  const snapshot = await db.collection('system/data/equipment').get();
  const missing = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.imagem) {
      missing.push(data.nome || doc.id);
    }
  });
  missing.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  console.log('TOTAL FALTANDO:', missing.length);
  console.log(JSON.stringify(missing, null, 2));
}

listMissing();
