/**
 * Passo 6 da migração v2: os tipos de dano ganham NOME próprio.
 *
 * Os 13 canais por Essência deixam de se chamar pela cor e passam ao nome de
 * dano aprovado (mesa fala "dano Ígneo", não "dano da Essência Vermelha").
 * Dano no masculino, Blindagem no feminino. A cor continua na descrição —
 * é o elo com o cânone da Fluxomancia.
 *
 * Vínculos de item usam ID (sobrevivem); o que referencia por NOME são as
 * mecânicas (alvo/nome/preview) e o campo espelhaVD — tudo varrido aqui.
 *
 *   node functions/renomear-vds-essencia.mjs            (dry-run)
 *   node functions/renomear-vds-essencia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* cor do cânone → [dano (masc.), blindagem (fem.)] */
const NOMES = {
    'Cinza':      ['Eólico', 'Eólica'],
    'Azul-Claro': ['Aquático', 'Aquática'],
    'Azul':       ['Espiritual', 'Espiritual'],
    'Púrpura':    ['Necrótico', 'Necrótica'],
    'Verde':      ['Natural', 'Natural'],
    'Rosa':       ['Cristalino', 'Cristalina'],
    'Amarela':    ['Luminoso', 'Luminosa'],
    'Vermelha':   ['Ígneo', 'Ígnea'],
    'Marrom':     ['Telúrico', 'Telúrica'],
    'Branca':     ['Espacial', 'Espacial'],
    'Prateada':   ['Temporal', 'Temporal'],
    'Preta':      ['Abissal', 'Abissal'],
    'Dourada':    ['Áureo', 'Áurea'],
};
const MAPA = {};
for (const [cor, [m, f]] of Object.entries(NOMES)) {
    MAPA[`Dano ${cor}`] = `Dano ${m}`;
    MAPA[`Blindagem ${cor}`] = `Blindagem ${f}`;
}

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [vdSnap, mecSnap, eqSnap] = await Promise.all([grab('derivedValues'), grab('mechanics'), grab('equipment')]);

const mudVD = [], mudMec = [], erros = [];

for (const d of vdSnap.docs) {
    const v = d.data();
    if (MAPA[v.nome]) mudVD.push({ ref: d.ref, patch: { nome: MAPA[v.nome] }, linha: `${v.nome} → ${MAPA[v.nome]}` });
    if (v.espelhaVD && MAPA[v.espelhaVD]) {
        const m = mudVD.find(x => x.ref.id === d.ref.id);
        if (m) m.patch.espelhaVD = MAPA[v.espelhaVD];
        else mudVD.push({ ref: d.ref, patch: { espelhaVD: MAPA[v.espelhaVD] }, linha: `${v.nome}: espelhaVD → ${MAPA[v.espelhaVD]}` });
    }
}

for (const d of mecSnap.docs) {
    const m = d.data();
    const patch = {};
    let mudou = false;
    if (MAPA[m.nome]) { patch.nome = MAPA[m.nome]; mudou = true; }
    if (typeof m.previewTexto === 'string') {
        let p = m.previewTexto;
        for (const [de, para] of Object.entries(MAPA)) p = p.split(de).join(para);
        if (p !== m.previewTexto) { patch.previewTexto = p; mudou = true; }
    }
    if (m.config && Array.isArray(m.config.calculos)) {
        let tocou = false;
        const calcs = m.config.calculos.map(c => {
            const novo = { ...c };
            if (MAPA[c.alvo]) { novo.alvo = MAPA[c.alvo]; tocou = true; }
            if (Array.isArray(c.equacao)) {
                const eq = c.equacao.map(t => (t && MAPA[t.ref]) ? (tocou = true, { ...t, ref: MAPA[t.ref] }) : t);
                novo.equacao = eq;
            }
            return novo;
        });
        if (tocou) { patch.config = { ...m.config, calculos: calcs }; mudou = true; }
    }
    if (mudou) mudMec.push({ ref: d.ref, patch, linha: `${m.nome}${patch.nome ? ' → ' + patch.nome : ''}` });
}

/* refs por nome em equações de item: não deve existir (vínculo é por ID) */
for (const d of eqSnap.docs) {
    const e = d.data();
    for (const v of e.valoresDerivadosVinculados || []) {
        for (const t of v.equacao || []) {
            if (t && MAPA[t.ref]) erros.push(`REF POR NOME EM ITEM · ${e.nome}: ${t.ref}`);
        }
    }
}

console.log(`\n=== renomear canais de Essência ===\n`);
for (const m of mudVD) console.log(`  VD   ${m.linha}`);
for (const m of mudMec) console.log(`  MEC  ${m.linha}`);
console.log(`\nVDs a renomear      : ${mudVD.length}   (esperado: 26)`);
console.log(`mecânicas ajustadas : ${mudMec.length}`);
for (const er of erros) console.error(`  🔴 ${er}`);

if (erros.length || mudVD.length !== 26) { console.error(`\n🔴 ABORTADO — contagem não bate.`); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const m of [...mudVD, ...mudMec]) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${mudVD.length} VDs + ${mudMec.length} mecânicas gravados.`);
process.exit(0);
