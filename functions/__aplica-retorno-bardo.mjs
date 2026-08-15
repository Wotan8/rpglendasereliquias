/**
 * A regra de Harmonia do Bardo, dita pelo mestre, virando cadastro:
 *
 *   No fim do turno ele recupera em Harmonia o MESMO valor que gastou para
 *   conjurar; +1 se ficou parado (não gastou a Ação de Movimento); e se falhou
 *   no teste, a música quebra e a Harmonia acumulada vai a zero.
 *
 * O "+1 fixo" e o "falhou zera tudo" foram confirmados pelo mestre em 14/08/2026.
 * Antes disso só existia a metade que está na descrição do VD Harmonia ("se o
 * Bardo falhar... toda a HAR acumulada é perdida") — o +1 não estava em lugar
 * nenhum do banco.
 *
 *   node functions/__aplica-retorno-bardo.mjs            (dry-run)
 *   node functions/__aplica-retorno-bardo.mjs --apply
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

const CFG = {
    retornoRecurso: 'Harmonia',
    retornoBonusParado: 1,
    retornoExigeSucesso: true,
    retornoZeraSeFalhar: true,
};

// Os módulos do Repertório Sonoro. A regra é do Bardo, então vale em todos os
// círculos — não é privilégio de um deles.
const snap = await db.collection('system/data/classModules').get();
let n = 0;
for (const d of snap.docs) {
    if (!/^sonoro_c\d+$/.test(d.id)) continue;
    const m = d.data();
    const igual = Object.entries(CFG).every(([k, v]) => m[k] === v);
    if (igual) { console.log(`   = ${d.id} já bate`); continue; }
    console.log(`   ↻ ${d.id}: ${JSON.stringify(CFG)}`);
    n++;
    if (APLICAR) await d.ref.update({ ...CFG, updatedAt: admin.firestore.Timestamp.now() });
}
console.log(`\n${n} módulo(s) a mudar`);
console.log(APLICAR ? '✅ APLICADO' : '🔍 dry-run — rode com --apply para gravar');
process.exit(0);
