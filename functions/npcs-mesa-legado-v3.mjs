/**
 * As seis fichas de mesa que ficaram de fora de functions/npcs-legado-v3.mjs
 * porque estavam vinculadas a uma mesa em andamento. Autorizado pelo usuário
 * em 31/08/2026 a mexer nelas também.
 *
 * Mesma metodologia — Alvo = (FOR max DES) + perícia da arma, dado do
 * catálogo `system/data/equipment`, perícia do campo legado `skills` mapeada
 * pro catálogo (maior nível, teto 5) — com duas exceções deliberadas:
 *
 *   · GORREN-NHAR tem GARRAS, não arma de catálogo. O golpe físico
 *     ("Garras Soberanas") vira Alvo/dado normalmente (Briga + FOR), mas o
 *     dado FICA o que já estava escrito à mão ("3d10+7") — não se inventa
 *     dado de arma natural pra um bicho que não é de catálogo. As outras três
 *     linhas dele (Comando Abissal, Rugido do Soberano, Manto Protetor) NÃO
 *     são ataque físico — são teste de resistência (AUT vs Alvo já escrito)
 *     ou passivo, formato diferente e já correto. Ficam como estão.
 *   · VORATH é só rito — de oito linhas, só "Punhal Ritual" é golpe físico.
 *     As outras sete (Rasgo Abissal, Estilhaçar Causa, Salto pela Fenda,
 *     Ritual de Invocação, Selo Negativo, Visão do Fim, Onda de Loucura) não
 *     têm dado fixo de arma e ficam de fora do texto novo — mesmo tratamento
 *     dado à Véspera Língua-Negra em npcs-legado-v3.mjs.
 *
 *   node functions/npcs-mesa-legado-v3.mjs            (dry-run)
 *   node functions/npcs-mesa-legado-v3.mjs --apply
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
const TETO = 5;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const normArma = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; };
const vg = n => n.toFixed(2).replace('.', ',');
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

const NOMES = ["Gorren-Nhar, o Porteiro", "Vorath 'Fenda-Aberta'", "Seriva 'Véu Cinza'",
    "Arek 'Gêmeo do Véu'", "Rila 'Gêmea do Véu'", 'Vigia de Elite da Feira'];

/* ── perícia legado → catálogo, mesmo mapa de npcs-legado-v3.mjs ── */
const M = {
    'percepcao': 'Observação', 'negociacao': 'Barganha', 'intimidar': 'Intimidação',
    'persuasao': 'Diplomacia', 'enganacao': 'Malandragem', 'manipulacao': 'Malandragem',
    'contacao de historias': 'Performance', 'performance': 'Performance',
    'lider': 'Liderança', 'lideranca': 'Liderança', 'taticas': 'Liderança', 'tatica': 'Liderança',
    'combate corpo a corpo': 'Arma', 'arma': 'Arma',
    'arqueirismo': 'Disparo', 'disparo': 'Disparo',
    'atletismo': 'Atletismo', 'acrobacia': 'Agilidade',
    'briga': 'Briga', 'arremesso': 'Arremessar', 'arremessar': 'Arremessar',
    'agilidade': 'Agilidade', 'furtividade': 'Furtividade',
    'rastreamento': 'Sobrevivência', 'sobrevivencia': 'Sobrevivência',
    'herbalismo': 'Herbalismo', 'herbologia': 'Herbalismo',
    'resistencia': 'Resiliência', 'resistencia mental': 'Resiliência',
    'abismo': 'Abismancia', 'ritual (contato)': 'Abismancia', 'ritual (selo)': 'Abismancia',
    'contato com o oitavo': 'Abismancia', 'mistério': 'Abismancia', 'mistero': 'Abismancia',
    'uso de reliquias': 'Erudição', 'manobras (esquiva)': 'Reflexo',
    'prestidigitacao': 'Malandragem', 'venenos': 'Alquimancia',
};
const LIXO = /^(armas de |armaduras |escudos$|postura (ofensiva|de combate)|imobilizar|atordoar|investida|especializ|manobra|percepcao passiva)/i;

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, skills, equip] = await Promise.all([grab('npcs'), grab('system/data/skills'), grab('system/data/equipment')]);
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;
const skById = Object.fromEntries(skills.map(s => [s.id, s]));

