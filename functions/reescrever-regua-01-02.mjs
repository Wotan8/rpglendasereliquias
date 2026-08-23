/**
 * Régua §0.1 e §0.2 — alinhar a linha de base ao combate v3.
 *
 * O v3 tirou o dado do defensor (Livro §6.1 "Só o atacante rola") e zerou a
 * fórmula do raiz de defesa. A régua ainda descrevia o modelo antigo — defensor
 * rolando, "Reação 3" — e a unidade 3,445 saía dele.
 *
 *   node functions/reescrever-regua-01-02.mjs            (dry-run)
 *   node functions/reescrever-regua-01-02.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('8aLc6aTVahCWswWdhngK');
const d = (await ref.get()).data();

const corte = d.contentHTML.indexOf('<h2>0.3 A unidade');
if (corte < 0) throw new Error('âncora §0.3 não encontrada');
if (d.contentHTML.includes('Só o atacante rola')) throw new Error('§0.1 já está em v3');

const NOVO = `<h2>0.1 A resolução, em números</h2>
<p>Todo teste é <code>1d10 ≤ Alvo</code>. O 10 sempre falha, o 1 é crítico. <strong>Graus = Alvo − resultado.</strong></p>
<p><strong>Só o atacante rola</strong> (Livro §6.1). A Defesa do alvo é um número, não um teste: o golpe passa quando os Graus do atacante são <strong>iguais ou maiores</strong> que ela.</p>
<pre>P(golpe passa) = (Alvo − Defesa) ÷ 10        com Alvo ≤ 9, resultado preso em [0 ; 0,9]</pre>
<p>Linear e fechada: uma rolagem, uma comparação. A versão anterior desta régua somava a rolagem do defensor e precisava de convolução exata sobre os 10 resultados, com piso de 10% pelo crítico natural na defesa. O <strong>combate v3</strong> tirou o dado do defensor, e a convolução saiu junto.</p>
<p><strong>O que isso mudou de verdade:</strong> ±1 no Alvo do atacante e ∓1 na Defesa do alvo agora valem <em>exatamente</em> a mesma coisa — 0,10 de probabilidade cada. No modelo antigo não valiam, porque o piso do crítico na defesa cortava a cauda boa e tornava o Alvo menos eficiente que a Defesa.</p>

<h2>0.2 O par de referência</h2>
<p>Guerreiro FOR 4 + Perícia: Arma 3, Espada Longa Q0. Defensor com Perícia: Esquiva 2.</p>
<p>A Defesa dele é <code>0 + 2 − 1 = 1</code> (Livro §6.4): o modificador raiz <strong>Defesa</strong> nasce 0 e não tem fórmula própria, e a perícia entra com −1.</p>
<table>
<thead><tr><th>Grandeza</th><th>Valor</th><th>De onde sai</th></tr></thead>
<tbody>
<tr><td>Alvo de ataque</td><td>7</td><td>FOR 4 + Arma 3</td></tr>
<tr><td>P(acerto)</td><td>0,70</td><td>7 ÷ 10</td></tr>
<tr><td>Defesa: Esquiva do alvo</td><td>1</td><td>Defesa 0 + Esquiva 2 − 1</td></tr>
<tr><td><strong>P(golpe passa)</strong></td><td><strong>0,60</strong></td><td>(7 − 1) ÷ 10</td></tr>
<tr><td>Dano líquido (1d8 + 4 − Blindagem 2)</td><td>6,5</td><td>4,5 + 4 − 2</td></tr>
<tr><td><strong>DPR</strong></td><td><strong>3,90</strong></td><td>0,60 × 6,5</td></tr>
<tr><td>Vitalidade = (VIG + Tamanho) × 3</td><td>18</td><td>—</td></tr>
<tr><td>Duração do combate</td><td>4,6 rodadas</td><td>18 ÷ 3,90</td></tr>
</tbody>
</table>
<p>A duração cai dentro do invariante de 4 a 5 rodadas do §0.4 — foi o que fixou o defensor de referência em Esquiva 2 e não 3. Com Esquiva 3 a Defesa vai a 2, o DPR cai para 3,25 e o combate estica para 5,5 rodadas, fora do invariante.</p>

<h2>0.2b O que a troca de base move</h2>
<p>A unidade saiu de <strong>3,445 para 3,90</strong> (+13,2%). Toda taxa derivada dela muda — mas não todas na mesma direção, e duas não mudam nada:</p>
<table>
<thead><tr><th>Efeito</th><th>Antes</th><th>Agora</th><th>Derivação nova</th></tr></thead>
<tbody>
<tr><td>1 ponto de dano entregue</td><td>0,290</td><td><strong>0,256</strong></td><td>1 ÷ 3,90</td></tr>
<tr><td>1 ponto de cura</td><td>0,290</td><td><strong>0,256</strong></td><td>dano desfeito</td></tr>
<tr><td>+1 Blindagem, por rodada</td><td>0,154</td><td>0,154</td><td>1 ÷ 6,5 — só depende do dano líquido, e ele não mudou</td></tr>
<tr><td>+N de dano num golpe que precisa acertar</td><td>0,154</td><td>0,154</td><td>idem</td></tr>
<tr><td>±1 no Alvo, por rodada</td><td>0,170</td><td><strong>0,167</strong></td><td>0,10 × 6,5 ÷ 3,90</td></tr>
<tr><td>∓1 na Defesa do alvo, por rodada</td><td>—</td><td><strong>0,167</strong></td><td>agora idêntico ao Alvo (§0.1)</td></tr>
<tr><td>1 turno roubado</td><td>1,000</td><td>1,000</td><td>uma rodada de DPR negada, por construção</td></tr>
<tr><td><strong>Atacar quem não pode reagir</strong></td><td>0,320</td><td><strong>0,167</strong></td><td>(0,70 − 0,60) × 6,5 ÷ 3,90</td></tr>
<tr><td>Desarmar</td><td>1,000</td><td>1,000</td><td>o alvo gasta uma ação</td></tr>
<tr><td>Reposicionar de graça</td><td>0,333</td><td>0,333</td><td>1/3 do turno</td></tr>
</tbody>
</table>
<p><strong>A Blindagem não se mexeu, e isso não é sorte:</strong> ela vale <code>P × 1 ÷ (P × dano líquido)</code>, o P cancela, e sobra <code>1 ÷ 6,5</code>. Vale para qualquer bônus que só rende no golpe que entra.</p>
<p><strong>"Atacar quem não pode reagir" caiu pela metade</strong>, e é a mudança de maior alcance. Ela mede o que se ganha ignorando a Defesa; como a Defesa de referência do v3 é 1 e não 5, ignorá-la vale muito menos. Isso derruba o preço de Oculto, Atordoado e de toda habilidade que ignora Defesa.</p>
<p><strong>Pendente de propagação (16/08/2026):</strong> as taxas acima estão calculadas mas <em>não</em> foram aplicadas ao §1.1, ao §6.3 (valor cheio das condições) nem aos 78 carimbos <code>regua</code> do catálogo, todos ainda em base 3,445. Enquanto isso não for feito, o §0.2 e o resto do documento discordam — e quem medir deve declarar qual base está usando.</p>

`;

const novoHTML = NOVO + d.contentHTML.slice(corte);
console.log(APPLY ? 'APLICANDO' : 'DRY-RUN', `· ${d.contentHTML.length} → ${novoHTML.length} chars`);
console.log(`  §0.1 e §0.2 substituídos, §0.2b criada, §0.3+ intactos`);
if (APPLY) {
    await ref.update({ contentHTML: novoHTML,
        words: novoHTML.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length,
        updatedAt: Date.now() });
    console.log('✅ gravado');
}
process.exit(0);
