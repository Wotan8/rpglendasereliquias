/**
 * Marca todo item vestível com a tag "Vestimenta" e classifica as armaduras
 * em Leve / Média / Pesada. Idempotente — só grava o que falta.
 *
 * node functions/tag-vestimentas.mjs          → dry-run (só mostra o diff)
 * node functions/tag-vestimentas.mjs --write  → grava no Firestore
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

// Classificação por nome (o cadastro não tem campo de blindagem — a peça é
// identificada manualmente). Peças de vestuário sem proteção ficam fora daqui
// e recebem só "Vestimenta".
const CLASSE_ARMADURA = {
    'Couro Leve': 'Leve',
    'Gibão Acolchoado': 'Leve',
    'Couro Batido': 'Leve',
    'Armadura Leve': 'Leve',
    'Manto Linho': 'Leve',
    'Couro Reforçado': 'Média',
    'Couro Cravejado': 'Média',
    'Brigandina': 'Média',
    'Peitoral de Aço': 'Média',
    'Cota de Malha': 'Média',
    'Cota de Placas': 'Pesada',
    'Meia-Armadura': 'Pesada',
    'Armadura Completa': 'Pesada',
    'Armadura de Torneio': 'Pesada',
};

const snap = await db.collection('system/data/equipment').where('tipo', '==', 'Vestimenta').get();
const batch = db.batch();
let mudados = 0;
const semClasse = [];

for (const doc of snap.docs) {
    const item = doc.data();
    const nome = (item.nome || '').trim();
    const atuais = Array.isArray(item.tags) ? item.tags : [];
    const novas = ['Vestimenta'];
    const classe = CLASSE_ARMADURA[nome];
    if (classe) novas.push(classe);
    else semClasse.push(nome);

    const faltando = novas.filter(t => !atuais.includes(t));
    if (!faltando.length) continue;

    console.log(`${nome}: [${atuais.join(', ') || '—'}]  +  ${faltando.join(', ')}`);
    batch.update(doc.ref, { tags: [...atuais, ...faltando] });
    mudados++;
}

console.log(`\n${mudados} de ${snap.size} itens precisam de update.`);
console.log(`Sem classe de armadura (só "Vestimenta"): ${semClasse.join(' | ')}`);

if (!mudados) console.log('\nNada a fazer.');
else if (WRITE) { await batch.commit(); console.log('\n✅ Gravado.'); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
