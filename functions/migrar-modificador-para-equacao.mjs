/**
 * Tira os vínculos de item do campo LEGADO `modificador` e põe o valor na
 * Equação de Valor — que é onde o projeto guarda número de regra.
 *
 * POR QUE `modificador` é legado (ficha-v1.7_1/js/inventory.js):
 *   • VDs (linha ~408) e Perícias (~341): `temEq ? resolveEquation(...) : modificador`
 *     — a equação VENCE, e o editor do Criador zera o modificador assim que ela
 *     existe (_eqDvEqSync). Bônus deixado ali é número morto: não escala, não
 *     referencia nada da ficha, e some no primeiro save pela UI.
 *   • Atributos (~331) e Status Vitais (~437): o motor lê SÓ `modificador`,
 *     não há equação. Lá o campo é o formato certo — este script não os toca.
 *
 * A migração é de FORMA, não de valor: `modificador: 2` vira
 * `equacao: [{tipo:'fixo', valor:2}]`, exatamente o que o próprio chip do
 * Criador já monta ao renderizar um vínculo legado. Nada de mesa muda.
 *
 * Trocar o número fixo por fórmula escalável (Blindagem = Qualidade + Reforço,
 * por exemplo) é OUTRA conversa — essa é decisão de balanceamento e não entra
 * aqui.
 *
 *   node functions/migrar-modificador-para-equacao.mjs             (ensaio)
 *   node functions/migrar-modificador-para-equacao.mjs --aplicar
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const CAMPOS = ['valoresDerivadosVinculados', 'periciasVinculadas'];

const dvNome = Object.fromEntries((await db.collection('system/data/derivedValues').get())
    .docs.map(d => [d.id, d.data().nome || d.id]));
const skNome = Object.fromEntries((await db.collection('system/data/skills').get())
    .docs.map(d => [d.id, d.data().nome || d.id]));
const rotulo = id => dvNome[id] || skNome[id] || id;

const col = db.collection('system/data/equipment');
const eq = (await col.get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

/** Vínculo que ainda vale por modificador e não tem equação. */
const ehLegado = v => v && Number(v.modificador) && !(Array.isArray(v.equacao) && v.equacao.length);

const planos = [];
for (const item of eq) {
    const patch = {};
    const linhas = [];
    for (const campo of CAMPOS) {
        const vincs = item[campo];
        if (!Array.isArray(vincs) || !vincs.some(ehLegado)) continue;
        patch[campo] = vincs.map(v => {
            if (!ehLegado(v)) return v;
            const n = Number(v.modificador);
            linhas.push(`${rotulo(v.id)} ${n > 0 ? '+' : ''}${n}${v.escopo ? ` (${v.escopo})` : ''}`);
            // Mesma forma que _eqDvChip monta ao abrir um vínculo legado.
            return { ...v, modificador: 0, equacao: [{ tipo: 'fixo', valor: n }] };
        });
    }
    if (linhas.length) planos.push({ item, patch, linhas });
}

console.log(`CATÁLOGO: ${eq.length} itens · ${planos.length} com vínculo no campo legado\n`);
planos.forEach(p => console.log(`   ${p.item.nome || p.item.id}: ${p.linhas.join(' · ')}`));

if (!planos.length) { console.log('\nNada a migrar.'); process.exit(0); }
if (!APLICAR) { console.log(`\n(ensaio) ${planos.length} item(ns). Rode com --aplicar para gravar.`); process.exit(0); }

const agora = new Date().toISOString();
let n = 0;
let batch = db.batch();
for (const p of planos) {
    batch.update(p.item.ref, { ...p.patch, atualizadoEm: agora, updatedAt: agora });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();
console.log(`\n✅ ${planos.length} item(ns) migrados — valor idêntico, agora na equação.`);
