/**
 * Régua v2 — registra o método novo no livro e reverte os 3 custos da v1.
 *
 *   node functions/__aplica-regua-v2-livro.mjs            (dry-run)
 *   node functions/__aplica-regua-v2-livro.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const U = 3.445;
const PISO = 1.50, TETO = 3.50;
assert.equal(1.00 / 1.00, 1.00, 'a espada: 1,00 unidade por 1 Ação Padrão');
assert.ok(PISO > 1.00, 'o piso tem que exigir mais que só sacar a espada');

/* ═══ 1. A seção nova da Régua de Balanceamento ═══ */
const SECAO = `
<h2>0.6 O custo é tudo que o personagem paga — e a faixa é 1,50× a 3,50×</h2>

<p>A primeira versão desta régua media <code>unidades ÷ recurso</code> e aprovava
qualquer coisa entre 1,00× e 1,70×. Isso contradizia o §0.3 do próprio documento:
se o guerreiro ataca de graça toda rodada, uma habilidade que consome a Ação
Padrão não entrega o que ela vale — entrega o que ela vale <strong>a mais que o
golpe que ela substituiu</strong>.</p>

<p>Medindo assim, nove manobras marciais estavam aprovadas rendendo menos que
sacar a espada. Desarme e Retirada Ágil rendiam exatamente <strong>zero</strong> a
mais, e continuavam marcadas como 1,00× — dentro da faixa.</p>

<h3>A correção</h3>

<pre>custo total = recursos + ação
razão = unidades ÷ custo total
faixa aceitável = 1,50×  a  3,50×</pre>

<p>O golpe de espada vale <strong>1,00×</strong> por construção: entrega 1,00
unidade e custa 1 Ação Padrão. É o chão contra o qual tudo se mede. O piso de
1,50 é a exigência explícita de que gastar recurso renda <strong>50% a mais</strong>
que só bater — abaixo disso a habilidade existe no papel e nunca é usada na mesa.</p>

<h3>Quanto custa cada ação</h3>

<table><tbody>
<tr><td>Ação Livre</td><td>0</td><td>não tira nada do turno</td></tr>
<tr><td>Ação de Movimento</td><td>0,333</td><td>um terço do turno (§0.5)</td></tr>
<tr><td>Ação Padrão</td><td>1,000</td><td>o golpe que você não deu</td></tr>
<tr><td>Ação Completa</td><td>1,333</td><td>a Padrão mais a de Movimento</td></tr>
<tr><td>Sustentada</td><td>1,000</td><td>por turno mantido</td></tr>
<tr><td>Fora de combate</td><td>0</td><td>outra economia (§3.3)</td></tr>
</tbody></table>

<h3>Quanto custa cada recurso</h3>

<table><tbody>
<tr><td>1 Energia</td><td>1,000</td><td>a âncora (§4.1)</td></tr>
<tr><td>1 Graça, 1 Harmonia</td><td>1,000</td><td>recurso de escola equivale à Energia</td></tr>
<tr><td>1 Carga</td><td>0,871</td><td>3 de Vitalidade, câmbio do Sangral</td></tr>
<tr><td>1 Vitalidade</td><td>0,290</td><td>§1.1 — cura é dano desfeito</td></tr>
<tr><td>1 Sanidade</td><td>0,290</td><td><strong>âncora declarada</strong>, ver abaixo</td></tr>
</tbody></table>

<p><strong>Ponto em aberto:</strong> Sanidade não tinha taxa de combate — o §6.3
diz isso na Vennire, e a coloca na economia de cena. A v2 precisa de um número
porque ela é custo de ativação, então foi igualada à Vitalidade: as duas são
reserva que se esgota. É estimativa, não derivação, e mexer nela move o preço de
toda a Abismancia e da Necromancia.</p>

<h3>O que isso implica</h3>

<p>Uma habilidade de 1 Energia em Ação Padrão custa <strong>2,00</strong>. Para
entrar na faixa ela precisa entregar de <strong>3,00 a 7,00 unidades</strong> —
cerca do dobro do que a v1 exigia. Habilidade de Ação Livre não paga o golpe, e
por isso é a forma mais barata de entregar valor: é lá que a régua permite efeito
pequeno.</p>

<p>Na revisão de 12/08/2026, <strong>54 das 60 habilidades medidas reprovaram na
v2</strong>. Isso não significa que o catálogo estava quebrado para cima: significa
que ele estava calibrado contra um chão que não existia.</p>
`;

const arts = await db.collection('worldbuilding-articles').get();
const cap0 = arts.docs.find((d) => d.data().bookId === 'book-regua-balanceamento' && (d.data().order ?? 99) === 0);
assert.ok(cap0, 'não achei o capítulo 0 da Régua');
const jaTem = /0\.6 O custo é tudo que o personagem paga/.test(cap0.data().contentHTML || '');

/* ═══ 2. Não há custo a reverter ═══
   A v1 subiu Golpe Cruzado, Golpe pelas Costas e Golpe Giratório de 1 para 2,
   mas só no metadado `regua.custo` — o campo Custo que o jogador lê continuou
   "1 Energia". Nunca houve mudança visível na mesa, então não há o que desfazer:
   a v2 recalcula a régua dos três a partir do custo real. */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const desalinhados = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
    const kC = Object.keys(lbl).find((x) => /^custo/i.test(lbl[x]));
    for (const it of (m.itensPredefinidos || [])) {
        if (!kC || !it.regua) continue;
        const txt = String(it.valores?.[kC] ?? '');
        const n = Number((txt.match(/^\s*(\d+)/) || [])[1]);
        if (Number.isFinite(n) && it.regua.custo !== n && /energia|gra[çc]a/i.test(txt))
            desalinhados.push(`${it.nome}: cadastro "${txt}" vs régua ${it.regua.custo}`);
    }
}

console.log('=== PLANO ===');
console.log(`  seção 0.6 no capítulo "${cap0.data().title}": ${jaTem ? 'JÁ EXISTE (pula)' : 'a gravar'}`);
console.log(`  régua desalinhada do cadastro: ${desalinhados.length}`);
desalinhados.forEach((x) => console.log('    ' + x));

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
if (!jaTem) lote.update(cap0.ref, { contentHTML: (cap0.data().contentHTML || '') + SECAO, updatedAt: Date.now() });
await lote.commit();
console.log('\n✅ gravado.');
