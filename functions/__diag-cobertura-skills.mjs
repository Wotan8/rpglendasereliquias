/**
 * Cobertura REAL: roda o interpretador de custo (shared/skill-custo.js) e o de
 * mira (miraDaReguaV2, recortado de tab-turno.js) sobre TODOS os pré-definidos
 * publicados, e diz o que o Tabuleiro entende de cada um.
 *   node functions/__diag-cobertura-skills.mjs [--faltas]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { custosDaSkill, rotuloDosCustos } from '../shared/skill-custo.js';
import { ehFormula, resolverMedida } from '../shared/medida-formula.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const SO_FALTAS = process.argv.includes('--faltas');

// mesmo leitor de mecânica de custo do runtime (shared/combate-cenas.js)
function custoDaMecanica(mech) {
    if (!mech || mech.tipo !== 'modificar') return null;
    const calc = (mech.config?.calculos || [])[0];
    if (!calc || calc.operacao !== '-') return null;
    const eq = (calc.equacao || [])[0];
    const qtd = Number(eq?.valor);
    if (!(qtd > 0) || !calc.alvo) return null;
    return { rotulo: mech.nome || `−${qtd} ${calc.alvo}`, alvo: String(calc.alvo), qtd };
}

// miraDaReguaV2 recortada do próprio tab-turno.js — sem cópia de regra
const src = readFileSync(new URL('../tabuleiro/js/tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const i0 = src.indexOf('function miraDaReguaV2(');
const iTem = src.indexOf('const temMedida =');
const sandbox = { r: null, ehFormula };
vm.createContext(sandbox);
vm.runInContext(src.slice(iTem, src.indexOf('\n', iTem)) + '\n' + src.slice(i0, src.indexOf('\n}\n', i0) + 3), sandbox);
const miraDe = (pd) => { sandbox.pd = pd; vm.runInContext('r = JSON.stringify(miraDaReguaV2(pd) ?? null)', sandbox); return JSON.parse(sandbox.r); };
// Ficha de referência só para a cobertura mostrar um número no lugar da fórmula
const FICHA_EX = { 'Liderança': 4, 'PRE': 3 };
const medida = (v) => resolverMedida(v, (n) => FICHA_EX[n] ?? null);

const mods = await db.collection('system/data/classModules').get();
const mechs = await db.collection('system/data/mechanics').get();
const mechById = new Map(mechs.docs.map(d => [d.id, d.data()]));
const classes = await db.collection('system/data/classes').get();
const classeDoMod = new Map();
for (const c of classes.docs) for (const id of c.data().modulosDaClasse || []) classeDoMod.set(id, c.data().nome);

let tot = 0, semMira = 0, semCusto = 0;
const porClasse = new Map();
for (const d of mods.docs) {
    const m = { id: d.id, ...d.data() };
    if (m.publicado === false) continue;
    const classe = classeDoMod.get(d.id) || '(sem classe)';
    for (const pd of m.itensPredefinidos || []) {
        tot++;
        const custos = custosDaSkill({ modulo: m, predef: pd, item: {}, mechPorId: (id) => mechById.get(id), custoDaMecanica });
        const mira = pd.mira || miraDe(pd);
        if (!mira) semMira++;
        if (!custos.length) semCusto++;
        const fmt = (v) => ehFormula(v) ? `ƒ${String(v).trim()}=${medida(v)}` : `${v}`;
        const alvo = !mira ? '—'
            : mira.tipo === 'locais' ? `📍locais×${mira.alvosPorGraus ? `graus(≤${mira.maxAlvos})` : mira.maxAlvos} @${fmt(mira.alcanceM)}m`
            : mira.tipo === 'alvos' ? `alvos×${mira.maxAlvos} @${fmt(mira.alcanceM)}m`
            : medida(mira.raioM) === 0 && !ehFormula(mira.raioM) ? 'só em si'
            : `${mira.forma} ${fmt(mira.raioM ?? mira.comprimentoM)}m (${mira.origem})`;
        const conds = (mira?.condicoes || []).map(c => c.nome).join('+');
        const linha = `  ${mira ? '🎯' : '  '}${custos.length ? '💰' : '  '} ${String(pd.nome).slice(0, 34).padEnd(35)}`
            + `${rotuloDosCustos(custos).padEnd(26)} ${alvo.padEnd(24)} ${conds}`;
        if (!SO_FALTAS || !mira || !custos.length) {
            if (!porClasse.has(classe)) porClasse.set(classe, []);
            porClasse.get(classe).push(linha);
        }
    }
}
for (const [classe, linhas] of [...porClasse].sort()) {
    console.log(`\n──── ${classe}`);
    console.log(linhas.join('\n'));
}
console.log(`\nTOTAL ${tot} habilidades · com mira ${tot - semMira} · com custo ${tot - semCusto}`);
console.log(`sem mira: ${semMira} · sem custo: ${semCusto}`);
process.exit(0);
