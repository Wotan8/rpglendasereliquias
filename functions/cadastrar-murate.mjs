/**
 * Cadastra a tribo Muraté: texto, peculiaridades e mecânicas.
 * Idempotente: procura por nome antes de criar.
 *
 *   node functions/cadastrar-murate.mjs            (dry-run)
 *   node functions/cadastrar-murate.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TRIBO = 'Muraté';

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

/* ===== Texto e unidades militares =====
 * NÃO PREENCHER AQUI. A lore da tribo é do usuário e não se inventa.
 * cultura/governo/economia/militar e unidadesMilitares só entram neste script
 * com texto que o usuário escreveu ou aprovou explicitamente. */
const TEXTO = {};
const UNIDADES = null;

/* ===== Mecânicas ===== */
console.log('=== MECÂNICAS ===');
const MECANICAS = [
    {
        nome: 'Muraté — Bloquear Tribal',
        descricao: 'O primeiro escudo vem antes da primeira arma. +1 em Bloquear.',
        tipo: 'modificar',
        previewTexto: 'Perícia: Bloquear +1',
        config: { calculos: [calc('Perícia: Bloquear', '+', fixo(1))] },
    },
    {
        // Bloquear é a única perícia defensiva sobre proteger A SI MESMO com escudo
        // (Cobertura e Proteger são sobre aliados). ÷3 porque Blindagem subtrai de
        // todo golpe: sem dividir, +3 de Bl dobraria o melhor arnês do jogo.
        nome: 'Muraté — Muralha Viva',
        descricao: 'Quem domina o escudo o mantém posicionado mesmo sem bloquear. Blindagem += Bloquear ÷ 3.',
        tipo: 'modificar',
        previewTexto: 'Blindagem + (Perícia: Bloquear ÷ 3)',
        config: { calculos: [calc('Blindagem', '+', [{ tipo: 'ficha', ref: 'Perícia: Bloquear' }, { tipo: 'fixo', op: '÷', valor: 3 }])] },
    },
    {
        nome: 'Muraté — Pé Firme',
        descricao: '+1 na defesa enquanto não se deslocar no turno.',
        tipo: 'condicional',
        previewTexto: 'Sem se deslocar no turno: +1 na rolagem de defesa.',
        config: {
            condicaoMecanica: false,
            gatilho: 'Não ter se deslocado neste turno.',
            textoSucesso: '+1 na rolagem de defesa até o próximo turno.',
            textoFalha: 'Sem efeito.',
        },
    },
    {
        // Espelho exato do Uqatá: mesmo alvo (Dano), direção oposta.
        // −2 é o máximo seguro: −3 leva o Muraté a 16 golpes contra arnês pesado,
        // fora da janela de 3 a 10. E −2 é o que ele perderia por nunca usar
        // arma de duas mãos (1d12 média 6,5 vs 1d8 média 4,5).
        nome: 'Muraté — Braço de Escudo',
        descricao: 'O braço que segura o escudo é o braço que não golpeia. Dano −2.',
        tipo: 'modificar',
        previewTexto: 'Dano −2',
        config: { calculos: [calc('Dano', '-', fixo(2))] },
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
        nome: 'Perícias Tribais Muraté',
        descricao: 'A criança Muraté recebe o escudo antes da arma e o carrega até o braço esquecer que ele está lá. Antes de aprender a ferir, aprende-se a não ser ferido.',
        mecs: ['Muraté — Bloquear Tribal'],
    },
    {
        nome: 'Muralha Viva',
        descricao: 'Um escudo mal segurado é peso morto; um escudo bem segurado está sempre no caminho, mesmo quando você não está pensando nele. O Muraté não bloqueia — ele simplesmente é difícil de acertar em cheio.',
        mecs: ['Muraté — Muralha Viva'],
    },
    {
        nome: 'Pé Firme',
        descricao: 'Plantar o pé é uma decisão, e o Muraté a toma antes de a luta começar. Enquanto ele não se mover, o chão em que está é dele.',
        mecs: ['Muraté — Pé Firme'],
    },
    {
        nome: 'Braço de Escudo',
        descricao: 'Metade da força de um Muraté está ocupada segurando aço entre ele e o mundo. Golpe dado com uma mão só, e com a atenção dividida, não abre o mesmo talho — e nenhum Muraté trocaria isso pelo contrário.',
        mecs: ['Muraté — Braço de Escudo'],
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

/* ===== Tribo ===== */
console.log('\n=== TRIBO ===');
const tsnap = await db.collection('system/data/tribes').where('nome', '==', TRIBO).limit(1).get();
if (tsnap.empty) { console.log(`  ✖ tribo "${TRIBO}" não encontrada — ABORTADO`); process.exit(1); }
const tribo = tsnap.docs[0];
console.log(`  ${tribo.id} "${TRIBO}"  publicado=${tribo.data().publicado}`);
const temTexto = Object.keys(TEXTO).length > 0;
console.log(`  texto: ${temTexto ? Object.keys(TEXTO).join(', ') : '(nenhum — lore não é inventada aqui)'}`);
console.log(`  unidadesMilitares: ${UNIDADES ? UNIDADES.map(u => u.nome).join(', ') : '(inalterado)'}`);
console.log(`  peculiaridadeIds: ${JSON.stringify(tribo.data().peculiaridadeIds || [])} -> ${JSON.stringify(pecIds)}`);
console.log(`  ordem: 3  (depois de Uqatá 1 e Pogtara 2)`);
if (APPLY) {
    await db.doc(`system/data/tribes/${tribo.id}`).update({
        ...TEXTO, ...(UNIDADES ? { unidadesMilitares: UNIDADES } : {}),
        peculiaridadeIds: pecIds, ordem: 3,
        pericias: admin.firestore.FieldValue.delete(),
        atualizadoEm: new Date(),
    });
}
console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
