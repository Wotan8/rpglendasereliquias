// =============================================
// Livro do Jogador, Cap. 5 — relíquia é MARCA, não tipo (26/08/2026).
// Espelha o campo ehReliquia da spec e ehReliquia() do motor.
//
//   node functions/livro-reliquia-marca.mjs            (dry-run)
//   node functions/livro-reliquia-marca.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = '<p>Vale para toda peça marcada como Relíquia, <strong>mesmo quando ela também é outra coisa</strong>: uma adaga que é relíquia continua sendo adaga no combate — tem dano, categoria e ocupa a mão — e ainda assim não quebra. Relíquia não desgasta, esteja em que prateleira do catálogo estiver.</p>';
const PARA = '<p><strong>Relíquia não é um tipo de item — é uma marca que qualquer item pode ter.</strong> Uma adaga que é relíquia continua sendo adaga: tem dano, tem categoria, ocupa a mão, e mesmo assim não quebra. Uma armadura relíquia veste e protege como qualquer outra, e não cede. Um espelho relíquia é um objeto que você segura. O que a marca faz é uma coisa só, e definitiva: aquela peça não tem Integridade.</p>';

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
