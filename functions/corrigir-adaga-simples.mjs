/**
 * Adaga simples — migra o `Acerto +1` para a Equação de Valor no VD tipado.
 *
 * ANTES: vínculo no VD genérico `Acerto` com modificador fixo +1 e sem `escopo`,
 *        ou seja, escopado na coluna do próprio item. Com os VDs tipados o
 *        genérico virou só agregador de modificadores globais (peculiaridade,
 *        condição, escudo) — esse +1 ficou órfão.
 *
 * DEPOIS: vínculo em `Acerto Corpo a Corpo` com a equação completa da arma:
 *         FOR + Perícia: Arma + Acerto + 1
 *         O termo `Acerto` puxa o agregador genérico; o `+1` é o Fio literal.
 *
 * ⚠ Pelo modelo de Fio, esse +1 é 1 Fio gasto em Acerto → a Adaga simples fica
 *   Grau 2. Se a intenção era ser inicial, zere o literal (vira Grau 1).
 *
 *   node functions/corrigir-adaga-simples.mjs            (dry-run)
 *   node functions/corrigir-adaga-simples.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vdPorNome = n => vds.find(v => v.nome === n);

const item = eq.find(x => x.nome === 'Adaga simples');
if (!item) { console.error('❌ "Adaga simples" não encontrada.'); process.exit(1); }

const acertoGen = vdPorNome('Acerto');
const acertoCaC = vdPorNome('Acerto Corpo a Corpo');
if (!acertoGen || !acertoCaC) { console.error('❌ VD de Acerto não encontrado.'); process.exit(1); }

const antes = item.valoresDerivadosVinculados || [];
const alvo = antes.find(v => v.id === acertoGen.id && Number(v.modificador) === 1);
if (!alvo) { console.error('❌ Não achei o vínculo Acerto +1. Já foi corrigido? Abortando.'); process.exit(1); }

/* Formato dos termos conforme _resolveTermValue / resolveEquation
   (ficha-v1.7_1/js/mechanics-engine.js). */
const depois = [
    ...antes.filter(v => v !== alvo),
    {
        id: acertoCaC.id,
        equacao: [
            { tipo: 'ficha', ref: 'FOR' },
            { op: '+', tipo: 'ficha', ref: 'Perícia: Arma' },
            { op: '+', tipo: 'ficha', ref: 'Acerto' },
            { op: '+', valor: 1 }
        ]
    }
];

console.log(`Item: ${item.nome} (${item.id})  ${item.formulaDano}  ${item.categoriaArma}\n`);
console.log('- ANTES: ', JSON.stringify(antes));
console.log('+ DEPOIS:', JSON.stringify(depois));
console.log('\nEquação legível: FOR + Perícia: Arma + Acerto + 1');
console.log('Fio = 1 (gasto em Acerto)  →  Grau 2');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await db.collection('system/data/equipment').doc(item.id).update({
    valoresDerivadosVinculados: depois,
    atualizadoEm: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
});
console.log('\n✅ Gravado.');
process.exit(0);
