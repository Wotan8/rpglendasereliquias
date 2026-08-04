/**
 * Cap. 5 — duas correções pedidas:
 *
 *  1. "tier" → "Fio" em todo o capítulo. As duas palavras descreviam a mesma
 *     escada, e a §5.5 chegava a usar as duas na mesma frase.
 *  2. A tabela de fraqueza sai da porcentagem. % é inviável de calcular na mesa,
 *     e além disso não sobrevivia ao arredondamento da Blindagem: −10% e −20%
 *     davam o mesmo inteiro que 0% no Grau 1.
 *     Vira **metade da Blindagem** — a mesma operação que o livro já usa em
 *     Golpe Preciso (Cap. 6.9). Cada classe cede a UM tipo.
 *
 *   node functions/livro-cap5-fio-e-fraqueza.mjs            (dry-run)
 *   node functions/livro-cap5-fio-e-fraqueza.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não existe.'); process.exit(1); }
let html = snap.data().contentHTML || '';
const antes = html.length;

/* ---- 1. tier → Fio ---- */
const nTier = (html.match(/\btiers?\b/gi) || []).length;
console.log(`"tier" encontrados: ${nTier}`);
if (nTier !== 10) { console.error(`🔴 esperava 10, achei ${nTier}. Abortando.`); process.exit(1); }
html = html
    .replace(/\btiers\b/g, 'Fios')
    .replace(/\btier\b/g, 'Fio')
    .replace(/\bTiers\b/g, 'Fios')
    .replace(/\bTier\b/g, 'Fio');
const sobra = (html.match(/\btiers?\b/gi) || []).length;
console.log(`  → trocados. Restantes: ${sobra}`);
if (sobra) { console.error('🔴 sobrou "tier". Abortando.'); process.exit(1); }

/* ---- 2. fraqueza sem porcentagem ---- */
const DE_TABELA = `<p>O que existe é <strong>fraqueza</strong>, e ela é da peça. Placa espalha o fio da lâmina e entrega o impacto inteiro a quem está dentro; malha detém o corte e abre na ponta da estocada. Cada classe cede a alguma coisa:</p>
<table>
<thead><tr><th>Classe</th><th>Cortante</th><th>Perfurante</th><th>Contundente</th></tr></thead>
<tbody>
<tr><td>Leve</td><td>—</td><td>−10%</td><td>−10%</td></tr>
<tr><td>Média</td><td>—</td><td>−10%</td><td>−20%</td></tr>
<tr><td>Pesada</td><td>—</td><td>—</td><td><strong>−30%</strong></td></tr>
</tbody>
</table>
<p>A porcentagem desconta da Blindagem daquela peça, antes de arredondar o total. Peças específicas podem trazer fraquezas próprias além dessas — inclusive contra uma Essência.</p>
<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra um malho, os 3,90 caem para 2,73 e a Blindagem vira <strong>2</strong>. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada e 4 de malho. O impacto não arrebenta a placa — passa por ela.</p></blockquote>`;

const PARA_TABELA = `<p>O que existe é <strong>fraqueza</strong>, e ela é da peça. Placa espalha o fio da lâmina e entrega o impacto inteiro a quem está dentro; couro detém a pancada e se rasga na ponta da flecha. <strong>Cada classe cede a um tipo, e contra ele a Blindagem vale metade</strong> — arredondando para baixo, como sempre:</p>
<table>
<thead><tr><th>Classe</th><th>Cede a</th><th>Blindagem contra esse tipo</th></tr></thead>
<tbody>
<tr><td>Leve</td><td>Perfurante</td><td>metade</td></tr>
<tr><td>Média</td><td>Contundente</td><td>metade</td></tr>
<tr><td>Pesada</td><td>Contundente</td><td>metade</td></tr>
</tbody>
</table>
<p>Metade é a mesma conta do Golpe Preciso (Capítulo 6, seção 6.9) — dividir por dois e cortar a fração. Peças específicas podem ceder a outra coisa, inclusive a uma Essência; quando for o caso, a peça diz.</p>
<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra um malho, 1. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada e 4 de malho — e o malho ainda passa pela placa quando a espada já não passa mais.</p></blockquote>`;

const n2 = html.split(DE_TABELA).length - 1;
console.log(`\nTabela de fraqueza (%) encontrada: ${n2}`);
if (n2 !== 1) { console.error('🔴 esperava 1. Abortando.'); process.exit(1); }
html = html.replace(DE_TABELA, PARA_TABELA);
console.log('  → trocada por "metade".');

if (html.includes('%')) console.log(`\n⚠ ainda existem ${(html.match(/%/g)||[]).length} sinais de % no capítulo — confira se são de outra regra.`);
console.log(`\n${antes} → ${html.length} chars`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
