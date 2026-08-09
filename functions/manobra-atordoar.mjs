/**
 * `Atordoar` (Manobras, Guerreiro/Ladino) — a manobra mais desbalanceada do
 * catálogo, e estava escondida porque não nomeava a condição.
 *
 * Texto atual: "Se acertar, a cada Grau de Sucesso o alvo perde 1 turno + 1d4
 * turnos." Com 3 Graus médios isso são 5,5 a 10,5 turnos perdidos — a frase é
 * ambígua e as duas leituras estouram. Um combate dura 5 rodadas. Por 1 Energia,
 * sem Chance e sem teste de resistência, a manobra remove um alvo do combate.
 *
 * A conta (1 unidade = 3,445 = uma rodada de guerreiro):
 *
 *   Atordoado, 1 turno   = 1,32   → 1,32× em custo 1   ✅ dentro da faixa 1,00–1,70
 *   Atordoado, 2 turnos  = 2,64   → 2,64×              ❌
 *   Atordoado, 5 turnos  = 6,60   → 6,60×              ❌ é remoção, não controle
 *
 * A escalada por Graus sai. Ela é o que transformava um acerto bom em remoção —
 * e Graus já servem para algo: derrubam o Alvo de defesa do alvo (§6.4). A
 * manobra continua premiando quem acerta bem, só não duas vezes.
 *
 *   node functions/manobra-atordoar.mjs            (dry-run)
 *   node functions/manobra-atordoar.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = 'Se acertar, a cada Grau de Sucesso o alvo perde 1 turno + 1d4 turnos.';
const PARA = 'Se acertar, o alvo fica Atordoado por 1 turno.';

/* ═══ ASSERTS — a régua, reproduzida ═══ */
const ATORDOADO = 1.32;              // 1,00 turno roubado + 0,32 sem Reação
const CUSTO = 1;
assert.ok(ATORDOADO / CUSTO >= 1.00, 'a versão nova tem que passar a regra de 1:1');
assert.ok(ATORDOADO / CUSTO <= 1.70, 'e não pode estourar a faixa');
assert.ok(3 * (1 + 2.5) * ATORDOADO / CUSTO > 6, 'a versão antiga estourava em mais de 6×');
assert.ok(PARA.includes('Atordoado'), 'o texto novo tem que NOMEAR a condição, não descrevê-la');
assert.ok(!/grau/i.test(PARA), 'sem escalada por Graus — eles já derrubam o Alvo de defesa');
console.log(`✅ 5 asserts passaram.\n`);

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
        if (it.nome !== 'Atordoar') return it;
        const atual = String(it.valores?.[kE] ?? '').trim();
        if (atual !== DE) { erros.push(`texto inesperado em "${m.titulo}": ${atual}`); return it; }
        mexeu = true;
        plano.push({ modulo: m.titulo, id: m.id });
        return { ...it, descricao: PARA, valores: { ...it.valores, [kE]: PARA } };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Atordoar ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log(`  ~6,60× → 1,32×  (custo 1 Energia, inalterado)`);
console.log(`  módulos afetados: ${plano.map(p => p.modulo).join(', ') || '—'}`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: manobra não encontrada.'); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
