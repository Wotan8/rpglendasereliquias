/**
 * Cap. 5 — rodada de ajustes do Fio (§5.5 e §5.6).
 *
 * Pedidos: normalizar Arcana, Fio só afeta dano, remover o teto por Poder,
 * nova curva de Liga, Afiação Arcana com o tempo da comum, o que cada afiação
 * soma, e a magnitude +5 → +1.
 *
 * Achados fora do briefing, corrigidos junto (senão o capítulo se contradiz):
 *  - a tabela de Poder ainda dizia "Lendário" e "Relíquia" (a tabela de Grau
 *    já tinha virado Obra Prima e Graal);
 *  - o bullet "O que não é Grau" dizia que a Liga é o teto da Afiação — agora
 *    quem limita a Afiação é o Fio;
 *  - a 2ª das três portas dizia que a Afiação Arcana conta no teto da Liga;
 *  - o fecho da 5.6 ignorava o Reforço Arcano ao falar de resistir a Essência.
 *
 *   node functions/livro-cap5-ajustes-grau.mjs            (dry-run)
 *   node functions/livro-cap5-ajustes-grau.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const E = [];
const ed = (nome, de, para) => E.push({ nome, de, para });

/* ===================== §5.5 ===================== */

ed('5.5 · cadeia: Afiação Mágica → Arcana',
'a mesma arma aceita Afiação e Afiação Mágica até o Fio cada uma',
'a mesma arma aceita Afiação e Afiação Arcana até o Fio cada uma');

ed('5.5 · tabela das quatro melhorias → Arcana',
'<td>Afiação Mágica</td><td>Resistência Mágica (rara)</td>',
'<td>Afiação Arcana</td><td>Resistência Arcana (rara)</td>');

ed('5.5 · cabeçalho da tabela de afiação → Arcana',
'<th>Afiação Mágica (forjarcanista)</th>',
'<th>Afiação Arcana (forjarcanista)</th>');

ed('5.5 · magnitude +5 → +1 e +0,33 → +0,067',
`<li><strong>Em arma:</strong> cada melhoria vale <strong>+5 de dano por tier</strong>, e as duas empilham na mesma arma — uma arma de Liga 3 com as duas afiações no máximo carrega +30 de dano;</li>
<li><strong>Em proteção:</strong> cada melhoria vale <strong>+0,33 de Blindagem por slot coberto, por tier</strong> (as duas juntas, +0,67). O ferreiro reforça o arnês inteiro como um trabalho só — reforçar um arnês de 13 slots rende o mesmo que reforçar 13 peças avulsas de 1 slot. Não existe vantagem em fatiar.</li>`,
`<li><strong>Em arma:</strong> cada melhoria vale <strong>+1 de dano por tier</strong>, e as duas empilham na mesma arma — uma arma de Fio 3 com as duas afiações no máximo carrega +6 de dano;</li>
<li><strong>Em proteção:</strong> cada melhoria vale <strong>+0,067 de Blindagem por slot coberto, por tier</strong>, o que dá +1 no conjunto completo de 13 slots. O ferreiro reforça o arnês inteiro como um trabalho só — reforçar um arnês de 13 slots rende o mesmo que reforçar 13 peças avulsas de 1 slot. Não existe vantagem em fatiar.</li>`);

