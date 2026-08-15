/**
 * Onde as skills falam em GANHAR recurso (e sob que condição)?
 * Quero saber se isso é CAMPO (dá para o motor ler) ou TEXTO (só a mesa lê).
 * Só leitura.
 *
 *   node functions/__audit-recompensas.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

// "ganha/recupera X", "no fim do turno", "se ficar parado", "se mover"
const GANHO = /\b(ganha|ganhe|recupera|recupere|devolve|restaura|converte)\b/i;
const CONDIC = /\b(se |caso |desde que|contanto|somente se|apenas se)\b/i;
const QUANDO = /\b(fim do turno|final do turno|in[íi]cio do turno|por rodada|fim da rodada)\b/i;
const MOVER = /\b(parad[oa]|se mover|se deslocar|sem se mover|n[ãa]o se mover|imóvel)\b/i;

const mods = await db.collection('system/data/classModules').get();
const achados = [];

for (const d of mods.docs) {
    const m = d.data();
    const schema = m.schema || [];
    // 1) o schema tem coluna que fale de ganho/recompensa?
    const colsGanho = schema.filter(f => GANHO.test(f.label || '') || /recompensa|retorno|ganho/i.test(f.label || ''));

    // 2) os itens falam de ganho no texto?
    for (const it of m.itensPredefinidos || []) {
        const txt = [it.descricao, ...Object.values(it.valores || {})].filter(x => typeof x === 'string').join(' \n ');
        if (!GANHO.test(txt)) continue;
        achados.push({
            mod: m.nome || d.id, modId: d.id,
            nome: it.nome || '?',
            temCondicao: CONDIC.test(txt), temQuando: QUANDO.test(txt), temMover: MOVER.test(txt),
            colsGanho: colsGanho.map(f => f.label),
            trecho: (txt.match(/[^.\n]*\b(ganha|ganhe|recupera|recupere|devolve|restaura|converte)\b[^.\n]*/i) || [''])[0].trim().slice(0, 190),
        });
    }
}

console.log(`${achados.length} skill(s) falam em ganhar/recuperar recurso\n`);
const porMod = new Map();
for (const a of achados) {
    if (!porMod.has(a.mod)) porMod.set(a.mod, []);
    porMod.get(a.mod).push(a);
}
for (const [mod, lista] of porMod) {
    console.log('═'.repeat(78));
    console.log(`${mod}   (${lista.length})   colunas de ganho no schema: ${lista[0].colsGanho.length ? lista[0].colsGanho.join(', ') : '— NENHUMA —'}`);
    for (const a of lista) {
        const flags = [a.temQuando ? '⏱️quando' : '', a.temCondicao ? '❓condicional' : '', a.temMover ? '🏃movimento' : ''].filter(Boolean).join(' ');
        console.log(`   · ${a.nome}  ${flags}`);
        console.log(`     "${a.trecho}"`);
    }
}
process.exit(0);
