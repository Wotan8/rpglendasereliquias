/**
 * Hemomancia estava cadastrada como perícia mental universal, aparecendo para
 * todo personagem. É exclusiva do Sangral, como as outras 6 hemáticas.
 * node functions/corrigir-hemomancia.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ID = 'y2bEPzaHq7PiDYUJtTGH'; // Hemomancia

const ref = db.doc(`system/data/skills/${ID}`);
const snap = await ref.get();
if (!snap.exists) throw new Error('Hemomancia não encontrada');
const antes = snap.data();
console.log(`antes: ${antes.nome} categoria=${antes.categoria} todoPersonagem=${antes.todoPersonagem}`);

await ref.update({
  categoria: 'exclusivo',
  todoPersonagem: false,
  atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
});

const depois = (await ref.get()).data();
console.log(`depois: ${depois.nome} categoria=${depois.categoria} todoPersonagem=${depois.todoPersonagem}`);

// Confere que o Sangral continua sendo a única classe que a concede
const classes = (await db.collection('system/data/classes').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const donas = classes.filter(c => (c.pericClasse || []).some(p => (typeof p === 'object' ? p.nome : p) === ID));
console.log(`classes que concedem Hemomancia: ${donas.map(c => c.nome).join(', ') || '(nenhuma!)'}`);
if (donas.length !== 1 || donas[0].nome !== 'Sangral') throw new Error('vínculo de classe inesperado');
console.log('✅ ok');
process.exit(0);
