/**
 * §9.9 — resolve o conflito da PRS.
 *
 * A tabela de Estado tinha uma coluna "PRS do Eco" com Furioso 4, Corrompido 5,
 * Sereno 1, Ancestral 3. Isso é escala de RESISTÊNCIA — o hostil briga mais.
 * As 11 fichas usam PRS como PODER: Servo 2 ("o quase-nada"), Mestre de Armas 8
 * ("o topo da lista"). As duas ordenações discordam, e o Projetor precifica pela
 * PRS da ficha — então um Ancestral saía mais barato que um Furioso.
 *
 * RESOLVIDO: PRS é UM número e é o PODER.
 *   · a resistência já estava modelada no redutor da Supressão, no termo
 *     (5 − Disposição), que a própria tabela de Estado alimenta;
 *   · Estado e Poder são ORTOGONAIS — um Sereno pode ser poderoso;
 *   · o campo duplicado `eco.prs` do Painel saiu, e `poderDoHospede` lê a ficha.
 *
 * Este script tira a coluna da tabela e escreve a seção do Poder, calibrada
 * pelos Ecos que existem — sem inventar mapeamento de Estado para Poder.
 *
 *   node functions/regua-cap9-poder.mjs            (dry-run)
 *   node functions/regua-cap9-poder.mjs --apply
 */
import { createRequire } from 'node:module';
import { poderDoHospede, custoDaProjecao } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('DA76qGdp3QZp8VCCUQPF');

/* os Ecos reais calibram a escala — a tabela não inventa números */
const ecos = [];
for (const d of (await db.collection('npcs').get()).docs) {
    const n = d.data();
    if (!/eco/i.test(JSON.stringify(n.tags || ''))) continue;
    ecos.push({ nome: n.nome, papel: n.papel || '', poder: poderDoHospede(n) });
}
ecos.sort((a, b) => a.poder - b.poder || a.nome.localeCompare(b.nome));

const doc = (await ref.get()).data();
if (doc.public !== false) { console.error('ABORTA: livro tecnico tem de ser public:false'); process.exit(1); }
let H = doc.contentHTML;

const troca = (de, para) => {
    if (!H.includes(de)) { console.error(`ABORTA: nao achei ${JSON.stringify(de.slice(0, 70))}`); process.exit(1); }
    H = H.split(de).join(para);
};

/* 1 · a coluna PRS sai da tabela de Estado */
troca('<thead><tr><th>Estado</th><th>Disposição base</th><th>PRS do Eco</th><th>Testa Supressão no fim da cena?</th></tr></thead>',
    '<thead><tr><th>Estado</th><th>Disposição base</th><th>Testa Supressão no fim da cena?</th></tr></thead>');
for (const [estado, disp, prs, testa] of [
    ['Sereno', '7', '1', 'não'], ['Inquieto', '6', '2', 'não'], ['Furioso', '3', '4', '<strong>sim</strong>'],
    ['Corrompido', '2', '5', '<strong>sim</strong>'], ['Ancestral', '5', '3', 'não'],
]) {
    troca(`<tr><td>${estado}</td><td>${disp}</td><td>${prs}</td><td>${testa}</td></tr>`,
        `<tr><td>${estado}</td><td>${disp}</td><td>${testa}</td></tr>`);
}

