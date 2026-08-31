/**
 * NPCs fora de Sereni ainda em notação pré-v3 — item 3 do handoff do Bestiário.
 *
 * A varredura achou 16 fichas com `ataques` no formato de pool antigo
 * ("Nome (+N) = XdY"), não 50 como o handoff estimava. Seis têm mesaId
 * preenchido (mesa em andamento — Gorren-Nhar, Vorath, Seriva, Arek, Rila,
 * Vigia de Elite da Feira) e ficam de fora: não se mexe em ficha de mesa em
 * andamento sem perguntar. As dez que sobram são os cinco filhos Attak
 * (Rukran/Uqatá) e quatro vilões avulsos (Primus Romus, Noctal Sem-Rosto,
 * Ravka Juba-Negra, Véspera Língua-Negra) mais Selith.
 *
 * MESMA METODOLOGIA das quatro passadas de Sereni (functions/sereni-npcs-0*.mjs),
 * em duas passadas:
 *
 *   A. Perícia — campo legado `skills` (texto "Nome N") mapeado para o
 *      catálogo `system/data/skills`. Vale o MAIOR nível, nunca a soma; teto 5;
 *      especialização e manobra são descartadas, não mapeadas. Perícia já
 *      cadastrada em `periciasEstruturadas` vence o legado.
 *   B. Ataques — Alvo = (FOR max DES) + a perícia que a arma usa, preso em 9;
 *      dano = dado do CATÁLOGO `system/data/equipment` + FOR. O nome da arma
 *      sai do texto legado; arma que não existe no catálogo é descartada, não
 *      inventada.
 *
 * DUAS DIFERENÇAS DESTES DEZ CONTRA SERENI, por isso não reusei o script:
 *
 *   1. Essas fichas de vilão/boss têm manobra nomeada por cima da arma
 *      ("Dente de Biltrox — Machado de Guerra 2 mãos (+4)", "- Lança de
 *      Legado (+5)"). O extrator de nome de Sereni não lida com travessão nem
 *      com marcador de lista — ele simplesmente não casava a linha e a
 *      descartava em silêncio. Aqui o nome é tirado depois do travessão
 *      quando ele existe, e o marcador de lista é removido antes.
 *   2. Capacidades condicionais (golpe furtivo que ignora Blindagem, rajada
 *      que ignora Reação, ritual abissal, comando de tropa) não têm dado fixo
 *      e não entram na régua — ficam FORA do texto novo e são listadas no
 *      relatório, não apagadas do histórico da ficha (RITO DE DOMA já ensinou
 *      isso: o que não cabe em Alvo/dado fica em prosa, em outro campo, não é
 *      inventado um número para ele).
 *
 * Selith não ganha perícia de arma pelo papel (regra dos guardas de Sereni) —
 * ela é Druida sem treino de arma no legado, e isso é característico, não
 * lacuna. O Alvo dela sai só do atributo.
 *
 *   node functions/npcs-legado-v3.mjs            (dry-run)
 *   node functions/npcs-legado-v3.mjs --apply
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

/* ── as 16 fichas ainda em notação de pool antiga; 6 têm mesa e não se mexe ── */
const NOMES_ALVO = ['Tavek Attak', 'Zurak Attak', 'Nihak Attak', 'Korak Attak', 'Vexia Naira Attak',
    'Primus Romus', 'Noctal Sem-Rosto', 'Ravka Juba-Negra', 'Véspera Língua-Negra', 'Selith'];
const NOMES_MESA = ['Gorren-Nhar, o Porteiro', "Vorath 'Fenda-Aberta'", "Seriva 'Véu Cinza'",
    "Arek 'Gêmeo do Véu'", "Rila 'Gêmea do Véu'", 'Vigia de Elite da Feira'];

/* ═══════════════ PASSO A — perícia legado → catálogo ═══════════════
   Mesmo mapa de functions/sereni-npcs-02-pericias.mjs, verbatim: mesmo
   catálogo, mesma régua (maior nível, teto 5, especialização fora). */
