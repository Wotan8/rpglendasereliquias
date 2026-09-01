/**
 * Publica os seis capítulos que faltam do Bestiário — depois de conferir os
 * números em DOIS formatos.
 *
 * Os capítulos 6 a 10 têm verbete com bloco <pre>, que é fácil de conferir.
 * O capítulo 1, "O Nível de Ameaça", é diferente: ele cita força e Grau em
 * PROSA e em TABELA, e é o capítulo que explica a escada inteira. Hoje sete
 * carimbos mudaram (Serpente, Vidrela, Avarbus, Velocirops, Papa-Noite,
 * Górbal, Ratazana) — se ele estiver citando os antigos, publicá-lo é
 * espalhar número velho no capítulo que serve de régua para os outros.
 *
 * Duas conferências, então:
 *
 *   A. bloco <pre> de verbete   → recomputa da ficha e compara linha a linha
 *   B. força solta no texto     → para cada "N,NN×" achado perto do nome de
 *                                 uma criatura, compara com o carimbo atual
 *
 * Divergência não publica. O capítulo fica em rascunho e o relatório diz o
 * que reescrever.
 *
 *   node functions/publica-caps-restantes.mjs            (dry-run)
 *   node functions/publica-caps-restantes.mjs --apply
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

const num = v => String(v).replace('.', ',');
const npcs = (await db.collection('npcs').get()).docs.map(d => d.data()).filter(n => n.tipo === 'criatura');
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];

const forcaDoCarimbo = n => {
    const m = /(\d+,\d+)×/.exec(String(n.criatura?.nivelAmeaca || ''));
    return m ? m[1] : null;
};
const grauDoCarimbo = n => String(n.criatura?.nivelAmeaca || '').split(' · ')[0] || null;

const relatorio = [];
for (const doc of arts.sort((a, b) => (a.data().order || 0) - (b.data().order || 0))) {
    const d = doc.data();
    if (d.public) continue;                      // já publicado, não mexe
    const html = String(d.contentHTML || '');
    const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const probs = [];

    /* ── A. verbetes com <pre> ── */
    const blocos = [...html.matchAll(/<h3>([^<]+)<\/h3>[\s\S]*?<pre>([\s\S]*?)<\/pre>/g)];
    for (const [, nome, pre] of blocos) {
        const n = npcs.find(x => x.nome === nome);
        /* <h3> que não é nome de criatura é subtítulo de capítulo de regra
           ("Os seis graus", "A conta do inimigo solitário") — não é verbete. */
        if (!n) continue;
        const [l1 = '', l2 = ''] = pre.trim().split('\n');
        const vd = n.valoresDer || {};
        const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
        const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
        if (!g) { probs.push({ tipo: 'golpe ilegível', nome, detalhe: atq }); continue; }
        const e1 = `Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${num(Number(vd.VIT).toFixed(1))}   Blindagem ${num(vd.BLD ?? 0)}   ${vd.DESLOCAMENTO || '—'}`;
        const e2 = `${grauDoCarimbo(n)} · ${forcaDoCarimbo(n)}× o guerreiro · ${String(n.criatura?.nivelAmeaca).split(' · ')[2] || ''}`;
        if (l1.trim() !== e1) probs.push({ tipo: 'stats', nome, no: l1.trim(), ficha: e1 });
        if (l2.trim() !== e2) probs.push({ tipo: 'carimbo', nome, no: l2.trim(), ficha: e2 });
    }

    /* ── B. força citada solta no texto ──
       Por FRASE, não por janela de N caracteres: "O Lobo, o Urso e o Servo
       Reanimado são Comuns." não cita força nenhuma, e uma janela larga
       pegava o "1,0×" da frase seguinte e acusava os três. E a comparação é
       NUMÉRICA — "1,0" e "1,00" são o mesmo número escrito de dois jeitos. */
    const comPre = new Set(blocos.map(b => b[1]));
    const frases = texto.split(/(?<=[.;:])\s+/);
    const igual = (a, b) => Math.abs(Number(String(a).replace(',', '.')) - Number(String(b).replace(',', '.'))) < 0.005;
    for (const n of npcs) {
        if (comPre.has(n.nome)) continue;                       // já conferido no bloco A
        const f = forcaDoCarimbo(n);
        if (!f) continue;
        for (const fr of frases) {
            if (!fr.includes(n.nome)) continue;
            const citada = [...fr.matchAll(/(\d+,\d+)×/g)].map(m => m[1]);
            if (!citada.length) continue;

            /* A frase pode citar uma SOMA e não a força individual: "Sete Lobos
               entregam 4,06× e 84 de carne". Quando há contagem antes do nome,
               o certo é conferir a MULTIPLICAÇÃO, não comparar com a unidade. */
            const cnt = new RegExp(`\\b(um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|\\d+)\\s+${n.nome}`, 'i').exec(fr);
            if (cnt) {
                const N = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5,
                    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 }[cnt[1].toLowerCase()] || Number(cnt[1]);
                const esperado = N * Number(f.replace(',', '.'));
                if (!citada.some(c => Math.abs(Number(c.replace(',', '.')) - esperado) < 0.02))
                    probs.push({ tipo: 'soma em prosa', nome: `${N}× ${n.nome}`,
                        no: citada.join(' / '), ficha: `${esperado.toFixed(2).replace('.', ',')} (${N} × ${f})`, contexto: fr.slice(0, 120) });
                continue;
            }
            if (!citada.some(c => igual(c, f))) probs.push({ tipo: 'força em prosa', nome: n.nome,
                no: citada.join(' / '), ficha: f, contexto: fr.slice(0, 120) });
        }
    }

    relatorio.push({ ref: doc.ref, id: doc.id, order: d.order, title: d.title, words: d.words, probs });
}

/* ── relatório ── */
console.log(`\n=== ${relatorio.length} capítulos em rascunho ===\n`);
for (const r of relatorio) {
    const ok = !r.probs.length;
    console.log(`${ok ? '✅' : '❌'} ${String(r.order).padStart(2)}. ${r.title.padEnd(32)} ${String(r.words).padStart(5)} palavras   ${ok ? 'números conferem' : `${r.probs.length} divergência(s)`}`);
}

const sujos = relatorio.filter(r => r.probs.length);
for (const r of sujos) {
    console.log(`\n──────── ${r.order}. ${r.title}`);
    for (const p of r.probs) {
        console.log(`   [${p.tipo}] ${p.nome}`);
        if (p.no !== undefined) {
            console.log(`      no capítulo: ${p.no}`);
            console.log(`      na ficha:    ${p.ficha}`);
        } else console.log(`      ${p.detalhe}`);
        if (p.contexto) console.log(`      contexto:    …${p.contexto}…`);
    }
}

const limpos = relatorio.filter(r => !r.probs.length);
console.log(`\n${limpos.length} capítulo(s) prontos para publicar; ${sujos.length} ficam em rascunho até serem corrigidos.`);

if (erros.length) { console.log('\n❌ ERROS:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
if (!limpos.length) { console.log('\nNada a publicar.'); process.exit(0); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para publicar os que conferem.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const r of limpos) batch.update(r.ref, { public: true, status: 'publicado', updatedAt: iso, updatedBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${limpos.length} capítulos publicados.${sujos.length ? ` ${sujos.length} deixado(s) em rascunho.` : ''}`);
process.exit(0);