const naoMapeados = new Map();
const pericias = {};
for (const nome of NOMES) {
    const doc = npcs.find(n => n.nome === nome);
    if (!doc) continue;
    const melhor = new Map(), de = new Map();
    for (const linha of String(doc.skills || '').split(/\n|\|/)) {
        const m = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ()'.\-]*?)\s+(\d+)/.exec(linha.trim());
        if (!m) continue;
        const bruto = m[1].trim(), nv = Math.min(TETO, Number(m[2]));
        if (LIXO.test(bruto)) continue;
        const destino = skPorNome[norm(bruto)] ? skPorNome[norm(bruto)].nome : M[norm(bruto)];
        if (!destino) { naoMapeados.set(bruto, (naoMapeados.get(bruto) || 0) + 1); continue; }
        const s = skPorNome[norm(destino)];
        if (!s) { naoMapeados.set(`${bruto} → "${destino}" NÃO EXISTE`, 1); continue; }
        melhor.set(s.id, Math.max(melhor.get(s.id) || 0, nv));
        de.set(s.id, [...(de.get(s.id) || []), bruto]);
    }
    /* Gorren-Nhar e Vigia já têm periciasEstruturadas reais — isso vence o legado */
    const jaTem = new Map((doc.periciasEstruturadas || []).filter(p => p.refId && Number(p.nivel) > 0)
        .map(p => [p.refId, Number(p.nivel)]));
    for (const [id, nv] of jaTem) melhor.set(id, Math.max(melhor.get(id) || 0, nv));
    pericias[nome] = {
        pericias: [...melhor].map(([refId, nivel]) => ({ refId, nivel })),
        detalhe: [...melhor].map(([id, nv]) => ({ nome: skById[id]?.nome || '???', nv, de: (de.get(id) || []).join(', ') })),
    };
}

/* ── ataques legado → v3 ── */
const PERICIA_DE = (nomeArma) => {
    const n = normArma(nomeArma);
    if (/^(soco|briga|desarmado|pancada|cabecada|joelhada|garra)/.test(n)) return 'Briga';
    if (/arremess/.test(n)) return 'Arremessar';
    if (/besta|arco|funda|dardo|virote/.test(n)) return 'Disparo';
    return 'Arma';
};
const armas = equip.filter(e => /arma/i.test(e.tipo || '') && e.formulaDano)
    .map(e => ({ nome: e.nome, dado: String(e.formulaDano).split('/')[0].trim(), n: normArma(e.nome) }));
const ALIAS = { 'adagas gemeas': 'Adaga', 'adaga dupla': 'Adaga', 'dardos arremessaveis': 'Dardo' };
const achaArma = (txt) => {
    const t = normArma(txt);
    if (!t) return null;
    if (ALIAS[t]) { const a = armas.find(x => x.n === normArma(ALIAS[t])); if (a) return a; }
    let melhor = null;
    for (const a of armas) {
        if (t === a.n) return a;
        if (t.includes(a.n) || a.n.includes(t)) if (!melhor || a.n.length > melhor.n.length) melhor = a;
    }
    return melhor;
};

/* linhas que já são teste-de-resistência ou passivo, não ataque físico —
   ficam FORA da extração de brutos e continuam intocadas no texto final */
const PRESERVAR = {
    'Gorren-Nhar, o Porteiro': [/^Comando Abissal/, /^Rugido do Soberano/, /^Manto Protetor/],
};
/* dado que já está escrito à mão e vence o do catálogo (arma natural, sem entrada em equipment) */
const DADO_FIXO = { 'Gorren-Nhar, o Porteiro': { 'Garras Soberanas': '3d10+7' } };

