/**
 * §9.5 — a curva da entrega tem forma de VALE, e isso é registro, não defeito.
 *
 * Medição de 26/08/2026 (Eco fixo tudo-4, enumeração das faces pelo motor):
 * a entrega esperada cai conforme o personagem se aproxima do teto e VOLTA a
 * crescer quando a Aura levanta o teto. Quem parou de crescer recebe pouco;
 * quem comprou Aura recebe muito de novo — e paga por isso.
 *
 * Sem esta nota, o próximo auditor olha só a metade esquerda da curva e conclui
 * "a habilidade favorece o iniciante" — foi exatamente o falso problema
 * descoberto e descartado em 26/08. A nota existe para ninguém redescobri-lo.
 *
 *   node functions/regua-cap9-vale.mjs            (dry-run)
 *   node functions/regua-cap9-vale.mjs --apply
 */
import { createRequire } from 'node:module';
import { calcularDadiva, categoriasDaDadiva, candidatosDaCategoria, dadoSugerido } from '../shared/dadiva.js';
import { custoEscalonado } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('DA76qGdp3QZp8VCCUQPF');

/* ── a medição roda AQUI, no motor — a tabela do capítulo nasce dela ─────── */
const catalogo = {
    pericias: [{ nome: 'Atletismo', categoria: 'fisico' }, { nome: 'Erudição', categoria: 'mental' },
        { nome: 'Esquiva', categoria: 'combate' }, { nome: 'Diplomacia', categoria: 'social' },
        { nome: 'Submundo', categoria: 'exclusivo' }],
    derivedValues: [...['P. Tátil', 'P. Visual', 'P. Auditiva', 'P. Olfativa', 'Percepção', 'Visão de Essência']
        .map(n => ({ key: n, nome: n, blocoNome: 'Sentidos' })),
    ...['Flutuação', 'Voo', 'Aéreo', 'Terrestre', 'Vertical', 'Aquático']
        .map(n => ({ key: n, nome: n, blocoNome: 'Deslocamento' }))],
};
const A = ['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRS', 'PRE', 'MAN', 'AUT'];
const eco = {
    atributos: Object.fromEntries(A.map(a => [a, 4])),
    pericias: { Atletismo: 4, Erudição: 4, Esquiva: 4, Diplomacia: 4, Submundo: 4 },
    vitais: { vitMax: 30, enerMax: 5 },
    vds: Object.fromEntries(catalogo.derivedValues.map(d => [d.key, 4])),
};
function esperado(nivel, teto) {
    const xama = {
        atributos: Object.fromEntries(A.map(a => [a, nivel])),
        pericias: Object.fromEntries(Object.keys(eco.pericias).map(k => [k, nivel])),
        vitais: { vitMax: 20, enerMax: 3 },
        vds: Object.fromEntries(catalogo.derivedValues.map(d => [d.key, nivel])),
    };
    let total = 0;
    for (const chave of ['braco', 'mente', 'pele', 'olho', 'passo', 'boca', 'pericia', 'energia']) {
        for (const cat of categoriasDaDadiva(chave, catalogo)) {
            const cands = candidatosDaCategoria(cat, eco, catalogo);
            if (!cands.length) continue;
            const saidas = dadoSugerido(cands.length).nenhumEm;
            let soma = 0;
            for (let f = 1; f <= saidas; f++) {
                const r = calcularDadiva(chave, eco, xama, catalogo,
                    { teto: () => teto, custoRecurso: 2, sorteio: (arr) => (f <= arr.length ? arr[f - 1] : null) });
                soma += (r?.ganhos || []).reduce((t, g) => t + (g.unidades || 0), 0);
            }
            total += soma / saidas;
        }
    }
    return total;
}
const n2 = (x) => x.toFixed(2).replace('.', ',');
const CASOS = [
    ['iniciante (tudo 1), sem Aura', 1, 5],
    ['médio (tudo 3), sem Aura', 3, 5],
    ['no teto (tudo 5), sem Aura', 5, 5],
    ['tudo 5, Aura grau I em tudo', 5, 6],
    ['tudo 5, Aura grau III em tudo', 5, 8],
];
const linhas = CASOS.map(([nome, nivel, teto]) => {
    const U = esperado(nivel, teto);
    const s = custoEscalonado(U).sanidade;
    return `<tr><td>${nome}</td><td>${n2(U)}</td><td>${s}</td></tr>`;
});

const NOTA = `<h3>A curva da entrega é um vale — e é para ser</h3>
<p>Medição de 26/08/2026, Eco fixo (tudo 4), valor esperado por enumeração das faces:</p>
<table>
<thead><tr><th>Quem recebe</th><th>E[unidades]</th><th>Sanidade</th></tr></thead>
<tbody>
${linhas.join('\n')}
</tbody>
</table>
<p>A entrega cai conforme o personagem se aproxima do teto e <strong>volta a crescer quando a Aura o levanta</strong>. O fundo do vale é o personagem parado no teto sem Aura. Isso é coerente três vezes: o iniciante recebe muito e a Sanidade o avisa de que aquele Eco não era para ele (mesmo raciocínio do exemplo do §9.8 — o número diz, sem prosa); quem comprou Aura pagou caro pelo teto novo e a incorporação o empurra até lá; e o veterano tem o pool de Sanidade que a conta pede.</p>
<p><strong>O piso do vale não é zero:</strong> o teto só corta atributos e perícias. Sentidos, Deslocamento, Pele e Energia entregam o valor do hóspede inteiro para qualquer receptor — na medição, 5,04 un constantes em todos os casos.</p>
<p><strong>Armadilha de auditoria.</strong> Quem olhar só a metade esquerda da curva conclui que a habilidade favorece o iniciante e propõe limitar a entrega. Foi proposto e descartado em 26/08/2026: a metade direita mostra que o "favorecimento" é o espaço na ficha, e a Aura o devolve a quem investir. Não há correção pendente aqui.</p>
`;

const doc = (await ref.get()).data();
if (doc.public !== false) { console.error('ABORTA: livro tecnico tem de ser public:false'); process.exit(1); }
let H = doc.contentHTML;
const ANCORA = '<h2>9.6 O preço do Projetor';
if (!H.includes(ANCORA)) { console.error('ABORTA: nao achei a ancora do 9.6'); process.exit(1); }
if (H.includes('curva da entrega é um vale')) { console.error('ABORTA: a nota ja existe'); process.exit(1); }
H = H.replace(ANCORA, NOTA + ANCORA);

const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`${doc.words} → ${palavras(H)} palavras`);
for (const l of linhas) console.log('  ' + l.replace(/<[^>]+>/g, ' '));
for (const t of ['p', 'table', 'tr', 'td', 'h3']) {
    const o = (H.match(new RegExp(`<${t}[ >]`, 'g')) || []).length, c = (H.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c}`); process.exit(1); }
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: H, words: palavras(H), updatedAt: Date.now() });
console.log('OK gravado');
process.exit(0);
