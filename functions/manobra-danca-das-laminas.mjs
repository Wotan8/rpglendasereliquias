/**
 * Manobra "Dança das Lâminas" — o 3º ataque de quem luta com duas armas.
 * Requer Ambidestria 5. Guerreiro queima o turno; Ladino ainda se desloca.
 *
 * Cria 1 mecânica booleana REQ e adiciona 1 item predefinido em cada módulo
 * de manobras (guerreiro e ladino). Idempotente: pula o que já existe.
 *
 * node functions/manobra-danca-das-laminas.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const NOME = 'Dança das Lâminas';
const CUSTO_ENER = 'gT5DZcIaG69aYuEjdXwQ'; // mecânica "-1 ENER"
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const agora = admin.firestore.Timestamp.now();

// --- 1) mecânica REQ: Perícia: Ambidestria >= 5 -----------------------------
const mechs = await db.collection('system/data/mechanics').get();
let reqId = mechs.docs.find(d => d.data().nome === NOME + ' REQ')?.id;

if (reqId) {
    console.log('REQ já existe:', reqId);
} else {
    const ref = await db.collection('system/data/mechanics').add({
        nome: NOME + ' REQ',
        descricao: NOME + ' REQ',
        tipo: 'booleano',
        fonte: 'classe',
        escopo: 'proprio',
        duracao: 'permanente',
        duracaoEspecial: '',
        duracaoTurnos: null,
        empilhamento: 'soma',
        evoluivel: false,
        nivelMaximo: null,
        progressao: null,
        progressaoApenasCriacao: false,
        progressaoTipoExp: 'custo',
        condicaoAplicacao: '',
        tags: ['Classe', 'Guerreiro', 'Ladino'],
        config: {
            equacaoA: [{ ref: 'Perícia: Ambidestria', tipo: 'ficha' }],
            operadorComparacao: '>=',
            equacaoB: [{ tipo: 'fixo', valor: 5 }],
            valorVerdadeiro: '',
            valorFalso: 'Requer Ambidestria 5',
        },
        previewTexto: '[Perícia: Ambidestria] ≥ 5 ? ✅ : ❌Requer Ambidestria 5',
        publicado: true,
        versao: 1,
        criadoPor: AUTOR,
        criadoEm: agora,
        atualizadoEm: agora,
    });
    reqId = ref.id;
    console.log('REQ criada:', reqId);
}

// --- 2) item predefinido em cada módulo -------------------------------------
const EFEITO_GUERREIRO =
    'Empunhando duas armas, você desfere três golpes em vez de dois. Todos usam a ' +
    'penalidade atual de Ambidestria (−1 no Alvo). Consome o turno inteiro: você não ' +
    'se desloca nesta rodada. Uma vez por turno.';

const EFEITO_LADINO =
    'Empunhando duas armas, você desfere três golpes em vez de dois. Todos usam a ' +
    'penalidade atual de Ambidestria (−1 no Alvo). O par de golpes cabe na Ação Padrão: ' +
    'sua Ação de Movimento fica livre e você ainda se desloca. Uma vez por turno.';

const VARIANTES = [
    { mod: 'manobras_guerreiro', acao: 'Ação Completa (turno inteiro)', efeito: EFEITO_GUERREIRO, razao: 2.2 },
    { mod: 'manobras_ladino', acao: 'Ação Padrão', efeito: EFEITO_LADINO, razao: 2.5 },
];

for (const v of VARIANTES) {
    const ref = db.doc('system/data/classModules/' + v.mod);
    const snap = await ref.get();
    const itens = snap.data().itensPredefinidos || [];

    if (itens.some(i => i.nome === NOME)) {
        console.log(v.mod + ': "' + NOME + '" já cadastrada, pulando.');
        continue;
    }

    itens.push({
        id: 'pdi_' + Date.now() + '_amb' + (v.mod === 'manobras_ladino' ? 'l' : 'g'),
        nome: NOME,
        descricao: v.efeito,
        custoExpProprio: 1,
        custoCriacaoMecanicaIds: [reqId],
        custoEquipamentos: null,
        valores: {
            1: NOME,
            2: '',
            3: '1 Energia',
            4: CUSTO_ENER,
            5: v.efeito,
            acao: v.acao,
        },
        alcance: null,
        formaArea: 'nenhuma',
        tamanhoArea: null,
        alvosMax: 1,
        duracaoValor: null,
        duracaoUnidade: null,
        condicoesAplicadas: [],
        requer: 'Ambidestria 5',
        regua: { razao: v.razao, unidades: v.razao, custo: 1, em: '2026-08-11' },
    });

    await ref.update({ itensPredefinidos: itens, atualizadoEm: agora });
    console.log(v.mod + ': "' + NOME + '" adicionada (' + itens.length + ' itens no módulo).');
}

process.exit(0);
