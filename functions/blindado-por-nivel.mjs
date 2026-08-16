/**
 * 🛡️ Blindado: o "+N de Blindagem" vira número de verdade.
 *
 * A condição dizia "+N de Blindagem" e não tinha nada que carregasse o N —
 * a Amamoia ficava com o chip na tela e Blindagem 0 na ficha.
 *
 * Decisão de mesa (16/08/2026): o N é o NÍVEL da condição. `modVd` diz qual
 * Valor Derivado e `modVdPorNivel` diz quanto vale cada degrau, então
 * Blindado nível 5 soma +5 (ver shared/combate-cenas.js).
 *
 * Para o nível existir, a condição precisa acumular níveis. O texto dela dizia
 * "Empilha até 3", mas a Postura Defensiva aplica Blindado 5 — o teto sobe
 * para 5 para a postura caber no próprio sistema de níveis.
 *
 *   node functions/blindado-por-nivel.mjs            (dry-run)
 *   node functions/blindado-por-nivel.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const snap = await db.collection('system/data/conditions').get();
const alvo = snap.docs.find(d => /^blindado$/i.test(d.data().nome || ''));
if (!alvo) { console.error('🔴 condição "Blindado" não encontrada'); process.exit(1); }
const c = alvo.data();

const patch = { modVd: 'Blindagem', modVdPorNivel: 1, acumulaNiveis: true, nivelMaximo: 5 };
console.log('='.repeat(60));
console.log('Blindado' + (APPLY ? ' — GRAVANDO' : ' — DRY-RUN'));
console.log('='.repeat(60));
for (const [k, v] of Object.entries(patch)) {
    console.log(`  ${k.padEnd(16)} ${JSON.stringify(c[k])} → ${JSON.stringify(v)}`);
}
console.log('\n  efeito: Blindado nv 1 = +1 · nv 3 = +3 · nv 5 = +5 de Blindagem');

// A Postura Defensiva precisa dizer o NÍVEL, senão aplica 1.
const mods = await db.collection('system/data/classModules').get();
const posturas = [];
for (const d of mods.docs) {
    const m = d.data();
    const itens = (m.itensPredefinidos || []).map(pd => ({ ...pd }));
    let mexeu = false;
    for (const pd of itens) {
        if (!/postura defensiva/i.test(pd.nome || '')) continue;
        pd.condicoesAplicadas = (pd.condicoesAplicadas || []).map(cd =>
            /blindado/i.test(cd.condicao || '') ? { ...cd, nivel: 5 } : cd);
        console.log(`  [${m.titulo}] Postura Defensiva → aplica Blindado nível 5`);
        mexeu = true;
    }
    if (mexeu) posturas.push({ ref: d.ref, itens });
}

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
const lote = db.batch();
lote.update(alvo.ref, patch);
for (const p of posturas) lote.update(p.ref, { itensPredefinidos: p.itens });
await lote.commit();
console.log('\n✅ gravado.');
process.exit(0);
