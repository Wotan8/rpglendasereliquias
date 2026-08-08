/**
 * Interação entre as Catorze Essências — o "capítulo próprio" que o cânone
 * promete e nunca existiu.
 *
 * "As catorze não estão soltas. Formam ciclos, oposições e dependências que
 *  este compêndio detalha em capítulo próprio" — As Catorze Essências, cap. 1.
 *  O Compêndio de Fluxomancia tem UM capítulo. Este é o segundo.
 *
 * NADA AQUI É INVENTADO. Cada relação sai de uma frase do cap. 1, citada na
 * tabela RELACOES abaixo. Essências que o cânone não opõe a ninguém
 * (Espaço, Tempo, Cristal, Poder) ficam NEUTRAS — e isso também é leitura do
 * cânone, não omissão: "três essências não pertencem a ciclo nenhum" e as
 * Estruturais "governam a armação da realidade em vez de seu conteúdo".
 *
 * Mecanismo: o que já existe. Fraqueza N = piso(efeito ÷ 2^N), mínimo 1
 * (Régua §2.4). Nenhuma regra nova — a vantagem se expressa como a AUSÊNCIA de
 * penalidade somada à penalidade do outro lado. Quem consome não é ferido pelo
 * consumido.
 *
 *   node functions/essencias-interacoes.mjs            (dry-run)
 *   node functions/essencias-interacoes.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const FLUXO = 'book-fluxomancia';
const REGUA = 'book-regua-balanceamento';

/* atacante → alvo : quem ataca leva Fraqueza 1. Cada linha traz a frase do
   cânone que a produz — se a citação não estiver no cap. 1, o assert quebra. */
const RELACOES = [
    // ── A roda das quatro ──
    { de: 'Terra',     contra: 'Vento',    fonte: 'o Vento consome a Terra' },
    { de: 'Água',      contra: 'Terra',    fonte: 'a Terra consome a Água' },
    { de: 'Fogo',      contra: 'Água',     fonte: 'a Água consome o Fogo' },
    { de: 'Vento',     contra: 'Fogo',     fonte: 'o Fogo consome o Vento' },
    // ── O Ciclo Vital e quem o quebra ──
    { de: 'Vida',      contra: 'Necrótica', fonte: 'Corrompe a Vida no lugar em que a Natureza deveria consumi-la' },
    { de: 'Natureza',  contra: 'Necrótica', fonte: 'e consome a Natureza' },
    { de: 'Sangue',    contra: 'Necrótica', fonte: 'sangue corrompido por ela resiste à manipulação hemática' },
    // ── A Luz como contenção ──
    { de: 'Necrótica', contra: 'Luz',      fonte: 'tem bônus natural contra o Necrótico e o Abissal' },
    { de: 'Abissal',   contra: 'Luz',      fonte: 'Contra a Luz encontra mais dificuldade que contra qualquer outra' },
];
/* O Abissal como alvo já está na Régua §2.4 e continua valendo: toda Essência
   que não seja Abissal ou Luz leva Fraqueza 1, e o dano físico também. */
const NEUTRAS = ['Espaço', 'Tempo', 'Cristal', 'Poder'];

/* ═══ ASSERTS: o cânone é a fonte ═══ */
const capSnap = await db.collection('worldbuilding-articles').where('bookId', '==', FLUXO).get();
const cap1 = capSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(a => /As Catorze Ess/i.test(a.title || ''));
assert.ok(cap1, 'capítulo "As Catorze Essências" não achado');
const canone = String(cap1.contentHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const r of RELACOES) assert.ok(canone.includes(r.fonte), `citação não confere com o cânone: "${r.fonte}"`);
for (const n of NEUTRAS) assert.ok(canone.includes(n), `essência neutra não existe no cânone: ${n}`);
/* a roda tem que fechar: 4 elos, cada um aparecendo uma vez como de e como contra */
const roda = RELACOES.slice(0, 4);
assert.equal(new Set(roda.map(r => r.de)).size, 4, 'a roda não fecha (de)');
assert.equal(new Set(roda.map(r => r.contra)).size, 4, 'a roda não fecha (contra)');
/* nenhuma relação em par duplo — se A é fraco contra B, B não é fraco contra A */
for (const r of RELACOES) assert.ok(!RELACOES.some(x => x.de === r.contra && x.contra === r.de),
    `par simétrico proibido: ${r.de}↔${r.contra}`);
console.log(`✅ ${RELACOES.length + NEUTRAS.length + 3} asserts — toda relação rastreada ao cap. 1.\n`);

