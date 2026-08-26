/**
 * §9.9 — como o Mestre gera o Poder do Eco.
 *
 * Fechava o último [A DEFINIR] do capítulo: o Poder precifica a projeção (§9.6)
 * e entra no redutor da Supressão (§9.8), mas nada dizia de onde ele vem.
 *
 * ⚠️ A proposta original era pendurar o Poder na "tabela de sorte de Ecos" do
 * d20, decidida em 01/08/2026. VERIFICADO EM 26/08: essa tabela nunca foi
 * escrita — não existe "Estéril/Fértil/Saturada" em artigo nenhum do banco, e
 * o Mestre não rola d20 nenhum. O que existe é o `Buscar Vestígio`, que usa os
 * GRAUS do teste do jogador para decidir quantos Ecos respondem (1 + Graus) e
 * qual o melhor Estado disponível.
 *
 * Então o Poder ganha dado próprio, e o modificador de lugar — que era a boa
 * ideia daquela tabela — vem junto:
 *
 *      Poder = 2d4 + lugar        (Estéril −2 · Comum 0 · Nexo +2), preso a 1–10
 *
 * Por que 2d4 e não 1d8: a curva em sino põe a massa no meio (5) e deixa 2 e 8
 * raros, que é a forma dos 11 Ecos feitos à mão (2 a 8, mediana 4). 1d8 daria
 * peso igual ao banal e ao excepcional.
 *
 * Isso NÃO conflita com o Buscar Vestígio: aquele teste é do jogador e decide
 * quantos e em que Estado; este dado é do Mestre e decide quão fortes. Uma
 * rolagem, um eixo (§9.10).
 *
 *   node functions/regua-cap9-poder-gerar.mjs            (dry-run)
 *   node functions/regua-cap9-poder-gerar.mjs --apply
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

/* ── a distribuição de 2d4, calculada aqui ──────────────────────────────── */
const dist = {};
for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) dist[a + b] = (dist[a + b] || 0) + 1;
const preso = (n) => Math.max(1, Math.min(10, n));
const faixa = (mod) => {
    const linha = {};
    for (const [soma, peso] of Object.entries(dist)) {
        const p = preso(Number(soma) + mod);
        linha[p] = (linha[p] || 0) + peso;
    }
    return linha;
};
const pct = (n) => `${Math.round(n / 16 * 100)}%`;
const LUGARES = [
    ['Estéril — urbano, corrompido, pedra viva', -2],
    ['Comum — o resto do mundo', 0],
    ['Nexo adormecido, ruína antiga, Antiqua', +2],
];
const linhasLugar = LUGARES.map(([nome, mod]) => {
    const f = faixa(mod);
    const chaves = Object.keys(f).map(Number).sort((a, b) => a - b);
    const detalhe = chaves.map(k => `${k} (${pct(f[k])})`).join(' · ');
    return `<tr><td>${nome}</td><td>${mod > 0 ? '+' : ''}${mod}</td><td>${chaves[0]}–${chaves[chaves.length - 1]}</td><td>${detalhe}</td></tr>`;
});

/* ── calibração: os Ecos feitos à mão ───────────────────────────────────── */
const poderes = [];
for (const d of (await db.collection('npcs').get()).docs) {
    const n = d.data();
    if (!/eco/i.test(JSON.stringify(n.tags || ''))) continue;
    poderes.push(poderDoHospede(n));
}
poderes.sort((a, b) => a - b);
const mediana = poderes[Math.floor(poderes.length / 2)];

