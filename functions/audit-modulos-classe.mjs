/**
 * Read-only: quais classes tem modulo de classe, quais estao vazias,
 * e quantos itens predefinidos cada modulo carrega.
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

const [classes, classModules, maneuvers] = await Promise.all(
  ['classes', 'classModules', 'maneuvers'].map(grab));

const modById = id => classModules.find(m => m.id === id);

const semModulo = [], comModulo = [], refsQuebradas = [];

for (const c of classes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))) {
  const pub = c.publicado === false ? ' [NAO PUBLICADA]' : '';
  const entradas = Array.isArray(c.modulosDaClasse) ? c.modulosDaClasse : [];
  const manobras = Array.isArray(c.manobras) ? c.manobras.length : 0;
  const dvs = Array.isArray(c.derivedValueIds) ? c.derivedValueIds.length : 0;

  if (entradas.length === 0) {
    semModulo.push({ nome: c.nome + pub, manobras, dvs });
    continue;
  }

  const mods = [];
  for (const e of entradas) {
    if (typeof e === 'string') {
      const m = modById(e);
      if (!m) { refsQuebradas.push(`${c.nome} -> ${e}`); continue; }
      mods.push(m);
    } else if (e && typeof e === 'object') {
      mods.push({ ...e, _inline: true });
    }
  }
  comModulo.push({ nome: c.nome + pub, mods, manobras, dvs });
}

console.log('#'.repeat(72));
console.log(`CLASSES SEM NENHUM MODULO DE CLASSE  (${semModulo.length}/${classes.length})`);
console.log('#'.repeat(72));
for (const c of semModulo) {
  console.log(`  ${c.nome.padEnd(30)} manobras=${c.manobras}  VDs=${c.dvs}`);
}

console.log('\n' + '#'.repeat(72));
console.log(`CLASSES COM MODULO  (${comModulo.length}/${classes.length})`);
console.log('#'.repeat(72));
for (const c of comModulo) {
  console.log(`\n${c.nome}   manobras=${c.manobras}  VDs=${c.dvs}`);
  for (const m of c.mods) {
    const itens = Array.isArray(m.itensPredefinidos) ? m.itensPredefinidos.length : 0;
    const schema = Array.isArray(m.schema) ? m.schema.length : 0;
    const vazio = itens === 0 ? '  <-- SEM ITENS PREDEFINIDOS' : '';
    console.log(`    ${(m.icone || '?')} ${(m.titulo || m.id).padEnd(28)} tipo=${(m.tipo || '?').padEnd(11)} itens=${String(itens).padStart(3)} campos=${String(schema).padStart(2)}${m._inline ? ' [inline/legado]' : ''}${vazio}`);
  }
}

if (refsQuebradas.length) {
  console.log('\n' + '#'.repeat(72));
  console.log('REFERENCIAS QUEBRADAS (classe aponta pra modulo inexistente)');
  console.log('#'.repeat(72));
  refsQuebradas.forEach(r => console.log('  ' + r));
}

const usados = new Set(comModulo.flatMap(c => c.mods.map(m => m.id)));
const orfaos = classModules.filter(m => !usados.has(m.id));
if (orfaos.length) {
  console.log('\n' + '#'.repeat(72));
  console.log('MODULOS CADASTRADOS QUE NENHUMA CLASSE USA');
  console.log('#'.repeat(72));
  orfaos.forEach(m => console.log(`  ${m.titulo || m.id}  (id=${m.id})`));
}

console.log(`\nTotal: ${classes.length} classes, ${classModules.length} modulos, ${maneuvers.length} manobras na colecao 'maneuvers'.`);
process.exit(0);
