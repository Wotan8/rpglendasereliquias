/**
 * Fecha o Domínio que faltava: PROTEÇÃO.
 *
 * Sem o treino, o que o aço vestido rende para no VIG. O teto morde só a
 * parcela de Blindagem que veio de PEÇA (tipoLimite 'maximo_itens') — o que
 * raça, peculiaridade, condição ou bênção somam passa inteiro.
 *
 *   VD  Teto de Ofício: Proteção  = VIG
 *   PEC Domínio de Proteção (12 EXP) → +10 nesse teto
 *   MEC Limite: Blindagem de peça ≤ Teto de Ofício: Proteção  (regra global)
 *
 * A mecânica de limite é uma REGRA DE ITEM (itemRules), não peculiaridade:
 * ela precisa valer para todo personagem, inclusive quem não comprou nada.
 *
 *   node functions/cadastrar-dominio-protecao.mjs            (dry-run)
 *   node functions/cadastrar-dominio-protecao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, mecs, pecs] = await Promise.all(['derivedValues', 'mechanics', 'peculiarities'].map(grab));

const modelo = vds.find(v => v.nome === 'Teto de Ofício: Braço');
if (!modelo) { console.error('🔴 "Teto de Ofício: Braço" não existe — rode cadastrar-dominios.mjs antes.'); process.exit(1); }
const expMec = mecs.filter(m => (m.nome || '') === 'Custo Avulsa -12 EXP');
if (expMec.length !== 1) { console.error(`🔴 "Custo Avulsa -12 EXP": ${expMec.length} achadas (esperado 1).`); process.exit(1); }

const NOME_VD = 'Teto de Ofício: Proteção';
const NOME_PEC = 'Domínio de Proteção';
const NOME_LIM = 'Blindagem de peça limitada pelo Ofício';

const erros = [];
if (vds.some(v => v.nome === NOME_VD)) erros.push(`VD já existe: ${NOME_VD}`);
if (pecs.some(p => p.nome === NOME_PEC)) erros.push(`peculiaridade já existe: ${NOME_PEC}`);
if (mecs.some(m => m.nome === NOME_LIM)) erros.push(`mecânica já existe: ${NOME_LIM}`);

console.log('\n=== Domínio de Proteção ===\n');
console.log(`  VD   🛡️ ${NOME_VD.padEnd(26)} = VIG   (bloco "${modelo.blocoNome}", ordem ${(modelo.ordem || 5) + 3})`);
console.log(`  PEC  🛡️ ${NOME_PEC.padEnd(26)} → +10 no teto · 12 EXP`);
console.log(`  REGRA   ${NOME_LIM}`);
console.log(`          Blindagem: teto de itens = [${NOME_VD}]`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nomes.');
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const colPec = db.collection('system/data/peculiarities');
const colRule = db.collection('system/data/itemRules');
const batch = db.batch();

/* 1) VD do teto — base VIG, igual aos três irmãos */
const mecBase = colMec.doc();
batch.set(mecBase, {
    nome: NOME_VD, descricao: 'Base do teto: o atributo VIG.',
    fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
    duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
    condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Valor Derivado'], publicado: true,
    previewTexto: `+[VIG] em ${NOME_VD}`,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    config: { calculos: [{ alvo: NOME_VD, operacao: '+', equacao: [{ tipo: 'ficha', ref: 'VIG' }] }] }
});
batch.set(colVD.doc(), {
    nome: NOME_VD, icone: '🛡️', ordem: (modelo.ordem || 5) + 3,
    descricao: 'Quanto a proteção vestida rende: sem o Domínio de Proteção, a soma da '
        + 'Blindagem que vem das PEÇAS não passa deste valor (base = VIG). O que raça, '
        + 'peculiaridade, condição ou bênção somam na Blindagem passa inteiro, por cima '
        + 'do teto. A Peculiaridade soma +10 e o teto deixa de morder (Livro, 5.6).',
    blocoId: modelo.blocoId || '', blocoNome: modelo.blocoNome || '', blocoOrdem: modelo.blocoOrdem,
    // todoPersonagem: false igual aos três irmãos — é encanamento do teto, não
    // campo de ficha. O jogador não lê "Teto de Ofício: Proteção 3"; ele vê a
    // Blindagem já limitada. VD escondido continua sendo calculado.
    escopoItem: '', arredondaMesa: false, todoPersonagem: false,
    prefixo: '', sufixo: '', mecanicaIds: [mecBase.id],
    campoAtual: false, campoEditavel: false, statusCombate: false,
    characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
    publicado: true, criadoPor: AUTOR, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1
});

/* 2) Peculiaridade que destrava */
const mecPec = colMec.doc();
batch.set(mecPec, {
    nome: `${NOME_PEC} — ${NOME_VD}`,
    descricao: `O treino destrava o aço: +10 no ${NOME_VD}.`,
    fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
    duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
    condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Combate', 'Domínio'], publicado: true,
    previewTexto: `+10 em ${NOME_VD}`,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    config: { calculos: [{ alvo: NOME_VD, operacao: '+', equacao: [{ valor: 10 }] }] }
});
batch.set(colPec.doc(), {
    nome: NOME_PEC, icone: '🛡️',
    descricao: 'Saber vestir o aço e carregá-lo o dia inteiro. Sem o Domínio, a Blindagem '
        + 'que vem das peças rende no máximo o seu VIG — o corpo não sustenta o que a '
        + 'armadura promete. Com ele, rende inteira. Classes marciais pesadas nascem com ele.',
    fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao',
    ehVantagem: true, concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
    mecanicaExpCriacao: [expMec[0].id],
    tags: ['Criação', 'Avulsa'], publicado: true,
    derivedValueIds: [], mecanicaIds: [mecPec.id],
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1
});

/* 3) A regra do teto — global, vale para todo personagem */
const mecLim = colMec.doc();
batch.set(mecLim, {
    nome: NOME_LIM,
    descricao: 'A soma da Blindagem vinda de peças equipadas não passa do Teto de Ofício: Proteção.',
    fonte: 'individual', tipo: 'limitar', duracao: 'permanente',
    duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
    condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Combate', 'Domínio'], publicado: true,
    previewTexto: `Blindagem: o que vem de itens não passa de [${NOME_VD}]`,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    config: { calculos: [{ alvo: 'Blindagem', tipoLimite: 'maximo_itens', valorTipo: 'ficha', equacao: [{ tipo: 'ficha', ref: NOME_VD }] }] }
});
batch.set(colRule.doc(), {
    nome: NOME_LIM,
    descricao: 'Regra global: sem o Domínio de Proteção, o aço rende até o VIG.',
    mecanicaIds: [mecLim.id], publicado: true,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1
});

await batch.commit();
console.log('\n✅ VD + Peculiaridade + regra de item criados (3 mecânicas).');
process.exit(0);