/* 2 · a seção do Poder entra logo depois da tabela de Estado */
const ANCORA = '<p>O Eco gerado vira ficha de NPC';
const SECAO = `<h3>Poder do Eco — e por que não está na tabela acima</h3>
<pre>Poder = PRS da ficha do Eco.  Escala 1–10.  UMA fonte, sem campo paralelo.
usa em  redutor da Supressão (§9.8)
        Sanidade da projeção (§9.6): 1 + ⌊Poder ÷ 3⌋ + Véu</pre>
<p><strong>Poder e Estado são ortogonais.</strong> Estado diz como o Eco se comporta; Poder diz quanto ele vale. Um Sereno pode ser poderoso e um Furioso pode ser fraco. A tabela de Estado não dá Poder, e não deve dar.</p>
<p><strong>O conflito que existia aqui.</strong> Esta tabela trazia uma coluna "PRS do Eco" com Sereno 1 · Inquieto 2 · Furioso 4 · Corrompido 5 · Ancestral 3 — escala de <em>resistência</em>, em que o hostil briga mais. As fichas usam PRS como <em>poder</em>: Eco do Servo 2, Eco do Mestre de Armas 8. As duas ordenações discordam, e como o §9.6 precifica a projeção pela PRS da ficha, um Ancestral (3) saía mais barato que um Furioso (4). A coluna saiu.</p>
<p><strong>A resistência não se perdeu:</strong> ela já estava no redutor da Supressão, no termo <code>(5 − Disposição)</code>, que esta tabela alimenta. Sereno (Disp 7) subtrai 2 do redutor; Furioso (Disp 3) soma 2; Corrompido (Disp 2) soma 3. O hostil continua mais difícil de segurar — só que uma vez, e não duas.</p>
<p>Calibração, pelos Ecos cadastrados hoje:</p>
<table>
<thead><tr><th>Poder</th><th>Eco</th><th>Papel</th></tr></thead>
<tbody>
${ecos.map(e => `<tr><td>${e.poder}</td><td>${e.nome}</td><td>${e.papel}</td></tr>`).join('\n')}
</tbody>
</table>
<p><strong>Armadilha.</strong> Não existe mais campo de Poder no cadastro do Eco no Painel — havia um (<code>eco.prs</code>) e ele vencia a ficha. Duas entradas para um número só é fábrica de divergência: bastava o Mestre preencher lá com a escala velha para a projeção cobrar pela resistência. Quem for reabrir o cadastro não recrie esse campo.</p>
`;
troca(ANCORA, SECAO + ANCORA);

/* 3 · o exemplo fechado do §9.8 rotula o 4 como PRS; agora é Poder */
troca('redutor = 4 (PRS) + 2 (personalidade) + 3 (5 − 2) = 9',
    'redutor = 4 (Poder) + 2 (personalidade) + 3 (5 − 2) = 9');
troca('redutor = PRS do Eco  (+ peso da Personalidade, + (5 − Disposição))',
    'redutor = Poder do Eco  (+ peso da Personalidade, + (5 − Disposição))');

/* 4 · fecha o ponto em aberto */
troca('<p><strong>PRS do §9.9 contra PRS de ficha.</strong> A tabela de geração dá PRS 1 a 5 por Estado (Ancestral 3). Os 11 Ecos cadastrados têm PRS 2 a 8, e o Projetor agora precifica por esse número — um Eco do Mestre de Armas (PRS 8) sai mais caro que um Ancestral (PRS 3). Ou a tabela de geração está numa escala velha, ou o Poder do Eco é outro número que não a PRS. <code>[A DEFINIR]</code>, e é o ponto mais urgente daqui.</p>',
    '<p><strong>RESOLVIDO em 25/08/2026 — PRS do §9.9 contra PRS de ficha.</strong> A PRS estava sendo pedida para ser resistência e poder ao mesmo tempo, com ordenações opostas. Ficou sendo <strong>Poder</strong>, fonte única na ficha; a resistência continua entrando pelo termo <code>(5 − Disposição)</code>. Ver §9.9. Falta gerar o Poder na mesa: hoje o Mestre define na ficha, e não há rolagem para isso — <code>[A DEFINIR]</code> se deve haver.</p>');

/* ── relatório ──────────────────────────────────────────────────────────── */
const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`${doc.words} → ${palavras(H)} palavras`);
for (const t of ['p', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'h2', 'h3', 'strong', 'em', 'code']) {
    const o = (H.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
    const c = (H.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c}`); process.exit(1); }
}
if (/PRS do Eco<\/th>/.test(H)) { console.error('ABORTA: a coluna PRS ainda esta na tabela'); process.exit(1); }
console.log('tags ok · coluna PRS fora da tabela de Estado');
console.log('\nEscada de preço da projeção, agora monotônica no Poder:');
for (const p of [1, 3, 5, 8, 10]) {
    console.log(`  Poder ${String(p).padStart(2)} → ` + ['material', 'eterico', 'astral']
        .map(v => `${v} ${custoDaProjecao({ atributos: { PRS: p } }, v).sanidade} SAN`).join(' · '));
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: H, words: palavras(H), updatedAt: Date.now() });
console.log('\nOK gravado');
process.exit(0);
