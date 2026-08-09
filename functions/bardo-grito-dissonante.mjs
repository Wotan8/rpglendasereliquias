/**
 * GRITO DISSONANTE (Bardo, Custo 1 — Abertura) — segunda passada.
 *
 * A primeira tirou o Atordoado e dobrou o debuff (4,98× → 1,02×). O dono do
 * sistema pediu o inverso: só o Atordoado. A régua concorda, com uma condição.
 *
 *   Atordoado, 1 alvo ......................... 1,32  → 1,32×  ✅
 *   Atordoado, 3 alvos, Chance 5 (o piso) ..... 1,98  → 1,98×
 *   Atordoado, 3 alvos, teste de resistência .. 3,96  → 3,96×  ❌
 *
 * Resultado limpo: ATORDOADO EM ÁREA NÃO CABE EM CUSTO 1 por construção. Para
 * 3 alvos fecharem em 1,00 seria preciso Chance 2,5, e o piso é 5 (Régua §6.10).
 * As duas regras se travam sozinhas.
 *
 * Então: alvo único, sem portão. 1,32× — dentro da faixa 1,00–1,70.
 *
 * Some junto o multi-componente que atrapalhava a medição: agora a habilidade
 * faz uma coisa só, e a régua consegue conferir sem ambiguidade de alvos.
 *
 *   node functions/bardo-grito-dissonante.mjs            (dry-run)
 *   node functions/bardo-grito-dissonante.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = 'Inimigos a 6m sofrem -2 no Alvo até o fim do próximo turno.';
const PARA = 'Um inimigo a 6m fica Atordoado por 1 turno.';

/* ═══ ASSERTS ═══ */
const T_ALVO = 0.585 / 3.445, ATORDOADO = 1.32, PISO_CHANCE = 5, CUSTO = 1;
const antes = 2 * T_ALVO * 1 * 3;              // -2 no Alvo, 1 rodada, 3 alvos
const depois = ATORDOADO;                       // 1 alvo, sem portão
assert.ok(Math.abs(antes - 1.02) < 0.01, 'a versão anterior valia 1,02');
assert.ok(depois / CUSTO >= 1.00, `passa o piso de 1:1 (${(depois / CUSTO).toFixed(2)}×)`);
assert.ok(depois / CUSTO <= 1.70, 'e não estoura a faixa');
/* A prova de que a área não cabe: a Chance necessária fica abaixo do piso. */
const chanceNecessaria = (CUSTO / (ATORDOADO * 3)) * 10;
assert.ok(chanceNecessaria < PISO_CHANCE,
    `Atordoado em 3 alvos precisaria de Chance ${chanceNecessaria.toFixed(1)}, abaixo do piso ${PISO_CHANCE}`);
assert.ok(/Atordoado/.test(PARA), 'tem que NOMEAR a condição, não descrevê-la');
assert.ok(!/inimigos/i.test(PARA), 'singular: em área o custo não fecha');
console.log(`✅ 6 asserts passaram.  ${antes.toFixed(2)} → ${depois.toFixed(2)} unidades`);
console.log(`   (Atordoado em 3 alvos exigiria Chance ${chanceNecessaria.toFixed(1)} — o piso é ${PISO_CHANCE})\n`);

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
        if (!/GRITO DISSONANTE/i.test(it.nome || '')) return it;
        const atual = String(it.valores?.[kE] ?? '').trim();
        if (atual.replace(/\s+/g, ' ') !== DE) { erros.push(`texto inesperado: ${atual}`); return it; }
        mexeu = true;
        plano.push(m.titulo);
        return {
            ...it, valores: { ...it.valores, [kE]: PARA }, descricao: PARA,
            /* volta ao campo tipado, agora com portão e alvo explícitos */
            condicoesAplicadas: [{ condicao: 'Atordoado', portao: 'chance', chance: 10 }],
            alvosMax: 1, formaArea: 'nenhuma', tamanhoArea: null, alcance: 6,
            duracaoValor: 1, duracaoUnidade: 'turno',
        };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== GRITO DISSONANTE ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log(`  1,02× → ${(depois / CUSTO).toFixed(2)}×   (Custo 1, inalterado)`);
console.log(`  campos: alvosMax 1 · alcance 6 · duração 1 turno · Atordoado(C10)`);
console.log(`  módulo: ${plano.join(', ') || '—'}`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: canção não encontrada.'); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
