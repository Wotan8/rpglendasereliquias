/**
 * Repete, fora do navegador, EXATAMENTE o que tab-turno.js faz para achar o
 * pré-definido de cada skill do participante. Se aqui achar e no Tabuleiro
 * não, o problema é de carga; se aqui não achar, é de dado.
 *   node functions/__diag-predef-lookup.mjs "vespa"
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const ALVO = (process.argv[2] || 'vespa').toLowerCase();

const normNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

const mods = await db.collection('system/data/classModules').get();
const predefPorId = new Map(), predefPorNome = new Map();
for (const d of mods.docs) {
    const m = { id: d.id, ...d.data() };
    if (m.publicado === false) continue;          // mesmo filtro do ensureNpcSystemData
    for (const pd of m.itensPredefinidos || []) {
        const ref = { pd, modId: m.id, modTitulo: m.titulo, schema: m.schema || [], retorno: m.retornoRecurso || '' };
        predefPorId.set(pd.id, ref);
        predefPorNome.set(normNome(pd.nome), ref);
    }
}
console.log(`predefs indexados: ${predefPorId.size} por id, ${predefPorNome.size} por nome\n`);

const npcs = await db.collection('npcs').get();
for (const d of npcs.docs) {
    const n = d.data();
    if (!String(n.nome || '').toLowerCase().includes(ALVO)) continue;
    console.log(`=== ${n.nome} (${d.id}) — classe ${n.classe}`);
    for (const vinc of n.modulosClasse || []) {
        for (const it of vinc.itens || []) {
            const nome = it._predefNome || it.nome || it['1'] || '?';
            const porId = it._predefId ? predefPorId.get(it._predefId) : null;
            const porNome = predefPorNome.get(normNome(nome));
            const ref = porId || porNome;
            const pd = ref?.pd;
            const temMira = pd && ((!!pd.formaArea && Number(pd.tamanhoArea) > 0) || Number(pd.alvosMax) > 0);
            console.log(`  ${ref ? '✅' : '❌'} ${nome}`);
            console.log(`      _predefId=${it._predefId || '∅'} achouPorId=${!!porId} achouPorNome=${!!porNome}`);
            if (pd) console.log(`      modulo=${ref.modTitulo} · mira=${temMira ? 'SIM' : 'NÃO'} · formaArea=${pd.formaArea} tamanho=${pd.tamanhoArea} alvosMax=${pd.alvosMax} faccao=${pd.faccao}`);
            if (pd) console.log(`      regua.custo=${pd.regua?.custo ?? '∅'} · retornoModulo=${ref.retorno || '∅'} · custoAcao=${JSON.stringify(pd.custoAcao || it.acao || '')}`);
        }
    }
}
process.exit(0);
