/**
 * Tradução para o combate v3 — LOTE 1: as quatro fichas que já declaram a
 * força-alvo no próprio `nivelAmeaca`. Aqui não se decide potência, só se
 * resolve Alvo e dado para bater um número que já era cânone.
 *
 *   Velocirops  ~1,3×      Papa-Noite  ~1,2×
 *   Avarbus     ~0,8×      Ratazana    ~0,5×
 *
 * Régua v3 (base 3,90; defensor Defesa 1, Blindagem 2):
 *   P = (min(Alvo,9) − 1) ÷ 10      líq = max(1, dado + bônus − 2)
 *   DPR = P × líq                   força = DPR ÷ 3,90
 * Acerto no v3 = (FOR max DES) + Perícia da arma natural — é daí que sai o Alvo.
 *
 * O `nivelAmeaca` passa ao formato do capítulo novo do Bestiário:
 *   Grau · força · densidade · doma/vínculo
 *
 * Junto, duas correções de geografia que você acabou de dar:
 *   · Tiric mora em Sereni e passa dias na cabana de pesca da Borda de Silmarela.
 *   · Selith usa a cabana enquanto ele está na vila; quando ele volta, ela
 *     recolhe-se à Floresta de Silmarela.
 *   · A Borda de Silmarela sai do [LACUNA] com o que isso estabelece — e só isso.
 *
 *   node functions/bestiario-v3-lote1.mjs            (dry-run)
 *   node functions/bestiario-v3-lote1.mjs --apply
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
    return { P, liq, dpr: P * liq, x: (P * liq) / U };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

const LOTE = [
    { nome: 'Velocirops', alvoX: 1.3, alvo: 8, dado: '1d10', bonus: 4,
      ataques: 'Garras e Mordidas (A. Padrão): Alvo 8, 1d10+4.\n'
        + 'Investida (A. Padrão; exige 6 m em linha reta antes): Alvo 9, 1d10+4 e Derrubada.',
      densidade: 'solitário ou par',
      cauda: 'Domável: AUT + Domar, Redutor −5 · Vínculo: Lealdade 10 · chega com as 5 melhorias pré-gastas — não cresce mais' },

    { nome: 'Papa-Noite', alvoX: 1.2, alvo: 9, dado: '1d6', bonus: 4,
      ataques: 'Garras Noturnas (A. Padrão): Alvo 9, 1d6+4 e Envenenar 1.\n'
        + 'Magífago: caça pelo que a presa carrega de Essência, não pelo que ela tem de carne — '
        + 'conjurador é presa preferencial.',
      densidade: 'solitário',
      cauda: 'magífago — indomável, salvo decisão do Narrador · de dia tem 20 cm e é pegável' },

    { nome: 'Avarbus', alvoX: 0.8, alvo: 6, dado: '1d6', bonus: 4,
      ataques: 'Mordida Necrótica (A. Padrão): Alvo 6, 1d6+4 e Necrose 1.\n'
        + 'Dorso Espinhaço (Reação): quem o acerta em corpo a corpo leva 1d4 dos espinhos das costas.',
      densidade: 'solitário, par ou esquadrão de até 4',
      cauda: 'indomável, salvo decisão do Narrador' },

    { nome: 'Ratazana', alvoX: 0.5, alvo: 5, dado: '1d6', bonus: 3,
      ataques: 'Mordida Infecta (A. Padrão): Alvo 5, 1d6+3 e Infecção — VIG Alvo 3 ou perde '
        + '1 de Vitalidade por hora até ser tratada.\n'
        + 'Caudada (A. Padrão): Alvo 5, 1d4+3 e Derrubada.',
      densidade: 'solitária ou ninhada de 2 a 4',
      cauda: 'Domável: AUT + Domar, Redutor −1 · Vínculo: Lealdade 6' },
];

const npcs = (await db.collection('npcs').get()).docs;
const geo = (await db.collection('worldbuilding-geography').get()).docs;
const um = (docs, nome) => docs.filter(d => (d.data().nome || '') === nome);
const erros = [];

for (const c of LOTE) {
    const d = um(npcs, c.nome);
    if (d.length !== 1) { erros.push(`"${c.nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    c.ref = d[0].ref;
    c.vit = n.valoresDer?.VIT ?? null;
    c.acertoBase = Math.max(Number(n.atributos?.FOR) || 0, Number(n.atributos?.DES) || 0);
    c.antes = String(n.ataques || '').split('\n')[0];
    c.ameacaAntes = n.criatura?.nivelAmeaca || '(vazio)';
    Object.assign(c, forca(c.alvo, c.dado, c.bonus));
    c.grau = grauDe(c.x);
    c.desvio = Math.abs(c.x - c.alvoX) / c.alvoX;
    c.ameaca = `${c.grau} · ${c.x.toFixed(2).replace('.', ',')}× · ${c.densidade} · ${c.cauda}`;
    if (c.desvio > 0.15) erros.push(`${c.nome}: força ${c.x.toFixed(2)}× está a ${(c.desvio * 100).toFixed(0)}% do alvo ${c.alvoX}× (teto 15%)`);
    if (c.alvo > c.acertoBase + 5) erros.push(`${c.nome}: Alvo ${c.alvo} exigiria perícia ${c.alvo - c.acertoBase} — acima do plausível`);
}

/* ── geografia ── */
const TIRIC = 'Sereni — passa dias seguidos na cabana de pesca da Borda de Silmarela';
const SELITH = 'Cabana de Tiric, na Borda de Silmarela — recolhe-se à Floresta de Silmarela quando ele volta da vila';
const BORDA_DESC = 'Beira d\'água do Vale de Silmarela. Tiric, o pescador de Sereni, mantém aqui uma cabana e '
    + 'passa dias seguidos na borda antes de voltar à vila. Selith, a druida élorin, usa a cabana enquanto '
    + 'ele está fora; quando ele volta, ela se recolhe à Floresta de Silmarela. Os dois se revezam sem nunca '
    + 'combinar nada.\n\n[LACUNA] Que corpo d\'água é este — rio, lago ou braço — ainda não está definido.';

