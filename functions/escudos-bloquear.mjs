/**
 * Passo 5 da migração v2: a Qualidade do escudo soma no Bloquear.
 *
 * Escudo não sobe de Blindagem (fixa: Torre 2 · Grande 1 · Médio 1 · Broquel 0).
 * A Qualidade dele compra bloqueio: um vínculo em `periciasVinculadas` com
 * Equação de Valor [Item: Qualidade], resolvido com o escudo em escopo.
 * Catálogo inteiro é Q0 hoje, então o bônus nasce 0 e cresce com a peça.
 *
 *   node functions/escudos-bloquear.mjs            (dry-run)
 *   node functions/escudos-bloquear.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const ESCUDOS = ['Broquel', 'Escudo de Torre', 'Escudo Grande', 'Escudo Médio'];

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, skSnap] = await Promise.all([grab('equipment'), grab('skills')]);

const bloquear = skSnap.docs.filter(d => (d.data().nome || '') === 'Bloquear');
if (bloquear.length !== 1) { console.error(`🔴 perícia "Bloquear": ${bloquear.length} achadas (esperado 1).`); process.exit(1); }
const skillId = bloquear[0].id;

const mudancas = [], avisos = [];
for (const d of eqSnap.docs) {
    const e = d.data();
    if (!ESCUDOS.includes(e.nome)) continue;
    const atuais = Array.isArray(e.periciasVinculadas) ? e.periciasVinculadas : [];
    if (atuais.some(p => p.id === skillId)) { avisos.push(`já vinculado: ${e.nome}`); continue; }
    const novo = [...atuais, { id: skillId, modificador: 0, equacao: [{ tipo: 'ficha', ref: 'Item: Qualidade' }] }];
    mudancas.push({ ref: d.ref, patch: { periciasVinculadas: novo }, nome: e.nome, antes: atuais.length });
}

console.log(`\n=== Qualidade do escudo soma no Bloquear (perícia ${skillId}) ===\n`);
for (const m of mudancas) console.log(`  ${m.nome.padEnd(18)} periciasVinculadas: ${m.antes} → ${m.antes + 1}`);
for (const a of avisos) console.log(`  ⚠ ${a}`);

if (mudancas.length + avisos.length !== ESCUDOS.length) {
    console.error(`\n🔴 ABORTADO — ${mudancas.length + avisos.length} escudos vistos, esperado ${ESCUDOS.length}.`);
    process.exit(1);
}
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${mudancas.length} escudos gravados.`);
process.exit(0);
