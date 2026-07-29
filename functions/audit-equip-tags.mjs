/**
 * Lista todo o equipamento cadastrado com tipo, tags e campos relevantes.
 * node functions/audit-equip-tags.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection('system/data/equipment').get();
const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const porTipo = {};
for (const i of itens) (porTipo[i.tipo || '(sem tipo)'] ||= []).push(i);

for (const [tipo, arr] of Object.entries(porTipo).sort()) {
  console.log(`\n########## ${tipo} (${arr.length}) ##########`);
  for (const i of arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))) {
    console.log(`- ${i.nome}  [${i.id}]`);
    console.log(`    tags: ${(i.tags || []).join(', ') || '—'}`);
    console.log(`    equipavelEm: ${JSON.stringify(i.equipavelEm) || '—'}  forma: ${i.formaEquipar || '—'}  catArma: ${i.categoriaArma || '—'}`);
    console.log(`    peso: ${i.peso ?? '—'}  tam: ${i.tamanho ?? '—'}  pressao: ${i.pressaoBase ?? '—'}  liga: ${i.liga ?? '—'}  preco: ${i.preco ?? '—'}`);
    console.log(`    desc: ${(i.descricao || '').replace(/\s+/g, ' ').slice(0, 200)}`);
  }
}

const tagCount = {};
for (const i of itens) for (const t of i.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
console.log(`\n\n########## TAGS EM USO (${Object.keys(tagCount).length}) ##########`);
for (const [t, n] of Object.entries(tagCount).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(3)}x  ${t}`);
console.log(`\nTotal de itens: ${itens.length}`);
process.exit();
