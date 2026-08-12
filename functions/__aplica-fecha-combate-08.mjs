/**
 * Auditoria — lote 8: fecha a régua de COMBATE.
 *
 *   A. As 6 canções com régua velha, calculada com P = 1,00 (nenhum portão).
 *   B. As 11 que estavam fora da faixa 1,00–1,70×.
 *
 * Regra de correção, na ordem: primeiro nível de condição e alvos (teto 5),
 * depois magnitude, e custo só quando nada mais fecha. Custo de canção do
 * Bardo nunca — é o tier.
 *
 *   node functions/__aplica-fecha-combate-08.mjs            (dry-run)
 *   node functions/__aplica-fecha-combate-08.mjs --apply
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

const U = 3.445, ALVO = 0.585 / U, BLIND = 0.53 / U, DANO = 1 / U;
const ATRIB = 4, BARREIRA_FIS = 2, BARREIRA_ARC = 0;
const pBuff = (red = 0) => Math.max(0, Math.min(7 + red, 9)) / 10;          // só o seu teste
const pDebuff = (red = 0) => Math.max(0, Math.min(7 + red, 9) - 3) / 10;    // GS >= AUT 3
const CENA = 5, ENERGIA = 1.00, CARGA = 3 / U;
const ACELERADO = 1.43, IGNORA_DEFESA = 0.320, ATORDOADO = 1.32;
const liq = (dado, arc = false) => dado + ATRIB - (arc ? BARREIRA_ARC : BARREIRA_FIS);
const unDano = (dado, arc = false) => liq(dado, arc) * DANO;
const regua = (un, custo) => ({ razao: Number((un / custo).toFixed(2)), unidades: Number(un.toFixed(2)), custo, em: HOJE });
const buff = (n, alvos, r = CENA) => ({ condicao: n, portao: null, chance: null, alvos, rodadas: r });
const debuff = (n, alvos, r = CENA) => ({ condicao: n, portao: 'resistencia', chance: null, alvos, rodadas: r });

const P = {};

/* ═══ A. As 6 canções com régua velha (P = 1,00) ═══ */
P['NOTA PENETRANTE [S]'] = {
    custo: 1, alvos: 2, cond: [debuff('Surdo', 2)],
    efeito: 'Cone de 3m, até 2 alvos: 1 de dano sônico e Surdo por 1 cena.',
    un: pDebuff() * unDano(1, true) * 2,
};
P['CANÇÃO DO VIGOR [V, C]'] = {
    custo: 1, alvos: 1, cond: [],
    efeito: '1 aliado a 6m recupera 2 de Energia. +1 aliado por Grau de Sucesso extra.',
    un: pBuff() * (2 * ENERGIA),
};
P['RITMO DE GUERRA [P, V]'] = {
    custo: 2, alvos: 5, cond: [buff('Fortalecido', 5)],
    efeito: 'Até 5 aliados em 6m ficam Fortalecido 1 por 1 cena (+1 no Alvo de Ataque).',
    un: pBuff() * ALVO * CENA * 5,
};
P['DISTORÇÃO ESPACIAL ILUSÓRIA [C, S]'] = {
    custo: 2, alvos: 4, cond: [debuff('Abalado', 4)],
    efeito: 'Até 4 alvos em 6m ficam Abalado 2 por 1 cena em ataques corpo-a-corpo; mover-se exige teste de RAC.',
    un: pDebuff() * (2 * ALVO) * CENA * 4,
};
P['FÚRIA INSPIRADA [V]'] = {
    /* §4.7: recurso devolvido <= recurso gasto. 3 aliados × 1 Energia por 3 de
       Harmonia fecha 1:1 — o resto do valor tem que vir de outro efeito. */
    custo: 3, alvos: 3, cond: [buff('Fortalecido', 3)],
    efeito: 'Até 3 aliados a 6m recuperam 1 de Energia e ficam Fortalecido 1 por 1 cena.',
    un: pBuff() * (ENERGIA + ALVO * CENA) * 3,
};
P['CADÊNCIA ACELERADORA [P, C]'] = {
    custo: 3, alvos: 1, cond: [buff('Acelerado', 1)],
    efeito: '1 aliado a 6m fica Acelerado por 1 cena (+1 ação adicional por turno).',
    un: pBuff() * ACELERADO * CENA,
};

/* ═══ B. As 11 fora da faixa ═══ */

