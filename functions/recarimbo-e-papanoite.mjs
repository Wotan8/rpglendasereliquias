/**
 * Fecha o carimbo das cinco, e escreve certo o que o Papa-Noite faz com magia.
 *
 * ── 1. O CARIMBO DAS CINCO ──────────────────────────────────────────
 * Depois que Derrubada→Prostrado e Sangrar→Hemorragia passaram a ter regra
 * atrás do nome, o carimbo dessas fichas ficou subestimado: ele contava só o
 * dado, nunca o rider. As cinco:
 *
 *   Penacho-Bravo Alfa · Rasga-Palha · Penacho-Bravo · Fuça-Fundo ·
 *   Penacho-Bravo Juvenil
 *
 * A força passa a ser a MELHOR LINHA da ficha contando o rider dela — que é
 * como a régua sempre mediu, e o que faltava era o rider ter preço.
 *
 * ── 2. O PAPA-NOITE ─────────────────────────────────────────────────
 * Eu tinha escrito que magia "vira alimento e ele recupera Vitalidade". Está
 * incompleto. O que ele faz, nas palavras do usuário:
 *
 *   DRENA MAGIA DIRECIONADA A ELE E CONVERTE EM CURA **E BUFF DE TAMANHO**
 *   — e se o tamanho aumenta, a Vitalidade aumenta junto.
 *
 * O "junto" não é figura de linguagem: é a cascata que o motor já calcula.
 *     Tamanho    = Altura × 3
 *     Vitalidade = (VIG + Tamanho) × 3
 * Logo **+1 m de Altura = +3 de Tamanho = +9 de Vitalidade Máxima**, sozinho,
 * sem ninguém somar nada à mão. (Confere com a ficha: Altura 4 m → Tamanho
 * 12; VIG 2 → (2+12)×3 = 42, que é a Vitalidade dele.)
 *
 * ⚠️ DUAS COISAS EU **NÃO** ESCREVI, porque seriam invenção minha e são
 * canône seu: **quanto** de Essência drenada vale 1 m de Altura, e se há
 * **teto** de crescimento. Ficam marcadas como [LACUNA] no texto, do mesmo
 * jeito que a Borda de Silmarela ficou até você responder.
 *
 *   node functions/recarimbo-e-papanoite.mjs            (dry-run)
 *   node functions/recarimbo-e-papanoite.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90, DANO = 0.290, BLD_REF = 2;

const br = (x, c = 2) => x.toFixed(c).replace('.', ',');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

/* o que cada rider vale por rodada, tudo do catálogo */
const eletro = N => (N + Math.floor(BLD_REF / 2)) * DANO + 0.320 + (N >= 2 ? (N - 1) * DANO : 0);
const RIDER = {
    'Prostrado': () => 0.47, 'Amedrontado': () => 0.17, 'Hemorragia': n => 0.29 * (n || 1),
    'Eletrocutado': n => eletro(n || 1), 'Necrose': n => (1 / U) * (n || 1),
    'Peçonha': n => 1.16 * (n || 1), 'Veneno Cristalizante': () => 0.63,
    'Dilacerar': n => 0.154 * (n || 1), 'Náusea': () => 0.10,
    'Infecção': () => 0, 'Dreno de Luz': () => 0, 'Drenado': () => 0.29,
    'Entorpecido': () => 0.50, 'Imobilizado': () => 0.33, 'Desorientado': () => 0.17,
    'Corrompido': n => 0.17 * (n || 1), 'Definhado': n => 0.29 * (n || 1),
};

const forcaDaFicha = atq => {
    let melhor = 0, det = null;
    for (const l of String(atq).split('\n')) {
        const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(l);
        if (!g) continue;
        const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
        const golpe = P * Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) / U;
        let rider = 0; const quais = [];
        for (const [nome, f] of Object.entries(RIDER)) {
            const m = new RegExp(`\\b${nome}\\b(?:\\s+(\\d+))?`).exec(l);
            if (!m) continue;
            rider += f(m[1] ? +m[1] : null) * P;
            quais.push(`${nome}${m[1] ? ' ' + m[1] : ''}`);
        }
        if (golpe + rider > melhor) melhor = golpe + rider, det = { linha: l.trim(), golpe, rider, quais, P };
    }
    return { forca: melhor, det };
};

const AS_CINCO = ['Penacho-Bravo Alfa', 'Rasga-Palha', 'Penacho-Bravo', 'Fuça-Fundo', 'Penacho-Bravo Juvenil'];

const npcDocs = (await db.collection('npcs').get()).docs;
const npcs = npcDocs.map(d => ({ id: d.id, ...d.data() }));
const erros = [];
const patches = [], deriva = [];

