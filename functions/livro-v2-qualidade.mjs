/**
 * Passe v2 no Livro de Regras do Jogador — o livro alcança o sistema.
 *
 * Capítulo 5: §5.4–5.6 REESCRITOS por inteiro (splice entre os h2), porque
 * o miolo mudou demais para remendo: Qualidade no lugar de Grau/Fio, Blindagem
 * inteira por peça (taxa por slot e piso "mínimo 1 vestindo algo" morrem),
 * Domínios, projétil carregando o poder, escudo somando no Bloquear, canais
 * com nome de dano. §5.2 e §5.3 levam remendos pontuais.
 *
 * Capítulo 6: Transbordo (regra nova), Bloquear com Qualidade, §6.5 atualizado
 * (Qualidade, nomes de dano, fraqueza declarada, exemplo com inteiro).
 *
 *   node functions/livro-v2-qualidade.mjs            (dry-run)
 *   node functions/livro-v2-qualidade.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ============================== §5.4–5.6 NOVOS ============================== */

const S54 = `<h2>5.4 Armaduras e Escudos</h2>
<blockquote><p><em>"O metal que veste não te faz invencível. Te dá uma segunda chance de não morrer."</em></p></blockquote>
<p>Armaduras e escudos fornecem <strong>Blindagem</strong>, subtraída do dano de cada ataque recebido:</p>
<p><strong>Dano Final = Dano Bruto − Blindagem (mínimo 1 no golpe)</strong></p>
<p>A subtração é seca — sem porcentagem, sem rolagem extra, feita de cabeça na mesa: dano 9 contra Blindagem 3 = perde 6 de Vitalidade. O piso de 1 é do <em>golpe</em>: todo ataque que acerta e não é defendido marca ao menos 1 (Capítulo 6, seção 6.5). Não existe imunidade, existe demorar muitos golpes.</p>

<h3>A Blindagem é da peça, e é inteira</h3>
<p>Cada peça de proteção declara sua Blindagem em <strong>número inteiro</strong>. Quem veste soma o que tem no corpo, e esse total é a sua Blindagem. <strong>Não há fração, não há arredondamento, não há conta escondida</strong> — o número da peça é o número da mesa.</p>
<p>O corpo se organiza em <strong>três regiões de proteção</strong> — Cabeça (com o pescoço), Torso (com costas, ombros e cintura) e Membros (braços, pernas e pés) — e cada classe de material tem um orçamento por região. A peça que carrega a região é a <strong>âncora</strong>: o peitoral, o elmo, as grevas. As peças pequenas em volta — gorjal, faldar, ombreira, bota — são <strong>satélites: valem 0 de Blindagem enquanto novas</strong>. Elas existem para completar a cobertura, para receber melhorias, e porque o valor delas chega quando a Qualidade da peça sobe (seção 5.6). Um gorro de couro recém-comprado não segura lâmina nenhuma — e o livro agora diz isso com um zero honesto em vez de uma fração que ninguém somava.</p>
<blockquote><p><strong>Exemplos:</strong> Cota de Malha (1) + Escudo Grande (1) = <strong>Blindagem 2</strong>. Armadura de Torneio (3) + Escudo de Torre (2) = <strong>Blindagem 5</strong> — a proteção máxima possível hoje, sem melhorias.</p></blockquote>

<h3>O catálogo de proteção</h3>
<p>Os valores reais de todas as peças do jogo — a ficha aplica tudo ao equipar. Onde a cobertura diz "×2", a peça cobre os dois lados de uma vez: <strong>par é uma peça só</strong>. Não existe "uma greva".</p>
<table>
<thead><tr><th>Peça</th><th>Classe</th><th>Blindagem</th><th>Cobre</th><th>Peso</th><th>Preço (L$)</th><th>Penalidade</th></tr></thead>
<tbody>
<tr><td>Armadura de Torneio</td><td>Pesada</td><td><strong>3</strong></td><td>O corpo inteiro (Torso, Cabeça, Pescoço, Costas, Ombro ×2, Braço ×2, Cintura, Perna ×2, Pé ×2)</td><td>6</td><td>20.000</td><td>DES −3 · Furt. −5 · Desloc. −2</td></tr>
<tr><td>Armadura Completa</td><td>Pesada</td><td><strong>2</strong></td><td>Torso, Costas, Ombro ×2, Braço ×2, Cintura, Perna ×2, Pé ×2</td><td>5</td><td>12.000</td><td>DES −2 · Furt. −4</td></tr>
<tr><td>Meia-Armadura</td><td>Pesada</td><td><strong>2</strong></td><td>Torso, Cabeça, Pescoço, Costas, Ombro ×2, Braço ×2</td><td>4</td><td>9.000</td><td>DES −1 · Furt. −3</td></tr>
<tr><td>Escudo de Torre</td><td>Escudo</td><td><strong>2</strong></td><td>Mão</td><td>4</td><td>1.800</td><td>Acerto −2 · Desloc. −1</td></tr>
<tr><td>Cota de Placas</td><td>Pesada</td><td><strong>1</strong></td><td>Torso, Pescoço, Costas, Ombro ×2, Braço ×2, Cintura</td><td>4</td><td>5.500</td><td>DES −1 · Furt. −3</td></tr>
<tr><td>Couraça de Placas</td><td>Pesada</td><td><strong>1</strong></td><td>Torso, Costas</td><td>2</td><td>3.800</td><td>Furt. −1</td></tr>
<tr><td>Elmo de Placas</td><td>Pesada</td><td><strong>1</strong></td><td>Cabeça</td><td>1</td><td>5.000</td><td>DES −1 · Furt. −1</td></tr>
<tr><td>Grevas de Placas</td><td>Pesada</td><td><strong>1</strong></td><td>Perna ×2</td><td>1</td><td>5.000</td><td>DES −1 · Furt. −1 · Desloc. −1</td></tr>
<tr><td>Cota de Malha</td><td>Média</td><td><strong>1</strong></td><td>Torso, Costas, Ombro ×2, Braço ×2, Cintura</td><td>1</td><td>3.000</td><td>DES −1 · Furt. −2</td></tr>
<tr><td>Peitoral de Aço</td><td>Média</td><td><strong>1</strong></td><td>Torso, Pescoço, Costas, Ombro ×2, Cintura</td><td>1</td><td>2.800</td><td>DES −1 · Furt. −2</td></tr>
<tr><td>Brigandina</td><td>Média</td><td><strong>1</strong></td><td>Torso, Costas, Ombro ×2, Cintura</td><td>3</td><td>3.500</td><td>DES −1 · Furt. −1</td></tr>
<tr><td>Couro Cravejado</td><td>Média</td><td><strong>1</strong></td><td>Torso, Costas, Ombro ×2</td><td>2</td><td>1.800</td><td>Furt. −1</td></tr>
<tr><td>Couro Reforçado</td><td>Média</td><td><strong>1</strong></td><td>Torso, Costas, Ombro ×2</td><td>2</td><td>1.500</td><td>Furt. −1</td></tr>
<tr><td>Calças de Malha</td><td>Média</td><td><strong>1</strong></td><td>Perna ×2</td><td>1</td><td>1.900</td><td>DES −1 · Furt. −1</td></tr>
<tr><td>Armadura Leve</td><td>Leve</td><td><strong>1</strong></td><td>Torso, Costas, Ombro ×2</td><td>1</td><td>1.200</td><td>—</td></tr>
<tr><td>Couro Batido</td><td>Leve</td><td><strong>1</strong></td><td>Torso, Costas, Cintura</td><td>1</td><td>800</td><td>—</td></tr>
<tr><td>Couro Leve</td><td>Leve</td><td><strong>1</strong></td><td>Torso, Costas</td><td>1</td><td>400</td><td>—</td></tr>
<tr><td>Gibão Acolchoado</td><td>Leve</td><td><strong>1</strong></td><td>Torso, Costas</td><td>1</td><td>300</td><td>—</td></tr>
<tr><td>Escudo Grande</td><td>Escudo</td><td><strong>1</strong></td><td>Mão</td><td>3</td><td>1.000</td><td>Acerto −1</td></tr>
<tr><td>Escudo Médio</td><td>Escudo</td><td><strong>1</strong></td><td>Mão (ou preso ao Braço)</td><td>1</td><td>500</td><td>—</td></tr>
<tr><td>Braçadeiras de Placas</td><td>Pesada</td><td>0</td><td>Braço ×2</td><td>1</td><td>2.200</td><td>DES −1</td></tr>
<tr><td>Escarpes de Placas</td><td>Pesada</td><td>0</td><td>Pé ×2</td><td>1</td><td>4.000</td><td>Furt. −1 · Desloc. −1</td></tr>
<tr><td>Ombreiras de Placas</td><td>Pesada</td><td>0</td><td>Ombro ×2</td><td>1</td><td>2.000</td><td>—</td></tr>
<tr><td>Faldar de Placas</td><td>Pesada</td><td>0</td><td>Cintura</td><td>1</td><td>1.000</td><td>—</td></tr>
<tr><td>Gorjal de Aço</td><td>Pesada</td><td>0</td><td>Pescoço</td><td>1</td><td>1.000</td><td>Furt. −1</td></tr>
<tr><td>Botas Ferradas</td><td>Média</td><td>0</td><td>Pé ×2</td><td>1</td><td>1.600</td><td>Furt. −1</td></tr>
<tr><td>Braçadeiras de Couro</td><td>Média</td><td>0</td><td>Braço ×2</td><td>1</td><td>900</td><td>—</td></tr>
<tr><td>Cinturão Rebitado</td><td>Média</td><td>0</td><td>Cintura</td><td>1</td><td>500</td><td>—</td></tr>
<tr><td>Coifa de Malha</td><td>Média</td><td>0</td><td>Cabeça</td><td>1</td><td>1.600</td><td>Furt. −1</td></tr>
<tr><td>Gorjal de Malha</td><td>Média</td><td>0</td><td>Pescoço</td><td>1</td><td>500</td><td>—</td></tr>
<tr><td>Capuz Acolchoado</td><td>Leve</td><td>0</td><td>Cabeça</td><td>1</td><td>900</td><td>Furt. −1</td></tr>
<tr><td>Cinta Acolchoada</td><td>Leve</td><td>0</td><td>Cintura</td><td>1</td><td>400</td><td>—</td></tr>
<tr><td>Gola de Couro</td><td>Leve</td><td>0</td><td>Pescoço</td><td>1</td><td>400</td><td>—</td></tr>
<tr><td>Mangas Acolchoadas</td><td>Leve</td><td>0</td><td>Braço ×2</td><td>1</td><td>800</td><td>DES −1 · Furt. −1</td></tr>
<tr><td>Manto de Linho</td><td>Leve</td><td>0</td><td>Costas, Cabeça</td><td>1</td><td>400</td><td>—</td></tr>
<tr><td>Broquel</td><td>Escudo</td><td>0</td><td>Mão</td><td>1</td><td>200</td><td>—</td></tr>
</tbody>
</table>
<p><strong>Como ler a tabela:</strong> mais Blindagem sempre custa mais penalidade. Armadura paga em Destreza, Furtividade e Deslocamento; escudos grandes pagam em <strong>Acerto</strong> — a mão que segura o muro ataca pior. A penalidade é <strong>própria de cada peça</strong> e vale enquanto ela estiver vestida. E a peça de valor 0 não é enfeite: ela completa a cobertura, recebe Reforço junto com o conjunto, e cresce quando a Qualidade sobe (seção 5.6). O que ela não faz é parar aço de graça.</p>
<p><strong>Ocupação é exclusiva:</strong> um slot ocupado está ocupado — não se veste ombreira por cima de armadura que já cobre o ombro. Armas de duas mãos, pelo mesmo princípio, ocupam as duas Mãos.</p>
<p><strong>Conjunto ou peça por peça:</strong> a soma fecha dos dois lados. O arnês Pesado montado em avulsas — elmo, couraça, grevas e os satélites — dá os mesmos 3 da Armadura de Torneio, pagando mais caro (24.000 L$ contra 20.000) pela conveniência de comprar aos poucos.</p>

<h3>Quanto isso aguenta? (a janela letal)</h3>
<p>Contra um golpe comum de personagem iniciante (1d8 + FOR 3), um Humano com 24 de Vitalidade cai em:</p>
<table>
<thead><tr><th>Proteção</th><th>Blindagem</th><th>Golpes até cair</th></tr></thead>
<tbody>
<tr><td>Nenhuma</td><td>0</td><td><strong>3</strong></td></tr>
<tr><td>Cota de Malha</td><td>1</td><td>4</td></tr>
<tr><td>Armadura Completa</td><td>2</td><td>4</td></tr>
<tr><td>Armadura de Torneio</td><td>3</td><td>5</td></tr>
<tr><td>Torneio + Escudo de Torre</td><td>5</td><td><strong>10</strong></td></tr>
</tbody>
</table>
<p>Armadura nunca torna ninguém imune; torna a diferença entre morrer em 3 golpes e aguentar 10. E <strong>duas mãos versus escudo é uma troca real:</strong> a arma de duas mãos entrega cerca do dobro de dano útil; a mão com escudo aguenta mais que o dobro de golpes — e ainda bloqueia (seção 5.6).</p>

<h3>Vestir e Remover</h3>
<table>
<thead><tr><th>Tipo</th><th>Vestir</th><th>Remover</th></tr></thead>
<tbody>
<tr><td>Leve</td><td>1 minuto</td><td>1 minuto</td></tr>
<tr><td>Média</td><td>5 minutos</td><td>3 minutos</td></tr>
<tr><td>Pesada</td><td>10 minutos (requer ajuda)</td><td>5 minutos</td></tr>
<tr><td>Escudo</td><td>Ação de movimento</td><td>Ação livre</td></tr>
</tbody>
</table>
<p>Com ajuda, o tempo para vestir armadura pesada cai pela metade. <strong>Penetração de armadura:</strong> algumas armas, manobras (como Golpe Preciso) ou habilidades ignoram metade ou toda a Blindagem — quando for o caso, o efeito diz.</p>

<h3>Nem todo golpe machuca a mesma armadura</h3>
<p>Toda arma fere de um dos três jeitos, e a família dela no catálogo já diz qual:</p>
<table>
<thead><tr><th>Tipo</th><th>Famílias</th></tr></thead>
<tbody>
<tr><td><strong>Cortante</strong></td><td>Espada, Adaga, Machado, Foice</td></tr>
<tr><td><strong>Perfurante</strong></td><td>Haste, Arco, Besta</td></tr>
<tr><td><strong>Contundente</strong></td><td>Impacto — clava, maça, malho, martelo, mangual, porrete, soqueira</td></tr>
</tbody>
</table>
<p>Sua Blindagem continua sendo <strong>um número só</strong>, e o Reforço do ferreiro vale contra os três. Não existe blindagem contra corte para comprar à parte.</p>
<p>O que existe é <strong>fraqueza</strong>, e ela é <strong>da peça</strong> — um número que a própria peça declara, já inteiro, já pronto no catálogo. Contra o tipo a que ela cede, vale a Blindagem reduzida que está escrita nela (via de regra, a metade); contra o que ela <strong>resiste</strong>, a aumentada. A mesa não divide nada: lê "Blindagem 3 · cede a Contundente: 1" e usa o número certo. Cada classe tem o que costuma ceder — couro rasga na ponta, placa entrega a pancada — mas <strong>quem manda é a peça</strong>. Quando ela foge do padrão, ela diz. E fraqueza compõe: uma peça já fraca, combinada com outra penalidade, pode passar de zero — aí o golpe entra amplificado.</p>
<p><strong>Uma peça também pode ceder a uma Essência</strong>, e aí a conta é a mesma por outro caminho: a fraqueza arcana é um número que desconta da <strong>Blindagem Arcana</strong>, e pode levá-la abaixo de zero — quando ela para de proteger e passa a amplificar. Um arnês que cede ao Ígneo em −2, num alvo sem Reforço Arcano, faz uma parcela de chama de 4 entregar 6. A resistência arcana é o mesmo número com o sinal trocado. Não existe motivo para couro ceder ao Ígneo mais que ao Necrótico: um arnês cede, o do lado não cede, e é a peça que diz. Descobrir isso antes do combate vale mais que um nível de Qualidade.</p>
<blockquote><p><strong>Exemplo:</strong> quem veste a Armadura de Torneio tem Blindagem 3. Contra o que ela cede (Contundente: 1), o malho passa quase inteiro. Um Humano de 24 de Vitalidade aguenta 5 golpes de espada nesse arnês — e 4 do malho que ele quase não segura.</p></blockquote>
<p>Golpe que carrega mais de um tipo — aço e Essência na mesma lâmina — resolve cada parcela separada. O procedimento está no Capítulo 6, seção 6.5.</p>
`;

