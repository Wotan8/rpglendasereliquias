/**
 * Varre TODAS as fontes de peculiaridade (raça, classe, tribo, módulos de classe)
 * atrás de peculiaridades que trazem um Valor Derivado via `derivedValueIds`.
 *
 * Reporta quais desses VDs ficavam INVISÍVEIS na ficha, ou seja: não têm
 * `todoPersonagem` e não estão vinculados direto no doc da fonte — só chegavam pela
 * peculiaridade. Para peculiaridade de CLASSE esse caminho estava quebrado
 * (lia window.CLASSES, global inexistente), então esses são os casos afetados.
 *
 * node functions/scan-vd-orfaos.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [derivedValues, peculiarities, races, classes, tribes, classModules] =
  await Promise.all(['derivedValues', 'peculiarities', 'races', 'classes', 'tribes', 'classModules'].map(grab));

const dvById = Object.fromEntries(derivedValues.map(d => [d.id, d]));
const pecById = Object.fromEntries(peculiarities.map(p => [p.id, p]));
const idsDe = lista => (lista || []).map(x => (typeof x === 'object' && x !== null ? x.id : x)).filter(Boolean);

/** VDs que a fonte já vincula diretamente no próprio documento. */
const diretos = fonte => new Set(idsDe(fonte.derivedValueIds));

const achados = [];
const varrer = (tipoFonte, fonte, pecIds) => {
  const jaDiretos = diretos(fonte);
  for (const pecId of idsDe(pecIds)) {
    const pec = pecById[pecId];
    if (!pec) { achados.push({ tipoFonte, fonte: fonte.nome, pec: `??? (${pecId})`, dv: '—', estado: 'PECULIARIDADE INEXISTENTE' }); continue; }
    for (const dvId of idsDe(pec.derivedValueIds)) {
      const dv = dvById[dvId];
      if (!dv) { achados.push({ tipoFonte, fonte: fonte.nome, pec: pec.nome, dv: `??? (${dvId})`, estado: 'VD INEXISTENTE' }); continue; }
      const coberto = dv.todoPersonagem === true || jaDiretos.has(dvId);
      achados.push({
        tipoFonte, fonte: fonte.nome, pec: pec.nome, dv: dv.nome,
        estado: coberto
          ? (dv.todoPersonagem ? 'ok (todoPersonagem)' : 'ok (vinculado direto na fonte)')
          : (tipoFonte === 'CLASSE' ? '🔴 ESTAVA INVISÍVEL' : 'ok (caminho já funcionava)'),
      });
    }
  }
};

for (const r of races) varrer('RAÇA', r, r.peculiaridadeIds);
for (const t of tribes) varrer('TRIBO', t, t.peculiaridadeIds);
for (const c of classes) {
  varrer('CLASSE', c, c.peculiaridadeIds);
  varrer('CLASSE', c, c.bonusIniciais);
}
for (const m of classModules) varrer('MÓDULO', m, m.peculiaridadeIds);

if (!achados.length) console.log('Nenhuma peculiaridade traz Valor Derivado em nenhuma fonte.');
for (const a of achados) {
  console.log(`${a.estado.padEnd(30)} ${a.tipoFonte.padEnd(7)} ${String(a.fonte).padEnd(18)} ${a.pec.padEnd(24)} → ${a.dv}`);
}

const quebrados = achados.filter(a => a.estado.startsWith('🔴'));
console.log(`\n${achados.length} vínculos peculiaridade→VD; ${quebrados.length} afetados pelo bug da classe.`);

// Contexto: quantas peculiaridades cada classe tem, para saber se a varredura foi vazia
// por não haver dado ou por não haver vínculo.
console.log(`\nClasses (${classes.length}): ` + classes.map(c =>
  `${c.nome}=${idsDe(c.peculiaridadeIds).length + idsDe(c.bonusIniciais).length}pec`).join(', '));
console.log(`Módulos de classe: ${classModules.length}`);
process.exit();
