/**
 * Migra "Loção de cura 2 (+4)" do vínculo por mecânica para o campo novo
 * statusVitaisVinculados. Os dois somariam: +4 da mecânica one-off e +4 do
 * status vital = +8. A mecânica em si não é apagada, só desvinculada do item.
 *
 * node functions/vincular-status-locao.mjs          → dry-run
 * node functions/vincular-status-locao.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const snap = await db.collection('system/data/equipment').where('tipo', '==', 'Consumível').get();
const alvo = snap.docs.find(d => (d.data().nome || '').startsWith('Loção de cura 2'));
if (!alvo) { console.log('❌ Loção não encontrada.'); process.exit(1); }

const item = alvo.data();
console.log(`Item: ${item.nome}  [${alvo.id}]`);
console.log(`  antes → mecanicaIds: ${JSON.stringify(item.mecanicaIds || [])}`);
console.log(`          statusVitaisVinculados: ${JSON.stringify(item.statusVitaisVinculados || [])}`);

const patch = {
    statusVitaisVinculados: [{ id: 'VIT_ATUAL', modificador: 4 }],
    mecanicaIds: [],
};

console.log(`  depois → statusVitaisVinculados: ${JSON.stringify(patch.statusVitaisVinculados)}`);
console.log(`           mecanicaIds: []  (mecânica "Loção de Cura 2 (+4 VIT)" segue cadastrada)`);

if (WRITE) { await alvo.ref.update(patch); console.log('\n✅ Gravado.'); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
