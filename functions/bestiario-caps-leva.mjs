/**
 * Bestiário — os três capítulos da leva nova.
 *
 * As doze criaturas gravadas em `bestiario-leva-interacao.mjs` não tinham
 * verbete. Entram agrupadas por O QUE AS MOVE, que é como o livro sempre se
 * organizou:
 *
 *   11. Os Que Não Mordem     as sete que não atacam — o que elas fazem é
 *                             condição, e metade é boa
 *   12. A Mata Fechada        Aracasca · Aranha-Galho · Javali-Espinhoso
 *   13. O Que Velmora Cria    Espectro da Seiva Negra · Avarbus Azire
 *
 * TODO NÚMERO É GERADO DA FICHA: Alvo, dado, Vitalidade, Blindagem,
 * Deslocamento, Grau, força, densidade, Redutor, Lealdade, a condição que a
 * criatura aplica, o sinal, a regra, o remédio, a moral e o rito de doma
 * saem de `npcs`. Só a introdução de cada capítulo e a linha de abertura de
 * cada verbete são escritas à mão.
 *
 * Os capítulos nascem em RASCUNHO (`public: false`). O livro inteiro está
 * público, mas virar o `public` de um capítulo é publicar — e isso é decisão
 * sua, não minha. É um campo de distância quando quiser.
 *
 *   node functions/bestiario-caps-leva.mjs            (dry-run)
 *   node functions/bestiario-caps-leva.mjs --apply
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

/* ── o que é escrito à mão: a introdução e uma linha por bicho ── */
const CAPITULOS = [
{
    title: 'Os Que Não Mordem',
    synopsis: 'Sete criaturas que não atacam ninguém, e ainda assim mudam quem chega perto — '
        + 'metade para melhor.',
    intro: `<blockquote><p><em>"Nem tudo que mexe com você queria mexer com você."</em></p></blockquote>

<p>Este capítulo não tem um único predador. Nenhuma das sete abaixo caça gente, nenhuma defende território, e a maioria foge antes de ser vista. Mesmo assim todas elas entram na ficha de quem chegou perto — porque <strong>o que elas fazem não é dano, é condição</strong>, e condição não precisa de intenção.</p>

<p>Metade do que sai daqui é <strong>bom</strong>. Uma fecha ferida, outra devolve a cabeça no lugar, outra encurta a estrada, outra faz o pão alimentar mais. E a mesma criatura, pela mesma porta, faz o contrário quando a pessoa lida errado — porque é a mesma biologia nos dois casos. O Lambe-Ferida cura porque precisa da ferida aberta; quem o puxa no meio do serviço fica com a ferida que ele precisava. Não há duas criaturas ali, uma boa e uma má. Há uma, e há o jeito de lidar.</p>

<p>É por isso que estas sete não se medem pela força. <strong>Todas ficam entre 0,05× e 0,27× o guerreiro</strong>, e isso não diz nada sobre elas: elas não foram feitas para trocar golpe. O que a mesa tem de olhar é a linha da condição.</p>`,
    bichos: [
        ['Lambe-Ferida', 'O único bicho do Vale que o pastor deixa entrar no curral de propósito, e o único que ele tem medo de espantar na hora errada.'],
        ['Salamandra-Musgo', 'Não faz nada com você. Faz com o lugar — e depois o lugar faz com você.'],
        ['Bebe-Susto', 'Come o que sobra do pânico alheio. É o motivo de batedor dormir na gruta antes de descer nela, e o motivo de não dormir duas noites.'],
        ['Solvina', 'A mesma secreção que tira do corpo o que estava agarrado nele desmancha o ponto que estava segurando o corpo. A diferença é a mão.'],
        ['Puxa-Passo', 'Sozinho é um inseto. Aos cinquenta é uma estrada mais curta, e depois é uma conta a pagar.'],
        ['Adoça-Pão', 'A aldeia batizou o bicho pelo ano bom. O ano ruim usa o mesmo nome.'],
        ['Veste-Pedra', 'Carrega a própria pedreira nas costas e anda três metros por turno por causa disso. Quem encosta descobre o que é carregar junto.'],
    ],
},
{
    title: 'A Mata Fechada',
    synopsis: 'As três que fazem da floresta um lugar onde não se anda sozinho, distraído, nem em '
        + 'linha reta.',
    intro: `<blockquote><p><em>"A mata não é perigosa. A mata tem três coisas dentro, e cada uma quer uma coisa diferente de você."</em></p></blockquote>

<p>As duas florestas do Vale — a de <strong>Silmarela</strong>, que Sereni alcança a pé, e a de <strong>Silmari</strong>, que é a mata grande — têm as mesmas três criaturas, e cada uma cobra um erro diferente.</p>

<p>A <strong>Aracasca</strong> cobra andar sozinho: ela não desce para dois. A <strong>Aranha-Galho</strong> cobra olhar sem ver: ela é um galho a mais na árvore, com musgo do lado errado. O <strong>Javali-Espinhoso</strong> cobra atravessar sem perguntar de quem é o chão — e ele avisa antes, com espinhos no caminho apontando para onde foi.</p>

<p>Nenhuma das três persegue quem sai. A Aracasca não deixa o tronco, a Aranha não desce da copa, o Javali não corrige a curva da investida. <strong>Todas as três são vencidas pelo mesmo movimento: sair de onde elas estão.</strong> O problema é que é preciso perceber a tempo.</p>`,
    bichos: [
        ['Aracasca', 'Passa o dia inteiro imóvel dentro de um tronco oco fazendo uma conta só: quantos vocês são.'],
        ['Aranha-Galho', 'Fica dias na mesma posição. Você tem uma tarde; ela tem a semana inteira.'],
        ['Javali-Espinhoso', 'Não caça ninguém. Só decide onde o território dele começa, e a decisão é dele.'],
    ],
},
{
    title: 'O Que Velmora Cria',
    synopsis: 'Dois necrófagos de naturezas opostas na mesma mata podre: um que apaga as trevas '
        + 'comendo, e um que é feito delas.',
    intro: `<blockquote><p><em>"Velmora não está morta. Velmora está sendo digerida, e há mais de um comensal à mesa."</em></p></blockquote>

<p>A Floresta de Velmora e as Ruínas que ela cerca sustentam dois bichos que vivem do mesmo apodrecimento e não se parecem em nada. O <strong>Espectro da Seiva Negra</strong> é a corrupção com forma: caça o vivo, deixa a seiva na ferida e o trecho de mata onde ele está fica sem nenhum outro predador. O <strong>Avarbus Azire</strong> faz o contrário pelo motivo errado — ele <strong>come as trevas</strong>, apaga fenda e ruptura como quem limpa um prato, e devolve luz. E deixa o chão infértil onde passou.</p>

<p>Os dois são <strong>Séria</strong>, os dois mordem fundo, e a diferença entre encontrar um ou outro é a diferença entre fugir para a clareira e fugir para o escuro. O Espectro não atravessa sol pleno. O Azire come a tocha que você trouxe.</p>

<p>E há a ironia que os coveiros de ruína conhecem e a mesa demora a entender: o Azire <strong>se doma</strong>. É o único necrófago do banco que aceita acordo, e o acordo é entregar os mortos que você tinha para enterrar, um por um.</p>`,
    bichos: [
        ['Espectro da Seiva Negra', 'Contorno que não fecha, gotejando o que corrói. A tocha que você acendeu para vê-lo é a luz fraca a que ele é imune, e agora ele sabe onde você está.'],
        ['Avarbus Azire', 'Maior que o irmão e cintilante. Come cadáver e come fenda com a mesma fome, e o azire nos olhos é o que o torna abordável — o Avarbus comum, sem ele, não tem com o que negociar.'],
    ],
},
];

