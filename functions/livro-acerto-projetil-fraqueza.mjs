/**
 * Três correções de regra.
 *
 *  §6.3 — a tabela de Acerto prometia "FOR ou DES", escolha que não existe:
 *         quem decide é a arma, e isso já está cadastrado em cada uma. Arremesso
 *         também deixa de ser escolha e vira DES.
 *  §5.3 — "Munição" vira "Projétil", o termo do sistema.
 *  §5.4 — a fraqueza arcana não podia ser "metade": metade de 0 é 0, e a §6.5
 *         diz que a Blindagem Arcana desce abaixo de zero e amplifica. A física
 *         continua metade (ali a Blindagem sempre existe); a arcana passa a ser
 *         um valor declarado na peça.
 *
 *   node functions/livro-acerto-projetil-fraqueza.mjs            (dry-run)
 *   node functions/livro-acerto-projetil-fraqueza.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const CAP6 = [
    {
        nome: '§6.3 · a arma decide o atributo, não o jogador',
        de: `<tr><td>Corpo-a-corpo (arma)</td><td>FOR ou DES + Arma</td></tr>
<tr><td>Desarmado</td><td>FOR + Briga</td></tr>
<tr><td>Arremesso</td><td>FOR ou DES + Arremessar</td></tr>
<tr><td>Disparo</td><td>DES + Disparo</td></tr>`,
        para: `<tr><td>Corpo-a-corpo (arma)</td><td>FOR + Arma — ou DES + Arma, nas armas de precisão</td></tr>
<tr><td>Desarmado</td><td>FOR + Briga</td></tr>
<tr><td>Arremesso</td><td>DES + Arremessar</td></tr>
<tr><td>Disparo</td><td>DES + Disparo</td></tr>`
    },
    {
        nome: '§6.3 · quem escolhe é a mão que saca',
        de: '<p><em>Na ficha, a aba <strong>Combate</strong> mostra o Acerto e o Dano já calculados para cada arma equipada.</em></p>',
        para: `<p><strong>Quem decide o atributo é a arma.</strong> Adaga, faca, estoque e sabre são lâminas de ponta e pulso: acertam por Destreza. Espada, machado, foice, haste e impacto pedem braço, e acertam por Força. Você não escolhe no momento do golpe — escolhe qual arma saca.</p>
<p><em>Na ficha, a aba <strong>Combate</strong> mostra o Acerto e o Dano já calculados para cada arma equipada, com o atributo que aquela arma usa. A conta não se monta na mão.</em></p>`
    }
];

const CAP5 = [
    {
        nome: '§5.3 · Munição → Projétil',
        de: '<li><strong>Munição:</strong> arcos e bestas requerem flechas/virotes — sem munição, a arma é inútil. A aljava fica no inventário e desconta conforme o uso.</li>',
        para: '<li><strong>Projétil:</strong> arcos e bestas requerem flechas ou virotes — sem projétil, a arma é inútil. A aljava fica no inventário e desconta conforme o uso.</li>'
    },
    {
        nome: '§5.4 · fraqueza arcana deixa de ser metade',
        de: '<p><strong>Uma peça também pode ceder a uma Essência</strong>, e vale a mesma regra: contra a Essência que a fura, o Reforço Arcano conta metade. Físico e arcano funcionam igual — os dois são da peça.',
        para: `<p><strong>Uma peça também pode ceder a uma Essência</strong>, e aí a conta é outra. No físico a Blindagem sempre existe, então metade dela ainda protege alguma coisa. Contra Essência não: quem não pagou Reforço Arcano tem zero, e metade de zero é zero. Por isso a fraqueza arcana é um <strong>número que a peça desconta</strong> da Blindagem Arcana — e ele pode levá-la abaixo de zero. Aí ela para de proteger e passa a amplificar: um arnês que cede ao Fogo em −2, num alvo sem Reforço Arcano, faz uma parcela de chama de 4 entregar 6. A resistência arcana funciona igual, ao contrário: um número que a peça soma. Físico e arcano funcionam igual num ponto — os dois são da peça.`
    }
];

async function aplicar(docId, edicoes, rotulo) {
    const ref = db.collection('worldbuilding-articles').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`🔴 ${docId} não existe.`); return null; }
    let html = snap.data().contentHTML || '';
    const antes = html.length;
    console.log(`\n=== ${rotulo} ===`);
    for (const e of edicoes) {
        const n = html.split(e.de).length - 1;
        const ok = n === 1;
        console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
        if (!ok) return null;
        html = html.replace(e.de, e.para);
    }
    console.log(`  ${antes} → ${html.length} chars`);
    return { ref, html };
}

const r6 = await aplicar('art-regras-jogador-06', CAP6, 'Capítulo 6');
const r5 = await aplicar('art-regras-jogador-05', CAP5, 'Capítulo 5');
if (!r6 || !r5) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }

/* nenhuma "munição" pode sobrar no capítulo 5 */
const sobra = (r5.html.match(/[Mm]uniç/g) || []).length;
console.log(`\n"munição" restante no Capítulo 5: ${sobra}`);
if (sobra) {
    const t = r5.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const m of t.matchAll(/[Mm]uniç/g)) console.error(`  🔴 …${t.slice(Math.max(0, m.index - 130), m.index + 130)}…`);
    process.exit(1);
}

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
for (const r of [r6, r5]) await r.ref.update({ contentHTML: r.html, updatedAt: Date.now() });
console.log('\n✅ Gravado nos dois capítulos.');
process.exit(0);
