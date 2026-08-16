/**
 * Ajusta o golpe desarmado nas Partes do Corpo que podem golpear (Mão, Cabeça,
 * Pernas, Pé, Braço), via cadastro — nada cravado em código:
 *
 *   Acerto Desarmado  (maior entre FOR e DES) + Perícia: Briga
 *                     — antes era só FOR + Briga; parte finas/ágeis (chute,
 *                     cabeçada) agora também podem usar DES.
 *   Dano              soma FOR
 *                     — canal físico genérico (mesmo VD "Dano" que as armas
 *                     usam), agora também vinculado ao golpe desarmado.
 *
 * node functions/golpe-desarmado-dano-e-acerto.mjs           (mostra o que faria)
 * node functions/golpe-desarmado-dano-e-acerto.mjs --gravar  (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const gravar = process.argv.includes('--gravar');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const vds = await grab('derivedValues');
const vdId = nome => { const v = vds.find(x => x.nome === nome); if (!v) { console.error(`🔴 VD "${nome}" não existe.`); process.exit(1); } return v.id; };

const DV_ACERTO_DESARMADO = vdId('Acerto Desarmado');
const DV_DANO = vdId('Dano');

const EQUACAO_ACERTO = [
    { tipo: 'ficha', ref: 'FOR' },
    { op: 'max', tipo: 'ficha', ref: 'DES' },
    { op: '+', tipo: 'ficha', ref: 'Perícia: Briga' },
];
const EQUACAO_DANO = [{ tipo: 'ficha', ref: 'FOR' }];

const snap = await db.collection('system/data/bodyParts').get();
const batch = db.batch();
let mudou = 0;

for (const doc of snap.docs) {
    const b = doc.data();
    if (!b.podeGolpear) continue;

    const vinculos = Array.isArray(b.valoresDerivadosVinculados) ? [...b.valoresDerivadosVinculados] : [];
    let mudouEsta = false;

    const idxAcerto = vinculos.findIndex(v => v.id === DV_ACERTO_DESARMADO);
    if (idxAcerto >= 0) {
        vinculos[idxAcerto] = { ...vinculos[idxAcerto], equacao: EQUACAO_ACERTO };
    } else {
        vinculos.push({ id: DV_ACERTO_DESARMADO, equacao: EQUACAO_ACERTO });
    }
    mudouEsta = true; // sempre realinha a equação de Acerto Desarmado ao padrão novo

    const idxDano = vinculos.findIndex(v => v.id === DV_DANO);
    if (idxDano < 0) {
        vinculos.push({ id: DV_DANO, equacao: EQUACAO_DANO });
        mudouEsta = true;
    }

    if (!mudouEsta) {
        console.log(`   = ${b.icone || ''} ${b.nome} — já no padrão novo`);
        continue;
    }
    console.log(`   ✔ ${b.icone || ''} ${b.nome} → Acerto Desarmado: máx(FOR,DES)+Briga · Dano: +FOR`);
    batch.update(doc.ref, { valoresDerivadosVinculados: vinculos });
    mudou++;
}

if (!mudou) { console.log('\nNada a mudar.'); process.exit(0); }
if (!gravar) { console.log(`\n${mudou} parte(s) mudariam. Rode com --gravar para aplicar.`); process.exit(0); }
await batch.commit();
console.log(`\n✅ ${mudou} parte(s) atualizadas.`);
process.exit(0);
