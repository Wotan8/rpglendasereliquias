/**
 * Escreve o sistema novo de loções nos DOIS livros:
 *
 *  A. Compêndio de Alquimancia (PÚBLICO) — voz de mesa, imitando o capítulo
 *     existente: 2 capítulos novos + cirurgia na seção "Preparo de Loções" do
 *     capítulo de introdução (o preparo de dois passos sai; um teste entra).
 *  B. Régua de Balanceamento (não público) — capítulo técnico 8, prosa seca.
 *
 * ═══ RECONCILIAÇÃO COM O CÂNONE (as decisões, para o bloco de divergências) ═══
 *  - Lei da Dosagem MANTIDA: opostos não coexistem. Os seis pares de reação
 *    foram conferidos — nenhum é par oposto direto. A lei entra na espec.
 *  - As 44 propriedades MANTIDAS como cânone; as OITO das receitas são "as da
 *    bancada" — as que têm efeito de jogo fixado. As demais existem e aguardam.
 *  - Erudição revela propriedades: MANTIDO (é o gate do Caçador/Druida).
 *  - Preparo de DOIS passos (Maceração + Dosagem) vira UM teste — decisão de
 *    custo de mesa (uma rolagem por fornada). A perícia Dosagem NÃO morre:
 *    vira o teste da CRIAÇÃO LIVRE (dosar mistura sem receita, a −3).
 *  - Fórmulas do cânone mantidas: RAC + Herbalismo + Maceração (com receita) e
 *    INT + Herbalismo + Dosagem (sem receita). A espec citava "Alquimancia" no
 *    lugar de Herbalismo — corrigida em favor do cânone.
 *  - "Soma exata" MANTIDA para receita; a criação livre é a exceção declarada.
 *  - "Nenhuma propriedade nova desde a era passada" (Calinor Ivien) MANTIDO —
 *    e casa com o desenho: o que se descobre são REAÇÕES, nunca propriedades.
 *
 *   node functions/livro-alquimancia-locoes.mjs            (dry-run)
 *   node functions/livro-alquimancia-locoes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK_ALQ = 'book_ms3gb8iq5q9k0i';
const BOOK_REGUA = 'book-regua-balanceamento';

/* ═══════════ A.1 — cirurgia no capítulo de introdução ═══════════ */
const PREPARO_NOVO = `<h2>Preparo de Loções</h2>
<p>Antes de qualquer regra, entenda o que você está fazendo: <strong>loção é pasta</strong>. Não se bebe, não se derrama, não evapora em nuvem conveniente. Adere onde é posta e fica ali, esperando. É por isso que loção não tem área — e é por isso que ela chega onde a magia de área não chega: na lâmina, na ponta da flecha, na pele, na maçaneta.</p>
<table>
<thead><tr><th>Forma de entrega</th><th>Alcança</th><th>Descarga</th></tr></thead>
<tbody>
<tr><td>Unção de arma</td><td>quem a arma acertar</td><td>os 3 próximos acertos</td></tr>
<tr><td>Unção de projétil</td><td>quem o projétil acertar</td><td>1 acerto</td></tr>
<tr><td>Aplicação na pele</td><td>você ou um aliado tocado</td><td>imediata</td></tr>
<tr><td>Tratamento de ferida</td><td>um alvo caído ou tocado</td><td>imediata</td></tr>
<tr><td>Cobertura de superfície</td><td>quem tocar a superfície</td><td>primeiro contato</td></tr>
</tbody>
</table>
<p>A receita declara a forma. Aplicar custa 1 Ação Padrão, como tudo.</p>
<h3>O teste — um só</h3>
<p><strong>Alvo = RAC + Herbalismo + Maceração</strong>, com redutor igual ao <strong>Macerar</strong> da receita (a soma dos pontos de propriedade, mais o custo de amplificação, se houver).</p>
<ul>
<li><strong>Graus de Sucesso = doses produzidas.</strong> A fornada inteira, numa rolagem.</li>
<li><strong>Falha:</strong> os ingredientes são perdidos.</li>
<li><strong>Falha crítica:</strong> a mistura reage errado e produz uma loção de efeito invertido. Guarde o frasco: foi assim que mais de uma reação famosa foi descoberta.</li>
</ul>
<p>A conta se equilibra sozinha, e todo boticário aprende isso no bolso: receita fácil rende frascos, receita difícil rende potência. Quem só prepara a loção mais forte que conhece passa a semana para encher uma prateleira.</p>
<h3>Sem receita — a Dosagem</h3>
<p>Receita é registro do que já deu certo. Não é pré-requisito.</p>
<p>O alquimista pode misturar o que quiser: escolhe os ingredientes, o Narrador soma as propriedades, e o teste vira <strong>INT + Herbalismo + Dosagem</strong>, com o mesmo redutor <strong>e −3 por estar improvisando</strong>. Deu certo, a receita passa a existir para ele — com nome dele, se tiver coragem. Deu errado, valem as regras de falha acima, e a falha crítica no improviso é onde nascem as histórias que os boticários contam baixinho.</p>
<p><em>A Lei da Dosagem continua absoluta: propriedades opostas não entram na mesma mistura — nem por teimosia, nem por Grau de Sucesso nenhum.</em></p>`;

