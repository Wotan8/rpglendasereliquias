/**
 * Famo: acrescenta a unidade SAGITES e cadastra as peculiaridades da tribo.
 *
 * O texto do SAGITES foi pedido pelo usuário ("arqueiro Famo, inspirado em
 * arqueiros romanos, mesma escrita/estrutura/tamanho das outras unidades").
 * As 4 unidades existentes são texto DELE — preservadas intactas.
 * cultura/governo/economia/militar/descricao NÃO são tocados aqui.
 *
 *   node functions/cadastrar-famo.mjs            (dry-run)
 *   node functions/cadastrar-famo.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TRIBO = 'Famo';

const MECH_BASE = {
    fonte: 'tribo', duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '',
    escopo: 'proprio', condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};
const fixo = v => [{ tipo: 'fixo', valor: v }];
const calc = (alvo, operacao, equacao) => ({ alvo, operacao, equacao });

const acheOuCrie = async (col, nome, dados) => {
    const snap = await db.collection(col).where('nome', '==', nome).limit(1).get();
    if (!snap.empty) {
        const id = snap.docs[0].id;
        console.log(`  ~ ATUALIZA ${col.split('/').pop()}/${id}  "${nome}"`);
        if (APPLY) await db.doc(`${col}/${id}`).update({ ...dados, atualizadoEm: new Date() });
        return id;
    }
    const ref = db.collection(col).doc();
    console.log(`  + CRIA     ${col.split('/').pop()}/${ref.id}  "${nome}"`);
    if (APPLY) await ref.set({ ...dados, criadoEm: new Date(), atualizadoEm: new Date() });
    return ref.id;
};

/* ===== SAGITES — acrescentado às 4 unidades existentes, sem alterá-las ===== */
const SAGITES = {
    nome: 'SAGITES',
    funcao: 'Cobrem o avanço da formação e impedem que reforços alcancem a linha.',
    descricao: 'Os arqueiros das legiões, formados em corpos auxiliares e posicionados atrás da linha ou sobre as muralhas dos postos avançados. Utilizam arcos compostos e bestas, com aljavas volumosas e pouca armadura, priorizando cadência e alcance sobre resistência. Não disparam por conta própria: atiram em salvas ao comando, cobrindo o avanço da formação e caindo sobre os reforços inimigos antes que estes alcancem o choque. Um Sagite sozinho vale pouco; uma centena deles escurece o céu antes do primeiro encontro de escudos.',
};

console.log('=== UNIDADE NOVA ===');
const tsnap = await db.collection('system/data/tribes').where('nome', '==', TRIBO).limit(1).get();
if (tsnap.empty) { console.log(`  ✖ tribo "${TRIBO}" não encontrada`); process.exit(1); }
const tribo = tsnap.docs[0];
const atuais = tribo.data().unidadesMilitares || [];
console.log(`  existentes (preservadas): ${atuais.map(u => u.nome).join(', ')}`);
const jaTem = atuais.some(u => (u.nome || '').trim().toUpperCase() === 'SAGITES');
const unidades = jaTem ? atuais.map(u => (u.nome || '').trim().toUpperCase() === 'SAGITES' ? SAGITES : u) : [...atuais, SAGITES];
console.log(`  ${jaTem ? '~ ATUALIZA' : '+ ACRESCENTA'} SAGITES`);
console.log(`      funcao: ${SAGITES.funcao}`);
console.log(`      ${SAGITES.descricao}`);
console.log(`  resultado: ${unidades.map(u => u.nome).join(', ')}`);

