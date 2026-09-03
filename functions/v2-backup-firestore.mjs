/**
 * Backup COMPLETO do Firestore para uma pasta local (todas as coleções, recursivo).
 *
 *   node functions/v2-backup-firestore.mjs "D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03"
 *
 * Grava um JSON por coleção (raiz ou aninhada, ex.: system__data__skills.json),
 * um MANIFEST.json com contagens, e copia firestore.rules e storage.rules.
 * Só leitura no banco.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const DEST = process.argv[2];
if (!DEST) { console.error('uso: node functions/v2-backup-firestore.mjs "<pasta destino>"'); process.exit(1); }
mkdirSync(DEST, { recursive: true });

const ser = v => {
    if (v === null || v === undefined) return v;
    if (v instanceof admin.firestore.Timestamp) return { __ts: v.toMillis() };
    if (v instanceof admin.firestore.DocumentReference) return { __ref: v.path };
    if (v instanceof admin.firestore.GeoPoint) return { __geo: [v.latitude, v.longitude] };
    if (Buffer.isBuffer(v)) return { __bytes: v.toString('base64') };
    if (Array.isArray(v)) return v.map(ser);
    if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = ser(v[k]); return o; }
    return v;
};

const manifest = { geradoEm: new Date().toISOString(), colecoes: {} };
let totalDocs = 0;

async function dumpCollection(colRef) {
    const path = colRef.path;
    const snap = await colRef.get();
    const docs = {};
    for (const d of snap.docs) {
        docs[d.id] = ser(d.data());
        totalDocs++;
        const subs = await d.ref.listCollections();
        for (const s of subs) await dumpCollection(s);
    }
    // documentos "fantasma" (só com subcoleções) não aparecem em get(); listDocuments cobre
    const all = await colRef.listDocuments();
    for (const ref of all) {
        if (docs[ref.id] !== undefined) continue;
        const subs = await ref.listCollections();
        if (subs.length) { docs[ref.id] = { __somenteSubcolecoes: true }; for (const s of subs) await dumpCollection(s); }
    }
    const file = path.replace(/\//g, '__') + '.json';
    writeFileSync(join(DEST, file), JSON.stringify(docs, null, 1), 'utf8');
    manifest.colecoes[path] = Object.keys(docs).length;
    console.log(`${path}: ${Object.keys(docs).length} docs`);
}

const roots = await db.listCollections();
for (const c of roots) await dumpCollection(c);
manifest.totalDocumentos = totalDocs;
writeFileSync(join(DEST, 'MANIFEST.json'), JSON.stringify(manifest, null, 1), 'utf8');
for (const f of ['firestore.rules', 'storage.rules', 'firebase.json']) {
    const src = new URL('../' + f, import.meta.url);
    if (existsSync(src)) copyFileSync(src, join(DEST, f));
}
console.log(`\nTOTAL: ${totalDocs} documentos em ${Object.keys(manifest.colecoes).length} coleções → ${DEST}`);
process.exit(0);
