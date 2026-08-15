/**
 * Auditoria dos EQUIPAMENTOS que servem de foco de conjuração.
 *
 * Cada Forma de Conjuração exige uma tag ("Corda", "Sopro", "Percussão"...).
 * Este script cruza as Formas com o catálogo e com as instâncias em uso, e
 * aponta três coisas:
 *   1. Forma cuja tag NENHUM equipamento tem — a forma é inconjurável;
 *   2. equipamento com cara de foco cuja tag não bate com forma nenhuma;
 *   3. INSTÂNCIA cujas tags divergem do modelo do catálogo (o Tabuleiro junta
 *      as duas, mas divergência é sinal de cadastro velho).
 *
 *   node functions/__diag-focos-conjuracao.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const [formasSnap, equipSnap, itensSnap] = await Promise.all([
    db.collection('system/data/castingForms').get(),
    db.collection('system/data/equipment').get(),
    db.collection('items').get(),
]);

const formas = formasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.publicado !== false);
const catalogo = equipSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const catPorId = new Map(catalogo.map(t => [t.id, t]));

console.log('\n═══ FORMAS DE CONJURAÇÃO E O QUE EXIGEM ═══');
for (const f of formas) {
    const req = f.requisito === 'item_tag' ? `item com tag ${JSON.stringify(f.itemTags || [])}`
        : f.requisito === 'parte_corpo' ? `parte do corpo ${JSON.stringify(f.partesDoCorpoNomes || [])}`
        : '(sem requisito)';
    console.log(`  ${f.icone || '🪄'} ${String(f.nome).padEnd(18)} ${req}`);
}

/* ---- 1) Forma sem nenhum equipamento que a satisfaça ---- */
console.log('\n═══ 1) FORMAS SEM EQUIPAMENTO NO CATÁLOGO ═══');
let orfas = 0;
for (const f of formas) {
    if (f.requisito !== 'item_tag') continue;
    const tags = (f.itemTags || []).map(norm);
    const servem = catalogo.filter(t => (t.tags || []).some(x => tags.includes(norm(x))));
    if (!servem.length) { console.log(`  ❌ ${f.nome}: NENHUM equipamento tem ${JSON.stringify(f.itemTags)}`); orfas++; }
    else console.log(`  ✅ ${String(f.nome).padEnd(18)} ${servem.length} equipamento(s): ${servem.map(t => t.nome).join(', ')}`);
}
if (!orfas) console.log('  (todas as formas têm equipamento no catálogo)');

/* ---- 2) Item com cara de foco e tag que não casa com forma nenhuma ---- */
const tagsDeForma = new Set(formas.flatMap(f => (f.itemTags || []).map(norm)));
console.log('\n═══ 2) EQUIPAMENTO COM CARA DE FOCO E TAG QUE NÃO CASA ═══');
let suspeitos = 0;
const CARA_DE_FOCO = /instrument|rabeca|ala[uú]de|lira|harpa|tambor|flauta|corneta|trompa|gaita|pandeiro|c[ií]tara|viol|foco|talism[aã]|totem|s[ií]mbolo|cajado|varinha|orbe|grim[oó]rio/i;
for (const t of catalogo) {
    const cara = CARA_DE_FOCO.test(t.nome || '') || (t.tags || []).some(x => /instrument|foco/i.test(x));
    if (!cara) continue;
    const casa = (t.tags || []).some(x => tagsDeForma.has(norm(x)));
    if (!casa) { console.log(`  ⚠️ ${String(t.nome).padEnd(34)} tags=${JSON.stringify(t.tags || [])} — nenhuma casa com Forma`); suspeitos++; }
}
if (!suspeitos) console.log('  (todo equipamento com cara de foco casa com alguma Forma)');

/* ---- 3) Instância divergindo do modelo ---- */
console.log('\n═══ 3) INSTÂNCIAS COM TAGS DIVERGENTES DO MODELO ═══');
let divergentes = 0, semTagENoModeloTem = 0;
for (const d of itensSnap.docs) {
    const i = d.data();
    const tplId = i.modeloId || i.origemTemplateId;
    if (!tplId) continue;
    const tpl = catPorId.get(tplId);
    if (!tpl) continue;
    const tagsI = (i.tags || []).map(norm).sort();
    const tagsT = (tpl.tags || []).map(norm).sort();
    if (JSON.stringify(tagsI) === JSON.stringify(tagsT)) continue;
    const faltando = tagsT.filter(x => !tagsI.includes(x));
    if (!faltando.length) continue;   // instância com tag EXTRA não é problema
    divergentes++;
    if (divergentes <= 15) {
        console.log(`  ⚠️ ${String(i.nome || '?').padEnd(30)} instância=${JSON.stringify(i.tags || [])} modelo=${JSON.stringify(tpl.tags || [])}`);
    }
    if ((i.tags || []).length === 0) semTagENoModeloTem++;
}
console.log(divergentes
    ? `\n  ${divergentes} instância(s) sem tag que o modelo tem (${semTagENoModeloTem} sem tag nenhuma).`
      + '\n  O Tabuleiro junta instância + modelo, então isto NÃO quebra a conjuração — mas o cadastro está velho.'
    : '  (nenhuma instância perdeu tag do modelo)');

process.exit(0);
