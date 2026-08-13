/** Registra a faixa dupla e o critério do Redutor no capítulo 0 da Régua. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const U = 3.445;
assert.ok(Math.abs(3 * (0.585 / U) - 0.51) < 0.01, 'Defesa 3 vale 0,51 — a conta que motivou a faixa dupla');

const SECAO = `
<h2>0.7 Faixa dupla, e onde o Redutor pertence</h2>

<p>Enfrentar a Defesa do alvo é preço. Uma habilidade que precisa vencer
resistência entrega o efeito em 40% das vezes; uma que abençoa um aliado entrega
em 70%. A régua já descontava isso no multiplicador — mas o teto único de 1,70×
tratava as duas como se corressem o mesmo risco.</p>

<pre>enfrenta resistência ......  1,00×  a  2,00×
buff em si ou em aliado ...  1,00×  a  1,70×</pre>

<p>A folga não é desconto: é <strong>tolerância</strong>. Somar a dificuldade ao
denominador (custo) faria o oposto do pretendido — baixaria a razão e faria a
habilidade parecer mais barata de justificar. Como teto, ela permite que uma
magia arriscada entregue mais quando entrega, que é o que a mesa espera de algo
que falha três vezes em cinco.</p>

<h3>O Redutor não é propriedade da magia</h3>

<p>Redutor vem do momento, do ambiente ou de outro combatente. Se o personagem já
tem a perícia que a habilidade exige, cobrar um redutor fixo é um terceiro
imposto — invisível, porque não aparece no campo de custo.</p>

<p>Ele também penaliza duas vezes no efeito hostil: derruba a chance de conjurar
<em>e</em> derruba os Graus, que são o que o alvo precisa vencer. Em Redutor −3 a
habilidade entrega um quarto; em −4 contra AUT 3, entrega <strong>zero</strong> —
foi assim que a Armadura Sanguínea ficou impossível de conjurar sem ninguém
perceber.</p>

<p><strong>Critério:</strong> zera o Redutor de habilidade que <em>dá dano</em>,
<em>afeta facção inimiga</em> ou onde <em>o GS é determinante</em> — essas já
enfrentam a Defesa do alvo e não pagam o pedágio duas vezes. Onde o GS não decide
nada (auto-buff, cena, ritual), o Redutor permanece: ali ele é dificuldade de
execução, não imposto sobre o acerto.</p>

<p>Aplicado em 12/08/2026: 15 habilidades zeradas, 18 mantidas.</p>
`;

const arts = await db.collection('worldbuilding-articles').get();
const cap0 = arts.docs.find((d) => d.data().bookId === 'book-regua-balanceamento' && (d.data().order ?? 99) === 0);
assert.ok(cap0);
const jaTem = /0\.7 Faixa dupla/.test(cap0.data().contentHTML || '');
console.log(`seção 0.7: ${jaTem ? 'JÁ EXISTE' : 'a gravar'}`);
if (!APLICAR) { console.log('(dry-run)'); process.exit(0); }
if (!jaTem) await cap0.ref.update({ contentHTML: (cap0.data().contentHTML || '') + SECAO, updatedAt: Date.now() });
console.log('✅ gravado.');
