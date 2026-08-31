/**
 * Bestiário — Altura, Vitalidade e nomes próprios.
 *
 * A VITALIDADE. `Tamanho = Altura × 3` e `Vitalidade = (VIG + Tamanho) × 3` são
 * automáticos. O que travava era outra coisa: `valoresDer.overrides` VENCE o
 * valor calculado (npc-calc-engine.js:964), e as fichas antigas têm a Vitalidade
 * digitada à mão. Pior: ao abrir uma delas no Painel, normalizeNpc migra o
 * número do topo PARA DENTRO de overrides — o chute vira override permanente.
 *
 * Então cada ficha leva quatro coisas:
 *   · overrides[Altura] = metros            (o motor faz o resto)
 *   · overrides.VIT apagado                 (senão o motor continua calado)
 *   · valoresDer.VIT = o valor calculado    (espelho, para quem lê a chave legada)
 *   · schemaVersion 2 + modoFicha mecanico + vinculados dos VDs universais
 *
 * A lista de `vinculados` é copiada do Avarbus — a única ficha que já estava
 * certa e serve de modelo.
 *
 * FORA DA VARREDURA, de propósito:
 *   · as 11 invocáveis/companheiras — Vitalidade calibrada à mão para fechar a
 *     escada de força; recalcular quebraria a escada;
 *   · Nevara, Sentinela da Feira e Velhen — têm mesaId, são de mesa em andamento;
 *   · Velocirops, Papa-Noite e Avarbus — já estavam certos.
 *
 * OS NOMES. Nomes-rótulo viram nomes próprios. Penacho-Bravo fica: é nome de
 * camponês, de "bravo" no sentido de indomável.
 *
 *   node functions/bestiario-altura-e-nomes.mjs            (dry-run)
 *   node functions/bestiario-altura-e-nomes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const ID_ALTURA = 'XPv2i5GhoHfz2QSH3pCl';

/* nome atual · altura em metros · nome novo (null = mantém) · nota */
const FICHAS = [
    ['Águia Tempestuosa',            1.2, 'Fúlgora',        'corpo em pé; a envergadura de 3,5 m não é altura'],
    ['Aranha de Cristal',            1.0, 'Vidrela',        'perfil vertical; 2,5 m é envergadura de pernas'],
    ['Bezerro-das-Tempestades',      1.2, 'Nimbrote',       'altura no ombro'],
    ['Lobo Espectral das Pradarias', 1.0, 'Passa-Cerca',    'altura no ombro'],
    ['Penacho-Bravo',                2.0, null,             'o "6" do campo era Tamanho, não Altura'],
    ['Penacho-Bravo Alfa',           3.0, null,             'o campo já dizia "~3 m de altura"'],
    ['Penacho-Bravo Juvenil',        1.7, null,             'faixa 1,6–2,0 m do campo'],
    ['Ratazana',                     1.5, null,             'altura; 3 m é o comprimento com cauda'],
    ['Rei-Coveiro',                  0.9, null,             'altura; 1,80 m é envergadura'],
    ['Sombra Comedora de Luz',       2.0, 'Apaga-Lume',     'altura declarada no campo'],
    ['Touro-da-Tempestades Alfa',    4.5, 'Nímbaro Alfa',   'altura no ombro'],
    ['Touro-das-Tempestades',        3.5, 'Nímbaro',        'altura no ombro'],
    ['Vaca-da-Tempestade',           3.0, 'Nímbara',        'altura no ombro'],
    ['Verme Perfurador de Pedra',    1.0, 'Górbal',         'diâmetro — é a medida vertical; comprimento 2 a 8 m conforme a idade'],
];

const grab = async c => (await db.collection(c).get()).docs;
const npcs = await grab('npcs');
const acha = nome => npcs.filter(d => (d.data().nome || '') === nome);
const erros = [];

/* modelo de `vinculados`: o Avarbus */
const avarbus = acha('Avarbus')[0];
if (!avarbus) erros.push('Avarbus (ficha-modelo) não achado');
const VINCULADOS = avarbus ? (avarbus.data().valoresDer?.vinculados || []) : [];
if (!VINCULADOS.includes(ID_ALTURA)) erros.push('a lista de vinculados do Avarbus não inclui a Altura');

