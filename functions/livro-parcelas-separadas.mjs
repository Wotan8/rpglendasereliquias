/**
 * §6.5 — as parcelas de dano deixam de virar um número só.
 *
 *  1. Passo 4 reescrito: cada parcela entra na Vitalidade com o seu tipo. O piso
 *     de 1 continua sendo do golpe inteiro (é o que impede fatiar o arcano em
 *     três Essências para render 3 em vez de 1), e quando sobra só esse 1 ele é
 *     do tipo da maior parcela antes da Blindagem.
 *  2. O exemplo da espada necrótica fechava com "Dano final = 7" — agora fecha
 *     nas duas parcelas separadas.
 *  3. Entra a Blindagem Arcana negativa: quando a peça cede e não há Reforço
 *     Arcano para absorver, ela amplifica em vez de proteger.
 *
 *   node functions/livro-parcelas-separadas.mjs            (dry-run)
 *   node functions/livro-parcelas-separadas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const E = [
    {
        nome: '§6.5 · passo 4: parcelas separadas, piso do golpe',
        de: '<li><strong>Some tudo e aplique o piso de 1.</strong> O mínimo é do golpe inteiro, <strong>nunca de cada parcela</strong>.</li>',
        para: '<li><strong>Cada parcela entra na Vitalidade com o seu tipo.</strong> Elas não viram um número só: o alvo perde tantos de Cortante e tantos de Púrpura, separados. O <strong>piso de 1 é do golpe inteiro</strong>, nunca de cada parcela — e quando tudo é barrado e sobra só esse 1, ele é do tipo da maior parcela antes da Blindagem.</li>'
    },
    {
        nome: '§6.5 · exemplo da necrótica fecha nas duas parcelas',
        de: 'Aço: 9 − 3 = 6. Púrpura: 2 − 1 = 1. Dano final = <strong>7</strong>.</p></blockquote>',
        para: 'Aço: 9 − 3 = 6. Púrpura: 2 − 1 = 1. O alvo perde <strong>6 de Cortante e 1 de Púrpura</strong> — não 7 de dano.</p></blockquote>'
    },
    {
        nome: '§6.5 · Blindagem Arcana abaixo de zero amplifica',
        de: '<p>Repare no passo 2: cada Essência enfrenta a Blindagem Arcana <em>inteira</em>.',
        para: '<p>A Blindagem Arcana pode ficar <strong>abaixo de zero</strong> — basta a peça ceder a uma Essência e não haver Reforço Arcano para segurar. Aí ela deixa de proteger e passa a amplificar: uma parcela de 4 contra Blindagem Arcana −2 entrega 6. É o prêmio de acertar a fraqueza.</p>\n<p>Repare no passo 2: cada Essência enfrenta a Blindagem Arcana <em>inteira</em>.'
    }
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não existe.'); process.exit(1); }
let html = snap.data().contentHTML || '';
const antes = html.length;
let erro = false;

for (const e of E) {
    const n = html.split(e.de).length - 1;
    const ok = n === 1;
    console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
    if (!ok) { erro = true; continue; }
    html = html.replace(e.de, e.para);
}
if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }

/* o exemplo de parcela única não podia ser tocado */
if (!html.includes('Dano final = 6 pontos de Vitalidade')) {
    console.error('🔴 o exemplo da Armadura Completa sumiu. Abortando.'); process.exit(1);
}
console.log('\n  exemplo da Armadura Completa preservado.');
console.log(`  ${antes} → ${html.length} chars (+${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
