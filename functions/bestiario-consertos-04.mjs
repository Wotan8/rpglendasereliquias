/**
 * Geografia — a hierarquia de Silmari, e as correções de Sereni.
 *
 * O banco tratava "Floresta de Silmari" como o topo e pendurava o Vale de
 * Silmarela dentro dela. Está errado: SILMARI É UMA REGIÃO. Dentro dela ficam
 * a Floresta de Silmari (a mata imensa) E o Vale de Silmarela — irmãos, não
 * pai e filho.
 *
 *   Região de Silmari
 *   ├─ Floresta de Silmari
 *   └─ Vale de Silmarela
 *      ├─ Sereni · Onéria · Ondúria · Arnavar · Khar Dul · Ermida de Silmarela
 *      ├─ Floresta de Silmarela   (novo)
 *      ├─ Floresta de Velmora
 *      ├─ Planície de Velmora     (novo)
 *      ├─ Planície de Silmarela   (novo)
 *      └─ Borda de Silmarela      (novo)
 *
 *  1. Cria a Região de Silmari e os quatro locais novos, como ESBOÇO —
 *     descrição em branco marcada [LACUNA]. Nada de lore inventada.
 *  2. Reancora Floresta de Silmari e Vale de Silmarela na Região.
 *  3. Reescreve a descrição da Floresta de Silmari, que dizia abrigar o Vale e
 *     Sereni, e tira a tag "Sereni" dela.
 *  4. Fecha o [A CONFIRMAR] da Floresta de Velmora: ela é do Vale, sim.
 *  5. Sereni: população ~100 → 271.
 *  6. Sereni não tem muralha. Thorkan, Burkan e Zorkan são guardas da vila —
 *     os mais conhecidos, e só. Sai "Muralha" do papel e das tags.
 *  7. Tiric e Selith moram na Borda de SILMARELA, não de Silmari.
 *
 *   node functions/bestiario-consertos-04.mjs            (dry-run)
 *   node functions/bestiario-consertos-04.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const LACUNA = '[LACUNA] Local criado para fechar a hierarquia de Silmari. Descrição a preencher.';

const geoSnap = await db.collection('worldbuilding-geography').get();
const geo = geoSnap.docs;
const npcSnap = await db.collection('npcs').get();
const acha = nome => geo.filter(d => (d.data().nome || '') === nome);
const erros = [];
const plano = [];

/* ── 1 · a Região e os quatro locais novos ── */
const NOVOS = [
    { nome: 'Região de Silmari', tipo: 'Região', pai: null },
    { nome: 'Floresta de Silmarela', tipo: 'Região', pai: 'Vale de Silmarela' },
    { nome: 'Planície de Velmora', tipo: 'Região', pai: 'Vale de Silmarela' },
    { nome: 'Planície de Silmarela', tipo: 'Região', pai: 'Vale de Silmarela' },
    { nome: 'Borda de Silmarela', tipo: 'Região', pai: 'Vale de Silmarela' },
];
for (const n of NOVOS) if (acha(n.nome).length) erros.push(`local "${n.nome}" já existe`);

const um = (nome) => {
    const d = acha(nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); return null; }
    return d[0];
};
const floresta = um('Floresta de Silmari');
const vale = um('Vale de Silmarela');
const velmora = um('Floresta de Velmora');
const sereni = um('Sereni');

const DESC_NOVA = 'A grande mata da Região de Silmari — e apenas ela: a floresta não abriga o Vale de '
    + 'Silmarela, os dois são irmãos dentro da mesma região. Mapas dela circulam no mercado negro; a '
    + 'banca Linhas Falsas, na Feira do Submundo, vende um.';

if (floresta) {
    plano.push({ o: `Floresta de Silmari · descrição`, de: String(floresta.data().descricao || '').slice(0, 150) + '…', para: DESC_NOVA.slice(0, 150) + '…' });
    plano.push({ o: `Floresta de Silmari · tags`, de: floresta.data().tags, para: '' });
    plano.push({ o: `Floresta de Silmari · pertenceA`, de: floresta.data().pertenceA?.nome ?? 'null', para: 'Região de Silmari' });
}
if (vale) plano.push({ o: `Vale de Silmarela · pertenceA`, de: vale.data().pertenceA?.nome ?? 'null', para: 'Região de Silmari' });
if (velmora) plano.push({ o: `Floresta de Velmora · notas`, de: '…"Não está documentado se pertence ao Vale — confirmar"', para: 'confirmado: pertence ao Vale de Silmarela' });
if (sereni) plano.push({ o: `Sereni · população`, de: sereni.data().populacao, para: '271' });

