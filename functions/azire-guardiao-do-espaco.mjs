/**
 * O Azire é guardião do espaço, não necrófago — e o Espectro vai para as duas matas.
 *
 * Correções de cânone dadas pelo usuário em 01/09/2026:
 *
 *  1. O **Espectro da Seiva Negra** vive nas DUAS matas, como as outras três
 *     de "A Mata Fechada".
 *
 *  2. O **Avarbus comum** aparece — ou é atraído — por locais com MUITAS
 *     MORTES. É o que a ficha dele já insinuava; passa a estar escrito.
 *
 *  3. O **Avarbus Azire** é o OPOSTO do irmão, e eu tinha escrito ele errado
 *     em quase tudo que não era número:
 *       · **Azire é convenção de nome no cenário**: tudo que tem Azire no
 *         nome é DOURADO e carrega muita **Essência Índigo (Espaço)** e
 *         **Âmbar-Incandescente (Poder)**.
 *       · Azires **comem Abismo** — não carniça.
 *       · São chamados **guardiões do espaço**, porque é deles o trabalho de
 *         "curar" as feridas do espaço.
 *       · E a definição que fecha tudo: **o Abismo é uma ferida no espaço** —
 *         uma fenda que se rompe no tecido e deixa o Abismo entrar. O Azire
 *         não caça o Abismo por ódio: ele fecha o buraco comendo o que sai.
 *
 * ── COMO ISSO CONVERSA COM O QUE JÁ ESTÁ ESCRITO ────────────────────
 * O livro "Abismancia" (`book_ms3gb8sua583cb`) já dizia: *"Onde o tecido do
 * Soberano afina, a Abissência pinga; onde mente e carne racham, fendas se
 * abrem"* e *"rituais abissais abrem fendas, por onde a Abissência vaza para
 * a realidade"*. A cosmologia bate. ⚠️ Só o NOME do tecido diverge: o livro
 * diz **"tecido do Soberano"**, você disse **"tecido do espaço"**. Escrevi
 * usando a sua formulação e deixo a pergunta: são o mesmo tecido com dois
 * nomes, ou duas coisas?
 *
 * As essências saem do banco, não de mim: `Dano Espacial` é a **Essência
 * Índigo (Espaço)** e `Dano Áureo` é a **Âmbar-Incandescente (Poder)** —
 * e "Áureo" já é o nome do canal dourado.
 *
 * ⚠️ O QUE EU ESTOU LENDO E VOCÊ PRECISA CONFIRMAR: a ficha do cofre diz que
 * o Azire tem "afinidade com Palla graças ao seu Azire" (Luz). Você disse
 * espacial e âmbar. Tratei a Luz/Palla do cofre como leitura velha do que
 * hoje é o Âmbar-Incandescente (o canal Áureo é o dourado), e escrevi assim:
 * **o corpo é Avarbus — necrótico, espinhoso, da linhagem; o Azire é o que
 * cavalga o corpo — dourado, espacial, âmbar.** É o que explica o cofre
 * dizer que, perdendo o azire, ele desmaia: sem o azire sobra um Avarbus.
 * Se essa leitura estiver errada, é uma linha para desfazer.
 *
 *   node functions/azire-guardiao-do-espaco.mjs            (dry-run)
 *   node functions/azire-guardiao-do-espaco.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK = 'book_mrs9ur4aw1m6a';
const U = 3.90;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = (x, c = 2) => x.toFixed(c).replace('.', ',');

const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const cond = (await db.collection('system/data/conditions').get()).docs.map(d => d.data().nome);
const geo = (await db.collection('worldbuilding-geography').get()).docs.map(d => d.data().nome);
const erros = [];
const acha = n => npcs.find(x => x.nome === n);
const cap = t => arts.find(d => (d.data().title || '') === t);

if (!cond.includes('Necrose')) erros.push('condição "Necrose" não existe — o Azire depende dela');
for (const g of ['Floresta de Silmarela', 'Floresta de Silmari']) if (!geo.includes(g)) erros.push(`geografia "${g}" não existe`);

const patches = [];

/* ─── 1. Espectro nas duas matas ─── */
const esp = acha('Espectro da Seiva Negra');
if (!esp) erros.push('"Espectro da Seiva Negra" não achado');
else patches.push({ nome: esp.nome, ref: db.collection('npcs').doc(esp.id), antes: esp, campos: {
    local: 'Floresta de Silmarela · Floresta de Silmari',
    'criatura.habitat': 'Floresta de Silmarela e Floresta de Silmari — mata densa e árvores corrompidas, nas duas matas',
} });

