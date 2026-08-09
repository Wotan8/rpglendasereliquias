/**
 * Compêndio de Fluxomancia — "As Treze Essências" (art-fluxomancia-13-essencias).
 * Duas correções de cânone ditadas pelo dono do mundo:
 *
 *   1) O Ciclo Vital é entre DUAS — Vida e Natureza. A Necrótica não é membro
 *      do ciclo: ela existe para quebrá-lo (corrompe a Vida no lugar em que a
 *      Natureza deveria consumi-la, e consome a Natureza).
 *
 *   2) A Abissal vence TODAS as demais — é o coringa das Essências. Contra a
 *      Luz encontra mais dificuldade que contra qualquer outra, e a Luz é a
 *      única capaz de vencê-la enquanto a presença do Abismo for pequena.
 *
 * Só mexe nesses três parágrafos. Não renumera nada, não toca em outra seção.
 *
 *   node functions/livro-flux-ciclo-e-abismo.mjs            (dry-run)
 *   node functions/livro-flux-ciclo-e-abismo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ref = db.collection('worldbuilding-articles').doc('art-fluxomancia-13-essencias');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não encontrado.'); process.exit(1); }

const original = snap.data().contentHTML || '';

/* Cada troca é [rótulo, texto exato de origem, texto novo]. A âncora precisa
   aparecer exatamente uma vez — se o artigo mudou, o script aborta em vez de
   gravar por cima de outra coisa. */
const TROCAS = [
    ['Ciclo Vital',
     '<p>Vida, Natureza e Necrótica formam a cadeia que todo ser vivo percorre. A Natureza converte-se em Vida quando algo nasce e reclama a Vida de volta quando algo morre. A Vida, corrompida, torna-se Necrótica; e a Necrótica consome a Natureza, sendo sua oposta direta. É o ciclo mais disputado do mundo: três escolas o encaram de três ângulos incompatíveis.</p>',
     '<p>O ciclo é entre duas: Vida e Natureza. A Natureza doa a semente da vida; a vida germina, cresce e morre, e a Natureza a consome de volta. A roda se fecha sem terceiro.</p>\n\n' +
     '<p>A Necrótica não pertence a ele — existe para quebrá-lo. Corrompe a Vida no lugar em que a Natureza deveria consumi-la, e consome a Natureza. É o ciclo mais disputado do mundo: três escolas o encaram de três ângulos incompatíveis.</p>'],

    ['Vantagem da Luz',
     '<p><strong>Vantagem:</strong> tem bônus natural contra o Necrótico e o Abissal. É a principal força de contenção contra ambos.</p>',
     '<p><strong>Vantagem:</strong> tem bônus natural contra o Necrótico e o Abissal. É a principal força de contenção contra ambos — e a única essência capaz de vencer o Abissal, enquanto a presença do Abismo ainda for pequena.</p>'],

    ['Precedência da Abissal',
     '<p><strong>Limitação:</strong> consome e corrompe tudo que toca, inclusive quem a usa.',
     '<p><strong>Precedência:</strong> vence todas as demais. É o coringa das Essências, e nenhuma a detém por inteiro. Contra a Luz encontra mais dificuldade que contra qualquer outra — e onde sua presença ainda é pequena, só a Luz a vence.</p>\n' +
     '<p><strong>Limitação:</strong> consome e corrompe tudo que toca, inclusive quem a usa.'],
];

let html = original;
const erros = [];
for (const [rotulo, de] of TROCAS) {
    const n = html.split(de).length - 1;
    if (n !== 1) erros.push(`${rotulo}: âncora aparece ${n}× (esperado 1)`);
}
if (erros.length) {
    console.error('🔴 ABORTADO — o artigo não está no estado esperado:\n' + erros.map(e => '  - ' + e).join('\n'));
    process.exit(1);
}
for (const [, de, para] of TROCAS) html = html.replace(de, para);

const limpo = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('=== art-fluxomancia-13-essencias — 3 trocas ===\n');
for (const [rotulo, de, para] of TROCAS) {
    console.log(`── ${rotulo}`);
    console.log(`   ANTES: ${limpo(de).slice(0, 190)}`);
    console.log(`   DEPOIS: ${limpo(para).slice(0, 320)}\n`);
}
console.log(`${original.length} → ${html.length} chars (${html.length - original.length >= 0 ? '+' : ''}${html.length - original.length})`);

/* assert rodável: as três ideias novas têm que estar no HTML final, e as duas
   frases desmentidas não podem sobrar. */
const deveTer = ['A roda se fecha sem terceiro', 'existe para quebrá-lo', 'vence todas as demais', 'só a Luz a vence'];
const naoDeveTer = ['Vida, Natureza e Necrótica formam a cadeia'];
const falhas = [...deveTer.filter(s => !html.includes(s)).map(s => `faltou: "${s}"`),
                ...naoDeveTer.filter(s => html.includes(s)).map(s => `sobrou: "${s}"`)];
if (falhas.length) { console.error('\n🔴 auto-verificação falhou:\n' + falhas.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('✅ auto-verificação passou (4 frases novas presentes, 1 desmentida removida).');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
