/**
 * Cadastra o roster de ingredientes da Alquimancia — 23 itens novos + arruma a
 * Babosa (propriedade sai da descrição solta e vira tag padronizada).
 *
 * Antes disto o sistema não rodava: as receitas exigem "Toxis 2" e NENHUM item
 * do catálogo carregava propriedade alquímica.
 *
 * Convenções:
 *  - propriedade em TAG, no formato exato das receitas: "Toxis 2", "Vitalis 1"
 *  - canal de Essência em tag "Canal: <Essência>" (dano tipado na loção)
 *  - raridade pela soma das potências (espec §6): 1 comum · 2 incomum ·
 *    3 raro · 4+ expedição. Preço-âncora: loção pronta = 120–140 L$.
 *  - plantas reais e de folclore, sem plágio (autorizado pelo dono do mundo);
 *    único nome derivado de cânone: Fungo-do-Véu (do Véu Terreno, Necromancia)
 *
 * ASSERT RODÁVEL: as 8 receitas cadastradas têm que ser cozinháveis com este
 * roster, respeitando variedade mínima e repetição. Se não fecharem, aborta.
 *
 *   node functions/cadastrar-ingredientes-alquimia.mjs            (dry-run)
 *   node functions/cadastrar-ingredientes-alquimia.mjs --apply
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
const SLOT_MAO = '6r4QB7jnlln8WpehKzS4';   // mesmo slot da Babosa

/* nome · props {Propriedade: potência} · canal · preço · desc */
const ROSTER = [
    // ── comuns (soma 1) — mercado, 5–10 L$ ─────────────────────────────────
    { nome: 'Confrei', props: { Vitalis: 1 }, preco: 8,
      desc: 'A erva-dos-ossos: folha áspera que os físicos amarram sobre fratura. Fecha o que está aberto.' },
    { nome: 'Arruda', props: { Caltra: 1 }, preco: 6,
      desc: 'Amarga, de cheiro que espanta. Toda benzedeira tem um pé na porta — limpa veneno, praga e mau agouro, diz o povo. O veneno, pelo menos, é verdade.' },
    { nome: 'Losna', props: { Toxis: 1 }, preco: 6,
      desc: 'O amargor feito planta. Em dose de taverna, aperitivo; em dose de boticário, o começo de um fim discreto.' },
    { nome: 'Papoula-Parda', props: { Metanox: 1 }, preco: 10,
      desc: 'A flor do sono pesado. O leite da cápsula entorpece dor, medo e pressa — e cobra juros de quem volta sempre.' },
    { nome: 'Urtiga', props: { Dissolvix: 1 }, preco: 5,
      desc: 'Queima ao toque e queima melhor macerada. O ácido humilde das cercas vivas.' },
    { nome: 'Hortelã-Brava', props: { Metabolis: 1 }, preco: 6,
      desc: 'Acorda a boca, acorda o sangue. Mascada antes da marcha, rende uma légua a mais.' },
    { nome: 'Aroeira', props: { Dissolvix: 1 }, preco: 7,
      desc: 'A árvore que morde: a seiva empola a pele de quem dorme à sua sombra. Corrói devagar e sem perdão.' },
    { nome: 'Sal-Gema', props: { Caltra: 1 }, preco: 5, mineral: true,
      desc: 'O cristal humilde que preserva carne, couro e cadáver. Moído em loção, purga e conserva. Ver o Compêndio de Cristalomancia.' },
    // ── incomuns (soma 2) — herborista, 25–60 L$ ───────────────────────────
    { nome: 'Cicuta', props: { Toxis: 2 }, preco: 40,
      desc: 'O veneno dos filósofos: mata de baixo para cima, frio e educado. Base clássica da Loção de Veneno Simples.' },
    { nome: 'Mandrágora', props: { Metanox: 2 }, preco: 55,
      desc: 'Raiz em forma de gente, colhida com corda, cão e ouvidos tapados — o grito, dizem, derruba. Seca e moída, entorpece como pouca coisa entorpece.' },
    { nome: 'Beladona', props: { Sentinox: 1, Toxis: 1 }, preco: 45,
      desc: 'A bela-dama: abre as pupilas até o mundo virar luz demais, e envenena com a mesma doçura. As cortesãs a usavam; as viúvas também.' },
    { nome: 'Visco', props: { Vitalis: 1, Caltra: 1 }, preco: 50,
      desc: 'A planta que vive sem chão, colhida de foice em carvalho velho. Os druidas a chamam de tudo-cura. Exageram — mas não muito.' },
    { nome: 'Dedaleira', props: { Metabolis: 2 }, preco: 45,
      desc: 'Sinos roxos que aceleram o coração até o galope — ou até a parada. A diferença entre remédio e veneno está na dosagem, e a dedaleira é o exemplo da regra.' },
    { nome: 'Sangue-de-Dragão', props: { Regebolis: 2 }, preco: 60,
      desc: 'Resina vermelha que verte de árvore ferida e seca em lágrimas. Sobre a chaga, o corpo lembra como se refazer.' },
    { nome: 'Valeriana', props: { Metanox: 1, Sentinox: 1 }, preco: 35,
      desc: 'Raiz fétida do sono sem sonho. Embota o corpo e embaça o olho — o ladrão a sopra no estábulo antes do serviço.' },
    { nome: 'Fungo-do-Véu', props: { Toxis: 1 }, canal: 'Necrótico', preco: 60,
      desc: 'Cresce em catacumba funda, onde o Véu Terreno é fino. O chapéu cinza solta um pó que fere também no canal Necrótico — veneno que armadura nenhuma conhece.' },
    { nome: 'Cinábrio', props: { Toxis: 2 }, mineral: true, preco: 60,
      desc: 'O minério vermelho que sangra mercúrio. Veneno que não veio de planta — e que antídoto de erva custa a reconhecer. Ver o Compêndio de Cristalomancia.' },
    // ── raros (soma 3) — coleta específica, 120–250 L$ ─────────────────────
    { nome: 'Acônito', props: { Toxis: 2, Metanox: 1 }, preco: 180,
      desc: 'O capuz-de-monge, o matador-de-lobos. Dormência que sobe do dedo ao coração. É dele que sai o Beijo de Chumbo — e o coletor usa luva dupla.' },
    { nome: 'Sempre-Viva', props: { Vitalis: 2, Regebolis: 1 }, preco: 200,
      desc: 'A flor que não aceita murchar, colhida em campo de altitude. Guarda a teima da vida em pétala seca.' },
    { nome: 'Olho-de-Boneca', props: { Sentinox: 2, Toxis: 1 }, preco: 190,
      desc: 'Bagas brancas de pupila preta, encarando de volta. Quem as come vê o que não está lá — e deixa de ver o que está. Base do Pavor-Cego.' },
    { nome: 'Casca de Salgueiro-Branco', props: { Caltra: 2, Vitalis: 1 }, preco: 150,
      desc: 'A casca que os físicos mastigam contra febre e dor. Limpa o sangue do que não devia estar nele.' },
    // ── expedição (soma 4) — não há mercado estável ────────────────────────
    { nome: 'Rosa-de-Jericó', props: { Vitalis: 2, Regebolis: 2 }, preco: 600,
      desc: 'A planta que finge a morte por anos e revive com uma gota. Cresce onde nada mais aceita crescer. O boticário que a mói jura que ela range.' },
    { nome: 'Flor-Cadáver', props: { Toxis: 2, Sentinox: 2 }, canal: 'Necrótico', preco: 650,
      desc: 'Floresce uma noite a cada tantos anos, fedendo a carniça para chamar o que rasteja. O fedor derruba sentidos; o extrato, gente inteira.' },
];

