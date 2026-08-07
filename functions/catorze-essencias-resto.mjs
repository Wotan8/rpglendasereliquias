/**
 * Rabo do passe das catorze: a entrada da Essência Cinza-Claro (Vento) ainda
 * dizia "a mais responsiva ao som de todas as treze".
 *
 *   node functions/catorze-essencias-resto.mjs --dry-run
 *   node functions/catorze-essencias-resto.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const DRY = process.argv.includes('--dry-run');
const DE = 'é a mais responsiva ao som de todas as treze';
const PARA = 'é a mais responsiva ao som de todas as catorze';

const ref = db.doc('worldbuilding-articles/art-fluxomancia-13-essencias');
const html = (await ref.get()).data().contentHTML || '';
const n = html.split(DE).length - 1;
console.log(`ocorrências: ${n}`);
if (n !== 1) throw new Error(`esperava 1, achei ${n}`);

console.log(`${DRY ? '[dry-run] trocaria' : 'trocando'}: "${DE}" → "${PARA}"`);
if (DRY) { console.log('[dry-run] nada gravado'); process.exit(0); }

await ref.update({ contentHTML: html.replace(DE, PARA), updatedAt: Date.now(), updatedBy: 'igorestevamalvesdesouza@gmail.com' });

const conf = (await ref.get()).data().contentHTML;
const sobrou = (conf.match(/\btreze\b/gi) || []).length;
if (sobrou) throw new Error(`ainda sobraram ${sobrou}`);
console.log('✅ nenhum "treze" no compêndio');
process.exit(0);
