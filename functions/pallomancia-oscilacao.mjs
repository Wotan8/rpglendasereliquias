/**
 * Pallomancia — Teste de Oscilação Solar: dizer o que os modificadores modificam.
 *
 * O bloco dizia:
 *     Alvo = AUT + Fluxomancia + Resistência à Luz Vacilante
 *     Redutor: 2 (base)
 *     Modificadores: +1 se sob sol direto; -1 se em sombra densa ou área abissal.
 *
 * "Modificadores" de quê? Três evidências fecham a leitura no ALVO:
 *
 *  1. Redutor NÃO TEM SINAL (Livro do Jogador, cap. 2: `Alvo = Atributo +
 *     Perícia + Bônus − Redutor`). Um número com sinal não pode ser delta de
 *     Redutor por construção.
 *  2. A ficção exige: sol direto AJUDA quem canaliza a Deusa-Sol; sombra densa
 *     e área abissal ATRAPALHAM. Só a leitura no Alvo dá isso — no Redutor os
 *     sinais ficariam invertidos (sol tornando a prece mais difícil).
 *  3. A linha seguinte do próprio bloco escreve "-1 no Alvo fixo", mostrando
 *     que é assim que este artigo marca delta de Alvo.
 *
 * ⚠️ NÃO TOCA no outro problema deste bloco, que é de balanceamento e não de
 * redação: a perícia Resistência à Luz Vacilante é contada DUAS VEZES — está
 * no Alvo como termo E "reduz em 1 por nível o redutor da Oscilação Solar".
 * Ver o relatório do script.
 *
 * De quebra, conserta o cabeçalho "Como Suspender A Luz Vacilante", que o
 * import quebrou em dois <h2> com um "A" solto no meio.
 *
 *   node functions/pallomancia-oscilacao.mjs            (dry-run)
 *   node functions/pallomancia-oscilacao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('art_ms3gb8qyw3pvwr');

const doc = (await ref.get()).data();
let H = doc.contentHTML;
const troca = (de, para) => {
    if (!H.includes(de)) { console.error(`ABORTA: nao achei ${JSON.stringify(de.slice(0, 70))}`); process.exit(1); }
    H = H.split(de).join(para);
};

/* 1 · os modificadores são no Alvo, e o texto passa a dizer */
troca('Modificadores: +1 se sob sol direto; -1 se em sombra densa ou área abissal.',
    'Modificadores <strong>no Alvo</strong>: +1 sob sol direto; −1 em sombra densa ou área abissal. '
    + '(O Redutor não leva sinal — ele é a dificuldade, e sobe ou desce por outras regras, não por estas.)');

/* 2 · o cabeçalho partido em dois pelo import */
troca('<h2>Como Suspender</h2>\n<p>A</p>\n<h2>Luz Vacilante</h2>',
    '<h2>Como Suspender a Luz Vacilante</h2>');

const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`"${doc.title}" · público=${doc.public} · ${doc.words} → ${palavras(H)} palavras`);
for (const t of ['p', 'h2', 'strong', 'table', 'tr', 'td']) {
    const o = (H.match(new RegExp(`<${t}[ >]`, 'g')) || []).length, c = (H.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c}`); process.exit(1); }
}
console.log('tags ok\n');

/* ── o que fica em aberto, e é decisão de mesa ──────────────────────────── */
const t = H.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const noAlvo = /Alvo = AUT \+ Fluxomancia \+ Resistência à Luz Vacilante/.test(t);
const noRedutor = /reduz em 1 por nível o redutor da Oscilação Solar/.test(t);
if (noAlvo && noRedutor) {
    console.log('⚠️  ACHADO NOVO, não tocado: a perícia Resistência à Luz Vacilante conta DUAS vezes.');
    console.log('    · entra no Alvo como termo:  Alvo = AUT + Fluxomancia + Resistência à Luz Vacilante');
    console.log('    · e ainda "reduz em 1 por nível o redutor da Oscilação Solar"');
    console.log('    Nível 3 da perícia move o teste em 6, não em 3. É a mesma família do conflito da PRS:');
    console.log('    dois mecanismos para um número só. Corrigir muda balanceamento — decisão de mesa.');
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: H, words: palavras(H), updatedAt: Date.now() });
console.log('\nOK gravado');
process.exit(0);
