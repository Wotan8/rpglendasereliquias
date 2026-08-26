/**
 * §9 da Régua — reescrita contra o motor (25/08/2026).
 *
 * O capítulo descrevia um modelo que não existe mais: CINCO Dádivas com efeito
 * fixo, taxas na base 3,445, e custo "2 ENER + 2 SAN" no Ancestral. Hoje são
 * NOVE, cada uma sorteia da ficha do hóspede, o valor é somado até o teto, a
 * base é 3,90, e a Sanidade do Receptor é escalonada pela entrega.
 *
 * PRESERVADO por continuar valendo: §9.3 Personalidade (a tabela das dez e a
 * conta bônus−ônus=0), a escada da Supressão, o exemplo fechado do redutor, a
 * geração do Eco e a regra "uma rolagem, um eixo".
 *
 * Todo número deste capítulo saiu de functions/_cap9deriva.mjs, que roda o
 * motor de verdade. Nenhum foi digitado de memória.
 *
 * Livro técnico é NÃO PÚBLICO — o script confere isso e aborta se mudou.
 *
 *   node functions/regua-cap9-reescreve.mjs            (dry-run)
 *   node functions/regua-cap9-reescreve.mjs --apply
 */
import { createRequire } from 'node:module';
import { TAXA, RODADAS_POR_CENA, TETO_SEM_AURA, DADIVAS } from '../shared/dadiva.js';
import { ORCAMENTO_BASE, UNIDADES_POR_SANIDADE, SANIDADE_PROJETOR_PISO,
    PODER_POR_SANIDADE, REDUTOR_DO_VEU, custoEscalonado, custoDaProjecao } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('DA76qGdp3QZp8VCCUQPF');

const doc = (await ref.get()).data();
const H = doc.contentHTML;
if (doc.public !== false) { console.error('ABORTA: livro tecnico tem de ser public:false'); process.exit(1); }
if (H.length !== 11766) { console.error(`ABORTA: cap9 tem ${H.length} chars, esperado 11766`); process.exit(1); }

/* ── recortes que ficam ─────────────────────────────────────────────────── */
const at = (s) => { const i = H.indexOf(s); if (i < 0) { console.error(`ABORTA: nao achei ancora ${JSON.stringify(s.slice(0, 50))}`); process.exit(1); } return i; };
const PERSONALIDADE = H.slice(at('<h2>9.3 Personalidade'), at('<h2>9.4 Supressão'));
const SUPRESSAO_TESTE = H.slice(at('<h2>9.4 Supressão'), at('<h3>Por que o Ancestral testa na entrada'));
const ESCADA = H.slice(at('<table>\n<thead><tr><th>Nível</th>'), at('<h3>Exemplo fechado'));
const EXEMPLO = H.slice(at('<h3>Exemplo fechado'), at('<h2>9.5 Geração do Eco'));
const GERACAO = H.slice(at('<h2>9.5 Geração do Eco'), at('<h2>9.6 A regra que saiu daqui'));
const UM_EIXO = H.slice(at('<h2>9.6 A regra que saiu daqui'), at('<h2>9.7 Pontos em aberto'));

const troca = (s, de, para) => {
    if (!s.includes(de)) { console.error(`ABORTA: nao achei ${JSON.stringify(de.slice(0, 60))}`); process.exit(1); }
    return s.split(de).join(para);
};

/* a taxa de Alvo mudou de 0,170 (base 3,445) para 0,167 (base 3,90) */
let personalidade = troca(PERSONALIDADE, 'bônus − ônus = 2×0,170×0,25×5 − 2×0,170×0,25×5 = 0,00',
    'bônus − ônus = 2×0,167×0,25×5 − 2×0,167×0,25×5 = 0,00');
personalidade = troca(personalidade, 'ela vale 0,43 e sai do orçamento', 'ela vale 0,42 e sai do orçamento');
personalidade = personalidade.replace('<h2>9.3 Personalidade', '<h2>9.7 Personalidade');

let escada = troca(ESCADA, '<td>−0,170/rodada</td>', '<td>−0,167/rodada</td>');
escada = troca(escada, '<td>−0,340/rodada + 1,000 pela ação</td>', '<td>−0,334/rodada + 1,000 pela ação</td>');

let supressao = SUPRESSAO_TESTE.replace('<h2>9.4 Supressão', '<h2>9.8 Supressão');

