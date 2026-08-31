/**
 * Bestiário — carimbo de Grau na Sentinela da Feira. Item 8 do handoff.
 *
 * A ameaça dela é condicional NO ALVO ("Alto contra violadores das Leis ·
 * Nulo contra todos os outros"), mas o COMBATE em si não é condicional nada
 * — Punho de Cinza é Alvo 9 fixo, 2d10+4, Vitalidade 40, Blindagem 5, sempre
 * os mesmos números contra quem ela decide atacar. A régua v3 mede isso
 * normalmente; só a targeting rule (quem ela ataca) é que fica de fora da
 * força em × guerreiro, e vai na frase de eixo/doma do carimbo, não no lugar
 * do Grau.
 *
 * Autorizado a mexer em ficha de mesa nesta sessão (mesma mesa das seis
 * fichas já migradas em npcs-mesa-legado-v3.mjs). Só o campo nivelAmeaca
 * muda — Alvo, dado, Vitalidade e Blindagem continuam exatamente os mesmos.
 *
 *   node functions/bestiario-carimbo-sentinela.mjs            (dry-run)
 *   node functions/bestiario-carimbo-sentinela.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const UNIDADE = 3.90, DEFESA = 1, BLD_REF = 2;
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];
const br = (x, c = 2) => x.toFixed(c).replace('.', ',');

const npcs = (await db.collection('npcs').get()).docs;
const doc = npcs.find(d => (d.data().nome || '') === 'Sentinela da Feira');
if (!doc) { console.log('❌ "Sentinela da Feira" não achada'); process.exit(1); }
const n = doc.data();

const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?\)? = (\d+d\d+)(?:\+(\d+))?/.exec(atq);
if (!g) { console.log(`❌ golpe não legível — "${atq}"`); process.exit(1); }
const alvo = +g[1], transb = g[2] ? +g[2] : Math.max(0, alvo - 9), dado = g[3], bonus = g[4] ? +g[4] : 0;
const dm = medio(dado);
const P = Math.max(0, Math.min((Math.min(alvo, 9) - DEFESA) / 10, 0.9));
const liq = Math.max(1, dm + bonus - BLD_REF);
const dpr = P * liq, forca = dpr / UNIDADE, grau = grauDe(forca);

const antes = String(n.criatura?.nivelAmeaca || '');
const depois = [
    grau,
    `${br(forca)}×${transb ? ` (+${transb} Transbordo)` : ''}`,
    'nasce de uma conta quebrada — restam poucas das 12 da Corrente de Doze Contas',
    'Ataca só quem violou uma das Três Leis do Submundo; ignora todo o resto',
    'Indomável: construto sem mente, só Ina Nó-de-Pedra dissolve',
    'Aspecto: Risco 1',
].join(' · ');

console.log(`\n=== Sentinela da Feira · ${doc.id} ===`);
console.log(`Alvo ${alvo}${transb ? ` (+${transb} Transbordo)` : ''}, ${dado}${bonus ? `+${bonus}` : ''}   P=${br(P)}  líq=${br(liq, 1)}  DPR=${br(dpr)}`);
console.log(`força = ${br(forca)}× → ${grau}`);
console.log(`\nde:   ${antes}\npara: ${depois}`);

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

await doc.ref.update({ 'criatura.nivelAmeaca': depois, lastUpdate: new Date().toISOString(), lastUpdateBy: AUTOR });
console.log('\n✅ carimbo gravado.');
process.exit(0);
