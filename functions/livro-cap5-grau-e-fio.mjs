/**
 * Capítulo 5 do Livro de Regras do Jogador — insere a seção "5.6 Grau e Fio"
 * logo depois de 5.5 (Liga, Afiações e Reforços), e renumera 5.6→5.7, 5.7→5.8,
 * 5.8→5.9.
 *
 * Encaixe: 5.5 termina dizendo "o poder real de um item está nos seus valores
 * naturais". A seção nova é justamente o nome desse poder. Nenhuma referência
 * cruzada quebra — as duas que existem ("ver seção 5.5") continuam apontando
 * para Liga.
 *
 *   node functions/livro-cap5-grau-e-fio.mjs            (dry-run)
 *   node functions/livro-cap5-grau-e-fio.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const SECAO = `<h2>5.6 Grau e Fio</h2>
<blockquote><p><em>"Toda lâmina corta. A diferença é quantos fios ela guarda."</em></p></blockquote>
<p>Duas espadas longas, as duas 1d8, as duas de aço. Uma saiu ontem da bigorna da vila; a outra atravessou três donos e uma guerra. O dado não muda. O que muda é o <strong>Fio</strong>.</p>

<h3>Fio: o poder que o item carrega</h3>
<p><strong>Cada Fio vale +1 de dano.</strong> A conta é fácil de lembrar porque o seu Dano vem da Força: um Fio é, na prática, <em>um ponto de Força que a arma te dá de graça</em> — sem custar EXP.</p>
<blockquote><p>Espada Longa (1d8) com FOR 3 rola <strong>1d8 + 3</strong>. A mesma espada com 2 Fios rola <strong>1d8 + 5</strong>. O dado continua 1d8.</p></blockquote>

<h3>Grau: o nome da faixa</h3>
<p>Fio é o número; <strong>Grau</strong> é como se chama a faixa. Grau = Fio + 1.</p>
<table>
<thead><tr><th>Grau</th><th>Fio</th><th>Nome</th><th>O que é</th></tr></thead>
<tbody>
<tr><td>0</td><td>−1</td><td>Improvisado</td><td>Quebrado, enferrujado, um galho.</td></tr>
<tr><td>1</td><td>0</td><td>Inicial</td><td>Tudo que está no catálogo hoje.</td></tr>
<tr><td>2</td><td>+1</td><td>Veterano</td><td>Peça de quem já sobreviveu a alguma coisa.</td></tr>
<tr><td>3</td><td>+2</td><td>Mestre</td><td>Obra de quem passou a vida na oficina.</td></tr>
<tr><td>4</td><td>+3</td><td>Lendário</td><td>Tem nome próprio e gente atrás.</td></tr>
<tr><td>5</td><td>+4</td><td>Relíquia</td><td>Não se compra. Ver seção 5.8.</td></tr>
</tbody>
</table>

<h3>Quando cada Grau chega às suas mãos</h3>
<p><strong>Poder</strong> é todo o EXP que seu personagem já acumulou — o EXP Total da ficha. Ele diz que Grau é adequado a você:</p>
<table>
<thead><tr><th>Poder (EXP Total)</th><th>Grau adequado</th><th>Fio disponível</th></tr></thead>
<tbody>
<tr><td>até 500</td><td>1 — Inicial</td><td>0</td></tr>
<tr><td>500 a 850</td><td>2 — Veterano</td><td>+1</td></tr>
<tr><td>850 a 1.300</td><td>3 — Mestre</td><td>+2</td></tr>
<tr><td>1.300 a 1.800</td><td>4 — Lendário</td><td>+3</td></tr>
<tr><td>acima de 1.800</td><td>5 — Relíquia</td><td>+4</td></tr>
</tbody>
</table>
<p>Cada Grau custa mais ou menos 400 de Poder. Você não calcula nada com essa tabela — ela existe para o Narrador saber o que cai nas suas mãos, e quando. Equipamento acima da sua faixa não é impossível: é uma decisão do Narrador, e ele sabe o que está fazendo.</p>

<h3>Arma soma, proteção multiplica</h3>
<p>Na arma, cada Fio é <strong>+1 de dano</strong>, e o dado nunca muda. Na proteção, cada Grau <strong>multiplica por 1,35</strong> a Blindagem por slot:</p>
<table>
<thead><tr><th>Grau</th><th>Leve</th><th>Média</th><th>Pesada</th><th>Arnês Pesado completo (13 slots)</th></tr></thead>
<tbody>
<tr><td>1</td><td>0,20</td><td>0,22</td><td>0,30</td><td>3,90</td></tr>
<tr><td>2</td><td>0,27</td><td>0,30</td><td>0,41</td><td>5,33</td></tr>
<tr><td>3</td><td>0,36</td><td>0,40</td><td>0,55</td><td>7,15</td></tr>
<tr><td>4</td><td>0,49</td><td>0,54</td><td>0,74</td><td>9,62</td></tr>
<tr><td>5</td><td>0,66</td><td>0,73</td><td>1,00</td><td>13,00</td></tr>
</tbody>
</table>
<p>Multiplica em vez de somar por um motivo prático: Blindagem é <em>subtraída</em> do dano, e o dano cresce junto com quem bate. Se a armadura ganhasse só +1 por Grau, viraria enfeite lá na frente. Com a multiplicação, um combate entre arma e armadura do mesmo Grau continua durando de 5 a 8 golpes, do começo ao fim da campanha.</p>
<p><strong>Escudo não sobe de Grau em Blindagem.</strong> Armadura pesada com Escudo de Torre já exige 10 golpes para derrubar alguém no Grau 1 — é o limite do que o sistema aguenta sem o combate travar. Escudo melhora em outras coisas: acerto, proteger aliado, anular penalidade.</p>

<h3>O que não é Grau</h3>
<ul>
<li><strong>O dado da arma.</strong> 1d4 a 1d12 diz quantas mãos e que alcance, não quanto poder. Montante (1d12) e Adaga (1d4) são <em>os dois</em> Grau 1;</li>
<li><strong>A Liga</strong> (seção 5.5). Liga é a qualidade do material e o teto de Afiação — e como afiar e reforçar sobem dos dois lados ao mesmo tempo, elas se cancelam. Liga é manutenção; <strong>Grau é o que sobra depois que ela se cancela</strong>.</li>
</ul>

<h3>A regra que você precisa decorar</h3>
<blockquote><p>A soma de <strong>todos</strong> os Fios de dano que você está carregando — todas as peças, todos os canais — não pode passar do Fio da sua faixa de Poder.</p></blockquote>
<p>Com 900 de Poder você está no Grau 3, teto de 2 Fios. Pode ser uma espada de 2 Fios; ou uma espada de 1 mais uma flecha de 1; ou 1 de fogo e 1 de vento na mesma lâmina. Munição tem teto próprio de +2, para ninguém comprar a escada inteira em flecha.</p>

<h3>Fio nem sempre é físico</h3>
<p>Uma arma pode carregar Fio de outra natureza — uma lâmina que fere com a Essência Púrpura, uma flecha que queima com a Vermelha. Cada natureza dessas é um <strong>canal</strong> separado, e cada canal enfrenta a resistência do alvo <em>naquele</em> canal. Como se resolve isso na mesa está no Capítulo 6, seção 6.5.</p>
<p>O que importa na hora de comprar: <strong>armadura comum só protege do dano físico.</strong> Resistir a uma Essência exige item específico — talismã, loção, bênção — e isso é raro, caro e situacional. Uma resistência que muda alguma coisa começa perto de 1,80 no Grau 1; abaixo disso você não vai sentir. As treze Essências estão no Compêndio de Fluxomancia.</p>
`;

const ANCORA = '<h2>5.6 Equipamentos Gerais</h2>';
const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('❌ art-regras-jogador-05 não existe.'); process.exit(1); }

let html = snap.data().contentHTML || '';
if (html.includes('5.6 Grau e Fio')) { console.error('❌ A seção já existe. Abortando.'); process.exit(1); }
if (html.split(ANCORA).length - 1 !== 1) { console.error('❌ Âncora "5.6 Equipamentos Gerais" não é única. Abortando.'); process.exit(1); }

/* Renumera de trás para frente, para não colidir. */
const renum = [['<h2>5.8 Carga e Peso</h2>', '<h2>5.9 Carga e Peso</h2>'],
               ['<h2>5.7 Itens Especiais</h2>', '<h2>5.8 Itens Especiais</h2>'],
               ['<h2>5.6 Equipamentos Gerais</h2>', '<h2>5.7 Equipamentos Gerais</h2>']];
