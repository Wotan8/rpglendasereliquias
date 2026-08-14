/**
 * Como cada MÓDULO DE CLASSE diz "com o que se conjura isto?".
 * Mostra os campos select_vd de cada módulo mágico e os VDs que eles apontam.
 *
 *   node functions/__audit-veiculos.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const vdSnap = await db.collection('system/data/derivedValues').get();
const VD = new Map();
vdSnap.forEach(d => VD.set(d.id, d.data()));

const snap = await db.collection('system/data/classModules').get();
for (const d of snap.docs) {
    const m = d.data();
    const campos = m.schema || [];
    const vds = campos.filter(f => f.tipo === 'select_vd');
    if (!vds.length) continue;

    console.log('═'.repeat(76));
    console.log(`${m.nome || d.id}   [${d.id}]   tipo: ${m.tipo}   itens: ${(m.itensPredefinidos || []).length}`);
    for (const f of vds) {
        console.log(`   coluna "${f.label}"  (chave ${f.chave || f.key})`);
    }
    // que combinações aparecem de fato nos itens
    const combos = new Map();
    for (const it of m.itensPredefinidos || []) {
        const preenchidos = vds
            .filter(f => it.valores?.[f.chave || f.key])
            .map(f => f.label);
        const chave = preenchidos.join(' + ') || '(nenhum)';
        if (!combos.has(chave)) combos.set(chave, []);
        combos.get(chave).push(it.nome || '?');
    }
    console.log('   ── combinações usadas pelos itens:');
    for (const [k, nomes] of combos) {
        console.log(`      ${k.padEnd(42)} ${nomes.length}×  ex.: ${nomes[0]}`);
    }
    // para que VD cada coluna aponta (pega o 1º item que preencheu)
    console.log('   ── VD apontado por coluna:');
    for (const f of vds) {
        const k = f.chave || f.key;
        const it = (m.itensPredefinidos || []).find(x => x.valores?.[k]);
        const vd = it ? VD.get(it.valores[k]) : null;
        console.log(`      ${String(f.label).padEnd(20)} → ${vd ? `${vd.nome} (${vd.chave || vd.key || '?'})` : '— nunca preenchido —'}`);
    }
}
process.exit(0);
