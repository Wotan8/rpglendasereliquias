/**
 * Velhen 'O Que Se Repete' é NPC, não criatura — mesmo caso do Gorren-Nhar e do
 * Ibirá. Vira `tipo: 'npc'`; o texto de `criatura{}` migra para
 * `rolePlay.historia` antes de o bloco ser zerado, senão o primeiro save do
 * Painel o apagaria (ele grava `criatura: tipo === 'criatura' ? {...} : null`).
 *
 *   node functions/bestiario-velhen-npc.mjs            (dry-run)
 *   node functions/bestiario-velhen-npc.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const npcs = (await db.collection('npcs').get()).docs;
const d = npcs.filter(x => /^Velhen/.test(x.data().nome || ''));
if (d.length !== 1) { console.error(`🔴 Velhen: ${d.length} docs`); process.exit(1); }
const n = d[0].data();
if (n.tipo === 'npc') { console.log('Velhen já é npc — nada a fazer.'); process.exit(0); }

const c = n.criatura || {};
const linhas = [
    c.habitat && `Onde é encontrado: ${c.habitat}`,
    c.comportamento && `Comportamento: ${c.comportamento}`,
    c.dieta && c.dieta !== 'Nenhuma' && `Dieta: ${c.dieta}`,
    c.nivelAmeaca && `Nível de ameaça: ${c.nivelAmeaca}`,
].filter(Boolean);
const rp = n.rolePlay || {};
const historia = [String(rp.historia || '').trim(), linhas.join('\n')].filter(Boolean).join('\n\n');

console.log(`\n${n.nome} [${d[0].id}]`);
console.log(`   tipo: "${n.tipo}" → "npc"`);
console.log(`   mesa: ${n.mesaId || '—'} · visibilidade: ${n.visibilidade || '—'}`);
console.log(`   bloco criatura: ${JSON.stringify(c)}`);
console.log(linhas.length
    ? `   migra para rolePlay.historia:\n${linhas.map(l => '        · ' + l).join('\n')}`
    : `   nada a migrar — o bloco criatura está vazio`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await d[0].ref.update({
    tipo: 'npc', criatura: null,
    ...(linhas.length ? { 'rolePlay.historia': historia } : {}),
    lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR,
});
console.log('\n✅ Velhen virou npc.');
process.exit(0);
