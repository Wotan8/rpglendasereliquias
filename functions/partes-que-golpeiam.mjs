/**
 * Marca quais Partes do Corpo golpeiam. A ficha usa isso para listar o golpe
 * desarmado na aba Ataques: parte que golpeia e está sem item equipado vira
 * uma linha com Acerto e Dano, como uma arma (dado 1d4, Livro 6.8).
 *
 * Soco, chute, joelhada, cabeçada e cotovelada. Torso, Costas, Ombro, Pescoço,
 * Cintura e Dedos ficam de fora — não são golpe, são lugar de vestir.
 * Partes de raça (Asa, Língua) ficam a seu critério no Painel do Criador.
 *
 * node functions/partes-que-golpeiam.mjs          (mostra o que faria)
 * node functions/partes-que-golpeiam.mjs --gravar (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const GOLPEIAM = ['Mão', 'Pé', 'Pernas', 'Cabeça', 'Braço'];
const gravar = process.argv.includes('--gravar');

const snap = await db.collection('system/data/bodyParts').get();
const batch = db.batch();
let mudou = 0;

for (const doc of snap.docs) {
    const b = doc.data();
    const alvo = GOLPEIAM.includes((b.nome || '').trim());
    if (!!b.podeGolpear === alvo) {
        console.log(`   = ${b.icone || ''} ${b.nome} — já está ${alvo ? 'golpeando' : 'fora'}`);
        continue;
    }
    console.log(`   ${alvo ? '✔' : '✖'} ${b.icone || ''} ${b.nome} → podeGolpear = ${alvo}`);
    batch.update(doc.ref, { podeGolpear: alvo });
    mudou++;
}

if (!mudou) { console.log('\nNada a mudar.'); process.exit(0); }
if (!gravar) { console.log(`\n${mudou} parte(s) mudariam. Rode com --gravar para aplicar.`); process.exit(0); }

await batch.commit();
console.log(`\n✅ ${mudou} parte(s) atualizadas.`);
process.exit(0);
