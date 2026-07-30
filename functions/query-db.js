// Script local pra eu (Claude) consultar Firestore/Storage do projeto.
// Uso: node query-db.js <comando> [args]
//   collections                     - lista as coleções raiz
//   get <colecao> <docId>           - le um documento
//   list <colecao> [limite=20]      - lista documentos de uma colecao
//   storage [prefixo]               - lista arquivos no bucket padrao

const admin = require("firebase-admin");
const serviceAccount = require("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();

async function main() {
  const [cmd, a, b] = process.argv.slice(2);

  if (cmd === "collections") {
    const cols = await db.listCollections();
    console.log(cols.map((c) => c.id));
  } else if (cmd === "get") {
    const snap = await db.collection(a).doc(b).get();
    console.log(snap.exists ? snap.data() : "NAO ENCONTRADO");
  } else if (cmd === "list") {
    const limit = Number(b) || 20;
    const snap = await db.collection(a).limit(limit).get();
    snap.forEach((doc) => console.log(doc.id, "=>", doc.data()));
  } else if (cmd === "storage") {
    const [files] = await admin.storage().bucket().getFiles({ prefix: a || "" });
    console.log(files.map((f) => f.name));
  } else {
    console.log("Uso: node query-db.js <collections|get|list|storage> [args]");
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit());