/* a linha do 1d6 de Dádiva morreu: o hóspede entrega as nove */
let geracao = GERACAO.replace('<h2>9.5 Geração do Eco', '<h2>9.9 Geração do Eco');
geracao = troca(geracao, '<tr><td>1d6 Dádiva</td><td>1 Braço · 2 Pele · 3 Olho · 4 Passo · 5 Boca · 6 o Mestre escolhe</td></tr>',
    '<tr><td>Dádiva</td><td>não se rola na geração: o hóspede entrega as nove, e o sorteio acontece em cada incorporação (§9.3)</td></tr>');
geracao = troca(geracao, 'tabela do §9.3', 'tabela do §9.7');

let umEixo = UM_EIXO.replace('<h2>9.6 A regra que saiu daqui', '<h2>9.10 A regra que saiu daqui');
umEixo = troca(umEixo, 'a Transcendência — Projetor, que ficou de fora porque projeção é economia de cena e não tem entrega medida',
    'a Transcendência — Projetor. Ela não viola a regra: os Graus compram só a duração, e a magnitude não vem de rolagem nenhuma — vem do Poder do hóspede e do Véu escolhido (§9.6)');

/* ── números, todos do motor ────────────────────────────────────────────── */
const n3 = (x) => x.toFixed(3).replace('.', ',');
const n2 = (x) => x.toFixed(2).replace('.', ',');
const ACAO_PADRAO = 1.000, ACAO_COMPLETA = 1.333, TX_SAN = 0.290, TX_ENER_CUSTO = 1.000;
const linhaReceptor = (U) => {
    const s = custoEscalonado(U).sanidade;
    const c = 2 * TX_ENER_CUSTO + ACAO_PADRAO + s * TX_SAN;
    return `<tr><td>${U}</td><td>${s}</td><td>${n3(c)}</td><td>${n2(U / c)}×</td></tr>`;
};
const linhaProjetor = (prs, veu) => {
    const c = custoDaProjecao({ atributos: { PRS: prs } }, veu);
    return `<tr><td>${prs}</td><td>${veu}</td><td>${c.sanidade}</td><td>${c.redutor}</td><td>${n3(2 * TX_ENER_CUSTO + ACAO_COMPLETA + c.sanidade * TX_SAN)}</td></tr>`;
};
const sanParaSegurar = (U) => Math.ceil((U / 1.70 - (2 * TX_ENER_CUSTO + ACAO_PADRAO)) / TX_SAN);