ed('5.5 · "Melhoria é manutenção" com os números novos',
'<p><strong>Melhoria é manutenção, não poder.</strong> Uma arma totalmente melhorada ganha +10 de dano por tier; um corpo totalmente coberto e totalmente melhorado ganha os mesmos +10 de Blindagem. Entre equipamentos do mesmo tier, as melhorias se cancelam — afiar e reforçar serve para <em>não ficar para trás</em>. O poder real de um item está nos seus valores naturais: dado maior, material melhor, cobertura maior.</p>',
`<p><strong>Melhoria é manutenção, não poder.</strong> Uma arma com as duas afiações no máximo ganha +1 de dano por tier de cada oficina; um corpo inteiramente coberto e reforçado ganha o mesmo em Blindagem. Entre equipamentos do mesmo tier, as melhorias se cancelam — afiar e reforçar serve para <em>não ficar para trás</em>. O poder real de um item está no seu Fio (seção 5.6).</p>

<h3>O que cada afiação soma</h3>
<p>A <strong>Afiação</strong> do ferreiro soma <strong>dano físico</strong> e para no Fio da peça. A <strong>Afiação Arcana</strong> soma <strong>dano de Essência</strong>, nunca físico, e pode ser repartida entre várias Essências na mesma arma — contanto que a soma de todas não passe do Fio.</p>
<p>As duas são independentes: uma arma de Fio 4 aceita Afiação 4 <em>e</em> Arcana 4. É daí que sai o Fio × 2.</p>
<blockquote><p><strong>Exemplo.</strong> Espada Longa, Liga 5, Fio 4. Afiação comum no 4. Afiação Arcana repartida em Fogo 1, Necrótico 2 e Vento 1 — somam 4, o teto. Contra um alvo sem Reforço Arcano, esses quatro pontos de Essência entram inteiros na Vitalidade. Só o dano físico é barrado pela Blindagem.</p></blockquote>
<p>Na proteção vale o mesmo: o <strong>Reforço</strong> barra dano físico, o <strong>Reforço Arcano</strong> barra Essência. Com uma diferença que decide o jogo — <strong>o Reforço Arcano protege contra qualquer Essência, não contra uma escolhida.</strong> O ataque escolhe canais; a defesa é geral. Fosse por canal, bastaria repartir o dano arcano em três Essências para nunca mais ser barrado.</p>`);

ed('5.5 · nova curva de Liga',
`<tr><td>1</td><td>catálogo</td><td>1.100 L$</td><td>0</td></tr>
<tr><td>2</td><td>×2</td><td>2.200 L$</td><td>1</td></tr>
<tr><td>3</td><td>×4</td><td>4.400 L$</td><td>2</td></tr>
<tr><td>4</td><td>×8</td><td>8.800 L$</td><td>3</td></tr>
<tr><td>5</td><td>×16</td><td>17.600 L$</td><td>4</td></tr>`,
`<tr><td>1</td><td>catálogo</td><td>1.100 L$</td><td>0</td></tr>
<tr><td>2</td><td>×1,5</td><td>1.650 L$</td><td>1</td></tr>
<tr><td>3</td><td>×3</td><td>3.300 L$</td><td>2</td></tr>
<tr><td>4</td><td>×6</td><td>6.600 L$</td><td>3</td></tr>
<tr><td>5</td><td>×16</td><td>17.600 L$</td><td>4</td></tr>`);

ed('5.5 · Afiação Arcana passa a levar o tempo da comum',
`<tr><td>1</td><td>100 L$ · 1 hora</td><td>300 L$ · 3 horas</td></tr>
<tr><td>2</td><td>250 L$ · 2 horas</td><td>750 L$ · 6 horas</td></tr>
<tr><td>3</td><td>600 L$ · 3 horas</td><td>1.800 L$ · 9 horas</td></tr>
<tr><td>4</td><td>1.500 L$ · 4 horas</td><td>4.500 L$ · 12 horas</td></tr>`,
`<tr><td>1</td><td>100 L$ · 1 hora</td><td>300 L$ · 1 hora</td></tr>
<tr><td>2</td><td>250 L$ · 2 horas</td><td>750 L$ · 2 horas</td></tr>
<tr><td>3</td><td>600 L$ · 3 horas</td><td>1.800 L$ · 3 horas</td></tr>
<tr><td>4</td><td>1.500 L$ · 4 horas</td><td>4.500 L$ · 4 horas</td></tr>`);

