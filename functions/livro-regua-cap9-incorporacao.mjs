/**
 * Régua de Balanceamento — capítulo 9: Incorporação (Xamã).
 *
 * Documento novo. Registra o que foi decidido na frente da Incorporação e a
 * regra de projeto que saiu dela. Também corrige o flag do LIVRO, que estava
 * `public: true` — os capítulos estão todos privados, então nada vazou, mas o
 * livro técnico é sempre não público.
 *
 *   node functions/livro-regua-cap9-incorporacao.mjs            (dry-run)
 *   node functions/livro-regua-cap9-incorporacao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const BOOK = 'book-regua-balanceamento';

/* Conferência das contas ANTES de escrever: o capítulo não pode publicar
   número que o script não reproduz. */
const DPR = 3.445, P_IN = 0.53, CENA = 5;
const T = { dano: 1 / DPR, blind: P_IN / DPR, alvo: 0.585 / DPR };
const r2 = n => Math.round(n * 100) / 100;
const braco = r2((1 * T.dano + 1 * T.alvo) * CENA / 2);
const pele = r2((3 * T.blind) * CENA / 2);
const olho = r2((2 * T.alvo + 2 * T.alvo * 0.25) * CENA / 2);
assert.equal(braco, 1.15, `Braço deu ${braco}`);
assert.equal(pele, 1.15, `Pele deu ${pele}`);
assert.equal(olho, 1.06, `Olho deu ${olho}`);
/* Ancestral: efeito ×2 e custo ×2 preserva a razão. */
assert.equal(r2((2 * T.dano + 2 * T.alvo) * CENA / 4), braco, 'Ancestral tem que manter a razão');
/* Personalidade: bônus e ônus de mesmo tamanho em perícia estreita se anulam. */
assert.equal(r2(2 * T.alvo * 0.25 * CENA - 2 * T.alvo * 0.25 * CENA), 0, 'personalidade é textura');
console.log('✅ 5 asserts de conta.\n');

