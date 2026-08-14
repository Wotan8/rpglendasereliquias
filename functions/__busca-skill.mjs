/**
 * Acha uma skill/habilidade pelo nome, em qualquer lugar onde ela possa morar,
 * e mostra a ESTRUTURA do que está gravado — é o que decide se o Tabuleiro tem
 * como saber com o que ela se conjura.
 *
 *   node functions/__busca-skill.mjs "grito dissonante"
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const alvo = (process.argv[2] || '').toLowerCase();
if (!alvo) { console.log('uso: node functions/__busca-skill.mjs "nome"'); process.exit(1); }

const bate = o => JSON.stringify(o || {}).toLowerCase().includes(alvo);

// 1) Módulos de classe (itens predefinidos = as skills cadastradas)
const mods = await db.collection('system/data/classModules').get();
for (const d of mods.docs) {
    const m = d.data();
    const achados = (m.itensPredefinidos || []).filter(bate);
    if (!achados.length) continue;
    console.log('═'.repeat(76));
    console.log(`MÓDULO: ${m.nome}   tipo: ${m.tipo}   [${d.id}]`);
    console.log('SCHEMA (os campos que o módulo define por item):');
    for (const f of m.schema || []) console.log(`   · ${f.chave || f.key} — "${f.label}" (${f.tipo})`);
    for (const it of achados) {
        console.log('\nITEM CADASTRADO:');
        console.log(JSON.stringify(it, null, 1));
    }
}

// 2) Manobras
const man = await db.collection('system/data/maneuvers').get();
for (const d of man.docs) {
    if (!bate(d.data())) continue;
    console.log('═'.repeat(76));
    console.log('MANOBRA:', JSON.stringify(d.data(), null, 1).slice(0, 1500));
}

// 3) Mecânicas
const mec = await db.collection('system/data/mechanics').get();
for (const d of mec.docs) {
    if (!bate(d.data())) continue;
    console.log('═'.repeat(76));
    console.log('MECÂNICA:', JSON.stringify(d.data(), null, 1).slice(0, 1200));
}

process.exit(0);
