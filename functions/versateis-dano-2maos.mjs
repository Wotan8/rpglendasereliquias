/**
 * +2 de Dano nas 4 armas Versáteis quando empunhadas com as duas mãos.
 * Decisão do Mestre, 13/08/2026.
 *
 * COMO isso é gravado: um SEGUNDO vínculo do mesmo Valor Derivado Dano, com
 * `maos: 2` e o valor numa EQUAÇÃO ([{tipo:'fixo', valor:2}]) — nunca no campo
 * `modificador`, que é legado. O vínculo que já existe (equação
 * Qualidade+Afiação+FOR) fica sem pegada e continua valendo nas duas: os
 * motores somam os dois, então com uma mão sai a equação e com duas sai +2.
 *
 * Reexecutar MIGRA vínculo que ainda esteja no `modificador`.
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

/**
 * O valor mora na EQUAÇÃO, nunca no campo `modificador`.
 * `modificador` é o formato legado — a ficha, o NPC e o Tabuleiro só o leem
 * quando NÃO há equação, e o próprio editor do Criador o zera assim que a
 * equação existe. Bônus gravado ali fica preso: não escala, não referencia
 * nada da ficha e some no primeiro toque pela UI.
 */
const equacaoDoBonus = () => [{ tipo: 'fixo', valor: BONUS }];
const ehBonus2Maos = (v) => v.id === DANO.id && Number(v.maos) === 2;
const jaCerto = (v) => Array.isArray(v.equacao) && v.equacao.length
    && !Number(v.modificador);

const planos = [];
for (const a of eq) {
    const vincs = a.valoresDerivadosVinculados || [];
    const atual = vincs.find(ehBonus2Maos);

    if (atual && jaCerto(atual)) {
        console.log(`   = ${a.nome}: já tem o bônus por equação — pulando`);
        continue;
    }
    if (!vincs.some(v => v.id === DANO.id)) {
        console.log(`   ⚠️ ${a.nome}: não tem vínculo de Dano nenhum — pulando (cadastre o Dano antes)`);
        continue;
    }

    // Migra o vínculo que já existe (tirando o modificador legado) ou cria um.
    const novo = atual
        ? vincs.map(v => ehBonus2Maos(v)
            ? { id: DANO.id, maos: 2, modificador: 0, equacao: equacaoDoBonus() } : v)
        : vincs.concat([{ id: DANO.id, maos: 2, modificador: 0, equacao: equacaoDoBonus() }]);

    planos.push({ a, novo });
    console.log(`   ${atual ? '~' : '+'} ${a.nome}: Dano só com 2 mãos → equação [fixo ${BONUS}]`
        + (atual ? `  (era modificador: ${atual.modificador})` : ''));
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
