/**
 * Mostra a MESA DE SORTEIO de um Eco real, do jeito que o Mestre vai ver na
 * janela do Tabuleiro: uma linha por grupo, os candidatos numerados e o dado.
 *
 * Serve para conferir os dados contra o catálogo de verdade antes de desenhar
 * a janela — o número de Sentidos e de Deslocamentos vem do banco, então é o
 * cadastro que decide o dado, não o código.
 *
 *   node functions/mesa-de-sorteio-preview.mjs [nome do Eco]
 */
import { createRequire } from 'node:module';
import { mesaDeSorteio } from '../shared/dadiva.js';
import { dadivasDoHospede } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const ALVO = process.argv[2] || 'Velho de Muitas Vidas';

const pericias = [], derivedValues = [];
const nomePericia = {};
for (const d of (await db.collection('system').doc('data').collection('skills').get()).docs) {
    const s = d.data(); nomePericia[d.id] = s.nome;
    pericias.push({ nome: s.nome, categoria: s.categoria });
}
for (const d of (await db.collection('system').doc('data').collection('derivedValues').get()).docs) {
    const v = d.data(); derivedValues.push({ key: v.key || v.nome, nome: v.nome, blocoNome: v.blocoNome });
}
const catalogo = { pericias, derivedValues };

const doc = (await db.collection('npcs').get()).docs.find(d => (d.data().nome || '').includes(ALVO));
if (!doc) { console.error(`nao achei Eco com "${ALVO}"`); process.exit(1); }
const n = doc.data();
// a ficha normalizada que o motor consome
const ficha = {
    atributos: n.atributos || {},
    pericias: Object.fromEntries((n.periciasEstruturadas || []).map(p => [nomePericia[p.refId] || p.refId, p.nivel])),
    vitais: { vitMax: n.valoresDer?.VIT || 0, enerMax: n.valoresDer?.ENER || 0 },
    vds: n.valoresDer || {},
};

console.log(`## ${n.nome} — ${n.papel || ''}\n`);
const linhas = mesaDeSorteio(dadivasDoHospede(ficha, 'eco'), ficha, catalogo);
for (const l of linhas) {
    const d = l.dado;
    const rerrola = d.rerrolaAcimaDe ? `, rerrola acima de ${d.rerrolaAcimaDe}` : '';
    console.log(`${l.icone} ${l.categoria.padEnd(22)} ${d.rotulo.padEnd(5)} → ${l.candidatos.map(c => `${c.n}=${c.nome}`).join('  ')}  ${d.nenhumEm}=NENHUM${rerrola}`);
}
console.log(`\n${linhas.length} rolagens · chance de anular: 1 em (candidatos+1) em cada uma`);
console.log(`Habilidade não rola — vem inteira: ${(n.modulosClasse || []).map(m => m.refId).join(', ') || '(nenhum módulo)'}`);
process.exit(0);