const SECAO = `<h3>Gerando o Poder — 2d4 mais o lugar</h3>
<pre>Poder = 2d4 + lugar,  preso a 1–10
lugar   Estéril −2  ·  Comum 0  ·  Nexo adormecido +2</pre>
<p>O <strong>Buscar Vestígio</strong> é do jogador e decide <em>quantos</em> Ecos respondem (1 + Graus) e qual o melhor Estado disponível. Este dado é do Mestre e decide <em>quão fortes</em> eles são. São eixos separados de propósito — uma rolagem, um eixo (§9.10).</p>
<table>
<thead><tr><th>Lugar</th><th>Mod.</th><th>Faixa</th><th>Distribuição</th></tr></thead>
<tbody>
${linhasLugar.join('\n')}
</tbody>
</table>
<p><strong>O lugar é o teto, e essa é a razão de o modificador existir.</strong> Um Eco de Poder 9–10 — o que cobra 4 a 6 de Sanidade para projetar — só aparece em Nexo adormecido, ruína antiga ou junto a uma Antiqua. Zona estéril não passa de 6. Isso põe em número o que o Compêndio já diz em prosa: ambiente urbano ou corrompido tem Essência Verde escassa; Nexo adormecido concentra Ecos poderosos e antigos.</p>
<p><strong>Por que 2d4 e não 1d8.</strong> A curva em sino põe a massa no meio e deixa os extremos raros. Com 1d8 o Eco banal e o excepcional sairiam com a mesma frequência, e o Mestre gastaria a raridade sem querer. Calibração contra os ${poderes.length} Ecos cadastrados à mão: eles vão de ${poderes[0]} a ${poderes[poderes.length - 1]}, mediana ${mediana} — a faixa Comum (2–8, moda 5) é a mesma, com o dado ligeiramente mais generoso que a mão.</p>
<p><strong>Exemplo fechado.</strong> Mestre rola 3 e 2 numa floresta comum: Poder 5. O mesmo 3 e 2 num Nexo adormecido: Poder 7 — e projetar-se nele no Véu Astral passa a custar ${custoDaProjecao({ atributos: { PRS: 7 } }, 'astral').sanidade} de Sanidade em vez de ${custoDaProjecao({ atributos: { PRS: 5 } }, 'astral').sanidade}. O lugar mudou o preço sem mudar regra nenhuma.</p>
<p><strong>Armadilha.</strong> Poder não se rola junto com Estado. O 1d10 de Estado diz se o Eco é Sereno ou Furioso; o 2d4 diz quanto ele vale. Amarrar os dois recria o conflito que o §9.9 acabou de resolver — um Ancestral obrigatoriamente poderoso, um Sereno obrigatoriamente fraco.</p>
`;

const doc = (await ref.get()).data();
if (doc.public !== false) { console.error('ABORTA: livro tecnico tem de ser public:false'); process.exit(1); }
let H = doc.contentHTML;
if (H.includes('Gerando o Poder')) { console.error('ABORTA: a secao ja existe'); process.exit(1); }

const ANCORA = '<p><strong>Armadilha.</strong> Não existe mais campo de Poder no cadastro';
if (!H.includes(ANCORA)) { console.error('ABORTA: nao achei a ancora na secao do Poder'); process.exit(1); }
H = H.replace(ANCORA, SECAO + ANCORA);

/* fecha o [A DEFINIR] */
const ABERTO = 'Falta gerar o Poder na mesa: hoje o Mestre define na ficha, e não há rolagem para isso — <code>[A DEFINIR]</code> se deve haver.';
if (!H.includes(ABERTO)) { console.error('ABORTA: nao achei o ponto em aberto'); process.exit(1); }
H = H.replace(ABERTO, 'A geração do Poder foi fechada em 26/08/2026: <strong>2d4 + lugar</strong>, no §9.9. A "tabela de sorte de Ecos" com d20 e modificador de local, decidida em 01/08/2026, <strong>nunca foi escrita</strong> — o dado próprio do Poder herdou dela a única parte que importava, o lugar como teto.');

const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`${doc.words} → ${palavras(H)} palavras\n`);
console.log('Poder = 2d4 + lugar, preso a 1–10:');
for (const [nome, mod] of LUGARES) {
    const f = faixa(mod);
    const ks = Object.keys(f).map(Number).sort((a, b) => a - b);
    console.log(`  ${nome.padEnd(42)} ${String(mod).padStart(2)} → ${ks.map(k => `${k}:${pct(f[k])}`).join(' ')}`);
}
console.log(`\nEcos à mão: ${poderes.join(' ')} (mediana ${mediana})`);
for (const t of ['p', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'h3', 'strong', 'em', 'code']) {
    const o = (H.match(new RegExp(`<${t}[ >]`, 'g')) || []).length, c = (H.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c}`); process.exit(1); }
}
console.log('\ntags ok');
if (!APPLY) { console.log('rode com --apply'); process.exit(0); }
await ref.update({ contentHTML: H, words: palavras(H), updatedAt: Date.now() });
console.log('OK gravado');
process.exit(0);
