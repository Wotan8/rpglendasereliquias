/**
 * Diagnóstico: por que o Tabuleiro não lê custo nem mira das skills.
 * Só LÊ. Mostra, por módulo de classe, o schema e o que cada pré-definido
 * carrega de custo (select_botao → mecânica) e de mira (Régua v2).
 *   node functions/__diag-skills-tabuleiro.mjs [filtro]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const FILTRO = (process.argv[2] || '').toLowerCase();

const mods = await db.collection('system/data/classModules').get();
const mechs = await db.collection('system/data/mechanics').get();
const mechById = new Map(mechs.docs.map(d => [d.id, d.data()]));
const classes = await db.collection('system/data/classes').get();

console.log(`\n=== CLASSES (${classes.size}) ===`);
for (const c of classes.docs) {
    const d = c.data();
    console.log(` ${d.nome} → modulosDaClasse:`, JSON.stringify(d.modulosDaClasse || []));
}

console.log(`\n=== MÓDULOS (${mods.size}) ===`);
for (const m of mods.docs) {
    const d = m.data();
    if (FILTRO && !String(d.titulo || '').toLowerCase().includes(FILTRO)) continue;
    console.log(`\n──────── ${d.titulo} (${m.id})  publicado=${d.publicado !== false}`);
    console.log('  schema:');
    for (const f of d.schema || []) {
        console.log(`    · key=${JSON.stringify(f.key)} tipo=${f.tipo} label=${JSON.stringify(f.label)}`
            + (f.ehVeiculo ? ' ehVeiculo=SIM' : '')
            + (f.mecanicaIds ? ` mecanicaIds=${JSON.stringify(f.mecanicaIds)}` : ''));
    }
    console.log(`  retornoRecurso=${JSON.stringify(d.retornoRecurso || '')}`);
    console.log(`  itensPredefinidos (${(d.itensPredefinidos || []).length}):`);
    for (const pd of d.itensPredefinidos || []) {
        const mira = {
            formaArea: pd.formaArea, tamanhoArea: pd.tamanhoArea, alcance: pd.alcance,
            alvosMax: pd.alvosMax, anguloCone: pd.anguloCone, faccao: pd.faccao,
            cond: (pd.condicoesAplicadas || []).length,
        };
        const temMira = (!!pd.formaArea && Number(pd.tamanhoArea) > 0) || Number(pd.alvosMax) > 0;
        // custos: campos select_botao com mecânica escolhida no predef
        const custos = [];
        for (const f of d.schema || []) {
            if (f.tipo !== 'select_botao') continue;
            const mid = pd.valores?.[f.key];
            const mech = mid ? mechById.get(mid) : null;
            custos.push(`${f.label}=${mid || '∅'}${mech ? ` (${mech.nome})` : ''}`);
        }
        const veics = [];
        for (const f of d.schema || []) {
            if (f.tipo !== 'select_vd' || !f.ehVeiculo) continue;
            veics.push(`${f.label}=${pd.valores?.[f.key] || '∅'}`);
        }
        console.log(`    ${temMira ? '🎯' : '❌'} ${pd.nome}  id=${pd.id}`);
        console.log(`        mira: ${JSON.stringify(mira)}`);
        console.log(`        custoAcao=${JSON.stringify(pd.custoAcao || '')} regua.custo=${pd.regua?.custo ?? '∅'}`);
        if (custos.length) console.log(`        custos(select_botao): ${custos.join(' | ')}`);
        if (veics.length) console.log(`        veiculos(select_vd): ${veics.join(' | ')}`);
        const chavesValores = Object.keys(pd.valores || {});
        if (chavesValores.length) console.log(`        valores keys: ${JSON.stringify(chavesValores)}`);
    }
}
process.exit(0);