for (const [de, para] of renum) {
    if (html.split(de).length - 1 !== 1) { console.error(`❌ Heading não único: ${de}`); process.exit(1); }
    html = html.replace(de, para);
}
html = html.replace('<h2>5.7 Equipamentos Gerais</h2>', SECAO + '\n' + '<h2>5.7 Equipamentos Gerais</h2>');

const sinopse = 'Luns e economia, armas, armaduras e Blindagem, Liga e melhorias, Grau e Fio na progressão de equipamento, itens especiais, e o sistema de Carga em kg com Pressão do inventário.';

console.log('AÇÕES:');
console.log('  + nova seção "5.6 Grau e Fio" depois de 5.5 (Liga)');
console.log('  ~ 5.6 Equipamentos Gerais → 5.7');
console.log('  ~ 5.7 Itens Especiais     → 5.8');
console.log('  ~ 5.8 Carga e Peso        → 5.9');
console.log('  ~ synopsis atualizada');
console.log(`\n  ${snap.data().contentHTML.length} → ${html.length} chars (+${html.length - snap.data().contentHTML.length})`);
console.log('\n=== TEXTO NOVO ===\n');
console.log(SECAO.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

if (!APPLY) { console.log('\n\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await ref.update({ contentHTML: html, synopsis: sinopse, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
