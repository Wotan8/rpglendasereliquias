// =============================================
// Livro do Jogador, Cap. 5 — duas regras novas (26/08/2026):
//   1. Relíquia NÃO tem Integridade (§5.8 é Item Especial, não peça de ferreiro).
//   2. Contêiner tem BOCA (tamanho máximo do item) e pode ser de PROPÓSITO
//      ÚNICO (tags aceitas). As duas TRAVAM, ao contrário do peso, que avisa.
// Espelha shared/inventario-motor.js (integridadeMax, cabeNoConteiner).
//
//   node functions/livro-reliquia-e-boca-conteiner.mjs            (dry-run)
//   node functions/livro-reliquia-e-boca-conteiner.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const ANCORA_A = '<p>O número é inteiro e a conta fecha na mesa: a adaga aguenta oito falhas críticas e cai na nona, o montante aguenta vinte e oito e cai na vigésima nona. A regra é a mesma nas duas mãos. A diferença é o aço.</p>';
const NOVO_A = ANCORA_A + `
<p><strong>Relíquia não tem Integridade.</strong> Nenhuma. Não é peça de ferreiro: não lasca na Falha Crítica, não cede sob peso e não se conserta na bancada — onde as outras peças mostram um número, a Relíquia mostra um traço. O que limita uma Relíquia é a história dela e o preço de portá-la (seção 5.8), nunca o desgaste.</p>`;

const ANCORA_B = '<p>Todo contêiner do catálogo tem um <strong>peso máximo</strong> e uma <strong>Integridade</strong> (seção 5.5). Passar do peso máximo não é proibido: ninguém arranca a bolsa da sua mão, e o site deixa você enfiar o que quiser lá dentro. O que acontece é que ela começa a ceder.</p>';
const NOVO_B = `<p>Antes do peso, duas perguntas mais simples: <em>isso passa pela boca?</em> e <em>isso é o que essa bolsa carrega?</em></p>
<table>
<thead><tr><th>Limite do contêiner</th><th>O que faz</th></tr></thead>
<tbody>
<tr><td><strong>Boca</strong> — tamanho máximo do item</td><td><strong>Trava.</strong> Peça maior que a boca não entra, por mais vazia que a bolsa esteja.</td></tr>
<tr><td><strong>Conteúdo aceito</strong> — as tags que ele leva</td><td><strong>Trava.</strong> Aljava só recebe flecha; bolsa de moedas só recebe moeda e gema.</td></tr>
<tr><td><strong>Capacidade</strong> — número de pilhas</td><td><strong>Trava.</strong> Cheio é cheio.</td></tr>
<tr><td><strong>Peso máximo</strong> (kg)</td><td><strong>Avisa.</strong> Deixa guardar e a bolsa começa a ceder — é o que vem a seguir.</td></tr>
</tbody>
</table>
<p>A boca costuma ser o próprio tamanho do contêiner: uma lança de 1,70 m não entra numa mochila de 60 cm, e isso não é birra do site — é geometria. Contêiner com esses campos em branco não restringe nada. E o que já está guardado nunca é revisto: as travas valem para o que você tenta guardar <em>agora</em>, não para expulsar o que já estava lá.</p>
` + ANCORA_B;

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const doc = await ref.get();
let html = doc.data().contentHTML;
for (const [nome, de, para] of [['Relíquia', ANCORA_A, NOVO_A], ['boca do contêiner', ANCORA_B, NOVO_B]]) {
    const n = html.split(de).length - 1;
    if (n !== 1) { console.log(`❌ ${nome}: âncora aparece ${n}× (esperava 1) — nada gravado.`); process.exit(1); }
    html = html.replace(de, para);
    console.log(`✓ ${nome}`);
}
const words = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).length;
console.log(`palavras: ${doc.data().words} → ${words}`);
if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
await ref.update({ contentHTML: html, words, atualizadoEm: agora, updatedAt: agora });
console.log('✅ Capítulo 5 atualizado.');
process.exit(0);
