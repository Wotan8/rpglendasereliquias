import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findItem() {
  const collections = ['items', 'economy-items', 'loja_itens', 'system/data/items', 'system/data/equipaveis', 'system/data/avulsas'];
  
  for (const col of collections) {
    try {
      const parts = col.split('/');
      let ref = db;
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) ref = ref.collection(parts[i]);
        else ref = ref.doc(parts[i]);
      }
      
      const snap = await ref.get();
      if (!snap || snap.empty) continue;

      snap.forEach(doc => {
        const data = doc.data();
        const nome = data.name || data.nome || data.title || doc.id;
        
        if (nome.toLowerCase().includes("caixa") || nome.toLowerCase().includes("feira")) {
          console.log(`\nFound possible match in ${col}/${doc.id}:`);
          console.log("Nome:", nome);
          console.log("Descricao:", data.description || data.descricao || data.desc || "");
        }
      });
    } catch (e) {
      // ignore
    }
  }
}

findItem().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
