/**
 * Lança e Tridente: dado de duas mãos = 1d10 (decisão do Mestre, 13/08/2026).
 *
 * As duas eram Versáteis só no rótulo — 1d8 nas duas pegadas, sem o segundo
 * dado cadastrado. audit-armas-versateis.mjs não grava isso de propósito
 * (escolher o dado é balanceamento); este script é a decisão, registrada.
 *
 * 1d8 → 1d10 é um degrau na escada de dados, o mesmo salto que a Espada
 * Bastarda já tinha do cadastro antigo.
 *
 *   node functions/lanca-tridente-2maos.mjs             (ensaio)
 *   node functions/lanca-tridente-2maos.mjs --aplicar
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const ALVOS = { 'Lança': '1d10', 'Tridente': '1d10' };
const APLICAR = process.argv.includes('--aplicar');

const eq = (await db.collection('system/data/equipment').get()).docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(i => i.tipo === 'Arma' && i.categoriaArma === 'versatil' && ALVOS[i.nome]);

const faltando = Object.keys(ALVOS).filter(n => !eq.some(i => i.nome === n));
if (faltando.length) { console.error(`❌ não encontrado no catálogo: ${faltando.join(', ')}`); process.exit(1); }

for (const i of eq) console.log(`   ${i.nome}: ${i.formulaDano} · 2 mãos ${i.formulaDano2Maos || '(vazio)'} → ${ALVOS[i.nome]}`);

if (!APLICAR) { console.log('\n(ensaio) rode com --aplicar para gravar.'); process.exit(0); }

const agora = new Date().toISOString();
const batch = db.batch();
for (const i of eq) batch.update(i.ref, { formulaDano2Maos: ALVOS[i.nome], atualizadoEm: agora, updatedAt: agora });
await batch.commit();
console.log(`\n✅ ${eq.length} arma(s) atualizadas.`);
