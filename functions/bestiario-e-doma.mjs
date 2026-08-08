/**
 * Duas entregas:
 *
 *  1. DOMA — as feras selvagens pré-existentes entram na situação do Druida.
 *     O cânone do Vínculo Animal já manda: "AUT + Domar, com o Redutor da
 *     criatura" — mas nenhuma criatura tem Redutor. Este script preenche o
 *     `criatura.nivelAmeaca` (vazio hoje) das 4 feras sem mesa com a escada:
 *
 *       força ≤0,6× guerreiro → Redutor −1 · Lealdade mínima 6
 *       força ≤1,0×          → Redutor −3 · Lealdade mínima 8
 *       força  >1,0×          → Redutor −5 · Lealdade mínima 10
 *
 *     Fera acima do orçamento de companheiro (0,6×) nasce com as melhorias
 *     PRÉ-GASTAS: cada ~0,13× acima do orçamento consome 1 do teto de 5. Um
 *     Velocirops domado já chega pronto — e não cresce mais.
 *
 *     NPCs de mesa (Gorren-Nhar, Sentinela, Ibirá) NÃO são tocados.
 *
 *  2. BESTIÁRIO — o livro sai do placeholder ("Bixo 1" / "fgsdfgsdfgdsfg"):
 *     o capítulo-lixo vira a introdução, e entram 4 capítulos com as criaturas.
 *
 *   node functions/bestiario-e-doma.mjs            (dry-run)
 *   node functions/bestiario-e-doma.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const BOOK = 'book_mrs9ur4aw1m6a';

/* ── 1. doma das feras selvagens (sem mesa, nivelAmeaca vazio) ── */
const DOMA = {
    'Velocirops': 'Fera de grande porte (~1,3× guerreiro) · Domável: AUT + Domar, Redutor −5 · Vínculo: Lealdade 10 · chega com as 5 melhorias pré-gastas — não cresce mais',
    'Ratazana':   'Besta comum (~0,5× guerreiro) · Domável: AUT + Domar, Redutor −1 · Vínculo: Lealdade 6',
    'Papa-Noite': 'Predador incomum (~1,2× guerreiro) · magifago — indomável, salvo decisão do Narrador',
    'Avarbus':    'Necrófago incomum (~0,8× guerreiro) · indomável, salvo decisão do Narrador',
};

/* ── 2. capítulos do Bestiário ── */
const INTRO = {
    title: 'Como se lê uma fera',
    synopsis: 'Os três eixos de qualquer criatura — Disposição, Lealdade e a obediência dos mortos — e as regras de doma e vínculo.',
    html: `
<blockquote><p><em>"Toda criatura obedece a alguma coisa. O trabalho é descobrir a quê."</em></p></blockquote>
<p>Este bestiário separa as criaturas pelo que as move, porque é isso que decide o que acontece na mesa. Três eixos, um por capítulo:</p>
<ul>
<li><strong>Disposição</strong> (0–10) — o quanto uma criatura invocada age por quem a chamou. O Mestre a gera em segredo; o Laço de Nome move ±1. Abaixo de 5, ela trabalha contra.</li>
<li><strong>Lealdade</strong> (0–10) — o quanto uma fera de vínculo age pelo Druida. Sobe por convivência, nunca por Luns. A partir de 6, cada ponto compra uma melhoria (+1 em Alvo, dano ou Blindagem, ou +3 de Vitalidade; teto 5).</li>
<li><strong>Obediência dos erguidos</strong> — fantoche não tem eixo: executa. O preço está na carne, que é pouca.</li>
</ul>
<h3>Domar</h3>
<p>Conseguir uma fera é teste universal, de qualquer classe: <strong>AUT + Domar, com o Redutor da criatura</strong> — anotado na ficha de cada uma. O vínculo do Druida (e a Fusão Selvagem) exige a Lealdade mínima da fera, também anotada.</p>
<p><strong>Fera forte chega pronta:</strong> criatura acima do porte de companheiro nasce com as melhorias pré-gastas. Um Velocirops domado já é o que sempre vai ser — magnífico, e terminado.</p>
<h3>O que os números querem dizer</h3>
<p>O Alvo e o dano de cada criatura foram medidos contra a régua do sistema: "1,0× guerreiro" significa que ela rende, por rodada, o que rende um guerreiro de referência. Um grupo de quatro derruba uma criatura de 2,0× em poucas rodadas — se ninguém errar. As de 3,0× não se derrubam: se sobrevive a elas.</p>
`,
};

