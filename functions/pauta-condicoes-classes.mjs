/**
 * Pauta da frente de condições (PROMPT-CLASSES-CONDICOES.md, seção 3).
 * Quatro reparos, todos com origem citada no recado:
 *
 *  1. Cegueira da Fé I — texto e condição não diziam a mesma coisa. Ofuscado é
 *     DESVANTAGEM em ataques e defesas, não "−2 no Alvo em Percepção e Ataque".
 *     Fica a condição; o texto passa a nomeá-la.
 *  2. GRITO DISSONANTE — Atordoado (1,32) com Chance 10 em custo 1 (orçamento
 *     1,00): 32% acima. Chance 8 entrega 1,06 e encosta sem passar. Legal pelo
 *     piso de 5 do §6.10.
 *  3. TROMBETA DO JULGAMENTO — Desorientado + Atordoado na MESMA rodada é o
 *     §6.11 na forma mais forte: Atordoado já tira o turno, e não sobra ataque
 *     nem defesa para receber a Desvantagem. Das duas saídas oferecidas, fica
 *     SÓ o Atordoado — a magia já media 1,82×, acima do topo da faixa, e a
 *     outra saída (Desorientado por 1 cena) subiria mais.
 *  4. Luz da Vontade I — apelidos ("medo", "ofuscamento/cegueira leve") viram
 *     os nomes cadastrados. Ela remove, não aplica: condicoesAplicadas fica [].
 *
 *   node functions/pauta-condicoes-classes.mjs            (dry-run)
 *   node functions/pauta-condicoes-classes.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const REPAROS = [
    {
        nome: 'Cegueira da Fé I',
        de: 'Um feixe de luz intensa ofusca o alvo: -2 no Alvo em testes de Percepção e Ataque por 1 cena.',
        para: 'Um feixe de luz intensa deixa o alvo Ofuscado por 1 cena: Desvantagem em ataques e defesas.',
    },
    {
        nome: 'GRITO DISSONANTE [V, S]',
        de: 'Um inimigo a 6m fica Atordoado por 1 turno.',
        para: 'Um inimigo a 6m fica Atordoado por 1 turno (Chance 8).',
        chance: { condicao: 'Atordoado', valor: 8 },
    },
    {
        nome: 'TROMBETA DO JULGAMENTO [S]',
        de: 'Falha: 1d6 de dano, empurra 3m por GS, Desorientado por 1 turno e Atordoado.',
        para: 'Falha: 1d6 de dano, empurra 3m por GS e Atordoado por 1 turno.',
        remover: 'Desorientado',
    },
    {
        nome: 'Luz da Vontade I',
        de: 'remove 1 condição mental (ex.: medo, ofuscamento/cegueira leve)',
        para: 'remove 1 condição mental (Amedrontado, Ofuscado ou Cego)',
    },
];

assert.equal(REPAROS.length, 4);
assert.ok(REPAROS.every(r => r.de !== r.para), 'todo reparo muda alguma coisa');
assert.ok(!REPAROS.some(r => r.chance && r.chance.valor < 5), 'piso de Chance 5 (§6.10)');

const snap = await db.collection('system/data/classModules').get();
const erros = [], plano = [];
const alterados = new Map();

for (const d of snap.docs) {
    const m = d.data();
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const r = REPAROS.find(x => x.nome === it.nome);
        if (!r) return it;
        /* o mesmo texto vive em `descricao` e num campo de `valores` — troca nos dois */
        const trocas = [];
        let desc = it.descricao || '';
        if (desc.includes(r.de)) { desc = desc.replace(r.de, r.para); trocas.push('descricao'); }
        const valores = { ...(it.valores || {}) };
        for (const [k, v] of Object.entries(valores)) {
            if (typeof v === 'string' && v.includes(r.de)) { valores[k] = v.replace(r.de, r.para); trocas.push(`valores.${k}`); }
        }
        if (!trocas.length) { erros.push(`${r.nome}: texto de origem não achado`); return it; }

        let conds = it.condicoesAplicadas || [];
        if (r.chance) {
            const antes = conds.length;
            conds = conds.map(c => c.condicao === r.chance.condicao ? { ...c, chance: r.chance.valor } : c);
            if (conds.length !== antes) erros.push(`${r.nome}: perdeu condição`);
            if (!conds.some(c => c.condicao === r.chance.condicao)) erros.push(`${r.nome}: ${r.chance.condicao} não achada`);
        }
        if (r.remover) {
            const antes = conds.length;
            conds = conds.filter(c => c.condicao !== r.remover);
            if (conds.length !== antes - 1) erros.push(`${r.nome}: esperava remover 1 ${r.remover}`);
        }
        mexeu = true;
        plano.push({ nome: r.nome, modulo: m.titulo, trocas, conds });
        return { ...it, descricao: desc, valores, condicoesAplicadas: conds };
    });
    if (mexeu) alterados.set(d.ref, itens);
}
const naoAchados = REPAROS.filter(r => !plano.some(p => p.nome === r.nome));
if (naoAchados.length) erros.push(`itens não achados: ${naoAchados.map(r => r.nome).join(', ')}`);

console.log('=== Pauta da frente de condições ===\n');
for (const p of plano) {
    console.log(`▸ ${p.nome}  [${p.modulo}]`);
    console.log(`   texto: ${p.trocas.join(' + ')}`);
    console.log(`   cond:  ${JSON.stringify(p.conds)}`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
for (const [ref, itens] of alterados) batch.update(ref, { itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
await batch.commit();
console.log('\n✅ Gravado.');
process.exit(0);
