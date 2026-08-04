/**
 * Rebalanceamento das Peculiaridades Avulsas contra a economia real de EXP.
 *
 * Âncoras (ficha-v1.7_1/js/exp-upgrade.js:11-17):
 *   atributo → nível N = 5N EXP · perícia → nível N = 4N EXP
 *   ⇒ +1 permanente numa perícia de meio de campanha ≈ 12 EXP
 *   EXP/sessão ≈ 3,5 (rubrica manda 2-4; sessão 46 deu 3,4 de base)
 *   EXP Inicial na sessão 47 = 15 + 47 = 62 ⇒ 1 EXP ≈ 0,29 sessão
 *
 * Grava backup do estado anterior antes de escrever.
 *   node functions/rebalancear-avulsas.mjs           (dry-run, só mostra o diff)
 *   node functions/rebalancear-avulsas.mjs --aplicar (escreve no Firestore)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');

/* nv1 = valor da mecânica compartilhada de EXP de criação (mecanicaExpCriacao).
   niveis = custoExp INCREMENTAL dos níveis 2+, na mecânica narrativa "(Níveis)".
   ganho: true = desvantagem (progressaoTipoExp 'ganho'); false = vantagem ('custo'). */
const PLANO = {
  // ---- VANTAGENS (custam EXP) ----
  'Bonito':              { ganho: false, nv1: 4,  niveis: { 2: 2 } },
  'Dupla-Face':          { ganho: false, nv1: 4,  niveis: { 2: 5, 3: 3 } },
  'Gigantismo':          { ganho: false, nv1: 8,  niveis: { 2: 8, 3: 8 } },
  'Hipermóvel':          { ganho: false, nv1: 5,  niveis: { 2: 4, 3: 4 } },
  'Memória Prodigiosa':  { ganho: false, nv1: 4,  niveis: { 2: 2, 3: 4 } },
  'Olfato Apurado':      { ganho: false, nv1: 4,  niveis: { 2: 5, 3: 5 } },
  'Resistente à Dor':    { ganho: false, nv1: 2,  niveis: { 2: 4, 3: 4 } },
  'Sono Leve':           { ganho: false, nv1: 4,  niveis: { 2: 2 } },
  'Sortudo':             { ganho: false, nv1: 14, niveis: { 2: 14, 3: 8 } },
  'Teimoso':             { ganho: false, nv1: 5,  niveis: { 2: 4, 3: 6 } },
  'Veterano de Guerra':  { ganho: false, nv1: 4,  niveis: { 2: 2, 3: 3 } },
  'Voz Marcante':        { ganho: false, nv1: 4,  niveis: { 2: 7, 3: 3 } },
  // ---- DESVANTAGENS (concedem EXP) ----
  'Albino':              { ganho: true,  nv1: 4,  niveis: {} },
  'Alérgico':            { ganho: true,  nv1: 2,  niveis: { 2: 3, 3: 5 } },
  'Azarado':             { ganho: true,  nv1: 10, niveis: { 2: 8, 3: 14 } },
  'Caolho':              { ganho: true,  nv1: 10, niveis: {} },
  'Cicatriz Notável':    { ganho: true,  nv1: 0,  niveis: { 2: 0, 3: 12 } },
  'Corpulento':          { ganho: true,  nv1: 0,  niveis: { 2: 2, 3: 6 } },
  'Desajeitado':         { ganho: true,  nv1: 4,  niveis: { 2: 4 } },
  'Feio':                { ganho: true,  nv1: 2,  niveis: { 2: 4 } },
  'Franzino':            { ganho: true,  nv1: 2,  niveis: { 2: 2, 3: 2 } },
  'Gago':                { ganho: true,  nv1: 4,  niveis: { 2: 5 } },
  'Glutão':              { ganho: true,  nv1: 0,  niveis: { 2: 3 } },
  'Manco':               { ganho: true,  nv1: 8,  niveis: { 2: 6 } },
  'Medroso':             { ganho: true,  nv1: 2,  niveis: { 2: 5 } },
  'Nanismo':             { ganho: true,  nv1: 8,  niveis: { 2: 8, 3: 8 } },
  'Roncador':            { ganho: true,  nv1: 2,  niveis: { 2: 5 } },
  'Vegetariano':         { ganho: true,  nv1: 2,  niveis: {} },
};

