/**
 * Peçonha, o conserto do Fantoche, e a retirada do "Veneno" que eu errei.
 *
 * ── 1. O QUE EU TINHA ERRADO ────────────────────────────────────────
 * Criei uma condição "Veneno" sem saber que o sistema JÁ tinha o eixo do
 * veneno, e que ele não é condição — é PROPRIEDADE ALQUÍMICA:
 *
 *   Toxis P    1 de dano por rodada, durante 2P rodadas (no máx. a cena)
 *   Caltra P   remove P níveis de condição ou de veneno
 *
 * (Livro `book_ms3gb8iq5q9k0i`, "As Oito da Bancada"; régua em
 *  `book-regua-balanceamento` §8. A "Loção de Veneno Simples I" aplica
 *  Toxis 2 e vale 1,16 un — 0,58 un por ponto de Toxis.)
 *
 * Com Toxis existindo, "Veneno" virou uma terceira coisa sobreposta que não
 * explicava nada. Ela é APAGADA aqui — foi criada nesta mesma sessão, não
 * chegou a nenhuma mesa, e o script confere que ninguém aponta para ela
 * antes de apagar.
 *
 * ── 2. PEÇONHA — a regra que o usuário fixou (31/08/2026) ────────────
 *   Peçonha N ≡ Toxis 2N          cada nível vale DOIS pontos de Toxis
 *   cura SÓ com loção/poção de Caltra de nível igual ou maior
 *
 * É o degrau acima do que a bancada produz: o alquimista faz Toxis, a
 * criatura faz Peçonha, e a diferença é que a peçonha não passa sozinha.
 * O usuário pediu esta régua explicitamente porque vêm criaturas com
 * condições mais nocivas e mais difíceis de curar — Peçonha é o primeiro
 * degrau dessa escada, e a Serpente é a criatura que a estreia.
 *
 * ── 3. O FANTOCHE ───────────────────────────────────────────────────
 * Com a Necrose finalmente precificada, o Fantoche não cabe mais no
 * próprio orçamento. A conta, agora com o rider pesado pela chance de
 * acerto (um efeito só vale quando o golpe entra):
 *
 *     golpe            0,154×
 *     Necrose 1        0,256 un × P 0,40 = 0,102×
 *     total            0,256×   contra o alvo de projeto de 0,15×
 *
 * E não há dado que resolva: mesmo zerando o golpe no piso de dano 1, o
 * Fantoche fica em 0,205× — a Necrose sozinha já custa mais que o teto
 * dele. Isso importa porque o Adepto sustenta PRE + Servos de pé ao mesmo
 * tempo: sete Fantoches a 0,15× são 1,05×; a 0,26× são 1,79×, vindos de
 * uma habilidade só.
 *
 * Então a Necrose SAI da mordida e fica como prosa. O corpo continua
 * apodrecendo no texto — é o que ele é —, mas o Fantoche não tem força
 * para levar a podridão para dentro de quem ele toca. Quem leva é o
 * Avarbus Azire, que paga por ela.
 *
 *   node functions/condicoes-peconha-e-fantoche.mjs            (dry-run)
 *   node functions/condicoes-peconha-e-fantoche.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const CRIADOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const U = 3.90;
const TOXIS_UN = 0.58;                 // 1 ponto de Toxis = 0,58 un (Régua §8.2/§8.6)
const NECROSE_UN = 1 / U;              // 1 ponto de VIT Máxima = 0,256 un
const br = (x, c = 3) => x.toFixed(c).replace('.', ',');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const PECONHA = {
    nome: 'Peçonha', icone: '🐍', duracao: 'até a Caltra — não passa sozinha', removivel: true,
    acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true,
    descricao:
`O que a bancada não sabe fazer. A peçonha de bicho não é a loção do alquimista: é mais funda e não passa sozinha.

· **Peçonha N equivale a Toxis 2N** — cada nível vale **dois pontos** da propriedade alquímica;
· logo: **1 de dano por rodada durante 4N rodadas**, no fim do turno do alvo;
· **acumula** — cada nova peçonha soma níveis, até **5**;
· **não estanca, não apaga, e NÃO acaba com o fim da cena**, diferente do Toxis;
· sai **só** com loção ou poção de **Caltra de nível igual ou maior** ao da Peçonha. Caltra remove P níveis, então Caltra 2 limpa uma Peçonha 2 — ou duas Peçonhas 1.

Nem Herbalismo, nem descanso, nem cura comum tiram: é preciso o frasco certo. Quem entra em mata de bicho peçonhento sem Caltra na mochila fez uma escolha, e a escolha vai cobrar.

**Preço:** ${br(TOXIS_UN * 2)} un por nível (2 × ${br(TOXIS_UN, 2)}, a taxa do Toxis na Régua §8.6). O travamento da cura em item é degrau acima e **ainda não está precificado** — é o que esta condição cobra a mais e o que a próxima revisão da Régua tem de olhar.

**O lugar dela na escada do veneno:** o **Toxis** é o que o alquimista macera e passa com o fim da cena. A **Peçonha** é o que o bicho carrega, vale o dobro por nível e exige o antídoto certo. É o primeiro degrau da escada das condições que não se resolvem com tempo.`,
};

const grab = async c => (await db.collection(c).get()).docs;
const [condDocs, npcDocs] = await Promise.all([grab('system/data/conditions'), grab('npcs')]);
const erros = [], avisos = [];

/* ── conferências ── */
if (condDocs.some(d => norm(d.data().nome) === norm('Peçonha')))
    erros.push('condição "Peçonha" já existe — este script criaria duplicata');
