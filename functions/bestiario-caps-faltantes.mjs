/**
 * Bestiário — os quatro capítulos que faltavam.
 *
 * O livro cobria abissais, erguidos, os quatro companheiros e dois predadores.
 * Treze criaturas do Vale ficaram de fora quando ele foi escrito. Entram agora,
 * no mesmo formato de verbete do capítulo dos domáveis, e agrupadas por
 * O QUE AS MOVE — que é como o livro sempre se organizou.
 *
 *   6. A Manada das Nuvens Baixas   Nimbrote · Nímbara · Nímbaro · Nímbaro Alfa
 *   7. Os Penacho-Bravo             Juvenil · adulto · Alfa
 *   8. O Campo Aberto               Fúlgora · Passa-Cerca · Rei-Coveiro
 *   9. O Que Vive Embaixo           Vidrela · Górbal · Apaga-Lume
 *
 * NEVARA FICA DE FORA, e de propósito: ela tem mesa, e o capítulo "Predadores
 * de Vasteluna" já estabelece a regra — "as criaturas senhoras de campanha, as
 * que têm nome próprio e mesa, não constam deste bestiário".
 *
 * Todo número é gerado da ficha. Só a linha de abertura de cada verbete e a
 * introdução de cada capítulo são escritas à mão.
 *
 *   node functions/bestiario-caps-faltantes.mjs            (dry-run)
 *   node functions/bestiario-caps-faltantes.mjs --apply
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

const CAPITULOS = [
    {
        title: 'A Manada das Nuvens Baixas',
        synopsis: 'O gado de tempestade da planície: quatro degraus de um mesmo bicho, e uma manada '
            + 'que não é encontro — é sair da frente.',
        intro: `<blockquote><p><em>"Não se enfrenta a manada. Espera-se ela passar."</em></p></blockquote>
<p>Herbívoros, e é justamente por isso que são perigosos: não caçam ninguém, não perseguem, não têm interesse em você — e atropelam o que estiver no caminho. A carga de um Nímbaro adulto não é ataque, é trânsito.</p>
<p>Carregam carga elétrica no chifre, o que a planície chama de Faísca e o que o atingido chama de perder a Reação. A manada anda com os bezerros no centro, e é essa formação que explica todo o resto do comportamento dela.</p>
<p><strong>A manada cheia soma perto de dez vezes um guerreiro.</strong> Um grupo de quatro personagens vale quatro. A conta é essa, e ela não pede interpretação.</p>`,
        bichos: [
            ['Nimbrote', 'O filhote. Não é ele a ameaça — é o que a mãe faz quando ele berra.'],
            ['Nímbara', 'A fêmea. Ataca primeiro quando há cria por perto, e não recua depois de começar.'],
            ['Nímbaro', 'O macho de borda. Carrega no que se aproxima antes de olhar o que é.'],
            ['Nímbaro Alfa', 'Onde ele vai, a manada vai. Não se derruba um alfa: espera-se ele mudar de pasto.'],
        ],
    },
    {
        title: 'Os Penacho-Bravo',
        synopsis: 'A caça do Vale — galináceos gigantes que dão carne, pena e uma lição sobre ninho.',
        intro: `<blockquote><p><em>"Bravo não é elogio. É aviso."</em></p></blockquote>
<p>O nome é de camponês e diz o que interessa: são grandes e são revoltosos, e é por isso que dá trabalho lidar com eles. Ninguém em Sereni chama um Penacho-Bravo de bonito.</p>
<p>São a caça da região e um dos poucos bichos do Vale que valem a pena abater: a carne serve, as penas duras servem, e o bando é grande o bastante para sustentar caçada regular sem sumir.</p>
<p>Tudo neles gira em torno do ninho. Longe do ninho são ariscos e fogem; perto dele não fogem nunca. <strong>Um bando cheio — um Alfa, quatro adultos, dois juvenis — soma quase exatamente o que um grupo de quatro personagens vale.</strong> É o combate honesto do Vale, e é raro um encontro sair tão redondo.</p>`,
        bichos: [
            ['Penacho-Bravo Juvenil', 'Arisco, e não briga sozinho. Isolado do bando, foge.'],
            ['Penacho-Bravo', 'Territorial. Protege o ninho e ataca quem se aproxima dele, sem aviso intermediário.'],
            ['Penacho-Bravo Alfa', 'Chefe do bando. Entre o ninho e você, sempre.'],
        ],
    },
    {
        title: 'O Campo Aberto',
        synopsis: 'Três que dividem a planície e não se encontram: a que caça de cima, a que caça de '
            + 'noite e o que espera todo mundo terminar.',
        intro: `<blockquote><p><em>"No campo aberto não há de onde vir. É por isso que se olha para cima."</em></p></blockquote>
<p>A planície não esconde ninguém, e as três criaturas deste capítulo resolveram esse problema de três maneiras diferentes: a Fúlgora ataca de uma altura de onde não se enxerga; o Passa-Cerca atravessa o que deveria parar; o Rei-Coveiro simplesmente não ataca — espera.</p>
<p>Nenhuma das três disputa com a outra, e é por isso que cabem no mesmo campo.</p>`,
        bichos: [
            ['Fúlgora', 'Uma por território — não divide céu. Defende o ninho antes de defender a si mesma.'],
            ['Passa-Cerca', 'Sua cerca não serve e sua parede não serve. O que serve é luz e companhia.'],
            ['Rei-Coveiro', 'Onde ele pousa, alguma coisa morreu — e ele chega antes do cheiro.'],
        ],
    },
    {
        title: 'O Que Vive Embaixo',
        synopsis: 'Galeria, túnel e escuro: três criaturas que não caçam pela vista, e a que apaga a sua.',
        intro: `<blockquote><p><em>"Embaixo da terra, quem enxerga é quem já está em desvantagem."</em></p></blockquote>
<p>Nenhuma das três caça pelos olhos. A Vidrela lê vibração, o Górbal lê o tremor da rocha, e o Apaga-Lume lê a ausência de luz — que é o estado natural do lugar onde ele vive, e o estado que ele impõe onde não é.</p>
<p>Isso muda a preparação inteira. Tocha, lampião e passo firme são as três coisas que um grupo leva para o subsolo, e são exatamente as três que chamam o que mora lá.</p>`,
        bichos: [
            ['Vidrela', 'Ouve pela vibração. Grito e passo pesado a trazem.'],
            ['Górbal', 'O túnel é dele. Dois metros quando novo, oito quando velho — e não persegue à superfície.'],
            ['Apaga-Lume', 'O remédio é a luz que ela tira primeiro.'],
        ],
    },
];

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];

for (const c of CAPITULOS) if (arts.some(d => (d.data().title || '') === c.title)) erros.push(`capítulo "${c.title}" já existe`);

const verbete = (nome, abertura) => {
    const n = npcs.find(x => x.nome === nome);
    if (!n) { erros.push(`"${nome}" não achado`); return ''; }
    if (n.mesaId) { erros.push(`"${nome}" tem mesa — não entra no bestiário`); return ''; }
    const c = n.criatura || {}, vd = n.valoresDer || {};
    const m = /RITO DE DOMA\s*\nChamariz: (.+)\nPreço: (.+)\nA prova: (.+)\nO erro: (.+)/.exec(String(c.comportamento || ''));
    if (!m) { erros.push(`"${nome}": sem bloco RITO DE DOMA`); return ''; }
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
    return `
<h3>${esc(nome)}</h3>
<p>${esc(abertura)}</p>
<pre>Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${Number(vd.VIT).toFixed(1).replace('.', ',')}   Blindagem ${vd.BLD ?? 0}   ${esc(vd.DESLOCAMENTO || '—')}
${grau} · ${forca}× o guerreiro · ${esc(dens)}</pre>
<p><strong>Como domar.</strong> ${esc(m[1])}</p>
<ul>
<li><strong>O preço:</strong> ${esc(m[2])}</li>
<li><strong>A prova:</strong> ${esc(m[3])} <em>AUT + Domar${redutor && redutor !== '0' ? `, Redutor ${redutor}` : ', sem Redutor'}.</em></li>
<li><strong>O erro:</strong> ${esc(m[4])}</li>
</ul>
<p>Depois de aceita, a Lealdade começa em <strong>${lealIni}</strong> e o vínculo exige <strong>${lealFim}</strong>${sess ? ` — <strong>${sess} sessões</strong> de convivência` : ' — já nasce vinculada'}.</p>
`;
};

for (const c of CAPITULOS) {
    c.html = c.intro + c.bichos.map(([n, a]) => verbete(n, a)).join('\n');
    c.words = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    for (const t of ['p', 'h3', 'pre', 'ul', 'li', 'strong', 'em', 'blockquote'])
        if ((c.html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length !== (c.html.match(new RegExp(`</${t}>`, 'g')) || []).length)
            erros.push(`"${c.title}": tag <${t}> desbalanceada`);
}

const ordemBase = Math.max(...arts.map(d => Number(d.data().order) || 0));

/* quem sobra depois disto */
const cobertos = new Set(CAPITULOS.flatMap(c => c.bichos.map(([n]) => n)));
const sobra = npcs.filter(n => n.tipo === 'criatura' && /RITO DE DOMA/.test(n.criatura?.comportamento || '')
    && !cobertos.has(n.nome) && !['Corvo', 'Serpente', 'Lobo', 'Urso', 'Ratazana', 'Velocirops'].includes(n.nome));

