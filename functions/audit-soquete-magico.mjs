/**
 * SÓ LEITURA. Compara o dano do mago com o do guerreiro sob o modelo v2 do
 * soquete mágico, para ver se a magia cabe na janela letal do sistema.
 *
 * Calibra no banco (Blindagem do catálogo, fórmulas de Vitalidade e Energia) e
 * aplica por cima as decisões de design que ainda NÃO estão gravadas:
 *
 *   • Régua de dado por barreira — cada ponto de Blindagem que a parcela pula
 *     custa um passo de dado. Por 1 Energia: físico 1d8 (vs 2), físico tipado
 *     1d6 (vs 1), Essência 1d4 (vs Blindagem Arcana 0).
 *   • Transbordo de Dano = max(0, Alvo − 9), fixo, soma em todo golpe que entra.
 *     A Qualidade do foco vai para Acerto Mágico, não para dano.
 *   • Fraqueza N = dano ÷ 2^N, arredondado para baixo, mínimo 1.
 *     Contra alvo abissal: Abissal 0 · Luz 1 · toda outra Essência 2 · físico 2.
 *   • O contrapeso do Invocador é variância (a invocação pode virar contra o
 *     grupo), não custo — entra como TRAICAO, não como dano menor.
 *
 * Resolução (§6.3–6.5): 1d10 ≤ Alvo acerta, Graus = Alvo − resultado; o defensor
 * rola contra Reação + perícia − Graus; o 10 sempre falha e o 1 sempre salva.
 * As probabilidades saem por convolução exata sobre os 10 resultados — a média
 * dos Graus superestima, porque o piso de 10% corta a cauda boa.
 *
 *   node functions/audit-soquete-magico.mjs
 *   node functions/audit-soquete-magico.mjs --self-test   (só os asserts)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══ MODELO ═══════════════════════════════════════════════════════════════ */

/** P(o golpe entra): ataque acerta E o defensor falha em escapar. */
export function pDano(alvoAtaque, alvoDefesaBase) {
    let soma = 0;
    for (let r = 1; r <= Math.min(alvoAtaque, 9); r++) {
        const graus = alvoAtaque - r;
        const alvoDef = alvoDefesaBase - graus;
        const escapa = Math.max(0.1, Math.min(Math.max(alvoDef, 0), 9) / 10);
        soma += 1 - escapa;
    }
    return soma / 10;
}

/** Cada ponto de Alvo acima de 9 vale +1 de dano em todo golpe que entra. */
export const transbordo = alvo => Math.max(0, alvo - 9);

/** Régua de dado: o dado médio que dá paridade contra a barreira enfrentada. */
export const dadoDaBarreira = (barreira, atributo, alvoLiquido) =>
    alvoLiquido - atributo + barreira;

/** Fraqueza N divide o dano por 2^N, para baixo, com piso de 1. */
export const aplicarFraqueza = (dano, n) => Math.max(1, Math.floor(dano / 2 ** n));

/** Dano por rodada. */
export function dpr({ alvo, alvoDefesaBase = 5, dadoMedio, atributo, barreira, fraqueza = 0 }) {
    const bruto = dadoMedio + atributo + transbordo(alvo) - barreira;
    const dano = fraqueza ? aplicarFraqueza(bruto, fraqueza) : bruto;
    return pDano(alvo, alvoDefesaBase) * dano;
}

/* ═══ ASSERTS ══════════════════════════════════════════════════════════════ */

