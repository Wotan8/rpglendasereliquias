/**
 * LIVRO DE REGRAS DO JOGADOR — três capítulos para a Integridade
 *
 * A régua vive no banco, não no JS: mudou a mecânica, muda o capítulo.
 * Especificação desatualizada é pior que especificação ausente, porque tem
 * credibilidade sem ter razão.
 *
 *   §5.5  Falha Crítica passa a ter DUAS consequências: a automática, de
 *         Integridade, e a do Narrador, de acabamento (esta, intacta).
 *   §5.9  Contêiner ganha teto de peso, desgaste e ruptura.
 *   §7.6  Desambigua a Integridade de cenário da de equipamento.
 *
 * Cada troca ancora no texto EXATO que espera encontrar e aborta se o capítulo
 * já tiver mudado — sobrescrever cego um livro publicado é pior que não mexer.
 *
 *   node functions/livro-integridade.mjs            # dry-run
 *   node functions/livro-integridade.mjs --apply    # grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

// ===================================================================
// §5.5 — a Integridade entra ANTES da seção do acabamento
// ===================================================================
const ANCORA_55 = '<h3>O acabamento se perde antes da peça</h3>';

const NOVO_55 = `<h3>Integridade: o que a peça aguenta</h3>
<p>Antes da Afiação e antes da Qualidade existe uma pergunta mais simples: a peça está inteira ou está arruinada? Isso é a <strong>Integridade</strong>.</p>
<p><strong>Integridade = (Liga + Tamanho) × 3</strong></p>
<p>É a mesma conta da Vitalidade de um corpo (seção 2.8), com a Liga no lugar do Vigor — quem decide quanto uma coisa aguenta antes de deixar de servir é o material de que ela foi feita. Peça sem Liga declarada conta como Liga 1. O que está no catálogo e tem preço não é galho de árvore.</p>
<table>
<thead><tr><th>Peça</th><th>Liga</th><th>Tamanho</th><th>Integridade</th></tr></thead>
<tbody>
<tr><td>Adaga comum</td><td>2</td><td>0,3 m</td><td>6,9</td></tr>
<tr><td>Espada longa</td><td>3</td><td>1,2 m</td><td>12,6</td></tr>
<tr><td>Montante de Liga Superior</td><td>5</td><td>1,5 m</td><td>19,5</td></tr>
<tr><td>Mochila Média de Couro</td><td>2</td><td>4</td><td>18</td></tr>
</tbody>
</table>
<p>Uma Falha Crítica custa <strong>1 ponto de Integridade</strong>. Sempre, e sem ninguém precisar decidir nada: quem rolou o 10 vê o número cair na hora, e o Tabuleiro faz a conta sozinho. Arma improvisada continua sendo o caso extremo que sempre foi — <strong>Liga 0 se destrói na primeira falha</strong>, porque não havia peça, havia um pedaço de pau.</p>
<p>O número quebra, e é para quebrar: a adaga aguenta seis falhas críticas e cai na sétima, o montante aguenta dezenove e cai na vigésima. A regra é a mesma nas duas mãos. A diferença é o aço.</p>

<h3>Integridade zero</h3>
<p>A peça não some, não se parte ao meio e não vira pó. Ela continua na sua mão, continua pesando o que pesava, e <strong>para de fazer efeito</strong>. Uma espada arruinada ainda é um pedaço comprido de metal — só não é mais uma espada que corta melhor que as outras. Nada do que ela dava conta enquanto estiver assim: dano, acerto, blindagem, vínculo nenhum.</p>
<p>Continua ocupando o slot, também. Quem quiser as duas mãos livres tem de guardar ou largar o ferro velho como largaria qualquer outro.</p>

<h3>Consertar sai por metade</h3>
<p><strong>Metade do preço da peça, uma hora por ponto.</strong> Divida pela Integridade máxima e você tem o preço do ponto.</p>
<blockquote><p><strong>Exemplo:</strong> a Mochila Média de Couro custa 250 L$ e tem Integridade 18. O ponto sai por 250 × 0,5 ÷ 18 ≈ 7 L$ e uma hora de bancada. Do fundo ao topo: 125 L$ e dezoito horas — metade do preço de uma mochila nova, e a metade que você paga é em tempo.</p></blockquote>
<p>A escada da oficina fica com três degraus, e cada um custa dez vezes o anterior: <strong>Integridade</strong>, depois <strong>Afiação</strong>, depois <strong>Qualidade</strong>. Repor a Integridade de uma peça comum é troco. Repor o gume custa centenas. Subir a Qualidade custa milhares. Quem vive na estrada conserta; quem vive na cidade melhora.</p>
<p><em>O botão "Restaurar do cadastro", na janela do item, devolve a peça ao que o catálogo diz — e devolve inteira. É o conserto do ferreiro, sem a viagem até ele.</em></p>

<h3>O acabamento se perde antes da peça</h3>`;

// ===================================================================
// §5.9 — o contêiner também tem limite
// ===================================================================
const ANCORA_59_LI = '<li><strong>Containers</strong> (mochilas, alforjes, baús) somam o peso do conteúdo multiplicado pelo seu fator de pressão — uma boa mochila carrega melhor que os braços;</li>';
const NOVO_59_LI = '<li><strong>Containers</strong> (mochilas, alforjes, baús) somam o peso do conteúdo multiplicado pelo seu fator de pressão — uma boa mochila carrega melhor que os braços, até onde ela aguenta (ver abaixo);</li>';

const ANCORA_59 = '<h3>Transporte Alternativo</h3>';

const NOVO_59 = `<h3>A mochila também tem limite</h3>
<p>Todo contêiner do catálogo tem um <strong>peso máximo</strong> e uma <strong>Integridade</strong> (seção 5.5). Passar do peso máximo não é proibido: ninguém arranca a bolsa da sua mão, e o site deixa você enfiar o que quiser lá dentro. O que acontece é que ela começa a ceder.</p>
<p><strong>Excesso = peso dentro ÷ peso máximo − 1</strong></p>
<p>Dentro do limite, o excesso é zero e nada acontece — a maioria das bolsas de mesa vive assim e nunca vê essa regra. Acima do limite, o excesso é o que a bolsa paga, e ela paga em dois momentos:</p>
<table>
<thead><tr><th>Quando</th><th>Custa</th></tr></thead>
<tbody>
<tr><td>Guardar ou tirar alguma coisa</td><td>1 × excesso</td></tr>
<tr><td>Cada trecho de caminhada no mapa</td><td>⅓ × excesso</td></tr>
</tbody>
</table>
<p>Remexer é carga nova entrando de uma vez. Andar é a mesma carga batendo na costura, passo após passo. Por isso a caminhada custa um terço — a mesma proporção que uma Ação de Movimento tem para uma Ação Padrão. O excesso trava em 2: acima de três vezes o limite a bolsa já arrebentou, e insistir não piora a conta.</p>
<blockquote><p><strong>Exemplo:</strong> uma Mochila Média de Couro (peso máximo 20 kg, Integridade 18) com 40 kg dentro está no dobro do limite — excesso 1. Cada coisa guardada ou tirada custa 1 ponto; cada trecho de caminhada custa 0,33. Uma sessão com dez remexidas e vinte trechos come quase dezessete dos dezoito pontos. <strong>Dobrou o peso, a bolsa não passa da sessão.</strong></p></blockquote>
<p>A dez por cento acima do limite, a mesma mochila dura onze sessões. Marca, não mata. A regra existe para o grupo que resolveu levar o saque inteiro de uma vez, não para punir quem carregou uma corda a mais.</p>

<h3>Quando a bolsa rasga</h3>
<p>Integridade zero e o fundo cede. Nada é destruído: tudo que estava dentro passa para <strong>Itens Soltos</strong>, e a bolsa fica com você, vazia e imprestável até passar por uma oficina. Rompida, ela também não recebe mais nada — não dá para enfiar de volta o que acabou de cair.</p>
<p>Aí você descobre a segunda metade do preço. O que estava na mochila pressionava pelo fator dela; solto, pressiona pelo peso cheio. <strong>Sua Carga sobe no instante em que a bolsa rasga</strong>, e é assim que uma mochila estourada vira uma penalidade de teste físico na rodada seguinte, sem que nada tenha sido acrescentado ao seu inventário.</p>
<p>No Tabuleiro há uma consequência a mais, e ela não é nova: item Solto fica no chão quando o token anda. Bolsa rasgada em combate espalha o conteúdo pelo mapa. Pegue as coisas antes de sair andando.</p>

<h3>Transporte Alternativo</h3>`;

// ===================================================================
// §7.6 — desambiguar as duas escalas
// ===================================================================
const ANCORA_76 = '<p><strong>Objetos e estruturas:</strong> objetos têm <strong>Dureza</strong> (madeira 1, pedra 2, aço 3, +4 por camada de reforço) e <strong>Integridade</strong> (Dureza + Tamanho do objeto). Para danificar, o dano precisa superar a Dureza; ferramentas certas reduzem a Dureza para a tarefa (uma broca "fura" 3 pontos de Dureza de uma porta).</p>';

const NOVO_76 = ANCORA_76 + `
<p>Essa conta é a do <em>cenário</em> — a porta que se arromba, o baú que se quebra, a ponte que não aguenta o carroção. O <strong>equipamento que você carrega</strong> usa a mesma ideia numa escala maior: a Liga faz as vezes da Dureza e o resultado é triplicado, porque uma espada precisa atravessar uma campanha e uma porta só precisa aguentar um machado (seções 5.5 e 5.9).</p>`;

// ===================================================================

/* `marca` e um trecho que SO existe no texto novo. Nao da para checar pelo
   comeco do `para`: em duas das quatro trocas o texto novo COMECA com o texto
   antigo, e o script se declarava pronto sem ter feito nada. */
