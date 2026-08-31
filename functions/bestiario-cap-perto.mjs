/**
 * Bestiário · capítulo 10 — "Os Que Vivem Perto".
 *
 * As seis criaturas do Vale que o Druida realmente pode ter. Todas cabem no
 * orçamento de companheiro, e todas são definidas pela mesma coisa: o que
 * tiram das pessoas, ou o que dão.
 *
 * Mesmo gerador dos capítulos anteriores — todo número sai da ficha.
 *
 *   node functions/bestiario-cap-perto.mjs            (dry-run)
 *   node functions/bestiario-cap-perto.mjs --apply
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

const TITULO = 'Os Que Vivem Perto';
const SINOPSE = 'O rebanho, o cão e as quatro pragas que valem uma coleira — as seis criaturas do Vale '
    + 'que um Druida pode realmente ter, e o que cada uma empresta na Fusão Selvagem.';

const INTRO = `<blockquote><p><em>"Praga é o bicho que a gente ainda não descobriu para que serve."</em></p></blockquote>

<p>As seis deste capítulo não são as maiores nem as mais perigosas do Vale. São as que ninguém precisa procurar: já estão no pasto, na rede, na horta, na lavoura e no telhado. E é justamente por isso que valem — <strong>toda vila do Vale sabe como cada uma se comporta, porque convive com elas há gerações.</strong> O conhecimento que o Druida precisa já está na boca do pastor e do pescador.</p>

<p>Cinco das seis são chamadas de praga por alguém. O Rouba-Rede rasga a rede do Tiric; o Papa-Broto come a cevada da Darva antes de virar cerveja; o Fuça-Fundo revira a horta de quem plantou perto da mata; o Rasga-Palha abre o telhado do galinheiro. Só o Fenor não incomoda ninguém — e o Cão-Pastor existe por causa dele.</p>

<p><strong>Todas cabem no orçamento de companheiro</strong>, entre 0,19× e 0,56× o guerreiro. Nenhuma chega pronta: todas ainda têm as cinco melhorias de Lealdade para crescer, e é isso que as separa de um Velocirops domado.</p>

<p>E cada uma abre uma Dádiva diferente na Fusão Selvagem. Antes delas, o Druida do Vale escolhia entre voo, faro, couro e peçonha — o que os quatro companheiros clássicos entregam. <strong>Nadar, escavar, saltar, ouvir e carregar não tinham bicho.</strong> Agora têm.</p>`;

/* nome → [abertura, dádiva] */
const BICHOS = [
    ['Fenor', 'O rebanho de Sereni. Dá lã, leite e o queijo que sai daqui para as outras vilas — e é a razão de haver pastor.', 'carga e resistência'],
    ['Cão-Pastor', 'Ferramenta de pastor, e tratado como tal, o que em Sereni significa melhor do que a maioria das pessoas trata gente. Late antes de haver motivo.', 'faro e audição'],
    ['Rouba-Rede', 'Rasga a rede pelo meio, come um peixe e deixa os outros. Não é fome: é o mais fácil. Tiric conserta a dele há anos e nunca matou um.', 'nadar e fôlego'],
    ['Fuça-Fundo', 'A vila o caça e o odeia nas mesmas semanas. Onde ele fuçou, o que presta já saiu do chão — e o herborista aprende a andar atrás dele.', 'faro e escavar'],
    ['Papa-Broto', 'Come o broto, não a planta. Por isso a lavoura não morre: só rende menos, todo ano, para sempre. Ninguém tenta exterminar — tenta acompanhar.', 'deslocamento e salto'],
    ['Rasga-Palha', 'Desce no telhado de palha, abre um rombo e leva o pinto pelo buraco. Quem tem paciência descobre a outra metade: a mesma ave aceita o punho.', 'visão e voo'],
];

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];
if (arts.some(d => (d.data().title || '') === TITULO)) erros.push(`capítulo "${TITULO}" já existe`);

