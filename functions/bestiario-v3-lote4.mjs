/**
 * v3 · LOTE 4 — céu e campo aberto.
 *
 *   Águia Tempestuosa → FÚLGORA          Séria  1,35×   predadora aérea, territorial
 *   Lobo Espectral    → PASSA-CERCA      Comum  0,69×   matilha etérea
 *   Rei-Coveiro                          Praga  0,19×   carniceiro covarde
 *
 * Renomeia as duas primeiras (nomes aprovados) e traduz as três para v3, com a
 * Altura no override para a Vitalidade sair da fórmula.
 *
 * DECISÕES QUE MERECEM CONFERÊNCIA:
 *
 *  · A Fúlgora fica com VIG 8. Eu tinha proposto baixar para 4, você respondeu
 *    preocupado com a Vitalidade cair — então mantive. Com Altura 1,2 ela fica em
 *    34,8, e não em 22,8. Ela segue mais resistente que o Urso, o que é estranho
 *    para uma ave, mas é o dado que estava lá e não é meu para mudar.
 *
 *  · O Passa-Cerca ganha DOIS golpes de valor idêntico: a Mordida (1d4+4) e as
 *    Garras (1d4+2, IGNORA BLINDAGEM). Contra alvo sem armadura a mordida rende
 *    mais; contra alvo blindado, as garras. Mesmo 0,69× nos dois — é escolha de
 *    alvo, não escada de poder. Ignorar Blindagem vale +0,3× contra o defensor
 *    de referência, e é por isso que as garras levam dado menor.
 *
 *  · O Passa-Cerca entrou como DOMÁVEL, seguindo a regra universal do capítulo.
 *    Domar um canídeo etéreo com AUT + Domar é discutível — se ele devia ser
 *    indomável como o magífago e o necrófago, me diga e eu troco.
 *
 *   node functions/bestiario-v3-lote4.mjs            (dry-run)
 *   node functions/bestiario-v3-lote4.mjs --apply
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
/* bldAlvo = Blindagem do defensor de referência que este golpe enfrenta (0 se ignora) */
const dprDe = (alvo, dado, bon, bldAlvo = 2) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    const liq = Math.max(1, medio(dado) + bon - bldAlvo);
    return { P, liq, dpr: P * liq };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');
