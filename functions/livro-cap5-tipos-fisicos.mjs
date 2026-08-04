/**
 * Cap. 5 — fecha a etapa da tipagem de dano.
 *
 *  1. §5.4 — subseção nova: dano físico tipado (Cortante/Perfurante/Contundente),
 *     Blindagem e Reforço continuam gerais, a fraqueza vem da peça.
 *  2. §5.5 — reescreve o trecho que dizia "o ataque escolhe canais; a defesa é
 *     geral". Com defesa geral, escolher canal seria escolha falsa; o que dá
 *     sentido à escolha é a fraqueza declarada na peça.
 *  3. §5.5 — "Cada Liga acima dobra" ficou errado quando a curva virou
 *     ×1,5 / ×3 / ×6 / ×16. Erro óbvio de número, corrigido junto.
 *
 * Os golpes citados usam a Blindagem ARREDONDADA (regra da 5.4), para bater com
 * a tabela da janela letal que já está no capítulo.
 *
 *   node functions/livro-cap5-tipos-fisicos.mjs            (dry-run)
 *   node functions/livro-cap5-tipos-fisicos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const E = [];
const ed = (nome, de, para) => E.push({ nome, de, para });

/* ---- 1. §5.4: subseção nova, no fim da seção ---- */
const FIM_54 = '<strong>Penetração de armadura:</strong> algumas armas, manobras (como Golpe Preciso) ou habilidades ignoram metade ou toda a Blindagem — quando for o caso, o efeito diz.</p>';

ed('5.4 · subseção nova: os três tipos de dano físico', FIM_54, FIM_54 + `

<h3>Nem todo golpe machuca a mesma armadura</h3>
<p>Toda arma fere de um dos três jeitos, e a família dela no catálogo já diz qual:</p>
<table>
<thead><tr><th>Tipo</th><th>Famílias</th></tr></thead>
<tbody>
<tr><td><strong>Cortante</strong></td><td>Espada, Adaga, Machado, Foice</td></tr>
<tr><td><strong>Perfurante</strong></td><td>Haste, Arco, Besta</td></tr>
<tr><td><strong>Contundente</strong></td><td>Impacto — clava, maça, malho, martelo, mangual, porrete, soqueira</td></tr>
</tbody>
</table>
<p>Sua Blindagem continua sendo <strong>um número só</strong>, e o Reforço do ferreiro vale contra os três. Não existe blindagem contra corte para comprar à parte.</p>
<p>O que existe é <strong>fraqueza</strong>, e ela é da peça. Placa espalha o fio da lâmina e entrega o impacto inteiro a quem está dentro; malha detém o corte e abre na ponta da estocada. Cada classe cede a alguma coisa:</p>
<table>
<thead><tr><th>Classe</th><th>Cortante</th><th>Perfurante</th><th>Contundente</th></tr></thead>
<tbody>
<tr><td>Leve</td><td>—</td><td>−10%</td><td>−10%</td></tr>
<tr><td>Média</td><td>—</td><td>−10%</td><td>−20%</td></tr>
<tr><td>Pesada</td><td>—</td><td>—</td><td><strong>−30%</strong></td></tr>
</tbody>
</table>
<p>A porcentagem desconta da Blindagem daquela peça, antes de arredondar o total. Peças específicas podem trazer fraquezas próprias além dessas — inclusive contra uma Essência.</p>
<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra um malho, os 3,90 caem para 2,73 e a Blindagem vira <strong>2</strong>. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada e 4 de malho. O impacto não arrebenta a placa — passa por ela.</p></blockquote>
<p>Golpe que carrega mais de um tipo — aço e Essência na mesma lâmina — resolve cada parcela separada. O procedimento está no Capítulo 6, seção 6.5.</p>`);

/* ---- 2. §5.5: por que escolher canal importa ---- */
ed('5.5 · a escolha do canal deixa de ser escolha falsa',
'<p>Na proteção vale o mesmo: o <strong>Reforço</strong> barra dano físico, o <strong>Reforço Arcano</strong> barra Essência. Com uma diferença que decide o jogo — <strong>o Reforço Arcano protege contra qualquer Essência, não contra uma escolhida.</strong> O ataque escolhe canais; a defesa é geral. Fosse por canal, bastaria repartir o dano arcano em três Essências para nunca mais ser barrado.</p>',
`<p>Na proteção vale o mesmo: o <strong>Reforço</strong> barra dano físico, o <strong>Reforço Arcano</strong> barra Essência. E os dois valem contra tudo — <strong>não se compra reforço contra uma Essência escolhida.</strong> Fosse por canal, bastaria repartir o dano arcano em três Essências para nunca mais ser barrado.</p>
<p>Então por que escolher Fogo em vez de Necrótico, se a defesa é a mesma? Porque a <strong>fraqueza</strong> não mora na defesa geral: mora na peça (seção 5.4). Um arnês cede ao Fogo, um manto cede ao Vento. Quem descobre isso antes do primeiro golpe leva uma vantagem que dado nenhum entrega.</p>`);

/* ---- 3. §5.5: a curva de Liga não dobra mais ---- */
ed('5.5 · "Cada Liga acima dobra" (número errado desde a curva nova)',
'<p>O preço de catálogo é o da Liga 1. Cada Liga acima dobra:</p>',
'<p>O preço de catálogo é o da Liga 1. Cada Liga acima multiplica, e o salto cresce conforme sobe:</p>');

/* ===================== gravar ===================== */
const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não existe.'); process.exit(1); }
let html = snap.data().contentHTML || '';
const antes = html.length;
if (html.includes('Nem todo golpe machuca')) { console.error('🔴 subseção já existe. Abortando.'); process.exit(1); }
let erro = false;

for (const e of E) {
    const n = html.split(e.de).length - 1;
    const ok = n === 1;
    console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
    if (!ok) { erro = true; continue; }
    html = html.replace(e.de, e.para);
}
if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }
console.log(`\n${antes} → ${html.length} chars (+${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
