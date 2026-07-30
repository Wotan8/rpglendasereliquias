import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Default storage bucket name usually matches <project_id>.appspot.com or firebasestorage.app
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function main() {
    const [localPath, collectionPath, docName, destFolder] = process.argv.slice(2);
    if (!localPath || !collectionPath || !docName) {
        console.error("Uso: node upload-and-update.mjs <caminhoLocal> <caminhoColecao> <nomeDocumento> [pastaDestino]");
        process.exit(1);
    }
    
    // 1. Procurar o documento pelo campo 'nome'
    const snap = await db.collection(collectionPath).where('nome', '==', docName).limit(1).get();
    if (snap.empty) {
        console.error(`Erro: Documento com nome "${docName}" não encontrado na coleção "${collectionPath}".`);
        process.exit(1);
    }
    const docId = snap.docs[0].id;
    
    // 2. Definir o caminho no Storage
    const fileName = localPath.split('\\').pop().split('/').pop();
    const folder = destFolder || collectionPath.split('/').pop(); 
    const storagePath = `worldbuilding-images/${folder}/${Date.now()}_${fileName}`;
    
    console.log(`Fazendo upload de ${localPath} para ${storagePath}...`);
    
    // 3. Fazer o Upload
    await bucket.upload(localPath, {
        destination: storagePath,
        metadata: { contentType: 'image/png' } // default
    });
    
    // 4. Gerar a URL Pública no formato correto do projeto
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`URL Gerada: ${downloadUrl}`);
    
    // 5. Atualizar o Firestore
    console.log(`Atualizando documento ${collectionPath}/${docId}...`);
    await db.doc(`${collectionPath}/${docId}`).update({
        imagem: downloadUrl,
        imagemUrl: downloadUrl,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✔ Sucesso! Imagem salva e banco atualizado.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