const NOVO = `<h2>9.1 O que se compra</h2>
<pre>Transcendência — Receptor    2 Energia · Ação Padrão · 1 cena = ${RODADAS_POR_CENA} rodadas (§0.1)
Transcendência — Projetor    2 Energia · Ação Completa · Graus × 10 minutos
portão (as duas)             Totemismo 3 · Totem cravado · Eco encontrado</pre>
<p>As duas usam o mesmo motor (<code>shared/incorporacao.js</code>) e se separam no que entregam:</p>
<ul>
<li><strong>Receptor</strong> — o hóspede entra no personagem. O personagem recebe as <strong>Dádivas</strong>. É a única das duas com entrega medida em unidades.</li>
<li><strong>Projetor</strong> — o personagem vai para o hóspede e passa a jogar a ficha dele. <strong>Não recebe Dádiva nenhuma.</strong></li>
</ul>
<p><strong>Mudou em 25/08/2026.</strong> A versão anterior deste capítulo descrevia cinco Dádivas com efeito fixo (<code>Braço +1 de dano, +1 no Alvo</code>, <code>Pele +3 de Blindagem</code>…), taxas na base 3,445 e custo <code>2 ENER + 2 SAN</code> no Ancestral. Nada disso existe. Quem encontrar aqueles números em outro documento está lendo material morto.</p>

<h2>9.2 As nove Dádivas</h2>
<p>O que o hóspede entrega não é escolhido no cadastro nem fixado aqui: <strong>cada Dádiva sorteia um candidato dentro do grupo dela</strong>, e o candidato vem da ficha do hóspede. O catálogo é <code>DADIVAS</code> em <code>shared/dadiva.js</code>; esta tabela é reflexo dele, não a fonte.</p>
<table>
<thead><tr><th>Dádiva</th><th>Sorteia entre</th><th>Taxa</th><th>Por rodada?</th></tr></thead>
<tbody>
<tr><td>Braço</td><td>FOR · DES · VIG</td><td>Alvo ${n3(TAXA.alvo)}</td><td>sim</td></tr>
<tr><td>Mente</td><td>INT · RAC · PRS</td><td>Alvo ${n3(TAXA.alvo)}</td><td>sim</td></tr>
<tr><td>Boca</td><td>PRE · MAN · AUT</td><td>Alvo ${n3(TAXA.alvo)}</td><td>sim</td></tr>
<tr><td>Pele</td><td>Vitalidade Máxima · Blindagem · Blindagem Arcana</td><td>${n3(TAXA.vitalidade)} / ${n3(TAXA.blindagem)} / ${n3(TAXA.blindagem)}</td><td>só as Blindagens</td></tr>
<tr><td>Olho</td><td>os VDs do bloco <em>Sentidos</em></td><td>Alvo ${n3(TAXA.alvo)}</td><td>sim</td></tr>
<tr><td>Passo</td><td>os VDs do bloco <em>Deslocamento</em></td><td>—</td><td>economia de cena (§3.3)</td></tr>
<tr><td>Perícia</td><td>uma por <strong>tipo</strong> de perícia que o hóspede tenha</td><td>Alvo × cláusula estreita 0,25 (§1.4)</td><td>sim</td></tr>
<tr><td>Habilidade</td><td>não sorteia: libera os módulos de classe do hóspede</td><td>—</td><td>—</td></tr>
<tr><td>Energia</td><td>Energia Máxima, com teto no custo da própria habilidade (§11.3)</td><td>${n3(TAXA.energia)}</td><td>não</td></tr>
</tbody>
</table>
<pre>Alvo por rodada    ${n3(TAXA.alvo)} = 0,10 × 6,5 ÷ 3,90        numa cena: ${n3(TAXA.alvo * RODADAS_POR_CENA)}
Blindagem/rodada   ${n3(TAXA.blindagem)} = 1 ÷ 6,5                 numa cena: ${n3(TAXA.blindagem * RODADAS_POR_CENA)}
Vitalidade         ${n3(TAXA.vitalidade)} = 1 ÷ 3,90  (uma vez, não por rodada)
Energia            ${n3(TAXA.energia)} = 1 ÷ 3,90</pre>
<p><strong>Armadilha.</strong> A Perícia expande em <em>uma categoria por tipo do cadastro</em>, não numa rolagem só. Com cinco tipos cadastrados, ela sozinha vira cinco rolagens. Quem contar "nove Dádivas = nove rolagens" erra o número de dados da mesa.</p>

<h2>9.3 O dado, e a face de nenhum</h2>
<pre>n candidatos → n+1 saídas: os n candidatos e o NENHUM
P(nenhum) = 1 ÷ (n+1)
dado = menor padrão com ≥ n+1 faces; o que passar de n+1 RERROLA</pre>
<p>Receber uma Dádiva não é receber vantagem. A saída de nenhum existe para que a sorte possa anular, e ela vale <strong>uma saída, sempre uma só</strong> — o rerrolar existe justamente para o número de faces do dado disponível não inflar essa chance.</p>
<table>
<thead><tr><th>Candidatos</th><th>Dado</th><th>Nenhum em</th><th>P(nenhum)</th></tr></thead>
<tbody>
<tr><td>1</td><td>1d4, rerrola acima de 2</td><td>2</td><td>50,0%</td></tr>
<tr><td>3</td><td>1d4</td><td>4</td><td>25,0%</td></tr>
<tr><td>5</td><td>1d6</td><td>6</td><td>16,7%</td></tr>
<tr><td>6</td><td>1d8, rerrola acima de 7</td><td>7</td><td>14,3%</td></tr>
<tr><td>11</td><td>1d12</td><td>12</td><td>8,3%</td></tr>
</tbody>
</table>
<p><strong>Consequência de projeto, não bug:</strong> quanto mais candidatos o grupo tem, menor a chance de anular. Um hóspede rico em perícias falha menos. Mexer no número de Sentidos ou de Deslocamentos do cadastro muda o dado e a probabilidade — o catálogo é que manda, não este capítulo.</p>

<h2>9.4 Por que não existe razão fixa</h2>
<p>A entrega é <strong>somada</strong> ao valor do personagem e cortada pelo teto (${TETO_SEM_AURA} sem Aura, o que a Aura permitir com ela, teto racial vence tudo). Logo o que a Dádiva rende depende de <em>quanto espaço sobrava na ficha de quem recebe</em>, e não só do hóspede. Dois Xamãs incorporando o mesmo Eco recebem coisas diferentes.</p>
<pre>ganho = min(valor do hóspede, teto − valor do personagem)
unidades = ganho × taxa × (${RODADAS_POR_CENA} se por rodada)</pre>
<p><strong>Exemplo fechado.</strong> Braço. Eco FOR 5 · DES 3 · VIG 4. Xamã FOR 2 · DES 5 · VIG 3, teto ${TETO_SEM_AURA}.</p>
<pre>face 1 = FOR     cabe ${TETO_SEM_AURA}−2 = 3   ganho 3   3 × ${n3(TAXA.alvo)} × ${RODADAS_POR_CENA} = 2,505 un
face 2 = DES     cabe ${TETO_SEM_AURA}−5 = 0   ganho 0   0,000 un   (já estava no teto)
face 3 = VIG     cabe ${TETO_SEM_AURA}−3 = 2   ganho 2   2 × ${n3(TAXA.alvo)} × ${RODADAS_POR_CENA} = 1,670 un
face 4 = NENHUM                      0,000 un
E[unidades] = 4,175 ÷ 4 = 1,044 un</pre>
<p>O mesmo Eco num Xamã de FOR 5 entregaria zero naquela face. <strong>Por isso a Incorporação não tem carimbo de razão</strong> — o carimbo dela é <code>conformidade: true, razao: null</code>, medida pelo §11 (custo, tempo, requisito, risco, efeito com teto), não pela faixa de 1,00–1,70×.</p>

<h2>9.5 O preço do Receptor: a escalonada</h2>
<pre>Sanidade = ⌊(unidades entregues − ${ORCAMENTO_BASE}) ÷ ${UNIDADES_POR_SANIDADE}⌋      (custoEscalonado, shared/incorporacao.js)
custo total = 2 Energia + Ação Padrão + ${n3(TX_SAN)} × Sanidade</pre>
<p>As primeiras ${ORCAMENTO_BASE} unidades vêm com o custo fixo. Acima disso, quem tira mais paga mais — em Sanidade, que não se recupera dentro da cena.</p>
<table>
<thead><tr><th>Unidades</th><th>Sanidade</th><th>Custo total</th><th>Razão</th></tr></thead>
<tbody>
${[2, 4, 6, 8, 12, 16].map(linhaReceptor).join('\n')}
</tbody>
</table>
<p><strong>A razão cresce, e cresce de propósito.</strong> Isto é o invariante do §9.8 visto por outro ângulo: num sistema de uma Ação Padrão por habilidade, pacote grande é inerentemente mais eficiente por ação, e nenhum preço em recurso fecha a janela. Para segurar a razão em 1,70× seria preciso cobrar <code>${sanParaSegurar(8)}</code> de Sanidade a 8 unidades (a escalonada cobra ${custoEscalonado(8).sanidade}) e <code>${sanParaSegurar(12)}</code> a 12 unidades (cobra ${custoEscalonado(12).sanidade}) — preço que mata o personagem antes da cena acabar.</p>
<p><strong>A escalonada não é dispositivo de faixa. É preço de risco.</strong> Ela existe para que a entrega grande doa, não para que ela caiba em 1,70×. Quem quiser reabrir isso mexe em <code>UNIDADES_POR_SANIDADE</code>, que é parâmetro, não constante escondida.</p>
<p><strong>Ancestral.</strong> O dobro da entrega (§9.8) passa pela mesma conta e cobra mais Sanidade sozinho — não há mais linha de custo separada para ele. Era <code>2 ENER + 2 SAN</code> fixo; virou consequência da entrega.</p>

<h2>9.6 O preço do Projetor: Poder e Véu</h2>
<p>A projeção não recebe Dádiva, então não há entrega para escalonar. Ela cobra pelo que veste e por onde vai.</p>
<pre>Sanidade = ${SANIDADE_PROJETOR_PISO} + ⌊Poder do hóspede ÷ ${PODER_POR_SANIDADE}⌋ + Véu (Material 0 · Etérico 1 · Astral 2)
Redutor no teste de Transcendência (Projetor) = Material ${REDUTOR_DO_VEU.material} · Etérico ${REDUTOR_DO_VEU.eterico} · Astral ${REDUTOR_DO_VEU.astral}
Poder = eco.prs do cadastro; vazio, a PRS da ficha</pre>
<table>
<thead><tr><th>Poder</th><th>Véu</th><th>Sanidade</th><th>Redutor</th><th>Custo total</th></tr></thead>
<tbody>
${[2, 6, 10].flatMap(p => ['material', 'eterico', 'astral'].map(v => linhaProjetor(p, v))).join('\n')}
</tbody>
</table>
<p><strong>O piso de ${SANIDADE_PROJETOR_PISO} é regra, não arredondamento:</strong> sair do corpo cobra sempre, mesmo com o hóspede mais banal.</p>
<p><strong>Armadilha — não repita o erro que estava aqui.</strong> Até 25/08/2026 o Projetor pagava a <em>escalonada do Receptor</em>, calculada sobre as unidades da Dádiva. Como aquelas unidades são cortadas pelo teto de quem recebe, elas mediam o espaço que sobrava na ficha do Xamã, não a força do hóspede: pelo mesmo Eco e pelo mesmo benefício, o veterano no teto pagava <strong>zero</strong> e o iniciante pagava caro. Se algum dia a projeção voltar a ser cobrada por entrega de Dádiva, é este bug de volta.</p>
`;

