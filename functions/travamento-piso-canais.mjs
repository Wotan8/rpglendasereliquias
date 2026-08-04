/**
 * Travamento 1 — o piso de 1 é do GOLPE, não de cada canal de dano.
 *
 * Com dano tipado, fatiar o Fio entre canais multiplicava o mínimo: arma Grau 1
 * com Fio 4 contra armadura Grau 5 dava 1 de dano se todo o Fio fosse físico, e
 * 5 se fosse 2 fogo + 2 vento. Exploit de 5×.
 *
 * Regra: cada canal é clampado em 0, os canais somam, e só então o piso de 1
 * incide sobre o golpe. Em lutas pareadas não muda nada (Grau 5: 6,50 nas duas
 * formas).
 *
 *   node functions/travamento-piso-canais.mjs            (dry-run)
 *   node functions/travamento-piso-canais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ANCORA = 'Não existe imunidade; existe demorar muitos golpes.</p>';

const NOVO = ANCORA + `
<p><strong>Dano de mais de um canal.</strong> Uma arma pode carregar canais além do
físico — uma lâmina necrótica soma uma parcela Púrpura, uma flecha encantada soma
uma parcela Vermelha. Cada canal subtrai <strong>a Blindagem do alvo naquele
canal</strong>, não a Blindagem física. Resolva nesta ordem:</p>
<ol>
<li><strong>Cada canal separado</strong> — subtraia do canal a Blindagem do alvo naquele canal. Se der negativo, o canal vale <strong>0</strong> (nunca menos).</li>
<li><strong>Some os canais</strong> — o total é o dano do golpe.</li>
<li><strong>Piso de 1</strong> — se a soma der zero, marque 1. O mínimo é do golpe inteiro, <strong>nunca de cada canal</strong>.</li>
</ol>
<blockquote><p><strong>Exemplo:</strong> espada necrótica, 1d8 + FOR 3, com 1 de dano
Púrpura. Rola 6 → 9 físico e 1 Púrpura. O alvo tem Blindagem 3,30 e Blindagem
Púrpura 0. Físico: 9 − 3,30 = 5,70. Púrpura: 1 − 0 = 1. Dano final = 6,70.</p></blockquote>
<blockquote><p><strong>Blindagem negativa é fraqueza.</strong> Se o alvo tem Blindagem
Verde −2, uma parcela Verde de 1 passa a valer 1 − (−2) = 3.</p></blockquote>`;

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
const snap = await ref.get();
if (!snap.exists) { console.error('❌ art-regras-jogador-06 não existe.'); process.exit(1); }

const html = snap.data().contentHTML || '';
if (html.includes('Piso de 1')) { console.error('❌ O trecho já parece estar aplicado. Abortando.'); process.exit(1); }
const n = html.split(ANCORA).length - 1;
console.log(`Ocorrências da âncora: ${n}`);
if (n !== 1) { console.error('❌ Esperava exatamente 1. Abortando sem gravar.'); process.exit(1); }

console.log('\nInsere após o parágrafo do piso, em 6.5:\n');
console.log(NOVO.slice(ANCORA.length).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

if (!APPLY) { console.log('\n\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await ref.update({ contentHTML: html.replace(ANCORA, NOVO), updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
