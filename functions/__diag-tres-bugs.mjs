/**
 * Leitura crua para os três problemas relatados na mesa:
 *   1. instrumento não vira linha de ataque (Acerto/Dano Sonoro)
 *   2. arco atira sem flecha e não gasta munição
 *   3. Composição de Batalha aplicou Fortalecido no inimigo também
 *
 *   node functions/__diag-tres-bugs.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const [eqSnap, dvSnap, modSnap, condSnap] = await Promise.all([
    db.collection('system/data/equipment').get(),
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/classModules').get(),
    db.collection('system/data/conditions').get(),
]);
const equip = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const dvs = dvSnap.docs.map(d => ({ id: d.id, ...d.data() }));

/* ---------- 1) INSTRUMENTOS ---------- */
console.log('\n═══ 1) INSTRUMENTOS NO CATÁLOGO ═══');
const instrumentos = equip.filter(e => (e.tags || []).some(t => /instrument|corda|sopro|percuss/i.test(t)));
for (const i of instrumentos) {
    console.log(`  ${String(i.nome).padEnd(28)} tipo=${String(i.tipo).padEnd(12)} cat=${i.categoriaArma || '—'}`
        + ` dano=${i.formulaDano || '—'} tipoGolpe=${JSON.stringify(i.tipoGolpe || null)}`
        + ` tags=${JSON.stringify(i.tags || [])}`);
}
console.log('\n  VDs com cara de Sonoro:');
for (const d of dvs.filter(x => /sonor|s[ôo]nic/i.test(x.nome || ''))) {
    console.log(`    ${d.id}  ${d.nome}  (escola=${d.blocoNome || d.escola || '—'})`);
}
console.log('\n  Tipos de Golpe existentes no cadastro de equipamento:');
console.log('   ', [...new Set(equip.flatMap(e => {
    const t = e.tipoGolpe; return !t ? [] : (Array.isArray(t) ? t : [t]);
}))].join(', ') || '(nenhum)');

/* ---------- 2) ARMAS DE DISPARO E MUNIÇÃO ---------- */
console.log('\n═══ 2) ARMAS A DISTÂNCIA × tipoProjetil ═══');
const disparo = equip.filter(e => e.categoriaArma === 'distancia');
let semMunicao = 0;
for (const a of disparo) {
    const tp = a.tipoProjetil;
    const lista = !tp ? [] : (Array.isArray(tp) ? tp : String(tp).split(','));
    if (!lista.length) semMunicao++;
    console.log(`  ${lista.length ? '✅' : '❌'} ${String(a.nome).padEnd(26)} tipoProjetil=${JSON.stringify(lista)} alcanceM=${a.alcanceM ?? '—'}`);
}
console.log(`\n  ${semMunicao}/${disparo.length} arma(s) a distância SEM munição cadastrada — essas atiram de graça para sempre.`);

console.log('\n  Projéteis no catálogo e suas tags:');
for (const p of equip.filter(e => e.tipo === 'Projétil')) {
    console.log(`    ${String(p.nome).padEnd(26)} tags=${JSON.stringify(p.tags || [])} chanceRecuperar=${p.chanceRecuperar ?? '(padrão)'}`);
}

/* ---------- 3) COMPOSIÇÃO DE BATALHA ---------- */
console.log('\n═══ 3) COMPOSIÇÃO DE BATALHA (e vizinhas com escolha de facção) ═══');
const condNome = new Map(condSnap.docs.map(d => [d.id, d.data().nome]));
for (const d of modSnap.docs) {
    const mod = d.data();
    for (const it of (mod.itensPredefinidos || [])) {
        const nome = it.nome || it.titulo || '';
        if (!/composi[çc][ãa]o de batalha|ritmo de guerra|f[úu]ria inspirada/i.test(nome)) continue;
        console.log(`\n  📜 ${nome}   [módulo: ${mod.nome}]`);
        console.log(`     descrição: ${String(it.descricao || it.efeito || '').slice(0, 260)}`);
        for (const k of ['formaArea', 'tamanhoArea', 'alcance', 'alvosMax', 'anguloCone', 'faccao', 'regua', 'portao']) {
            if (it[k] !== undefined) console.log(`     ${k}: ${JSON.stringify(it[k])}`);
        }
        const cds = it.condicoesAplicadas || [];
        console.log(`     condicoesAplicadas (${cds.length}):`);
        for (const c of cds) {
            console.log(`       · ${JSON.stringify(c)}   → ${condNome.get(c.id || c.condicaoId) || '(nome não resolvido)'}`);
        }
    }
}

process.exit(0);
