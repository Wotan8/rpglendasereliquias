/**
 * PREPARAR O TERRENO DA INTEGRIDADE
 *
 * Duas coisas, uma vez só:
 *
 * 1. TRÊS CONSERTOS DE CADASTRO. Números de fábrica que fariam a peça apodrecer
 *    sozinha no dia em que a regra entrasse — exatamente o que a doutrina de
 *    `cabeNoConteiner` jurou não fazer ("vazio = sem limite; nada de inventar
 *    padrão"). Se o cadastro está errado, conserta-se o cadastro.
 *
 * 2. LIMPEZA DO CAMPO LEGADO. 143 docs de `items` carregam `integridade` e
 *    `dureza` de v1.6, com valores que nem batem entre si (em 62 deles
 *    `integridade ≠ dureza + tamanho`) e um `999999`. Nada no site lê esses
 *    campos hoje. Deixá-los é convidar quem abrir o Firestore em três meses a
 *    achar que achou o campo novo — que se chama `avaria` e guarda o dano
 *    acumulado, não o que resta.
 *
 *   node functions/preparar-integridade.mjs            # dry-run
 *   node functions/preparar-integridade.mjs --apply    # grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const { FieldValue } = admin.firestore;

/** (Liga + Tamanho) × 3, mínimo 3 — espelha integridadeMax do motor. */
const integ = (x) => {
    const liga = Number(x.liga);
    return Math.max(3, ((Number.isFinite(liga) ? liga : 1) + (Number(x.tamanho) || 1)) * 3);
};

// ---------- 1. os três consertos ----------
const CONSERTOS = [
    { nome: /^Aljava/i, campo: 'pesoMaximoContainer', de: 1, para: 1.5,
      porque: 'capacidade 20 × flecha 0,05 = 1,00 kg exato — margem zero de fábrica' },
    { nome: /^Mochila Grande/i, campo: 'tamanho', de: 1, para: 5,
      porque: '50 kg de teto com o tamanho de fábrica daria a Integridade de uma aljava' },
    { nome: /^Caixa de Ferro/i, campo: 'liga', de: undefined, para: 3,
      porque: 'é ferro; liga vazia lê 1 e daria a uma caixa de aço a dureza de couro' },
];

console.log('=== 1. consertos de cadastro ===');
const eq = await db.collection('system/data/equipment').get();
let consertados = 0;
for (const d of eq.docs) {
    const x = d.data();
    for (const c of CONSERTOS) {
        if (!c.nome.test(x.nome || '')) continue;
        const atual = x[c.campo];
        if (atual === c.para) continue;                       // já está certo
        if (c.de !== undefined && Number(atual) !== c.de) continue;
        if (c.de === undefined && atual !== undefined && atual !== null && atual !== '') continue;
        consertados++;
        console.log(`  ${APPLY ? '✍️ ' : '· '}${x.nome}: ${c.campo} ${atual ?? '(vazio)'} → ${c.para}`);
        console.log(`      Integridade ${integ(x)} → ${integ({ ...x, [c.campo]: c.para })}   ·   ${c.porque}`);
        if (APPLY) await d.ref.update({ [c.campo]: c.para, updatedAt: new Date().toISOString() });
    }
}
console.log(`  ${consertados} conserto(s)`);

// ---------- 2. o campo legado ----------
console.log('\n=== 2. campo legado de v1.6 ===');
let limpos = 0;
for (const col of ['items', 'containers']) {
    const s = await db.collection(col).get();
    let n = 0;
    for (const d of s.docs) {
        const x = d.data();
        if (x.integridade === undefined && x.dureza === undefined) continue;
        n++; limpos++;
        if (APPLY) await d.ref.update({ integridade: FieldValue.delete(), dureza: FieldValue.delete() });
    }
    if (n) console.log(`  ${APPLY ? '✍️ ' : '· '}${col}: ${n} doc(s) com integridade/dureza de v1.6`);
}
console.log(`  ${limpos} doc(s) ${APPLY ? 'limpos' : 'a limpar'}`);

if (!APPLY) console.log('\nRode de novo com --apply para gravar.');
