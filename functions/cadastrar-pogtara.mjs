/**
 * Cria os VDs Percepção Tátil e Auditiva, e cadastra a tribo Pogtara.
 * Idempotente: procura por nome antes de criar.
 *
 *   node functions/cadastrar-pogtara.mjs            (dry-run)
 *   node functions/cadastrar-pogtara.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TRIBO = 'Pogtara';

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

/* ===== 1. Os dois sentidos novos =====
   Molde copiado de "Percepção Olfativa": bloco Sentidos, todoPersonagem:false
   (só aparece pra quem recebe), base RAC + Observação − 1.
   O ref da perícia leva o prefixo "Perícia: " — a Olfativa usa "Observação"
   puro, que só funciona porque não existe VD homônimo. Com prefixo é seguro
   mesmo que um dia exista. */
console.log('=== VALORES DERIVADOS NOVOS ===');
const SENTIDOS = [
    { nome: 'Percepção Tátil', icone: '🖐️', ordem: 3, descricao: 'A capacidade de ler o ambiente pelo toque — texturas, vibrações, correntes de ar e o desenho da rocha sob os dedos.' },
    { nome: 'Percepção Auditiva', icone: '👂', ordem: 4, descricao: 'A capacidade de notar, identificar e localizar pelo som — ecos, respiração, passos e o que se move fora do campo de visão.' },
];
const sentidoIds = {};
for (const s of SENTIDOS) {
    const mecId = await acheOuCrie('system/data/mechanics', s.nome, {
        nome: s.nome, descricao: 'Calc base', fonte: 'individual', tipo: 'modificar',
        duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'nao_empilha', evoluivel: false, nivelMaximo: null,
        progressao: null, progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Sentido'], publicado: true,
        config: {
            calculos: [calc(s.nome, '+', [
                { tipo: 'ficha', ref: 'RAC' },
                { tipo: 'ficha', op: '+', ref: 'Perícia: Observação' },
                { tipo: 'fixo', op: '-', valor: 1 },
            ])],
        },
    });
    sentidoIds[s.nome] = await acheOuCrie('system/data/derivedValues', s.nome, {
        nome: s.nome, descricao: s.descricao, icone: s.icone,
        blocoNome: 'Sentidos', blocoId: 'senses', blocoOrdem: 2, ordem: s.ordem,
        campoEditavel: false, campoAtual: false, prefixo: '', sufixo: '',
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        todoPersonagem: false, publicado: true, versao: 1,
        mecanicaIds: [mecId],
    });
    console.log(`      base: RAC + Perícia: Observação − 1   [todoPersonagem: false]`);
}

/* ===== 2. Mecânicas da tribo ===== */
console.log('\n=== MECÂNICAS DA TRIBO ===');
const MECANICAS = [
    {
        nome: 'Pogtara — Furtividade Tribal',
        descricao: 'Criado em túnel, aprende a não fazer barulho antes de aprender a falar. +1 em Furtividade.',
        tipo: 'modificar',
        previewTexto: 'Perícia: Furtividade +1',
        config: { calculos: [calc('Perícia: Furtividade', '+', fixo(1))] },
    },
    {
        nome: 'Pogtara — Escolha Tribal',
        descricao: '1 ponto livre entre Observação, Sobrevivência e Atletismo.',
        tipo: 'distribuir',
        previewTexto: '1 ponto: Observação / Sobrevivência / Atletismo',
        config: {
            pool: 'Personalizado',
            poolPersonalizado: ['Perícia: Observação', 'Perícia: Sobrevivência', 'Perícia: Atletismo'],
            restricao: 'livre', quantidadeAlvos: 1, valorPorAlvo: 1, operacao: '+',
        },
    },
    {
        nome: 'Pogtara — Sentidos do Túnel',
        descricao: '+1 em Percepção Tátil e +1 em Percepção Auditiva.',
        tipo: 'modificar',
        previewTexto: 'Percepção Tátil +1 · Percepção Auditiva +1',
        config: { calculos: [calc('Percepção Tátil', '+', fixo(1)), calc('Percepção Auditiva', '+', fixo(1))] },
    },
    {
        nome: 'Pogtara — Olhos de Ninho',
        descricao: '−1 em Percepção Visual e −1 em Percepção.',
        tipo: 'modificar',
        previewTexto: 'Percepção Visual −1 · Percepção −1',
        config: { calculos: [calc('Percepção Visual', '-', fixo(1)), calc('Percepção', '-', fixo(1))] },
    },
];
const mecIds = {};
for (const m of MECANICAS) {
    mecIds[m.nome] = await acheOuCrie('system/data/mechanics', m.nome, { ...MECH_BASE, ...m });
    console.log(`      ${JSON.stringify(m.config).slice(0, 190)}`);
}

