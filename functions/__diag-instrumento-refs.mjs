/**
 * Confere que TODA referência das equações novas dos instrumentos existe de
 * verdade. Ref errada não dá erro: o termo vale 0 e o Alvo fica baixo em
 * silêncio — o pior tipo de bug de cadastro.
 *
 *   node functions/__diag-instrumento-refs.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const [eqSnap, dvSnap, skSnap] = await Promise.all([
    db.collection('system/data/equipment').get(),
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/skills').get(),
]);
const dvPorId = new Map(dvSnap.docs.map(d => [d.id, d.data()]));
const dvNomes = new Set(dvSnap.docs.map(d => norm(d.data().nome)));
const skNomes = new Set(skSnap.docs.map(d => norm(d.data().nome)));

/** Refs que as ARMAS já usam e que portanto sabemos que resolvem. */
const refsDeArma = new Set();
for (const d of eqSnap.docs) {
    const e = d.data();
    if (e.tipo !== 'Arma') continue;
    for (const v of (e.valoresDerivadosVinculados || [])) {
        for (const t of (v.equacao || [])) if (t.ref) refsDeArma.add(norm(t.ref));
    }
}

const resolve = (ref) => {
    const n = norm(ref);
    if (refsDeArma.has(n)) return 'já usada por arma';
    if (/^pericia:/.test(n)) return skNomes.has(n.replace(/^pericia:\s*/, '')) ? 'perícia do registro' : null;
    if (dvNomes.has(n)) return 'Valor Derivado';
    if (['for', 'des', 'vig', 'int', 'pre', 'per', 'car', 'von'].includes(n)) return 'atributo';
    return null;
};

let problemas = 0, conferidos = 0;
for (const d of eqSnap.docs) {
    const e = d.data();
    if (!(e.tags || []).some(t => norm(t) === 'instrumento')) continue;
    console.log(`\n🎻 ${e.nome}  dano=${e.formulaDano || '❌ SEM FÓRMULA'}`);
    if (!e.formulaDano) { problemas++; console.log('   ❌ sem fórmula de dano NÃO vira linha de ataque'); }
    for (const v of (e.valoresDerivadosVinculados || [])) {
        const dv = dvPorId.get(v.id);
        console.log(`   🔗 ${dv?.nome || '❌ VD inexistente ' + v.id}  (escopoItem=${JSON.stringify(dv?.escopoItem)})`);
        if (!dv) { problemas++; continue; }
        for (const t of (v.equacao || [])) {
            if (!t.ref) continue;
            const ok = resolve(t.ref);
            conferidos++;
            console.log(`        ${ok ? '✅' : '❌'} ${t.op ? t.op + ' ' : ''}${t.ref}${ok ? ` — ${ok}` : ' — NÃO RESOLVE (valeria 0 calado)'}`);
            if (!ok) problemas++;
        }
    }
}

console.log(`\n${problemas ? '❌' : '✅'} ${conferidos} referência(s) conferida(s), ${problemas} problema(s)`);
process.exit(problemas ? 1 : 0);
