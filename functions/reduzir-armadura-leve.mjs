/**
 * Armadura Leve: 5 slots -> 4, tirando a Cintura.
 *
 * Com a taxa Leve a 0,20 ela dava 1,00 cobrindo 5 slots e passava por cima do
 * Couro Cravejado e do Couro Reforçado (Média, 4 slots, 0,88, Furt −1): mais
 * Blindagem, mais barata E sem penalidade. A 4 slots ela fica com 0,80 e a
 * mesma cobertura dos dois — vira troca legítima: o couro Média cobra 300 a
 * mais e uma Furtividade pra entregar 0,08 de Blindagem.
 *
 * Sai a Cintura (e não um Ombro) porque meia ombreira não existe.
 * O preço volta a 1.200: os 1.400 tinham sido calibrados pro item de 5 slots.
 *
 *   node functions/reduzir-armadura-leve.mjs            (dry-run)
 *   node functions/reduzir-armadura-leve.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const TAXA = { 'Leve': 0.20, 'Média': 0.22 };
const PRECO = 1200;
const ARTIGO = 'worldbuilding-articles/art-regras-jogador-05';

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, bp, skills] = await Promise.all(['equipment', 'derivedValues', 'bodyParts', 'skills'].map(grab));
const BL = dvs.find(d => d.nome === 'Blindagem').id;
const FURT = skills.find(s => s.nome === 'Furtividade').id;
const PARTE = Object.fromEntries(bp.map(p => [p.nome, p.id]));
const NOME = Object.fromEntries(bp.map(p => [p.id, p.nome]));
const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const slotsDe = e => 1 + (e.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0);
const furtDe = e => (e.periciasVinculadas || []).find(p => p.id === FURT)?.modificador ?? 0;
const item = n => eq.find(x => (x.nome || '').trim() === n);
const num = n => n.toFixed(2).replace('.', ',');

const leve = item('Armadura Leve');
const EXTRAS = [{ id: PARTE['Costas'], quantidade: 1 }, { id: PARTE['Ombro'], quantidade: 2 }];
const SLOTS = 1 + EXTRAS.reduce((a, s) => a + s.quantidade, 0);
const NOVA_BL = Math.round(TAXA.Leve * SLOTS * 100) / 100;

const cobertura = (principal, extras) => [principal, ...extras.flatMap(s => Array(s.quantidade).fill(NOME[s.id]))].join(', ');

console.log('\n=== ARMADURA LEVE ===\n');
console.log(`  cobertura: ${slotsDe(leve)} slots (${cobertura('Torso', leve.slotsAdicionais)})`);
console.log(`          -> ${SLOTS} slots (${cobertura('Torso', EXTRAS)})`);
console.log(`  Blindagem: ${num(blDe(leve))} -> ${num(NOVA_BL)}   (${TAXA.Leve} × ${SLOTS})`);
console.log(`  preço:     ${leve.preco} -> ${PRECO}`);
console.log(`  na mesa:   ${Math.floor(blDe(leve))} -> ${Math.floor(NOVA_BL)}  (${(24 / Math.max(1, 7.5 - Math.floor(blDe(leve)))).toFixed(1)} -> ${(24 / Math.max(1, 7.5 - Math.floor(NOVA_BL))).toFixed(1)} golpes)`);

console.log('\n=== CONTRA O COURO MÉDIA (mesma cobertura, 4 slots) ===\n');
const rivais = ['Couro Reforçado', 'Couro Cravejado'].map(item);
console.log(`  Armadura Leve       ${SLOTS} slots · Bl ${num(NOVA_BL)} · ${PRECO} · sem penalidade`);
for (const r of rivais)
    console.log(`  ${r.nome.padEnd(19)} ${slotsDe(r)} slots · Bl ${num(blDe(r))} · ${r.preco} · Furt ${furtDe(r)}`);

console.log('\n=== ESCADA DA FAIXA LEVE ===\n');
leve.slotsAdicionais = EXTRAS; leve.preco = PRECO;   // em memória, pra tabela e asserts
leve.valoresDerivadosVinculados = [{ id: BL, modificador: NOVA_BL }];
const faixa = eq.filter(e => (e.tags || []).includes('Leve') && (e.tags || []).includes('Armadura'))
    .map(e => ({ nome: e.nome, slots: slotsDe(e), bl: blDe(e), preco: e.preco }))
    .sort((a, b) => a.slots - b.slots || a.preco - b.preco);
console.log('  peça                slots    Bl    preço   Bl/1.000');
for (const f of faixa)
    console.log(`  ${f.nome.padEnd(19)} ${String(f.slots).padStart(3)}   ${num(f.bl)}   ${String(f.preco).padStart(5)}   ${(f.bl / f.preco * 1000).toFixed(2)}`);

// --- Capítulo 5 do Livro ---------------------------------------------------
let html = (await db.doc(ARTIGO).get()).data().contentHTML;
const LINHAS = [
    [`<tr><td>Armadura Leve</td><td>Leve</td><td>5</td><td><strong>1,00</strong></td>`,
     `<tr><td>Armadura Leve</td><td>Leve</td><td>4</td><td><strong>0,80</strong></td>`],
    [`<tr><td>Armadura Leve</td><td>Torso, Costas, 2 Ombros, Cintura</td></tr>`,
     `<tr><td>Armadura Leve</td><td>Torso, Costas, 2 Ombros</td></tr>`],
];
console.log('\n=== CAPÍTULO 5 DO LIVRO (público) ===\n');
for (const [de, para] of LINHAS) {
    const n = html.split(de).length - 1;
    console.log(`  ${n === 1 ? '✔' : '✖'} ${n} ocorrência(s): ${de.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    html = html.split(de).join(para);
}

console.log('\n=== INVARIANTES ===\n');
const checa = (r, fn) => { fn(); console.log(`  ✔ ${r}`); };
checa('4 slots e Blindagem = 0,20 × 4', () => {
    assert.equal(SLOTS, 4);
    assert.equal(NOVA_BL, Math.round(TAXA.Leve * 4 * 100) / 100);
});
checa('sai a Cintura, os Ombros continuam em par', () => {
    assert(!EXTRAS.some(s => s.id === PARTE['Cintura']));
    assert.equal(EXTRAS.find(s => s.id === PARTE['Ombro']).quantidade, 2);
});
checa('não domina mais o couro Média: mesma cobertura, menos Blindagem', () =>
    rivais.forEach(r => {
        assert.equal(slotsDe(r), SLOTS, `${r.nome} cobre ${slotsDe(r)}, não ${SLOTS}`);
        assert(NOVA_BL < blDe(r), `${r.nome}: ${num(blDe(r))} não é mais que ${num(NOVA_BL)}`);
    }));
checa('quem cobra mais caro entrega mais Blindagem', () =>
    rivais.forEach(r => assert(r.preco > PRECO && blDe(r) > NOVA_BL, r.nome)));
checa('escada Leve: mais cobertura = menos Blindagem por moeda', () => {
    for (let i = 1; i < faixa.length; i++)
        if (faixa[i].slots > faixa[i - 1].slots)
            assert(faixa[i].bl / faixa[i].preco <= faixa[i - 1].bl / faixa[i - 1].preco, faixa[i].nome);
});
checa('cada linha do Capítulo 5 casou exatamente uma vez', () =>
    LINHAS.forEach(([, para]) => assert.equal(html.split(para).length - 1, 1, para)));

if (!APPLY) { console.log('\nDRY-RUN — 1 peça + o Capítulo 5. Rode com --apply.\n'); process.exit(); }

const lote = db.batch();
lote.update(db.doc(`system/data/equipment/${leve.id}`), {
    slotsAdicionais: EXTRAS,
    valoresDerivadosVinculados: [{ id: BL, modificador: NOVA_BL }],
    preco: PRECO,
    atualizadoEm: new Date(),
});
lote.update(db.doc(ARTIGO), { contentHTML: html, updatedAt: new Date() });
await lote.commit();
console.log('\n✔ Armadura Leve em 4 slots (Bl 0,80 · 1.200) e o Capítulo 5 atualizado.\n');
process.exit();
