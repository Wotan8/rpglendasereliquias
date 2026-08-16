/**
 * Combate v3 — passo 8: mais três desalinhos entre Capítulos 2/4 e o Capítulo 6.
 *
 * Achados na revisão do passo 7 (mesma causa: v3 reescreveu só o Cap. 6).
 *
 *  1. §4.5 — Ambidestria dizia "sem penalidade. Sem treino: −2". A escada real
 *     (ambidestria-escada.mjs, já gravada no Cap. 6 e na perícia) é −3 sem
 *     treino, −2 no Nv1, −1 no Nv2, zero a partir do Nv3, e Nv5 destrava a
 *     manobra de duas armas da classe. O Cap. 4 nunca recebeu essa atualização.
 *
 *  2. §4.5 — Reflexo dizia "requisito para contra-ataques em cadeia", conceito
 *     que não existe mais (§6.8: "um contra-ataque não pode ser contra-atacado").
 *     No v3, Reflexo é o que define quantas defesas você declara por rodada
 *     (§6.2: Reflexo − 1, mínimo 1).
 *
 *  3. §2.6 — a tabela "Usos da Energia" não lista o Contra-Ataque, que o §6.8
 *     cobra 1 ENER. Lacuna, não contradição — só faltava a linha.
 *
 *   node functions/combate-v3-8-livro-desalinhos-2.mjs            (dry-run)
 *   node functions/combate-v3-8-livro-desalinhos-2.mjs --apply
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
    ['art-regras-jogador-04', '§4.5 Ambidestria — escada real, não "sem penalidade"',
        '<tr><td><strong>Ambidestria</strong></td><td>DES</td><td>Lutar com duas armas sem penalidade. Sem treino: −2 no Alvo de ambos os ataques.</td></tr>',
        '<tr><td><strong>Ambidestria</strong></td><td>DES</td><td>Lutar com duas armas (6.10). Sem treino: −3 no Alvo de ambos os ataques. Nv1: −2. Nv2: −1. Nv3: sem penalidade. Nv5: destrava a manobra de duas armas da sua classe.</td></tr>'],
    ['art-regras-jogador-04', '§4.5 Reflexo — defesas por rodada, não "contra-ataques em cadeia"',
        '<tr><td><strong>Reflexo</strong></td><td>DES/RAC (menor)</td><td>Reagir instintivamente. Requisito para defender-se de contra-ataques em cadeia.</td></tr>',
        '<tr><td><strong>Reflexo</strong></td><td>DES/RAC (menor)</td><td>Reagir instintivamente. Define quantas defesas você declara por rodada: Reflexo − 1 (mínimo 1), ver 6.2. Além desse limite, cada defesa custa Energia.</td></tr>'],
    ['art-regras-jogador-02', '§2.6 Usos da Energia — falta a linha do Contra-Ataque',
        '<tr><td>Defesa Extra</td><td>1 ENER</td><td>Declara uma defesa além do seu limite da rodada, que é Reflexo − 1 (ver §6.2).</td></tr>',
        '<tr><td>Defesa Extra</td><td>1 ENER</td><td>Declara uma defesa além do seu limite da rodada, que é Reflexo − 1 (ver §6.2).</td></tr>\n<tr><td>Contra-Ataque</td><td>1 ENER</td><td>Ataca de volta quando quem te atacou erra feio (ver §6.8). Consome uma defesa da rodada.</td></tr>'],
];

/* Depois da troca, estas frases NÃO podem sobrar. */
const PROIBIDOS = ['sem penalidade. Sem treino: −2', 'contra-ataques em cadeia'];

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
console.log('COMBATE v3 — passo 8: mais três desalinhos (Cap. 2 e 4 vs. Cap. 6)');
console.log('='.repeat(74));
for (const f of feitos) {
    console.log(`\n  ${f.rot}   [${f.id}]`);
    console.log(`    DEPOIS: ${f.para.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
}

/* auto-verificação */
if (feitos.length !== TROCAS.length) erros.push(`${TROCAS.length} trocas previstas, ${feitos.length} aplicadas`);
for (const [id, d] of docs) {
    for (const p of PROIBIDOS) if (d.html.includes(p)) erros.push(`${id}: ainda contém "${p}"`);
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
