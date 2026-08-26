// =============================================
// FAXINA: itens de `items` cujo dono não existe mais (personagem apagado).
// ---------------------------------------------
// Órfão não aparece em ficha nenhuma — é peso morto de banco. Esta limpeza
// apaga só o ENTULHO: os três donos abaixo ficam de fora por decisão do
// usuário (25/08/2026), porque o equipamento deles parece de personagem real
// (uma Relíquia de masmorra no meio).
//
// SEGURANÇA: o --apply grava PRIMEIRO um backup JSON com TODOS os órfãos
// (inclusive os preservados) e só apaga depois de o arquivo estar em disco.
// Sem backup gravado, nada é apagado.
//
//   node functions/limpar-itens-orfaos.mjs            (dry-run)
//   node functions/limpar-itens-orfaos.mjs --apply
// =============================================
import { createRequire } from 'node:module';
import { writeFileSync, existsSync, statSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// Donos apagados cujo inventário NÃO se toca — conferir antes de mexer.
const PRESERVAR = new Set([
    'char_1784170022478_ewp088',   // Kit do Embalsamador, Manto Sussurrante da Fenda
    'char_1785376103069_3zbupg',   // Alaúde Clássico, Broche da Guilda
    'u9OjlCjlYRUG2uzdYal1',        // Especulum Fatu (Relíquia), Armadura Infame
    // 2ª rodada: não são entulho — kits coerentes de jogadora real e peça de lore
    'char_1785376902673_22tjc9',   // Amanda Souza — kit inicial de Invocador
    'char_1785715707950_j01e05',   // Amanda Souza — kit inicial de Invocador
    'pmkfv9GLXgBJRq27aKGE',        // Medalhão de Thannathog
]);
const BACKUP = 'backup-itens-orfaos.json';

const donos = new Set();
for (const col of ['char', 'characters', 'npcs']) {
    (await db.collection(col).get()).forEach(d => donos.add(d.id));
}

const orfaos = [];
(await db.collection('items').get()).forEach(d => {
    const x = d.data();
    const c = x.characterId;
    if (!c || String(c).startsWith('__caixa_mestre__') || donos.has(c)) return;
    orfaos.push({ id: d.id, ref: d.ref, dono: c, dados: x });
});

const apagar = orfaos.filter(o => !PRESERVAR.has(o.dono));
const manter = orfaos.filter(o => PRESERVAR.has(o.dono));

const porDono = new Map();
for (const o of apagar) {
    if (!porDono.has(o.dono)) porDono.set(o.dono, []);
    porDono.get(o.dono).push(`${o.dados.nome || o.dados.name || '?'} [${o.dados.tipo || '—'}]`);
}
console.log(`donos vivos: ${donos.size} · órfãos no total: ${orfaos.length}`);
console.log(`APAGAR: ${apagar.length} itens de ${porDono.size} donos apagados`);
for (const [c, l] of porDono) console.log(`  ${c} → ${l.join(' | ')}`);
console.log(`\nPRESERVADOS (${manter.length}): ${[...PRESERVAR].join(', ')}`);
for (const o of manter) console.log(`  · ${o.dados.nome || o.dados.name} [${o.dados.tipo || '—'}] (${o.dono})`);

if (!APLICAR) { console.log(`\nDRY-RUN — o --apply grava ${BACKUP} com os ${orfaos.length} órfãos antes de apagar.`); process.exit(0); }

// backup de TODOS os órfãos (o que some e o que fica), antes de qualquer delete
writeFileSync(BACKUP, JSON.stringify({
    gerado: new Date().toISOString(),
    preservados: [...PRESERVAR],
    itens: orfaos.map(o => ({ id: o.id, dono: o.dono, apagado: !PRESERVAR.has(o.dono), dados: o.dados })),
}, null, 1), 'utf8');
if (!existsSync(BACKUP) || statSync(BACKUP).size < 100) {
    console.log('❌ backup não ficou em disco — NADA foi apagado.'); process.exit(1);
}
console.log(`\n💾 backup: ${BACKUP} (${(statSync(BACKUP).size / 1024).toFixed(1)} kB, ${orfaos.length} itens)`);

let n = 0, batch = db.batch();
for (const o of apagar) {
    batch.delete(o.ref);
    if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
}
if (n) await batch.commit();
console.log(`🗑️  ${apagar.length} itens órfãos apagados · ${manter.length} preservados.`);
process.exit(0);
