/**
 * Duas decisões do dono do mundo, num script:
 *
 *  1. METANOX — opção A. A escada vira:
 *       P≥1  Lento por 1 cena ............................. 0,50
 *       P≥2  também −1 no Alvo de todos os testes, 1 cena .. 1,35  ← Entorpecente
 *       P≥3  também Atordoado por 1 turno .................. 2,67
 *     P1 continua na âncora (0,50/ponto); P2 é o 1,35× aprovado; P3 fica ACIMA
 *     do teto de 2,00 por dose — aceito e declarado: exige soma 3 (mandrágora +
 *     comum), o Macerar 3 corta doses, e é o tier da paralisia. Monitorar.
 *
 *  2. Compêndio de Cristalomancia sai do rascunho: livro e 5 capítulos públicos.
 *
 *   node functions/alquimancia-metanox-a.mjs            (dry-run)
 *   node functions/alquimancia-metanox-a.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const colArts = db.collection('worldbuilding-articles');

/* ── 1a. capítulo público "As Oito da Bancada" ── */
const OITO_DE = '<td><strong>Metanox</strong></td><td>Sensorial</td><td>Lento por 1 cena; com P 3 ou mais, também Atordoado por 1 turno</td>';
const OITO_PARA = '<td><strong>Metanox</strong></td><td>Sensorial</td><td>Lento por 1 cena; com P 2 ou mais, também −1 no Alvo de todos os testes por 1 cena; com P 3 ou mais, também Atordoado por 1 turno</td>';

/* ── 1b. Régua cap. 8: conferência + remoção do [A DEFINIR] ── */
const CONF_DE = '<tr><td>Entorpecente (Metanox 2)</td><td>0,50</td><td><strong>0,50× 🔵</strong></td></tr>';
const CONF_PARA = '<tr><td>Entorpecente (Metanox 2)</td><td>1,35</td><td>1,35× ✅</td></tr>';
const DEFINIR_DE = '<p><strong>[A DEFINIR]</strong> — Metanox 2 não sustenta uma dose (Lento vale 0,10/rodada). Opção A: Metanox passa a dar Lento e −1 no Alvo por 1 cena (→ 1,35×). Opção B: a receita Entorpecente exige potência 4 (→ 1,82×, loção avançada). Recomendação registrada: A.</p>';
const DEFINIR_PARA = '<p><strong>Decidido — opção A.</strong> A escada do Metanox: P1 = Lento (0,50, na âncora) · P2 = também −1 no Alvo por 1 cena (1,35) · P3 = também Atordoado (2,67). <strong>P3 excede o teto de 2,00 por dose</strong> — aceito e declarado: exige soma 3 de ingrediente incomum, e Macerar 3 derruba a fornada. Se na mesa a loção P3 dominar, o corte é o −1 no Alvo deixar de empilhar com o Atordoado.</p>';

const [alq8, regua8, livroCris, capsCris] = await Promise.all([
    colArts.where('title', '==', 'As Oito da Bancada').get(),
    colArts.where('title', '==', '8 — Régua da Alquimancia').get(),
    db.collection('worldbuilding-books').doc('book-cristalomancia').get(),
    colArts.where('bookId', '==', 'book-cristalomancia').get(),
]);

const erros = [];
const oito = alq8.docs[0], regua = regua8.docs[0];
if (!oito) erros.push('capítulo "As Oito da Bancada" não achado');
if (!regua) erros.push('capítulo 8 da Régua não achado');
if (!livroCris.exists) erros.push('book-cristalomancia não achado');

const hOito = oito ? String(oito.data().contentHTML || '') : '';
const hRegua = regua ? String(regua.data().contentHTML || '') : '';
for (const [rot, html, de] of [['Oito/Metanox', hOito, OITO_DE], ['Régua/conferência', hRegua, CONF_DE], ['Régua/[A DEFINIR]', hRegua, DEFINIR_DE]]) {
    if (html && html.split(de).length - 1 !== 1) erros.push(`âncora não única: ${rot}`);
}

console.log('=== Metanox opção A + publicação da Cristalomancia ===\n');
console.log('  ~ As Oito da Bancada: Metanox ganha o degrau P≥2 (−1 no Alvo, 1 cena)');
console.log('  ~ Régua §8.6: Entorpecente 0,50× 🔵 → 1,35× ✅ · [A DEFINIR] vira decisão registrada');
console.log(`  ~ Cristalomancia: livro público + ${capsCris.docs.length} capítulos publicados`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Âncoras únicas conferidas.');
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
batch.update(colArts.doc(oito.id), { contentHTML: hOito.replace(OITO_DE, OITO_PARA), updatedAt: agora });
batch.update(colArts.doc(regua.id), {
    contentHTML: hRegua.replace(CONF_DE, CONF_PARA).replace(DEFINIR_DE, DEFINIR_PARA), updatedAt: agora });
batch.update(db.collection('worldbuilding-books').doc('book-cristalomancia'), { public: true, updatedAt: agora });
for (const c of capsCris.docs) batch.update(colArts.doc(c.id), { public: true, status: 'publicado', updatedAt: agora });
await batch.commit();
console.log('\n✅ Gravado.');
process.exit(0);
