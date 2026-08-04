/**
 * Cap. 5 — duas correções:
 *
 *  1. §5.5 "Descasamento de Fio é letal" — a arma dois Fios acima matava em
 *     "1–2 golpes" no modelo de +5 por tier. Com +1, são dois ou três. O lado
 *     da proteção (piso de 1, 24 golpes) não mudou.
 *  2. §5.4 — a regra da metade passa a valer também para o dano arcano. A
 *     fraqueza física vem da classe do material; a arcana vem da peça.
 *
 *   node functions/livro-cap5-descasamento-arcano.mjs            (dry-run)
 *   node functions/livro-cap5-descasamento-arcano.mjs --apply
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
        nome: '5.5 · descasamento: 1–2 golpes → dois ou três',
        de: '<p><strong>Descasamento de Fio é letal — e é proposital.</strong> Uma arma dois Fios acima da sua proteção mata em 1–2 golpes; uma proteção dois Fios acima da arma atacante reduz tudo ao piso de 1 de dano (24 golpes para cair). O perigo do jogo está em enfrentar quem tem aço melhor que o seu — não na sorte do dado.</p>',
        para: '<p><strong>Descasamento de Fio é letal — e é proposital.</strong> Uma arma dois Fios acima da sua proteção mata em dois ou três golpes; uma proteção dois Fios acima da arma atacante reduz tudo ao piso de 1 de dano (24 golpes para cair). O perigo do jogo está em enfrentar quem tem aço melhor que o seu — não na sorte do dado.</p>'
    },
    {
        nome: '5.4 · a metade vale para o arcano também',
        de: '<p>Metade é a mesma conta do Golpe Preciso (Capítulo 6, seção 6.9) — dividir por dois e cortar a fração. Peças específicas podem ceder a outra coisa, inclusive a uma Essência; quando for o caso, a peça diz.</p>',
        para: `<p>Metade é a mesma conta do Golpe Preciso (Capítulo 6, seção 6.9) — dividir por dois e cortar a fração.</p>
<p><strong>Uma peça também pode ceder a uma Essência</strong>, e vale a mesma regra: contra a Essência que a fura, o Reforço Arcano conta metade. A diferença está na origem. A fraqueza física vem da classe do material e está na tabela acima — toda placa entrega o impacto, sempre. A fraqueza arcana é da peça: um arnês cede ao Fogo, o arnês ao lado não cede a nada, e é a peça que diz. Descobrir isso antes do combate vale mais que um Fio.</p>`
    }
];

const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
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

/* o número que NÃO podia mudar */
if (!html.includes('24 golpes para cair')) { console.error('🔴 o "24 golpes para cair" sumiu. Abortando.'); process.exit(1); }
console.log('\n  "24 golpes para cair" preservado.');
console.log(`${antes} → ${html.length} chars (+${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