/* ===== 3. Peculiaridades ===== */
// VDs que já existiam (Percepção Visual) precisam ser resolvidos por nome
const dvIdPorNome = Object.fromEntries(
    (await db.collection('system/data/derivedValues').get()).docs.map(d => [d.data().nome, d.id]));
console.log('\n=== PECULIARIDADES ===');
const PEC_BASE = {
    fonte: 'tribo', fonteRef: '', quandoSeAplica: 'passivo', ehVantagem: false,
    concedeAura: false, auraVinculadaId: null, auraGrauConcedido: null,
    derivedValueIds: [], mecanicaExpCriacao: [],
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};
const PECULIARIDADES = [
    {
        nome: 'Perícias Tribais Pogtara',
        descricao: 'No ninho, silêncio não é virtude — é sobrevivência. Aprende-se a pisar, a respirar e a esperar antes de aprender qualquer outra coisa.',
        mecs: ['Pogtara — Furtividade Tribal', 'Pogtara — Escolha Tribal'],
    },
    {
        nome: 'Filhos do Túnel',
        // sem estes vínculos os VDs (todoPersonagem:false) nem aparecem na ficha
        dvs: ['Percepção Tátil', 'Percepção Auditiva'],
        descricao: 'A rocha fala pelas mãos e pelos ecos. Um Pogtara sabe a largura de uma passagem pelo som do próprio fôlego, e reconhece um desmoronamento pela vibração muito antes de ouvi-lo.',
        mecs: ['Pogtara — Sentidos do Túnel'],
    },
    {
        nome: 'Olhos de Ninho',
        dvs: ['Percepção Visual'],
        descricao: 'Gerações debaixo da terra cobram seu preço. A céu aberto, sob luz forte, o mundo é largo demais e claro demais — e o Pogtara enxerga menos do que qualquer um.',
        mecs: ['Pogtara — Olhos de Ninho'],
    },
];
const pecIds = [];
for (const p of PECULIARIDADES) {
    const id = await acheOuCrie('system/data/peculiarities', p.nome, {
        ...PEC_BASE, nome: p.nome, descricao: p.descricao, mecanicaIds: p.mecs.map(n => mecIds[n]),
        derivedValueIds: (p.dvs || []).map(n => ({ id: sentidoIds[n] || dvIdPorNome[n], valorInicial: 0, characterCreationMin: 0, characterCreationMax: 0 })),
    });
    console.log(`      ${p.mecs.join(' + ')}`);
    pecIds.push(id);
}

/* ===== 4. Vincular na tribo ===== */
console.log('\n=== TRIBO ===');
const tsnap = await db.collection('system/data/tribes').where('nome', '==', TRIBO).limit(1).get();
if (tsnap.empty) { console.log(`  ✖ tribo "${TRIBO}" não encontrada — ABORTADO`); process.exit(1); }
const tribo = tsnap.docs[0];
console.log(`  ${tribo.id} "${TRIBO}"`);
console.log(`  peculiaridadeIds: ${JSON.stringify(tribo.data().peculiaridadeIds || [])} -> ${JSON.stringify(pecIds)}`);
console.log(`  pericias: remove o campo morto`);
console.log(`  publicado: ${tribo.data().publicado} -> (inalterado)`);
if (APPLY) {
    await db.doc(`system/data/tribes/${tribo.id}`).update({
        peculiaridadeIds: pecIds,
        pericias: admin.firestore.FieldValue.delete(),
        atualizadoEm: new Date(),
    });
}

console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
