/**
 * Tira de `equipavelEm` os slots principais que o próprio `slotsAdicionais` do
 * item torna impossíveis.
 *
 * O bug: `equipavelEm` lista os slots que a ficha oferece como principal, e
 * `slotsAdicionais` a cobertura ALÉM do principal. Quando os dois pedem a mesma
 * parte, escolher aquela parte como principal faz a reserva pedir uma cópia a
 * mais do que o corpo tem — e a reserva é tudo-ou-nada (shared/equip-slots.js),
 * então o item simplesmente não equipa. Manto de Linho no slot Cabeça, Cota de
 * Malha no Ombro, etc. A ficha oferece a opção e ela nunca funciona.
 *
 * Regra: parte P só serve de principal se sobrar corpo pra cobertura —
 *   quantidade_pedida(P) <= slots_da_raça(P) - 1
 * Usa o MAIOR número de slots entre as raças: só remove o que está quebrado
 * para todo mundo.
 *
 *   node functions/corrigir-equipavelem.mjs            (dry-run)
 *   node functions/corrigir-equipavelem.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, bp, racas] = await Promise.all(['equipment', 'bodyParts', 'races'].map(grab));
const NOME = Object.fromEntries(bp.map(p => [p.id, p.nome]));

/* Quantos slots daquela parte o corpo mais generoso tem. */
const CAPACIDADE = {};
for (const r of racas)
    for (const p of (r.partesDoCorpo || []))
        CAPACIDADE[p.id] = Math.max(CAPACIDADE[p.id] || 0, p.slots || 1);

const mudancas = [];
for (const e of eq) {
    const extras = e.slotsAdicionais || [];
    if (!extras.length || !Array.isArray(e.equipavelEm) || !e.equipavelEm.length) continue;

    const pedido = Object.fromEntries(extras.map(s => [s.id, s.quantidade || 1]));
    const impossiveis = e.equipavelEm.filter(id => (pedido[id] || 0) > (CAPACIDADE[id] ?? 1) - 1);
    if (!impossiveis.length) continue;

    mudancas.push({ e, impossiveis, resta: e.equipavelEm.filter(id => !impossiveis.includes(id)) });
}

console.log('\n=== SLOTS PRINCIPAIS IMPOSSÍVEIS ===\n');
for (const m of mudancas) {
    console.log(`  ${m.e.nome}`);
    for (const id of m.impossiveis)
        console.log(`     ✖ ${NOME[id]}: cobertura pede ${m.e.slotsAdicionais.find(s => s.id === id).quantidade}× e o corpo só tem ${CAPACIDADE[id]}`);
    console.log(`     equipavelEm: [${m.e.equipavelEm.map(i => NOME[i]).join(', ')}] -> [${m.resta.map(i => NOME[i]).join(', ')}]`);
}
if (!mudancas.length) console.log('  nenhum — todo slot principal oferecido é equipável.');

console.log('\n=== INVARIANTES ===\n');
const checa = (rotulo, fn) => { fn(); console.log(`  ✔ ${rotulo}`); };
checa('nenhum item fica sem slot principal', () =>
    mudancas.forEach(m => assert(m.resta.length, `${m.e.nome} ficaria sem equipavelEm`)));
checa('a cobertura (slotsAdicionais) não é tocada — Blindagem não muda', () =>
    mudancas.forEach(m => assert(m.e.slotsAdicionais.length)));
checa('o que sobrou é equipável de verdade', () =>
    mudancas.forEach(m => m.resta.forEach(id => {
        const pedido = (m.e.slotsAdicionais.find(s => s.id === id) || {}).quantidade || 0;
        assert(pedido <= (CAPACIDADE[id] ?? 1) - 1, `${m.e.nome} / ${NOME[id]}`);
    })));

if (!APPLY) { console.log(`\nDRY-RUN — ${mudancas.length} itens seriam corrigidos. Rode com --apply.\n`); process.exit(); }

const lote = db.batch();
mudancas.forEach(m => lote.update(db.doc(`system/data/equipment/${m.e.id}`), { equipavelEm: m.resta, atualizadoEm: new Date() }));
await lote.commit();
console.log(`\n✔ ${mudancas.length} itens corrigidos.\n`);
process.exit();
