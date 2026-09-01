/**
 * CONSERTO DE ERRO MEU — dois habitats inventados e um capítulo construído
 * em cima deles.
 *
 * Ao traduzir as fichas do cofre eu escolhi lugares que a FONTE NÃO DIZ:
 *
 *   Espectro da Seiva Negra
 *     cofre:  "Floresta densas e árvores corrompidas" + link [[Floresta de Sylmari]]
 *     gravei: "Floresta de Velmora"                              ← INVENTADO
 *
 *   Avarbus Azire
 *     cofre:  "Ruínas/Masmorras · Lugares Abandonados · Clima Temperado ou Tropical"
 *     gravei: "Ruínas de Velmora"                                ← INVENTADO
 *
 * Nenhum dos dois cita Velmora em lugar nenhum. E o padrão certo já estava
 * no banco: o **Avarbus comum** guarda `Ruínas/Masmorras, Lugares
 * Abandonados. Clima Temperado ou Tropical.` — as palavras do cofre,
 * verbatim, sem escolher ruína nenhuma. Era só ter copiado.
 *
 * Em cima da invenção eu ainda escrevi o capítulo 13, "O Que Velmora Cria",
 * cuja premissa inteira — dois necrófagos dividindo a mata de Velmora — é
 * minha, não do cânone. Ele é APAGADO.
 *
 * O que este script faz:
 *   1. Espectro  → Floresta de Silmari (o link do próprio cofre)
 *   2. Azire     → a redação genérica do cofre, igual à do Avarbus comum
 *   3. apaga o capítulo 13
 *   4. o Espectro passa a ser o quarto verbete de "A Mata Fechada" (cap. 12,
 *      rascunho) — ele é bicho de floresta e o capítulo é das florestas
 *   5. o Azire ganha um parágrafo em "Predadores de Vasteluna" (cap. 5),
 *      ao lado do irmão dele, no formato de prosa curta daquele capítulo
 *
 * ⚠️ O capítulo 5 está `public: true`. Este script ACRESCENTA um parágrafo
 * nele — não mexe no resto, não vira flag nenhuma.
 *
 *   node functions/conserta-habitats-inventados.mjs            (dry-run)
 *   node functions/conserta-habitats-inventados.mjs --apply
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

const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];
const acha = nome => npcs.find(n => n.nome === nome);
const cap = titulo => arts.find(d => (d.data().title || '') === titulo);

/* ─── 1 e 2: os dois habitats voltam para a fonte ─── */
const avarbusComum = acha('Avarbus');
if (!avarbusComum) erros.push('"Avarbus" (comum) não achado — é dele que sai a redação de referência');

const CORRECOES = [
    { nome: 'Espectro da Seiva Negra',
      local: 'Floresta de Silmari',
      habitat: 'Floresta de Silmari — mata densa e árvores corrompidas',
      porque: 'a nota do cofre linka [[Floresta de Sylmari]]; "Sylmari" é a grafia velha de Silmari' },
    { nome: 'Avarbus Azire',
      local: avarbusComum?.local || 'Ruínas/Masmorras',
      habitat: avarbusComum?.criatura?.habitat || 'Ruínas/Masmorras, Lugares Abandonados. Clima Temperado ou Tropical.',
      porque: 'palavras do cofre, verbatim — a mesma redação que o Avarbus comum já usa no banco' },
];
for (const c of CORRECOES) {
    const n = acha(c.nome);
    if (!n) { erros.push(`"${c.nome}" não achado em npcs`); continue; }
    c.ref = db.collection('npcs').doc(n.id);
    c.localAntes = n.local; c.habitatAntes = n.criatura?.habitat;
    c.ficha = n;
}

