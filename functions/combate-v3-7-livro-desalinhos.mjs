/**
 * Combate v3 — passo 7: dois trechos do Livro que ficaram na versão anterior.
 *
 * O v3 reescreveu o Capítulo 6, mas os Capítulos 2 e 4 falam do mesmo combate e
 * não foram tocados. Sobraram duas contradições diretas com o §6.4/§6.8:
 *
 *  1. §2.6 — "Aumentar Reação: 1 ENER, +2 na Reação até o fim do turno".
 *     Fazia sentido quando a defesa era um TESTE e a Reação entrava no Alvo dele.
 *     Hoje a Reação entra em TODAS as Defesas (§6.4: "Defesa = Reação + Perícia
 *     de defesa − 1"), então 1 ENER compraria +2 em todas de uma vez — mais
 *     barato e mais forte que a defesa extra do §6.2, que custa o mesmo 1 ENER e
 *     compra UMA defesa. Além disso o §6.4 diz que a Reação "só muda por
 *     peculiaridade, condição, postura ou magia" — Energia não está na lista.
 *     → vira Defesa Extra, que é o gasto defensivo que o v3 realmente criou.
 *
 *  2. §4.5 — perícia Contra-Ataque: "atacar imediatamente após defesa crítica".
 *     Gatilho da v2. O §6.8 do v3 mudou para o erro do ATACANTE (Graus ≤ 0 ou
 *     rolou 10), e acrescentou os dois preços: 1 Energia e uma defesa da rodada.
 *
 *   node functions/combate-v3-7-livro-desalinhos.mjs            (dry-run)
 *   node functions/combate-v3-7-livro-desalinhos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* [doc, rótulo, de, para] — trecho não encontrado ABORTA tudo. */
const TROCAS = [
    ['art-regras-jogador-02', '§2.6 Usos da Energia — Aumentar Reação → Defesa Extra',
        '<tr><td>Aumentar Reação</td><td>1 ENER</td><td>+2 na Reação até o fim do turno.</td></tr>',
        '<tr><td>Defesa Extra</td><td>1 ENER</td><td>Declara uma defesa além do seu limite da rodada, que é Reflexo − 1 (ver §6.2).</td></tr>'],
    ['art-regras-jogador-04', '§4.5 Perícia Contra-Ataque — gatilho e preço do §6.8',
        '<tr><td><strong>Contra-Ataque</strong></td><td>DES</td><td>Transformar defesa em ofensa — atacar imediatamente após defesa crítica.</td></tr>',
        '<tr><td><strong>Contra-Ataque</strong></td><td>DES</td><td>Transformar o erro do inimigo em golpe: quem ataca você e não alcança o próprio Alvo (Graus 0 ou menos) ou rola 10 abre a guarda. Custa 1 Energia e uma defesa da rodada.</td></tr>'],
];

/* Depois da troca, estas frases NÃO podem sobrar em lugar nenhum do Livro. */
const PROIBIDOS = ['+2 na Reação', 'após defesa crítica'];

const erros = [], feitos = [];
const docs = new Map();

for (const [id, rot, de, para] of TROCAS) {
    if (!docs.has(id)) {
        const ref = db.collection('worldbuilding-articles').doc(id);
        const snap = await ref.get();
        if (!snap.exists) { console.error(`🔴 ABORTADO: ${id} não encontrado.`); process.exit(1); }
        docs.set(id, { ref, html: snap.data().contentHTML || '', original: snap.data().contentHTML || '' });
    }
    const d = docs.get(id);
    if (!d.html.includes(de)) { erros.push(`${id}: trecho não encontrado — ${rot}`); continue; }
    d.html = d.html.split(de).join(para);
    feitos.push({ id, rot, de, para });
}

console.log('='.repeat(74));
console.log('COMBATE v3 — passo 7: alinhar Capítulos 2 e 4 ao Capítulo 6');
console.log('='.repeat(74));
for (const f of feitos) {
    console.log(`\n  ${f.rot}   [${f.id}]`);
    console.log(`    ANTES:  ${f.de.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    console.log(`    DEPOIS: ${f.para.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
}

/* auto-verificação */
if (feitos.length !== TROCAS.length) erros.push(`${TROCAS.length} trocas previstas, ${feitos.length} aplicadas`);
for (const [id, d] of docs) {
    for (const p of PROIBIDOS) if (d.html.includes(p)) erros.push(`${id}: ainda contém "${p}"`);
    if (d.html.length === d.original.length && d.html === d.original) erros.push(`${id}: nada mudou`);
}
for (const f of feitos) if (!docs.get(f.id).html.includes(f.para)) erros.push(`${f.rot}: texto novo não entrou`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação: ${feitos.length} trocas em ${docs.size} capítulos, nenhum termo antigo sobrou.`);
for (const [id, d] of docs) console.log(`   ${id}: ${d.original.length} → ${d.html.length} chars`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
for (const [, d] of docs) batch.update(d.ref, {
    contentHTML: d.html, updatedAt: Date.now(),
    words: d.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
await batch.commit();
console.log(`\n✅ Gravado: ${feitos.length} trechos em ${docs.size} capítulos.`);
process.exit(0);
