/**
 * Transcendência — Projetor: o Redutor do Véu sai da prosa e vira regra viva.
 *
 * O Efeito já dizia "Véu Etérico (Redutor 2) ou Astral (Redutor 4)" — e ninguém
 * aplicava, porque nada no código conhecia Véu. Agora a janela do Tabuleiro
 * mostra os dois preços de cada camada e o log registra os dois.
 *
 * Este script só reescreve o Efeito para que os dois eixos apareçam juntos, na
 * mesma tabela, em vez de a Sanidade estar num parágrafo e o Redutor perdido na
 * primeira linha.
 *
 *   node functions/projetor-redutor-veu.mjs            (dry-run)
 *   node functions/projetor-redutor-veu.mjs --apply
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

const NOVO = `Projeta a consciência no Eco; o corpo entra em transe (inerte, vulnerável). A projeção NÃO recebe Dádiva — quem se projeta joga a ficha do hóspede, não empresta pedaços dela.

O VÉU — até onde a consciência sobe. Subir cobra duas coisas, e as duas de uma vez:
· SANIDADE = 1 + (Poder do Eco ÷ 3, arredondado para baixo) + Véu
· REDUTOR no teste de Transcendência (Projetor), que é a dificuldade subtraída do Alvo

Véu Material — Véu 0 · Redutor 0. O mundo físico.
Véu Etérico — Véu +1 · Redutor 2. Exige Transcendência 3+.
Véu Astral — Véu +2 · Redutor 4. Exige um Eco que tenha transcendido.

Eco de Poder 2 no Material custa 1 de Sanidade. Eco de Poder 8 no Astral custa 5 de Sanidade e tira 4 do Alvo. Não existe projeção de graça.`;

const m = (await ref.get()).data();
const itens = m.itensPredefinidos.map(p => ({ ...p }));
const p = itens.find(x => x.nome === 'Transcendência — Projetor');
const velho = p?.valores?.['6'];
if (!velho) { console.error('ABORTA: predef ou Efeito sumiu'); process.exit(1); }
if (!velho.includes('Véu Etérico (Redutor 2)')) { console.error('ABORTA: o Efeito nao esta no estado esperado (o sinal do Redutor ja saiu?)'); process.exit(1); }
p.valores = { ...p.valores, '6': NOVO };
if (p.descricao === velho) p.descricao = NOVO;

console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
console.log(`Efeito: ${velho.length} → ${NOVO.length} chars\n`);
console.log('Confere contra o motor (shared/incorporacao.js):');
for (const v of ['material', 'eterico', 'astral']) {
    const c = custoDaProjecao({ atributos: { PRS: 8 } }, v);
    const bate = NOVO.includes(`Redutor ${c.redutor}`) || c.redutor === 0;
    console.log(`  ${v.padEnd(9)} Sanidade ${c.sanidade} · Redutor ${c.redutor}  ${bate ? 'texto bate' : '!! TEXTO DIVERGE'}`);
    if (!bate) process.exit(1);
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ itensPredefinidos: itens });
console.log('\nOK gravado');
process.exit(0);
