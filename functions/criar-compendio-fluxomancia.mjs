import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const BOOK_ID = 'book-fluxomancia';
const ART_ID = 'art-fluxomancia-13-essencias';
const EMAIL = 'igorestevamalvesdesouza@gmail.com';

const ent = (cor, dominio, corpo) =>
  `<h3>Essência ${cor} — ${dominio}</h3>\n${corpo}`;

const contentHTML = `<p><em>Fluxomancia — a base teórica de toda magia. Capítulo 1.</em></p>

<p>A Essência é uma só. O que muda é a natureza que ela assume ao se manifestar, e essa natureza pode ser vista — por quem sabe olhar — como cor. São treze as formas conhecidas. Nenhuma escola trabalha com todas: cada arte se especializa em duas ou três e trata as demais como matéria estranha, perigosa ou inútil. A perícia de <strong>Fluxomancia</strong> é justamente o que permite distinguir uma da outra antes de tocá-la.</p>

<p>As treze não estão soltas. Formam ciclos, oposições e dependências que este compêndio detalha em capítulo próprio; aqui elas aparecem agrupadas pela relação que as prende umas às outras.</p>

<h2>Tabela das Treze</h2>

<table>
<thead><tr><th>Cor</th><th>Domínio</th><th>Quem trabalha com ela</th></tr></thead>
<tbody>
<tr><td>Vermelha</td><td>Fogo</td><td>Runomancia</td></tr>
<tr><td>Cinza</td><td>Vento</td><td>Runomancia, Sonoromancia</td></tr>
<tr><td>Marrom</td><td>Terra</td><td>Runomancia</td></tr>
<tr><td>Azul-Claro</td><td>Água</td><td>Runomancia</td></tr>
<tr><td>Azul</td><td>Vida</td><td>Hemomancia, Pallomancia, Totemancia</td></tr>
<tr><td>Verde</td><td>Natureza</td><td>Totemancia, Alquimancia</td></tr>
<tr><td>Púrpura</td><td>Necrótica</td><td>Necromancia</td></tr>
<tr><td>Amarela</td><td>Luz</td><td>Pallomancia</td></tr>
<tr><td>Branca</td><td>Espaço</td><td>Pallomancia</td></tr>
<tr><td>Prateada</td><td>Tempo</td><td>Runomancia (restrita)</td></tr>
<tr><td>Rosa</td><td>Cristal</td><td>Runomancia</td></tr>
<tr><td>Preta</td><td>Abissal</td><td>Abismancia</td></tr>
<tr><td>Dourada</td><td>Poder</td><td>Forjarcana</td></tr>
</tbody>
</table>

<h2>As Quatro do Ciclo</h2>

<p>Vento, Terra, Água e Fogo consomem-se em roda fechada: o Vento consome a Terra, a Terra consome a Água, a Água consome o Fogo, e o Fogo consome o Vento. Vento e Terra são opostos; Água e Fogo também. Nenhuma delas se esgota, porque cada uma se alimenta da seguinte. São as quatro que mais aparecem em runa comum e as únicas cujas combinações a Runomancia classifica como <em>físicas</em> — permitidas a qualquer aprendiz.</p>

${ent('Vermelha', 'Fogo', `<p>Destrutiva, transformadora, apaixonante. Conjura chamas para ataque ou iluminação, provoca explosões em área, e usa o calor para moldar ou consumir materiais.</p>
<p><strong>Limitação:</strong> responde mal ao som — a chama obedece à pressão, não à melodia.</p>
<p><strong>Confluências físicas:</strong> Vapor (com Água), Lava e Metal (com Terra), Fumaça (com Vento), Cinzas (com Natureza).</p>`)}

${ent('Cinza', 'Vento', `<p>Movimento, liberdade e comunicação. Cria rajadas, tornados e zonas de calmaria; acelera o usuário ou retarda o inimigo; carrega sons e mensagens por distâncias longas.</p>
<p><strong>Particularidade:</strong> é a mais responsiva ao som de todas as treze, porque som é perturbação nas correntes de ar. A Voz do Sopro da Sonoromancia conecta-se diretamente a ela.</p>
<p><strong>Confluências físicas:</strong> Névoa e Gelo (com Água), Areia (com Terra), Fumaça (com Fogo).</p>`)}

${ent('Marrom', 'Terra', `<p>Estabilidade, força e resiliência. Ergue barreiras de rocha, lança projéteis minerais, abriga quem a invoca e remodela o terreno em vantagem tática.</p>
<p><strong>Limitação:</strong> sólidos conduzem o som mas resistem à manipulação por ele — através da terra, só a percussão funciona, e ainda assim com dificuldade.</p>
<p><strong>Confluências físicas:</strong> Lava e Metal (com Fogo), Areia (com Vento), Lama e Sal (com Água).</p>`)}

${ent('Azul-Claro', 'Água', `<p>Fluida, adaptável e curativa — a serenidade do rio e a fúria da tempestade. Move e molda líquidos em qualquer estado, congela superfícies, armas e inimigos, e purifica venenos, doenças e impurezas.</p>
<p><strong>Particularidade:</strong> ondas sonoras viajam bem nela; efeitos de Água ganham força debaixo d'água, ainda que todo o resto perca.</p>
<p><strong>Confluências físicas:</strong> Vapor (com Fogo), Névoa e Gelo (com Vento), Lama e Sal (com Terra).</p>`)}

<h2>O Ciclo Vital</h2>

<p>Vida, Natureza e Necrótica formam a cadeia que todo ser vivo percorre. A Natureza converte-se em Vida quando algo nasce e reclama a Vida de volta quando algo morre. A Vida, corrompida, torna-se Necrótica; e a Necrótica consome a Natureza, sendo sua oposta direta. É o ciclo mais disputado do mundo: três escolas o encaram de três ângulos incompatíveis.</p>

${ent('Azul', 'Vida', `<p>O alicerce da criação. Restaura vitalidade, revitaliza e fortalece aliados, e gera vida nova em ambientes férteis. É a essência que pulsa no sangue de toda criatura viva — Centelha Vital, Pulso Primordial, Chama-Azul.</p>
<p><strong>Limitação decisiva:</strong> só permanece Azul enquanto conectada a um corpo vivo. Separada dele, dissipa-se e a Natureza a reclama. É por isso que o hemomante controla o sangue nas veias e na Bolha, mas perde o que derrama.</p>`)}

${ent('Verde', 'Natureza', `<p>Flora, fauna e equilíbrio ecológico. Faz plantas crescerem num instante, convoca criaturas naturais e regenera ambientes arruinados.</p>
<p><strong>Dupla face:</strong> para o hemomante, sangue que virou Verde é matéria morta e perdida. Para o Xamã, é exatamente ali que o trabalho começa — a Essência Verde é o repositório dos Ecos da Alma, onde os vestígios dos mortos permanecem antes de se dissolverem.</p>`)}

${ent('Púrpura', 'Necrótica', `<p>A energia da morte e do renascimento, ligada ao ciclo de decomposição. Levanta cadáveres, drena a vitalidade dos vivos e cura por meio necrótico — sempre a um custo, seja dor ou marca permanente.</p>
<p><strong>Origem:</strong> flui do Véu Terreno, a camada mais próxima entre o mundo dos vivos e a Sétima Camada de Thannathog. Ao invadir um cadáver, não regenera: corrompe a essência de vida que se esvai e forja ali um novo selo de movimento.</p>
<p><strong>Limitação:</strong> sangue corrompido por ela resiste à manipulação hemática e pode contaminar quem tentar absorvê-lo.</p>`)}

<h2>As Estruturais</h2>

<p>Luz, Espaço e Tempo governam a armação da realidade em vez de seu conteúdo. A Luz depende do Espaço para contornar o que a bloqueia; Espaço e Tempo são inseparáveis entre si. São as essências das quais a Pallomancia extrai sua liturgia e as que a Runomancia mais teme combinar.</p>

${ent('Amarela', 'Luz', `<p>Calor, revelação e purificação — a energia solar. Cura e purifica, cega e queima com explosões luminosas, ergue barreiras sagradas.</p>
<p><strong>Vantagem:</strong> tem bônus natural contra o Necrótico e o Abissal. É a principal força de contenção contra ambos.</p>
<p><strong>Limitação:</strong> viaja em linha reta. Linha de visão e ângulo importam sempre, e muros, escudos e corpos a bloqueiam — só o Espaço muda isso. A cura pela Luz é quente e cauteriza ao curar.</p>`)}

${ent('Branca', 'Espaço', `<p>Governa as dimensões: dobra, estica e manipula a extensão ao redor. Teleporta por curtas distâncias, cria bolsões dimensionais e barreiras, ancora selos e distorce a percepção de distância e de gravidade.</p>
<p><strong>Função estrutural:</strong> é o que permite à Luz alcançar o que não vê — contornar obstáculos, atingir aliados fora de vista, reposicionar combatentes.</p>
<p><strong>Limitação:</strong> exige geometria precisa. Erro de traçado gera Eco forte, e o Espaço é quase surdo a qualquer som.</p>`)}

${ent('Prateada', 'Tempo', `<p>Controla a passagem: acelera, retarda ou congela o tempo em áreas limitadas, cria bolhas temporais onde as horas correm em outro passo, e concede vislumbres do passado e de futuros possíveis.</p>
<p><strong>Raridade:</strong> é das mais raras e das mais perigosas. Distorcer o tempo afeta a realidade de maneiras que ninguém consegue prever inteiramente.</p>
<p><strong>Confluências proibidas:</strong> Cronogelo (com Água) e Chama Eterna (com Fogo) — a segunda exige licença; a primeira, nenhuma licença cobre.</p>`)}

<h2>As Singulares</h2>

<p>Três essências não pertencem a ciclo nenhum. O Cristal serve de recipiente às outras, o Abissal consome e corrompe todas, e a Dourada é a única capaz de canalizá-las sem se alterar.</p>

${ent('Rosa', 'Cristal', `<p>Estrutura, pureza e amplificação. Converte matéria em formas cristalinas que servem de arma, armadura, barreira ou conduíte; intensifica feitiços lançados através dos cristais que cria.</p>
<p><strong>Importância prática:</strong> os cristais que alimentam a Runomancia são dessa natureza. É a essência que torna possível guardar carga e transportá-la — sem ela, nenhuma runa acenderia longe de uma Linha de Ley.</p>
<p><strong>Particularidade:</strong> responde ao som de modo imprevisível. A frequência certa amplifica; a errada estilhaça.</p>`)}

${ent('Preta', 'Abissal', `<p>O poder do vazio e do caos primordial. Inspira pânico e paralisia, convoca seres do Abismo e desintegra matéria em vórtices de energia caótica.</p>
<p><strong>Origem:</strong> vem de além da Oitava Camada, onde é chamada de <em>Abissência</em> — matéria-essência coringa, capaz de criar, conceber vida, distorcer ou dissolver.</p>
<p><strong>Limitação:</strong> consome e corrompe tudo que toca, inclusive quem a usa. Não existe magia abissal discreta: todo rito deixa rastro no lugar, no ritualista e no que estiver por perto. Sangue tocado por ela fere quem o absorve, e o Abismo responde ao chamado sonoro com fome.</p>`)}

${ent('Dourada', 'Poder', `<p>Amplifica qualquer essência que toque e permanece estável fazendo isso. É moralmente neutra: não tende ao bem nem ao mal, e seu resultado depende inteiramente de quem a maneja e do que se combina com ela.</p>
<p><strong>Onde se encontra:</strong> no Erídio, o metal místico com que se forjam as Relíquias. Todo Erídio carrega traços dela, e é ela que permite a uma Relíquia canalizar e manipular as demais essências. Quanto mais pura e controlada na forja, mais estável e poderosa a peça resultante.</p>
<p><strong>Particularidade:</strong> nenhum som mortal ressoa com ela. Tentar afetá-la pela Sonoromancia não falha — machuca.</p>`)}
`;

