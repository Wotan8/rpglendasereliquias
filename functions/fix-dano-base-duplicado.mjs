/**
 * O Dano tinha o MESMO bug do Acerto — e mais um em cima.
 *
 * BUG 1 — dobra: o VD `Dano` carregava a mecânica `+[FOR]`, e 54 das 62 equações
 * de item terminam com `+ FOR`. Como o total por item é
 * `base global + delta do item` (item-scope-calc.js:78), a Força entrava duas
 * vezes: 2×FOR + Qualidade + Afiação.
 *
 * BUG 2 — a Força vazava para onde ela NÃO deve ir: 8 itens (as 7 bestas e a
 * Funda) foram escritos de propósito SEM FOR, com bônus fixo +2/+3/+5, porque a
 * potência deles é do mecanismo, não do braço de quem atira. A base somava FOR
 * neles assim mesmo. A Besta Pesada mostrava 1d10 + FOR + 5 onde o cadastro
 * pedia 1d10+5.
 *
 * Os dois saem com a mesma correção, e é a simétrica da que o Acerto recebeu:
 * a Força não pertence à base, porque QUEM a usa depende da arma. Ela fica na
 * Equação de Valor de cada item, e o VD `Dano` volta a ser o que já é usado
 * como: o balde de modificador GENÉRICO. Prova de que esse é o papel dele —
 * duas mecânicas raciais já escrevem lá:
 *     Uqatá — Fúria que Fere ....... Dano + Perícia: Ímpeto
 *     Muraté — Braço de Escudo ..... Dano −2
 *
 * NÃO propaga o Dano para os canais de Essência, e isso é de propósito.
 * Ver a nota ao fim do arquivo.
 *
 *   node functions/fix-dano-base-duplicado.mjs            (dry-run)
 *   node functions/fix-dano-base-duplicado.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const VD_DANO = 'JYISs9MKSNeQ9MdJzkyT';
const MEC_BASE = 'vFmVYYo9jxFLCvfFi5do';

const DESC_NOVA =
    'Modificador GENÉRICO de dano, somado à Fórmula de Dano de toda arma equipada '
    + '(ex: 1d10 + 5 = "1d10+5"). A BASE aqui é 0 — a Força NÃO entra aqui, porque nem toda '
    + 'arma usa Força: um machado usa, uma besta não (a potência dela é do mecanismo). '
    + 'O atributo de cada arma sai da Equação de Valor montada no próprio item, no cadastro '
    + 'de Equipamentos, junto da Qualidade e da Afiação. Aqui entram só peculiaridade, '
    + 'condição, classe, raça e postura. O dado (1d10) vem do campo "Fórmula de Dano" do '
    + 'Equipamento. O total de cada arma aparece na aba Combate.';

const LIVRO_DE = 'Cada arma tem sua fórmula de dado (Capítulo 5); o Dano do personagem tem base FOR; e a própria arma pode somar bônus';
const LIVRO_PARA = 'Cada arma tem sua fórmula de dado (Capítulo 5) e diz sozinha qual atributo soma no dano — machado e espada somam FOR, besta e funda não somam nada além do próprio mecanismo. A arma ainda soma a Qualidade dela';

const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');

const [vdSnap, mecSnap, eqSnap, vdsSnap] = await Promise.all([
    colVD.doc(VD_DANO).get(), colMec.doc(MEC_BASE).get(),
    db.collection('system/data/equipment').get(), colVD.get(),
]);

const erros = [];
if (!vdSnap.exists) erros.push(`VD Dano (${VD_DANO}) não encontrado`);
if (!mecSnap.exists) erros.push(`mecânica Dano (base) (${MEC_BASE}) não encontrada`);
const vd = vdSnap.data() || {}, mec = mecSnap.data() || {};
if (vd.nome !== 'Dano') erros.push(`o VD ${VD_DANO} se chama "${vd.nome}", esperado "Dano"`);
if (!(vd.mecanicaIds || []).includes(MEC_BASE)) erros.push('o VD Dano não aponta para a mecânica base — já corrigido?');

/* A mecânica só pode estar presa a este VD. */
for (const c of ['derivedValues', 'skills', 'peculiarities', 'races', 'classes', 'conditions', 'equipment', 'classModules']) {
    let s; try { s = await db.collection(`system/data/${c}`).get(); } catch (e) { continue; }
    for (const d of s.docs) {
        if (d.id === VD_DANO) continue;
        if (JSON.stringify(d.data()).includes(MEC_BASE)) erros.push(`mecânica usada também por ${c}/${d.data().nome || d.id}`);
    }
}

/* Contagem: quem some FOR e quem não. */
let comFOR = 0, semFOR = 0; const bestas = [];
for (const d of eqSnap.docs) {
    const v = (d.data().valoresDerivadosVinculados || []).find(x => x.id === VD_DANO && Array.isArray(x.equacao));
    if (!v) continue;
    if (v.equacao.some(t => t.ref === 'FOR')) comFOR++;
    else { semFOR++; bestas.push(d.data().nome); }
}

