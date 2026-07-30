/**
 * Preenche o texto da tribo Forasteiro e cadastra suas 3 peculiaridades.
 * Idempotente: procura por nome antes de criar.
 *
 *   node functions/cadastrar-forasteiro.mjs            (dry-run)
 *   node functions/cadastrar-forasteiro.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const TRIBO = 'Forasteiro';

const MECH_BASE = {
    fonte: 'tribo', duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '',
    escopo: 'proprio', condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};

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

/* ===== Texto da tribo =====
   governo/economia/militar são obrigatórios no painel e para quem não tem tribo
   eles não existem — então cada campo diz o que a AUSÊNCIA significa. */
const TEXTO = {
    lema: 'Os Sem Povo',
    descricao: 'Nem todo mundo em Vasteluna tem um povo. Alguns foram expulsos, outros fugiram, outros nasceram entre duas tribos e não foram aceitos por nenhuma. Há os que desertaram de uma legião, os que sobreviveram ao massacre da própria aldeia, os que simplesmente andaram longe demais para voltar. O que os une não é uma origem — é a falta dela.',
    cultura: 'Nenhuma que você tenha herdado. O que um forasteiro sabe, aprendeu sozinho ou tomou de quem passou. Não há ritual de passagem, não há brado de nascimento, não há prato que signifique casa. Alguns constroem os próprios costumes ao longo da estrada; outros imitam os de quem os acolheu por uma estação. Nenhum dos dois é reconhecido por ninguém.',
    governo: 'Nenhum. Você não responde a Tomador, Senado, Conclave, Chefe da Tribo, Caveira Negra ou Conselho de Sábios. Também não pode recorrer a nenhum deles: não há quem julgue em seu favor, não há quem registre sua queixa, não há quem herde o que você deixar.',
    economia: 'A sua. O que carrega, o que ganha e o que consegue guardar. Sem tributo a pagar, mas também sem quinhão de saque, sem armazém comunal em ano ruim e sem crédito na palavra de um parente. Um forasteiro compra caro e vende barato, porque não tem gente por trás para garantir o acordo.',
    militar: 'Nenhuma. Ninguém marcha por você, ninguém vem te buscar quando você não volta, ninguém vinga sua morte. Em troca, você não é convocado, não jura bandeira e não morre por uma fronteira que não escolheu.',
};

console.log('=== MECÂNICAS ===');
const MECANICAS = [
    {
        nome: 'Forasteiro — Aprendizado Sem Mestre',
        descricao: '1 ponto em qualquer perícia. Ninguém te ensinou um ofício — você escolheu o seu.',
        tipo: 'distribuir',
        previewTexto: '1 ponto em qualquer perícia',
        // mesma forma do "Aprendizado Acelerado", que já usa o pool aberto
        config: { pool: 'Perícias (qualquer)', restricao: 'livre', quantidadeAlvos: 1, valorPorAlvo: 1, operacao: '+' },
    },
    {
        nome: 'Forasteiro — Nenhuma Rixa é Sua',
        descricao: 'As rivalidades herdadas não te alcançam.',
        tipo: 'narrativo',
        previewTexto: 'Não carrega as rixas herdadas entre tribos.',
        config: {
            textoEfeito: 'Uqatá e Muraté, Laqueus e Latebra, Famo e Tulo se matam por ódio de gerações. Você atravessa território das duas no mesmo mês carregando o ódio de ninguém. Onde um membro de tribo seria morto pelo símbolo que veste, você é apenas mais um estranho — desconfiado, mas não caçado.',
        },
    },
    {
        nome: 'Forasteiro — Sem Povo',
        descricao: '−1 em Barganha. Sem gente por trás, sua palavra não garante acordo.',
        tipo: 'modificar',
        previewTexto: 'Perícia: Barganha −1',
        config: { calculos: [{ alvo: 'Perícia: Barganha', operacao: '-', equacao: [{ tipo: 'fixo', valor: 1 }] }] },
    },
];
const mecIds = {};
for (const m of MECANICAS) {
    mecIds[m.nome] = await acheOuCrie('system/data/mechanics', m.nome, { ...MECH_BASE, ...m });
    console.log(`      ${JSON.stringify(m.config).slice(0, 170)}`);
}

console.log('\n=== PECULIARIDADES ===');
const PEC_BASE = {
    fonte: 'tribo', fonteRef: '', quandoSeAplica: 'passivo', ehVantagem: false,
    concedeAura: false, auraVinculadaId: null, auraGrauConcedido: null,
    derivedValueIds: [], mecanicaExpCriacao: [],
    tags: ['Tribo', TRIBO], publicado: true, versao: 1,
};
const PECULIARIDADES = [
    {
        nome: 'Perícias do Forasteiro',
        descricao: 'Sem mestre, sem tradição e sem ofício herdado. O que você sabe fazer, escolheu aprender — e é só uma coisa, porque ninguém te deu tempo nem professor para mais.',
        mecs: ['Forasteiro — Aprendizado Sem Mestre'],
    },
    {
        nome: 'Nenhuma Rixa é Sua',
        descricao: 'Você não nasceu devendo sangue a ninguém. As guerras antigas de Vasteluna passam ao seu lado sem te reconhecer, e isso te abre estradas que nenhum membro de tribo pode andar.',
        mecs: ['Forasteiro — Nenhuma Rixa é Sua'],
    },
    {
        nome: 'Sem Povo',
        descricao: 'Nenhuma tribo te abriga, te estende crédito ou te segue. Comuno te recebe bem, porque foi feita de gente como você, e Uqatá não liga para sua origem se você for forte o bastante. Famo, Pogo, Arn, Pogtara e Mâni vão do frio ao hostil.',
        mecs: ['Forasteiro — Sem Povo'],
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
const tsnap = await db.collection('system/data/tribes').where('nome', '==', TRIBO).limit(1).get();
if (tsnap.empty) { console.log(`  ✖ tribo "${TRIBO}" não encontrada — ABORTADO`); process.exit(1); }
const tribo = tsnap.docs[0];
console.log(`  ${tribo.id} "${TRIBO}"  publicado=${tribo.data().publicado}`);
for (const [k, v] of Object.entries(TEXTO)) console.log(`  ${k}: ${JSON.stringify(String(v).slice(0, 70))}...`);
console.log(`  peculiaridadeIds: ${JSON.stringify(tribo.data().peculiaridadeIds || [])} -> ${JSON.stringify(pecIds)}`);
console.log(`  ordem: 99  (última no grid — é a saída "sem tribo")`);
if (APPLY) {
    await db.doc(`system/data/tribes/${tribo.id}`).update({
        ...TEXTO, peculiaridadeIds: pecIds, ordem: 99,
        pericias: admin.firestore.FieldValue.delete(),
        atualizadoEm: new Date(),
    });
}

console.log(APPLY ? '\n✔ GRAVADO.\n' : '\nDRY-RUN — nada gravado. Rode com --apply.\n');
process.exit();