const linhas = [];
const verbete = (nome, abertura, dadiva) => {
    const n = npcs.find(x => x.nome === nome);
    if (!n) { erros.push(`"${nome}" não achado`); return ''; }
    if (n.mesaId) { erros.push(`"${nome}" tem mesa`); return ''; }
    const c = n.criatura || {}, vd = n.valoresDer || {};
    const m = /RITO DE DOMA\s*\nChamariz: (.+)\nPreço: (.+)\nA prova: (.+)\nO erro: (.+)/.exec(String(c.comportamento || ''));
    if (!m) { erros.push(`"${nome}": sem RITO DE DOMA`); return ''; }
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
    if (!g) { erros.push(`"${nome}": golpe não legível`); return ''; }
    const am = String(c.nivelAmeaca || '');
    const [grau] = am.split(' · ');
    const forca = (/(\d+,\d+)×/.exec(am) || [])[1];
    const redutor = (/Redutor (−?\d+|0)/.exec(am) || [])[1];
    const lealIni = (/Lealdade começa em (\d+)/.exec(am) || [])[1];
    const lealFim = (/vínculo exige (\d+)/.exec(am) || [])[1];
    const sess = (/(\d+) sessões ao todo/.exec(am) || [])[1];
    const dens = am.split(' · ')[2] || '';
    if (!grau || !forca || !lealIni) { erros.push(`"${nome}": nivelAmeaca incompleto`); return ''; }
    linhas.push({ nome, grau, forca, vit: vd.VIT, dadiva, sess: sess || '0' });
    return `
<h3>${esc(nome)}</h3>
<p>${esc(abertura)}</p>
<pre>Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${Number(vd.VIT).toFixed(1).replace('.', ',')}   Blindagem ${vd.BLD ?? 0}   ${esc(vd.DESLOCAMENTO || '—')}
${grau} · ${forca}× o guerreiro · ${esc(dens)}
Na Fusão Selvagem empresta ${esc(dadiva)}.</pre>
<p><strong>Como domar.</strong> ${esc(m[1])}</p>
<ul>
<li><strong>O preço:</strong> ${esc(m[2])}</li>
<li><strong>A prova:</strong> ${esc(m[3])} <em>AUT + Domar${redutor && redutor !== '0' ? `, Redutor ${redutor}` : ', sem Redutor'}.</em></li>
<li><strong>O erro:</strong> ${esc(m[4])}</li>
</ul>
<p>Depois de aceita, a Lealdade começa em <strong>${lealIni}</strong> e o vínculo exige <strong>${lealFim}</strong>${sess ? ` — <strong>${sess} sessões</strong> de convivência` : ' — já nasce vinculada'}.</p>
`;
};

const html = INTRO + BICHOS.map(([n, a, d]) => verbete(n, a, d)).join('\n');
for (const t of ['p', 'h3', 'pre', 'ul', 'li', 'strong', 'em', 'blockquote'])
    if ((html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length !== (html.match(new RegExp(`</${t}>`, 'g')) || []).length)
        erros.push(`tag <${t}> desbalanceada`);
const palavras = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const ordem = Math.max(...arts.map(d => Number(d.data().order) || 0)) + 1;

console.log(`\n=== ${ordem}. ${TITULO} — ${linhas.length} verbetes, ${palavras} palavras ===\n`);
console.log('nome           grau     força   Vit    sessões até o vínculo   Dádiva');
for (const l of linhas)
    console.log(`${l.nome.padEnd(14)} ${l.grau.padEnd(8)} ${l.forca}×  ${Number(l.vit).toFixed(1).padStart(5)}  ${String(l.sess === '0' ? 'já nasce vinculada' : l.sess + ' sessões').padEnd(22)} ${l.dadiva}`);
console.log('\nAmostra — Rouba-Rede:');
console.log(html.split('<h3>Rouba-Rede</h3>')[1].split('<h3>')[0].replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim()).map(s => '   ' + s.trim()).join('\n'));

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
await db.collection('worldbuilding-articles').add({
    bookId: BOOK, title: TITULO, synopsis: SINOPSE, contentHTML: html.trim(),
    order: ordem, status: 'publicado', public: false, mentions: [], words: palavras,
    createdAt: agora, updatedAt: agora, updatedBy: AUTOR,
});
console.log(`\n✅ capítulo ${ordem} gravado.`);
process.exit(0);
