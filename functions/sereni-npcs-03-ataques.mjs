/**
 * NPCs de Sereni · passada 3 — os ataques em v3.
 *
 * Diferente do bestiário: humano não tem arma natural. O Alvo sai da ficha e o
 * dado sai do CATÁLOGO DE EQUIPAMENTO, não da minha cabeça.
 *
 *     Alvo  = (FOR max DES) + a perícia que a arma usa, preso em 9
 *             corpo a corpo → Arma · desarmado → Briga
 *             disparo → Disparo · arremesso → Arremessar
 *     Dano  = dado do item no catálogo + FOR        (Livro §6.5)
 *     Excedente de Alvo acima de 9 vira Transbordo, e é escrito.
 *
 * O nome da arma sai do texto legado de cada ficha (o que ela já dizia empunhar)
 * e é casado com `system/data/equipment`. Arma que não existir no catálogo é
 * LISTADA e a linha dela é descartada — não se inventa item nem dado.
 *
 * Quem não tem arma nenhuma fica com Desarmado, que é o que ele tem.
 *
 *   node functions/sereni-npcs-03-ataques.mjs            (dry-run)
 *   node functions/sereni-npcs-03-ataques.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; };
const vg = n => n.toFixed(2).replace('.', ',');
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

/* que perícia cada tipo de golpe usa */
const PERICIA_DE = (nomeArma, cat) => {
    const n = norm(nomeArma);
    if (/^(soco|briga|desarmado|pancada|cabecada|joelhada)/.test(n)) return 'Briga';
    if (/arremess|estaca|faca de arremesso/.test(n) || cat === 'arremesso') return 'Arremessar';
    if (/besta|arco|funda|dardo|virote/.test(n) || cat === 'distancia') return 'Disparo';
    return 'Arma';
};

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, skills, equip] = await Promise.all([grab('npcs'), grab('system/data/skills'), grab('system/data/equipment')]);
const skById = Object.fromEntries(skills.map(s => [s.id, s]));
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;

/* índice de armas: nome normalizado → {nome, dado, categoria} */
const armas = equip.filter(e => /arma/i.test(e.tipo || '') && e.formulaDano)
    .map(e => ({ nome: e.nome, dado: String(e.formulaDano).split('/')[0].trim(), cat: e.categoriaArma || '', n: norm(e.nome) }));
/* apelidos que a ficha usa e o catálogo não tem. Ferramenta de ofício vira a
   arma equivalente; nada aqui inventa dado — todo destino existe no catálogo. */
const ALIAS = {
    'marreta curta': 'Maça', 'martelo de forja': 'Maça de Armas', 'picareta de trabalho': 'Machadinha',
    'espada larga': 'Espada Longa', 'gladio curto': 'Espada Curta', 'arpao': 'Tridente',
    'machado de arremesso': 'Machadinha', 'estacas arremessadas': 'Dardo', 'arremesso de pedra': 'Funda',
    'bisturi cirurgico': 'Estilete',
    'panela de ferro': 'Porrete', 'panela de cobre': 'Porrete', 'rolo de massa': 'Porrete',
    'garrafa quebrada': 'Porrete',
    'bastao de oleiro': 'Bordão', 'bastao de anciao': 'Bordão', 'defesa com bastao medico': 'Bordão',
    'cajado mistico': 'Bordão', 'cajado de aprendiz': 'Bordão', 'cajado cerimonial': 'Bordão',
    'cajado de cego': 'Bordão', 'cajado de pastor': 'Bordão', 'cajado ritual': 'Bordão',
    'remo de fermentacao': 'Bordão',
};
const achaArma = (txt) => {
    const t = norm(txt);
    if (!t) return null;
    if (ALIAS[t]) { const a = armas.find(x => x.n === norm(ALIAS[t])); if (a) return a; }
    let melhor = null;
    for (const a of armas) {
        if (t === a.n) return a;
        if (t.includes(a.n) || a.n.includes(t)) {
            if (!melhor || a.n.length > melhor.n.length) melhor = a;
        }
    }
    return melhor;
};

const alvos = npcs.filter(n => /sereni/i.test(String(n.local || '')) && n.tipo !== 'criatura');
const semArma = new Map();
const plano = [];

