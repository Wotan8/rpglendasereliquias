const admin = require("firebase-admin");
const serviceAccount = require("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  const cols = await db.listCollections();
  for (const c of cols) {
    const snap = await c.get();
    for (const d of snap.docs) {
      const j = JSON.stringify(d.data());
      if (/contracanto|sonoral|bardo/i.test(j)) {
        console.log(`${c.id}/${d.id} | ${d.data().nome || d.data().title || d.data().titulo || ""} | ${j.length} bytes`);
      }
    }
    // subcolecoes de docs
    for (const d of snap.docs) {
      const subs = await d.ref.listCollections();
      for (const s of subs) console.log(`  SUB ${c.id}/${d.id}/${s.id}`);
    }
  }
})().catch(console.error).finally(() => process.exit());