ed('5.5 · o porquê do preço do forjarcanista',
'<p>As duas cobram o mesmo por hora. O forjarcanista sai três vezes mais caro porque leva três vezes mais tempo. E o Fio custa menos por hora que a afiação: ali a maior parte do preço é aço, carvão e têmpera — na afiação é quase só o pulso de quem trabalha.</p>',
'<p>O forjarcanista leva o mesmo tempo do ferreiro e cobra três vezes mais pela hora. Não é demora, é escassez — existe um deles para muitos ferreiros, e ele sabe disso. Imbuir é rápido; forjar é que leva dias. E o Fio custa menos por hora que qualquer afiação: ali a maior parte do preço é aço, carvão e têmpera, enquanto na afiação é quase só o pulso de quem trabalha.</p>');

/* ===================== §5.6 ===================== */

ed('5.6 · Fio só afeta o dano',
'<em>um ponto de Força que a arma te dá de graça</em> — sem custar EXP.</p>',
'<em>um ponto de Força que a arma te dá de graça</em> — sem custar EXP. <strong>E é só isso que ele faz:</strong> Fio não melhora acerto, não estende alcance, não ajuda a se defender e não entra em teste nenhum. Só dano.</p>');

ed('5.6 · Poder vira régua, não trava (título e abertura)',
`<h3>Quando cada Grau chega às suas mãos</h3>
<p><strong>Poder</strong> é todo o EXP que seu personagem já acumulou — o EXP Total da ficha. Ele diz que Grau é adequado a você:</p>`,
`<h3>Poder: uma régua, não uma trava</h3>
<p><strong>Poder</strong> é todo o EXP que seu personagem já acumulou — o EXP Total da ficha. Serve para você saber onde ele está na escada, e para o Narrador calibrar o que oferece:</p>`);

ed('5.6 · tabela de Poder: Lendário/Relíquia → Obra Prima/Graal',
`<thead><tr><th>Poder (EXP Total)</th><th>Grau adequado</th><th>Fio disponível</th></tr></thead>
<tbody>
<tr><td>até 500</td><td>1 — Inicial</td><td>0</td></tr>
<tr><td>500 a 850</td><td>2 — Veterano</td><td>+1</td></tr>
<tr><td>850 a 1.300</td><td>3 — Mestre</td><td>+2</td></tr>
<tr><td>1.300 a 1.800</td><td>4 — Lendário</td><td>+3</td></tr>
<tr><td>acima de 1.800</td><td>5 — Relíquia</td><td>+4</td></tr>
</tbody>`,
`<thead><tr><th>Poder (EXP Total)</th><th>Grau equivalente</th><th>Fio</th></tr></thead>
<tbody>
<tr><td>até 500</td><td>1 — Inicial</td><td>0</td></tr>
<tr><td>500 a 850</td><td>2 — Veterano</td><td>+1</td></tr>
<tr><td>850 a 1.300</td><td>3 — Mestre</td><td>+2</td></tr>
<tr><td>1.300 a 1.800</td><td>4 — Obra Prima</td><td>+3</td></tr>
<tr><td>acima de 1.800</td><td>5 — Graal</td><td>+4</td></tr>
</tbody>`);

ed('5.6 · fecho da tabela de Poder: nada trava equipamento',
'<p>Cada Grau custa mais ou menos 400 de Poder. Você não calcula nada com essa tabela — ela existe para o Narrador saber o que cai nas suas mãos, e quando. Equipamento acima da sua faixa não é impossível: é uma decisão do Narrador, e ele sabe o que está fazendo.</p>',
'<p>Cada Grau custa mais ou menos 400 de Poder. <strong>Nada disso trava equipamento.</strong> Um personagem de 500 de Poder que ponha a mão numa lâmina de Fio 4 usa a lâmina de Fio 4, e vai bater muito acima do que se espera dele — o que é problema do Narrador, não da ficha. A tabela diz o que é <em>esperado</em>, não o que é <em>permitido</em>.</p>');

