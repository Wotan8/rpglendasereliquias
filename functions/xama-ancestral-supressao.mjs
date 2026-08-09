/**
 * Eco Ancestral passa a cobrar teste de Supressão NA PRÓPRIA INCORPORAÇÃO.
 *
 * POR QUÊ. O Ancestral entrega o dobro por 2 Energia + 2 Sanidade. Só recurso,
 * a razão é 1,15× — a mesma do Comum, justa. Contando a Ação Padrão que toda
 * habilidade custa (§0.5), ele fica 19% mais eficiente:
 *
 *   Comum      2,30 ÷ (2+1) = 0,77×
 *   Ancestral  4,60 ÷ (4+1) = 0,92×
 *
 * Subir o custo para 5 conserta a segunda leitura e quebra a primeira (0,92×,
 * abaixo do piso ≥1:1). A janela que satisfaz as duas é VAZIA para qualquer
 * pacote acima de 3,29 unidades — pacote grande é inerentemente mais eficiente
 * por ação num sistema de 1 Ação Padrão por habilidade.
 *
 * Então o preço vai onde a régua não converte em desconto: RISCO. Cânone
 * sustenta — "perigos que a mente mortal mal compreende", "vontade própria
 * forte", "suas exigências são proporcionais ao que oferece".
 *
 * Toca em três lugares, para não deixar especificação desencontrada:
 *   1. ritual Transcendência — Receptor (mod_totem)
 *   2. Régua cap. 9 (livro técnico, não público)
 *   3. Totemancia (capítulo público) — na voz de mesa
 *
 *   node functions/xama-ancestral-supressao.mjs            (dry-run)
 *   node functions/xama-ancestral-supressao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* 1 — ritual */
const RIT_DE = 'com REDUTOR igual à PRS do Eco. Role na falha crítica, a cada extensão paga, e ao fim';
const RIT_PARA = 'com REDUTOR igual à PRS do Eco. Role na falha crítica, a cada extensão paga, SEMPRE que\n'
    + 'incorporar um Eco ANCESTRAL, e ao fim';

/* 2 — livro técnico */
const TEC_DE = '<pre>teste   Alvo = AUT + Perícia: Transcendência\n'
    + '        redutor = PRS do Eco  (+ peso da Personalidade, + (5 − Disposição))\n'
    + 'quando  falha crítica na incorporação · cada extensão paga (1 SAN + 1 VIT)\n'
    + '        fim de cada cena com Eco Furioso ou Corrompido</pre>';
const TEC_PARA = '<pre>teste   Alvo = AUT + Perícia: Transcendência\n'
    + '        redutor = PRS do Eco  (+ peso da Personalidade, + (5 − Disposição))\n'
    + 'quando  falha crítica na incorporação · cada extensão paga (1 SAN + 1 VIT)\n'
    + '        fim de cada cena com Eco Furioso ou Corrompido\n'
    + '        SEMPRE que a incorporação for de Eco Ancestral</pre>\n'
    + '<h3>Por que o Ancestral testa na entrada</h3>\n'
    + '<pre>Comum      2,30 ÷ (2+1 ação) = 0,77×\n'
    + 'Ancestral  4,60 ÷ (4+1 ação) = 0,92×   → 19% mais eficiente por ação</pre>\n'
    + '<p>Só recurso, os dois dão 1,15× e o Ancestral é justo. Contando a Ação Padrão que toda '
    + 'habilidade custa (§0.5), a ação vira overhead fixo e quem entrega o dobro numa ação só '
    + 'amortiza melhor. Subir o custo para 5 conserta essa leitura e quebra a outra: 4,60 ÷ 5 = '
    + '<strong>0,92×</strong>, armadilha pelo piso.</p>\n'
    + '<pre>Leitura A (recurso) exige:        custo ≤ 4,60\n'
    + 'Leitura B (recurso + ação) exige: custo ≥ 5,00\n'
    + 'janela: VAZIA</pre>\n'
    + '<p><strong>Invariante descoberto aqui:</strong> a janela fecha para todo pacote que entregue '
    + 'mais de <code>3,29</code> unidades — <code>0,304 × entrega ≤ 1</code>. Num sistema de 1 Ação '
    + 'Padrão por habilidade, pacote grande é <em>inerentemente</em> mais eficiente por ação, e a regra '
    + '≥1:1 garante que ele também seja justo por recurso. Não existe custo que satisfaça as duas. '
    + 'Isto não é defeito da Incorporação: vale para toda magia cara do sistema, e é o que justifica '
    + 'a existência de tier.</p>\n'
    + '<p><strong>Consequência de projeto:</strong> quando um tier alto ficar eficiente demais por ação, '
    + 'o preço vai em <strong>risco</strong>, não em recurso. Risco mora do lado do custo e a régua não o '
    + 'converte em desconto. Aqui: o Ancestral testa Supressão já na incorporação.</p>';