/* ── 6 · os três irmãos ── */
const IRMAOS = ['Thorkan', 'Burkan', 'Zorkan'];
const irmaos = [];
for (const nome of IRMAOS) {
    const d = npcSnap.docs.filter(x => (x.data().nome || '') === nome);
    if (d.length !== 1) { erros.push(`irmão "${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    const papel = String(n.papel || '').replace(/Guarda da Muralha/i, 'Guarda de Sereni');
    const tags = String(n.tags || '').split(',').map(s => s.trim())
        .filter(t => t && !/^-?\s*muralha/i.test(t)).join(', ');
    if (papel === n.papel && tags === n.tags) { erros.push(`"${nome}" não mudou — a âncora "Muralha" não bateu`); continue; }
    irmaos.push({ ref: d[0].ref, nome, papel, tags, antes: { papel: n.papel, tags: n.tags } });
}

/* ── 7 · Tiric e Selith ── */
const BORDA = [];
for (const doc of npcSnap.docs) {
    const n = doc.data();
    if (!/Borda de Silmari\b/.test(String(n.local || ''))) continue;
    BORDA.push({ ref: doc.ref, nome: n.nome, de: n.local, para: String(n.local).replace(/Borda de Silmari\b/, 'Borda de Silmarela') });
}
if (!BORDA.length) erros.push('nenhum NPC em "Borda de Silmari" — a âncora não bateu');

/* ── relatório ── */
console.log('\n=== Geografia · hierarquia de Silmari ===\n');
console.log(`LOCAIS NOVOS (esboço, descrição em [LACUNA]):`);
for (const n of NOVOS) console.log(`   + ${n.nome} (${n.tipo}) ⊂ ${n.pai || '—'}`);
console.log(`\nALTERAÇÕES:`);
for (const p of plano) console.log(`   ~ ${p.o}\n        de:   ${p.de}\n        para: ${p.para}`);
console.log(`\nOS TRÊS IRMÃOS (guardas de Sereni, não de muralha):`);
for (const i of irmaos) {
    console.log(`   ~ ${i.nome}`);
    console.log(`        papel: "${i.antes.papel}" → "${i.papel}"`);
    console.log(`        tags:  "${i.antes.tags}"\n            →  "${i.tags}"`);
}
console.log(`\nBORDA DE SILMARELA:`);
for (const b of BORDA) console.log(`   ~ ${b.nome}: "${b.de}" → "${b.para}"`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ── gravação ── */
const iso = new Date().toISOString();
const col = db.collection('worldbuilding-geography');
const criados = {};
for (const n of NOVOS) {
    const ref = col.doc();
    criados[n.nome] = ref.id;
    await ref.set({
        nome: n.nome, tipo: n.tipo, descricao: LACUNA,
        clima: '', governo: '', populacao: '', recursos: '', perigos: '',
        landmarks: '', historiaLocal: '', notas: LACUNA, tags: '',
        linkedNpcs: [], linkedTribos: [],
        pertenceA: n.pai ? { id: criados[n.pai] || acha(n.pai)[0]?.id, nome: n.pai, tipo: 'Região' } : null,
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
}
const regiao = { id: criados['Região de Silmari'], nome: 'Região de Silmari', tipo: 'Região' };
const batch = db.batch();
batch.update(floresta.ref, { descricao: DESC_NOVA, tags: '', pertenceA: regiao, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(vale.ref, { pertenceA: regiao, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(velmora.ref, {
    notas: String(velmora.data().notas || '').replace(
        /Não está documentado se pertence ao Vale de Silmarela — confirmar com o Mestre\.?/,
        'Pertence ao Vale de Silmarela (confirmado em 28/08/2026).'),
    lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(sereni.ref, { populacao: '271', lastUpdate: iso, lastUpdateBy: AUTOR });
for (const i of irmaos) batch.update(i.ref, { papel: i.papel, tags: i.tags, lastUpdate: iso, lastUpdateBy: AUTOR });
for (const b of BORDA) batch.update(b.ref, { local: b.para, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${NOVOS.length} locais criados · hierarquia reancorada · Sereni 271 · ${irmaos.length} irmãos · ${BORDA.length} NPCs na Borda de Silmarela.`);
process.exit(0);
