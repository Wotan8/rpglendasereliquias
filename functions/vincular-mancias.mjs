/**
 * Vincula cada Compêndio de mancia à classe que usa aquela mancia.
 * O livro inteiro fica visível (capituloIds: [] = todos os capítulos).
 *
 * A dupla livro↔classe sai do próprio cadastro: o nome da mancia aparece
 * na `especialidade` da classe e no título do livro ("Compêndio de X").
 *
 *   node functions/vincular-mancias.mjs           → só mostra o plano
 *   node functions/vincular-mancias.mjs --apply   → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');

const norm = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const chapters = (await db.collection('worldbuilding-articles').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const classes = (await db.collection('system/data/classes').get()).docs.map(d => ({ id: d.id, ...d.data() }));

// "Compêndio de Runomancia" → "runomancia"
const mancias = books
  .map(b => ({ book: b, mancia: (norm(b.title).match(/([a-z]+mancia)/) || [])[1] }))
  .filter(x => x.mancia);

// A classe da Abismancia não usa a palavra em lugar nenhum do cadastro
// ("Invocação Abissal"), então esta é a única ponte feita à mão.
const PONTE = { abismancia: 'Invocador do Abismo' };

const plano = [];
for (const { book, mancia } of mancias) {
  // Uma mancia pode ser usada por mais de uma classe (Alquimancia: Druida e Caçador).
  let usam = classes.filter(c => norm(`${c.especialidade} ${c.arquetipo} ${c.descricao}`).includes(mancia));
  if (!usam.length && PONTE[mancia]) usam = classes.filter(c => c.nome === PONTE[mancia]);
  if (!usam.length) { console.log(`⚠️  "${book.title}": nenhuma classe cita ${mancia} — pulado`); continue; }
  for (const cls of usam) plano.push({ cls, book, mancia, caps: chapters.filter(c => c.bookId === book.id).length });
}

console.log(`\n===== PLANO (${plano.length} vínculos) =====`);
for (const p of plano) {
  const antes = p.cls.livroVinculado?.bookId;
  console.log(`• ${p.cls.nome.padEnd(22)} → "${p.book.title}" (${p.caps} cap., livro inteiro)` +
    `${antes ? `   [substitui ${antes}]` : ''}${p.book.public === true ? '' : '   ⚠️ livro NÃO público no Cronista'}`);
}
const semLivro = classes.filter(c => !plano.some(p => p.cls.id === c.id));
console.log(`\nSem mancia (ficam sem livro): ${semLivro.map(c => c.nome).join(', ') || '—'}`);

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(); }

for (const p of plano) {
  await db.doc(`system/data/classes/${p.cls.id}`).update({
    livroVinculado: { bookId: p.book.id, capituloIds: [] },
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log(`✅ ${p.cls.nome} → ${p.book.title}`);
}
console.log(`\n${plano.length} classe(s) atualizada(s).`);
process.exit();
