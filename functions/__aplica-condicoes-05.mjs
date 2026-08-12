/**
 * Auditoria — lote 5: o resto das habilidades que duram passa a vir de condição.
 *
 * REGRA NOVA DE PROJETO: teto de 5 alvos. Habilidade que precisa de 6+ para
 * fechar a conta quase nunca acha 6 na mesa — o número existe no papel e não
 * no jogo. Quando falta valor, sobe o NÍVEL da condição, não a quantidade de
 * alvos. Isso corrige o RITMO DE MARCHA gravado no lote 4 com 8.
 *
 *   node functions/__aplica-condicoes-05.mjs            (dry-run)
 *   node functions/__aplica-condicoes-05.mjs --apply
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

const U = 3.445;
const ALVO = 0.585 / U, BLIND = 0.53 / U, CELERE = (0.333 / 10) * 1.5;
const DANO_GOLPE = 0.53 * 0.290;          // +1 de dano por golpe, por rodada
const IGNORA_DEFESA = 0.320, ACAO_META = 0.500, ENERGIA = 1.00;
const P_PROPRIO = 0.70, P_INIMIGO = 0.42, CENA = 5;
const TETO_ALVOS = 5;
const regua = (un, custo) => ({ razao: Number((un / custo).toFixed(2)), unidades: Number(un.toFixed(2)), custo, em: HOJE });
const c = (nome, alvos, rodadas = CENA) => ({ condicao: nome, portao: 'resistencia', chance: null, alvos, rodadas });

const P = {};

/* ─ Correção do lote 4: 8 alvos viola o teto. Sobe o nível. ─ */
P['RITMO DE MARCHA [P]'] = {
    custo: 2, alvos: 5,
    efeito: 'Até 5 aliados em 10m ficam Célere 3 por 1 cena (+4,5 m de Deslocamento).',
    cond: [c('Célere', 5)],
    un: P_PROPRIO * (3 * CELERE) * CENA * 5,
};

/* ─ Guerreiro ─ */
P['Inspirar'] = {
    custo: 1, alvos: 5,
    efeito: 'Até 5 aliados em 6m ficam Fortalecido 1 por 2 rodadas (+1 no Alvo).',
    cond: [c('Fortalecido', 5, 2)],
    un: P_PROPRIO * ALVO * 2 * 5,
};
P['Postura Defensiva'] = {
    custo: 1, alvos: 1,
    efeito: 'Você fica Blindado 5 e Abalado 2 até trocar de postura. Ação Livre.',
    cond: [c('Blindado', 1), c('Abalado', 1)],
    un: P_PROPRIO * (5 * BLIND - 2 * ALVO) * CENA,
};
P['Postura Ofensiva'] = {
    custo: 1, alvos: 1,
    efeito: 'Você causa +4 de dano em cada golpe e fica Exposto 1 até trocar de postura. Ação Livre.',
    cond: [c('Exposto', 1)],
    un: P_PROPRIO * (4 * DANO_GOLPE - 1 * ALVO) * CENA,
};

/* ─ Ladino ─ */
P['Passos Sombrios'] = {
    custo: 1, alvos: 1,
    efeito: 'Move o Deslocamento Terrestre inteiro e fica Oculto por 1 cena — seus ataques ignoram a Defesa. Quem não quiser perdê-lo de vista gasta um teste de Percepção. Ação de Movimento.',
    cond: [c('Oculto', 1)],
    un: P_PROPRIO * IGNORA_DEFESA * CENA,
};

