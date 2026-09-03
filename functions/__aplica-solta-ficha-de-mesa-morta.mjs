/**
 * Solta as fichas que apontam para uma mesa que não existe mais.
 *
 * POR QUE EXISTE. Apagar uma mesa hoje já solta os personagens dela
 * (`confirmDeleteMesa` em painel-mestre/js/area-mesas.js grava `mesaId: null`
 * ANTES de apagar). Estas fichas são resíduo de antes dessa correção: ficaram
 * com `mesaId` apontando para o nada, e a ficha monta aba de mesa morta com
 * "companheiros" órfãos.
 *
 * O que faz: exatamente o que o fluxo de exclusão faria — `mesaId: null`.
 * Nada é apagado.
 *
 * Não é cânone (ficha de jogador não está na lista do CLAUDE.md: livro, raça,
 * classe, tribo, local, NPC, item, magia, peculiaridade, módulo), então não
 * há versão a subir.
 *
 *   node functions/__aplica-solta-ficha-de-mesa-morta.mjs           # só mostra
 *   node functions/__aplica-solta-ficha-de-mesa-morta.mjs --apply   # grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const mesas = new Set((await db.collection('mesas').get()).docs.map(d => d.id));
const chars = await db.collection('char').get();

const orfas = chars.docs.filter(d => {
    const m = d.data().mesaId;
    return m && !mesas.has(m);
});

console.log(`${mesas.size} mesas vivas · ${chars.size} fichas · ${orfas.length} apontando para mesa morta`);
for (const d of orfas) {
    const x = d.data();
    console.log(`  ${d.id}  "${x.fields?.nome || x.nome || 'sem nome'}"  ->  ${x.mesaId}`);
}

if (!orfas.length) { console.log('nada a fazer.'); process.exit(0); }

if (!APLICAR) {
    console.log('\n(nada foi gravado — rode com --apply)');
    process.exit(0);
}

// Lote: são poucas, e ou soltam todas ou nenhuma.
const lote = db.batch();
for (const d of orfas) lote.update(d.ref, { mesaId: null });
await lote.commit();
console.log(`\n${orfas.length} ficha(s) soltas.`);
process.exit(0);
