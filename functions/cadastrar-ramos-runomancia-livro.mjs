/**
 * Compêndio de Runomancia — Parte XIV: Os Três Ofícios da Gravação.
 *
 * O capítulo público dos ramos (Escripta, Talhador, Tatuador), na voz do
 * compêndio. A base de tempo/custo é o §6.4 que já existe (CT ÷ 5 horas,
 * 2 L$ × CT) — o capítulo NÃO a contradiz: declara os multiplicadores de cada
 * ofício por cima dela.
 *
 * Inclui as regras decididas nesta frente: fórmulas de usos, Domínios de
 * 12 EXP, runa emprestada (gatilho simples / lógica de acesso), comportamento
 * de materiais, e condições por natureza (mapa das confluências).
 *
 *   node functions/cadastrar-ramos-runomancia-livro.mjs            (dry-run)
 *   node functions/cadastrar-ramos-runomancia-livro.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const BOOK = 'book_ms3gb8w3l8qous';

const CAP = {
    title: '🖋️ Parte XIV — Os Três Ofícios da Gravação',
    synopsis: 'Escripta, Talhador e Tatuador: a mesma runa, três mãos. Tempos, custos, usos, e quem pode ativar o quê.',
    html: `
<p><em>"O circuito não sabe se foi pintado, entalhado ou agulhado. Quem sabe é o tempo."</em></p>
<p>Uma runa é o mesmo circuito em qualquer superfície — a auditoria não muda, o CT não muda, a Lei da Forma não perdoa ninguém. O que muda é a <b>mão</b>: três ofícios gravam, e cada um paga de um jeito. Os números abaixo multiplicam a base da Parte VI (tempo = CT ÷ 5 horas · material ≈ 2 L$ × CT).</p>
<table><tr><th></th><th>🖌️ Escripta</th><th>🪨 Talhador</th><th>🪡 Tatuador</th></tr>
<tr><td>Ferramenta</td><td>pincel e tinta</td><td>talhadeiras</td><td>agulhas rituais</td></tr>
<tr><td>Superfície</td><td>papel, tecido, parede</td><td>pedra, metal, madeira, osso</td><td><b>carne viva</b></td></tr>
<tr><td>Tempo</td><td><b>0,75×</b></td><td><b>4×</b></td><td><b>1,25×</b></td></tr>
<tr><td>Material</td><td>≈ 1 L$ × CT</td><td>≈ 2 L$ × CT</td><td>≈ 3 L$ × CT, e exige Infusor</td></tr>
<tr><td>Perícia</td><td>Escripta Rúnica</td><td>Talha Rúnica</td><td>Tatuagem Rúnica</td></tr>
<tr><td>Usos</td><td>muito poucos</td><td>muitos</td><td>permanente no portador</td></tr></table>
<h4>Quanto dura o que você gravou</h4>
<p><b>Escripta:</b> usos = Escripta Rúnica + qualidade da tinta (comum 0 · fina +1 · mestra +2) − ⌈CT ÷ 20⌉, mínimo 1. A tinta corre rápido e morre cedo — é o improviso legítimo do runomago apertado.</p>
<p><b>Talhador:</b> a mesma conta, <b>× 10</b> (mínimo 10). A pedra envelhece, e re-entalhar é serviço que o Talhador cobra. Quatro vezes mais lento que a base: é o ofício da paciência, e do que fica.</p>
<p><b>Tatuador:</b> permanente enquanto a pele for do portador. Escalpelada a pele, perdido o membro, perdida a runa. O Rastro anda com a pessoa, e a Lei da Afinidade (Parte IV) governa cada gota de tinta na carne — o Protocolo de Valdris não é sugestão.</p>
<p><b>Domínio</b> (Peculiaridade, 12 EXP por ofício): sem ele, qualquer um com a perícia grava <em>rascunho</em> — usos travados em 1 e −2 no Teste de Construção. <b>Gravação Rúnica</b> segue sendo a teoria comum dos três: −10% de tempo por nível, em qualquer ofício.</p>
<h4>Ferramentas e materiais</h4>
<p>Todo material de bancada se comporta de um de três jeitos: <b>Consumido</b> (tinta, papel, Lunis — some no uso), <b>Desgastável</b> (pincéis, talhadeiras finas — cada uso soma desgaste, e a chance de estragar é o desgaste em 1d10) ou <b>Resistente</b> (talhadeiras pesadas, a bancada — só quebram em falha crítica). Ferramenta com desgaste 7+ é aposta: trocar é mais barato que perder a gravação.</p>
<h4>Quem pode ativar uma runa</h4>
<p><b>Qualquer pessoa</b> ativa uma runa de gatilho simples — Toque, alavanca, pressão — com 1 Ação Padrão. O circuito faz o resto; é para isso que ele existe. Runa com lógica de acesso obedece à lógica: Reconhecedor só responde à biometria cadastrada, Selector só a quem foi selecionado, Contador para quando a contagem acaba. <b>O controle de quem usa é projeto, não regra</b> — o runomago que não quer emprestar não esconde a runa: grava um Reconhecedor.</p>
<h4>A runa fere com a natureza dela</h4>
<p>Toda runa ofensiva aplica, além do dano, a <b>condição</b> da sua natureza — Fogo queima (Queimadura), Gelo congela (Congelamento, a trilha de três níveis), Raio atordoa. O mapa completo das vinte e uma Confluências e suas condições está registrado junto às condições do sistema; o portão (Chance ou resistência) é declarado no projeto, como em qualquer habilidade.</p>
<p><em>Um aviso de ofício: o mundo inteiro pode carregar as suas runas — o guerreiro leva a lâmina de Metal, o batedor leva a pedra de luz. O runomago está em quatro lugares ao mesmo tempo, e é exatamente por isso que os tribunais de Vasteluna tratam a assinatura do Rastro como testemunha.</em></p>
`,
};

const caps = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const erros = [];
if (caps.some(d => /Parte XIV/.test(d.data().title || ''))) erros.push('Parte XIV já existe');
const maxOrder = Math.max(...caps.map(d => d.data().order ?? 0));
const palavras = CAP.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

console.log('=== Compêndio de Runomancia — capítulo novo ===\n');
console.log(`  ${CAP.title}  (${palavras} palavras, order ${maxOrder + 1})`);
for (const s of ['0,75×', '4×', '1,25×', 'Escripta Rúnica', 'Congelamento', 'Reconhecedor', 'Consumido', 'rascunho']) {
    if (!CAP.html.includes(s)) erros.push(`faltou no texto: ${s}`);
}
if (/mentaliz/i.test(CAP.html)) erros.push('mentalização não existe');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('  ✅ auto-verificação passou.');
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
await db.collection('worldbuilding-articles').add({
    bookId: BOOK, title: CAP.title, synopsis: CAP.synopsis, contentHTML: CAP.html.trim(),
    order: maxOrder + 1, status: 'publicado', public: true, mentions: [], words: palavras,
    createdAt: agora, updatedAt: agora, updatedBy: 'igorestevamalvesdesouza@gmail.com',
});
console.log('\n✅ Parte XIV gravada (pública).');
process.exit(0);