const grab = async col => (await db.collection(`system/data/${col}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [pecs, mechs] = await Promise.all([grab('peculiarities'), grab('mechanics')]);
const mById = Object.fromEntries(mechs.map(m => [m.id, m]));

/* ---- 1. Mecânicas compartilhadas de EXP de criação ---- */
const expMechs = {};      // 'custo:4' → id
for (const m of mechs) {
  const c = (m.config?.calculos || []).find(c => c.alvo === 'EXP');
  if (!c || !/Avulsa/i.test(m.nome || '')) continue;
  const v = (c.equacao || []).reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  expMechs[`${c.operacao === '+' ? 'ganho' : 'custo'}:${v}`] = m.id;
}

const criadas = [];
async function idDaMecanicaExp(ganho, valor) {
  const chave = `${ganho ? 'ganho' : 'custo'}:${valor}`;
  if (expMechs[chave]) return expMechs[chave];
  const doc = {
    nome: ganho ? `Ganho Avulsa +${valor} EXP` : `Custo Avulsa -${valor} EXP`,
    tipo: 'modificar',
    evoluivel: false,
    config: { calculos: [{ alvo: 'EXP', qualExp: 'ambos', operacao: ganho ? '+' : '-', quandoAplica: 'na_criacao', equacao: [{ tipo: 'fixo', valor }] }] },
  };
  if (!APLICAR) { criadas.push(doc.nome); return `<nova:${doc.nome}>`; }
  const ref = await db.collection('system/data/mechanics').add(doc);
  expMechs[chave] = ref.id;
  criadas.push(`${doc.nome} (${ref.id})`);
  return ref.id;
}

/* ---- 2. Backup ---- */
const alvo = pecs.filter(p => PLANO[p.nome]);
const faltando = Object.keys(PLANO).filter(n => !alvo.some(p => p.nome === n));
if (faltando.length) { console.error('PECULIARIDADES NÃO ENCONTRADAS:', faltando); process.exit(1); }

const backup = { data: new Date().toISOString(), peculiarities: {}, mechanics: {} };
for (const p of alvo) {
  backup.peculiarities[p.id] = { nome: p.nome, mecanicaExpCriacao: p.mecanicaExpCriacao || [] };
  for (const id of p.mecanicaIds || []) {
    const m = mById[id];
    if (m?.evoluivel) backup.mechanics[id] = { nome: m.nome, progressaoTipoExp: m.progressaoTipoExp, progressao: m.progressao };
  }
}
const arqBackup = new URL('./_backup-avulsas-' + Date.now() + '.json', import.meta.url).pathname.replace(/^\//, '');
if (APLICAR) fs.writeFileSync(arqBackup, JSON.stringify(backup, null, 2));

/* ---- 3. Diff + escrita ---- */
const linhas = [];
for (const p of alvo.sort((a, b) => a.nome.localeCompare(b.nome))) {
  const plano = PLANO[p.nome];
  const tipoExp = plano.ganho ? 'ganho' : 'custo';
  const sinal = plano.ganho ? '+' : '−';

  // 3a. nv1
  const antigoId = (p.mecanicaExpCriacao || [])[0];
  const antigoVal = antigoId
    ? ((mById[antigoId]?.config?.calculos || []).find(c => c.alvo === 'EXP')?.equacao || []).reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0)
    : 0;
  if (antigoVal !== plano.nv1) {
    const novoIds = plano.nv1 === 0 ? [] : [await idDaMecanicaExp(plano.ganho, plano.nv1)];
    linhas.push(`${p.nome.padEnd(20)} nv1  ${antigoVal} → ${plano.nv1}`);
    if (APLICAR) await db.doc(`system/data/peculiarities/${p.id}`).update({ mecanicaExpCriacao: novoIds });
  }

  // 3b. níveis 2+ (custoExp incremental) e uniformização do progressaoTipoExp
  const evoluiveis = (p.mecanicaIds || []).map(id => mById[id]).filter(m => m?.evoluivel);
  const narrativa = evoluiveis.find(m => m.tipo === 'narrativo') || evoluiveis[0];
  for (const m of evoluiveis) {
    const patch = {};
    if (m.progressaoTipoExp !== tipoExp) {
      patch.progressaoTipoExp = tipoExp;
      linhas.push(`${p.nome.padEnd(20)} tipoExp "${m.nome}" ${m.progressaoTipoExp} → ${tipoExp}`);
    }
    const prog = JSON.parse(JSON.stringify(m.progressao || {}));
    let mudou = false;
    for (const [nv, dados] of Object.entries(prog)) {
      // custoExp mora só na narrativa; as "modificar" ficam em 0
      const novo = m === narrativa ? (plano.niveis[nv] ?? 0) : 0;
      if ((dados.custoExp || 0) !== novo) {
        if (m === narrativa && nv !== '1') linhas.push(`${p.nome.padEnd(20)} nv${nv}  ${sinal}${dados.custoExp || 0} → ${sinal}${novo}`);
        dados.custoExp = novo;
        mudou = true;
      }
    }
    if (mudou) patch.progressao = prog;
    if (Object.keys(patch).length && APLICAR) await db.doc(`system/data/mechanics/${m.id}`).update(patch);
  }
}

console.log(linhas.length ? linhas.join('\n') : '(nada a mudar)');
console.log(`\nMecânicas de EXP ${APLICAR ? 'criadas' : 'a criar'}: ${criadas.join(', ') || '(nenhuma)'}`);
console.log(APLICAR ? `\n✅ Aplicado. Backup em ${arqBackup}` : '\n(dry-run — rode com --aplicar para gravar)');
process.exit();
