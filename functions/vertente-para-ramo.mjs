/**
 * "vertente" → "ramo" no BANCO DE REGRAS da Totemancia.
 *
 * O Compêndio já foi reestruturado (functions/compendio-tres-ramos.mjs) e fala
 * em RAMO. As Peculiaridades, os VDs e as mecânicas ainda falavam em vertente,
 * e o jogador vê os dois vocabulários na mesma tela.
 *
 * Escopo: só os 10 documentos da Totemancia. FICAM DE FORA de propósito:
 *   · peculiarities/mWunLe957F7B43ecLjo2 (Alquimancia) — "vertente ofensiva /
 *     defensiva" é a palavra comum, não o termo da Totemancia.
 *   · worldbuilding-articles/art-classes-futuras — livro de ideias, e as
 *     "vertentes da Forjarcanomancia" são outra escola.
 *
 * Verificado antes de rodar: nenhuma fórmula, ficha de PC ou NPC referencia
 * essas mecânicas POR NOME, e nada no front filtra pela tag "Vertente".
 * Renomear é seguro.
 *
 * Cada troca é literal e traz a concordância junto (a vertente → o ramo).
 * Aborta se sobrar "vertente" em qualquer doc tocado.
 *
 *   node functions/vertente-para-ramo.mjs            (dry-run)
 *   node functions/vertente-para-ramo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ALVOS = [
    ['peculiarities', 'VmfuETVZhYVrZXUrlNdf', [
        ['A vertente do Xamã que pesca', 'O ramo do Xamã que pesca'],
        ['O nível desta vertente é o teto', 'O nível deste ramo é o teto'],
        ['Vertente', 'Ramo'],
    ]],
    ['peculiarities', 'xhv1hEiSuC3ciao1oUIx', [
        ['A vertente do Xamã que pesca', 'O ramo do Xamã que pesca'],
        ['O nível desta vertente é o teto', 'O nível deste ramo é o teto'],
        ['Vertente', 'Ramo'],
    ]],
    ['peculiarities', 'ekws3sw5gzCvu6Th6Edo', [
        ['QUANTAS vertentes o Xamã pratica', 'QUANTOS ramos o Xamã pratica'],
        ['Nv 1 — uma vertente, escolhida na criação', 'Nv 1 — um ramo, escolhido na criação'],
        ['Nv 2 — o Xamã pode tomar a segunda vertente.', 'Nv 2 — o Xamã pode tomar o segundo ramo.'],
        ['a Peculiaridade da própria vertente (1–5)', 'a Peculiaridade do próprio ramo (1–5)'],
    ]],
    ['classModules', 'mod_vodu', [
        ['Vertente mínima (Voduísmo):', 'Ramo mínimo (Voduísmo):'],
    ]],
    ['mechanics', 'I0uTqeMJAiXnl4ubrylt', [
        ['Totemancia Xamânica — vertentes praticadas', 'Totemancia Xamânica — ramos praticados'],
        ['Nv 1 destrava uma vertente (escolhida no pool', 'Nv 1 destrava um ramo (escolhido no pool'],
        ['(Nv1 1 vertente · Nv2 as duas)', '(Nv1 1 ramo · Nv2 os dois)'],
    ]],
    ['mechanics', 'YaZUWUVjIUlmc4dp2JWh', [
        ['Espiritismo — nível da vertente', 'Espiritismo — nível do ramo'],
        ['Vertente', 'Ramo'],
    ]],
    ['mechanics', 'fJLPLXy4Ak5swsWN0hTX', [
        ['Voduísmo — nível da vertente', 'Voduísmo — nível do ramo'],
        ['Vertente', 'Ramo'],
    ]],
    ['derivedValues', '2DBxgQG87jJXXt3AXLPA', [
        ['Quantas vertentes da Totemancia o Xamã pratica.', 'Quantos ramos da Totemancia o Xamã pratica.'],
        ['1 = uma vertente · 2 = as duas.', '1 = um ramo · 2 = os dois.'],
        ['Não é o poder das vertentes —', 'Não é o poder dos ramos —'],
    ]],
    ['derivedValues', 'bsshCP73Z7zAfqDU6Dql', [
        ['Nível da vertente Voduísmo', 'Nível do ramo Voduísmo'],
        ['habilidades desta vertente: vertente Voduísmo 3', 'habilidades deste ramo: ramo Voduísmo 3'],
    ]],
    ['derivedValues', 'oq3I5JuNixxUjShhXqS0', [
        ['Nível da vertente Espiritismo', 'Nível do ramo Espiritismo'],
        ['habilidades desta vertente: vertente Espiritismo 3', 'habilidades deste ramo: ramo Espiritismo 3'],
    ]],
];

// aplica as trocas em toda string do documento, em qualquer profundidade
const mapear = (o, pares) => {
    if (typeof o === 'string') return pares.reduce((s, [de, para]) => s.split(de).join(para), o);
    if (Array.isArray(o)) return o.map(v => mapear(v, pares));
    if (o && typeof o === 'object' && o.constructor === Object) {
        const r = {}; for (const k of Object.keys(o)) r[k] = mapear(o[k], pares); return r;
    }
    return o;   // Timestamp e afins passam intactos
};

console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
let mudados = 0, sobras = 0;
const gravar = [];
for (const [c, id, pares] of ALVOS) {
    const ref = db.collection('system').doc('data').collection(c).doc(id);
    const antes = (await ref.get()).data();
    if (!antes) { console.error(`ABORTA: ${c}/${id} nao existe`); process.exit(1); }
    const depois = mapear(antes, pares);
    const jA = JSON.stringify(antes), jD = JSON.stringify(depois);
    console.log(`${c}/${id} · "${depois.nome || depois.titulo}"`);
    for (const [de, para] of pares) {
        const n = jA.split(de).length - 1;
        if (!n) { console.error(`  ABORTA: nao achei ${JSON.stringify(de)}`); process.exit(1); }
        console.log(`  ${n}x  ${de}  →  ${para}`);
    }
    if (/vertente/i.test(jD)) {
        sobras++;
        console.error(`  !! ainda sobrou "vertente": ${jD.match(/.{0,70}vertente.{0,70}/i)[0]}`);
    }
    if (jA !== jD) { mudados++; gravar.push([ref, depois]); }
}
console.log(`\n${mudados} documentos mudam` + (sobras ? `, ${sobras} com sobra` : ', nenhuma sobra'));
if (sobras) process.exit(1);
if (!APPLY) { console.log('rode com --apply'); process.exit(0); }
for (const [ref, doc] of gravar) { await ref.set(doc); console.log(`OK ${ref.path}`); }
process.exit(0);
