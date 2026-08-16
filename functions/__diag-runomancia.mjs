/**
 * O que o CADASTRO já sabe de Runomancia — antes de definir qualquer regra.
 *   node functions/__diag-runomancia.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const [dvSnap, modSnap, essSnap, livSnap] = await Promise.all([
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/classModules').get(),
    db.collection('system/data/essencias').get().catch(() => ({ docs: [] })),
    db.collection('livros').get().catch(() => ({ docs: [] })),
]);

console.log('\n═══ ESSÊNCIAS cadastradas ═══');
if (!essSnap.docs.length) console.log('  (coleção system/data/essencias vazia ou inexistente)');
for (const d of essSnap.docs) {
    const e = d.data();
    console.log(`  ${String(e.nome).padEnd(14)} cor=${String(e.cor || '—').padEnd(24)} danoVd=${e.danoVd || e.vdDano || '—'} blindagemVd=${e.blindagemVd || '—'}`);
    for (const k of Object.keys(e)) if (!['nome','cor','descricao'].includes(k)) { /* mostra chaves úteis */ }
    if (d === essSnap.docs[0]) console.log(`     (chaves: ${Object.keys(e).join(', ')})`);
}

console.log('\n═══ MÓDULOS de classe da Runomancia ═══');
for (const d of modSnap.docs) {
    const m = d.data();
    const txt = JSON.stringify(m).toLowerCase();
    if (!/run[oiô]ma|runimago|runomago|rúnic|runic/.test(txt)) continue;
    console.log(`\n  📦 ${m.nome || d.id}   (id ${d.id})`);
    console.log(`     classe=${m.classeNome || m.classe || '?'} · custoRecurso=${m.custoRecurso || m.retornoRecurso || '—'}`);
    for (const it of (m.itensPredefinidos || [])) {
        console.log(`     · ${String(it.nome || '?').padEnd(34)} acao=${it.acao || '—'} forma=${it.formaArea || '—'} alvos=${it.alvosMax ?? '—'} cond=${(it.condicoesAplicadas || []).map(c => c.condicao).join('/') || '—'}`);
    }
    const cols = m.colunas || m.schema || m.campos || null;
    if (cols) console.log(`     colunas: ${JSON.stringify(cols).slice(0, 400)}`);
}

console.log('\n═══ VDs do bloco Runomancia / rúnicos ═══');
for (const d of dvSnap.docs.map(x => ({ id: x.id, ...x.data() }))) {
    if (!/run[oiô]|rúnic/i.test((d.nome || '') + (d.blocoNome || ''))) continue;
    console.log(`  ${d.id}  ${String(d.nome).padEnd(34)} bloco=${d.blocoNome || '—'} escopoItem=${JSON.stringify(d.escopoItem)}`);
}

console.log('\n═══ LIVROS com cara de cânone rúnico ═══');
for (const d of livSnap.docs) {
    const l = d.data();
    if (!/run[oiô]|rúnic/i.test((l.titulo || '') + (l.nome || ''))) continue;
    const caps = (l.capitulos || l.secoes || []);
    console.log(`  📖 ${l.titulo || l.nome}  (${d.id}) — ${caps.length} capítulo(s), publicado=${l.publicado}`);
    for (const c of caps) console.log(`      · ${c.titulo || c.nome || '?'}  (${String(c.conteudo || c.texto || '').length} chars)`);
}

process.exit(0);
