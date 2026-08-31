/**
 * Bestiário — capítulo novo: "O Nível de Ameaça".
 *
 * Entra como order 1, logo depois de "Como se lê uma fera"; os capítulos 1 a 4
 * descem para 2 a 5.
 *
 * O livro é public:true — jogador lê. Então o capítulo traz a ESCALA e os dois
 * testes em linguagem de mesa, e não a derivação (unidade, P(golpe passa), DPR).
 * Essa parte fica na Régua de Balanceamento, que é public:false.
 *
 * Nenhuma criatura de mesa com nome próprio é citada — o capítulo "Predadores"
 * já estabelece que elas não constam deste livro.
 *
 *   node functions/bestiario-cap-ameaca.mjs            (dry-run)
 *   node functions/bestiario-cap-ameaca.mjs --apply
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

const TITULO = 'O Nível de Ameaça';
const SINOPSE = 'Os seis graus, o que cada um custa em personagens, e os dois testes que dizem se '
    + 'o encontro é páreo — o de dano e o de carne.';

const HTML = `
<blockquote><p><em>"Não pergunte se a fera é forte. Pergunte quantos de vocês ela ocupa."</em></p></blockquote>

<p>Toda criatura deste livro traz um número: <strong>quanto ela vale medida contra o guerreiro de referência do sistema</strong> — o sujeito de espada e escudo, sem magia e sem truque, que ataca de graça toda rodada. Uma criatura de <strong>1,0×</strong> rende numa rodada o que ele rende. Uma de <strong>0,5×</strong> rende metade. Uma de <strong>2,0×</strong> rende o dobro.</p>

<p>A leitura prática é essa: <strong>a força é quantos personagens aquela criatura ocupa.</strong> Uma fera de 2,0× tira dois do combate enquanto estiver de pé. Uma de 0,25× é um estorvo que quatro deles ignoram — até chegarem doze.</p>

<h3>Os seis graus</h3>

<table>
<thead><tr><th>Grau</th><th>Força</th><th>O que significa na mesa</th><th>Quantas fazem o combate de um grupo de quatro</th></tr></thead>
<tbody>
<tr><td><strong>Inofensiva</strong></td><td>abaixo de 0,15×</td><td>não é encontro, é cenário</td><td>—</td></tr>
<tr><td><strong>Praga</strong></td><td>0,15× a 0,35×</td><td>só ameaça em número</td><td>12 ou mais</td></tr>
<tr><td><strong>Comum</strong></td><td>0,35× a 0,75×</td><td>um por personagem, e ainda sobra</td><td>6 a 10</td></tr>
<tr><td><strong>Séria</strong></td><td>0,75× a 1,5×</td><td>ocupa um personagem inteiro</td><td>3 a 5</td></tr>
<tr><td><strong>Grave</strong></td><td>1,5× a 3,0×</td><td>ocupa dois</td><td>2</td></tr>
<tr><td><strong>Calamidade</strong></td><td>3,0× ou mais</td><td>não se derruba: se sobrevive a ela</td><td><strong>1</strong></td></tr>
</tbody>
</table>

<p>Onde caem as criaturas deste livro: o Corvo é <strong>Inofensiva</strong> e vale pelos olhos, não pelo bico. O Fantoche e a Serpente são <strong>Praga</strong>. O Lobo, o Urso e o Servo Reanimado são <strong>Comuns</strong> — a faixa do companheiro. A Cria Menor do Véu é <strong>Séria</strong>, e é ela que marca o 1,0× exato da escada abissal. Da Cria da Fenda para cima, tudo é <strong>Grave</strong>.</p>

<h3>Os dois testes</h3>

<p>Contar cabeças não basta, porque um encontro se resolve em duas moedas diferentes, e as duas precisam fechar:</p>

<pre>TESTE DO DANO   — some a força de todos os inimigos.
                  Páreo quando a soma iguala o número de personagens.

TESTE DA CARNE  — some a Vitalidade de todos os inimigos.
                  Páreo quando a soma iguala 18 por personagem.</pre>

<p>Para um grupo de quatro, o outro lado precisa somar <strong>4,0× de força e cerca de 72 de Vitalidade</strong>. Sete Lobos entregam 4,06× e 84 de carne: encontro parelho, quatro a cinco rodadas, do jeito que o sistema quer.</p>

<p><strong>Quando só um dos testes fecha, a criatura tem um defeito com nome.</strong></p>

<ul>
<li><strong>Vidro</strong> — passa no dano e falha na carne. Quatro Crias Menores do Véu somam 4,0× de força e apenas 48 de Vitalidade: entregam o golpe de quatro e morrem como duas. O grupo que focar fogo desmonta o encontro em duas rodadas.</li>
<li><strong>Esponja</strong> — passa na carne e falha no dano. É a criatura que ninguém teme e que ninguém consegue matar. Um combate longo em que nada acontece é pior que um combate curto e cruel.</li>
</ul>

<h3>A conta do inimigo solitário</h3>

<p>A mesma régua explica por que <strong>chefe sozinho é o desenho mais difícil do sistema</strong>. Contra quatro personagens, uma criatura só precisa carregar sozinha os 4,0× de força <em>e</em> os 72 de Vitalidade. É onde vive o Grau Calamidade — e é por isso que ele começa em 3,0× e não antes.</p>

<p>Uma solitária que passe nos dois testes com folga — digamos 4,4× de força e 120 de carne — dá um combate de cinco a sete rodadas contra o grupo inteiro, e é exatamente esse o alvo. O erro comum é o contrário: subir só o dano e deixar a Vitalidade de uma fera comum. Aí ela mata um personagem na primeira rodada e cai na segunda, e ninguém sai satisfeito.</p>

<p>Quando não der para fechar os dois números, o caminho não é inflar a Vitalidade até o combate virar aritmética. É dar à criatura algo que <em>compre rodadas</em>: uma reação que anule o primeiro golpe, uma fase em que ela não pode ser atingida, uma reserva que chega no meio da luta.</p>

<h3>O que o campo diz na ficha</h3>

<p>O Nível de Ameaça de cada criatura começa pelo grau, traz a força medida e — a parte que mais importa para quem prepara a sessão — <strong>declara a densidade</strong>: quantas costumam aparecer juntas. Lutar contra três lobos não se parece com lutar contra um.</p>

<pre>Comum · 0,58× · bando de 3 a 5 · Domável: AUT + Domar, Redutor −1 · Vínculo: Lealdade 6
Grave · 1,95× · solitário · indomável</pre>

<h3>Duas ressalvas honestas</h3>

<p><strong>O lado mais numeroso rende um pouco mais do que a soma diz.</strong> Quem tem mais corpos perde ataques mais devagar, porque demora mais para cada baixa doer. O efeito é da ordem de um décimo, não de uma multiplicação — na dúvida, arredonde o número de criaturas para baixo.</p>

<p><strong>E a força de uma criatura não é constante.</strong> Ela foi medida contra a proteção comum de um aventureiro de estrada. Contra um grupo de arnês completo, a mesma fera vale menos; contra um grupo em roupa de viagem, vale muito mais. Se a sua mesa está bem equipada, meça de novo antes de confiar no número.</p>
`;

/* ── conferências ── */
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];
if (!arts.length) erros.push('nenhum capítulo achado no Bestiário');
if (arts.some(d => (d.data().title || '') === TITULO)) erros.push(`capítulo "${TITULO}" já existe`);
const intro = arts.find(d => (d.data().order || 0) === 0);
if (!intro) erros.push('capítulo de order 0 não achado');

