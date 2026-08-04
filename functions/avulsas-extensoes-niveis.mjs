/**
 * Quatro extensões de nível + reprecificação do Resistente à Dor.
 *
 *   Corpulento  3 → 5 níveis   (Peso ×1,8/×2,0 · D.Terr −4/−5)
 *   Manco       2 → 4 níveis   (D.Terr −4/−5 · D.Vert −4/−5)
 *   Franzino    3 → 4 níveis   (Peso ×0,45 · D.Aq +3)  — para no 4: ×0,35 cairia
 *                               no mesmo beco de Carga do Nanismo Nv5
 *   Caolho      1 → 3 níveis   (Percepção Visual −1/−2/−3), virando evolutivo
 *   Resistente à Dor           2/4/4 → 12/8/7, agora que a escada de ferimento
 *                               existe no Cap. 6 do Livro de Regras
 *
 *   node functions/avulsas-extensoes-niveis.mjs            (dry-run)
 *   node functions/avulsas-extensoes-niveis.mjs --aplicar
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const VD_PERCEPCAO_VISUAL = 'ATSo9CZFPKWh9KODn4Xi';
const MEC_CAOLHO_VD = 'xHxWHtrLbMzsky9sCZvv';
const PEC_CAOLHO = '7FJM3vTEuY1kwEH14p9w';
const PEC_RESISTENTE = '1wNfDxhhyjUtQuEhnFxd';

/* Níveis novos por mecânica. { termos } = mecânica de cálculo · { custoExp, descricao } = narrativa. */
const NOVOS_NIVEIS = {
  // ---- Corpulento: nivelMaximo 3 → 5 ----
  'CORPULENTO — Peso':        { max: 5, 4: { termos: { 0: 1.8 } }, 5: { termos: { 0: 2.0 } } },
  'CORPULENTO — D.Terrestre': { max: 5, 4: { termos: { 0: 4 } },   5: { termos: { 0: 5 } } },
  'CORPULENTO — D.Aquático':  { max: 5, 4: { termos: { 0: 3 } },   5: { termos: { 0: 4 } } },
  'CORPULENTO — D.Vertical':  { max: 5, 4: { termos: { 0: 3 } },   5: { termos: { 0: 4 } } },
  'Corpulento (Níveis)': { max: 5,
    4: { custoExp: 4, descricao: '▲ +4 situacional contra empurrões, derrubadas e tentativas de movê-lo; investida corpo-a-corpo causa +1 de dano por impacto. ▼ Desvantagem em Atletismo e Agilidade; Deslocamento bem abaixo do normal; passagens estreitas exigem contorção; consome rações extras.' },
    5: { custoExp: 4, descricao: '▲ +5 situacional contra empurrões e derrubadas; fincando os pés, é praticamente imóvel. ▼ Desvantagem em Atletismo e Agilidade; Deslocamento na metade do de um homem comum; não passa por vãos apertados; equipamento sob medida e ração dobrada.' } },

  // ---- Manco: nivelMaximo 2 → 4 ----
  'MANCO — D.Terrestre': { max: 4, 3: { termos: { 0: 4 } }, 4: { termos: { 0: 5 } } },
  'MANCO — D.Vertical':  { max: 4, 3: { termos: { 0: 4 } }, 4: { termos: { 0: 5 } } },
  'Manco (Níveis)': { max: 4,
    3: { custoExp: 5, descricao: '▲ +1 situacional em Arma com bastões e bengalas; +1 situacional em Intimidação. ▼ Desvantagem em Agilidade e Atletismo; não pode correr o dobro do deslocamento; percurso longo exige parada ou apoio.' },
    4: { custoExp: 5, descricao: '▲ +1 situacional em Arma com bastões e bengalas; +1 situacional em Intimidação. ▼ Desvantagem em Agilidade e Atletismo; não corre; depende de bengala ou muleta para andar, e terreno difícil exige teste para atravessar.' } },

  // ---- Franzino: nivelMaximo 3 → 4 ----
  'FRANZINO — Peso':       { max: 4, 4: { termos: { 0: 0.45 } } },
  'FRANZINO — D.Aquático': { max: 4, 4: { termos: { 0: 3 } } },
  'Franzino (Níveis)': { max: 4,
    4: { custoExp: 3, descricao: '▲ Passa por qualquer fresta em que a cabeça caiba; nada com facilidade incomum. ▼ −4 situacional em VIG contra doenças e exaustão; −2 situacional em Briga; qualquer empurrão o derruba; Carga muito baixa.' } },
};

