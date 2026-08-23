import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');

const vds = (await D.collection('derivedValues').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const fam = /acerto|dano|defesa|rea[çc][ãa]o|blindagem/i;
console.log('### famílias Acerto / Dano / Defesa / Reação / Blindagem');
for (const v of vds.filter(v => fam.test(v.nome||'')).sort((a,b)=>(a.blocoOrdem-b.blocoOrdem)||(a.ordem-b.ordem))) {
    console.log(`  [${String(v.blocoOrdem??'').padStart(3)}/${String(v.ordem??'').padStart(3)}] ${(v.nome||'').padEnd(28)} escopoItem=${v.escopoItem||'—'}  bloco="${v.blocoNome||'—'}"  mec=${(v.mecanicaIds||[]).length}`);
}

console.log('\n### quem CITA "Reação" por ref de nome (equações e mecânicas)');
const alvo = /rea[çc][ãa]o/i;
for (const v of vds) {
    const eqs = JSON.stringify(v.equacaoValor ?? v.config ?? v.formula ?? '');
    if (alvo.test(eqs)) console.log(`  VD ${v.nome}`);
}
let nMec = 0;
for (const doc of (await D.collection('mechanics').get()).docs) {
    const d = doc.data();
    const j = JSON.stringify(d.config || {});
    if (/ref"\s*:\s*"Rea[çc][ãa]o"/i.test(j) || /"Rea[çc][ãa]o"/.test(j)) { console.log(`  MEC ${d.nome}`); nMec++; }
}
console.log(`  (${nMec} mecânicas)`);

console.log('\n### descrição completa do VD Reação e do VD Acerto (para comparar o papel)');
for (const v of vds.filter(v => /^(rea[çc][ãa]o|acerto|dano)$/i.test(v.nome||''))) {
    console.log(`\n-- ${v.nome} (${v.id}) · escopoItem=${v.escopoItem} · bloco=${v.blocoNome}`);
    console.log(`   ${v.descricao}`);
}
process.exit(0);
