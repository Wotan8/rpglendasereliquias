/**
 * Custo 4 — Apoteose. Passada no tier inteiro.
 *
 * As quatro canções custam o mesmo e valem coisas muito diferentes:
 *
 *   RÉQUIEM ................. 5,25×
 *   LETARGIA TEMPORAL ....... 3,75×
 *   LAMENTO DA BANSHEE ...... 1,76×   (ajustada na passada anterior)
 *   MARCHA DO CATACLISMO .... 1,11×   (idem)
 *
 * Espalhamento de 4,7× dentro de um tier é o problema: o jogador que escolhe
 * MARCHA está pagando o mesmo por um quinto do efeito. A regra ≥1,00 não pega
 * isso — ela tem piso, não teto.
 *
 * ═══ Por que as duas grandes estouram ═══
 *
 * Orçamento de Custo 4 = 4,00 unidades. Em área (3 alvos), 1,33 por alvo.
 *
 * RÉQUIEM drena a Energia inteira: o pool é PRS + AUT ≈ 7, e 1 Energia vale
 * 1,00 unidade por definição da âncora. São 7,00 por alvo — cinco vezes o que
 * cabe. Drenar 2 mantém a canção mordendo (28% do pool, sem recuperar na cena)
 * dentro do orçamento.
 *   2 × 3 alvos = 6,00 → 1,50×
 *
 * LETARGIA rouba uma ação por turno pela cena: 1,00 × 5 rodadas = 5,00 por
 * alvo, quatro vezes o que cabe. Roubar ação é o efeito mais caro do sistema
 * (§1.1) e simplesmente não cabe em área neste tier. Fica em alvo único, com o
 * efeito INTEIRO preservado — é letargia total num inimigo, não meia letargia
 * em três.
 *   5,00 × 1 alvo = 5,00 → 1,25×
 *
 * Depois disso o tier fica entre 1,11× e 1,76×.
 *
 *   node functions/bardo-custo4.mjs            (dry-run)
 *   node functions/bardo-custo4.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const CUSTO = 4, ALVOS = 3, RODADAS = 5, POOL_ENERGIA = 7, ACAO = 1.00;

const AJUSTES = {
    'RÉQUIEM [V, C]': {
        de: 'Inimigos em 6m testam PRS + AUT vs GS. Falha: perdem toda a DET e não recuperam até o fim da cena.',
        para: 'Inimigos em 6m testam PRS + AUT vs GS. Falha: perdem 2 de Energia e não recuperam até o fim da cena.',
        antes: POOL_ENERGIA * ALVOS / CUSTO, depois: 2 * ALVOS / CUSTO,
        campos: {},
        nota: 'drena 2 em vez do pool inteiro; "DET" vira "Energia", que é o nome atual',
    },
    'LETARGIA TEMPORAL [P, C]': {
        de: 'Inimigos em 6m testam AUT vs GS. Falha: perdem 1 ação/turno e -3 de Iniciativa. Falha Crítica: inverte no Bardo.',
        para: '1 inimigo a 6m testa AUT vs GS. Falha: perde 1 ação/turno e -3 de Iniciativa por 1 cena. Falha Crítica: inverte no Bardo.',
        antes: ACAO * RODADAS * ALVOS / CUSTO, depois: ACAO * RODADAS * 1 / CUSTO,
        campos: { alvosMax: 1, formaArea: 'nenhuma', tamanhoArea: null },
        nota: 'de área para alvo único; o efeito fica inteiro',
    },
};

/* ═══ ASSERTS ═══ */
for (const [nome, a] of Object.entries(AJUSTES)) {
    assert.ok(a.antes > 3, `${nome}: tem que estar estourando antes (${a.antes.toFixed(2)}×)`);
    assert.ok(a.depois >= 1.00, `${nome}: precisa passar o piso (${a.depois.toFixed(2)}×)`);
    assert.ok(a.depois <= 1.80, `${nome}: e caber no tier, que agora vai até 1,76× (${a.depois.toFixed(2)}×)`);
}
/* O tier inteiro tem que fechar num intervalo estreito — é o ponto da passada. */
const tier = [1.11, 1.76, AJUSTES['RÉQUIEM [V, C]'].depois, AJUSTES['LETARGIA TEMPORAL [P, C]'].depois];
assert.ok(Math.max(...tier) / Math.min(...tier) < 1.7,
    `espalhamento do tier tem que cair abaixo de 1,7× (deu ${(Math.max(...tier) / Math.min(...tier)).toFixed(2)}×)`);
assert.ok(!/DET/.test(AJUSTES['RÉQUIEM [V, C]'].para), 'DET é o nome antigo de Energia');
console.log(`✅ ${Object.keys(AJUSTES).length * 3 + 2} asserts passaram.`);
console.log(`   espalhamento do tier: 4,73× → ${(Math.max(...tier) / Math.min(...tier)).toFixed(2)}×\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [], plano = [];
for (const m of mods.filter(x => x.id === 'sonoro_c4')) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find(k => /efeito/i.test(lbl[k]));
    const itens = (m.itensPredefinidos || []).map(it => {
        const a = AJUSTES[it.nome];
        if (!a) return it;
        const atual = String(it.valores?.[kE] ?? '').trim().replace(/\s+/g, ' ');
        if (atual !== a.de) { erros.push(`"${it.nome}"\n        banco: ${atual}`); return it; }
        plano.push({ nome: it.nome, ...a });
        return { ...it, valores: { ...it.valores, [kE]: a.para }, descricao: a.para, ...a.campos };
    });
    m._novos = itens;
}

console.log('=== Custo 4 — Apoteose ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}   ${p.antes.toFixed(2)}× → ${p.depois.toFixed(2)}×   [${p.nota}]`);
    console.log(`     de:   ${p.de}`);
    console.log(`     para: ${p.para}\n`);
}
console.log('  Já ajustadas na passada anterior: LAMENTO 1,76× · MARCHA 1,11×');
console.log(`  Tier depois: 1,11× a 1,76× — espalhamento de ${(1.76 / 1.11).toFixed(2)}×`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 2) { console.error(`\n🔴 ABORTADO: ${plano.length}/2 achadas.`); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
