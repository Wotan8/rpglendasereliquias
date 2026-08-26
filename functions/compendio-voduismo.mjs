/**
 * Compêndio de Totemancia — capítulo do Voduísmo (regra de mesa).
 *
 * ⚠️ A LORE JÁ EXISTE no capítulo 0, sob o nome "Mandinguice — o Ramo do
 * Vínculo Vivo": a tabela de partes do corpo, a de alcance, o Selo de Vida, os
 * Encantos e Nós, o estigma social. Este capítulo NÃO repete nada disso —
 * aponta para lá e acrescenta só o que faltava: a mecânica.
 *
 * Reconciliação de nome (memória de design 01/08): "Mandinga" sobreviveu como
 * nome POPULAR, dado por quem pratica; "Voduísmo" é o nome da vertente. Os dois
 * convivem de propósito, e o texto diz isso em vez de apagar um deles.
 *
 * O livro é public:true — é livro de jogador. Nada de material de mestre aqui
 * (a tabela de sorte de Ecos, por exemplo, não entra).
 *
 *   node functions/compendio-voduismo.mjs            (dry-run)
 *   node functions/compendio-voduismo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const col = db.collection('worldbuilding-articles');
const LIVRO = 'book_ms3gb924a9frg1';

const base = (await col.doc('art_ms3gb93y6turqk').get()).data();

const HTML = `<p><em>Regra de mesa — Xamã, vertente <strong>Voduísmo</strong>.</em></p>
<p>Este capítulo é só a mecânica. A natureza do vínculo, o Selo de Vida, os Encantos e Nós, a tabela de partes do corpo e o estigma social estão no capítulo <strong>Totemancia</strong>, na seção "Mandinguice — o Ramo do Vínculo Vivo".</p>

<h2>O nome, e por que são dois</h2>
<p><strong>Voduísmo</strong> é o nome da vertente. <strong>Mandinga</strong> é como o povo chama — e é o único nome da Totemancia que veio de quem pratica, não da academia. Os dois valem, e um Mandingueiro raramente se apresenta como voduísta.</p>
<p><strong>Voduísmo não é classe nem subclasse.</strong> É uma das duas vertentes do Xamã, ao lado do Espiritismo. O Xamã escolhe uma na criação; a segunda exige <strong>Totemancia Xamânica nível 2</strong>.</p>

<h2>As duas vertentes</h2>
<table>
<thead><tr><th></th><th>Essência</th><th>Alcança</th></tr></thead>
<tbody>
<tr><td><strong>Espiritismo</strong></td><td>Verde</td><td>o Eco que a morte deixou, e que o Verde guardou</td></tr>
<tr><td><strong>Voduísmo</strong></td><td>Azul</td><td>o vivo, pelo fio de Azul que ainda não foi consumido</td></tr>
</tbody>
</table>
<p>São o mesmo ofício olhando lados opostos do mesmo processo: <strong>o Verde come o Azul.</strong> O espiritista trabalha com o que o Verde já consumiu. O voduísta corre contra o Verde para pescar o Azul antes que apague — e é por isso que fragmento velho não serve.</p>

<h2>O nível da vertente é o teto do Custo</h2>
<p>A Peculiaridade <strong>Voduísmo</strong> vai de 1 a 5, e o nível é o maior Custo que o Xamã pode conjurar nela. Voduísmo 3 usa até Custo 3.</p>
<table>
<thead><tr><th>Custo</th><th>Ritual</th><th>O que faz</th></tr></thead>
<tbody>
<tr><td>1</td><td><strong>AGULHA</strong></td><td>5 de dano e Abalado no nível do Elo, por 1 cena</td></tr>
<tr><td>2</td><td><strong>AMARRAÇÃO</strong></td><td>Imobilizado por 3 rodadas e Exposto 3 enquanto durar</td></tr>
<tr><td>3</td><td><strong>BOCA COSIDA</strong></td><td>o alvo não conjura, não canta e não fala por 1 cena</td></tr>
<tr><td>4</td><td><strong>O PESO</strong></td><td>Cego e Amedrontado por 1 cena</td></tr>
<tr><td>5</td><td><strong>ESPELHO DE CARNE</strong></td><td>o dano que o portador do boneco recebe vai para o alvo, até 20 pontos</td></tr>
</tbody>
</table>

<h2>Os dois orçamentos</h2>
<p>Conseguir o fragmento e usar o boneco são coisas de economias diferentes, e é isso que mantém a vertente honesta.</p>
<p><strong>Conseguir</strong> acontece fora do combate: furtar, negociar, arrancar, colher do campo de batalha. Custa tempo, requisito e risco — nunca uma ação de turno.</p>
<p><strong>Usar</strong> acontece no combate, custa Energia e Ação Padrão como qualquer ritual, e o alvo resiste normalmente.</p>
<p>O poder do vodu nunca esteve no boneco. Está em já ter o fio de cabelo.</p>

<h2>O Elo</h2>
<p>A qualidade do fragmento é o <strong>Elo</strong>, e o Elo é o nível de toda condição que a vertente aplica. Um fio de cabelo dá Abalado 1; um dente arrancado dá Abalado 3. A tabela de partes do corpo do capítulo Totemancia diz quanto tempo cada uma leva para perder a Essência Azul — e o princípio dela vale aqui inteiro: <strong>quanto mais importante a parte era para o corpo, mais devagar ela apaga.</strong></p>
<p>Sangue é a armadilha: carrega muita Azul e a perde em <em>minutos a horas</em>, porque não é estrutural. Osso carrega menos e dura semanas.</p>
<p><strong>A janela vale só até o ritual pegar.</strong> Depois disso o elo passa a ser alimentado pelo Xamã, e não depende mais do Azul original.</p>

<h2>Os limites</h2>
<p><strong>Elos ativos ≤ nível de Voduísmo.</strong> Um voduísta de nível 2 mantém dois bonecos. Para amarrar um terceiro, desfaz um.</p>
<p><strong>Alcance:</strong> a tabela do capítulo Totemancia manda. Com Totem de Antiqua não há limite de distância — mas <strong>o elo nunca atravessa planos</strong>. Alvo que entra numa camada inferior sai do alcance de qualquer boneco.</p>
<p><strong>O vodu não mata.</strong> O dano da vertente para em 1 de Vitalidade. Ela controla, humilha, imobiliza e cega — não executa. Quem quiser matar à distância que use uma besta.</p>
<p><strong>Alvo vivo.</strong> Um cadáver fresco ainda serve como fragmento — a Azul não apagou. Mas o ritual aplica e controla os <em>vivos</em>, e um morto não tem o que ser controlado. Campo de batalha rende fragmento, não vítima.</p>
<p><strong>O boneco é um objeto no mundo.</strong> Pode ser entregue, roubado, queimado ou molhado, e as seis formas de romper um vínculo do capítulo Totemancia valem todas. Quem descobre que é alvo de vodu não tem um teste de resistência: tem uma missão.</p>

<h2>O que exige interpretação</h2>
<p>Nenhum ritual de Voduísmo é declarado em silêncio. O praticante costura, espeta, amarra, enche de terra — e diz alguma coisa ao alvo. A mesa vê o gesto e ouve a palavra, mesmo que o alvo esteja a um quilômetro.</p>
`;

const doc = {
    bookId: LIVRO,
    title: 'Voduísmo — a vertente do vínculo vivo',
    order: 1,
    synopsis: 'A mecânica da vertente azul do Xamã: o Elo, os dois orçamentos, a escada de cinco rituais e os limites. A lore está no capítulo Totemancia.',
    contentHTML: HTML,
    words: HTML.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    public: true, status: 'publicado', mentions: [],
    updatedBy: base.updatedBy, createdAt: Date.now(), updatedAt: Date.now(),
};

const jaTem = (await col.where('bookId', '==', LIVRO).get()).docs.some(d => /Vodu/i.test(d.data().title || ''));
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} · "${doc.title}" · ${doc.words} palavras · public=${doc.public}`);
if (jaTem) { console.error('ABORTA: já existe capítulo de Voduísmo'); process.exit(1); }
if (APPLY) { const r = await col.add(doc); console.log(`GRAVADO ${r.id}`); }
else console.log('rode com --apply');
process.exit(0);
