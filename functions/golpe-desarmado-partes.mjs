/**
 * Golpe desarmado 100% no CADASTRO — remove a última regra cravada em código.
 *
 * Para cada Parte do Corpo com podeGolpear, grava (só onde está vazio):
 *   formulaDano  '1d4'            (Livro 6.8 — agora como DADO, editável)
 *   tipoGolpe    ['contundente']  (soco/chute/cabeçada — Blindagem Contundente)
 *   valoresDerivadosVinculados    Acerto Desarmado = FOR + Perícia: Briga
 *                                 (Livro 6.3 — mesma Equação de Valor que uma
 *                                 arma usa para o próprio acerto tipado)
 *
 * O VD "Acerto Desarmado" já soma o Acerto global pela mecânica intrínseca;
 * o vínculo da parte entra por cima, preso àquela parte — sem contagem dupla.
 *
 * node functions/golpe-desarmado-partes.mjs          (mostra o que faria)
 * node functions/golpe-desarmado-partes.mjs --gravar (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DV_ACERTO_DESARMADO = 'H9VopkYPpDz3MXssdHP9';
const VINCULO = [{
    id: DV_ACERTO_DESARMADO,
    equacao: [{ tipo: 'ficha', ref: 'FOR' }, { op: '+', tipo: 'ficha', ref: 'Perícia: Briga' }],
}];
const gravar = process.argv.includes('--gravar');

const snap = await db.collection('system/data/bodyParts').get();
const batch = db.batch();
let mudou = 0;

for (const doc of snap.docs) {
    const b = doc.data();
    if (!b.podeGolpear) continue;
    const patch = {};
    if (!b.formulaDano) patch.formulaDano = '1d4';
    if (!(Array.isArray(b.tipoGolpe) ? b.tipoGolpe.length : b.tipoGolpe)) patch.tipoGolpe = ['contundente'];
    if (!(b.valoresDerivadosVinculados || []).length) patch.valoresDerivadosVinculados = VINCULO;
    if (!Object.keys(patch).length) {
        console.log(`   = ${b.icone || ''} ${b.nome} — já completo`);
        continue;
    }
    console.log(`   ✔ ${b.icone || ''} ${b.nome} → ${Object.keys(patch).join(', ')}`);
    batch.update(doc.ref, patch);
    mudou++;
}

if (!mudou) { console.log('\nNada a mudar.'); process.exit(0); }
if (!gravar) { console.log(`\n${mudou} parte(s) mudariam. Rode com --gravar para aplicar.`); process.exit(0); }
await batch.commit();
console.log(`\n✅ ${mudou} parte(s) atualizadas.`);
process.exit(0);
