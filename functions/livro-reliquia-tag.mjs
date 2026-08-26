// =============================================
// Livro do Jogador, Cap. 5 — a isenção de Relíquia vale pela TAG também.
// Peça que é arma E relíquia fica no tipo Arma (para ter dano, categoria e
// slot de mão) e mesmo assim não quebra. Espelha ehReliquia do motor.
//
//   node functions/livro-reliquia-tag.mjs            (dry-run)
//   node functions/livro-reliquia-tag.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = '<p><strong>Relíquia não tem Integridade.</strong> Nenhuma. Não é peça de ferreiro: não lasca na Falha Crítica, não cede sob peso e não se conserta na bancada — onde as outras peças mostram um número, a Relíquia mostra um traço. O que limita uma Relíquia é a história dela e o preço de portá-la (seção 5.8), nunca o desgaste.</p>';
const PARA = '<p><strong>Relíquia não tem Integridade.</strong> Nenhuma. Não é peça de ferreiro: não lasca na Falha Crítica, não cede sob peso e não se conserta na bancada — onde as outras peças mostram um número, a Relíquia mostra um traço. O que limita uma Relíquia é a história dela e o preço de portá-la (seção 5.8), nunca o desgaste.</p>\n<p>Vale para toda peça marcada como Relíquia, <strong>mesmo quando ela também é outra coisa</strong>: uma adaga que é relíquia continua sendo adaga no combate — tem dano, categoria e ocupa a mão — e ainda assim não quebra. Relíquia não desgasta, esteja em que prateleira do catálogo estiver.</p>';

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const doc = await ref.get();
const html = doc.data().contentHTML;
const n = html.split(DE).length - 1;
if (n !== 1) { console.log(`❌ âncora aparece ${n}× (esperava 1) — nada gravado.`); process.exit(1); }
const novo = html.replace(DE, PARA);
const words = novo.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).length;
console.log(`✓ âncora encontrada · palavras: ${doc.data().words} → ${words}`);
if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
await ref.update({ contentHTML: novo, words, atualizadoEm: agora, updatedAt: agora });
console.log('✅ Capítulo 5 atualizado.');
process.exit(0);
