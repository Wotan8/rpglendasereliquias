/**
 * Cadastra as mecânicas + peculiaridades da tribo Uqatá e vincula na tribo.
 * Idempotente: procura por nome antes de criar; atualiza se já existir.
 *
 *   node functions/cadastrar-uqata.mjs            (dry-run)
 *   node functions/cadastrar-uqata.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TRIBO = 'Uqatá';

/* Campos que toda mecânica carrega neste sistema (copiados dos registros reais). */
const MECH_BASE = {
    fonte: 'tribo', duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '',
    escopo: 'proprio', condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};

const fixo = v => [{ tipo: 'fixo', valor: v }];
const ficha = ref => [{ tipo: 'ficha', ref }];
const DEFESAS = ['Perícia: Bloquear', 'Perícia: Proteger', 'Perícia: Cobertura'];

const MECANICAS = [
    {
        nome: 'Uqatá — Ímpeto Tribal',
        descricao: 'Todo Uqatá é criado sabendo avançar. +1 em Ímpeto.',
        tipo: 'modificar',
        previewTexto: 'Perícia: Ímpeto +1',
        config: { calculos: [{ alvo: 'Perícia: Ímpeto', operacao: '+', equacao: fixo(1) }] },
    },
    {
        nome: 'Uqatá — Fúria que Fere',
        descricao: 'Entre os Uqatá o ímpeto vira ferimento: soma o nível de Ímpeto ao Dano.',
        tipo: 'modificar',
        previewTexto: 'Dano + Perícia: Ímpeto',
        config: { calculos: [{ alvo: 'Dano', operacao: '+', equacao: ficha('Perícia: Ímpeto') }] },
    },
    {
        nome: 'Uqatá — Ritual da Farpa',
        descricao: '+1 na primeira rolagem de ataque de um combate iniciado pelos Uqatá.',
        tipo: 'condicional',
        previewTexto: 'Combate iniciado pelos Uqatá: +1 na 1ª rolagem de ataque.',
        config: {
            condicaoMecanica: false,
            gatilho: 'Combate iniciado pelos Uqatá (julgamento do mestre).',
            textoSucesso: '+1 na primeira rolagem de ataque do combate.',
            textoFalha: 'Sem efeito.',
        },
    },
    {
        nome: 'Uqatá — Recusa de Proteção',
        descricao: 'Não pode equipar armadura Média ou Pesada, nem escudo de qualquer tipo.',
        tipo: 'conceder',
        previewTexto: 'Não pode equipar: Média, Pesada, Escudo.',
        config: {
            tipoConcessao: 'bloquear_equipar',
            descricaoConcessao: 'Armadura Média, Pesada e escudos — a tribo não permite.',
            equipReqs: [
                { targetTipo: 'tag', tag: 'Média' },
                { targetTipo: 'tag', tag: 'Pesada' },
                { targetTipo: 'tag', tag: 'Escudo' },
            ],
        },
    },
    {
        nome: 'Uqatá — Teto de Guarda',
        // Teto, não subtração. Um cálculo por alvo: o motor SOBRESCREVE
        // mechanicLimits[alvo], então dois cálculos no mesmo alvo se anulariam.
        descricao: 'Bloquear, Proteger e Cobertura nunca passam de 3 para um Uqatá.',
        tipo: 'limitar',
        previewTexto: 'Bloquear / Proteger / Cobertura: máximo 3',
        config: { calculos: DEFESAS.map(alvo => ({ alvo, tipoLimite: 'maximo', equacao: fixo(3) })) },
    },
];

const PEC_BASE = {
    fonte: 'tribo', fonteRef: '', quandoSeAplica: 'passivo', ehVantagem: false,
    concedeAura: false, auraVinculadaId: null, auraGrauConcedido: null,
    derivedValueIds: [], mecanicaExpCriacao: [],
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};

