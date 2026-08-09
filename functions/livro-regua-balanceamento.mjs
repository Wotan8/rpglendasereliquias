/**
 * Cria o livro técnico "Régua de Balanceamento" — NÃO público, referência
 * interna para as skills de balanceamento consultarem antes de mexer em número.
 *
 * Prosa técnica seca de propósito: não é material de mesa, é especificação.
 * Tudo aqui foi derivado do banco ou decidido explicitamente; o que ainda está
 * em aberto vai marcado como tal, para ninguém tratar suposição como regra.
 *
 *   node functions/livro-regua-balanceamento.mjs            (dry-run)
 *   node functions/livro-regua-balanceamento.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK_ID = 'book-regua-balanceamento';

const LIVRO = {
    title: 'Régua de Balanceamento',
    description: 'Especificação técnica interna. As fórmulas, taxas e invariantes usadas para '
        + 'balancear qualquer coisa do sistema — classes, magias, itens, criaturas. Não é material '
        + 'de mesa: é a referência que as ferramentas de auditoria consultam antes de mexer em número.',
    cover: '', order: -2, public: false,
};

const CAPS = [
    {
        title: '0 — A unidade e a linha de base',
        synopsis: 'Como a resolução do sistema vira número, de onde sai a unidade de medida, e por que ela muda com a Qualidade.',
        html: `
<h2>0.1 A resolução, em números</h2>
<p>Todo teste é <code>1d10 ≤ Alvo</code>. O 10 sempre falha, o 1 é crítico. <strong>Graus = Alvo − resultado.</strong> A defesa rola contra <code>Reação + perícia − Graus do atacante</code>.</p>
<p>Um golpe só causa dano se o atacante acerta <em>e</em> o defensor falha. A probabilidade sai por <strong>convolução exata sobre os 10 resultados</strong>, nunca pela média dos Graus — a média superestima, porque o piso de 10% (o crítico natural na defesa) corta a cauda boa.</p>
<pre>P(dano entra) = (1/10) × Σ [1 − max(0,1 ; clamp(AlvoDefesa − Graus, 0, 9)/10)]
                para cada resultado r de 1 até min(Alvo, 9)</pre>

<h2>0.2 O par de referência</h2>
<p>Guerreiro FOR 4 + Perícia: Arma 3, Espada Longa Q0. Defensor Reação 3 + Esquiva 2.</p>
<table>
<thead><tr><th>Grandeza</th><th>Valor</th></tr></thead>
<tbody>
<tr><td>Alvo de ataque</td><td>7</td></tr>
<tr><td>P(acerto)</td><td>0,70</td></tr>
<tr><td>P(dano entra)</td><td><strong>0,53</strong></td></tr>
<tr><td>Dano líquido (1d8 + 4 − Blindagem 2)</td><td>6,5</td></tr>
<tr><td><strong>DPR</strong></td><td><strong>3,445</strong></td></tr>
<tr><td>Vitalidade = (VIG + Tamanho) × 3</td><td>18</td></tr>
<tr><td>Duração do combate</td><td>~5 rodadas</td></tr>
</tbody>
</table>

<h2>0.3 A unidade</h2>
<blockquote><p><strong>1 unidade = o que um guerreiro entrega em 1 rodada.</strong></p></blockquote>
<p>É a referência mais dura que existe no sistema, porque o guerreiro ataca <strong>de graça, toda rodada</strong>. Qualquer coisa que custe recurso e entregue menos que uma rodada de espada é pior que sacar a espada.</p>

<h2>0.4 A unidade não é constante</h2>
<p>A proteção cresce mais rápido que a arma ao longo da escada de Qualidade. Logo a unidade <strong>encolhe</strong>:</p>
<table>
<thead><tr><th></th><th>Q0</th><th>Q5</th></tr></thead>
<tbody>
<tr><td>Dano da arma</td><td>1d8 + 4 = 8,5</td><td>1d8 + 5 + 4 = 13,5</td></tr>
<tr><td>Blindagem do arnês</td><td>~2</td><td>~9</td></tr>
<tr><td>Dano líquido</td><td>6,5</td><td>4,5</td></tr>
<tr><td><strong>1 unidade</strong></td><td><strong>3,445</strong></td><td><strong>2,385</strong></td></tr>
</tbody>
</table>
<p><strong>Sempre calcule a unidade na faixa de Qualidade que está auditando.</strong> Medir uma magia de custo alto contra defesa Q0 produz falso positivo de "quebrada" — foi assim que apareceu um "nuke de 17,2 de dano" que na verdade rende 8,2 contra a Blindagem que existe naquela faixa.</p>
<p><strong>Invariante que tudo protege:</strong> 3 a 10 rodadas para derrubar; combate pareado (arma e proteção da mesma Qualidade) dura 4 a 5. Se o desenho sair disso, é sinal vermelho.</p>
`,
    },
    {
        title: '1 — Régua de controle e suporte',
        synopsis: 'As taxas de conversão de qualquer efeito para a unidade, os três eixos de uma magia, e a regra de custo 1:1.',
        html: `
<h2>1.1 Taxas de conversão</h2>
<p>Todo efeito vira unidade. As taxas abaixo são derivadas, não arbitradas — cada uma é a diferença que o efeito faz no DPR.</p>
<table>
<thead><tr><th>Efeito</th><th>Unidades</th><th>De onde sai</th></tr></thead>
<tbody>
<tr><td>1 ponto de dano</td><td>0,290</td><td>1 ÷ 3,445</td></tr>
<tr><td>1 ponto de cura</td><td>0,290</td><td>dano desfeito</td></tr>
<tr><td>+1 Blindagem, por rodada</td><td>0,154</td><td>0,53 × 1 ÷ 3,445 — só rende no golpe que entra</td></tr>
<tr><td>±1 no Alvo, por rodada</td><td>0,170</td><td>0,585 ÷ 3,445</td></tr>
<tr><td>1 turno roubado</td><td>1,000</td><td>uma rodada inteira de DPR negada</td></tr>
<tr><td>Atacar quem não pode reagir</td><td>0,320</td><td>(0,70 − 0,53) × 6,5 ÷ 3,445 — §6.4</td></tr>
<tr><td>Desarmar</td><td>1,000</td><td>o alvo gasta uma ação para recuperar</td></tr>
<tr><td>Reposicionar de graça</td><td>0,333</td><td><em>âncora a confirmar</em>: 1/3 do turno</td></tr>
</tbody>
</table>

<h2>1.2 Confiabilidade: aliado × inimigo</h2>
<p>Efeito em <strong>inimigo</strong> passa por dois testes (o seu e a defesa dele): <strong>P = 0,53</strong>.<br>
Efeito em <strong>aliado ou em si mesmo</strong> passa só pelo seu: <strong>P = 0,70</strong>.</p>
<p>Suporte é 32% mais confiável que ataque. Ignorar isso subestima toda magia de buff e cura.</p>

<h2>1.3 Os três eixos</h2>
<p>Uma magia não tem um número, tem três. O produto deles é o que se mede:</p>
<blockquote><p><strong>pontos-rodada-alvo = magnitude × rodadas × alvos</strong></p></blockquote>
<p>Jogar todo o balanceamento na magnitude produz prescrições absurdas ("+10 no Alvo"). O conserto quase sempre é mais palatável repartido: dobrar duração e dobrar alvos é o mesmo fator que quadruplicar a magnitude, e cabe muito melhor na mesa.</p>
<p><strong>Teto de duração:</strong> além da cena (5 rodadas) não rende mais em combate. Buff de 1 dia vale 5 rodadas nesta régua. O valor fora de combate é real e <em>não é medido aqui</em>.</p>

<h2>1.4 A regra de custo</h2>
<blockquote><p><strong>Razão custo × efeito ≥ 1,00.</strong> Cada ponto de recurso gasto tem que devolver pelo menos uma unidade. Se 1:1 não couber no desenho, o efeito sobe — nunca o contrário.</p></blockquote>
<p>Todo recurso vale 1 unidade por ponto até prova em contrário. Uma magia de 2 Energia + 1 Graça custa <strong>3 pontos</strong> e precisa entregar 3,00.</p>

<h2>1.5 Tabela de projeto</h2>
<p>O que cada faixa de custo é obrigada a comprar (valores no Q0; recalcule a unidade para outras faixas):</p>
<table>
<thead><tr><th>Custo</th><th>Dano ou cura</th><th>Alvo (pontos-rodada-alvo)</th><th>Blindagem</th><th>Turnos roubados</th></tr></thead>
<tbody>
<tr><td>1</td><td>3,4</td><td>6</td><td>7</td><td>1</td></tr>
<tr><td>2</td><td>6,9</td><td>12</td><td>13</td><td>2</td></tr>
<tr><td>3</td><td>10,3</td><td>18</td><td>20</td><td>3</td></tr>
<tr><td>5</td><td>17,2</td><td>29</td><td>33</td><td>5</td></tr>
</tbody>
</table>
<p>Exemplo de leitura: 6 pontos-rodada-alvo de Alvo por 1 de custo = "−1 no Alvo de 3 inimigos por 2 rodadas", ou "−2 no Alvo de 1 inimigo por 3 rodadas". São equivalentes na régua; a escolha é de sabor.</p>
`,
    },
    {
        title: '2 — Régua de dano e das barreiras',
        synopsis: 'Como o dado de uma magia sai da barreira que ela enfrenta, o Transbordo de Dano, e a escala de fraqueza entre Essências.',
        html: `
<h2>2.1 Régua de dado por barreira</h2>
<blockquote><p><strong>Cada ponto de Blindagem que a parcela pula custa um passo de dado.</strong></p></blockquote>
<pre>dado médio = (alvo líquido) − atributo + (barreira que a parcela enfrenta)</pre>
<table>
<thead><tr><th>Parcela</th><th>Barreira típica (Q0)</th><th>Dado por 1 Energia</th><th>Líquido</th></tr></thead>
<tbody>
<tr><td>Física geral</td><td>Blindagem 2</td><td>1d8</td><td>6,5</td></tr>
<tr><td>Física tipada, na fraqueza da peça</td><td>~1</td><td>1d6</td><td>6,5</td></tr>
<tr><td>Essência</td><td>Blindagem Arcana 0</td><td>1d4</td><td>6,5</td></tr>
</tbody>
</table>
<p>A régua se autocorrige: quando a Blindagem Arcana entrar no catálogo valendo 2, o dado arcano volta a 1d8 sozinho.</p>
<p><strong>Magia nem sempre é dano arcano.</strong> Pedra arremessada com Essência de Terra é dano físico — a pedra é matéria. Gravidade com a mesma Essência é arcano. Bater em Blindagem Física é sempre mais barato.</p>

<h2>2.2 Transbordo de Dano</h2>
<pre>Transbordo = Alvo − 9   (mínimo 0)</pre>
<p>Número fixo, calculado uma vez e impresso na ficha, somado em todo golpe que entra. <strong>É o Alvo, não a rolagem.</strong> Sem conta na mesa.</p>
<p>A Qualidade do foco vai para o <strong>Acerto Mágico</strong>, não para o dano. O Transbordo é o que impede essa escolha de saturar: sem ele, o d10 tem teto e um foco Obra-Prima renderia igual a um Especialista.</p>

<h2>2.3 Blindagem Arcana</h2>
<p>Um número só, <strong>nunca tipada</strong>. As 13 Blindagens por Essência nascem iguais a ela e só divergem quando uma peça vestida cede (▼ fraco) ou resiste (▲ resiste).</p>
<blockquote><p>A Blindagem Arcana é uma <strong>poça de redução gasta uma vez por golpe</strong>, aplicada da maior parcela para a menor até acabar.</p></blockquote>
<p>Sem essa regra, repartir o dano em parcelas pequenas rende o dobro: 5 canais de 1 contra BA 3 passariam 4, enquanto um canal de 5 passaria 2. Com ela, os dois passam 2. Espalhar deixa de ser melhor <em>e</em> deixa de ser pior.</p>
<p>O lado ofensivo arcano <strong>não é campo de item</strong>: entra pelos Valores Derivados de <code>Dano &lt;Essência&gt;</code>, um vínculo por canal. O lado defensivo espelha o Reforço físico (<code>reforcoArcano</code> + <code>blindagemArcanaQ0</code>, com a Blindagem Arcana gravada na peça).</p>

<h2>2.4 Fraqueza N</h2>
<pre>efeito final = piso(efeito ÷ 2^N), mínimo 1</pre>
<p>O arredondamento é o do motor da ficha (<code>dvValorDeMesa</code>, Livro §5.4): para baixo, mínimo 1 quando maior que zero.</p>
<table>
<thead><tr><th>Contra alvo abissal</th><th>Fraqueza</th><th>Efetividade</th></tr></thead>
<tbody>
<tr><td>Abissal</td><td>0</td><td>100%</td></tr>
<tr><td>Luz</td><td>0</td><td>100%</td></tr>
<tr><td>Qualquer outra Essência</td><td>1</td><td>50%</td></tr>
<tr><td>Dano físico</td><td>1</td><td>50%</td></tr>
</tbody>
</table>
<p>Em efeito não numérico, <strong>fraqueza N vale −N no Alvo do teste</strong> — cegar um abissal fica mais difícil, em vez de o mestre ter que inventar o que é um quarto de cegueira.</p>
<p><strong>Consequência de projeto:</strong> criatura abissal precisa de cerca de <strong>metade</strong> da Vitalidade de uma ameaça equivalente. Um grupo de quatro a 50% de efetividade soma o mesmo que dois personagens em força total.</p>
`,
    },
    {
        title: '3 — Invocação, e o teste de escopo',
        synopsis: 'Como medir uma criatura de lealdade incerta, e como saber quando um efeito simplesmente não pertence a esta régua.',
        html: `
<h2>3.1 Invocação que pode virar contra</h2>
<p>O valor não está no texto da magia: está na ficha da criatura, vezes a chance de ela lutar do seu lado.</p>
<pre>valor = (2p − 1) × DPR_da_criatura × rodadas ÷ unidade</pre>
<p>Com <code>p</code> = chance de ela agir a seu favor. Abaixo de <strong>p = 0,5</strong> o valor é <strong>negativo</strong>: o conjurador está pagando para ajudar o inimigo.</p>

<h2>3.2 Requisito de projeto das criaturas invocadas</h2>
<p>Invertendo a fórmula para a Invocação Abissal (custo 5 pontos, 5 rodadas em campo):</p>
<table>
<thead><tr><th>Disposição</th><th>p</th><th>DPR necessário</th><th>× guerreiro</th></tr></thead>
<tbody>
<tr><td>indócil</td><td>50%</td><td>impossível</td><td>—</td></tr>
<tr><td>dócil</td><td>70%</td><td>8,61</td><td>2,5×</td></tr>
<tr><td>leal</td><td>90%</td><td>4,31</td><td>1,3×</td></tr>
<tr><td>dominada</td><td>100%</td><td>3,45</td><td>1,0×</td></tr>
</tbody>
</table>
<p>Uma invocação dócil precisa bater <strong>2,5× o guerreiro</strong> para o rito valer o que custa. É por isso que magias de domínio (Laço de Nome, +1 Disposição) não são conforto: são o que move <code>p</code> acima do equilíbrio. Sem elas a invocação não fecha em cenário nenhum.</p>

<h2>3.3 Teste de escopo: quatro economias, não uma</h2>
<p>Nem tudo se mede em rodadas de dano. Forçar tudo numa régua só é erro de categoria e produz falso "desbalanceado".</p>
<table>
<thead><tr><th>Economia</th><th>O que é</th><th>Régua</th></tr></thead>
<tbody>
<tr><td><strong>Combate</strong></td><td>dano, cura, Alvo, Blindagem, ação negada, desarme, furtividade</td><td>esta régua</td></tr>
<tr><td><strong>Cena / ritual</strong></td><td>planos, selos, ocultação, detecção pura, viagem</td><td><em>não se mede em dano.</em> O preço é tempo + requisito + risco, e o sistema já cobra assim: CA mínimo, Sacrifício, ações de conjuração, falha catastrófica</td></tr>
<tr><td><strong>Invocação / vínculo</strong></td><td>fantoches, aliados animais, Ecos</td><td>§3.1 — a ficha da criatura</td></tr>
<tr><td><strong>Receita</strong></td><td>loções, poções, patuás</td><td>régua de item: preço + dificuldade de preparo</td></tr>
</tbody>
</table>
<blockquote><p><strong>Pergunta de escopo:</strong> esse efeito muda o resultado de um combate? Se muda, mede aqui. Se não muda, ele pertence a outra economia e cobrá-lo por taxa de dano é erro.</p></blockquote>
`,
    },
    {
        title: '4 — Recursos e o que cada um custa',
        synopsis: 'Energia, Graça, Carga, Sanidade, Harmonia e Conexão com Abismo: de onde vêm, quanto valem, e as armadilhas conhecidas de cada um.',
        html: `
<h2>4.1 Energia — a moeda de referência</h2>
<pre>Energia Máxima = PRS + AUT</pre>
<p>Pool típico 7 (PRS 4 + AUT 3). Combate de 5 rodadas. <strong>1 Energia = 1,00 unidade</strong> — é a âncora de todo o resto.</p>
<p><strong>Faixa útil: 1 a 3 Energia por magia.</strong> Acima disso o conjurador não consegue gastar o pool: custo 4 dá uma conjuração só e deixa 3 pontos parados.</p>

<h2>4.2 Regra do custo alternativo</h2>
<blockquote><p>Recurso próprio de escola deve ser custo <strong>alternativo</strong>, não adicional: "1 Energia <strong>OU</strong> 1 Graça", nunca "1 Energia <strong>e</strong> 1 Graça".</p></blockquote>
<p>Custo adicional dobra a barra que a magia precisa vencer sem dobrar o que ela entrega. Foi assim que a Graça de Palla chegou a taxa implícita <strong>negativa</strong> em 10 de 10 casos medidos — o conjurador pagava um segundo recurso e recebia menos do que a Energia sozinha já compraria.</p>

<h2>4.3 Recurso recuperável</h2>
<p>Um recurso que se recupera em combate não pode valer o mesmo que um que não se recupera. Antes de precificar, calcule o <strong>loop</strong> completo: o que custa a ação de recuperar, o que ela exige de condição, e quanto devolve.</p>
<p>Exemplo medido: a Carga do Sangral recupera-se por 1 Energia <em>mais uma ação inteira</em> (que vale 1 unidade de custo de oportunidade) <em>mais</em> sangue derramado ao alcance <em>mais</em> um teste com redutor. Loop real ≈ 1,5:1 condicionado — payoff de preparação, não motor quebrado. Sem contar a ação, o mesmo loop parece 3:1 e acusa a classe injustamente.</p>

<h2>4.4 Recurso que é o próprio tier</h2>
<p>Quando o nome da faixa <em>é</em> o custo (Harmonia do Bardo: "Custo N" custa N), confira a progressão inteira: se o retorno cai conforme o tier sobe, a escada está invertida. Medição registrada: canção de Custo 5 rendendo 0,11× enquanto uma de Custo 2 rendia 0,85×.</p>

<h2>4.5 Conexão com Abismo</h2>
<pre>CA = ⌊Perícia: Abismancia ÷ 2⌋ + valorDeMesa(10 × fração de Sanidade perdida)</pre>
<p>Arredondamento do motor: para baixo, mínimo 1 se maior que zero. O treino dá o pé na porta (sem ele um conjurador são fica em CA 0 e não alcança o ritual mais barato, que exige 2); a loucura dá o resto.</p>
<p>Gastar Sanidade <strong>sobe</strong> o CA, então a classe é catraca de mão única dentro da sessão. <code>Perícia: Resiliência</code> é armadilha: entra em Sanidade Máxima e só atrasa a escada.</p>

<h2>4.6 Contrapeso por variância</h2>
<p>Quando o contrapeso de uma classe é <strong>azar</strong> e não custo, ele não aparece no valor esperado. Auditoria de dano médio vai sempre acusar a classe de quebrada. Modele o risco como valor negativo (§3.1) ou declare explicitamente que a classe não se mede por DPR.</p>
`,
    },
    {
        title: '5 — Ferramentas e procedimento',
        synopsis: 'Os scripts de auditoria, o que cada um responde, e as regras de trabalho ao gravar no banco.',
        html: `
<h2>5.1 Scripts</h2>
<table>
<thead><tr><th>Script</th><th>Responde</th></tr></thead>
<tbody>
<tr><td><code>audit-graus.mjs</code></td><td>estado do catálogo por Qualidade; armas, proteções e focos</td></tr>
<tr><td><code>audit-soquete-magico.mjs</code></td><td>DPR do mago × guerreiro nas 6 Qualidades; escada de CA; sensibilidade à Blindagem</td></tr>
<tr><td><code>audit-regua-controle.mjs</code></td><td>as magias contra a régua desta especificação; prescrição nos três eixos</td></tr>
<tr><td><code>soquete-6-triagem-magias.mjs</code></td><td>quais magias têm dano e quais não têm</td></tr>
<tr><td><code>audit-modulos-classe.mjs</code></td><td>que módulo cada classe tem e quantos itens carrega</td></tr>
</tbody>
</table>

<h2>5.2 Regras de trabalho</h2>
<ul>
<li><strong>Todo script que grava tem <code>--dry-run</code> primeiro</strong>, conta ocorrências e aborta se não bater o esperado.</li>
<li><strong>Toda lógica não trivial deixa um assert rodável.</strong> A régua inteira desta especificação é verificada por asserts dentro dos próprios scripts.</li>
<li><strong>Prefixo <code>Perícia:</code> é obrigatório</strong> em ref de perícia. Oito nomes são perícia <em>e</em> valor derivado ao mesmo tempo; sem o prefixo o motor casa com o VD errado <strong>em silêncio</strong>.</li>
<li><strong>A equação do motor é fold sequencial</strong>, da esquerda para a direita, sem parênteses. <code>[A, ÷2, +B]</code> é <code>(A÷2)+B</code>. O <code>min</code> precisa vir logo depois do termo que ele deve capar — se o atributo vier antes, o teto capa o Alvo inteiro em vez de capar só o que a peça entrega.</li>
<li><strong>Nunca inventar lore.</strong> Nome próprio, instituição, relação entre Essências: nada sem o cânone dizer ou o dono do mundo fornecer.</li>
</ul>

<h2>5.3 Pontos em aberto</h2>
<p>Registrados aqui para ninguém tratar suposição como regra:</p>
<ul>
<li><strong>Reposicionar de graça = 1/3 de turno</strong> — âncora estimada, não derivada. Confirmar contra a mesa.</li>
<li><strong>Blindagem típica por faixa de Qualidade</strong> — a soma do arnês é o número que entra no golpe; falta a curva Q0→Q5 para calcular a unidade em cada faixa com precisão.</li>
<li><strong>Régua de cena</strong> — a economia de ritual e exploração não tem taxa, por decisão. Se um dia precisar de uma, ela não sai desta.</li>
</ul>
`,
    },
];

/* ═══ CONFERÊNCIAS ═══ */
const colLivros = db.collection('worldbuilding-books');
const colArts = db.collection('worldbuilding-articles');
const jaExiste = (await colLivros.doc(BOOK_ID).get()).exists;
const artsExistentes = (await colArts.where('bookId', '==', BOOK_ID).get()).docs;

