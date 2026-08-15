/**
 * Formas de Conjuração das classes que ainda não tinham.
 *
 * Só o Bardo tinha Forma cadastrada, e por isso ele era o único que precisava
 * do foco na mão. As demais conjuravam de bolso vazio: o Xamã sem o Totem, o
 * Adepto sem o Talismã. Estas Formas fecham isso.
 *
 * Cada Forma liga:
 *   · os Valores Derivados que as colunas "🪄 forma de conjurar" dos módulos
 *     daquela classe apontam (é por eles que a magia acha a Forma);
 *   · a TAG do item que precisa estar equipado.
 *
 * Não crio para Sangral nem para Druida, de propósito: o Sangral tira do
 * próprio sangue e o Ferinismo do Druida depende do ANIMAL, não de um objeto.
 * Nenhum dos dois tem foco de bolso, e inventar um seria mudar a classe.
 *
 *   node functions/__aplica-formas-conjuracao-classes.mjs           (só mostra)
 *   node functions/__aplica-formas-conjuracao-classes.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const FORMAS = [
    {
        nome: 'Totem', icone: '🪵', ordem: 10,
        descricao: 'O Xamã não fala com Eco de mãos vazias. O Totem é a porta: '
            + 'sem ele na mão não há vestígio a cravar, nem voz a ouvir.',
        itemTags: ['Totem'],
        vds: ['Cravar Totem', 'Buscar Vestígio', 'Transcendência (Projetor)', 'Transcendência (Receptor)',
              'Comunhão Simples', 'Vincular Eco (Antiqua)', 'Libertar Eco Aprisionado', 'Exorcismo'],
    },
    {
        nome: 'Talismã Profano', icone: '💀', ordem: 11,
        descricao: 'O Adepto rasga o véu com o Talismã erguido. Sem ele, a Sétima Camada não responde.',
        itemTags: ['Talismã Profano'],
        vds: ['Convocar', 'Vozes do Túmulo', 'Controle da Ruína', 'Contato Necromântico', 'Fragmento de Identidade'],
    },
    {
        nome: 'Talismã Abissal', icone: '🕳️', ordem: 12,
        descricao: 'O Invocador precisa de âncora para o que puxa do Abismo. O Talismã é a âncora.',
        itemTags: ['Talismã Abissal'],
        vds: ['Contato Abismântico', 'Selo'],
    },
    {
        nome: 'Símbolo Sagrado', icone: '☀️', ordem: 13,
        descricao: 'A Graça de Palla passa pelo Símbolo. O Pallacerdote que o perde reza sem canal.',
        itemTags: ['Símbolo'],
        vds: ['Bênção', 'Súplica', 'Reconsagração', 'Exorcismo Menor', 'Peregrinação do Amanhecer', 'Cura de Nexo Menor'],
    },
    {
        nome: 'Tomo Rúnico', icone: '📖', ordem: 14,
        descricao: 'A runa se lê antes de se gravar. O Runimago trabalha com o Tomo aberto.',
        itemTags: ['Tomo'],
        vds: ['Diagnóstico Rúnico', 'Gravação Rúnica'],
        aviso: 'O Cartucho Rúnico ainda não tem itens pré-definidos com coluna de '
            + 'forma de conjurar, então esta Forma fica pronta mas inerte até lá.',
    },
];

/* Índices por nome */
const [dvSnap, eqSnap, jaSnap] = await Promise.all([
    db.collection('system/data/derivedValues').get(),
    db.collection('system/data/equipment').get(),
    db.collection('system/data/castingForms').get(),
]);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const dvPorNome = new Map(dvSnap.docs.map(d => [norm(d.data().nome), d.id]));
const jaExiste = new Set(jaSnap.docs.map(d => norm(d.data().nome)));
const itensComTag = (tag) => eqSnap.docs
    .filter(d => (d.data().tags || []).some(t => norm(t) === norm(tag)))
    .map(d => d.data().nome);

let criadas = 0, puladas = 0;
for (const f of FORMAS) {
    if (jaExiste.has(norm(f.nome))) { console.log(`⏭️  "${f.nome}" já existe — não duplico`); puladas++; continue; }

    const ids = [], faltando = [];
    for (const nome of f.vds) {
        const id = dvPorNome.get(norm(nome));
        if (id) ids.push(id); else faltando.push(nome);
    }
    const itens = f.itemTags.flatMap(itensComTag);

    console.log(`\n${f.icone} ${f.nome}`);
    console.log(`   exige item com tag ${JSON.stringify(f.itemTags)} → ${itens.length} item(ns): ${itens.slice(0, 5).join(', ')}${itens.length > 5 ? '…' : ''}`);
    console.log(`   cobre ${ids.length} Valor(es) Derivado(s): ${f.vds.filter(n => dvPorNome.get(norm(n))).join(', ')}`);
    if (faltando.length) console.log(`   ⚠️ VD não encontrado no registro: ${faltando.join(', ')}`);
    if (!itens.length) { console.log('   ❌ NENHUM equipamento tem essa tag — a Forma travaria a classe. Pulando.'); puladas++; continue; }
    if (!ids.length) { console.log('   ❌ nenhum VD resolvido — a Forma nunca seria encontrada. Pulando.'); puladas++; continue; }
    if (f.aviso) console.log(`   ℹ️ ${f.aviso}`);

    if (APLICAR) {
        await db.collection('system/data/castingForms').add({
            nome: f.nome, icone: f.icone, descricao: f.descricao, ordem: f.ordem,
            requisito: 'item_tag', itemTags: f.itemTags,
            partesDoCorpoNomes: [], condicoesBloqueiam: [],
            derivedValueIds: ids,
            publicado: true, criadoEm: new Date(),
        });
    }
    criadas++;
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${criadas} Forma(s), ${puladas} pulada(s)`);
console.log('\nSangral e Druida ficaram de fora de propósito: o Sangral tira do próprio');
console.log('sangue e o Ferinismo depende do ANIMAL, não de um objeto de bolso.');
process.exit(0);