const DOMA = {
    'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4],
};
const clausula = (grau) => {
    const [r, ini, lim, ritmo] = DOMA[grau];
    const falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${grau} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo`
                 : ' — já nasce vinculada');
};

const LOTE = [
    { de: ['Águia Tempestuosa', 'Fúlgora'], para: 'Fúlgora',
      grauAlvo: 'Séria', altura: 1.2, bld: 0,
      golpe: ['Garras Eletrizadas', 8, '1d10', 4, 2],
      ataques: 'Garras Eletrizadas (A. Padrão): Alvo 8, 1d10+4 e Faísca — o alvo perde a Reação até o fim do turno dele.\n'
        + 'Bicada Metálica (A. Padrão): Alvo 8, 1d8+4, e ignora 2 de Blindagem.\n'
        + 'Mergulho (A. Padrão; só em voo, exige 10 m de altura): Alvo 9, 1d10+4 e Derrubada.\n'
        + 'Rajada de Raios (A. Padrão, linha de 20 m): Alvo 7, 1d8 Eólico.',
      densidade: '1 por território — não divide céu com outra',
      nota: 'defende o ninho antes de defender a si mesma' },

    { de: ['Lobo Espectral das Pradarias', 'Passa-Cerca'], para: 'Passa-Cerca',
      grauAlvo: 'Comum', altura: 1.0, bld: 0,
      golpe: ['Mordida Espectral', 7, '1d4', 4, 2],
      ataques: 'Mordida Espectral (A. Padrão): Alvo 7, 1d4+4.\n'
        + 'Garras Fantasmagóricas (A. Padrão): Alvo 7, 1d4+2, e IGNORA Blindagem — contra alvo armado de placa, é este o golpe.\n'
        + 'Uivo Aterrorizante (A. Padrão, área 15 m): Alvo 6, 1d4 em Sanidade e Medo.\n'
        + 'Matilha: +1 de Alvo para cada aliado adjacente ao mesmo alvo.\n'
        + 'Fase Etérea: atravessa objeto sólido ao se mover. Não é isso que a protege — ela é frágil.',
      densidade: 'matilha de 4 a 8; sozinha ela recua',
      nota: 'sua cerca não serve, sua parede não serve; o que serve é luz e companhia' },

    { de: ['Rei-Coveiro'], para: 'Rei-Coveiro',
      grauAlvo: 'Praga', altura: 0.9, bld: 0,
      golpe: ['Bico Curvo', 6, '1d4', 1, 2],
      ataques: 'Bico Curvo (A. Padrão): Alvo 6, 1d4+1.\n'
        + 'Vômito Defensivo (A. Padrão, cone 3 m): Alvo 5, 1d4 e Náusea — o alvo não corre até o fim do turno seguinte.\n'
        + 'Covarde: não inicia briga com quem está de pé. Ataca ferido, caído e morto — nessa ordem.',
      densidade: 'bando de 3 a 10 sobre a mesma carcaça',
      nota: 'onde ele pousa, alguma coisa morreu — e ele chega antes do cheiro' },
];

const npcs = (await db.collection('npcs').get()).docs;
const erros = [];

for (const c of LOTE) {
    const achados = npcs.filter(d => c.de.includes(d.data().nome || ''));
    if (achados.length !== 1) { erros.push(`${c.de.join(' / ')}: ${achados.length} docs`); continue; }
    const n = achados[0].data();
    c.ref = achados[0].ref; c.doc = n; c.nomeAtual = n.nome;
    const [, alvo, dado, bon, bldAlvo] = c.golpe;
    const forAtt = Number(n.atributos?.FOR) || 0, des = Number(n.atributos?.DES) || 0, vig = Number(n.atributos?.VIG) || 0;
    Object.assign(c, dprDe(alvo, dado, bon, bldAlvo));
    c.x = c.dpr / U;
    c.grau = grauDe(c.x);
    c.vitAntes = Number(n.valoresDer?.VIT) || 0;
    c.vitDepois = (vig + c.altura * 3) * 3;
    c.vig = vig;
    c.pericia = alvo - Math.max(forAtt, des);
    if (c.grau !== c.grauAlvo) erros.push(`${c.para}: ${vg(c.x)}× cai em ${c.grau}, não em ${c.grauAlvo}`);
    if (bon > forAtt) erros.push(`${c.para}: bônus +${bon} acima de FOR ${forAtt}`);
    if (c.pericia > 5 || c.pericia < 0) erros.push(`${c.para}: Alvo ${alvo} exigiria perícia ${c.pericia}`);
    const duelo = c.vitDepois / (0.6 * Math.max(1, 8.5 - c.bld));
    if (duelo > 10.5) erros.push(`${c.para}: ${duelo.toFixed(1)} rodadas em duelo, acima do teto de 10`);
    c.duelo = duelo;
    c.rodGrupo = duelo / 4;
    c.ameaca = [c.grau, `${vg(c.x)}×`, c.densidade, clausula(c.grau), c.nota].join(' · ');
}

/* Garras do Passa-Cerca: confere que ignorar Blindagem não desequilibra */
const pc = LOTE.find(c => c.para === 'Passa-Cerca');
if (pc?.ref) {
    const garras = dprDe(7, '1d4', 2, 0);
    pc.garrasX = garras.dpr / U;
    if (Math.abs(pc.garrasX - pc.x) > 0.06)
        erros.push(`Passa-Cerca: garras ${vg(pc.garrasX)}× contra mordida ${vg(pc.x)}× — deviam empatar`);
}

/* ── relatório ── */
console.log('\n=== v3 · LOTE 4 — céu e campo aberto ===\n');
console.log('nome           Alvo  dano     P     líq    DPR    força    grau     VIG  Altura  Vit          duelo / grupo de 4');
for (const c of LOTE) {
    if (!c.ref) continue;
    const [, alvo, dado, bon] = c.golpe;
    console.log(`${c.para.padEnd(14)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(7)} ${c.P.toFixed(2)}  ${c.liq.toFixed(1).padStart(5)}  ${c.dpr.toFixed(2).padStart(5)}  ${vg(c.x)}×  ${c.grau.padEnd(7)} ${String(c.vig).padStart(3)}  ${String(c.altura).padStart(4)} m  ${String(c.vitAntes).padStart(4)}→${c.vitDepois.toFixed(1).padStart(5)}  ${c.duelo.toFixed(1)} / ${c.rodGrupo.toFixed(1)}`);
}
console.log('\nRenomeações:');
for (const c of LOTE) if (c.ref) console.log(`   ${c.nomeAtual === c.para ? '(já é)' : c.nomeAtual + '  →'} ${c.para}`);
if (pc?.ref) console.log(`\nPassa-Cerca — os dois golpes empatam: mordida ${vg(pc.x)}× · garras que ignoram Blindagem ${vg(pc.garrasX)}×`);
console.log('\nAtaques:');
for (const c of LOTE) if (c.ref) { console.log(`\n   ${c.para}`); for (const l of c.ataques.split('\n')) console.log(`      ${l}`); }
console.log('\nNível de Ameaça:');
for (const c of LOTE) if (c.ref) console.log(`\n   ${c.para}\n      de:   ${c.doc.criatura?.nivelAmeaca || '(vazio)'}\n      para: ${c.ameaca}`);
if (pc?.ref) console.log(`\n   Matilha de 6 Passa-Cerca = ${vg(6 * pc.x)}× e ${(6 * pc.vitDepois).toFixed(0)} de carne, contra os 4,0× e 72 de um grupo de quatro.`);

/* fichas que sobraram em notação antiga */
const legado = npcs.filter(d => /\(\+\d+\)\s*=\s*\d+d10/.test(String(d.data().ataques || '')));
console.log(`\n\nAinda em notação antiga depois deste lote: ${legado.filter(d => !LOTE.some(c => c.ref?.id === d.id)).map(d => d.data().nome).join(', ') || 'nenhuma'}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const c of LOTE) {
    const vd = c.doc.valoresDer || {};
    const overrides = { ...(vd.overrides || {}), [ALTURA_VD]: c.altura };
    delete overrides.VIT;
    batch.update(c.ref, {
        nome: c.para, schemaVersion: 2, modoFicha: 'mecanico',
        ataques: c.ataques, 'criatura.nivelAmeaca': c.ameaca,
        valoresDer: { ...vd, overrides, atual: vd.atual || {}, extras: vd.extras || [],
            VIT: c.vitDepois, BLD: c.bld },
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
}
await batch.commit();
console.log(`\n✅ ${LOTE.length} fichas traduzidas e renomeadas.`);
process.exit(0);
