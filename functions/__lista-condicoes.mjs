/**
 * Lê as condições cadastradas — descrição INTEIRA, para configurar o Tabuleiro
 * pelo que está escrito e não pelo que a gente acha que está.
 * Só leitura.
 *
 *   node functions/__lista-condicoes.mjs            (resumo)
 *   node functions/__lista-condicoes.mjs Cego Lento (texto inteiro dessas)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const filtros = process.argv.slice(2).filter(a => !a.startsWith('--'));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const snap = await db.collection('system/data/conditions').get();
let cs = [];
snap.forEach(d => cs.push({ id: d.id, ...d.data() }));
cs.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
if (filtros.length) cs = cs.filter(c => filtros.some(f => norm(c.nome).includes(norm(f))));

for (const c of cs) {
    console.log('\n' + '─'.repeat(78));
    console.log(`${c.icone || '?'} ${c.nome}   [${c.id}]   ⏱️ ${c.duracao || '—'}   ${c.removivel ? 'removível' : 'não removível'}`);
    console.log(String(c.descricao || '').replace(/\n{3,}/g, '\n\n'));
}
console.log(`\n${cs.length} condição(ões)`);
process.exit(0);
