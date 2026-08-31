/**
 * Nevara — os quatro consertos, e a carne de um predador de topo.
 *
 *  1. Renomeia "Felino-Fantasma das Savanas" → "Nevara".
 *  2. Alvo 10 e 11 não existem: o teto é 9 e o excedente é Transbordo. A ficha
 *     passa a escrever isso — "Alvo 9 (+1 Transbordo)".
 *  3. Salto Predatório dava +5 com FOR 4. Vai a +4 (Dano = FOR).
 *  4. O Tamanho estava travado em 10 por override. Sai o override; a Altura vai
 *     a 1,5 (a altura no ombro que a própria ficha declarava) e o Tamanho volta
 *     a ser calculado: 4,5.
 *
 * A CARNE. Ela age sempre sozinha e é predadora de topo — então quem mede a
 * Vitalidade dela não é o duelo, é o grupo. O teto de 10 rodadas vale para
 * criatura que um personagem pode encontrar de igual para igual; para a solitária
 * que enfrenta a mesa inteira, o alvo é a janela de 4 a 5 rodadas contra quatro
 * personagens (Régua §0.4). Por isso o assert daqui é esse, e não o do duelo.
 *
 *     base pela Altura 1,5 ....... (VIG 4 + 4,5) × 3 = 25,5
 *     Carne Dura Nv10 ............ +30            → 55,5
 *     Pele Dura Nv3 .............. Blindagem 2 → 3
 *     grupo de 4 entrega 13,2 por rodada → 4,2 rodadas   ✓
 *
 * Nada disso é override: são as duas peculiaridades, que custam 305 de Poder e
 * aparecem no selo. Ela sai de Poder 803 para 1108.
 *
 *   node functions/bestiario-nevara.mjs            (dry-run)
 *   node functions/bestiario-nevara.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90, ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl', TAMANHO_VD = '173WnYtDJuLBjr8Yuyy4';

const medio = d => { const m = /(\d+)d(\d+)/.exec(d); return Number(m[1]) * (Number(m[2]) + 1) / 2; };
const mede = (alvo, dado, bon, vezes = 1) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    const liq = Math.max(1, medio(dado) + bon - 2);
    return { P, liq, dpr: P * liq * vezes, transbordo: Math.max(0, alvo - 9), x: P * liq * vezes / U };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');
const custo = nv => { let t = 0; for (let i = 1; i <= nv; i++) t += 5 * i; return t; };

const ALTURA = 1.5, CARNE_NV = 10, PELE_NV = 3, BLD = 3;
const GOLPES = [
    ['Garras Duplas (A. Padrão + A. Movimento, §6.10)', 10, '1d8', 4, 2],
    ['Salto Predatório (A. Padrão; exige 6 m de corrida)', 11, '1d12', 4, 1],
    ['Mordida Fatal (A. Padrão)', 10, '1d10', 4, 1],
    ['Estrangulamento (A. Padrão, só contra alvo Agarrado)', 8, '1d8', 4, 1],
    ['Cauda Chicote (A. Padrão)', 9, '1d6', 4, 1],
];
const rotuloAlvo = alvo => alvo > 9 ? `Alvo 9 (+${alvo - 9} Transbordo)` : `Alvo ${alvo}`;
const ATAQUES =
    `Garras Duplas (A. Padrão + A. Movimento, regra de segunda arma do §6.10): ${rotuloAlvo(10)}, 1d8+4 cada.\n`
  + `Salto Predatório (A. Padrão; exige 6 m de corrida): ${rotuloAlvo(11)}, 1d12+4 e Derrubada.\n`
  + `Mordida Fatal (A. Padrão): ${rotuloAlvo(10)}, 1d10+4 — vai ao pescoço.\n`
  + `Estrangulamento (A. Padrão, só contra alvo Agarrado): Alvo 8, 1d8+4 por rodada.\n`
  + `Cauda Chicote (A. Padrão): Alvo 9, 1d6+4 e desequilíbrio.\n`
  + `Ilusionista: não é vista antes do primeiro golpe, salvo quem passe em Percepção Alvo 3.`;

const NIVEL_AMEACA_CAUDA = 'Domável: AUT + Domar, dificuldade Grave (Redutor −5) · Lealdade começa em 2, '
    + 'vínculo exige 10 — 8 pontos a cada 3 sessões, 24 sessões ao todo';

const grab = async c => (await db.collection(c).get()).docs;
const [npcs, pecs, skillsDocs] = await Promise.all([grab('npcs'), grab('system/data/peculiarities'), grab('system/data/skills')]);
const erros = [];
const d = npcs.filter(x => /^(Nevara|Felino-Fantasma)/i.test(x.data().nome || ''));
if (d.length !== 1) erros.push(`Nevara / Felino-Fantasma: ${d.length} docs`);
const doc = d[0], n = doc?.data() || {};
const pecId = nome => { const p = pecs.filter(x => (x.data().nome || '') === nome); if (p.length !== 1) erros.push(`peculiaridade "${nome}": ${p.length}`); return p[0]?.id; };
const CARNE = pecId('Carne Dura'), PELE = pecId('Pele Dura');

const a = n.atributos || {}, vd = n.valoresDer || {};
const FOR = Number(a.FOR) || 0, DES = Number(a.DES) || 0, VIG = Number(a.VIG) || 0;
const base = Math.max(FOR, DES);

let melhor = null;
for (const [rot, alvo, dado, bon, vezes] of GOLPES) {
    const m = mede(alvo, dado, bon, vezes);
    if (!melhor || m.x > melhor.x) melhor = { ...m, rot };
    if (bon > FOR) erros.push(`"${rot}": bônus +${bon} acima de FOR ${FOR}`);
    const per = Math.min(alvo, 9) - base;
    if (per > 5 || per < 0) erros.push(`"${rot}": exigiria perícia ${per}`);
}
const grau = grauDe(melhor.x);
if (grau !== 'Grave') erros.push(`força ${vg(melhor.x)}× cai em ${grau}, e ela deve ser Grave`);

const vitBase = (VIG + ALTURA * 3) * 3;
const vitFinal = vitBase + 3 * CARNE_NV;
const dprGrupo = 4 * 0.6 * Math.max(1, 8.5 - BLD);
const rodGrupo = vitFinal / dprGrupo;
if (rodGrupo < 4 || rodGrupo > 5) erros.push(`${rodGrupo.toFixed(1)} rodadas contra um grupo de quatro — fora da janela de 4 a 5`);
if (BLD > 3.9) erros.push(`Blindagem ${BLD} acima do teto 3,90`);

/* Poder */
const acum = (nv, por) => { let t = 0; for (let i = 1; i <= nv; i++) t += i * por; return t; };
const skById = Object.fromEntries(skillsDocs.map(s => [s.id, s.data()]));
let pAtr = 0; for (const k of ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT']) pAtr += acum(Number(a[k]) || 0, 5);
let pPer = 0; for (const p of (n.periciasEstruturadas || [])) pPer += acum(Number(p.nivel) || 0, Number(skById[p.refId]?.custoEvolucao) || 4);
const poderAntes = pAtr + pPer, poderDepois = poderAntes + custo(CARNE_NV) + custo(PELE_NV);

const ameaca = ['Grave', `${vg(melhor.x)}×`,
    'sempre sozinha — predadora de topo das redondezas de Sereni',
    NIVEL_AMEACA_CAUDA,
    'não se vê a primeira; o que se vê é a segunda'].join(' · ');

/* ── relatório ── */
console.log(`\n=== Nevara ===\n`);
console.log(`   nome: "${n.nome}" → "Nevara"`);
console.log(`\n   golpe                                                  Alvo escrito             DPR    força`);
for (const [rot, alvo, dado, bon, vezes] of GOLPES) {
    const m = mede(alvo, dado, bon, vezes);
    console.log(`   ${rot.padEnd(54)} ${rotuloAlvo(alvo).padEnd(22)} ${m.dpr.toFixed(2).padStart(5)}  ${vg(m.x)}×`);
}
console.log(`\n   Turno mais forte: ${melhor.rot} → ${vg(melhor.x)}× · GRAU ${grau.toUpperCase()}`);
console.log(`\n   Salto Predatório: bônus +5 → +4 (Dano = FOR ${FOR})`);
console.log(`   Tamanho: override ${vd.overrides?.[TAMANHO_VD]} REMOVIDO · Altura ${vd.overrides?.[ALTURA_VD]} → ${ALTURA} m · Tamanho calculado ${(ALTURA * 3).toFixed(1)}`);
console.log(`\n   Vitalidade  base ${vitBase.toFixed(1)} + Carne Dura Nv${CARNE_NV} (+${3 * CARNE_NV}) = ${vitFinal.toFixed(1)}   (era ${vd.VIT})`);
console.log(`   Blindagem   ${vd.BLD} → ${BLD}  (Pele Dura Nv${PELE_NV})`);
console.log(`   Grupo de quatro entrega ${dprGrupo.toFixed(1)} por rodada → ${rodGrupo.toFixed(1)} rodadas   (janela 4 a 5)`);
console.log(`   Ela entrega ${melhor.dpr.toFixed(1)} por rodada → derruba um personagem em ${(18 / melhor.dpr).toFixed(1)} rodadas`);
console.log(`\n   ⚡ Poder ${poderAntes} → ${poderDepois}  (Carne Dura ${custo(CARNE_NV)} + Pele Dura ${custo(PELE_NV)})`);
console.log(`\n   ataques:\n${ATAQUES.split('\n').map(l => '      ' + l).join('\n')}`);
console.log(`\n   nivelAmeaca:\n      de:   ${n.criatura?.nivelAmeaca || '(vazio)'}\n      para: ${ameaca}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const ov = { ...(vd.overrides || {}), [ALTURA_VD]: ALTURA };
delete ov[TAMANHO_VD]; delete ov.VIT; delete ov.BLD;
const pq = (n.peculiaridades || []).filter(p => p.refId !== CARNE && p.refId !== PELE);
pq.push({ refId: CARNE, nivel: CARNE_NV, fonte: null }, { refId: PELE, nivel: PELE_NV, fonte: null });
await doc.ref.update({
    nome: 'Nevara', schemaVersion: 2, modoFicha: 'mecanico',
    ataques: ATAQUES, 'criatura.nivelAmeaca': ameaca, peculiaridades: pq,
    valoresDer: { ...vd, overrides: ov, atual: vd.atual || {}, extras: vd.extras || [],
        VIT: vitFinal, BLD },
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
});
console.log('\n✅ Nevara consertada.');
process.exit(0);
