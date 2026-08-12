/* Auditoria: câmbio da Carga do Sangral + portão de resistência mensurável.
   node functions/__audit-carga-provocado.mjs                                 */
import assert from 'node:assert/strict';

/* ═══ Linha de base — Régua §0.2 a §1.1 ═══ */
const U = 3.445;                 // 1 unidade = DPR do guerreiro em Q0
const P_INIMIGO = 0.53, CENA = 5;
const DANO = 1 / U;              // 0,290 por ponto de dano (e de Vitalidade)
const ALVO = 0.585 / U;          // 0,170 por ±1 no Alvo, por rodada
const BLIND = (P_INIMIGO * 1) / U;
assert.ok(Math.abs(DANO - 0.290) < 0.001 && Math.abs(ALVO - 0.170) < 0.001
       && Math.abs(BLIND - 0.154) < 0.001, 'as taxas têm que sair da unidade 3,445');

/* ═══ 1. CÂMBIO APROVADO: 1 Carga = 3 Vitalidade ═══ */
const VIT_POR_CARGA = 3;
const CARGA = VIT_POR_CARGA * DANO;            // 0,871 unidades
const ENERGIA = 1.00;
const ACAO = 1.00;                             // §1.1, o ataque que não se fez
console.log(`1 Carga = ${VIT_POR_CARGA} Vitalidade = ${CARGA.toFixed(3)} un   (1 Energia = ${(ENERGIA/CARGA).toFixed(2)} Cargas)\n`);
const custo = (cargas = 0, en = 0, acoes = 0) => cargas * CARGA + en * ENERGIA + acoes * ACAO;

const sangral = [
  ['Lâmina Hemática',   2, 0, 0, 3 * P_INIMIGO * CENA * DANO,  '+3 dano, 5 rod'],
  ['Escudo Hemático',   2, 0, 0, 2 * BLIND * CENA,             '+2 Blindagem, 5 rod'],
  ['Agulhas Sanguíneas',3, 0, 0, 4 * 6.5 * P_INIMIGO * DANO,   '4 agulhas'],
  ['Armadura Sanguínea',4, 1, 0, 3 * BLIND * CENA,             '+3 Blindagem, 5 rod'],
];
console.log('SANGRAL                       custo   entrega  razão   veredito');
for (const [nome, cg, en, ac, entrega, nota] of sangral) {
  const c = custo(cg, en, ac), r = entrega / c;
  console.log(`${nome.padEnd(28)}${c.toFixed(2).padStart(6)}${entrega.toFixed(2).padStart(9)}  ${r.toFixed(2).padStart(5)}×  ${r<1?'SUB':r>1.7?'ESTOURA':'ok'}   (${nota})`);
}

/* Absorção Hemática: "dano derramado ÷ 3" já É a taxa nova — o texto e o
   câmbio passam a concordar sozinhos. E o §4.7 exige contar a ação. */
const devolve = 3 * CARGA, gasto = custo(0, 1, 1);
console.log(`\nAbsorção Hemática: gasta ${gasto.toFixed(2)} un (1 Energia + 1 Ação), devolve até 3 Cargas = ${devolve.toFixed(2)} un → ${(devolve/gasto).toFixed(2)}×`);
assert.equal(VIT_POR_CARGA, 3, 'o "÷3" do texto tem que casar com o câmbio, senão há arbitragem');

/* ═══ 2. PORTÃO DE RESISTÊNCIA — o Redutor é o Chance do teste resistido ═══
   Resolução do sistema: 1d10 ≤ Alvo, e 10 sempre falha. O alvo RESISTE com
   Alvo A; a condição pega quando ele falha.                              */
const ALVO_RESIST_BASE = 7;                    // mesmo Alvo da linha de base §0.2
const pFalha = (redutor) => 1 - Math.min(Math.max(ALVO_RESIST_BASE + redutor, 0), 9) / 10;
console.log('\n═══ Redutor = o Chance do teste resistido ═══');
console.log('Redutor  Alvo do alvo  P(falha)  equivale a Chance');
for (const r of [0, -1, -2, -3, -4]) {
  const p = pFalha(r);
  console.log(`  ${String(r).padStart(2)}         ${ALVO_RESIST_BASE + r}          ${p.toFixed(2)}        ${(p * 10).toFixed(0)}`);
}
assert.ok(Math.abs(pFalha(-2) - 0.50) < 1e-9, 'Redutor −2 tem que reproduzir o ×0,50 do exemplo do §6.1');

