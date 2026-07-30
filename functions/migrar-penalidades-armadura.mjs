/**
 * Move as penalidades de armadura Média/Pesada das mecânicas para vínculo
 * direto na peça (atributosVinculados / periciasVinculadas / VD).
 *
 * Tudo num único batch: vincular e apagar precisam ser atômicos, senão existe
 * uma janela em que a penalidade aplica DOBRADA (mecânica + vínculo).
 *
 * ESCUDOS FICAM DE FORA. A penalidade deles mira "Acerto", que tem
 * escopoItem='coluna': pelo vínculo de VD o valor cai em itemBonuses[item.id]
 * (a coluna do próprio escudo), não no saco global. Como itemRule ele cai no
 * global, que é o certo — você ataca com a arma, não com o escudo.
 *
 * node functions/migrar-penalidades-armadura.mjs          → dry-run
 * node functions/migrar-penalidades-armadura.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const DES = 'attr_des';
const FURTIVIDADE = 'zReRsG9Ch9To4Og1M1BD';   // perícia (id do Firestore)
const DESLOC = 'bdHkbTOBvQwk80t4On9P';        // VD global

// Tabela de penalidade do Livro, pág. 101.
const FAIXAS = {
    'Média I': { itens: ['Couro Cravejado', 'Couro Reforçado'], furt: -1 },
    'Média II': { itens: ['Brigandina'], des: -1, furt: -1 },
    'Média III': { itens: ['Peitoral de Aço', 'Cota de Malha'], des: -1, furt: -2 },
    'Pesada I': { itens: ['Cota de Placas', 'Meia-Armadura'], des: -1, furt: -3 },
    'Pesada II': { itens: ['Armadura Completa'], des: -2, furt: -4 },
    'Pesada III': { itens: ['Armadura de Torneio'], des: -3, furt: -5, desloc: -2 },
};

const eq = await db.collection('system/data/equipment').get();
const mech = await db.collection('system/data/mechanics').get();
const rules = await db.collection('system/data/itemRules').get();

const erros = [];
const acharItem = n => {
    const d = eq.docs.find(x => (x.data().nome || '').trim() === n);
    if (!d) erros.push(`item não encontrado: ${n}`);
    return d;
};

// --- 1) Vínculos nas peças -------------------------------------------------
const updates = [];
for (const [faixa, p] of Object.entries(FAIXAS)) {
    for (const nome of p.itens) {
        const doc = acharItem(nome);
        if (!doc) continue;
        const a = doc.data();

        const patch = { tags: (a.tags || []).filter(t => t !== faixa) };
        if (p.des) patch.atributosVinculados = [{ id: DES, modificador: p.des }];
        if (p.furt) patch.periciasVinculadas = [{ id: FURTIVIDADE, modificador: p.furt }];
        if (p.desloc) {
            // Blindagem já mora aqui — anexar, nunca sobrescrever.
            const outros = (a.valoresDerivadosVinculados || []).filter(v => v.id !== DESLOC);
            patch.valoresDerivadosVinculados = [...outros, { id: DESLOC, modificador: p.desloc }];
        }
        updates.push({ ref: doc.ref, nome, faixa, patch, antes: a });
    }
}

// --- 2) Mecânicas e itemRules da faixa (escudos preservados) ---------------
const FAIXAS_NOMES = Object.keys(FAIXAS);
const mecsApagar = mech.docs.filter(d => {
    const n = d.data().nome || '';
    return FAIXAS_NOMES.some(f => n === `Armadura ${f} EQUIPADA` || n === `Penalidade ${f}`);
});
const rulesApagar = rules.docs.filter(d =>
    FAIXAS_NOMES.some(f => (d.data().nome || '') === `Penalidade de Armadura — ${f}`));

// --- 3) Nada além dos itemRules pode citar essas mecânicas -----------------
const idsMec = new Set(mecsApagar.map(d => d.id));
const idsRule = new Set(rulesApagar.map(d => d.id));
for (const col of await db.doc('system/data').listCollections()) {
    for (const d of (await col.get()).docs) {
        if (idsMec.has(d.id) || idsRule.has(d.id)) continue;
        const s = JSON.stringify(d.data());
        for (const id of idsMec) {
            if (s.includes(id) && !idsRule.has(d.id)) erros.push(`mecânica ${id} ainda citada em ${col.id}/${d.data().nome || d.id}`);
        }
    }
}

console.log(`########## VÍNCULOS NAS PEÇAS (${updates.length}) ##########`);
for (const u of updates) {
    console.log(`\n${u.nome}  [${u.faixa}]`);
    console.log(`   tags: [${(u.antes.tags || []).join(', ')}] → [${u.patch.tags.join(', ')}]`);
    if (u.patch.atributosVinculados) console.log(`   atributo: DES ${u.patch.atributosVinculados[0].modificador}`);
    if (u.patch.periciasVinculadas) console.log(`   perícia:  Furtividade ${u.patch.periciasVinculadas[0].modificador}`);
    if (u.patch.valoresDerivadosVinculados) console.log(`   VD:       ${JSON.stringify(u.patch.valoresDerivadosVinculados)}`);
}

console.log(`\n########## A APAGAR ##########`);
console.log(`mecânicas (${mecsApagar.length}):`);
mecsApagar.forEach(d => console.log(`   ${d.data().nome}`));
console.log(`itemRules (${rulesApagar.length}):`);
rulesApagar.forEach(d => console.log(`   ${d.data().nome}`));

console.log(`\n########## PRESERVADO (escudos) ##########`);
mech.docs.filter(d => /Escudo (Grande|Torre)$/.test(d.data().nome || '')).forEach(d => console.log(`   ${d.data().nome}`));
rules.docs.filter(d => /Escudo (Grande|Torre)$/.test(d.data().nome || '')).forEach(d => console.log(`   ${d.data().nome}`));

if (erros.length) {
    console.log(`\n⛔ ${erros.length} problema(s) — nada gravado:`);
    erros.forEach(e => console.log('   ' + e));
    process.exit(1);
}
console.log('\n✅ nenhuma referência pendente.');

if (!WRITE) { console.log('\n(dry-run — rode com --write para gravar)'); process.exit(); }

const lote = db.batch();
updates.forEach(u => lote.update(u.ref, u.patch));
mecsApagar.forEach(d => lote.delete(d.ref));
rulesApagar.forEach(d => lote.delete(d.ref));
await lote.commit();
console.log(`\n✅ ${updates.length} peças vinculadas, ${mecsApagar.length} mecânicas e ${rulesApagar.length} itemRules apagadas — num batch só.`);
process.exit();
