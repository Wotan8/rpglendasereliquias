/**
 * Bestiário · capítulo "Companheiros e Feras Domáveis" — de tabela para verbetes.
 *
 * O capítulo era uma tabela de cinco linhas. Vira um verbete por criatura, e
 * cada verbete termina no bloco COMO DOMAR.
 *
 * TUDO O QUE É NÚMERO É GERADO DA FICHA, não digitado aqui: Alvo, dano,
 * Vitalidade, Blindagem, Deslocamento, Grau, força, Redutor e Lealdade saem de
 * `npcs`, e o rito sai do bloco RITO DE DOMA que gravamos em
 * `criatura.comportamento`. Assim o livro não pode divergir da mesa — se a ficha
 * mudar, roda-se isto de novo.
 *
 * Só a linha de abertura de cada verbete é escrita à mão.
 *
 *   node functions/bestiario-cap-domaveis.mjs            (dry-run)
 *   node functions/bestiario-cap-domaveis.mjs --apply
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

/* ordem no capítulo, e a única frase escrita à mão de cada um */
const ORDEM = [
    ['Corvo', 'Vale pelos olhos, não pelo bico. Reporta o que vê a quem entende Linguagem Animal, e é o único aliado do Vale que trabalha sem nunca entrar em combate.'],
    ['Serpente', 'Silenciosa, e erra pouco quem não a viu. O valor dela não é o dado — é o Toxis que fica depois dele.'],
    ['Lobo', 'Matilha de um. Flanqueia por instinto, e é o companheiro que mais se parece com um soldado a pé.'],
    ['Urso', 'Lento para começar a briga, péssimo de terminar contra. Protege o vínculo acima da própria fome.'],
    ['Ratazana', 'Besta de esgoto e catacumba. Ninguém escolhe uma Ratazana; escolhe-se o lugar onde só há Ratazana.'],
    ['Velocirops', 'O predador que o Vale não devia sustentar e sustenta. Quem doma um não ganha um companheiro — ganha a coisa mais perigosa da região, e ela já está pronta no dia em que aceita.'],
];

const INTRO = `
<blockquote><p><em>"Domar é uma tarde. O vínculo é o resto."</em></p></blockquote>

<p>Companheiro entra na mesa pela régua: cerca de <strong>0,6× o guerreiro</strong> na chegada, crescendo pela <strong>Lealdade</strong> — uma melhoria por ponto a partir de 6, teto de cinco. Fera acima disso chega com as melhorias pré-gastas: é magnífica no dia em que aceita, e é tudo o que vai ser.</p>

<p>Conseguir a criatura é teste de qualquer classe — <strong>AUT + Domar</strong> contra o Redutor dela. O vínculo e a Fusão Selvagem são do Druida.</p>

<p>E o teste é a última coisa que acontece, não a primeira. <strong>Cada fera tem o seu rito</strong>, e o rito é o que decide se você chega a rolar: o que a traz, o que custa entrar, em que instante a prova é possível, e o que a falha cobra. Um Corvo se conquista com brilho dado sem pedir; um Velocirops, com um ano de carne deixada no mesmo lugar. As duas coisas se chamam domar e não se parecem em nada.</p>
`;

const vg = n => Number(n).toFixed(2).replace('.', ',');
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const npcDocs = (await db.collection('npcs').get()).docs;
const npcs = npcDocs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];