const S55 = `<h2>5.5 Liga, Afiações e Reforços</h2>
<blockquote><p><em>"Qualquer tolo empunha uma espada. Poucos sabem a diferença entre aço bruto e aço puro."</em></p></blockquote>
<p>Todo equipamento tem uma <strong>Liga</strong> — a nobreza do material, de 0 a 5:</p>
<table>
<thead><tr><th>Liga</th><th>Nome</th><th>Descrição</th></tr></thead>
<tbody>
<tr><td>0</td><td>Sem Liga</td><td>Improvisada. Pedra, galho, garrafa quebrada.</td></tr>
<tr><td>1</td><td>Bruta</td><td>Baixa. O que qualquer ferreiro de vila produz.</td></tr>
<tr><td>2</td><td>Justa</td><td>Comum. Equipamento de soldado profissional.</td></tr>
<tr><td>3</td><td>Nobre</td><td>Boa. Acabamento impecável, equipamento de elite.</td></tr>
<tr><td>4</td><td>Pura</td><td>Alta. Materiais raros e técnicas fechadas.</td></tr>
<tr><td>5</td><td>Superior</td><td>Suprema. O limite do que a forja alcança.</td></tr>
</tbody>
</table>
<p>A Liga é o teto do que a peça pode <em>vir a ser</em>, e abre uma corrente de três degraus presos um ao outro:</p>
<ul>
<li>a <strong>Qualidade</strong> nunca passa da <strong>Liga</strong>. Uma peça de Liga 3 chega à Qualidade 3 e para ali (ver seção 5.6);</li>
<li>a <strong>Afiação</strong> nunca passa da <strong>Qualidade</strong>. Não se mantém acabamento onde não há trabalho — peça malfeita não segura gume;</li>
<li>as duas oficinas contam separado: a mesma arma aceita Afiação e Afiação Arcana até a Qualidade cada uma, ou seja, <strong>Qualidade × 2</strong> somadas.</li>
</ul>
<p>Escrita curta: <strong>Liga ≥ Qualidade ≥ Afiação</strong>. Em proteção, só a ponta troca de nome: <strong>Liga ≥ Qualidade ≥ Reforço</strong>. O material limita o trabalho; o trabalho limita o acabamento.</p>

<h3>As quatro melhorias: duas oficinas, dois alvos</h3>
<table>
<thead><tr><th>Profissional</th><th>Em arma</th><th>Em armadura/escudo</th></tr></thead>
<tbody>
<tr><td><strong>Ferreiro</strong></td><td>Afiação</td><td>Reforço</td></tr>
<tr><td><strong>Forjarcanista</strong> (raro)</td><td>Afiação Arcana</td><td>Reforço Arcano (raro)</td></tr>
</tbody>
</table>
<ul>
<li><strong>Em arma:</strong> cada nível de Afiação vale <strong>+1 de dano</strong>, e as duas empilham na mesma arma — em parcelas diferentes. Numa arma de Qualidade 3 com tudo no máximo: a Afiação soma +3 de dano físico, a Afiação Arcana soma +3 de Essência, e a Qualidade dela soma outros +3 no físico. A lâmina bate com <strong>+6 físico e +3 de Essência</strong>, não com um número só;</li>
<li><strong>Em proteção:</strong> o Reforço é <strong>um trabalho sobre o corpo inteiro</strong>, ancorado na peça de Torso: <strong>+1 de Blindagem por nível, com teto na Qualidade do Torso</strong>. O Reforço Arcano funciona igual, na Blindagem Arcana. Não se reforça peça por peça — o ferreiro trabalha o conjunto como um serviço só, e sem peça de Torso não há onde ancorar.</li>
</ul>
<p><strong>Melhoria é manutenção, não poder.</strong> Entre equipamentos da mesma Qualidade, as melhorias se cancelam — afiar e reforçar serve para <em>não ficar para trás</em>. O poder real de um item está na Qualidade (seção 5.6).</p>

<h3>O que cada afiação soma</h3>
<p>A <strong>Afiação</strong> do ferreiro soma <strong>dano físico</strong> e para na Qualidade da peça. A <strong>Afiação Arcana</strong> soma <strong>dano de Essência</strong>, nunca físico, e pode ser repartida entre vários canais na mesma arma — contanto que a soma de todos não passe da Qualidade.</p>
<blockquote><p><strong>Exemplo.</strong> Espada Longa, Liga 5, Qualidade 4. Afiação comum no 4. Afiação Arcana repartida em Ígneo 1, Necrótico 2 e Eólico 1 — somam 4, o teto. Contra um alvo sem Reforço Arcano, esses quatro pontos de Essência entram inteiros na Vitalidade. Só o dano físico é barrado pela Blindagem.</p></blockquote>
<p>Na proteção vale o mesmo: o <strong>Reforço</strong> barra dano físico, o <strong>Reforço Arcano</strong> barra Essência. E os dois valem contra tudo — <strong>não se compra reforço contra uma Essência escolhida.</strong> Fosse por canal, bastaria repartir o dano arcano em três Essências para nunca mais ser barrado.</p>
<p><strong>Descasamento de Qualidade é letal — e é proposital.</strong> Uma arma dois níveis acima da proteção do alvo mata em dois ou três golpes; uma proteção dois níveis acima da arma atacante reduz quase tudo ao piso. O perigo do jogo está em enfrentar quem tem aço melhor que o seu — não na sorte do dado.</p>

<h3>Comprar Liga</h3>
<p>O preço de catálogo é o da Liga 1. Cada Liga acima multiplica, e o salto cresce conforme sobe:</p>
<table>
<thead><tr><th>Liga</th><th>Preço</th><th>Espada Longa</th><th>Teto de Qualidade</th></tr></thead>
<tbody>
<tr><td>1</td><td>catálogo</td><td>1.100 L$</td><td>1</td></tr>
<tr><td>2</td><td>×1,5</td><td>1.650 L$</td><td>2</td></tr>
<tr><td>3</td><td>×3</td><td>3.300 L$</td><td>3</td></tr>
<tr><td>4</td><td>×6</td><td>6.600 L$</td><td>4</td></tr>
<tr><td>5</td><td>×16</td><td>17.600 L$</td><td>5</td></tr>
</tbody>
</table>
<p>Uma lâmina de Liga 5 recém-saída da forja não corta melhor que a de Liga 1. Custa dezesseis vezes mais pelo que <em>pode vir a ser</em>. Quem leva uma dessas está comprando material, e ainda vai pagar o ferreiro.</p>

<h3>O preço do ofício</h3>
<p><strong>Subir a Qualidade</strong> é o serviço mais caro que uma oficina vende:</p>
<table>
<thead><tr><th>Qualidade</th><th>Preço</th><th>Tempo</th></tr></thead>
<tbody>
<tr><td>1</td><td>1.000 L$</td><td>3 dias</td></tr>
<tr><td>2</td><td>2.500 L$</td><td>6 dias</td></tr>
<tr><td>3</td><td>6.000 L$</td><td>9 dias</td></tr>
<tr><td>4</td><td>15.000 L$</td><td>12 dias</td></tr>
<tr><td>5</td><td>37.500 L$</td><td>15 dias</td></tr>
</tbody>
</table>
<p>Do zero à Qualidade 5: <strong>62.000 L$ e quarenta e cinco dias</strong> com a sua arma em cima da bancada de outro homem. O preço é o mesmo em adaga e em montante — o catálogo já pagou o dado; a Qualidade paga o poder. Em proteção vale a mesma tabela, por peça.</p>
<p><strong>Afiar</strong> é barato, rápido, e é o serviço que se repete:</p>
<table>
<thead><tr><th>Qualidade</th><th>Afiação (ferreiro)</th><th>Afiação Arcana (forjarcanista)</th></tr></thead>
<tbody>
<tr><td>1</td><td>100 L$ · 1 hora</td><td>300 L$ · 1 hora</td></tr>
<tr><td>2</td><td>250 L$ · 2 horas</td><td>750 L$ · 2 horas</td></tr>
<tr><td>3</td><td>600 L$ · 3 horas</td><td>1.800 L$ · 3 horas</td></tr>
<tr><td>4</td><td>1.500 L$ · 4 horas</td><td>4.500 L$ · 4 horas</td></tr>
<tr><td>5</td><td>3.750 L$ · 5 horas</td><td>11.250 L$ · 5 horas</td></tr>
</tbody>
</table>
<p>O forjarcanista leva o mesmo tempo do ferreiro e cobra três vezes mais pela hora. Não é demora, é escassez — existe um deles para muitos ferreiros, e ele sabe disso. <strong>Projétil afia pela metade</strong>: metade do preço, metade do tempo, por maço de 20 (seção 5.6) — ponta pequena, trabalho simples.</p>

<h3>A bancada leva o acabamento junto</h3>
<p>Subir a Qualidade não é acrescentar uma camada. É refazer a peça de cima a baixo — o aço volta ao fogo, o couro volta ao tacho, e o que estava afiado se perde no processo.</p>
<p><strong>Subir a Qualidade zera todas as afiações e reforços.</strong> Comum e Arcana, gume e Reforço — tudo volta a zero, e tudo se paga de novo.</p>
<p>Isso põe uma escolha na bancada. Você chega com uma lâmina de Qualidade 2, Afiação 2 e Arcana 2: +4 de dano físico e +2 de Essência. Paga os 6.000 L$ do terceiro nível e volta nove dias depois com uma espada de Qualidade 3 sem acabamento nenhum — +3 no físico, nada de Essência. Saiu da oficina mais fraco do que entrou. Recuperar os dois pontos custa mais 600 e 1.800, e mais seis horas de bancada. Subir Qualidade é investimento; afiar é o que te mantém vivo até o investimento render. Ninguém sobe a Qualidade na véspera de uma batalha.</p>

<h3>O acabamento se perde antes da peça</h3>
<p>Uma Falha Crítica pode <strong>comer um nível de Afiação</strong>. A Qualidade só é atingida quando não resta acabamento nenhum a perder. Em arma de disparo, a Falha Crítica <strong>quebra o projétil</strong> em vez de comer gume — a arma não tem lâmina para cegar.</p>
<p>Sai barato de propósito: repor a afiação de uma Qualidade 4 custa 1.500 L$, repor a Qualidade 4 custa 15.000. Dez vezes. Para perder Qualidade de verdade é preciso encaixar falhas críticas em série sem passar por uma oficina — o que só acontece longe de qualquer estrada.</p>
<p>A lista de consequências de Falha Crítica é escolha do Narrador (Capítulo 6, seção 6.7). Perder o acabamento é uma opção entre a arma escapar da mão, a corda arrebentar e você acertar quem estava do seu lado. Não acontece toda vez.</p>

<h3>Nem toda oficina chega à Qualidade 5</h3>
<p>São duas travas de naturezas diferentes. A primeira está na peça e se confere na hora: a Qualidade nunca passa da Liga. A segunda está no mundo — nem todo artesão sabe assentar o quinto nível numa peça, e achar quem saiba é problema do personagem, não da ficha. Onde vive esse mestre, e o que ele cobra além de Luns, é assunto do Narrador.</p>
`;

