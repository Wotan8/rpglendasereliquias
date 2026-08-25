/**
 * Capítulo "Classes futuras" no livro Ideias Futuras (Escritório do Cronista).
 *
 * O texto de cada classe é do usuário, na conversa — está aqui palavra por
 * palavra, só quebrado em seções. Não há nome de habilidade, número, recurso nem
 * lore que ele não tenha escrito.
 *
 * Os blocos "Cânone" são CITAÇÃO dos livros do Escritório do Cronista e do
 * cadastro, com a fonte ao lado: servem para quem for cadastrar a classe não
 * ter de redescobrir o gancho (nem o atrito). Também não são extensão da ideia.
 *
 *   node functions/ideias-classes-futuras.mjs            (dry-run)
 *   node functions/ideias-classes-futuras.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const BOOK_ID = 'book-ideias-futuras';
const ART_ID = 'art-classes-futuras';
const CRIADOR_UID = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Cada ideia como o usuário escreveu. `texto` é a citação; `notas` são apontamentos
   de registro (o que já existe hoje no sistema), nunca extensão da ideia. */
const IDEIAS = [
    {
        nome: 'Monge',
        texto: 'Controla a própria essência de vida e pode externalizá-la e mimetizar ela para um outro '
            + 'elemento. Um monge de pedra consegue externalizar sua essência e projetar proteção como se '
            + 'fosse uma rocha etc.',
        notas: [],
    },
    {
        nome: 'Palladino',
        texto: 'Um tipo de guerreiro pesado, mas que usa magia de luz. Ótimo tanker, com magia de proteção '
            + 'e de chamar atenção.',
        notas: [],
    },
    {
        nome: 'Pallamago',
        texto: 'Da Pallomancia, este é o que mais se parece um mago: usa a magia de luz para causar dano e '
            + 'prejudicar os alvos.',
        notas: ['Hoje a Pallomancia tem uma classe só, o <strong>Pallacerdote</strong>.'],
    },
    {
        nome: 'Imitor',
        texto: 'É uma espécie de ferreiro. Segue a mesma ideia do Xamã: pode se especializar em uma '
            + 'vertente ou ser mediano nas duas. Usa uma vertente da Forjarcanomancia. Uma vertente é '
            + 'focada em forjar relíquias falsas e descobrir detalhes de efeitos e capacidades de '
            + 'relíquias reais e falsas — ótimo para “ler” equipamento. A outra é especialista em fazer '
            + 'encantamentos em equipamentos: o nome “Item Mágico” só existe por causa deles. Eles não '
            + 'tentam imitar uma Relíquia (que é um item extremamente poderoso e raro) — apenas dão '
            + 'habilidades específicas para equipamento. Ambas as vertentes sabem fazer afiação comum e '
            + 'Afiação Arcana.',
        notas: [
            'A <strong>Forjarcanomancia</strong> aparece na tabela das Catorze como a escola da '
            + 'Âmbar-Incandescente (Poder), e é a única ali sem compêndio e sem classe — o Imitor seria '
            + 'o primeiro a praticá-la. <em>(Compêndio de Fluxomancia, “As Catorze Essências”)</em>',
            'A Âmbar não tem cristal: mora no <strong>Erídio</strong>, o metal com que se forjam as '
            + 'Relíquias, e é ela que permite a uma Relíquia canalizar as demais Essências. '
            + '<em>(Compêndio de Cristalomancia, “Cristais de Afinidade”)</em>',
            'A farsa já tem material no cânone: a <strong>pirita</strong> “imita o corte, o peso, o '
            + 'lustro — e não brilha, porque não segura nada”; vende-se “para cenário de teatro e para '
            + 'golpe em quem tem pressa”. E a perícia do perito também: a <strong>fluorita</strong> '
            + '“não guarda, acusa”. <em>(Compêndio de Cristalomancia, “Singulares e Ferramentas”)</em>',
            'A <strong>galena</strong> é o material natural da Blindagem Arcana em armadura — encosta na '
            + 'vertente de encantamento. <em>(mesma fonte)</em>',
            'Já existem no cadastro: a perícia <strong>Relíquia</strong> (mental, “entendimento de '
            + 'artefatos antigos, seus efeitos e possíveis usos ou perigos”) e a <strong>Afiação</strong>, '
            + 'que anda junto da Qualidade na regra de equipamento. <em>(Livro de Regras, cap. 5)</em>',
        ],
    },
    {
        nome: 'Bufão',
        texto: 'Uma espécie de palhaço, que tem magia que afeta a sorte e é especialista em magias de buffs '
            + '— criando a dualidade do nome: Bufão com buff.',
        notas: [],
    },
    {
        nome: 'Nobre',
        texto: 'Sabe usar só Esgrima e tem skills de ordem.',
        complemento: 'O poder dele são as ações dos outros: reposiciona, concede ataque, segura a linha '
            + 'que ia quebrar. Não conjura, não cura e não bate melhor que o Guerreiro.',
        notas: [
            'O parágrafo em itálico é a proposta de “comandante” aceita na conversa, não escrita pelo '
            + 'autor — está aqui porque foi o que o nome veio responder.',
            'A perícia <strong>Liderança</strong> já existe e já serve: “inspiração e comando sobre grupos, '
            + 'aliados ou subordinados… usar para: comandar tropa”. As ordens podem sair dela em vez de '
            + 'uma perícia nova. <em>(cadastro, perícia social)</em>',
            '<strong>Esgrima não existe</strong> no cadastro. As perícias de combate são as onze de defesa '
            + 'e manobra (Aparar, Bloquear, Contra-Ataque…); quem acerta o golpe é a perícia <strong>Arma'
            + '</strong>. Já as armas existem: <strong>Estoque</strong> (1d6) e <strong>Sabre</strong> (1d8) '
            + 'estão no catálogo. <em>(cadastro)</em>',
            '<strong>Atrito:</strong> “sabe usar só Esgrima” esbarra numa decisão já tomada — '
            + '“especializações de equipamento foram removidas: não existe mais redutor por falta de '
            + 'treino”. Hoje ninguém é proibido de pegar uma arma. A restrição precisa virar outra coisa '
            + '(perícia exclusiva da classe, manobra que só funciona com lâmina leve, ou sabor puro). '
            + '<em>(Livro de Regras, cap. 1)</em>',
            '<strong>Moral</strong> e <strong>Lealdade</strong> já são régua no sistema, mas de criatura e '
            + 'de NPC — nenhuma classe de jogador os toca. <em>(Bestiário, “Como se lê uma fera”)</em>',
            '<strong>Em aberto:</strong> numa mesa de quatro aventureiros, quem ele comanda? Se for os '
            + 'outros jogadores, a classe rouba turno alheio. Só fecha se o alvo forem os aliados e NPCs '
            + 'que a ficha já sustenta.',
            '<strong>Em aberto (mundo):</strong> Vasteluna não tem nobreza feudal escrita — tem tribos, e '
            + 'o Conselho de Sábios Ganute. O que encosta em “nobre” é a raça <strong>Karu-Real</strong> '
            + '(“presença aristocrática, chifres discretos como coroa natural; há algo antigo e nobre '
            + 'nesse sangue”) e o padrão de vida <strong>Aristocrático</strong> (1.000+ L$). O título '
            + 'precisa de uma casa: sangue Karu-Real, ou dinheiro de Sereni? '
            + '<em>(Livro de Regras, caps. 3 e 5)</em>',
        ],
    },
];

