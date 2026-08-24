/**
 * Livro técnico (Régua de Balanceamento), cap. 4 — nova seção §4.8:
 * Recuperar Fôlego (ação de combate) e Descanso Rápido. Playtest 18/08/2026.
 * Append idempotente no fim do capítulo; aborta se a seção já existe.
 * node functions/__aplica-regua-folego.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const SECAO = `

<h2>4.8 Recuperar Fôlego e Descanso Rápido</h2>
<p>Duas regras do playtest de 18/08/2026. Publicadas no Livro de Regras do Jogador (6.2 e 7.1); implementadas no Tabuleiro (<code>tabuleiro/js/tab-turno.js</code>, <code>tbTurnoFolego</code>).</p>

<h3>Recuperar Fôlego — ação base de combate</h3>
<pre>Custo:   Ação Completa (as 2 ações do turno; personagem parado)
Efeito:  +1 Energia, limitado à Energia Máxima da ficha
Escopo:  só dentro de combate iniciado</pre>
<p>Efeitos colaterais herdados da Ação Completa: derruba postura (condições com <code>saiComAcaoPadrao</code>), consome a rodada inteira. A ação não existe fora de combate — fora dele a recuperação é dos descansos (7.1 do Livro do Jogador).</p>
<p><strong>Loop (§4.3):</strong> devolve 1,00 unidade (1 Energia, §4.1) por um turno inteiro de custo de oportunidade. Pela conferência do §4.7, <code>recurso devolvido (1) ≤ recurso gasto (turno inteiro)</code> — não há motor perpétuo: o teto da ficha corta o acúmulo e o turno parado é pago em exposição (nenhuma defesa nova é criada, postura cai).</p>
<p><strong>Exemplo fechado:</strong> conjurador PRS 4 + AUT 3 → pool 7. Gastou os 7 até a rodada 4. Rodada 5: Recuperar Fôlego → Energia 0 → 1; ataca na rodada 6. Com Energia 7/7 a ação é negada (o Tabuleiro desabilita o botão).</p>
<p><strong>Premissa alterada:</strong> o §4.1 precifica com pool fechado (típico 7 em combate de 5 rodadas). Com o Fôlego, o gasto total possível num combate longo passa de <code>pool</code> para <code>pool + turnos parados</code>. A faixa útil de custo por magia (1–3) segue valendo por ora; reavaliar se combates longos virarem rotina.</p>
<p><strong>Armadilhas de mesa (arbitragem registrada):</strong> combate sem lado hostil válido não é combate — terminou a hostilidade, terminou o Fôlego (a "luta com a galinha" não gera regen pré-chefão); descansar meia hora observando um inimigo agonizar rende teste de Sanidade.</p>

<h3>Descanso Rápido</h3>
<pre>Duração: ~30 min fora de combate
Efeito:  1 ponto, em Energia OU Sanidade (escolha de quem descansa)
Veto:    nunca Vitalidade — VIT só recupera no Descanso Longo</pre>
<p>Sem teste: o ponto é fixo. Conversão: 1,00 unidade por ~30 min de tempo de jogo, sem custo de recurso — o preço é o relógio da cena e a interrupção possível (regra de interrupção do 7.1 vale).</p>

<h3>Pontos em aberto</h3>
<ul>
<li>Peso do turno inteiro na régua (custo de oportunidade em unidades): <strong>[A DEFINIR]</strong> — depende do realinhamento da linha de base do §0.2 (base 3,90). Até lá o loop do Fôlego se declara em texto, não em razão.</li>
<li>Limite de repetição do Descanso Rápido por dia/cena: <strong>[A DEFINIR]</strong> — sem limite decidido, 30 min repetidos regeneram Energia sem teto fora de combate; hoje só a arbitragem de interrupções segura.</li>
<li>Reforma do Descanso Curto (4–6h) e Longo (8h) discutida no playtest: valores de recuperação <strong>não fechados</strong>; o Livro do Jogador mantém a escada antiga (Curto ~1h sem recuperação por padrão).</li>
<li>Divergência de cânone: Compêndio de Runomancia, Parte VIII, diz "descanso curto restaura ¼ [da Energia]; longo, o total" — não bate com o 7.1 do Livro do Jogador nem com esta seção. Unificar quando a reforma dos descansos fechar.</li>
</ul>`;

const ref = db.collection('worldbuilding-articles').doc('9sTazY2j3pqMErvSgkqP');
const d = await ref.get();
const html = String(d.data().contentHTML || '');
if (html.includes('4.8 Recuperar Fôlego')) { console.log('§4.8 já existe — nada a fazer'); process.exit(0); }
if (!html.includes('Recurso recuperável')) throw new Error('cap. 4 não está no estado esperado (sem §4.3) — abortando');
await ref.update({ contentHTML: html + SECAO });
console.log(`cap. 4 atualizado: ${html.length} → ${html.length + SECAO.length} chars`);
process.exit(0);
