/**
 * Cadastra a camada de classe do Runimago:
 *
 *  1. Três perícias de ramo (categoria exclusivo):
 *       Escripta Rúnica (DES/INT) · Talha Rúnica (FOR/DES) · Tatuagem Rúnica (DES/PRS)
 *  2. Três Peculiaridades de Domínio (12 EXP, mecânica compartilhada
 *     "Custo Avulsa -12 EXP" — o padrão das armas e focos). Sem VD de teto:
 *     o gate do ramo é regra de ofício (sem Domínio = rascunho, usos 1, −2),
 *     não corte de equação.
 *  3. Módulo "Cartucho Rúnico" — o primeiro com permitirCriacaoJogador: true
 *     como razão de existir. Cada item é uma runa projetada no Laboratorium.
 *  4. Vincula o módulo à classe Runimago (hoje com ZERO módulos).
 *
 *   node functions/cadastrar-ramos-runomancia.mjs            (dry-run)
 *   node functions/cadastrar-ramos-runomancia.mjs --apply
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
const MODULO_ID = 'cartucho_runico';

const PERICIAS = [
    { nome: 'Escripta Rúnica', atributoBase: ['DES', 'INT'],
      desc: 'O ofício do pincel: gravar circuitos com tinta sobre papel, tecido ou parede. Rápido (0,75× o tempo padrão) e barato (metade do material) — e a runa nasce contada: usos = perícia + qualidade da tinta − ⌈CT÷20⌉.' },
    { nome: 'Talha Rúnica', atributoBase: ['FOR', 'DES'],
      desc: 'O ofício da talhadeira: circuitos entalhados em pedra, metal, madeira ou osso. Quatro vezes mais lento que o padrão — e dez vezes mais durável: usos = 10 × (perícia + qualidade do material − ⌈CT÷20⌉).' },
    { nome: 'Tatuagem Rúnica', atributoBase: ['DES', 'PRS'],
      desc: 'O ofício da agulha: circuitos na carne viva, com Infusor obrigatório (§6.4) e a Lei da Afinidade governando a tinta. 1,25× o tempo padrão. Permanente no portador — some se escalpelarem a pele ou o membro for perdido.' },
];

const DOMINIOS = [
    { nome: 'Domínio de Escripta', icone: '🖌️', ramo: 'Escripta Rúnica' },
    { nome: 'Domínio de Talha', icone: '🪨', ramo: 'Talha Rúnica' },
    { nome: 'Domínio de Tatuagem', icone: '🪡', ramo: 'Tatuagem Rúnica' },
];

/* Schema do Cartucho: os números vêm da auditoria do Laboratorium; o jogador
   não digita conta, cola o resultado. Campos tipados do passo 7 valem aqui
   como em toda magia (alcance/formaArea/duração ficam FORA de valores). */
const SCHEMA = [
    { key: '1', tipo: 'text', label: 'Nome da runa', largura: 'full', placeholder: 'Ex.: Lança de Lava II', somenteLeitura: false },
    { key: '2', tipo: 'text', label: 'Ramo:', largura: 'quarto', placeholder: 'Escripta / Talha / Tatuagem', somenteLeitura: false },
    { key: '3', tipo: 'number', label: 'CT:', largura: 'quarto', placeholder: 'da auditoria', somenteLeitura: false },
    { key: '4', tipo: 'number', label: 'Alvo de Construção:', largura: 'quarto', placeholder: 'da auditoria', somenteLeitura: false },
    { key: '5', tipo: 'contador', label: 'Usos restantes', largura: 'quarto', placeholder: '' },
    { key: '6', tipo: 'textarea', label: 'Efeito:', largura: 'full', placeholder: 'O que a runa faz quando ativa (da ficha técnica)', somenteLeitura: false },
    { key: '7', tipo: 'text', label: 'Condições aplicadas:', largura: 'full', placeholder: 'Ex.: Congelamento (VIG vs GS) — ver CONFLUENCIAS-CONDICOES', ocultarSeVazio: true, somenteLeitura: false },
    { key: '8', tipo: 'text', label: 'Gatilho/acesso:', largura: 'full', placeholder: 'Toque simples / Reconhecedor (biometrias) / Selector...', ocultarSeVazio: true, somenteLeitura: false },
    { key: '9', tipo: 'link', label: 'Ficha técnica:', largura: 'full', placeholder: 'link da exportação do Laboratorium', ocultarSeVazio: true, somenteLeitura: false },
];

