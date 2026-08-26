/**
 * Cap. Espiritismo — atualiza "O que o Eco empresta" para as NOVE Dádivas.
 *
 * A prosa foi escrita quando as Dádivas eram cinco + uma perícia à parte. A
 * reforma de 18/08, uniformizada em 24/08, deixou nove e mudou a regra: NADA se
 * escolhe (tudo sorteia) e o sorteado é SOMADO ao do personagem, maior ou menor,
 * até o teto. O capítulo ainda descrevia o modelo antigo.
 *
 * Fonte de verdade: shared/dadiva.js (DADIVAS, tetoDoAtributo, §11.3 da Energia).
 * Se aquele arquivo mudar, este capítulo muda junto — não é decoração.
 *
 * Substitui só o bloco entre <h4>O que o Eco empresta</h4> e o <h4> seguinte.
 * Aborta se o bloco não estiver no estado esperado.
 *
 *   node functions/cap-espiritismo-dadivas.mjs            (dry-run)
 *   node functions/cap-espiritismo-dadivas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('pH0cqjh74rGy5qJZc3H5');

const doc = (await ref.get()).data();
const H = doc.contentHTML;
const ini = H.indexOf('<h4>O que o Eco empresta</h4>');
const fim = H.indexOf('<h4>A voz, e o que ela esconde</h4>');
if (ini < 0 || fim < ini) { console.error('ABORTA: nao achei o bloco das Dadivas'); process.exit(1); }
const velho = H.slice(ini, fim);
if (!velho.includes('e são cinco')) { console.error('ABORTA: o bloco ja nao diz "e sao cinco" — alguem mexeu'); process.exit(1); }

const NOVO = `<h4>O que o Eco empresta</h4>
<p>Um Eco não concede poder. Concede o que ele foi. Aquilo que a vida dele treinou até virar segunda natureza é a única coisa que sobrevive à dissolução — e é a única coisa que ele tem para dar.</p>
<p>Chama-se <strong>Dádiva</strong>, e são nove:</p>
<ul>
<li><strong>Braço</strong> — de quem lutou, caçou, matou. O corpo lembra o que a mão alheia sabia.</li>
<li><strong>Mente</strong> — de erudito, de artífice, de quem passou a vida decifrando. O pensamento vem com método emprestado.</li>
<li><strong>Boca</strong> — de orador, de líder, de sacerdote. As palavras saem com autoridade emprestada.</li>
<li><strong>Pele</strong> — de quem aguentou, ou da fera de couro grosso. O corpo endurece por dentro: às vezes contra a lâmina, às vezes contra o que não é lâmina.</li>
<li><strong>Olho</strong> — de batedor, de vigia, de ave. Enxerga-se longe, e enxerga-se o que estava escondido.</li>
<li><strong>Passo</strong> — de quem corria, ou da fera veloz. O chão fica mais curto.</li>
<li><strong>Perícia</strong> — os ofícios que a vida dele martelou até virarem reflexo.</li>
<li><strong>Habilidade</strong> — o que ele sabia fazer, e que ninguém mais ali sabe.</li>
<li><strong>Energia</strong> — o fôlego de quem entra.</li>
</ul>
<p><strong>Nenhuma delas se escolhe.</strong> O Eco entrega o que calhou. Braço, Mente e Boca abrem o grupo de atributos que lhes cabe e sai um; a Pele decide sozinha se endurece a carne, o couro ou o que barra magia; o Olho tira um sentido, o Passo um jeito de andar. Só a Perícia vem larga — uma de cada tipo de ofício que o Eco tenha. Um especialista dá pouca coisa e boa. Um Eco vivido dá um pedaço de cada vida que levou.</p>
<p><strong>O que vem se soma ao que já havia</strong>, seja mais, seja menos. Não há troca e não há sobra: um Eco fraco continua valendo alguma coisa, e um Eco forte não substitui o Xamã — empurra ele. Quem segura é o teto, que é <strong>cinco</strong>. Só uma Aura levanta esse número, e o limite do corpo de quem recebe manda acima de qualquer Aura. O que passa disso se perde no caminho.</p>
<p>A Energia é a exceção, e a razão é a mesma de sempre: <strong>o Eco devolve fôlego, nunca mais do que a comunhão custou para abrir</strong>. Quem tentar se financiar com hóspede fecha a conta em zero.</p>
<p>Ecos que transcenderam ao Astral entregam o dobro — e cobram na mesma proporção. O dobro também para no teto.</p>
<p><strong>Na prática:</strong> o que o Eco foi em vida decide o que ele serve. Um Xamã que só encontra camponeses mortos de febre não vai sair dali com braço de espadachim. E nada disso dura: acaba quando a incorporação acaba.</p>

`;

const novoHTML = H.slice(0, ini) + NOVO + H.slice(fim);
const palavras = s => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO' : 'DRY-RUN');
console.log(`bloco: ${palavras(velho)} → ${palavras(NOVO)} palavras`);
console.log(`capitulo: ${doc.words} → ${palavras(novoHTML)} palavras`);
for (const t of ['p', 'ul', 'li', 'strong', 'h4']) {
    const o = (NOVO.match(new RegExp(`<${t}[ >]`, 'g')) || []).length, c = (NOVO.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) { console.error(`ABORTA: <${t}> ${o}/${c}`); process.exit(1); }
}
console.log('tags ok · 9 Dádivas: ' + (NOVO.match(/<li><strong>/g) || []).length + ' itens na lista');
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: novoHTML, words: palavras(novoHTML), updatedAt: Date.now() });
console.log('OK gravado');
process.exit(0);
