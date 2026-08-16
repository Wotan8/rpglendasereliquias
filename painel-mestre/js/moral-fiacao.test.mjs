/**
 * 🤝 A fiação da Moral, nas duas telas.
 *
 * A régua está trancada em shared/moral.test.mjs. Aqui o que se cobra é o que
 * some sem dar erro: o bloco não aparecer, a lista ficar em "Carregando…" para
 * sempre, ou o valor mudar na tela e não chegar ao banco.
 *
 * O Tabuleiro NÃO tem código próprio: ele abre a mesma ficha de NPC do Painel
 * do Mestre (abrirFichaMestreNpc → openNpcModal). Por isso o teste confere que
 * o CSS e o módulo continuam sendo injetados lá — se essa injeção sumir, o
 * bloco existe e sai sem estilo nenhum.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const npcs = readFileSync(new URL('./area-npcs.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../css/area-npcs.css', import.meta.url), 'utf8');
const mostrar = readFileSync(new URL('../../tabuleiro/js/tab-mostrar.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../painel-mestre.html', import.meta.url), 'utf8');

/* ===== o bloco existe e é desenhado ===== */
assert.match(npcs, /🤝 Moral com os Personagens/);
assert.match(npcs, /id="npcMoralLista"/);
assert.match(npcs, /window\.renderNpcMoral = async function/);
assert.match(npcs, /window\.npcMoralDelta = async function/);

/* ===== a régua vem do módulo puro, não de números soltos aqui ===== */
assert.match(npcs, /import\('\.\.\/\.\.\/shared\/moral\.js\?v=1'\)/);
assert.match(npcs, /const \{ linhasDeMoral \} = await _moralMod\(\)/);
assert.match(npcs, /const \{ aplicarMoral \} = await _moralMod\(\)/);
assert.doesNotMatch(npcs, /npc-moral[\s\S]{0,400}Math\.max\(-10/,
    'a escala não pode ser reescrita aqui: ela mora em shared/moral.js');

/* ===== 🔒 não fica "Carregando…" para sempre ===== */
assert.match(npcs, /let chars = window\._npcVincChars \|\| \[\];\s*\n\s*if \(!chars\.length\) \{/,
    '🔒 a moral busca os personagens sozinha — não pode depender de o Mestre '
    + 'ter aberto a aba de Vínculos antes');
assert.match(npcs, /window\.renderNpcMoral\?\.\(\);/, 'e redesenha quando a lista chega por lá');

/* ===== o degrau grava, e recusa quando não mudou ===== */
assert.match(npcs, /if \(!r\.mudou\) \{/, 'no extremo da escala, avisa em vez de gravar nada');
assert.match(npcs, /npc\.moral = r\.moral;/, 'otimista: a tela responde antes da rede');
assert.match(npcs, /updateDoc\(doc\(db, 'npcs', npc\.id\), \{ moral: r\.moral/);
assert.match(npcs, /import \{ db[^}]*updateDoc/, 'updateDoc tem de estar importado');
assert.match(npcs, /addLog\(S\.currentUser\?\.email,\s*\n\s*`🤝 Moral/,
    'e o histórico da mesa registra: é memória, tem de sobreviver ao NPC');

/* ===== o motivo é OPCIONAL e some depois ===== */
assert.match(npcs, /placeholder="Motivo \(opcional\)/, '🔒 no meio da cena, clicar e seguir tem de funcionar');
assert.match(npcs, /if \(campo\) campo\.value = '';/, 'e o campo limpa para o próximo registro');

/* ===== estilo, e a herança do Tabuleiro ===== */
assert.match(css, /\.npc-moral-linha\s*\{/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]{0,200}\.npc-moral-linha/,
    'no celular a linha empilha — o Mestre usa isso na mesa, não só no monitor');
assert.match(mostrar, /area-npcs\.css\?v=(\d+)/, 'o Tabuleiro injeta o CSS da ficha de NPC');
const vTab = Number(mostrar.match(/area-npcs\.css\?v=(\d+)/)[1]);
const vPm = Number(html.match(/area-npcs\.css\?v=(\d+)/)[1]);
assert.equal(vTab, vPm,
    '🔒 as duas telas têm de pedir a MESMA versão do CSS — divergir aqui já deixou o '
    + 'formulário de NPC sair cru no Tabuleiro antes');

console.log('✅ fiação da moral OK — bloco nas duas telas, lista que se vira sozinha, e o degrau chega ao banco');