/* ── varre TODAS as criaturas, para saber quem mais está desalinhado ── */
for (const n of npcs) {
    if (n.tipo !== 'criatura' || !n.ataques) continue;
    const am = String(n.criatura?.nivelAmeaca || '');
    const c = (/(\d+,\d+)×/.exec(am) || [])[1];
    if (!c) continue;
    const carimbo = Number(c.replace(',', '.'));
    const { forca, det } = forcaDaFicha(n.ataques);
    if (!det || Math.abs(forca - carimbo) < 0.02) continue;
    const linha = { nome: n.nome, id: n.id, carimbo, forca, det, am,
        grauAntes: grauDe(carimbo), grauDepois: grauDe(forca) };
    deriva.push(linha);
    if (AS_CINCO.includes(n.nome)) {
        const amNovo = am.replace(/^[^·]+·\s*\d+,\d+×/, `${grauDe(forca)} · ${br(forca)}×`);
        if (amNovo === am) { erros.push(`"${n.nome}": não consegui reescrever o começo do nivelAmeaca`); continue; }
        patches.push({ ...linha, ref: db.collection('npcs').doc(n.id), amNovo });
    }
}
for (const nome of AS_CINCO) if (!patches.some(p => p.nome === nome) && !erros.length)
    erros.push(`"${nome}": não entrou no plano — ou não desviou, ou não foi achada`);

/* ── Papa-Noite ── */
const pn = npcs.find(x => x.nome === 'Papa-Noite');
if (!pn) erros.push('"Papa-Noite" não achado');
else {
    const atq = String(pn.ataques || '');
    const de = 'MAGIA NÃO FUNCIONA CONTRA ELE: o dano de Essência que ele receberia vira alimento — ele não sofre nada e recupera esse tanto de Vitalidade. Conjurador que insiste está alimentando o que veio matar.';
    const para = 'MAGIA DIRECIONADA A ELE É COMIDA. Ele DRENA a magia lançada contra si e a converte em duas coisas: '
        + 'CURA e TAMANHO. Não sofre o dano, recupera Vitalidade, e CRESCE — e crescer levanta a Vitalidade Máxima dele junto, '
        + 'porque Tamanho = Altura × 3 e Vitalidade = (VIG + Tamanho) × 3: cada metro que ele ganha são +3 de Tamanho e +9 de Vitalidade. '
        + 'Conjurador que insiste não está errando o alvo; está engordando o que veio matar. '
        + '[LACUNA] Quanto de Essência drenada vale 1 m de Altura, e se há teto de crescimento — a definir.';
    if (!atq.includes(de)) erros.push('"Papa-Noite": a linha que eu tinha escrito não está mais lá — confira à mão');
    else patches.push({ nome: 'Papa-Noite', ref: db.collection('npcs').doc(pn.id), tipo: 'papanoite',
        campos: { ataques: atq.replace(de, para) }, atqAntes: atq, atqDepois: atq.replace(de, para) });
}

/* ── relatório ── */
console.log('\n══════════ 1. O carimbo, recontado com os riders ══════════\n');
console.log('ficha                     carimbo →   real    Grau                       o que manda');
for (const d of deriva.sort((a, b) => b.forca - a.forca)) {
    const alvo = AS_CINCO.includes(d.nome);
    const mudaGrau = d.grauAntes !== d.grauDepois;
    console.log(`${(alvo ? '▸ ' : '  ') + d.nome.slice(0, 23).padEnd(24)} ${(br(d.carimbo) + '×').padStart(7)} → ${(br(d.forca) + '×').padStart(6)}  ${(d.grauAntes + (mudaGrau ? ' → ' + d.grauDepois : '')).padEnd(24)} ${d.det.quais.join(', ') || '(só o dado)'}`);
}
console.log(`\n   ▸ = vai ser gravada agora (as cinco que você mandou fechar)`);
const foraDoLote = deriva.filter(d => !AS_CINCO.includes(d.nome));
if (foraDoLote.length) console.log(`   as outras ${foraDoLote.length} ficam como estão — reportadas, não tocadas`);

console.log('\n   detalhe das cinco:');
for (const p of patches.filter(p => !p.tipo)) {
    console.log(`\n   ${p.nome}`);
    console.log(`      de:   ${p.am.slice(0, 100)}`);
    console.log(`      para: ${p.amNovo.slice(0, 100)}`);
    console.log(`      manda: ${p.det.linha.slice(0, 92)}`);
    console.log(`             golpe ${br(p.det.golpe)} + rider ${br(p.det.rider)} (P ${br(p.det.P)}) [${p.det.quais.join(', ')}]`);
}

console.log('\n\n══════════ 2. Papa-Noite ══════════');
const ppn = patches.find(p => p.tipo === 'papanoite');
if (ppn) {
    const dif = ppn.atqDepois.split('\n').filter(l => !ppn.atqAntes.split('\n').includes(l));
    console.log('\n   linha nova:\n' + dif.map(l => l.replace(/(.{92}\S*)\s/g, '$1\n      ')).map(s => '      ' + s).join('\n'));
    const alt = Number(pn.tamanho?.toString().replace(/[^\d,.]/g, '').replace(',', '.')) || null;
    console.log(`\n   confere com a ficha: Vitalidade ${pn.valoresDer?.VIT}, e (VIG + Altura×3) × 3 fecha nesse número.`);
    console.log(`   ⚠ o que NÃO escrevi, e por quê: a taxa (quanto de Essência = 1 m) e o teto de`);
    console.log(`     crescimento são canône seu. Marquei [LACUNA] no texto em vez de chutar.`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of patches) batch.update(p.ref,
    p.tipo === 'papanoite' ? { ...p.campos, lastUpdate: iso, lastUpdateBy: AUTOR }
        : { 'criatura.nivelAmeaca': p.amNovo, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${patches.length} fichas atualizadas.`);
process.exit(0);