const M = {
    'percepcao': 'Observação', 'percepcao social': 'Observação', 'percepcao aguçada': 'Observação',
    'vigilancia': 'Observação', 'acustica': 'Observação',
    'negociacao': 'Barganha', 'avaliacao': 'Barganha', 'contabilidade': 'Barganha',
    'intimidar': 'Intimidação', 'tortura': 'Intimidação', 'interrogatorio': 'Intimidação',
    'persuasao': 'Diplomacia', 'labia': 'Diplomacia', 'oratoria': 'Diplomacia',
    'enganacao': 'Malandragem', 'falsificacao': 'Malandragem', 'manipulacao': 'Malandragem',
    'deteccao de mentiras': 'Empatia', 'leitura social': 'Empatia', 'empat': 'Empatia', 'empata': 'Empatia',
    'contacao de historias': 'Performance', 'performance': 'Performance', 'perform': 'Performance',
    'etiqueta': 'Tradição', 'religiao': 'Tradição', 'teologia': 'Tradição', 'cultura famo': 'Tradição',
    'lider': 'Liderança', 'lideranca': 'Liderança', 'taticas': 'Liderança', 'tatica': 'Liderança',
    'estrategia': 'Liderança', 'administracao': 'Liderança', 'disciplina': 'Liderança',
    'manejo de animais': 'Domar',
    'combate corpo a corpo': 'Arma', 'punhal': 'Arma', 'armas leves': 'Arma', 'arma': 'Arma',
    'arqueirismo': 'Disparo', 'arquearia': 'Disparo', 'disparo': 'Disparo',
    'forca bruta': 'Atletismo', 'escalada': 'Atletismo', 'natacao': 'Atletismo', 'atlet': 'Atletismo',
    'atletismo': 'Atletismo',
    'briga de bar': 'Briga', 'briga': 'Briga', 'arremesso': 'Arremessar', 'arremessar': 'Arremessar',
    'cavalear': 'Montaria', 'combate montado': 'Montaria', 'montaria': 'Montaria',
    'agili': 'Agilidade', 'agilidade': 'Agilidade', 'furti': 'Furtividade', 'furtividade': 'Furtividade',
    'silencio': 'Furtividade',
    'rastreamento': 'Sobrevivência', 'sobrev': 'Sobrevivência', 'sobrevivencia': 'Sobrevivência',
    'exploracao': 'Sobrevivência', 'forrageiro': 'Sobrevivência', 'forrageiro especialista': 'Sobrevivência',
    'rastreamento natural': 'Sobrevivência', 'percepcao natural': 'Sobrevivência',
    'conhecimento de flora': 'Erudição', 'percepcao da contaminacao': 'Observação',
    'pesca': 'Labuta', 'olaria': 'Labuta', 'ferraria basica': 'Labuta', 'culinaria': 'Labuta',
    'ofício': 'Labuta', 'oficio': 'Labuta',
    'defesa com escudo': 'Bloquear', 'escudo': 'Bloquear', 'postura defensiva': 'Bloquear',
    'reacao rapida': 'Reflexo',
    'engenharia': 'Erudição', 'cartografia': 'Erudição', 'direito': 'Erudição', 'burocracia': 'Erudição',
    'politica': 'Erudição', 'escrita e leitura': 'Erudição', 'decifracao': 'Erudição',
    'criptografia': 'Erudição', 'conhec': 'Erudição', 'conhecimento': 'Erudição',
    'historia local': 'História', 'historia': 'História',
    'medicina': 'Anatomia', 'cirurgia': 'Anatomia', 'diagnostico': 'Anatomia', 'primeiros socorros': 'Anatomia',
    'herbologia': 'Herbalismo', 'herbalismo': 'Herbalismo', 'identificacao de plantas': 'Herbalismo',
    'cura com ervas': 'Herbalismo', 'toxicologia': 'Herbalismo', 'comunicacao com plantas': 'Herbalismo',
    'alquimia': 'Alquimancia', 'preparo de pocoes': 'Alquimancia',
    'resistencia': 'Resiliência', 'resistencia a loucura': 'Resiliência', 'meditacao': 'Resiliência',
    'concentracao': 'Resiliência',
    'conhecimento arcano': 'Fluxomancia', 'percepcao mistica': 'Fluxomancia', 'rituais': 'Fluxomancia',
    'rituais basicos': 'Fluxomancia', 'fluxomancia': 'Fluxomancia', 'magia natural': 'Fluxomancia',
    'abismo': 'Abismancia', 'abismancia': 'Abismancia', 'contato com o oitavo': 'Abismancia',
    'selo abissal': 'Abismancia', 'sacrificio': 'Abismancia', 'talisma abissal': 'Abismancia',
    'ecos do vazio': 'Abismancia',
    'runas antigas': 'Runomancia',
    'armadilhas': 'Arrombamento', 'ferramentas do crime': 'Arrombamento', 'arrombamento': 'Arrombamento',
    'conhecimento (submundo)': 'Submundo', 'rede de contatos': 'Submundo',
    'visoes profeticas': 'Sexto Sentido', 'presciencia': 'Sexto Sentido',
    'rituais de palla': 'Devoção em Palla', 'cura pela luz': 'Devoção em Palla',
    'cura mistica': 'Comunhão com Ecos', 'rituais de cura': 'Comunhão com Ecos',
};
const LIXO = /^(armas de |armaduras |escudos$|postura (ofensiva|de combate)|imobilizar|atordoar|investida|romper defesa|golpe giratorio|—|-\s*per|especializ|manobra|ambidestria|contra-ataque|impeto|controle$)/i;

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, skills, equip] = await Promise.all([grab('npcs'), grab('system/data/skills'), grab('system/data/equipment')]);
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;