const ABISSAIS = {
    title: 'As Respostas do Abismo',
    synopsis: 'O que atende quando um Invocador rasga o véu — do menor ao que não deveria ser chamado.',
    html: `
<p>O rito não escolhe. O <strong>CA</strong> do invocador escolhe: quanto mais funda a mente no Abismo, maior — e menos dócil — o que responde. A Disposição de cada resposta é gerada em segredo pelo Mestre; os valores abaixo são a base típica.</p>
<table>
<thead><tr><th>Criatura</th><th>Responde a</th><th>Alvo</th><th>Dano</th><th>Vit</th><th>Bld</th><th>Disposição</th></tr></thead>
<tbody>
<tr><td><strong>Cria Menor do Véu</strong></td><td>CA 2–3</td><td>7</td><td>1d8+4</td><td>12</td><td>0</td><td>5</td></tr>
<tr><td><strong>Cria da Fenda</strong></td><td>CA 4–5</td><td>8</td><td>1d10+5</td><td>18</td><td>1</td><td>4</td></tr>
<tr><td><strong>Horror Rastejante</strong></td><td>CA 6–7</td><td>9</td><td>1d10+6</td><td>24</td><td>2</td><td>4</td></tr>
<tr><td><strong>Horror Maior</strong></td><td>CA 8–9</td><td>10</td><td>1d12+6 (+1)</td><td>30</td><td>2</td><td>3</td></tr>
<tr><td><strong>Entidade da Oitava</strong></td><td>CA 10+</td><td>11</td><td>1d12+8 (+2)</td><td>36</td><td>3</td><td>2</td></tr>
</tbody>
</table>
<p>Os dois últimos carregam Transbordo — acertam fundo mesmo quando o azar ajuda o outro lado. E note a coluna final: <strong>a resposta melhor é a menos sua.</strong> A Cria Menor testa a coleira quando não é observada. O Horror Maior anota cada ordem como débito. A Entidade sabe quem abriu a porta para quem.</p>
<p>A conta do rito é a da Régua: invocar são é prejuízo — a resposta fraca só se paga dominada. Invocar à beira do colapso é negócio. O Abismo prefere devedores.</p>
`,
};

const ERGUIDOS = {
    title: 'Os Erguidos',
    synopsis: 'O que a Necromancia põe de pé: o fantoche descartável e o servo que lembra.',
    html: `
<p><strong>Fantoche</strong> — Alvo 5, 1d4, Vitalidade 6, meia marcha. Não desvia, não recua, não pensa; executa a última ordem até cair, e cai rápido. O valor não está no golpe: está no corpo — cada machadada que um fantoche come é uma que o grupo não comeu. O Adepto sustenta <strong>PRE + Servos</strong> de pé ao mesmo tempo (Limite de Fantoches), e o gargalo verdadeiro é outro: precisa de cadáver no chão.</p>
<p><strong>Servo Reanimado</strong> — Alvo 6, 1d6+3, Vitalidade 15, Blindagem 1. O produto do Ritual de Reanimação, com o Fragmento de Identidade preservado no 4º Passo: lembra de quem foi, e obedece quem o trouxe. É companheiro permanente — mesma régua do aliado do Druida, sem a Lealdade: o vínculo dele foi selado de outro jeito, e não cresce.</p>
`,
};

const COMPANHEIROS = {
    title: 'Companheiros e Feras Domáveis',
    synopsis: 'Os quatro vínculos do Druida, e as feras de Vasteluna que aceitam coleira — por um preço.',
    html: `
<p>Companheiro entra na mesa pela régua: ~0,6× o guerreiro na chegada, crescendo pela <strong>Lealdade</strong> (uma melhoria por ponto a partir de 6, teto 5). Domar é universal — AUT + Domar contra o Redutor da fera — mas o vínculo e a Fusão Selvagem são do Druida.</p>
<table>
<thead><tr><th>Fera</th><th>Alvo</th><th>Dano</th><th>Vit</th><th>Desloc.</th><th>O que a distingue</th></tr></thead>
<tbody>
<tr><td><strong>Lobo</strong></td><td>6</td><td>1d6+3</td><td>12</td><td>13,5m</td><td>flanqueia por instinto: +1 no Alvo com aliado adjacente ao alvo</td></tr>
<tr><td><strong>Urso</strong></td><td>5</td><td>1d8+4</td><td>9m</td><td>18</td><td>péssimo de terminar contra; protege o vínculo acima da própria fome</td></tr>
<tr><td><strong>Corvo</strong></td><td>5</td><td>1d4</td><td>6</td><td>voo 18m</td><td>vale pelos olhos; reporta a quem tem Linguagem Animal</td></tr>
<tr><td><strong>Serpente</strong></td><td>6</td><td>1d4+1</td><td>8</td><td>7,5m</td><td>a mordida leva Toxis 1 — 1 de dano por rodada, por 2 rodadas</td></tr>
</tbody>
</table>
<h3>As que aceitam coleira, por um preço</h3>
<p><strong>Velocirops</strong> — a fera grande dos campos abertos (~1,3× guerreiro). Domável e hostil, na mesma frase: Redutor −5, e o vínculo exige Lealdade 10. Chega com as cinco melhorias pré-gastas — quem doma um Velocirops não cria um filhote: assina um tratado.</p>
<p><strong>Ratazana</strong> — a besta dos esgotos e catacumbas (~0,5×). Redutor −1, Lealdade 6. Ninguém se orgulha; funciona.</p>
`,
};

