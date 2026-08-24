/**
 * Apaga a mecânica órfã "Inspirar" [iMJqSEqhpeLPF9ttm6rR].
 *
 * Ela soma [Perícia: Liderança] num alvo chamado "Inspirar" que não existe como
 * Valor Derivado, perícia, atributo nem status vital — a ficha devolvia 0 e
 * seguia. E nenhuma peculiaridade, módulo, classe, raça, tribo, item ou ficha
 * aponta para ela: nunca chegou à mesa.
 *
 * Confere a orfandade DE NOVO antes de apagar, em vez de confiar na varredura
 * de ontem: entre uma coisa e outra alguém pode ter vinculado a mecânica a uma
 * peculiaridade, e aí apagar quebraria um cadastro vivo.
 *
 *   node functions/apaga-mecanica-inspirar.mjs            (dry-run)
 *   node functions/apaga-mecanica-inspirar.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ID = 'iMJqSEqhpeLPF9ttm6rR';

const SYS = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics', 'skills', 'conditions',
    'equipment', 'maneuvers', 'spells', 'derivedValues', 'vitalStats', 'auras', 'itemRules',
    'bodyParts', 'runicElements', 'classModules', 'knowledge', 'castingForms'];
const TOP = ['char', 'characters', 'npcs', 'items', 'mesas', 'campaigns', 'containers', 'loja_itens'];

const ref = db.collection('system/data/mechanics').doc(ID);
const snap = await ref.get();
if (!snap.exists) { console.log('A mecânica já não existe. Nada a fazer.'); process.exit(0); }

const doc = snap.data();
console.log(`Mecânica: "${doc.nome}"  fonte=${doc.fonte}  tags=${(doc.tags || []).join(', ')}`);
console.log(`Alvo: ${JSON.stringify((doc.config?.calculos || []).map(c => c.alvo))}\n`);

const citam = [];
for (const col of [...SYS.map(c => `system/data/${c}`), ...TOP]) {
    let s; try { s = await db.collection(col).get(); } catch { continue; }
    for (const d of s.docs) {
        if (d.id === ID) continue;
        if (JSON.stringify(d.data()).includes(ID)) {
            citam.push(`${col}/${d.id} "${d.data().nome || d.data().titulo || ''}"`);
        }
    }
}

if (citam.length) {
    console.log(`❌ ${citam.length} referência(s) — NÃO é mais órfã, não apago:`);
    citam.forEach(c => console.log('   · ' + c));
    process.exit(1);
}
console.log('✅ Órfã confirmada: ninguém aponta para ela.');

if (!APPLY) { console.log('\n(dry-run — rode com --apply para apagar)'); process.exit(0); }

const arq = new URL('./_backup-mecanica-inspirar.json', import.meta.url);
writeFileSync(arq, JSON.stringify({ id: ID, ...doc }, null, 2));
console.log(`\n💾 backup em ${arq}`);

await ref.delete();
console.log('🗑️  apagada.');
process.exit(0);
