// =============================================
// Livro do Jogador, Cap. 5 — Integridade passa à escala única de Tamanho.
// ---------------------------------------------
// Decisão de 25/08/2026: o campo Tamanho da peça é SEMPRE metros, e o porte
// é o triplo (a mesma cascata Altura → Tamanho do §2.8). A fórmula publicada
// vira round((Liga + Tamanho×3) × 3), piso 3, e a tabela de âncoras é refeita.
// Espelha integridadeMax de shared/inventario-motor.js.
//
//   node functions/livro-integridade-metros.mjs            (dry-run)
//   node functions/livro-integridade-metros.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const TROCAS = [
    ['<p><strong>Integridade = (Liga + Tamanho) × 3</strong></p>',
     '<p><strong>Integridade = (Liga + Tamanho × 3) × 3</strong> — arredondada para o inteiro mais próximo, nunca abaixo de 3.</p>'],

    ['<p>É a mesma conta da Vitalidade de um corpo (seção 2.8), com a Liga no lugar do Vigor — quem decide quanto uma coisa aguenta antes de deixar de servir é o material de que ela foi feita. Peça sem Liga declarada conta como Liga 1. O que está no catálogo e tem preço não é galho de árvore.</p>',
     '<p>É a mesma conta da Vitalidade de um corpo (seção 2.8), com a Liga no lugar do Vigor — e o Tamanho é o mesmo Tamanho de lá: <strong>o triplo da maior medida em metros</strong>. Um humano de 1,70 m tem Tamanho ~5; uma espada de 1,20 m, ~3,6. Quem decide quanto uma coisa aguenta antes de deixar de servir é o material de que ela foi feita. Peça sem Liga declarada conta como Liga 1. O que está no catálogo e tem preço não é galho de árvore. No cadastro, o Tamanho da peça é sempre a maior dimensão, em metros.</p>'],

    ['<tr><td>Adaga comum</td><td>2</td><td>0,3 m</td><td>6,9</td></tr>',
     '<tr><td>Adaga comum</td><td>2</td><td>0,30 m</td><td>9</td></tr>'],
    ['<tr><td>Espada longa</td><td>3</td><td>1,2 m</td><td>12,6</td></tr>',
     '<tr><td>Espada longa</td><td>3</td><td>1,20 m</td><td>20</td></tr>'],
    ['<tr><td>Montante de Liga Superior</td><td>5</td><td>1,5 m</td><td>19,5</td></tr>',
     '<tr><td>Montante de Liga Superior</td><td>5</td><td>1,50 m</td><td>29</td></tr>'],
    ['<tr><td>Mochila Média de Couro</td><td>2</td><td>4</td><td>18</td></tr>',
     '<tr><td>Mochila Média de Couro</td><td>2</td><td>0,60 m</td><td>11</td></tr>'],

    ['<p>O número quebra, e é para quebrar: a adaga aguenta seis falhas críticas e cai na sétima, o montante aguenta dezenove e cai na vigésima. A regra é a mesma nas duas mãos. A diferença é o aço.</p>',
     '<p>O número é inteiro e a conta fecha na mesa: a adaga aguenta oito falhas críticas e cai na nona, o montante aguenta vinte e oito e cai na vigésima nona. A regra é a mesma nas duas mãos. A diferença é o aço.</p>'],

    ['<blockquote><p><strong>Exemplo:</strong> a Mochila Média de Couro custa 250 L$ e tem Integridade 18. O ponto sai por 250 × 0,5 ÷ 18 ≈ 7 L$ e uma hora de bancada. Do fundo ao topo: 125 L$ e dezoito horas — metade do preço de uma mochila nova, e a metade que você paga é em tempo.</p></blockquote>',
     '<blockquote><p><strong>Exemplo:</strong> a Mochila Média de Couro custa 250 L$ e tem Integridade 11. O ponto sai por 250 × 0,5 ÷ 11 ≈ 11 L$ e uma hora de bancada. Do fundo ao topo: 125 L$ e onze horas — metade do preço de uma mochila nova, e a metade que você paga é em tempo.</p></blockquote>'],

    ['<blockquote><p><strong>Exemplo:</strong> uma Mochila Média de Couro (peso máximo 20 kg, Integridade 18) com 40 kg dentro está no dobro do limite — excesso 1. Cada coisa guardada ou tirada custa 1 ponto; cada trecho de caminhada custa 0,33. Uma sessão com dez remexidas e vinte trechos come quase dezessete dos dezoito pontos. <strong>Dobrou o peso, a bolsa não passa da sessão.</strong></p></blockquote>',
     '<blockquote><p><strong>Exemplo:</strong> uma Mochila Média de Couro (peso máximo 20 kg, Integridade 11) com 40 kg dentro está no dobro do limite — excesso 1. Cada coisa guardada ou tirada custa 1 ponto; cada trecho de caminhada custa 0,33. Os onze pontos somem com dez remexidas e três trechos de caminhada. <strong>Dobrou o peso, a bolsa não termina a sessão.</strong></p></blockquote>'],

    ['<p>A dez por cento acima do limite, a mesma mochila dura onze sessões. Marca, não mata. A regra existe para o grupo que resolveu levar o saque inteiro de uma vez, não para punir quem carregou uma corda a mais.</p>',
     '<p>A dez por cento acima do limite, a mesma mochila dura quase sete sessões. Marca, não mata. A regra existe para o grupo que resolveu levar o saque inteiro de uma vez, não para punir quem carregou uma corda a mais.</p>'],
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const doc = await ref.get();
let html = doc.data().contentHTML;

const conta = (s, sub) => s.split(sub).length - 1;
let falhas = 0;
for (const [de, para] of TROCAS) {
    const n = conta(html, de);
    if (n !== 1) { console.log(`❌ ${n}× (esperava 1): ${de.slice(0, 70)}…`); falhas++; continue; }
    html = html.replace(de, para);
    console.log(`✓ ${de.slice(0, 60)}…`);
}
if (falhas) { console.log(`\n${falhas} troca(s) não casaram — NADA foi gravado.`); process.exit(1); }

// sobra algum número da escala velha?
for (const sujo of ['6,9', '12,6', '19,5', 'Integridade 18', 'aguenta seis falhas']) {
    if (html.includes(sujo)) console.log(`⚠️ sobrou "${sujo}" no capítulo — conferir`);
}

const words = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).length;
console.log(`\npalavras: ${doc.data().words} → ${words}`);

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
await ref.update({ contentHTML: html, words, atualizadoEm: agora, updatedAt: agora });
console.log('✅ Capítulo 5 atualizado.');
process.exit(0);
