/**
 * Como uma ARMA está cadastrada, campo a campo — o molde a copiar para os
 * instrumentos. Só lê.
 *
 *   node functions/__diag-arma-modelo.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const [eqSnap, dvSnap] = await Promise.all([
    db.collection('system/data/equipment').get(),
    db.collection('system/data/derivedValues').get(),
]);
const equip = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const dvNome = new Map(dvSnap.docs.map(d => [d.id, d.data().nome]));

const MOSTRAR = ['Estilete', 'Adaga', 'Espada Curta', 'Arco Longo', 'Bordão', 'Cajado'];
for (const nome of MOSTRAR) {
    const a = equip.find(e => (e.nome || '').toLowerCase() === nome.toLowerCase());
    if (!a) { console.log(`\n(sem "${nome}" no catálogo)`); continue; }
    console.log(`\n═══ ${a.nome} ═══`);
    for (const k of ['tipo', 'categoriaArma', 'formaEquipar', 'equipavelEm', 'formulaDano', 'formulaDano2Maos',
                     'tipoGolpe', 'liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'preco',
                     'peso', 'tamanho', 'alcanceM', 'tags']) {
        if (a[k] !== undefined && a[k] !== null && a[k] !== '') console.log(`  ${k}: ${JSON.stringify(a[k])}`);
    }
    for (const v of (a.valoresDerivadosVinculados || [])) {
        console.log(`  🔗 VD ${dvNome.get(v.id) || v.id}: ${JSON.stringify(v)}`);
    }
}

console.log('\n═══ Dano por dado × peso/preço nas armas simples (para calibrar o instrumento) ═══');
const armas = equip.filter(e => e.tipo === 'Arma' && e.formulaDano)
    .sort((a, b) => String(a.formulaDano).localeCompare(String(b.formulaDano)));
for (const a of armas) {
    console.log(`  ${String(a.formulaDano).padEnd(8)} ${String(a.nome).padEnd(26)} peso=${String(a.peso ?? '—').padEnd(5)} preço=${String(a.preco ?? '—').padEnd(6)} liga=${a.liga ?? '—'} q=${a.qualidade ?? '—'} cat=${a.categoriaArma || '—'}`);
}

console.log('\n═══ VDs "Acerto Mágico" e "Dano Eólico" ═══');
for (const d of dvSnap.docs.map(x => ({ id: x.id, ...x.data() }))) {
    if (!/^acerto m[áa]gico$|^dano e[óo]lico$/i.test(d.nome || '')) continue;
    console.log(`  ${d.id}  ${d.nome}`);
    for (const k of ['blocoNome', 'escopoPorItem', 'statusCombate', 'equacao', 'formula', 'descricao']) {
        if (d[k] !== undefined) console.log(`     ${k}: ${JSON.stringify(d[k]).slice(0, 240)}`);
    }
}

process.exit(0);