function autoTeste() {
    const r2 = v => Math.round(v * 1000) / 1000;

    // Convolução: guerreiro Alvo 7 contra defensor base 5.
    assert.equal(r2(pDano(7, 5)), 0.53, 'pDano(7,5) deve dar 0,53');
    // Teto do d10: Alvo 12 não passa de 90% de acerto, mas rende mais Graus.
    assert.equal(r2(pDano(12, 5)), 0.8, 'pDano(12,5) deve dar 0,80');
    // Alvo maior nunca piora.
    for (let a = 1; a < 15; a++) assert.ok(pDano(a + 1, 5) >= pDano(a, 5), 'pDano deve ser monotônica');

    assert.equal(transbordo(7), 0);
    assert.equal(transbordo(12), 3);

    // Régua de dado: com atributo 4 e alvo líquido 6,5 os três tipos empatam.
    assert.equal(dadoDaBarreira(2, 4, 6.5), 4.5, 'físico geral → 1d8');
    assert.equal(dadoDaBarreira(1, 4, 6.5), 3.5, 'físico tipado → 1d6');
    assert.equal(dadoDaBarreira(0, 4, 6.5), 2.5, 'Essência → 1d4');

    // Fraqueza: divide por 2^N, para baixo, piso de 1.
    assert.equal(aplicarFraqueza(6, 1), 3);
    assert.equal(aplicarFraqueza(6, 2), 1);   // 6/4 = 1,5 → 1
    assert.equal(aplicarFraqueza(2, 2), 1);   // piso morde
    assert.equal(aplicarFraqueza(20, 2), 5);

    // Paridade: os três tipos de parcela dão o mesmo DPR no Q0.
    const base = { alvo: 7, atributo: 4 };
    const tipos = [[2, 4.5], [1, 3.5], [0, 2.5]].map(([b, d]) =>
        r2(dpr({ ...base, barreira: b, dadoMedio: d })));
    assert.deepEqual(tipos, [tipos[0], tipos[0], tipos[0]], 'a régua de dado tem que empatar os três tipos');

    console.log('✅ 14 asserts passaram.');
}

if (process.argv.includes('--self-test')) { autoTeste(); process.exit(0); }
autoTeste();

/* ═══ CALIBRAÇÃO NO BANCO ══════════════════════════════════════════════════ */

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds, mecs] = await Promise.all(['equipment', 'derivedValues', 'mechanics'].map(grab));

const vdNome = id => (vds.find(v => v.id === id) || {}).nome || '';
const blindagemDe = i => (i.valoresDerivadosVinculados || [])
    .filter(v => vdNome(v.derivedValueId || v.id) === 'Blindagem')
    .reduce((s, v) => s + (Number(v.modificador) || 0), 0);
const protecoes = eq.filter(i => (i.valoresDerivadosVinculados || [])
    .some(v => vdNome(v.derivedValueId || v.id) === 'Blindagem'));

const fmt = m => JSON.stringify((m?.config?.calculos || []).map(c => `${c.alvo} ${c.operacao || ''}`)) ;
const vit = mecs.find(m => m.nome === 'Vitalidade');
const ener = mecs.find(m => m.nome === 'Energia');
const arcanos = eq.filter(i => (i.valoresDerivadosVinculados || [])
    .some(v => vdNome(v.derivedValueId || v.id) === 'Blindagem Arcana')).length;

/* Premissas de personagem — o par de referência do §6.3. */
const ATRIBUTO = 4, PERICIA = 3, DEF_BASE = 5;
/* Blindagem por golpe = soma do arnês. O default 2 é conservador; --blindagem=N
   troca para o que a sua mesa realmente veste. */
const BLINDAGEM_FIS = Number((process.argv.find(a => a.startsWith('--blindagem=')) || '').split('=')[1]) || 2;
/* O orçamento da magia é ancorado no que a ARMA de referência entrega de fato
   (Espada Longa 1d8, Q0), não num número fixo — senão mudar a Blindagem
   compensa o mago pela régua de dado e deixa o guerreiro para trás. */
const ALVO_LIQUIDO = 4.5 + ATRIBUTO - BLINDAGEM_FIS;
const VITALIDADE = 18;                         // (VIG 3 + Tamanho 3) × 3
const BA = arcanos === 0 ? 0 : 2;              // hoje o catálogo não tem nenhuma

const n2 = v => v.toFixed(2);
const linha = '─'.repeat(74);

