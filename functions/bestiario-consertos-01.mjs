/**
 * Bestiário — consertos estruturais (nenhum número de régua muda aqui).
 *
 *  1. Apaga "Guardião das Gramíneas Ancestrais" — criatura sem conexão com o cenário.
 *  2. Apaga a Águia Tempestuosa duplicada (a órfã, sem vínculo). Fica a que tem vínculo.
 *  3. As 11 invocáveis/companheiras estão com `tipo: 'npc'` e bloco `criatura{}` cheio.
 *     Viram `tipo: 'criatura'` — passam a ter selo 🐉, entram no filtro e na busca.
 *  4. Gorren-Nhar e Ibirá são NPCs, não criaturas. Viram `tipo: 'npc'`; o texto que
 *     morava em `criatura{}` é migrado para `rolePlay.historia` antes de o bloco ser
 *     zerado — senão o primeiro save do Painel o apagaria (o painel grava
 *     `criatura: tipo === 'criatura' ? {...} : null`).
 *
 * Os dois documentos apagados vão para backup-bestiario-consertos-01.json antes.
 *
 *   node functions/bestiario-consertos-01.mjs            (dry-run)
 *   node functions/bestiario-consertos-01.mjs --apply
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const APAGAR_NOME = 'Guardião das Gramíneas Ancestrais';
const AGUIA_ORFA = 'xI3BUZuBxbnkI1wWRX6p';   // 0 vínculos; a irmã NJTgz… tem 1
const VIRAM_CRIATURA = ['Fantoche', 'Servo Reanimado', 'Lobo', 'Urso', 'Corvo', 'Serpente',
    'Cria Menor do Véu', 'Cria da Fenda', 'Horror Rastejante', 'Horror Maior', 'Entidade da Oitava'];
const VIRAM_NPC = ['Gorren-Nhar, o Porteiro', 'Ibirá'];

const npcs = (await db.collection('npcs').get()).docs;
const acha = nome => npcs.filter(d => d.data().nome === nome);
const erros = [];

/* ── 1 e 2 · o que sai ── */
const apagar = [];
const g = acha(APAGAR_NOME);
if (g.length !== 1) erros.push(`"${APAGAR_NOME}": esperava 1 doc, achei ${g.length}`);
else apagar.push(g[0]);

const aguias = acha('Águia Tempestuosa');
if (aguias.length !== 2) erros.push(`Águia Tempestuosa: esperava 2 docs, achei ${aguias.length}`);
else {
    const orfa = aguias.find(d => d.id === AGUIA_ORFA);
    const fica = aguias.find(d => d.id !== AGUIA_ORFA);
    if (!orfa) erros.push(`Águia órfã ${AGUIA_ORFA} não achada`);
    else if ((orfa.data().vinculos || []).length) erros.push('a Águia marcada como órfã TEM vínculo — pare e confira');
    else { apagar.push(orfa); console.log(`   (fica a Águia ${fica.id}, com ${(fica.data().vinculos || []).length} vínculo)`); }
}

/* ── 3 · npc → criatura ── */
const viramCriatura = [];
for (const nome of VIRAM_CRIATURA) {
    const d = acha(nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    if (n.tipo === 'criatura') { console.log(`   "${nome}" já é criatura — pulado`); continue; }
    if (!n.criatura) { erros.push(`"${nome}" não tem bloco criatura — não é o alvo certo`); continue; }
    viramCriatura.push(d[0]);
}

/* ── 4 · criatura → npc, migrando o texto ── */
const viramNpc = [];
for (const nome of VIRAM_NPC) {
    const d = acha(nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    if (n.tipo === 'npc') { console.log(`   "${nome}" já é npc — pulado`); continue; }
    const c = n.criatura || {};
    const linhas = [
        c.habitat && `Onde é encontrado: ${c.habitat}`,
        c.comportamento && `Comportamento: ${c.comportamento}`,
        c.dieta && c.dieta !== 'Nenhuma' && `Dieta: ${c.dieta}`,
    ].filter(Boolean);
    const rp = n.rolePlay || {};
    const historia = [String(rp.historia || '').trim(), linhas.join('\n')].filter(Boolean).join('\n\n');
    viramNpc.push({ doc: d[0], historia, migrado: linhas });
}

/* ── relatório ── */
console.log(`\n=== Bestiário · consertos estruturais ===\n`);
console.log(`APAGA (${apagar.length}):`);
for (const d of apagar) console.log(`   ✗ ${d.data().nome} [${d.id}]  tipo=${d.data().tipo} vinculos=${(d.data().vinculos || []).length}`);
console.log(`\nnpc → criatura (${viramCriatura.length}):`);
for (const d of viramCriatura) console.log(`   🐉 ${d.data().nome}`);
console.log(`\ncriatura → npc (${viramNpc.length}):`);
for (const v of viramNpc) {
    console.log(`   👤 ${v.doc.data().nome} — migra para rolePlay.historia:`);
    for (const l of v.migrado) console.log(`        · ${l}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ── gravação ── */
const backup = apagar.map(d => ({ id: d.id, ...d.data() }));
fs.writeFileSync('backup-bestiario-consertos-01.json', JSON.stringify(backup, null, 2), 'utf8');
console.log(`\n💾 backup dos apagados em functions/backup-bestiario-consertos-01.json`);

const agora = new Date().toISOString();
const batch = db.batch();
for (const d of apagar) batch.delete(d.ref);
for (const d of viramCriatura) batch.update(d.ref, { tipo: 'criatura', lastUpdate: agora, lastUpdateBy: AUTOR });
for (const v of viramNpc) batch.update(v.doc.ref, {
    tipo: 'npc', criatura: null, 'rolePlay.historia': v.historia, lastUpdate: agora, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${apagar.length} apagados · ${viramCriatura.length} viraram criatura · ${viramNpc.length} viraram npc.`);
process.exit(0);
