// =============================================
// Livro do Jogador, Cap. 5 — quase tudo guarda alguma coisa (26/08/2026).
// Kit, estojo, roupa, manto, cinto, tomo, instrumento e bota passam a ter
// espaço próprio; e contêiner VAZIO pode ser guardado dentro de outro.
// Espelha lote7-bolsos-e-estojos.mjs e cabeNoConteiner.
//
//   node functions/livro-bolsos.mjs            (dry-run)
//   node functions/livro-bolsos.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const ANCORA = '<h3>A mochila também tem limite</h3>';
const NOVO = `<h3>Nem só a mochila guarda</h3>
<p>Bolsa e mochila são o óbvio, não o único. A camisa tem bolso, o manto tem forro, o cinto tem de onde pendurar, a bota esconde uma faca, o estojo do herborista guarda as ervas que o nomeiam, o grimório segura folha solta entre as páginas e o alaúde tem caixa oca — e todos guardam de verdade, com as mesmas quatro réguas de qualquer contêiner.</p>
<table>
<thead><tr><th>Onde</th><th>Cabe</th><th>Costuma aceitar</th></tr></thead>
<tbody>
<tr><td>Bolso de roupa</td><td>2 coisas, 1 kg, até 15 cm</td><td>moeda, faca pequena, frasco</td></tr>
<tr><td>Forro de manto ou capa</td><td>2 coisas, 2 kg, até 20 cm</td><td>qualquer coisa que caiba</td></tr>
<tr><td>Cinto e faixa</td><td>3 coisas, 1,5 kg, até 20 cm</td><td>o que pendura</td></tr>
<tr><td>Kit e estojo de ofício</td><td>3 a 6 coisas, 1 a 2,5 kg</td><td>só ferramenta, insumo ou ingrediente</td></tr>
<tr><td>Tomo, diário, grimório</td><td>3 folhas, 300 g</td><td>receita, documento, papel</td></tr>
<tr><td>Instrumento de caixa oca</td><td>2 coisas, 1 kg, até 25 cm</td><td>o que o bardo não quer mostrar</td></tr>
<tr><td>Bota</td><td>1 lâmina, 300 g</td><td>só adaga</td></tr>
</tbody>
</table>
<p><strong>Armadura não guarda nada.</strong> Placas, malha e couro batido não têm bolso, e isso é de propósito: quem se enfia em ferro precisa de alguém — ou de uma bolsa — para carregar o resto. É a mesma peça que já come sua Carga inteira.</p>
<p>Uma peça vazia que guarda coisas pode ser guardada: o casaco dobrado entra na mochila sem discussão. <strong>Cheia, não.</strong> Esvazie antes — senão o que está dentro dela sumiria da conta do peso, e bolsa dentro de bolsa vira bolsa sem fundo.</p>

` + ANCORA;

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const doc = await ref.get();
const html = doc.data().contentHTML;
const n = html.split(ANCORA).length - 1;
if (n !== 1) { console.log(`❌ âncora aparece ${n}× (esperava 1) — nada gravado.`); process.exit(1); }
const novo = html.replace(ANCORA, NOVO);
const words = novo.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).length;
console.log(`✓ âncora encontrada · palavras: ${doc.data().words} → ${words}`);
if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
await ref.update({ contentHTML: novo, words, atualizadoEm: agora, updatedAt: agora });
console.log('✅ Capítulo 5 atualizado.');
process.exit(0);
