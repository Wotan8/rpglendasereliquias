/**
 * Portão de progressão para os ritos de Adepto, Xamã e Pallacerdote.
 *
 * O Invocador tem `CA mínimo` de 2 a 8 e, com isso, uma escada: nem todo rito
 * está disponível desde sempre. As outras três classes de rito não têm nada —
 * os 3 do Adepto, os 8 do Xamã e os 4 do Pallacerdote ficam todos no mesmo
 * nível, acessíveis desde a criação. Sem portão não existe progressão.
 *
 * ═══ DE QUE O PORTÃO É FEITO ═══
 *
 * Nenhum VD novo, nenhuma mecânica nova: o portão é o nível mínimo da PERÍCIA DE
 * ESCOLA, que já existe em todas as três e já vai de 0 a 5.
 *
 *   Adepto        Perícia: Contato com o Sétimo (PRS — o atributoChave dele)
 *   Xamã          Perícia: Totemismo (INT/RAC)
 *   Pallacerdote  Perícia: Devoção em Palla (PRE — o atributoChave dele)
 *
 * É o mesmo desenho do Invocador visto por outro ângulo: o CA dele também nasce
 * de perícia (⌊Abismancia ÷ 2⌋); o que ele tem a mais é trocar sanidade por
 * acesso. Copiar essa troca para as outras três tornaria as classes iguais.
 *
 * ═══ A ORDEM ═══
 *
 * Os valores seguem o escopo medido por `audit-rituais-escopo.mjs`: si mesmo <
 * um alvo < área < cena < mundo. Rito que muda o mundo pede perícia 5; rito que
 * só afeta quem conjura pede 1.
 *
 * ⚠ A ordenação do Xamã é JULGAMENTO, não medição: as 8 descrições dele são
 * curtas demais para o classificador separar (saíram todas como "si mesmo").
 * Revisar antes de considerar fechado.
 *
 *   node functions/rituais-portao.mjs            (dry-run)
 *   node functions/rituais-portao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const PLANO = {
    ritual_necro: {
        classe: 'Adepto de Thannathog', pericia: 'Contato com o Sétimo',
        niveis: {
            'VOZES DO TÚMULO': 1,          // si mesmo — ouvir os mortos
            'ERGUER FANTOCHES': 3,         // cena — servos temporários
            'RITUAL DE REANIMAÇÃO': 5,     // mundo — servo permanente
        },
    },
    mod_totem: {
        classe: 'Xamã', pericia: 'Totemismo', duvidoso: true,
        niveis: {
            'Cravar Totem': 1,             // pré-requisito dos outros ritos
            'Buscar Vestígio': 1,
            'Comunhão Simples': 2,
            'Transcendência — Receptor': 3,
            'Transcendência — Projetor': 3,
            'Exorcismo': 4,
            'Vincular Eco (Antiqua)': 4,
            'Libertar Eco Aprisionado': 5,
        },
    },
    rituais_palla: {
        classe: 'Pallacerdote', pericia: 'Devoção em Palla',
        niveis: {
            'Peregrinação do Amanhecer': 1,  // si mesmo — rito devocional
            'Cura de Nexo Menor': 2,         // si mesmo — estabilizar
            'Exorcismo Menor': 3,            // área — limpar zona
            'Reconsagração do Santuário': 4, // área por 1 dia
        },
    },
};

/* ═══ ASSERTS ═══ */
for (const [id, p] of Object.entries(PLANO)) {
    const vals = Object.values(p.niveis);
    assert.ok(vals.every(v => v >= 1 && v <= 5), `${id}: portão fora de 1–5`);
    assert.ok(Math.min(...vals) === 1, `${id}: tem que haver rito de entrada (nível 1)`);
    assert.ok(new Set(vals).size >= 2, `${id}: portão com valor único não é escada`);
}
assert.ok(Math.max(...Object.values(PLANO.ritual_necro.niveis)) === 5,
    'Reanimação permanente é o topo do Adepto');
console.log(`✅ ${Object.keys(PLANO).length * 3 + 1} asserts passaram.\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [];

for (const [id, p] of Object.entries(PLANO)) {
    const m = mods.find(x => x.id === id);
    if (!m) { erros.push(`módulo ${id} não encontrado`); continue; }
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    if (Object.values(lbl).some(l => /perícia mínima/i.test(l))) { erros.push(`${id}: portão já existe`); continue; }

    /* campo novo no schema, logo depois do Nome */
    const chaveNova = String(Math.max(0, ...(m.schema || []).map(f => +f.key || 0)) + 1);
    const campo = {
        key: chaveNova, tipo: 'number', label: `Perícia mínima (${p.pericia}):`,
        largura: 'quarto', somenteLeitura: true, placeholder: '1 a 5', ocultarSeVazio: false,
    };
    const schemaNovo = [(m.schema || [])[0], campo, ...(m.schema || []).slice(1)].filter(Boolean);

    const semNivel = [];
    const itens = (m.itensPredefinidos || []).map(it => {
        const n = p.niveis[it.nome];
        if (n == null) { semNivel.push(it.nome); return it; }
        return { ...it, valores: { ...it.valores, [chaveNova]: n } };
    });
    if (semNivel.length) erros.push(`${id}: sem nível definido → ${semNivel.join(', ')}`);
    m._schema = schemaNovo; m._itens = itens; m._campo = campo; m._p = p;
}

console.log('=== Portão nos ritos ===\n');
for (const m of mods.filter(x => x._p)) {
    console.log(`─── ${m._p.classe}   campo novo: "${m._campo.label}"  (key ${m._campo.key})${m._p.duvidoso ? '   ⚠ ordenação por julgamento' : ''}`);
    const ord = Object.entries(m._p.niveis).sort((a, b) => a[1] - b[1]);
    for (const [nome, n] of ord) console.log(`     ${n}  ${nome}`);
    console.log();
}
if (erros.length) { console.error('🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`  ${Object.keys(PLANO).length} módulos · ${Object.values(PLANO).reduce((s, p) => s + Object.keys(p.niveis).length, 0)} ritos ganham portão.`);
console.log('  Nenhum VD, mecânica ou perícia nova — só um campo por módulo.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._schema)) {
    await col.doc(m.id).update({ schema: m._schema, itensPredefinidos: m._itens, updatedAt: Date.now() });
}
console.log('\n✅ Gravado.');
process.exit(0);