const tiric = um(npcs, 'Tiric')[0], selith = um(npcs, 'Selith')[0], borda = um(geo, 'Borda de Silmarela')[0];
if (!tiric) erros.push('Tiric não achado');
if (!selith) erros.push('Selith não achada');
if (!borda) erros.push('Borda de Silmarela não achada');

/* ── relatório ── */
console.log('\n=== v3 · LOTE 1 — as quatro com força-alvo declarada ===\n');
console.log('nome         Alvo  dado    P     líq    DPR    força    alvo   desvio  grau      Vit    rodadas');
for (const c of LOTE) {
    if (!c.ref) continue;
    console.log(`${c.nome.padEnd(12)} ${String(c.alvo).padStart(3)}  ${(c.dado + '+' + c.bonus).padEnd(7)} ${c.P.toFixed(2)}  ${c.liq.toFixed(1).padStart(5)}  ${c.dpr.toFixed(2).padStart(5)}  ${c.x.toFixed(2)}×  ${c.alvoX.toFixed(2)}×  ${(c.desvio * 100).toFixed(0).padStart(4)}%  ${c.grau.padEnd(9)} ${String(c.vit).padStart(5)}  ${(Number(c.vit) / U).toFixed(1)}`);
}
console.log('\nO Alvo vem de (FOR max DES) + perícia da arma natural:');
for (const c of LOTE) if (c.ref) console.log(`   ${c.nome.padEnd(12)} base ${c.acertoBase} + perícia ${c.alvo - c.acertoBase} = Alvo ${c.alvo}`);
console.log('\nAtaques:');
for (const c of LOTE) if (c.ref) {
    console.log(`\n   ${c.nome}`);
    console.log(`      de:   ${c.antes}`);
    for (const l of c.ataques.split('\n')) console.log(`      para: ${l}`);
}
console.log('\nNível de Ameaça, no formato novo:');
for (const c of LOTE) if (c.ref) {
    console.log(`\n   ${c.nome}`);
    console.log(`      de:   ${c.ameacaAntes}`);
    console.log(`      para: ${c.ameaca}`);
}
console.log('\n\n=== Geografia ===');
console.log(`   Tiric  · local: "${tiric?.data().local}"\n                 → "${TIRIC}"`);
console.log(`   Selith · local: "${selith?.data().local}"\n                 → "${SELITH}"`);
console.log(`   Borda de Silmarela · descrição sai do [LACUNA] (o corpo d'água segue em aberto)`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const c of LOTE) batch.update(c.ref, {
    ataques: c.ataques, 'criatura.nivelAmeaca': c.ameaca, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(tiric.ref, { local: TIRIC, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(selith.ref, { local: SELITH, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(borda.ref, { descricao: BORDA_DESC, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${LOTE.length} fichas traduzidas para v3 · Tiric, Selith e a Borda de Silmarela atualizados.`);
process.exit(0);
