/* Redutor no teste de CONJURAR: as duas penalidades se multiplicam.
   node functions/__audit-bardo-redutor.mjs                                   */
import assert from 'node:assert/strict';

const pSucesso = (A) => Math.max(0, Math.min(A, 9)) / 10;
const grausMedios = (A) => { const a = Math.max(0, Math.min(A, 9)); return a ? (a - 1) / 2 : 0; };
const pAlvoFalha = (At, gs) => 1 - Math.max(0, Math.min(At - gs, 9)) / 10;
const ALVO = 7;                                   // linha de base §0.2, conjurador e alvo
/** P de o efeito realmente acontecer, dado o Redutor no teste de conjurar. */
const pTotal = (red, chance = null) => {
  const A = ALVO + red, gs = grausMedios(A);
  return pSucesso(A) * (chance !== null ? chance / 10 : pAlvoFalha(ALVO, gs));
};

const AMEDRONTADO = 0.17, OFUSCADO = 0.37, LENTO = 0.10, ATORDOADO = 1.32;
const PROVOCADO = 2 * (0.585 / 3.445);            // −2 no Alvo = 0,340/rodada/alvo

console.log('═══ BARDO com o Redutor ACHATADO em 0 ═══');
console.log(`P(conjurar) ${pSucesso(ALVO).toFixed(2)} · GS médio ${grausMedios(ALVO).toFixed(1)} · P(alvo falha) ${pAlvoFalha(ALVO, grausMedios(ALVO)).toFixed(2)} → P total ${pTotal(0).toFixed(2)}\n`);
console.log('canção                custo  hoje    alvos p/ entrar na faixa');
const bardo = [
  ['GRITO DISSONANTE', 1, 1, (n) => ATORDOADO * n, 8],
  ['INTIMIDAÇÃO SÔNICA', 1, 2, (n) => AMEDRONTADO * 5 * n, null],
  ['NANA DO ENTORPECIMENTO', 2, 1, (n) => (LENTO + OFUSCADO) * 5 * n, null],
];
for (const [nome, custo, alvosHoje, cheio, chance] of bardo) {
  const p = pTotal(0, chance);
  const razao = (n) => p * cheio(n) / custo;
  let n = alvosHoje; while (razao(n) < 1.00 && n < 12) n++;
  console.log(`${nome.padEnd(24)}${String(custo).padStart(4)}   ${razao(alvosHoje).toFixed(2)}×   ${alvosHoje} → ${n} alvos = ${razao(n).toFixed(2)}×`);
}
console.log('  (ONDA, LAMENTO, MARCHA e TROMBETA seguem travadas: têm dano no texto e nenhum na régua)');

console.log('\n═══ PALLACERDOTE — os dois Brilhos, com Provocado ═══');
console.log('(Redutor deles é baixo e fica como está; o preço é que se ajusta)');
console.log('brilho                    Red  P total  alvos  razão a custo 1');
for (const [nome, red] of [['Brilho Chamativo da Fé I', -3], ['Brilho Provocativo da Fé I', -1]]) {
  const p = pTotal(red);
  const razao = (n) => p * PROVOCADO * 5 * n;
  let n = 1; while (razao(n) < 1.00 && n < 12) n++;
  const linha = [n, n + 1].filter(x => razao(x) <= 1.70)
    .map(x => `${x} alvos = ${razao(x).toFixed(2)}×`).join('  |  ');
  console.log(`${nome.padEnd(26)}${String(red).padStart(3)}   ${p.toFixed(3)}    ${linha}`);
}

/* Travas: o que esta auditoria decidiu não pode voltar calado. */
assert.ok(pTotal(0) > pTotal(-6) * 10, 'achatar o Redutor tem que valer mais de 10× no topo');
assert.ok(pTotal(0) * AMEDRONTADO * 5 * 4 / 1 >= 1.00, 'INTIMIDAÇÃO a 4 alvos entra na faixa');
assert.ok(pTotal(0) * (LENTO + OFUSCADO) * 5 * 3 / 2 >= 1.00, 'NANA a 3 alvos entra na faixa');
assert.ok(pTotal(-3) * PROVOCADO * 5 * 5 <= 1.70, 'Chamativo a 5 alvos não estoura');
console.log('\n✅ asserts passaram.');
