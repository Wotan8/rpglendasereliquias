/**
 * v3 · LOTE 5 — subsolo e escuridão. Fecha o bestiário fora as de mesa.
 *
 *   Vidrela      Séria  1,15×   emboscadora de caverna
 *   Górbal       Grave  1,88×   perfurador; Carne Dura Nv4 responde pelo comprimento
 *   Apaga-Lume   Séria  0,81×   apaga a luz, e a luz forte a mata
 *
 * Mais dois acertos pedidos:
 *   · Fúlgora vai a VIG 4 → Vitalidade 22,8.
 *   · Rei-Coveiro não é fraco: ele é forte e ESPERA. O golpe base fica em 0,69×
 *     (Comum) contra quem está de pé, e sobe para 1,33× (Séria) contra alvo
 *     Prostrado, Atordoado ou abaixo de metade da Vitalidade. FOR 1 → 4: um
 *     necrófago que abre carcaça não tem força de passarinho. O Grau carimbado é
 *     o de cima, porque é o que a mesa encontra quando alguém cai.
 *
 * BLINDAGEM: Vidrela vinha com 4 e Górbal com 8. O teto é 3,90 (arnês pesado
 * completo, Grau 1). Ambos caem para 3 e viram Pele Dura Nv3.
 *
 *   node functions/bestiario-v3-lote5.mjs            (dry-run)
 *   node functions/bestiario-v3-lote5.mjs --apply
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
const dprDe = (alvo, dado, bon, bldAlvo = 2) => {
    const P = Math.max(0, Math.min((Math.min(alvo, 9) - 1) / 10, 0.9));
    const liq = Math.max(1, medio(dado) + bon - bldAlvo);
    return { P, liq, dpr: P * liq };
};
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const vg = n => n.toFixed(2).replace('.', ',');
const DOMA = { 'Inofensiva': [0, 6, 4, 1], 'Praga': [-1, 5, 5, 1], 'Comum': [-1, 4, 6, 1],
    'Séria': [-3, 3, 8, 2], 'Grave': [-5, 2, 10, 3], 'Calamidade': [-7, 1, 10, 4] };
const clausula = g => {
    const [r, ini, lim, ritmo] = DOMA[g], falta = Math.max(0, lim - ini);
    return `Domável: AUT + Domar, dificuldade ${g} (Redutor ${r === 0 ? '0' : '−' + Math.abs(r)}) · `
        + `Lealdade começa em ${ini}, vínculo exige ${lim}`
        + (falta ? ` — ${falta} ponto${falta > 1 ? 's' : ''} a cada ${ritmo} ${ritmo > 1 ? 'sessões' : 'sessão'}, ${falta * ritmo} sessões ao todo` : ' — já nasce vinculada');
};

const LOTE = [
    { nome: 'Vidrela', grauAlvo: 'Séria', altura: 1.0, bld: 3, pele: 3,
      golpe: ['Quelíceras Cristalinas', 7, '1d10', 4],
      ataques: 'Quelíceras Cristalinas (A. Padrão): Alvo 7, 1d10+4 e Veneno Cristalizante — 2 de dano '
        + 'por rodada, por 3 rodadas; enquanto durar, o alvo tem −1 de Deslocamento.\n'
        + 'Pernas Laminadas (A. Padrão): Alvo 7, 1d8+4 cortante.\n'
        + 'Teia Cortante (A. Padrão, 8 m): Alvo 6, prende. FOR Alvo 4 para se soltar; quem forçar leva 1d4.\n'
        + 'Emboscadora: se atacar antes de ser vista, o primeiro golpe é Alvo 9.',
      densidade: 'solitária, uma por galeria',
      nota: 'ouve pela vibração; grito e passo pesado a trazem' },

    { nome: 'Górbal', grauAlvo: 'Grave', altura: 1.0, bld: 3, pele: 3, carneDura: 2,
      golpe: ['Mandíbulas Perfuradoras', 8, '1d12', 6],
      ataques: 'Mandíbulas Perfuradoras (A. Padrão): Alvo 8, 1d12+6 e Dilacerar — a peça de armadura '
        + 'atingida perde 1 de Blindagem até ser consertada.\n'
        + 'Golpe de Cauda (A. Padrão, área 3 m): Alvo 7, 1d8+6 e Derrubada.\n'
        + 'Engolir (A. Padrão, só contra alvo Agarrado): Alvo 8, 1d12+6 por rodada, sem Blindagem.\n'
        + 'Tremor Sísmico (A. Padrão, 6 m): Alvo 6, sem dano — todos no chão testam DES Alvo 4 ou caem.\n'
        + 'Perfura rocha a 4 m por rodada. Não persegue à superfície.',
      densidade: 'solitário; o túnel é dele',
      nota: '2 m quando novo, 8 m quando velho — a Carne Dura é o comprimento que a altura não conta' },

    { nome: 'Apaga-Lume', grauAlvo: 'Séria', altura: 2.0, bld: 0,
      golpe: ['Toque da Escuridão', 8, '1d8', 2],
      ataques: 'Toque da Escuridão (A. Padrão): Alvo 8, 1d8+2 e Dreno de Luz — apaga a chama mais '
        + 'próxima do alvo, tocha, lampião ou vela.\n'
        + 'Tentáculos Umbrais (A. Padrão, 4 m): Alvo 7, 1d6+2.\n'
        + 'Sufocar em Trevas (A. Padrão, só contra alvo Agarrado): Alvo 8, 1d6+2 por rodada; o alvo não respira.\n'
        + 'Absorção: cura metade do dano que causa, enquanto estiver no escuro.\n'
        + 'FRAQUEZA — luz intensa: sob chama grande, fogueira ou luz de Palla, perde a Absorção e '
        + 'sofre dano dobrado. É por isso que se anda com tocha, e é por isso que ela apaga a sua.',
      densidade: 'solitária',
      nota: 'o remédio é a luz que ela tira primeiro' },
];

/* ── ajustes avulsos ── */
const AVULSOS = {
    'Fúlgora': { vig: 4, motivo: 'VIG 8 → 4' },
    'Rei-Coveiro': { forNovo: 4, grauAlvo: 'Séria',
        golpe: ['Bico Curvo contra presa incapacitada', 9, '1d8', 4],
        base: [7, '1d4', 4],
        ataques: 'Bico Curvo (A. Padrão): Alvo 7, 1d4+4.\n'
          + 'CONTRA ALVO PROSTRADO, ATORDOADO OU ABAIXO DE METADE DA VITALIDADE: Alvo 9, 1d8+4. '
          + 'É para isso que ele espera.\n'
          + 'Vômito Defensivo (A. Padrão, cone 3 m): Alvo 6, 1d4+4 e Náusea — o alvo não corre até o '
          + 'fim do turno seguinte.\n'
          + 'Não inicia briga com quem está de pé. Não é medo: é economia.',
        densidade: 'bando de 3 a 10 sobre a mesma carcaça',
        nota: 'onde ele pousa, alguma coisa morreu — e ele chega antes do cheiro' },
};