/* ── PARTE A · os quatro companheiros de cânone nunca foram carimbados.
   O nivelAmeaca deles ainda é o texto velho ("companheiro · Lealdade — …"),
   sem Grau, sem força e sem Redutor. Sem isso o verbete não tem o que citar. ── */
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const DOMA = { 'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4] };
const clausula = g => {
    const [r, ini, lim, ritmo] = DOMA[g], falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${g} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo` : ' — já nasce vinculada');
};
const CANONE = {
    'Corvo': 'olheiro do Druida; vale pelos olhos, não pelo bico',
    'Serpente': 'companheiro do Druida; a mordida leva Toxis 1',
    'Lobo': 'companheiro do Druida; flanqueia por instinto',
    'Urso': 'companheiro do Druida; protege o vínculo acima da própria fome',
};
const carimbo = [];
for (const [nome, nota] of Object.entries(CANONE)) {
    const doc = npcDocs.find(x => (x.data().nome || '') === nome);
    if (!doc) { erros.push(`"${nome}" não achado`); continue; }
    const n = doc.data();
    if (DOMA[String(n.criatura?.nivelAmeaca || '').split(' · ')[0]]) continue;   // já carimbado
    const g = /Alvo (\d+)[^\n]*?(\d+d\d+)\+(\d+)/.exec(String(n.ataques || ''));
    if (!g) { erros.push(`"${nome}": golpe não legível`); continue; }
    const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
    const x = P * Math.max(1, medio(g[2]) + (+g[3]) - 2) / 3.90;
    const grau = grauDe(x);
    carimbo.push({ ref: doc.ref, nome, antes: n.criatura?.nivelAmeaca || '',
        depois: [grau, `${x.toFixed(2).replace('.', ',')}×`, 'companheiro do Druida', clausula(grau), nota].join(' · ') });
    npcs.find(y => y.id === doc.id).criatura.nivelAmeaca = carimbo.at(-1).depois;
}

const cap = arts.find(d => (d.data().title || '') === 'Companheiros e Feras Domáveis');
if (!cap) erros.push('capítulo "Companheiros e Feras Domáveis" não achado');

const verbetes = [];
for (const [nome, abertura] of ORDEM) {
    const n = npcs.find(x => x.nome === nome);
    if (!n) { erros.push(`"${nome}" não achado em npcs`); continue; }
    const c = n.criatura || {}, vd = n.valoresDer || {};
    const comp = String(c.comportamento || '');
    const m = /RITO DE DOMA\s*\nChamariz: (.+)\nPreço: (.+)\nA prova: (.+)\nO erro: (.+)/.exec(comp);
    if (!m) { erros.push(`"${nome}": bloco RITO DE DOMA não achado no comportamento`); continue; }

    /* a primeira linha nem sempre é golpe — o Velocirops abre com a anatomia */
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const golpe = /Alvo (\d+)(?: \(\+\d+ Transbordo\))?, ([\dd+]+)/.exec(atq);
    const am = String(c.nivelAmeaca || '');
    const grau = am.split(' · ')[0] || '—';
    const forca = (/(\d+,\d+)×/.exec(am) || [])[1];
    const redutor = (/Redutor (−?\d+|0)/.exec(am) || [])[1];
    const lealIni = (/Lealdade começa em (\d+)/.exec(am) || [])[1];
    const lealFim = (/vínculo exige (\d+)/.exec(am) || [])[1];
    const sessoes = (/(\d+) sessões ao todo/.exec(am) || [])[1];

    verbetes.push({ nome, abertura,
        alvo: golpe?.[1], dano: golpe?.[2], atq,
        vit: vd.VIT, bld: vd.BLD ?? 0, desloc: vd.DESLOCAMENTO || '—',
        grau, forca, redutor, lealIni, lealFim, sessoes,
        chamariz: m[1], preco: m[2], prova: m[3], erro: m[4] });
}

const html = INTRO + verbetes.map(v => `
<h3>${esc(v.nome)}</h3>
<p>${esc(v.abertura)}</p>
<pre>Alvo ${v.alvo}   ${v.dano}   Vitalidade ${Number(v.vit).toFixed(1).replace('.', ',')}   Blindagem ${v.bld}   ${esc(v.desloc)}
${v.grau} · ${v.forca}× o guerreiro</pre>
<p><strong>Como domar.</strong> ${esc(v.chamariz)}</p>
<ul>
<li><strong>O preço:</strong> ${esc(v.preco)}</li>
<li><strong>A prova:</strong> ${esc(v.prova)} <em>AUT + Domar${v.redutor && v.redutor !== '0' ? `, Redutor ${v.redutor}` : ', sem Redutor'}.</em></li>
<li><strong>O erro:</strong> ${esc(v.erro)}</li>
</ul>
<p>Depois de aceita, a Lealdade começa em <strong>${v.lealIni}</strong> e o vínculo exige <strong>${v.lealFim}</strong>${v.sessoes ? ` — <strong>${v.sessoes} sessões</strong> de convivência` : ' — já nasce vinculada'}.</p>
`).join('\n');

/* conferência de tags */
for (const t of ['p', 'h3', 'pre', 'ul', 'li', 'strong', 'em', 'blockquote'])
    if ((html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length !== (html.match(new RegExp(`</${t}>`, 'g')) || []).length)
        erros.push(`tag <${t}> desbalanceada`);

const palavras = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

/* domáveis que ainda não estão em livro nenhum */
const noLivro = new Set(ORDEM.map(([n]) => n));
const foraDoLivro = npcs.filter(n => n.tipo === 'criatura'
    && /RITO DE DOMA/.test(n.criatura?.comportamento || '') && !noLivro.has(n.nome)).map(n => n.nome);

console.log(`\n=== "Companheiros e Feras Domáveis" — de tabela para ${verbetes.length} verbetes ===\n`);
console.log(`   ${cap?.data().words} → ${palavras} palavras\n`);
console.log('nome          Alvo  dano     Vit    Bld  grau        força   Redutor  Lealdade      sessões');
for (const v of verbetes)
    console.log(`${v.nome.padEnd(13)} ${String(v.alvo).padStart(3)}  ${String(v.dano).padEnd(7)} ${Number(v.vit).toFixed(1).padStart(5)}  ${String(v.bld).padStart(2)}   ${v.grau.padEnd(11)} ${v.forca}×  ${String(v.redutor).padStart(6)}   ${v.lealIni} → ${v.lealFim}       ${v.sessoes || '—'}`);
console.log('\nExemplo de verbete (Corvo):');
console.log(html.split('<h3>')[1].split('<h3>')[0].replace(/<[^>]+>/g, '').split('\n').filter(Boolean).map(s => '   ' + s.trim()).join('\n'));
if (carimbo.length) {
    console.log('\nCarimbo do formato novo nos companheiros de cânone:');
    for (const c of carimbo) console.log(`   ${c.nome}\n      de:   ${c.antes}\n      para: ${c.depois}`);
}
if (foraDoLivro.length) console.log(`\n⚠ Domáveis com rito e SEM verbete em livro nenhum (${foraDoLivro.length}):\n   ${foraDoLivro.join(' · ')}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch0 = db.batch();
for (const c of carimbo) batch0.update(c.ref, { 'criatura.nivelAmeaca': c.depois, lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR });
if (carimbo.length) await batch0.commit();
await cap.ref.update({
    contentHTML: html.trim(), words: palavras,
    synopsis: 'Verbete por verbete: o que cada fera é, o que ela vale, e o rito que a doma — o que a traz, '
        + 'o que custa, quando se rola e o que a falha cobra.',
    updatedAt: Date.now(), updatedBy: AUTOR,
});
console.log(`\n✅ capítulo reescrito com ${verbetes.length} verbetes.`);
process.exit(0);