console.log('\n' + '═'.repeat(74));
console.log('AUDITORIA DO SOQUETE MÁGICO v2   (só leitura)');
console.log('═'.repeat(74));
console.log(`Catálogo: ${protecoes.length} proteções · Blindagem ${[...new Set(protecoes.map(blindagemDe))].sort().join(', ')}`);
console.log(`Itens que dão Blindagem Arcana: ${arcanos}  → BA de referência = ${BA}`);
console.log(`Vitalidade = ${vit ? '(VIG + Tamanho) × 3' : '?'} → ${VITALIDADE} no par de referência`);
console.log(`Energia    = ${ener ? 'PRS + AUT' : '?'} → 7 típico (PRS 4 + AUT 3)`);
console.log(`Personagem: atributo ${ATRIBUTO}, perícia ${PERICIA}, defensor Reação+perícia = ${DEF_BASE}`);

/* ── 1. Escada de Qualidade ─────────────────────────────────────────────── */
console.log('\n' + linha);
console.log('1) ESCADA DE QUALIDADE — arma (Q vai pro dano) × mago (Q vai pro Acerto)');
console.log(linha);
console.log('  Q │  arma  │ mago fís │ mago ess │  Δ mago vs arma');
for (let q = 0; q <= 5; q++) {
    const arma = dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5 + q, atributo: ATRIBUTO, barreira: BLINDAGEM_FIS });
    const alvoMago = ATRIBUTO + PERICIA + q;
    const mFis = dpr({ alvo: alvoMago, dadoMedio: dadoDaBarreira(BLINDAGEM_FIS, ATRIBUTO, ALVO_LIQUIDO), atributo: ATRIBUTO, barreira: BLINDAGEM_FIS });
    const mEss = dpr({ alvo: alvoMago, dadoMedio: dadoDaBarreira(BA, ATRIBUTO, ALVO_LIQUIDO), atributo: ATRIBUTO, barreira: BA });
    const d = (mFis / arma - 1) * 100;
    console.log(`  ${q} │  ${n2(arma)}  │   ${n2(mFis)}   │   ${n2(mEss)}   │  ${d >= 0 ? '+' : ''}${d.toFixed(0)}%`);
}

/* ── 2. Custo em Energia × dado ─────────────────────────────────────────── */
console.log('\n' + linha);
console.log('2) CUSTO EM ENERGIA — pool 7, combate de 5 rodadas');
console.log(linha);
const ORCAMENTO = dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5, atributo: ATRIBUTO, barreira: BLINDAGEM_FIS }) * 5;
console.log(`  Orçamento do combate = ${n2(ORCAMENTO)} de dano (5 rodadas de guerreiro Q0)`);
for (const custo of [1, 2, 3, 4]) {
    const n = Math.min(5, Math.floor(7 / custo));
    const bruto = ORCAMENTO / n / pDano(ATRIBUTO + PERICIA, DEF_BASE);
    const dado = bruto - ATRIBUTO + BLINDAGEM_FIS;
    const nota = custo > 3 ? '  ⚠ sobra Energia parada — faixa útil é 1–3' : '';
    console.log(`  ${custo} Energia → ${n} conjuração(ões) · dado alvo ${n2(dado)} ≈ ${custo}d8${nota}`);
}

/* ── 3. Matchup abissal ─────────────────────────────────────────────────── */
console.log('\n' + linha);
console.log('3) CONTRA ALVO ABISSAL — fraqueza N divide por 2^N (piso 1)');
console.log(linha);
const casos = [
    ['Invocador (Abissal)',      0, BA,             0],
    ['Pallacerdote (Luz)',       0, BA,             0],
    ['Outro mago (Essência)',    1, BA,             0],
    ['Guerreiro (físico)',       1, BLINDAGEM_FIS,  0],
];
for (const [nome, fraq, barr, tr] of casos) {
    const d = dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: dadoDaBarreira(barr, ATRIBUTO, ALVO_LIQUIDO),
                    atributo: ATRIBUTO, barreira: barr, fraqueza: fraq, traicao: tr });
    console.log(`  ${nome.padEnd(24)} fraq ${fraq} → DPR ${n2(d)} · ${(VITALIDADE / d).toFixed(0)} rodadas sozinho`);
}
const grupo = 4 * dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5, atributo: ATRIBUTO, barreira: BLINDAGEM_FIS, fraqueza: 1 });
const grupoCheio = 4 * dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5, atributo: ATRIBUTO, barreira: BLINDAGEM_FIS });
console.log(`  ${'Grupo de 4 sem Invocador'.padEnd(24)}        → DPR ${n2(grupo)} · ${(VITALIDADE / grupo).toFixed(0)} rodadas`);
/* Uma ameaça de chefe é dimensionada para durar ~5 rodadas contra o grupo
   inteiro em força total. A abissal precisa da mesma duração com o grupo
   levando fraqueza 2 — o arredondamento para baixo torna o corte bem mais
   fundo que o "um quarto" que a conta de cabeça sugeria. */