const FIM = `<h2>9.11 Pontos em aberto</h2>
<p><strong>PRS do §9.9 contra PRS de ficha.</strong> A tabela de geração dá PRS 1 a 5 por Estado (Ancestral 3). Os 11 Ecos cadastrados têm PRS 2 a 8, e o Projetor agora precifica por esse número — um Eco do Mestre de Armas (PRS 8) sai mais caro que um Ancestral (PRS 3). Ou a tabela de geração está numa escala velha, ou o Poder do Eco é outro número que não a PRS. <code>[A DEFINIR]</code>, e é o ponto mais urgente daqui.</p>
<p><strong>Nenhum Eco tem <code>eco.estado</code> preenchido</strong> (0 de 11). O dobro do Ancestral funciona no motor e não dispara para ninguém. Decisão de mesa pendente, não defeito de código.</p>
<p><strong>Sanidade continua a ${n3(TX_SAN)}/ponto</strong> por falta de âncora própria (§4). Todo custo deste capítulo depende disso — se a Sanidade for reancorada, as duas tabelas de preço mudam juntas.</p>
<p><strong>Passo e Habilidade não têm taxa.</strong> Deslocamento e módulo de classe emprestado não são medidos pela régua de combate (§3.3). São entrega real que sai como zero unidade, o que <em>subestima</em> a incorporação nas duas tabelas de razão acima. Se a mesa achar a Dádiva de Habilidade forte demais, é aqui que está a cegueira.</p>
<p><strong>A Perícia usa cláusula estreita ×0,25</strong> herdada do §1.4, mas ela não é "efeito preso a uma perícia" — ela <em>é</em> a perícia. A taxa está provavelmente baixa. Não foi rederivada.</p>
<p><strong>Dívida Espiritual não tem número.</strong> O capítulo público diz que xamãs endividados "sofrem penalidades em todos os rituais". Quanto, e como sobe e desce, <code>[A DEFINIR]</code>.</p>
<p><strong>Peso da Personalidade e (5 − Disposição) no redutor</strong> são âncoras propostas, não derivadas. O exemplo do §9.8 mostra que somados estouram o piso — se na mesa o Furioso virar intocável, o corte é usar só um dos dois.</p>
<p><strong>Redutor do Véu não é aplicado automaticamente.</strong> A janela do Tabuleiro mostra o número e o log registra; quem subtrai do Alvo é o Mestre. Não há teste de Transcendência rolado pelo motor.</p>`;

