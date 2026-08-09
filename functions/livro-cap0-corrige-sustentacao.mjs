/**
 * Régua de Balanceamento, cap. 0.5 — corrige o que eu escrevi errado sobre
 * sustentação.
 *
 * ERRADO (gravado por engano): "habilidade que exige manter ritmo consome 1 Ação
 * Padrão por turno enquanto durar — −1,00 por rodada a descontar".
 *
 * CERTO: a Ação Padrão SÓ ACIONA a habilidade. Sustentar não custa ação. Se a
 * magia se mantém, é porque o custo em recurso já pagou por isso.
 *
 * Consequência: a régua estava certa desde o começo. Duração é componente do
 * efeito e é paga pelo recurso, não por ação recorrente. As seis canções
 * sustentadas do Bardo NÃO estão no vermelho, e o [A DEFINIR] sobre o DPR do
 * Bardo deixa de existir.
 *
 *   node functions/livro-cap0-corrige-sustentacao.mjs            (dry-run)
 *   node functions/livro-cap0-corrige-sustentacao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const col = db.collection('worldbuilding-articles');
const docs = (await col.where('bookId', '==', 'book-regua-balanceamento').get()).docs;
const alvo = docs.find(d => /^0 —/.test(d.data().title || ''));
if (!alvo) { console.error('🔴 ABORTADO: capítulo 0 não encontrado.'); process.exit(1); }
const original = alvo.data().contentHTML || '';

const DE = `<h3>Sustentação</h3>
<p>Habilidade que exige "manter ritmo" ou vale "enquanto tocar" consome <strong>1 Ação Padrão por turno</strong> enquanto durar. Isso é <strong>−1,00 por rodada</strong> que a régua precisa descontar do valor entregue — o conjurador não está atacando.</p>
<p>Consequência prática: uma canção sustentada só se paga se o que ela dá ao grupo superar o que o conjurador deixa de fazer sozinho. <strong>[A DEFINIR]</strong> — o DPR de referência de um Bardo, que é o que decide se as seis canções sustentadas do repertório estão no positivo.</p>`;

const PARA = `<h3>Sustentação não custa ação</h3>
<blockquote><p>A Ação Padrão <strong>só aciona</strong> a habilidade. Manter não custa nada.</p></blockquote>
<p>Se uma magia se sustenta — "enquanto tocar", "manter ritmo", "pela cena" — é porque o <strong>custo em recurso já pagou por isso</strong>. Não há ação recorrente a descontar.</p>
<p>Para a régua isso significa que <strong>duração é componente do efeito</strong> (§1.3), paga pelo recurso gasto na conjuração, exatamente como magnitude e alvos. Uma canção que dura a cena entrega cinco rodadas de efeito por um pagamento só, e é isso que justifica ela custar mais que uma de efeito instantâneo.</p>
<p>Descontar sustentação como se fosse ação por turno colocaria toda habilidade de duração no vermelho e é <strong>erro</strong>.</p>`;

if (!original.includes(DE)) { console.error('🔴 ABORTADO: trecho errado não encontrado — o texto já mudou.'); process.exit(1); }
const html = original.replace(DE, PARA);

console.log('=== Correção: sustentação ===\n');
console.log('  ERRADO: "manter ritmo consome 1 Ação Padrão por turno · −1,00 por rodada"');
console.log('  CERTO:  a Ação Padrão só aciona; sustentar vem do custo já pago\n');
console.log(`  ${original.length} → ${html.length} chars`);
const deveTer = ['só aciona', 'custo em recurso já pagou'];
const naoDeveTer = ['1 Ação Padrão por turno', '[A DEFINIR]</strong> — o DPR de referência de um Bardo'];
const falhas = [...deveTer.filter(s => !html.includes(s)).map(s => `faltou "${s}"`),
                ...naoDeveTer.filter(s => html.includes(s)).map(s => `sobrou "${s}"`)];
if (falhas.length) { console.error('\n🔴 auto-verificação falhou:\n  ' + falhas.join('\n  ')); process.exit(1); }
console.log('  ✅ auto-verificação passou.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await col.doc(alvo.id).update({ contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
console.log('\n✅ Gravado.');
process.exit(0);
