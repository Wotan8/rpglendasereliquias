/**
 * Liga o Tabuleiro às formas de conjurar. Três coisas, nesta ordem:
 *
 *   1. TAGS nos instrumentos. O catálogo só tinha "Instrumento" — Rabeca,
 *      Flauta e Tambor eram indistinguíveis. Sem separar, exigir "sopro" numa
 *      Forma travaria o Bardo inteiro. A tag antiga fica; a nova entra junto.
 *      A separação sai do NOME do próprio item (rabeca e alaúde são corda —
 *      isso é o que a palavra significa, não regra nova).
 *
 *   2. FORMAS DE CONJURAÇÃO — Vocal, Corda, Percussão, Sopro — cada uma
 *      apontando o VD que os módulos do Bardo já usavam, e declarando o que
 *      exige. Vocal exige Cabeça e é bloqueada por Afogando/Silenciado; os
 *      instrumentos exigem o item com a tag criada no passo 1.
 *
 *   3. MARCAR as colunas dos módulos mágicos como "🪄 forma de conjurar", que
 *      é o que faz o Tabuleiro perguntar por elas em vez de oferecer o Estilete.
 *      Manobras ficam de FORA: "Postura Ofensiva" é postura, não veículo.
 *
 *   node functions/__aplica-formas-conjuracao.mjs            (dry-run)
 *   node functions/__aplica-formas-conjuracao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const agora = () => admin.firestore.Timestamp.now();

/* ═══ 1. TAGS DOS INSTRUMENTOS ═══ */
const TAG_POR_ITEM = {
    'Rabeca': 'Corda', 'Harpa de Colo': 'Corda', 'Alaúde Clássico': 'Corda',
    'Flauta de Madeira': 'Sopro', 'Gaita de Foles': 'Sopro', 'Trompa de Caça': 'Sopro', 'Apito Druida de Osso': 'Sopro',
    'Tambor de Mão': 'Percussão', 'Címbalos': 'Percussão', 'Pandeireta': 'Percussão', 'Chocalho Cerimonial': 'Percussão',
};

console.log('── 1. TAGS NOS INSTRUMENTOS ──');
const eqSnap = await db.collection('system/data/equipment').get();
let nTags = 0;
for (const d of eqSnap.docs) {
    const e = d.data();
    const nova = TAG_POR_ITEM[(e.nome || '').trim()];
    if (!nova) continue;
    const tags = e.tags || [];
    if (tags.includes(nova)) continue;
    console.log(`   ${(e.nome).padEnd(24)} [${tags.join(', ')}] + "${nova}"`);
    nTags++;
    if (APLICAR) await d.ref.update({ tags: [...tags, nova], updatedAt: agora() });
}
console.log(`   ${nTags} item(ns) a marcar\n`);

/* ═══ 2. FORMAS DE CONJURAÇÃO ═══ */
const vdSnap = await db.collection('system/data/derivedValues').get();
const vdPorNome = new Map();
vdSnap.forEach(d => vdPorNome.set((d.data().nome || '').trim().toLowerCase(), d.id));

const condSnap = await db.collection('system/data/conditions').get();
const condPorNome = new Map();
condSnap.forEach(d => condPorNome.set((d.data().nome || '').trim().toLowerCase(), d.id));

const vd = n => vdPorNome.get(n.toLowerCase()) || null;
const cond = n => condPorNome.get(n.toLowerCase()) || null;