/* Canais de Essência: confirmar que ficam de fora. */
const canais = vdsSnap.docs.map(d => d.data()).filter(v => v.escopoItem === 'dano-canal');

const refLivro = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
let html = (await refLivro.get()).data().contentHTML || '';
if (!html.includes(LIVRO_DE)) erros.push('Livro §6.5: trecho do Dano não encontrado');

console.log('='.repeat(74));
console.log('BUG: Dano contado duas vezes, e Força vazando para as bestas');
console.log('='.repeat(74));
console.log(`\nMecânica ..... ${mec.nome} — ${mec.previewTexto}`);
console.log(`\nBUG 1 (dobra) ..... ${comFOR} armas somam "+ FOR" na equação E recebiam FOR da base`);
console.log(`                    total ficava 2×FOR + Qualidade + Afiação`);
console.log(`BUG 2 (vazamento) . ${semFOR} itens escritos de propósito SEM FOR recebiam FOR mesmo assim:`);
console.log(`                    ${bestas.join(', ')}`);
console.log(`                    ex: Besta Pesada mostrava 1d10 + FOR + 5; o cadastro pede 1d10+5`);
console.log(`\nCORREÇÃO: a mecânica sai do VD e é aposentada. A Força fica na equação de`);
console.log(`cada arma, que é quem sabe se ela se aplica. O VD Dano volta a ser o balde`);
console.log(`genérico — papel que Uqatá e Muraté já usam.`);
console.log(`\nLIVRO §6.5: a frase "o Dano do personagem tem base FOR" é reescrita.`);
console.log(`\nCANAIS DE ESSÊNCIA (${canais.length}): NÃO recebem mecânica. Ver a nota no rodapé do script.`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (comFOR !== 54) erros.push(`esperava 54 armas com FOR, achei ${comFOR}`);
if (semFOR !== 8) erros.push(`esperava 8 itens sem FOR, achei ${semFOR}`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ auto-verificação: mecânica presa só ao VD Dano; 54 com FOR e 8 sem, como esperado.');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
html = html.split(LIVRO_DE).join(LIVRO_PARA);
const batch = db.batch();
batch.update(colVD.doc(VD_DANO), {
    mecanicaIds: (vd.mecanicaIds || []).filter(id => id !== MEC_BASE),
    descricao: DESC_NOVA, updatedAt: agora, atualizadoEm: agora,
});
batch.update(colMec.doc(MEC_BASE), {
    publicado: false,
    nome: 'Dano (base) — APOSENTADA: dobrava a Força e a vazava para bestas, que não usam Força',
    previewTexto: 'aposentada',
    config: { calculos: [] },
    atualizadoEm: agora,
});
batch.update(refLivro, {
    contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
await batch.commit();
console.log('\n✅ Gravado: Dano voltou a ser base 0; mecânica aposentada; Livro §6.5 corrigido.');
process.exit(0);

/* ============================================================================
 * POR QUE OS CANAIS DE ESSÊNCIA NÃO HERDAM O DANO
 *
 * O paralelo com o Acerto quebra aqui, e quebra feio:
 *
 *   Acerto tipado = tipo de entrega. Todo golpe tem EXATAMENTE UM. Descer o
 *                   genérico para eles aplica o modificador uma vez. Correto.
 *
 *   Dano tipado   = canal de Essência. Um golpe carrega ZERO ou VÁRIOS, e o
 *                   Livro §6.5 manda cada parcela subtrair a Blindagem Arcana
 *                   SEPARADAMENTE.
 *
 * Se os 14 canais herdassem o Dano genérico:
 *
 *   1. Uma lâmina com Necrótico + Ígneo somaria o modificador nas duas parcelas
 *      MAIS na física — três vezes. Quanto mais Essências, mais multiplicação.
 *      O §6.5 assume o contrário: repartir em Essências pequenas é MAIS FRACO,
 *      porque cada pedaço enfrenta a Blindagem Arcana inteira.
 *   2. item-scope-calc.js:90 descarta canal com total 0. Com base herdada, todo
 *      canal ficaria diferente de zero e as 14 Essências apareceriam em TODA
 *      arma de TODO personagem.
 *   3. Um bônus de "+2 de dano" viraria +2 físico +2 necrótico +2 ígneo ... —
 *      dano elemental que nenhuma Blindagem física barra.
 *
 * A Essência é um eixo ortogonal ao personagem: ela vem da arma ou da magia,
 * não do braço. Por isso os 14 canais ficam sem mecânica, com base 0, e só
 * ganham valor pela Equação de Valor do item que os carrega.
 * ========================================================================== */
