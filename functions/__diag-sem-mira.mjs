/**
 * As habilidades sem mira interpretável, com TODO o texto que o cadastro tem
 * sobre elas. É o texto que diz qual é a mira — não se inventa número aqui.
 *   node functions/__diag-sem-mira.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const src = readFileSync(new URL('../tabuleiro/js/tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const i0 = src.indexOf('function miraDaReguaV2(');
const sb = { r: null }; vm.createContext(sb);
vm.runInContext(src.slice(i0, src.indexOf('\n}\n', i0) + 3), sb);
const miraDe = (pd) => { sb.pd = pd; vm.runInContext('r = JSON.stringify(miraDaReguaV2(pd) ?? null)', sb); return JSON.parse(sb.r); };

const mods = await db.collection('system/data/classModules').get();
const classes = await db.collection('system/data/classes').get();
const classeDoMod = new Map();
for (const c of classes.docs) for (const id of c.data().modulosDaClasse || []) classeDoMod.set(id, c.data().nome);

for (const d of mods.docs) {
    const m = { id: d.id, ...d.data() };
    if (m.publicado === false) continue;
    const rotulo = new Map((m.schema || []).map(f => [f.key, f.label || f.key]));
    const semMira = (m.itensPredefinidos || []).filter(pd => !pd.mira && !miraDe(pd));
    if (!semMira.length) continue;
    console.log(`\n════ ${classeDoMod.get(d.id) || '?'} · ${m.titulo} (${d.id})`);
    for (const pd of semMira) {
        console.log(`\n  ── ${pd.nome}   [${pd.id}]`);
        console.log(`     formaArea=${JSON.stringify(pd.formaArea)} tamanhoArea=${JSON.stringify(pd.tamanhoArea)} `
            + `alcance=${JSON.stringify(pd.alcance)} alvosMax=${JSON.stringify(pd.alvosMax)} `
            + `anguloCone=${JSON.stringify(pd.anguloCone)} faccao=${JSON.stringify(pd.faccao)}`);
        console.log(`     duracao=${pd.duracaoValor ?? '∅'} ${pd.duracaoUnidade || ''} · condicoes=${JSON.stringify(pd.condicoesAplicadas || [])}`);
        if (pd.descricao) console.log(`     descricao: ${pd.descricao}`);
        for (const [k, v] of Object.entries(pd.valores || {})) {
            if (v === '' || v == null) continue;
            if (/^[0-9a-zA-Z]{20}$/.test(String(v))) continue;   // id de VD/mecânica
            console.log(`     ${rotulo.get(k) || k}: ${v}`);
        }
    }
}
process.exit(0);
