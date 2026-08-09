/**
 * Compêndio de Fluxomancia — capítulo Totemancia (público).
 * Acrescenta a seção "A Comunhão do Receptáculo".
 *
 * Voz extraída do próprio capítulo: frases curtas em série seguidas de uma
 * longa com travessão; epígrafe com atribuição no padrão que já existe lá
 * ("— Sabedoria Xamânica Ancestral"); "Na prática:" como marcador de regra.
 *
 * NADA INVENTADO. Dádivas, Personalidade, Supressão e os Estados vêm das
 * decisões fechadas com o dono do mundo e do que o capítulo já dizia. A
 * atribuição da epígrafe reusa uma forma que já está no texto — nenhum nome
 * próprio novo entra no cânone.
 *
 *   node functions/totemancia-comunhao-receptaculo.mjs            (dry-run)
 *   node functions/totemancia-comunhao-receptaculo.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const SECAO = `
<h3>A Comunhão do Receptáculo</h3>
<p><em>"A porta você abre. Quem entra, entra por vontade própria — e vai embora pela dele."</em> — Sabedoria Xamânica Ancestral</p>
<p>Cravado o totem e achado o vestígio, o Xamã faz o que nenhum necromante faria: pede licença dentro da própria carne. A Transcendência na forma Receptor não puxa o Eco. Ela abre espaço. O que entra, entra porque quis, e sai quando a cena acabar.</p>
<p>Quem já viu de perto conta sempre as mesmas coisas. O gosto de uma refeição que o Xamã nunca comeu. A mão que sabe um ofício que ele nunca aprendeu, e sabe bem demais. Um cheiro de lugar onde ele nunca esteve, insistente, atravessando o cheiro do lugar onde ele está.</p>

<h4>O que o Eco empresta</h4>
<p>Um Eco não concede poder. Concede o que ele foi. Aquilo que a vida dele treinou até virar segunda natureza é a única coisa que sobrevive à dissolução — e é a única coisa que ele tem para dar.</p>
<p>Chama-se <strong>Dádiva</strong>, e são cinco:</p>
<ul>
<li><strong>Braço</strong> — de quem lutou, caçou, matou. O golpe do Xamã ganha o peso de mão alheia.</li>
<li><strong>Pele</strong> — de quem aguentou, ou da fera de couro grosso. O corpo endurece por dentro.</li>
<li><strong>Olho</strong> — de batedor, de vigia, de ave. Enxerga-se longe, e enxerga-se o que estava escondido.</li>
<li><strong>Passo</strong> — de quem corria, ou da fera veloz. O chão fica mais curto.</li>
<li><strong>Boca</strong> — de orador, de líder, de sacerdote. As palavras saem com autoridade emprestada.</li>
</ul>
<p>Além da Dádiva, o Eco empresta <strong>uma perícia sua</strong>. É aí que a comunhão se paga: o ferreiro morto empresta a forja, o general empresta a leitura de um campo de batalha, a velha que curou meia aldeia empresta as mãos. Ecos que transcenderam ao Astral emprestam o dobro — e cobram na mesma proporção.</p>
<p><strong>Na prática:</strong> o que o Eco foi em vida decide o que ele serve. Um Xamã que só encontra camponeses mortos de febre não vai sair dali com braço de espadachim.</p>

<h4>A voz, e o que ela esconde</h4>
<p>Todo Eco fala de um jeito. Uns respondem devagar e sem rancor. Outros perguntam mais do que respondem. Há os que voltam sempre ao que perderam, os que mandam sem ter sobre quem, e os que não usam palavra nenhuma — respondem em imagens, e o Xamã acorda sabendo de coisas que não sabe explicar.</p>
<p>Essa voz não é enfeite. Um Eco orgulhoso empresta a autoridade que teve e leva junto a paciência que nunca teve; o Xamã se pega curto com quem devia agradar. Um Eco faminto empresta a teimosia de quem sobreviveu ao inverno e deixa a mente mais fácil de dobrar. <strong>O que se ganha de um lado, perde-se do outro, e o Eco não avisa qual dos dois vem primeiro.</strong></p>
<p>Alguns escondem o que sentem. Recebem o chamado com doçura, agradecem a oferenda, aceitam a comunhão — e o rancor só aparece de dentro, quando já não há como devolver. Ler a intenção verdadeira de um Eco antes de abrir a carne é trabalho de Empatia ou de Comunhão, e ele resiste como resistiria a qualquer outra pergunta que não queira responder.</p>
<p>É por isso que os xamãs velhos preferem o Eco sereno ao Eco forte. O rancoroso empresta mais. Sempre.</p>

<h4>A Supressão</h4>
<p>Hóspede é hóspede enquanto quer ser. O Eco que decide ficar começa devagar, e raramente onde o Xamã está olhando.</p>
<p>Primeiro o <strong>Sussurro</strong>: uma frase que sai da boca do Xamã sem ter passado pela cabeça dele. Uma resposta grosseira a quem não merecia. Um nome dito em voz alta no meio de uma sala silenciosa. Nada que não se possa explicar como cansaço.</p>
<p>Depois a <strong>Rédea</strong>: uma vez por cena, o corpo faz sozinho. A mão saca a faca antes de o Xamã decidir sacar, ou não saca quando ele decide. O gesto é dele. A vontade não era.</p>
<p>E então o <strong>Domínio</strong>, que não tem sinal nenhum porque não sobra ninguém para dar o sinal. O Eco anda, come, fala e responde pelo nome do Xamã. Quem convive não nota de imediato — nota que ele mudou, e explica de outro jeito.</p>
<p>De dentro do Domínio ainda se volta. Ao fim de cada cena o Xamã empurra, e às vezes o corpo obedece. <strong>Mas há um ponto em que ele deixa de empurrar, e nesse ponto o Xamã já não é ninguém — é a lembrança que o Eco tem de um homem que abriu a porta.</strong></p>
<p>O caminho de volta existe e é conhecido: exorcismo feito por outro xamã, ou pelo próprio, se ainda houver quem faça a mão obedecer. Honrar o preço que ficou por pagar. Uma noite inteira de descanso com oferenda posta e nome dito direito. Nenhum deles é rápido, e todos exigem que alguém perceba a tempo.</p>
<p><strong>Na prática:</strong> a Lei da Reciprocidade não é conselho moral. É a única coisa entre o Xamã e o hóspede que gostou da casa.</p>
`;

/* ═══ ASSERTS ═══ */
assert.ok(/Sabedoria Xamânica Ancestral/.test(SECAO), 'atribuição reusa a forma canônica, sem nome novo');
assert.equal((SECAO.match(/<li><strong>(Braço|Pele|Olho|Passo|Boca)<\/strong>/g) || []).length, 5, 'as cinco Dádivas');
for (const t of ['Sussurro', 'Rédea', 'Domínio']) assert.ok(SECAO.includes(t), `falta o degrau ${t}`);
/* Voz de mesa: sem número, sem taxa, sem nome de campo. Isso é do livro técnico. */
assert.ok(!/\d\s*(un|×|rodada|Alvo|Blindagem)/i.test(SECAO), 'a seção pública não carrega número de régua');
assert.ok(!/\[FALTA/.test(SECAO), 'nenhuma lacuna aberta');
console.log('✅ 5 asserts.\n');

const arts = (await db.collection('worldbuilding-articles').get()).docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
const cap = arts.find(a => /^Totemancia/i.test(a.title || ''));
const erros = [];
if (!cap) erros.push('capítulo Totemancia não achado');
if (cap && /A Comunhão do Receptáculo/.test(cap.contentHTML || '')) erros.push('a seção já existe');
if (cap && cap.public !== true) erros.push('o capítulo de Totemancia não está público — confira antes');

const novoHTML = (cap?.contentHTML || '') + SECAO;
const palavras = novoHTML.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

console.log('=== Totemancia · A Comunhão do Receptáculo ===\n');
console.log(SECAO.replace(/<\/(p|li|h\d)>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n{2,}/g, '\n')
    .split('\n').filter(Boolean).map(l => '  ' + l.trim()).join('\n').slice(0, 1500));
console.log(`\n  capítulo: ${cap?.words || 0} → ${palavras} palavras`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await cap.ref.update({ contentHTML: novoHTML, words: palavras, updatedAt: Date.now() });
console.log('\n✅ Gravado no capítulo público.');
process.exit(0);