console.log('=== Livro técnico: Régua de Balanceamento ===\n');
console.log(`  ${LIVRO.title}  (public: ${LIVRO.public})`);
console.log(`  ${LIVRO.description}\n`);
for (const c of CAPS) {
    const palavras = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`  ${c.title.padEnd(42)} ${String(palavras).padStart(4)} palavras`);
}
console.log(`\n  Total: 1 livro + ${CAPS.length} capítulos, todos NÃO públicos.`);

if (jaExiste || artsExistentes.length) {
    console.error(`\n🔴 ABORTADO: livro já existe (${artsExistentes.length} capítulos). Apague antes ou use outro id.`);
    process.exit(1);
}
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
batch.set(colLivros.doc(BOOK_ID), { ...LIVRO, createdAt: agora, updatedAt: agora, updatedBy: AUTOR });
CAPS.forEach((c, i) => {
    batch.set(colArts.doc(), {
        bookId: BOOK_ID, title: c.title, synopsis: c.synopsis, contentHTML: c.html.trim(),
        order: i, status: 'publicado', public: false, mentions: [],
        words: c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        createdAt: agora, updatedAt: agora, updatedBy: AUTOR,
    });
});
await batch.commit();
console.log(`\n✅ Livro criado com ${CAPS.length} capítulos (não público).`);
process.exit(0);
