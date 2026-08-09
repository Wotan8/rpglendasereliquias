/**
 * Cria o Compêndio de Cristalomancia — o estudo dos cristais de Vasteluna.
 *
 * NÃO público: nasce para revisão do dono do mundo. Nomes de cristal são
 * PROPOSTAS (minerais reais sempre que possível — rubi, selenita, iolita —
 * exatamente como autorizado; os poucos inventados vão marcados).
 *
 * Amarras de cânone respeitadas:
 *  - §5.1 do Livro: Lun é cristal que brilha com luz própria, infalsificável
 *    pela luminosidade, Luni/Ka'Luni/Mi'Luni. O compêndio EXPLICA isso, não
 *    contradiz.
 *  - As Catorze Essências: Vida não persiste fora de corpo vivo → a safira não
 *    "guarda" Vida solta; Dourada mora no Erídio (metal) → NÃO existe cristal
 *    áureo, e a pirita é a farsa; Iridescente/Cristal é o recipiente das outras;
 *    cristais alimentam a Runomancia longe das Linhas de Ley.
 *  - Nenhum nome de instituição inventado (regra da casa): guildas e ofícios
 *    ficam genéricos, com [LACUNA] onde faltar.
 *
 *   node functions/criar-compendio-cristalomancia.mjs            (dry-run)
 *   node functions/criar-compendio-cristalomancia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK_ID = 'book-cristalomancia';

const LIVRO = {
    title: 'Compêndio de Cristalomancia',
    description: 'O estudo dos cristais: como a pedra guarda o que a carne não segura. O Lun e a '
        + 'economia da luz, os cristais de afinidade das Catorze Essências, os singulares, e o pó '
        + 'de cristal na bancada do alquimista.',
    cover: '', order: 8, public: false,
};

const CAPS = [
{
    title: 'A Cristalomancia',
    synopsis: 'O que é o estudo dos cristais, por que a pedra guarda carga, e quem vive disso.',
    html: `
<p>A Essência flui, queima, apodrece e se dissipa. Só uma coisa no mundo a segura parada sem ser um corpo vivo: <strong>o cristal</strong>. As Catorze Essências (Compêndio de Fluxomancia) dizem da Iridescente que ela é o recipiente das outras — <em>"a essência que torna possível guardar carga e transportá-la; sem ela, nenhuma runa acenderia longe de uma Linha de Ley"</em>. A Cristalomancia é o estudo dessa exceção: que pedras seguram o quê, por quanto tempo, e a que preço.</p>
<p>Não é uma escola de magia. O cristalomante não conjura — <strong>mede, lapida e carrega</strong>. É ofício de bancada e de mina, mais próximo do ferreiro que do mago, e é por isso que toda escola depende dele e nenhuma o admite como igual. O runomante compra seus cristais carregados; o alquimista compra seu pó; o templo compra seu topázio. Quem corta a pedra não lança o feitiço, mas decide quanta magia cabe nele.</p>
<h3>As três medidas de um cristal</h3>
<table>
<thead><tr><th>Medida</th><th>O que diz</th></tr></thead>
<tbody>
<tr><td><strong>Afinidade</strong></td><td>que Essência a pedra aceita. A maioria aceita uma; o Lun, nenhuma e todas — ver capítulo seguinte.</td></tr>
<tr><td><strong>Capacidade</strong></td><td>quanta carga segura antes de rachar. Cresce com a lapidação, nunca com o tamanho bruto: pedra grande mal cortada é pedra pequena com peso.</td></tr>
<tr><td><strong>Pureza</strong></td><td>quanto vaza. Cristal impuro devolve a carga em dias; um bem lapidado, em estações. A Qualidade (0–5) do catálogo mede exatamente isto.</td></tr>
</tbody>
</table>
<h3>De onde vem</h3>
<p>Cristal de afinidade nasce onde a Essência empoça: rubi em campo de fogo antigo, ametista onde os mortos descansam fundo, selenita em caverna onde o tempo anda devagar. A regra do coletor é causal e cruel — <strong>o cristal bom cresce exatamente onde é perigoso colher</strong>. Quem controla um veio controla a magia de uma região inteira, e as guerras por minas não são raras. <em>[LACUNA: que casas, guildas ou coroas controlam os grandes veios — a decidir pelo dono do mundo.]</em></p>
`,
},
{
    title: 'O Lun — a economia da luz',
    synopsis: 'Por que a moeda de Vasteluna brilha, por que não se falsifica, e o que isso obriga o mundo a ser.',
    html: `
<p>O Livro de Regras (§5.1) diz o que todo mercador sabe: o <strong>Lun</strong> é um pequeno cristal que brilha com luz própria, e não se falsifica porque a luminosidade denuncia a autenticidade. Este capítulo diz o que o mercador <em>não</em> sabe: <strong>por quê</strong>.</p>
<p>O Lun é o único cristal de <strong>carga neutra</strong>: guarda Essência sem cor, que qualquer escola pode sorver e nenhuma pode envenenar. O brilho é o vazamento mínimo dessa carga — um Lun brilha porque está <em>cheio</em>. Um Lun descarregado apaga, e Lun apagado não vale nada: ninguém aceita moeda escura. É por isso que a falsificação falha: pode-se imitar a forma, o corte, até o peso — a pirita faz tudo isso — mas não se imita luz que nasce de dentro.</p>
<blockquote><p><strong>A moeda de Vasteluna é lastreada em energia.</strong> Um Luni não representa valor: contém valor. Quem paga, paga em magia potencial.</p></blockquote>
<h3>Consequências (e é aqui que o mundo fica interessante)</h3>
<ul>
<li><strong>Queimar dinheiro é literal.</strong> Um conjurador encurralado pode sorver a própria bolsa. O que um Luni alimenta, quanto rende — <em>[A PRECIFICAR na Régua; a taxa é decisão de balanceamento, não de lore]</em>.</li>
<li><strong>Riqueza pesa e brilha.</strong> Não existe fortuna discreta em Luns: um cofre cheio é visível no escuro. Os ricos de verdade convertem em Ka'Luni e Mi'Luni — cristais maiores, mais raros, de lapidação controlada — ou em terra, aço e favores.</li>
<li><strong>Alguém lapida os Luns.</strong> Moeda que é cristal exige quem a corte e a carregue. Quem controla essa forja controla a emissão de moeda do mundo. <em>[LACUNA: quem cunha os Luns — coroa, guilda, templo? Decisão grande demais para este compêndio.]</em></li>
<li><strong>O nome.</strong> Os estudiosos divergem: uns dizem que o Lun leva o nome da lua — pequenas luas que cabem na palma, no mundo da Lua Vasta — outros, que Vasteluna é que herdou o nome da moeda que a unifica. As duas versões servem a quem as conta. <em>[PROPOSTA de etimologia — o dono do mundo decide, ou deixa em disputa.]</em></li>
</ul>
`,
},
{
    title: 'Cristais de Afinidade',
    synopsis: 'Um cristal para cada Essência que aceita ser guardada — e as duas que não aceitam.',
    html: `
<p>Treze Essências têm cor; nem todas têm pedra. A lista abaixo é o consenso dos lapidários — minerais reais de Vasteluna, colhidos onde cada Essência empoça. A capacidade e o preço variam com a Qualidade; os efeitos são a <em>natureza</em> da pedra, iguais do cascalho ao Graal.</p>
<table>
<thead><tr><th>Cristal</th><th>Essência</th><th>Natureza</th></tr></thead>
<tbody>
<tr><td><strong>Rubi</strong></td><td>Vermelha — Fogo</td><td>Morno ao toque mesmo no inverno. Carregado, aquece sem queimar; estilhaçado, cospe a carga inteira em brasa — o runomante o usa como munição tanto quanto como bateria.</td></tr>
<tr><td><strong>Celestina</strong></td><td>Cinza-Claro — Vento</td><td>Leve demais para o tamanho, canta um zumbido fino quando o ar muda. Pendurada, vira sino de tempestade; moída, a loção que a leva não gruda no chão — ver capítulo do alquimista.</td></tr>
<tr><td><strong>Olho-de-Tigre</strong></td><td>Ocre — Terra</td><td>Pesa o dobro do que aparenta. Enterrado no alicerce, a parede racha mais devagar; no punho de uma picareta, a rocha cede mais rápido. A pedra entende a pedra.</td></tr>
<tr><td><strong>Água-Marinha</strong></td><td>Azul-Claro — Água</td><td>Sempre fria, sua atmosfera úmida. Na boca, engana a sede por um dia — os que atravessam desertos as chupam como pastilhas, e as devolvem gastas.</td></tr>
<tr><td><strong>Safira</strong></td><td>Azul — Vida</td><td>A exceção que confirma o cânone: a Vida não persiste fora de corpo vivo, e a safira solta é só uma pedra bonita. <strong>Engastada na carne viva</strong>, porém, pulsa com o portador e segura uma reserva do que ele é. Arrancada, apaga na hora. É o único cristal que se <em>implanta</em> — e o mercado disso é exatamente tão sórdido quanto parece.</td></tr>
<tr><td><strong>Esmeralda</strong></td><td>Verde — Natureza</td><td>Enterrada, o solo em volta acorda: brota o que dormia, num círculo de passos. Os herboristas plantam esmeraldas gastas como quem aduba. Colhida de veio virgem, vem coberta de raízes que ninguém plantou.</td></tr>
<tr><td><strong>Ametista</strong></td><td>Púrpura — Necrótica</td><td>Cresce onde os mortos descansam fundo — catacumba velha é jardim de ametista. Segura o Necrótico como nenhuma outra pedra, e é por isso que todo talismã profano a carrega. Dormir com uma debaixo do travesseiro dá os sonhos errados.</td></tr>
<tr><td><strong>Opala</strong></td><td>Iridescente — Cristal</td><td>A pedra da própria Essência-recipiente: muda de cor conforme a carga que segura, e é a única que aceita <em>qualquer</em> afinidade — uma de cada vez. Cara, instável, indispensável: é dela que se fazem os condutos que a Runomancia chama de finos.</td></tr>
<tr><td><strong>Topázio</strong></td><td>Amarela — Luz</td><td>Bebe o sol o dia inteiro e o devolve à noite, fiel como um criado velho. Lanterna que não chama o vento, luz que o Necrótico e o Abissal detestam. Os templos o engastam em tudo.</td></tr>
<tr><td><strong>Iolita</strong></td><td>Índigo — Espaço</td><td>A pedra do navegador: olhada contra o céu, acha o sol atrás da nuvem — ela <em>dobra a luz</em>, como o Espaço dobra o caminho. Marcos de teleporte, âncoras de selo e bússolas que apontam para onde não se vê usam iolita ou não funcionam.</td></tr>
<tr><td><strong>Selenita</strong></td><td>Prateada — Tempo</td><td>Cresce em caverna onde o ar não se move há séculos, em lâminas de prata fosca. Perto dela, a vela queima devagar. É das poucas coisas que seguram a Prateada sem desastre — e mesmo assim os lapidários a cortam com o testamento em dia.</td></tr>
<tr><td><strong>Obsidiana</strong></td><td>Preta — Abissal</td><td>Não guarda o Abissal — <strong>nada guarda</strong>, ele consome o cofre. A obsidiana é a cicatriz: vidro negro que nasce onde o Abismo tocou e a matéria desistiu. Não armazena carga; <em>lembra</em>. Selos abissais são riscados nela porque ela já conhece a assinatura.</td></tr>
<tr><td><strong>Granada</strong></td><td>Carmesim — Sangue</td><td>Vermelha de dentro, como coisa que ainda não secou. Diz-se que cresce onde a terra bebeu sangue demais — campo de batalha velho é garimpo de granada. Segura sangue <em>morto</em> sem deixá-lo apodrecer: o hemomante a usa como reservatório do que já não vive. <em>[NOVO — decorre da 14ª Essência; o efeito exato para o Sangral está por precificar.]</em></td></tr>
</tbody>
</table>
<h3>As que não têm pedra</h3>
<p><strong>Áurea (Âmbar-Incandescente — Poder):</strong> não existe cristal áureo. A Dourada mora no <strong>Erídio</strong>, que é metal — e metal não é assunto deste compêndio. O que existe é a farsa: ver a pirita, no capítulo seguinte.</p>
`,
},
{
    title: 'Singulares e Ferramentas',
    synopsis: 'Os cristais que não guardam Essência — fazem outra coisa. Do detector à farsa, da bateria de Ley ao chumbo dos arcanistas.',
    html: `
<table>
<thead><tr><th>Cristal</th><th>O que faz</th></tr></thead>
<tbody>
<tr><td><strong>Quartzo Claro</strong></td><td>O cristal do pobre: aceita carga neutra como o Lun, mas <em>vaza</em> — em dias está escuro. É por isso que o quartzo é vidro de janela e o Lun é moeda. Aprendizes de Runomancia treinam nele porque errar em quartzo é barato.</td></tr>
<tr><td><strong>Pirita</strong></td><td>O ouro-dos-tolos, e a razão de o §5.1 dizer que Lun não se falsifica. Imita o corte, o peso, o lustro — e não brilha, porque não segura nada. Toda tentativa de moeda falsa em Vasteluna morre na primeira sala escura. Vende-se pirita, ainda assim: para cenário de teatro e para golpe em quem tem pressa.</td></tr>
<tr><td><strong>Lágrima de Ley</strong></td><td>Cristal que cresceu <em>em cima</em> de uma Linha de Ley: nasce carregado e recarrega sozinho enquanto estiver perto da Linha. A bateria perfeita — e presa ao lugar. Arrancada da Linha, vira quartzo caro que se esvazia como qualquer outro. Vende-se a mina, nunca a pedra.</td></tr>
<tr><td><strong>Galena</strong></td><td>O chumbo dos arcanistas: não guarda Essência — <strong>barra</strong>. Lâminas de galena forram cofres, coifas e celas contra magia. É o material natural da Blindagem Arcana em armadura <em>[gancho para o reforço arcano do catálogo; taxa por precificar]</em>. Pesada, tóxica de trabalhar, e os lapidários que vivem dela morrem cedo.</td></tr>
<tr><td><strong>Fluorita</strong></td><td>Não guarda, <em>acusa</em>: perto de Essência solta, fulge na cor dela. A pedra do perito — o fluxomante a esfrega na parede para saber que escola passou por ali. Fluorita queimada de uma cor só nunca mais acusa outra.</td></tr>
<tr><td><strong>Cinábrio</strong></td><td>Vermelho vivo, veneno velho: o minério que sangra mercúrio. Moído, é ingrediente mineral de <strong>Toxis</strong> — o veneno que não veio de planta e que antídoto de erva custa a reconhecer. Minerador de cinábrio conta os dedos e os anos.</td></tr>
<tr><td><strong>Sal-Gema</strong></td><td>O cristal humilde que preserva: carne, couro, cadáver, reagente. Moído em loção, é ingrediente de <strong>Caltra</strong> — purga e conserva. Necromantes compram sal-gema em quantidade que faz o vendedor não perguntar.</td></tr>
<tr><td><strong>Magnetita</strong></td><td>A pedra que aponta e agarra. Bússola, é o uso honesto; o outro é a âncora — engastada em grilhão, dificulta o teleporte de quem o veste <em>[gancho para a condição Ancorado; taxa por precificar]</em>.</td></tr>
<tr><td><strong>Ecoíta</strong></td><td><em>[nome inventado — veto à vontade]</em> Geodo oco que guarda um som: o que se grita dentro dele fica, até alguém o abrir. Mensageiro que não trai, testemunha que não mente — e o Bardo que descobre um veio fica rico ou some.</td></tr>
</tbody>
</table>
`,
},
{
    title: 'O Cristal na Bancada — Alquimancia mineral',
    synopsis: 'Pó de cristal como ingrediente: a ponte entre a Cristalomancia e as loções.',
    html: `
<p>A Alquimancia sempre trabalhou com o que cresce. O ramo mineral — previsto no cânone das Catorze Essências, que dá à arte a Verde <em>e</em> a Iridescente — trabalha com o que <strong>não cresce: mói</strong>.</p>
<h3>Pó de cristal é ingrediente</h3>
<p>Cristal moído entra na loção como qualquer erva: carrega propriedades, com potência conforme a Qualidade da pedra sacrificada. A diferença é <strong>o que</strong> ele carrega:</p>
<ul>
<li><strong>Cinábrio</strong> → Toxis (mineral) · <strong>Sal-Gema</strong> → Caltra · <strong>Água-Marinha</strong> → Vitalis fraco e frio;</li>
<li><strong>Pó de cristal de afinidade</strong> → a loção ganha <em>canal de Essência</em>: uma loção de Toxis com pó de rubi fere também no canal Ígneo — dano tipado, contra a Blindagem da Essência, seguindo a régua de dano por barreira já fixada. É o único jeito de uma <em>pasta</em> carregar fogo sem queimar o boticário.</li>
</ul>
<p>O custo é o óbvio: <strong>moer cristal é queimar dinheiro</strong> — literalmente, no caso do Lun. A loção mineral é sempre mais cara que a botânica, e é essa a trava econômica: ninguém unta a lâmina com rubi para matar um ladrão de galinha.</p>
<h3>O que o pó não faz</h3>
<ul>
<li>Não dá área: loção é pastosa, com pó ou sem pó;</li>
<li>Não guarda carga na loção pronta — o pó <em>morre</em> na maceração; o efeito é da mistura, não uma bateria;</li>
<li>Não substitui a planta: propriedade botânica e mineral <strong>somam e reagem pelas mesmas regras</strong> da especificação de loções. Um par novo entre propriedade de erva e de pedra é descoberto como qualquer outro: na falha crítica de alguém corajoso.</li>
</ul>
<p><em>Os ingredientes minerais entram no catálogo pela mesma régua dos botânicos: soma das potências define raridade e preço. Cinábrio e sal-gema são de mercado; pó de opala é de expedição.</em></p>
`,
},
];

/* ═══ CONFERÊNCIAS ═══ */
const colLivros = db.collection('worldbuilding-books');
const colArts = db.collection('worldbuilding-articles');
const jaExiste = (await colLivros.doc(BOOK_ID).get()).exists;
const artsExistentes = (await colArts.where('bookId', '==', BOOK_ID).get()).docs;

