/**
 * Couro Batido: ancora só no Torso, e conserta a escada de preço da faixa Leve.
 *
 * A Blindagem dele já está no modelo (taxa Leve × 3 slots) — não muda. O que
 * estava torto era a eficiência: a faixa Leve tem que perder Blindagem por moeda
 * conforme a cobertura cresce (é assim na Pesada: Placas 0,44 -> Torneio 0,20), e
 * a Armadura Leve a 1.200 rendia MAIS por moeda que o Couro Batido cobrindo 2
 * slots a mais. O 800 do Couro Batido é preço do Livro; o 1.200 da Armadura Leve
 * fui eu que inventei ontem (ela estava sem preço). Então quem cede é o 1.200.
 *
 *   node functions/balancear-couro-batido.mjs            (dry-run)
 *   node functions/balancear-couro-batido.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const TAXA_LEVE = 0.20;
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, bp, dvs] = await Promise.all(['equipment', 'bodyParts', 'derivedValues'].map(grab));
const NOME = Object.fromEntries(bp.map(p => [p.id, p.nome]));
const TORSO = bp.find(p => p.nome === 'Torso').id;
const BL = dvs.find(d => d.nome === 'Blindagem').id;
const item = n => eq.find(x => (x.nome || '').trim() === n);
const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const slotsDe = e => 1 + (e.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0);

const couro = item('Couro Batido');
const leve = item('Armadura Leve');
const PRECO_ARMADURA_LEVE = 1400;   // era 1.200

console.log('\n=== COURO BATIDO ===\n');
console.log(`  âncora (equipavelEm): [${couro.equipavelEm.map(i => NOME[i]).join(', ')}] -> [Torso]`);
console.log(`  cobertura: ${slotsDe(couro)} slots (${[NOME[couro.equipavelEm[0]], ...(couro.slotsAdicionais || []).map(s => NOME[s.id])].join(', ')}) — não muda`);
console.log(`  Blindagem: ${blDe(couro)} = ${TAXA_LEVE} × ${slotsDe(couro)} — já está no modelo, não muda`);
console.log(`  peso ${couro.peso} · preço ${couro.preco} (do Livro) · penalidade nenhuma — não muda`);

const faixa = () => ['Gibão Acolchoado', 'Couro Leve', 'Manto de Linho', 'Couro Batido', 'Armadura Leve']
    .map(n => { const e = item(n); return { nome: n, slots: slotsDe(e), bl: blDe(e), preco: e.preco }; })
    .sort((a, b) => a.slots - b.slots || a.preco - b.preco);

const tabela = rotulo => {
    console.log(`\n  ${rotulo}`);
    console.log('  peça                slots    Bl     preço   por slot   Bl/1.000');
    for (const f of faixa())
        console.log(`  ${f.nome.padEnd(19)} ${String(f.slots).padStart(3)}   ${f.bl.toFixed(2)}   ${String(f.preco).padStart(6)}   ${String(Math.round(f.preco / f.slots)).padStart(7)}   ${(f.bl / f.preco * 1000).toFixed(2)}`);
};
console.log('\n=== ESCADA DA FAIXA LEVE ===');
tabela('ANTES:');
leve.preco = PRECO_ARMADURA_LEVE;            // em memória, pra tabela e asserts
tabela('DEPOIS:');

console.log('\n=== JANELA LETAL (golpe 7,5 · Vitalidade 24) ===\n');
for (const f of faixa())
    console.log(`  ${f.nome.padEnd(19)} Bl ${f.bl.toFixed(2)} -> a mesa usa ${Math.floor(f.bl)}  ->  ${(24 / Math.max(1, 7.5 - Math.floor(f.bl))).toFixed(1)} golpes`);
console.log('\n  ⚠ toda a faixa Leve arredonda pra 0. Nenhuma peça Leve, sozinha ou somada,');
console.log('    chega a 1 de Blindagem — a maior cobertura Leve possível é 0,75 (Armadura Leve).');

console.log('\n=== INVARIANTES ===\n');
const checa = (r, fn) => { fn(); console.log(`  ✔ ${r}`); };
checa('Blindagem do Couro Batido continua = taxa × slots', () =>
    assert.equal(blDe(couro), Math.round(TAXA_LEVE * slotsDe(couro) * 100) / 100));
checa('cobertura do Couro Batido intacta (3 slots)', () => assert.equal(slotsDe(couro), 3));
checa('Couro Batido ancora só no Torso, e o Torso não está na cobertura extra', () =>
    assert(!(couro.slotsAdicionais || []).some(s => s.id === TORSO)));
checa('escada Leve: mais cobertura = menos Blindagem por moeda', () => {
    const f = faixa();
    for (let i = 1; i < f.length; i++)
        if (f[i].slots > f[i - 1].slots)
            assert(f[i].bl / f[i].preco <= f[i - 1].bl / f[i - 1].preco,
                `${f[i].nome} rende mais por moeda que ${f[i - 1].nome} cobrindo mais`);
});
checa('nenhum preço do Livro foi mexido', () =>
    ['Gibão Acolchoado', 'Couro Leve', 'Couro Batido'].forEach(n =>
        assert(item(n).preco === { 'Gibão Acolchoado': 300, 'Couro Leve': 400, 'Couro Batido': 800 }[n], n)));

if (!APPLY) { console.log('\nDRY-RUN — 2 itens seriam alterados. Rode com --apply.\n'); process.exit(); }

const lote = db.batch();
lote.update(db.doc(`system/data/equipment/${couro.id}`), { equipavelEm: [TORSO], atualizadoEm: new Date() });
lote.update(db.doc(`system/data/equipment/${leve.id}`), { preco: PRECO_ARMADURA_LEVE, atualizadoEm: new Date() });
await lote.commit();
console.log('\n✔ Couro Batido ancorado só no Torso · Armadura Leve 1.200 -> 1.400.\n');
process.exit();