const PREDADORES = {
    title: 'Predadores de Vasteluna',
    synopsis: 'As que não aceitam coleira: caçam, e uma delas caça exatamente o que você tem de mais caro.',
    html: `
<p><strong>Papa-Noite</strong> — solitário, hostil, <strong>magifago</strong>: come magia. Vitalidade 42, e a razão de ser temido não é o golpe — é a dieta. Onde um Papa-Noite caça, conjurador é presa preferencial. Indomável, salvo decisão do Narrador — e o Narrador que decidir isso sabe o que está fazendo.</p>
<p><strong>Avarbus</strong> — necrófago de ruína e masmorra (~0,8× guerreiro), caça sozinho, em par ou em esquadrão de até quatro. Aparece onde algo morreu; se nada morreu ainda, é porque ele chegou cedo.</p>
<p><em>As criaturas senhoras de campanha — as que têm nome próprio e mesa — não constam deste bestiário. Quem as encontrou sabe; quem não encontrou, melhor assim.</em></p>
`,
};

/* ═══ EXECUÇÃO ═══ */
const npcs = (await db.collection('npcs').get()).docs;
const caps = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const placeholder = caps.find(d => (d.data().title || '') === 'Bixo 1');
const erros = [];
const alvosDoma = [];
for (const [nome, texto] of Object.entries(DOMA)) {
    const doc = npcs.find(d => d.data().nome === nome && !d.data().mesaId);
    if (!doc) { erros.push(`fera "${nome}" não achada (ou tem mesa)`); continue; }
    const atual = doc.data().criatura?.nivelAmeaca || '';
    if (atual) { erros.push(`"${nome}" já tem nivelAmeaca: ${atual.slice(0, 40)}`); continue; }
    alvosDoma.push({ doc, nome, texto });
}
if (!placeholder) erros.push('capítulo placeholder "Bixo 1" não achado');
const NOVOS = [ABISSAIS, ERGUIDOS, COMPANHEIROS, PREDADORES];
for (const c of NOVOS) if (caps.some(d => d.data().title === c.title)) erros.push(`capítulo já existe: ${c.title}`);

console.log('=== Doma + Bestiário ===\n');
console.log('1. Feras selvagens ganham Redutor de Doma (nivelAmeaca estava vazio):');
for (const a of alvosDoma) console.log(`   ${a.nome.padEnd(12)} → ${a.texto.slice(0, 80)}…`);
console.log('\n2. Bestiário:');
console.log(`   ~ "Bixo 1" (placeholder) → "${INTRO.title}"`);
for (const c of NOVOS) {
    const w = c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`   + "${c.title}" (${w} palavras)`);
}
console.log('\n   Fora do livro, de propósito: Gorren-Nhar, Sentinela da Feira e Ibirá (mesa).');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = Date.now();
const batch = db.batch();
for (const a of alvosDoma) {
    batch.update(a.doc.ref, { 'criatura.nivelAmeaca': a.texto, lastUpdate: new Date().toISOString() });
}
batch.update(placeholder.ref, {
    title: INTRO.title, synopsis: INTRO.synopsis, contentHTML: INTRO.html.trim(), order: 0,
    words: INTRO.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, updatedAt: agora,
});
NOVOS.forEach((c, i) => {
    batch.set(db.collection('worldbuilding-articles').doc(), {
        bookId: BOOK, title: c.title, synopsis: c.synopsis, contentHTML: c.html.trim(),
        order: i + 1, status: 'publicado', public: false, mentions: [],
        words: c.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
        createdAt: agora, updatedAt: agora, updatedBy: 'igorestevamalvesdesouza@gmail.com',
    });
});
await batch.commit();
console.log(`\n✅ ${alvosDoma.length} feras com doma + Bestiário com 5 capítulos.`);
process.exit(0);