const TROCAS = [
    { id: 'art-regras-jogador-05', nome: '§5.5 · Integridade, zero e conserto', de: ANCORA_55, para: NOVO_55,
      marca: 'Integridade: o que a peça aguenta' },
    { id: 'art-regras-jogador-05', nome: '§5.9 · o bullet do contêiner', de: ANCORA_59_LI, para: NOVO_59_LI,
      marca: 'até onde ela aguenta (ver abaixo)' },
    { id: 'art-regras-jogador-05', nome: '§5.9 · limite, desgaste e ruptura', de: ANCORA_59, para: NOVO_59,
      marca: 'A mochila também tem limite' },
    { id: 'art-regras-jogador-07', nome: '§7.6 · as duas escalas', de: ANCORA_76, para: NOVO_76,
      marca: 'Essa conta é a do <em>cenário</em>' },
];

const palavras = (html) => String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

const porArtigo = {};
for (const t of TROCAS) (porArtigo[t.id] ||= []).push(t);

let abortou = false;
for (const [id, trocas] of Object.entries(porArtigo)) {
    const ref = db.collection('worldbuilding-articles').doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`❌ ${id} não existe`); abortou = true; continue; }
    const x = snap.data();
    let html = x.contentHTML || '';
    const antes = palavras(html);
    console.log(`\n📖 ${id} — ${x.title} (${antes} palavras, ${x.public ? 'público' : 'rascunho'})`);

    for (const t of trocas) {
        if (html.includes(t.marca)) {
            console.log(`  ⏭️  ${t.nome}: já aplicado`);
            continue;
        }
        if (!html.includes(t.de)) {
            console.log(`  ❌ ${t.nome}: ÂNCORA NÃO ENCONTRADA — o capítulo mudou desde que este script foi escrito`);
            abortou = true;
            continue;
        }
        html = html.replace(t.de, t.para);
        console.log(`  ${APPLY ? '✍️ ' : '· '}${t.nome}: +${palavras(t.para) - palavras(t.de)} palavras`);
    }

    if (abortou) { console.log('  (nada gravado neste artigo)'); continue; }
    console.log(`  total: ${antes} → ${palavras(html)} palavras`);
    if (APPLY) {
        await ref.update({
            contentHTML: html,
            words: palavras(html),
            updatedAt: new Date().toISOString(),
            updatedBy: 'integridade',
        });
    }
}

if (abortou) console.log('\n⚠️ Alguma âncora falhou. NADA foi gravado onde falhou — confira o capítulo à mão.');
else if (!APPLY) console.log('\nRode de novo com --apply para gravar.');
else console.log('\n✅ Capítulos atualizados.');