/* Ladino — quatro manobras que ignoram Defesa/Blindagem por 1 Energia. */
P['Golpe pelas Costas'] = {
    custo: 2, alvos: 1, cond: [],
    efeito: 'Condição: estar furtivo. Alvo = + Furtividade. Ignora a Blindagem. +1 de dano por Grau de Sucesso.',
    un: 2.57,   // valor medido antes; o que muda é o custo
};
P['Corte de Passagem'] = {
    custo: 2, alvos: 1, cond: [],
    efeito: 'Sua Ação de Movimento deixa de ser um golpe parado: você corta em qualquer ponto do trajeto e segue andando.',
    un: 2.75,
};
P['Ataque Mudo'] = {
    custo: 1, alvos: 1, cond: [buff('Oculto', 1)],
    efeito: 'Ignora a Defesa. 1× por cena no mesmo alvo. Só funciona contra alvos vivos e orgânicos.',
    un: pBuff() * IGNORA_DEFESA * CENA,
};
P['Engodo'] = {
    custo: 1, alvos: 1, cond: [debuff('Exposto', 1, 1)],
    efeito: 'Você finge um golpe para abrir a guarda do inimigo: ele fica Exposto 3 até o fim do seu próximo ataque neste turno.',
    un: pDebuff() * (3 * ALVO) * 1 + 1.0,
};

/* Guerreiro */
P['Golpe Cruzado'] = {
    custo: 2, alvos: 1, cond: [],
    efeito: 'Sua Ação Padrão rende dois golpes em vez de um, sem penalidade. A Ação de Movimento continua como na regra base.',
    un: 2.75,
};
P['Golpe Giratório'] = {
    custo: 2, alvos: 5, cond: [],
    efeito: 'Ataca até 5 inimigos adjacentes (até 2m). −2 no Alvo. Cada alvo defende separadamente.',
    un: 3.30,
};
P['Cólera'] = {
    custo: 2, alvos: 1, cond: [buff('Exposto', 1)],
    efeito: 'Estado de fúria marcial: +2 de dano em cada golpe e Exposto 2, até o fim do combate ou até você passar um turno sem atacar.',
    un: 2.29,
};

/* Pallacerdote */
P['Cegueira da Fé I'] = {
    custo: 1, alvos: 3, cond: [debuff('Cego', 3)],
    efeito: 'Um feixe de luz intensa deixa até 3 alvos Cego por 1 cena se os seus Graus alcançarem a AUT de cada um.',
    un: pDebuff(-3) * 1.05 * CENA * 3,
};
P['Reconsagração do Santuário'] = {
    custo: 4, alvos: 1, cond: [],
    efeito: 'Restaura a conexão com Palla em uma zona de 6m por 1 dia. Todo teste de Pallomancia dentro da zona tem +2 no Alvo.',
    un: 6.11,
};

/* Sangral */
P['Transfusão Forçada'] = {
    custo: Number((3 * CARGA + ENERGIA).toFixed(2)), alvos: 1, cond: [],
    efeito: 'Aliado: cura (GS)d6 de Vitalidade. Inimigo: causa (GS)d6 de dano necrótico + rastreamento 24h. Risco: −1 Sanidade por uso.',
    un: 5.35,
};
P['Explosão Hemática'] = {
    /* 9,14× era o pior do catálogo, e piorou com o câmbio: "TODA a Bolha" é
       barato em unidades. O dado passa a ser fixo e a área entra no teto. */
    custo: Number((4 * CARGA + ENERGIA).toFixed(2)), alvos: 5, cond: [],
    efeito: 'A Bolha explode: 3d6 de dano em área, até 5 alvos. Custa 4 Cargas e 1 Sanidade, e destrói a Bolha completamente.',
    un: pDebuff() * unDano(10.5) * 5,
};

console.log('=== PLANO ===');
const fora = [];
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    const v = r < 1.00 ? 'SUB' : r > 1.70 ? 'ESTOURA' : 'ok';
    if (v !== 'ok') fora.push(`${nome} ${r.toFixed(2)}x`);
    console.log(`${nome.slice(0, 30).padEnd(32)} custo ${String(p.custo).padStart(5)}  ${p.un.toFixed(2).padStart(5)} un  ${r.toFixed(2).padStart(5)}x  ${v}`);
}
assert.equal(fora.length, 0, `fora da faixa: ${fora.join(' | ')}`);
for (const [nome, p] of Object.entries(P)) assert.ok(p.alvos <= 5, `${nome} passa do teto de 5 alvos`);

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
        const novo = { ...it, valores: { ...it.valores }, regua: regua(p.un, p.custo), alvosMax: p.alvos };
        if (p.cond.length) novo.condicoesAplicadas = p.cond;
        if (kE) novo.valores[kE] = p.efeito;
        if (it.descricao && it.descricao !== it.nome) novo.descricao = p.efeito;
        return novo;
    });
    if (mexeu) m._novos = itens;
}
console.log(`\n  itens: ${achados.size}/${Object.keys(P).length}`);
const faltam = Object.keys(P).filter((n) => !achados.has(n));
assert.equal(faltam.length, 0, `não achei: ${faltam.join(', ')}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