const BABOSA_FIX = {
    nome: 'Babosa', props: { Regebolis: 1 },
    desc: 'A folha gorda que verte gel sobre a queimadura. O remédio de quem não tem boticário por perto.',
};

/* ═══ ASSERT: as 8 receitas fecham com o roster ═══ */
const RECEITAS = [
    { nome: 'Veneno Simples',      req: { Toxis: 2 },              variedade: 1, repetir: true },
    { nome: 'Entorpecente',        req: { Metanox: 2 },            variedade: 1, repetir: true },
    { nome: 'Corrosiva',           req: { Dissolvix: 2 },          variedade: 2, repetir: false },
    { nome: 'Ilusória',            req: { Sentinox: 2 },           variedade: 1, repetir: true },
    { nome: 'Cura Rápida',         req: { Vitalis: 1, Regebolis: 1 }, variedade: 1, repetir: true },
    { nome: 'Antídoto',            req: { Caltra: 2 },             variedade: 1, repetir: true },
    { nome: 'Estímulo',            req: { Metabolis: 2 },          variedade: 1, repetir: true },
    { nome: 'Regeneração',         req: { Regebolis: 2 },          variedade: 1, repetir: true },
];
const fontes = [...ROSTER, BABOSA_FIX];
for (const r of RECEITAS) {
    for (const [prop, pot] of Object.entries(r.req)) {
        const donos = fontes.filter(f => (f.props[prop] || 0) > 0);
        const melhor = Math.max(0, ...donos.map(f => f.props[prop]));
        const alcancavel = r.repetir
            ? melhor * 2 >= pot || melhor >= pot
            : donos.length >= r.variedade && donos.slice(0).sort((a, b) => b.props[prop] - a.props[prop])
                .slice(0, Math.max(r.variedade, 2)).reduce((s, f) => s + f.props[prop], 0) >= pot;
        assert.ok(alcancavel, `${r.nome}: ${prop} ${pot} não é alcançável com o roster`);
        if (!r.repetir) assert.ok(donos.length >= r.variedade,
            `${r.nome}: exige ${r.variedade} fontes diferentes de ${prop}, há ${donos.length}`);
    }
}
assert.ok(fontes.length >= 24, 'roster mínimo de 24 fontes');
assert.ok(fontes.filter(f => Object.values(f.props).reduce((a, b) => a + b, 0) === 1).length >= 8, 'base comum larga');
console.log(`✅ ${RECEITAS.length + 2} asserts passaram — as 8 receitas fecham com o roster.\n`);