const naoMapeados = new Map();
const pericias = {};   // nome do NPC → { pericias: [...], detalhe: [...] }
for (const nomeAlvo of [...NOMES_ALVO, ...NOMES_MESA]) {
    const doc = npcs.find(n => n.nome === nomeAlvo);
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
    const jaTem = new Map((doc.periciasEstruturadas || []).filter(p => p.refId && Number(p.nivel) > 0)
        .map(p => [p.refId, Number(p.nivel)]));
    for (const [id, nv] of jaTem) melhor.set(id, Math.max(melhor.get(id) || 0, nv));
    pericias[nomeAlvo] = {
        pericias: [...melhor].map(([refId, nivel]) => ({ refId, nivel })),
        detalhe: [...melhor].map(([id, nv]) => ({ nome: skills.find(s => s.id === id).nome, nv, de: (de.get(id) || []).join(', ') })),
    };
}

/* ═══════════════ PASSO B — ataques legado → v3 ═══════════════ */
const PERICIA_DE = (nomeArma) => {
    const n = normArma(nomeArma);
    if (/^(soco|briga|desarmado|pancada|cabecada|joelhada)/.test(n)) return 'Briga';
    if (/arremess/.test(n)) return 'Arremessar';
    if (/besta|arco|funda|dardo|virote/.test(n)) return 'Disparo';
    return 'Arma';
};
const armas = equip.filter(e => /arma/i.test(e.tipo || '') && e.formulaDano)
    .map(e => ({ nome: e.nome, dado: String(e.formulaDano).split('/')[0].trim(), n: normArma(e.nome) }));
const ALIAS = {
    'martelo de forja': 'Maça de Armas', 'ferpa dupla': 'Ferpa Uqatá', 'ferpa de treino': 'Ferpa Uqatá',
    'farpa cerimonial': 'Farpa Uqatá', 'facas de arremesso': 'Faca de Arremesso', 'ferrao curto': 'Ferrão Uqatá',
    'cajado de carvalho': 'Bordão', 'gladio pesado': 'Espada de Infantaria', 'pilum': 'Azagaia',
    'adaga curva negra': 'Adaga', 'adaga ritual': 'Adaga', 'faca ritual': 'Faca',
};
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