const venenoDoc = condDocs.find(d => norm(d.data().nome) === 'veneno');
if (!venenoDoc) avisos.push('condição "Veneno" não achada — nada a apagar (já foi?)');

/* ninguém pode estar apontando para "Veneno" antes de apagá-la */
const refsVeneno = npcDocs.filter(d => /\bVeneno\s*\d/.test(String(d.data().ataques || '')))
    .map(d => d.data().nome);
const soASerpente = refsVeneno.every(n => n === 'Serpente');
if (!soASerpente) erros.push(`"Veneno" está citada por fichas além da Serpente: ${refsVeneno.filter(n => n !== 'Serpente').join(', ')} — não apago com refs vivas`);

/* ── os dois patches de ficha ── */
const patches = [];

const fant = npcDocs.find(d => (d.data().nome || '') === 'Fantoche');
if (!fant) erros.push('"Fantoche" não achado');
else {
    const atq = String(fant.data().ataques || '');
    const alvoTxt = ' e Necrose 1 — a carne que ele toca apodrece';
    if (!atq.includes(alvoTxt)) erros.push(`"Fantoche": não achei "${alvoTxt.trim()}" em ataques — confira à mão:\n      ${atq}`);
    else patches.push({ ref: fant.ref, nome: 'Fantoche', doc: fant.data(),
        atqAntes: atq, atqDepois: atq.replace(alvoTxt, ''),
        riderAntes: { nome: 'Necrose 1', un: NECROSE_UN }, riderDepois: null,
        alvoDeDesign: 0.15, nota: 'a podridão vira prosa; a mecânica sai' });
}

const serp = npcDocs.find(d => (d.data().nome || '') === 'Serpente');
if (!serp) erros.push('"Serpente" não achada');
else {
    const atq = String(serp.data().ataques || '');
    const de = ' e Veneno 1 — a peçonha entra com a mordida';
    const para = ' e Peçonha 1 — Toxis 2, e só sai com Caltra 1';
    if (!atq.includes(de)) erros.push(`"Serpente": não achei "${de.trim()}" em ataques — confira à mão:\n      ${atq}`);
    else patches.push({ ref: serp.ref, nome: 'Serpente', doc: serp.data(),
        atqAntes: atq, atqDepois: atq.replace(de, para),
        riderAntes: { nome: 'Veneno 1', un: NECROSE_UN }, riderDepois: { nome: 'Peçonha 1', un: TOXIS_UN * 2 },
        alvoDeDesign: 0.35, nota: 'estreia a escada da Peçonha' });
}

/* ── a conta, com o rider pesado pela chance de acerto ── */
for (const p of patches) {
    const linha = (p.atqAntes.split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(linha);
    p.P = g ? Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9)) : 0;
    const liq = g ? Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) : 0;
    p.forcaGolpe = p.P * liq / U;
    p.antes = p.forcaGolpe + (p.riderAntes ? p.riderAntes.un * p.P : 0);
    p.depois = p.forcaGolpe + (p.riderDepois ? p.riderDepois.un * p.P : 0);
}

