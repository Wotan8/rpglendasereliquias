/**
 * Redutor não tem sinal.
 *
 * Regra (Livro do Jogador, cap. 2): `Alvo = Atributo + Perícia + Bônus − Redutor`.
 * O Redutor JÁ é subtração — ele é a dificuldade. Escrever "Redutor −5" ou
 * "Redutor +2" põe sinal num número que não tem sinal, e o texto acabou com as
 * duas grafias em livros diferentes: a fera hostil aparecia como "Redutor −5" e
 * o Véu Astral como "Redutor +4", como se puxassem para lados opostos. Não
 * puxam: os dois são dificuldade, e mais é pior.
 *
 * Este script tira SÓ o sinal. Nenhum número muda de valor.
 *
 * FICAM DE FORA de propósito, porque ali o sinal é aritmética e não notação:
 *   · "redutor = 4 (PRS) + 2 (personalidade) + 3 (5 − 2) = 9" (Livro §9) — é a
 *     conta da soma do Redutor, e está certa.
 *   · "Redutor: −2 − tamanho da Fenda" vira "Redutor: 2 + tamanho da Fenda",
 *     porque o segundo termo SOMA dificuldade.
 *   · "Modificadores: +1 se sob sol direto; -1 se em sombra densa" (Pallomancia)
 *     — não diz se modifica o Alvo ou o Redutor. Deixado como está; ver o
 *     relatório no fim.
 *
 *   node functions/redutor-sem-sinal.mjs            (dry-run)
 *   node functions/redutor-sem-sinal.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/** [coleção|'artigo', id, [[de, para], …]] */
const PLANO = [
    ['artigo', '8aLc6aTVahCWswWdhngK', [
        ['Em Redutor −3 a\nhabilidade entrega um quarto; em −4', 'Em Redutor 3 a\nhabilidade entrega um quarto; em 4'],
    ]],
    ['artigo', 'AyBLgYEHof5F2ixhiy3x', [
        ['Redutor −5, e o vínculo exige Lealdade 10', 'Redutor 5, e o vínculo exige Lealdade 10'],
        ['Redutor −1, Lealdade 6', 'Redutor 1, Lealdade 6'],
    ]],
    ['artigo', 'art_ms3gb8kk81pgs2', [
        ['com o mesmo redutor <strong>e −3 por estar improvisando</strong>', 'com o mesmo redutor <strong>e mais 3 de Redutor por estar improvisando</strong>'],
    ]],
    ['artigo', 'art_ms3gb8qyw3pvwr', [
        ['Redutor: -2', 'Redutor: 2'],          // 3 ocorrências, todas iguais
    ]],
    ['artigo', 'art_ms3h0956wksi93', [
        ['reduz o Redutor de Proibidas (−1 Nv2 / −2 Nv3)', 'reduz o Redutor de Proibidas em 1 no Nv2 e em 2 no Nv3'],
    ]],
    ['classModules', 'TbRKh68m2hvr9KUVrOXb', [
        ['Redutor: −2 − tamanho da Fenda', 'Redutor: 2 + tamanho da Fenda'],   // antes das trocas simples
        ['Redutor: −2', 'Redutor: 2'],
        ['Redutor: −3', 'Redutor: 3'],
        ['Redutor: −4', 'Redutor: 4'],
    ]],
    ['classModules', 'mod_totem', [
        ['Véu Etérico (Redutor +2) ou Astral (Redutor +4)', 'Véu Etérico (Redutor 2) ou Astral (Redutor 4)'],
    ]],
    ['classModules', 'ritual_necro', [
        ['AUT 2 = Redutor -4', 'AUT 2 = Redutor 4'],
    ]],
];

const mapear = (o, pares) => {
    if (typeof o === 'string') return pares.reduce((s, [de, para]) => s.split(de).join(para), o);
    if (Array.isArray(o)) return o.map(v => mapear(v, pares));
    if (o && typeof o === 'object' && o.constructor === Object) {
        const r = {}; for (const k of Object.keys(o)) r[k] = mapear(o[k], pares); return r;
    }
    return o;
};

/** Quantas vezes `alvo` aparece nas strings deste documento. */
function contar(o, alvo) {
    if (typeof o === 'string') return o.split(alvo).length - 1;
    if (Array.isArray(o)) return o.reduce((t, v) => t + contar(v, alvo), 0);
    if (o && typeof o === 'object' && o.constructor === Object) {
        return Object.values(o).reduce((t, v) => t + contar(v, alvo), 0);
    }
    return 0;
}

console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
let trocas = 0;
const gravar = [];
for (const [onde, id, pares] of PLANO) {
    const ref = onde === 'artigo'
        ? db.collection('worldbuilding-articles').doc(id)
        : db.collection('system').doc('data').collection(onde).doc(id);
    const antes = (await ref.get()).data();
    if (!antes) { console.error(`ABORTA: ${onde}/${id} nao existe`); process.exit(1); }
    const jA = JSON.stringify(antes);
    console.log(`${onde}/${id} · "${antes.title || antes.titulo}"`);
    for (const [de, para] of pares) {
        // conta nas strings REAIS, não no JSON: uma das âncoras tem quebra de
        // linha, e no JSON ela vira \n literal e nunca casaria.
        const n = contar(antes, de);
        if (!n) { console.error(`  ABORTA: nao achei ${JSON.stringify(de)}`); process.exit(1); }
        trocas += n;
        console.log(`  ${n}x  ${JSON.stringify(de)}  →  ${JSON.stringify(para)}`);
    }
    const depois = mapear(antes, pares);
    if (jA !== JSON.stringify(depois)) gravar.push([ref, depois]);
}

// nenhum "Redutor <sinal><número>" pode sobrar nos docs tocados
const RE = /Redutor[^.\n]{0,10}?[−\-+]\s?\d/gi;
let sobras = 0;
for (const [ref, doc] of gravar) {
    for (const m of JSON.stringify(doc).matchAll(RE)) { sobras++; console.log(`  !! sobrou em ${ref.id}: ${m[0]}`); }
}
console.log(`\n${trocas} trocas em ${gravar.length} documentos` + (sobras ? ` · ${sobras} SOBRA(S)` : ' · nenhuma sobra'));
if (sobras) process.exit(1);
if (!APPLY) { console.log('rode com --apply'); process.exit(0); }
for (const [ref, doc] of gravar) { await ref.set(doc); console.log(`OK ${ref.path}`); }
process.exit(0);