console.log(`\n=== ${CAPITULOS.length} capítulos novos ===\n`);
for (const [i, c] of CAPITULOS.entries()) {
    console.log(`── ${ordemBase + 1 + i}. ${c.title}  (${c.words} palavras, ${c.bichos.length} verbetes)`);
    console.log(`   ${c.synopsis}`);
    for (const [n] of c.bichos) {
        const x = npcs.find(y => y.nome === n);
        const am = String(x?.criatura?.nivelAmeaca || '');
        console.log(`      ${n.padEnd(23)} ${am.split(' · ').slice(0, 2).join(' · ')}`);
    }
    console.log('');
}
console.log('Amostra — primeiro verbete do primeiro capítulo:');
console.log(CAPITULOS[0].html.split('<h3>')[1].replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim()).map(s => '   ' + s.trim()).join('\n'));
if (sobra.length) console.log(`\n⚠ Ainda fora do livro: ${sobra.map(n => `${n.nome}${n.mesaId ? ' (mesa)' : ''}`).join(' · ')}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
CAPITULOS.forEach((c, i) => {
    batch.set(db.collection('worldbuilding-articles').doc(), {
        bookId: BOOK, title: c.title, synopsis: c.synopsis, contentHTML: c.html.trim(),
        order: ordemBase + 1 + i, status: 'publicado', public: false, mentions: [], words: c.words,
        createdAt: agora, updatedAt: agora, updatedBy: AUTOR,
    });
});
await batch.commit();
console.log(`\n✅ ${CAPITULOS.length} capítulos gravados, ${CAPITULOS.reduce((s, c) => s + c.bichos.length, 0)} verbetes.`);
process.exit(0);
