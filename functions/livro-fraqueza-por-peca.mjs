/**
 * §5.4 — a fraqueza passa a ser da PEÇA. A tabela por classe vira padrão, não lei.
 *
 * Motivo: dentro de uma mesma classe as peças se comportam diferente. Elmo de
 * Placas contra impacto é o pior lugar do corpo; Escarpes quase não sofrem com
 * pancada e cedem à ponta; Brigandina aguenta corte e abre na estocada; Cota de
 * Malha detém o fio e falha na ponta e na pancada. A classe é atalho, não regra.
 *
 * Entra junto a resistência: contra o tipo a que a peça resiste, a Blindagem
 * vale uma vez e meia.
 *
 *   node functions/livro-fraqueza-por-peca.mjs            (dry-run)
 *   node functions/livro-fraqueza-por-peca.mjs --apply
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
        nome: '§5.4 · a tabela por classe vira padrão, não lei',
        de: '<p>O que existe é <strong>fraqueza</strong>, e ela é da peça. Placa espalha o fio da lâmina e entrega o impacto inteiro a quem está dentro; couro detém a pancada e se rasga na ponta da flecha. <strong>Cada classe cede a um tipo, e contra ele a Blindagem vale metade</strong> — arredondando para baixo, como sempre:</p>\n<table>\n<thead><tr><th>Classe</th><th>Cede a</th><th>Blindagem contra esse tipo</th></tr></thead>',
        para: '<p>O que existe é <strong>fraqueza</strong>, e ela é <strong>da peça</strong> — não da classe. Contra o tipo a que ela cede, a Blindagem vale metade, arredondando para baixo como sempre. Cada tipo de armadura tem o que costuma ceder, e é o que você espera antes de examinar o que está diante de você:</p>\n<table>\n<thead><tr><th>Classe</th><th>Costuma ceder a</th><th>Blindagem contra esse tipo</th></tr></thead>'
    },
    {
        nome: '§5.4 · física e arcana funcionam igual; entra a resistência',
        de: '<p><strong>Uma peça também pode ceder a uma Essência</strong>, e vale a mesma regra: contra a Essência que a fura, o Reforço Arcano conta metade. A diferença está na origem. A fraqueza física vem da classe do material e está na tabela acima — toda placa entrega o impacto, sempre. A fraqueza arcana é da peça: um arnês cede ao Fogo, o arnês ao lado não cede a nada, e é a peça que diz. Descobrir isso antes do combate vale mais que um Fio.</p>',
        para: `<p>A tabela diz o comum, não o certo. Placa costuma entregar o impacto, mas um elmo cede à pancada muito mais que uma escarpa, e uma brigandina de placas rebitadas em tecido aguenta corte melhor do que a classe dela promete. <strong>Quem manda é a peça.</strong> Quando ela foge do padrão, ela diz.</p>
<p><strong>Uma peça também pode ceder a uma Essência</strong>, e vale a mesma regra: contra a Essência que a fura, o Reforço Arcano conta metade. Físico e arcano funcionam igual — os dois são da peça. A única diferença é que o físico tem um padrão a que recorrer e o arcano não tem nenhum: não existe motivo para couro ceder ao Fogo mais que ao Necrótico. Um arnês cede ao Fogo, o arnês ao lado não cede a nada, e é a peça que diz. Descobrir isso antes do combate vale mais que um Fio.</p>
<p>O contrário também existe. Uma peça pode <strong>resistir</strong> a um tipo, e aí a Blindagem contra ele vale <strong>uma vez e meia</strong> — mesma conta, mesmo arredondamento. Resistência é rara e nunca vem de graça: quem a tem, tem porque a peça foi feita ou tratada para isso.</p>`
    },
    {
        nome: '§5.4 · exemplo com fraqueza e resistência',
        de: '<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra um malho, 1. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada e 4 de malho — e o malho ainda passa pela placa quando a espada já não passa mais.</p></blockquote>',
        para: '<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra o que ela cede, 1. Contra o que ela resiste, 4. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada nesse arnês, 4 do que o fura e 6 do que ele detém — e o malho ainda passa pela placa quando a espada já não passa mais.</p></blockquote>'
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

if (html.includes('toda placa entrega o impacto, sempre')) { console.error('🔴 a frase falsa sobreviveu. Abortando.'); process.exit(1); }
console.log('\n  "toda placa entrega o impacto, sempre" removida.');
console.log(`  ${antes} → ${html.length} chars (+${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
