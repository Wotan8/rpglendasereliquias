// =============================================
// LOTE 8 — relíquia deixa de ser tipo e vira MARCA (26/08/2026).
// ---------------------------------------------
// Decisão do usuário: "uma relíquia pode ser qualquer tipo". Então `tipo` diz
// o que a peça é mecanicamente (arma, objeto...) e `ehReliquia` diz que ela
// não desgasta. As duas peças relíquia do catálogo passam para o novo modelo:
//
//   O Sussurro Final   Arma      + marca   (era Arma + tag Relíquia)
//   Especulum Fatu     Objeto    + marca   (era tipo Relíquia, sem mecânica
//                                           de tipo nenhum — é espelho de mão)
//
// A tag "Relíquia" do Sussurro fica: serve de filtro e de sabor, e o motor
// continua aceitando o legado. O que manda agora é a marca.
//
//   node functions/lote8-marca-reliquia.mjs            (dry-run)
//   node functions/lote8-marca-reliquia.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const PLANO = {
    '2iCZWB05YIm3WdmbcuWm': { ehReliquia: true },                      // O Sussurro Final (segue Arma)
    hTqKivrhSnVFzYzbyrLM:   { ehReliquia: true, tipo: 'Objeto' },      // Especulum Fatu
};

const col = db.collection('system/data/equipment');
for (const [id, patch] of Object.entries(PLANO)) {
    const d = await col.doc(id).get();
    if (!d.exists) { console.log(`❌ não existe: ${id}`); process.exit(1); }
    const x = d.data();
    console.log(`${x.nome} · tipo ${x.tipo}${patch.tipo ? ' → ' + patch.tipo : ''} · ehReliquia ${x.ehReliquia ?? '(vazio)'} → true · tags ${(x.tags||[]).join('/') || '—'}`);
}

// ninguém mais no catálogo deveria ficar com tipo Relíquia
const sobra = [];
(await col.get()).forEach(d => { const x = d.data(); if (x.tipo === 'Relíquia' && !PLANO[d.id]) sobra.push(x.nome); });
console.log(sobra.length ? `⚠️ ainda no tipo Relíquia: ${sobra.join(', ')}` : '\n✓ nenhuma outra peça presa no tipo Relíquia');

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const [id, patch] of Object.entries(PLANO)) batch.update(col.doc(id), { ...patch, atualizadoEm: agora, updatedAt: agora });
await batch.commit();
console.log('\n✅ marca aplicada.');
process.exit(0);