/* 3 — capítulo público, voz de mesa */
const PUB_DE = '<p><strong>Na prática:</strong> a Lei da Reciprocidade não é conselho moral. É a única coisa entre o Xamã e o hóspede que gostou da casa.</p>';
const PUB_PARA = '<p>Com os Ancestrais não há período de cortesia. O que desce do Astral chega inteiro, com nome, com memória e com vontade — e a primeira coisa que faz ao entrar é medir o tamanho de quem abriu. <strong>Toda comunhão com um Ancestral começa com o Xamã segurando a porta.</strong> Xamã que não aguenta esse primeiro empurrão descobre, tarde, que o Eco não veio visitar.</p>\n'
    + PUB_DE;

assert.ok(!/custa|Energia|Sanidade/.test(PUB_PARA.replace(PUB_DE, '')), 'a seção pública não fala em recurso — isso é ficha, não prosa');
assert.ok(/SEMPRE que/.test(RIT_PARA) && /SEMPRE que/.test(TEC_PARA), 'a regra nova em ambas as especificações');

const [modsSnap, artsSnap] = await Promise.all([
    db.collection('system/data/classModules').get(),
    db.collection('worldbuilding-articles').get(),
]);
const arts = artsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
const totem = modsSnap.docs.find(d => d.id === 'mod_totem');
const cap9 = arts.find(a => /^9 — Incorporação/.test(a.title || ''));
const capPub = arts.find(a => /^Totemancia/i.test(a.title || ''));
const erros = [];
const alvos = [];

const itens = (totem?.data().itensPredefinidos || []).map(it => {
    if (it.nome !== 'Transcendência — Receptor') return it;
    const t = String(it.descricao || '');
    if (!t.includes(RIT_DE)) { erros.push('ritual: âncora não achada'); return it; }
    if (t.includes('SEMPRE que')) { erros.push('ritual: regra já aplicada'); return it; }
    const novo = t.replace(RIT_DE, RIT_PARA);
    alvos.push({ o: 'ritual Transcendência — Receptor' });
    return { ...it, descricao: novo, valores: { ...(it.valores || {}), 6: novo } };
});
if (!totem) erros.push('mod_totem não achado');

let html9 = null;
if (!cap9) erros.push('Régua cap. 9 não achado');
else if (!String(cap9.contentHTML).includes(TEC_DE)) erros.push('cap. 9: âncora não achada');
else if (String(cap9.contentHTML).includes('janela: VAZIA')) erros.push('cap. 9: já aplicado');
else { html9 = String(cap9.contentHTML).replace(TEC_DE, TEC_PARA); alvos.push({ o: 'Régua cap. 9 (+ o invariante)' }); }

let htmlPub = null;
if (!capPub) erros.push('capítulo Totemancia não achado');
else if (!String(capPub.contentHTML).includes(PUB_DE)) erros.push('Totemancia: âncora não achada');
else if (/período de cortesia/.test(String(capPub.contentHTML))) erros.push('Totemancia: já aplicado');
else { htmlPub = String(capPub.contentHTML).replace(PUB_DE, PUB_PARA); alvos.push({ o: 'Totemancia (público)' }); }

console.log('=== Eco Ancestral: Supressão na incorporação ===\n');
console.log('  Comum      2,30 ÷ (2+1 ação) = 0,77×');
console.log('  Ancestral  4,60 ÷ (4+1 ação) = 0,92×   → o preço vai em risco, não em recurso\n');
for (const a of alvos) console.log(`  ~ ${a.o}`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (alvos.length !== 3) { console.error(`\n🔴 ABORTADO: ${alvos.length}/3 alvos.`); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const w = h => h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const batch = db.batch();
batch.update(totem.ref, { itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
batch.update(cap9.ref, { contentHTML: html9, words: w(html9), updatedAt: agora });
batch.update(capPub.ref, { contentHTML: htmlPub, words: w(htmlPub), updatedAt: agora });
await batch.commit();
console.log('\n✅ Ritual, Régua e capítulo público — os três alinhados.');
process.exit(0);
