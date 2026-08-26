/**
 * Transcendência — Receptor: a Sanidade é SÓ a escalonada.
 *
 * Decisão de 25/08/2026. O predef cobrava duas vezes pela mesma coisa:
 *   · Custo fixo, alternativa "1 Energia + 2 Sanidade"
 *   · Ancestral: "o custo passa a 2 Energia + 2 Sanidade"
 *   · E, por cima, custoEscalonado() em shared/incorporacao.js — +1 de Sanidade
 *     a cada 2 unidades entregues acima de 2.
 *
 * Fica só a escalonada. O custo declarado passa a ser 2 Energia, e o Ancestral
 * não ganha linha de Sanidade própria: dobrar a Dádiva já dobra o excedente, e
 * a escalonada cobra sozinha. É a mesma ideia do §9.4 — "risco mora do lado do
 * custo" — sem o piso fixo por cima.
 *
 * NÃO TOCA em "Transcendência — Projetor", que tem o mesmo custo declarado mas
 * NÃO recebe Dádiva: tirar a Sanidade fixa dele deixaria o ritual de graça.
 * Nem em "Vincular Eco (Antiqua)" (10 Sanidade), que é ritual de 8h, não
 * incorporação.
 *
 *   node functions/receptor-sanidade-escalonada.mjs            (dry-run)
 *   node functions/receptor-sanidade-escalonada.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('system').doc('data').collection('classModules').doc('mod_totem');

const CUSTO_VELHO = '2 Energia ou 1 Energia + 2 Sanidade';
const CUSTO_NOVO = '2 Energia';
const ANC_VELHO = 'Eco ANCESTRAL dobra a Dádiva — mas o dobro também para no teto — e o custo passa a\n2 Energia + 2 Sanidade.';
const ANC_NOVO = 'Eco ANCESTRAL dobra a Dádiva — mas o dobro também para no teto. O custo em Energia não\nmuda: o dobro entregue já cobra o dobro na escalonada, que é a ÚNICA Sanidade desta\nhabilidade.';

const m = (await ref.get()).data();
const itens = m.itensPredefinidos.map(p => ({ ...p }));
const p = itens.find(x => x.nome === 'Transcendência — Receptor');
if (!p) { console.error('ABORTA: predef sumiu'); process.exit(1); }
if (p.valores?.['4'] !== CUSTO_VELHO) { console.error(`ABORTA: custo e ${JSON.stringify(p.valores?.['4'])}, esperado ${JSON.stringify(CUSTO_VELHO)}`); process.exit(1); }
if (!p.valores?.['6']?.includes(ANC_VELHO)) { console.error('ABORTA: a linha do Ancestral nao esta no estado esperado'); process.exit(1); }
if (p.regua?.pecas?.custo !== CUSTO_VELHO) { console.error('ABORTA: regua.pecas.custo divergente'); process.exit(1); }

p.valores = { ...p.valores, '4': CUSTO_NOVO, '6': p.valores['6'].replace(ANC_VELHO, ANC_NOVO) };
if (p.descricao?.includes(ANC_VELHO)) p.descricao = p.descricao.replace(ANC_VELHO, ANC_NOVO);
p.regua = { ...p.regua, pecas: { ...p.regua.pecas, custo: CUSTO_NOVO } };

const sobra = JSON.stringify(p).match(/[^"\\]{0,40}\d+ Sanidade[^"\\]{0,40}/g) || [];
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`Custo:            ${CUSTO_VELHO}  →  ${CUSTO_NOVO}`);
console.log(`regua.pecas.custo ${CUSTO_VELHO}  →  ${CUSTO_NOVO}`);
console.log(`Ancestral:        sem linha de Sanidade fixa`);
console.log(`\nSanidade que resta no predef:`);
for (const s of sobra) console.log(`  · ${s.trim()}`);
if (sobra.some(s => /\+ \d+ Sanidade|passa a\\n?2 Energia \+/.test(s))) { console.error('\nABORTA: sobrou Sanidade fixa'); process.exit(1); }
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ itensPredefinidos: itens });
console.log('\nOK gravado');
process.exit(0);