const novoHTML = NOVO + '\n' + personalidade + supressao + escada + EXEMPLO + geracao + umEixo + FIM;

/* ── relatório ──────────────────────────────────────────────────────────── */
const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`${doc.words} → ${palavras(novoHTML)} palavras · public=${doc.public}`);
console.log('\nSEÇÕES:');
for (const m of novoHTML.matchAll(/<h([23])>([^<]*)/g)) console.log(`  h${m[1]}  ${m[2]}`);
for (const t of ['p', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'h2', 'h3', 'strong', 'em', 'code']) {
    const o = (novoHTML.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
    const c = (novoHTML.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o} abre / ${c} fecha`); process.exit(1); }
}
// O §9.1 CITA o modelo morto de propósito, para avisar. A checagem tem de
// distinguir citação de sobra: ignora o parágrafo do aviso e procura no resto.
const AVISO_INI = novoHTML.indexOf('<p><strong>Mudou em 25/08/2026.</strong>');
const AVISO_FIM = novoHTML.indexOf('</p>', AVISO_INI) + 4;
const semAviso = novoHTML.slice(0, AVISO_INI) + novoHTML.slice(AVISO_FIM);
const MORTO = ['cinco Dádivas', '3,445', '0,170', '0,340', '+3 de Blindagem',
    '2 Energia + 2 Sanidade', '1d6 Dádiva', 'valor 3 (Comum)', '4,60'];
const sobrou = MORTO.filter(m => semAviso.includes(m));
console.log(sobrou.length ? `\n!! texto morto sobrou: ${sobrou.join(' · ')}` : '\ntags ok · nenhum texto do modelo antigo sobrou');
if (sobrou.length) process.exit(1);
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: novoHTML, words: palavras(novoHTML), updatedAt: Date.now() });
console.log('\nOK gravado');
process.exit(0);
