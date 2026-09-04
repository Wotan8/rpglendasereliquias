/**
 * Fase F do Núcleo v2 — faxina do banco, só o que o varredor provou morto.
 *
 *   node functions/v2-faxina.mjs            dry-run
 *   node functions/v2-faxina.mjs --apply    grava (backup em BACKUP_DIR)
 *
 * Prova de cada remoção:
 *  1. 23 mecânicas sem NENHUMA citação — nem em equação, classe, peculiaridade, item
 *     (functions/v2-refs.mjs) nem nos botões/valores de predef (varredura de classModules,
 *     peculiarities e classes por id) — são despublicadas com o motivo gravado.
 *  2. VDs "Ecos do Vazio" e "Espiritomancia": nenhuma equação, módulo, peculiaridade ou classe
 *     os cita, e nenhum arquivo do site lê o nome (grep) — despublicados.
 *  3. `specializations` (1 doc, "Espada"): a especialização saiu do sistema na v1.7 (memória do
 *     projeto) e só o loader da ficha ainda lista a coleção — o doc vai para o backup e é apagado.
 *  Coleções vazias (`maneuvers`, `spells`) não têm doc para apagar: saem só dos loaders (código).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';
const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const agora = new Date().toISOString();
const ops = [];

const [mecs, vds, mods, pecs, classes, eq, specs] = await Promise.all([
    col('system/data/mechanics'), col('system/data/derivedValues'), col('system/data/classModules'), col('system/data/peculiarities'),
    col('system/data/classes'), col('system/data/equipment'), col('system/data/specializations'),
]);
const todos = JSON.stringify({ mods, pecs, classes, eq, mecs: mecs.map(m => ({ ...m, id: undefined })), vds });
const MORTAS = ['0i4mRfaPWlCYN4FjkAWD', '6dWgswlRrQI93u1JtlBL', '8gaBLR0UDrrJLICYXCR1', 'ABXR4Unmk5x7pDdewrzg', 'AyelOmwEBWKpGUbX50QY', 'BEiCa01W2trTy4u2dS17', 'PFMt5xbw3k1yX2cEjnDd', 'QrV8ggk7lSavkeqQXa5H', 'R7HOER5hK6Z85ing8CTU', 'SPzEuBnn9fXnd69VEiyf', 'Vq0poKDCHtRbVH8mhWaS', 'WWa1Yk0vgm77YLIls4ee', 'Wi5wJpwjafqlTR6FNfyt', 'XsrIda90Z6hO6V0isRyC', 'hwkDhVusaeNhFnG8ypOa', 'oVAohA2H7qf4b1Yc0olS', 'qpQ3X6rupBL7sD2FYSyL', 's10L9QNYv4w5yvg4vAen', 'u2IFXkTTV1vXAJ6GPBbT', 'uQrty8oYugFJ271l3CpN', '4SGNWms1NDtmI79R2rSf', '6xYmAYYV6FuhwMDStiSk', 'tXJN5d4pWzOpfdHClCAq'];
for (const id of MORTAS) {
    const m = mecs.find(x => x.id === id);
    if (!m || m.publicado === false) continue;
    const citacoes = (todos.match(new RegExp(id, 'g')) || []).length;
    if (citacoes) { console.log(`⚠️ ${id} ${m.nome}: ${citacoes} citação(ões) — NÃO despublica`); continue; }
    ops.push({ ref: db.doc(`system/data/mechanics/${id}`), data: { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-F: sem nenhuma citação (v2-refs + varredura de predefs, classes e peculiaridades)', updatedAt: Date.now() }, antes: { publicado: m.publicado ?? null }, log: `mecânica ${m.nome}: despublicada` });
}
for (const nome of ['Ecos do Vazio', 'Espiritomancia']) {
    const v = vds.find(x => x.nome === nome);
    if (!v || v.publicado === false) continue;
    const citacoes = (todos.match(new RegExp(`"${nome}"|"${v.id}"`, 'g')) || []).length;
    if (citacoes > 1) { console.log(`⚠️ VD ${nome}: ${citacoes} citação(ões) — NÃO despublica`); continue; }   // 1 = o próprio doc
    ops.push({ ref: db.doc(`system/data/derivedValues/${v.id}`), data: { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-F: nenhuma equação, módulo ou tela lê', updatedAt: Date.now() }, antes: { publicado: v.publicado ?? null }, log: `VD ${nome}: despublicado` });
}
for (const s of specs) ops.push({ ref: db.doc(`system/data/specializations/${s.id}`), data: null, antes: s, log: `specializations/${s.id} (${s.nome}): apagado (coleção legada, doc guardado no backup)`, apagar: true });

console.log(`ops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-faxina-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
const b = db.batch();
for (const o of ops) o.apagar ? b.delete(o.ref) : b.update(o.ref, o.data);
await b.commit();
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