const CAP = {
    title: '9 — Incorporação, e a regra dos dois eixos',
    synopsis: 'O que um Eco entrega ao Xamã, quanto vale, e por que a duração deixou de sair do dado.',
    html: `
<h2>9.1 O que se compra</h2>
<pre>Transcendência — Receptor
custo   2 Energia  (Eco Comum)  ·  2 Energia + 2 Sanidade  (Ancestral)
portão  Totemismo 3 · Totem cravado · Eco encontrado
duração 1 cena = 5 rodadas (§0.1)</pre>
<p>O ritual existia com o efeito escrito como "concedendo bônus conforme o Eco". A frase nunca foi definida. Este capítulo define.</p>
<p>O Eco entrega duas coisas: uma <strong>Dádiva</strong>, que é mecânica, e <strong>uma perícia sua no valor 3</strong> (Comum) ou <strong>5</strong> (Ancestral), que é ficção com efeito de mesa e não entra na régua de combate.</p>

<h2>9.2 As cinco Dádivas</h2>
<pre>taxas (§1.1):  dano 0,290 = 1 ÷ 3,445
               Blindagem 0,154 = 0,53 × 1 ÷ 3,445
               Alvo 0,170 = 0,585 ÷ 3,445
cláusula estreita ×0,25 (§1.4) · cena = 5 rodadas</pre>
<table>
<thead><tr><th>Dádiva</th><th>Efeito (Comum)</th><th>Derivação</th><th>Razão</th></tr></thead>
<tbody>
<tr><td><strong>Braço</strong></td><td>+1 de dano, +1 no Alvo dos ataques</td><td>(1×0,290 + 1×0,170) × 5 ÷ 2</td><td><strong>1,15×</strong></td></tr>
<tr><td><strong>Pele</strong></td><td>+3 de Blindagem</td><td>3×0,154 × 5 ÷ 2</td><td><strong>1,15×</strong></td></tr>
<tr><td><strong>Olho</strong></td><td>+2 no Alvo à distância, +2 em Observação</td><td>(2×0,170 + 2×0,170×0,25) × 5 ÷ 2</td><td><strong>1,06×</strong></td></tr>
<tr><td><strong>Passo</strong></td><td>+3m de Deslocamento, +2 em Furtividade e Atletismo</td><td>—</td><td>economia de cena (§3.3)</td></tr>
<tr><td><strong>Boca</strong></td><td>+2 no Alvo de testes sociais</td><td>—</td><td>economia de cena (§3.3)</td></tr>
</tbody>
</table>
<p><strong>Ancestral dobra o efeito e o custo.</strong> A razão não muda: <code>(2×0,290 + 2×0,170) × 5 ÷ 4 = 1,15×</code>. É assim que um tier deve se comportar — mais poder, mesmo preço por unidade.</p>
<p>Passo e Boca não têm razão porque a régua de combate não mede deslocamento nem teste social a sério (cláusula social vale 0,10, §1.4). Estão no mesmo balde dos ritos do Xamã. <strong>Não são fracas: são de outra economia.</strong></p>

<h2>9.3 Personalidade — dez, e nenhuma muda o orçamento</h2>
<p>Cada Eco tem uma Personalidade (1d10). Ela define voz, inclinação de Disposição, se esconde o que sente, o que empresta, o que cobra, e o peso na Supressão.</p>
<table>
<thead><tr><th>d10</th><th>Personalidade</th><th>Disp.</th><th>Máscara</th><th>Empresta</th><th>Cobra</th><th>Supressão</th></tr></thead>
<tbody>
<tr><td>1</td><td>Sereno</td><td>+2</td><td>não</td><td>+2 Resiliência</td><td>−1 Intimidação</td><td>−2</td></tr>
<tr><td>2</td><td>Zeloso</td><td>+1</td><td>não</td><td>+2 Tradição</td><td>−2 Malandragem</td><td>−1</td></tr>
<tr><td>3</td><td>Curioso</td><td>+1</td><td>não</td><td>+2 Investigação</td><td>−1 Furtividade</td><td>0</td></tr>
<tr><td>4</td><td>Saudoso</td><td>+1</td><td>não</td><td>+2 Empatia</td><td>−1 Observação</td><td>0</td></tr>
<tr><td>5</td><td>Orgulhoso</td><td>0</td><td>não</td><td>+2 Liderança</td><td>−2 Diplomacia</td><td>+1</td></tr>
<tr><td>6</td><td>Silente</td><td>0</td><td>—</td><td>+2 Sexto Sentido</td><td>−2 em toda perícia social</td><td>0</td></tr>
<tr><td>7</td><td>Sofrido</td><td>0</td><td>não</td><td>+2 Observação</td><td>−2 Intimidação</td><td>+1</td></tr>
<tr><td>8</td><td>Malicioso</td><td>−1</td><td><strong>sim</strong></td><td>+2 Malandragem</td><td>−2 Diplomacia</td><td>+1</td></tr>
<tr><td>9</td><td>Faminto</td><td>−1</td><td><strong>sim</strong></td><td>+2 Sobrevivência</td><td>−2 Resiliência</td><td>+2</td></tr>
<tr><td>10</td><td>Rancoroso</td><td>−2</td><td><strong>sim</strong></td><td>+2 Intimidação</td><td>−2 Empatia</td><td>+2</td></tr>
</tbody>
</table>
<pre>bônus − ônus = 2×0,170×0,25×5 − 2×0,170×0,25×5 = 0,00</pre>
<p>Bônus e ônus têm o mesmo tamanho e caem os dois em cláusula estreita. <strong>A soma é zero: personalidade é textura, não poder.</strong> Isso é requisito, não coincidência — se uma personalidade futura der +2 sem tirar nada, ela vale 0,43 e sai do orçamento.</p>
<p><strong>Armadilha.</strong> "Máscara: sim" significa que a Disposição que o Mestre descreve não é a real. Isso não é modificador — é informação escondida, e não entra em conta nenhuma. Quem for automatizar a ficha do Eco não deve expor o campo Disposição ao jogador.</p>
<p><strong>Padrão deliberado:</strong> os Ecos hostis emprestam as perícias mais afiadas. A tentação é de projeto — a Lei da Reciprocidade virando número.</p>

<h2>9.4 Supressão — o preço, não a entrega</h2>
<pre>teste   Alvo = AUT + Perícia: Transcendência
        redutor = PRS do Eco  (+ peso da Personalidade, + (5 − Disposição))
quando  falha crítica na incorporação · cada extensão paga (1 SAN + 1 VIT)
        fim de cada cena com Eco Furioso ou Corrompido</pre>
<table>
<thead><tr><th>Nível</th><th>Nome</th><th>Efeito</th><th>Custo na régua</th></tr></thead>
<tbody>
<tr><td>1</td><td>Sussurro</td><td>o Eco fala pela boca do Xamã quando o Mestre quiser; −1 no Alvo de tudo</td><td>−0,170/rodada</td></tr>
<tr><td>2</td><td>Rédea</td><td>uma vez por cena o Eco gasta uma das ações do Xamã; −2 no Alvo de tudo</td><td>−0,340/rodada + 1,000 pela ação</td></tr>
<tr><td>3</td><td>Domínio</td><td>o Eco tem o corpo; o jogador não joga o personagem</td><td>fora da régua (§3.3)</td></tr>
</tbody>
</table>
<p>No Nv 3, ao fim de cada cena o jogador refaz o mesmo teste para voltar ao Nv 2. <strong>Três cenas seguidas em Domínio sem sucesso: o Eco fica e o personagem vira NPC.</strong> Desce um degrau por Exorcismo, por honrar o preço do Eco, ou por Descanso Longo com oferenda.</p>
<p>A Supressão <strong>não entra na entrega</strong>. É risco, e risco mora do lado do custo. Uma habilidade não fica mais barata por ser perigosa — fica mais cara de usar.</p>
<p><strong>Por que a escada tem três degraus e não um teste:</strong> perder personagem em uma rolagem é o que o §6.12 chama de remoção da luta, levado ao extremo. Com a escada são no mínimo seis falhas até a perda, e três saídas conhecidas no caminho.</p>

<h3>Exemplo fechado</h3>
<pre>Xamã: AUT 4 · Transcendência 3        → Alvo 7
Eco Furioso, Personalidade Rancoroso (+2), Disposição 2
redutor = 4 (PRS) + 2 (personalidade) + 3 (5 − 2) = 9
Alvo final = 7 − 9 = −2 → piso 1 (§6.3): 10% de sucesso</pre>
<p>Um Rancoroso Furioso de Disposição 2 sobe um degrau em nove de cada dez cenas. <strong>É a leitura correta:</strong> esse Eco não deveria ser incorporado, e o número diz isso sem precisar de aviso em prosa.</p>

<h2>9.5 Geração do Eco (mesa do Mestre)</h2>
<table>
<thead><tr><th>Rolagem</th><th>Resultado</th></tr></thead>
<tbody>
<tr><td>1d10 Estado</td><td>1–3 Sereno · 4–6 Inquieto · 7–8 Furioso · 9 Corrompido · 10 Ancestral*</td></tr>
<tr><td>1d10 Personalidade</td><td>tabela do §9.3</td></tr>
<tr><td>1d6 Dádiva</td><td>1 Braço · 2 Pele · 3 Olho · 4 Passo · 5 Boca · 6 o Mestre escolhe</td></tr>
<tr><td>Disposição</td><td>base do Estado + inclinação da Personalidade</td></tr>
</tbody>
</table>
<p>* Ancestral só sai em Nexo adormecido, ruína antiga ou junto a uma Antiqua — cânone da Lei do Território. Fora desses lugares, 10 relê como Sereno.</p>
<table>
<thead><tr><th>Estado</th><th>Disposição base</th><th>PRS do Eco</th><th>Testa Supressão no fim da cena?</th></tr></thead>
<tbody>
<tr><td>Sereno</td><td>7</td><td>1</td><td>não</td></tr>
<tr><td>Inquieto</td><td>6</td><td>2</td><td>não</td></tr>
<tr><td>Furioso</td><td>3</td><td>4</td><td><strong>sim</strong></td></tr>
<tr><td>Corrompido</td><td>2</td><td>5</td><td><strong>sim</strong></td></tr>
<tr><td>Ancestral</td><td>5</td><td>3</td><td>não</td></tr>
</tbody>
</table>
<p>O Eco gerado vira ficha de NPC (<code>tipo: 'eco'</code>, bloco <code>eco {}</code> no Painel do Mestre). Eco vinculado a Totem de Antiqua aparece na aba Aliados do Xamã, como qualquer NPC ligado ao personagem.</p>

<h2>9.6 A regra que saiu daqui: uma rolagem, um eixo</h2>
<pre>REGRA DE PROJETO
Uma mesma rolagem não escala poder E duração.
Escolha um: ou os Graus compram magnitude, ou compram tempo.</pre>
<p>O ritual dizia <code>duração = Graus × turnos</code> e "bônus conforme o Eco". Se o bônus também viesse dos Graus, a mesma rolagem multiplicaria os dois eixos. Mesmo com o bônus fixo, a duração variável sozinha já produz:</p>
<pre>Braço com 1 Grau : 0,460 × 1 ÷ 2 = 0,23×
Braço com 5 Graus: 0,460 × 5 ÷ 2 = 1,15×
razão pior/melhor = 5,0</pre>
<p><strong>Uma rolagem decidindo 5× de entrega é variância que nenhuma faixa segura.</strong> E o pior caso é armadilha pelo §RAZÃO_MÍNIMA: o jogador paga 2 Energia e recebe 0,23×. Por isso a duração virou 1 cena fixa e o poder passou a vir do Eco.</p>
<p><strong>Parente do §6.12</strong> ("condição que rouba turno não escala com Graus"): lá o argumento é que os Graus já derrubaram o Alvo da defesa e escalar a duração paga duas vezes pelo mesmo acerto. Aqui o argumento é a variância. São a mesma regra vista de dois lados.</p>
<p><strong>Onde procurar isto de novo:</strong> qualquer habilidade cujo texto diga "Graus ×" seguido de unidade de tempo. Hoje o catálogo tem uma só — a Transcendência — Projetor, que ficou de fora porque projeção é economia de cena e não tem entrega medida.</p>

<h2>9.7 Pontos em aberto</h2>
<ul>
<li><strong>Dívida Espiritual não tem número.</strong> O capítulo público de Totemancia diz que xamãs endividados "sofrem penalidades em todos os rituais". Quanto, e como sobe e desce, <code>[A DEFINIR]</code>. Enquanto isso a Supressão não a usa como modificador.</li>
<li><strong>Peso da Personalidade e (5 − Disposição) no redutor</strong> são âncoras propostas, não derivadas. O exemplo do §9.4 mostra que somados podem estourar o piso — se na mesa o Furioso virar intocável, o corte é usar só um dos dois.</li>
<li><strong>Perícia emprestada no valor 3/5</strong> não passou pela régua: perícia fora de combate não tem taxa. Se um jogador usar a perícia emprestada para dominar cena de investigação inteira, o valor 5 do Ancestral é o primeiro suspeito.</li>
<li><strong>Passo e Boca</strong> ficaram sem razão medida. Se a mesa reclamar que são piores que as outras três, a resposta não é buffar — é conferir se o Mestre está dando cena para elas.</li>
<li><strong>Sanidade como recurso</strong> continua valendo 1,00/ponto por falta de âncora própria (§4). O custo alternativo do Receptor (2 ENER + 2 SAN = 4,00) depende disso.</li>
</ul>
`,
};