/* Caolho: a mecânica de VD vira evolutiva e ganha uma narrativa irmã. */
const CAOLHO_PROG_VD = {
  1: { custoExp: 0, termos: { 0: 1 } },
  2: { custoExp: 0, termos: { 0: 2 } },
  3: { custoExp: 0, termos: { 0: 3 } },
};
const CAOLHO_NARRATIVA = {
  nome: 'Caolho (Níveis)',
  descricao: 'Efeitos por nível de Caolho',
  tipo: 'narrativo', fonte: 'generica', escopo: 'proprio', duracao: 'permanente',
  duracaoEspecial: '', duracaoTurnos: null, empilhamento: 'soma', condicaoAplicacao: '',
  evoluivel: true, nivelMaximo: 3, progressaoApenasCriacao: false, progressaoTipoExp: 'ganho',
  tags: ['Avulsa'], publicado: true, versao: 1,
  progressao: {
    1: { custoExp: 0, descricao: '▲ +1 situacional em Percepção auditiva e tátil (compensação sensorial). ▼ Um dos olhos está comprometido: o campo visual encolheu e a noção de profundidade falha.' },
    2: { custoExp: 7, descricao: '▲ +1 situacional em Percepção auditiva e tátil. ▼ Perdeu o olho: Desvantagem em qualquer teste que dependa de enxergar pelo lado cego.' },
    3: { custoExp: 6, descricao: '▲ +2 situacional em Percepção auditiva e tátil. ▼ Perdeu o olho e o que restou enxerga mal: Desvantagem pelo lado cego e Desvantagem em Disparo a longas distâncias.' },
  },
  config: { textoEfeito: '▲ +1 situacional em Percepção auditiva e tátil. ▼ Campo visual e profundidade comprometidos.' },
  previewTexto: '▲ +1 situacional em Percepção auditiva e tátil. ▼ Campo visual e profundidade comprometidos.',
};

/* nv1 (mecanicaExpCriacao): nome da pec → { ganho, valor } */
const NV1 = {
  'Caolho': { ganho: true, valor: 5 },              // era +10 com −2 de cara; agora o Nv1 é −1
  'Resistente à Dor': { ganho: false, valor: 12 },  // era −2, sem escada de ferimento escrita
};
/* custoExp de níveis já existentes que mudam */
const CUSTO_EXISTENTE = { 'Resistente à Dor (Níveis)': { 2: 8, 3: 7 } };

const mechSnap = await db.collection('system/data/mechanics').get();
const mechs = mechSnap.docs;
const byNome = n => mechs.find(d => d.data().nome === n);

const faltando = [...Object.keys(NOVOS_NIVEIS), ...Object.keys(CUSTO_EXISTENTE)].filter(n => !byNome(n));
if (faltando.length) { console.error('MECÂNICAS NÃO ENCONTRADAS:', faltando); process.exit(1); }

const backup = {};
const log = [];
const grava = async (ref, patch) => { if (APLICAR) await ref.update(patch); };

/* ---- 1. Mecânicas de EXP compartilhadas que faltarem ---- */
const expMechs = {};
for (const d of mechs) {
  const m = d.data();
  const c = (m.config?.calculos || []).find(c => c.alvo === 'EXP');
  if (!c || !/Avulsa/i.test(m.nome || '')) continue;
  const v = (c.equacao || []).reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  expMechs[`${c.operacao === '+' ? 'ganho' : 'custo'}:${v}`] = d.id;
}
async function idExp(ganho, valor) {
  const k = `${ganho ? 'ganho' : 'custo'}:${valor}`;
  if (expMechs[k]) return expMechs[k];
  const doc = {
    nome: ganho ? `Ganho Avulsa +${valor} EXP` : `Custo Avulsa -${valor} EXP`,
    tipo: 'modificar', evoluivel: false,
    config: { calculos: [{ alvo: 'EXP', qualExp: 'ambos', operacao: ganho ? '+' : '-', quandoAplica: 'na_criacao', equacao: [{ tipo: 'fixo', valor }] }] },
  };
  log.push(`  + mecânica compartilhada "${doc.nome}"`);
  if (!APLICAR) return `<nova:${doc.nome}>`;
  const ref = await db.collection('system/data/mechanics').add(doc);
  expMechs[k] = ref.id;
  return ref.id;
}

/* ---- 2. Níveis novos nas mecânicas existentes ---- */
for (const [nome, plano] of Object.entries(NOVOS_NIVEIS)) {
  const doc = byNome(nome), m = doc.data();
  backup[doc.id] = { nome, nivelMaximo: m.nivelMaximo, progressao: m.progressao };
  const prog = JSON.parse(JSON.stringify(m.progressao || {}));
  const molde = prog[String(Math.max(...Object.keys(prog).map(Number)))];
  for (const nv of Object.keys(plano).filter(k => k !== 'max')) {
    const d = plano[nv];
    const entrada = JSON.parse(JSON.stringify(molde));
    if (d.termos) { entrada.termos = d.termos; entrada.custoExp = 0; }
    else { entrada.custoExp = d.custoExp; entrada.descricao = d.descricao; delete entrada.termos; }
    prog[nv] = entrada;
    log.push(`${nome.padEnd(26)} nv${nv}: ${JSON.stringify(d.termos ?? { custoExp: d.custoExp })}`);
  }
  await grava(doc.ref, { progressao: prog, nivelMaximo: plano.max });
}