const vitChefe = grupoCheio * 5, vitAbissal = grupo * 5;
console.log(`\n  Vitalidade para durar 5 rodadas contra um grupo de 4:`);
console.log(`    ameaça comum  ${vitChefe.toFixed(0).padStart(3)}`);
console.log(`    abissal       ${vitAbissal.toFixed(0).padStart(3)}  → ${(vitAbissal / vitChefe * 100).toFixed(0)}% do normal (~1/${(vitChefe / vitAbissal).toFixed(0)})`);
console.log(`  O piso de 1 e o arredondamento para baixo cortam mais fundo que 25%:`);
console.log(`  o dano líquido cai de ${n2(grupoCheio)} para ${n2(grupo)}, ou seja ${(grupo / grupoCheio * 100).toFixed(0)}%.`);

/* ── 4. Invocador: a escada de CA ───────────────────────────────────────── */
console.log('\n' + linha);
console.log('4) INVOCADOR — nenhum ritual causa dano; o eixo é CA × Sanidade');
console.log(linha);
const modInvoc = (await grab('classModules')).find(m => m.id === 'TbRKh68m2hvr9KUVrOXb');
const lbl = Object.fromEntries((modInvoc?.schema || []).map(f => [f.key, f.label]));
const chave = alvo => Object.keys(lbl).find(k => (lbl[k] || '').startsWith(alvo));
const kCA = chave('CA mínimo'), kSan = chave('Custo Sanidade'), kEner = chave('Custo em Energia');
const rituais = (modInvoc?.itensPredefinidos || [])
    .map(it => ({ nome: it.nome, ca: +(it.valores?.[kCA] || 0), san: +(it.valores?.[kSan] || 0), ener: +(it.valores?.[kEner] || 0) }))
    .sort((a, b) => a.ca - b.ca);
console.log('  CA │ Ener │ San │ ritual');
for (const r of rituais) console.log(`  ${String(r.ca).padStart(2)} │  ${r.ener}   │  ${r.san}  │ ${r.nome}`);
const caVD = vds.find(v => v.nome === 'Conexão com Abismo');
const sanMec = mecs.find(m => m.nome === 'Sanidade');
console.log(`\n  Sanidade Máxima = ${sanMec ? '(INT + AUT + PRS + Perícia: Resiliência) × 2' : '?'} → ~24 típico`);
console.log(`  Sanidade para conjurar tudo uma vez: ${rituais.reduce((s, r) => s + r.san, 0)}`);
console.log(`  "Conexão com Abismo" (= CA) tem equação no banco? ${caVD?.equacao?.length ? 'sim' : '❌ ainda não'}`);
console.log('  → "virar contra o grupo" é a Disposição da criatura (Laço de Nome ±1),');
console.log('    estatística rastreada, não sorteio. Nada a modelar aqui.');

/* CA = ⌊Perícia: Abismancia ÷ 2⌋ + a fração de Sanidade JÁ PERDIDA em décimos.
   O arredondamento é o do motor da ficha (derived-values.js `dvValorDeMesa`,
   Livro §5.4): para baixo, mas mínimo 1 quando o valor é maior que zero. */
const valorDeMesa = v => (v > 0 ? Math.max(1, Math.floor(v)) : Math.floor(v) || 0);
const CA = (san, max, abismancia = 0) =>
    Math.floor(abismancia / 2) + valorDeMesa(10 * (1 - san / max));

