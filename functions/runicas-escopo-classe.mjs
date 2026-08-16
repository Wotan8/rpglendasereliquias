/**
 * As 3 perícias de ramo do Runimago (Escripta / Talha / Tatuagem Rúnica) foram
 * cadastradas por cadastrar-ramos-runomancia.mjs sem duas coisas:
 *
 *   1. `todoPersonagem: false` — sem o campo, a ficha lia `!== false` e as
 *      mostrava no bloco Exclusivo de TODO personagem.
 *   2. entrada em `Runimago.pericClasse` — o vínculo que faz a perícia aparecer
 *      só para quem é da classe (o mesmo caminho de Selo Abissal, Totemismo...).
 *
 * O conserto do default está em ficha-v1.7_1/js/system-data-loader.js; este
 * script fecha o dado.
 *
 *   node functions/runicas-escopo-classe.mjs            (dry-run)
 *   node functions/runicas-escopo-classe.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const RUNICAS = ['Escripta Rúnica', 'Talha Rúnica', 'Tatuagem Rúnica'];

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [skills, classes] = await Promise.all(['skills', 'classes'].map(grab));

const alvos = RUNICAS.map(n => skills.find(s => s.nome === n));
const runimago = classes.find(c => c.nome === 'Runimago');
const idOf = p => (typeof p === 'object' ? (p.id || p.nome) : p);

/* ═══ ASSERTS ═══ */
assert.ok(alvos.every(Boolean), 'as 3 perícias rúnicas existem no cadastro');
assert.ok(alvos.every(s => s.categoria === 'exclusivo'), 'as 3 são categoria exclusivo');
assert.ok(runimago, 'classe Runimago existe');
// A régua: nenhuma outra exclusiva vaza — todas as demais já são false.
const vazando = skills.filter(s => s.categoria === 'exclusivo' && s.todoPersonagem !== false
    && !RUNICAS.includes(s.nome));
assert.equal(vazando.length, 0, `outras exclusivas sem todoPersonagem:false: ${vazando.map(s => s.nome)}`);
console.log('✅ 4 asserts passaram.\n');

const jaVinculadas = new Set((runimago.pericClasse || []).map(idOf));
const novasRefs = alvos.filter(s => !jaVinculadas.has(s.id));

console.log('=== Escopo das perícias rúnicas ===\n');
for (const s of alvos) {
    console.log(`  ${s.nome.padEnd(18)} todoPersonagem: ${s.todoPersonagem} → false`
        + `   |  pericClasse do Runimago: ${jaVinculadas.has(s.id) ? 'já vinculada' : 'VINCULAR'}`);
}
console.log(`\n  Runimago.pericClasse: ${jaVinculadas.size} → ${jaVinculadas.size + novasRefs.length}`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ═══ GRAVAÇÃO ═══ */
const agora = admin.firestore.Timestamp.now();
const lote = db.batch();
for (const s of alvos) {
    lote.update(db.collection('system/data/skills').doc(s.id), { todoPersonagem: false, atualizadoEm: agora });
}
if (novasRefs.length) {
    lote.update(db.collection('system/data/classes').doc(runimago.id), {
        pericClasse: [...(runimago.pericClasse || []), ...novasRefs.map(s => s.id)],
        atualizadoEm: agora,
    });
}
await lote.commit();
console.log('\n✅ 3 perícias fechadas em exclusivo + vínculo no Runimago.');
process.exit(0);