/* ═══════════ A.2 — capítulo: as oito da bancada ═══════════ */
const CAP_OITO = {
    title: 'As Oito da Bancada',
    synopsis: 'Das propriedades catalogadas pela linhagem Ivien, as oito que todo boticário domina — e o que cada ponto delas faz.',
    html: `
<p>O catálogo de Calinor Ivien lista dezenas de propriedades, e nenhuma nova foi encontrada desde a era passada. Mas o catálogo é uma coisa e a bancada é outra: destas, <strong>oito</strong> sustentam quase tudo que se macera em Vasteluna. São as que têm efeito fixado em regra. As demais existem, aguardam, e de tempos em tempos alguém jura que domou uma — geralmente pouco antes do enterro.</p>
<p>Cada propriedade entra na loção com uma potência <strong>P</strong>. O efeito cresce com ela:</p>
<table>
<thead><tr><th>Propriedade</th><th>Família</th><th>O que P pontos fazem</th></tr></thead>
<tbody>
<tr><td><strong>Toxis</strong></td><td>Ofensiva</td><td>1 de dano por rodada, durante 2P rodadas (no máximo a cena)</td></tr>
<tr><td><strong>Dissolvix</strong></td><td>Ofensiva</td><td>−P de Blindagem do alvo por 1 cena; em objeto, corrói</td></tr>
<tr><td><strong>Metanox</strong></td><td>Sensorial</td><td>Lento por 1 cena; com P 3 ou mais, também Atordoado por 1 turno</td></tr>
<tr><td><strong>Sentinox</strong></td><td>Sensorial</td><td>Ofuscado por P rodadas; com P 2 ou mais, Cego por metade de P (arredonda para baixo)</td></tr>
<tr><td><strong>Vitalis</strong></td><td>Vital</td><td>cura P+1 de Vitalidade, imediato</td></tr>
<tr><td><strong>Regebolis</strong></td><td>Vital</td><td>cura 1 por rodada, durante 2P rodadas</td></tr>
<tr><td><strong>Caltra</strong></td><td>Vital</td><td>remove P níveis de condição ou de veneno</td></tr>
<tr><td><strong>Metabolis</strong></td><td>Metabólica</td><td>+1 no Alvo por 3P rodadas</td></tr>
</tbody>
</table>
<p>As condições em maiúscula são as do Capítulo 6 do Livro de Regras — a loção as aplica como qualquer golpe as aplicaria, e a Lei da Dosagem vale como sempre valeu: o oposto da propriedade nunca divide o frasco com ela.</p>
<p>O ingrediente mineral entrou para a bancada na última geração: cinábrio para Toxis, sal-gema para Caltra, e o pó de cristal de afinidade — que dá à loção um <strong>canal de Essência</strong>, ferindo onde armadura comum não defende. O Compêndio de Cristalomancia diz de onde vêm as pedras. O preço diz por que ninguém unta a lâmina com rubi para matar ladrão de galinha.</p>
`,
};

