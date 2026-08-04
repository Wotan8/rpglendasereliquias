/**
 * O Reforço passa a ser comprável por parte (correção do usuário).
 *
 * O §5.5 dizia "não se reforça peça por peça — o ferreiro trabalha o conjunto
 * como um serviço só". Vira o contrário: cada uma das três partes recebe o seu,
 * e o que segura o total é o teto na Qualidade do Torso.
 *
 *   node functions/livro-reforco-por-parte.mjs            (dry-run)
 *   node functions/livro-reforco-por-parte.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const EDICOES = [
    {
        nome: '§5.5 · Reforço se compra por parte',
        de: '<li><strong>Em proteção:</strong> o Reforço é <strong>um trabalho sobre o corpo inteiro</strong>, ancorado na peça de Torso: <strong>+1 de Blindagem por nível, com teto na Qualidade do Torso</strong>. O Reforço Arcano funciona igual, na Blindagem Arcana. Não se reforça peça por peça — o ferreiro trabalha o conjunto como um serviço só, e sem peça de Torso não há onde ancorar.</li>',
        para: '<li><strong>Em proteção:</strong> o Reforço vale <strong>+1 de Blindagem por nível</strong> e se compra <strong>parte por parte</strong> — Cabeça, Torso e Membros levam cada um o seu serviço, pela mesma tabela da Afiação. Nenhuma parte passa da própria Qualidade, e <strong>o Reforço somado no corpo inteiro não passa da Qualidade da peça de Torso</strong>: é o peitoral que sustenta o resto, e sem ele não há onde ancorar trabalho nenhum. O Reforço Arcano funciona igual, na Blindagem Arcana.</li>'
    },
    {
        nome: '§5.5 · a corrente inclui o Reforço da proteção',
        de: 'Escrita curta: <strong>Liga ≥ Qualidade ≥ Afiação</strong>. Em proteção, só a ponta troca de nome: <strong>Liga ≥ Qualidade ≥ Reforço</strong>. O material limita o trabalho; o trabalho limita o acabamento.',
        para: 'Escrita curta: <strong>Liga ≥ Qualidade ≥ Afiação</strong>. Em proteção, só a ponta troca de nome: <strong>Liga ≥ Qualidade ≥ Reforço</strong>, e isso vale peça a peça — um elmo de Qualidade 2 aceita Reforço 2, não mais. O material limita o trabalho; o trabalho limita o acabamento.'
    },
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 capítulo 5 não existe.'); process.exit(1); }
let html = snap.data().contentHTML || '';
const antes = html.length;

console.log('\n=== Reforço por parte (Capítulo 5) ===');
for (const e of EDICOES) {
    const n = html.split(e.de).length - 1;
    console.log(`${n === 1 ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
    if (n !== 1) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }
    html = html.replace(e.de, e.para);
}
/* a frase antiga não pode sobreviver em lugar nenhum */
if (html.includes('Não se reforça peça por peça')) {
    console.error('  🔴 a frase antiga ainda está no capítulo.'); process.exit(1);
}
console.log(`  ${antes} → ${html.length} chars`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Capítulo 5 atualizado.');
process.exit(0);
