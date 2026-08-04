/**
 * Cria as 16 Blindagens tipadas — 3 de golpe físico e 13 de Essência.
 *
 * Cada uma nasce lendo o número geral por uma mecânica compartilhada:
 *
 *     Blindagem Cortante  =  Blindagem        (+ modificadores da peça)
 *     Blindagem Púrpura   =  Blindagem Arcana (+ modificadores da peça)
 *
 * Assim a peça normal não vincula nada — só as que fogem do padrão. E efeito
 * genérico ("+2 Blindagem") propaga sozinho para todos os tipos, porque eles
 * leem o geral.
 *
 * Fraqueza entra como modificador NEGATIVO no vínculo da peça; resistência,
 * positivo. O valor pode ficar abaixo de zero: contra a fraqueza de alguém sem
 * Reforço Arcano, o golpe é amplificado, e é isso que se quer.
 *
 * A ordem importa: os tipados têm `ordem` maior que Blindagem (30) e Blindagem
 * Arcana (31), porque o recálculo percorre os Valores Derivados por `ordem`
 * (derived-values.js:176) e eles precisam ler o geral já resolvido.
 *
 *   node functions/criar-blindagens-tipadas.mjs            (dry-run)
 *   node functions/criar-blindagens-tipadas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const FISICOS = [
    ['Cortante',    '🗡️', 'Espada, Adaga, Machado e Foice'],
    ['Perfurante',  '🏹', 'Haste, Arco e Besta'],
    ['Contundente', '🔨', 'Impacto — clava, maça, malho, martelo, mangual, porrete e soqueira']
];

/* Cores e domínios conforme "As Treze Essências" (Compêndio de Fluxomancia). */
const ESSENCIAS = [
    ['Cinza','🌫️','Vento'], ['Azul-Claro','💧','Água'], ['Azul','💙','Vida'],
    ['Púrpura','💜','Necrótica'], ['Verde','🌿','Natureza'], ['Rosa','💎','Cristal'],
    ['Amarela','☀️','Luz'], ['Vermelha','🔥','Fogo'], ['Marrom','⛰️','Terra'],
    ['Branca','⬜','Espaço'], ['Prateada','⏳','Tempo'], ['Preta','🕳️','Abissal'],
    ['Dourada','⭐','Poder']
];

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const vds = await grab('derivedValues');
const base = n => vds.find(v => v.nome === n);
const blFis = base('Blindagem'), blArc = base('Blindagem Arcana');
if (!blFis || !blArc) { console.error('🔴 Blindagem ou Blindagem Arcana não encontrada.'); process.exit(1); }
console.log(`Bases: ${blFis.nome} (ordem ${blFis.ordem}) · ${blArc.nome} (ordem ${blArc.ordem})`);

const novos = [];
FISICOS.forEach(([cor, icone, familias], i) => novos.push({
    nome: `Blindagem ${cor}`, icone, lê: 'Blindagem', ordem: 32 + i,
    blocoId: 'blindagem-golpe', blocoNome: 'Blindagem por Golpe', blocoOrdem: 2,
    descricao: `Blindagem contra dano ${cor.toLowerCase()} (${familias}). Nasce igual à `
        + `Blindagem geral; só muda se alguma peça vestida ceder ou resistir a esse golpe. `
        + `Menor que a geral é fraqueza, maior é resistência (Livro de Regras, 5.4).`
}));
ESSENCIAS.forEach(([cor, icone, dominio], i) => novos.push({
    nome: `Blindagem ${cor}`, icone, lê: 'Blindagem Arcana', ordem: 35 + i,
    blocoId: 'blindagem-essencia', blocoNome: 'Blindagem por Essência', blocoOrdem: 3,
    descricao: `Blindagem contra a Essência ${cor} (${dominio}). Nasce igual à Blindagem `
        + `Arcana; só muda se alguma peça vestida ceder ou resistir a essa Essência. `
        + `Pode ficar abaixo de zero — aí o golpe é amplificado (Livro de Regras, 5.4).`
}));

/* conferências */
const existentes = new Set(vds.map(v => v.nome));
const erros = novos.filter(n => existentes.has(n.nome)).map(n => `já existe: ${n.nome}`);
const dup = novos.map(n => n.nome).filter((n, i, a) => a.indexOf(n) !== i);
if (dup.length) erros.push(`duplicado na lista: ${dup.join(', ')}`);
if (novos.some(n => n.ordem <= Math.max(blFis.ordem, blArc.ordem)))
    erros.push('algum tipado tem ordem menor que a base — leria o geral antes de ele existir');

console.log(`\n${novos.length} Valores Derivados a criar:`);
for (const n of novos) console.log(`  ${n.icone} ${n.nome.padEnd(22)} lê ${n.lê.padEnd(17)} ordem ${n.ordem}  [${n.blocoNome}]`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nome e ordem coerente com as bases.');

if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const batch = db.batch();

for (const n of novos) {
    const mecRef = colMec.doc();
    batch.set(mecRef, {
        nome: n.nome, descricao: `Herda o valor de ${n.lê}.`,
        fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
        duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
        condicaoAplicacao: '', empilhamento: 'soma',
        evoluivel: false, nivelMaximo: null, progressao: null,
        progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
        tags: ['Valor Derivado'], publicado: true,
        previewTexto: `+[${n.lê}] em ${n.nome}`,
        criadoPor: blFis.criadoPor, criadoEm: agora, atualizadoEm: agora, versao: 1,
        config: { calculos: [{ alvo: n.nome, operacao: '+', equacao: [{ tipo: 'ficha', ref: n.lê }] }] }
    });
    batch.set(colVD.doc(), {
        nome: n.nome, icone: n.icone, descricao: n.descricao, ordem: n.ordem,
        blocoId: n.blocoId, blocoNome: n.blocoNome, blocoOrdem: n.blocoOrdem,
        escopoItem: '', arredondaMesa: true, todoPersonagem: true,
        prefixo: '', sufixo: '', mecanicaIds: [mecRef.id],
        campoAtual: false, campoEditavel: false, statusCombate: false,
        characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
        publicado: true, criadoPor: blFis.criadoPor,
        criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1
    });
}
await batch.commit();
console.log(`\n✅ ${novos.length} Valores Derivados + ${novos.length} mecânicas criados.`);
process.exit(0);
