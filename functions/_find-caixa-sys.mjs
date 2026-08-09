import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function findInSystemData() {
  const collections = await db.collection('system').doc('data').listCollections();
  for (const col of collections) {
    console.log("Checking subcollection:", col.id);
    const snap = await col.get();
    snap.forEach(doc => {
      const data = doc.data();
      const str = JSON.stringify(data).toLowerCase();
      if (str.includes("caixa") || str.includes("feira")) {
        console.log(`\n!!! FOUND in system/data/${col.id}/${doc.id} !!!`);
        console.log(data.nome || data.name || doc.id);
        if (str.includes("caixa da feira")) {
            console.log(JSON.stringify(data, null, 2));
        }
      }
    });
  }
}

findInSystemData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
