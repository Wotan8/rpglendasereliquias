/**
 * Passo 3a da migração v2: os DOMÍNIOS (o gate de treino do Ofício).
 *
 * Regra (§6.3 v2): sem o Domínio da família, o bônus de Ofício de uma arma
 * (Qualidade + Afiação) rende no máximo o atributo que a governa. Com ele,
 * rende inteiro. Implementação sem tocar o motor:
 *
 *   3 VDs de teto (todo personagem tem):
 *     Teto de Ofício: Braço     = FOR   (espada, machado, haste, impacto, foice)
 *     Teto de Ofício: Precisão  = DES   (adaga, faca, estoque, sabre + arremesso)
 *     Teto de Ofício: Disparo   = DES   (arco, besta)
 *
 *   3 Peculiaridades avulsas (12 EXP, mecânica compartilhada "Custo Avulsa -12"):
 *     Domínio de Armas de Braço / de Armas de Precisão / de Disparo
 *     → cada uma soma +10 no teto correspondente; o min() para de morder.
 *
 * A equação das armas passa a ser  min(Qualidade + Afiação, Teto) + FOR
 * — isso é o passo 3b (armas-dominio-min.mjs).
 *
 * Proteção Pesada fica de FORA por ora: o teto dela é sobre o TOTAL do corpo
 * e o motor ainda não tem cap de VD somado — decidido adiar, não improvisar.
 *
 *   node functions/cadastrar-dominios.mjs            (dry-run)
 *   node functions/cadastrar-dominios.mjs --apply
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

/* bloco e ordem: colados nos Acertos por entrega, que já vivem no bloco certo */
const acerto = vds.find(v => v.nome === 'Acerto Corpo a Corpo');
if (!acerto) { console.error('🔴 VD "Acerto Corpo a Corpo" não encontrado.'); process.exit(1); }

const expMec = mecs.filter(m => (m.nome || '') === 'Custo Avulsa -12 EXP');
if (expMec.length !== 1) { console.error(`🔴 mecânica "Custo Avulsa -12 EXP": ${expMec.length} achadas (esperado 1).`); process.exit(1); }

const TETOS = [
    { nome: 'Teto de Ofício: Braço',    icone: '💪', le: 'FOR', ordem: 5,
      familias: 'espada, machado, haste, impacto e foice' },
    { nome: 'Teto de Ofício: Precisão', icone: '🎯', le: 'DES', ordem: 6,
      familias: 'adaga, faca, estoque e sabre, mais as armas de arremesso' },
    { nome: 'Teto de Ofício: Disparo',  icone: '🏹', le: 'DES', ordem: 7,
      familias: 'arco e besta' },
];
const DOMINIOS = [
    { nome: 'Domínio de Armas de Braço',    icone: '⚔️', teto: 'Teto de Ofício: Braço' },
    { nome: 'Domínio de Armas de Precisão', icone: '🗡️', teto: 'Teto de Ofício: Precisão' },
    { nome: 'Domínio de Disparo',           icone: '🏹', teto: 'Teto de Ofício: Disparo' },
];

/* conferências */
const erros = [];
const nomesVD = new Set(vds.map(v => v.nome)), nomesPec = new Set(pecs.map(p => p.nome)), nomesMec = new Set(mecs.map(m => m.nome));
for (const t of TETOS) if (nomesVD.has(t.nome)) erros.push(`VD já existe: ${t.nome}`);
for (const d of DOMINIOS) if (nomesPec.has(d.nome)) erros.push(`peculiaridade já existe: ${d.nome}`);
for (const t of TETOS) if (nomesMec.has(t.nome)) erros.push(`mecânica já existe: ${t.nome}`);

console.log('\n=== cadastrar Domínios (passo 3a) ===\n');
for (const t of TETOS) console.log(`  VD  ${t.icone} ${t.nome.padEnd(26)} = ${t.le}  (ordem ${t.ordem}, bloco "${acerto.blocoNome}")`);
for (const d of DOMINIOS) console.log(`  PEC ${d.icone} ${d.nome.padEnd(28)} → +10 em ${d.teto}  · 12 EXP`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nomes.');
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const colPec = db.collection('system/data/peculiarities');
const batch = db.batch();

for (const t of TETOS) {
    const mecRef = colMec.doc();
    batch.set(mecRef, {
        nome: t.nome, descricao: `Base do teto: o atributo ${t.le}.`,
        fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
        duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        evoluivel: false, nivelMaximo: null, progressao: null,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Valor Derivado'], publicado: true,
        previewTexto: `+[${t.le}] em ${t.nome}`,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
        config: { calculos: [{ alvo: t.nome, operacao: '+', equacao: [{ tipo: 'ficha', ref: t.le }] }] }
    });
    batch.set(colVD.doc(), {
        nome: t.nome, icone: t.icone, ordem: t.ordem,
        descricao: `Quanto o Ofício rende numa arma de ${t.familias}: sem o Domínio, `
            + `Qualidade + Afiação da peça não passam deste valor (base = ${t.le}). `
            + `A Peculiaridade de Domínio soma +10 e o teto deixa de morder. `
            + `O dado da arma nunca é cortado (Livro, 6.3).`,
        blocoId: acerto.blocoId || '', blocoNome: acerto.blocoNome || '', blocoOrdem: acerto.blocoOrdem,
        escopoItem: '', arredondaMesa: false, todoPersonagem: true,
        prefixo: '', sufixo: '', mecanicaIds: [mecRef.id],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: AUTOR,
        criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1
    });
}

for (const d of DOMINIOS) {
    const mecRef = colMec.doc();
    batch.set(mecRef, {
        nome: `${d.nome} — ${d.teto}`,
        descricao: `O treino destrava o Ofício: +10 no ${d.teto}.`,
        fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
        duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        evoluivel: false, nivelMaximo: null, progressao: null,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Combate', 'Domínio'], publicado: true,
        previewTexto: `+10 em ${d.teto}`,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
        config: { calculos: [{ alvo: d.teto, operacao: '+', equacao: [{ valor: 10 }] }] }
    });
    batch.set(colPec.doc(), {
        nome: d.nome, icone: d.icone,
        descricao: `Treinamento de verdade com as armas dessa família. Sem o Domínio, o bônus de `
            + `Ofício de uma arma (Qualidade + Afiação) rende no máximo o atributo que a governa; `
            + `com ele, rende inteiro. O dado da arma nunca é cortado — 1d12 mal empunhado ainda `
            + `é um 1d12 caindo. Classes marciais nascem com o Domínio do seu ofício.`,
        fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao',
        ehVantagem: true, concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
        mecanicaExpCriacao: [expMec[0].id],
        tags: ['Criação', 'Avulsa'], publicado: true,
        derivedValueIds: [], mecanicaIds: [mecRef.id],
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1
    });
}

await batch.commit();
console.log(`\n✅ 3 VDs de teto + 3 Peculiaridades de Domínio (+ 6 mecânicas) criados.`);
process.exit(0);