/* ─── 4 e 5: os verbetes ─── */
const verbete = (nome, abertura) => {
    const n = acha(nome);
    if (!n) { erros.push(`"${nome}" não achado`); return ''; }
    const c = n.criatura || {}, vd = n.valoresDer || {};
    const comp = String(c.comportamento || '');
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
    if (!g) { erros.push(`"${nome}": golpe não legível`); return ''; }
    const am = String(c.nivelAmeaca || '');
    const grau = am.split(' · ')[0], forca = (/(\d+,\d+)×/.exec(am) || [])[1], dens = am.split(' · ')[2] || '';
    const indomavel = (/Indomável: ([^·]+)/.exec(am) || [])[1];
    const p = rx => (rx.exec(comp) || [])[1];
    const efeito = comp.split('\n')[0];
    const sinal = p(/^O SINAL: (.+)$/m), regra = p(/^A REGRA: (.+)$/m);
    const remedio = p(/^O REMÉDIO: (.+)$/m), moral = p(/^A MORAL: (.+)$/m);
    const m = /RITO DE DOMA\s*\nChamariz: (.+)\nPreço: (.+)\nA prova: (.+)\nO erro: (.+)/.exec(comp);
    const redutor = (/Redutor (−?\d+|0)/.exec(am) || [])[1];
    const lealIni = (/Lealdade começa em (\d+)/.exec(am) || [])[1];
    const lealFim = (/vínculo exige (\d+)/.exec(am) || [])[1];
    const sess = (/(\d+) sessões ao todo/.exec(am) || [])[1];
    if (!sinal || !regra || !remedio || !grau || !forca) { erros.push(`"${nome}": ficha incompleta para verbete`); return ''; }
    return `
<h3>${esc(nome)}</h3>
<p>${esc(abertura)}</p>
<pre>Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${num(Number(vd.VIT).toFixed(1))}   Blindagem ${num(vd.BLD ?? 0)}   ${esc(vd.DESLOCAMENTO || '—')}
${esc(grau)} · ${forca}× o guerreiro · ${esc(dens)}</pre>
<p><strong>O que ele faz.</strong> ${esc(efeito)}</p>
<ul>
<li><strong>O sinal:</strong> ${esc(sinal)}</li>
<li><strong>A regra:</strong> ${esc(regra)}</li>
<li><strong>O remédio:</strong> ${esc(remedio)}</li>
</ul>
${moral ? `<p><em>${esc(moral)}</em></p>\n` : ''}${m ? `<p><strong>Como domar.</strong> ${esc(m[1])}</p>
<ul>
<li><strong>O preço:</strong> ${esc(m[2])}</li>
<li><strong>A prova:</strong> ${esc(m[3])} <em>AUT + Domar${redutor && redutor !== '0' ? `, Redutor ${redutor}` : ', sem Redutor'}.</em></li>
<li><strong>O erro:</strong> ${esc(m[4])}</li>
</ul>
<p>Depois de aceita, a Lealdade começa em <strong>${lealIni}</strong> e o vínculo exige <strong>${lealFim}</strong>${sess ? ` — <strong>${sess} sessões</strong> de convivência` : ' — já nasce vinculada'}.</p>`
        : `<p><strong>Não se doma.</strong> ${esc(String(indomavel).trim())}.</p>`}
`;
};

