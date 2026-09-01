/**
 * Conserta a cosmologia adulterada, e fecha as três afinidades do Azire.
 *
 * ── 1. "tecido do Soberano" NÃO EXISTE ──────────────────────────────
 * O capítulo "Abismancia" (`art_ms3gb8uftgqztr`, livro `book_ms3gb8sua583cb`,
 * PÚBLICO) dizia:
 *
 *     "Onde o tecido do Soberano afina, a Abissência pinga"
 *
 * Está errado, e o próprio capítulo se contradiz duas linhas abaixo. A
 * mitologia dele diz, com todas as letras, que quem rompe é o ESPAÇO:
 *
 *     "Assim nasceu o Espaço: (…) um corpo condenado a crescer e
 *      romper-se enquanto se expande"
 *     "Espaço, o que está em todo lugar e, por isso, se rompe para
 *      nos comportar"
 *
 * O tecido é UM e chama-se **tecido do espaço**. Corrigido.
 *
 * ⚠️ "Universo Soberano" NÃO se toca — é canône legítimo, o nome do berço de
 * oito véus que Tempo e Espaço teceram, e aparece em outras duas frases do
 * mesmo capítulo. "Aspecto Soberano do Abismo", do Gorren-Nhar, idem. A
 * varredura do banco inteiro achou UMA ocorrência ruim e só ela é tocada.
 *
 * ── 2. Todo Azire: Luz + Espacial + Âmbar ───────────────────────────
 * Eu tinha lido errado. A afinidade com Luz que o cofre declara não foi
 * superada por nada: são TRÊS Essências ao mesmo tempo, e as três explicam
 * o ofício dele:
 *
 *     Amarela (Luz)            é o que limpa o abissal — o próprio catálogo
 *                              de condições diz que só a Luz remove Corrompido
 *     Índigo (Espaço)          é o tecido que ele remenda
 *     Âmbar-Incandescente      é a força para fazê-lo; "Áureo" é o nome do
 *       (Poder)                canal, e é literalmente o dourado dele
 *
 *   node functions/conserta-tecido-do-espaco.mjs            (dry-run)
 *   node functions/conserta-tecido-do-espaco.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const erros = [];
const patches = [];

/* ─── 1. a frase adulterada ─── */
const RUIM = 'tecido do Soberano';
const BOM = 'tecido do espaço';

/* varre TUDO de novo na hora de gravar — se apareceu em outro lugar, aparece aqui */
const COLS = ['npcs', 'worldbuilding-articles', 'worldbuilding-geography', 'items',
    'system/data/equipment', 'system/data/conditions', 'system/data/mechanics',
    'system/data/skills', 'system/data/peculiarities', 'system/data/derivedValues',
    'system/data/spells', 'system/data/maneuvers', 'system/data/classModules',
    'system/data/races', 'system/data/tribes', 'system/data/knowledge'];
const achados = [];
for (const col of COLS) {
    let docs; try { docs = (await db.collection(col).get()).docs; } catch { continue; }
    for (const d of docs) {
        const raw = JSON.stringify(d.data());
        if (!new RegExp(RUIM, 'i').test(raw)) continue;
        achados.push({ col, id: d.id, ref: d.ref, nome: d.data().nome || d.data().title || d.id, data: d.data() });
    }
}
if (!achados.length) erros.push(`"${RUIM}" não foi achado em lugar nenhum — já foi corrigido?`);

for (const a of achados) {
    /* só o campo contentHTML é texto de livro; se aparecer noutro campo, aborta e avisa */
    const html = String(a.data.contentHTML || '');
    if (!html.includes(RUIM)) {
        erros.push(`[${a.col}] "${a.nome}": "${RUIM}" está fora de contentHTML — não mexo às cegas, confira à mão`);
        continue;
    }
    const antes = html;
    const depois = html.split(RUIM).join(BOM);
    /* trava: "Universo Soberano" e "aspecto Soberano" têm de sobreviver intactos */
    const contaAntes = (antes.match(/Universo Soberano/g) || []).length;
    const contaDepois = (depois.match(/Universo Soberano/g) || []).length;
    if (contaAntes !== contaDepois) erros.push(`[${a.col}] "${a.nome}": a troca mexeu em "Universo Soberano" — abortado`);
    patches.push({ tipo: 'livro', ...a, antes, depois,
        trecho: (/.{110}tecido do Soberano.{110}/i.exec(antes.replace(/<[^>]+>/g, ' ')) || [''])[0],
        trechoNovo: (/.{110}tecido do espaço.{110}/i.exec(depois.replace(/<[^>]+>/g, ' ')) || [''])[0] });
}

