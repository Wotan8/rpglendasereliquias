/**
 * Régua de Balanceamento, capítulo 0 — acrescenta a ECONOMIA DE AÇÃO.
 *
 * Faltava, e a falta produziu erro real: uma habilidade foi reescrita com "sem
 * gastar ação", que o sistema não concede. Isso é regra de base — pertence ao
 * capítulo da linha de base, antes de qualquer taxa.
 *
 *   node functions/livro-cap0-economia-acao.mjs            (dry-run)
 *   node functions/livro-cap0-economia-acao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const col = db.collection('worldbuilding-articles');
const docs = (await col.where('bookId', '==', 'book-regua-balanceamento').get()).docs;
const alvo = docs.find(d => /^0 —/.test(d.data().title || ''));
if (!alvo) { console.error('🔴 ABORTADO: capítulo 0 não encontrado.'); process.exit(1); }
const original = alvo.data().contentHTML || '';

const NOVO = `
<h2>0.5 Economia de ação — leia antes de escrever qualquer habilidade</h2>
<p>Livro §6.2. <strong>O turno tem duas ações:</strong></p>
<table>
<thead><tr><th>Ação</th><th>Serve para</th><th>Vale na régua</th></tr></thead>
<tbody>
<tr><td><strong>Ação Padrão</strong></td><td>atacar, usar habilidade, <strong>lançar magia</strong>, usar item</td><td><strong>1,00</strong> — é o ataque que você deixou de fazer</td></tr>
<tr><td><strong>Ação de Movimento</strong></td><td>deslocar-se, recarregar, pegar item</td><td>~0,33 <em>(âncora a confirmar)</em></td></tr>
<tr><td>Ação Livre</td><td>falar uma frase, largar objeto, olhar</td><td>0</td></tr>
</tbody>
</table>
<p>Alternativamente, duas Ações de Movimento. Quem luta com armas duplas usa a de Movimento para atacar com a segunda arma (§6.10).</p>

<blockquote><p><strong>TODA magia, TODA manobra e TODO golpe consomem 1 Ação Padrão.</strong> Isso é o padrão, não uma característica que a habilidade precise declarar. Se custar mais de uma ação, o turno inteiro (Ação Completa) ou apenas uma Ação Livre, <strong>a descrição diz</strong>. Fora esses casos, é 1 Ação.</p></blockquote>

<h3>O que isso proíbe na redação</h3>
<p>Nenhuma habilidade é isenta de Ação. Escrever <em>"sem gastar ação"</em> ou <em>"sem custo de ação"</em> reivindica uma isenção que o sistema não concede, e infla o valor da habilidade contra a régua sem que nada tenha sido pago.</p>
<p>Erro registrado: <em>Composição de Batalha</em> foi reescrita com "sem gastar ação" e teve de ser corrigida. A forma certa de dizer o que se pretendia é <strong>"não exige manter ritmo"</strong> — o efeito corre pela cena sem reativação. A distinção é entre <em>ausência de sustentação</em> (existe) e <em>isenção de ação</em> (não existe).</p>

<h3>Sustentação</h3>
<p>Habilidade que exige "manter ritmo" ou vale "enquanto tocar" consome <strong>1 Ação Padrão por turno</strong> enquanto durar. Isso é <strong>−1,00 por rodada</strong> que a régua precisa descontar do valor entregue — o conjurador não está atacando.</p>
<p>Consequência prática: uma canção sustentada só se paga se o que ela dá ao grupo superar o que o conjurador deixa de fazer sozinho. <strong>[A DEFINIR]</strong> — o DPR de referência de um Bardo, que é o que decide se as seis canções sustentadas do repertório estão no positivo.</p>

<h3>Por que 1 turno roubado vale mais que 1,00</h3>
<p>Atordoado custa o turno <em>inteiro</em>: as duas ações. Por isso vale <strong>1,32</strong> e não 1,00 — 1,00 da Ação Padrão negada, mais o resto (§6.1).</p>
`;

let html = original.trimEnd() + '\n' + NOVO.trim() + '\n';
console.log('=== Capítulo 0: economia de ação ===\n');
console.log('  0.5 Economia de ação — o turno tem 2 ações; toda habilidade custa 1 Padrão');
console.log(`  ${original.length} → ${html.length} chars (+${html.length - original.length})`);

const deveTer = ['TODA magia, TODA manobra', 'sem gastar ação', 'não exige manter ritmo', '1 Ação Padrão por turno'];
const falta = deveTer.filter(s => !html.includes(s));
if (falta.length) { console.error('\n🔴 auto-verificação falhou: ' + falta.join(', ')); process.exit(1); }
if (/0\.5 Economia[\s\S]*0\.5 Economia/.test(html)) { console.error('\n🔴 ABORTADO: seção duplicada.'); process.exit(1); }
console.log('  ✅ auto-verificação passou.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await col.doc(alvo.id).update({ contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
console.log('\n✅ Gravado.');
process.exit(0);
