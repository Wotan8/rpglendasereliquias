/**
 * Limpa espaços sobrando no nome das tribos (o nome é chave primária do sistema).
 * Dry-run por padrão.  node functions/fix-nomes-tribos.mjs [--apply]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const tribes = (await db.collection('system/data/tribes').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const sujos = tribes.filter(t => t.nome !== (t.nome || '').trim());

console.log('=== TRIBOS COM ESPAÇO SOBRANDO ===');
for (const t of sujos) console.log(`  "${t.nome}"  ->  "${t.nome.trim()}"   (id=${t.id})`);
console.log(`  total: ${sujos.length} de ${tribes.length}\n`);

// Quem referencia nome de tribo por aí
console.log('=== VARREDURA DE USO (quem quebraria) ===');
const nomesSujos = new Set(sujos.map(t => t.nome));
const cols = await db.listCollections();
console.log('coleções raiz:', cols.map(c => c.id).join(', '));

let achados = 0;
for (const col of cols) {
  const snap = await col.limit(500).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    for (const campo of ['tribo', 'triboSelecionada', 'tribe']) {
      const v = d?.[campo] ?? d?.dados?.[campo] ?? d?.wizardState?.[campo];
      if (typeof v === 'string' && nomesSujos.has(v)) {
        console.log(`  ⚠️ ${col.id}/${doc.id}  ${campo}="${v}"`);
        achados++;
      }
    }
  }
}
console.log(achados ? `\n  ${achados} documento(s) seriam afetados — NÃO aplicar sem migrar junto.` : '  nenhum documento usa esses nomes. Seguro renomear.\n');

if (!APPLY) { console.log('DRY-RUN. Rode com --apply para gravar.'); process.exit(); }
if (achados) { console.log('ABORTADO: há referências em uso.'); process.exit(1); }

for (const t of sujos) {
  await db.doc(`system/data/tribes/${t.id}`).update({ nome: t.nome.trim() });
  console.log(`  ✔ ${t.id}: "${t.nome}" -> "${t.nome.trim()}"`);
}
console.log(`\n${sujos.length} tribo(s) renomeada(s).`);
process.exit();
