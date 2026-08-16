/**
 * 🎼 Qualidade 1 em todo instrumento do catálogo.
 *
 * A área que um instrumento enche é um múltiplo da Qualidade da peça
 * (shared/instrumento-area.js: percussão 2×, corda 3×, sopro 4×). Os 11
 * instrumentos estavam sem Qualidade nenhuma, então toda Sonoromancia saía
 * com 0 m de alcance.
 *
 * Decisão de mesa (16/08/2026): a Qualidade INICIAL é 0, e nenhum item do
 * jogo passa de 1. A área usa (Qualidade + 1), então a peça inicial já soa —
 * ver shared/instrumento-area.js.
 *
 * Grava a STRING '1', não o número: o campo é um `select` no Painel do Criador
 * (shared/equip-campos.js) e compara `valores[key] === o.value`, que são
 * strings. Número faria o select abrir em branco.
 *
 * As INSTÂNCIAS na mão dos personagens ficam como estão, de propósito: elas
 * têm `qualidade: null`, e o leitor usa `instancia ?? modelo` — herdam o
 * catálogo. Gravar nelas congelaria o valor e uma correção futura no modelo
 * não chegaria mais.
 *
 *   node functions/instrumentos-qualidade.mjs            (dry-run)
 *   node functions/instrumentos-qualidade.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const QUALIDADE = '0';

const ehInstrumento = (o) => (o.tags || []).some(t => /^instrumento$/i.test(String(t).trim()));
const familia = (o) => ((o.tags || []).find(t => /^(sopro|corda|percuss)/i.test(String(t).trim())) || '—');

const snap = await db.collection('system/data/equipment').get();
const lote = db.batch();
let n = 0, semFamilia = [];

console.log('='.repeat(62));
console.log('Qualidade dos instrumentos' + (APPLY ? ' — GRAVANDO' : ' — DRY-RUN'));
console.log('='.repeat(62));

for (const d of snap.docs) {
    const i = d.data();
    if (!ehInstrumento(i)) continue;
    const f = familia(i);
    if (f === '—') semFamilia.push(i.nome);
    if (String(i.qualidade ?? '') === QUALIDADE) { console.log(`  = ${i.nome}: já está em ${QUALIDADE}`); continue; }
    console.log(`  ${String(i.nome).padEnd(24)} ${String(f).padEnd(11)} qualidade ${JSON.stringify(i.qualidade)} → '${QUALIDADE}'`);
    lote.update(d.ref, { qualidade: QUALIDADE });
    n++;
}

if (semFamilia.length) {
    console.log(`\n⚠️ sem tag de família (não viram área): ${semFamilia.join(', ')}`);
}
console.log(`\n${n} instrumento(s) a atualizar.`);
if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
if (n) await lote.commit();
console.log('✅ gravado.');
process.exit(0);
