/**
 * Capítulos públicos (Espiritismo e Ferinismo) — o que faltava contar ao jogador.
 *
 * As regras já rodam no Tabuleiro e já estão no §9 da Régua e nos predefs, mas
 * o livro que o JOGADOR lê não dizia três coisas:
 *   1. o sorteio é DADO, com face de nenhum — a sorte pode anular;
 *   2. a Sanidade do Receptor escala com o tamanho da entrega (+1 a cada 2
 *      unidades acima de 2);
 *   3. a projeção cobra Sanidade por Poder + Véu, e o Véu ainda põe Redutor.
 *
 * Números conferidos contra o motor no fim do script — aborta se divergirem.
 * Nada de material de mestre (Disposição, Máscara, tabela de sorte ficam fora).
 *
 *   node functions/cap-publicos-dado-sanidade.mjs            (dry-run)
 *   node functions/cap-publicos-dado-sanidade.mjs --apply
 */
import { createRequire } from 'node:module';
import { dadoSugerido } from '../shared/dadiva.js';
import { ORCAMENTO_BASE, UNIDADES_POR_SANIDADE, SANIDADE_PROJETOR_PISO,
    PODER_POR_SANIDADE, REDUTOR_DO_VEU, custoDaProjecao } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* confere que o texto que vou gravar bate com o motor */
if (ORCAMENTO_BASE !== 2 || UNIDADES_POR_SANIDADE !== 2) { console.error('ABORTA: escalonada mudou; reescreva o texto'); process.exit(1); }
if (SANIDADE_PROJETOR_PISO !== 1 || PODER_POR_SANIDADE !== 3) { console.error('ABORTA: projecao mudou; reescreva o texto'); process.exit(1); }
if (REDUTOR_DO_VEU.eterico !== 2 || REDUTOR_DO_VEU.astral !== 4) { console.error('ABORTA: Redutor do Veu mudou'); process.exit(1); }
if (dadoSugerido(3).rotulo !== '1d4' || dadoSugerido(3).nenhumEm !== 4) { console.error('ABORTA: dado mudou'); process.exit(1); }
if (custoDaProjecao({ atributos: { PRS: 6 } }, 'astral').sanidade !== 5) { console.error('ABORTA: exemplo do Astral nao bate'); process.exit(1); }

const planos = [];

/* ── ESPIRITISMO ────────────────────────────────────────────────────────── */
{
    const ref = db.collection('worldbuilding-articles').doc('pH0cqjh74rGy5qJZc3H5');
    const doc = (await ref.get()).data();
    let H = doc.contentHTML;
    const troca = (de, para) => {
        if (!H.includes(de)) { console.error(`ABORTA (Espiritismo): nao achei ${JSON.stringify(de.slice(0, 60))}`); process.exit(1); }
        H = H.split(de).join(para);
    };

    // 1 · "nenhuma se escolhe" ganha o COMO: o dado e a face de nenhum
    troca('<p><strong>Nenhuma delas se escolhe.</strong> O Eco entrega o que calhou.',
        `<p><strong>Nenhuma delas se escolhe — rola-se um dado para cada uma.</strong> O dado tem sempre uma face a mais que as opções, e essa face é <strong>nenhum</strong>: a Dádiva veio vazia, e não há o que reclamar ao Eco. Três atributos pedem 1d4, e o 4 não é nenhum dos três; caiu número acima do nenhum, rola de novo. Receber uma Dádiva não é receber vantagem — é descobrir o que aquela vida tinha para dar <em>hoje</em>.</p>
<p>O Eco entrega o que calhou.`);

    // 2 · a Sanidade escalonada, que não estava em lugar nenhum do livro
    troca('<p><strong>Na prática:</strong> o que o Eco foi em vida decide o que ele serve.',
        `<p><strong>E a comunhão cobra pelo que entrega.</strong> Abrir a carne custa a Energia do ritual — mas quando o Eco tem muito para dar, o peso de carregar outra vida cobra em <strong>Sanidade</strong>: quanto maior o total que os dados trouxerem, mais o Xamã paga, e a conta chega junto com a entrega, não antes. Um Eco modesto sai só pela Energia. Um Eco cheio de vidas dentro de um Xamã que ainda tem muito espaço para crescer é a comunhão mais cara que existe — e é o Xamã jovem quem mais sente. O Tabuleiro faz essa conta sozinho.</p>
<p><strong>Na prática:</strong> o que o Eco foi em vida decide o que ele serve.`);

    // 3 · a projeção com Véu, que só existia no predef
    troca('<h4>A voz, e o que ela esconde</h4>',
        `<h4>A Projeção, e até que Véu</h4>
<p>A outra forma da Transcendência é o caminho inverso: o Xamã deixa o corpo e vai habitar o Eco. Não recebe Dádiva nenhuma — passa a agir pelo que o Eco é, com a ficha dele, enquanto o próprio corpo fica em transe, inerte e vulnerável.</p>
<p>Sair do corpo custa <strong>Sanidade, e nunca zero</strong>. O preço cresce com duas coisas: o <strong>Poder do Eco</strong> que se veste — quanto mais forte a consciência alheia, mais a mente mortal se esgarça para caber nela — e a profundidade do <strong>Véu</strong> até onde se sobe. O Véu Material é o mundo de sempre. O Etérico e o Astral são camadas onde o lugar deixa de se parecer com um lugar, e subir até elas também <strong>dificulta o próprio teste da projeção</strong> (Redutor ${REDUTOR_DO_VEU.eterico} no Etérico, ${REDUTOR_DO_VEU.astral} no Astral). O Etérico exige Transcendência 3+; o Astral, um Eco que tenha transcendido.</p>
<p>Um Eco brando, no mundo material, custa 1 de Sanidade. Um Eco poderoso, no Astral, chega a 5 ou mais. O Tabuleiro mostra os preços das três camadas antes de o Xamã escolher.</p>
<h4>A voz, e o que ela esconde</h4>`);

    planos.push(['Espiritismo — o Ramo do Eco', ref, doc, H]);
}