ed('5.6 · bullet da Liga: teto do Fio, não da Afiação',
'<li><strong>A Liga</strong> (seção 5.5). Liga é a qualidade do material e o teto de Afiação — e como afiar e reforçar sobem dos dois lados ao mesmo tempo, elas se cancelam. Liga é manutenção; <strong>Grau é o que sobra depois que ela se cancela</strong>.</li>',
'<li><strong>A Liga</strong> (seção 5.5). Liga é a qualidade do material e o teto do Fio — o Fio nunca passa da Liga menos um. E as melhorias que ela sustenta sobem dos dois lados ao mesmo tempo, então se cancelam. Liga é manutenção; <strong>Grau é o que sobra depois que ela se cancela</strong>.</li>');

ed('5.6 · remover a subseção do teto por faixa de Poder',
`<h3>A regra que você precisa decorar</h3>
<blockquote><p>A soma de <strong>todos</strong> os Fios de dano que você está carregando — todas as peças, todos os canais — não pode passar do Fio da sua faixa de Poder.</p></blockquote>
<p>Com 900 de Poder você está no Grau 3, teto de 2 Fios. Pode ser uma espada de 2 Fios; ou uma espada de 1 mais uma flecha de 1; ou 1 de fogo e 1 de vento na mesma lâmina. Munição tem teto próprio de +2, para ninguém comprar a escada inteira em flecha.</p>

`, '');

ed('5.6 · três portas: tirar o teto de Poder e corrigir o da Arcana',
`<li><strong>De nascença</strong> — a peça foi forjada de material que já carrega a Essência. Esse Fio conta no teto da sua faixa de Poder, junto com o físico;</li>
<li><strong>Afiação Arcana</strong> — o forjarcanista imbui o canal numa arma comum. Conta no teto da Liga (ver seção 5.5), não no teto de Fio;</li>
<li><strong>Consumível</strong> — óleo, loção, unguento passado na lâmina. Dura o que dura e não conta em teto nenhum.</li>`,
`<li><strong>De nascença</strong> — a peça foi forjada de material que já carrega a Essência;</li>
<li><strong>Afiação Arcana</strong> — o forjarcanista imbui o canal numa arma comum. Para no Fio da peça, como toda afiação (ver seção 5.5);</li>
<li><strong>Consumível</strong> — óleo, loção, unguento passado na lâmina. Dura o que dura e não consome Fio nenhum.</li>`);

ed('5.6 · fecho: incluir o Reforço Arcano',
'Resistir a uma Essência exige item específico — talismã, loção, bênção — e isso é raro, caro e situacional.',
'Contra Essência é preciso Reforço Arcano (seção 5.5) ou item específico — talismã, loção, bênção — e isso é raro, caro e situacional.');

/* ===================== gravar ===================== */
const ref = db.collection('worldbuilding-articles').doc('art-regras-jogador-05');
const snap = await ref.get();
if (!snap.exists) { console.error('🔴 artigo não existe.'); process.exit(1); }
let html = snap.data().contentHTML || '';
const antes = html.length;
let erro = false;

for (const e of E) {
    const n = html.split(e.de).length - 1;
    const ok = n === 1;
    console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
    if (!ok) { erro = true; continue; }
    html = html.replace(e.de, e.para);
}
if (erro) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }

/* nenhuma menção a Mágica/Mágico deve sobrar no sentido de afiação */
const sobra = [...html.matchAll(/Afiação Mágica|Resistência Mágica/g)].length;
console.log(`\n"Afiação/Resistência Mágica" restantes: ${sobra}`);
if (sobra) { console.error('🔴 sobrou menção. Abortando.'); process.exit(1); }
console.log(`${antes} → ${html.length} chars (${html.length - antes >= 0 ? '+' : ''}${html.length - antes})`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
await ref.update({ contentHTML: html, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
