import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function searchAll() {
  const collections = await db.listCollections();
  
  for (const col of collections) {
    try {
      const snap = await col.get();
      snap.forEach(doc => {
        const data = doc.data();
        const str = JSON.stringify(data).toLowerCase();
        if (str.includes("caixa da feira")) {
          console.log(`\n!!! FOUND in ${col.id}/${doc.id} !!!`);
          console.log(JSON.stringify(data, null, 2));
        }
      });
    } catch(e) {
    }
  }
}

searchAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
