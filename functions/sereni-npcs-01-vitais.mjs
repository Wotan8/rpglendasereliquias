/**
 * NPCs de Sereni · passada 1 — os vitais. Nenhuma decisão de design aqui.
 *
 * O problema é o mesmo do bestiário: sem Altura, o VD Tamanho vale 0 e a
 * Vitalidade perde o seu maior termo. Aí alguém digita um número à mão, e o
 * número não tem fórmula nenhuma por trás — Bren Tor está com Vitalidade 0,
 * Darian Voss com 7, Burkan com 60 e Brym com 70, sem regra que ligue os quatro.
 *
 *  1. Lê a altura do campo `tamanho` (todos escrevem "1,80m", "1,92m — 105kg"…)
 *     e grava no override do VD Altura. Tamanho e Vitalidade passam a sair da
 *     fórmula: (VIG + Altura×3) × 3.
 *  2. Apaga o override de Vitalidade, senão o motor continua calado.
 *  3. Blindagem acima de 3,90 cai para 3. O teto é o arnês pesado completo de
 *     Grau 1 — Albrix está com 8, mais que placa inteira.
 *
 * NÃO toca em ataques, perícias nem atributos: isso é a passada 2, e é caso a caso.
 * NPC sem altura legível no campo é listado e PULADO, não chutado.
 *
 *   node functions/sereni-npcs-01-vitais.mjs            (dry-run)
 *   node functions/sereni-npcs-01-vitais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl', TAMANHO_VD = '173WnYtDJuLBjr8Yuyy4';
const BLD_TETO = 3.9, BLD_CORTE = 3;

/* "1,92m — 105kg" → 1.92 · "3m" → 3 · aceita só a faixa plausível de gente */
const alturaDe = (txt) => {
    const m = /(\d+[,.]\d+|\d+)\s*m\b/i.exec(String(txt || ''));
    if (!m) return null;
    const v = Number(m[1].replace(',', '.'));
    return v >= 0.3 && v <= 6 ? v : null;
};

const npcs = (await db.collection('npcs').get()).docs;
const alvos = npcs.filter(d => {
    const n = d.data();
    return /sereni/i.test(String(n.local || '')) && n.tipo !== 'criatura';
});

const plano = [], pulados = [];
for (const doc of alvos) {
    const n = doc.data();
    const alt = alturaDe(n.tamanho);
    const vd = n.valoresDer || {}, ov = vd.overrides || {};
    const vig = Number(n.atributos?.VIG) || 0;
    const bldAntes = Number(vd.BLD ?? ov[  'hV1UIhcVb4Ip7lgsqtLm'] ?? 0);
    const bldDepois = bldAntes > BLD_TETO ? BLD_CORTE : bldAntes;
    if (alt == null) { pulados.push({ nome: n.nome, tamanho: n.tamanho || '(vazio)', bldAntes, bldDepois }); continue; }
    plano.push({
        ref: doc.ref, doc: n, nome: n.nome, mesa: !!n.mesaId,
        alturaAntes: ov[ALTURA_VD] ?? null, altura: alt,
        tamanhoTravado: ov[TAMANHO_VD] ?? null,
        vig, vitAntes: Number(vd.VIT) || 0, vitDepois: (vig + alt * 3) * 3,
        bldAntes, bldDepois,
    });
}

/* ── relatório ── */
console.log(`\n=== NPCs de Sereni · vitais (${alvos.length} fichas) ===\n`);
console.log('nome                          VIG  altura   Vitalidade        Blindagem   nota');
for (const p of plano.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const notas = [];
    if (p.alturaAntes != null && p.alturaAntes !== p.altura) notas.push(`altura ${p.alturaAntes}→${p.altura}`);
    if (p.tamanhoTravado != null) notas.push(`Tamanho travado em ${p.tamanhoTravado} — sai`);
    if (p.bldAntes !== p.bldDepois) notas.push(`Blindagem acima do teto`);
    if (p.mesa) notas.push('de mesa');
    console.log(`${p.nome.slice(0, 28).padEnd(29)} ${String(p.vig).padStart(3)}  ${String(p.altura).padStart(5)} m  ${String(p.vitAntes).padStart(5)} → ${p.vitDepois.toFixed(1).padStart(5)}   ${String(p.bldAntes).padStart(3)} → ${String(p.bldDepois).padStart(3)}    ${notas.join(' · ')}`);
}
if (pulados.length) {
    console.log(`\nPULADOS — altura não legível no campo \`tamanho\` (${pulados.length}):`);
    for (const p of pulados) console.log(`   ${p.nome.padEnd(29)} tamanho="${p.tamanho}"${p.bldAntes !== p.bldDepois ? `  ⚠ Blindagem ${p.bldAntes} acima do teto` : ''}`);
}
const subiu = plano.filter(p => p.vitDepois > p.vitAntes).length;
const desceu = plano.filter(p => p.vitDepois < p.vitAntes).length;
console.log(`\n   ${plano.length} corrigidos · Vitalidade sobe em ${subiu}, desce em ${desceu}`);
console.log(`   Blindagem cortada em ${plano.filter(p => p.bldAntes !== p.bldDepois).length}`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
let batch = db.batch(), n = 0;
for (const p of plano) {
    const vd = p.doc.valoresDer || {};
    const ov = { ...(vd.overrides || {}), [ALTURA_VD]: p.altura };
    delete ov[TAMANHO_VD]; delete ov.VIT;
    batch.update(p.ref, {
        schemaVersion: 2, modoFicha: p.doc.modoFicha || 'mecanico',
        valoresDer: { ...vd, overrides: ov, atual: vd.atual || {}, extras: vd.extras || [],
            VIT: p.vitDepois, BLD: p.bldDepois },
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();
console.log(`\n✅ ${plano.length} fichas com Altura, Vitalidade calculada e Blindagem no teto.`);
process.exit(0);