const PECULIARIDADES = [
    {
        nome: 'Perícias Tribais Uqatá',
        descricao: 'Desde que se firma nas pernas, um Uqatá aprende que o corpo inteiro é a arma. Não se ensina a bater — ensina-se a não parar.',
        mecs: ['Uqatá — Ímpeto Tribal'],
    },
    {
        nome: 'Fúria que Fere',
        descricao: 'Em outras tribos o ímpeto vira manobra: uma investida, um avanço, uma linha rompida. Entre os Uqatá ele vira ferimento. A diferença não está na técnica, está no que se pretende com ela.',
        mecs: ['Uqatá — Fúria que Fere'],
    },
    {
        nome: 'Ritual da Farpa',
        descricao: 'Antes da guerra, homens e mulheres giram suas armas em uma dança frenética para invocar o espírito da fúria. Quem sai desse círculo já está em combate — só falta o inimigo descobrir.',
        mecs: ['Uqatá — Ritual da Farpa'],
    },
    {
        nome: 'O Escudo é o Túmulo dos Fracos',
        descricao: 'Cicatriz de avanço se exibe. Cicatriz de defesa se esconde. Um Uqatá coberto de placa é um Uqatá que já admitiu que pode perder. Não veste armadura Média ou Pesada, e não empunha escudo.',
        mecs: ['Uqatá — Recusa de Proteção'],
    },
    {
        nome: 'Cicatriz nas Costas',
        descricao: 'Ninguém ensina um Uqatá a erguer guarda. Aprende-se a atacar antes, e quem não aprendeu rápido o bastante não está mais aqui para reclamar.',
        mecs: ['Uqatá — Teto de Guarda'],
    },
];

/* ---------- execução ---------- */

const acheOuCrie = async (col, nome, dados) => {
    const snap = await db.collection(col).where('nome', '==', nome).limit(1).get();
    if (!snap.empty) {
        const id = snap.docs[0].id;
        console.log(`  ~ ATUALIZA ${col}/${id}  "${nome}"`);
        if (APPLY) await db.doc(`${col}/${id}`).update({ ...dados, atualizadoEm: new Date() });
        return id;
    }
    const ref = db.collection(col).doc();
    console.log(`  + CRIA     ${col}/${ref.id}  "${nome}"`);
    if (APPLY) await ref.set({ ...dados, criadoEm: new Date(), atualizadoEm: new Date() });
    return ref.id;
};

console.log(`\n=== MECÂNICAS (${MECANICAS.length}) ===`);
const mecIds = {};
for (const m of MECANICAS) {
    mecIds[m.nome] = await acheOuCrie('system/data/mechanics', m.nome, { ...MECH_BASE, ...m });
    console.log(`      config: ${JSON.stringify(m.config)}`);
}

console.log(`\n=== PECULIARIDADES (${PECULIARIDADES.length}) ===`);
const pecIds = [];
for (const p of PECULIARIDADES) {
    const mecanicaIds = p.mecs.map(n => mecIds[n]);
    const id = await acheOuCrie('system/data/peculiarities', p.nome, {
        ...PEC_BASE, nome: p.nome, descricao: p.descricao, mecanicaIds,
    });
    console.log(`      mecânicas: ${p.mecs.join(' + ')}`);
    pecIds.push(id);
}

console.log(`\n=== VINCULAR NA TRIBO ===`);
const tsnap = await db.collection('system/data/tribes').where('nome', '==', TRIBO).limit(1).get();
if (tsnap.empty) { console.log(`  ✖ tribo "${TRIBO}" não encontrada — ABORTADO`); process.exit(1); }
const tribo = tsnap.docs[0];
console.log(`  tribo ${tribo.id} "${TRIBO}"`);
console.log(`  peculiaridadeIds: ${JSON.stringify(tribo.data().peculiaridadeIds || [])}  ->  ${JSON.stringify(pecIds)}`);
console.log(`  pericias: remove o campo morto (o motor nunca lê tribo.pericias)`);
console.log(`  publicado: ${tribo.data().publicado}  ->  (inalterado — publicar é decisão à parte)`);
if (APPLY) {
    await db.doc(`system/data/tribes/${tribo.id}`).update({
        peculiaridadeIds: pecIds,
        pericias: admin.firestore.FieldValue.delete(),
        atualizadoEm: new Date(),
    });
}

console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