const S56 = `<h2>5.6 Qualidade</h2>
<blockquote><p><em>"Toda lâmina corta. A diferença é quantas vezes ela voltou à bancada."</em></p></blockquote>
<p>Duas espadas longas, as duas 1d8, as duas de aço. Uma saiu ontem da forja da vila; a outra atravessou três donos e uma guerra, e foi refeita a cada dono. O dado não muda. O que muda é a <strong>Qualidade</strong>.</p>

<h3>Qualidade: o poder que o item carrega</h3>
<p><strong>Cada nível de Qualidade vale +1 de dano.</strong> A conta é fácil de lembrar porque o seu Dano vem da Força: um nível de Qualidade é, na prática, <em>um ponto de Força que a arma te dá de graça</em> — sem custar EXP. <strong>E é só isso que ele faz:</strong> Qualidade não melhora acerto, não estende alcance e não entra em teste nenhum. Só dano — com uma única exceção, o escudo, que bloqueia melhor (abaixo).</p>
<blockquote><p>Espada Longa (1d8) com FOR 3 rola <strong>1d8 + 3</strong>. A mesma espada em Qualidade 2 rola <strong>1d8 + 5</strong>. O dado continua 1d8.</p></blockquote>

<h3>As faixas</h3>
<table>
<thead><tr><th>Qualidade</th><th>Nome</th><th>O que é</th></tr></thead>
<tbody>
<tr><td>0</td><td>Inicial</td><td>Tudo que está no catálogo hoje.</td></tr>
<tr><td>1</td><td>Veterano</td><td>Peça de quem já sobreviveu a alguma coisa.</td></tr>
<tr><td>2</td><td>Especialista</td><td>Trabalho de oficina que conhece o próprio ofício.</td></tr>
<tr><td>3</td><td>Mestre</td><td>Obra de quem passou a vida na bancada.</td></tr>
<tr><td>4</td><td>Obra-Prima</td><td>O melhor que uma oficina entrega quando tem tempo e material de sobra.</td></tr>
<tr><td>5</td><td>Graal</td><td>Perseguido por todo mestre, alcançado por quase nenhum. Sai da forja, não da ruína.</td></tr>
</tbody>
</table>

<h3>Poder: uma régua, não uma trava</h3>
<p><strong>Poder</strong> é todo o EXP que seu personagem já acumulou — o EXP Total da ficha. Serve para você saber onde ele está na escada, e para o Narrador calibrar o que oferece:</p>
<table>
<thead><tr><th>Poder (EXP Total)</th><th>Qualidade equivalente</th></tr></thead>
<tbody>
<tr><td>até 500</td><td>0 — Inicial</td></tr>
<tr><td>500 a 850</td><td>1 — Veterano</td></tr>
<tr><td>850 a 1.300</td><td>2 — Especialista</td></tr>
<tr><td>1.300 a 1.800</td><td>3 — Mestre</td></tr>
<tr><td>acima de 1.800</td><td>4 — Obra-Prima</td></tr>
</tbody>
</table>
<p>O Graal fica fora da régua de propósito: não existe Poder que o alcance, existe oficina. <strong>Nada disso trava equipamento.</strong> Um personagem de 500 de Poder que ponha a mão numa lâmina de Qualidade 4 usa a lâmina de Qualidade 4, e vai bater muito acima do que se espera dele — o que é problema do Narrador, não da ficha. A tabela diz o que é <em>esperado</em>, não o que é <em>permitido</em>.</p>

<h3>Arma soma, proteção sobe por degraus</h3>
<p>Na arma, cada nível é <strong>+1 de dano</strong>, e o dado nunca muda. Na proteção, a Qualidade sobe a Blindagem <strong>do conjunto</strong> pela tabela da classe — quem faz a conta por peça é o catálogo; a mesa só lê o inteiro:</p>
<table>
<thead><tr><th>Qualidade</th><th>Leve (corpo)</th><th>Média (corpo)</th><th>Pesada (corpo)</th></tr></thead>
<tbody>
<tr><td>0</td><td>1</td><td>2</td><td><strong>3</strong></td></tr>
<tr><td>1</td><td>1</td><td>3</td><td><strong>4</strong></td></tr>
<tr><td>2</td><td>2</td><td>3</td><td><strong>5</strong></td></tr>
<tr><td>3</td><td>2</td><td>4</td><td><strong>6</strong></td></tr>
<tr><td>4</td><td>3</td><td>5</td><td><strong>7</strong></td></tr>
<tr><td>5</td><td>3</td><td>6</td><td><strong>9</strong></td></tr>
</tbody>
</table>
<p>Sobe por degraus, e não +1 seco, por um motivo prático: Blindagem é <em>subtraída</em> de um dano que cresce junto com quem bate. Junto com o Reforço (+1 por nível, seção 5.5), um combate entre arma e armadura da mesma Qualidade continua durando de 4 a 5 golpes, do começo ao fim da campanha.</p>

<h3>Domínio: a peça rende o que a mão sabe pedir</h3>
<p>Qualquer um empunha qualquer arma — não existe redutor por falta de treino. O que existe é um teto natural: <strong>sem o Domínio da família, o bônus de ofício de uma arma (Qualidade + Afiação) rende no máximo o atributo que a governa.</strong> Com o Domínio, rende inteiro. O dado nunca é cortado — 1d12 mal empunhado ainda é um 1d12 caindo.</p>
<table>
<thead><tr><th>Domínio (Peculiaridade, 12 EXP)</th><th>Governa</th><th>Cobre</th></tr></thead>
<tbody>
<tr><td><strong>Domínio de Armas de Braço</strong></td><td>FOR</td><td>espada, machado, haste, impacto, foice</td></tr>
<tr><td><strong>Domínio de Armas de Precisão</strong></td><td>DES</td><td>adaga, faca, estoque, sabre — e as armas de arremesso</td></tr>
<tr><td><strong>Domínio de Disparo</strong></td><td>DES</td><td>arco, besta</td></tr>
</tbody>
</table>
<p>O mago de FOR 2 <em>pode</em> empunhar a espada de Qualidade 5: ela rende +2 — o que o braço dele arranca de uma lâmina que não entende. O bárbaro de FOR 5 sem treino algum tira +5 da mesma espada: força bruta compensa técnica até certo ponto, que é exatamente o que ela faz na vida. Classes marciais nascem com o Domínio do seu ofício; as outras compram como qualquer Peculiaridade. Proteção não exige Domínio nenhum — vestir aço qualquer um veste; carregá-lo o dia inteiro é outra conversa.</p>

<h3>Projétil: a ponta carrega o poder</h3>
<p>Arco e besta dão <strong>o dado</strong> — e a besta dá também a potência do próprio arco de aço (1d4 soma 2, 1d6 soma 3, 1d10 soma 5), sem atributo nenhum: quem faz força é a máquina. O que nenhum dos dois carrega é Qualidade: <strong>Qualidade e Afiação vivem na flecha e no virote</strong>, vendidos por maço de 20 — a aljava.</p>
<ul>
<li><strong>Na ficha,</strong> a arma de disparo aponta qual maço a alimenta (no detalhe do item, aba Inventário). Sem projétil apontado, a arma dispara só o dado;</li>
<li><strong>Falha Crítica quebra o projétil</strong> — desconte do maço. O gume que se perde é o da ponta, não o da arma;</li>
<li><strong>Depois do combate,</strong> um teste de <strong>VIG + Sobrevivência</strong> recupera flechas: metade das disparadas (arredonde para cima) mais uma por Grau, até o total. As quebradas pela Falha Crítica não voltam. Falhou no teste: um quarto;</li>
<li><strong>O Domínio de Disparo</strong> governa o teto normalmente — o cap morde o bônus da ponta.</li>
</ul>
<p>O espadachim paga o gume uma vez; o arqueiro repõe conforme perde. O mesmo poder custa o mesmo — a diferença é que o do arqueiro voa para longe.</p>

<h3>Escudo: bloqueia melhor, não blinda mais</h3>
<p>Escudo tem Blindagem fixa (tabela da seção 5.4) e <strong>não sobe de Blindagem com a Qualidade</strong> — armadura pesada com Escudo de Torre já exige 10 golpes, o limite do que o combate aguenta sem travar. A Qualidade do escudo compra outra coisa:</p>
<p><strong>A Qualidade do escudo soma no teste de Bloquear</strong> (Capítulo 6, seção 6.4). A critério do Narrador, também em Proteger e Dar Cobertura, quando é o escudo que se interpõe. Um Escudo de Torre de Qualidade 3 é um muro que aprendeu a andar.</p>
<p>Escudo com umbo de ferro que também bate não é regra à parte: é um item de catálogo com fórmula de dano própria, na família Impacto.</p>

<h3>Os canais: dano com nome</h3>
<p>Uma arma pode ferir com mais do que aço. Cada Essência tem um <strong>nome de dano</strong> — é assim que a mesa fala, e a cor do cânone fica na descrição:</p>
<table>
<thead><tr><th>Dano</th><th>Essência</th><th>Dano</th><th>Essência</th></tr></thead>
<tbody>
<tr><td><strong>Eólico</strong></td><td>Cinza — Vento</td><td><strong>Ígneo</strong></td><td>Vermelha — Fogo</td></tr>
<tr><td><strong>Aquático</strong></td><td>Azul-Claro — Água</td><td><strong>Telúrico</strong></td><td>Marrom — Terra</td></tr>
<tr><td><strong>Espiritual</strong></td><td>Azul — Vida</td><td><strong>Espacial</strong></td><td>Branca — Espaço</td></tr>
<tr><td><strong>Necrótico</strong></td><td>Púrpura — Necrótica</td><td><strong>Temporal</strong></td><td>Prateada — Tempo</td></tr>
<tr><td><strong>Natural</strong></td><td>Verde — Natureza</td><td><strong>Abissal</strong></td><td>Preta — Abissal</td></tr>
<tr><td><strong>Cristalino</strong></td><td>Rosa — Cristal</td><td><strong>Áureo</strong></td><td>Dourada — Poder</td></tr>
<tr><td><strong>Luminoso</strong></td><td>Amarela — Luz</td><td></td><td></td></tr>
</tbody>
</table>
<p>Cada canal é uma parcela separada <em>no ataque</em> — mas do outro lado só existe um número. Todos os canais arcanos enfrentam a mesma <strong>Blindagem Arcana</strong>. A diferença entre um e outro só aparece quando a peça do alvo cede àquele em particular (seção 5.4). Como se resolve na mesa está no Capítulo 6, seção 6.5.</p>
<p>Um equipamento ganha um canal de três maneiras:</p>
<ul>
<li><strong>De nascença</strong> — a peça foi forjada de material que já carrega a Essência;</li>
<li><strong>Afiação Arcana</strong> — o forjarcanista imbui o canal numa arma comum. Para na Qualidade da peça, como toda afiação (seção 5.5);</li>
<li><strong>Consumível</strong> — óleo, loção, unguento passado na lâmina. Dura o que dura e não consome Qualidade nenhuma.</li>
</ul>
<p>O forjarcanista é a porta pela qual a magia entra num equipamento mundano. Espada nenhuma nasce flamejante.</p>
<p>O que importa na hora de comprar: <strong>armadura comum só protege do dano físico.</strong> Contra Essência é preciso Reforço Arcano (seção 5.5) ou item específico — talismã, loção, bênção — e isso é raro, caro e situacional. As treze Essências estão no Compêndio de Fluxomancia.</p>
`;

