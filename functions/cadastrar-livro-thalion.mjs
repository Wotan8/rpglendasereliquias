/**
 * Livro do Cânone: "Thalion Vassek".
 *
 * PRIVADO (public: false). Lore de mestre.
 *
 * REGRA DO LIVRO — não quebrar:
 *   UM CONTO = UM CAPÍTULO, ÍNTEGRO, SEM UMA PALAVRA ALTERADA.
 *   NENHUM outro capítulo reconta, resume ou cita pedaço de conto.
 *   Só existe um capítulo que não é conto: o Dossiê de Mesa, no fim.
 *
 * Os dois contos antigos são extraídos dos .docx de "Relatos de Vasteluna"
 * (scratchpad/contos.json) — não redigitados. O conto novo vem de
 * scratchpad/ele-dormia.txt.
 *
 * ORDEM CANÔNICA (1 ciclo = 1 ano):
 *   1. O Céu Ficou Parado — ano 0, a família morre
 *   2. Eu Cedi           — ano 4, rompe com Morik e cede à vingança
 *   3. Ele Dormia        — depois do ano 4: Ibirá aparece em Sereni, o roubo,
 *                          e a desistência diante do deus adormecido
 *
 *   node functions/cadastrar-livro-thalion.mjs [--apply]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const BOOK_ID = 'book-thalion-vassek';
const SP = 'C:/Users/Soberano/AppData/Local/Temp/claude/C--Users-Soberano-Documents-rpglendasereliquias/1ad1a0c6-eeb4-480c-b250-36f05112ebb8/scratchpad';

/** Só escapa o que quebraria HTML. Não normaliza aspas, reticências nem espaços. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const emParagrafos = (paras) => paras.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

/* --- contos antigos: direto dos .docx originais --- */
const contos = JSON.parse(readFileSync(`${SP}/contos.json`, 'utf8').replace(/^\uFEFF/, ''));
function doDocx(chave, tituloEsperado) {
    const paras = contos[chave];
    if (!Array.isArray(paras) || !paras.length) throw new Error(`conto "${chave}" ausente`);
    if (paras[0].trim() !== tituloEsperado) throw new Error(`1º parágrafo de "${chave}" é "${paras[0]}", esperava "${tituloEsperado}"`);
    return { html: emParagrafos(paras.slice(1)), n: paras.length - 1 };
}
const CEU = doDocx('ceu', 'O Céu Ficou Parado');
const CEDI = doDocx('cedi', 'Eu Cedi');

/* --- conto novo --- */
const novoParas = readFileSync(`${SP}/ele-dormia.txt`, 'utf8').replace(/^\uFEFF/, '').split(/\n/).map(s => s.trim()).filter(Boolean);
const DORMIA = { html: emParagrafos(novoParas), n: novoParas.length };

const LIVRO = {
    title: 'Thalion Vassek',
    description: 'Os contos de Thalion Vassek em ordem, na íntegra, mais um dossiê de condução. Um conto por capítulo, sem cortes. Livro de mestre.',
    order: 20,
    public: false,
};

