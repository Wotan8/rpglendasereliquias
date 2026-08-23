/**
 * Propaga a base nova (unidade 3,445 → 3,90) do §0.2 para o resto da Régua.
 *
 * O combate v3 tirou o dado do defensor. A unidade saiu de 3,445 para 3,90, e
 * com ela toda taxa derivada. Fonte das taxas novas: §0.2b.
 *
 * NÃO toca no que não deriva da unidade: Blindagem e "+N de dano num golpe"
 * valem 1 ÷ 6,5 (o P cancela), turno roubado e Desarmar são ações, e a âncora
 * do Lento é estimativa declarada.
 *
 *   node functions/propagar-base-390.mjs            (dry-run)
 *   node functions/propagar-base-390.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const col = db.collection('worldbuilding-articles');
const plano = [];

const troca = async (id, pares, rotulo) => {
    const ref = col.doc(id);
    const a = (await ref.get()).data();
    let h = a.contentHTML, n = 0;
    for (const [de, para] of pares) {
        if (!h.includes(de)) { console.log(`  AVISO ${rotulo}: ancora nao achada -- ${de.slice(0, 70)}`); continue; }
        h = h.replaceAll(de, para); n++;
    }
    if (n) plano.push({ rotulo: `${rotulo} (${n}/${pares.length})`, f: () => ref.update({
        contentHTML: h,
        words: h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        updatedAt: Date.now(),
    }) });
};

const CAP1 = '0p00vfreClWjXlAGR9YM', CAP6 = 'gc3xRb9UpDWKq2CGjzh8';

/* ── §1.1 taxas de conversão ── */
await troca(CAP1, [
    ['<td>1 ponto de dano</td><td>0,290</td><td>1 ÷ 3,445</td>',
        '<td>1 ponto de dano <em>entregue</em></td><td>0,256</td><td>1 ÷ 3,90</td>'],
    ['<td>1 ponto de cura</td><td>0,290</td><td>dano desfeito</td>',
        '<td>1 ponto de cura</td><td>0,256</td><td>dano desfeito</td>'],
    ['<td>+1 Blindagem, por rodada</td><td>0,154</td><td>0,53 × 1 ÷ 3,445 — só rende no golpe que entra</td>',
        '<td>+1 Blindagem, por rodada</td><td>0,154</td><td>0,60 × 1 ÷ 3,90 = 1 ÷ 6,5 — o P cancela. Vale igual para qualquer bônus que só rende no golpe que entra, e por isso NÃO mudou com a base</td>'],
    ['<td>±1 no Alvo, por rodada</td><td>0,170</td><td>0,585 ÷ 3,445</td>',
        '<td>±1 no Alvo, por rodada</td><td>0,167</td><td>0,10 × 6,5 ÷ 3,90</td></tr>\n<tr><td>∓1 na Defesa do alvo, por rodada</td><td>0,167</td><td>idêntico ao Alvo desde o v3 (§0.1)</td>'],
    ['<td>Atacar quem não pode reagir</td><td>0,320</td><td>(0,70 − 0,53) × 6,5 ÷ 3,445 — §6.4</td>',
        '<td>Atacar quem não pode reagir</td><td>0,167</td><td>(0,70 − 0,60) × 6,5 ÷ 3,90 — caiu à metade: a Defesa de referência do v3 é 1, não 5</td>'],
], '1.1 taxas de conversao');

/* ── §1.5 tabela de projeto ── */
await troca(CAP1, [
    ['<tr><td>1</td><td>3,4</td><td>6</td><td>7</td><td>1</td></tr>', '<tr><td>1</td><td>3,9</td><td>6</td><td>7</td><td>1</td></tr>'],
    ['<tr><td>2</td><td>6,9</td><td>12</td><td>13</td><td>2</td></tr>', '<tr><td>2</td><td>7,8</td><td>12</td><td>13</td><td>2</td></tr>'],
    ['<tr><td>3</td><td>10,3</td><td>18</td><td>20</td><td>3</td></tr>', '<tr><td>3</td><td>11,7</td><td>18</td><td>20</td><td>3</td></tr>'],
    ['<tr><td>5</td><td>17,2</td><td>29</td><td>33</td><td>5</td></tr>', '<tr><td>5</td><td>19,5</td><td>30</td><td>33</td><td>5</td></tr>'],
], '1.5 tabela de projeto');

/* ── §6.3 valor cheio das condições ── */
await troca(CAP6, [
    ['<p>No Q0, unidade 3,445 (§0.3). Cena = 5 rodadas, o teto do §1.3.</p>',
        '<p>No Q0, unidade <strong>3,90</strong> (§0.2). Cena = 5 rodadas, o teto do §1.3.</p>'],
    ['<td>1,32</td><td>1,000 turno roubado + 0,320 atacar quem não pode reagir (§1.1). Dura 1 turno</td>',
        '<td>1,167</td><td>1,000 turno roubado + 0,167 atacar quem não pode reagir (§1.1). Dura 1 turno</td>'],
    ['<td>1,05</td><td>5,23</td><td>(2,15 + 4) × 0,170 — Desvantagem mais −4 no Alvo, × 5 rodadas</td>',
        '<td>1,03</td><td>5,14</td><td>(2,15 + 4) × 0,167 — Desvantagem mais −4 no Alvo, × 5 rodadas</td>'],
    ['<td>0,37</td><td>1,83</td><td>2,15 × 0,170 — só a Desvantagem, × 5 rodadas</td>',
        '<td>0,36</td><td>1,80</td><td>2,15 × 0,167 — só a Desvantagem, × 5 rodadas</td>'],
    ['<td>0,17</td><td>0,85</td><td>1 × 0,170 — −1 no Alvo de tudo, × 5 rodadas</td>',
        '<td>0,17</td><td>0,84</td><td>1 × 0,167 — −1 no Alvo de tudo, × 5 rodadas</td>'],
    ['<td>+0,47 / −0,66</td><td>ver abaixo</td><td>(5,07 − 3,445) ÷ 3,445 contra CaC; (1,17 − 3,445) ÷ 3,445 contra atirador</td>',
        '<td>+0,50 / −0,67</td><td>ver abaixo</td><td>(0,90 − 0,60) × 6,5 ÷ 3,90 contra CaC; (0,20 − 0,60) × 6,5 ÷ 3,90 contra atirador</td>'],
    ['+4 no Alvo de quem bate de perto vale +0,47 por rodada; −4 no Alvo de quem atira vale −0,66. Com um de cada batendo no mesmo turno, o saldo é <strong>−0,19</strong>',
        '+4 no Alvo de quem bate de perto vale +0,50 por rodada; −4 no Alvo de quem atira vale −0,67. Com um de cada batendo no mesmo turno, o saldo é <strong>−0,17</strong>'],
], '6.3 valor cheio das condicoes');

