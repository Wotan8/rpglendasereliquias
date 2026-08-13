/**
 * Régua geométrica — a forma e o alcance entram na conta.
 *
 * Grava o capítulo novo na Régua de Balanceamento e estende o vocabulário de
 * `formaArea` que já existia no cadastro (circulo, cone, zona, adjacentes).
 *
 *   node functions/__aplica-geometria-livro.mjs            (dry-run)
 *   node functions/__aplica-geometria-livro.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ═══ A fórmula, verificável ═══ */
const CELULA = 3 * 3;                       // 3 m x 3 m por combatente
const TOKEN = 1.5 * 1.5;                    // 2,25 m² — o token em si
const POR_METRO = 0.333 / 10;               // 0,0333 — Ação de Movimento / Desloc. base

const area = {
    circulo: (R) => Math.PI * R * R,
    cone: (R, ang) => (ang / 360) * Math.PI * R * R,
    linha: (L, W) => L * W,
    retangulo: (a, b) => a * b,
};
const alvos = (m2, bloqueavel = false, forma = 'circulo') => {
    /* Arredonda PRIMEIRO, corta a sombra DEPOIS. Meia-alvo não existe, e
       dividir o valor cru antes do piso dava 3 onde a metade de 4 é 2. */
    const cheio = Math.floor(m2 / CELULA);
    if (!bloqueavel) return cheio;
    if (forma === 'linha') return 1;          // um corpo de largura: o primeiro interrompe
    return Math.max(1, Math.ceil(cheio / 2)); // ~metade fica na sombra da primeira fileira
};

assert.equal(CELULA / TOKEN, 4, 'a célula de 3 m cabe 4 tokens — é isso que a densidade 0,25 diz');
assert.equal(alvos(area.circulo(3)), 3, 'círculo raio 3 pega 3 — a bola de fogo clássica');
assert.equal(alvos(area.circulo(4.5)), 7);
assert.equal(alvos(area.cone(6, 60)), 2);
assert.equal(alvos(area.cone(9, 60)), 4);
assert.equal(alvos(area.circulo(4.5), true), 4, 'círculo R4,5 bloqueável: 7 vira 4');
assert.equal(alvos(area.linha(30, 1.5), true, 'linha'), 1, 'raio reto de 30 m atinge um só');
assert.equal(alvos(area.cone(9, 60), true), 2, 'bloqueável perde a sombra: 4 vira 2');
assert.ok(Math.abs(30 * POR_METRO - 1.00) < 0.01, '30 m de alcance valem uma Energia inteira');