const FORMAS = [
    {
        nome: 'Vocal', icone: '🗣️', ordem: 1,
        descricao: 'A própria voz. Não precisa de nada nas mãos — mas precisa de boca livre e ar nos pulmões.',
        vds: ['Vocal'],
        requisito: 'parte_corpo', partesDoCorpoNomes: ['Cabeça'],
        // É isto que faz o "não pode falar" do Afogando parar de ser só texto.
        condicoes: ['Afogando'],
    },
    {
        nome: 'Inst. Corda', icone: '🪕', ordem: 2,
        descricao: 'Rabeca, alaúde, harpa. Precisa do instrumento em mãos.',
        vds: ['Inst. Cordas', 'Inst. Corda'],
        requisito: 'item_tag', itemTags: ['Corda'],
    },
    {
        nome: 'Inst. Percussão', icone: '🥁', ordem: 3,
        descricao: 'Tambor, címbalos, chocalho. Precisa do instrumento em mãos.',
        vds: ['Inst. Percussão'],
        requisito: 'item_tag', itemTags: ['Percussão'],
    },
    {
        nome: 'Inst. Sopro', icone: '🎺', ordem: 4,
        descricao: 'Flauta, gaita, trompa. Precisa do instrumento em mãos e de fôlego.',
        vds: ['Inst. Sopro'],
        requisito: 'item_tag', itemTags: ['Sopro'],
        condicoes: ['Afogando'],
    },
];

console.log('── 2. FORMAS DE CONJURAÇÃO ──');
const fcSnap = await db.collection('system/data/castingForms').get();
const jaTem = new Map();
fcSnap.forEach(d => jaTem.set((d.data().nome || '').trim(), d));

let nFormas = 0;
for (const f of FORMAS) {
    const derivedValueIds = f.vds.map(vd).filter(Boolean);
    const condicoesBloqueiam = (f.condicoes || []).map(cond).filter(Boolean);
    if (!derivedValueIds.length) {
        console.log(`   ⚠️ "${f.nome}" — nenhum VD encontrado (${f.vds.join(' / ')}), PULANDO`);
        continue;
    }
    const doc = {
        nome: f.nome, icone: f.icone, descricao: f.descricao, ordem: f.ordem,
        derivedValueIds, requisito: f.requisito,
        itemTags: f.itemTags || [], partesDoCorpoNomes: f.partesDoCorpoNomes || [],
        condicoesBloqueiam, publicado: true, updatedAt: agora(),
    };
    const existente = jaTem.get(f.nome);
    console.log(`   ${existente ? '↻' : '+'} ${f.icone} ${f.nome.padEnd(16)} VD=${derivedValueIds.length} · ${f.requisito}` +
        (f.itemTags ? ` [${f.itemTags.join(',')}]` : '') +
        (condicoesBloqueiam.length ? ` · bloqueia: ${(f.condicoes || []).join(', ')}` : ''));
    nFormas++;
    if (APLICAR) {
        if (existente) await existente.ref.update(doc);
        else await db.collection('system/data/castingForms').add({ ...doc, criadoEm: agora() });
    }
}
console.log(`   ${nFormas} forma(s)\n`);

/* ═══ 3. MARCAR AS COLUNAS DOS MÓDULOS ═══ */
// Só coluna select_vd que É veículo. Manobras ficam de fora de propósito:
// "Postura Ofensiva" é postura, não forma de conjurar.
const PULAR = /manobra/i;
const EH_VEICULO = /^(vocal|inst\.|teste)/i;

console.log('── 3. COLUNAS MARCADAS COMO VEÍCULO ──');
const cmSnap = await db.collection('system/data/classModules').get();
let nCols = 0;
for (const d of cmSnap.docs) {
    const m = d.data();
    if (PULAR.test(m.nome || d.id)) { continue; }
    const schema = m.schema || [];
    let mudou = false;
    const novo = schema.map(f => {
        if (f.tipo !== 'select_vd' || f.ehVeiculo) return f;
        if (!EH_VEICULO.test(String(f.label || '').trim())) return f;
        mudou = true;
        return { ...f, ehVeiculo: true };
    });
    if (!mudou) continue;
    const marcadas = novo.filter(f => f.ehVeiculo).map(f => f.label);
    console.log(`   ${(m.nome || d.id).padEnd(28)} → ${marcadas.join(' · ')}`);
    nCols++;
    if (APLICAR) await d.ref.update({ schema: novo, updatedAt: agora() });
}
console.log(`   ${nCols} módulo(s)\n`);

console.log('═'.repeat(70));
console.log(APLICAR ? '✅ APLICADO no Firestore' : '🔍 dry-run — rode com --apply para gravar');
process.exit(0);