const alvos = [];
for (const [nome, altura, novoNome, nota] of FICHAS) {
    const d = acha(nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    if (n.mesaId) { erros.push(`"${nome}" tem mesaId — não devia estar na varredura`); continue; }
    const vig = Number(n.atributos?.VIG) || 0;
    const vit = Number(((vig + altura * 3) * 3).toFixed(2));
    alvos.push({ ref: d[0].ref, nome, novoNome, altura, nota, vig,
                 vitAntes: n.valoresDer?.VIT ?? n.valoresDer?.overrides?.VIT ?? null, vit,
                 modoAntes: n.modoFicha || '(undefined)' });
}

/* renomes fora da coleção npcs */
const geo = await grab('worldbuilding-geography');
const arts = await grab('worldbuilding-articles');
const equip = await grab('system/data/equipment');
const renomes = Object.fromEntries(FICHAS.filter(f => f[2]).map(f => [f[0], f[2]]));
const colaterais = [];
for (const d of geo) {
    const s = JSON.stringify(d.data());
    for (const [de, para] of Object.entries(renomes))
        if (s.includes(de)) colaterais.push({ ref: d.ref, onde: `GEO ${d.data().nome}`, de, para, doc: d });
}
for (const d of [...arts, ...equip]) {
    const s = JSON.stringify(d.data());
    for (const de of Object.keys(renomes))
        if (s.includes(de)) colaterais.push({ ref: null, onde: `${d.data().title || d.data().nome}`, de, para: renomes[de], doc: d });
}

/* ── relatório ── */
console.log('\n=== Bestiário · Altura, Vitalidade e nomes ===\n');
console.log('nome                          → nome novo        alt   VIG   Vit antes → depois   modo antes');
for (const a of alvos) {
    console.log(`${a.nome.padEnd(29)} → ${(a.novoNome || '(mantém)').padEnd(16)} ${String(a.altura).padStart(4)}m  ${String(a.vig).padStart(2)}   ${String(a.vitAntes).padStart(5)} → ${String(a.vit).padStart(6)}   ${a.modoAntes}`);
}
console.log('\nJustificativa da altura de cada uma:');
for (const a of alvos) console.log(`   ${a.nome.padEnd(29)} ${a.nota}`);
console.log(`\nCada ficha recebe: overrides[Altura] · overrides.VIT APAGADO · valoresDer.VIT = espelho`);
console.log(`                   schemaVersion 2 · modoFicha "mecanico" · vinculados (${VINCULADOS.length} VDs, do Avarbus)`);
console.log(`\nCitações fora de npcs que precisam do nome novo (${colaterais.length}):`);
for (const c of colaterais) console.log(`   ${c.ref ? '~' : '!'} ${c.onde}: "${c.de}" → "${c.para}"${c.ref ? '' : '  (NÃO gravado por este script)'}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ── gravação ── */
const iso = new Date().toISOString();
const batch = db.batch();
for (const a of alvos) {
    const patch = {
        schemaVersion: 2, modoFicha: 'mecanico',
        [`valoresDer.overrides.${ID_ALTURA}`]: a.altura,
        'valoresDer.overrides.VIT': FV.delete(),
        'valoresDer.VIT': a.vit,
        'valoresDer.vinculados': VINCULADOS,
        lastUpdate: iso, lastUpdateBy: AUTOR,
    };
    if (a.novoNome) patch.nome = a.novoNome;
    batch.update(a.ref, patch);
}
for (const c of colaterais.filter(x => x.ref)) {
    const d = c.doc.data();
    const campos = {};
    for (const k of ['descricao', 'perigos', 'notas', 'historiaLocal', 'landmarks', 'tags'])
        if (typeof d[k] === 'string' && d[k].includes(c.de)) campos[k] = d[k].split(c.de).join(c.para);
    if (Object.keys(campos).length) batch.update(c.ref, { ...campos, lastUpdate: iso, lastUpdateBy: AUTOR });
}
await batch.commit();
console.log(`\n✅ ${alvos.length} fichas com Altura e Vitalidade calculadas · ${Object.keys(renomes).length} renomeadas · ${colaterais.filter(x => x.ref).length} docs de geografia atualizados.`);
process.exit(0);
