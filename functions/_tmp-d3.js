const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json")) });
const db = admin.firestore();
(async () => {
  for (const id of ["mod_palla_c1", "rituais_palla", "TbRKh68m2hvr9KUVrOXb"]) {
    const m = (await db.collection("system/data/classModules").doc(id).get()).data();
    console.log(`\n######## ${id} | ${m.titulo} | custoExpPorItem: ${m.custoExpPorItem}`);
    console.log("schema:", (m.schema || []).map(f => `${f.key}:${f.label}(${f.tipo})`).join(" | "));
    (m.itensPredefinidos || []).forEach(i => console.log("  •", i.nome, "| exp:", i.custoExpProprio, "|", JSON.stringify(i.valores).slice(0, 400)));
  }
})().catch(e => console.error(e)).finally(() => process.exit());