function montarHTML() {
    const p = [];
    p.push(`<h1>Classes futuras</h1>`);
    p.push(`<p><em>Ideias de classe que ainda não viraram cadastro. Cada uma está como foi dita — sem
        mecânica, sem número e sem recurso definido. Quando alguma for para a mesa, é aqui que ela começa.</em></p>`);
    p.push(`<p>Onde houver <strong>Cânone</strong>, é apontamento do que os livros já fixam sobre aquilo —
        gancho e atrito, não extensão da ideia.</p>`);
    p.push(`<p>As onze classes que já existem: Adepto de Thannathog, Bardo, Caçador, Druida, Guerreiro,
        Invocador do Abismo, Ladino, Pallacerdote, Runimago, Sangral e Xamã.</p>`);
    p.push(`<hr>`);

    for (const i of IDEIAS) {
        p.push(`<h2>${esc(i.nome)}</h2>`);
        p.push(`<p>${esc(i.texto)}</p>`);
        if (i.complemento) p.push(`<p><em>${esc(i.complemento)}</em></p>`);
        if (i.notas.length) {
            p.push(`<blockquote><p><strong>Cânone</strong></p><ul>`
                + i.notas.map(n => `<li>${n}</li>`).join('') + `</ul></blockquote>`);
        }
    }

    p.push(`<hr>`);
    p.push(`<p><em>Nada aqui está balanceado nem tem Domínio, escada de módulo ou custo em Energia
        definidos. Antes de cadastrar qualquer uma, a régua do sistema é que decide os números.</em></p>`);
    return p.join('\n');
}

const livro = await db.doc(`worldbuilding-books/${BOOK_ID}`).get();
if (!livro.exists) {
    console.log(`❌ o livro ${BOOK_ID} não existe — rode antes o arquiva-golpes-do-verde.mjs`);
    process.exit(1);
}

const html = montarHTML();
const agora = Date.now();
const anterior = await db.doc(`worldbuilding-articles/${ART_ID}`).get();

const capitulo = {
    title: 'Classes futuras',
    synopsis: IDEIAS.map(i => i.nome).join(' · '),
    contentHTML: html,
    bookId: BOOK_ID, order: 1,
    status: 'rascunho', public: false,
    mentions: [],
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    createdAt: anterior.exists ? (anterior.data().createdAt || agora) : agora,
    updatedAt: agora, updatedBy: CRIADOR_UID,
};

console.log(`📄 ${anterior.exists ? 'atualizar' : 'criar'} "${capitulo.title}" (${ART_ID}) em "${livro.data().title}"`);
console.log(`   ${IDEIAS.length} ideias: ${capitulo.synopsis}`);
console.log(`   ${capitulo.words} palavras · público: ${capitulo.public} · status: ${capitulo.status}`);

if (!APPLY) {
    writeFileSync('__previa-classes-futuras.html', `<meta charset="utf-8">${html}`, 'utf8');
    console.log('\n(dry-run — prévia em functions/__previa-classes-futuras.html)');
    process.exit(0);
}

await db.doc(`worldbuilding-articles/${ART_ID}`).set(capitulo);
console.log('\n✅ capítulo gravado');
process.exit(0);
