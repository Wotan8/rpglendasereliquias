/**
 * Procura strings de tag em QUALQUER lugar do banco antes de apagá-las.
 * Varre todas as coleções de system/data em profundidade (string solta, dentro
 * de array, aninhada em config) + personagens e subcoleções.
 *
 * node functions/scan-uso-tags.mjs "Tag A" "Tag B" ...
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ALVOS = process.argv.slice(2);
if (!ALVOS.length) { console.log('Passe as tags a procurar.'); process.exit(1); }

/** Onde a string aparece, com o caminho até ela. */
function achar(node, alvo, caminho = '') {
    const hits = [];
    if (typeof node === 'string') {
        if (node === alvo) hits.push(caminho || '(raiz)');
        return hits;
    }
    if (Array.isArray(node)) {
        node.forEach((v, i) => hits.push(...achar(v, alvo, `${caminho}[${i}]`)));
        return hits;
    }
    if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) hits.push(...achar(v, alvo, caminho ? `${caminho}.${k}` : k));
    }
    return hits;
}

const usos = Object.fromEntries(ALVOS.map(t => [t, []]));

const subs = await db.doc('system/data').listCollections();
for (const col of subs) {
    const snap = await col.get();
    for (const d of snap.docs) {
        for (const alvo of ALVOS) {
            for (const caminho of achar(d.data(), alvo)) {
                // O próprio campo tags do equipamento é a definição, não uso.
                const definicao = col.id === 'equipment' && caminho.startsWith('tags[');
                usos[alvo].push({ col: col.id, nome: d.data().nome || d.id, caminho, definicao });
            }
        }
    }
}

const chars = await db.collection('characters').get();
for (const c of chars.docs) {
    for (const sub of await c.ref.listCollections()) {
        for (const d of (await sub.get()).docs) {
            for (const alvo of ALVOS) {
                for (const caminho of achar(d.data(), alvo)) {
                    usos[alvo].push({ col: `characters/${sub.id}`, nome: d.data().nome || d.id, caminho, definicao: caminho.startsWith('tags[') });
                }
            }
        }
    }
}

console.log(`coleções de system/data varridas: ${subs.length}  |  personagens: ${chars.size}\n`);
for (const alvo of ALVOS) {
    const todos = usos[alvo];
    const reais = todos.filter(u => !u.definicao);
    console.log(`### "${alvo}" — ${todos.length} ocorrência(s), ${reais.length} fora do campo tags`);
    if (!todos.length) { console.log('   (não aparece em lugar nenhum)\n'); continue; }
    const defs = todos.filter(u => u.definicao);
    if (defs.length) console.log(`   definida em: ${defs.map(d => `${d.nome} (${d.col})`).join(', ')}`);
    if (reais.length) reais.forEach(u => console.log(`   ⚠️ USO REAL: ${u.col} → ${u.nome} @ ${u.caminho}`));
    else console.log('   ✅ nenhum uso real — só a definição no item');
    console.log('');
}
process.exit();
