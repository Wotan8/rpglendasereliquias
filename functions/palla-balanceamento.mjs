/**
 * Pallacerdote — as cinco magias abaixo de 1:1, corrigidas pela régua.
 *
 * Regra da casa: cada ponto de recurso devolve ≥ 1,00 unidade (1 unidade = 3,445
 * = uma rodada de guerreiro no Q0). Taxas: 1 ponto de dano/cura = 0,290 ·
 * ±1 no Alvo por rodada = 0,170 · 1 Energia devolvida = 1,000.
 *
 * Várias fecham em 1,70× e não em 1,00× porque o passo mínimo de magnitude é 1
 * inteiro — não existe "+1,5 no Alvo". A régua tem granularidade mais fina que o
 * sistema, então a mira realista é a faixa 1,00–1,70×.
 *
 * FORA desta passada, de propósito:
 *   Luz Reveladora I  (0,96×) — está na linha; mexer seria ruído.
 *   Moral Cintilante I (0,51×) — a régua conta "+1 em testes sociais" como se
 *     fosse Alvo de combate, e teste social não acontece 5× por combate. Aqui
 *     quem está errada é a régua, não a magia.
 *
 *   node functions/palla-balanceamento.mjs            (dry-run)
 *   node functions/palla-balanceamento.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const DPR = 3.445, T_ALVO = 0.585 / DPR, T_CURA = 1 / DPR, P_AL = 0.70 / 0.53;

/* nome → { de, para, antes, depois, conta } */
const AJUSTES = {
    'Penitência da Fé I': {
        de: '-1 no Alvo de testes de uma perícia escolhida pelo orador da súplica.',
        para: '-2 no Alvo de testes de uma perícia escolhida pelo orador da súplica, por 1 cena.',
        antes: 0.17, depois: 2 * T_ALVO * 5,
        conta: '-2 × 5 rodadas × 0,170',
    },
    'Luz Cauterizante I': {
        de: 'Cura 1 de Vitalidade ou remove 1 condição leve.',
        para: 'Cura 3 de Vitalidade ou remove 1 condição leve.',
        antes: 0.38, depois: 3 * T_CURA * P_AL,
        conta: '3 de cura × 0,290 × 1,32 (efeito em aliado passa por um teste só)',
    },
    'Luz Revigorante I': {
        de: 'Alvo ganha +1 no Alvo de testes de VIG/AUT por 1 cena.',
        para: 'Alvo ganha +2 no Alvo de testes de VIG/AUT por 1 cena.',
        antes: 0.85, depois: 2 * T_ALVO * 5,
        conta: '+2 × 5 rodadas × 0,170',
    },
    'Cegueira da Fé I': {
        de: 'Um feixe de luz intensa ofusca o alvo: -1 no Alvo em testes de Percepção e Ataque por 1 cena.',
        para: 'Um feixe de luz intensa ofusca o alvo: -2 no Alvo em testes de Percepção e Ataque por 1 cena.',
        antes: 0.85, depois: 2 * T_ALVO * 5,
        conta: '-2 × 5 rodadas × 0,170',
    },
    'Luz da Vontade I': {
        de: 'Restaura 1 Energia a 1 aliado e remove 1 condição mental (ex.: medo, ofuscamento/cegueira leve).',
        para: 'Restaura 2 Energia a 1 aliado e remove 1 condição mental (ex.: medo, ofuscamento/cegueira leve).',
        antes: 0.66, depois: 2 * P_AL / 2,   // 2 Energia = 2,00 unidades, custo 2 pontos
        conta: '2 Energia devolvidas × 1,000, sobre custo 2',
    },
};

/* ═══ ASSERTS ═══ */
assert.ok(Math.abs(T_ALVO - 0.170) < 0.001, 'taxa de Alvo bate com a régua');
assert.ok(Math.abs(T_CURA - 0.290) < 0.001, 'taxa de cura bate com a régua');
for (const [nome, a] of Object.entries(AJUSTES)) {
    assert.ok(a.depois > a.antes, `${nome}: a correção tem que subir o valor`);
    assert.ok(a.depois >= 1.0, `${nome}: precisa fechar em ≥ 1,00 (deu ${a.depois.toFixed(2)})`);
    assert.ok(a.depois <= 2.0, `${nome}: não pode estourar a faixa (deu ${a.depois.toFixed(2)})`);
    assert.notEqual(a.de, a.para, `${nome}: texto novo tem que ser diferente`);
}
console.log(`✅ ${2 + Object.keys(AJUSTES).length * 4} asserts passaram.\n`);

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
        const atual = String(it.valores?.[kE] ?? '').trim();
        if (atual !== a.de) { erros.push(`"${it.nome}": efeito não bate com o esperado.\n        banco: ${atual}\n        esperado: ${a.de}`); return it; }
        mexeu = true;
        plano.push({ nome: it.nome, modulo: m.titulo, ...a });
        /* A descrição espelha o efeito nesses módulos — mantém as duas em sincronia. */
        return { ...it, descricao: a.para, valores: { ...it.valores, [kE]: a.para } };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Pallacerdote: cinco correções ===\n');
for (const p of plano) {
    console.log(`  ${p.nome}   ${p.antes.toFixed(2)}× → ${p.depois.toFixed(2)}×`);
    console.log(`     ${p.conta}`);
    console.log(`     de:   ${p.de}`);
    console.log(`     para: ${p.para}\n`);
}
if (erros.length) { console.error('🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (plano.length !== Object.keys(AJUSTES).length) {
    console.error(`🔴 ABORTADO: ${plano.length}/${Object.keys(AJUSTES).length} magias achadas.`); process.exit(1);
}
console.log(`  ${plano.length} magias. Custo e teste intocados — só a magnitude do efeito.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
