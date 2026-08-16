import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
    });
}

const db = admin.firestore();

async function main() {
    const snap = await db.collection('system/data/equipment').get();
    const totems = [];
    
    snap.forEach(doc => {
        const data = doc.data();
        const nome = data.nome || '';
        if (nome.toLowerCase().includes('totem')) {
            totems.push({
                id: doc.id,
                nome: data.nome,
                descricao: data.descricao || data.descricaoAparencia || '',
                imagem: data.imagem || data.imagemUrl || '',
                criadoEm: data.criadoEm || data.createdAt || null
            });
        }
    });

    console.log(`TOTAL TOTENS ENCONTRADOS: ${totems.length}`);
    console.log("\nTOTENS SEM IMAGEM:");
    const semImagem = totems.filter(t => !t.imagem);
    semImagem.forEach(t => {
        console.log(`- [${t.nome}]: ${t.descricao}`);
    });

    console.log("\nTOTENS COM IMAGEM:");
    const comImagem = totems.filter(t => t.imagem);
    comImagem.forEach(t => {
        console.log(`- [${t.nome}]: ${t.imagem}`);
    });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
