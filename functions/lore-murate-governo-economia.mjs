/**
 * Governo e Economia da Muraté + publicação da tribo.
 *
 * Texto desenvolvido em conjunto com o usuário e APROVADO por ele em 30/07/2026.
 * Ancorado no canon: Casas com brasão (casa Oraté, do CONTO DE AMOR), cidades
 * muradas com pedra, armadura completa, não expansionistas mas territorialistas,
 * rivalidade com os Uqatá, Murátia como assentamento mais antigo.
 * As definições novas (custódia como legitimidade, reis no plural, conselho que
 * arbitra sem mandar, sucessão como fardo, infiltração Arn) foram propostas,
 * revisadas e corrigidas pelo usuário antes de virem para cá.
 *
 *   node functions/lore-murate-governo-economia.mjs            (dry-run)
 *   node functions/lore-murate-governo-economia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const GOVERNO = [
    'A unidade de poder Muraté não é a pessoa nem a família: é a fortificação. Cada muro, torre e forte está sob custódia de uma Casa, e é a custódia que dá à Casa o nome, o brasão e a voz. A Casa Oraté não é grande porque tem muitos filhos ou muito ouro — é grande porque guarda o que guarda, e guarda há muito tempo. Um Muraté não pergunta "de que família você é?"; pergunta "o que a sua Casa segura?". Autoridade se mede em tempo, não em extensão: uma Casa que guarda uma torre pequena há nove gerações pesa mais que uma que recebeu uma muralha inteira há duas.',
    'Os Muraté têm reis — no plural. Cada cidade tem o seu, e o rei é simplesmente o custódio de uma fortificação em escala de cidade: mesma lógica das Casas menores, escala maior. Aqui está a diferença que define a tribo diante das outras — entre os Famo, toda cidade pertence a um único Imperador; entre os Muraté, nenhum rei manda em outro rei. Cada um governa a sua cidade, negocia por conta própria e responde apenas pelo que guarda. É dessa multiplicação de coroas que nascem as intrigas, e de vez em quando as guerras.',
    'O que existe acima deles não é um trono, é uma mesa: o conselho de Murátia, na fortificação mais antiga da tribo, onde os reis e os grandes custódios se reúnem para arbitrar disputas. O conselho julga; o conselho não manda. Nenhuma Casa obedece a nada que não tenha aceitado, e todas sabem disso.',
    'Os Muraté crescem — mas para dentro. É engano supor que um povo que não conquista fica do mesmo tamanho. Fortalezas mudam de mão o tempo todo entre Casas Muraté, e vilas se tornam cidades a cada geração. O que quase nunca acontece é tomarem território de outra tribo: as construções alheias lhes parecem indefesas e frágeis, e fortificar um lugar estrangeiro custaria décadas de pedra por um resultado pior do que já se tem em casa. Tomar fortaleza pronta é mais prático — e as fortalezas prontas são as dos primos.',
    'Por isso a guerra Muraté é política. Sitiar um muro Muraté é loucura: quem está de fora conhece cada pedra tão bem quanto quem está dentro, porque foram os mesmos avós que a assentaram, e a muralha aguenta — foi feita para aguentar. Então a coroa e a custódia trocam de mão por outros meios. Casamento. Dívida. Arbitragem comprada. Um rei velho pressionado a abdicar. Um herdeiro convencido de que o tio não merece. Um cerco Muraté raramente tem exército; tem testemunhas, contratos e uma reunião em Murátia. Quando falha, aí sim há guerra — e guerra entre Muraté é a mais lenta e a mais cara de Vasteluna.',
    'A sucessão é um fardo, e é assim que se chama. Quando um custódio morre, a guarda passa para quem já servia naquela posição — o filho tem preferência apenas se estava no muro. Herdar sem ter guardado é vergonha que se carrega a vida inteira. Os Muraté falam da custódia como peso, nunca como prêmio, e o dito é literal: carrega-se o muro. Há os que aceitam o fardo e o honram até morrerem nele. E há os que descobrem que a própria ganância é maior que o preceito — e esses são a razão de quase toda a história Muraté ser uma história de família.',
    'E há quem viva disso. Onde há muitas coroas e nenhuma acima delas, há sempre uma disputa aberta para quem souber financiá-la. Os Arn entenderam isso antes dos próprios Muraté, e não faltam conselhos em Murátia onde a voz mais bem paga não é Muraté nenhuma.',
].join('\n\n');

const ECONOMIA = [
    'Os Muraté são a tribo mais rica de Vasteluna em bens que ninguém consegue roubar, e uma das mais pobres em bens que se carregam. Pedra e aço são o que têm e o que vendem. As pedreiras Muraté fornecem o material das melhores construções do continente, e o arnês completo — a armadura que cobre dos pés à cabeça — é produto deles antes de ser de qualquer outro povo. Quem quer aço que dure, compra de um Muraté. Mas o que vendem mais caro não é material: é serviço de muro. Uma guarnição Muraté contratada para guardar uma mina, uma estrada ou um assentamento cobra o preço de uma campanha e entrega o que promete. Não vendem tropa para invasão — recusam por princípio, e a recusa é conhecida em toda Vasteluna.',
    'O excedente vira pedra. Um Muraté que enriquece não acumula ouro: levanta parede. Isso torna a tribo rica em patrimônio e pobre em moeda — não se liquida uma muralha, não se foge com uma torre. A riqueza deles está cimentada no chão, e é por isso que não podem simplesmente ir embora quando são atacados. A economia produz o territorialismo, não o contrário.',
    'A fraqueza é o lado de fora. Lavoura e rebanho ficam além do muro, e é ali que os Uqatá batem, temporada após temporada. Nenhuma Casa passa fome enquanto o portão aguenta, mas nenhuma Casa come bem no ano em que o campo queima. Os Muraté importam grão com frequência e pagam em pedra, aço e guarda.',
    'E há a fraqueza que muro nenhum resolve. Como cada cidade tem o seu rei e negocia por conta própria, não existe política comercial única — existem dezenas, e todas competindo entre si. Onde há uma Casa endividada por uma obra grande demais, há ouro Arniano disponível, oferecido com paciência e sem exigência aparente. Uma Casa que constrói com dinheiro emprestado descobre tarde que a custódia responde pela dívida — e que perder o muro para um credor dá exatamente no mesmo que perdê-lo para um exército, com a diferença de que ninguém morreu e ninguém pode acusar traição. Os Arn nunca sitiaram uma fortaleza Muraté. Não precisaram.',
].join('\n\n');

const snap = await db.collection('system/data/tribes').where('nome', '==', 'Muraté').limit(1).get();
if (snap.empty) { console.log('✖ Muraté não encontrada'); process.exit(1); }
const doc = snap.docs[0], t = doc.data();

console.log(`Muraté ${doc.id}\n`);
for (const [campo, texto] of [['governo', GOVERNO], ['economia', ECONOMIA]]) {
    const atual = String(t[campo] || '').trim();
    console.log(`${campo}: ${atual === '.' || !atual ? '(vazio)' : `(TINHA TEXTO — ${atual.length} chars!)`} -> ${texto.length} chars, ${texto.split('\n\n').length} parágrafos`);
}
console.log(`\npublicado: ${t.publicado} -> true`);

const vazio = v => !v || String(v).trim() === '.' || String(v).trim() === '';
const depois = { ...t, governo: GOVERNO, economia: ECONOMIA };
const faltando = ['descricao', 'cultura', 'governo', 'economia', 'militar'].filter(f => vazio(depois[f]));
console.log(`campos vazios depois: ${faltando.join(', ') || 'nenhum'}`);
console.log(`peculiaridades: ${(t.peculiaridadeIds || []).length}   unidades: ${(t.unidadesMilitares || []).map(u => u.nome).join(', ')}`);

if (faltando.length) { console.log('\n✖ ABORTADO: não publico tribo com campo vazio.'); process.exit(1); }
if (!APPLY) { console.log('\nDRY-RUN — nada gravado. Rode com --apply.\n'); process.exit(); }

await doc.ref.update({ governo: GOVERNO, economia: ECONOMIA, publicado: true, atualizadoEm: new Date() });
console.log('\n✔ GRAVADO E PUBLICADO.\n');
process.exit();
