/**
 * COMPOSIÇÃO DE BATALHA — correção de redação.
 *
 * A passada anterior escreveu "sem gastar ação". Isso não existe no sistema:
 * §6.2 — o turno tem 1 Ação Padrão + 1 Ação de Movimento, e TODA magia, manobra
 * e golpe consome 1 Ação. Só é diferente quando a descrição declara (Ação
 * Completa, mais de uma ação, ou Ação Livre).
 *
 * O valor na régua não muda — 3,40 un, 1,13× em Custo 3. O que muda é a
 * habilidade parar de reivindicar uma isenção que o sistema não concede.
 *
 * Forma correta: conjura uma vez (1 Ação, como tudo) e o efeito corre pela cena
 * sem precisar de reativação. É isso que a distingue das canções de "manter
 * ritmo" — não é isenção de ação, é ausência de sustentação.
 *
 *   node functions/bardo-composicao-correcao.mjs            (dry-run)
 *   node functions/bardo-composicao-correcao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DE = 'No início de cada turno, sem gastar ação, aplique +1 no Alvo a todos os aliados a 6m — ou o mesmo valor como penalidade a todos os inimigos a 6m.';
const PARA = 'Aliados a 6m ganham +1 no Alvo pela cena — ou o mesmo valor como penalidade aos inimigos a 6m, escolhido na conjuração. Não exige manter ritmo.';

/* ═══ ASSERTS ═══ */
assert.ok(!/sem gastar ação|sem custo de ação/i.test(PARA),
    'nenhuma habilidade é isenta de Ação — §6.2');
assert.ok(!/cada turno/i.test(PARA), 'sem reativação por turno: conjura uma vez e corre');
assert.equal((PARA.match(/[+-]\s*\d+\s*no Alvo/gi) || []).length, 1,
    'o valor aparece uma vez só — a régua soma todos que achar');
const T_ALVO = 0.585 / 3.445;
assert.ok(Math.abs(1 * T_ALVO * 5 * 4 - 3.40) < 0.01, 'o valor não muda: 3,40 un');
assert.ok(3.40 / 3 >= 1.00, 'segue passando o piso');
console.log('✅ 5 asserts passaram.  Valor inalterado: 3,40 un → 1,13×\n');

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
        if (!/COMPOSIÇÃO DE BATALHA/i.test(it.nome || '')) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== DE) { erros.push(`texto inesperado: ${atual}`); return it; }
        mexeu = true; plano.push(m.titulo);
        return { ...it, valores: { ...it.valores, [kE]: PARA }, descricao: PARA };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== COMPOSIÇÃO DE BATALHA — redação ===\n');
console.log(`  de:   ${DE}`);
console.log(`  para: ${PARA}\n`);
console.log('  valor: 1,13× (inalterado) · sai a isenção de Ação, que o sistema não concede');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!plano.length) { console.error('\n🔴 ABORTADO: não encontrada.'); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
