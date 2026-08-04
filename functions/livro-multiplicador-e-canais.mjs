/**
 * Caps. 5 e 6 — o multiplicador da proteção e a defesa arcana.
 *
 * Cap. 5:
 *  1. ×1,35 → ×1,20 (texto e tabela de proteção por Grau).
 *  2. "de 5 a 8 golpes" → "de 4 a 5 golpes".
 *  3. §5.6 — a resistência arcana não é por canal: todas as Essências enfrentam
 *     a mesma Blindagem Arcana.
 *
 * Cap. 6 §6.5:
 *  4. Reescreve "Dano de mais de um canal" com a ordem correta (parcela física
 *     contra a Blindagem, parcelas de Essência contra a Blindagem Arcana).
 *  5. Exemplo da espada necrótica citava "Blindagem Púrpura", que não existe mais.
 *  6. Remove o quadro "Blindagem negativa é fraqueza" — fraqueza virou metade.
 *  7. O exemplo da Armadura Completa usava Blindagem fracionária (3,30 → 5,70),
 *     contra a regra de arredondar da 5.4. Volta a 3 → 6.
 *
 *   node functions/livro-multiplicador-e-canais.mjs            (dry-run)
 *   node functions/livro-multiplicador-e-canais.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const CAP5 = [
    { nome: '5.6 · ×1,35 → ×1,20',
      de: '<strong>multiplica por 1,35</strong>',
      para: '<strong>multiplica por 1,20</strong>' },

    { nome: '5.6 · tabela de proteção recalculada',
      de: `<tr><td>2</td><td>0,27</td><td>0,30</td><td>0,41</td><td>5,33</td><td><strong>5</strong></td></tr>
<tr><td>3</td><td>0,36</td><td>0,40</td><td>0,55</td><td>7,15</td><td><strong>7</strong></td></tr>
<tr><td>4</td><td>0,49</td><td>0,54</td><td>0,74</td><td>9,62</td><td><strong>9</strong></td></tr>
<tr><td>5</td><td>0,66</td><td>0,73</td><td>1,00</td><td>13,00</td><td><strong>13</strong></td></tr>`,
      para: `<tr><td>2</td><td>0,24</td><td>0,26</td><td>0,36</td><td>4,68</td><td><strong>4</strong></td></tr>
<tr><td>3</td><td>0,29</td><td>0,32</td><td>0,43</td><td>5,59</td><td><strong>5</strong></td></tr>
<tr><td>4</td><td>0,35</td><td>0,38</td><td>0,52</td><td>6,76</td><td><strong>6</strong></td></tr>
<tr><td>5</td><td>0,41</td><td>0,46</td><td>0,62</td><td>8,06</td><td><strong>8</strong></td></tr>` },

    { nome: '5.6 · duração do combate: 5–8 → 4–5 golpes',
      de: 'um combate entre arma e armadura do mesmo Grau continua durando de 5 a 8 golpes, do começo ao fim da campanha.',
      para: 'um combate entre arma e armadura do mesmo Grau continua durando de 4 a 5 golpes, do começo ao fim da campanha.' },

    { nome: '5.6 · a resistência arcana não é por canal',
      de: 'Cada natureza dessas é um <strong>canal</strong> separado, e cada canal enfrenta a resistência do alvo <em>naquele</em> canal. Como se resolve isso na mesa está no Capítulo 6, seção 6.5.',
      para: 'Cada natureza dessas é um <strong>canal</strong> separado <em>no ataque</em> — mas do outro lado só existe um número. Todos os canais arcanos enfrentam a mesma <strong>Blindagem Arcana</strong>. A diferença entre uma Essência e outra só aparece quando a peça cede a ela: aí, contra aquela Essência, a Blindagem Arcana conta metade (seção 5.4). Como se resolve isso na mesa está no Capítulo 6, seção 6.5.' }
];

const CAP6 = [
    { nome: '6.5 · ordem de resolução das parcelas',
      de: `<p><strong>Dano de mais de um canal.</strong> Uma arma pode carregar canais além do
físico — uma lâmina necrótica soma uma parcela Púrpura, uma flecha encantada soma
uma parcela Vermelha. Cada canal subtrai <strong>a Blindagem do alvo naquele
canal</strong>, não a Blindagem física. Resolva nesta ordem:</p>
<ol>
<li><strong>Cada canal separado</strong> — subtraia do canal a Blindagem do alvo naquele canal. Se der negativo, o canal vale <strong>0</strong> (nunca menos).</li>
<li><strong>Some os canais</strong> — o total é o dano do golpe.</li>
<li><strong>Piso de 1</strong> — se a soma der zero, marque 1. O mínimo é do golpe inteiro, <strong>nunca de cada canal</strong>.</li>
</ol>`,
      para: `<p><strong>Dano de mais de um canal.</strong> Uma arma pode carregar Essência além do aço — uma lâmina necrótica soma uma parcela Púrpura, uma flecha encantada soma uma parcela Vermelha. O alvo tem dois números para se defender: a <strong>Blindagem</strong>, que barra o aço, e a <strong>Blindagem Arcana</strong>, que barra Essência — qualquer uma delas. Resolva nesta ordem:</p>
<ol>
<li><strong>A parcela física</strong> subtrai a Blindagem. Se a arma for do tipo a que a armadura cede, a Blindagem conta metade (Capítulo 5, seção 5.4);</li>
<li><strong>Cada parcela de Essência</strong> subtrai a Blindagem Arcana — a mesma para todas. Se a peça ceder àquela Essência, conta metade;</li>
<li><strong>Parcela que ficar negativa vale 0</strong>, nunca menos;</li>
<li><strong>Some tudo e aplique o piso de 1.</strong> O mínimo é do golpe inteiro, <strong>nunca de cada parcela</strong>.</li>
</ol>
<p>Repare no passo 2: cada Essência enfrenta a Blindagem Arcana <em>inteira</em>. Repartir o dano arcano em três Essências pequenas faz cada pedaço ser comido separadamente, e nenhum passa. Concentrar tudo na Essência a que o alvo cede é o que fura. Descobrir a fraqueza e apostar nela é a jogada.</p>` },

    { nome: '6.5 · exemplo da espada necrótica sem Blindagem Púrpura',
      de: `<blockquote><p><strong>Exemplo:</strong> espada necrótica, 1d8 + FOR 3, com 1 de dano
Púrpura. Rola 6 → 9 físico e 1 Púrpura. O alvo tem Blindagem 3,30 e Blindagem
Púrpura 0. Físico: 9 − 3,30 = 5,70. Púrpura: 1 − 0 = 1. Dano final = 6,70.</p></blockquote>
<blockquote><p><strong>Blindagem negativa é fraqueza.</strong> Se o alvo tem Blindagem
Verde −2, uma parcela Verde de 1 passa a valer 1 − (−2) = 3.</p></blockquote>`,
      para: `<blockquote><p><strong>Exemplo:</strong> espada necrótica, 1d8 + FOR 3, com 2 de dano Púrpura. Rola 6 → 9 de aço e 2 de Púrpura. O alvo tem Blindagem 3 e Blindagem Arcana 2, e o arnês dele cede à Púrpura — então contra ela a Arcana conta 1. Aço: 9 − 3 = 6. Púrpura: 2 − 1 = 1. Dano final = <strong>7</strong>.</p></blockquote>` },

    { nome: '6.5 · exemplo da Armadura Completa volta a arredondar',
      de: '<blockquote><p><strong>Exemplo:</strong> espada longa (1d8) com FOR 3. Rola 6 → dano 9. O defensor veste uma Armadura Completa (Blindagem 3,30). Dano final = 5,70 pontos de Vitalidade.</p></blockquote>',
      para: '<blockquote><p><strong>Exemplo:</strong> espada longa (1d8) com FOR 3. Rola 6 → dano 9. O defensor veste uma Armadura Completa: os 3,30 dela arredondam para Blindagem 3. Dano final = 6 pontos de Vitalidade.</p></blockquote>' }
];

async function aplicar(docId, edicoes, rotulo) {
    const ref = db.collection('worldbuilding-articles').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`🔴 ${docId} não existe.`); return false; }
    let html = snap.data().contentHTML || '';
    const antes = html.length;
    let erro = false;
    console.log(`\n=== ${rotulo} ===`);
    for (const e of edicoes) {
        const n = html.split(e.de).length - 1;
        const ok = n === 1;
        console.log(`${ok ? '  ok ' : '  🔴 '} ${e.nome}  (ocorrências: ${n})`);
        if (!ok) { erro = true; continue; }
        html = html.replace(e.de, e.para);
    }
    if (erro) return false;
    console.log(`  ${antes} → ${html.length} chars`);
    if (APLICAR) { await ref.update({ contentHTML: html, updatedAt: Date.now() }); console.log('  ✅ gravado'); }
    return true;
}

const ok5 = await aplicar('art-regras-jogador-05', CAP5, 'Capítulo 5');
const ok6 = await aplicar('art-regras-jogador-06', CAP6, 'Capítulo 6');
if (!ok5 || !ok6) { console.error('\n🔴 ABORTADO — alguma troca não bateu.'); process.exit(1); }
if (!APLICAR) console.log('\n(dry-run — nada gravado. Use --apply.)');
process.exit(0);
