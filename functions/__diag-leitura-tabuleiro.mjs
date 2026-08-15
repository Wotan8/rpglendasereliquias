/**
 * O MESMO diagnóstico que o Dashboard do Criador mostra, rodado sobre o banco
 * real: quais habilidades o Tabuleiro não aplica sozinho, e qual campo falta.
 *   node functions/__diag-leitura-tabuleiro.mjs
 */
import { createRequire } from 'node:module';
import { indexarPredefs, interpretarSkill } from '../shared/skill-runtime.js';
import { custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero } from '../shared/skill-custo.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

// mesmo leitor de mecânica de custo do runtime
function custoDaMecanica(mech) {
    if (!mech || mech.tipo !== 'modificar') return null;
    const calc = (mech.config?.calculos || [])[0];
    if (!calc || calc.operacao !== '-') return null;
    const qtd = Number((calc.equacao || [])[0]?.valor);
    if (!(qtd > 0) || !calc.alvo) return null;
    return { rotulo: mech.nome || `−${qtd} ${calc.alvo}`, alvo: String(calc.alvo), qtd };
}

const [mods, mechs, classes] = await Promise.all([
    db.collection('system/data/classModules').get(),
    db.collection('system/data/mechanics').get(),
    db.collection('system/data/classes').get(),
]);
const mechById = new Map(mechs.docs.map(d => [d.id, d.data()]));
const classeDoMod = new Map();
for (const c of classes.docs) for (const id of c.data().modulosDaClasse || []) classeDoMod.set(id, c.data().nome);

const modulos = mods.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.publicado !== false);
const idx = indexarPredefs(modulos);

let total = 0;
const problemas = [];
for (const mod of modulos) {
    for (const pd of mod.itensPredefinidos || []) {
        total++;
        const r = interpretarSkill({ _predefId: pd.id, _predefNome: pd.nome }, {
            idx, custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero,
            mechPorId: (id) => mechById.get(id), custoDaMecanica, registroOk: true,
        });
        if (!r.diagnostico.ok) problemas.push({ mod, pd, d: r.diagnostico });
    }
}

const ok = total - problemas.length;
console.log(`\n🎲 LEITURA DO TABULEIRO — ${ok}/${total} aplicadas automaticamente (${Math.round(ok / total * 100)}%)\n`);

const porClasse = new Map();
for (const p of problemas) {
    const cl = classeDoMod.get(p.mod.id) || '(sem classe)';
    if (!porClasse.has(cl)) porClasse.set(cl, []);
    porClasse.get(cl).push(p);
}
for (const [cl, lista] of [...porClasse].sort()) {
    console.log(`──── ${cl} (${lista.length})`);
    for (const { mod, pd, d } of lista) {
        console.log(`  ⚠️ ${pd.nome}  · ${mod.titulo}`);
        for (const f of d.faltas) console.log(`       [${f.campo}] ${f.porque}`);
    }
    console.log('');
}
if (!problemas.length) console.log('✅ Nada pendente: o Tabuleiro aplica todas sozinho.');
process.exit(0);
