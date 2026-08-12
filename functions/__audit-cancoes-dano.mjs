/* As 4 canções com dano: dado a 85% de uma ARMA DE QUALIDADE = CUSTO.
   Liga ≥ Qualidade ≥ Afiação (audit-graus.mjs); a Afiação é o bônus de dano,
   o "+5" do 1d8+5+4 do §0.4. Área é o botão: mais alvos, não mais dado.
   node functions/__audit-cancoes-dano.mjs                                    */
import assert from 'node:assert/strict';
const U = 3.445, DANO = 1 / U, ATRIB = 4;

/* Arma de Qualidade N com Afiação N: 1d8 + N + atributo. */
const armaBruto = (q) => 4.5 + q + ATRIB;
assert.equal(armaBruto(0), 8.5, 'Q0 tem que dar o 8,5 da linha de base §0.2');
assert.equal(armaBruto(5), 13.5, 'Q5 tem que dar o 13,5 do §0.4');

const ALVO_85 = (custo) => 0.85 * armaBruto(custo);
const dados = { '1d4':2.5,'1d6':3.5,'1d8':4.5,'1d10':5.5,'1d12':6.5,'2d6':7,'2d6+1':8,'2d8':9 };
const maisPerto = (x) => Object.entries(dados).sort((a,b)=>Math.abs(a[1]-x)-Math.abs(b[1]-x))[0];

console.log('custo  arma Q=custo  85% dela  dado que falta  escolhido  bruto  % da arma');
const escolha = {};
for (const custo of [3, 4, 5]) {
  const alvo = ALVO_85(custo), precisa = alvo - ATRIB;
  const [nome, med] = maisPerto(precisa);
  escolha[custo] = nome;
  console.log(`  ${custo}      ${armaBruto(custo).toFixed(1).padStart(5)}       ${alvo.toFixed(2).padStart(5)}      ${precisa.toFixed(2).padStart(5)}        ${nome.padEnd(6)} ${(med+ATRIB).toFixed(1).padStart(5)}   ${(100*(med+ATRIB)/armaBruto(custo)).toFixed(0)}%`);
}

/* Razão com o dado novo. Blindagem 2 (Q0) — a curva Q0→Q5 é ponto em aberto
   do §5.3, então NÃO extrapolo: meço na faixa que a régua tem fechada. */
const P = 0.42, BLIND = 2;
const unDano = (d) => (dados[d] + ATRIB - BLIND) * DANO;
const ATORDOADO = 1.32, PROSTRADO = 0.47, AMEDRONTADO = 0.17, EMPURRAO = 0.333;
const cancoes = [
  { nome:'ONDA DE CHOQUE', custo:3, extras:ATORDOADO+EMPURRAO },
  { nome:'MARCHA DO CATACLISMO', custo:4, extras:PROSTRADO },
  { nome:'LAMENTO DA BANSHEE', custo:4, extras:AMEDRONTADO },
  { nome:'TROMBETA', custo:5, extras:ATORDOADO+EMPURRAO },
];
console.log('\ncanção                custo dado    alvos para a faixa   razão');
for (const c of cancoes) {
  const d = escolha[c.custo];
  const razao = (n) => P * (unDano(d) + c.extras) * n / c.custo;
  let n = 1; while (razao(n) < 1.00 && n < 14) n++;
  const linha = [n, n+1].filter(x=>razao(x)<=1.70).map(x=>`${x} alvos = ${razao(x).toFixed(2)}×`).join('  |  ');
  console.log(`${c.nome.padEnd(22)}${String(c.custo).padStart(4)}  ${d.padEnd(6)}  ${linha}`);
}

/* ═══ PROVOCADO, empilhável até 3 ═══ */
const ALVO_UN = 0.585 / U;
console.log('\n═══ PROVOCADO — empilha até 3 ═══');
for (const n of [1,2,3])
  console.log(`  Provocado ${n}: −${2*n} no Alvo contra quem não provocou = ${(2*n*ALVO_UN).toFixed(2)} un/rodada  (cena: ${(2*n*ALVO_UN*5).toFixed(2)})`);
console.log(`  teto em 3 = ${(6*ALVO_UN).toFixed(2)} un/rodada — entre Imobilizado (0,69) e Cego (1,05)`);
assert.ok(6*ALVO_UN < 1.05, 'o teto do Provocado não pode passar do Cego');
assert.ok(2*ALVO_UN > 0.17, 'e o nível 1 tem que valer mais que Amedrontado, que é mais amplo');
console.log('\n✅ asserts passaram.');