const CAPS = [
    {
        title: '0 — Ordem, fontes e lacunas',
        synopsis: 'A linha do tempo dos contos, de onde vem cada fato e o que ainda falta decidir. Nada aqui reconta os contos.',
        contentHTML: `
<p>Este livro é <strong>a obra de Thalion Vassek</strong>: um conto por capítulo, íntegro, sem uma palavra alterada e sem recorte. Nenhum capítulo resume, cita ou reconta trecho de conto. O único capítulo que não é conto é o <strong>Dossiê de Mesa</strong>, no fim, e ele existe para conduzir o NPC, não para explicar o texto.</p>
<p>Quando houver dúvida sobre uma fala ou um fato, <strong>o conto manda</strong>.</p>

<h2>Ordem</h2>
<p><strong>1 ciclo = 1 ano.</strong></p>
<table>
<thead><tr><th>Quando</th><th>Conto</th><th>O que acontece</th></tr></thead>
<tbody>
<tr><td><strong>Ano 0</strong></td><td>O Céu Ficou Parado</td><td>Ibirá desce na vila natal, promete, cava. A fenda abre no terceiro dia. Paloma, Sabrini e Guilion morrem.</td></tr>
<tr><td><strong>Ano 4</strong></td><td>Eu Cedi</td><td>Depois de três ciclos em Sereni ao lado de Morik Varn, rompe em silêncio e cede à vingança.</td></tr>
<tr><td><strong>Depois do ano 4</strong></td><td>Ele Dormia</td><td>Ibirá aparece em Sereni e começa outra masmorra. Thalion escolhe não avisar Morik. Rouba a adaga, chega diante do deus adormecido, não consegue levantar o braço, e desiste.</td></tr>
<tr><td>Hoje</td><td>—</td><td>Subsolo de Velmora, tentando vender a lâmina antes de enlouquecer.</td></tr>
</tbody>
</table>

<h2>Lacunas abertas</h2>
<ul>
<li><strong>[FALTA]</strong> O nome da vila natal.</li>
<li><strong>[FALTA]</strong> A idade de Thalion, há quantos anos era capitão, e quem foi o pai que lhe deu a espada de aço.</li>
<li><strong>[FALTA]</strong> O que ele fez entre o enterro e a chegada a Sereni.</li>
<li><strong>[FALTA]</strong> Que cargo ocupava em Sereni, e se Fontrix e Albrix serviram sob ele.</li>
<li><strong>[FALTA]</strong> Com que pano ele embrulhou a adaga.</li>
<li><strong>[FALTA]</strong> Quanto tempo passou entre a fuga de Sereni e a chegada a Velmora.</li>
<li><strong>[FALTA]</strong> Há quanto tempo carrega a lâmina — define quanta Sanidade ela já cobrou.</li>
</ul>

<h2>Fora deste livro</h2>
<p>A masmorra que Ibirá ergueu em Sereni é hoje a <strong>Ruína de Ibirá</strong>. Ela virou ruína quando o grupo da Mesa 1 a venceu, no 1º arco — isso não tem relação nenhuma com o conto <em>Ele Dormia</em> e não pertence à história de Thalion.</p>
`.trim(),
    },
    {
        title: 'O Céu Ficou Parado',
        synopsis: 'Conto de Thalion Vassek, íntegro. Ano 0. Texto original do autor — não editar.',
        contentHTML: CEU.html,
    },
    {
        title: 'Eu Cedi',
        synopsis: 'Conto de Thalion Vassek, íntegro. Ano 4, quatro ciclos depois do anterior. Texto original do autor — não editar.',
        contentHTML: CEDI.html,
    },
    {
        title: 'Ele Dormia',
        synopsis: 'Conto de Thalion Vassek, íntegro. Depois do ano 4: o retorno a Sereni, a escolha de não avisar, o roubo da adaga e o braço que não subiu.',
        contentHTML: DORMIA.html,
    },
    {
        title: 'Dossiê de Mesa',
        synopsis: 'Ferramenta de condução do NPC: desejo, contradição, medo, tiques de fala, os quatro botões, e o que ele sabe e não sabe hoje.',
        contentHTML: `
<p>Único capítulo que não é obra do autor. Quando houver conflito, <strong>o conto manda</strong>.</p>

<h2>Em uma linha</h2>
<p>Um capitão de guarda que falhou uma vez, se cobrou por quatro anos, deixou uma vila morrer por causa de um homem, e descobriu na mesma noite que a vingança nunca esteve ao alcance dele.</p>

<h2>Os quatro pilares</h2>
<table>
<thead><tr><th>Peça</th><th>Qual é</th></tr></thead>
<tbody>
<tr><td><strong>Desejo</strong></td><td>Se livrar da lâmina antes que ela o quebre — sem dizer a ninguém que é por isso. Por baixo, e ele não diz nem para si: que o deus aprenda os três nomes.</td></tr>
<tr><td><strong>Contradição</strong></td><td>Acusou Morik de deixar gente morrer por obsessão privada, e depois deixou Sereni morrer por obsessão com Morik. Ele sabe, escreveu, e não se defende.</td></tr>
<tr><td><strong>Medo</strong></td><td>Não é morrer. É que a conta que ele pagou adiantado — uma vila — tenha sido por nada.</td></tr>
<tr><td><strong>Maneirismo</strong></td><td><strong>Endireita objetos sobre a mesa enquanto fala</strong>, sem olhar. Quando <em>para</em> de endireitar, a cena virou. É o semáforo antes de qualquer explicação.</td></tr>
</tbody>
</table>

<h2>Como ele fala</h2>
<ul>
<li><strong>Repete a frase quando trava.</strong> Não é ênfase, é o homem emperrando.</li>
<li><strong>Corrige-se no meio</strong>, com um "Não…" seco, e volta atrás na própria afirmação.</li>
<li><strong>Números.</strong> Conta tudo — dias, passos, anos, batidas do peito. Quando dá um número, está se segurando. Perder a conta é a pior coisa que acontece com ele.</li>
<li><strong>Toca a cicatriz</strong> quando abalado.</li>
</ul>

<h2>O que ele nunca diz</h2>
<ul>
<li><strong>Como a família morreu.</strong> Ele se recusa por escrito. Insistir não o irrita — encerra a conversa.</li>
<li><strong>Que deixou Sereni cair de propósito.</strong> Está escrito, mas escrito não é dito.</li>
<li><strong>Que está vendendo por medo da própria cabeça.</strong> Apresentará qualquer outra razão primeiro.</li>
<li><strong>Desculpa por ter acreditado no deus.</strong></li>
</ul>

<h2>Os quatro botões</h2>
<table>
<thead><tr><th>Botão</th><th>O que aciona</th><th>O que acontece</th></tr></thead>
<tbody>
<tr><td><strong>Abre</strong></td><td>Falar da família <em>sem pedir detalhe</em>. Dizer os três nomes. Perguntar da árvore.</td><td>Ele responde. Conta que o filho chamava a árvore de "a gorda", e que ria toda vez.</td></tr>
<tr><td><strong>Fecha</strong></td><td>Pedir que descreva a morte deles.</td><td>Fim de papo. Vira as costas.</td></tr>
<tr><td><strong>Congela</strong></td><td>Dizer que Ibirá tentou consertar.</td><td>A mão vai à espada antes do pensamento.</td></tr>
<tr><td><strong>Quebra</strong></td><td>Contar que a esposa de Morik chamava Sereni e que Ibirá a matou.</td><td>Para de endireitar os objetos. Toca a cicatriz. <em>"…Três anos eu odiei aquele homem por ser hipócrita."</em> [pausa] <em>"E ele era só… outro viúvo."</em></td></tr>
</tbody>
</table>

<h2>O que ele sabe e o que não sabe, hoje</h2>
<table>
<thead><tr><th>Sabe</th><th>Não sabe</th></tr></thead>
<tbody>
<tr><td>Que Ibirá matou a família dele</td><td>Que Ibirá matou a esposa de Morik</td></tr>
<tr><td>Quem são Fontrix e Albrix — homens de Morik</td><td>Que Albrix morreu esta noite</td></tr>
<tr><td>Que a adaga fere deuses, porque a roubou do próprio</td><td>Que o grupo trabalha para Ibirá</td></tr>
<tr><td>Que existe passagem secreta — ele a usa</td><td>Que Morik está a uma noite de estrada</td></tr>
<tr><td>Que ferir não é vencer</td><td>Que existe uma poção feita do sangue do deus</td></tr>
<tr><td>Que Onéria caiu e as legiões Famo avançam</td><td>O que aconteceu com Sereni depois — e não quer saber</td></tr>
</tbody>
</table>

<h2>Onde ele está</h2>
<p>Câmara lateral no subsolo das Ruínas de Velmora, sob a Feira do Submundo de Ina Nó-de-Pedra. Um catre, uma mesa com objetos alinhados, e debaixo do catre uma caixa de ferro sem fechadura: dois fechos, e a tampa levanta. Seriva "Véu Cinza" já veio autenticar a peça. É venda, não guarda.</p>
<p><strong>Se a Feira não acontecer, ele perde tudo</strong> — não há segundo comprador organizado, e ele não pode simplesmente largar a adaga: alguém tem que aceitá-la. Isso lhe dá uma queixa concreta, e não moral, contra quem estragar a noite.</p>
`.trim(),
    },
];

