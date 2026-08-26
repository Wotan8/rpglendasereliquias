// =============================================
// LOTE 7 — 37 peças passam a guardar item (26/08/2026).
// ---------------------------------------------
// Até aqui só mochila, bolsa, aljava e caixa guardavam coisa. Kit e estojo se
// chamavam kit e não guardavam nada; roupa não tinha bolso. Cada peça recebe
// ehContainer + as quatro réguas: capacidade (pilhas, TRAVA), peso máximo (kg,
// AVISO), boca (m, TRAVA) e tags aceitas (TRAVA).
//
// multiplicadorPressao = 1 em tudo: o que está no bolso está no seu corpo, e
// só mochila boa (0,7) distribui melhor que os braços.
//
// FICAM DE FORA de propósito: armadura pesada e média (é ela que obriga a
// comprar bolsa — dar bolso apaga o custo), luvas e máscaras (sem volume) e
// totens/talismãs (foco mágico, não recipiente).
//
//   node functions/lote7-bolsos-e-estojos.mjs            (dry-run)
//   node functions/lote7-bolsos-e-estojos.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// nome do catálogo → [capacidade, pesoMax kg, boca m, tagsAceitas]
const P = {
    // ===== 1. KITS E ESTOJOS =====
    'Bolsa de Reagentes':          [6, 2,   .15, ['Ingrediente', 'Matéria', 'Insumo', 'Frasco']],
    'Bolsa de Ervas Rituais':      [6, 1.5, .15, ['Ingrediente', 'Matéria', 'Insumo']],
    'Estojo do Herborista':        [5, 2.5, .25, ['Ingrediente', 'Matéria', 'Ferramenta']],
    'Kit de Herbalismo de osso':   [5, 2,   .25, ['Ingrediente', 'Matéria', 'Ferramenta']],
    'Estojo de Campo':             [5, 2.5, .25, []],
    'Kit de Gravação Rúnica':      [5, 2,   .25, ['Consumível de bancada', 'Ferramenta', 'Insumo']],
    'Kit do Embalsamador de Valdris': [5, 2, .25, ['Ferramenta', 'Insumo', 'Ingrediente']],
    'Kit de Sobrevivência Primal': [4, 2.5, .3,  []],
    'Kit de Larápio Simples':      [3, 1,   .2,  ['Ferramenta']],
    'Kit de Primeiros Socorros':   [3, 1,   .2,  ['Insumo', 'Loção']],
    // ===== 2. ROUPAS COM BOLSO =====
    'Roupas Comuns':               [2, 1, .15, []],
    'Roupas Escuras Simples':      [2, 1, .15, []],
    'Roupas Reforçadas':           [2, 1, .15, []],
    'Colete do Jovem Artista':     [2, 1, .15, []],
    'Vestes Litúrgicas Simples':   [2, 1, .15, []],
    'Vestes Tribais Simples':      [2, 1, .15, []],
    // ===== 3. MANTOS E CAPAS (bolso interno) =====
    'Capa com Capuz Puída':        [2, 2, .2, []],
    'Manto de Patrulha':           [2, 2, .2, []],
    'Manto do Viajante':           [2, 2, .2, []],
    'Manto Negro do Exílio':       [2, 2, .2, []],
    'Manto Sussurrante da Fenda':  [2, 2, .2, []],
    // ===== 4. CINTOS (o que pendura) =====
    'Cinturão Rebitado':           [3, 1.5, .2, []],
    'Cinta Acolchoada':            [3, 1.5, .2, []],
    'Faixa do Trovador Viajante':  [3, 1.5, .2, []],
    // ===== 5. ESCONDERIJOS =====
    'Botas Ferradas':              [1, 0.3, .25, ['Adaga']],
    'Chapéu do caulos':            [1, 0.2, .15, []],
    'Bengala do Patriarca':        [1, 0.5, .2,  []],
    // ===== 6. TOMOS (folha solta entre as páginas) =====
    'Grimório de Aprendiz':        [3, 0.3, .3, ['Receita', 'Documento', 'Insumo']],
    'Grimório dos Ecos Cifrados':  [3, 0.3, .3, ['Receita', 'Documento', 'Insumo']],
    'Diário de Necromancia':       [3, 0.3, .3, ['Receita', 'Documento', 'Insumo']],
    'Diário de Rituais em Branco': [3, 0.3, .3, ['Receita', 'Documento', 'Insumo']],
    'Caderno de Notas de Vasteluna': [3, 0.3, .3, ['Receita', 'Documento', 'Insumo']],
    // ===== 7. INSTRUMENTOS OCOS =====
    'Alaúde Clássico':             [2, 1, .25, []],
    'Rabeca':                      [2, 1, .25, []],
    'Tambor de Mão':               [2, 1, .25, []],
    // ===== 8. MECANISMO (a descrição já dizia) =====
    'Besta de Repetição':          [5, 1, .4, ['Virote']],
    // ===== 9. RECIPIENTE =====
    'Frascos de Dosagem de Cerâmica': [3, 1, .1, ['Loção']],
};

const snap = await db.collection('system/data/equipment').get();
const porNome = new Map();
snap.forEach(d => porNome.set((d.data().nome || '').trim(), { id: d.id, ...d.data() }));

const faltam = Object.keys(P).filter(n => !porNome.has(n));
if (faltam.length) { faltam.forEach(n => console.log(`❌ não achei no catálogo: "${n}"`)); process.exit(1); }

// o que do catálogo passaria a caber em cada um (efeito real, não promessa)
const todos = []; snap.forEach(d => todos.push(d.data()));
const cabe = (i, boca, tags) => {
    if (i.ehContainer || i.tipo === 'Container') return false;
    if ((Number(i.tamanho) || 1) > boca + 1e-9) return false;
    if (!tags.length) return true;
    return (i.tags || []).some(t => tags.some(a => a.toLowerCase() === String(t).trim().toLowerCase()));
};

console.log('Peça | tipo | cap | peso máx | boca | só aceita | itens do catálogo que entram');
let jaEra = 0;
for (const [nome, [cap, pmax, boca, tags]] of Object.entries(P)) {
    const x = porNome.get(nome);
    if (x.ehContainer) { jaEra++; }
    const n = todos.filter(i => cabe(i, boca, tags)).length;
    console.log(`${nome} | ${x.tipo} | ${cap} | ${pmax} kg | ${boca} m | ${tags.join('/') || '(tudo)'} | ${n}`);
}
console.log(`\n${Object.keys(P).length} peças · ${jaEra} já eram contêiner`);

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }
const agora = new Date().toISOString();
const batch = db.batch();
for (const [nome, [cap, pmax, boca, tags]] of Object.entries(P)) {
    batch.update(db.collection('system/data/equipment').doc(porNome.get(nome).id), {
        ehContainer: true,
        capacidadeContainer: cap,
        pesoMaximoContainer: pmax,
        tamanhoMaximoItem: boca,
        tagsAceitas: tags,
        multiplicadorPressao: 1,
        atualizadoEm: agora, updatedAt: agora,
    });
}
await batch.commit();
console.log(`\n✅ ${Object.keys(P).length} peças agora guardam item.`);
process.exit(0);
