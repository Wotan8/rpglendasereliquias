/**
 * v3 · LOTE 3 — os Penacho-Bravo, e a Lealdade aberta em três números.
 *
 * PARTE A — a tabela de doma tinha uma coluna só de Lealdade, herdada do cânone
 * antigo, e ela dizia apenas o LIMIAR do vínculo. Faltava o que importa: onde a
 * fera começa, e quanto custa subir. Fera perigosa começa mais desconfiada E
 * sobe mais devagar — as duas coisas, não uma.
 *
 *   Grau        Redutor  começa em  vínculo exige  sessões/ponto  total até o vínculo
 *   Inofensiva     0         6            4              1          já nasce vinculada
 *   Praga         −1         5            5              1          0
 *   Comum         −1         4            6              1          2 sessões
 *   Séria         −3         3            8              2          10 sessões
 *   Grave         −5         2           10              3          24 sessões
 *   Calamidade    −7         1           10              4          36 sessões
 *
 * Os limiares 6 / 8 / 10 de Comum, Séria e Grave são os do cânone antigo e não
 * se mexeram. O que entrou foi a coluna de partida e a de ritmo.
 *
 * As 8 fichas já carimbadas são reescritas com a cláusula nova. Quem é indomável
 * continua indomável e não ganha cláusula de doma nenhuma.
 *
 * PARTE B — Penacho-Bravo Juvenil, adulto e Alfa.
 *
 *   Juvenil  Praga  0,26×      adulto  Comum  0,58×      Alfa  Séria  1,15×
 *
 * E aqui entra a PRIMEIRA MIGRAÇÃO DE ALTURA. As três estão em `modoFicha`
 * indefinido, com a Vitalidade digitada à mão (4 / 9 / 11) e sem Altura — logo
 * Tamanho 0, logo a Vitalidade perdia o seu maior termo. Migram para modo
 * mecânico com a Altura no override e a lista de `vinculados` copiada do Avarbus,
 * que é a ficha mecânica de referência do banco. A Vitalidade passa a ser
 * calculada: (VIG + Altura×3) × 3.
 *
 *   node functions/bestiario-v3-lote3.mjs            (dry-run)
 *   node functions/bestiario-v3-lote3.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90, ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl';

const medio = d => { const m = /(\d+)d(\d+)/.exec(d); return Number(m[1]) * (Number(m[2]) + 1) / 2; };
const dprDe = (alvo, dado, bon) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    const liq = Math.max(1, medio(dado) + bon - 2);
    return { P, liq, dpr: P * liq };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');

/* Grau → [Redutor, Lealdade inicial, limiar do vínculo, sessões por ponto] */
const DOMA = {
    'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4],
};
const clausula = (grau) => {
    const [r, ini, lim, ritmo] = DOMA[grau];
    const falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${grau} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo` : ' — já nasce vinculada');
};

/* ── PARTE A · seção reescrita do capítulo ── */
const SECAO_VELHA = /\n<h3>A doma sai do Grau<\/h3>[\s\S]*$/;
const SECAO_NOVA = `
<h3>A doma sai do Grau</h3>

<p>Conseguir uma fera é teste universal, de qualquer classe: <strong>AUT + Domar</strong>, com o Redutor da criatura. E o Redutor não é gosto do Narrador — <strong>sai do Grau de Ameaça</strong>, porque é exatamente isso que a fera opõe a quem tenta coleirá-la.</p>

<p>Domar, porém, é só o primeiro dos dois portões. O segundo é a <strong>Lealdade</strong>, e ela cobra em duas moedas que a tabela antiga não mostrava: <em>onde a fera começa</em> e <em>quanto custa cada ponto</em>. Fera perigosa começa mais desconfiada <strong>e</strong> sobe mais devagar.</p>

<table>
<thead><tr><th>Grau</th><th>Redutor</th><th>Melhor chance</th><th>Lealdade inicial</th><th>Vínculo exige</th><th>Sessões por ponto</th><th>Da doma ao vínculo</th></tr></thead>
<tbody>
<tr><td>Inofensiva</td><td>0</td><td>90%</td><td>6</td><td>4</td><td>1</td><td>já nasce vinculada</td></tr>
<tr><td>Praga</td><td>−1</td><td>80%</td><td>5</td><td>5</td><td>1</td><td>já nasce vinculada</td></tr>
<tr><td>Comum</td><td>−1</td><td>80%</td><td>4</td><td>6</td><td>1</td><td>2 sessões</td></tr>
<tr><td>Séria</td><td>−3</td><td>60%</td><td>3</td><td>8</td><td>2</td><td>10 sessões</td></tr>
<tr><td>Grave</td><td>−5</td><td>40%</td><td>2</td><td>10</td><td>3</td><td>24 sessões</td></tr>
<tr><td><strong>Calamidade</strong></td><td><strong>−7</strong></td><td><strong>20%</strong></td><td><strong>1</strong></td><td><strong>10</strong></td><td><strong>4</strong></td><td><strong>36 sessões</strong></td></tr>
</tbody>
</table>

<p>A coluna "melhor chance" é a de quem já chegou ao teto: Alvo 9, o máximo que qualquer teste alcança. Contra uma Calamidade, o melhor domador vivo acerta um em cada cinco. <strong>Uma Calamidade pode, sim, ser domada</strong> — só que a dificuldade se chama Calamidade, e é isso que ela quer dizer.</p>

<p>E a última coluna é a que separa a proeza da posse. Domar é uma tarde; o vínculo é o resto. Uma fera Comum aceita você em duas sessões. Uma Grave leva vinte e quatro. Uma Calamidade leva trinta e seis — uma campanha inteira convivendo com uma coisa que ainda não decidiu se você é dono ou vizinho. <strong>Lealdade não se compra com Luns, e não há atalho:</strong> o que sobe é a convivência.</p>

<p>Um personagem recém-criado tem AUT 3 e Domar 3: Alvo 6. Ele doma Praga e Comum, arranha as Sérias e não encosta no resto. A fera grande não é uma questão de coragem, é de anos.</p>

<p><strong>E fera forte chega pronta.</strong> Criatura acima do orçamento de companheiro nasce com as melhorias de Lealdade pré-gastas: é magnífica no dia em que aceita, e é tudo o que vai ser. O que ela não vier a crescer, você não vai ensinar.</p>
`;

/* ── PARTE B · os Penacho-Bravo ── */
const LOTE = [
    { nome: 'Penacho-Bravo Juvenil', grauAlvo: 'Praga', altura: 1.7, bld: 0,
      golpe: ['Esporão Serrilhado (A. Padrão)', 5, '1d4', 2],
      ataques: 'Esporão Serrilhado (A. Padrão): Alvo 5, 1d4+2 e Sangrar 1.\n'
        + 'Bicada Perfurante (A. Padrão): Alvo 5, 1d4+2; contra alvo Pequeno ou menor, Alvo 6.\n'
        + 'Foge se ficar isolado do bando.',
      densidade: 'no bando, atrás dos adultos',
      nota: 'arisco; não briga sozinho' },

    { nome: 'Penacho-Bravo', grauAlvo: 'Comum', altura: 2.0, bld: 1,
      golpe: ['Esporão Serrilhado (A. Padrão)', 6, '1d6', 3],
      ataques: 'Esporão Serrilhado (A. Padrão): Alvo 6, 1d6+3 e Sangrar 1.\n'
        + 'Bicada Perfurante (A. Padrão): Alvo 6, 1d6+3; contra alvo Pequeno ou menor, Alvo 7.\n'
        + 'Investida Saltitante (A. Padrão; exige 6 m em linha reta antes): Alvo 6, 1d6+3 e Derrubada.',
      densidade: 'bando de 3 a 6, com um Alfa',
      nota: 'territorial; protege o ninho e ataca quem se aproxima dele' },

    { nome: 'Penacho-Bravo Alfa', grauAlvo: 'Séria', altura: 3.0, bld: 2,
      golpe: ['Esporão Serrilhado (A. Padrão)', 7, '1d10', 4],
      ataques: 'Esporão Serrilhado (A. Padrão): Alvo 7, 1d10+4 e Sangrar 2.\n'
        + 'Bicada Perfurante (A. Padrão): Alvo 7, 1d10+4; contra alvo Pequeno ou menor, Alvo 8.\n'
        + 'Investida Saltitante (A. Padrão; exige 6 m em linha reta antes): Alvo 7, 1d10+4 e Derrubada.',
      densidade: '1 por bando',
      nota: 'chefe do bando; entre o ninho e você, sempre' },
];

const grab = async c => (await db.collection(c).get()).docs;
const [npcs, arts] = await Promise.all([grab('npcs'),
    (async () => (await db.collection('worldbuilding-articles').where('bookId', '==', 'book_mrs9ur4aw1m6a').get()).docs)()]);
const erros = [];
const um = n => npcs.filter(d => (d.data().nome || '') === n);

const cap = arts.find(d => (d.data().title || '') === 'O Nível de Ameaça');
if (!cap) erros.push('capítulo "O Nível de Ameaça" não achado');
else if (!SECAO_VELHA.test(cap.data().contentHTML)) erros.push('seção "A doma sai do Grau" não achada para substituir');

const avarbus = um('Avarbus')[0];
if (!avarbus) erros.push('Avarbus (modelo de ficha mecânica) não achado');
const VINCULADOS = avarbus?.data().valoresDer?.vinculados || [];
if (VINCULADOS.length < 5) erros.push(`lista de vinculados do Avarbus veio com ${VINCULADOS.length} itens — suspeito`);

/* A · re-carimbo das 8 já feitas */
const JA_FEITAS = ['Velocirops', 'Papa-Noite', 'Avarbus', 'Ratazana', 'Nimbrote', 'Nímbara', 'Nímbaro', 'Nímbaro Alfa'];
const recarimbo = [];
for (const nome of JA_FEITAS) {
    const d = um(nome);
    if (d.length !== 1) { erros.push(`"${nome}": ${d.length} docs`); continue; }
    const antes = d[0].data().criatura?.nivelAmeaca || '';
    const segs = antes.split(' · ').map(s => s.trim()).filter(Boolean);
    const grau = segs[0];
    if (!DOMA[grau]) { erros.push(`"${nome}": primeiro segmento "${grau}" não é um Grau`); continue; }
    const indomavel = segs.some(s => /indom[áa]vel/i.test(s));
    const mantidos = segs.filter(s => !/^Domável:|^Vínculo: Lealdade|^Lealdade começa/i.test(s));
    const depois = indomavel ? mantidos.join(' · ') : [...mantidos, clausula(grau)].join(' · ');
    if (depois !== antes) recarimbo.push({ ref: d[0].ref, nome, antes, depois });
}

/* B · os Penachos */
for (const c of LOTE) {
    const d = um(c.nome);
    if (d.length !== 1) { erros.push(`"${c.nome}": ${d.length} docs`); continue; }
    const n = d[0].data();
    c.ref = d[0].ref; c.doc = n;
    const [, alvo, dado, bon] = c.golpe;
    const forAtt = Number(n.atributos?.FOR) || 0, des = Number(n.atributos?.DES) || 0, vig = Number(n.atributos?.VIG) || 0;
    Object.assign(c, dprDe(alvo, dado, bon));
    c.x = c.dpr / U;
    c.grau = grauDe(c.x);
    c.vitAntes = Number(n.valoresDer?.VIT) || 0;
    c.vitDepois = (vig + c.altura * 3) * 3;
    c.pericia = alvo - Math.max(forAtt, des);
    if (c.grau !== c.grauAlvo) erros.push(`${c.nome}: ${vg(c.x)}× cai em ${c.grau}, não em ${c.grauAlvo}`);
    if (bon > forAtt) erros.push(`${c.nome}: bônus +${bon} acima de FOR ${forAtt}`);
    if (c.pericia > 5 || c.pericia < 0) erros.push(`${c.nome}: Alvo ${alvo} exigiria perícia ${c.pericia}`);
    const rod = c.vitDepois / (4 * 0.6 * Math.max(1, 8.5 - c.bld));
    if (c.vitDepois / (0.6 * Math.max(1, 8.5 - c.bld)) > 10.5) erros.push(`${c.nome}: ${(c.vitDepois / (0.6 * Math.max(1, 8.5 - c.bld))).toFixed(1)} rodadas em duelo, acima do teto de 10`);
    c.rodGrupo = rod;
    c.ameaca = [c.grau, `${vg(c.x)}×`, c.densidade, clausula(c.grau), c.nota].join(' · ');
}

/* ── relatório ── */
console.log('\n=== PARTE A · Lealdade em três números ===\n');
console.log('Grau         Redutor  começa  exige  sessões/ponto  da doma ao vínculo');
for (const [g, [r, ini, lim, ritmo]] of Object.entries(DOMA)) {
    const falta = Math.max(0, lim - ini);
    console.log(`${g.padEnd(12)} ${String(r).padStart(5)}  ${String(ini).padStart(6)}  ${String(lim).padStart(5)}  ${String(ritmo).padStart(13)}  ${falta ? falta * ritmo + ' sessões' : 'já nasce vinculada'}`);
}
console.log(`\nRe-carimbo de ${recarimbo.length} fichas já feitas:`);
for (const r of recarimbo) console.log(`\n   ${r.nome}\n      de:   ${r.antes}\n      para: ${r.depois}`);

console.log('\n\n=== PARTE B · Penacho-Bravo ===\n');
console.log('nome                    Alvo  dano     DPR    força    grau     Altura   Vit           rodadas p/ grupo de 4');
for (const c of LOTE) {
    if (!c.ref) continue;
    const [, alvo, dado, bon] = c.golpe;
    console.log(`${c.nome.padEnd(23)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(7)} ${c.dpr.toFixed(2).padStart(5)}  ${vg(c.x)}×  ${c.grau.padEnd(7)} ${String(c.altura).padStart(5)} m  ${String(c.vitAntes).padStart(4)}→${c.vitDepois.toFixed(1).padStart(5)}  ${c.rodGrupo.toFixed(1)}`);
}
console.log('\nMigração de ficha (modo indefinido → mecânico, Altura no override, Vitalidade calculada):');
for (const c of LOTE) if (c.ref) console.log(`   ${c.nome.padEnd(23)} modo "${c.doc.modoFicha || '(indefinido)'}" → "mecanico" · ${VINCULADOS.length} VDs vinculados`);
console.log('\nNível de Ameaça:');
for (const c of LOTE) if (c.ref) console.log(`\n   ${c.nome}\n      de:   ${c.doc.criatura?.nivelAmeaca || '(vazio)'}\n      para: ${c.ameaca}`);
const bando = 1.15 + 4 * 0.58 + 2 * 0.26;
console.log(`\n   Bando cheio (1 Alfa + 4 adultos + 2 juvenis) = ${vg(bando)}× contra os 4,0× de um grupo de quatro — páreo exato.`);
console.log('   Três itens do catálogo dependem deste Grau: Carne, Penas Duras e o Cheiro Verde de Vasteluna.');

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const html = cap.data().contentHTML.replace(SECAO_VELHA, SECAO_NOVA);
const batch = db.batch();
batch.update(cap.ref, { contentHTML: html, words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, updatedAt: Date.now() });
for (const r of recarimbo) batch.update(r.ref, { 'criatura.nivelAmeaca': r.depois, lastUpdate: iso, lastUpdateBy: AUTOR });
for (const c of LOTE) {
    const vd = c.doc.valoresDer || {};
    batch.update(c.ref, {
        schemaVersion: 2, modoFicha: 'mecanico',
        ataques: c.ataques, 'criatura.nivelAmeaca': c.ameaca,
        valoresDer: {
            ...vd,
            overrides: { ...(vd.overrides || {}), [ALTURA_VD]: c.altura },
            atual: vd.atual || {}, extras: vd.extras || [], vinculados: VINCULADOS,
            VIT: c.vitDepois, BLD: c.bld,
        },
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
}
await batch.commit();
console.log(`\n✅ tabela de Lealdade no capítulo · ${recarimbo.length} re-carimbadas · ${LOTE.length} Penachos traduzidos e migrados.`);
process.exit(0);
