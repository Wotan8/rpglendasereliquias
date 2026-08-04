/**
 * Cap. 5 §5.5 — a economia do ferreiro.
 *
 *  1. Reescreve o "teto de melhoria": a Afiação passa a ser limitada pelo Fio,
 *     não pela Liga. Vira a cadeia Liga → Fio → Afiação.
 *  2. Acrescenta o preço da Liga (×2 por degrau), a tabela de serviços de Fio
 *     e de Afiação com preço e prazo, a regra do Fio flat e a de proteção por
 *     slots, a Falha Crítica comendo o gume, e o alcance do artesão.
 *
 *   node functions/livro-cap5-oficina.mjs            (dry-run)
 *   node functions/livro-cap5-oficina.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ---- 1. a cadeia dos três tetos, no lugar do teto antigo ---- */
const TETO_DE = '<p>A Liga define o poder natural do item — e é também o seu <strong>teto de melhoria</strong>: um item só aceita melhorias até o tier da própria Liga. Uma espada de Liga 2 aceita Afiação até o tier 2; para afiar além, é preciso uma arma melhor.</p>';

const TETO_PARA = `<p>A Liga é o teto do que a peça pode <em>vir a ser</em>, e abre uma cadeia de três degraus presos um ao outro:</p>
<ul>
<li>o <strong>Fio</strong> nunca passa da <strong>Liga menos um</strong> (ver seção 5.6). Uma peça de Liga 3 não chega além do Grau 3;</li>
<li>a <strong>Afiação</strong> nunca passa do <strong>Fio</strong>. Não se mantém gume onde não há gume — lâmina sem Fio não aceita afiação nenhuma;</li>
<li>as duas oficinas contam separado: a mesma arma aceita Afiação e Afiação Mágica até o Fio cada uma, ou seja, <strong>Fio × 2</strong> somadas.</li>
</ul>`;

/* ---- 2. a oficina, no fim da 5.5 ---- */
const ANCORA = '<p><strong>Descasamento de tier é letal — e é proposital.</strong> Uma arma dois tiers acima da sua proteção mata em 1–2 golpes; uma proteção dois tiers acima da arma atacante reduz tudo ao piso de 1 de dano (24 golpes para cair). O perigo do jogo está em enfrentar quem tem aço melhor que o seu — não na sorte do dado.</p>';

