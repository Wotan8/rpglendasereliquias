/**
 * Cap. Ferinismo — o Receptor da Fusão Selvagem usa a Dádiva, não a sobra.
 *
 * Escrevi o capítulo copiando a descrição do predef `ally_animal`, que ainda
 * diz "ganha o que o animal tem de melhor, e só o que for melhor que o dele".
 * Essa é a regra ANTIGA da sobra. shared/incorporacao.js e shared/dadiva.js são
 * um motor só para as duas classes, e a regra em vigor é sortear e SOMAR até o
 * teto. O capítulo estava contradizendo o código que roda no Tabuleiro.
 *
 * ⚠️ A descrição do predef em system/data/classModules/ally_animal continua
 * errada — não é escopo deste script.
 *
 *   node functions/cap-ferinismo-dadiva.mjs            (dry-run)
 *   node functions/cap-ferinismo-dadiva.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const ref = db.collection('worldbuilding-articles').doc('MD1Z9RdcBQo3wKL15KVD');

const doc = (await ref.get()).data();
const VELHO = '<p><strong>Receptor</strong> — o Druida abre espaço na própria carne e o aliado entra. O corpo do bicho fica inerte. O Druida ganha o que o animal tem de melhor, e só o que for melhor que o dele: faro, visão, deslocamento, ataque natural.</p>';
const NOVO = '<p><strong>Receptor</strong> — o Druida abre espaço na própria carne e o aliado entra. O corpo do bicho fica inerte. O que o animal entrega é a <strong>Dádiva</strong>, a mesma do Espiritismo e com a mesma regra: sorteia-se o que sai, e o que sai se soma ao que o Druida já tinha, até o teto. Faro, visão, couro, deslocamento, ataque natural — o bicho não escolhe o que dá. As nove Dádivas estão no capítulo <strong>Espiritismo</strong>.</p>';
const EXTRA = '<p>O custo em Sanidade acompanha o tamanho da entrega: um lobo empresta pouco e sai barato, um urso ancião empresta muito e cobra por isso. Não existe preço fixo — quem tira mais, paga mais.</p>';

if (!doc.contentHTML.includes(VELHO)) { console.error('ABORTA: o paragrafo do Receptor nao esta no estado esperado'); process.exit(1); }
const novoHTML = doc.contentHTML.replace(VELHO, NOVO + '\n' + EXTRA);
const palavras = s => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(APPLY ? 'APLICANDO' : 'DRY-RUN');
console.log(`capitulo: ${doc.words} → ${palavras(novoHTML)} palavras`);
if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
await ref.update({ contentHTML: novoHTML, words: palavras(novoHTML), updatedAt: Date.now() });
console.log('OK gravado');
process.exit(0);
