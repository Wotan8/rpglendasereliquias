/**
 * Mede a carga mecânica de cada raça e classe: nº de peculiaridades, perícias,
 * derivados e manobras. Base para calibrar o orçamento das tribos.
 * node functions/audit-carga.mjs
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

const [races, classes, peculiarities, derivedValues, skills] = await Promise.all(
  ['races', 'classes', 'peculiarities', 'derivedValues', 'skills'].map(grab));

const pecName = id => peculiarities.find(p => p.id === id)?.nome || `?${id}`;
const idOf = x => (typeof x === 'object' && x !== null ? x.id : x);
const n = a => (a || []).length;

const linha = (o, extra) => {
  const pecs = (o.peculiaridadeIds || []).map(x => pecName(idOf(x)));
  console.log(`\n${o.nome}${o.publicado === false ? '  [NÃO PUBLICADA]' : ''}`);
  console.log(`  peculiaridades: ${pecs.length}${pecs.length ? ' → ' + pecs.join(' | ') : ''}`);
  console.log(`  derivedValueIds: ${n(o.derivedValueIds)}${n(o.derivedValueIds) ? ' → ' + o.derivedValueIds.map(x => derivedValues.find(d => d.id === idOf(x))?.nome + (typeof x === 'object' && x.valorInicial ? `=${x.valorInicial}` : '')).join(', ') : ''}`);
  extra(o);
};

console.log('##################  RAÇAS  ##################');
for (const r of races) linha(r, o => {
  console.log(`  pericias: ${n(o.pericias)}${n(o.pericias) ? ' → ' + o.pericias.map(p => typeof p === 'object' ? `${p.nome}${p.nivel ? ' Nv.' + p.nivel : ''}` : p).join(', ') : ''}`);
  const outros = Object.keys(o).filter(k => Array.isArray(o[k]) && o[k].length && !['peculiaridadeIds', 'derivedValueIds', 'pericias'].includes(k));
  if (outros.length) console.log(`  outros arrays: ${outros.map(k => `${k}(${o[k].length})`).join(', ')}`);
});

console.log('\n\n##################  CLASSES  ##################');
for (const c of classes) linha(c, o => {
  console.log(`  pericClasse: ${n(o.pericClasse)}${n(o.pericClasse) ? ' → ' + o.pericClasse.map(p => skills.find(s => s.id === idOf(p))?.nome || idOf(p)).join(', ') : ''}`);
  console.log(`  manobras: ${n(o.manobras)}  bonusIniciais: ${n(o.bonusIniciais)}  mecanicaIds: ${n(o.mecanicaIds)}  kits: ${n(o.kitsIniciais)}  testes: ${n(o.testesDeClasse)}`);
});

console.log('\n\n##################  RESUMO  ##################');
const stat = (label, arr, get) => {
  const v = arr.map(get);
  console.log(`${label}: min=${Math.min(...v)} max=${Math.max(...v)} média=${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}  (n=${v.length})`);
};
stat('Raça  — peculiaridades', races, r => n(r.peculiaridadeIds));
stat('Raça  — derivados', races, r => n(r.derivedValueIds));
stat('Classe— peculiaridades', classes, c => n(c.peculiaridadeIds));
stat('Classe— perícias', classes, c => n(c.pericClasse));
stat('Classe— manobras', classes, c => n(c.manobras));

console.log(`\nPeculiaridades por fonte:`);
const porFonte = {};
for (const p of peculiarities) porFonte[p.fonte || '(sem)'] = (porFonte[p.fonte || '(sem)'] || 0) + 1;
console.log('  ' + Object.entries(porFonte).map(([k, v]) => `${k}=${v}`).join('  '));
console.log(`\nTotal de perícias cadastradas: ${skills.length}`);
console.log('Nomes: ' + skills.map(s => s.nome).sort().join(', '));
process.exit();
