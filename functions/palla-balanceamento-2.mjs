/**
 * Pallacerdote — as duas que a condicionalidade derrubou.
 *
 * O fator de condicionalidade (Régua §1.x) desconta bônus que só valem numa
 * fatia dos testes: 0,25 para um atributo específico, 0,30 para um tipo de
 * inimigo. As duas foram calibradas antes dele existir e voltaram para baixo.
 *
 * ═══ Luz Revigorante I — 0,42× ═══
 *   hoje:  +2 no Alvo de VIG/AUT · 5 rodadas · 1 alvo · fator 0,25
 *          2 × 0,170 × 5 × 1 × 0,25 = 0,42
 *   Subir a magnitude não resolve: precisaria de +5. O eixo com folga é ALVOS —
 *   e "Revigorante" é bênção de grupo, não de um.
 *   novo:  mesmos +2, mas em aliados a 6m (×4) → 1,70 → 1,70×
 *
 * ═══ Luz do Expurgo I — 0,61× ═══
 *   hoje:  +1 contra Necrótico/Abissal · 3 rodadas (Graus) · 4 aliados · 0,30
 *          1 × 0,170 × 3 × 4 × 0,30 = 0,61
 *   Aqui os alvos já estão largos e a duração é a mecânica bonita da magia
 *   (Graus de Sucesso = turnos). Sobra magnitude: +1 → +2 → 1,22×.
 *
 * As duas mudam um número só cada, e nenhuma perde o que a caracteriza.
 *
 *   node functions/palla-balanceamento-2.mjs            (dry-run)
 *   node functions/palla-balanceamento-2.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const T = 0.585 / 3.445;                  // ±1 no Alvo, por rodada
const AJUSTES = {
    'Luz Revigorante I': {
        de: 'Alvo ganha +2 no Alvo de testes de VIG/AUT por 1 cena.',
        para: 'Aliados a 6m ganham +2 no Alvo de testes de VIG/AUT por 1 cena.',
        antes: 2 * T * 5 * 1 * 0.25, depois: 2 * T * 5 * 4 * 0.25, custo: 1,
        eixo: 'alvos 1 → 4 (grupo)',
    },
    'Luz do Expurgo I': {
        de: 'Aliados num raio de 3m ganham +1 no Alvo contra Necrótico/Abissal. Graus de Sucesso = turnos com o bônus.',
        para: 'Aliados num raio de 3m ganham +2 no Alvo contra Necrótico/Abissal. Graus de Sucesso = turnos com o bônus.',
        antes: 1 * T * 3 * 4 * 0.30, depois: 2 * T * 3 * 4 * 0.30, custo: 1,
        eixo: 'magnitude +1 → +2',
    },
};

/* ═══ ASSERTS ═══ */
for (const [nome, a] of Object.entries(AJUSTES)) {
    assert.ok(a.antes / a.custo < 1.00, `${nome}: tem que estar reprovada antes`);
    assert.ok(a.depois / a.custo >= 1.00, `${nome}: precisa fechar em ≥1,00 (deu ${(a.depois / a.custo).toFixed(2)})`);
    assert.ok(a.depois / a.custo <= 1.70, `${nome}: não pode estourar (deu ${(a.depois / a.custo).toFixed(2)})`);
    assert.notEqual(a.de, a.para, `${nome}: texto tem que mudar`);
    assert.ok(!/sem gastar ação/i.test(a.para), `${nome}: nenhuma habilidade é isenta de Ação (§0.5)`);
}
console.log(`✅ ${Object.keys(AJUSTES).length * 5} asserts passaram.\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [], plano = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find(k => /efeito/i.test(lbl[k]));
    if (!kE) continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const a = AJUSTES[it.nome];
        if (!a) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== a.de) { erros.push(`"${it.nome}"\n        banco:    ${atual}\n        esperado: ${a.de}`); return it; }
        mexeu = true; plano.push({ nome: it.nome, modulo: m.titulo, ...a });
        return { ...it, valores: { ...it.valores, [kE]: a.para }, descricao: a.para };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Pallacerdote: as duas da condicionalidade ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}   ${(p.antes / p.custo).toFixed(2)}× → ${(p.depois / p.custo).toFixed(2)}×   [${p.eixo}]`);
    console.log(`     de:   ${p.de}`);
    console.log(`     para: ${p.para}\n`);
}
if (erros.length) { console.error('🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 2) { console.error(`🔴 ABORTADO: ${plano.length}/2 achadas.`); process.exit(1); }
console.log('  Custo e teste intocados.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