/* ═══ CAPÍTULO PÚBLICO (Fluxomancia) ═══ */
const CAP_FLUXO = {
    title: 'Ciclos, Oposições e Precedência',
    synopsis: 'A roda das quatro, o Ciclo Vital e quem o quebra, a Luz como contenção e a precedência do Abismo — e o que isso faz na mesa.',
    html: `
<p><em>"A Essência é uma só. O que muda é a natureza que ela assume."</em> — e naturezas se encontram. Este capítulo é o que o primeiro prometeu: como as catorze se prendem umas às outras, e o que acontece quando uma é usada contra outra.</p>
<p>A regra é uma só, e já governava o Abismo: quando uma Essência age contra aquela que a consome, <strong>o efeito cai pela metade</strong> (arredondando para baixo, nunca abaixo de 1). Em efeito que não seja número — cegar, prender, adormecer — a metade vira <strong>−1 no Alvo do teste</strong>.</p>

<h4>A roda das quatro</h4>
<p>Vento, Terra, Água e Fogo consomem-se em roda fechada. Quem consome não é ferido pelo que consome:</p>
<pre>Vento → Terra → Água → Fogo → Vento</pre>
<table><tr><th>Age contra</th><th>Quem a consome</th><th>Efeito</th></tr>
<tr><td>Terra</td><td>Vento</td><td>metade</td></tr>
<tr><td>Água</td><td>Terra</td><td>metade</td></tr>
<tr><td>Fogo</td><td>Água</td><td>metade</td></tr>
<tr><td>Vento</td><td>Fogo</td><td>metade</td></tr></table>
<p>Vento e Terra são opostos; Água e Fogo também. Na roda, porém, oposição não é empate: cada uma tem uma presa e um predador. Um runomago que só conheça Fogo é magnífico contra o Vento e desperdiçado contra a Água — e é por isso que a Runomancia ensina as quatro juntas.</p>

<h4>O Ciclo Vital, e quem o quebra</h4>
<p>Natureza e Vida giram uma na outra, sem terceiro. A <strong>Necrótica</strong> não pertence ao ciclo — existe para quebrá-lo, e por isso as duas do ciclo agem contra ela pela metade. O <strong>Sangue</strong> sofre o mesmo, pelo que o cânone já dizia: sangue corrompido pela Púrpura resiste à manipulação hemática, e contamina quem tentar absorvê-lo.</p>
<table><tr><th>Age contra a Necrótica</th><th>Efeito</th></tr>
<tr><td>Vida · Natureza · Sangue</td><td>metade</td></tr>
<tr><td>Luz</td><td>inteiro</td></tr></table>

<h4>A Luz é contenção</h4>
<p>A Amarela tem bônus natural contra a Púrpura e a Preta — é a principal força de contenção contra as duas, e a única Essência capaz de vencer o Abissal enquanto a presença do Abismo ainda for pequena. Onde a Luz é o alvo, <strong>Necrótica e Abissal agem pela metade</strong>. Onde a Luz é a arma, ela nunca é reduzida.</p>
<p>Isto explica a liturgia inteira da Pallomancia: contra o que sai do Véu Terreno ou de além da Oitava Camada, o sacerdote não é uma escolha entre outras. É a escolha.</p>

<h4>A precedência do Abismo</h4>
<p>A Preta vence todas as demais — é o coringa, e nenhuma a detém por inteiro. <strong>Contra alvo abissal, toda Essência age pela metade, e o dano físico também.</strong> Só a Luz e o próprio Abissal ferem por inteiro.</p>
<p>Um horror do Abismo com metade da Vitalidade de uma ameaça equivalente dá a mesma luta — porque o grupo inteiro bate pela metade. Quem for enfrentar o Abismo leva Luz, ou leva números.</p>

<h4>As que não entram na conta</h4>
<p><strong>Espaço, Tempo, Cristal e Poder</strong> não opõem ninguém e ninguém as opõe. As Estruturais governam a armação da realidade em vez de seu conteúdo; o Cristal é recipiente das outras; a Âmbar-Incandescente amplifica qualquer uma e permanece estável fazendo isso — é moralmente neutra, e mecanicamente também. Contra elas e por elas, o efeito é sempre inteiro.</p>
<p>A vantagem delas não é vencer matchup: é <em>não ter</em> matchup ruim. Uma relíquia de Erídio funciona igual contra tudo, e essa constância é o que a torna cara.</p>

<h4>Resumo de mesa</h4>
<p>Só existem <strong>nove</strong> reduções em todo o sistema, mais a precedência do Abismo. Se a Essência do golpe não estiver na lista, o efeito é inteiro:</p>
<pre>metade contra Vento ......... Terra
metade contra Terra ......... Água
metade contra Água .......... Fogo
metade contra Fogo .......... Vento
metade contra Necrótica ..... Vida · Natureza · Sangue
metade contra Luz ........... Necrótica · Abissal
metade contra Abissal ....... TODAS, menos Luz (e o físico também)</pre>
`,
};

