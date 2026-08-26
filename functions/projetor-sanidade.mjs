/**
 * Transcendência — Projetor: a Sanidade passa a ser calculada, não fixa.
 *
 * Decisão de 25/08/2026, mesma linha do Receptor: nada de piso fixo somado a um
 * variável. A projeção cobra pelo que ela é — sair do corpo e controlar um
 * espírito intangível, que atravessa o sólido — e isso escala com o Poder do
 * hóspede e com a profundidade do Véu:
 *
 *      Sanidade = 1 + ⌊Poder do Eco ÷ 3⌋ + Véu (Material 0 · Etérico 1 · Astral 2)
 *
 * Nunca zero. O Eco mais banal (Poder 2) cobra 1; o Mestre de Armas (Poder 8)
 * no Astral cobra 5. A conta mora em shared/incorporacao.js (`custoDaProjecao`),
 * com os dois botões ajustáveis.
 *
 * Some daqui a alternativa "1 Energia + 2 Sanidade" pelo mesmo motivo que sumiu
 * do Receptor: era Sanidade fixa por cima de Sanidade variável.
 *
 * NÃO TOCA no Receptor nem em "Vincular Eco (Antiqua)".
 *
 *   node functions/projetor-sanidade.mjs            (dry-run)
 *   node functions/projetor-sanidade.mjs --apply
 */
import { createRequire } from 'node:module';
import { custoDaProjecao } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('system').doc('data').collection('classModules').doc('mod_totem');

const CUSTO_VELHO = '2 Energia ou 1 Energia + 2 Sanidade';
const CUSTO_NOVO = '2 Energia';
const EFEITO_VELHO = 'Projeta a consciência no Eco; o corpo entra em transe (inerte, vulnerável). Pode elevar-se ao Véu Etérico (Redutor +2) ou Astral (Redutor +4) se o Eco tiver transcendido.';
const EFEITO_NOVO = `Projeta a consciência no Eco; o corpo entra em transe (inerte, vulnerável). Pode elevar-se ao Véu Etérico (Redutor +2) ou Astral (Redutor +4) se o Eco tiver transcendido.

A projeção NÃO recebe Dádiva — quem se projeta joga a ficha do hóspede, não empresta pedaços dela.

SANIDADE: sair do corpo e controlar um espírito que atravessa o sólido cobra sempre, e cobra mais quanto mais forte o hóspede e mais fundo o Véu.
· Sanidade = 1 + (Poder do Eco ÷ 3, arredondado para baixo) + Véu
· Véu: Material 0 · Etérico +1 · Astral +2
Eco de Poder 2 no Material custa 1. Eco de Poder 8 no Astral custa 5. Não existe projeção de graça.`;

const m = (await ref.get()).data();
const itens = m.itensPredefinidos.map(p => ({ ...p }));
const p = itens.find(x => x.nome === 'Transcendência — Projetor');
if (!p) { console.error('ABORTA: predef sumiu'); process.exit(1); }
if (p.valores?.['4'] !== CUSTO_VELHO) { console.error(`ABORTA: custo e ${JSON.stringify(p.valores?.['4'])}`); process.exit(1); }
if (p.valores?.['6'] !== EFEITO_VELHO) { console.error('ABORTA: o Efeito nao esta no estado esperado'); process.exit(1); }

p.valores = { ...p.valores, '4': CUSTO_NOVO, '6': EFEITO_NOVO };
if (p.descricao === EFEITO_VELHO) p.descricao = EFEITO_NOVO;

console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`Custo: ${CUSTO_VELHO}  →  ${CUSTO_NOVO}`);
console.log(`Efeito: ${EFEITO_VELHO.length} → ${EFEITO_NOVO.length} chars\n`);
console.log('A escada, com os Ecos que existem hoje:');
for (const [nome, prs] of [['Eco do Servo', 2], ['Eco do Soldado Raso', 3], ['Eco do Batedor', 4],
    ['Eco do Velho de Muitas Vidas', 6], ['Eco do Mestre de Armas', 8], ['(Ancestral)', 10]]) {
    const l = ['material', 'eterico', 'astral'].map(v => `${v.padEnd(9)} −${custoDaProjecao({ atributos: { PRS: prs } }, v).sanidade}`);
    console.log(`  ${nome.padEnd(30)} Poder ${String(prs).padStart(2)}   ${l.join('  ')}`);
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ itensPredefinidos: itens });
console.log('\nOK gravado');
process.exit(0);
