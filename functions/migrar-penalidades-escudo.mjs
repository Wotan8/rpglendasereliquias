/**
 * Últimas 2 penalidades: escudos passam a carregar o próprio modificador,
 * usando a flag escopo:'global' no vínculo de Valor Derivado.
 *
 * Sem a flag, Acerto (escopoItem='coluna') cairia em itemBonuses[escudo.id] —
 * uma coluna de Acerto do próprio escudo, que ninguém usa para atacar.
 *
 * Vincular e apagar no mesmo batch: separados, existe uma janela em que a
 * penalidade aplica dobrada.
 *
 * node functions/migrar-penalidades-escudo.mjs          → dry-run
 * node functions/migrar-penalidades-escudo.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const ACERTO = 'hmHQhKsFs03T9ixGVy8b';   // escopoItem='coluna' → precisa da flag
const DESLOC = 'bdHkbTOBvQwk80t4On9P';   // já global

// Livro, pág. 102.
const ESCUDOS = {
    'Escudo Grande': { tag: 'Escudo Grande', vds: [{ id: ACERTO, modificador: -1, escopo: 'global' }] },
    'Escudo de Torre': {
        tag: 'Escudo Torre',
        vds: [{ id: ACERTO, modificador: -2, escopo: 'global' }, { id: DESLOC, modificador: -1 }],
    },
};

const eq = await db.collection('system/data/equipment').get();
const mech = await db.collection('system/data/mechanics').get();
const rules = await db.collection('system/data/itemRules').get();
const erros = [];

const updates = [];
for (const [nome, cfg] of Object.entries(ESCUDOS)) {
    const doc = eq.docs.find(d => (d.data().nome || '').trim() === nome);
    if (!doc) { erros.push(`item não encontrado: ${nome}`); continue; }
    const a = doc.data();

    // Blindagem já mora aqui — preservar e só anexar/substituir os alvos novos.
    const novosIds = new Set(cfg.vds.map(v => v.id));
    const patch = {
        valoresDerivadosVinculados: [
            ...(a.valoresDerivadosVinculados || []).filter(v => !novosIds.has(v.id)),
            ...cfg.vds,
        ],
        tags: (a.tags || []).filter(t => t !== cfg.tag),
    };
    updates.push({ ref: doc.ref, nome, tag: cfg.tag, patch, antes: a });
}

const nomesMec = Object.values(ESCUDOS).map(c => c.tag);
const mecsApagar = mech.docs.filter(d => {
    const n = d.data().nome || '';
    return nomesMec.some(t => n === `Armadura ${t} EQUIPADA` || n === `Penalidade ${t}`);
});
const rulesApagar = rules.docs.filter(d =>
    nomesMec.some(t => (d.data().nome || '') === `Penalidade de Armadura — ${t}`));

// Nada além dos próprios itemRules pode citar essas mecânicas.
const idsMec = new Set(mecsApagar.map(d => d.id));
const idsRule = new Set(rulesApagar.map(d => d.id));
for (const col of await db.doc('system/data').listCollections()) {
    for (const d of (await col.get()).docs) {
        if (idsMec.has(d.id) || idsRule.has(d.id)) continue;
        const s = JSON.stringify(d.data());
        for (const id of idsMec) if (s.includes(id)) erros.push(`mecânica ${id} citada em ${col.id}/${d.data().nome || d.id}`);
    }
}

console.log('########## VÍNCULOS ##########');
for (const u of updates) {
    const bl = u.patch.valoresDerivadosVinculados.find(v => v.id === 'hV1UIhcVb4Ip7lgsqtLm');
    console.log(`\n${u.nome}`);
    console.log(`   tags: [${(u.antes.tags || []).join(', ')}] → [${u.patch.tags.join(', ')}]`);
    console.log(`   Blindagem preservada: ${bl ? bl.modificador : '⚠️ SUMIU'}`);
    u.patch.valoresDerivadosVinculados.filter(v => v.id !== 'hV1UIhcVb4Ip7lgsqtLm')
        .forEach(v => console.log(`   ${v.id === ACERTO ? 'Acerto' : 'Desloc. Terrestre'} ${v.modificador}${v.escopo === 'global' ? '  [GLOBAL]' : ''}`));
}

console.log(`\n########## A APAGAR ##########`);
console.log(`mecânicas (${mecsApagar.length}): ${mecsApagar.map(d => d.data().nome).join(' | ')}`);
console.log(`itemRules (${rulesApagar.length}): ${rulesApagar.map(d => d.data().nome).join(' | ')}`);

if (erros.length) {
    console.log(`\n⛔ nada gravado:`); erros.forEach(e => console.log('   ' + e)); process.exit(1);
}
console.log('\n✅ nenhuma referência pendente.');
if (!WRITE) { console.log('\n(dry-run — rode com --write para gravar)'); process.exit(); }

const lote = db.batch();
updates.forEach(u => lote.update(u.ref, u.patch));
mecsApagar.forEach(d => lote.delete(d.ref));
rulesApagar.forEach(d => lote.delete(d.ref));
await lote.commit();
console.log(`\n✅ ${updates.length} escudos vinculados, ${mecsApagar.length} mecânicas e ${rulesApagar.length} itemRules apagadas.`);
process.exit();