/* ═══════════ A.3 — capítulo: soma, amplificação e reação ═══════════ */
const CAP_COMBINAR = {
    title: 'Soma, Amplificação e Reação',
    synopsis: 'As três coisas que acontecem quando propriedades dividem o mesmo pilão — e as seis misturas que viram outra coisa.',
    html: `
<blockquote><p><em>"O pilão não pergunta a intenção. Soma, inflama ou transforma — e cobra de acordo."</em></p></blockquote>
<p>Quando duas propriedades dividem a mesma loção, uma de três coisas acontece. O alquimista que sabe qual das três vai acontecer cobra caro. O que não sabe paga ele mesmo.</p>
<h3>Soma</h3>
<p>A mesma propriedade, vinda de fontes diferentes, <strong>soma potência</strong>. Losna com losna é Toxis 2. É o caso simples, e é assim que a maioria das receitas atinge a potência que pede.</p>
<h3>Amplificação</h3>
<p>Duas propriedades <strong>da mesma família</strong> se excitam: <strong>uma delas, à escolha do alquimista, ganha +1 de potência</strong> — e o Macerar da mistura sobe +2. Mais efeito, teste mais difícil; a Lei da Dosagem em números.</p>
<p>É por isso que a Loção de Cura Rápida leva Vitalis <em>e</em> Regebolis em vez de Vitalis puro: por dois pontos de dificuldade, ela cura já e continua curando.</p>
<h3>Reação</h3>
<p>Certos pares não somam nem se excitam. <strong>Desaparecem — e do pilão sai outra coisa</strong>, com potência igual à menor das duas, mais um. A reação é irreversível: ninguém extrai os componentes de volta.</p>
<p>Seis reações são conhecidas e têm nome. Os nomes são dos boticários, e boticário batiza pelo que a coisa faz ou pelo que ela lembra:</p>
<table>
<thead><tr><th>Mistura</th><th>Nasce</th><th>O que faz (potência P = menor +1)</th></tr></thead>
<tbody>
<tr><td>Toxis + Metanox</td><td><strong>Beijo de Chumbo</strong></td><td>Atordoado por 1 turno; com P 4 ou mais, 2 turnos. O nome vem do envenenamento dos fundidores — o chumbo também beija devagar.</td></tr>
<tr><td>Sentinox + Metanox</td><td><strong>Pavor-Cego</strong></td><td>Amedrontado por 3P rodadas — e o alvo não distingue aliado de inimigo.</td></tr>
<tr><td>Toxis + Dissolvix</td><td><strong>Água-Forte</strong></td><td>2 de dano por rodada, por 2P rodadas, ignorando Blindagem. O nome é o dos gravadores, que a usam para comer metal.</td></tr>
<tr><td>Vitalis + Metabolis</td><td><strong>Sangue-Novo</strong></td><td>cura 2P e dá +1 no Alvo por 3P rodadas.</td></tr>
<tr><td>Regebolis + Caltra</td><td><strong>Lava-Chagas</strong></td><td>cura 1 por rodada por 2P rodadas e remove P condições.</td></tr>
<tr><td>Dissolvix + Caltra</td><td><strong>Cal-Morta</strong></td><td>anula toda loção e veneno no alvo; P de dano se o alvo for construto.</td></tr>
</tbody>
</table>
<p>A reação rende mais do que a soma das partes — é o prêmio de quem acertou. E rende menos do que as duas propriedades renderiam separadas em potência cheia — é o preço de ter tentado.</p>
<p>Há sétima reação? Oitava? O catálogo de Ivien diz que propriedade nova não se acha desde a era passada. Sobre reação nova, o catálogo não diz nada. Os boticários reparam nesse silêncio.</p>
`,
};

