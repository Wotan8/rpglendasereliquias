/**
 * Dump das tribos com peculiaridades/derivados/perícias resolvidos por nome.
 * node functions/audit-tribos.mjs
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

const [tribes, peculiarities, derivedValues, mechanics] = await Promise.all(
  ['tribes', 'peculiarities', 'derivedValues', 'mechanics'].map(grab));

const nameOf = (arr, id) => arr.find(x => x.id === id)?.nome || `?${id}`;
const pecById = id => peculiarities.find(p => p.id === id);

for (const t of tribes.sort((a, b) => (a.ordem || 99) - (b.ordem || 99))) {
  console.log('='.repeat(70));
  console.log(`${t.nome}  [${t.publicado === false ? 'NÃO PUBLICADA' : 'publicada'}]  id=${t.id}`);
  console.log(`lema: ${t.lema || '—'}`);
  for (const f of ['descricao', 'cultura', 'governo', 'economia', 'militar']) {
    console.log(`\n-- ${f} --\n${t[f] || '(VAZIO)'}`);
  }
  console.log(`\n-- unidadesMilitares --`);
  for (const u of t.unidadesMilitares || []) console.log(`  • ${u.nome} [${u.funcao || '—'}]: ${u.descricao || ''}`);
  if (!t.unidadesMilitares?.length) console.log('  (nenhuma)');

  console.log(`\n-- pericias --`);
  for (const p of t.pericias || []) {
    const o = typeof p === 'object' ? p : { nome: p };
    console.log(`  • ${o.nome}${o.nivel ? ` Nv.${o.nivel}` : ''}${o.opcao ? ` ou ${o.opcao}` : ''}`);
  }
  if (!t.pericias?.length) console.log('  (nenhuma)');

  console.log(`\n-- peculiaridades --`);
  for (const id of t.peculiaridadeIds || []) {
    const p = pecById(id);
    if (!p) { console.log(`  • ?${id} (NÃO ENCONTRADA)`); continue; }
    console.log(`  • ${p.nome} [fonte=${p.fonte}, ${p.quandoSeAplica || 'passivo'}${p.ehVantagem ? ', VANTAGEM' : ''}]`);
    console.log(`      ${(p.descricao || '').replace(/\s+/g, ' ').slice(0, 300)}`);
    const mec = (p.mecanicaIds || []).map(m => nameOf(mechanics, m));
    const dv = (p.derivedValueIds || []).map(d => nameOf(derivedValues, d));
    if (mec.length) console.log(`      mecânicas: ${mec.join(', ')}`);
    if (dv.length) console.log(`      derivados: ${dv.join(', ')}`);
  }
  if (!t.peculiaridadeIds?.length) console.log('  (nenhuma)');

  console.log(`\n-- derivedValueIds da tribo --`);
  console.log('  ' + ((t.derivedValueIds || []).map(d => nameOf(derivedValues, d)).join(', ') || '(nenhum)'));
  console.log(`\nimagemUrl: ${t.imagemUrl ? 'SIM' : 'FALTANDO'}\n`);
}
process.exit();
