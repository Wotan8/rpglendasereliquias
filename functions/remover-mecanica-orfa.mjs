/**
 * Varre o banco atrás de QUALQUER referência a uma mecânica e só then apaga.
 * Uso: node functions/remover-mecanica-orfa.mjs <mechId> [--write]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MECH_ID = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!MECH_ID) { console.log('Falta o id da mecânica.'); process.exit(1); }

const alvo = await db.doc(`system/data/mechanics/${MECH_ID}`).get();
if (!alvo.exists) { console.log(`❌ Mecânica ${MECH_ID} não existe.`); process.exit(1); }
console.log(`Alvo: "${alvo.data().nome}"  [${MECH_ID}]\n`);

/** Procura o id em qualquer profundidade do doc (string solta, array ou campo). */
function contemId(node) {
    if (node === MECH_ID) return true;
    if (Array.isArray(node)) return node.some(contemId);
    if (node && typeof node === 'object') return Object.values(node).some(contemId);
    return false;
}

const refs = [];

// 1) Todas as coleções de system/data
const subs = await db.doc('system/data').listCollections();
for (const col of subs) {
    if (col.id === 'mechanics') continue;
    const snap = await col.get();
    for (const d of snap.docs) {
        if (contemId(d.data())) refs.push(`system/data/${col.id} → ${d.data().nome || d.id} [${d.id}]`);
    }
}

// 2) Outras mecânicas podem encadear esta (gatilhos, condicional)
const mechs = await db.collection('system/data/mechanics').get();
for (const d of mechs.docs) {
    if (d.id !== MECH_ID && contemId(d.data())) refs.push(`mecânica encadeada → ${d.data().nome || d.id} [${d.id}]`);
}

// 3) Personagens e os itens deles
const chars = await db.collection('characters').get();
console.log(`Personagens verificados: ${chars.size}`);
for (const c of chars.docs) {
    if (contemId(c.data())) refs.push(`characters/${c.id} (${c.data().nome || '?'}) — no doc`);
    for (const sub of await c.ref.listCollections()) {
        const s = await sub.get();
        for (const d of s.docs) {
            if (contemId(d.data())) refs.push(`characters/${c.id}/${sub.id} → ${d.data().nome || d.id}`);
        }
    }
}

console.log(`\n########## REFERÊNCIAS (${refs.length}) ##########`);
refs.forEach(r => console.log('  ' + r));

if (refs.length) {
    console.log('\n⛔ NÃO está órfã — nada foi apagado.');
    process.exit(1);
}
console.log('  (nenhuma) — órfã confirmada.');

if (WRITE) { await alvo.ref.delete(); console.log('\n🗑️  Apagada.'); }
else console.log('\n(dry-run — rode com --write para apagar)');
process.exit();
