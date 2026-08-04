/**
 * Primeira peça com fraqueza declarada — para ver o VD espelho funcionando.
 *
 * A Armadura de Torneio cedendo ao Contundente já está no livro (§5.4, no
 * exemplo "Blindagem 3, contra o que ela cede, 1"). Aqui isso vira dado.
 *
 *   Blindagem 3,90  →  Contundente: metade  →  vínculo de −1,95
 *   Blindagem Arcana 0  →  cede à Vermelha  →  vínculo de −2  (VALOR DE TESTE)
 *
 * ⚠ A fraqueza à Vermelha é só para provar que a Blindagem Arcana desce abaixo
 * de zero. Se não for para ficar, rode com --limpar.
 *
 *   node functions/teste-fraqueza-torneio.mjs            (dry-run)
 *   node functions/teste-fraqueza-torneio.mjs --apply
 *   node functions/teste-fraqueza-torneio.mjs --limpar --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const LIMPAR = process.argv.includes('--limpar');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vd = n => vds.find(v => v.nome === n);
const nm = id => (vds.find(v => v.id === id) || {}).nome || '?';

const item = eq.find(e => e.nome === 'Armadura de Torneio');
if (!item) { console.error('🔴 Armadura de Torneio não encontrada.'); process.exit(1); }

const blCont = vd('Blindagem Contundente'), blVerm = vd('Blindagem Vermelha');
if (!blCont || !blVerm) { console.error('🔴 Blindagens tipadas não encontradas.'); process.exit(1); }

const atual = item.valoresDerivadosVinculados || [];
const blFisica = atual.find(v => nm(v.id) === 'Blindagem');
console.log(`${item.nome} — Blindagem atual: ${blFisica ? blFisica.modificador : '(nenhuma!)'}`);
if (!blFisica) { console.error('🔴 a peça não vincula Blindagem. Abortando.'); process.exit(1); }

const semTipadas = atual.filter(v => ![blCont.id, blVerm.id].includes(v.id));
const metade = -(Number(blFisica.modificador) / 2);
const novo = LIMPAR ? semTipadas : [
    ...semTipadas,
    { id: blCont.id, modificador: metade },   // cede ao Contundente: perde metade
    { id: blVerm.id, modificador: -2 }        // TESTE: cede à Vermelha
];

console.log('\nvínculos depois:');
for (const v of novo) console.log(`  ${nm(v.id).padEnd(24)} ${v.modificador >= 0 ? '+' : ''}${v.modificador}`);

const mesa = v => !(v > 0) ? (Math.floor(v) || 0) : Math.max(1, Math.floor(v));
if (!LIMPAR) {
    const bl = Number(blFisica.modificador);
    console.log('\no que a ficha deve mostrar:');
    console.log(`  Blindagem            ${mesa(bl)}       (${bl})`);
    console.log(`  Contundente          ${mesa(bl + metade)}   ▼ fraco   (${bl + metade})`);
    console.log(`  Cortante / Perfurante  — escondidos, iguais ao geral`);
    console.log(`  Blindagem Arcana     ${mesa(0)}`);
    console.log(`  Vermelha             ${mesa(-2)}  ▼ fraco   (amplifica: parcela de 4 vira 6)`);
    console.log(`  as outras 12 Essências — escondidas`);
}

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await db.collection('system/data/equipment').doc(item.id).update({
    valoresDerivadosVinculados: novo,
    atualizadoEm: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now()
});
console.log(LIMPAR ? '\n✅ Fraquezas removidas.' : '\n✅ Gravado.');
process.exit(0);