for (const n of alvos) {
    const a = n.atributos || {};
    const FOR = Number(a.FOR) || 0, DES = Number(a.DES) || 0;
    const nivelDe = (nomePer) => {
        const s = skPorNome[norm(nomePer)];
        if (!s) return 0;
        const p = (n.periciasEstruturadas || []).find(x => x.refId === s.id);
        return Number(p?.nivel) || 0;
    };
    /* nomes de golpe declarados no texto legado */
    const brutos = [];
    for (const linha of String(n.ataques || '').split(/\n|\|/)) {
        const m = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ()'.\-]{2,40}?)\s*(?:\(|=|$)/.exec(linha.trim());
        if (!m) continue;
        const nome = m[1].trim();
        if (/^(efeito|obs|—|-|bonus|b[oô]nus)/i.test(nome)) continue;
        if (!brutos.includes(nome)) brutos.push(nome);
    }
    const linhas = [];
    for (const bruto of brutos.slice(0, 4)) {
        const per = PERICIA_DE(bruto);
        const desarmado = per === 'Briga';
        const arma = desarmado ? null : achaArma(bruto);
        if (!desarmado && !arma) { semArma.set(bruto, (semArma.get(bruto) || 0) + 1); continue; }
        const dado = desarmado ? '1d2' : arma.dado;
        const base = per === 'Disparo' || per === 'Arremessar' ? DES : Math.max(FOR, DES);
        const alvoCru = base + nivelDe(per);
        const alvo = Math.min(alvoCru, 9);
        const P = Math.max(0, Math.min((alvo - 1) / 10, 0.9));
        const liq = Math.max(1, medio(dado) + FOR - 2);
        linhas.push({ rot: desarmado ? 'Desarmado' : arma.nome, per, dado, alvoCru, alvo,
            transbordo: Math.max(0, alvoCru - 9), dpr: P * liq, x: P * liq / U,
            nivel: nivelDe(per) });
    }
    if (!linhas.length) {
        const alvoCru = Math.max(FOR, DES) + nivelDe('Briga');
        const alvo = Math.min(alvoCru, 9);
        const P = Math.max(0, Math.min((alvo - 1) / 10, 0.9));
        const liq = Math.max(1, 1.5 + FOR - 2);
        linhas.push({ rot: 'Desarmado', per: 'Briga', dado: '1d2', alvoCru, alvo,
            transbordo: Math.max(0, alvoCru - 9), dpr: P * liq, x: P * liq / U, nivel: nivelDe('Briga') });
    }
    linhas.sort((p, q) => q.x - p.x);
    const texto = linhas.map(l =>
        `${l.rot} (A. Padrão): Alvo ${l.alvo}${l.transbordo ? ` (+${l.transbordo} Transbordo)` : ''}, ${l.dado}+${FOR}.`
        + `   [${l.per} ${l.nivel} + ${l.per === 'Disparo' || l.per === 'Arremessar' ? `DES ${DES}` : `FOR/DES ${Math.max(FOR, DES)}`}]`
    ).join('\n');
    plano.push({ ref: npcs.find(x => x.id === n.id) && db.collection('npcs').doc(n.id),
        nome: n.nome, FOR, DES, linhas, texto, x: linhas[0].x, grau: grauDe(linhas[0].x),
        antes: String(n.ataques || '').split(/\n|\|/)[0].trim() });
}

/* ── relatório ── */
console.log(`\n=== NPCs de Sereni · ataques em v3 (${plano.length}) ===\n`);
console.log(`Catálogo: ${armas.length} armas com dado de dano.\n`);
console.log('nome                          FOR DES  melhor golpe                          Alvo  dano     força   grau');
for (const p of plano.sort((a, b) => b.x - a.x)) {
    const l = p.linhas[0];
    console.log(`${p.nome.slice(0, 28).padEnd(29)} ${String(p.FOR).padStart(3)} ${String(p.DES).padStart(3)}  ${l.rot.slice(0, 36).padEnd(37)} ${String(l.alvo).padStart(3)}${l.transbordo ? '+' + l.transbordo : '  '}  ${(l.dado + '+' + p.FOR).padEnd(7)} ${vg(l.x)}×  ${p.grau}`);
}
console.log('\nExemplo do texto gravado:\n');
for (const p of plano.slice(0, 3)) console.log(`   ── ${p.nome}\n${p.texto.split('\n').map(s => '      ' + s).join('\n')}\n`);
if (semArma.size) {
    console.log(`⚠ Golpes descartados — não são arma com dado, ou o nome não casou (${semArma.size}):`);
    console.log('   ' + [...semArma].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
}
const semPericia = plano.filter(p => p.linhas[0].rot !== 'Desarmado' && p.linhas[0].nivel === 0);
if (semPericia.length) {
    console.log(`\n⚠ EMPUNHA A ARMA E NÃO TEM A PERÍCIA DELA (${semPericia.length}) — o Alvo sai só do atributo:`);
    for (const p of semPericia.sort((a, b) => b.x - a.x))
        console.log(`   ${p.nome.padEnd(29)} ${p.linhas[0].rot.padEnd(22)} ${p.linhas[0].per} 0 → Alvo ${p.linhas[0].alvo}`);
}
const zerados = plano.filter(p => p.FOR === 0 && p.DES === 0);
if (zerados.length) console.log(`\n⚠ Ficha com atributos zerados: ${zerados.map(p => p.nome).join(', ')}`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, { ataques: p.texto, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} fichas com ataques em v3.`);
process.exit(0);
