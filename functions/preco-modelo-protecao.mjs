/**
 * Item 8: preço de proteção passa a ter modelo.
 *
 * Hoje não há nenhum: um Capuz Acolchoado (0 de Blindagem, 1 slot, penalidade)
 * custa 900 L$, mais que um Couro Batido (1 de Blindagem, 3 slots, sem
 * penalidade) a 800. E duas peças idênticas em tudo têm preços diferentes —
 * é o que o audit chama de DOMINADO há dez commits.
 *
 *   preço = (ponto × Blindagem + cobertura × slots) × (1 − 5% por penalidade)
 *
 * A penalidade desconta em PERCENTUAL, não em valor fixo: peça ruim vale menos,
 * nunca vale nada. O desconto para em 30%, senão o arnês completo (10 pontos de
 * penalidade somados) sairia pela metade do que vale.
 *
 * O modelo é a régua de peça NOVA (Qualidade 0). Qualidade e Reforço se pagam
 * por cima, pela tabela do ofício (§5.5) — não entram aqui.
 *
 *   node functions/preco-modelo-protecao.mjs            (dry-run, tabela completa)
 *   node functions/preco-modelo-protecao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const ESPERADAS = 36;

/* ponto = o que vale 1 de Blindagem · cobertura = o que vale cada slot coberto */
export const MODELO = {
    'Leve':   { ponto: 400,  cobertura: 200 },
    'Média':  { ponto: 1400, cobertura: 300 },
    'Pesada': { ponto: 3500, cobertura: 800 },
    // Escudo ocupa uma Mão: a cobertura não é o valor dele, o bloqueio é.
    'Escudo': { ponto: 700,  cobertura: 200 },
};
const TETO_DESCONTO = 0.30;

export function precoModelo({ classe, bl, slots, pen }) {
    const m = MODELO[classe];
    if (!m) return null;
    const bruto = m.ponto * bl + m.cobertura * slots;
    const desconto = Math.min(TETO_DESCONTO, 0.05 * pen);
    return Math.round(bruto * (1 - desconto) / 50) * 50;   // arredonda a 50 L$
}

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const nm = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;
const CLASSES = Object.keys(MODELO);

const linhas = [];
for (const d of eqSnap.docs) {
    const e = d.data();
    const classe = (e.tags || []).find(t => CLASSES.includes(t));
    if (!classe) continue;
    const bl = (e.valoresDerivadosVinculados || []).filter(v => nm(v.id) === 'Blindagem')
        .reduce((s, v) => s + (Number(v.modificador) || 0), 0);
    const slots = 1 + (e.slotsAdicionais || []).reduce((s, x) => s + (x.quantidade || 0), 0);
    const pen = [...(e.atributosVinculados || []), ...(e.periciasVinculadas || []),
                 ...(e.valoresDerivadosVinculados || []).filter(v => !/^Blindagem/.test(nm(v.id)))]
        .reduce((s, v) => s + Math.abs(Math.min(0, Number(v.modificador) || 0)), 0);
    const novo = precoModelo({ classe, bl, slots, pen });
    const velho = Number(e.preco) || 0;
    linhas.push({ ref: d.ref, nome: e.nome, classe, bl, slots, pen, velho, novo, delta: novo - velho });
}

linhas.sort((a, b) => CLASSES.indexOf(a.classe) - CLASSES.indexOf(b.classe) || b.novo - a.novo);
console.log(`\n=== modelo de preço de proteção ===\n`);
console.log('peça'.padEnd(24), 'cls'.padEnd(7), 'Bl', 'slot', 'pen', '   antes', '  modelo', '   delta');
for (const l of linhas) {
    const d = l.delta === 0 ? '     =' : (l.delta > 0 ? '+' : '') + l.delta;
    console.log(l.nome.padEnd(24), l.classe.padEnd(7), String(l.bl).padStart(2), String(l.slots).padStart(4),
        String(l.pen).padStart(3), String(l.velho).padStart(8), String(l.novo).padStart(8), d.padStart(8));
}
const iguais = linhas.filter(l => l.delta === 0).length;
const sobem = linhas.filter(l => l.delta > 0).length;
const descem = linhas.filter(l => l.delta < 0).length;
console.log(`\npeças: ${linhas.length} / ${ESPERADAS}   ·   sem mudança: ${iguais}   sobem: ${sobem}   descem: ${descem}`);
if (linhas.length !== ESPERADAS) { console.error('\n🔴 ABORTADO — contagem não bate.'); process.exit(1); }

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
const lote = db.batch();
for (const l of linhas.filter(x => x.delta !== 0)) lote.update(l.ref, { preco: l.novo });
await lote.commit();
console.log(`\n✅ ${linhas.filter(x => x.delta !== 0).length} preços gravados.`);
process.exit(0);
