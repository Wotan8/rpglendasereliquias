const admin = require("firebase-admin");
const serviceAccount = require("./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json");
const fs = require("fs");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();

async function main() {
  const snap = await db.collection("npcs").get();
  let result = "# Lista de NPCs sem Imagem\n\n";
  result += "| Nome | Raça | Classe | Tipo | Local | Papel |\n";
  result += "|---|---|---|---|---|---|\n";

  let count = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    if (!data.imagem || data.imagem.trim() === "") {
      const nome = data.nome || "Sem Nome";
      const raca = data.raca || (data.racaRef ? data.racaRef.custom : "-");
      const classe = data.classe || (data.classeRef ? data.classeRef.custom : "-");
      const tipo = data.tipo || "-";
      const local = data.local || "-";
      const papel = data.papel || "-";
      
      result += `| ${nome} | ${raca} | ${classe} | ${tipo} | ${local} | ${papel} |\n`;
      count++;
    }
  });

  result += `\n**Total de NPCs sem imagem:** ${count}\n`;
  fs.writeFileSync("../npcs_sem_imagem.md", result);
  console.log(`Encontrados ${count} NPCs sem imagem. Lista salva em ../npcs_sem_imagem.md`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit());