const plain = contentHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const now = Date.now();

const sib = (await db.collection('worldbuilding-articles').doc('art_ms3gb954k59x5d').get()).data()
  || (await db.collection('worldbuilding-articles').where('title', '==', 'Sonoromancia').get()).docs[0].data();

await db.collection('worldbuilding-books').doc(BOOK_ID).set({
  title: 'Compêndio de Fluxomancia',
  description: 'A doutrina da Essência: o que ela é, em quantas formas se manifesta e como cada uma se relaciona com as outras. Base teórica de todas as escolas.',
  cover: '',
  order: -1,
  createdAt: now,
  updatedAt: now,
  updatedBy: EMAIL,
  public: false,
});

await db.collection('worldbuilding-articles').doc(ART_ID).set({
  title: 'As Treze Essências',
  bookId: BOOK_ID,
  synopsis: 'As treze formas conhecidas da Essência, agrupadas pelas relações que as prendem: as quatro do ciclo elemental, o ciclo vital, as estruturais e as três singulares.',
  contentHTML,
  order: 0,
  status: sib.status ?? 'published',
  public: sib.public ?? true,
  mentions: [],
  words: plain.split(' ').length,
  createdAt: now,
  updatedAt: now,
  updatedBy: EMAIL,
});

console.log(`OK  livro=${BOOK_ID} (public=false, order=-1)`);
console.log(`OK  capitulo=${ART_ID} "As Treze Essências" — ${plain.split(' ').length} palavras, status=${sib.status ?? 'published'}`);
process.exit(0);
