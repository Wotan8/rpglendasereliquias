/**
 * Remove tags mortas e garante "Foco Mágico" nos itens que eram marcados por
 * "Símbolo Sagrado".
 *
 * NÃO remove Escudo Torre / Escudo Grande / Média I-III / Pesada I-III: cada uma
 * é lida por uma mecânica publicada via config.equipReqs[].tag (as 8 penalidades
 * de armadura). Verificado com functions/scan-uso-tags.mjs.
 *
 * node functions/podar-tags.mjs          → dry-run
 * node functions/podar-tags.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const REMOVER = ['Símbolo Sagrado', 'Nível 2'];
// Quem perder "Símbolo Sagrado" precisa continuar identificável como foco.
// Acento seguindo a convenção do catálogo (Matéria, Máscara, Relíquia, Símbolo).
const TROCAS = { 'Símbolo Sagrado': 'Foco Mágico' };

const snap = await db.collection('system/data/equipment').get();
const lote = db.batch();
let mudados = 0;

for (const doc of snap.docs) {
    const item = doc.data();
    const antigas = Array.isArray(item.tags) ? item.tags : [];
    if (!antigas.some(t => REMOVER.includes(t))) continue;

    const substitutas = antigas.filter(t => TROCAS[t]).map(t => TROCAS[t]);
    const novas = [...new Set([...antigas.filter(t => !REMOVER.includes(t)), ...substitutas])];

    console.log(`${item.nome}`);
    console.log(`   [${antigas.join(', ')}]`);
    console.log(`→  [${novas.join(', ')}]`);
    lote.update(doc.ref, { tags: novas });
    mudados++;
}

if (!mudados) { console.log('Nada a fazer.'); process.exit(); }
if (WRITE) { await lote.commit(); console.log(`\n✅ ${mudados} item(ns) atualizado(s).`); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
