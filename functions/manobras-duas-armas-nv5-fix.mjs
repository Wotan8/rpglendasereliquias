/**
 * Corrige o efeito das duas manobras de Ambidestria 5 e deixa explícito no livro
 * que, na regra base, a Ação de Movimento É o golpe da mão secundária.
 *
 *   base       — Padrão: 1 golpe | Movimento: 1 golpe | não anda
 *   Guerreiro  — Padrão vira 2 golpes  -> 2 golpes e anda, ou 3 parado
 *   Ladino     — Movimento vira golpe+deslocamento ou 2 golpes -> idem
 *
 * node functions/manobras-duas-armas-nv5-fix.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const agora = admin.firestore.Timestamp.now();

// --- 1) efeito das manobras -------------------------------------------------
const MANOBRAS = {
    manobras_guerreiro: {
        nome: 'Golpe Cruzado',
        efeito: 'Sua Ação Padrão rende dois golpes em vez de um, sem penalidade. A Ação de Movimento ' +
            'continua como na regra base: outro golpe, ou o deslocamento. No turno, você escolhe — ' +
            'dois golpes e ainda anda, ou três golpes parado.',
    },
    manobras_ladino: {
        nome: 'Corte de Passagem',
        efeito: 'Sua Ação de Movimento deixa de ser um golpe parado: você corta em qualquer ponto do ' +
            'trajeto e segue andando, ou desfere dois golpes no lugar do deslocamento. Somando a Ação ' +
            'Padrão, você escolhe — dois golpes e ainda anda, ou três golpes parado.',
    },
};

for (const [mod, m] of Object.entries(MANOBRAS)) {
    const ref = db.doc('system/data/classModules/' + mod);
    const itens = (await ref.get()).data().itensPredefinidos;
    const item = itens.find(x => x.nome === m.nome);
    if (!item) throw new Error(m.nome + ' não achada em ' + mod);

    item.descricao = m.efeito;
    item.valores['5'] = m.efeito;
    // o modo "3 golpes parado" é o teto: +1 golpe conectado x meio ~= 2,75 de
    // Vitalidade por Energia, dentro da faixa 2-4 do combate v3.
    item.regua = { razao: 2.75, unidades: 2.75, custo: 1, em: '2026-08-11' };

    await ref.update({ itensPredefinidos: itens, atualizadoEm: agora });
    console.log(mod + ': "' + m.nome + '" — efeito e régua corrigidos.');
}

// --- 2) livro: a Ação de Movimento é o segundo golpe ------------------------
const ART = 'worldbuilding-articles/art-regras-jogador-06';
const DE = `<li><strong>Ação:</strong> Ação Padrão + Ação de Movimento — <strong>o turno inteiro</strong>. Você não se desloca nesta rodada.</li>`;
const PARA = `<li><strong>Ação:</strong> o turno inteiro. A <strong>Ação Padrão</strong> rende um golpe e a <strong>Ação de Movimento</strong> rende o outro — é ela que paga a mão secundária, e por isso você <strong>não se desloca</strong> nesta rodada.</li>`;

const html = (await db.doc(ART).get()).data().contentHTML;
if (html.split(DE).length - 1 !== 1) throw new Error('Trecho do livro não bateu — livro intacto.');
await db.doc(ART).update({ contentHTML: html.replace(DE, PARA), updatedAt: agora });
console.log('Livro cap. 6.10: bullet de Ação reescrito por slot.');

process.exit(0);
