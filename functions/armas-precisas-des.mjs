/**
 * Armas de precisão passam a acertar por DES.
 *
 * Não existe tag: a equação é por item, então a arma que acerta com Destreza
 * simplesmente tem DES na equação dela. Adaga, Estoque e Sabre são lâminas de
 * ponta e pulso — o resto do corpo a corpo segue em FOR.
 *
 *     Acerto Corpo a Corpo  =  DES + Perícia: Arma + Acerto
 *
 * O Dano continua em FOR: quem fura com precisão ainda precisa de braço para
 * atravessar. Só o acerto muda.
 *
 *   node functions/armas-precisas-des.mjs            (dry-run)
 *   node functions/armas-precisas-des.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const nm = id => (vds.find(v => v.id === id) || {}).nome || '?';
const acertoCaC = vds.find(v => v.nome === 'Acerto Corpo a Corpo');
if (!acertoCaC) { console.error('🔴 VD "Acerto Corpo a Corpo" não existe.'); process.exit(1); }

/* Por nome, não por tag: Estoque e Sabre são da família Espada, e o resto da
   família continua em FOR. Relíquia fica fora, como no lote anterior. */
const POR_NOME = ['Estoque', 'Sabre'];
const alvo = e => !(e.tags || []).includes('Relíquia')
    && ((e.tags || []).includes('Adaga') || POR_NOME.includes(e.nome));

const armas = eq.filter(e => e.formulaDano && /^1d/.test(e.formulaDano) && alvo(e));
const EQ_DES = [
    { tipo: 'ficha', ref: 'DES' },
    { op: '+', tipo: 'ficha', ref: 'Perícia: Arma' },
    { op: '+', tipo: 'ficha', ref: 'Acerto' }
];
const leg = eqn => eqn.map((t, i) => `${i ? ' ' + (t.op || '+') + ' ' : ''}${t.ref || t.valor}`).join('');

console.log(`${armas.length} armas passam a acertar por DES:\n`);
const pend = [];
for (const e of armas) {
    const vinc = e.valoresDerivadosVinculados || [];
    const atual = vinc.find(v => v.id === acertoCaC.id);
    if (!atual || !Array.isArray(atual.equacao)) {
        console.log(`  ⚠ ${e.nome.padEnd(24)} sem equação de Acerto Corpo a Corpo — pulada`);
        continue;
    }
    const antes = leg(atual.equacao);
    if (antes === leg(EQ_DES)) { console.log(`  ok ${e.nome.padEnd(24)} já está em DES`); continue; }
    console.log(`  ${e.nome.padEnd(24)} ${antes}  →  ${leg(EQ_DES)}`);
    pend.push({ e, vinculos: vinc.map(v => v.id === acertoCaC.id ? { id: v.id, equacao: EQ_DES } : v) });
}

/* Quem NÃO muda, para conferir que a lista está certa */
const ficam = eq.filter(e => e.formulaDano && /^1d/.test(e.formulaDano) && !alvo(e)
    && !(e.tags || []).some(t => ['Arco', 'Besta', 'Zarabatana'].includes(t)));
console.log(`\n${ficam.length} armas de corpo a corpo seguem em FOR:`);
console.log(`  ${ficam.map(e => e.nome).join(', ')}`);

if (!pend.length) { console.log('\nNada a fazer.'); process.exit(0); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const col = db.collection('system/data/equipment');
const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const p of pend) batch.update(col.doc(p.e.id), { valoresDerivadosVinculados: p.vinculos, atualizadoEm: agora, updatedAt: agora });
await batch.commit();
console.log(`\n✅ ${pend.length} armas passaram para DES.`);
process.exit(0);
