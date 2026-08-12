/**
 * Auditoria — lote 6: fecha o portão de resistência e conserta a marcação.
 *
 * REGRA FECHADA (§5.3 tinha isto em aberto): a condição pega quando os Graus
 * do conjurador alcançam o atributo do alvo — GS >= AUT, igual à rolagem de
 * combate. Como GS = Alvo − resultado (§0.1) e o 10 sempre falha:
 *
 *      P(a condição pega) = (Alvo do conjurador − AUT do alvo) / 10
 *
 * Isso já embute o acerto da conjuração: rolagem falha não gera Grau nenhum.
 * Substitui o ×0,50 que o §6.1 usava só como ilustração.
 *
 * ERRO QUE ISSO REVELOU, e era meu: marquei buff em si mesmo e em aliado com
 * `portao: 'resistencia'`. Ninguém resiste a uma bênção — o §1.2 diz que
 * efeito em aliado passa só pelo teste de quem conjura. Com o portão errado a
 * Armadura Sanguínea (Redutor −4) dava P = 0,00: o Sangral nunca se armaria.
 *
 *   node functions/__aplica-portao-06.mjs            (dry-run)
 *   node functions/__aplica-portao-06.mjs --apply
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

const U = 3.445, ALVO_UN = 0.585 / U, BLIND = 0.53 / U;
const ALVO_BASE = 7, AUT_TIPICO = 3;
const pAcerto = (red) => Math.max(0, Math.min(ALVO_BASE + red, 9)) / 10;
const pResiste = (red) => Math.max(0, Math.min(ALVO_BASE + red, 9) - AUT_TIPICO) / 10;
assert.equal(pResiste(0), 0.40);
assert.equal(pAcerto(-3), 0.40, 'buff com Redutor −3 ainda sai em 4 de 10');
assert.equal(pResiste(-4), 0.00, 'debuff com Redutor −4 contra AUT 3 é impossível — e é o achado');

const regua = (un, custo) => ({ razao: Number((un / custo).toFixed(2)), unidades: Number(un.toFixed(2)), custo, em: HOJE });
/* `portao: null` = não há resistência: é buff, passa só pelo teste do conjurador. */
const buff = (nome, alvos, rodadas = 5) => ({ condicao: nome, portao: null, chance: null, alvos, rodadas });
const debuff = (nome, alvos, rodadas = 5) => ({ condicao: nome, portao: 'resistencia', chance: null, alvos, rodadas });

const CARGA = 3 / U;
const P = {};

/* ─ Buffs mal marcados: o portão sai, o P sobe, o valor se ajusta ─ */
P['Escudo Hemático'] = {          // self, Redutor −2 → P 0,50
    custo: Number((2 * CARGA).toFixed(2)), alvos: 1, cond: [buff('Blindado', 1)],
    efeito: 'Cria um escudo de sangue solidificado: Blindado 6 por 1 cena. O sangue não é perdido ao fim do efeito.',
    un: pAcerto(-2) * 6 * BLIND * 5,
};
P['Luz do Manto de Palla I'] = {  // aliado, Redutor −3 → P 0,40
    custo: 1, alvos: 1, cond: [buff('Blindado', 1)],
    efeito: 'Um aliado fica Blindado 4 por 1 cena e ignora Exaustão.',
    un: pAcerto(-3) * 4 * BLIND * 5,
};
P['Luz Revigorante I'] = {        // aliado, Redutor −3 → P 0,40
    custo: 1, alvos: 1, cond: [buff('Fortalecido', 1)],
    efeito: 'Um aliado a 6m fica Fortalecido 4 por 1 cena (+4 no Alvo de testes de VIG e AUT).',
    un: pAcerto(-3) * 4 * ALVO_UN * 5,
};

/* ─ Debuffs de verdade: o Redutor fundo derruba o P, e o efeito compensa ─ */
P['Distração da Fé I'] = {        // Redutor −3 → P 0,10
    custo: 1, alvos: 5, cond: [debuff('Exposto', 5)],
    efeito: 'Até 5 alvos em 6m ficam Exposto 3 por 1 cena se os seus Graus alcançarem a AUT de cada um (−3 na Defesa).',
    un: pResiste(-3) * 3 * ALVO_UN * 5 * 5,
};
P['Brilho Chamativo da Fé I'] = { // Redutor −3 → P 0,10
    custo: 1, alvos: 5, cond: [debuff('Provocado', 5)],
    efeito: 'Até 5 alvos em 6m ficam Provocado 2 por 1 cena se os seus Graus alcançarem a AUT de cada um (−4 no Alvo de qualquer ataque que não seja contra você).',
    un: pResiste(-3) * 2 * (2 * ALVO_UN) * 5 * 5,
};
/* Faltou no primeiro passe, e é o caso que revelou o erro: auto-buff marcado
   como resistido, com Redutor −4, dava P = 0,00. Como buff, P = 0,30 — mas
   nem Blindado 8 paga 4 Cargas nesse P, então o custo cai para 2. */
P['Armadura Sanguínea'] = {
    custo: Number((2 * CARGA).toFixed(2)), alvos: 1, cond: [buff('Blindado', 1)],
    efeito: 'Armadura completa de sangue: Blindado 8 por 1 cena (+3 de Blindagem, mais os 5 pontos que a armadura absorve de cada ataque).',
    un: pAcerto(-4) * 8 * BLIND * 5,
};
P['Névoa Sanguínea'] = {          // Redutor −3 → P 0,10
    custo: Number((3 * CARGA).toFixed(2)), alvos: 5, cond: [debuff('Abalado', 5)],
    efeito: 'Névoa que obscurece a visão: até 5 alvos (exceto o Sangral) ficam Abalado 8 por 1 cena em testes visuais. O Sangral sente através da névoa.',
    un: pResiste(-3) * 8 * ALVO_UN * 5 * 5,
};

console.log('=== PLANO ===');
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    const v = r < 1.00 ? 'SUB' : r > 1.70 ? 'ESTOURA' : 'ok';
    console.log(`${nome.slice(0, 28).padEnd(30)} custo ${String(p.custo).padStart(5)}  ${p.un.toFixed(2).padStart(6)} un  ${r.toFixed(2).padStart(5)}x  ${v}   ${p.cond[0].portao || 'sem portão'}`);
}
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    assert.ok(r >= 1.00 && r <= 1.70, `${nome} fora da faixa: ${r.toFixed(2)}x`);
    assert.ok(p.alvos <= 5, `${nome} passa do teto de 5 alvos`);
}

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
        achados.add(it.nome); mexeu = true;
        const novo = { ...it, valores: { ...it.valores }, regua: regua(p.un, p.custo), condicoesAplicadas: p.cond, alvosMax: p.alvos };
        if (kE) novo.valores[kE] = p.efeito;
        if (it.descricao && it.descricao !== it.nome) novo.descricao = p.efeito;
        return novo;
    });
    if (mexeu) m._novos = itens;
}
console.log(`\n  itens: ${achados.size}/${Object.keys(P).length}`);
assert.equal(achados.size, Object.keys(P).length);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
