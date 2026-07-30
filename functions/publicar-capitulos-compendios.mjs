/**
 * Marca como 🌐 público cada capítulo dos Compêndios de mancia que ainda
 * não tem regra de Conhecimento. Capítulo COM regra não é tocado — lá quem
 * manda é a trava cadastrada no Painel do Criador.
 *
 *   node functions/publicar-capitulos-compendios.mjs           → só mostra o plano
 *   node functions/publicar-capitulos-compendios.mjs --apply   → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');

const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const chapters = (await db.collection('worldbuilding-articles').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const regras = (await db.collection('system/data/knowledge').get()).docs.map(d => ({ id: d.id, ...d.data() }));

const compendios = books.filter(b => /mancia/i.test(b.title || ''));
const temRegra = (capId) => regras.some(r => r.capituloId === capId);

// Livro que já é curado por regras de Conhecimento fica INTEIRO de fora:
// lá o critério de quem lê o quê é a trava cadastrada, não o flag público.
// (Hoje é só o de Runomancia.)
const plano = [], pulados = [];
for (const b of compendios) {
  const caps = chapters.filter(x => x.bookId === b.id);
  const curado = caps.some(c => temRegra(c.id));
  for (const c of caps) {
    if (c.public === true) continue;
    (curado ? pulados : plano).push({ book: b, cap: c, motivo: curado ? 'livro curado por regras' : '' });
  }
}

console.log(`===== A PUBLICAR (${plano.length} capítulos) =====`);
for (const p of plano) console.log(`• ${p.book.title.padEnd(28)} → "${p.cap.title || 'Sem título'}"`);
console.log(`\n===== INTOCADOS (${pulados.length}) =====`);
for (const p of pulados) console.log(`• ${p.book.title.padEnd(28)} → "${p.cap.title || 'Sem título'}"  [${temRegra(p.cap.id) ? 'tem regra' : p.motivo}]`);

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(); }

for (const p of plano) {
  await db.doc(`worldbuilding-articles/${p.cap.id}`).update({ public: true });
  console.log(`✅ ${p.book.title} → ${p.cap.title || 'Sem título'}`);
}
console.log(`\n${plano.length} capítulo(s) publicado(s).`);
process.exit();