/* ============================== EDIÇÕES PONTUAIS ============================== */

const CAP5_EDICOES = [
    {
        nome: '§5.2 · nota de versão: Fio → Qualidade',
        de: 'O <em>poder</em> do equipamento é outra coisa, e tem nome próprio: o <strong>Fio</strong> (ver seção 5.6).',
        para: 'O <em>poder</em> do equipamento é outra coisa, e tem nome próprio: a <strong>Qualidade</strong> (ver seção 5.6).'
    },
    {
        nome: '§5.3 · bônus da arma',
        de: 'à qual se somam o seu Valor Derivado de Dano (base FOR) e os bônus da própria arma — o dano natural do material e as Afiações (ver seção 5.5).',
        para: 'à qual se somam o seu Valor Derivado de Dano (base FOR) e os bônus da própria arma — a Qualidade da peça e as Afiações (ver seções 5.5 e 5.6).'
    },
    {
        nome: '§5.3 · projétil carrega o poder',
        de: '<li><strong>Projétil:</strong> arcos e bestas requerem flechas ou virotes — sem projétil, a arma é inútil. A aljava fica no inventário e desconta conforme o uso.</li>',
        para: '<li><strong>Projétil:</strong> arcos e bestas requerem flechas ou virotes — e é o projétil que carrega a Qualidade e a Afiação (seção 5.6). A aljava fica no inventário, a ficha aponta qual maço alimenta a arma, e o uso desconta do maço. Sem projétil, a arma dispara só o dado.</li>'
    },
];