/* ─── 2. Avarbus comum: atraído por muitas mortes ─── */
const av = acha('Avarbus');
if (!av) erros.push('"Avarbus" não achado');
else {
    const compAntes = String(av.criatura?.comportamento || '');
    const linha = 'É atraído por locais com MUITAS MORTES — campo de batalha, peste, cova coletiva. Onde morreu muita gente, ele chega; se ainda não morreu ninguém, é porque ele chegou cedo.';
    if (compAntes.includes('MUITAS MORTES')) erros.push('"Avarbus": a linha de atração já está lá');
    else patches.push({ nome: av.nome, ref: db.collection('npcs').doc(av.id), antes: av, campos: {
        'criatura.comportamento': (compAntes ? compAntes.trimEnd() + '\n\n' : '') + linha,
    } });
}

/* ─── 3. O Azire, reescrito ─── */
const az = acha('Avarbus Azire');
if (!az) erros.push('"Avarbus Azire" não achado');
else {
    const CORPO = 'Dourado. É a primeira coisa que se nota e é a que dá o nome: no cenário, o que carrega Azire é dourado, e carrega muita Essência Índigo (Espaço) e Âmbar-Incandescente (Poder). '
        + 'O corpo é Avarbus — fibra rígida, dorso inteiro em espinho, mandíbula que dilacera, a linhagem necrótica do irmão. O Azire é o que cavalga esse corpo: pulsa nos olhos e muda a fome inteira. '
        + 'Por isso, perdendo o azire, ele desmaia — o que sobra é um Avarbus, e um Avarbus não sabe o que fazer com uma fenda.';

    const INTERACAO = 'Come Abismo. Fenda, ruptura, resíduo abissal: é disso que ele vive, e é por isso que a ruína onde ele está apaga em vez de acender. '
        + 'A mordida ainda é da linhagem: Necrose 1, e a carne que ela mata não volta enquanto ele estiver de pé. '
        + 'O dorso espinhaço é reação, não ataque — quem bate nele de perto se fere nos espinhos. A Repulsão Azire empurra até cinco metros e anula o golpe corpo a corpo que a disparou.';

    const comportamento = [
        INTERACAO, '',
        'O SINAL: Uma ruína que devia estar escura e não está. Onde ele come, a fenda apaga — e o dourado dele é a única luz que sobra.',
        'A REGRA: Vai aonde o tecido está rasgado, não aonde há mortos. É o oposto exato do irmão: o Avarbus comum é atraído por muitas mortes, o Azire por muitas fendas. Deixa Avarbus comuns viverem no território dele, mantidos na fronteira, e é alfa deles.',
        'O REMÉDIO: Fechar a fenda antes dele chegar funciona, e é caro. Levar luz sagrada para expulsá-lo é o pior conselho que existe — o dourado dele não é Palla, é Âmbar, e ele não tem por que recuar de luz nenhuma.',
        'A MORAL: A reverência ao guardião do espaço — e o desconforto de descobrir que quem fecha a ferida do mundo é uma coisa espinhosa que ninguém convidou.',
        '',
        'RITO DE DOMA',
        'Chamariz: uma fenda. Não há outro — ele não vem por comida, vem por buraco.',
        'Preço: levá-lo até a próxima, e à seguinte, e à seguinte',
        'A prova: quando ele fechar uma fenda com você por perto sem primeiro empurrar você com a Repulsão Azire',
        'O erro: tapar a fenda antes dele terminar. Ele entende como roubo, e tem razão',
    ].join('\n');

    const am = String(az.criatura?.nivelAmeaca || '');
    patches.push({ nome: az.nome, ref: db.collection('npcs').doc(az.id), antes: az, campos: {
        'criatura.dieta': 'Abissófago — come Abismo: fenda, ruptura e resíduo abissal. Não come carniça, e é nisso que difere do irmão.',
        'criatura.comportamento': comportamento,
        'rolePlay.historia': CORPO,
        /* `ataques` NÃO se toca: o Alvo e o dado continuam os mesmos, e o
           espaçamento é o padrão que as outras 35 fichas usam. */
        'criatura.nivelAmeaca': am.replace('do bestiário do cofre, traduzida para a régua v3',
            'guardião do espaço: come Abismo e fecha a fenda que o deixou entrar'),
    }, nota: 'dieta, comportamento, folclore, rito e corpo reescritos' });
}

/* ─── 4. o capítulo 12: o Espectro deixa de ser "só da mata grande" ─── */
const c12 = cap('A Mata Fechada');
let html12 = null, words12 = 0;
if (!c12) erros.push('capítulo "A Mata Fechada" não achado');
else {
    const atual = String(c12.data().contentHTML || '');
    const de = 'Três das quatro criaturas deste capítulo vivem nas duas matas; a quarta, o <strong>Espectro da Seiva Negra</strong>, é da mata grande e só dela.';
    const para = 'As quatro criaturas deste capítulo vivem nas duas matas, e cada uma cobra um erro diferente.';
    if (!atual.includes(de)) erros.push('cap. 12: a frase do Espectro não bate com o que gravei');
    else {
        html12 = atual.replace(de, para);
        words12 = html12.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }
}