const grab = async c => (await db.collection(c).get()).docs;
const [npcs, pecs] = await Promise.all([grab('npcs'), grab('system/data/peculiarities')]);
const erros = [];
const um = n => npcs.filter(d => (d.data().nome || '') === n);
const pecId = n => { const d = pecs.filter(x => (x.data().nome || '') === n); if (d.length !== 1) erros.push(`peculiaridade "${n}": ${d.length}`); return d[0]?.id; };
const PELE = pecId('Pele Dura'), CARNE = pecId('Carne Dura');
const custo = nv => { let t = 0; for (let i = 1; i <= nv; i++) t += 5 * i; return t; };

for (const c of LOTE) {
    const d = um(c.nome);
    if (d.length !== 1) { erros.push(`"${c.nome}": ${d.length} docs`); continue; }
    const n = d[0].data(); c.ref = d[0].ref; c.doc = n;
    const [, alvo, dado, bon] = c.golpe;
    const f = Number(n.atributos?.FOR) || 0, des = Number(n.atributos?.DES) || 0, vig = Number(n.atributos?.VIG) || 0;
    Object.assign(c, dprDe(alvo, dado, bon));
    c.x = c.dpr / U; c.grau = grauDe(c.x);
    c.bldAntes = Number(n.valoresDer?.BLD) || 0;
    c.vitAntes = Number(n.valoresDer?.VIT) || 0;
    c.vitDepois = (vig + c.altura * 3) * 3 + (c.carneDura ? 3 * c.carneDura : 0);
    c.pericia = alvo - Math.max(f, des);
    if (c.grau !== c.grauAlvo) erros.push(`${c.nome}: ${vg(c.x)}× cai em ${c.grau}, não em ${c.grauAlvo}`);
    if (bon > f) erros.push(`${c.nome}: bônus +${bon} acima de FOR ${f}`);
    if (c.pericia > 5 || c.pericia < 0) erros.push(`${c.nome}: Alvo ${alvo} exigiria perícia ${c.pericia}`);
    if (c.bld > 3.9) erros.push(`${c.nome}: Blindagem ${c.bld} acima do teto 3,90`);
    c.duelo = c.vitDepois / (0.6 * Math.max(1, 8.5 - c.bld));
    if (c.duelo > 10.5) erros.push(`${c.nome}: ${c.duelo.toFixed(1)} rodadas em duelo, acima do teto`);
    c.ameaca = [c.grau, `${vg(c.x)}×`, c.densidade, clausula(c.grau), c.nota].join(' · ');
}

