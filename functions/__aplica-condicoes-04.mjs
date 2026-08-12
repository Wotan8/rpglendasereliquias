/**
 * Auditoria — lote 4: liga as habilidades às condições, e fecha três pontas.
 *
 *   1. DET não existe mais (virou Energia): 2 ocorrências no texto de efeito.
 *   2. Armadura Sanguínea: "absorve os primeiros 5 de cada ataque" É +5 de
 *      Blindagem — vira Blindado 8 (3 + 5) e sai de 0,51× para dentro da faixa
 *      sem tocar no custo.
 *   3. RITMO DE MARCHA: agora que o Célere tem preço (0,050 un/rodada por
 *      nível), dá para medir — e ela reprova. Balanceada por alvos.
 *
 *   node functions/__aplica-condicoes-04.mjs            (dry-run)
 *   node functions/__aplica-condicoes-04.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const HOJE = '2026-08-12';

/* ═══ Taxas ═══ */
const U = 3.445;
const ALVO = 0.585 / U, BLIND = 0.53 / U, CELERE = (0.333 / 10) * 1.5, ENERGIA = 1.00;
const P_ALIADO = 0.70;      // efeito em aliado passa só pelo seu teste (§1.2)
const P_INIMIGO = 0.42;     // Redutor 0 + portão de resistência
const CENA = 5;
const regua = (un, custo) => ({ razao: Number((un / custo).toFixed(2)), unidades: Number(un.toFixed(2)), custo, em: HOJE });

/* ═══ O plano ═══ */
const P = {};

/* Armadura Sanguínea: 3 + 5 absorvidos = Blindado 8. Custo 4 Cargas + 1 Energia,
   com a Carga já no câmbio novo (3 Vitalidade = 0,871 un). */
const CARGA = 3 / U;
P['Armadura Sanguínea'] = {
    custo: Number((4 * CARGA).toFixed(2)),   // a Energia era aditiva sobre as Cargas (§4.2)
    efeito: 'Armadura completa de sangue: Blindado 8 por 1 cena (+3 de Blindagem, mais os 5 pontos que a armadura absorve de cada ataque).',
    cond: [{ condicao: 'Blindado', portao: 'resistencia', chance: null, alvos: 1, rodadas: CENA }],
    alvos: 1,
    un: P_ALIADO * 8 * BLIND * CENA,
};

/* RITMO DE MARCHA: +3 m = Célere 2. Custo 2 (o tier). Só alvos podem subir. */
P['RITMO DE MARCHA [P]'] = {
    custo: 2, alvos: 8,
    efeito: 'Até 8 aliados em 10m ficam Célere 2 por 1 cena (+3 m de Deslocamento).',
    cond: [{ condicao: 'Célere', portao: 'resistencia', chance: null, alvos: 8, rodadas: CENA }],
    un: P_ALIADO * (2 * CELERE) * CENA * 8,
};

/* ACORDE DEBILITANTE: −2 no Alvo + o recurso drenado. DET → Energia. */
P['ACORDE DEBILITANTE [C, P]'] = {
    custo: 1, alvos: 1,
    efeito: '1 inimigo em 6m testa AUT vs GS. Falha: Abalado 2 por 1 cena (−2 no Alvo) e Drenado 1 (perde 1 de Energia e não a recupera na cena).',
    cond: [
        { condicao: 'Abalado', portao: 'resistencia', chance: null, alvos: 1, rodadas: CENA },
        { condicao: 'Drenado', portao: 'resistencia', chance: null, alvos: 1, rodadas: CENA },
    ],
    un: P_INIMIGO * (2 * ALVO * CENA + 1 * ENERGIA),
};

/* A SINFONIA: DET → Energia, e os buffs viram condição. O "efeito de Custo 1
   grátis por turno" fica no texto: é economia de recurso, não condição. */
P['A SINFONIA [Todas]'] = {
    custo: 5, alvos: 2,
    efeito: 'Até 2 aliados em 10m ficam Fortalecido 2 e Blindado 1 por 1 cena, e recuperam 2 de Energia. Você lança 1 efeito de Custo 1 por turno sem gastar Harmonia. Após o fim: +3 Dissonância.',
    cond: [
        { condicao: 'Fortalecido', portao: 'resistencia', chance: null, alvos: 2, rodadas: CENA },
        { condicao: 'Blindado', portao: 'resistencia', chance: null, alvos: 2, rodadas: CENA },
    ],
    un: P_ALIADO * ((2 * ALVO + 1 * BLIND) * CENA + 2 * ENERGIA) * 2,
};

/* Distração da Fé I: −1 na Defesa = Exposto 1. */
P['Distração da Fé I'] = {
    custo: 1, alvos: 3,
    efeito: 'Até 3 alvos em 6m testam AUT vs GS. Falha: Exposto 3 por 1 cena (−3 na Defesa).',
    cond: [{ condicao: 'Exposto', portao: 'resistencia', chance: null, alvos: 3, rodadas: CENA }],
    /* 1 atacante por rodada — conservador de propósito: contar quantos batem
       no alvo devolveria a dependência de composição de mesa, que é o que
       tornava o taunt imensurável. Redutor −3 do cadastro → P 0,18. */
    un: 0.18 * 3 * ALVO * CENA * 3,
};

console.log('=== PLANO ===');
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    const v = r < 1.00 ? 'SUB' : r > 1.70 ? 'ESTOURA' : 'ok';
    console.log(`\n▸ ${nome}   custo ${p.custo}   ${p.un.toFixed(2)} un   ${r.toFixed(2)}x  ${v}`);
    console.log(`   ${p.efeito}`);
    console.log(`   condições: ${p.cond.map((c) => `${c.condicao} ${c.rodadas}r x${c.alvos}`).join(' + ')}`);
}
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    assert.ok(r >= 1.00 && r <= 1.70, `${nome} fora da faixa: ${r.toFixed(2)}x`);
}
assert.ok(!Object.values(P).some((p) => /\bDET\b/.test(p.efeito)), 'nenhum texto novo pode falar em DET');

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const achados = new Set();
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
    const kE = Object.keys(lbl).find((x) => /^efeito/i.test(lbl[x]));
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map((it) => {
        const p = P[it.nome];
        if (!p) return it;
        achados.add(it.nome);
        mexeu = true;
        const novo = { ...it, valores: { ...it.valores }, regua: regua(p.un, p.custo), condicoesAplicadas: p.cond };
        if (p.alvos) novo.alvosMax = p.alvos;
        if (kE) novo.valores[kE] = p.efeito;
        if (it.descricao && it.descricao !== it.nome) novo.descricao = p.efeito;
        return novo;
    });
    if (mexeu) m._novos = itens;
}
console.log(`\n  itens: ${achados.size}/${Object.keys(P).length}   módulos: ${mods.filter((m) => m._novos).length}`);
assert.equal(achados.size, Object.keys(P).length, 'todo item do plano tem que existir no banco');

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