const semArma = new Map();
const plano = [];
for (const nomeAlvo of NOMES_ALVO) {
    const doc = npcs.find(n => n.nome === nomeAlvo);
    if (!doc) continue;
    const nivelDe = (nomePer) => {
        const s = skPorNome[norm(nomePer)];
        if (!s) return 0;
        const p = (pericias[nomeAlvo]?.pericias || []).find(x => x.refId === s.id);
        return Number(p?.nivel) || 0;
    };
    const a = doc.atributos || {};
    const FOR = Number(a.FOR) || 0, DES = Number(a.DES) || 0;

    const brutos = [], descartadas = [];
    for (let linha of String(doc.ataques || '').split('\n')) {
        linha = linha.trim();
        if (!linha) continue;
        if (/^—/.test(linha)) continue;                          // sub-linha de fórmula/explicação
        linha = linha.replace(/^[-•*]\s*/, '');                  // marcador de lista
        const partes = linha.split(/\s+—\s+/);
        const candidato = partes.length > 1 ? partes[1] : partes[0];  // "Flavor — Arma real" usa a arma real
        const m = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ()'.\-]{2,40}?)\s*(?:\(|=|$)/.exec(candidato.trim());
        if (!m) { descartadas.push(linha.slice(0, 50)); continue; }
        const nome = m[1].trim();
        if (!brutos.includes(nome)) brutos.push(nome); else continue;
    }

    const linhas = [];
    for (const bruto of brutos) {
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
        const jaUsado = linhas.some(l => l.rot === arma?.nome);
        const rot = desarmado ? 'Desarmado' : (jaUsado ? `${arma.nome} (${per})` : arma.nome);
        linhas.push({ rot, per, dado, alvoCru, alvo,
            transbordo: Math.max(0, alvoCru - 9), dpr: P * liq, x: P * liq / U, nivel: nivelDe(per) });
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

    plano.push({
        ref: doc.id && db.collection('npcs').doc(doc.id), nome: nomeAlvo, FOR, DES, linhas, texto,
        x: linhas[0].x, grau: grauDe(linhas[0].x), descartadasSemAlvo: descartadas,
        pericias: pericias[nomeAlvo]?.pericias || [],
        antes: String(doc.ataques || '').split('\n').filter(Boolean).slice(0, 2).join(' | '),
    });
}

/* ═══════════════ relatório ═══════════════ */
console.log(`\n=== NPCs fora de Sereni · notação legada → v3 (${plano.length} de ${NOMES_ALVO.length} alvos) ===\n`);
console.log(`Ignoradas por mesa em andamento (${NOMES_MESA.length}): ${NOMES_MESA.join(', ')}\n`);

console.log('--- Passo A: perícia legado → catálogo ---');
for (const nomeAlvo of NOMES_ALVO) {
    const p = pericias[nomeAlvo];
    if (!p || !p.detalhe.length) { console.log(`── ${nomeAlvo}: nenhuma perícia extraível`); continue; }
    console.log(`── ${nomeAlvo}`);
    for (const d of p.detalhe.sort((x, y) => y.nv - x.nv)) console.log(`     ${d.nome.padEnd(18)} ${d.nv}   ← ${d.de}`);
}
if (naoMapeados.size) {
    console.log(`\n⚠ Nomes de perícia não mapeados — ignorados, não chutados (${naoMapeados.size}):`);
    console.log('   ' + [...naoMapeados].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
}

console.log('\n--- Passo B: ataques legado → v3 ---');
console.log('nome                          FOR DES  melhor golpe                       Alvo  dano     força   grau');
for (const p of plano) {
    const l = p.linhas[0];
    console.log(`${p.nome.slice(0, 28).padEnd(29)} ${String(p.FOR).padStart(3)} ${String(p.DES).padStart(3)}  ${l.rot.slice(0, 32).padEnd(33)} ${String(l.alvo).padStart(3)}${l.transbordo ? '+' + l.transbordo : '  '}  ${(l.dado + '+' + p.FOR).padEnd(7)} ${vg(l.x)}×  ${p.grau}`);
}
console.log('\nTexto completo gravado, ficha a ficha:\n');
for (const p of plano) console.log(`── ${p.nome}\n   de:   ${p.antes}\n${p.texto.split('\n').map(s => '   para: ' + s).join('\n')}\n`);

if (semArma.size) {
    console.log(`⚠ Golpes descartados do texto novo — sem dado de arma no catálogo (${semArma.size}):`);
    console.log('   ' + [...semArma].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
}
const comCapacidade = plano.filter(p => p.descartadasSemAlvo.length);
if (comCapacidade.length) {
    console.log(`\n⚠ Capacidades condicionais fora da régua (sem dado fixo — não apagadas da história da ficha, só não vão para o texto de ataque):`);
    for (const p of comCapacidade) console.log(`   ${p.nome}: ${p.descartadasSemAlvo.join(' · ')}`);
}
const semPericia = plano.filter(p => p.linhas[0].rot !== 'Desarmado' && p.linhas[0].nivel === 0);
if (semPericia.length) {
    console.log(`\n⚠ Empunha a arma e a perícia dela está em 0 — o Alvo sai só do atributo (${semPericia.length}):`);
    for (const p of semPericia) console.log(`   ${p.nome.padEnd(24)} ${p.linhas[0].rot.padEnd(20)} ${p.linhas[0].per} 0 → Alvo ${p.linhas[0].alvo}`);
}

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    periciasEstruturadas: p.pericias, ataques: p.texto, schemaVersion: 2, lastUpdate: iso, lastUpdateBy: AUTOR,
});
await batch.commit();
console.log(`\n✅ ${plano.length} fichas migradas para v3.`);
process.exit(0);