const CAP6_EDICOES = [
    {
        nome: '§6.3 · Transbordo (regra nova)',
        de: '<blockquote><p><strong>Exemplo:</strong> guerreiro com FOR 4 e Arma 3 ataca. Alvo = 7. Rola 2: acertou com 5 Graus. O defensor terá −5 no teste de defesa.</p></blockquote>',
        para: `<blockquote><p><strong>Exemplo:</strong> guerreiro com FOR 4 e Arma 3 ataca. Alvo = 7. Rola 2: acertou com 5 Graus. O defensor terá −5 no teste de defesa.</p></blockquote>
<p><strong>Transbordo — quando o Alvo passa de 9.</strong> Num d10 o 10 sempre falha, então Alvo acima de 9 não melhora a chance de acertar. O excedente não se perde: <strong>cada ponto de Alvo acima de 9 vira 1 Grau automático em todo teste bem-sucedido.</strong> Vale para ataque e para defesa. Um mortal no teto (atributo 5 + perícia 5) já carrega 1 Grau de Transbordo; quem expande o teto além disso — uma Aura — é aqui que aparece. O sobre-humano não fica imune ao azar: erra pouco, e acerta fundo.</p>`
    },
    {
        nome: '§6.4 · Bloquear soma a Qualidade do escudo',
        de: '<tr><td><strong>Bloquear</strong></td><td>Reação + Bloquear</td><td>Requer escudo.</td></tr>',
        para: '<tr><td><strong>Bloquear</strong></td><td>Reação + Bloquear</td><td>Requer escudo. <strong>A Qualidade do escudo soma no teste</strong> (Capítulo 5, seção 5.6).</td></tr>'
    },
    {
        nome: '§6.5 · Fio → Qualidade',
        de: 'e a própria arma pode somar bônus — o Fio dela (Capítulo 5, seção 5.6) e as Afiações.',
        para: 'e a própria arma pode somar bônus — a Qualidade dela (Capítulo 5, seção 5.6) e as Afiações.'
    },
    {
        nome: '§6.5 · canais com nome de dano',
        de: 'Uma arma pode carregar Essência além do aço — uma lâmina necrótica soma uma parcela Púrpura, uma flecha encantada soma uma parcela Vermelha.',
        para: 'Uma arma pode carregar Essência além do aço — uma lâmina necrótica soma uma parcela de dano Necrótico, uma flecha encantada soma uma parcela Ígnea (os treze nomes estão no Capítulo 5, seção 5.6).'
    },
    {
        nome: '§6.5 · passo 1: fraqueza declarada',
        de: '<li><strong>A parcela física</strong> subtrai a Blindagem. Se a arma for do tipo a que a armadura cede, a Blindagem conta metade (Capítulo 5, seção 5.4);</li>',
        para: '<li><strong>A parcela física</strong> subtrai a Blindagem. Se a arma for do tipo a que a armadura cede, vale a Blindagem reduzida que a peça declara (Capítulo 5, seção 5.4);</li>'
    },
    {
        nome: '§6.5 · passo 2: desconto arcano',
        de: '<li><strong>Cada parcela de Essência</strong> subtrai a Blindagem Arcana — a mesma para todas. Se a peça ceder àquela Essência, conta metade;</li>',
        para: '<li><strong>Cada parcela de Essência</strong> subtrai a Blindagem Arcana — a mesma para todas. A fraqueza arcana da peça desconta dela, e pode levá-la abaixo de zero;</li>'
    },
    {
        nome: '§6.5 · passo 4: nome do canal',
        de: 'o alvo perde tantos de Cortante e tantos de Púrpura, separados.',
        para: 'o alvo perde tantos de Cortante e tantos de Necrótico, separados.'
    },
    {
        nome: '§6.5 · exemplo necrótico com nome novo',
        de: '<blockquote><p><strong>Exemplo:</strong> espada necrótica, 1d8 + FOR 3, com 2 de dano Púrpura. Rola 6 → 9 de aço e 2 de Púrpura. O alvo tem Blindagem 3 e Blindagem Arcana 2, e o arnês dele cede à Púrpura — então contra ela a Arcana conta 1. Aço: 9 − 3 = 6. Púrpura: 2 − 1 = 1. O alvo perde <strong>6 de Cortante e 1 de Púrpura</strong> — não 7 de dano.</p></blockquote>',
        para: '<blockquote><p><strong>Exemplo:</strong> espada necrótica, 1d8 + FOR 3, com 2 de dano Necrótico. Rola 6 → 9 de aço e 2 de Necrótico. O alvo tem Blindagem 3 e Blindagem Arcana 2, e o arnês dele cede ao Necrótico em −1 — contra ele a Arcana vale 1. Aço: 9 − 3 = 6. Necrótico: 2 − 1 = 1. O alvo perde <strong>6 de Cortante e 1 de Necrótico</strong> — não 7 de dano.</p></blockquote>'
    },
    {
        nome: '§6.5 · exemplo com Blindagem inteira',
        de: '<blockquote><p><strong>Exemplo:</strong> espada longa (1d8) com FOR 3. Rola 6 → dano 9. O defensor veste uma Armadura Completa: os 3,30 dela arredondam para Blindagem 3. Dano final = 6 pontos de Vitalidade.</p></blockquote>',
        para: '<blockquote><p><strong>Exemplo:</strong> espada longa (1d8) com FOR 3. Rola 6 → dano 9. O defensor veste uma Armadura Completa: Blindagem 2, inteira, direto da peça. Dano final = 7 pontos de Vitalidade.</p></blockquote>'
    },
];