/* ---- 3. custoExp de níveis já existentes ---- */
for (const [nome, niveis] of Object.entries(CUSTO_EXISTENTE)) {
  const doc = byNome(nome), m = doc.data();
  backup[doc.id] = backup[doc.id] || { nome, nivelMaximo: m.nivelMaximo, progressao: m.progressao };
  const prog = JSON.parse(JSON.stringify(m.progressao || {}));
  for (const [nv, custo] of Object.entries(niveis)) {
    log.push(`${nome.padEnd(26)} nv${nv}: custoExp ${prog[nv]?.custoExp} → ${custo}`);
    prog[nv].custoExp = custo;
  }
  await grava(doc.ref, { progressao: prog });
}

/* ---- 4. Caolho: mecânica de VD vira evolutiva + narrativa nova + VD vinculado ---- */
{
  const doc = mechs.find(d => d.id === MEC_CAOLHO_VD), m = doc.data();
  backup[MEC_CAOLHO_VD] = { nome: m.nome, evoluivel: m.evoluivel, nivelMaximo: m.nivelMaximo, progressao: m.progressao, progressaoTipoExp: m.progressaoTipoExp, config: m.config, previewTexto: m.previewTexto };
  const config = JSON.parse(JSON.stringify(m.config));
  config.calculos[0].equacao[0].valor = 1;   // base = Nv1; os termos por nível sobrescrevem
  await grava(doc.ref, { evoluivel: true, nivelMaximo: 3, progressaoTipoExp: 'ganho', progressao: CAOLHO_PROG_VD, config, previewTexto: '-1 em Percepção Visual' });
  log.push(`CAOLHO — Percepção Visual  vira evolutivo (−1/−2/−3), tipoExp custo → ganho`);

  const pecRef = db.doc(`system/data/peculiarities/${PEC_CAOLHO}`);
  const pec = (await pecRef.get()).data();
  backup['pec:' + PEC_CAOLHO] = { nome: pec.nome, mecanicaIds: pec.mecanicaIds, derivedValueIds: pec.derivedValueIds, descricao: pec.descricao, mecanicaExpCriacao: pec.mecanicaExpCriacao };

  let narrativaId = byNome('Caolho (Níveis)')?.id;
  if (!narrativaId) {
    log.push('  + mecânica "Caolho (Níveis)" (narrativa por nível)');
    narrativaId = APLICAR ? (await db.collection('system/data/mechanics').add(CAOLHO_NARRATIVA)).id : '<nova:Caolho (Níveis)>';
  }
  await grava(pecRef, {
    mecanicaIds: [...new Set([...(pec.mecanicaIds || []), narrativaId])],
    // Percepção Visual tem todoPersonagem:false — sem isto o campo não aparece na ficha
    derivedValueIds: [{ id: VD_PERCEPCAO_VISUAL, valorInicial: 0, characterCreationMin: 0, characterCreationMax: 0 }],
    descricao: 'Um dos olhos está comprometido — turvo, cego ou perdido. A cada nível a perda avança e o lado cego pesa mais.',
  });
  log.push('Caolho                     + Percepção Visual em derivedValueIds (campo não aparecia na ficha)');
}

/* ---- 5. nv1 (mecanicaExpCriacao) ---- */
const pecSnap = await db.collection('system/data/peculiarities').get();
for (const [nome, { ganho, valor }] of Object.entries(NV1)) {
  const doc = pecSnap.docs.find(d => d.data().nome === nome);
  if (!doc) { console.error(`Peculiaridade não encontrada: ${nome}`); process.exit(1); }
  const antigo = (doc.data().mecanicaExpCriacao || [])[0];
  const antigoVal = antigo ? ((mechs.find(d => d.id === antigo)?.data().config?.calculos || []).find(c => c.alvo === 'EXP')?.equacao || []).reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0) : 0;
  backup['pec:' + doc.id] = backup['pec:' + doc.id] || { nome, mecanicaExpCriacao: doc.data().mecanicaExpCriacao };
  log.push(`${nome.padEnd(26)} nv1: ${ganho ? '+' : '−'}${antigoVal} → ${ganho ? '+' : '−'}${valor}`);
  await grava(doc.ref, { mecanicaExpCriacao: [await idExp(ganho, valor)] });
}

console.log(log.join('\n'));
if (APLICAR) {
  const arq = `functions/_backup-extensoes-${Date.now()}.json`;
  fs.writeFileSync(arq, JSON.stringify(backup, null, 2));
  console.log(`\n✅ Aplicado. Backup em ${arq}`);
} else {
  console.log('\n(dry-run — rode com --aplicar para gravar)');
}
process.exit();
