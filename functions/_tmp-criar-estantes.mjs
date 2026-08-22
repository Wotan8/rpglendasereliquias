/* Cria "Referencia interna" e "Sistema RPG" e vincula os livros. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--aplicar');
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const NOVAS = [
    { nome: 'Referência interna', livros: ['Bestiario', 'Régua de Balanceamento'] },
    { nome: 'Sistema RPG', livros: ['Lendas & Relíquias — Livro de Regras do Jogador', 'Régua de Balanceamento'] },
];

const ref = db.collection('worldbuilding-settings').doc('estantes');
const estantes = (await ref.get()).data().lista || [];
const books = (await db.collection('worldbuilding-books').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const das = (b) => b.estanteIds || (b.estanteId ? [b.estanteId] : []);

const plano = [];
for (const nova of NOVAS) {
    if (estantes.find(e => (e.nome || '').toLowerCase() === nova.nome.toLowerCase())) {
        console.error(`Ja existe estante "${nova.nome}" — abortando.`); process.exit(1);
    }
    const est = { id: uid('est'), nome: nova.nome, icone: '🗂️' };
    const alvos = nova.livros.map(t => {
        const b = books.find(x => (x.title || '') === t);
        if (!b) { console.error(`Livro nao encontrado: "${t}" — abortando.`); process.exit(1); }
        return b;
    });
    plano.push({ est, alvos });
    console.log(`${est.icone} ${est.nome}`);
    alvos.forEach(b => console.log(`   - ${b.title}  [estantes hoje: ${das(b).length}]`));
}
if (!APLICAR) { console.log('\nSIMULACAO. Rode com --aplicar para gravar.'); process.exit(0); }

await ref.set({ lista: [...estantes, ...plano.map(p => p.est)] }, { merge: true });
console.log(`\nestantes gravadas: ${estantes.length} -> ${estantes.length + plano.length}`);
const porLivro = new Map();
for (const { est, alvos } of plano)
    for (const b of alvos) porLivro.set(b.id, [...new Set([...(porLivro.get(b.id) || das(b)), est.id])]);
for (const [id, ids] of porLivro) {
    await db.collection('worldbuilding-books').doc(id).set({ estanteIds: ids, estanteId: null }, { merge: true });
    console.log(`gravado: ${books.find(b => b.id === id).title} -> ${ids.length} estante(s)`);
}
