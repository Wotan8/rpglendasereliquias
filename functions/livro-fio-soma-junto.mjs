/**
 * Duas frases:
 *
 *  §5.5 — "uma arma de Fio 3 com as duas afiações no máximo carrega +6 de dano"
 *         somava Afiação comum com Afiação Arcana num número só (uma é física,
 *         a outra é Essência, e enfrentam Blindagens diferentes), e ainda
 *         esquecia o Fio, que também soma na parcela física.
 *
 *  §6.5 — "o dano natural do material" é como o Fio se chamava antes de ter nome.
 *
 *   node functions/livro-fio-soma-junto.mjs            (dry-run)
 *   node functions/livro-fio-soma-junto.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const E = [
    { doc: 'art-regras-jogador-05', nome: '§5.5 · o que a arma de Fio 3 realmente carrega',
      de: '<li><strong>Em arma:</strong> cada melhoria vale <strong>+1 de dano por Fio</strong>, e as duas empilham na mesma arma — uma arma de Fio 3 com as duas afiações no máximo carrega +6 de dano;</li>',
      para: '<li><strong>Em arma:</strong> cada melhoria vale <strong>+1 de dano por Fio</strong>, e as duas empilham na mesma arma — mas em parcelas diferentes. Numa arma de Fio 3 com tudo no máximo: a Afiação soma +3 de dano físico, a Afiação Arcana soma +3 de Essência, e o Fio dela soma outros +3 no físico. A lâmina bate com <strong>+6 físico e +3 de Essência</strong>, não com um número só;</li>' },

    { doc: 'art-regras-jogador-06', nome: '§6.5 · "dano natural do material" → Fio',
      de: 'e a própria arma pode somar bônus — o dano natural do material e as Afiações.',
      para: 'e a própria arma pode somar bônus — o Fio dela (Capítulo 5, seção 5.6) e as Afiações.' }
];

const porDoc = {};
for (const e of E) (porDoc[e.doc] ||= []).push(e);
let erro = false;
const pend = [];

for (const [doc, lista] of Object.entries(porDoc)) {
    const ref = db.collection('worldbuilding-articles').doc(doc);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`🔴 ${doc} não existe.`); erro = true; continue; }
    let html = snap.data().contentHTML || '';
    const antes = html.length;
    for (const e of lista) {
        const n = html.split(e.de).length - 1;
        const ok = n === 1;
        console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
        if (!ok) { erro = true; continue; }
        console.log(`     - ${e.de.replace(/<[^>]+>/g, '').slice(0, 160)}`);
        console.log(`     + ${e.para.replace(/<[^>]+>/g, '').slice(0, 160)}`);
        html = html.replace(e.de, e.para);
    }
    pend.push({ ref, html, doc, antes });
}

if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
for (const p of pend) {
    await p.ref.update({ contentHTML: p.html, updatedAt: Date.now() });
    console.log(`✅ ${p.doc}: ${p.antes} → ${p.html.length} chars`);
}
process.exit(0);
