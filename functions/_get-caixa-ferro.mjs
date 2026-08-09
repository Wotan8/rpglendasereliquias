import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function getDoc() {
  const doc = await db.doc('system/data/equipment/uMqdxwznvzmxwR0tGeg6').get();
  console.log(JSON.stringify(doc.data(), null, 2));
}

getDoc().then(() => process.exit(0));
