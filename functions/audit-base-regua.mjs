/**
 * AUDITORIA — todo carimbo esta na base atual da unidade?
 *
 * O combate v3 moveu a unidade de 3,445 para 3,90 (Regua §0.2). Carimbo feito
 * na base velha nao e comparavel com carimbo feito na nova: as taxas de dano
 * (0,290 -> 0,256) e de "atacar quem nao pode reagir" (0,320 -> 0,167) mudaram.
 *
 * Carimbo SEM o campo `base` e pre-16/08/2026, portanto base 3,445.
 *
 * SO LEITURA. Sai com 1 se achar carimbo fora da base atual.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const BASE_ATUAL = 3.90;

const classeDe = {};
for (const doc of (await db.collection('system').doc('data').collection('classes').get()).docs)
    for (const m of (doc.data().modulosDaClasse || [])) classeDe[m] = doc.data().nome;

const velhos = [];
let atuais = 0;
for (const doc of (await db.collection('system').doc('data').collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    for (const p of (m.itensPredefinidos || [])) {
        if (!p.regua) continue;
        if (p.regua.base === BASE_ATUAL) { atuais++; continue; }
        velhos.push(`${classeDe[doc.id] || '?'} · ${p.nome}  (base ${p.regua.base ?? 3.445}, ${p.regua.razao ?? '—'}x)`);
    }
}
console.log(`${atuais} carimbos na base ${BASE_ATUAL}`);
if (velhos.length) {
    console.log(`\n${velhos.length} ainda na base 3,445 — precisam ser recompostos termo a termo:`);
    velhos.forEach(v => console.log(`  . ${v}`));
}
process.exit(velhos.length ? 1 : 0);
