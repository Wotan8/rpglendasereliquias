/**
 * Compêndio de Totemancia — reestrutura em TRONCO + UM CAPÍTULO POR RAMO.
 *
 * Decisão do dono do mundo (25/08/2026): "ramo" é o termo certo na Totemancia
 * (não "vertente"), e são TRÊS — Espiritismo, Voduísmo, Ferinismo. Um Xamã é
 * espiritista ou voduísta (ou os dois, via Totemancia Xamânica Nv 2); o
 * Ferinismo é do Druida.
 *
 * O capítulo 0 hoje carrega dentro dele a lore inteira do Voduísmo e a do
 * Receptáculo (Espiritismo). Este script CORTA por offsets fixos e redistribui.
 * Não reescreve prosa que já estava certa — só a que ficou incoerente.
 *
 * Âncora: o cap. 0 tem que ter 41555 chars. Se mudou, ABORTA (os offsets são
 * posicionais e cortariam no meio de uma frase).
 *
 *   node functions/compendio-tres-ramos.mjs            (dry-run)
 *   node functions/compendio-tres-ramos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const col = db.collection('worldbuilding-articles');
const LIVRO = 'book_ms3gb924a9frg1';
const CAP0 = 'art_ms3gb93y6turqk';
const CAP_VODU = 'K2LSQ7VqQfZEyLyepL1E';

const base = (await col.doc(CAP0).get()).data();
const H = base.contentHTML;
if (H.length !== 41555) { console.error(`ABORTA: cap0 tem ${H.length} chars, esperado 41555. Os offsets sao posicionais.`); process.exit(1); }

// ── corte posicional ───────────────────────────────────────────────────────
const seg = (a, b) => H.slice(a, b);
let A = seg(0, 19514);        // tronco: intro → riscos
let B = seg(19514, 28505);    // lore do Voduísmo
let D = seg(30614, 33076);    // Conseguir um Eco + Regras do ramo do Xamã
let E = seg(33076, 33785);    // Regras do ramo do Voduísmo
let F = seg(33785, 34890);    // ganchos do Xamã
let G = seg(34890, 36425);    // ganchos do voduísta
let Hh = seg(36425, H.length);// A Comunhão do Receptáculo
// C (28505..30614) é reescrito inteiro mais abaixo.

const troca = (s, de, para, obrig = true) => {
    if (!s.includes(de)) { if (obrig) { console.error(`ABORTA: nao achei ${JSON.stringify(de.slice(0, 70))}`); process.exit(1); } return s; }
    return s.split(de).join(para);
};

// ── A · tronco ─────────────────────────────────────────────────────────────
// (1) "dois ramos" → três, e o contraste passa a ser entre RAMOS, não entre a
// classe Xamã e um praticante que também é Xamã.
const i0 = A.indexOf('dois ramos distintos.');
const i1 = A.indexOf('para os que ainda vivem.') + 'para os que ainda vivem.'.length;
if (i0 < 0 || i1 < i0) { console.error('ABORTA: nao achei o paragrafo de introducao dos ramos'); process.exit(1); }
A = A.slice(0, i0) + `três ramos. O <strong>Espiritismo</strong> aprende a perceber os Ecos na Essência Verde, a comunicar-se com eles e a comungar temporariamente com suas essências através de objetos rituais conhecidos como Totens. O <strong>Voduísmo</strong> não busca os mortos — alcança os vivos.</p>
<p>Através de rituais com totens, o voduísta pesca a Essência Azul de criaturas vivas e a vincula a objetos, criando ligações que permitem afetar o alvo à distância: dor, controle, bênção ou maldição. O <strong>Ferinismo</strong> não procura vestígio nenhum — o aliado dele está vivo, anda junto e responde por vontade própria.</p>
<p>Os três compartilham o mesmo fundamento: totens, rituais e a leitura das essências no ambiente. O que muda é para onde olham. O espiritista olha para trás, para os que já foram; o voduísta, para os que ainda estão aqui e não sabem que foram achados. O Druida não precisa procurar — o dele já anda do lado, e o que ele constrói é lealdade.` + A.slice(i1);
// (2) o trabalho na Essência Verde é do espiritista, não da classe inteira
A = troca(A, 'Para o Xamã, a Essência Verde que absorveu', 'Para o espiritista, a Essência Verde que absorveu');
A = troca(A, 'repositório dos Ecos = onde o Xamã trabalha', 'repositório dos Ecos = onde o espiritista trabalha');
A += '</p>';   // o último <p> ficou aberto no corte

// ── C · reescrito: a tabela dos três ramos ────────────────────────────────
const C = `<h2>Quem Usa a Totemancia</h2><div class="tm-tabela-rola"><table>
<thead><tr><th>Classe</th><th>Ramo</th><th>Método</th><th>Foco</th><th>Capítulo</th></tr></thead>
<tbody>
<tr><td>Xamã</td><td><strong>Espiritismo</strong></td><td>Totens + Ecos — cravar totem, buscar vestígios na Essência Verde, projetar-se ou incorporar Ecos da Alma</td><td>Comunhão espiritual, exploração dos Véus, suporte e combate via Ecos</td><td>1</td></tr>
<tr><td>Xamã</td><td><strong>Voduísmo</strong></td><td>Totens + Vínculos — cravar totem, pescar Essência Azul de seres vivos, vincular a objetos; tecer Encantos e Nós</td><td>Controle à distância via bonecas, maldições e bênçãos, manipulação de sorte e emoções</td><td>2</td></tr>
<tr><td>Druida</td><td><strong>Ferinismo</strong></td><td>Vínculo + Lealdade — conseguir o aliado animal, cultivar Lealdade, selar o vínculo e fundir-se com ele</td><td>Aliado animal permanente, Fusão Selvagem nas duas formas, Convocar Manada</td><td>3</td></tr>
</tbody>
</table></div>
<p><strong>Um Xamã é espiritista ou voduísta.</strong> Ramo não é subclasse — é o que ele escolheu praticar dentro da mesma arte. Escolhe um na criação, e pode tomar o segundo depois, pagando por ele. O Ferinismo é do Druida.</p>
<p>O espiritista busca os mortos. Sua mecânica central — a Transcendência do Eco — permite duas formas de comunhão: Projetor (consciência projetada no Eco, corpo em transe) e Receptor (Eco incorporado no Xamã, poderes temporários).</p>
<p>O voduísta busca os vivos. Sua mecânica central é o Vínculo Vivo — a criação de pontes de Essência Azul entre pessoas e objetos para afetá-las à distância — complementada pelos Encantos e Nós que tecem bênçãos, maldições e alterações de sorte.</p>
<p>O Druida não busca ninguém: o aliado dele é uma criatura viva que decidiu andar junto. Onde o Xamã paga o preço toda vez que chama, o Druida paga uma vez só — e o preço é a Lealdade, que leva sessões para subir.</p>
<p>Os três compartilham o mesmo ritual base (cravar totem, conectar com o ambiente), as mesmas Leis (Comunhão, Reciprocidade, Território) e os mesmos riscos fundamentais (Sanidade, Dívida Espiritual).</p>
<h2>Regras Importantes</h2>
<p>Regras gerais da Totemancia (os três ramos):</p><ul><li>Totem deve estar cravado no ambiente para funcionar. Desconectado, é um objeto comum.</li><li>Toda ajuda espiritual tem preço (Lei da Reciprocidade). Promessas devem ser cumpridas. Dívida Espiritual é cumulativa.</li><li>A Totemancia não é Necromancia. Nem o espiritista, que conversa com Ecos; nem o voduísta, que vincula vivos; nem o Druida, que anda com um bicho — nenhum deles reanima cadáver. Mas a sociedade raramente faz a distinção.</li></ul>`;

// ── B · lore do Voduísmo ───────────────────────────────────────────────────
B = B.slice(B.indexOf('<h2>'));
B = troca(B, '<h2>Vertente Do Vínculo Vivo</h2>', '<h2>O Ramo do Vínculo Vivo</h2>');
B = troca(B, 'O Voduísmo é a segunda vertente da Totemancia', 'O Voduísmo é um dos três ramos da Totemancia');
B = troca(B, 'Vínculo Vivo (Voodoo):', 'Vínculo Vivo (o boneco):');
B = troca(B, 'Efeitos de sorte/azar (via Voduísmo):', 'Efeitos de sorte/azar (via nós de bênção e maldição):');
B = troca(B, 'o Voduísmo é tolerado apenas quando usada', 'o Voduísmo é tolerado apenas quando usado');
B = B.replace(/<h2>\s*$/, '');   // o corte levou junto a abertura do <h2> seguinte

// ── D/E/F/G/H · ramos ──────────────────────────────────────────────────────
D = '<h2>' + D;
D = troca(D, '<h2>Regras Do Ramo Do Xamã</h2>', '<h2>Regras do Ramo do Espiritismo</h2>');
D = D.replace(/<h2>\s*$/, '');

E = '<h2>' + E;
E = troca(E, '<h2>Regras Da Vertente Do Voduísmo</h2>', '<h2>Regras do Ramo do Voduísmo</h2>');
E = troca(E, 'O voduísta não vincula mortos — para isso existe o Xamã.', 'O voduísta não vincula mortos — para isso existe o Espiritismo.');
E = troca(E, '<p>voduístas que amaldiçoam', '<p>Voduístas que amaldiçoam');
E = troca(E, '<p>(VODUÍSMO):</p>', '');   // redundante logo abaixo do próprio título
E = E.replace(/<h2>\s*$/, '');

F = '<h2>' + F;
F = troca(F, '<h2>Ganchos Narrativos Xamã</h2>', '<h2>Ganchos Narrativos</h2>');
F = F.replace(/\s*$/, '</li></ul>');   // o último <li> ficou aberto no corte

G = troca(G, 'VODUÍSTA:</li><li>', '');
G = '<h2>Ganchos Narrativos</h2>\n<ul><li>' + G;
G = troca(G, 'O voduísta Justo:', 'O Voduísta Justo:');

G = G.replace(/<h3>A\s*$/, '');  // idem: o <h3>A do Receptáculo pertence ao cap. do Espiritismo
Hh = '<h3>A ' + Hh;

// ── montagem ───────────────────────────────────────────────────────────────
const palavras = s => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const meta = {
    bookId: LIVRO, public: true, status: 'publicado', mentions: [],
    updatedBy: base.updatedBy, updatedAt: Date.now()
};

const cap0 = {
    ...meta, title: 'Totemancia',
    synopsis: 'O tronco da escola: o Eco da Alma, os Véus, as três Leis, os totens, a Madeira de Antiqua, os riscos — e os três ramos que saem daqui.',
    order: 0, contentHTML: A + '\n' + C
};

const cap1 = {
    ...meta, title: 'Espiritismo — o Ramo do Eco',
    synopsis: 'O ramo do Xamã que pesca na Essência Verde: conseguir um Eco como Aliado, as regras do ramo e o que acontece dentro da carne na Comunhão do Receptáculo.',
    order: 1, contentHTML: `<p><em>Ramo da Totemancia — Classe: <strong>Xamã</strong>.</em></p>
<p>O que a morte deixou, o Verde guardou. O espiritista é quem sabe procurar ali — e quem aceita que o achado tem vontade própria. O tronco da escola (os Véus, as Leis, os totens, a Antiqua) está no capítulo <strong>Totemancia</strong>.</p>
` + D + '\n' + Hh + '\n' + F     // ganchos por último
};

const cap2 = {
    ...meta, title: 'Voduísmo — o Ramo do Vínculo Vivo',
    synopsis: 'O ramo do Xamã que pesca na Essência Azul: o Selo de Vida, os fragmentos e sua validade, os Encantos e Nós, o estigma — e a mecânica do Elo com a escada de cinco rituais.',
    order: 2, contentHTML: `<p><em>Ramo da Totemancia — Classe: <strong>Xamã</strong>.</em></p>
` + B + '\n' + E + `
<h2>Voduísmo não é classe nem subclasse</h2>
<p>É um dos três ramos da Totemancia, e um dos dois que o Xamã pratica, ao lado do Espiritismo. O Xamã escolhe um na criação; o segundo exige <strong>Totemancia Xamânica nível 2</strong>. Quem pratica é <strong>voduísta</strong>.</p>
<h2>Os dois ramos do Xamã</h2><div class="tm-tabela-rola"><table>
<thead><tr><th>Ramo</th><th>Essência</th><th>Alcança</th></tr></thead>
<tbody>
<tr><td><strong>Espiritismo</strong></td><td>Verde</td><td>o Eco que a morte deixou, e que o Verde guardou</td></tr>
<tr><td><strong>Voduísmo</strong></td><td>Azul</td><td>o vivo, pelo fio de Azul que ainda não foi consumido</td></tr>
</tbody>
</table></div>
<p>São o mesmo ofício olhando lados opostos do mesmo processo: <strong>o Verde come o Azul.</strong> O espiritista trabalha com o que o Verde já consumiu. O voduísta corre contra o Verde para pescar o Azul antes que apague — e é por isso que fragmento velho não serve.</p>
<h2>O nível do ramo é o teto do Custo</h2>
<p>A Peculiaridade <strong>Voduísmo</strong> vai de 1 a 5, e o nível é o maior Custo que o Xamã pode conjurar nela. Voduísmo 3 usa até Custo 3.</p>
<div class="tm-tabela-rola"><table>
<thead><tr><th>Custo</th><th>Ritual</th><th>O que faz</th></tr></thead>
<tbody>
<tr><td>1</td><td><strong>AGULHA</strong></td><td>5 de dano e Abalado no nível do Elo, por 1 cena</td></tr>
<tr><td>2</td><td><strong>AMARRAÇÃO</strong></td><td>Imobilizado por 3 rodadas e Exposto 3 enquanto durar</td></tr>
<tr><td>3</td><td><strong>BOCA COSIDA</strong></td><td>o alvo não conjura, não canta e não fala por 1 cena</td></tr>
<tr><td>4</td><td><strong>O PESO</strong></td><td>Cego e Amedrontado por 1 cena</td></tr>
<tr><td>5</td><td><strong>ESPELHO DE CARNE</strong></td><td>o dano que o portador do boneco recebe vai para o alvo, até 20 pontos</td></tr>
</tbody>
</table></div>
<h2>Os dois orçamentos</h2>
<p>Conseguir o fragmento e usar o boneco são coisas de economias diferentes, e é isso que mantém o ramo honesto.</p>
<p><strong>Conseguir</strong> acontece fora do combate: furtar, negociar, arrancar, colher do campo de batalha. Custa tempo, requisito e risco — nunca uma ação de turno.</p>
<p><strong>Usar</strong> acontece no combate, custa Energia e Ação Padrão como qualquer ritual, e o alvo resiste normalmente.</p>
<p>O poder do vodu nunca esteve no boneco. Está em já ter o fio de cabelo.</p>
<h2>O Elo</h2>
<p>A qualidade do fragmento é o <strong>Elo</strong>, e o Elo é o nível de toda condição que o ramo aplica. Um fio de cabelo dá Abalado 1; um dente arrancado dá Abalado 3. A tabela de partes do corpo, mais acima neste capítulo, diz quanto tempo cada uma leva para perder a Essência Azul — e o princípio dela vale aqui inteiro: <strong>quanto mais importante a parte era para o corpo, mais devagar ela apaga.</strong></p>
<p>Sangue é a armadilha: carrega muita Azul e a perde em <em>minutos a horas</em>, porque não é estrutural. Osso carrega menos e dura semanas.</p>
<p><strong>A janela vale só até o ritual pegar.</strong> Depois disso o elo passa a ser alimentado pelo Xamã, e não depende mais do Azul original.</p>
<h2>Os limites</h2>
<p><strong>Elos ativos ≤ nível de Voduísmo.</strong> Um voduísta de nível 2 mantém dois bonecos. Para amarrar um terceiro, desfaz um.</p>
<p><strong>Alcance:</strong> a tabela deste capítulo manda. Com Totem de Antiqua não há limite de distância — mas <strong>o elo nunca atravessa planos</strong>. Alvo que entra numa camada inferior sai do alcance de qualquer boneco.</p>
<p><strong>O vodu não mata.</strong> O dano do ramo para em 1 de Vitalidade. Ele controla, humilha, imobiliza e cega — não executa. Quem quiser matar à distância que use uma besta.</p>
<p><strong>Alvo vivo.</strong> Um cadáver fresco ainda serve como fragmento — a Azul não apagou. Mas o ritual aplica e controla os <em>vivos</em>, e um morto não tem o que ser controlado. Campo de batalha rende fragmento, não vítima.</p>
<p><strong>O boneco é um objeto no mundo.</strong> Pode ser entregue, roubado, queimado ou molhado, e as seis formas de romper um vínculo descritas acima valem todas. Quem descobre que é alvo de vodu não tem um teste de resistência: tem uma missão.</p>
<h2>O que exige interpretação</h2>
<p>Nenhum ritual de Voduísmo é declarado em silêncio. O praticante costura, espeta, amarra, enche de terra — e diz alguma coisa ao alvo. A mesa vê o gesto e ouve a palavra, mesmo que o alvo esteja a um quilômetro.</p>
` + G     // ganchos por último
};

const cap3 = {
    ...meta, title: 'Ferinismo — o Ramo do Aliado Vivo',
    synopsis: 'O ramo do Druida: nenhum vestígio, nenhum morto — um bicho vivo, a Lealdade que se constrói ao longo de sessões, o vínculo selado e a Fusão Selvagem nas duas formas.',
    order: 3, contentHTML: `<p><em>Ramo da Totemancia — Classe: <strong>Druida</strong>.</em></p>
<p>Os outros dois ramos trabalham com o que sobrou de alguém. O Ferinismo, não. O aliado do Druida está vivo, come, dorme, tem medo e pode ir embora. Não há vestígio para achar nem Eco para negociar — há um bicho, e há o tempo que se leva para ele confiar.</p>
<p>É por isso que o preço do Ferinismo é diferente. O Xamã paga toda vez que chama: ritual, Energia, consentimento. O Druida paga uma vez, e paga antes — em sessões de convivência. Depois que o vínculo está selado, ele não pede licença de novo.</p>
<h2>A cadeia, em quatro etapas</h2>
<p>Cada etapa é a porta da seguinte. Pular uma não é opção.</p>
<div class="tm-tabela-rola"><table>
<thead><tr><th>#</th><th>Etapa</th><th>Teste</th><th>Quando</th></tr></thead>
<tbody>
<tr><td>1</td><td>Conseguir o aliado</td><td><strong>AUT + Domar</strong>, contra o Redutor da criatura</td><td>Fora de combate</td></tr>
<tr><td>2</td><td>Cultivar Lealdade</td><td>Nenhum — sobe por narrativa</td><td>Ao longo das sessões</td></tr>
<tr><td>3</td><td><strong>Vínculo Animal</strong></td><td><strong>PRE + Domar + Fluxomancia</strong></td><td>Fora de combate</td></tr>
<tr><td>4</td><td><strong>Fusão Selvagem</strong></td><td><strong>PRE + Fluxomancia + Linguagem Animal</strong></td><td>Ação Completa</td></tr>
</tbody>
</table></div>
<p>A etapa 1 não é do Druida: <strong>conseguir um aliado é teste universal</strong>, e qualquer classe consegue tentar — do mesmo jeito que qualquer um capaz de perceber Ecos pode tentar atrair um. O que é do Druida começa na etapa 3.</p>
<h2>Lealdade</h2>
<p>Lealdade é um número de 0 a 10, e é <strong>do vínculo, não do bicho</strong>: a mesma criatura pode ser leal a um personagem e indiferente a outro. Sobe por narrativa — comida dividida, ferimento tratado, perigo enfrentado junto — e sobe devagar, no máximo <strong>1 ponto por sessão</strong>, porque o que ela destranca é mecânico.</p>
<p>O limiar para selar o vínculo é <strong>máx(6, 10 − Linguagem Animal)</strong>. Um Druida de Linguagem Animal 1 precisa de Lealdade 9; de Linguagem Animal 4 em diante, precisa de 6 e não abaixa mais. O piso existe de propósito: a perícia trava o Druida iniciante, não premia o veterano com um bicho de graça.</p>
<p><strong>Aliado não é vínculo, e vínculo não é obediência.</strong> Um aliado sem vínculo anda junto e ajuda quando quer. Só o vínculo selado dispensa o consentimento a cada uso — e só ele abre a Fusão Selvagem.</p>
<h2>Quantos</h2>
<p>O Druida tem até <strong>Domar + Aliado Animal</strong> aliados ao mesmo tempo, e vincula até <strong>Aliado Animal</strong> deles. Os outros continuam sendo aliados: andam junto, mas não servem para a Fusão.</p>
<h2>Fusão Selvagem</h2>
<p>Custa <strong>Ação Completa</strong> e exige vínculo selado com aquele aliado. Tem duas formas, e nas duas alguém fica indefeso.</p>
<p><strong>Receptor</strong> — o Druida abre espaço na própria carne e o aliado entra. O corpo do bicho fica inerte. O Druida ganha o que o animal tem de melhor, e só o que for melhor que o dele: faro, visão, deslocamento, ataque natural.</p>
<p><strong>Projetor</strong> — o Druida sai de si e vai para o aliado. O corpo <em>dele</em> fica inerte, e ele passa a jogar pelo bicho, na iniciativa do bicho, que já está na cena. Pode consultar a ficha do animal; não pode editá-la.</p>
<p>O risco é o mesmo dos dois lados: <strong>quem está em transe fica imóvel, não age e não reage</strong>, e a vulnerabilidade é total até a fusão ser desfeita. Proteger o corpo parado é problema do grupo.</p>
<h2>Convocar Manada</h2>
<p><strong>PRE + Liderança + Fluxomancia</strong>, Ação Padrão. Chama os animais pequenos que já estão por perto para intervir na cena. Não exige vínculo nem aliado — exige que haja bicho no lugar. A fórmula usa Liderança de propósito: se usasse Linguagem Animal seria a Fusão Selvagem com outro nome.</p>
<h2>Regras do Ramo do Ferinismo</h2>
<ul><li>Sem vínculo selado não há Fusão Selvagem. Aliado solto ajuda, mas não funde.</li><li>Lealdade é do vínculo e sobe no máximo 1 por sessão. Não se compra com EXP.</li><li>Nas duas formas da Fusão, alguém fica em transe — imóvel, sem agir e sem reagir.</li><li>O aliado é uma criatura viva. Morre, foge, envelhece e pode recusar o que o Druida jamais pediria a um Eco.</li><li>Conseguir a criatura é teste de qualquer classe. Vincular é do Druida.</li></ul>`
};

// ── gravação ───────────────────────────────────────────────────────────────
const plano = [
    ['ATUALIZA', CAP0, cap0], ['CRIA', null, cap1],
    ['ATUALIZA', CAP_VODU, cap2], ['CRIA', null, cap3],
];
console.log(APPLY ? 'APLICANDO\n' : 'DRY-RUN\n');
for (const [op, id, doc] of plano) {
    doc.words = palavras(doc.contentHTML);
    console.log(`${op.padEnd(9)} order=${doc.order}  ${String(id || '(novo)').padEnd(22)} "${doc.title}"  ${doc.words}w`);
}
const total = plano.reduce((s, [, , d]) => s + d.words, 0);
console.log(`\ntotal ${total} palavras (antes: ${base.words} + 701 = ${base.words + 701})`);
for (const t of ['ramos?', 'vertente']) {
    const n = plano.reduce((s, [, , d]) => s + (d.contentHTML.match(new RegExp(t, 'gi')) || []).length, 0);
    console.log(`  /${t}/i: ${n}`);
}
if (process.argv.includes('--preview')) {
    const fs = await import('node:fs');
    for (const [, , d] of plano) fs.writeFileSync(`C:/Users/Soberano/AppData/Local/Temp/claude/prev_${d.order}.html`, d.contentHTML, 'utf8');
    console.log('preview gravado em prev_0..3.html');
}
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
for (const [op, id, doc] of plano) {
    if (op === 'ATUALIZA') { await col.doc(id).update(doc); console.log(`OK update ${id}`); }
    else { doc.createdAt = Date.now(); const r = await col.add(doc); console.log(`OK create ${r.id}`); }
}
process.exit(0);
