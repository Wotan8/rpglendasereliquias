/**
 * Ambidestria: penalidade zera no Nv3, Nv4 é pedágio, Nv5 destrava contra-ataque
 * com as duas armas + a manobra Dança das Lâminas.
 *
 * Mexe em: livro do jogador (cap. 6.8 e 6.10), doc da perícia e o texto das duas
 * manobras já cadastradas (que ainda dizem "−1 no Alvo").
 * Aborta se algum texto de origem não bater — não grava pela metade.
 *
 * node functions/ambidestria-escada.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const agora = admin.firestore.Timestamp.now();
const SKILL_ID = 'DiTOT813BBSsZOmO3deC';
const ART = 'worldbuilding-articles/art-regras-jogador-06';

// --- 1) livro, capítulo 6 ---------------------------------------------------
const TROCAS = [
    // 6.10 — a penalidade
    [`<li><strong>Penalidade:</strong> <strong>−3 no Alvo</strong> de ambos os ataques, reduzida em 1 por nível de <strong>Ambidestria</strong>, até o mínimo de <strong>−1</strong>. Ela nunca chega a zero.</li>`,
     `<li><strong>Penalidade:</strong> <strong>−3 no Alvo</strong> de ambos os ataques, reduzida em 1 por nível de <strong>Ambidestria</strong>: −2 no nível 1, −1 no nível 2 e <strong>nenhuma a partir do nível 3</strong>.</li>`],

    // 6.10 — o capstone, logo depois de "Você escolhe a ordem dos golpes."
    [`<li>Você escolhe a ordem dos golpes.</li>`,
     `<li>Você escolhe a ordem dos golpes.</li>\n<li><strong>Ambidestria 5:</strong> no contra-ataque (6.8) você rola o dado <strong>das duas</strong> armas, e destrava a manobra <strong>Dança das Lâminas</strong> — três golpes num turno, por 1 Energia.</li>`],

    // 6.8 — a exceção do contra-ataque
    [`<li><strong>Com duas armas:</strong> você rola o dado de <strong>uma</strong> arma, e gasta a defesa como qualquer outro.</li>`,
     `<li><strong>Com duas armas:</strong> você rola o dado de <strong>uma</strong> arma, e gasta a defesa como qualquer outro. Com <strong>Ambidestria 5</strong>, rola as duas.</li>`],
];

const artSnap = await db.doc(ART).get();
let html = artSnap.data().contentHTML;

for (const [de, para] of TROCAS) {
    const n = html.split(de).length - 1;
    if (n !== 1) throw new Error(`Trecho do livro achado ${n}x (esperado 1): ${de.slice(0, 70)}…`);
    html = html.replace(de, para);
}
await db.doc(ART).update({ contentHTML: html, updatedAt: agora });
console.log('Livro cap. 6: 3 trechos reescritos.');

// --- 2) descrição da perícia ------------------------------------------------
await db.doc('system/data/skills/' + SKILL_ID).update({
    descricao:
        'Coordenação para lutar com duas armas ao mesmo tempo.\n' +
        'Usar para: ataques com duas armas, ações simultâneas com ambas as mãos.\n' +
        'Sem treino: −3 no Alvo dos dois golpes. Nv1: −2. Nv2: −1. Nv3: sem penalidade. ' +
        'Nv5: o contra-ataque rola o dado das duas armas e destrava a manobra Dança das Lâminas ' +
        '(três golpes num turno, por 1 Energia).',
    atualizadoEm: agora,
});
console.log('Perícia Ambidestria: descrição atualizada.');

// --- 3) texto das manobras já cadastradas -----------------------------------
const EFEITOS = {
    manobras_guerreiro: {
        texto: 'Empunhando duas armas, você desfere três golpes em vez de dois, todos sem penalidade ' +
            '(Ambidestria 5 já zerou a dos ataques duplos). Consome o turno inteiro: você não se ' +
            'desloca nesta rodada. Uma vez por turno.',
        razao: 2.75,
    },
    manobras_ladino: {
        texto: 'Empunhando duas armas, você desfere três golpes em vez de dois, todos sem penalidade ' +
            '(Ambidestria 5 já zerou a dos ataques duplos). O par de golpes cabe na Ação Padrão: sua ' +
            'Ação de Movimento fica livre e você ainda se desloca. Uma vez por turno.',
        razao: 3.0,
    },
};

for (const [mod, { texto, razao }] of Object.entries(EFEITOS)) {
    const ref = db.doc('system/data/classModules/' + mod);
    const itens = (await ref.get()).data().itensPredefinidos;
    const item = itens.find(i => i.nome === 'Dança das Lâminas');
    if (!item) throw new Error('Dança das Lâminas não achada em ' + mod);
    item.descricao = texto;
    item.valores['5'] = texto;
    item.regua = { razao, unidades: razao, custo: 1, em: '2026-08-11' };
    await ref.update({ itensPredefinidos: itens, atualizadoEm: agora });
    console.log(mod + ': efeito e régua atualizados.');
}

process.exit(0);