/* ═══ 3. PROVOCADO, com teste resistido ═══ */
const PROVOCADO = 2 * ALVO;                    // −2 no Alvo contra outro alvo
const valor = (alvos, rodadas, redutor) => pFalha(redutor) * PROVOCADO * rodadas * alvos;
console.log(`\nProvocado = −2 no Alvo contra quem não provocou = ${PROVOCADO.toFixed(3)} un/rodada/alvo`);
console.log('\nalvos rodadas Redutor  valor   custo1  custo2  custo3');
for (const [a, rd, red] of [[3,5,0],[2,5,0],[3,5,-2],[4,5,-2],[3,5,-4],[2,5,-3],[5,2,-2]]) {
  const v = valor(a, rd, red);
  const f = (c) => { const x = v/c; return `${x.toFixed(2)}×${x>=1&&x<=1.7?'✓':' '}`; };
  console.log(`  ${a}     ${rd}      ${String(red).padStart(2)}    ${v.toFixed(2).padStart(5)}   ${f(1)}  ${f(2)}  ${f(3)}`);
}
const escolhido = valor(3, 5, 0);
assert.ok(escolhido/1 >= 1.00 && escolhido/1 <= 1.70,
  '3 alvos / cena / sem Redutor a custo 1 tem que caber na faixa');

/* ═══ 4. O achado grande: resistência foi gravada SEM desconto ═══ */
console.log('\n═══ As 7 com portão de resistência, relidas ═══');
console.log('(o catálogo gravou P=1,00 — como se o alvo nunca resistisse)');
console.log('habilidade                  custo  gravada   com Redutor −2 (P 0,50)');
for (const [nome, un, c] of [['INTIMIDAÇÃO SÔNICA',1.70,1],['NANA DO ENTORPECIMENTO',2.35,2],
                             ['ONDA DE CHOQUE SONORAL',3.96,3],['TROMBETA DO JULGAMENTO',7.01,5]]) {
  const g = un/c, real = (un*0.50)/c;
  console.log(`${nome.padEnd(28)}${String(c).padStart(4)}   ${g.toFixed(2)}×     ${real.toFixed(2)}×  ${real<1?'← REPROVA':''}`);
}
console.log('\n✅ asserts passaram.');

/* ═══ 5. BARDO — custo é intocável (é o tier), então mexe-se no efeito ═══
   Correção do diagnóstico anterior: os Redutores NÃO são −2 uniformes, eles
   escalam com o tier (−2,−2,−3,−4,−5,−5,−6). E as unidades gravadas de
   quatro canções batem EXATAMENTE com o valor da condição sozinha — o dano
   que o texto descreve não entrou na conta.

   ATENÇÃO, âncora ausente: o teste é "AUT vs GS", disputado contra os Graus
   do bardo, não contra um Alvo fixo. A régua não tem a distribuição desse
   contestado (§5.3 devia listar). Uso o ×0,50 que o próprio §6.1 usa de
   ilustração, e mostro a sensibilidade em volta.                          */
const POR_RODADA = { Amedrontado: 0.17, Ofuscado: 0.37, Lento: 0.10, Prostrado: 0.47 };
const ATORDOADO = 1.32;

console.log('\n═══ BARDO — as duas canções que são SÓ condição ═══');
console.log('(nas outras quatro o texto tem dano que não foi contado; sem a magnitude não fecho)');
const limpas = [
  { nome: 'INTIMIDAÇÃO SÔNICA', custo: 1, red: -2, alvos: 2, rodadas: 5, conds: ['Amedrontado'] },
  { nome: 'NANA DO ENTORPECIMENTO', custo: 2, red: -3, alvos: 1, rodadas: 5, conds: ['Lento', 'Ofuscado'] },
];
const cheioDe = (c) => c.conds.reduce((s, n) => s + POR_RODADA[n] * c.rodadas, 0) * c.alvos;

for (const P of [0.40, 0.50, 0.60]) {
  console.log(`\n  se P(o alvo falha) = ${P.toFixed(2)}:`);
  for (const c of limpas) {
    const atual = P * cheioDe(c) / c.custo;
    // único botão permitido: mais alvos (o custo é o tier, não se toca)
    let alvos = c.alvos, r = atual;
    while (r < 1.00 && alvos < 8) { alvos++; r = P * cheioDe({ ...c, alvos }) / c.custo; }
    console.log(`    ${c.nome.padEnd(24)} ${atual.toFixed(2)}×  →  ${alvos} alvos (era ${c.alvos}) = ${r.toFixed(2)}×`);
  }
}

/* O que NÃO dá para fechar sem você: a magnitude do dano das outras quatro. */
console.log('\n  faltam a magnitude do dano de: ONDA DE CHOQUE (impacto), LAMENTO ((Composição)d4),');
console.log('  MARCHA (1d6), TROMBETA (1d6) — as quatro têm dano no texto e zero dano na régua.');

assert.ok(0.50 * cheioDe(limpas[0]) / 1 < 1.00, 'INTIMIDAÇÃO reprova hoje com desconto de resistência');
assert.ok(0.50 * cheioDe({ ...limpas[0], alvos: 3 }) / 1 >= 1.00, 'e passa com 3 alvos');
console.log('\n✅ asserts passaram.');