/* ============================== MOTOR ============================== */

async function processa(docId, edicoes, splice, rotulo) {
    const ref = db.collection('worldbuilding-articles').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`🔴 ${docId} não existe.`); return null; }
    let html = snap.data().contentHTML || '';
    const antes = html.length;
    console.log(`\n=== ${rotulo} ===`);

    if (splice) {
        const [ini, fim, novo] = splice;
        const nIni = html.split(ini).length - 1, nFim = html.split(fim).length - 1;
        console.log(`${nIni === 1 && nFim === 1 ? '  ok ' : '  🔴 '} splice §5.4–5.6  (delimitadores: ${nIni}/${nFim})`);
        if (nIni !== 1 || nFim !== 1) return null;
        const a = html.indexOf(ini), b = html.indexOf(fim);
        if (a >= b) { console.error('  🔴 delimitadores fora de ordem'); return null; }
        html = html.slice(0, a) + novo + html.slice(b);
    }

    for (const e of edicoes) {
        const n = html.split(e.de).length - 1;
        console.log(`${n === 1 ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
        if (n !== 1) return null;
        html = html.replace(e.de, e.para);
    }

    /* nenhum termo morto pode sobrar */
    const texto = html.replace(/<[^>]+>/g, ' ');
    const sobras = [];
    for (const m of texto.matchAll(/\bFio\b|\bGrau\s+\d|Grau máximo|por slot|taxa por slot|13 slots/g)) sobras.push(m[0]);
    if (sobras.length) {
        console.error(`  🔴 termos mortos sobraram: ${[...new Set(sobras)].join(', ')}`);
        for (const m of texto.matchAll(/\bFio\b/g)) console.error(`     …${texto.slice(Math.max(0, m.index - 90), m.index + 90).replace(/\s+/g, ' ')}…`);
        return null;
    }
    console.log(`  ${antes} → ${html.length} chars`);
    return { ref, html };
}

const r5 = await processa('art-regras-jogador-05', CAP5_EDICOES,
    ['<h2>5.4 Armaduras e Escudos</h2>', '<h2>5.7 Equipamentos Gerais</h2>', S54 + '\n' + S55 + '\n' + S56 + '\n'],
    'Capítulo 5');
const r6 = await processa('art-regras-jogador-06', CAP6_EDICOES, null, 'Capítulo 6');
if (!r5 || !r6) { console.error('\n🔴 ABORTADO — nada gravado.'); process.exit(1); }

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }
for (const r of [r5, r6]) await r.ref.update({ contentHTML: r.html, updatedAt: Date.now() });
console.log('\n✅ Gravado nos dois capítulos.');
process.exit(0);
