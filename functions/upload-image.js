const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

async function run() {
  const imagePath = process.argv[2];
  const npcId = process.argv[3];

  if (!imagePath || !npcId) {
    console.error('Uso: node upload-image.js <caminho-da-imagem> <npc-id>');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error('Arquivo não encontrado:', imagePath);
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  let contentType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.webp') contentType = 'image/webp';

  const bucket = admin.storage().bucket();
  const dest = `npcs/${npcId}${ext}`;
  
  console.log(`Fazendo upload de ${imagePath} para ${dest}...`);
  await bucket.upload(imagePath, {
    destination: dest,
    metadata: { contentType }
  });

  // Make the file publicly accessible via a long-lived download token or just construct the unauthenticated read URL.
  // We can just construct the default firebase storage media URL:
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media`;
  
  console.log(`URL da imagem: ${publicUrl}`);

  const db = admin.firestore();
  console.log(`Atualizando documento do NPC ${npcId}...`);
  await db.collection('npcs').doc(npcId).update({
    imagem: publicUrl,
    lastUpdate: new Date().toISOString()
  });

  console.log('Feito! NPC atualizado com sucesso.');
}

run().catch(console.error).finally(() => process.exit());
