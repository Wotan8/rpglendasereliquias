/**
 * Régua de Balanceamento — duas verificações que faltavam, ambas descobertas
 * porque a regra ≥1,00 não as pega:
 *
 *   cap. 1  §1.6  Espalhamento por tier
 *   cap. 4  §4.7  Conversão de recurso não pode dar lucro
 *
 *   node functions/livro-regua-espalhamento.mjs            (dry-run)
 *   node functions/livro-regua-espalhamento.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const col = db.collection('worldbuilding-articles');
const docs = (await col.where('bookId', '==', 'book-regua-balanceamento').get()).docs;

const ESPALHAMENTO = `
<h2>1.6 Espalhamento por tier</h2>
<p>A regra do §1.4 tem <strong>piso e não tem teto</strong>. Duas habilidades do mesmo tier podem passar as duas e ainda assim uma valer cinco vezes a outra — e o jogador que escolheu a fraca está pagando o mesmo preço por um quinto do efeito. Piso não é balanceamento; é só o mínimo.</p>
<blockquote><p><strong>Verificação separada:</strong> dentro de cada tier, a razão da melhor sobre a pior. Até <strong>~1,8×</strong> é saudável — habilidade flexível legitimamente vale mais que habilidade estreita. Acima de <strong>2,5×</strong> o tier deixou de significar preço.</p></blockquote>

<h3>Qual é o tier</h3>
<p>Depende de como a classe organiza o módulo:</p>
<ul>
<li><strong>O módulo é o tier</strong> quando ele organiza por preço — "Custo 3 — Clímax" do Bardo, os Círculos do Sangral e do Pallacerdote.</li>
<li><strong>O custo é o tier</strong> quando o módulo é só um container. "Manobras" guarda 19 habilidades de Guerreiro <em>e</em> de Ladino; agrupar por módulo compara uma manobra de 1 Energia com uma de 2, que nunca disputaram o mesmo preço.</li>
</ul>

<h3>O caso que originou a regra</h3>
<p>O Custo 4 do Bardo tinha <strong>4,73× de espalhamento</strong> — RÉQUIEM em 5,25× e MARCHA DO CATACLISMO em 1,11× — e <em>nenhuma das quatro reprovava</em>. As duas grandes eram efeito de pool inteiro aplicado em área: drenar toda a Energia (≈7 unidades por alvo) e roubar uma ação por turno pela cena (5,00 por alvo). Corrigidas, o tier fechou em 1,58×.</p>

<h3>Antes de corrigir, desconfie do instrumento</h3>
<p>Na varredura que produziu esta seção, <strong>três dos cinco extremos eram erro de medição e dois eram design</strong>. Um extremo isolado no relatório é mais provavelmente uma leitura torta que uma habilidade quebrada — principalmente quando a habilidade depende de outra (combo de preparação) ou é um estado com vários gatilhos.</p>
`;

const CONVERSAO = `
<h2>4.7 Conversão de recurso não pode dar lucro</h2>
<blockquote><p>Habilidade que devolve recurso tem que devolver <strong>no máximo o que custou</strong>.</p></blockquote>
<p>Esta é a única regra do documento que a razão custo × efeito <strong>não consegue</strong> verificar, porque o problema não está na razão. Uma habilidade pode ficar em 2,89× e o número não dizer o que importa.</p>
<p><strong>Caso medido:</strong> <em>Fúria Inspirada</em> (Custo 3) devolvia 1 de Energia a cada aliado num raio — quatro aliados, quatro Energias, por três de Harmonia gastos. <strong>Lucro líquido de +1 por conjuração, repetível.</strong> Um recurso que se paga e sobra é motor perpétuo, e a régua marcava só "2,89×, aprovado".</p>
<p>Corrigida para devolver a até três aliados: 1,32× e conversão 3 por 3.</p>

<h3>Como conferir</h3>
<p>Para toda habilidade que restaura, devolve ou converte recurso, some o que sai e o que entra <strong>ignorando o efeito</strong>:</p>
<pre>recurso devolvido × alvos  ≤  recurso gasto</pre>
<p>Vale também para conversão entre recursos diferentes — Harmonia virando Energia é conversão, e a taxa de 1,00 unidade por ponto (§4.1) faz os dois comparáveis.</p>
<p><strong>Recurso recuperável</strong> tem a mesma armadilha por outro caminho: veja o §4.3, e conte a ação gasta no ciclo de recuperação antes de julgar o loop.</p>
`;

const TROCAS = [
    { titulo: /^1 —/, marca: '1.6 Espalhamento por tier', html: ESPALHAMENTO, cap: 'cap. 1' },
    { titulo: /^4 —/, marca: '4.7 Conversão de recurso', html: CONVERSAO, cap: 'cap. 4' },
];

console.log('=== Régua: duas verificações novas ===\n');
const plano = [];
for (const t of TROCAS) {
    const d = docs.find(x => t.titulo.test(x.data().title || ''));
    if (!d) { console.error(`🔴 ${t.cap} não encontrado.`); process.exit(1); }
    const orig = d.data().contentHTML || '';
    if (orig.includes(t.marca)) { console.error(`🔴 ${t.cap}: seção já existe.`); process.exit(1); }
    const html = orig.trimEnd() + '\n' + t.html.trim() + '\n';
    plano.push({ id: d.id, titulo: d.data().title, html, delta: html.length - orig.length });
    console.log(`  ${d.data().title}`);
    console.log(`    + ${t.marca}   (+${html.length - orig.length} chars)\n`);
}
console.log('  A primeira responde "o piso não vê desigualdade dentro do tier".');
console.log('  A segunda responde "a razão não vê recurso que se paga e sobra".');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const p of plano) {
    await col.doc(p.id).update({ contentHTML: p.html, updatedAt: Date.now(),
        words: p.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length });
}
console.log('\n✅ Gravado nos dois capítulos.');
process.exit(0);
