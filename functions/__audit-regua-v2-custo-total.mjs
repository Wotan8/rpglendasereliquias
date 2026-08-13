/**
 * Régua v2 — o custo passa a incluir a AÇÃO, e a faixa vira 1,50–3,50×.
 *
 * O furo da v1: a razão contava o valor cheio da habilidade, incluindo o
 * golpe que ela consumiu. Mas o §0.3 já dizia que o guerreiro ataca de
 * graça toda rodada — logo uma habilidade de Ação Padrão que entrega 1,32
 * não entrega 1,32 a mais, entrega 0,32 a mais. Nove manobras estavam
 * aprovadas rendendo menos que sacar a espada.
 *
 * v2:  custo total = recursos + ação
 *      razão = unidades ÷ custo total
 *      faixa aceitável: 1,50× a 3,50×
 *
 * O golpe de espada é a referência e vale 1,00× por construção (entrega
 * 1,00 unidade, custa 1 Ação Padrão). O piso de 1,50 é a exigência de que
 * gastar recurso renda 50% a mais que só bater.
 *
 *   node functions/__audit-regua-v2-custo-total.mjs
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

const U = 3.445;
export const PISO = 1.50, TETO = 3.50;

/* ── Custo da ação (§0.5 e §1.1) ───────────────────────────────────── */
const ACAO = {
    'Ação Livre': 0,
    'Ação de Movimento': 0.333,
    'Ação Padrão': 1.000,
    'Ação Completa (turno inteiro)': 1.333,   // a Padrão mais a de Movimento
    'Sustentada (1 Padrão/turno)': 1.000,
    'Fora de combate': 0,                     // outra economia (§3.3)
};

/* ── Custo dos recursos ────────────────────────────────────────────── */
const ENERGIA = 1.00;          // §4.1, a âncora
const VITALIDADE = 1 / U;      // 0,290 — §1.1, cura é dano desfeito
const CARGA = 3 * VITALIDADE;  // 0,871 — câmbio do Sangral
/* Sanidade não tem taxa de combate na Régua (§6.3 diz isso na Vennire).
   Igualo a Vitalidade porque as duas são reserva que se esgota, e deixo
   como CONSTANTE declarada: se a mesa discordar, muda-se num lugar só. */
const SANIDADE = VITALIDADE;

/** Lê o custo em recursos do texto do campo Custo. */
function custoRecursos(txt) {
    const s = String(txt || '').toLowerCase();
    let total = 0;
    const num = (re) => { const m = s.match(re); if (!m) return 0;
        const n = m[1].includes('-') ? Number(m[1].split('-')[1]) : Number(m[1]); return Number.isFinite(n) ? n : 1; };
    total += num(/([\d-]+)\s*(de\s+)?energia/) * ENERGIA;
    total += num(/([\d-]+)\s*(de\s+)?gra[çc]a/) * ENERGIA;      // recurso de escola = Energia (§4.1)
    total += num(/([\d-]+)\s*(de\s+)?carga/) * CARGA;
    total += num(/([\d-]+)\s*(de\s+)?sanidade/) * SANIDADE;
    total += num(/([\d-]+)\s*(de\s+)?vitalidade/) * VITALIDADE;
    return total;
}
assert.ok(Math.abs(custoRecursos('1 Energia') - 1.00) < 1e-9);
assert.ok(Math.abs(custoRecursos('2 Cargas') - 2 * CARGA) < 1e-9);
assert.ok(Math.abs(custoRecursos('1 Energia e 1 Sanidade') - (1.00 + SANIDADE)) < 1e-9);
assert.equal(custoRecursos(''), 0);

/* A espada é a referência: 1,00 unidade por 1 Ação Padrão. */
assert.equal(1.00 / (0 + ACAO['Ação Padrão']), 1.00, 'o golpe de espada vale 1,00× por construção');
assert.ok(PISO > 1.00, 'o piso tem que exigir mais que a espada');

const lista = async (c) => (await db.collection(`system/data/${c}`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const [classes, mods] = await Promise.all(['classes', 'classModules'].map(lista));
const M = Object.fromEntries(mods.map((m) => [m.id, m]));

const linhas = [];
for (const c of classes) {
    for (const ref of (c.modulosDaClasse || [])) {
        const m = M[ref?.id ?? ref];
        if (!m) continue;
        const lbl = Object.fromEntries((m.schema || []).map((f) => [f.key, String(f.label || '')]));
        const kC = Object.keys(lbl).find((x) => /^custo/i.test(lbl[x]));
        const tier = /^Custo (\d)/.exec(m.titulo);
        for (const it of (m.itensPredefinidos || [])) {
            if (!it.regua || typeof it.regua.unidades !== 'number') continue;
            const acao = it.valores?.acao || 'Ação Padrão';
            const cAcao = ACAO[acao] ?? 1.000;
            const cRec = tier ? Number(tier[1]) * ENERGIA : custoRecursos(it.valores?.[kC]);
            const total = cRec + cAcao;
            linhas.push({
                classe: c.nome, nome: it.nome, acao, un: it.regua.unidades,
                v1: it.regua.razao, cRec, cAcao, total, v2: total ? it.regua.unidades / total : Infinity,
            });
        }
    }
}

linhas.sort((a, b) => a.v2 - b.v2);
console.log('=== RÉGUA v2: custo total = recursos + ação ===');
console.log(`faixa nova: ${PISO.toFixed(2)}–${TETO.toFixed(2)}×   (a espada é 1,00× por construção)\n`);
console.log('habilidade                    classe        ação         un    rec  +ação = total   v1     v2');
for (const l of linhas) {
    const marca = l.v2 < PISO ? '↓' : l.v2 > TETO ? '↑' : ' ';
    console.log(`${marca} ${l.nome.slice(0, 27).padEnd(29)}${l.classe.slice(0, 12).padEnd(14)}${l.acao.replace('Ação ', '').replace(' (turno inteiro)', '').padEnd(12)}${l.un.toFixed(2).padStart(5)} ${l.cRec.toFixed(2).padStart(5)} ${l.cAcao.toFixed(2).padStart(5)} ${l.total.toFixed(2).padStart(6)} ${l.v1.toFixed(2).padStart(5)}x ${l.v2.toFixed(2).padStart(5)}x`);
}
const abaixo = linhas.filter((l) => l.v2 < PISO), acima = linhas.filter((l) => l.v2 > TETO);
console.log(`\n  medidas: ${linhas.length}`);
console.log(`  abaixo de ${PISO}: ${abaixo.length}   dentro: ${linhas.length - abaixo.length - acima.length}   acima de ${TETO}: ${acima.length}`);
console.log(`\n  o que a v1 aprovava e a v2 reprova: ${linhas.filter((l) => l.v1 >= 1 && l.v1 <= 1.7 && (l.v2 < PISO || l.v2 > TETO)).length}`);
