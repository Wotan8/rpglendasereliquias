/**
 * +2 de Dano nas 4 armas Versáteis quando empunhadas com as duas mãos.
 * Decisão do Mestre, 13/08/2026.
 *
 * COMO isso é gravado: um SEGUNDO vínculo do mesmo Valor Derivado Dano, com
 * `maos: 2`. O vínculo que já existe (equação Qualidade+Afiação+FOR) fica sem
 * pegada e continua valendo nas duas — os motores somam os dois vínculos, então
 * com uma mão sai a equação e com duas sai a equação + 2.
 *
 * Dois vínculos do mesmo VD só são seguros depois do conserto do seletor do
 * Painel do Criador (painel-mechanics.js chaveia o chip por POSIÇÃO, não pelo
 * id do VD): antes disso o segundo era ineditável e o confirm o apagava sem
 * avisar. Ver __check-equacao-vinculo-vd.html, casos 8+.
 *
 *   node functions/versateis-dano-2maos.mjs             (ensaio)
 *   node functions/versateis-dano-2maos.mjs --aplicar
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const BONUS = 2;

const dvs = (await db.collection('system/data/derivedValues').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const DANO = dvs.find(d => d.escopoItem === 'dano' && /^dano$/i.test(String(d.nome || '').trim()));
if (!DANO) { console.error('❌ Valor Derivado "Dano" (escopoItem: dano) não encontrado.'); process.exit(1); }
console.log(`VD de Dano: ${DANO.nome} (${DANO.id})\n`);

const eq = (await db.collection('system/data/equipment').get()).docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(i => i.tipo === 'Arma' && i.categoriaArma === 'versatil');

const planos = [];
for (const a of eq) {
    const vincs = a.valoresDerivadosVinculados || [];
    // Idempotente: se já existe um vínculo de Dano preso às duas mãos, não repete.
    if (vincs.some(v => v.id === DANO.id && Number(v.maos) === 2)) {
        console.log(`   = ${a.nome}: já tem bônus de Dano com 2 mãos — pulando`);
        continue;
    }
    if (!vincs.some(v => v.id === DANO.id)) {
        console.log(`   ⚠️ ${a.nome}: não tem vínculo de Dano nenhum — pulando (cadastre o Dano antes)`);
        continue;
    }
    planos.push({ a, novo: vincs.concat([{ id: DANO.id, modificador: BONUS, maos: 2 }]) });
    console.log(`   + ${a.nome}: ${vincs.length} vínculo(s) → +1 de Dano ${BONUS >= 0 ? '+' : ''}${BONUS} só com 2 mãos`);
}

if (!planos.length) { console.log('\nNada a gravar.'); process.exit(0); }
if (!APLICAR) { console.log(`\n(ensaio) ${planos.length} arma(s). Rode com --aplicar para gravar.`); process.exit(0); }

const agora = new Date().toISOString();
const batch = db.batch();
for (const p of planos) {
    batch.update(p.a.ref, { valoresDerivadosVinculados: p.novo, atualizadoEm: agora, updatedAt: agora });
}
await batch.commit();
console.log(`\n✅ ${planos.length} arma(s) Versátil(eis) com +${BONUS} de Dano nas duas mãos.`);
