/**
 * Auditoria do cânone que a nova Wiki (Menu/Login) vai exibir:
 * livros do Cronista com pub.geral, seus capítulos e tamanhos.
 * node functions/_audit-canone-wiki.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const [bSnap, aSnap] = await Promise.all([
  db.collection('worldbuilding-books').get(),
  db.collection('worldbuilding-articles').get(),
]);
const livros = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const caps = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// mesma lógica de shared/livros-pub.js (legado: public=true → conhVinculo)
const pubDoLivro = l => {
  const p = l && l.pub;
  if (p && typeof p === 'object') return { geral: !!p.geral, conhGeral: !!p.conhGeral, conhVinculo: !!p.conhVinculo, mestre: !!p.mestre };
  return { geral: false, conhGeral: false, conhVinculo: !!(l && l.public), mestre: true };
};

const strip = h => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

console.log(`TOTAL: ${livros.length} livros, ${caps.length} capítulos\n`);
for (const l of livros) {
  const p = pubDoLivro(l);
  const meus = caps.filter(c => c.bookId === l.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const chars = meus.reduce((s, c) => s + strip(c.contentHTML || '').length, 0);
  const capImgs = meus.filter(c => /<img/i.test(String(c.contentHTML || ''))).length;
  const flags = ['geral', 'conhGeral', 'conhVinculo', 'mestre'].filter(k => p[k]).join(',') || 'nenhuma';
  console.log(`${p.geral ? '🌐' : '  '} [${flags}] "${l.title || l.id}" — ${meus.length} caps, ${(chars / 1000).toFixed(1)}k chars, capa:${l.cover ? 'sim' : 'não'}, capsComImg:${capImgs}`);
  if (p.geral) {
    for (const c of meus) {
      const t = strip(c.contentHTML || '');
      console.log(`     · "${c.title || c.id}" (${(t.length / 1000).toFixed(1)}k, status:${c.status || '-'}) ${t.slice(0, 90)}…`);
    }
  }
}

// Campos de um livro de exemplo (para saber o shape real)
if (livros[0]) console.log('\nCampos de livro:', Object.keys(livros[0]).join(', '));
if (caps[0]) console.log('Campos de capítulo:', Object.keys(caps[0]).join(', '));
process.exit(0);