const CAP = `
<h2>Régua geométrica — forma, alcance e sombra</h2>

<p>Até esta revisão, o número de alvos de uma habilidade era digitado à mão no
cadastro, e o alcance era texto livre — quase sempre "6 m", em habilidade de som,
de luz e de lâmina igual. Nenhum dos dois entrava na conta. Este capítulo faz os
dois entrarem, e o número de alvos passa a ser <strong>derivado da forma</strong>,
não declarado.</p>

<h3>1. A célula de 3 metros</h3>

<p>Um token ocupa 1,5 m × 1,5 m = 2,25 m². Mas combatentes <strong>não ficam
amontoados</strong>: em combate tático cada um ocupa a própria casa e deixa
aproximadamente uma vaga ao redor, para poder se mover e para não morrer todo
mundo junto numa área. Isso é uma célula de <strong>3 m × 3 m = 9 m²</strong> por
combatente.</p>

<pre>alvos = piso( área da forma ÷ 9 )</pre>

<p>Não é quantos tokens <em>cabem</em> na área — é quantos <em>estão</em> nela. Um
círculo de raio 4,5 m comporta 28 tokens colados, e nunca vai pegar 28: pega 7.</p>

<h3>2. As formas</h3>

<table><tbody>
<tr><td><strong>único</strong></td><td>—</td><td>1 alvo</td></tr>
<tr><td><strong>círculo</strong></td><td>πR²</td><td>R 3 → 3 · R 4,5 → 7</td></tr>
<tr><td><strong>cone</strong></td><td>(θ/360)πR²</td><td>60° R 6 → 2 · 60° R 9 → 4</td></tr>
<tr><td><strong>linha</strong></td><td>L × W</td><td>12 × 1,5 → 2</td></tr>
<tr><td><strong>retângulo</strong></td><td>A × B</td><td>6 × 6 → 4</td></tr>
<tr><td><strong>onda</strong></td><td>πR² centrado em si</td><td>exclui a própria casa</td></tr>
<tr><td><strong>muro</strong></td><td>L × 0,5</td><td>bloqueia passagem, não fere</td></tr>
<tr><td><strong>zona</strong></td><td>πR² × rodadas</td><td>acumula enquanto durar</td></tr>
<tr><td><strong>corrente</strong></td><td>—</td><td>N saltos declarados</td></tr>
<tr><td><strong>ponto</strong></td><td>—</td><td>1 alvo, sem custo de alcance</td></tr>
</tbody></table>

<h3>3. Bloqueável é propriedade, não forma</h3>

<p>Luz não atravessa corpo. Isso vale para <strong>qualquer</strong> forma que ela
tome — cone, círculo, retângulo —, então <code>bloqueavel</code> é uma marcação
independente da forma, e não uma forma chamada "feixe".</p>

<pre>alvos com bloqueio = máx( 1 , teto( alvos ÷ 2 ) )
linha bloqueável   = 1, sempre</pre>

<p>Com o espaçamento de 3 m, aproximadamente metade do volume fica atrás da
primeira fileira atingida. A linha é o caso extremo: tem um corpo de largura, e o
primeiro que ela toca a interrompe inteira — um raio reto de 30 m atinge
<strong>um</strong>, por mais longe que vá.</p>

<p><strong>Isto é aproximação declarada</strong>, numa constante só. Se a mesa
mostrar que sombreia mais ou menos, muda-se a metade e nada mais.</p>

<h3>4. O alcance tem preço</h3>

<pre>alcance = metros × 0,0333 unidades</pre>

<p>Derivado do Deslocamento: a Ação de Movimento vale 0,333 (§0.5) e move o
Desloc. Terrestre completo, 10 m na linha de base. Logo 1 m de alcance poupa
0,0333 — e <strong>30 m de alcance valem uma Energia inteira</strong>.</p>

<p>É isso que permite à Luz cobrar caro por distância sem cobrar por área: ela
troca alvos por alcance. Um cone de 60° a 9 m bloqueável rende 2 alvos e 0,30 de
alcance; um círculo de raio 3 a 6 m rende 3 alvos e 0,20. Desenhos opostos,
preços próximos — a régua deixa de favorecer um por acidente.</p>

<h3>5. A geometria natural de cada Essência</h3>

<p>Dez das catorze Essências já descrevem o próprio comportamento espacial no
cânone. A régua lê de lá em vez de arbitrar.</p>

<table><tbody>
<tr><td><strong>Luz</strong></td><td>"viaja reta"</td><td>qualquer forma, <strong>bloqueável</strong>, alcance longo</td></tr>
<tr><td><strong>Vento</strong></td><td>"nunca ocupa, sempre atravessa"</td><td>linha atravessante, não bloqueável</td></tr>
<tr><td><strong>Espacial</strong></td><td>"ignora a distância"</td><td>ponto — sem custo de alcance</td></tr>
<tr><td><strong>Fogo</strong></td><td>"consome e expande"</td><td>círculo</td></tr>
<tr><td><strong>Terra</strong></td><td>"sustenta e resiste"</td><td>muro, retângulo</td></tr>
<tr><td><strong>Água</strong></td><td>"adapta-se e acumula"</td><td>zona persistente</td></tr>
<tr><td><strong>Cristal</strong></td><td>"ressoa; espelho de outras"</td><td>corrente</td></tr>
<tr><td><strong>Natureza</strong></td><td>"enraíza"</td><td>zona persistente</td></tr>
<tr><td><strong>Sangue</strong></td><td>"vincula e cobra"</td><td>único, com vínculo</td></tr>
<tr><td><strong>Necrótico</strong></td><td>"desfaz e drena"</td><td>onda centrada em si</td></tr>
<tr><td>Poder · Abissal · Temporal · Vida</td><td>sem regra espacial no cânone</td><td>forma livre</td></tr>
</tbody></table>

<h3>6. A escada de alcance já existia</h3>

<p>Os verbos rúnicos declaram alcance por nível: <code>Controlar</code> Nv1 5 m ·
Nv2 15 m · Nv3 <strong>30 m</strong>; <code>Entender</code> Nv1 3 m · Nv2 10 m ·
Nv3 <strong>30 m</strong>.</p>

<p><strong>As magias de som e de luz do catálogo contradizem essa escada.</strong>
Silêncio Comandado cria zona de 3 m; Lamento da Banshee alcança 6 m. Som se
propaga e luz viaja até algo bloquear — as duas deveriam estar no topo da escada,
e estão no piso. Não é sabor: é a régua cobrando barato por algo que o próprio
sistema já dimensionou.</p>
`;

const arts = await db.collection('worldbuilding-articles').get();
const doLivro = arts.docs.filter((d) => d.data().bookId === 'book-regua-balanceamento');
const jaTem = doLivro.find((d) => /Régua geométrica — forma, alcance e sombra/.test(d.data().contentHTML || ''));
const ordem = Math.max(...doLivro.map((d) => d.data().order ?? 0)) + 1;

console.log('=== PLANO ===');
console.log(`  capítulo novo "Régua geométrica" na ordem ${ordem}: ${jaTem ? 'JÁ EXISTE (pula)' : 'a criar'}`);
console.log('\n  a fórmula, conferida pelos asserts:');
for (const [n, m2, b, f] of [['círculo R3', area.circulo(3), false], ['círculo R4,5', area.circulo(4.5), false],
    ['cone 60° R6', area.cone(6, 60), false], ['cone 60° R9', area.cone(9, 60), false],
    ['cone 60° R9 bloq', area.cone(9, 60), true], ['linha 30m bloq', area.linha(30, 1.5), true, 'linha'],
    ['retângulo 6x6', area.retangulo(6, 6), false]])
    console.log(`    ${n.padEnd(18)} ${m2.toFixed(1).padStart(6)} m²  →  ${alvos(m2, b, f)} alvos`);
console.log(`\n  alcance: 6 m = ${(6 * POR_METRO).toFixed(2)} un · 15 m = ${(15 * POR_METRO).toFixed(2)} · 30 m = ${(30 * POR_METRO).toFixed(2)}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
if (!jaTem) {
    await db.collection('worldbuilding-articles').add({
        bookId: 'book-regua-balanceamento', title: 'Régua geométrica — forma, alcance e sombra',
        order: ordem, contentHTML: CAP, synopsis: 'A forma da área e o alcance entram na régua: alvos = área ÷ 9, bloqueio corta a sombra, 1 m = 0,0333.',
        status: 'publicado', public: true, createdAt: Date.now(), updatedAt: Date.now(),
    });
    console.log('\n✅ capítulo gravado.');
} else console.log('\n(capítulo já existia — nada a fazer.)');