assert.equal(valorDeMesa(0), 0, 'zero continua zero');
assert.equal(valorDeMesa(0.42), 1, 'positivo abaixo de 1 sobe para 1 — regra do §5.4');
assert.equal(valorDeMesa(8.33), 8, 'acima de 1 é piso');
assert.equal(CA(10, 20), 5, 'exemplo do dono do mundo: 10/20 → CA 5');
assert.equal(CA(20, 20), 0, 'mente intacta e sem treino → CA 0');
assert.equal(CA(20, 20, 4), 2, 'Abismancia 4 dá o pé na porta: CA 2 são');

const SAN_MAX = 24;                            // (INT 3 + AUT 3 + PRS 4 + Resiliência 2) × 2
const caMin = Math.min(...rituais.map(r => r.ca));
console.log(`\n  ESCADA DE CA — Sanidade máxima ${SAN_MAX}, arredondamento do motor`);
for (const abis of [0, 4]) {
    console.log(`\n  Abismancia ${abis} (base ${Math.floor(abis / 2)}):`);
    console.log('    CA │ Sanidade │ invoca? │ destrava');
    for (const alvoCA of [...new Set(rituais.map(r => r.ca))].sort((a, b) => a - b)) {
        let san = SAN_MAX; while (san > 0 && CA(san, SAN_MAX, abis) < alvoCA) san--;
        const quais = rituais.filter(r => r.ca === alvoCA).map(r => r.nome).join(', ');
        const custoInvoc = rituais.find(r => /Invoca..o Abissal/.test(r.nome))?.san ?? 4;
        const podeInvocar = san - custoInvoc > 0;
        console.log(`    ${String(alvoCA).padStart(2)} │  ${String(san).padStart(2)}/${SAN_MAX}   │   ${podeInvocar ? 'sim' : '❌ '}   │ ${quais}`);
    }
    console.log(`    mente intacta → CA ${CA(SAN_MAX, SAN_MAX, abis)}` +
        (CA(SAN_MAX, SAN_MAX, abis) < caMin ? `  ⚠ abaixo do mínimo ${caMin}: não conjura nada` : '  ✅ já entra na escada'));
}

/* ── 5. Janela letal ────────────────────────────────────────────────────── */
console.log('\n' + linha);
console.log('5) SENSIBILIDADE À BLINDAGEM — o parâmetro mais incerto do modelo');
console.log(linha);
/* O modelo usa UM número de Blindagem por golpe. Quanto vale esse número
   depende de como a v2 aplica a proteção (por região atingida, ou soma do
   arnês) — e isso não está no banco. Um arnês Q0 completo soma 8 no catálogo;
   a média por região é bem menor. Em vez de fixar um valor e afirmar coisas em
   cima dele, aqui está a sensibilidade: quantas rodadas dura o pareado para
   cada Blindagem, no Q0 e no Q5. */
console.log('  Blindagem │ rodadas Q0 │ rodadas Q5 │ dentro de 3–10?');
for (const b of [1, 2, 3, 4, 5, 6, 8]) {
    const r0 = VITALIDADE / dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5, atributo: ATRIBUTO, barreira: b });
    const r5 = VITALIDADE / dpr({ alvo: ATRIBUTO + PERICIA, dadoMedio: 4.5 + 5, atributo: ATRIBUTO, barreira: b });
    const ok = [r0, r5].every(r => r >= 3 && r <= 10);
    console.log(`     ${String(b).padStart(2)}     │   ${r0.toFixed(1).padStart(5)}    │   ${r5.toFixed(1).padStart(5)}    │  ${ok ? '✅' : '⚠'}`);
}
console.log(`\n  A Blindagem que entra no golpe é a SOMA do arnês (confirmado pelo dono do`);
console.log(`  sistema; já balanceado). O melhor-de-cada-região do catálogo soma 8 no Q0,`);
console.log(`  mas isso é o teto teórico — inclui Escudo de Torre, que custa a mão da arma.`);
console.log(`  Rode com --blindagem=N para usar o valor típico da sua mesa.`);

console.log('\n' + linha);
console.log('SUPOSIÇÃO NÃO CONFIRMADA: efeitos não numéricos (controle, cegueira,');
console.log('zonas) tratados como "fraqueza N = −N no Alvo do teste". Não medido aqui.');
console.log(linha + '\n');
process.exit(0);