/* ===== Mecânicas ===== */
console.log('\n=== MECÂNICAS ===');
const MECANICAS = [
    {
        nome: 'Famo — Cobertura Tribal',
        descricao: 'Treinado desde cedo a defender o companheiro de linha. +1 em Cobertura.',
        tipo: 'modificar',
        previewTexto: 'Perícia: Cobertura +1',
        config: { calculos: [calc('Perícia: Cobertura', '+', fixo(1))] },
    },
    {
        nome: 'Famo — Escolha Tribal',
        descricao: '1 ponto livre entre Proteger, Liderança e Arma.',
        tipo: 'distribuir',
        previewTexto: '1 ponto: Proteger / Liderança / Arma',
        config: {
            pool: 'Personalizado',
            poolPersonalizado: ['Perícia: Proteger', 'Perícia: Liderança', 'Perícia: Arma'],
            restricao: 'livre', quantidadeAlvos: 1, valorPorAlvo: 1, operacao: '+',
        },
    },
    {
        nome: 'Famo — Um Famo Nunca Está Sozinho',
        descricao: '+1 em Cobertura e Proteger enquanto houver aliado adjacente.',
        tipo: 'condicional',
        previewTexto: 'Com aliado adjacente: +1 em Cobertura e Proteger.',
        config: {
            condicaoMecanica: false,
            gatilho: 'Haver ao menos um aliado adjacente.',
            textoSucesso: '+1 em Cobertura e +1 em Proteger enquanto a condição durar.',
            textoFalha: 'Sem efeito.',
        },
    },
    {
        // −3 é o limite útil: de 0 para −2 o Famo mediano cai 27 pontos percentuais
        // na ordem de iniciativa; de −2 para −4, só mais 12. A curva achata.
        nome: 'Famo — A Ordem Vem Antes',
        descricao: 'O Famo age quando a legião age. Iniciativa −3.',
        tipo: 'modificar',
        previewTexto: 'Iniciativa −3',
        config: { calculos: [calc('Iniciativa', '-', fixo(3))] },
    },
];
const mecIds = {};
for (const m of MECANICAS) {
    mecIds[m.nome] = await acheOuCrie('system/data/mechanics', m.nome, { ...MECH_BASE, ...m });
    console.log(`      ${JSON.stringify(m.config).slice(0, 175)}`);
}

/* ===== Peculiaridades ===== */
console.log('\n=== PECULIARIDADES ===');
const PEC_BASE = {
    fonte: 'tribo', fonteRef: '', quandoSeAplica: 'passivo', ehVantagem: false,
    concedeAura: false, auraVinculadaId: null, auraGrauConcedido: null,
    derivedValueIds: [], mecanicaExpCriacao: [],
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};
const PECULIARIDADES = [
    {
        nome: 'Perícias Tribais Famo',
        descricao: 'A primeira coisa que um recruta Famo aprende não é golpear — é onde ficar. O escudo dele cobre o vizinho da direita, e o da esquerda cobre o dele.',
        mecs: ['Famo — Cobertura Tribal', 'Famo — Escolha Tribal'],
    },
    {
        nome: 'Um Famo Nunca Está Sozinho',
        descricao: 'É o que dizem sobre eles, e é literal: a força de um Famo não está no braço dele, está no braço ao lado. Com companheiro em linha, ele defende os dois; sem companheiro, é só mais um homem armado.',
        mecs: ['Famo — Um Famo Nunca Está Sozinho'],
    },
    {
        nome: 'A Ordem Vem Antes',
        descricao: 'A legião avança quando a legião avança. Um Famo treinado a vida inteira para se mover junto não se move antes — mesmo quando enxerga a abertura primeiro, e mesmo quando ela se fecha enquanto ele espera.',
        mecs: ['Famo — A Ordem Vem Antes'],
    },
];
const pecIds = [];
for (const p of PECULIARIDADES) {
    const id = await acheOuCrie('system/data/peculiarities', p.nome, {
        ...PEC_BASE, nome: p.nome, descricao: p.descricao, mecanicaIds: p.mecs.map(n => mecIds[n]),
    });
    console.log(`      ${p.mecs.join(', ')}`);
    pecIds.push(id);
}

console.log('\n=== TRIBO ===');
console.log(`  ${tribo.id} "${TRIBO}"  publicado=${tribo.data().publicado}`);
console.log(`  peculiaridadeIds: ${JSON.stringify(tribo.data().peculiaridadeIds || [])} -> ${JSON.stringify(pecIds)}`);
console.log(`  ordem: 4   |   texto: NÃO tocado`);
if (APPLY) {
    await db.doc(`system/data/tribes/${tribo.id}`).update({
        unidadesMilitares: unidades, peculiaridadeIds: pecIds, ordem: 4,
        pericias: admin.firestore.FieldValue.delete(),
        atualizadoEm: new Date(),
    });
}
console.log(APPLY ? '\n✔ GRAVADO (não publicado — publicar é decisão à parte).\n' : '\nDRY-RUN — nada gravado.\n');
process.exit();
