/**
 * Combate v3 — passo 1: os Valores Derivados de Defesa.
 *
 * O defensor não rola mais. A Defesa vira um número estático que o atacante
 * precisa vencer com Graus de Sucesso:
 *
 *     Defesa = Reação + Perícia de defesa − 1,  limitada a menor(DES, RAC)
 *
 * Absorver é a exceção: recebe o golpe no corpo, então o teto dela é VIG.
 *
 * O VD Reação perde a fórmula própria (era menor(DES,RAC) + Agilidade) e passa
 * a ser só o lugar onde modificadores de defesa entram — assim um "−1 na Reação"
 * desce sozinho para as oito Defesas. Agilidade continua em Iniciativa e
 * Deslocamento Terrestre, que é onde ela sempre esteve somando de verdade.
 *
 *   node functions/combate-v3-1-defesas.mjs            (dry-run)
 *   node functions/combate-v3-1-defesas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const BLOCO = { blocoId: 'defesa', blocoNome: 'Defesa', blocoOrdem: 2 };

/* Mesma derivação de `key` do system-data-loader.js. */
const keyDe = nome => nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '');

/* [perícia (ou atributo) que soma, ícone, glosa curta, teto] */
const DEFESAS = [
    ['Esquiva',   '💨', 'Sair da trajetória do golpe.',                                   'DESRAC'],
    ['Aparar',    '⚔️', 'Interceptar com a própria arma. Exige arma empunhada.',           'DESRAC'],
    ['Bloquear',  '🛡️', 'Interpor o escudo. A Qualidade do escudo já soma na perícia.',    'DESRAC'],
    ['Desviar',   '🤚', 'Defesa desarmada. −1 contra ataques com arma.',                   'DESRAC'],
    ['Evadir',    '🏃', 'Escapar de área. Falhando, o Narrador pode derrubar você.',        'DESRAC'],
    ['Cobertura', '🫸', 'Desvia um golpe dirigido a um aliado sem virar alvo.',            'DESRAC'],
    ['Proteger',  '🧍', 'Você vira o alvo no lugar do aliado. Exige estar entre os dois.', 'DESRAC'],
    ['Absorver',  '🪨', 'Recebe no corpo: metade do dano, não letal. Soma VIG, não perícia.', 'VIG'],
];

const eqTeto = tipo => tipo === 'VIG'
    ? [{ tipo: 'ficha', ref: 'VIG' }]
    : [{ tipo: 'ficha', ref: 'DES' }, { tipo: 'ficha', op: 'min', ref: 'RAC' }];

const agora = admin.firestore.Timestamp.now();
const baseMec = {
    fonte: 'individual', duracao: 'permanente', duracaoTurnos: null, duracaoEspecial: '',
    escopo: 'proprio', condicaoAplicacao: '', empilhamento: 'soma', evoluivel: false,
    nivelMaximo: null, progressao: null, progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Valor Derivado', 'Combate v3'], publicado: true,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
};

/* ===== Conferências antes de gravar ===== */
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, sks] = await Promise.all([grab('derivedValues'), grab('skills')]);

const erros = [];
const nomesVD = new Set(vds.map(v => v.nome));
const keysVD = new Set(vds.map(v => keyDe(v.nome)));
const nomesSK = new Set(sks.map(s => s.nome));

for (const [per, , , teto] of DEFESAS) {
    const nome = `Defesa: ${per}`;
    if (nomesVD.has(nome)) erros.push(`VD já existe: "${nome}" — rode a limpeza antes`);
    if (keysVD.has(keyDe(nome))) erros.push(`key colide: "${nome}" → ${keyDe(nome)}`);
    if (nomesSK.has(nome)) erros.push(`colide com perícia: "${nome}"`);
    if (teto !== 'VIG' && !nomesSK.has(per)) erros.push(`perícia de defesa não encontrada: "${per}"`);
    keysVD.add(keyDe(nome));
}

const reacao = vds.find(v => v.nome === 'Reação');
if (!reacao) erros.push('VD "Reação" não encontrado');

