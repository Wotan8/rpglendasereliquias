/**
 * Publica os capítulos 11 e 12 do Bestiário — depois de conferir que os
 * números impressos neles ainda batem com as fichas.
 *
 * Os verbetes foram gerados da ficha, mas desde então houve recarimbo,
 * condições novas e renomeação de rider. Publicar número velho é pior que
 * não publicar: o capítulo vira uma segunda fonte que discorda da primeira.
 *
 * Este script LÊ cada bloco <pre> dos dois capítulos, recomputa o que ele
 * deveria dizer a partir de `npcs` agora, e só vira o `public` se tudo
 * bater. Divergência aborta.
 *
 *   node functions/publica-caps-11-12.mjs            (dry-run — só confere)
 *   node functions/publica-caps-11-12.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK = 'book_mrs9ur4aw1m6a';
const TITULOS = ['Os Que Não Mordem', 'A Mata Fechada'];

const num = v => String(v).replace('.', ',');
const npcs = (await db.collection('npcs').get()).docs.map(d => d.data());
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [], divergencias = [], alvos = [];

for (const t of TITULOS) {
    const doc = arts.find(d => (d.data().title || '') === t);
    if (!doc) { erros.push(`capítulo "${t}" não achado`); continue; }
    const d = doc.data();
    const html = String(d.contentHTML || '');
    alvos.push({ ref: doc.ref, id: doc.id, title: t, order: d.order, publicAntes: d.public, words: d.words });

    /* cada verbete: <h3>Nome</h3> … <pre>linha1\nlinha2</pre> */
    const blocos = [...html.matchAll(/<h3>([^<]+)<\/h3>[\s\S]*?<pre>([\s\S]*?)<\/pre>/g)];
    if (!blocos.length) erros.push(`"${t}": nenhum verbete com <pre> encontrado`);

    for (const [, nome, pre] of blocos) {
        const n = npcs.find(x => x.nome === nome && x.tipo === 'criatura');
        if (!n) { erros.push(`"${t}" → "${nome}": ficha não achada em npcs`); continue; }

        const [l1 = '', l2 = ''] = pre.trim().split('\n');
        const vd = n.valoresDer || {}, c = n.criatura || {};
        const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
        const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
        if (!g) { erros.push(`"${nome}": golpe não legível na ficha`); continue; }

        const l1Esperada = `Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${num(Number(vd.VIT).toFixed(1))}   Blindagem ${num(vd.BLD ?? 0)}   ${vd.DESLOCAMENTO || '—'}`;
        const am = String(c.nivelAmeaca || '');
        const grau = am.split(' · ')[0], forca = (/(\d+,\d+)×/.exec(am) || [])[1], dens = am.split(' · ')[2] || '';
        const l2Esperada = `${grau} · ${forca}× o guerreiro · ${dens}`;

        if (l1.trim() !== l1Esperada) divergencias.push({ cap: t, nome, campo: 'stats', no: l1.trim(), ficha: l1Esperada });
        if (l2.trim() !== l2Esperada) divergencias.push({ cap: t, nome, campo: 'carimbo', no: l2.trim(), ficha: l2Esperada });
    }
}

/* ── relatório ── */
console.log('\n=== Conferência antes de publicar ===\n');
for (const a of alvos) console.log(`   ${String(a.order).padStart(2)}. ${a.title.padEnd(22)} public=${a.publicAntes} → true   (${a.words} palavras)  [${a.id}]`);

if (divergencias.length) {
    console.log(`\n❌ ${divergencias.length} divergência(s) entre o capítulo e a ficha — NÃO publico número velho:`);
    for (const d of divergencias) {
        console.log(`\n   [${d.cap}] ${d.nome}  (${d.campo})`);
        console.log(`      no capítulo: ${d.no}`);
        console.log(`      na ficha:    ${d.ficha}`);
    }
    console.log('\n   Rode o gerador do capítulo de novo antes de publicar.');
    process.exit(1);
}
console.log(`\n✅ todos os verbetes batem com a ficha — Alvo, dado, Vitalidade, Blindagem, Deslocamento, Grau, força e densidade.`);

if (erros.length) { console.log('\n❌ ERROS:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para publicar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const a of alvos) batch.update(a.ref, { public: true, status: 'publicado', updatedAt: iso, updatedBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${alvos.length} capítulos publicados.`);
process.exit(0);
