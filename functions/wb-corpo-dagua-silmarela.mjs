/**
 * Worldbuilding — fecha a [LACUNA] da Borda de Silmarela. Item 5 do handoff
 * do Bestiário, o único que não era tarefa de código: que corpo d'água é
 * este. Resposta do usuário (31/08/2026): é um rio, ainda sem nome, que
 * passa por dentro da Floresta de Silmarela.
 *
 *   node functions/wb-corpo-dagua-silmarela.mjs            (dry-run)
 *   node functions/wb-corpo-dagua-silmarela.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const doc = (await db.collection('worldbuilding-geography').where('nome', '==', 'Borda de Silmarela').get()).docs[0];
if (!doc) { console.log('❌ "Borda de Silmarela" não achada'); process.exit(1); }
const g = doc.data();

const antes = String(g.descricao || '');
const alvo = '\n\n[LACUNA] Que corpo d\'água é este — rio, lago ou braço — ainda não está definido.';
if (!antes.includes(alvo)) { console.log('❌ a [LACUNA] esperada não bate com o texto atual — confira à mão:\n' + antes); process.exit(1); }

const depois = antes.replace(alvo, '\n\nÉ um rio — ainda sem nome — que nasce ou atravessa a Floresta de Silmarela antes de correr pela Borda.');

console.log(`\n=== Borda de Silmarela [${doc.id}] ===`);
console.log('--- ANTES ---\n' + antes);
console.log('\n--- DEPOIS ---\n' + depois);

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

await doc.ref.update({ descricao: depois, lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR });
console.log('\n✅ gravado.');
process.exit(0);
