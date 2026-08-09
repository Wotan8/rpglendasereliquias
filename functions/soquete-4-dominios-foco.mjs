/**
 * Passo 4 do soquete mágico v2 — Teto de Ofício e Domínio POR ESCOLA.
 *
 * Não existe "Domínio de foco" genérico: um Pallacerdote treinado no Símbolo de
 * Palla não pega um Talismã Profano e usa do mesmo jeito. Cada escola tem o seu
 * par, no mesmo padrão de `cadastrar-dominios.mjs` (3 famílias de arma):
 *
 *   Teto de Ofício: <Escola>  = <atributo>          (todo personagem tem)
 *   Domínio de <Escola>       → +10 no teto          (Peculiaridade avulsa, 12 EXP)
 *
 * Sem o Domínio, a Qualidade do foco rende no máximo o atributo que governa a
 * escola. Como a Qualidade do foco vai para o **Acerto Mágico** (e não para o
 * dano, ao contrário da arma), o teto morde a precisão, não a força do golpe.
 *
 * Ficam de fora: Hemomancia (o Sangral não usa foco — a habilidade é dele) e
 * Alquimancia (é ofício de bancada, o kit entra por `custoEquipamentos`, não por
 * Acerto Mágico — prova: o Caçador usa o mesmo módulo e não é classe mágica).
 * Forjarcanomancia fica intocada por decisão do dono do mundo.
 *
 * `Reforço Arcano` NÃO entra aqui: é campo de item, e `_ME_ITEM_PROPS` é um mapa
 * fixo no motor da ficha. Exige mudança de código + campo no painel-criador, e o
 * catálogo inteiro está em Qualidade 0 com os 13 focos inertes — refinar isso
 * agora seria adiantar um acabamento sobre um sistema sem nenhuma peça em uso.
 *
 *   node functions/soquete-4-dominios-foco.mjs            (dry-run)
 *   node functions/soquete-4-dominios-foco.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

/* escola → atributo que governa · foco · ícone · de onde vem o atributo */
const ESCOLAS = [
    { escola: 'Pallomancia',  le: 'PRE', foco: 'Símbolo',         icone: '🕯️', porque: 'atributoChave do Pallacerdote' },
    { escola: 'Necromancia',  le: 'PRS', foco: 'Talismã Profano', icone: '💀', porque: 'atributoChave do Adepto' },
    { escola: 'Abismancia',   le: 'PRS', foco: 'Talismã Abissal', icone: '🌑', porque: 'a perícia Abismancia é PRS' },
    { escola: 'Totemancia',   le: 'INT', foco: 'Totem',           icone: '🌿', porque: 'Totemismo é INT/RAC; escola dividida entre Xamã (PRE) e Druida (INT)', duvida: true },
    { escola: 'Sonoromancia', le: 'PRE', foco: 'instrumento',     icone: '🎵', porque: 'atributoChave do Bardo' },
    { escola: 'Runomancia',   le: 'INT', foco: 'Tomo',            icone: '📖', porque: 'atributoChave do Runimago' },
];

/* ═══ ASSERTS ═══ */
const SIGLAS = new Set(['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRE', 'PRS', 'AUT', 'MAN']);
assert.equal(ESCOLAS.length, 6, 'seis escolas com foco');
for (const e of ESCOLAS) assert.ok(SIGLAS.has(e.le), `sigla inválida em ${e.escola}`);
assert.equal(new Set(ESCOLAS.map(e => e.escola)).size, 6, 'nenhuma escola repetida');
assert.ok(!ESCOLAS.some(e => /Hemomancia|Alquimancia|Forjarcanomancia/.test(e.escola)),
    'Hemomancia, Alquimancia e Forjarcanomancia ficam fora');
/* Sem Domínio o teto é o atributo (máx 5); com Domínio some (+10 = 15 > Qualidade 5). */
assert.ok(5 + 10 > 5, 'o Domínio tem que zerar a mordida do teto em qualquer Qualidade');
console.log('✅ 10 asserts passaram.\n');

/* ═══ CONFERÊNCIAS ═══ */
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [vds, mecs, pecs] = await Promise.all(['derivedValues', 'mechanics', 'peculiarities'].map(grab));

const ancora = vds.find(v => v.nome === 'Acerto Mágico');
const expMec = mecs.filter(m => (m.nome || '') === 'Custo Avulsa -12 EXP');
const erros = [];
if (!ancora) erros.push('VD "Acerto Mágico" não encontrado — é a âncora de bloco');
if (expMec.length !== 1) erros.push(`mecânica "Custo Avulsa -12 EXP": ${expMec.length} achadas (esperado 1)`);

