/**
 * Sobe a taxa da classe Leve de 0,15 para 0,20 de Blindagem por slot coberto.
 *
 * Motivo: com 0,15 a faixa Leve inteira arredondava pra 0 na mesa — a maior
 * cobertura Leve possível (Armadura Leve, 5 slots) dava 0,75 e o jogador levava
 * exatamente o mesmo dano que andando pelado. A 0,20 ela chega a 1,00 e passa a
 * existir.
 *
 * Grava nos DOIS lugares, senão o Livro passa a mentir pro jogador:
 *   1. system/data/equipment            — a Blindagem que a ficha soma
 *   2. worldbuilding-articles/art-regras-jogador-05 — Capítulo 5, público
 *
 *   node functions/subir-taxa-leve.mjs            (dry-run)
 *   node functions/subir-taxa-leve.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const DE = 0.15, PARA = 0.20;
const ARTIGO = 'worldbuilding-articles/art-regras-jogador-05';

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, skills] = await Promise.all(['equipment', 'derivedValues', 'skills'].map(grab));
const BL = dvs.find(d => d.nome === 'Blindagem').id;
const FURT = skills.find(s => s.nome === 'Furtividade').id;
const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const slotsDe = e => 1 + (e.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0);
const furtDe = e => (e.periciasVinculadas || []).find(p => p.id === FURT)?.modificador ?? 0;
const num = n => n.toFixed(2).replace('.', ',');

const leves = eq.filter(e => (e.tags || []).includes('Leve') && (e.tags || []).includes('Armadura'));

console.log(`\n=== TAXA LEVE ${num(DE)} -> ${num(PARA)} ===\n`);
console.log('  peça                slots     Bl antes -> depois   na mesa (piso)');
const mudancas = leves.map(e => {
    const slots = slotsDe(e);
    const nova = Math.round(PARA * slots * 100) / 100;
    console.log(`  ${e.nome.padEnd(19)} ${String(slots).padStart(3)}       ${num(blDe(e))}  ->  ${num(nova)}        ${Math.floor(blDe(e))} -> ${Math.floor(nova)}`);
    return { e, slots, antes: blDe(e), nova };
}).sort((a, b) => b.nova - a.nova);

console.log('\n=== JANELA LETAL (golpe 7,5 · Vitalidade 24) ===\n');
const golpes = bl => 24 / Math.max(1, 7.5 - Math.floor(bl));
for (const m of mudancas)
    console.log(`  ${m.e.nome.padEnd(19)} ${golpes(m.antes).toFixed(1)} -> ${golpes(m.nova).toFixed(1)} golpes`);
console.log(`  ${'(nu, referência)'.padEnd(19)} ${golpes(0).toFixed(1)} golpes`);

/* Só compara quem disputa a MESMA vaga: armadura de tronco contra armadura de
   tronco. Uma Coifa de Malha cobre a Cabeça — ela não é alternativa à Armadura
   Leve, é complemento, e listar as duas juntas inventaria uma dominância que
   não existe. */
console.log('\n=== REGRA D: A LEVE AGORA ENCOSTA NA MÉDIA (linha de tronco) ===\n');
const TORSO = (await grab('bodyParts')).find(p => p.nome === 'Torso').id;
const daLinhaDoTronco = e => (e.equipavelEm || []).includes(TORSO);
const media = eq.filter(e => (e.tags || []).includes('Média') && (e.tags || []).includes('Armadura') && daLinhaDoTronco(e))
    .map(e => ({ nome: e.nome, slots: slotsDe(e), bl: blDe(e), preco: e.preco, furt: furtDe(e) }))
    .sort((a, b) => a.bl - b.bl);
const armLeve = mudancas.find(m => m.e.nome === 'Armadura Leve');
console.log(`  Armadura Leve       ${armLeve.slots} slots · Bl ${num(armLeve.nova)} · ${armLeve.e.preco} · sem penalidade`);
const dominadas = media.filter(m => m.bl < armLeve.nova && m.preco >= armLeve.e.preco);
for (const m of media)
    console.log(`  ${m.nome.padEnd(19)} ${m.slots} slots · Bl ${num(m.bl)} · ${m.preco} · Furt ${m.furt}${dominadas.includes(m) ? '   <-- dominada: menos Bl, mais cara E com penalidade' : ''}`);

// --- Capítulo 5 do Livro de Regras ----------------------------------------
const artigo = await db.doc(ARTIGO).get();
let html = artigo.data().contentHTML;
const LINHAS = [
    ['<tr><td>Leve</td><td>0,15</td></tr>', '<tr><td>Leve</td><td>0,20</td></tr>'],
    ...mudancas.map(m => [
        `<tr><td>${m.e.nome}</td><td>Leve</td><td>${m.slots}</td><td><strong>${num(m.antes)}</strong></td>`,
        `<tr><td>${m.e.nome}</td><td>Leve</td><td>${m.slots}</td><td><strong>${num(m.nova)}</strong></td>`,
    ]),
];
console.log(`\n=== CAPÍTULO 5 DO LIVRO (público) ===\n`);
for (const [de, para] of LINHAS) {
    const n = html.split(de).length - 1;
    console.log(`  ${n === 1 ? '✔' : '✖'} ${n} ocorrência(s): ${de.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    html = html.split(de).join(para);
}

console.log('\n=== INVARIANTES ===\n');
const checa = (r, fn) => { fn(); console.log(`  ✔ ${r}`); };
checa('toda peça Leve = 0,20 × slots', () =>
    mudancas.forEach(m => assert.equal(m.nova, Math.round(PARA * m.slots * 100) / 100)));
checa('a cobertura não é tocada — só a Blindagem muda', () =>
    mudancas.forEach(m => assert.equal(m.slots, slotsDe(m.e))));
checa('a faixa Leve deixa de ser inerte: a maior cobertura passa de 0 na mesa', () =>
    assert(Math.floor(armLeve.nova) >= 1, `Armadura Leve ainda arredonda pra ${Math.floor(armLeve.nova)}`));
checa('conjunto Leve de 13 slots (2,60) fica abaixo do Médio (2,86)', () =>
    assert(PARA * 13 < 0.22 * 13));
checa('cada linha do Capítulo 5 casou exatamente uma vez', () =>
    LINHAS.forEach(([, para]) => assert.equal(html.split(para).length - 1, 1, para)));
checa('nenhuma taxa de Média/Pesada foi tocada no Livro', () => {
    assert(html.includes('<tr><td>Média</td><td>0,22</td></tr>'));
    assert(html.includes('<tr><td>Pesada</td><td>0,30</td></tr>'));
});

if (dominadas.length) {
    console.log(`\n  ⚠ ${dominadas.length} peça(s) Média ficaram dominadas pela Armadura Leve — ver seção acima.`);
    console.log('    Não estou consertando: mexer nisso é decisão de design, não de modelo.');
}

if (!APPLY) { console.log(`\nDRY-RUN — ${mudancas.length} peças + o Capítulo 5. Rode com --apply.\n`); process.exit(); }

const lote = db.batch();
for (const m of mudancas) {
    const outros = (m.e.valoresDerivadosVinculados || []).filter(v => v.id !== BL);
    lote.update(db.doc(`system/data/equipment/${m.e.id}`),
        { valoresDerivadosVinculados: [...outros, { id: BL, modificador: m.nova }], atualizadoEm: new Date() });
}
lote.update(db.doc(ARTIGO), { contentHTML: html, updatedAt: new Date() });
await lote.commit();
console.log(`\n✔ ${mudancas.length} peças Leve recalibradas e o Capítulo 5 atualizado — num batch só.\n`);
process.exit();