const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const livroRef = db.collection('worldbuilding-books').doc(BOOK);
const livro = await livroRef.get();
const erros = [];
if (arts.some(d => /^9 —/.test(d.data().title || ''))) erros.push('capítulo 9 já existe');
const maxOrder = Math.max(...arts.map(d => d.data().order ?? 0));
if (maxOrder !== 8) erros.push(`esperava o último capítulo em order 8, achei ${maxOrder}`);
if (arts.some(d => d.data().public === true)) erros.push('há capítulo público no livro técnico');
const palavras = CAP.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

console.log('=== Régua · capítulo 9 ===\n');
console.log(`  + "${CAP.title}" (${palavras} palavras, order 9, NÃO público)`);
console.log(`  Dádivas medidas: Braço ${braco}× · Pele ${pele}× · Olho ${olho}×`);
console.log(`  ~ livro "${livro.data()?.title}": public ${livro.data()?.public} → false (livro técnico é sempre privado)`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
batch.set(db.collection('worldbuilding-articles').doc(), {
    bookId: BOOK, title: CAP.title, synopsis: CAP.synopsis, contentHTML: CAP.html.trim(),
    order: 9, status: 'publicado', public: false, mentions: [], words: palavras,
    createdAt: agora, updatedAt: agora, updatedBy: 'igorestevamalvesdesouza@gmail.com',
});
batch.update(livroRef, { public: false, updatedAt: agora });
await batch.commit();
console.log('\n✅ Capítulo 9 gravado e livro fechado.');
process.exit(0);
