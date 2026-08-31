/**
 * Bestiário — carimbo de Grau nas 7 que ficaram na notação velha.
 *
 * Cinco Respostas do Abismo, dois Erguidos. O `nivelAmeaca` delas nunca ganhou
 * Grau nem força: guardava só o eixo de obediência ("CA 6–7 · Disposição base 4
 * · Aspecto: Risco 1"). Sem o Grau na frente elas somem do filtro de Nível de
 * Ameaça do Painel, que compara o primeiro segmento do campo.
 *
 * O carimbo passa a ser, para todas as criaturas:
 *
 *   Grau · força× · densidade · eixo de obediência · doma · nota
 *
 * TUDO O QUE É NÚMERO É GERADO DA FICHA. Alvo, dado, Transbordo, Vitalidade,
 * Blindagem e Poder saem de `npcs`; força e Grau saem da Régua v3 (unidade
 * 3,90, defensor Defesa 1 / Blindagem 2). Só a densidade, o eixo e a cláusula
 * de indomabilidade são texto — e cada um vem do capítulo que já está no livro.
 *
 * O script trava se a força computada divergir do carimbo v3 de cânone: estas
 * fichas foram calibradas na base velha e sobrevivem à recomputação, então
 * divergência aqui é ficha mexida, não régua errada.
 *
 *   node functions/bestiario-carimbo-abissais.mjs            (dry-run)
 *   node functions/bestiario-carimbo-abissais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

/* ── Régua v3 (§0.2): defensor de referência Defesa 1, Blindagem 2 ── */
const UNIDADE = 3.90, DEFESA = 1, BLD_REF = 2, VIT_REF = 18;
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const br = (x, c = 2) => x.toFixed(c).replace('.', ',');

/* ── o que é texto, e de onde veio ──
   densidade e eixo saem dos capítulos "As Respostas do Abismo" e "Os Erguidos",
   que já estão no livro. `carimbo` é a força de cânone (skill /bestiario §2). */
const ABISSAL = 'abissal — vem pelo rito, não pela doma';
const ERGUIDO = 'erguido — obedece quem o levantou, e não tem Lealdade que cresça';
const ALVOS = [
    { nome: 'Fantoche',           carimbo: 0.154, densidade: 'em bando — o Adepto sustenta PRE + Servos de pé (Limite de Fantoches)',
      eixo: 'Erguido: p = 1, não desobedece', doma: ERGUIDO },
    { nome: 'Servo Reanimado',    carimbo: 0.577, densidade: 'um, permanente',
      eixo: 'Erguido: p = 1, não desobedece', doma: ERGUIDO },
    { nome: 'Cria Menor do Véu',  carimbo: 1.000, densidade: 'uma por rito',
      eixo: 'Invocada: CA 2–3, Disposição base 5', doma: ABISSAL },
    { nome: 'Cria da Fenda',      carimbo: 1.526, densidade: 'uma por rito',
      eixo: 'Invocada: CA 4–5, Disposição base 4', doma: ABISSAL },
    { nome: 'Horror Rastejante',  carimbo: 1.949, densidade: 'uma por rito',
      eixo: 'Invocada: CA 6–7, Disposição base 4', doma: ABISSAL },
    { nome: 'Horror Maior',       carimbo: 2.154, densidade: 'uma por rito',
      eixo: 'Invocada: CA 8–9, Disposição base 3', doma: ABISSAL },
    { nome: 'Entidade da Oitava', carimbo: 2.564, densidade: 'uma por rito',
      eixo: 'Invocada: CA 10+, Disposição base 2', doma: ABISSAL },
];

/* ── ⚡ Poder: mesmas fórmulas de npc-poder.js. Ficha em modo rápido sem
   perícia, peculiaridade ou módulo — o Poder é só atributo, e é o piso. ── */
const ATRIBS = ['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRS', 'PRE', 'MAN', 'AUT'];
const poderDe = n => ATRIBS.reduce((s, k) => {
    const v = Number(n.atributos?.[k] ?? n.atributos?.[k.toLowerCase()] ?? 0) || 0;
    return s + 5 * v * (v + 1) / 2;
}, 0);
const FAIXAS = [[500, '1 — Inicial', 0], [850, '2 — Veterano', 1], [1300, '3 — Mestre', 2], [1800, '4 — Lendário', 3]];
const faixaDe = p => (FAIXAS.find(([t]) => p < t) || [null, '5 — Relíquia', 4]).slice(1);

const erros = [];
const docs = (await db.collection('npcs').get()).docs;
const linhas = [];

