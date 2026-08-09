/**
 * Compêndio de Fluxomancia — o nome da escola da Essência Dourada é
 * "Forjarcanomancia", não "Forjarcana". Varredura confirmou 1 ocorrência única
 * em todo `worldbuilding-articles` + `worldbuilding-books`.
 *
 *   node functions/livro-flux-forjarcanomancia.mjs            (dry-run)
 *   node functions/livro-flux-forjarcanomancia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ref = db.collection('worldbuilding-articles').doc('art-fluxomancia-13-essencias');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não encontrado.'); process.exit(1); }
const original = snap.data().contentHTML || '';

const n = original.split('Forjarcana').length - 1;
if (n !== 1) { console.error(`🔴 ABORTADO: "Forjarcana" aparece ${n}× (esperado 1).`); process.exit(1); }

const html = original.replace('Forjarcana', 'Forjarcanomancia');

const i = html.indexOf('Forjarcanomancia');
console.log('=== art-fluxomancia-13-essencias — 1 troca ===\n');
console.log('  Forjarcana → Forjarcanomancia');
console.log('  contexto: ...' + html.slice(Math.max(0, i - 120), i + 40).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + '...');
console.log(`\n${original.length} → ${html.length} chars (+${html.length - original.length})`);

/* assert rodável */
if (html.split('Forjarcanomancia').length - 1 !== 1 || /Forjarcana(?!nomancia|mancia)/.test(html.replace('Forjarcanomancia', ''))) {
    console.error('🔴 auto-verificação falhou.'); process.exit(1);
}
console.log('✅ auto-verificação passou (1 "Forjarcanomancia", nenhum "Forjarcana" solto).');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