/* ═══════════ B — capítulo técnico na Régua ═══════════ */
const CAP_REGUA = {
    title: '8 — Régua da Alquimancia',
    synopsis: 'A âncora de potência das loções, as três formas de combinação, a curva de doses e as conferências.',
    html: `
<h2>8.1 A âncora</h2>
<pre>1 ponto de propriedade = 0,50 unidade</pre>
<p>Derivação: as oito receitas pré-existentes têm potência total 2, e aplicar uma loção custa 1 Ação Padrão = 1,00 unidade (§0.5). Potência 2 empatando com o ataque não feito é o ponto de equilíbrio — o autor das receitas calibrou sem escrever a conta; esta régua só a escreve.</p>
<p><strong>Faixa alvo por dose: 1,00 a 2,00 unidades.</strong> Piso pela Ação Padrão de aplicar; teto porque consumível não pode substituir classe.</p>
<h2>8.2 O que 1 ponto compra</h2>
<table>
<thead><tr><th>Moeda</th><th>1 ponto</th><th>Conferência (taxas do §1.1 e §6.1)</th></tr></thead>
<tbody>
<tr><td>dano/cura imediata</td><td>2</td><td>2 × 0,290 = 0,58</td></tr>
<tr><td>dano por rodada</td><td>1 por 2 rodadas</td><td>2 × 0,290 = 0,58</td></tr>
<tr><td>±1 no Alvo</td><td>3 rodadas</td><td>3 × 0,170 = 0,51</td></tr>
<tr><td>Lento</td><td>1 cena</td><td>5 × 0,10 = 0,50</td></tr>
<tr><td>Ofuscado</td><td>1 rodada</td><td>0,37</td></tr>
<tr><td>Cego</td><td>meia rodada (P2 → 1 rodada)</td><td>1,05 ÷ 2</td></tr>
<tr><td>Atordoado</td><td>1/3 de aplicação (exige P3)</td><td>1,32 ÷ 3</td></tr>
</tbody>
</table>
<h2>8.3 Combinação</h2>
<ul>
<li><strong>Soma</strong>: linear, sem desconto.</li>
<li><strong>Amplificação</strong> (mesma família): +1 de potência em UMA propriedade, Macerar +2. Preço deliberado: 1 ponto de efeito por 2 de dificuldade — abaixo da taxa de compra normal, senão amplificar vira a jogada única.</li>
<li><strong>Reação</strong>: as duas propriedades somem; nasce efeito terceiro com potência <code>menor + 1</code>. Renda maior que a soma, menor que as partes em potência cheia. Prioridade sobre amplificação. Os seis pares canônicos estão no Compêndio; <strong>todos conferidos contra a Lei da Dosagem</strong> — nenhum é par oposto direto.</li>
</ul>
<h2>8.4 A curva de doses — o teto que não precisou de regra</h2>
<pre>Alvo de Macerar = RAC + Herbalismo + Maceração − Macerar da receita
doses = Graus de Sucesso</pre>
<p>Com o alquimista de referência (3+3+3 = Alvo 9):</p>
<table>
<thead><tr><th>Macerar</th><th>Alvo</th><th>doses esperadas</th></tr></thead>
<tbody>
<tr><td>2</td><td>7</td><td>2,1</td></tr>
<tr><td>4</td><td>5</td><td>1,0</td></tr>
<tr><td>6</td><td>3</td><td>0,3</td></tr>
</tbody>
</table>
<p>Volume e potência se pagam mutuamente; acima de Macerar 6 a fornada não compensa. Nenhum teto artificial foi escrito.</p>
<p><strong>Criação livre</strong>: sem receita, o teste vira INT + Herbalismo + Dosagem com −3 adicional. As fórmulas são as do cânone (Compêndio de Alquimancia); a espec antiga citava "Alquimancia" no lugar de Herbalismo e foi corrigida em favor do cânone.</p>
<h2>8.5 Ingredientes</h2>
<pre>raridade = soma das potências + 1 se houver canal de Essência</pre>
<p>1 comum (mercado) · 2 incomum (herborista) · 3 raro (coleta) · 4+ expedição. Preço-âncora: loção pronta vende por 120–140 L$; o ingrediente raro custa na casa da loção pronta. Canal de Essência conta +1 porque dano tipado ignora a armadura comum — não se vende na feira.</p>
<h2>8.6 Conferências</h2>
<table>
<thead><tr><th>Loção</th><th>Unidades</th><th>Razão</th></tr></thead>
<tbody>
<tr><td>Veneno Simples (Toxis 2)</td><td>1,16</td><td>1,16× ✅</td></tr>
<tr><td>Cura Rápida (Vitalis 2 + Regebolis 1, amplificada)</td><td>1,92</td><td>1,92× ✅</td></tr>
<tr><td>Corrosiva (Dissolvix 2)</td><td>1,54</td><td>1,54× ✅</td></tr>
<tr><td>Entorpecente (Metanox 2)</td><td>0,50</td><td><strong>0,50× 🔵</strong></td></tr>
</tbody>
</table>
<p><strong>[A DEFINIR]</strong> — Metanox 2 não sustenta uma dose (Lento vale 0,10/rodada). Opção A: Metanox passa a dar Lento e −1 no Alvo por 1 cena (→ 1,35×). Opção B: a receita Entorpecente exige potência 4 (→ 1,82×, loção avançada). Recomendação registrada: A.</p>
<h2>8.7 Armadilhas conhecidas</h2>
<ul>
<li>O preparo canônico tinha DOIS testes (Maceração + Dosagem). Virou um por custo de mesa; a perícia Dosagem foi repropositada para a criação livre. Se alguém reintroduzir o segundo teste, a curva do §8.4 quebra — as doses passam a ser pagas duas vezes.</li>
<li>Reação usa a MENOR potência +1. Ler "maior" infla toda loção de reação em ~1 ponto.</li>
<li>Amplificação em UMA propriedade só. Nas duas, o custo de +2 de Macerar compra o dobro do que devia (foi o primeiro erro de calibragem desta régua, 3,06× na Cura Rápida).</li>
<li>Canal de Essência na loção morre na maceração — o pó não é bateria. Tratar como carga armazenada duplica o valor do ingrediente mineral.</li>
</ul>
`,
};