/* ── FERINISMO ──────────────────────────────────────────────────────────── */
{
    const ref = db.collection('worldbuilding-articles').doc('MD1Z9RdcBQo3wKL15KVD');
    const doc = (await ref.get()).data();
    let H = doc.contentHTML;
    const troca = (de, para) => {
        if (!H.includes(de)) { console.error(`ABORTA (Ferinismo): nao achei ${JSON.stringify(de.slice(0, 60))}`); process.exit(1); }
        H = H.split(de).join(para);
    };

    // o dado entra na frase da Dádiva, e a Sanidade ganha o gatilho concreto
    troca('sorteia-se o que sai, e o que sai se soma ao que o Druida já tinha, até o teto.',
        'rola-se um dado para cada Dádiva, sempre com uma face de <strong>nenhum</strong> — a sorte pode anular —, e o que sai se soma ao que o Druida já tinha, até o teto.');
    troca('<p>O custo em Sanidade acompanha o tamanho da entrega: um lobo empresta pouco e sai barato, um urso ancião empresta muito e cobra por isso. Não existe preço fixo — quem tira mais, paga mais.</p>',
        '<p>O custo em Sanidade acompanha o tamanho da entrega: um lobo empresta pouco e sai barato, um urso ancião empresta muito e cobra por isso. Não existe preço fixo — quem tira mais, paga mais, e a conta chega depois dos dados, não antes. O Tabuleiro a faz sozinho.</p>');
    // o Projetor do Druida também paga Sanidade pelo Poder do bicho
    troca('Pode consultar a ficha do animal; não pode editá-la.</p>',
        'Pode consultar a ficha do animal; não pode editá-la. Sair do corpo também cobra <strong>Sanidade</strong>, e mais quanto mais poderosa a criatura que se veste — vestir um urso ancião não é vestir uma lebre.</p>');

    planos.push(['Ferinismo — o Ramo do Aliado Vivo', ref, doc, H]);
}

/* ── gravação ───────────────────────────────────────────────────────────── */
const palavras = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
for (const [nome, , doc, H] of planos) {
    console.log(`${nome}: ${doc.words} → ${palavras(H)} palavras`);
    for (const t of ['p', 'h4', 'h2', 'strong', 'em', 'ul', 'li']) {
        const o = (H.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
        const c = (H.match(new RegExp(`</${t}>`, 'g')) || []).length;
        if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c} em ${nome}`); process.exit(1); }
    }
}
console.log('tags ok');
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
for (const [nome, ref, , H] of planos) {
    await ref.update({ contentHTML: H, words: palavras(H), updatedAt: Date.now() });
    console.log(`OK ${nome}`);
}
process.exit(0);