console.log('='.repeat(72));
console.log('COMBATE v3 — passo 1: Valores Derivados de Defesa');
console.log('='.repeat(72));
console.log(`\nNovo bloco: ${BLOCO.blocoNome} [${BLOCO.blocoId}] ordem ${BLOCO.blocoOrdem}`);
console.log(`(abaixo de 30 ⇒ nasce aberto na aba Combate da ficha)\n`);
for (const [per, ic, , teto] of DEFESAS) {
    const soma = teto === 'VIG' ? 'VIG' : `Perícia: ${per}`;
    console.log(`  ${ic} Defesa: ${per.padEnd(10)} key=${keyDe('Defesa: ' + per).padEnd(18)}`
        + `= Reação + ${soma} − 1   ⌈teto ${teto === 'VIG' ? 'VIG' : 'menor(DES,RAC)'}⌉`);
}

console.log(`\nVD Reação: perde a fórmula (mecânicas ${JSON.stringify(reacao?.mecanicaIds || [])} → [])`);
console.log('           vira contêiner de modificador; previewTexto errado do banco é corrigido junto.');

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nome nem de key. Perícias de defesa todas encontradas.');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ===== Gravação ===== */
const batch = db.batch();
const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');

DEFESAS.forEach(([per, icone, glosa, teto], i) => {
    const nome = `Defesa: ${per}`;
    const soma = teto === 'VIG'
        ? { tipo: 'ficha', op: '+', ref: 'VIG' }
        : { tipo: 'ficha', op: '+', ref: `Perícia: ${per}` };

    const refMod = colMec.doc(), refLim = colMec.doc();

    batch.set(refMod, {
        ...baseMec, nome: `${nome} (fórmula)`, tipo: 'modificar',
        descricao: `Reação + ${teto === 'VIG' ? 'VIG' : per} − 1.`,
        previewTexto: `+([Reação] + [${teto === 'VIG' ? 'VIG' : per}] − 1) em ${nome}`,
        config: { calculos: [{ alvo: nome, operacao: '+', equacao: [
            { tipo: 'ficha', ref: 'Reação' }, soma, { tipo: 'fixo', op: '-', valor: 1 },
        ] }] },
    });

    batch.set(refLim, {
        ...baseMec, nome: `${nome} (teto)`, tipo: 'limitar',
        descricao: teto === 'VIG'
            ? 'Absorver é recebida no corpo — o teto dela é VIG, não a agilidade.'
            : 'Nenhuma defesa passa do menor entre DES e RAC.',
        previewTexto: `${nome}: máximo ${teto === 'VIG' ? '[VIG]' : 'menor([DES], [RAC])'}`,
        config: { calculos: [{ alvo: nome, tipoLimite: 'maximo', equacao: eqTeto(teto) }] },
    });

    batch.set(colVD.doc(), {
        nome, icone, ordem: (i + 1) * 10, ...BLOCO,
        descricao: `${glosa} O atacante precisa de Graus de Sucesso IGUAIS OU MAIORES que este `
            + `número para o golpe passar. Fórmula: Reação + ${teto === 'VIG' ? 'VIG' : per} − 1, `
            + `limitada a ${teto === 'VIG' ? 'VIG' : 'menor(DES, RAC)'}. `
            + `Você declara uma defesa por golpe recebido; o limite por rodada é Reflexo − 1 (mínimo 1), `
            + `e cada defesa além disso custa 1 Energia.`,
        escopoItem: '', arredondaMesa: false, todoPersonagem: true,
        prefixo: '', sufixo: '', mecanicaIds: [refMod.id, refLim.id],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: AUTOR, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1,
    });
});

/* Reação perde a fórmula e vira contêiner de modificador. */
batch.update(db.collection('system/data/derivedValues').doc(reacao.id), {
    mecanicaIds: [],
    descricao: 'Modificador geral de defesa. NÃO tem fórmula própria: nasce 0 e só muda por '
        + 'peculiaridade, condição, postura ou magia. Entra nas oito Defesas, então um "−1 na Reação" '
        + 'desce para todas de uma vez. Quem rola é sempre o atacante.',
    updatedAt: agora, atualizadoEm: agora,
});
for (const mid of (reacao.mecanicaIds || [])) {
    batch.update(colMec.doc(mid), {
        publicado: false,
        nome: 'Reação (aposentada — combate v3, a Reação não tem mais fórmula)',
        previewTexto: 'aposentada',
        config: { calculos: [] },
        atualizadoEm: agora,
    });
}

await batch.commit();
console.log(`\n✅ Gravado: ${DEFESAS.length} VDs de Defesa, ${DEFESAS.length * 2} mecânicas, `
    + `Reação zerada (${(reacao.mecanicaIds || []).length} mecânica aposentada).`);
process.exit(0);
