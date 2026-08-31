/**
 * Bestiário — consertos 02.
 *
 *  1. Águia Tempestuosa perde o vínculo com o personagem char_1778363954904_wszauk.
 *  2. Apaga "Fungo Parasita Ambulante" — não existe no cenário.
 *
 * O apagado vai para backup-bestiario-consertos-02.json antes.
 *
 *   node functions/bestiario-consertos-02.mjs            (dry-run)
 *   node functions/bestiario-consertos-02.mjs --apply
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const npcs = (await db.collection('npcs').get()).docs;
const acha = nome => npcs.filter(d => d.data().nome === nome);
const erros = [];

const aguias = acha('Águia Tempestuosa');
if (aguias.length !== 1) erros.push(`Águia Tempestuosa: esperava 1 doc, achei ${aguias.length}`);
const aguia = aguias[0];
const vincAntes = aguia ? (aguia.data().vinculos || []) : [];
if (aguia && !vincAntes.length) erros.push('Águia já está sem vínculo — nada a fazer');

const fungos = acha('Fungo Parasita Ambulante');
if (fungos.length !== 1) erros.push(`Fungo Parasita Ambulante: esperava 1 doc, achei ${fungos.length}`);
const fungo = fungos[0];
if (fungo && (fungo.data().vinculos || []).length) erros.push('o Fungo TEM vínculo — pare e confira');

console.log('\n=== Bestiário · consertos 02 ===\n');
if (aguia) {
    console.log(`Águia Tempestuosa [${aguia.id}]`);
    console.log(`   vinculos: ${JSON.stringify(vincAntes)} → []`);
    console.log(`   mesaId: "${aguia.data().mesaId || ''}" (inalterado)`);
}
if (fungo) console.log(`\nAPAGA  ✗ ${fungo.data().nome} [${fungo.id}]  vinculos=${(fungo.data().vinculos || []).length}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

fs.writeFileSync('backup-bestiario-consertos-02.json',
    JSON.stringify([{ id: fungo.id, ...fungo.data() }], null, 2), 'utf8');
console.log('\n💾 backup do apagado em functions/backup-bestiario-consertos-02.json');

const agora = new Date().toISOString();
const batch = db.batch();
batch.update(aguia.ref, { vinculos: [], lastUpdate: agora, lastUpdateBy: AUTOR });
batch.delete(fungo.ref);
await batch.commit();
console.log('\n✅ vínculo da Águia removido · Fungo apagado.');
process.exit(0);
