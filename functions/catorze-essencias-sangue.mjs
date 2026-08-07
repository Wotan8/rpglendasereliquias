/**
 * Sangue é a décima quarta Essência (decisão do dono do mundo, 06/08/2026).
 *
 * Lore fornecida pelo dono do mundo, verbatim:
 *  - "Os dois. Vivem quase que misturados. mas nas veias o carmesin domina, no
 *     restante do corpo e a Azul. (...) as cores nunca se misturam, mas as duas
 *     essencias convivem juntas, como um emaranhado de filamentos de cor azul e
 *     carmesim-escura. Mas a Carmesim segue a mesma lei que a Agua, sua essência
 *     esta fixa na sua contra parte física, o proprio sangue."
 *  - "Entra no ciclo vital como produto de Agua+Vida+Natureza+Luz"
 *  - "Sangue morto continua sendo essência Carmesin-escura, porém sem vida. Pois
 *     a Vida (Essência azul), se esvai no ambiente quando perde contato com o corpo."
 *
 * Mexe em 5 artigos, 4 deles PÚBLICOS. Cada troca exige contagem exata.
 *
 *   node functions/catorze-essencias-sangue.mjs --dry-run
 *   node functions/catorze-essencias-sangue.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const DRY = process.argv.includes('--dry-run');
const EMAIL = 'igorestevamalvesdesouza@gmail.com';

// ---------------------------------------------------------------- compêndio
const LINHA_TABELA = '<tr><td>Púrpura</td><td>Necrótica</td><td>Necromancia</td></tr>';

const ENTRADA_SANGUE = `

<h3>Essência Carmesim-Escura — Sangue</h3>
<p>Produto de quatro: Água, Vida, Natureza e Luz encontram-se nela. Vincula e cobra — toda gota é um contrato.</p>
<p><strong>A lei da matéria:</strong> segue a mesma regra da Água — a essência está fixa na sua contraparte física. A Carmesim-Escura não paira nem viaja por conta própria: ela <em>é</em> o sangue. Onde há sangue, ela está; onde o sangue não vai, ela não chega.</p>
<p><strong>Convivência com a Azul:</strong> num corpo vivo as duas ocupam o mesmo espaço sem jamais se misturarem — um emaranhado de filamentos azuis e carmesins, cada cor inteira em si. Nas veias a Carmesim domina; no restante do corpo, a Azul. Derramado o sangue, a Azul perde o contato com o corpo e se esvai no ambiente; a Carmesim permanece. Sangue morto continua Carmesim-Escuro — porém sem vida.</p>`;

const COMPENDIO = [
  ['São treze as formas conhecidas.', 'São catorze as formas conhecidas.'],
  ['As treze não estão soltas.', 'As catorze não estão soltas.'],
  ['<h2>Tabela das Treze</h2>', '<h2>Tabela das Catorze</h2>'],
  [LINHA_TABELA, `${LINHA_TABELA}\n<tr><td>Carmesim-Escura</td><td>Sangue</td><td>Hemomancia</td></tr>`],
  // o Sangue entra no Ciclo Vital, mas não é parte da roda — é produto dela
  [
    'É o ciclo mais disputado do mundo: três escolas o encaram de três ângulos incompatíveis.</p>',
    'É o ciclo mais disputado do mundo: três escolas o encaram de três ângulos incompatíveis.</p>\n\n<p>O Sangue tampouco é parte da roda — é produto dela: Água, Vida, Natureza e Luz encontram-se para formá-lo. Aparece agrupado aqui porque é no corpo vivo que ele se dá, lado a lado com a Azul.</p>',
  ],
  // a Azul deixa de reivindicar o sangue para si
  [
    'É a essência que pulsa no sangue de toda criatura viva — Centelha Vital, Pulso Primordial, Chama-Azul.</p>',
    'Percorre a criatura viva inteira — Centelha Vital, Pulso Primordial, Chama-Azul. No sangue divide espaço com a Carmesim-Escura sem se misturar a ela, e ali é a Carmesim que domina; no restante do corpo, a Azul.</p>',
  ],
  [
    '<strong>Limitação decisiva:</strong> só permanece Azul enquanto conectada a um corpo vivo. Separada dele, dissipa-se e a Natureza a reclama. É por isso que o hemomante controla o sangue nas veias e na Bolha, mas perde o que derrama.</p>',
    '<strong>Limitação decisiva:</strong> só permanece enquanto conectada a um corpo vivo. Perdido o contato, esvai-se no ambiente e a Natureza a reclama. O que o hemomante perde no que derrama é a <em>vida</em> — a matéria segue Carmesim.</p>',
  ],
  // o sangue não "vira Verde": a Verde recolhe a vida que saiu dele
  [
    '<strong>Dupla face:</strong> para o hemomante, sangue que virou Verde é matéria morta e perdida. Para o Xamã, é exatamente ali que o trabalho começa — a Essência Verde é o repositório dos Ecos da Alma, onde os vestígios dos mortos permanecem antes de se dissolverem.</p>',
    '<strong>Dupla face:</strong> para o hemomante, o sangue que perdeu a Azul é matéria sem vida — Carmesim ainda, mas calada. Para o Xamã, é exatamente aí que o trabalho começa: a vida que se esvaiu é recolhida pela Verde, e a Essência Verde é o repositório dos Ecos da Alma, onde os vestígios dos mortos permanecem antes de se dissolverem.</p>',
  ],
  ['<p><strong>Limitação:</strong> sangue corrompido por ela resiste à manipulação hemática e pode contaminar quem tentar absorvê-lo.</p>', `<p><strong>Limitação:</strong> sangue corrompido por ela resiste à manipulação hemática e pode contaminar quem tentar absorvê-lo.</p>${ENTRADA_SANGUE}`],
];

// --------------------------------------------------------------- hemomancia
const HEMOMANCIA = [
  [
    'carrega dentro de si a Essência Azul, a mesma força vital que sustenta toda a existência',
    'carrega dentro de si duas Essências que convivem sem se misturar: a Carmesim-Escura, fixa na própria matéria do sangue, e a Azul, a mesma força vital que sustenta toda a existência',
  ],
  ['<h2>Essência Azul</h2>', '<h2>Carmesim e Azul</h2>'],
  [
    'A Hemomancia opera exclusivamente com a Essência Azul — Vida. É esta essência que pulsa dentro do sangue de toda criatura viva: Centelha Vital, Pulso Primordial, Chama-Azul. Enquanto o sangue corre dentro de um corpo — seja nas veias do hemomante ou dentro de sua Bolha — ele carrega vida. E vida pode ser moldada. Esse é o princípio fundamental que todo hemomante aprende primeiro e que governa tudo o mais: Sangue vivo = Essência Azul = controlável. Sangue morto = Essência Verde = incontrolável. A Transição Azul → Verde No instante em que o sangue é derramado e perde a conexão com um corpo vivo, a Essência Azul começa a se dissipar.',
    'A Hemomancia opera com duas Essências ao mesmo tempo. A Carmesim-Escura — Sangue — é a matéria: está fixa no sangue como a Azul-Claro está na água, e não se separa dele. A Azul — Vida — é o que corre com ele: Centelha Vital, Pulso Primordial, Chama-Azul. Num corpo vivo as duas se entrelaçam como filamentos, cada cor inteira em si, a Carmesim dominando nas veias e a Azul no restante do corpo. Enquanto o sangue corre dentro de um corpo — seja nas veias do hemomante ou dentro de sua Bolha — ele carrega as duas. Esse é o princípio fundamental que todo hemomante aprende primeiro e que governa tudo o mais: a Carmesim dá o que moldar, a Azul dá o que vive. A Perda da Azul No instante em que o sangue é derramado e perde a conexão com um corpo vivo, a Essência Azul começa a se dissipar — a Carmesim fica onde está, porque ela é o sangue.',
  ],
  [
    'A força vital escoa como calor de um corpo ao relento. Em seu lugar, o sangue se torna matéria orgânica inerte — e a Essência Verde (Natureza) o reclama. É o ciclo natural: o que veio da vida retorna à terra. A velocidade dessa transição depende da quantidade e das condições: Situação Tempo para virar Verde',
    'A força vital escoa como calor de um corpo ao relento, e a Essência Verde (Natureza) recolhe a vida que partiu. É o ciclo natural: o que veio da vida retorna à terra. O que fica na poça é sangue ainda — Carmesim-Escuro, íntegro como matéria e mudo como vida. A velocidade dessa perda depende da quantidade e das condições: Situação Tempo para a Azul se esvair',
  ],
  [
    'Para o hemomante, isso significa que sangue separado do corpo é sangue em contagem regressiva.',
    'Para o hemomante, isso significa que sangue separado do corpo é sangue em contagem regressiva — não para deixar de ser moldável, mas para deixar de estar vivo.',
  ],
  [
    'Agulhas lançadas, respingos de combate, poças no chão — tudo isso se torna verde e fora de alcance rapidamente.',
    'Agulhas lançadas, respingos de combate, poças no chão — tudo isso perde a Azul rapidamente e sobra como matéria carmesim, moldável mas morta.',
  ],
  [
    'Por que Sangue Verde é Incontrolável Sangue de Essência Verde já não responde à vontade. Pertence à natureza — é matéria orgânica como folha seca ou osso enterrado. Um hemomante não tem mais domínio sobre ele do que teria sobre uma pedra no chão. Isso cria uma limitação fundamental: hemomantes não podem manipular sangue de cadáveres antigos, manchas secas em paredes, ou poças coaguladas.',
    'Por que Sangue Morto Não Basta O sangue que perdeu a Azul continua Carmesim, e como matéria continua respondendo: pode ser movido, moldado, endurecido. O que ele não faz mais é viver — não cura, não alimenta a Bolha, não sustenta vínculo nem transfusão. Isso cria a limitação fundamental: um hemomante pode erguer uma parede com o sangue de um campo de batalha, mas não tira dela uma única gota de vida. Sangue coagulado, seco ou de cadáveres antigos, onde a própria matéria já se desfez, escapa até desse alcance.',
  ],
  [
    'Verde (Natureza) Antagonista. Sangue que vira verde é perdido. Hemomantes não conseguem controlá-lo.',
    'Verde (Natureza) Antagonista. Recolhe a Azul que deixa o sangue; o que ela leva, o hemomante não recupera.',
  ],
  [
    'começa imediatamente a perder Essência Azul. Em segundos, se torna verde e inerte. O sangue é irrecuperável.',
    'começa imediatamente a perder Essência Azul. Em segundos está morto — carmesim ainda, mas sem nada de vivo para reabsorver. O sangue é irrecuperável.',
  ],
  [
    'acelerar a transição Azul → Verde em sangue exposto',
    'acelerar a perda da Azul em sangue exposto',
  ],
  [
    '<li>Somente sangue de Essência Azul (vivo) pode ser manipulado. Sangue derramado começa a virar verde imediatamente. Sangue coagulado, seco ou de cadáveres antigos é incontrolável.</li>',
    '<li>A Carmesim dá matéria, a Azul dá vida. Sangue derramado perde a Azul imediatamente: segue moldável como matéria, mas não cura, não alimenta a Bolha e não sustenta vínculo. Sangue coagulado, seco ou de cadáveres antigos, onde a matéria já se desfez, é incontrolável.</li>',
  ],
  [
    'Após a transição completa Azul → Verde, os ecos se apagam.',
    'Depois que a Azul se esvai por inteiro, os ecos se apagam.',
  ],
  [
    'O hemomante manipula vida (Azul), não morte (Púrpura).',
    'O hemomante manipula sangue (Carmesim) e vida (Azul), não morte (Púrpura).',
  ],
  [
    'O sangue ainda não virou verde — e algo está impedindo a transição. A Essência Azul se recusa a morrer.',
    'A Azul ainda não se esvaiu — e algo está impedindo que ela vá embora. A vida se recusa a partir.',
  ],
  ['Transição Azul→Verde mais lenta.', 'A Azul se esvai mais devagar.'],
  ['o sangue de Pogos retarda a transição Azul → Verde por dias', 'o sangue de Pogos retarda a perda da Azul por dias'],
  ['sempre correndo contra o relógio da transição Azul → Verde', 'sempre correndo contra o relógio da perda da Azul'],
];

// --------------------------------------------------------------- totemancia
const TOTEMANCIA = [
  [
    'Este processo conecta diretamente com o que a Hemomancia (2.6) ensina sobre a transição da Essência Azul para Verde: o sangue derramado perde vida e vira natureza. A Totemancia observa o mesmo fenômeno por outro ângulo. Para o hemomante, sangue verde é inútil — matéria morta. Para o Xamã, a Essência Verde que absorveu aquela vida é exatamente onde o trabalho começa: é ali que os Ecos residem. Hemomancia (2.6) Totemancia (2.7) Essência Azul = sangue vivo = controlável Essência Azul = vida ativa = ainda não há Eco Transição Azul → Verde = sangue morre Transição Azul → Verde = Eco começa a se formar Essência Verde = sangue morto = inútil Essência Verde = repositório dos Ecos = onde o Xamã trabalha',
    'Este processo conecta diretamente com o que a Hemomancia (2.6) ensina sobre a Essência Azul que deixa o sangue derramado: a vida escapa e a Natureza a recolhe. A Totemancia observa o mesmo fenômeno por outro ângulo. Para o hemomante, o que resta na poça é matéria carmesim sem vida — moldável, mas muda. Para o Xamã, a Essência Verde que absorveu aquela vida é exatamente onde o trabalho começa: é ali que os Ecos residem. Hemomancia (2.6) Totemancia (2.7) Essência Azul = sangue vivo Essência Azul = vida ativa = ainda não há Eco A Azul deixa o sangue = o sangue morre A Azul deixa o sangue = Eco começa a se formar Essência Verde = a vida recolhida Essência Verde = repositório dos Ecos = onde o Xamã trabalha',
  ],
  [
    'assim como sangue derramado perde vida e vira verde (ver Hemomancia, 2.6)',
    'assim como sangue derramado perde a Azul para a Natureza (ver Hemomancia, 2.6)',
  ],
];

const PLANO = [
  { id: 'art-fluxomancia-13-essencias', rotulo: 'Compêndio de Fluxomancia', edits: COMPENDIO, titulo: 'As Catorze Essências', sinopse: 'As catorze formas conhecidas da Essência, agrupadas pelas relações que as prendem: as quatro do ciclo elemental, o ciclo vital, as estruturais e as três singulares.' },
  { id: 'art_ms3gb90mo6fulz', rotulo: 'Hemomancia', edits: HEMOMANCIA },
  { id: 'art_ms3gb93y6turqk', rotulo: 'Totemancia', edits: TOTEMANCIA },
  { id: 'art-regras-jogador-05', rotulo: 'Livro de Regras cap.5', edits: [['As treze Essências estão no Compêndio de Fluxomancia.', 'As catorze Essências estão no Compêndio de Fluxomancia.']] },
  { id: 'art-regras-jogador-06', rotulo: 'Livro de Regras cap.6', edits: [['os treze nomes estão no Capítulo 5, seção 5.6', 'os catorze nomes estão no Capítulo 5, seção 5.6']] },
];

// o texto só pode dizer 14 se o catálogo tiver 14
const vds = await db.collection('system/data/derivedValues').get();
const nB = vds.docs.filter(d => d.data().blocoId === 'blindagem-essencia').length;
const nD = vds.docs.filter(d => d.data().blocoId === 'ataque-item' && /^Dano /.test(d.data().nome || '')).length;
if (nB !== 14 || nD !== 14) throw new Error(`catálogo tem ${nB} blindagens e ${nD} canais — rode cadastrar-essencia-sangue.mjs antes`);
const asp = await db.doc('system/data/runicElements/asp_sangue').get();
if (!asp.exists) throw new Error('asp_sangue sumiu do runicElements');
console.log(`catálogo ok: 14 blindagens, 14 canais, asp_sangue cor=${asp.data().cor}\n`);

let falhou = false;
const gravar = [];

for (const p of PLANO) {
  const ref = db.doc(`worldbuilding-articles/${p.id}`);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`❌ ${p.rotulo}: não existe`); falhou = true; continue; }
  const x = snap.data();
  let html = x.contentHTML || '';
  console.log(`── ${p.rotulo} (${p.id}) public=${x.public}`);

  for (const [de, para] of p.edits) {
    const n = html.split(de).length - 1;
    if (n !== 1) {
      console.log(`   ❌ ${n} ocorrência(s) de: "${de.slice(0, 70)}…"`);
      falhou = true;
      continue;
    }
    html = html.replace(de, para);
    console.log(`   ✓ ${de.slice(0, 68).replace(/\s+/g, ' ')}…`);
  }

  const upd = { contentHTML: html, updatedAt: Date.now(), updatedBy: EMAIL };
  if (p.titulo) upd.title = p.titulo;
  if (p.sinopse) upd.synopsis = p.sinopse;
  upd.words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  gravar.push({ ref, upd, rotulo: p.rotulo, antes: (x.contentHTML || '').length, depois: html.length });
}

if (falhou) throw new Error('alguma troca não bateu a contagem — nada foi gravado');

console.log('');
for (const g of gravar) {
  console.log(`${DRY ? '[dry-run] gravaria' : 'gravando'} ${g.rotulo}: ${g.antes} → ${g.depois} chars`);
  if (!DRY) await g.ref.update(g.upd);
}

if (!DRY) {
  // pós-conferência: nenhum "treze" sobrou nos textos tocados
  for (const p of PLANO) {
    const h = (await db.doc(`worldbuilding-articles/${p.id}`).get()).data().contentHTML;
    const sobrou = (h.match(/\btreze\b/gi) || []).length;
    if (sobrou) throw new Error(`${p.rotulo} ainda tem ${sobrou} "treze"`);
  }
  console.log('\n✅ cânone público diz catorze');
} else {
  console.log('\n[dry-run] nada gravado');
}
process.exit(0);
