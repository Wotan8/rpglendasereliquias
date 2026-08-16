/**
 * Substitui a "Dança das Lâminas" (errada: consumia o turno inteiro) pelas duas
 * manobras de verdade, uma por classe, ambas exigindo Ambidestria 5:
 *
 *   Guerreiro — Golpe Cruzado:     1 Ação Padrão = os dois golpes. Movimento livre.
 *   Ladino    — Corte de Passagem: 1 Ação de Movimento = desloca-se E golpeia.
 *
 * node functions/manobras-duas-armas-nv5.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const agora = admin.firestore.Timestamp.now();
const REQ_ID = 'DDqEQQMitcZygUEdfKuV'; // booleana: Perícia: Ambidestria >= 5
const CUSTO_ENER = 'gT5DZcIaG69aYuEjdXwQ'; // -1 ENER
const ANTIGA = 'Dança das Lâminas';

// --- 1) o REQ deixa de ser de uma manobra só e vira o gate do nível ---------
await db.doc('system/data/mechanics/' + REQ_ID).update({
    nome: 'Ambidestria 5 REQ',
    descricao: 'Ambidestria 5 REQ',
    atualizadoEm: agora,
});
console.log('REQ renomeada para "Ambidestria 5 REQ" (compartilhada pelas duas manobras).');

// --- 2) uma manobra por classe ---------------------------------------------
const MANOBRAS = {
    manobras_guerreiro: {
        nome: 'Golpe Cruzado',
        acao: 'Ação Padrão',
        razao: 1.2,
        efeito: 'Empunhando duas armas, os dois golpes cabem em uma única Ação Padrão, sem penalidade. ' +
            'Sua Ação de Movimento fica livre: você ataca com as duas e ainda se desloca na mesma rodada.',
    },
    manobras_ladino: {
        nome: 'Corte de Passagem',
        acao: 'Ação de Movimento',
        razao: 1.3,
        efeito: 'Empunhando duas armas, sua Ação de Movimento rende um golpe além do deslocamento: ' +
            'você corta com a arma secundária em qualquer ponto do trajeto, sem penalidade, e segue ' +
            'andando. A Ação Padrão continua sua para atacar de novo.',
    },
};

for (const [mod, m] of Object.entries(MANOBRAS)) {
    const ref = db.doc('system/data/classModules/' + mod);
    const itens = (await ref.get()).data().itensPredefinidos;

    const i = itens.findIndex(x => x.nome === ANTIGA);
    if (i === -1) throw new Error(ANTIGA + ' não achada em ' + mod + ' — nada foi trocado.');
    if (itens.some(x => x.nome === m.nome)) throw new Error(m.nome + ' já existe em ' + mod);

    itens[i] = {
        ...itens[i],
        nome: m.nome,
        descricao: m.efeito,
        custoCriacaoMecanicaIds: [REQ_ID],
        valores: {
            1: m.nome,
            2: '',
            3: '1 Energia',
            4: CUSTO_ENER,
            5: m.efeito,
            acao: m.acao,
        },
        requer: 'Ambidestria 5',
        regua: { razao: m.razao, unidades: m.razao, custo: 1, em: '2026-08-11' },
    };

    await ref.update({ itensPredefinidos: itens, atualizadoEm: agora });
    console.log(mod + ': "' + ANTIGA + '" -> "' + m.nome + '" (' + m.acao + ').');
}

// --- 3) livro e perícia deixam de citar a manobra antiga --------------------
const ART = 'worldbuilding-articles/art-regras-jogador-06';
const DE = `destrava a manobra <strong>Dança das Lâminas</strong> — três golpes num turno, por 1 Energia.`;
const PARA = `destrava a manobra de duas armas da sua classe: <strong>Golpe Cruzado</strong> (Guerreiro) ou <strong>Corte de Passagem</strong> (Ladino).`;

const html = (await db.doc(ART).get()).data().contentHTML;
if (html.split(DE).length - 1 !== 1) throw new Error('Trecho do livro não bateu — livro intacto.');
await db.doc(ART).update({ contentHTML: html.replace(DE, PARA), updatedAt: agora });
console.log('Livro cap. 6.10: bullet do Ambidestria 5 atualizado.');

await db.doc('system/data/skills/DiTOT813BBSsZOmO3deC').update({
    descricao:
        'Coordenação para lutar com duas armas ao mesmo tempo.\n' +
        'Usar para: ataques com duas armas, ações simultâneas com ambas as mãos.\n' +
        'Sem treino: −3 no Alvo dos dois golpes. Nv1: −2. Nv2: −1. Nv3: sem penalidade. ' +
        'Nv5: o contra-ataque rola o dado das duas armas e destrava a manobra de duas armas da sua ' +
        'classe (Golpe Cruzado, do Guerreiro; Corte de Passagem, do Ladino).',
    atualizadoEm: agora,
});
console.log('Perícia Ambidestria: descrição atualizada.');

process.exit(0);