/* ─── 5. o parágrafo do Azire em "Predadores de Vasteluna" ─── */
const c5 = cap('Predadores de Vasteluna');
let html5 = null, words5 = 0;
if (!c5) erros.push('capítulo "Predadores de Vasteluna" não achado');
else if (az) {
    const atual = String(c5.data().contentHTML || '');
    const amAz = String(az.criatura?.nivelAmeaca || '');
    const forca = (/(\d+,\d+)×/.exec(amAz) || [])[1];
    const vit = br(Number(az.valoresDer?.VIT || 0), 1);
    const parAntigo = /<p><strong>Avarbus Azire<\/strong>[\s\S]*?<\/p>/;
    if (!parAntigo.test(atual)) erros.push('cap. 5: não achei o parágrafo do Azire para reescrever');
    else {
        const novo = `<p><strong>Avarbus Azire</strong> — o mesmo corpo com <strong>azire</strong> nos olhos (~${forca} guerreiro, Vitalidade ${vit}), e a fome trocada. `
            + `No cenário, o que tem Azire no nome é <strong>dourado</strong> e carrega Essência Índigo e Âmbar-Incandescente; este aqui <strong>come Abismo</strong>. `
            + `Fenda, ruptura, resíduo — e a ruína onde ele está <em>apaga</em> em vez de acender. É o avesso do irmão: o Avarbus vai onde morreu muita gente, o Azire vai onde o tecido rasgou. `
            + `Chamam-nos <strong>guardiões do espaço</strong>, e a palavra é justa: o Abismo entra por uma ferida, e o Azire fecha a ferida comendo o que sai dela. `
            + `A mordida continua da linhagem — Necrose. Se perder o azire, desmaia: sobra um Avarbus. <strong>Domável</strong>, Redutor −3, e o chamariz não é comida, é buraco.</p>`;
        html5 = atual.replace(parAntigo, novo);
        words5 = html5.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }
}

/* ─── conta do rider: o Azire passa a pagar Necrose ─── */
let contaAzire = null;
if (az) {
    const linha = (String(az.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '');
    const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(linha);
    if (g) {
        const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
        const med = (+g[2].split('d')[0]) * ((+g[2].split('d')[1]) + 1) / 2;
        const golpe = P * Math.max(1, med + (g[3] ? +g[3] : 0) - 2) / U;
        contaAzire = { P, golpe, necrose: (1 / U) * P, total: golpe + (1 / U) * P };
    }
}

/* ═══════════ relatório ═══════════ */
console.log('\n=== O Azire é guardião do espaço · o Espectro vai para as duas matas ===\n');
for (const p of patches) {
    console.log(`\n── ${p.nome}${p.nota ? `   [${p.nota}]` : ''}`);
    for (const [k, v] of Object.entries(p.campos)) {
        const antes = k.split('.').reduce((o, kk) => o?.[kk], p.antes);
        if (String(antes) === String(v)) { console.log(`   ${k}: (sem mudança)`); continue; }
        console.log(`   ${k}`);
        console.log(`      de:   ${JSON.stringify(String(antes || '').slice(0, 150))}`);
        console.log(`      para: ${JSON.stringify(String(v).slice(0, 150))}`);
    }
}

if (contaAzire) {
    console.log(`\n--- o Azire agora paga a Necrose que carrega ---`);
    console.log(`   golpe ${br(contaAzire.golpe)}×  +  Necrose 1 pesada por P ${br(contaAzire.P)} = ${br(contaAzire.necrose)}×   →   ${br(contaAzire.total)}×`);
    console.log(`   Continua na faixa Séria (0,75–1,5). É a única criatura do banco que carrega Necrose, e é a que pode pagar.`);
}

console.log('\n--- capítulos ---');
if (html12) console.log(`   12. A Mata Fechada          ${c12.data().words} → ${words12} palavras (o Espectro deixa de ser "só da mata grande")`);
if (html5) {
    console.log(`   5.  Predadores de Vasteluna ${c5.data().words} → ${words5} palavras (public=true; o parágrafo do Azire é reescrito)\n`);
    console.log((html5.match(/<p><strong>Avarbus Azire<\/strong>[\s\S]*?<\/p>/) || [''])[0]
        .replace(/<[^>]+>/g, '').replace(/(.{95}\S*)\s/g, '$1\n      ').split('\n').map(s => '      ' + s.trim()).join('\n'));
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of patches) batch.update(p.ref, { ...p.campos, lastUpdate: iso, lastUpdateBy: AUTOR });
if (html12) batch.update(c12.ref, { contentHTML: html12, words: words12, updatedAt: iso, updatedBy: AUTOR });
if (html5) batch.update(c5.ref, { contentHTML: html5, words: words5, updatedAt: iso, updatedBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${patches.length} fichas e 2 capítulos atualizados.`);
process.exit(0);
