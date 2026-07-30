/**
 * Roda o simulador real do wizard contra o Firestore e confere os sentidos do Pogtara.
 * node functions/verify-pogtara.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [derivedValues, mechanics, races, classes, tribes, peculiarities, skills, vitalStats] = await Promise.all(
  ['derivedValues','mechanics','races','classes','tribes','peculiarities','skills','vitalStats'].map(grab));

globalThis.window = {
  _systemData: { mechanics, races, classes, tribes, peculiarities },
  DERIVED_VALUES: derivedValues.filter(d => d.publicado !== false)
    .map(d => ({ id: d.id, key: d.key || d.id, nome: d.nome, mecanicaIds: d.mecanicaIds || [], campoAtual: !!d.campoAtual })),
  VITAL_STATS: vitalStats.filter(v => v.publicado !== false).map(v => ({ key: v.key || v.id, nome: v.nome, mecanicaIds: v.mecanicaIds || [] })),
  SKILLS: { todas: skills.filter(s => s.publicado !== false).map(s => ({
      name: s.nome,
      key: (s.key || s.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_'),
      mecanicaIds: s.mecanicaIds || [] })) },
  REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
  _adjustMechanicForLevel: m => m,
};
const { simulateDerivedValues } = await import('../criar-personagem/js/mechanics-simulator.js');
const id = nome => window.DERIVED_VALUES.find(d => d.nome === nome)?.id;
const SENTIDOS = ['Percepção', 'Percepção Visual', 'Percepção Tátil', 'Percepção Auditiva', 'Percepção Olfativa'];

const rodar = tribo => {
  window.wizardState = {
    racaSelecionada: 'Humano', classeSelecionada: null, triboSelecionada: tribo,
    atributos: { attr_for: 1, attr_des: 1, attr_vig: 1, attr_int: 1, attr_rac: 2, attr_prs: 1, attr_pre: 1, attr_man: 1, attr_aut: 1 },
    pericias: { sk_observacao: 2 },
    peculiaridadesIndividuais: [],
  };
  return simulateDerivedValues();
};

console.log('Humano, RAC 3 (1 base + 2), Observação 2.  Base dos sentidos = RAC + Observação.\n');
const semTribo = rodar(null), pog = rodar('Pogtara');
console.log('  sentido                 sem tribo   Pogtara');
for (const s of SENTIDOS) {
  const a = semTribo[id(s)], b = pog[id(s)];
  const d = (b - a) > 0 ? ` (+${b-a})` : (b - a) < 0 ? ` (${b-a})` : '';
  console.log(`  ${s.padEnd(22)} ${String(a).padStart(7)}   ${String(b).padStart(7)}${d}`);
}
const t = tribes.find(x => x.nome === 'Pogtara');
console.log(`\nPogtara publicado=${t.publicado}  peculiaridades=${(t.peculiaridadeIds||[]).length}`);
for (const pid of t.peculiaridadeIds || []) {
  const p = peculiarities.find(x => x.id === pid);
  console.log(`  • ${p.nome}`);
  for (const m of (p.mecanicaIds||[]).map(m => mechanics.find(x=>x.id===m)).filter(Boolean))
    console.log(`      ${m.tipo.padEnd(11)} ${m.previewTexto || m.nome}`);
}
process.exit();
