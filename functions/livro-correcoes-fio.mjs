/**
 * Três correções pedidas no Livro de Regras do Jogador:
 *
 *  1. Cap. 2 — "Grupo Poder" → "Grupo de Potência" (colidia com Poder = EXP Total).
 *  2. Cap. 5 §5.2 — Liga é a QUALIDADE; o poder do item é o Fio.
 *  3. Cap. 5 §5.4 — arredondar a Blindagem para baixo, mas com PISO 1 quando o
 *     total for maior que 0. Isso muda o bullet "peça avulsa vale 0 sozinha",
 *     que deixa de ser verdade.
 *
 *   node functions/livro-correcoes-fio.mjs            (dry-run)
 *   node functions/livro-correcoes-fio.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const EDICOES = [
    { art: 'art-regras-jogador-02', nome: 'Cap.2 — Grupo Poder → Grupo de Potência',
      de: '<thead><tr><th>Grupo</th><th>Poder</th><th>Refinamento</th><th>Resistência</th></tr></thead>',
      para: '<thead><tr><th>Grupo</th><th>Potência</th><th>Refinamento</th><th>Resistência</th></tr></thead>' },

    { art: 'art-regras-jogador-05', nome: 'Cap.5 §5.2 — Liga é qualidade, Fio é poder',
      de: 'A qualidade de um item hoje é a sua <strong>Liga</strong> — que define o poder natural do equipamento e seu teto de melhorias (ver seção 5.5), mas não exige treino específico para usar.',
      para: 'A <strong>Liga</strong> de um item é a qualidade do material e o seu teto de melhorias (ver seção 5.5); nenhuma delas exige treino específico para usar. O <em>poder</em> do equipamento é outra coisa, e tem nome próprio: o <strong>Fio</strong> (ver seção 5.6).' },

    { art: 'art-regras-jogador-05', nome: 'Cap.5 §5.4 — arredondamento com piso 1',
      de: 'Valores quebrados são normais — existem para que peças pequenas tenham peso próprio, e o jogador nunca subtrai fração de dano: <strong>some a Blindagem de tudo que está vestido e arredonde o total para baixo</strong>. Só o total importa na mesa.',
      para: 'Valores quebrados são normais — existem para que peças pequenas tenham peso próprio, e o jogador nunca subtrai fração de dano: <strong>some a Blindagem de tudo que está vestido e arredonde o total para baixo — mas se o total for maior que zero, ele vale no mínimo 1</strong>. Só o total importa na mesa. Quem veste alguma coisa nunca fica com Blindagem 0.' },

    { art: 'art-regras-jogador-05', nome: 'Cap.5 §5.4 — bullet da peça avulsa',
      de: '<li><strong>Peça avulsa pequena vale 0 sozinha.</strong> Um Elmo de Placas dá 0,30 — que arredonda para zero. Ela existe para ser <em>somada</em>, não para ser usada só: o primeiro elmo que você compra não muda nenhuma rolagem, e isso é esperado, não um defeito;</li>',
      para: '<li><strong>A primeira peça vale mais do que parece.</strong> Um Elmo de Placas dá 0,30 — como o total ficou acima de zero, ele vale Blindagem 1 na mesa. Da segunda peça em diante você está comprando fração: só quando a soma cruzar o 2 é que o número muda de novo. Peça avulsa existe para ser <em>somada</em>;</li>' }
];

let erro = false;
const porArtigo = {};
for (const e of EDICOES) (porArtigo[e.art] ||= []).push(e);

for (const [art, lista] of Object.entries(porArtigo)) {
    const ref = db.collection('worldbuilding-articles').doc(art);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`❌ ${art} não existe.`); erro = true; continue; }
    let html = snap.data().contentHTML || '';

    for (const e of lista) {
        const n = html.split(e.de).length - 1;
        console.log(`\n[${art}] ${e.nome}  →  ocorrências: ${n}`);
        if (n !== 1) { console.error(`  ❌ esperava 1, achou ${n}. Nada será gravado neste artigo.`); erro = true; continue; }
        console.log(`  - ${e.de.replace(/<[^>]+>/g, '').slice(0, 150)}`);
        console.log(`  + ${e.para.replace(/<[^>]+>/g, '').slice(0, 150)}`);
        html = html.replace(e.de, e.para);
    }
    porArtigo[art] = { lista, html, ref, antes: snap.data().contentHTML.length };
}

if (erro) { console.error('\n❌ ABORTADO — nenhuma alteração gravada.'); process.exit(1); }
if (!APPLY) { console.log('\n\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

for (const [art, o] of Object.entries(porArtigo)) {
    await o.ref.update({ contentHTML: o.html, updatedAt: Date.now() });
    console.log(`✅ ${art}: ${o.antes} → ${o.html.length} chars`);
}
process.exit(0);
