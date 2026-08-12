/**
 * Auditoria — lote 7: tira o portão de resistência dos buffs restantes.
 *
 * Os lotes 4 e 5 marcaram todo mundo como `portao: 'resistencia'` por
 * descuido meu. Nos buffs o CÁLCULO já usava P de aliado (0,70), então as
 * razões gravadas estão certas — só a etiqueta mente, e ela é o que a mesa
 * lê. Aqui só o campo muda.
 *
 *   node functions/__aplica-portao-07.mjs            (dry-run)
 *   node functions/__aplica-portao-07.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* Por nome: quais condições de cada habilidade são buff (sem portão). */
const BUFF = {
  'Postura Defensiva': ['Blindado', 'Abalado'],   // as duas são em si mesmo
  'Inspirar': ['Fortalecido'],
  'RITMO DE MARCHA [P]': ['Célere'],
  'COMPOSIÇÃO DE BATALHA [Qualquer]': ['Fortalecido'],
  'A SINFONIA [Todas]': ['Fortalecido', 'Blindado'],
};

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const plano = [];
for (const m of mods) {
  let mexeu = false;
  const itens = (m.itensPredefinidos || []).map((it) => {
    const alvo = BUFF[it.nome];
    if (!alvo) return it;
    let esteItem = false;   // por ITEM: a flag do módulo vazava para os seguintes
    const cs = (it.condicoesAplicadas || []).map((c) => {
      if (c && alvo.includes(c.condicao) && c.portao === 'resistencia') {
        plano.push(`${m.titulo.slice(0, 20)} :: ${it.nome} → ${c.condicao}`);
        mexeu = true; esteItem = true;
        return { ...c, portao: null };
      }
      return c;
    });
    return esteItem ? { ...it, condicoesAplicadas: cs } : it;
  });
  if (mexeu) m._novos = itens;
}
console.log('=== PLANO ===');
plano.forEach((x) => console.log('  sem portão: ' + x));
console.log(`\n  ${plano.length} condições destravadas`);
/* 10, não 7: Postura Defensiva e Inspirar existem também no módulo
   aposentado de Manobras, que nenhuma classe carrega. Consertar as duas
   cópias é inofensivo e evita que a errada volte se o módulo for religado. */
assert.equal(plano.length, 10, 'esperado os 7 ativos mais 3 do módulo aposentado');

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
