/**
 * Opção A: a Blindagem de proteção é valor de CADASTRO, não equação viva.
 *
 * Subir a Qualidade de uma peça é evento raro e deliberado — dias na bancada.
 * Quando acontece, alguém grava a Blindagem nova pela tabela do Livro (§5.6).
 * O risco disso é o erro silencioso: subir a Qualidade e esquecer a Blindagem.
 *
 * Este script dá ao audit o que falta para detectar isso:
 *   `qualidade`     — 0 em todas as peças (o campo nem existia em proteção)
 *   `blindagemQ0`   — a Blindagem da peça quando nova, âncora da conferência
 *
 * Com os dois, a regra fica verificável:
 *   qualidade 0  → Blindagem TEM que ser igual a blindagemQ0
 *   qualidade >0 → Blindagem tem que ser MAIOR que blindagemQ0
 *                  e não passar do total da classe naquela Qualidade
 *
 *   node functions/protecao-qualidade-base.mjs            (dry-run)
 *   node functions/protecao-qualidade-base.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ESPERADAS = 36;

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const vdNome = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;
const CLASSES = ['Leve', 'Média', 'Pesada', 'Escudo'];

let n = 0;
const mudancas = [], avisos = [];

for (const d of eqSnap.docs) {
    const e = d.data();
    const classe = (e.tags || []).find(t => CLASSES.includes(t));
    if (!classe) continue;

    const blVinc = (e.valoresDerivadosVinculados || []).filter(v => vdNome(v.id) === 'Blindagem');
    if (blVinc.length !== 1) { avisos.push(`🔴 ${e.nome}: ${blVinc.length} vínculos de Blindagem`); continue; }
    const bl = Number(blVinc[0].modificador) || 0;

    const patch = {};
    if (e.qualidade === undefined) patch.qualidade = '0';
    if (e.blindagemQ0 === undefined) patch.blindagemQ0 = bl;

    // Peça que já tem os dois campos e diverge é erro de dado, não migração.
    if (e.blindagemQ0 !== undefined && Number(e.qualidade || 0) === 0 && Number(e.blindagemQ0) !== bl)
        avisos.push(`🔴 ${e.nome}: blindagemQ0 ${e.blindagemQ0} ≠ Blindagem ${bl} com Qualidade 0`);

    n++;
    if (Object.keys(patch).length) mudancas.push({ ref: d.ref, patch, linha: `${e.nome.padEnd(24)} ${classe.padEnd(7)} Blindagem ${bl} → blindagemQ0 ${bl}, qualidade 0` });
}

console.log(`\n=== proteção: campo qualidade + âncora blindagemQ0 ===\n`);
for (const m of mudancas) console.log(`  ${m.linha}`);
console.log(`\npeças de proteção vistas : ${n} / ${ESPERADAS}`);
console.log(`a gravar                 : ${mudancas.length}`);
for (const a of avisos) console.error(`  ${a}`);

if (avisos.length || n !== ESPERADAS) { console.error(`\n🔴 ABORTADO — contagem ou dado não bate.`); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${mudancas.length} peças gravadas.`);
process.exit(0);