/* ── §6.4 tabela de desconto por Chance ── */
await troca(CAP6, [
    ['<td>Cego</td><td>5,23</td><td>4,18</td><td>3,14</td><td>2,61</td><td>2,09</td><td>1,57</td><td>1,05</td>',
        '<td>Cego</td><td>5,14</td><td>4,11</td><td>3,08</td><td>2,57</td><td>2,06</td><td>1,54</td><td>1,03</td>'],
    ['<td>Ofuscado</td><td>1,83</td><td>1,46</td><td>1,10</td><td>0,91</td><td>0,73</td><td>0,55</td><td>0,37</td>',
        '<td>Ofuscado</td><td>1,80</td><td>1,44</td><td>1,08</td><td>0,90</td><td>0,72</td><td>0,54</td><td>0,36</td>'],
    ['<td>Atordoado</td><td>1,32</td><td>1,06</td><td>0,79</td><td>0,66</td><td>0,53</td><td>0,40</td><td>0,26</td>',
        '<td>Atordoado</td><td>1,17</td><td>0,93</td><td>0,70</td><td>0,58</td><td>0,47</td><td>0,35</td><td>0,23</td>'],
    ['<td>Amedrontado</td><td>0,85</td><td>0,68</td><td>0,51</td><td>0,43</td><td>0,34</td><td>0,26</td><td>0,17</td>',
        '<td>Amedrontado</td><td>0,84</td><td>0,67</td><td>0,50</td><td>0,42</td><td>0,33</td><td>0,25</td><td>0,17</td>'],
    ['<td>Prostrado</td><td>0,47</td><td>0,38</td><td>0,28</td><td>0,24</td><td>0,19</td><td>0,14</td><td>0,09</td>',
        '<td>Prostrado</td><td>0,50</td><td>0,40</td><td>0,30</td><td>0,25</td><td>0,20</td><td>0,15</td><td>0,10</td>'],
], '6.4 desconto por Chance');

/* ── §6.5 os três casos medidos ── */
await troca(CAP6, [
    ['<td>Cego C=3 + Amedrontado C=6</td><td>2,08</td><td>2</td><td>1,04:1 ✅</td>',
        '<td>Cego C=3 + Amedrontado C=6</td><td>2,04</td><td>2</td><td>1,02:1 ✅</td>'],
    ['<td>Lento C=10 + Prostrado C=5</td><td>0,74</td><td>1</td><td>0,74:1 ❌</td>',
        '<td>Lento C=10 + Prostrado C=5</td><td>0,75</td><td>1</td><td>0,75:1 ❌</td>'],
    ['<td>Surdo C=10 + Atordoado C=4</td><td>0,53</td><td>5</td><td>0,11:1 ❌</td>',
        '<td>Surdo C=10 + Atordoado C=4</td><td>0,47</td><td>5</td><td>0,09:1 ❌</td>'],
], '6.5 casos medidos');

/* ── §6.13 teto do imposto sobre ação ── */
await troca(CAP6, [
    ['2 × d × 0,290', '2 × d × 0,256'],
    ['<td>1</td><td>0,58</td><td>1,00</td><td><strong>0,58</strong></td>', '<td>1</td><td>0,51</td><td>1,00</td><td><strong>0,51</strong></td>'],
    ['<td>2</td><td>1,16</td><td>1,00</td>', '<td>2</td><td>1,02</td><td>1,00</td>'],
    ['<td>3</td><td>1,74</td><td>1,00</td>', '<td>3</td><td>1,54</td><td>1,00</td>'],
    ['<td>4</td><td>2,32</td><td>1,00</td>', '<td>4</td><td>2,05</td><td>1,00</td>'],
    ['A conta ingênua do Congelamento Nv 2 dá 1,16', 'A conta ingênua do Congelamento Nv 2 dá 1,02'],
    ['4 de dano = 1,16 un', '4 de dano = 1,02 un'],
    ['um imposto de 1 por ação vale 0,58, e no piso entrega 1,45 na cena', 'um imposto de 1 por ação vale 0,51, e no piso entrega 1,28 na cena'],
], '6.13 imposto por acao');

console.log(`\n${plano.length} secoes${APPLY ? '' : ' (DRY-RUN)'}:`);
plano.forEach(p => console.log(`  - ${p.rotulo}`));
if (APPLY) { for (const p of plano) await p.f(); console.log('\nAPLICADO'); }
process.exit(0);
