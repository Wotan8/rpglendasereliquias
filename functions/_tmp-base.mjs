import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const strip = h => (h||'')
  .replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi,'\n').replace(/<\/t[dh]>/gi,' | ')
  .replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n{3,}/g,'\n\n');

const r = (await db.collection('worldbuilding-articles').doc('8aLc6aTVahCWswWdhngK').get()).data();
const i = r.contentHTML.indexOf('0.3 A unidade');
console.log('======== RÉGUA §0.1–0.2 ========');
console.log(strip(r.contentHTML.slice(0, i)));

const c6 = (await db.collection('worldbuilding-articles').doc('art-regras-jogador-06').get()).data();
const a = c6.contentHTML.indexOf('<h2>6.3'), b = c6.contentHTML.indexOf('<h2>6.5');
console.log('\n======== LIVRO cap.6 §6.3–6.4 (v3) ========');
console.log(strip(c6.contentHTML.slice(a, b)));
process.exit(0);