for (const a of ALVOS) {
    const achados = docs.filter(d => (d.data().nome || '') === a.nome);
    if (achados.length !== 1) { erros.push(`"${a.nome}": ${achados.length} fichas em npcs (esperado 1)`); continue; }
    const doc = achados[0], n = doc.data();

    if (n.tipo !== 'criatura') { erros.push(`"${a.nome}": tipo é '${n.tipo}', não 'criatura'`); continue; }
    if (n.mesaId || (n.vinculos || []).length) { erros.push(`"${a.nome}": tem mesa — não se mexe sem perguntar`); continue; }

    /* o Fantoche traz condição depois do dado: "Alvo 5, 1d4+1 e Necrose 1" */
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, (\d+d\d+)(?:\+(\d+))?/.exec(atq);
    if (!g) { erros.push(`"${a.nome}": golpe não legível em ataques — "${atq}"`); continue; }

    const alvo = +g[1], transb = g[2] ? +g[2] : Math.max(0, alvo - 9), bonus = g[4] ? +g[4] : 0;
    const dm = medio(g[3]);
    if (!Number.isFinite(dm)) { erros.push(`"${a.nome}": dado ilegível`); continue; }

    const P = Math.max(0, Math.min((Math.min(alvo, 9) - DEFESA) / 10, 0.9));
    const liq = Math.max(1, dm + bonus - BLD_REF);
    const dpr = P * liq, forca = dpr / UNIDADE, grau = grauDe(forca);

    /* trava: a ficha tem que continuar batendo com o carimbo v3 de cânone */
    const desvio = Math.abs(forca - a.carimbo) / a.carimbo;
    if (desvio > 0.02) erros.push(`"${a.nome}": força ${br(forca, 3)}× diverge do carimbo v3 ${br(a.carimbo, 3)}× (${br(desvio * 100, 1)}%) — a ficha mudou`);

    const vit = Number(n.valoresDer?.VIT) || 0, bld = Number(n.valoresDer?.BLD ?? 0) || 0;
    const poder = poderDe(n), [faixa, fio] = faixaDe(poder);
    const rodadasPraCair = vit / UNIDADE;                 // um guerreiro de referência batendo nela
    const rodadasPraMatar = dpr > 0 ? VIT_REF / dpr : Infinity;

    const depois = [
        grau,
        `${br(forca)}×${transb ? ` (+${transb} Transbordo)` : ''}`,
        a.densidade,
        a.eixo,
        `Indomável: ${a.doma} (salvo decisão do Narrador)`,
        'Aspecto: Risco 1',
    ].join(' · ');

    linhas.push({
        ref: doc.ref, nome: a.nome, antes: String(n.criatura?.nivelAmeaca || ''), depois,
        alvo, transb, dado: g[3] + (bonus ? `+${bonus}` : ''), vit, bld, P, liq, dpr, forca, grau,
        poder, faixa, fio, rodadasPraCair, rodadasPraMatar,
    });
}

console.log(`\n=== Carimbo de Grau — ${linhas.length} criaturas · base ${br(UNIDADE)} (Régua v3, defensor Defesa ${DEFESA} / Blindagem ${BLD_REF}) ===\n`);
console.log('Criatura              Alvo  Dado       Vit  Bld      P    líq   DPR    força  Grau         Poder  faixa           f/100     cai em    mata em');
for (const l of linhas) {
    console.log(
        l.nome.padEnd(21) +
        String(l.alvo + (l.transb ? `+${l.transb}T` : '')).padStart(4) + '  ' +
        l.dado.padEnd(9) + ' ' +
        String(l.vit).padStart(4) + ' ' + String(l.bld).padStart(4) + '  ' +
        br(l.P).padStart(5) + ' ' + br(l.liq, 1).padStart(6) + ' ' + br(l.dpr).padStart(5) + '  ' +
        (br(l.forca) + '×').padStart(7) + '  ' + l.grau.padEnd(11) + ' ' +
        String(l.poder).padStart(5) + '  ' + l.faixa.padEnd(14) + ' ' +
        br(l.poder ? l.forca / l.poder * 100 : 0).padStart(5) + '   ' +
        (br(l.rodadasPraCair, 1) + ' rod').padStart(9) + ' ' + (br(l.rodadasPraMatar, 1) + ' rod').padStart(10)
    );
}

console.log('\n--- o campo, antes e depois ---');
for (const l of linhas) console.log(`\n${l.nome}\n   de:   ${l.antes || '(vazio)'}\n   para: ${l.depois}`);

const fora = linhas.filter(l => l.rodadasPraCair < 3 || l.rodadasPraCair > 10 || l.rodadasPraMatar < 3 || l.rodadasPraMatar > 10);
if (fora.length) {
    console.log('\n⚠ Fora do invariante de 3–10 rodadas (só reportado; o carimbo não mexe em ficha):');
    for (const l of fora) console.log(`   ${l.nome}: um guerreiro a derruba em ${br(l.rodadasPraCair, 1)}, ela derruba um PJ em ${br(l.rodadasPraMatar, 1)}`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

const batch = db.batch();
for (const l of linhas) batch.update(l.ref, {
    'criatura.nivelAmeaca': l.depois,
    lastUpdate: new Date().toISOString(),
    lastUpdateBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ ${linhas.length} carimbos gravados.`);
process.exit(0);
