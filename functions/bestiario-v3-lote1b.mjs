/**
 * v3 · LOTE 1b — os três graus corrigidos.
 *
 *   Velocirops  Séria 1,35×  →  CALAMIDADE ~3,3×
 *   Papa-Noite  Séria 1,13×  →  GRAVE      ~1,85×
 *   Avarbus     Comum 0,71×  →  SÉRIA      ~0,85×
 *
 * O Grau é calculado, não digitado — então subir de grau é subir Alvo e dado.
 * Três consequências que vêm junto e não são opcionais:
 *
 *  1. VELOCIROPS TEM FOR 2. Para um predador de quatro metros isso é dado errado,
 *     e é o que segurava o dano: `Dano = FOR` (Livro §6.5), e todas as criaturas
 *     de cânone seguem `bônus = FOR` (Horror Rastejante FOR 6, dano 1d10+6). FOR
 *     vai a 7 — o mesmo do Horror Maior. Isso também baixa a perícia exigida pelo
 *     Alvo 9 de 5 para 2, porque o Acerto é (FOR max DES) + perícia.
 *
 *  2. UM CALAMIDADE SOLITÁRIO PRECISA PASSAR NO TESTE DA CARNE. Contra quatro
 *     personagens são ~72 de Vitalidade; ele tem 45. Sem isso ele mata um na
 *     primeira rodada e cai na segunda — o defeito "vidro" do capítulo novo. A
 *     via honesta é a peculiaridade: CARNE DURA Nv9 (+27) leva a 72 e custa 225
 *     de Poder. Inflar Vitalidade por override seria de graça, e mentiria no selo.
 *
 *  3. A DENSIDADE TEM DE CAIR PARA SOLITÁRIO. "Solitário ou par" a 3,3× cada dá
 *     6,6× contra um grupo de quatro: não é encontro, é execução.
 *
 * Os seis membros do bicho ("quatro patas e dois braços") entram como a segunda
 * linha de ataque, pela regra de segunda arma do Livro §6.10 — Ação de Movimento,
 * e os braços agarram em vez de dilacerar, então não somam dano.
 *
 *   node functions/bestiario-v3-lote1b.mjs            (dry-run)
 *   node functions/bestiario-v3-lote1b.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const medio = d => { const m = /(\d+)d(\d+)/.exec(d); return Number(m[1]) * (Number(m[2]) + 1) / 2; };
const forca = (alvo, dado, bonus) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    const liq = Math.max(1, medio(dado) + bonus - 2);
    return { P, liq, dpr: P * liq };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');

const LOTE = [
    { nome: 'Velocirops', grauAlvo: 'Calamidade', forNovo: 7, carneDura: 9,
      golpes: [['Mordida Dilacerante (A. Padrão)', 9, '2d10', 7]],
      ataques: 'Seis membros: quatro patas e dois braços.\n'
        + 'Mordida Dilacerante (A. Padrão): Alvo 9, 2d10+7.\n'
        + 'Braços Prensores (A. Movimento, regra de segunda arma do §6.10): Alvo 8, sem dano — Agarrar. '
        + 'Alvo agarrado sofre a Mordida com +1 de Alvo.\n'
        + 'Investida (A. Padrão; exige 6 m em linha reta antes): Alvo 9, 2d10+7 e Derrubada.',
      densidade: 'solitário — a esta força, um par é execução, não encontro',
      cauda: 'Domável: AUT + Domar, Redutor −5 · Vínculo: Lealdade 10 · chega com as 5 melhorias pré-gastas — não cresce mais' },

    { nome: 'Papa-Noite', grauAlvo: 'Grave',
      golpes: [['Garras Noturnas (A. Padrão)', 9, '2d6', 4]],
      ataques: 'Garras Noturnas (A. Padrão): Alvo 9, 2d6+4 e Envenenar 1.\n'
        + 'Magífago: caça pelo que a presa carrega de Essência, não pelo que ela tem de carne — '
        + 'conjurador é presa preferencial.',
      densidade: 'solitário',
      cauda: 'magífago — indomável, salvo decisão do Narrador · de dia tem 20 cm e é pegável' },

    { nome: 'Avarbus', grauAlvo: 'Séria',
      golpes: [['Mordida Necrótica (A. Padrão)', 7, '1d8', 3]],
      ataques: 'Mordida Necrótica (A. Padrão): Alvo 7, 1d8+3 e Necrose 1.\n'
        + 'Dorso Espinhaço (Reação): quem o acerta em corpo a corpo leva 1d4 dos espinhos das costas.',
      densidade: 'solitário, par ou esquadrão de até 4',
      cauda: 'indomável, salvo decisão do Narrador' },
];

const grab = async c => (await db.collection(c).get()).docs;
const npcs = await grab('npcs');
const pecs = await grab('system/data/peculiarities');
const erros = [];

const carne = pecs.filter(d => (d.data().nome || '') === 'Carne Dura');
if (carne.length !== 1) erros.push(`peculiaridade "Carne Dura": ${carne.length} docs`);
const CARNE_ID = carne[0]?.id;
const custoCarne = nv => { let t = 0; for (let i = 1; i <= nv; i++) t += 5 * i; return t; };

for (const c of LOTE) {
    const d = npcs.filter(x => (x.data().nome || '') === c.nome);
    if (d.length !== 1) { erros.push(`"${c.nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    c.ref = d[0].ref; c.doc = n;
    c.forAntes = Number(n.atributos?.FOR) || 0;
    c.forDepois = c.forNovo ?? c.forAntes;
    c.des = Number(n.atributos?.DES) || 0;
    c.vitAntes = Number(n.valoresDer?.VIT) || 0;
    c.vitDepois = c.carneDura ? c.vitAntes + 3 * c.carneDura : c.vitAntes;

    c.dpr = c.golpes.reduce((s, [, alvo, dado, bon]) => s + forca(alvo, dado, bon).dpr, 0);
    c.x = c.dpr / U;
    c.grau = grauDe(c.x);
    if (c.grau !== c.grauAlvo) erros.push(`${c.nome}: força ${vg(c.x)}× cai em ${c.grau}, não em ${c.grauAlvo}`);

    for (const [rot, alvo, , bon] of c.golpes) {
        if (bon > c.forDepois) erros.push(`${c.nome} · ${rot}: bônus +${bon} acima de FOR ${c.forDepois} (Dano = FOR)`);
        const per = alvo - Math.max(c.forDepois, c.des);
        if (per > 5) erros.push(`${c.nome} · ${rot}: Alvo ${alvo} exigiria perícia ${per} (teto 5)`);
        c.pericia = per;
    }
    /* teste da carne: um solitário de Calamidade tem de aguentar um grupo de 4 */
    if (c.grauAlvo === 'Calamidade' && c.vitDepois < 70)
        erros.push(`${c.nome}: Calamidade solitário com Vitalidade ${c.vitDepois} — falha no teste da carne (~72)`);

    c.ameaca = `${c.grau} · ${vg(c.x)}× · ${c.densidade} · ${c.cauda}`;
}

