/**
 * Recalibra a Blindagem das peças de proteção pelo modelo por slot coberto e
 * declara a cobertura em `slotsAdicionais`.
 *
 *   Blindagem = taxa(classe graduada) × slots cobertos
 *
 *   node functions/recalibrar-blindagem.mjs            (dry-run)
 *   node functions/recalibrar-blindagem.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* Taxa por slot coberto, por classe de material.
   As tags graduadas (Média III, Pesada I...) foram removidas do catálogo, então
   a taxa vem da tag guarda-chuva.
   Ancorada em: Pesada × 13 slots = 3,90 (o alvo do arnês completo). */
const TAXA = { 'Leve': 0.20, 'Média': 0.22, 'Pesada': 0.30 };

/* Cobertura proposta. `principal` é o slot onde a peça aparece na ficha;
   `extras` são os slots ADICIONAIS ocupados (vai em slotsAdicionais).
   Total de slots = 1 + soma dos extras.
 *
 * A cobertura é calibrada contra a ESCADA DE PENALIDADE que já está cadastrada
 * em atributosVinculados/periciasVinculadas (Torneio −3 DES/−5 Furt até as leves
 * sem nada). Invariante: mais Blindagem tem que custar mais penalidade — senão
 * uma peça fica estritamente melhor que outra e a escolha morre. */
const COBERTURA = {
    // ---- Pesadas (0,30/slot) ----
    'Armadura de Torneio': { principal: 'Torso', extras: { 'Cabeça': 1, 'Pescoço': 1, 'Costas': 1, 'Ombro': 2, 'Braço': 2, 'Cintura': 1, 'Pernas': 2, 'Pé': 2 } }, // 13
    'Armadura Completa':   { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2, 'Braço': 2, 'Cintura': 1, 'Pernas': 2, 'Pé': 2 } },                            // 11
    'Cota de Placas':      { principal: 'Torso', extras: { 'Pescoço': 1, 'Costas': 1, 'Ombro': 2, 'Braço': 2, 'Cintura': 1 } },                                    // 8
    'Meia-Armadura':       { principal: 'Torso', extras: { 'Cabeça': 1, 'Pescoço': 1, 'Costas': 1, 'Ombro': 2, 'Braço': 2 } },                                     // 8
    // ---- Médias (0,22/slot) ----
    'Cota de Malha':       { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2, 'Braço': 2, 'Cintura': 1 } },                                                  // 7
    'Peitoral de Aço':     { principal: 'Torso', extras: { 'Pescoço': 1, 'Costas': 1, 'Ombro': 2, 'Cintura': 1 } },                                                // 6
    'Brigandina':          { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2, 'Cintura': 1 } },                                                              // 5
    'Couro Cravejado':     { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2 } },                                                                            // 4
    'Couro Reforçado':     { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2 } },                                                                            // 4
    // ---- Leves (0,20/slot) ----
    'Armadura Leve':       { principal: 'Torso', extras: { 'Costas': 1, 'Ombro': 2 } },                                                                            // 4
    'Couro Batido':        { principal: 'Torso', extras: { 'Costas': 1, 'Cintura': 1 } },                                                                          // 3
    'Gibão Acolchoado':    { principal: 'Torso', extras: { 'Costas': 1 } },                                                                                        // 2
    'Couro Leve':          { principal: 'Torso', extras: { 'Costas': 1 } },                                                                                        // 2
    'Manto de Linho':      { principal: 'Costas', extras: { 'Cabeça': 1 } },                                                                                       // 2
};

/* Escudos ficam FORA da taxa: defesa ativa num slot de Mão que competiria com
   arma. Valor cheio, 1 slot. */
const ESCUDOS = { 'Escudo de Torre': 1.2, 'Escudo Grande': 0.9, 'Escudo Médio': 0.6, 'Broquel': 0.3 };

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, bp] = await Promise.all(['equipment', 'derivedValues', 'bodyParts'].map(grab));
const BL_ID = dvs.find(d => d.nome === 'Blindagem').id;
const PARTE = Object.fromEntries(bp.map(p => [p.nome, p.id]));
const blAtual = e => (e.valoresDerivadosVinculados || []).find(y => y.id === BL_ID)?.modificador ?? null;
const classeDe = e => Object.keys(TAXA).find(c => (e.tags || []).includes(c));