/* Fúlgora */
const ful = um('Fúlgora')[0];
if (!ful) erros.push('Fúlgora não achada');
const fulVit = ful ? (AVULSOS['Fúlgora'].vig + 1.2 * 3) * 3 : 0;

/* Rei-Coveiro */
const rc = um('Rei-Coveiro')[0];
if (!rc) erros.push('Rei-Coveiro não achado');
const A = AVULSOS['Rei-Coveiro'];
const rcAlto = dprDe(A.golpe[1], A.golpe[2], A.golpe[3]);
const rcBase = dprDe(A.base[0], A.base[1], A.base[2]);
A.x = rcAlto.dpr / U; A.xBase = rcBase.dpr / U; A.grau = grauDe(A.x);
if (A.grau !== A.grauAlvo) erros.push(`Rei-Coveiro: ${vg(A.x)}× cai em ${A.grau}, não em ${A.grauAlvo}`);
A.ameaca = [A.grau, `${vg(A.x)}× contra presa incapacitada (${vg(A.xBase)}× contra quem está de pé)`,
    A.densidade, clausula(A.grau), A.nota].join(' · ');

/* ── relatório ── */
console.log('\n=== LOTE 5 ===\n');
console.log('nome         Alvo  dano     DPR    força   grau    BLD     Vit           duelo');
for (const c of LOTE) if (c.ref) {
    const [, alvo, dado, bon] = c.golpe;
    console.log(`${c.nome.padEnd(12)} ${String(alvo).padStart(3)}  ${(dado + '+' + bon).padEnd(7)} ${c.dpr.toFixed(2).padStart(5)}  ${vg(c.x)}×  ${c.grau.padEnd(6)} ${c.bldAntes}→${c.bld}   ${String(c.vitAntes).padStart(4)}→${c.vitDepois.toFixed(1).padStart(5)}  ${c.duelo.toFixed(1)}`);
}
console.log('\nPeculiaridades:');
for (const c of LOTE) if (c.ref) {
    if (c.pele) console.log(`   ${c.nome.padEnd(12)} Pele Dura Nv${c.pele} (+${c.pele} Bld, ${custo(c.pele)} Poder)`);
    if (c.carneDura) console.log(`   ${c.nome.padEnd(12)} Carne Dura Nv${c.carneDura} (+${3 * c.carneDura} Vit, ${custo(c.carneDura)} Poder)`);
}
console.log('\n=== AVULSOS ===');
console.log(`   Fúlgora      VIG 8→4 · Vitalidade ${ful?.data().valoresDer?.VIT} → ${fulVit.toFixed(1)}`);
console.log(`   Rei-Coveiro  FOR 1→4 · ${vg(A.xBase)}× contra quem está de pé, ${vg(A.x)}× contra incapacitado → ${A.grau}`);
console.log('\nNível de Ameaça:');
for (const c of [...LOTE.filter(c => c.ref), { nome: 'Rei-Coveiro', doc: rc?.data(), ameaca: A.ameaca }])
    console.log(`\n   ${c.nome}\n      de:   ${c.doc?.criatura?.nivelAmeaca || '(vazio)'}\n      para: ${c.ameaca}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const c of LOTE) {
    const vd = c.doc.valoresDer || {};
    const ov = { ...(vd.overrides || {}), [ALTURA_VD]: c.altura }; delete ov.VIT; delete ov.BLD;
    const pq = (c.doc.peculiaridades || []).filter(p => p.refId !== PELE && p.refId !== CARNE);
    if (c.pele) pq.push({ refId: PELE, nivel: c.pele, fonte: null });
    if (c.carneDura) pq.push({ refId: CARNE, nivel: c.carneDura, fonte: null });
    batch.update(c.ref, {
        schemaVersion: 2, modoFicha: 'mecanico', ataques: c.ataques,
        'criatura.nivelAmeaca': c.ameaca, peculiaridades: pq,
        valoresDer: { ...vd, overrides: ov, atual: vd.atual || {}, extras: vd.extras || [],
            VIT: c.vitDepois, BLD: c.bld },
        lastUpdate: iso, lastUpdateBy: AUTOR,
    });
}
batch.update(ful.ref, { 'atributos.VIG': AVULSOS['Fúlgora'].vig, 'valoresDer.VIT': fulVit, lastUpdate: iso, lastUpdateBy: AUTOR });
batch.update(rc.ref, { 'atributos.FOR': A.forNovo, ataques: A.ataques, 'criatura.nivelAmeaca': A.ameaca, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${LOTE.length} do lote 5 + Fúlgora + Rei-Coveiro.`);
process.exit(0);
