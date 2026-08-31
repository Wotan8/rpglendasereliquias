/**
 * v3 · LOTE 2 — a Manada das Nuvens Baixas, e a doma lida pelo Grau.
 *
 * PARTE A — a escada de doma passa a sair do Grau de Ameaça, não de faixas soltas
 * de força. Uma Calamidade PODE ser domada; a dificuldade é que se chama
 * Calamidade. Os três degraus que já eram cânone (−1/6, −3/8, −5/10) ficam onde
 * estavam e mapeiam em Comum, Séria e Grave; só as duas pontas são novas.
 *
 *      Grau         Redutor   Lealdade   Alvo máximo alcançável (teto 9)
 *      Inofensiva      0          4              9   —  90%
 *      Praga          −1          5              8   —  80%
 *      Comum          −1          6              8   —  80%
 *      Séria          −3          8              6   —  60%
 *      Grave          −5         10              4   —  40%
 *      Calamidade     −7         10              2   —  20%
 *
 * PARTE B — as quatro fichas da manada, traduzidas para v3.
 *
 *   Nimbrote      Inofensiva  · o filhote não é a ameaça; a mãe é
 *   Nímbara       Séria       · protege a cria acima da própria fome
 *   Nímbaro       Séria       · territorial, carga
 *   Nímbaro Alfa  Grave       · líder de manada
 *
 * A BLINDAGEM DELES ERA DIGITADA E ALTA DEMAIS. Estavam com 0/3/4/5, e um arnês
 * pesado completo de Grau 1 dá 3,90 — o Alfa saía mais protegido que placa
 * completa. Cai para 0/2/2/3 e passa a ser PELE DURA cadastrada, que custa
 * Poder: número solto não custa nada e mente no selo, igual à Vitalidade.
 *
 *   node functions/bestiario-v3-lote2.mjs            (dry-run)
 *   node functions/bestiario-v3-lote2.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const medio = d => { const m = /(\d+)d(\d+)/.exec(d); return Number(m[1]) * (Number(m[2]) + 1) / 2; };
const dprDe = (alvo, dado, bonus) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    return { P, liq: Math.max(1, medio(dado) + bonus - 2), dpr: P * Math.max(1, medio(dado) + bonus - 2) };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const DOMA = { 'Inofensiva': [0, 4], 'Praga': [-1, 5], 'Comum': [-1, 6], 'Séria': [-3, 8], 'Grave': [-5, 10], 'Calamidade': [-7, 10] };
const vg = n => n.toFixed(2).replace('.', ',');
const custoPele = nv => { let t = 0; for (let i = 1; i <= nv; i++) t += 5 * i; return t; };

/* ── PARTE A · a seção nova do capítulo ── */
const SECAO_DOMA = `
<h3>A doma sai do Grau</h3>

<p>Conseguir uma fera é teste universal, de qualquer classe: <strong>AUT + Domar</strong>, com o Redutor da criatura. E o Redutor não é gosto do Narrador — <strong>sai do Grau de Ameaça</strong>, porque é exatamente isso que a fera opõe a quem tenta coleirá-la.</p>

<table>
<thead><tr><th>Grau</th><th>Redutor</th><th>Lealdade mínima</th><th>Melhor chance possível</th></tr></thead>
<tbody>
<tr><td>Inofensiva</td><td>0</td><td>4</td><td>90%</td></tr>
<tr><td>Praga</td><td>−1</td><td>5</td><td>80%</td></tr>
<tr><td>Comum</td><td>−1</td><td>6</td><td>80%</td></tr>
<tr><td>Séria</td><td>−3</td><td>8</td><td>60%</td></tr>
<tr><td>Grave</td><td>−5</td><td>10</td><td>40%</td></tr>
<tr><td><strong>Calamidade</strong></td><td><strong>−7</strong></td><td><strong>10</strong></td><td><strong>20%</strong></td></tr>
</tbody>
</table>

<p>A última coluna é a chance de quem chegou ao teto: Alvo 9, o máximo que qualquer teste alcança. Contra uma Calamidade, o melhor domador vivo acerta um em cada cinco. <strong>Uma Calamidade pode, sim, ser domada</strong> — só que a dificuldade se chama Calamidade, e é isso que ela quer dizer.</p>

<p>Um personagem recém-criado tem AUT 3 e Domar 3: Alvo 6. Ele doma Praga e Comum, arranha as Sérias e não encosta no resto. A fera grande não é uma questão de coragem, é de anos.</p>

<p><strong>E fera forte chega pronta.</strong> Criatura acima do orçamento de companheiro nasce com as melhorias de Lealdade pré-gastas: é magnífica no dia em que aceita, e é tudo o que vai ser. O que ela não vier a crescer, você não vai ensinar.</p>
`;