/* ── relatório ── */
console.log('\n=== v3 · LOTE 1b — graus corrigidos ===\n');
console.log('nome         FOR      Alvo  dano      DPR     força    grau        Vit          rodadas (solo / grupo de 4)');
for (const c of LOTE) {
    if (!c.ref) continue;
    const [rot, alvo, dado, bon] = c.golpes[0];
    const fa = c.forAntes === c.forDepois ? String(c.forAntes) : `${c.forAntes}→${c.forDepois}`;
    const va = c.vitAntes === c.vitDepois ? String(c.vitAntes) : `${c.vitAntes}→${c.vitDepois}`;
    console.log(`${c.nome.padEnd(12)} ${fa.padEnd(8)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(8)} ${c.dpr.toFixed(2).padStart(5)}  ${vg(c.x)}×  ${c.grau.padEnd(11)} ${va.padEnd(11)} ${(c.vitDepois / U).toFixed(1)} / ${(c.vitDepois / (4 * U)).toFixed(1)}`);
}
console.log('\nAlvo = (FOR max DES) + perícia:');
for (const c of LOTE) if (c.ref) console.log(`   ${c.nome.padEnd(12)} max(${c.forDepois}, ${c.des}) + perícia ${c.pericia} = Alvo ${c.golpes[0][1]}`);
console.log('\nAtaques:');
for (const c of LOTE) if (c.ref) { console.log(`\n   ${c.nome}`); for (const l of c.ataques.split('\n')) console.log(`      ${l}`); }
console.log('\nNível de Ameaça:');
for (const c of LOTE) if (c.ref) console.log(`\n   ${c.nome}\n      de:   ${c.doc.criatura?.nivelAmeaca}\n      para: ${c.ameaca}`);
const velo = LOTE.find(c => c.carneDura);
if (velo) {
    console.log(`\nPeculiaridade nova no Velocirops:`);
    console.log(`   🥩 Carne Dura Nv${velo.carneDura} → +${3 * velo.carneDura} de Vitalidade · ${custoCarne(velo.carneDura)} de Poder`);
    console.log(`   (no Nv${velo.carneDura} a carne não se come — quem o abate leva o couro e os ossos)`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const c of LOTE) {
    const patch = { ataques: c.ataques, 'criatura.nivelAmeaca': c.ameaca, lastUpdate: iso, lastUpdateBy: AUTOR };
    if (c.forNovo) patch['atributos.FOR'] = c.forNovo;
    if (c.carneDura) {
        patch.peculiaridades = [...(c.doc.peculiaridades || []).filter(p => p.refId !== CARNE_ID),
            { refId: CARNE_ID, nivel: c.carneDura, fonte: null }];
        patch['valoresDer.VIT'] = c.vitDepois;
    }
    batch.update(c.ref, patch);
}
await batch.commit();
console.log(`\n✅ ${LOTE.length} fichas ajustadas.`);
process.exit(0);
