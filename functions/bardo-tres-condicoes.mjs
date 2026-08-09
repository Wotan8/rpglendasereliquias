/**
 * As três canções que dependiam de decisão sobre condição. Propostas escolhidas
 * pelo dono do sistema: A, A e B.
 *
 * Taxas (Régua §1.1 e §6.1): 1 ponto de dano = 0,290 · Amedrontado 0,17/rodada ·
 * Prostrado 0,47 · Atordoado 1,32 · Desorientado 0,69/rodada · área = 3 alvos.
 *
 * ═══ 1. LAMENTO DA BANSHEE — Custo 4, proposta A ═══
 * O "-2 no Alvo" sai: Amedrontado JÁ é −1, e empilhar texto sobre condição
 * nomeada é a ambiguidade que a proposta A elimina em vez de arbitrar.
 * O dado ganha face — "(PRE + Composição) dados" não é mensurável, e com 7 dados
 * típicos estouraria qualquer orçamento. Vira (Composição)d4.
 *   (7,5 × 0,290 + 0,85) × 3 = 9,08 → 2,27×
 *
 * ═══ 2. MARCHA DO CATACLISMO — Custo 4, proposta A ═══
 * Fica só o Prostrado nomeado; o "-2 no Alvo, perde a próxima ação" sai, porque
 * inventava um Prostrado diferente do §6.10 (que é +4 a quem bate de perto).
 * Só que Prostrado sozinho derruba a magia para 0,35×, então o "dano estrutural"
 * ganha número — é o que sustenta o Custo 4.
 *   (3,5 × 0,290 + 0,47) × 3 = 4,46 → 1,11×
 *
 * ═══ 3. TROMBETA DO JULGAMENTO — Custo 5, proposta B ═══
 * Surdo sai (vale 0 em combate) e entra Desorientado — o par negativo do Vento,
 * a Essência da própria Sonoromancia. Limitado a 1 turno: pela cena, em cone,
 * ele sozinho valeria 3,45 por alvo e a canção iria a 4,7×.
 * Sai também o "+2 Dissonância": a Dissonância deixou de existir.
 *   (1,015 + 0,69 + 1,32) × 3 = 9,07 → 1,81×
 *
 * ⚠ CONTEXTO: o Custo 4 inteiro está inflado — RÉQUIEM 5,25×, LETARGIA 3,75×.
 * As duas de Apoteose aqui ficam ABAIXO das irmãs de tier. O tier precisa de
 * uma passada própria.
 *
 *   node functions/bardo-tres-condicoes.mjs            (dry-run)
 *   node functions/bardo-tres-condicoes.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const T_DANO = 1 / 3.445, AMEDRONTADO = 0.17, PROSTRADO = 0.47, ATORDOADO = 1.32, DESORIENTADO = 0.69, ALVOS = 3;

const AJUSTES = {
    'LAMENTO DA BANSHEE [V, S]': {
        de: 'Inimigos em 6m: dano sônico ((PRE + Composição) dados), AUT vs GS. Falha: Amedrontado + -2 no Alvo. Necróticos/abissais: dano dobrado.',
        para: 'Inimigos em 6m: dano sônico (Composição)d4, AUT vs GS. Falha: Amedrontado. Necróticos/abissais: dano dobrado.',
        custo: 4, antes: 0.38,
        depois: (7.5 * T_DANO + AMEDRONTADO * 5) * ALVOS,
        conds: [{ condicao: 'Amedrontado', portao: 'resistencia', chance: null }],
        nota: 'sai o −2 (Amedrontado já é −1); o dado ganha face',
    },
    'MARCHA DO CATACLISMO [P, S]': {
        de: 'Inimigos em 8m testam VIG vs GS. Falha: Prostrado, -2 no Alvo, perde a próxima ação. Causa dano estrutural.',
        para: 'Inimigos em 8m testam VIG vs GS. Falha: 1d6 de dano e Prostrado. Causa dano estrutural em construções.',
        custo: 4, antes: 1.36,
        depois: (3.5 * T_DANO + PROSTRADO) * ALVOS,
        conds: [{ condicao: 'Prostrado', portao: 'resistencia', chance: null }],
        nota: 'só o Prostrado nomeado; o dano ganha número para sustentar o tier',
    },
    'TROMBETA DO JULGAMENTO [S]': {
        de: 'Cone de (Composição × 200)m. VIG vs GS. Falha: dano massivo, empurra 3m por GS, Surdo + Atordoado. Ouvido a 1km. Após o uso: +2 Dissonância. Falha Crítica: ricocheteia.',
        para: 'Cone de (Composição × 200)m. VIG vs GS. Falha: 1d6 de dano, empurra 3m por GS, Desorientado por 1 turno e Atordoado. Ouvido a 1km. Falha Crítica: ricocheteia.',
        custo: 5, antes: 0.79,
        depois: (3.5 * T_DANO + DESORIENTADO + ATORDOADO) * ALVOS,
        conds: [{ condicao: 'Desorientado', portao: 'resistencia', chance: null },
                { condicao: 'Atordoado', portao: 'resistencia', chance: null }],
        nota: 'Surdo → Desorientado (Vento, a Essência da Sonoromancia); some a Dissonância',
    },
};

/* ═══ ASSERTS ═══ */
for (const [nome, a] of Object.entries(AJUSTES)) {
    assert.ok(a.depois / a.custo >= 1.00, `${nome}: precisa passar o piso (deu ${(a.depois / a.custo).toFixed(2)})`);
    /* Nem toda correção sobe o número. A MARCHA CAI de 1,36× para 1,11× porque
       passava aplicando um Prostrado que ela mesma inventava, diferente do
       §6.10. Perder potência aqui é o conserto, não o efeito colateral. */
    if (a.antes < 1.00) assert.ok(a.depois / a.custo > a.antes, `${nome}: reprovada, tem que melhorar`);
    assert.ok(/d\d/.test(a.para), `${nome}: o dado precisa de face declarada`);
    assert.ok(!/Dissonância/i.test(a.para), `${nome}: a Dissonância não existe mais`);
}
assert.ok(!/-2 no Alvo/.test(AJUSTES['LAMENTO DA BANSHEE [V, S]'].para), 'o −2 sai do Lamento');
assert.ok(!/Surdo/.test(AJUSTES['TROMBETA DO JULGAMENTO [S]'].para), 'Surdo sai da Trombeta');
assert.ok(!/perde a próxima ação/.test(AJUSTES['MARCHA DO CATACLISMO [P, S]'].para), 'a Marcha para de redefinir Prostrado');
console.log(`✅ ${Object.keys(AJUSTES).length * 4 + 3} asserts passaram.\n`);

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
        if (atual !== a.de) { erros.push(`"${it.nome}"\n        banco: ${atual}`); return it; }
        mexeu = true; plano.push({ nome: it.nome, modulo: m.titulo, ...a });
        return { ...it, valores: { ...it.valores, [kE]: a.para }, descricao: a.para, condicoesAplicadas: a.conds };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Bardo: as três de condição ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}   ${p.antes.toFixed(2)}× → ${(p.depois / p.custo).toFixed(2)}×   [${p.nota}]`);
    console.log(`     de:   ${p.de}`);
    console.log(`     para: ${p.para}\n`);
}
if (erros.length) { console.error('🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== 3) { console.error(`🔴 ABORTADO: ${plano.length}/3 achadas.`); process.exit(1); }
console.log('  Custos e portões de resistência intocados.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