/* ── relatório ── */
console.log(`\n=== Peçonha, Fantoche e a retirada do Veneno ===\n`);
console.log(`══ ${PECONHA.icone}  ${PECONHA.nome}   (${PECONHA.duracao}, acumula até ${PECONHA.nivelMaximo})`);
console.log(PECONHA.descricao.split('\n').map(s => '   ' + s).join('\n'));

console.log('\n\n--- a escada do veneno, agora inteira ---');
console.log('   Toxis P     (propriedade de loção)  1 dano/rodada por 2P rodadas, acaba na cena     0,58 un/ponto');
console.log('   Peçonha N   (condição de criatura)  1 dano/rodada por 4N rodadas, NÃO acaba sozinha  1,16 un/nível');
console.log('   Caltra P    (propriedade de loção)  remove P níveis — é a única saída da Peçonha');

console.log('\n--- Veneno: apagada ---');
console.log(venenoDoc
    ? `   "Veneno" [${venenoDoc.id}] será apagada. Citada por: ${refsVeneno.length ? refsVeneno.join(', ') : '(ninguém)'} — e a Serpente troca para Peçonha no mesmo lote.`
    : '   (não existe mais)');

console.log('\n--- as duas fichas ---');
for (const p of patches) {
    console.log(`\n── ${p.nome}   [${p.nota}]`);
    console.log(`   de:   ${p.atqAntes.split('\n')[0]}`);
    console.log(`   para: ${p.atqDepois.split('\n')[0]}`);
}

console.log('\n--- o carimbo de força, com o rider pesado pela chance de acerto (P) ---');
console.log('ficha       P      golpe   rider antes      →  rider depois      antes   depois   alvo   veredito');
for (const p of patches) {
    const ra = p.riderAntes ? `${p.riderAntes.nome} (${br(p.riderAntes.un * p.P, 2)}×)` : '—';
    const rd = p.riderDepois ? `${p.riderDepois.nome} (${br(p.riderDepois.un * p.P, 2)}×)` : '—';
    const ok = p.depois <= p.alvoDeDesign * 1.12;
    console.log(`${p.nome.padEnd(11)} ${br(p.P, 2)}  ${(br(p.forcaGolpe, 2) + '×').padStart(6)}  ${ra.padEnd(17)}→  ${rd.padEnd(18)} ${(br(p.antes, 2) + '×').padStart(6)}  ${(br(p.depois, 2) + '×').padStart(6)}  ${(br(p.alvoDeDesign, 2) + '×').padStart(5)}   ${ok ? '✅ cabe' : '⚠ ESTOURA'}`);
}

const estoura = patches.filter(p => p.depois > p.alvoDeDesign * 1.12);
if (estoura.length) {
    console.log('\n⚠ NÃO recalibrei ficha de cânone sozinho. O que estoura, e por quê:');
    for (const p of estoura) console.log(
        `   ${p.nome}: ${br(p.depois, 2)}× contra alvo ${br(p.alvoDeDesign, 2)}× (+${br((p.depois / p.alvoDeDesign - 1) * 100, 0)}%).`);
    console.log(`
   No caso da Serpente isso é ESPERADO e é o ponto da regra que você fixou:
   peçonha é desproporcional ao tamanho do bicho — é exatamente para isso que
   ela existe. Mas duas coisas passam a valer, e você decide:
     · a Serpente sai do orçamento de companheiro do Druida (teto 0,6×);
     · o carimbo dela ainda diz Praga 0,19×, e não conta o rider.
   Se quiser fechar: ou o carimbo dela sobe para Comum e o Druida ganha uma
   fera acima do orçamento de propósito, ou a Peçonha da Serpente cai para um
   efeito de cena (fora de combate) e o combate fica só com o dado.`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
avisos.forEach(a => console.log(`\nℹ ${a}`));
console.log('\n✅ conferências OK.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const iso = new Date().toISOString();
const batch = db.batch();
batch.set(db.collection('system/data/conditions').doc(), {
    ...PECONHA, publicado: true, efeitoMecanicaIds: [], versao: 1,
    criadoPor: CRIADOR, criadoEm: agora, atualizadoEm: agora,
});
if (venenoDoc) batch.delete(venenoDoc.ref);
for (const p of patches) batch.update(p.ref, { ataques: p.atqDepois, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ Peçonha cadastrada, Veneno apagada, ${patches.length} fichas atualizadas.`);
process.exit(0);
