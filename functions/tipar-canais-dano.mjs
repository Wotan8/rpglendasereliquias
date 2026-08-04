/**
 * Marca os 13 Danos por Essência com escopoItem: 'dano-canal'.
 *
 * Sem isso o motor não consegue separá-los do Dano genérico: em
 * item-scope-calc.js todo escopoItem 'dano' caía num acumulador único, então
 * "1d10 + Dano 2 + Vermelha 4 + Verde 2" virava "1d10+8" e a Blindagem física
 * do alvo absorvia o elemental inteiro.
 *
 * Distinguir por nome ou por `todoPersonagem` funcionaria hoje e quebraria
 * calado no dia que alguém cadastrar um bônus de dano condicional. O tipo é
 * explícito de propósito.
 *
 *   node tipar-canais-dano.mjs            # dry-run
 *   node tipar-canais-dano.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');

const ESSENCIAS = ['Cinza', 'Azul-Claro', 'Azul', 'Púrpura', 'Verde', 'Rosa',
  'Amarela', 'Vermelha', 'Marrom', 'Branca', 'Prateada', 'Preta', 'Dourada'];
const ALVOS = new Set(ESSENCIAS.map(c => `dano ${c}`.toLowerCase()));

const snap = await db.collection('system/data/derivedValues').get();
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const canais = docs.filter(d => ALVOS.has(String(d.nome || '').toLowerCase()));
const pendentes = canais.filter(d => d.escopoItem !== 'dano-canal');

console.log(`\n${canais.length}/13 canais encontrados · ${pendentes.length} a atualizar\n`);
for (const d of canais) {
  const marca = d.escopoItem === 'dano-canal' ? 'ok' : `${JSON.stringify(d.escopoItem)} → "dano-canal"`;
  console.log(`   ${d.nome.padEnd(22)} ${marca}`);
}

if (canais.length !== 13) {
  console.log('\n🔴 Esperava 13 canais. Confira os nomes antes de gravar.');
  process.exit(1);
}

// O Dano genérico continua 'dano': ele é a parcela física do golpe.
const generico = docs.find(d => d.nome === 'Dano');
console.log(`\n   Dano (genérico) segue como ${JSON.stringify(generico?.escopoItem)} — parcela física, correto.`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(); }

const batch = db.batch();
for (const d of pendentes) {
  batch.update(db.doc(`system/data/derivedValues/${d.id}`), { escopoItem: 'dano-canal', updatedAt: new Date() });
}
await batch.commit();
console.log(`\n✅ ${pendentes.length} canais tipados.`);
process.exit();