const cristais = CAPS.map(c => (c.html.match(/<strong>[A-ZÁÂÉÍÓÔÚÇ][^<]{2,20}<\/strong>/g) || [])).flat().length;
console.log('=== Compêndio de Cristalomancia ===\n');
console.log(`  ${LIVRO.title}  (public: ${LIVRO.public})`);
for (const c of CAPS) {
    const palavras = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`  ${c.title.padEnd(38)} ${String(palavras).padStart(4)} palavras`);
}
console.log(`\n  13 cristais de afinidade + 9 singulares + Lun = 23 pedras.`);
console.log('  Amarras: §5.1 (Lun) explicado sem contradição · safira obedece "Vida não persiste');
console.log('  fora de corpo vivo" · sem cristal áureo (Dourada mora no Erídio) · obsidiana não');
console.log('  guarda Abissal (nada guarda). Instituições ficaram [LACUNA], nunca nomeadas.');

if (jaExiste || artsExistentes.length) {
    console.error(`\n🔴 ABORTADO: livro já existe (${artsExistentes.length} capítulos).`);
    process.exit(1);
}
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
batch.set(colLivros.doc(BOOK_ID), { ...LIVRO, createdAt: agora, updatedAt: agora, updatedBy: AUTOR });
CAPS.forEach((c, i) => {
    batch.set(colArts.doc(), {
        bookId: BOOK_ID, title: c.title, synopsis: c.synopsis, contentHTML: c.html.trim(),
        order: i, status: 'rascunho', public: false, mentions: [],
        words: c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        createdAt: agora, updatedAt: agora, updatedBy: AUTOR,
    });
});
await batch.commit();
console.log(`\n✅ Livro criado com ${CAPS.length} capítulos (não público, rascunho).`);
process.exit(0);