const plano = [], semArma = new Map(), descartadasGeral = [];
for (const nome of NOMES) {
    const doc = npcs.find(n => n.nome === nome);
    if (!doc) continue;
    const nivelDe = (nomePer) => {
        const s = skPorNome[norm(nomePer)];
        if (!s) return 0;
        const p = (pericias[nome]?.pericias || []).find(x => x.refId === s.id);
        return Number(p?.nivel) || 0;
    };
    const a = doc.atributos || {};
    const FOR = Number(a.FOR) || 0, DES = Number(a.DES) || 0;
    const preservar = PRESERVAR[nome] || [];
    const linhasOriginais = String(doc.ataques || '').split('\n').filter(Boolean);
    const preservadas = linhasOriginais.filter(l => preservar.some(rx => rx.test(l.trim())));

    const brutos = [], descartadas = [];
    for (let linha of linhasOriginais) {
        linha = linha.trim();
        if (preservar.some(rx => rx.test(linha))) continue;
        if (/^—/.test(linha)) continue;
        linha = linha.replace(/^[-•*]\s*/, '');
        /* "Flavor — Arma real (+N) = XdY" usa a parte depois do travessão; mas se a
           parte ANTES do travessão já tem uma definição completa ("(" ou "="), o
           travessão está separando texto de sabor DEPOIS, não o nome antes. */
        const partes = linha.split(/\s+—\s+/);
        const candidato = (partes.length > 1 && !/[(=]/.test(partes[0])) ? partes[1] : partes[0];
        const m = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ()'.\-]{2,40}?)\s*(?:\(|=|$)/.exec(candidato.trim());
        if (!m) { descartadas.push(linha.slice(0, 60)); continue; }
        const nomeGolpe = m[1].trim();
        if (!brutos.includes(nomeGolpe)) brutos.push(nomeGolpe);
    }

    const linhas = [];
    for (const bruto of brutos) {
        const per = PERICIA_DE(bruto);
        const desarmado = per === 'Briga' && !/garra/i.test(bruto);
        const natural = /garra/i.test(bruto);
        const arma = (desarmado || natural) ? null : achaArma(bruto);
        if (!desarmado && !natural && !arma) { semArma.set(bruto, (semArma.get(bruto) || 0) + 1); continue; }
        const dadoFixo = DADO_FIXO[nome]?.[bruto];
        const dado = dadoFixo || (desarmado ? '1d2' : arma.dado);
        const base = per === 'Disparo' || per === 'Arremessar' ? DES : Math.max(FOR, DES);
        const alvoCru = base + nivelDe(per);
        const alvo = Math.min(alvoCru, 9);
        const P = Math.max(0, Math.min((alvo - 1) / 10, 0.9));
        const liq = Math.max(1, medio(dadoFixo ? dadoFixo.split('+')[0] : dado) + (dadoFixo ? Number(dadoFixo.split('+')[1] || 0) : FOR) - 2);
        const rot = desarmado ? 'Desarmado' : natural ? bruto : arma.nome;
        const textoLinha = dadoFixo
            ? `${rot} (A. Padrão): Alvo ${alvo}${alvoCru > 9 ? ` (+${alvoCru - 9} Transbordo)` : ''}, ${dadoFixo}.`
            : `${rot} (A. Padrão): Alvo ${alvo}${alvoCru > 9 ? ` (+${alvoCru - 9} Transbordo)` : ''}, ${dado}+${FOR}.`;
        linhas.push({ rot, per, dado, alvoCru, alvo, transbordo: Math.max(0, alvoCru - 9),
            dpr: P * liq, x: P * liq / U, nivel: nivelDe(per), textoLinha });
    }
    if (!linhas.length && !preservadas.length) {
        const alvoCru = Math.max(FOR, DES) + nivelDe('Briga');
        const alvo = Math.min(alvoCru, 9);
        const P = Math.max(0, Math.min((alvo - 1) / 10, 0.9));
        linhas.push({ rot: 'Desarmado', per: 'Briga', dado: '1d2', alvoCru, alvo, transbordo: Math.max(0, alvoCru - 9),
            dpr: P * Math.max(1, 1.5 + FOR - 2), x: P * Math.max(1, 1.5 + FOR - 2) / U, nivel: nivelDe('Briga'),
            textoLinha: `Desarmado (A. Padrão): Alvo ${alvo}${alvoCru > 9 ? ` (+${alvoCru - 9} Transbordo)` : ''}, 1d2+${FOR}.` });
    }
    linhas.sort((p, q) => q.x - p.x);
    const texto = [...linhas.map(l => `${l.textoLinha}   [${l.per} ${l.nivel} + ${l.per === 'Disparo' || l.per === 'Arremessar' ? `DES ${DES}` : `FOR/DES ${Math.max(FOR, DES)}`}]`), ...preservadas].join('\n');

    plano.push({ ref: db.collection('npcs').doc(doc.id), nome, FOR, DES, linhas, texto, preservadas,
        x: linhas[0]?.x ?? 0, grau: linhas[0] ? grauDe(linhas[0].x) : '—',
        pericias: pericias[nome]?.pericias || [],
        antes: linhasOriginais.slice(0, 2).join(' | '),
    });
    if (descartadas.length) descartadasGeral.push({ nome, descartadas });
}

/* ── relatório ── */
console.log(`\n=== Seis fichas de mesa · notação legada → v3 (${plano.length}) ===\n`);
console.log('--- perícia legado → catálogo ---');
for (const nome of NOMES) {
    const p = pericias[nome];
    if (!p || !p.detalhe.length) { console.log(`── ${nome}: nenhuma perícia extraível`); continue; }
    console.log(`── ${nome}`);
    for (const d of p.detalhe.sort((x, y) => y.nv - x.nv)) console.log(`     ${d.nome.padEnd(18)} ${d.nv}   ← ${d.de || '(já cadastrada)'}`);
}
if (naoMapeados.size) {
    console.log(`\n⚠ Nomes de perícia não mapeados (${naoMapeados.size}): ` + [...naoMapeados].map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
}

console.log('\n--- ataques legado → v3 ---');
console.log('nome                          FOR DES  melhor golpe                       Alvo  dano       força   grau');
for (const p of plano) {
    const l = p.linhas[0];
    if (!l) { console.log(`${p.nome.padEnd(29)} — só linhas preservadas, sem golpe físico`); continue; }
    console.log(`${p.nome.slice(0, 28).padEnd(29)} ${String(p.FOR).padStart(3)} ${String(p.DES).padStart(3)}  ${l.rot.slice(0, 32).padEnd(33)} ${String(l.alvo).padStart(3)}${l.transbordo ? '+' + l.transbordo : '  '}  ${(l.dado.includes('+') ? l.dado : l.dado + '+' + p.FOR).padEnd(9)} ${vg(l.x)}×  ${p.grau}`);
}
console.log('\nTexto completo, ficha a ficha:\n');
for (const p of plano) console.log(`── ${p.nome}\n   de:   ${p.antes}\n${p.texto.split('\n').map(s => '   para: ' + s).join('\n')}\n`);

if (semArma.size) console.log(`⚠ Golpes descartados — sem dado de arma no catálogo (${semArma.size}):\n   ` + [...semArma].map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
if (descartadasGeral.length) {
    console.log(`\n⚠ Linhas não legíveis como golpe (formato não bate) — não viraram Alvo/dado:`);
    for (const d of descartadasGeral) console.log(`   ${d.nome}: ${d.descartadas.join(' · ')}`);
}
const semPericia = plano.filter(p => p.linhas[0] && p.linhas[0].rot !== 'Desarmado' && p.linhas[0].nivel === 0);
if (semPericia.length) {
    console.log(`\n⚠ Empunha a arma e a perícia dela está em 0 — Alvo sai só do atributo (${semPericia.length}):`);
    for (const p of semPericia) console.log(`   ${p.nome.padEnd(24)} ${p.linhas[0].rot.padEnd(20)} ${p.linhas[0].per} 0 → Alvo ${p.linhas[0].alvo}`);
}

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    periciasEstruturadas: p.pericias, ataques: p.texto, schemaVersion: 2, lastUpdate: iso, lastUpdateBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ ${plano.length} fichas de mesa migradas para v3.`);
process.exit(0);
