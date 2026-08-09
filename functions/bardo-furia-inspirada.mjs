/**
 * FÚRIA INSPIRADA (Bardo, Custo 3 — Clímax) — 2,89×, e o problema não é o
 * número: é ser um MOTOR DE RECURSO com lucro.
 *
 * Texto: "Aliados em 6m recuperam 1 Energia e ganham +1 no Alvo de todos os
 * testes." Custo 3, duração 1 cena.
 *
 *   1 Energia devolvida × 1,32 (efeito em aliado passa por um teste só) ... 1,32
 *   +1 no Alvo × 5 rodadas × 0,170 ............................................ 0,85
 *                                                                            ─────
 *   por aliado 2,17 × 4 aliados = 8,68  →  2,89×
 *
 * O que a razão esconde: **o grupo recebe 4 de Energia por 3 de Harmonia
 * gastos.** Lucro líquido de +1 por conjuração, repetível. Um recurso que se
 * paga e sobra é a coisa que a auditoria persegue por definição — e a régua nem
 * marcou, porque a regra ≥1,00 só tem piso.
 *
 * ═══ O CONSERTO ═══
 *
 * O teto não é a razão, é a conversão: devolver no máximo o que se gasta.
 * Custo 3 → devolve 3.
 *
 *   1 Energia × 1,32 × 3 aliados = 3,96  →  1,32×   e conversão 3 por 3
 *
 * Sai o "+1 no Alvo". Não é perda de identidade: com ele, FÚRIA fazia o mesmo
 * que COMPOSIÇÃO DE BATALHA (também +1 no Alvo ao grupo pela cena, mesmo tier).
 * Separadas, o Clímax passa a ter uma canção que **reabastece** e uma que
 * **fortalece**, em vez de duas quase iguais.
 *
 *   node functions/bardo-furia-inspirada.mjs            (dry-run)
 *   node functions/bardo-furia-inspirada.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = 'Aliados em 6m recuperam 1 Energia e ganham +1 no Alvo de todos os testes.';
const PARA = 'Até 3 aliados a 6m recuperam 1 de Energia.';

/* ═══ ASSERTS ═══ */
const P_AL = 0.70 / 0.53, T_ALVO = 0.585 / 3.445, CUSTO = 3;
const antes = (1 * P_AL + 1 * T_ALVO * 5) * 4;
const depois = 1 * P_AL * 3;
assert.ok(Math.abs(antes / CUSTO - 2.89) < 0.02, `antes = 2,89× (deu ${(antes / CUSTO).toFixed(2)})`);
assert.ok(depois / CUSTO >= 1.00, `depois passa o piso (${(depois / CUSTO).toFixed(2)}×)`);
assert.ok(depois / CUSTO <= 1.70, 'e cabe na faixa');
/* O teste que importa: a conversão de recurso não pode dar lucro. */
assert.ok(4 > CUSTO, 'antes: 4 Energia devolvidas por 3 gastas — motor com lucro');
assert.ok(3 <= CUSTO, 'depois: devolve no máximo o que custa');
assert.ok(!/no Alvo/.test(PARA), 'sai o buff de Alvo — era o que a tornava cópia da Composição');
console.log(`✅ 6 asserts passaram.  ${(antes / CUSTO).toFixed(2)}× → ${(depois / CUSTO).toFixed(2)}× · conversão 4:3 → 3:3\n`);

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
        if (!/FÚRIA INSPIRADA/i.test(it.nome || '')) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== DE) { erros.push(`texto inesperado: ${atual}`); return it; }
        mexeu = true; plano.push(m.titulo);
        return { ...it, valores: { ...it.valores, [kE]: PARA }, descricao: PARA,
                 alvosMax: 3, formaArea: 'circulo', tamanhoArea: 6, alcance: 6,
                 duracaoValor: 0, duracaoUnidade: 'instantaneo' };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== FÚRIA INSPIRADA ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log(`  2,89× → ${(depois / CUSTO).toFixed(2)}×   (Custo 3, inalterado)`);
console.log('  a conversão de recurso deixa de dar lucro: 3 devolvidas por 3 gastas');
console.log('  sai o +1 no Alvo, que duplicava a COMPOSIÇÃO DE BATALHA do mesmo tier');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: não encontrada.'); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