/* ═══ ASSERTS ═══ */
assert.equal(PERICIAS.length, 3); assert.equal(DOMINIOS.length, 3);
assert.ok(PERICIAS.every(p => /Rúnica$/.test(p.nome)), 'nomes em paridade (— Rúnica)');
assert.ok(DOMINIOS.every(d => PERICIAS.some(p => p.nome === d.ramo)), 'cada Domínio aponta um ramo real');
assert.ok(SCHEMA.some(f => f.tipo === 'contador' && /Usos/.test(f.label)), 'usos restantes é contador');
assert.ok(!SCHEMA.some(f => /mentaliz/i.test(f.label + f.placeholder)), 'mentalização não existe');
console.log('✅ 5 asserts passaram.\n');

/* ═══ CONFERÊNCIAS ═══ */
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [sks, pecs, mecs, mods, cls] = await Promise.all(
    ['skills', 'peculiarities', 'mechanics', 'classModules', 'classes'].map(grab));
const erros = [];
for (const p of PERICIAS) if (sks.some(s => s.nome === p.nome)) erros.push(`perícia já existe: ${p.nome}`);
for (const d of DOMINIOS) if (pecs.some(x => x.nome === d.nome)) erros.push(`peculiaridade já existe: ${d.nome}`);
const expMec = mecs.filter(m => m.nome === 'Custo Avulsa -12 EXP');
if (expMec.length !== 1) erros.push(`mecânica "Custo Avulsa -12 EXP": ${expMec.length} (esperado 1)`);
if (mods.some(m => m.id === MODULO_ID)) erros.push('módulo cartucho_runico já existe');
const runimago = cls.find(c => c.nome === 'Runimago');
if (!runimago) erros.push('classe Runimago não achada');
else if ((runimago.modulosDaClasse || []).length) erros.push(`Runimago já tem módulos: ${JSON.stringify(runimago.modulosDaClasse)}`);

console.log('=== Camada de classe do Runimago ===\n');
for (const p of PERICIAS) console.log(`  PER  ${p.nome.padEnd(18)} ${JSON.stringify(p.atributoBase)}`);
for (const d of DOMINIOS) console.log(`  PEC  ${d.icone} ${d.nome.padEnd(20)} → destrava o ofício de ${d.ramo} · 12 EXP`);
console.log(`  MOD  🜃 Cartucho Rúnico  (${SCHEMA.length} campos · permitirCriacaoJogador: TRUE · 0 itens — as runas são do jogador)`);
console.log('  CLS  Runimago.modulosDaClasse ← [cartucho_runico]');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ═══ GRAVAÇÃO ═══ */
const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const p of PERICIAS) {
    batch.set(db.collection('system/data/skills').doc(), {
        nome: p.nome, categoria: 'exclusivo', atributoBase: p.atributoBase,
        descricao: p.desc, publicado: true, criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
}
for (const d of DOMINIOS) {
    batch.set(db.collection('system/data/peculiarities').doc(), {
        nome: d.nome, icone: d.icone,
        descricao: `Treinamento de verdade no ofício de ${d.ramo}. Sem o Domínio, grava-se só rascunho: `
            + `usos travados em 1 e −2 no Teste de Construção. Com ele, o ofício inteiro — tempos, custos e `
            + `usos da tabela dos ramos. O Domínio é por ramo: quem domina o pincel não entalha pedra do mesmo jeito.`,
        fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao',
        ehVantagem: true, concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
        mecanicaExpCriacao: [expMec[0].id],
        tags: ['Criação', 'Avulsa'], publicado: true,
        derivedValueIds: [], mecanicaIds: [],
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    });
}
batch.set(db.collection('system/data/classModules').doc(MODULO_ID), {
    titulo: 'Cartucho Rúnico', icone: '🜃', tipo: 'lista',
    schema: SCHEMA, itensPredefinidos: [],
    permitirCriacaoJogador: true,
    custoExpPorItem: null, custoExpLabel: '',
    custoCriacaoMecanicaId: '', custoCriacaoMecanicaIds: [],
    custoEdicaoAtivo: false, custoEdicaoMecanicaId: '', custoEdicaoMecanicaIds: [],
    custoRemocaoAtivo: false, custoRemocaoMecanicaId: '', custoRemocaoMecanicaIds: [],
    custoEquipamentos: null, bloqueioMecanicaIds: [], cadastrarBloqueio: false,
    limiteFixo: null, limiteMecanicaIds: [], mecanicaLimiteId: '',
    publicado: true, criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
});
batch.update(db.collection('system/data/classes').doc(runimago.id), {
    modulosDaClasse: [MODULO_ID], atualizadoEm: agora,
});
await batch.commit();
console.log('\n✅ 3 perícias + 3 Domínios + módulo Cartucho Rúnico + vínculo na classe.');
process.exit(0);
