/**
 * NANA DO ENTORPECIMENTO (Bardo, Custo 2 — Desenvolvimento) — 0,25×.
 *
 * Texto: "1 alvo a 6m testa AUT vs GS. Falha: Lento (½ Deslocamento, -2 Iniciativa)."
 *
 * O problema não é a magia estar mal escrita — é Lento ser barato demais para
 * carregar sozinho um Custo 2:
 *
 *   Lento .......... 0,10 por rodada × 5 (cena) = 0,50   → 0,25× em custo 2
 *
 * Os eixos disponíveis, medidos:
 *   só alvos:     3 inimigos → 1,50 → 0,75×   ainda reprova
 *   só duração:   já está no teto da cena
 *   magnitude:    Lento não tem magnitude, é binária
 *
 * Sobra somar uma segunda condição. "Entorpecimento" é adormecer os sentidos,
 * não só as pernas — e **Ofuscado** (Desvantagem em ataques e defesas) é
 * exatamente isso em regra, sem inventar condição nova:
 *
 *   Lento 0,10 + Ofuscado 0,37 = 0,47 por rodada × 5 = 2,35  → 1,18×  ✅
 *
 * Alvo único mantido de propósito: com os dois em área a magia iria a 3,53×.
 *
 *   node functions/bardo-nana.mjs            (dry-run)
 *   node functions/bardo-nana.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = '1 alvo a 6m testa AUT vs GS. Falha: Lento (½ Deslocamento, -2 Iniciativa).';
const PARA = '1 alvo a 6m testa AUT vs GS. Falha: Lento e Ofuscado por 1 cena.';

/* ═══ ASSERTS — valores vindos da tabela de condições ═══ */
const LENTO = 0.10, OFUSCADO = 0.37, RODADAS = 5, CUSTO = 2;
const antes = LENTO * RODADAS, depois = (LENTO + OFUSCADO) * RODADAS;
assert.ok(antes / CUSTO < 1.00, `antes reprova (${(antes / CUSTO).toFixed(2)}×)`);
assert.ok(depois / CUSTO >= 1.00, `depois passa (${(depois / CUSTO).toFixed(2)}×)`);
assert.ok(depois / CUSTO <= 1.70, 'sem estourar a faixa');
assert.ok((LENTO + OFUSCADO) * RODADAS * 3 / CUSTO > 3, 'em área iria a 3,5× — por isso alvo único');
assert.ok(!/\(½|Iniciativa/.test(PARA), 'a condição é nomeada, não redescrita — o card dela já diz o efeito');
assert.ok(/testa AUT vs GS/.test(PARA), 'o portão de resistência é mantido: sem Chance por cima');
console.log(`✅ 6 asserts passaram.  ${antes.toFixed(2)} → ${depois.toFixed(2)} un · ${(antes / CUSTO).toFixed(2)}× → ${(depois / CUSTO).toFixed(2)}×\n`);

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
        if (!/NANA DO ENTORPECIMENTO/i.test(it.nome || '')) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== DE) { erros.push(`texto inesperado: ${atual}`); return it; }
        mexeu = true; plano.push(m.titulo);
        return {
            ...it, valores: { ...it.valores, [kE]: PARA }, descricao: PARA,
            condicoesAplicadas: [
                { condicao: 'Lento', portao: 'resistencia', chance: null },
                { condicao: 'Ofuscado', portao: 'resistencia', chance: null },
            ],
            alvosMax: 1, formaArea: 'nenhuma', tamanhoArea: null, alcance: 6,
            duracaoValor: 1, duracaoUnidade: 'cena',
        };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== NANA DO ENTORPECIMENTO ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log(`  0,25× → ${(depois / CUSTO).toFixed(2)}×   (Custo 2, alvo único, portão de resistência — tudo inalterado)`);
console.log(`  soma Ofuscado ao Lento; a redescrição do Lento sai (o card da condição já diz)`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: não encontrada.'); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