/* ═══ RÉGUA §2.4 — a tabela geral ═══ */
const ADENDO = `
<h3>2.4b A matriz completa das Essências</h3>
<p>A tabela do §2.4 cobria só o alvo abissal. O Compêndio de Fluxomancia (cap. 2) fecha a matriz — e a mecânica é a mesma, sem regra nova: <strong>Fraqueza 1</strong> para quem age contra a Essência que o consome.</p>
<table>
<thead><tr><th>Alvo desta natureza</th><th>Age pela metade contra ele</th><th>Origem no cânone</th></tr></thead>
<tbody>
<tr><td>Vento</td><td>Terra</td><td>o Vento consome a Terra</td></tr>
<tr><td>Terra</td><td>Água</td><td>a Terra consome a Água</td></tr>
<tr><td>Água</td><td>Fogo</td><td>a Água consome o Fogo</td></tr>
<tr><td>Fogo</td><td>Vento</td><td>o Fogo consome o Vento</td></tr>
<tr><td>Necrótica</td><td>Vida · Natureza · Sangue</td><td>corrompe a Vida, consome a Natureza, e o sangue corrompido resiste ao hemomante</td></tr>
<tr><td>Luz</td><td>Necrótica · Abissal</td><td>bônus natural contra o Necrótico e o Abissal</td></tr>
<tr><td>Abissal</td><td>todas menos Luz, e o físico</td><td>vence todas as demais (§2.4)</td></tr>
<tr><td>Espaço · Tempo · Cristal · Poder</td><td><em>ninguém</em></td><td>não pertencem a ciclo nenhum</td></tr>
</tbody>
</table>
<p><strong>Custo de projeto:</strong> nove reduções, nenhuma nova mecânica. A régua não muda — a Fraqueza 1 já era <code>piso(efeito ÷ 2)</code>, mínimo 1, e o efeito não numérico continua virando −1 no Alvo.</p>
<p><strong>O que isto faz com o balanceamento:</strong> uma classe de canal único (Runimago de Fogo puro, Pallacerdote de Luz) vale a média de sempre contra alvo neutro, metade contra a presa errada, e inteiro contra a certa. Como as Essências neutras são quatro e a maioria dos alvos de mesa é <em>física</em> — sem natureza —, o caso comum continua sendo efeito inteiro. A matriz é tempero, não imposto: se ela começar a decidir todo combate, o erro está em atribuir natureza a alvo demais.</p>
<p><strong>Não empilha.</strong> Uma criatura tem UMA natureza. Se um Mestre quiser um alvo abissal <em>e</em> necrótico, escolhe qual manda — Fraqueza 2 (um quarto) não sai desta matriz, sai da soma indevida.</p>
`;

/* ═══ EXECUÇÃO ═══ */
const erros = [];
if (capSnap.docs.some(d => /Ciclos, Oposi/i.test(d.data().title || ''))) erros.push('capítulo de Fluxomancia já existe');
const reguaSnap = await db.collection('worldbuilding-articles').where('bookId', '==', REGUA).get();
const cap2 = reguaSnap.docs.find(d => /^2 —/.test(d.data().title || ''));
if (!cap2) erros.push('Régua cap. 2 não achado');
else if (/2\.4b/.test(cap2.data().contentHTML || '')) erros.push('Régua §2.4b já existe');

console.log('=== Interação entre as Catorze Essências ===\n');
console.log('  Nove reduções, todas rastreadas:');
for (const r of RELACOES) console.log(`    ${r.de.padEnd(10)} → metade contra ${r.contra.padEnd(11)} "${r.fonte.slice(0, 52)}…"`);
console.log(`  Neutras (cânone: "não pertencem a ciclo nenhum"): ${NEUTRAS.join(' · ')}`);
console.log(`\n  + "${CAP_FLUXO.title}" no Compêndio de Fluxomancia (público, order 1)`);
console.log('  ~ Régua cap. 2 ganha §2.4b (a matriz completa)');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
batch.set(db.collection('worldbuilding-articles').doc(), {
    bookId: FLUXO, title: CAP_FLUXO.title, synopsis: CAP_FLUXO.synopsis, contentHTML: CAP_FLUXO.html.trim(),
    order: 1, status: 'publicado', public: true, mentions: [],
    words: CAP_FLUXO.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    createdAt: agora, updatedAt: agora, updatedBy: 'igorestevamalvesdesouza@gmail.com',
});
const html2 = cap2.data().contentHTML + ADENDO;
batch.update(cap2.ref, { contentHTML: html2, updatedAt: agora,
    words: html2.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
await batch.commit();
console.log('\n✅ Capítulo público + Régua §2.4b gravados.');
process.exit(0);
