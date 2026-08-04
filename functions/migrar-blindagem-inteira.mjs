/**
 * Passo 2 da migração v2: Blindagem INTEIRA declarada na peça.
 *
 * A taxa fracionária por slot (classe × slots cobertos) morre. Cada proteção
 * passa a declarar um inteiro no vínculo de Blindagem, derivado do modelo de
 * três regiões (Cabeça · Torso · Membros) com âncora por região:
 *
 *   orçamento Q0        C  T  M   total
 *   Leve                0  1  0     1
 *   Média               0  1  1     2
 *   Pesada              1  1  1     3
 *   escudos (fixo)      Torre 2 · Grande 1 · Médio 1 · Broquel 0
 *
 * A peça-âncora da região leva o orçamento; as peças satélites valem 0 na
 * Qualidade 0 e ganham valor quando a Qualidade da peça sobe (tabela do Livro).
 * Somas fecham por construção: avulsas de uma classe = conjunto da classe.
 *
 * Fraqueza tipada acompanha: metade da Blindagem nova, arredondada para baixo,
 * gravada como delta no VD espelho (Torneio: Contundente −1,95 → −2).
 *
 *   node functions/migrar-blindagem-inteira.mjs            (dry-run)
 *   node functions/migrar-blindagem-inteira.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* nome exato no catálogo → Blindagem inteira (Q0) */
const TABELA = {
    // Escudos — valores fechados na v2
    'Broquel': 0, 'Escudo de Torre': 2, 'Escudo Grande': 1, 'Escudo Médio': 1,
    // Leve (T=1; C e M sem orçamento)
    'Armadura Leve': 1, 'Couro Batido': 1, 'Couro Leve': 1, 'Gibão Acolchoado': 1,
    'Capuz Acolchoado': 0, 'Cinta Acolchoada': 0, 'Gola de Couro': 0,
    'Mangas Acolchoadas': 0, 'Manto de Linho': 0,
    // Média (T=1, M=1 — âncora de Membros: Calças de Malha)
    'Cota de Malha': 1, 'Peitoral de Aço': 1, 'Brigandina': 1,
    'Couro Cravejado': 1, 'Couro Reforçado': 1, 'Calças de Malha': 1,
    'Botas Ferradas': 0, 'Braçadeiras de Couro': 0, 'Cinturão Rebitado': 0,
    'Coifa de Malha': 0, 'Gorjal de Malha': 0,
    // Pesada (C=1 Elmo · T=1 Couraça · M=1 Grevas)
    'Armadura de Torneio': 3, 'Armadura Completa': 2, 'Meia-Armadura': 2,
    'Cota de Placas': 1, 'Couraça de Placas': 1, 'Elmo de Placas': 1,
    'Grevas de Placas': 1, 'Braçadeiras de Placas': 0, 'Escarpes de Placas': 0,
    'Faldar de Placas': 0, 'Gorjal de Aço': 0, 'Ombreiras de Placas': 0
};
const ESPERADAS = Object.keys(TABELA).length;   // 36

const grab = async c => (await db.collection(`system/data/${c}`).get());
const [eqSnap, vdSnap] = await Promise.all([grab('equipment'), grab('derivedValues')]);
const vds = vdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const vdNome = id => (vds.find(v => v.id === id) || {}).nome || `?${id}`;

let achadas = 0, mudadas = 0, fraquezas = 0;
const mudancas = [], avisos = [];

for (const d of eqSnap.docs) {
    const e = d.data();
    if (!(e.nome in TABELA)) continue;
    achadas++;
    const alvo = TABELA[e.nome];
    const vinc = e.valoresDerivadosVinculados || [];

    const blVinc = vinc.filter(v => vdNome(v.id) === 'Blindagem');
    if (blVinc.length !== 1) {
        avisos.push(`🔴 ${e.nome}: ${blVinc.length} vínculos de Blindagem (esperado exatamente 1)`);
        continue;
    }
    const atual = Number(blVinc[0].modificador) || 0;

    let fraqItem = 0;
    const novo = vinc.map(v => {
        const n = vdNome(v.id);
        if (n === 'Blindagem') return { ...v, modificador: alvo };
        // Fraqueza/resistência tipada: recalcula sobre a Blindagem nova.
        // Fraqueza física = peça fica com metade (floor); o vínculo guarda o DELTA.
        if (/^Blindagem .+/.test(n) && Number(v.modificador) < 0) {
            const delta = Math.floor(alvo / 2) - alvo;   // ex.: 3 → fica 1 → delta −2
            fraqItem++;
            return { ...v, modificador: delta };
        }
        return v;
    });
    fraquezas += fraqItem;

    const linha = `${e.nome.padEnd(24)} ${String(atual).padStart(5)} → ${alvo}${fraqItem ? '   (fraqueza recalculada)' : ''}`;
    if (atual !== alvo || fraqItem) mudancas.push({ ref: d.ref, patch: { valoresDerivadosVinculados: novo }, linha });
    if (atual !== alvo) mudadas++;
}

console.log(`\n=== migrar Blindagem fracionária → inteira · ${ESPERADAS} peças na tabela ===\n`);
for (const m of mudancas) console.log(`  ${m.linha}`);
console.log(`\npeças achadas no catálogo : ${achadas} / ${ESPERADAS}`);
console.log(`valores alterados         : ${mudadas}`);
console.log(`fraquezas recalculadas    : ${fraquezas}`);
for (const a of avisos) console.log(a);

if (achadas !== ESPERADAS || avisos.length) {
    console.error(`\n🔴 ABORTADO — catálogo não bate com a tabela.`);
    process.exit(1);
}
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

let lote = db.batch();
for (const m of mudancas) lote.update(m.ref, m.patch);
await lote.commit();
console.log(`\n✅ ${mudancas.length} peças gravadas.`);
process.exit(0);
