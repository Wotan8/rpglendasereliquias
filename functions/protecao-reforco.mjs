/**
 * Reforço em proteção — mesma opção A da Qualidade.
 *
 * O Reforço soma na Blindagem gravada da peça (não é equação viva), e o campo
 * `reforco` guarda quantos níveis foram pagos. Coerência: a Qualidade também é
 * valor de cadastro; misturar um crescimento gravado com outro calculado faria
 * a mesma Blindagem ter duas fontes de verdade.
 *
 * Regras que o audit passa a cobrar:
 *   reforco ≤ qualidade da peça          (Livro, 5.5 — a corrente)
 *   reforco > 0 → Blindagem > blindagemQ0 (pagou e não gravou = erro silencioso)
 *
 * O teto do corpo inteiro (Reforço total ≤ Qualidade do Torso) fica como regra
 * de bancada: quem autoriza o serviço é o Narrador. A rede de segurança em
 * tempo real já existe e é outra — o Domínio de Proteção limita TODA a
 * Blindagem vinda de peça ao VIG de quem veste.
 *
 *   node functions/protecao-reforco.mjs            (dry-run)
 *   node functions/protecao-reforco.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ESPERADAS = 36;
const CLASSES = ['Leve', 'Média', 'Pesada', 'Escudo'];

const snap = await db.collection('system/data/equipment').get();
let n = 0;
const mudancas = [], avisos = [];

for (const d of snap.docs) {
    const e = d.data();
    if (!(e.tags || []).some(t => CLASSES.includes(t))) continue;
    n++;
    if (e.reforco !== undefined) { avisos.push(`já tem reforco: ${e.nome}`); continue; }
    mudancas.push({ ref: d.ref, patch: { reforco: 0 }, nome: e.nome });
}

console.log(`\n=== campo reforco nas proteções ===\n`);
console.log(`  ${mudancas.length} peças recebem reforco: 0`);
for (const a of avisos) console.log(`  ⚠ ${a}`);
console.log(`\npeças de proteção vistas : ${n} / ${ESPERADAS}`);

if (n !== ESPERADAS) { console.error(`\n🔴 ABORTADO — contagem não bate.`); process.exit(1); }
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${mudancas.length} peças gravadas.`);
process.exit(0);
