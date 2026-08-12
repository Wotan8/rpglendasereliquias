/**
 * A ficha reconstrói peculiaridades individuais a partir de state.dots['pec_*'],
 * o que ressuscita o que o Mestre apagou. Antes de tirar essa reconstrução:
 * quantos personagens ainda dependem dela (dot sem entrada na lista)?
 * node functions/audit-pec-dots-orfaos.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const pecs = new Map((await db.collection('system/data/peculiarities').get())
    .docs.map(d => [d.id, d.data()]));

let comDot = 0, dependentes = 0;
for (const doc of (await db.collection('char').get()).docs) {
    const d = doc.data();
    const nome = (d.fields && d.fields.nome) || d.nome || doc.id;
    const lista = (d.peculiaridadesIndividuais || []).map(p => (typeof p === 'object' ? p.id : p));
    const dots = Object.keys(d.dots || {}).filter(k => k.startsWith('pec_')).map(k => k.slice(4));

    const orfaos = dots.filter(id => {
        const p = pecs.get(id);
        return p && /individual/i.test(p.fonte || '') && !lista.includes(id);
    });
    if (dots.length) comDot++;
    if (!orfaos.length) continue;

    dependentes++;
    console.log(`\n${nome}  [char/${doc.id}]`);
    for (const id of orfaos) {
        console.log(`   dot pec_${id} = ${d.dots['pec_' + id]}  → "${pecs.get(id).nome}" (fora da lista)`);
    }
}

console.log(`\n${comDot} personagens com dots de peculiaridade · ${dependentes} com dot órfão (a reconstrução inventaria a pec).`);
process.exit(0);
