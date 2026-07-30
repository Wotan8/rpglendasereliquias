/**
 * Lista os "Recursos Avulsos" (items sem characterId) com todos os campos,
 * para decidir a migração pro catálogo system/data/equipment.
 * node functions/audit-avulsos.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection('items').get();
const avulsos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => !i.characterId);

const catalogo = (await db.collection('system/data/equipment').get()).docs.map(d => d.data().nome);
const norm = s => String(s || '').trim().toLowerCase();

console.log(`items total: ${snap.size}  |  avulsos (sem characterId): ${avulsos.length}\n`);

avulsos.sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || ''));

const chaves = new Set();
for (const i of avulsos) {
    const nome = i.name || i.nome || '(sem nome)';
    const jaTem = catalogo.find(c => norm(c) === norm(nome));
    console.log(`--- ${nome}  [${i.id}]${jaTem ? '   ⚠️ JÁ EXISTE NO CATÁLOGO' : ''}`);
    for (const [k, v] of Object.entries(i)) {
        if (k === 'id' || v === null || v === undefined || v === '') continue;
        chaves.add(k);
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        console.log(`      ${k}: ${s.replace(/\s+/g, ' ').slice(0, 220)}`);
    }
}

console.log(`\n########## CAMPOS USADOS ##########`);
console.log([...chaves].sort().join(', '));

const contar = campo => {
    const m = {};
    for (const i of avulsos) m[i[campo] ?? '(vazio)'] = (m[i[campo] ?? '(vazio)'] || 0) + 1;
    console.log(`${campo}: ` + Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
};
console.log(`\n########## DISTRIBUIÇÃO ##########`);
['tipo', 'category', 'categoriaArma', 'equipado', 'parentItemId'].forEach(contar);
process.exit();
