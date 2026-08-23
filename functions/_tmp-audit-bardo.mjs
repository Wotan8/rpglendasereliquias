// SÓ LEITURA — inventário dos módulos do Bardo e contagem de lógica tipada.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const col = await db.collection('system').doc('data').collection('classModules').get();
let totalPredefs = 0, comLogica = 0;
for (const doc of col.docs) {
    const d = doc.data();
    const preds = d.itensPredefinidos || [];
    const nome = d.nome || d.titulo || doc.id;
    if (!/sono|bardo/i.test(doc.id + nome)) continue;
    console.log(`\n== ${doc.id} · ${nome} · ${preds.length} itens ==`);
    for (const p of preds) {
        totalPredefs++;
        const temMira = p.formaArea || p.alcance != null || p.alvosMax != null;
        const temCusto = p.custoCriacaoMecanicaIds?.length || (p.valores && Object.keys(p.valores).length);
        const temCond = p.condicoesAplicadas?.length;
        const acao = p.acao || (p.valores && p.valores.acao) || '';
        const ok = !!(temMira || temCusto || temCond);
        if (ok) comLogica++;
        console.log(`  ${ok ? 'OK ' : '!! '}${(p.nome || p.id).slice(0, 44).padEnd(45)} mira:${temMira ? 'sim' : '—'} custo:${temCusto ? 'sim' : '—'} cond:${temCond || 0} acao:${String(acao).slice(0, 18)}`);
    }
}
console.log(`\nBardo: ${comLogica}/${totalPredefs} itens com lógica tipada`);
process.exit(0);
