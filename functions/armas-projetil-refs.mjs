/**
 * Passo 4 da migração v2: a ponta carrega o poder.
 *
 * Nas armas de DISPARO (tags Arco/Besta), Qualidade e Afiação saem do maço
 * apontado pela arma (campo projetilId da instância, refs "Projétil: ..."),
 * não da própria arma:
 *
 *   antes   Dano = min(Item: Qualidade + Item: Afiação, Teto) + FOR|pot
 *   depois  Dano = min(Projétil: Qualidade + Projétil: Afiação, Teto) + FOR|pot
 *
 * O teto do Domínio (Disparo) continua o mesmo — o cap morde o bônus da ponta.
 * Arremesso NÃO muda: a arma arremessada É o projétil.
 *
 *   node functions/armas-projetil-refs.mjs            (dry-run)
 *   node functions/armas-projetil-refs.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ESPERADAS = 13;   // 5 arcos + 8 bestas

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const vdNome = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;

const TROCA = { 'Item: Qualidade': 'Projétil: Qualidade', 'Item: Afiação': 'Projétil: Afiação' };

let n = 0, refs = 0;
const mudancas = [], erros = [];

for (const d of eqSnap.docs) {
    const e = d.data();
    const tags = e.tags || [];
    if (!tags.includes('Arco') && !tags.includes('Besta')) continue;
    const vinc = e.valoresDerivadosVinculados || [];
    const danoIdx = vinc.findIndex(v => vdNome(v.id) === 'Dano' && Array.isArray(v.equacao));
    if (danoIdx < 0) { erros.push(`SEM EQUAÇÃO DE DANO · ${e.nome}`); continue; }

    let nRefs = 0;
    const nova = vinc[danoIdx].equacao.map(t => {
        if (t && TROCA[t.ref]) { nRefs++; return { ...t, ref: TROCA[t.ref] }; }
        return t;
    });
    if (nRefs !== 2) { erros.push(`REFS INESPERADAS · ${e.nome}: trocaria ${nRefs} (esperado 2)`); continue; }

    const novoVinc = vinc.map((v, i) => i === danoIdx ? { ...v, equacao: nova } : v);
    n++; refs += nRefs;
    mudancas.push({ ref: d.ref, patch: { valoresDerivadosVinculados: novoVinc }, nome: e.nome, tag: tags.includes('Arco') ? 'Arco' : 'Besta' });
}

console.log(`\n=== refs Projétil: nas armas de disparo ===\n`);
for (const m of mudancas) console.log(`  ${m.nome.padEnd(28)} ${m.tag}`);
console.log(`\narmas a gravar : ${n}   (esperado: ${ESPERADAS})   refs trocadas: ${refs}`);
for (const er of erros) console.error(`  🔴 ${er}`);

if (erros.length || n !== ESPERADAS) { console.error(`\n🔴 ABORTADO — contagem/forma não bate.`); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${n} armas gravadas.`);
process.exit(0);