/* ═══════════ EXECUÇÃO ═══════════ */
const colArts = db.collection('worldbuilding-articles');
const [alqArts, reguaArts] = await Promise.all([
    colArts.where('bookId', '==', BOOK_ALQ).get(),
    colArts.where('bookId', '==', BOOK_REGUA).get(),
]);
const intro = alqArts.docs.find(d => (d.data().title || '') === 'Alquimancia');
const erros = [];
if (!intro) erros.push('capítulo de introdução da Alquimancia não encontrado');
for (const t of [CAP_OITO.title, CAP_COMBINAR.title]) {
    if (alqArts.docs.some(d => d.data().title === t)) erros.push(`capítulo já existe no Compêndio: ${t}`);
}
if (reguaArts.docs.some(d => /^8 —/.test(d.data().title || ''))) erros.push('capítulo 8 já existe na Régua');

/* cirurgia: da seção "Preparo de Loções" até antes de "Quem Usa a Alquimancia" */
let htmlIntro = intro ? String(intro.data().contentHTML || '') : '';
const iIni = htmlIntro.search(/<h[12][^>]*>\s*Preparo de Loções/i);
const iFim = htmlIntro.search(/<h[12][^>]*>\s*Quem Usa a Alquimancia/i);
if (intro && (iIni === -1 || iFim === -1 || iFim <= iIni)) {
    erros.push(`âncoras da cirurgia não encontradas (ini=${iIni}, fim=${iFim})`);
}
const removido = iIni !== -1 && iFim !== -1 ? htmlIntro.slice(iIni, iFim) : '';
const htmlNovo = htmlIntro.slice(0, iIni) + PREPARO_NOVO + '\n' + htmlIntro.slice(iFim);

console.log('=== Sistema de loções → dois livros ===\n');
console.log('A. Compêndio de Alquimancia (público):');
console.log(`   ~ cirurgia na introdução: seção "Preparo de Loções" (${removido.length} chars, dois testes) → um teste (${PREPARO_NOVO.length} chars)`);
console.log(`     removido começa: "${removido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 90)}…"`);
for (const c of [CAP_OITO, CAP_COMBINAR]) {
    const w = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`   + "${c.title}" (${w} palavras)`);
}
const wR = CAP_REGUA.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(`\nB. Régua de Balanceamento (não público):`);
console.log(`   + "${CAP_REGUA.title}" (${wR} palavras)`);

/* asserts de conteúdo */
const publico = PREPARO_NOVO + CAP_OITO.html + CAP_COMBINAR.html;
const deveTer = ['Beijo de Chumbo', 'Pavor-Cego', 'Água-Forte', 'Sangue-Novo', 'Lava-Chagas', 'Cal-Morta',
    'Lei da Dosagem', 'Graus de Sucesso = doses', 'RAC + Herbalismo + Maceração', 'INT + Herbalismo + Dosagem'];
for (const s of deveTer) if (!publico.includes(s)) erros.push(`faltou no texto público: "${s}"`);
if (/sem gastar ação/i.test(publico)) erros.push('texto público reivindica isenção de Ação (§0.5)');
if (/dois passos|1º Passo|2º Passo/i.test(htmlNovo)) erros.push('a cirurgia deixou resto do preparo antigo');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Asserts: 6 nomes presentes · Lei da Dosagem citada · fórmulas do cânone · sem isenção de Ação · cirurgia limpa.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
const agora = Date.now();
const batch = db.batch();
batch.update(colArts.doc(intro.id), { contentHTML: htmlNovo, updatedAt: agora,
    words: htmlNovo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
const maxOrderAlq = Math.max(...alqArts.docs.map(d => d.data().order ?? 0));
[CAP_OITO, CAP_COMBINAR].forEach((c, i) => {
    batch.set(colArts.doc(), { bookId: BOOK_ALQ, title: c.title, synopsis: c.synopsis,
        contentHTML: c.html.trim(), order: maxOrderAlq + 1 + i, status: 'publicado', public: true,
        mentions: [], words: c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        createdAt: agora, updatedAt: agora, updatedBy: AUTOR });
});
batch.set(colArts.doc(), { bookId: BOOK_REGUA, title: CAP_REGUA.title, synopsis: CAP_REGUA.synopsis,
    contentHTML: CAP_REGUA.html.trim(), order: 8, status: 'publicado', public: false,
    mentions: [], words: wR, createdAt: agora, updatedAt: agora, updatedBy: AUTOR });
await batch.commit();
console.log('\n✅ Gravado: cirurgia + 2 capítulos públicos + capítulo 8 da Régua.');
process.exit(0);