for (const t of ['p', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'h3', 'strong', 'em', 'ul', 'li', 'blockquote']) {
    const o = (HTML.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
    const c = (HTML.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) erros.push(`tag <${t}> desbalanceada: ${o} abre, ${c} fecha`);
}

const palavras = HTML.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const descem = arts.filter(d => (d.data().order || 0) >= 1).sort((a, b) => a.data().order - b.data().order);

console.log('\n=== Bestiário · capítulo novo ===\n');
console.log(`   + 1. "${TITULO}"  (${palavras} palavras)`);
console.log(`        ${SINOPSE}`);
console.log(`\n   Descem uma posição:`);
for (const d of descem) console.log(`     ${d.data().order} → ${d.data().order + 1}  "${d.data().title}"`);
console.log(`\n   Fica em 0: "${intro?.data().title}"`);
console.log(`\n   Tags conferidas: todas balanceadas.`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
for (const d of descem) batch.update(d.ref, { order: (d.data().order || 0) + 1, updatedAt: agora });
batch.set(db.collection('worldbuilding-articles').doc(), {
    bookId: BOOK, title: TITULO, synopsis: SINOPSE, contentHTML: HTML.trim(),
    order: 1, status: 'publicado', public: false, mentions: [], words: palavras,
    createdAt: agora, updatedAt: agora, updatedBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ capítulo gravado · ${descem.length} capítulos reordenados.`);
process.exit(0);
