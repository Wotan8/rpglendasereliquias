/**
 * Lote que põe as armas do catálogo para rodar no sistema de Fio.
 *
 *  1. Liga 1 nas peças que estão sem. Todo o catálogo é Grau 1 / Fio 0, e
 *     Liga 1 é o que as outras 84 já têm — nada ganha poder com isso.
 *     "O Sussurro Final" fica de fora: tem tag Relíquia, é Item Especial da
 *     §5.8 e não pertence à escada de Liga.
 *
 *  2. Equação de Acerto e de Dano em cada arma:
 *
 *       corpo a corpo   Acerto Corpo a Corpo = FOR + Perícia: Arma + Acerto
 *       distância       Acerto à Distância   = DES + Perícia: Disparo + Acerto
 *
 *       arma comum      Dano = FOR + Item: Fio + Item: Afiação
 *       besta           Dano = potência do arco + Item: Fio + Item: Afiação
 *
 *     A besta não soma atributo: quem faz força é o arco de aço, já armado.
 *     A potência sai do dado — 1d4 vale 2, 1d6 vale 3, 1d10 vale 5.
 *
 *   node functions/armas-liga-e-equacoes.mjs            (dry-run)
 *   node functions/armas-liga-e-equacoes.mjs --apply
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
const vd = n => { const v = vds.find(x => x.nome === n); if (!v) { console.error(`🔴 VD "${n}" não existe.`); process.exit(1); } return v; };

const V_ACERTO_CAC = vd('Acerto Corpo a Corpo');
const V_ACERTO_DIST = vd('Acerto à Distância');
const V_DANO = vd('Dano');

const F = ref => ({ tipo: 'ficha', ref });
const P = (op, ref) => ({ op, tipo: 'ficha', ref });
const N = (op, valor) => ({ op, valor });

/** Potência do arco da besta, pelo dado. */
const POTENCIA = { '1d4': 2, '1d6': 3, '1d8': 4, '1d10': 5, '1d12': 6 };

const armas = eq.filter(e => e.formulaDano && /^1d/.test(e.formulaDano));
const protecoes = eq.filter(e => (e.tags || []).some(t => ['Leve', 'Média', 'Pesada', 'Escudo'].includes(t)));
const RELIQUIA = e => (e.tags || []).includes('Relíquia');

/* ===== 1. Liga ===== */
const semLiga = [...armas, ...protecoes].filter(e => e.liga == null && !RELIQUIA(e));
const reliquias = [...armas, ...protecoes].filter(e => e.liga == null && RELIQUIA(e));

/* ===== 2. Equações ===== */
const planos = [];
const catErrada = [];
const DISTANCIA = ['Arco', 'Besta', 'Zarabatana'];
for (const e of armas) {
    if (RELIQUIA(e)) continue;              // Item Especial tem regra própria (§5.8)
    const tags = e.tags || [];
    const ehBesta = tags.includes('Besta');
    // A família manda, não `categoriaArma`: o Arco Curto está cadastrado como
    // arma de mão e viraria corpo a corpo se eu confiasse na categoria.
    const distancia = tags.some(t => DISTANCIA.includes(t));
    if (distancia !== (e.categoriaArma === 'distancia')) catErrada.push(`${e.nome} (tag ${tags.find(t => DISTANCIA.includes(t)) || '—'}, categoriaArma "${e.categoriaArma}")`);

    const acertoVD = distancia ? V_ACERTO_DIST : V_ACERTO_CAC;
    const acertoEq = distancia
        ? [F('DES'), P('+', 'Perícia: Disparo'), P('+', 'Acerto')]
        : [F('FOR'), P('+', 'Perícia: Arma'), P('+', 'Acerto')];

    const dado = (e.formulaDano || '').split('/')[0].trim();   // versátil: "1d8 / 1d10"
    const pot = POTENCIA[dado];
    if (ehBesta && !pot) { console.error(`🔴 besta com dado desconhecido: ${e.nome} (${e.formulaDano})`); process.exit(1); }
    const danoEq = ehBesta
        ? [{ valor: pot }, P('+', 'Item: Fio'), P('+', 'Item: Afiação')]
        : [F('FOR'), P('+', 'Item: Fio'), P('+', 'Item: Afiação')];

    // Preserva o que a peça já tinha, menos os dois VDs que estamos reescrevendo.
    const outros = (e.valoresDerivadosVinculados || [])
        .filter(v => ![V_ACERTO_CAC.id, V_ACERTO_DIST.id, V_DANO.id].includes(v.id));

    planos.push({
        e, ehBesta, distancia, pot,
        vinculos: [...outros, { id: acertoVD.id, equacao: acertoEq }, { id: V_DANO.id, equacao: danoEq }]
    });
}

/* ===== relatório ===== */
console.log(`=== 1. Liga 1 em ${semLiga.length} peças ===`);
for (const e of semLiga) console.log(`  ${e.nome}`);
if (reliquias.length) {
    console.log(`\n  fora do lote (tag Relíquia — Item Especial, §5.8):`);
    for (const e of reliquias) console.log(`    ⚠ ${e.nome}`);
}

console.log(`\n=== 2. Equações em ${planos.length} armas ===`);
const resumo = {};
for (const p of planos) {
    const forma = p.ehBesta ? `besta (potência ${p.pot})` : p.distancia ? 'distância' : 'corpo a corpo';
    (resumo[forma] ||= []).push(p.e.nome);
}
for (const [forma, nomes] of Object.entries(resumo)) {
    console.log(`\n  ${forma} — ${nomes.length}`);
    console.log(`    ${nomes.join(', ')}`);
}
if (catErrada.length) {
    console.log(`\n  ⚠ ${catErrada.length} arma(s) com "categoriaArma" divergindo da família — usei a família:`);
    for (const c of catErrada) console.log(`    ${c}`);
}
const amostra = planos.find(p => p.ehBesta) || planos[0];
console.log(`\n  exemplo (${amostra.e.nome}):`);
for (const v of amostra.vinculos.filter(v => v.equacao)) {
    const nome = vds.find(x => x.id === v.id).nome;
    const txt = v.equacao.map((t, i) => `${i ? ' ' + (t.op || '+') + ' ' : ''}${t.ref || t.valor}`).join('');
    console.log(`    ${nome.padEnd(22)} = ${txt}`);
}

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const col = db.collection('system/data/equipment');
const agora = admin.firestore.Timestamp.now();
let batch = db.batch(), n = 0;
const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };

for (const e of semLiga) { batch.update(col.doc(e.id), { liga: '1', atualizadoEm: agora, updatedAt: agora }); if (++n >= 400) await flush(); }
for (const p of planos) { batch.update(col.doc(p.e.id), { valoresDerivadosVinculados: p.vinculos, atualizadoEm: agora, updatedAt: agora }); if (++n >= 400) await flush(); }
await flush();
console.log(`\n✅ ${semLiga.length} Ligas · ${planos.length} armas com equação.`);
process.exit(0);
