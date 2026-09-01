/**
 * Refresca os blocos <pre> de TODOS os capítulos do Bestiário a partir das
 * fichas. Companheiro do `bestiario-recarimba.mjs`: aquele arruma o carimbo
 * na ficha, este propaga o carimbo para o livro.
 *
 * O livro guarda os números em bloco <pre> dentro de cada verbete:
 *
 *     Alvo 7   1d6+3   Vitalidade 20,1   Blindagem 1,1   9m
 *     Comum · 0,69× o guerreiro · solitária e territorial, uma por trecho de copa
 *
 * As duas linhas são 100% deriváveis da ficha. Este script reescreve só elas
 * — a prosa, a abertura, o rito de doma e as listas ficam intactos. Genérico
 * e re-executável: rode sempre que recarimbar.
 *
 *   node functions/bestiario-refresca-pre.mjs            (dry-run)
 *   node functions/bestiario-refresca-pre.mjs --apply
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

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = v => String(v).replace('.', ',');
const npcs = (await db.collection('npcs').get()).docs.map(d => d.data()).filter(n => n.tipo === 'criatura');
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];

/* as duas linhas do <pre>, montadas da ficha e de mais lugar nenhum */
const preDaFicha = nome => {
    const n = npcs.find(x => x.nome === nome);
    if (!n) return { erro: `"${nome}" não achada em npcs` };
    const vd = n.valoresDer || {}, c = n.criatura || {};
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
    if (!g) return { erro: `"${nome}": golpe não legível — "${atq}"` };
    const am = String(c.nivelAmeaca || '');
    const grau = am.split(' · ')[0], forca = (/(\d+,\d+)×/.exec(am) || [])[1], dens = am.split(' · ')[2] || '';
    if (!grau || !forca) return { erro: `"${nome}": nivelAmeaca sem Grau ou força` };
    return { texto:
`Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${num(Number(vd.VIT).toFixed(1))}   Blindagem ${num(vd.BLD ?? 0)}   ${esc(vd.DESLOCAMENTO || '—')}
${esc(grau)} · ${forca}× o guerreiro · ${esc(dens)}` };
};

const plano = [];
for (const doc of arts.sort((a, b) => (a.data().order || 0) - (b.data().order || 0))) {
    const d = doc.data();
    const html = String(d.contentHTML || '');
    let novo = html;
    const trocas = [];

    /* cada par <h3>Nome</h3> … <pre>…</pre>; só o <pre> daquele verbete muda */
    for (const m of html.matchAll(/<h3>([^<]+)<\/h3>([\s\S]*?)<pre>([\s\S]*?)<\/pre>/g)) {
        const [inteiro, nome, meio, preAtual] = m;
        const r = preDaFicha(nome.trim());
        if (r.erro) {
            /* <h3> que não é nome de criatura (subtítulo de capítulo de regra) — ignora */
            if (!npcs.some(x => x.nome === nome.trim())) continue;
            erros.push(`[${d.title}] ${r.erro}`); continue;
        }
        /* Alguns verbetes têm uma TERCEIRA linha escrita à mão no mesmo <pre>
           ("Na Fusão Selvagem empresta faro e audição."). Só as duas primeiras
           são deriváveis da ficha; o resto é texto e fica. */
        const extras = preAtual.trim().split('\n').slice(2);
        const alvo = [r.texto, ...extras].join('\n');
        if (preAtual.trim() === alvo.trim()) continue;
        novo = novo.replace(inteiro, `<h3>${nome}</h3>${meio}<pre>${alvo}</pre>`);
        trocas.push({ nome, de: preAtual.trim(), para: alvo.trim(), extras: extras.length });
    }
    if (!trocas.length) continue;
    plano.push({ ref: doc.ref, order: d.order, title: d.title, publicado: d.public, trocas, html: novo,
        words: novo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
}

/* ── relatório ── */
console.log(`\n=== Refresh dos blocos <pre> — ${plano.length} capítulo(s) desatualizado(s) ===\n`);
for (const p of plano) {
    console.log(`── ${String(p.order).padStart(2)}. ${p.title}${p.publicado ? '  ✅ JÁ PUBLICADO' : '  (rascunho)'}   ${p.trocas.length} verbete(s)`);
    for (const t of p.trocas) {
        const [a1, a2] = t.de.split('\n'), [b1, b2] = t.para.split('\n');
        console.log(`\n   ${t.nome}`);
        if (a1 !== b1) { console.log(`      de:   ${a1}`); console.log(`      para: ${b1}`); }
        if (a2 !== b2) { console.log(`      de:   ${a2}`); console.log(`      para: ${b2}`); }
    }
    console.log('');
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
if (!plano.length) { console.log('✅ todos os blocos <pre> já batem com as fichas. Nada a fazer.'); process.exit(0); }
console.log('✅ conferências OK. Só as duas linhas de número mudam; prosa, rito e listas ficam.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, { contentHTML: p.html, words: p.words, updatedAt: iso, updatedBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} capítulos com os números da ficha.`);
process.exit(0);