/* ── PARTE B · a manada ── */
const LOTE = [
    { nome: 'Nimbrote', grauAlvo: 'Inofensiva', bld: 0, pele: 0,
      golpe: ['Chifrinho (A. Padrão)', 4, '1d4', 1],
      ataques: 'Chifrinho (A. Padrão): Alvo 4, 1d4+1 e uma centelha que não machuca ninguém.\n'
        + 'Coice Desajeitado (A. Padrão): Alvo 3, 1d4+1.\n'
        + 'Bezerros quase nunca atacam — só em pânico, e erram quase sempre.',
      densidade: 'nunca sozinho: sempre no meio da manada',
      nota: 'a ameaça não é ele — é o que a Nímbara faz quando ele berra' },

    { nome: 'Nímbara', grauAlvo: 'Séria', bld: 2, pele: 2,
      golpe: ['Chifres Eletrificados (A. Padrão)', 6, '1d8', 4],
      ataques: 'Chifres Eletrificados (A. Padrão): Alvo 6, 1d8+4 e Faísca — o alvo perde a Reação até o fim do turno dele.\n'
        + 'Pisoteio (A. Padrão, área 2 m): Alvo 5, 1d6+4.\n'
        + 'Buffo Trovejante (A. Padrão, cone 6 m): Alvo 5, 1d4 sônico.',
      densidade: 'manada de 4 a 8, com os bezerros no centro',
      nota: 'ataca primeiro quando há cria por perto, e não recua' },

    { nome: 'Nímbaro', grauAlvo: 'Séria', bld: 2, pele: 2,
      golpe: ['Chifres Eletrificados (A. Padrão)', 7, '1d12', 5],
      ataques: 'Chifres Eletrificados (A. Padrão): Alvo 7, 1d12+5 e Faísca — o alvo perde a Reação até o fim do turno dele.\n'
        + 'Cabeçada Devastadora (A. Padrão; exige 8 m de carga): Alvo 7, 1d12+5 e empurra 4 m.\n'
        + 'Pisoteio (A. Padrão, área 3 m): Alvo 6, 1d8+5.',
      densidade: '1 ou 2 por manada, na borda',
      nota: 'territorial; carrega no que se aproxima antes de olhar o que é' },

    { nome: 'Nímbaro Alfa', grauAlvo: 'Grave', bld: 3, pele: 3,
      golpe: ['Chifres Relampejantes (A. Padrão)', 9, '2d8', 6],
      ataques: 'Chifres Relampejantes (A. Padrão): Alvo 9, 2d8+6 e Atordoado — o alvo testa VIG Alvo 4 ou perde o turno seguinte.\n'
        + 'Pisoteio Apocalíptico (A. Padrão, área 4 m): Alvo 8, 1d12+6.\n'
        + 'Buffo Trovejante (A. Padrão, cone 12 m): Alvo 7, 1d8 sônico e Derrubada.',
      densidade: '1 por manada, e onde ele vai a manada vai',
      nota: 'a manada inteira soma perto de 10× — não é encontro, é sair da frente' },
];

const grab = async c => (await db.collection(c).get()).docs;
const [npcs, pecs, arts] = await Promise.all([grab('npcs'), grab('system/data/peculiarities'),
    (async () => (await db.collection('worldbuilding-articles').where('bookId', '==', 'book_mrs9ur4aw1m6a').get()).docs)()]);
const erros = [];

const pd = pecs.filter(d => (d.data().nome || '') === 'Pele Dura');
if (pd.length !== 1) erros.push(`peculiaridade "Pele Dura": ${pd.length} docs`);
const PELE_ID = pd[0]?.id;

const cap = arts.find(d => (d.data().title || '') === 'O Nível de Ameaça');
if (!cap) erros.push('capítulo "O Nível de Ameaça" não achado');
else if (cap.data().contentHTML.includes('A doma sai do Grau')) erros.push('a seção de doma já está no capítulo');