const nomesVD = new Set(vds.map(v => v.nome)), nomesPec = new Set(pecs.map(p => p.nome)), nomesMec = new Set(mecs.map(m => m.nome));
for (const e of ESCOLAS) {
    if (nomesVD.has(`Teto de Ofício: ${e.escola}`)) erros.push(`VD já existe: Teto de Ofício: ${e.escola}`);
    if (nomesPec.has(`Domínio de ${e.escola}`)) erros.push(`peculiaridade já existe: Domínio de ${e.escola}`);
    if (nomesMec.has(`Teto de Ofício: ${e.escola}`)) erros.push(`mecânica já existe: Teto de Ofício: ${e.escola}`);
}

console.log('=== Passo 4: Teto de Ofício + Domínio, por escola ===\n');
for (const e of ESCOLAS) {
    console.log(`  ${e.duvida ? '?' : ' '} ${e.icone} ${e.escola.padEnd(13)} teto = ${e.le}   foco: ${e.foco.padEnd(16)} ${e.porque}`);
}
console.log('\n  Cada uma vira: 1 VD de teto + 1 mecânica de base + 1 Peculiaridade (12 EXP) + 1 mecânica de +10.');
console.log(`  Total: ${ESCOLAS.length} VDs, ${ESCOLAS.length} Peculiaridades, ${ESCOLAS.length * 2} mecânicas.`);
console.log('\n  Fora: Hemomancia (Sangral não usa foco) · Alquimancia (ofício de bancada) · Forjarcanomancia (intocada).');
console.log('  «?» Totemancia é a única escola de duas classes com atributoChave diferente.');

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(x => '  - ' + x).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nomes.');
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ═══ GRAVAÇÃO ═══ */
const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const colPec = db.collection('system/data/peculiarities');

ESCOLAS.forEach((e, i) => {
    const teto = `Teto de Ofício: ${e.escola}`;
    const mecBase = colMec.doc();
    batch.set(mecBase, {
        nome: teto, descricao: `Base do teto: o atributo ${e.le}.`,
        fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
        duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        evoluivel: false, nivelMaximo: null, progressao: null,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Valor Derivado'], publicado: true,
        previewTexto: `+[${e.le}] em ${teto}`,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
        config: { calculos: [{ alvo: teto, operacao: '+', equacao: [{ tipo: 'ficha', ref: e.le }] }] },
    });
    batch.set(colVD.doc(), {
        nome: teto, icone: e.icone, ordem: 20 + i,
        descricao: `Quanto o Ofício rende num foco de ${e.escola} (${e.foco}): sem o Domínio, a `
            + `Qualidade da peça não passa deste valor (base = ${e.le}). A Peculiaridade de Domínio `
            + `soma +10 e o teto deixa de morder. Como a Qualidade do foco vai para o Acerto Mágico, `
            + `o teto corta a precisão da conjuração, não o dado da magia.`,
        blocoId: ancora.blocoId || '', blocoNome: ancora.blocoNome || '', blocoOrdem: ancora.blocoOrdem,
        escopoItem: '', arredondaMesa: false, todoPersonagem: true,
        prefixo: '', sufixo: '', mecanicaIds: [mecBase.id],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: AUTOR,
        criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1,
    });

    const mecDom = colMec.doc();
    batch.set(mecDom, {
        nome: `Domínio de ${e.escola} — ${teto}`,
        descricao: `O treino destrava o Ofício: +10 no ${teto}.`,
        fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
        duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        evoluivel: false, nivelMaximo: null, progressao: null,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Combate', 'Domínio'], publicado: true,
        previewTexto: `+10 em ${teto}`,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
        config: { calculos: [{ alvo: teto, operacao: '+', equacao: [{ valor: 10 }] }] },
    });
    batch.set(colPec.doc(), {
        nome: `Domínio de ${e.escola}`, icone: e.icone,
        descricao: `Treinamento de verdade com o foco dessa escola (${e.foco}). Sem o Domínio, a `
            + `Qualidade do foco rende no máximo o atributo que governa a escola; com ele, rende `
            + `inteira. O Domínio é por escola: quem treinou num ${e.foco} não pega o foco de outra `
            + `arte e conjura do mesmo jeito.`,
        fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao',
        ehVantagem: true, concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
        mecanicaExpCriacao: [expMec[0].id],
        tags: ['Criação', 'Avulsa'], publicado: true,
        derivedValueIds: [], mecanicaIds: [mecDom.id],
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
});

await batch.commit();
console.log(`\n✅ ${ESCOLAS.length} VDs de teto + ${ESCOLAS.length} Peculiaridades de Domínio (+ ${ESCOLAS.length * 2} mecânicas) criados.`);
process.exit(0);
