/**
 * Exporta os livros pub.geral (o cânone público da Wiki) para JSON,
 * para alimentar o protótipo do novo Portal.
 * node functions/_export-wiki-json.mjs <destino.json>
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const [bSnap, aSnap] = await Promise.all([
  db.collection('worldbuilding-books').get(),
  db.collection('worldbuilding-articles').get(),
]);
const pubGeral = l => l.pub && typeof l.pub === 'object' && !!l.pub.geral;
const livros = bSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(pubGeral);
const caps = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const out = livros.map(l => ({
  id: l.id,
  title: l.title || '',
  description: l.description || '',
  cover: l.cover || '',
  order: l.order ?? 0,
  capitulos: caps
    .filter(c => c.bookId === l.id && c.status === 'publicado')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => ({
      id: c.id, title: c.title || '', synopsis: c.synopsis || '',
      order: c.order ?? 0, words: c.words ?? 0, contentHTML: c.contentHTML || '',
    })),
}));

const dest = process.argv[2] || 'wiki-export.json';
writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');
console.log(`${out.length} livro(s), ${out.reduce((s, l) => s + l.capitulos.length, 0)} capítulos → ${dest}`);
process.exit(0);
