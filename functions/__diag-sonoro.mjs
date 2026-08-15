/**
 * O que existe hoje de "Acerto" e "Dano" no registro, e o que a Sonoromancia
 * tem — para decidir de onde sai o Acerto/Dano de um INSTRUMENTO usado como
 * arma. Só lê.
 *
 *   node functions/__diag-sonoro.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const [dvSnap, modSnap] = await Promise.all([
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/classModules').get(),
]);
const dvs = dvSnap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('\n═══ VDs de ACERTO ═══');
for (const d of dvs.filter(x => /acerto/i.test(x.nome || '')).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))) {
    console.log(`  ${String(d.nome).padEnd(38)} bloco=${d.blocoNome || '—'} · escopoItem=${!!d.escopoPorItem} · statusCombate=${!!d.statusCombate}`);
}

console.log('\n═══ VDs de DANO ═══');
for (const d of dvs.filter(x => /^dano|dano /i.test(x.nome || '')).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))) {
    console.log(`  ${String(d.nome).padEnd(38)} bloco=${d.blocoNome || '—'} · escopoItem=${!!d.escopoPorItem}`);
}

console.log('\n═══ VDs da Sonoromancia / do Bardo ═══');
for (const d of dvs.filter(x => /sonor/i.test((x.nome || '') + (x.blocoNome || '')))) {
    console.log(`  ${d.id}  ${String(d.nome).padEnd(34)} bloco=${d.blocoNome || '—'}`);
    console.log(`     equacao=${JSON.stringify(d.equacao || d.formula || null)}`);
}

console.log('\n═══ Colunas "forma de conjurar" do BARDO ═══');
for (const doc of modSnap.docs) {
    const m = doc.data();
    if (!/bardo|sonoro|harmoni/i.test((m.nome || '') + (m.classeNome || '') + (m.classe || ''))) continue;
    const vds = (m.colunasVd || m.select_vd || []).filter(c => c.ehVeiculo || c.formaConjurar);
    console.log(`\n  📦 ${m.nome || doc.id}  (classe: ${m.classeNome || m.classe || '?'})`);
    for (const c of (m.colunasVd || m.select_vd || [])) {
        console.log(`     coluna: ${JSON.stringify({ nome: c.nome || c.label, vdId: c.vdId || c.id, ehVeiculo: !!c.ehVeiculo })}`);
    }
    if (!vds.length && !(m.colunasVd || m.select_vd || []).length) {
        console.log(`     (chaves do módulo: ${Object.keys(m).join(', ')})`);
    }
}

process.exit(0);