/* ─── 2. as três afinidades do Azire ─── */
const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const az = npcs.find(n => n.nome === 'Avarbus Azire');
if (!az) erros.push('"Avarbus Azire" não achado');
else {
    const CORPO = 'Dourado. É a primeira coisa que se nota e é a que dá o nome: no cenário, o que carrega Azire é dourado, e '
        + 'todo Azire tem forte afinidade com TRÊS Essências ao mesmo tempo — Amarela (Luz), Índigo (Espaço) e Âmbar-Incandescente (Poder). '
        + 'As três explicam o ofício: a Luz é o que limpa o abissal, o Espaço é o tecido que ele remenda, e o Âmbar é a força para fazê-lo. '
        + 'O corpo é Avarbus — fibra rígida, dorso inteiro em espinho, mandíbula que dilacera, a linhagem necrótica do irmão. '
        + 'O Azire é o que cavalga esse corpo: pulsa nos olhos e muda a fome inteira. Por isso, perdendo o azire, ele desmaia — '
        + 'o que sobra é um Avarbus, e um Avarbus não sabe o que fazer com uma fenda.';

    const INTERACAO = 'Come Abismo. Fenda, ruptura, resíduo abissal: é disso que ele vive, e é por isso que a ruína onde ele está apaga em vez de acender. '
        + 'O Devorador de Trevas é o ofício em si — toque de Luz que anula a fonte de trevas e devolve a ele o que gastou. '
        + 'A mordida ainda é da linhagem: Necrose 1, e a carne que ela mata não volta enquanto ele estiver de pé. '
        + 'O dorso espinhaço é reação, não ataque — quem bate nele de perto se fere nos espinhos. A Repulsão Azire empurra até cinco metros e anula o golpe corpo a corpo que a disparou.';

    const comp = String(az.criatura?.comportamento || '');
    const linhas = comp.split('\n');
    linhas[0] = INTERACAO;
    const iRem = linhas.findIndex(l => l.startsWith('O REMÉDIO:'));
    if (iRem < 0) erros.push('"Avarbus Azire": não achei a linha O REMÉDIO no comportamento');
    else linhas[iRem] = 'O REMÉDIO: Fechar a fenda antes dele chegar funciona, e é caro. Levar luz sagrada para expulsá-lo é o pior conselho que existe: '
        + 'Luz é uma das três Essências dele, e ele é imune a dano de Luz. A tocha benta não o afasta um passo — só mostra onde você está.';

    patches.push({ tipo: 'ficha', nome: az.nome, ref: db.collection('npcs').doc(az.id),
        campos: { 'rolePlay.historia': CORPO, 'criatura.comportamento': linhas.join('\n') },
        antesHist: az.rolePlay?.historia, antesComp: comp });
}

/* ─── 3. o parágrafo do Azire em "Predadores de Vasteluna" ─── */
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', 'book_mrs9ur4aw1m6a').get()).docs;
const c5 = arts.find(d => (d.data().title || '') === 'Predadores de Vasteluna');
if (!c5) erros.push('capítulo "Predadores de Vasteluna" não achado');
else {
    const atual = String(c5.data().contentHTML || '');
    const de = 'No cenário, o que tem Azire no nome é <strong>dourado</strong> e carrega Essência Índigo e Âmbar-Incandescente;';
    const para = 'No cenário, o que tem Azire no nome é <strong>dourado</strong>, e todo Azire tem forte afinidade com três Essências ao mesmo tempo — <strong>Amarela (Luz)</strong>, <strong>Índigo (Espaço)</strong> e <strong>Âmbar-Incandescente (Poder)</strong>. Este aqui';
    if (!atual.includes(de)) erros.push('cap. 5: a frase das essências do Azire não bate com o que gravei');
    else {
        /* o `para` termina em "Este aqui" e o texto original segue com " este
           aqui …" — a colagem duplica, e a frase agora começa depois de um
           ponto, então a maiúscula é a que vale. */
        const limpo = atual.replace(de, para).replace(/Este aqui\s+este aqui/g, 'Este aqui');
        patches.push({ tipo: 'livro', col: 'worldbuilding-articles', nome: 'Predadores de Vasteluna',
            ref: c5.ref, antes: atual, depois: limpo,
            trecho: '(parágrafo do Azire)', trechoNovo: (/<p><strong>Avarbus Azire<\/strong>[\s\S]*?<\/p>/.exec(limpo) || [''])[0].replace(/<[^>]+>/g, '') });
    }
}

/* ═══════════ relatório ═══════════ */
console.log('\n=== 1. A cosmologia adulterada ===\n');
console.log(`   varridas ${COLS.length} coleções atrás de "${RUIM}"`);
console.log(`   ocorrências: ${achados.length}${achados.length ? ' → ' + achados.map(a => `[${a.col}] ${a.nome}`).join(', ') : ''}`);
for (const p of patches.filter(p => p.tipo === 'livro' && p.trecho !== '(parágrafo do Azire)')) {
    console.log(`\n   de:   …${p.trecho.replace(/\s+/g, ' ')}…`);
    console.log(`   para: …${p.trechoNovo.replace(/\s+/g, ' ')}…`);
}
console.log(`\n   "Universo Soberano" e "aspecto Soberano": INTOCADOS (há trava no script).`);

console.log('\n\n=== 2. As três Essências do Azire ===\n');
const pf = patches.find(p => p.tipo === 'ficha');
if (pf) {
    console.log('   rolePlay.historia');
    console.log(`      de:   ${String(pf.antesHist).slice(0, 140)}…`);
    console.log(`      para: ${String(pf.campos['rolePlay.historia']).slice(0, 140)}…`);
    const remAntes = String(pf.antesComp).split('\n').find(l => l.startsWith('O REMÉDIO:')) || '';
    const remDepois = String(pf.campos['criatura.comportamento']).split('\n').find(l => l.startsWith('O REMÉDIO:')) || '';
    console.log('\n   O REMÉDIO');
    console.log(`      de:   ${remAntes}`);
    console.log(`      para: ${remDepois}`);
}

console.log('\n\n=== 3. O parágrafo no Bestiário ===\n');
const pc = patches.find(p => p.trecho === '(parágrafo do Azire)');
if (pc) console.log(pc.trechoNovo.replace(/(.{95}\S*)\s/g, '$1\n   ').split('\n').map(s => '   ' + s.trim()).join('\n'));

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of patches) {
    if (p.tipo === 'ficha') batch.update(p.ref, { ...p.campos, lastUpdate: iso, lastUpdateBy: AUTOR });
    else batch.update(p.ref, {
        contentHTML: p.depois,
        words: p.depois.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        updatedAt: iso, updatedBy: AUTOR });
}
await batch.commit();
console.log(`\n✅ ${patches.length} documentos corrigidos.`);
process.exit(0);
