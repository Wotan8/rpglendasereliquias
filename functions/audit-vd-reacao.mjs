/**
 * O VD "Reação" saiu das regras no combate v3 (virou "Defesa da rodada").
 * Antes de apagar o doc, checa se alguém ainda aponta pra ele.
 * node functions/audit-vd-reacao.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const SYS = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics', 'skills', 'conditions',
    'equipment', 'maneuvers', 'spells', 'derivedValues', 'vitalStats', 'auras', 'itemRules',
    'bodyParts', 'runicElements', 'classModules'];
const TOP = ['characters', 'char', 'npcs', 'items', 'mesas', 'campaigns', 'containers',
    'worldbuilding-books', 'worldbuilding-articles', 'loja_itens'];

const vds = await db.collection('system/data/derivedValues').get();
const alvos = vds.docs.filter(d => /^rea[çc][ãa]o$/i.test((d.data().nome || '').trim()));

if (!alvos.length) {
    console.log('Nenhum VD chamado "Reação" no banco. Nada a fazer.');
    process.exit(0);
}

for (const d of alvos) {
    const v = d.data();
    console.log(`\n=== VD "${v.nome}"  id=${d.id}  key=${v.key}  publicado=${v.publicado} ===`);
    console.log(JSON.stringify(v, null, 2).slice(0, 1200));
}

const ids = alvos.map(d => d.id);
const keys = alvos.map(d => d.data().key).filter(Boolean);
const agulhas = [...ids, ...keys];

console.log(`\nProcurando referências a: ${agulhas.join(', ')}\n`);

let achou = 0;
for (const col of [...SYS.map(c => `system/data/${c}`), ...TOP]) {
    let snap;
    try { snap = await db.collection(col).get(); } catch { continue; }
    for (const doc of snap.docs) {
        if (ids.includes(doc.id) && col === 'system/data/derivedValues') continue; // o próprio doc
        const txt = JSON.stringify(doc.data());
        const hits = agulhas.filter(a => txt.includes(a));
        if (hits.length) {
            achou++;
            const d = doc.data();
            console.log(`⚠️ ${col}/${doc.id}  "${d.nome || d.name || ''}"  → ${hits.join(', ')}`);
        }
    }
}

console.log(achou === 0
    ? '\n✅ ÓRFÃO: ninguém referencia o VD Reação. Pode apagar.'
    : `\n❌ ${achou} referência(s). NÃO apagar sem limpar antes.`);
process.exit(0);