for (const c of LOTE) {
    const d = npcs.filter(x => (x.data().nome || '') === c.nome);
    if (d.length !== 1) { erros.push(`"${c.nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    c.ref = d[0].ref; c.doc = n;
    const [rot, alvo, dado, bon] = c.golpe;
    const forAtt = Number(n.atributos?.FOR) || 0, des = Number(n.atributos?.DES) || 0;
    Object.assign(c, dprDe(alvo, dado, bon));
    c.x = c.dpr / U;
    c.grau = grauDe(c.x);
    c.vit = Number(n.valoresDer?.VIT) || 0;
    c.bldAntes = Number(n.valoresDer?.BLD) || 0;
    c.pericia = alvo - Math.max(forAtt, des);
    if (c.grau !== c.grauAlvo) erros.push(`${c.nome}: ${vg(c.x)}× cai em ${c.grau}, não em ${c.grauAlvo}`);
    if (bon > forAtt) erros.push(`${c.nome}: bônus +${bon} acima de FOR ${forAtt} (Dano = FOR)`);
    if (c.pericia > 5 || c.pericia < 0) erros.push(`${c.nome}: Alvo ${alvo} exigiria perícia ${c.pericia}`);
    if (c.bld > 3.9) erros.push(`${c.nome}: Blindagem ${c.bld} acima do arnês pesado completo (3,90)`);
    const [red, leal] = DOMA[c.grau];
    c.ameaca = `${c.grau} · ${vg(c.x)}× · ${c.densidade} · Domável: AUT + Domar, dificuldade ${c.grau} `
        + `(Redutor ${red === 0 ? '0' : '−' + Math.abs(red)}) · Vínculo: Lealdade ${leal} · ${c.nota}`;
}

/* ── relatório ── */
console.log('\n=== PARTE A · doma pelo Grau ===\n');
for (const [g, [r, l]] of Object.entries(DOMA))
    console.log(`   ${g.padEnd(11)} Redutor ${String(r).padStart(2)}  Lealdade ${String(l).padStart(2)}  melhor chance ${(9 + r) * 10}%`);
console.log(`\n   Seção nova no capítulo "O Nível de Ameaça" (${SECAO_DOMA.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} palavras).`);

console.log('\n\n=== PARTE B · Manada das Nuvens Baixas ===\n');
console.log('nome           Alvo  dano      P     líq    DPR    força    grau        BLD       Vit    rodadas p/ grupo de 4');
for (const c of LOTE) {
    if (!c.ref) continue;
    const [, alvo, dado, bon] = c.golpe;
    const liqPJ = Math.max(1, 8.5 - c.bld);
    console.log(`${c.nome.padEnd(14)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(8)} ${c.P.toFixed(2)}  ${c.liq.toFixed(1).padStart(5)}  ${c.dpr.toFixed(2).padStart(5)}  ${vg(c.x)}×  ${c.grau.padEnd(11)} ${c.bldAntes}→${c.bld}    ${String(c.vit).padStart(5)}  ${(c.vit / (4 * 0.6 * liqPJ)).toFixed(1)}`);
}
console.log('\nBlindagem vira Pele Dura cadastrada (custa Poder em vez de ser número solto):');
for (const c of LOTE) if (c.ref && c.pele) console.log(`   ${c.nome.padEnd(14)} Pele Dura Nv${c.pele} → +${c.pele} Blindagem · ${custoPele(c.pele)} de Poder`);
console.log('\nNível de Ameaça:');
for (const c of LOTE) if (c.ref) console.log(`\n   ${c.nome}\n      de:   ${c.doc.criatura?.nivelAmeaca || '(vazio)'}\n      para: ${c.ameaca}`);
const somaManada = 2.67 + 2 * 1.46 + 5 * 0.83 + 2 * 0.12;
console.log(`\n   Manada cheia (1 Alfa + 2 Nímbaros + 5 Nímbaras + 2 bezerros) = ${vg(somaManada)}× contra os 4,0× de um grupo de quatro.`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const html = cap.data().contentHTML + SECAO_DOMA;
const batch = db.batch();
batch.update(cap.ref, { contentHTML: html, words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, updatedAt: Date.now() });
for (const c of LOTE) {
    const patch = { ataques: c.ataques, 'criatura.nivelAmeaca': c.ameaca, lastUpdate: iso, lastUpdateBy: AUTOR };
    if (c.pele) {
        patch.peculiaridades = [...(c.doc.peculiaridades || []).filter(p => p.refId !== PELE_ID),
            { refId: PELE_ID, nivel: c.pele, fonte: null }];
        patch['valoresDer.overrides.BLD'] = FV.delete();
    }
    patch['valoresDer.BLD'] = c.bld;
    batch.update(c.ref, patch);
}
await batch.commit();
console.log(`\n✅ seção de doma no capítulo · ${LOTE.length} fichas da manada traduzidas.`);
process.exit(0);
