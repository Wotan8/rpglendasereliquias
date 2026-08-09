/**
 * Passo 2 do soquete mágico v2 — os 6 testes do Sangral ganham equação.
 *
 * O Sangral não tem foco: a habilidade é dele. Então onde os outros somam a
 * Qualidade do foco, ele soma uma SEGUNDA perícia — a do ofício da técnica.
 * A estrutura fica idêntica à dos outros magos, e o teto também (5+5+5):
 *
 *   atributo  +  Perícia: Hemomancia  +  Perícia: <técnica>
 *   ────────     ──────────────────      ─────────────────
 *   a técnica    saber a arte            o ofício (ocupa o lugar da Qualidade)
 *
 * O atributo sai da técnica, como o §6.3 já faz com arma ("quem decide o
 * atributo é a arma"). Nas perícias de dois atributos a escolha é do gesto:
 * Solidificar Arma empunha (FOR), Escudo Hemático aguenta (VIG), Empatia lê
 * (RAC), Transfusão tem mão fina (DES).
 *
 * ⚠ "Empatia Sanguínea" é nome de perícia E de valor derivado. O prefixo
 * "Perícia: " é obrigatório — sem ele o VD referencia a si mesmo em silêncio.
 *
 *   node functions/soquete-2-testes-sangral.mjs            (dry-run)
 *   node functions/soquete-2-testes-sangral.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* VD de teste → [atributo, perícia do ofício] */
const TESTES = {
    'Moldar Sangue':      ['DES', 'Manipulação de Sangue'],
    'Solidificar Arma':   ['FOR', 'Solidificação Hemática'],
    'Escudo Hemático':    ['VIG', 'Solidificação Hemática'],
    'Empatia Sanguínea':  ['RAC', 'Empatia Sanguínea'],
    'Transfusão':         ['DES', 'Sutura Hemática'],
    'Absorver Sangue':    ['VIG', 'Bolha'],
};
const ESCOLA = 'Hemomancia';
const montar = (attr, oficio) => ([
    { tipo: 'ficha', ref: attr },
    { op: '+', tipo: 'ficha', ref: `Perícia: ${ESCOLA}` },
    { op: '+', tipo: 'ficha', ref: `Perícia: ${oficio}` },
]);

/* ═══ ASSERTS ═══ */
const eqTeto = montar('FOR', 'Solidificação Hemática');
assert.equal(eqTeto.length, 3, 'três termos: atributo + escola + ofício');
assert.ok(eqTeto.slice(1).every(t => t.ref.startsWith('Perícia: ')),
    'toda perícia leva prefixo — sem ele o motor casa com o VD homônimo em silêncio');
assert.ok(new Set(eqTeto.map(t => t.ref)).size === 3, 'nenhum termo repetido: perícia não pode contar duas vezes');
/* Teto do Alvo: 5 + 5 + 5 = 15, igual ao mago com foco Q5 (atributo 5 + perícia 5 + Qualidade 5). */
const teto = eqTeto.reduce(s => s + 5, 0);
assert.equal(teto, 15, 'teto do Alvo do Sangral tem que empatar com o do mago com foco');
console.log('✅ 4 asserts passaram.\n');

/* ═══ GRAVAÇÃO ═══ */
const [vdSnap, skSnap] = await Promise.all([
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/skills').get(),
]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const nomesSk = new Set(skSnap.docs.map(d => d.data().nome));

const erros = [], plano = [];
if (!nomesSk.has(ESCOLA)) erros.push(`perícia de escola "${ESCOLA}" não existe`);
for (const [nomeVD, [attr, oficio]] of Object.entries(TESTES)) {
    if (!nomesSk.has(oficio)) { erros.push(`perícia "${oficio}" não existe`); continue; }
    const achados = vds.filter(v => v.nome === nomeVD);
    if (achados.length !== 1) { erros.push(`VD "${nomeVD}": ${achados.length} achados (esperado 1)`); continue; }
    if (achados[0].equacao?.length) { erros.push(`VD "${nomeVD}" JÁ TEM equação — não sobrescrevo`); continue; }
    plano.push({ id: achados[0].id, nome: nomeVD, equacao: montar(attr, oficio) });
}

console.log('=== Passo 2: testes do Sangral ===\n');
for (const p of plano) {
    console.log(`  ${p.nome.padEnd(20)} = ${p.equacao.map((t, i) => (i ? ' + ' : '') + `[${t.ref}]`).join('')}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 6) { console.error(`\n🔴 ABORTADO: ${plano.length} VDs no plano (esperado 6).`); process.exit(1); }
console.log(`\n  Teto do Alvo: 5 + 5 + 5 = 15 — mesmo do mago com foco Q5.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
const col = db.collection('system/data/derivedValues');
for (const p of plano) await col.doc(p.id).update({ equacao: p.equacao, updatedAt: Date.now() });
console.log(`\n✅ Gravado em ${plano.length} VDs.`);
process.exit(0);