/* ── leitura das fichas ── */
const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];

for (const c of CAPITULOS) if (arts.some(d => (d.data().title || '') === c.title))
    erros.push(`capítulo "${c.title}" já existe no livro`);

const verbete = (nome, abertura) => {
    const n = npcs.find(x => x.nome === nome && x.tipo === 'criatura');
    if (!n) { erros.push(`"${nome}" não achado em npcs`); return ''; }
    if (n.mesaId) { erros.push(`"${nome}" tem mesa — não entra no bestiário`); return ''; }
    const c = n.criatura || {}, vd = n.valoresDer || {};
    const comp = String(c.comportamento || '');

    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, ([\dd+]+)/.exec(atq);
    if (!g) { erros.push(`"${nome}": golpe não legível — "${atq}"`); return ''; }

    const am = String(c.nivelAmeaca || '');
    const grau = am.split(' · ')[0] || '';
    const forca = (/(\d+,\d+)×/.exec(am) || [])[1];
    const dens = am.split(' · ')[2] || '';
    const redutor = (/Redutor (−?\d+|0)/.exec(am) || [])[1];
    const lealIni = (/Lealdade começa em (\d+)/.exec(am) || [])[1];
    const lealFim = (/vínculo exige (\d+)/.exec(am) || [])[1];
    const sess = (/(\d+) sessões ao todo/.exec(am) || [])[1];
    const indomavel = (/Indomável: ([^·]+)/.exec(am) || [])[1];
    if (!grau || !forca) { erros.push(`"${nome}": nivelAmeaca sem Grau ou força`); return ''; }

    /* o bloco de folclore que a ficha guarda */
    const acha = rx => (rx.exec(comp) || [])[1];
    const efeito = comp.split('\n')[0];
    const sinal = acha(/^O SINAL: (.+)$/m), regra = acha(/^A REGRA: (.+)$/m);
    const remedio = acha(/^O REMÉDIO: (.+)$/m), moral = acha(/^A MORAL: (.+)$/m);
    if (!sinal || !regra || !remedio) { erros.push(`"${nome}": bloco de folclore incompleto no comportamento`); return ''; }
    const m = /RITO DE DOMA\s*\nChamariz: (.+)\nPreço: (.+)\nA prova: (.+)\nO erro: (.+)/.exec(comp);
    if (!m && !indomavel) { erros.push(`"${nome}": sem RITO DE DOMA e sem cláusula de indomável`); return ''; }

    return `
<h3>${esc(nome)}</h3>
<p>${esc(abertura)}</p>
<pre>Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}   ${g[3]}   Vitalidade ${num(Number(vd.VIT).toFixed(1))}   Blindagem ${num(vd.BLD ?? 0)}   ${esc(vd.DESLOCAMENTO || '—')}
${esc(grau)} · ${forca}× o guerreiro · ${esc(dens)}</pre>
<p><strong>O que ela faz.</strong> ${esc(efeito)}</p>
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

for (const c of CAPITULOS) {
    c.html = c.intro + '\n' + c.bichos.map(([n, a]) => verbete(n, a)).join('\n');
    c.words = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    for (const t of ['p', 'h3', 'pre', 'ul', 'li', 'strong', 'em', 'blockquote']) {
        const abre = (c.html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
        const fecha = (c.html.match(new RegExp(`</${t}>`, 'g')) || []).length;
        if (abre !== fecha) erros.push(`"${c.title}": tag <${t}> desbalanceada — ${abre} abre, ${fecha} fecha`);
    }
}

const ordemBase = Math.max(...arts.map(d => Number(d.data().order) || 0));

/* ── relatório ── */
console.log(`\n=== ${CAPITULOS.length} capítulos novos no Bestiário (a partir da ordem ${ordemBase + 1}) ===\n`);
for (const [i, c] of CAPITULOS.entries()) {
    console.log(`── ${ordemBase + 1 + i}. ${c.title}   (${c.words} palavras, ${c.bichos.length} verbetes)`);
    console.log(`   ${c.synopsis}`);
    for (const [n] of c.bichos) {
        const x = npcs.find(y => y.nome === n);
        const am = String(x?.criatura?.nivelAmeaca || '');
        console.log(`      ${n.padEnd(25)} ${am.split(' · ').slice(0, 2).join(' · ')}`);
    }
    console.log('');
}
console.log('Amostra — primeiro verbete do primeiro capítulo:\n');
console.log(CAPITULOS[0].html.split('<h3>')[1].replace(/<[^>]+>/g, '')
    .split('\n').filter(s => s.trim()).map(s => '   ' + s.trim()).join('\n'));

/* quem ainda fica de fora do livro */
/* Nem todo capítulo usa <h3>: o do Abismo cita as criaturas numa TABELA e o dos
   Erguidos em prosa corrida. Procurar só por <h3> dava nove falsos positivos —
   a busca é pelo nome no texto inteiro do livro. */
const noLivro = new Set(CAPITULOS.flatMap(c => c.bichos.map(([n]) => n)));
const textoDoLivro = arts.map(d => String(d.data().contentHTML || '').replace(/<[^>]+>/g, ' ')).join(' ');
const sobra = npcs.filter(n => n.tipo === 'criatura' && !n.mesaId
    && !noLivro.has(n.nome) && !textoDoLivro.includes(n.nome));
if (sobra.length) console.log(`\nℹ Criaturas sem mesa que continuam fora do livro (${sobra.length}): ${sobra.map(n => n.nome).join(' · ')}`);
else console.log('\nℹ Depois destes três capítulos, nenhuma criatura sem mesa fica fora do livro.');

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK: nenhum capítulo colide, toda ficha legível, todas as tags fecham.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const [i, c] of CAPITULOS.entries()) batch.set(db.collection('worldbuilding-articles').doc(), {
    bookId: BOOK, title: c.title, synopsis: c.synopsis, contentHTML: c.html,
    order: ordemBase + 1 + i, words: c.words,
    status: 'rascunho', public: false, mentions: [],
    createdAt: iso, updatedAt: iso, updatedBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ ${CAPITULOS.length} capítulos criados em RASCUNHO (public: false).`);
process.exit(0);