const OFICINA = ANCORA + `

<h3>Comprar Liga</h3>
<p>O preço de catálogo é o da Liga 1. Cada Liga acima dobra:</p>
<table>
<thead><tr><th>Liga</th><th>Preço</th><th>Espada Longa</th><th>Teto de Fio</th></tr></thead>
<tbody>
<tr><td>1</td><td>catálogo</td><td>1.100 L$</td><td>0</td></tr>
<tr><td>2</td><td>×2</td><td>2.200 L$</td><td>1</td></tr>
<tr><td>3</td><td>×4</td><td>4.400 L$</td><td>2</td></tr>
<tr><td>4</td><td>×8</td><td>8.800 L$</td><td>3</td></tr>
<tr><td>5</td><td>×16</td><td>17.600 L$</td><td>4</td></tr>
</tbody>
</table>
<p>Uma lâmina de Liga 5 recém-saída da forja não corta melhor que a de Liga 1. Custa dezesseis vezes mais pelo que <em>pode vir a ser</em>. Quem leva uma dessas está comprando material, e ainda vai pagar o ferreiro.</p>

<h3>O preço do ofício</h3>
<p><strong>Subir o Fio</strong> é o serviço mais caro que um ferreiro vende:</p>
<table>
<thead><tr><th>Fio</th><th>Preço</th><th>Tempo</th></tr></thead>
<tbody>
<tr><td>1</td><td>1.000 L$</td><td>3 dias</td></tr>
<tr><td>2</td><td>2.500 L$</td><td>6 dias</td></tr>
<tr><td>3</td><td>6.000 L$</td><td>9 dias</td></tr>
<tr><td>4</td><td>15.000 L$</td><td>12 dias</td></tr>
</tbody>
</table>
<p>Do zero ao Fio 4: <strong>24.500 L$ e trinta dias</strong> com a sua arma em cima da bancada de outro homem.</p>
<p><strong>Afiar</strong> é barato, rápido, e é o serviço que se repete:</p>
<table>
<thead><tr><th>Tier</th><th>Afiação (ferreiro)</th><th>Afiação Mágica (forjarcanista)</th></tr></thead>
<tbody>
<tr><td>1</td><td>100 L$ · 1 hora</td><td>300 L$ · 3 horas</td></tr>
<tr><td>2</td><td>250 L$ · 2 horas</td><td>750 L$ · 6 horas</td></tr>
<tr><td>3</td><td>600 L$ · 3 horas</td><td>1.800 L$ · 9 horas</td></tr>
<tr><td>4</td><td>1.500 L$ · 4 horas</td><td>4.500 L$ · 12 horas</td></tr>
</tbody>
</table>
<p>As duas cobram o mesmo por hora. O forjarcanista sai três vezes mais caro porque leva três vezes mais tempo. E o Fio custa menos por hora que a afiação: ali a maior parte do preço é aço, carvão e têmpera — na afiação é quase só o pulso de quem trabalha.</p>
<p><strong>O Fio custa o mesmo em qualquer arma.</strong> Uma adaga e um montante pagam os mesmos 1.000 L$ pelo primeiro. O preço de catálogo já pagou o dado — o tamanho, as mãos, o alcance. O Fio paga o poder. São duas compras, e não se misturam.</p>
<p>Em proteção o preço acompanha a cobertura: <strong>custo do degrau × slots cobertos ÷ 13</strong>. Um arnês inteiro paga cheio; um elmo de um slot paga a treze avos, uns 77 L$ pelo primeiro Fio. Conjunto ou peça por peça dá o mesmo total, como já vale para o Reforço.</p>

<h3>O gume se perde antes da lâmina</h3>
<p>Uma Falha Crítica pode <strong>comer um tier de Afiação</strong>. O Fio só é atingido quando não resta gume nenhum a perder.</p>
<p>Sai barato de propósito: repor a afiação do tier 4 custa 1.500 L$, repor um Fio 4 custa 15.000. Dez vezes. Para perder Fio de verdade é preciso encaixar quatro falhas críticas sem passar por uma oficina — o que só acontece longe de qualquer estrada.</p>
<p>A lista de consequências de Falha Crítica é escolha do Narrador (Capítulo 6, seção 6.7). Perder o gume é uma opção entre a arma escapar da mão, a corda arrebentar e você acertar quem estava do seu lado. Não acontece toda vez.</p>

<h3>Nem todo ferreiro chega ao Fio 4</h3>
<p>São duas travas de naturezas diferentes. A primeira está na peça e se confere na hora: o Fio nunca passa da Liga menos um. A segunda está no mundo — nem todo ferreiro sabe assentar um quarto Fio numa lâmina, e achar quem saiba é problema do personagem, não da ficha. Onde vive esse artesão, e o que ele cobra além de Luns, é assunto do Narrador.</p>`;

const EDICOES = [
    { nome: '§5.5 — teto de melhoria vira a cadeia Liga → Fio → Afiação', de: TETO_DE, para: TETO_PARA },
    { nome: '§5.5 — subseções da oficina (Liga, preços, gume, artesão)', de: ANCORA, para: OFICINA }
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 art-regras-jogador-05 não existe.'); process.exit(1); }

let html = snap.data().contentHTML || '';
const antes = html.length;
if (html.includes('Comprar Liga')) { console.error('🔴 As subseções já existem. Abortando.'); process.exit(1); }
let erro = false;

for (const e of EDICOES) {
    const n = html.split(e.de).length - 1;
    console.log(`\n${e.nome}  →  ocorrências: ${n}`);
    if (n !== 1) { console.error(`  🔴 esperava 1, achou ${n}.`); erro = true; continue; }
    html = html.replace(e.de, e.para);
}
if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }

console.log('\n=== TEXTO NOVO ===\n');
console.log((TETO_PARA + OFICINA.slice(ANCORA.length)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
console.log(`\n\n${antes} → ${html.length} chars (+${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
