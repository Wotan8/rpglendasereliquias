/**
 * Cap. 6.5 do Livro de Regras do Jogador: o exemplo de dano ensinava a arredondar
 * a Blindagem (3,30 → 3). A Blindagem passou a ser fracionária (2 casas), então o
 * exemplo estava contradizendo a regra.
 *
 *   node functions/corrigir-arredondamento-livro.mjs            (dry-run)
 *   node functions/corrigir-arredondamento-livro.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const DE = 'O defensor veste uma Armadura Completa (3,30 → Blindagem 3). Dano final = 6 pontos de Vitalidade.';
const PARA = 'O defensor veste uma Armadura Completa (Blindagem 3,30). Dano final = 5,70 pontos de Vitalidade.';

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
const snap = await ref.get();
if (!snap.exists) { console.error('❌ art-regras-jogador-06 não existe.'); process.exit(1); }

const html = snap.data().contentHTML || '';
const ocorrencias = html.split(DE).length - 1;
console.log(`Ocorrências da frase: ${ocorrencias}`);
if (ocorrencias !== 1) {
    console.error('❌ Esperava exatamente 1 ocorrência. Abortando sem gravar.');
    process.exit(1);
}

console.log(`\n- ${DE}\n+ ${PARA}\n`);

if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await ref.update({ contentHTML: html.replace(DE, PARA), updatedAt: Date.now() });
console.log('✅ Gravado.');
process.exit(0);