/* cap. 12 — de três para quatro, o Espectro entra como bicho de mata */
const c12 = cap('A Mata Fechada');
if (!c12) erros.push('capítulo "A Mata Fechada" não achado');
let html12 = null, words12 = 0;
if (c12) {
    const atual = String(c12.data().contentHTML || '');
    const introAntiga = `<p>As duas florestas do Vale — a de <strong>Silmarela</strong>, que Sereni alcança a pé, e a de <strong>Silmari</strong>, que é a mata grande — têm as mesmas três criaturas, e cada uma cobra um erro diferente.</p>`;
    const introNova = `<p>As duas florestas do Vale — a de <strong>Silmarela</strong>, que Sereni alcança a pé, e a de <strong>Silmari</strong>, que é a mata grande — cobram cada uma o seu erro. Três das quatro criaturas deste capítulo vivem nas duas matas; a quarta, o <strong>Espectro da Seiva Negra</strong>, é da mata grande e só dela.</p>`;
    if (!atual.includes(introAntiga)) erros.push('cap. 12: a introdução não bate com o que eu gravei — confira à mão');
    const fechoAntigo = `<p>Nenhuma das três persegue quem sai. A <strong>Aracasca</strong>`;
    let novo = atual.replace(introAntiga, introNova)
        .replace('<p>Nenhuma das três persegue quem sai.', '<p>Nenhuma das quatro persegue quem sai.')
        .replace('A mata tem três coisas dentro', 'A mata tem coisas dentro');
    novo += verbete('Espectro da Seiva Negra',
        'Contorno que não fecha, gotejando o que corrói. A tocha que você acendeu para vê-lo é a luz fraca a que ele é imune, e agora ele sabe onde você está.');
    html12 = novo;
    words12 = novo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    for (const t of ['p', 'h3', 'pre', 'ul', 'li', 'strong', 'em', 'blockquote']) {
        const a = (novo.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
        const f = (novo.match(new RegExp(`</${t}>`, 'g')) || []).length;
        if (a !== f) erros.push(`cap. 12: tag <${t}> desbalanceada — ${a}/${f}`);
    }
}

/* cap. 5 — o Azire ao lado do irmão, no formato de prosa curta do capítulo */
const c5 = cap('Predadores de Vasteluna');
if (!c5) erros.push('capítulo "Predadores de Vasteluna" não achado');
let html5 = null, words5 = 0;
if (c5) {
    const atual = String(c5.data().contentHTML || '');
    const az = acha('Avarbus Azire');
    const am = String(az?.criatura?.nivelAmeaca || '');
    const forca = (/(\d+,\d+)×/.exec(am) || [])[1];
    const vit = Number(az?.valoresDer?.VIT || 0).toFixed(1).replace('.', ',');
    const par = `<p><strong>Avarbus Azire</strong> — o mesmo bicho com azire nos olhos (~${forca} guerreiro, Vitalidade ${vit}). Come cadáver e come <strong>fonte de trevas</strong> — fenda, ruptura, resíduo — e por isso a ruína onde ele está apaga em vez de acender. Permite Avarbus comuns no território dele, mantidos na fronteira, e é alfa deles. Imune a necrótico e a luz; se perder o azire, desmaia. É o único necrófago que aceita acordo: <strong>Domável</strong>, Redutor −3.</p>`;
    const ancora = '<p><strong>Avarbus</strong> —';
    const i = atual.indexOf(ancora);
    if (i < 0) erros.push('cap. 5: não achei o parágrafo do Avarbus para inserir o Azire depois dele');
    else {
        const fim = atual.indexOf('</p>', i) + 4;
        html5 = atual.slice(0, fim) + '\n' + par + atual.slice(fim);
        words5 = html5.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }
}

/* ─── 3: o capítulo inventado ─── */
const c13 = cap('O Que Velmora Cria');
if (!c13) erros.push('capítulo "O Que Velmora Cria" não achado — já foi apagado?');

/* ═══════════ relatório ═══════════ */
console.log('\n=== CONSERTO: dois habitats inventados e o capítulo erguido sobre eles ===\n');
console.log('--- 1 e 2. as fichas voltam para a fonte ---');
for (const c of CORRECOES) {
    if (!c.ref) continue;
    console.log(`\n── ${c.nome}`);
    console.log(`   local    de: ${JSON.stringify(c.localAntes)}\n            para: ${JSON.stringify(c.local)}`);
    console.log(`   habitat  de: ${JSON.stringify(c.habitatAntes)}\n            para: ${JSON.stringify(c.habitat)}`);
    console.log(`   por quê: ${c.porque}`);
}

console.log(`\n--- 3. apagar o capítulo inventado ---`);
console.log(c13 ? `   "${c13.data().title}" (ordem ${c13.data().order}, public=${c13.data().public}) [${c13.id}] — APAGADO` : '   (não existe mais)');

console.log(`\n--- 4. cap. 12 "A Mata Fechada": três → quatro verbetes ---`);
if (html12) {
    console.log(`   ${c12.data().words} → ${words12} palavras`);
    console.log('   intro corrigida, e o Espectro entra como quarto verbete.');
}

console.log(`\n--- 5. cap. 5 "Predadores de Vasteluna" (public=true): + 1 parágrafo ---`);
if (html5) {
    console.log(`   ${c5.data().words} → ${words5} palavras. Só acrescenta; não mexe no resto.\n`);
    console.log(html5.replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim()).map(s => '      ' + s.trim()).join('\n'));
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const c of CORRECOES) batch.update(c.ref, {
    local: c.local, 'criatura.habitat': c.habitat, lastUpdate: iso, lastUpdateBy: AUTOR });
if (c13) batch.delete(c13.ref);
if (html12) batch.update(c12.ref, { contentHTML: html12, words: words12, updatedAt: iso, updatedBy: AUTOR });
if (html5) batch.update(c5.ref, { contentHTML: html5, words: words5, updatedAt: iso, updatedBy: AUTOR });
await batch.commit();
console.log('\n✅ habitats corrigidos, capítulo 13 apagado, caps. 12 e 5 atualizados.');
process.exit(0);
