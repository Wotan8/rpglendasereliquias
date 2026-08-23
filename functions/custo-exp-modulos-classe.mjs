/**
 * CUSTO EM EXP DAS SKILLS DE CLASSE — o nível do módulo é o preço.
 *
 * Decisão do usuário (23/08/2026): cada módulo é 1 nível na escola mágica a que
 * pertence, e o preço da skill é o NÍVEL DO MÓDULO em EXP — 1, 2, 3, 4, 5.
 * Não é a régua de perícia (4N): skill não é perícia.
 *
 *   Bardo (Sonoromancia) ..... Abertura 1 · Desenvolvimento 2 · Clímax 3 · Apoteose 4 · Opus Magnum 5
 *   Sangral (Hemomancia) ..... Básico 1 · Intermediário 2 · Avançado 3 · Mestre 4
 *   Pallacerdote (Pallomancia) Diácono 1 · Sábio 2 · Bispo 3
 *   Classes de módulo único .. 1
 *
 * FICAM DE FORA (módulos irmãos, que não formam escada — nível ainda por decidir):
 *   Druida (Loções Defensiva/Ofensiva, Ferinismo), Xamã (Rituais da Totemancia,
 *   Golpes do Verde), Pallacerdote (Rituais e Liturgia), Caçador (Loções Ofensiva).
 *   Fora também "Cartucho Rúnico": item criado pelo jogador no Laboratorium, sem
 *   pré-definidos — cobrar por cartucho taxaria consumível, não habilidade.
 *
 * Quem cobra: ficha-v1.7_1/js/class-modules-renderer.js (_cmValidarECobrar), pelo
 * campo `custoExpPorItem` do módulo. Nada de código muda aqui — só o cadastro.
 *
 *   node functions/custo-exp-modulos-classe.mjs          (dry-run)
 *   node functions/custo-exp-modulos-classe.mjs --gravar
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const GRAVAR = process.argv.includes('--gravar');

/* módulo → nível na escada da sua escola */
const NIVEL = {
    // Bardo — Sonoromancia
    sonoro_c1: 1, sonoro_c2: 2, sonoro_c3: 3, sonoro_c4: 4, sonoro_c5: 5,
    // Sangral — Hemomancia
    GUs2Zi2NPTnFT26UCIcW: 1, WJysyXHGIeKTBSFBYQgn: 2, Vav6fXgHrCL8GyWfEQbP: 3, bZG3VnGjJc3Js7SJLzI0: 4,
    // Pallacerdote — Pallomancia
    mod_palla_c1: 1, oWJHvVaZZctpOdFyeZXx: 2, FjWjJ8MIcxStfQV4qmgQ: 3,
    // classes de módulo único
    manobras_guerreiro: 1, manobras_ladino: 1, manobras_cacador: 1,
    ritual_necro: 1, TbRKh68m2hvr9KUVrOXb: 1,
};

const col = db.collection('system/data/classModules');
const classeDoMod = new Map();
for (const c of (await db.collection('system/data/classes').get()).docs)
    for (const id of c.data().modulosDaClasse || []) classeDoMod.set(id, c.data().nome);

const patch = [];
for (const [id, nivel] of Object.entries(NIVEL)) {
    const snap = await col.doc(id).get();
    if (!snap.exists) throw new Error(`módulo ${id} não existe`);
    const m = snap.data();
    patch.push({ id, nivel, titulo: m.titulo, classe: classeDoMod.get(id) || '(sem classe)',
        de: m.custoExpPorItem ?? 0, itens: (m.itensPredefinidos || []).length });
}

console.log('classe                 nível  EXP/skill  skills  módulo');
for (const p of patch.sort((a, b) => (a.classe + a.nivel).localeCompare(b.classe + b.nivel)))
    console.log(`${p.classe.padEnd(22)} nv${p.nivel}    ${p.de} → ${p.nivel}      ${String(p.itens).padStart(2)}     ${p.titulo}`);

const totalSkills = patch.reduce((s, p) => s + p.itens, 0);
console.log(`\n${patch.length} módulos · ${totalSkills} skills passam a custar EXP`);

if (!GRAVAR) { console.log('\n(dry-run — rode com --gravar para aplicar)'); process.exit(0); }

const lote = db.batch();
for (const p of patch) lote.update(col.doc(p.id), { custoExpPorItem: p.nivel, atualizadoEm: new Date() });
await lote.commit();

/* auto-verificação: relê do banco */
for (const p of patch) {
    const m = (await col.doc(p.id).get()).data();
    assert.equal(m.custoExpPorItem, p.nivel, `${p.titulo} não gravou`);
}
// e o que ficou de fora continua como estava — as duas Receitas de Loções do
// Druida/Caçador já vinham cadastradas com 1 EXP/item de antes deste passe.
const FORA = { ally_animal: 0, mod_totem: 0, mod_verde_xama: null, rituais_palla: 0,
               cartucho_runico: null, gX31tLk7vRsTPDuay4h9: 1, WxIUefCzMIAcupHjqqxw: 1 };
for (const [id, esperado] of Object.entries(FORA)) {
    const m = (await col.doc(id).get()).data();
    assert.equal(m.custoExpPorItem ?? null, esperado, `${m.titulo} não deveria ter sido tocado`);
}
console.log('\n✅ gravado e conferido no banco.');
process.exit(0);