/* ─ Bardo (custo é o tier: só o efeito cede) ─ */
P['LETARGIA TEMPORAL [P, C]'] = {
    custo: 4, alvos: 4,
    efeito: 'Até 4 inimigos em 6m testam AUT vs GS. Falha: Entorpecido e Lento por 1 cena. Falha Crítica: inverte no Bardo.',
    cond: [c('Entorpecido', 4), c('Lento', 4)],
    un: P_INIMIGO * (ACAO_META + 0.10) * CENA * 4,
};
P['COMPOSIÇÃO DE BATALHA [Qualquer]'] = {
    custo: 3, alvos: 3,
    efeito: 'Até 3 aliados em 6m ficam Fortalecido 2 pela cena — ou até 3 inimigos ficam Abalado 2, escolhido na conjuração. Não exige manter ritmo.',
    cond: [c('Fortalecido', 3)],
    un: P_PROPRIO * (2 * ALVO) * CENA * 3,
};
P['RÉQUIEM [V, C]'] = {
    custo: 4, alvos: 5,
    efeito: 'Até 5 inimigos em 6m testam PRS + AUT vs GS. Falha: Drenado 3 (perdem 3 de Energia e não a recuperam até o fim da cena).',
    cond: [c('Drenado', 5)],
    un: P_INIMIGO * (3 * ENERGIA) * 5,
};

/* ─ Pallacerdote ─ */
P['Luz do Manto de Palla I'] = {
    custo: 1, alvos: 1,
    efeito: 'Um aliado fica Blindado 2 por 1 cena e ignora Exaustão.',
    cond: [c('Blindado', 1)],
    un: P_PROPRIO * (2 * BLIND) * CENA,
};
P['Luz Revigorante I'] = {
    custo: 1, alvos: 1,
    efeito: 'Um aliado a 6m fica Fortalecido 2 por 1 cena (+2 no Alvo de testes de VIG e AUT).',
    cond: [c('Fortalecido', 1)],
    un: P_PROPRIO * (2 * ALVO) * CENA,
};
P['Penitência da Fé I'] = {
    custo: 1, alvos: 3,
    efeito: 'Até 3 alvos em 6m testam AUT vs GS. Falha: Abalado 2 por 1 cena numa perícia escolhida pelo orador da súplica.',
    cond: [c('Abalado', 3)],
    un: 0.30 * (2 * ALVO) * CENA * 3,
};

/* ─ Sangral ─ */
P['Escudo Hemático'] = {
    custo: Number((2 * (3 / U)).toFixed(2)), alvos: 1,
    efeito: 'Cria um escudo de sangue solidificado: Blindado 4 por 1 cena. O sangue não é perdido ao fim do efeito.',
    cond: [c('Blindado', 1)],
    un: P_PROPRIO * (4 * BLIND) * CENA,
};
P['Névoa Sanguínea'] = {
    custo: Number((3 * (3 / U)).toFixed(2)), alvos: 3,
    efeito: 'Névoa que obscurece a visão: até 3 alvos (exceto o Sangral) ficam Abalado 3 por 5 turnos em testes visuais. O Sangral sente através da névoa.',
    cond: [c('Abalado', 3)],
    un: P_INIMIGO * (3 * ALVO) * CENA * 3,
};

console.log('=== PLANO ===');
for (const [nome, p] of Object.entries(P)) {
    const r = p.un / p.custo;
    const v = r < 1.00 ? 'SUB' : r > 1.70 ? 'ESTOURA' : 'ok';
    console.log(`${nome.slice(0, 30).padEnd(32)} custo ${String(p.custo).padStart(5)}  ${p.un.toFixed(2).padStart(6)} un  ${r.toFixed(2).padStart(5)}x  ${v}   alvos ${p.alvos}`);
}
for (const [nome, p] of Object.entries(P)) {
    assert.ok(p.alvos <= TETO_ALVOS, `${nome} passa do teto de ${TETO_ALVOS} alvos`);
    const r = p.un / p.custo;
    assert.ok(r >= 1.00 && r <= 1.70, `${nome} fora da faixa: ${r.toFixed(2)}x`);
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
console.log(`\n  itens: ${achados.size}/${Object.keys(P).length}   módulos: ${mods.filter((m) => m._novos).length}`);
const faltando = Object.keys(P).filter((n) => !achados.has(n));
assert.equal(faltando.length, 0, `não achei no banco: ${faltando.join(', ')}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