const mudancas = [];
for (const [nome, cob] of Object.entries(COBERTURA)) {
    const item = eq.find(x => x.nome === nome);
    if (!item) { console.log(`  ✖ "${nome}" não encontrado no catálogo`); continue; }
    const classe = classeDe(item);
    if (!classe) { console.log(`  ✖ "${nome}" sem tag graduada — tags: ${JSON.stringify(item.tags)}`); continue; }

    const slots = 1 + Object.values(cob.extras).reduce((a, b) => a + b, 0);
    const nova = Math.round(TAXA[classe] * slots * 100) / 100;
    const extras = Object.entries(cob.extras).map(([n, q]) => ({ id: PARTE[n], quantidade: q }));
    if (extras.some(x => !x.id)) { console.log(`  ✖ "${nome}" parte desconhecida`); continue; }

    mudancas.push({ item, nome, classe, slots, antes: blAtual(item), nova, extras, cob });
}
for (const [nome, val] of Object.entries(ESCUDOS)) {
    const item = eq.find(x => x.nome === nome);
    if (!item) { console.log(`  ✖ escudo "${nome}" não encontrado`); continue; }
    mudancas.push({ item, nome, classe: 'Escudo', slots: 1, antes: blAtual(item), nova: val, extras: [], cob: null });
}

console.log('\n=== RECALIBRAÇÃO ===\n');
console.log('peça                    classe        slots   taxa    Bl antes -> depois');
for (const m of mudancas.sort((a, b) => b.nova - a.nova)) {
    const taxa = m.classe === 'Escudo' ? '  —  ' : TAXA[m.classe].toFixed(2);
    console.log(`  ${m.nome.padEnd(21)} ${m.classe.padEnd(12)} ${String(m.slots).padStart(4)}   ${taxa}    ${String(m.antes).padStart(4)}  ->  ${m.nova.toFixed(2)}`);
}

console.log('\n=== COBERTURA DECLARADA (slotsAdicionais) ===\n');
for (const m of mudancas.filter(x => x.cob)) {
    const lista = Object.entries(m.cob.extras).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join(', ');
    console.log(`  ${m.nome.padEnd(21)} principal: ${m.cob.principal.padEnd(8)} + ${lista}`);
}

/* Confere se a ordem de potência do catálogo antigo foi preservada */
console.log('\n=== INVERSÕES DE ORDEM vs o catálogo antigo ===\n');
const ordAntes = [...mudancas].sort((a, b) => b.antes - a.antes).map(m => m.nome);
const ordDepois = [...mudancas].sort((a, b) => b.nova - a.nova).map(m => m.nome);
let inversoes = 0;
for (let i = 0; i < ordAntes.length; i++) {
    for (let j = i + 1; j < ordAntes.length; j++) {
        const A = mudancas.find(m => m.nome === ordAntes[i]), B = mudancas.find(m => m.nome === ordAntes[j]);
        if (A.antes > B.antes && A.nova < B.nova) { console.log(`  ${A.nome} (${A.antes}→${A.nova}) agora abaixo de ${B.nome} (${B.antes}→${B.nova})`); inversoes++; }
    }
}
if (!inversoes) console.log('  nenhuma — a ordem de potência do catálogo foi preservada');

/* Janela letal do arnês mais completo */
const VIT = 24, dado = 4.5, FOR = 3;
const pesado = mudancas.find(m => m.nome === 'Armadura de Torneio') || {nova:0};
const torre = mudancas.find(m => m.nome === 'Escudo de Torre') || {nova:0};
console.log('\n=== JANELA LETAL (golpe 1d8+FOR3 = 7,5, Vitalidade 24) ===\n');
for (const [n, b] of [['nu', 0], ['Armadura de Torneio', pesado.nova], ['Torneio + Escudo Torre', pesado.nova + torre.nova]])
    console.log(`  ${n.padEnd(24)} Bl ${b.toFixed(2).padStart(5)}  ->  ${(VIT / (7.5 - b)).toFixed(1)} golpes`);

if (!APPLY) { console.log(`\nDRY-RUN — ${mudancas.length} itens seriam alterados. Rode com --apply.\n`); process.exit(); }

for (const m of mudancas) {
    const outros = (m.item.valoresDerivadosVinculados || []).filter(x => x.id !== BL_ID);
    const patch = {
        valoresDerivadosVinculados: [...outros, { id: BL_ID, modificador: m.nova }],
        atualizadoEm: new Date(),
    };
    if (m.cob) patch.slotsAdicionais = m.extras;
    await db.doc(`system/data/equipment/${m.item.id}`).update(patch);
    console.log(`  ✔ ${m.nome}: Bl ${m.antes} -> ${m.nova}${m.cob ? ` (+${m.extras.length} tipos de slot)` : ''}`);
}
console.log(`\n✔ ${mudancas.length} itens recalibrados.\n`);
process.exit();
