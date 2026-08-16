/**
 * 🎵 O Bardo paga canção com Harmonia E/OU Energia — sempre foi assim na mesa.
 *
 * Os cinco módulos de degrau ("Custo 1 — Abertura" … "Custo 5 — Opus Magnum")
 * não tinham `custoRecurso`: a moeda vinha por tabela do `retornoRecurso`
 * ("Harmonia"), então toda canção travava em "não tem Harmonia" mesmo com o
 * bardo cheio de Energia.
 *
 * Com DUAS moedas, `custosDaSkill` devolve uma BOLSA: o degrau é o total e
 * quem toca reparte (3 de Harmonia, ou 2 + 1, ou 3 de Energia).
 *
 *   node functions/bardo-moeda-dupla.mjs            (dry-run)
 *   node functions/bardo-moeda-dupla.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MOEDA = 'Harmonia ou Energia';

const snap = await db.collection('system/data/classModules').get();
const lote = db.batch();
let n = 0;
console.log('='.repeat(64));
console.log('Moeda dos módulos do Bardo' + (APPLY ? ' — GRAVANDO' : ' — DRY-RUN'));
console.log('='.repeat(64));
for (const d of snap.docs) {
    const m = d.data();
    // só os módulos de degrau que devolvem Harmonia (os do Bardo)
    if (!/^custo\s*\d/i.test(m.titulo || '')) continue;
    if (!/harmonia/i.test(m.retornoRecurso || '')) continue;
    if (m.custoRecurso === MOEDA) { console.log(`  = ${m.titulo}: já está`); continue; }
    console.log(`  ${m.titulo}: custoRecurso ${JSON.stringify(m.custoRecurso)} → ${JSON.stringify(MOEDA)}`);
    lote.update(d.ref, { custoRecurso: MOEDA });
    n++;
}
console.log(`\n${n} módulo(s) a atualizar.`);
if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
if (n) await lote.commit();
console.log('✅ gravado.');
process.exit(0);
