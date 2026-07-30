/**
 * Roda o simulador REAL do wizard (criar-personagem/js/mechanics-simulator.js)
 * contra os dados REAIS do Firestore, e imprime a cascata de cada avulsa revisada.
 * node functions/verify-avulsas.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const grab = async col => {
  const s = await db.collection(`system/data/${col}`).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
};

const [derivedValues, mechanics, races, peculiarities, skills, vitalStats] = await Promise.all(
  ['derivedValues', 'mechanics', 'races', 'peculiarities', 'skills', 'vitalStats'].map(grab));

globalThis.window = {
  _systemData: { mechanics, races, classes: [], tribes: [], peculiarities },
  DERIVED_VALUES: derivedValues.filter(d => d.publicado !== false)
    .map(d => ({ id: d.id, key: d.key || d.id, nome: d.nome, mecanicaIds: d.mecanicaIds || [], campoAtual: !!d.campoAtual })),
  VITAL_STATS: vitalStats.filter(v => v.publicado !== false).map(v => ({ key: v.key || v.id, nome: v.nome, mecanicaIds: v.mecanicaIds || [] })),
  SKILLS: { todas: skills.map(s => ({ name: s.nome, key: s.key || s.id, mecanicaIds: s.mecanicaIds || [] })) },
  REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
  _adjustMechanicForLevel(m, level) {
    const prog = m.progressao?.[String(level)];
    if (!prog?.termos) return m;
    const out = JSON.parse(JSON.stringify(m));
    for (const c of out.config?.calculos || []) {
      let i = 0;
      for (const t of c.equacao || []) {
        if (!t.tipo || t.tipo === 'fixo') {
          if (prog.termos[String(i)] !== undefined) t.valor = prog.termos[String(i)];
          i++;
        }
      }
    }
    return out;
  },
};

const { simulateDerivedValues } = await import('../criar-personagem/js/mechanics-simulator.js');

const byName = n => window.DERIVED_VALUES.find(d => d.nome === n);
const pecByName = n => peculiarities.find(p => p.nome === n);
const COLS = ['Altura', 'Tamanho', 'Peso', 'Carga', 'Desloc. Terrestre', 'Desloc. Vertical', 'Desloc. Aquático', 'Iniciativa', 'Percepção Visual', 'Percepção Olfativa'];

const rodar = pecs => {
  window.wizardState = {
    racaSelecionada: 'Humano',
    atributos: { attr_for: 1, attr_des: 1, attr_vig: 1, attr_int: 1, attr_rac: 1, attr_prs: 1, attr_pre: 1, attr_man: 1, attr_aut: 1 },
    pericias: { sk_fisico_agilidade: 2 },
    peculiaridadesIndividuais: pecs,
  };
  const r = simulateDerivedValues();
  return Object.fromEntries(COLS.map(c => [c, byName(c) ? r[byName(c).id] : null]));
};

const fmt = o => COLS.map(c => `${c.replace('Desloc. ', 'D.')}=${o[c] ?? '—'}`).join('  ');
const base = rodar([]);
console.log('BASE (Humano, FOR/DES/VIG 2, Agilidade 2)');
console.log('  ', fmt(base), '\n');

for (const [nome, niveis] of [['Gigantismo', [1, 2, 3]], ['Nanismo', [1, 2, 3]], ['Corpulento', [1, 3]], ['Franzino', [1, 3]], ['Glutão', [1, 2]], ['Manco', [1, 2]], ['Caolho', [1]], ['Veterano de Guerra', [1, 3]], ['Olfato Apurado', [1, 2, 3]]]) {
  const pec = pecByName(nome);
  if (!pec) { console.log(`${nome}: NÃO ENCONTRADA`); continue; }
  console.log(nome);
  for (const nv of niveis) {
    const r = rodar([{ id: pec.id, nivel: nv }]);
    const diff = COLS.filter(c => r[c] !== base[c]).map(c => `${c.replace('Desloc. ', 'D.')} ${base[c]}→${r[c]}`).join(', ');
    console.log(`   Nv${nv}: ${diff || '(sem mudança numérica)'}`);
  }
  console.log();
}
process.exit();
