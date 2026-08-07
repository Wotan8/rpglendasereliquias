/**
 * Sangue virou a décima quarta Essência: o catálogo agora tem 14 Blindagens
 * por Essência e 14 canais de dano. A Régua §2.3 ainda dizia 13.
 * Livro técnico (não público) — só o número muda, a regra é a mesma.
 *
 *   node functions/regua-14-blindagens.mjs --dry-run
 *   node functions/regua-14-blindagens.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const DRY = process.argv.includes('--dry-run');
const DE = 'As 13 Blindagens por Essência';
const PARA = 'As 14 Blindagens por Essência';

// o número no texto tem que bater com o catálogo de verdade
const vds = await db.collection('system/data/derivedValues').get();
const nBlind = vds.docs.filter(d => d.data().blocoId === 'blindagem-essencia').length;
console.log(`catálogo: blindagem-essencia=${nBlind}`);
if (nBlind !== 14) throw new Error(`o texto vai dizer 14 mas o catálogo tem ${nBlind}`);

const ref = db.doc('worldbuilding-articles/i2AF7A437sW2xkcpypiC');
const snap = await ref.get();
const x = snap.data();
if (x.public) throw new Error('esse artigo deveria ser do livro técnico (não público)');

const html = x.contentHTML || '';
const n = html.split(DE).length - 1;
console.log(`"${DE}" — ocorrências: ${n}`);
if (n !== 1) throw new Error(`esperava 1 ocorrência, achei ${n}`);

// varredura de segurança: outros "13" soltos no mesmo capítulo
const outros = [...html.matchAll(/.{60}\b(13|treze)\b.{60}/gis)].map(m => m[0].replace(/<[^>]+>/g, ''));
console.log(`outros "13/treze" no capítulo: ${outros.length - 1}`);
outros.forEach(o => { if (!o.includes(DE)) console.log(`   ⚠ ...${o.trim()}...`); });

const novo = html.replace(DE, PARA);
console.log(`\n${DRY ? '[dry-run] trocaria' : 'trocando'}: "${DE}" → "${PARA}"`);
if (!DRY) {
  await ref.update({ contentHTML: novo, updatedAt: Date.now(), updatedBy: 'igorestevamalvesdesouza@gmail.com' });
  const conf = (await ref.get()).data().contentHTML;
  if (conf.includes(DE) || !conf.includes(PARA)) throw new Error('pós-conferência falhou');
  console.log('✅ §2.3 diz 14');
} else {
  console.log('[dry-run] nada gravado');
}
process.exit(0);