/* ═══ PLANO ═══ */
const col = db.collection('system/data/equipment');
const eq = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const nomes = new Set(eq.map(i => i.nome));
const colisoes = ROSTER.filter(r => nomes.has(r.nome));
const babosa = eq.find(i => i.nome === 'Babosa');

const tagsDe = f => ['Matéria', 'Ingrediente',
    ...Object.entries(f.props).map(([p, n]) => `${p} ${n}`),
    ...(f.canal ? [`Canal: ${f.canal}`] : []),
    ...(f.mineral ? ['Mineral'] : [])];
/* Canal de Essência conta +1 na raridade: dano tipado que ignora a armadura
   comum não se vende na feira, mesmo que a potência bruta seja 1. */
const somaDe = f => Object.values(f.props).reduce((a, b) => a + b, 0) + (f.canal ? 1 : 0);
const RARIDADE = { 1: 'comum', 2: 'incomum', 3: 'raro', 4: 'expedição' };

console.log('=== Roster de ingredientes ===\n');
for (const f of ROSTER) {
    console.log(`  ${(f.nome).padEnd(26)} ${Object.entries(f.props).map(([p, n]) => `${p} ${n}`).join(' · ').padEnd(24)} ` +
        `${(f.canal ? `Canal ${f.canal} · ` : '')}${RARIDADE[Math.min(somaDe(f), 4)].padEnd(9)} ${String(f.preco).padStart(3)} L$`);
}
console.log(`\n  + Babosa atualizada: descrição "regebolis 1" vira tags ${JSON.stringify(tagsDe(BABOSA_FIX).slice(0, 3))}`);
console.log(`  ${ROSTER.length} itens novos · preço-âncora: loção pronta 120–140 L$`);
if (colisoes.length) { console.error(`\n🔴 ABORTADO: já existem no catálogo: ${colisoes.map(c => c.nome).join(', ')}`); process.exit(1); }
if (!babosa) { console.error('\n🔴 ABORTADO: Babosa não encontrada.'); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
for (const f of ROSTER) {
    batch.set(col.doc(), {
        nome: f.nome, tipo: 'Objeto', tags: tagsDe(f), descricao: f.desc,
        peso: f.mineral ? 0.5 : 0.1, tamanho: 1, quantidade: f.mineral ? 1 : 5,
        preco: f.preco, formaEquipar: 'segurar', equipavelEm: [SLOT_MAO],
        formulaDano: '', liga: '', pressaoBase: null, multiplicadorPressao: null,
        ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
        mecanicaIds: [], imagemUrl: '', publicado: true, versao: 1,
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora,
    });
}
batch.update(col.doc(babosa.id), {
    tags: tagsDe(BABOSA_FIX), descricao: BABOSA_FIX.desc, preco: 8,
    atualizadoEm: agora, versao: (babosa.versao || 1) + 1,
});
await batch.commit();
console.log(`\n✅ ${ROSTER.length} ingredientes cadastrados + Babosa padronizada.`);
process.exit(0);