/* ===================== EXECUÇÃO ===================== */
console.log(APPLY ? '=== APLICANDO ===\n' : '=== DRY-RUN ===\n');
console.log(`Livro "${LIVRO.title}" · ${BOOK_ID} · order=${LIVRO.order} · public=${LIVRO.public}\n`);
console.log('Contos (um capítulo cada, íntegros):');
console.log(`  O Céu Ficou Parado — ${CEU.n} parágrafos  [do .docx]`);
console.log(`  Eu Cedi           — ${CEDI.n} parágrafos  [do .docx]`);
console.log(`  Ele Dormia        — ${DORMIA.n} parágrafos  [novo]\n`);

const antigos = await db.collection('worldbuilding-articles').where('bookId', '==', BOOK_ID).get();
if (!antigos.empty) console.log(`⚠ removendo ${antigos.size} capítulo(s) da versão anterior\n`);

CAPS.forEach((c, i) => {
    const f = (c.contentHTML.match(/\[FALTA\]/g) || []).length;
    console.log(`  ${i} · ${c.title}${/íntegro/.test(c.synopsis) ? '  📖 CONTO' : ''} — ${c.contentHTML.length} chars${f ? ` · ${f} lacuna(s)` : ''}`);
});
const naoConto = CAPS.filter(c => !/íntegro/.test(c.synopsis)).length;
console.log(`\n  ${CAPS.length} capítulos: 3 contos + ${naoConto} de apoio`);

if (APPLY) {
    await db.collection('worldbuilding-books').doc(BOOK_ID).set({
        ...LIVRO, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, { merge: true });
    for (const d of antigos.docs) await d.ref.delete();
    for (let i = 0; i < CAPS.length; i++) {
        await db.collection('worldbuilding-articles').add({
            bookId: BOOK_ID, order: i, status: 'publicado', public: false,
            ...CAPS[i], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
    }
    console.log('\nGravado.');
} else {
    console.log('\nRode com --apply.');
}
process.exit(0);
