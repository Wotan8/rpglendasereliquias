/**
 * Cadastra a linha à la carte de armadura (peças avulsas por slot) e fecha os
 * dois preços que faltavam (Armadura Leve, Manto de Linho).
 *
 *   Blindagem = taxa(classe) × slots cobertos      (mesmo modelo de recalibrar-blindagem.mjs)
 *
 * Os asserts do fim são o teste: se um conjunto completo deixar de fechar em
 * 13 slots, na Blindagem da armadura de corpo equivalente, na penalidade dela
 * ou na faixa de preço da regra B, o script morre antes de gravar.
 *
 *   node functions/cadastrar-avulsas-armadura.mjs            (dry-run)
 *   node functions/cadastrar-avulsas-armadura.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const TAXA = { 'Leve': 0.15, 'Média': 0.22, 'Pesada': 0.30 };
const DONO = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';   // mesmo criadoPor do resto do catálogo

/* Pares (Ombro, Braço, Pernas, Pé) são UMA peça que toma os 2 slots — ficção
   (um par de grevas) e regra E (2 slots = 0,60 na Pesada, chega perto de
   importar sozinho; 1 slot = 0,30, arredonda pra zero e nunca importa). */
const PECAS = [
    // ---- Pesada (0,30/slot): 13 slots, o conjunto fecha sozinho -------------
    // Cabeça/Pernas/Pé levam a maior parte do preço: são os slots que as
    // armaduras de corpo não alcançam, então é onde o pedaço avulso vale caro.
    { nome: 'Elmo de Placas',         classe: 'Pesada', slot: 'Cabeça',  pares: 0, peso: 1, preco: 5000, des: -1, furt: -1,
      descricao: 'Elmo fechado de placas com viseira articulada. Peça mais exigente que um ferreiro faz: a visão custa o que a proteção paga.' },
    { nome: 'Gorjal de Aço',          classe: 'Pesada', slot: 'Pescoço', pares: 0, peso: 1, preco: 1000, furt: -1,
      descricao: 'Colar de placas sobrepostas que fecha a garganta entre o elmo e a couraça.' },
    { nome: 'Ombreiras de Placas',    classe: 'Pesada', slot: 'Ombro',   pares: 1, peso: 1, preco: 2000,
      descricao: 'Par de espaldares afivelados sobre os ombros, articulados para não travar o braço.' },
    { nome: 'Braçadeiras de Placas',  classe: 'Pesada', slot: 'Braço',   pares: 1, peso: 1, preco: 2200, des: -1,
      descricao: 'Par de canhões de braço com cotoveleira. Protegem o antebraço ao custo da soltura do golpe.' },
    { nome: 'Couraça de Placas',      classe: 'Pesada', slot: 'Torso',   pares: 0, extras: { 'Costas': 1 }, peso: 2, preco: 3800, furt: -1,
      descricao: 'Peito e espaldar de placa fechados nas laterais. A entrada avulsa em armadura pesada.' },
    { nome: 'Faldar de Placas',       classe: 'Pesada', slot: 'Cintura', pares: 0, peso: 1, preco: 1000,
      descricao: 'Lâminas de aço em cinta sobre os quadris, penduradas da couraça ou do próprio cinto.' },
    { nome: 'Grevas de Placas',       classe: 'Pesada', slot: 'Pernas',  pares: 1, peso: 1, preco: 5000, des: -1, furt: -1, desloc: -1,
      descricao: 'Par de grevas com joelheira cobrindo coxa e canela. Peso na perna é passo mais curto.' },
    { nome: 'Escarpes de Placas',     classe: 'Pesada', slot: 'Pé',      pares: 1, peso: 1, preco: 4000, furt: -1, desloc: -1,
      descricao: 'Par de sapatos de placas lamelares sobre o pé inteiro. Não se anda calado com eles.' },

    // ---- Média (0,22/slot): 9 slots. Torso, Costas e Ombro já têm peça média
    //      de 4 slots (Couro Reforçado, 1.500) — couraça e ombreira médias
    //      seriam variação inútil, então a linha começa no que falta.
    { nome: 'Coifa de Malha',         classe: 'Média',  slot: 'Cabeça',  pares: 0, peso: 1, preco: 1600, furt: -1,
      descricao: 'Capuz de malha de anéis sobre acolchoado. Cobre o crânio sem fechar o rosto.' },
    { nome: 'Gorjal de Malha',        classe: 'Média',  slot: 'Pescoço', pares: 0, peso: 1, preco: 500,
      descricao: 'Aventail de anéis pendurado na coifa, fechando a nuca e a garganta.' },
    { nome: 'Braçadeiras de Couro',   classe: 'Média',  slot: 'Braço',   pares: 1, peso: 1, preco: 900,
      descricao: 'Par de braçadeiras de couro cozido com tiras de metal embutidas.' },
    { nome: 'Cinturão Rebitado',      classe: 'Média',  slot: 'Cintura', pares: 0, peso: 1, preco: 500,
      descricao: 'Cinta larga de couro batido com placas rebitadas por dentro.' },
    { nome: 'Calças de Malha',        classe: 'Média',  slot: 'Pernas',  pares: 1, peso: 1, preco: 1900, des: -1, furt: -1,
      descricao: 'Par de chausses de malha amarradas ao cinto, cobrindo coxa e canela.' },
    { nome: 'Botas Ferradas',         classe: 'Média',  slot: 'Pé',      pares: 1, peso: 1, preco: 1600, furt: -1,
      descricao: 'Par de botas de couro grosso com biqueira e canela em placa de ferro.' },
];

/* Preços a corrigir no catálogo antigo.
   Os dois primeiros estavam ausentes — calibrados pela eficiência da faixa Leve
   (Bl por 1.000): Gibão 1,00 · Couro Leve 0,75 · Couro Batido 0,56.
   A Meia-Armadura sobe porque ela entrega Cabeça e Pescoço por 6.500: era a rota
   mais barata pra 3,90 de Blindagem (16.500, 18% abaixo do Torneio, e ainda com
   menos penalidade). A 9.000 nenhuma rota mista fica 10% abaixo do Torneio. */
const PRECOS = { 'Armadura Leve': 1200, 'Manto de Linho': 400, 'Meia-Armadura': 9000 };

/* Conjuntos completos a validar: 13 slots cada, comparados com a armadura de
   corpo equivalente em Blindagem, peso, preço e penalidade. */
const CONJUNTOS = {
    Pesada: { avulsas: PECAS.filter(p => p.classe === 'Pesada').map(p => p.nome), base: [], corpo: 'Armadura de Torneio' },
    Média: { avulsas: PECAS.filter(p => p.classe === 'Média').map(p => p.nome), base: ['Couro Reforçado'], corpo: null },
};

// --- leitura ---------------------------------------------------------------
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, bp, skills] = await Promise.all(['equipment', 'derivedValues', 'bodyParts', 'skills'].map(grab));
const idPor = (col, nome) => {
    const d = col.find(x => x.nome === nome);
    if (!d) throw new Error(`não achei "${nome}" no Firestore`);
    return d.id;
};
const BL = idPor(dvs, 'Blindagem');
const DESLOC = idPor(dvs, 'Desloc. Terrestre');
const FURT = idPor(skills, 'Furtividade');
const PARTE = nome => idPor(bp, nome);
const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const penDe = e => ({
    des: (e.atributosVinculados || []).find(a => a.id === 'attr_des')?.modificador ?? 0,
    furt: (e.periciasVinculadas || []).find(p => p.id === FURT)?.modificador ?? 0,
    desloc: (e.valoresDerivadosVinculados || []).find(v => v.id === DESLOC)?.modificador ?? 0,
});
const item = nome => {
    const e = eq.find(x => (x.nome || '').trim() === nome);
    if (!e) throw new Error(`item "${nome}" não está no catálogo`);
    return e;
};

/* Aplica os preços novos EM MEMÓRIA antes de qualquer conta: as rotas mistas da
   seção 4 e os asserts têm que enxergar a Meia-Armadura a 9.000, não a 6.500. */
const patchesPreco = Object.entries(PRECOS).map(([nome, preco]) => {
    const e = item(nome);
    const antes = e.preco;
    e.preco = preco;
    return { e, preco, antes };
});

// --- monta os docs ---------------------------------------------------------
const novos = PECAS.map(p => {
    const extras = { ...(p.extras || {}) };
    if (p.pares) extras[p.slot] = p.pares;          // par = principal + 1 do mesmo tipo
    const slots = 1 + Object.values(extras).reduce((a, b) => a + b, 0);
    const bl = Math.round(TAXA[p.classe] * slots * 100) / 100;

    const vds = [{ id: BL, modificador: bl }];
    if (p.desloc) vds.push({ id: DESLOC, modificador: p.desloc });

    const doc = {
        nome: p.nome,
        tipo: 'Vestimenta',
        descricao: p.descricao,
        categoriaArma: null,
        formaEquipar: 'vestir',
        equipavelEm: [PARTE(p.slot)],
        slotsAdicionais: Object.entries(extras).map(([n, q]) => ({ id: PARTE(n), quantidade: q })),
        peso: p.peso,
        tamanho: p.peso,
        formulaDano: '',
        liga: '1',
        preco: p.preco,
        pressaoBase: null,
        multiplicadorPressao: null,
        quantidade: null,
        ehContainer: false,
        capacidadeContainer: null,
        pesoMaximoContainer: null,
        mecanicaIds: [],
        imagemUrl: '',
        tags: ['Avulsa', p.classe, 'Armadura'],
        valoresDerivadosVinculados: vds,
        atributosVinculados: p.des ? [{ id: 'attr_des', modificador: p.des }] : [],
        periciasVinculadas: p.furt ? [{ id: FURT, modificador: p.furt }] : [],
        publicado: true,
        versao: 1,
        criadoPor: DONO,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
    };
    return { p, slots, bl, doc, jaExiste: eq.find(x => (x.nome || '').trim() === p.nome) };
});

// --- relatório -------------------------------------------------------------
const moeda = n => n.toLocaleString('pt-BR');
const penTxt = t => [t.des && `DES ${t.des}`, t.furt && `Furt ${t.furt}`, t.desloc && `Desloc ${t.desloc}`].filter(Boolean).join(' · ') || '—';

console.log('\n=== 1. PEÇAS NOVAS ===\n');
console.log('peça                      classe  slots    Bl   peso     preço  penalidade');
for (const n of novos) {
    const t = { des: n.p.des || 0, furt: n.p.furt || 0, desloc: n.p.desloc || 0 };
    console.log(`  ${n.p.nome.padEnd(23)} ${n.p.classe.padEnd(6)} ${String(n.slots).padStart(4)}  ${n.bl.toFixed(2)}  ${String(n.p.peso).padStart(4)}  ${moeda(n.p.preco).padStart(8)}  ${penTxt(t)}`);
    if (n.jaExiste) console.log(`      ⚠ JÁ EXISTE no catálogo (id ${n.jaExiste.id}) — seria duplicado`);
}

console.log('\n=== 2. CONJUNTO COMPLETO vs ARMADURA DE CORPO ===');
const somas = {};
for (const [classe, c] of Object.entries(CONJUNTOS)) {
    const daClasse = novos.filter(n => n.p.classe === classe);
    const bases = c.base.map(item);
    const slots = daClasse.reduce((a, n) => a + n.slots, 0)
        + bases.reduce((a, b) => a + 1 + (b.slotsAdicionais || []).reduce((x, s) => x + s.quantidade, 0), 0);
    const bl = Math.round((daClasse.reduce((a, n) => a + n.bl, 0) + bases.reduce((a, b) => a + blDe(b), 0)) * 100) / 100;
    const peso = daClasse.reduce((a, n) => a + n.p.peso, 0) + bases.reduce((a, b) => a + (b.peso || 0), 0);
    const preco = daClasse.reduce((a, n) => a + n.p.preco, 0) + bases.reduce((a, b) => a + (b.preco || 0), 0);
    const pen = ['des', 'furt', 'desloc'].reduce((o, k) => (o[k] =
        daClasse.reduce((a, n) => a + (n.p[k] || 0), 0) + bases.reduce((a, b) => a + penDe(b)[k], 0), o), {});
    somas[classe] = { slots, bl, peso, preco, pen, pecas: daClasse.length + bases.length, base: c.base };

    const alvo = c.corpo ? item(c.corpo) : null;
    console.log(`\n  --- ${classe} ---`);
    console.log(`  avulsas (${daClasse.length})${c.base.length ? ` + ${c.base.join(' + ')}` : ''}`);
    console.log(`                       slots    Bl  peso      preço  penalidade`);
    console.log(`  conjunto avulso      ${String(slots).padStart(5)}  ${bl.toFixed(2)}  ${String(peso).padStart(4)}  ${moeda(preco).padStart(9)}  ${penTxt(pen)}`);
    if (alvo) {
        const s = 1 + (alvo.slotsAdicionais || []).reduce((x, y) => x + y.quantidade, 0);
        console.log(`  ${alvo.nome.padEnd(20)} ${String(s).padStart(5)}  ${blDe(alvo).toFixed(2)}  ${String(alvo.peso).padStart(4)}  ${moeda(alvo.preco).padStart(9)}  ${penTxt(penDe(alvo))}`);
        console.log(`  → avulso custa ${((preco / alvo.preco - 1) * 100).toFixed(0)}% mais, pesa ${peso - alvo.peso} mais, mesma Bl`);
    } else {
        console.log(`  (não existe armadura de corpo Média de 13 slots — a maior é Cota de Malha, 7 slots / ${blDe(item('Cota de Malha'))})`);
    }
}

console.log('\n=== 3. EFICIÊNCIA (Bl por 1.000 moedas) — a distorção da regra B ===\n');
const eficiencia = [
    ...['Broquel', 'Gibão Acolchoado', 'Cota de Malha', 'Cota de Placas', 'Meia-Armadura', 'Armadura Completa', 'Armadura de Torneio']
        .map(n => ({ nome: n, bl: blDe(item(n)), preco: item(n).preco })),
    ...Object.entries(somas).map(([c, s]) => ({ nome: `conjunto avulso ${c}`, bl: s.bl, preco: s.preco })),
].sort((a, b) => b.bl / b.preco - a.bl / a.preco);
for (const e of eficiencia)
    console.log(`  ${e.nome.padEnd(24)} ${e.bl.toFixed(2)} / ${moeda(e.preco).padStart(7)}  =  ${(e.bl / e.preco * 1000).toFixed(2)}`);

console.log('\n=== 4. CAMINHOS MISTOS DE 13 SLOTS (armadura de corpo + avulsas) ===');
console.log('    Regra B pela borda: montar 3,90 misturando corpo + avulsa não pode sair barato demais.\n');
const achar = n => novos.find(x => x.p.nome === n) || null;
const ROTAS = [
    ['Cota de Placas', ['Elmo de Placas', 'Grevas de Placas', 'Escarpes de Placas']],
    ['Meia-Armadura', ['Faldar de Placas', 'Grevas de Placas', 'Escarpes de Placas']],
    ['Armadura Completa', ['Elmo de Placas', 'Gorjal de Aço']],
];
const torneio = item('Armadura de Torneio');
const rotas = ROTAS.map(([corpo, pecas]) => {
    const b = item(corpo);
    const ns = pecas.map(achar);
    return {
        corpo, pecas,
        slots: 1 + (b.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0) + ns.reduce((a, n) => a + n.slots, 0),
        bl: Math.round((blDe(b) + ns.reduce((a, n) => a + n.bl, 0)) * 100) / 100,
        preco: b.preco + ns.reduce((a, n) => a + n.p.preco, 0),
        pen: ['des', 'furt', 'desloc'].reduce((o, k) => (o[k] = penDe(b)[k] + ns.reduce((a, n) => a + (n.p[k] || 0), 0), o), {}),
    };
});
for (const r of rotas) {
    console.log(`  ${r.corpo} + ${r.pecas.map(p => p.replace(/ de (Placas|Aço)/, '')).join(' + ')}`);
    console.log(`     ${r.slots} slots · Bl ${r.bl.toFixed(2)} · ${moeda(r.preco)} (${((r.preco / torneio.preco - 1) * 100).toFixed(0)}% vs Torneio) · ${penTxt(r.pen)}`);
}
console.log(`  Armadura de Torneio (referência): 13 slots · Bl ${blDe(torneio).toFixed(2)} · ${moeda(torneio.preco)} · ${penTxt(penDe(torneio))}`);

console.log('\n=== 5. JANELA LETAL (golpe 1d8+FOR3 = 7,5 · Vitalidade 24 · tier 0) ===\n');
for (const [n, b] of [['nu', 0], ['Elmo de Placas só', novos.find(x => x.p.nome === 'Elmo de Placas').bl],
['conjunto Média', somas.Média.bl], ['conjunto Pesada', somas.Pesada.bl],
['conjunto Pesada + Escudo Torre', somas.Pesada.bl + blDe(item('Escudo de Torre'))]]) {
    const passa = Math.max(1, 7.5 - Math.floor(b));   // arredonda pra baixo só no total
    console.log(`  ${n.padEnd(32)} Bl ${b.toFixed(2).padStart(5)} (usa ${Math.floor(b)})  ->  ${(24 / passa).toFixed(1)} golpes`);
}

console.log('\n=== 6. PREÇOS CORRIGIDOS NO CATÁLOGO ANTIGO ===\n');
for (const { e, preco, antes } of patchesPreco)
    console.log(`  ${e.nome.padEnd(20)} ${antes ? moeda(antes) : 'ausente'} -> ${moeda(preco)}   (Bl ${blDe(e)} = ${(blDe(e) / preco * 1000).toFixed(2)} por 1.000)`);

// --- asserts: se um destes cair, nada é gravado ----------------------------
console.log('\n=== 7. INVARIANTES ===\n');
const checa = (rotulo, fn) => { fn(); console.log(`  ✔ ${rotulo}`); };

checa('nenhuma peça duplicada no catálogo', () => assert(!novos.some(n => n.jaExiste), 'peça de nome repetido'));
checa('Blindagem de cada peça = taxa × slots', () => novos.forEach(n =>
    assert.equal(n.bl, Math.round(TAXA[n.p.classe] * n.slots * 100) / 100)));
checa('conjunto completo = 13 slots nas duas classes', () =>
    Object.entries(somas).forEach(([c, s]) => assert.equal(s.slots, 13, `${c}: ${s.slots} slots`)));
checa('regra A — Bl do conjunto = taxa × 13', () =>
    Object.entries(somas).forEach(([c, s]) => assert.equal(s.bl, Math.round(TAXA[c] * 13 * 100) / 100, `${c}: ${s.bl}`)));
checa('regra B — conjunto Pesado entre 20.000 e 25.000 e acima do Torneio', () => {
    assert(somas.Pesada.preco >= 20000 && somas.Pesada.preco <= 25000, `${somas.Pesada.preco}`);
    assert(somas.Pesada.preco > torneio.preco, 'conjunto avulso não pode custar menos que o Torneio');
});
checa('regra B — conjunto Médio menos eficiente que a Cota de Malha', () => {
    const malha = item('Cota de Malha');
    assert(somas.Média.bl / somas.Média.preco < blDe(malha) / malha.preco);
});
checa('regra C — peso do conjunto Pesado ≥ Armadura de Torneio', () =>
    assert(somas.Pesada.peso >= torneio.peso, `${somas.Pesada.peso} < ${torneio.peso}`));
checa('regra D — penalidade do conjunto Pesado = a do Torneio', () =>
    assert.deepEqual(somas.Pesada.pen, penDe(torneio)));
checa('regra D — conjunto Médio (2,86) entre Cota de Placas (2,40) e Armadura Completa (3,30)', () => {
    const p = somas.Média.pen, placas = penDe(item('Cota de Placas')), completa = penDe(item('Armadura Completa'));
    assert(p.furt <= placas.furt, `Furt ${p.furt} tinha que ser pior que ${placas.furt}`);
    assert(p.des >= completa.des, `DES ${p.des} não pode ser pior que ${completa.des}`);
});
checa('regra E — peça de 1 slot Pesada arredonda pra 0 e não muda a mesa', () =>
    assert.equal(Math.floor(novos.find(n => n.p.nome === 'Elmo de Placas').bl), 0));
checa('regra F — todo par (Ombro/Braço/Pernas/Pé) é uma peça só de 2 slots', () =>
    ['Ombro', 'Braço', 'Pernas', 'Pé'].forEach(s =>
        novos.filter(n => n.p.slot === s).forEach(n => assert.equal(n.slots, 2, `${n.p.nome}`))));
checa('janela letal dos conjuntos entre 3 e 10 golpes', () =>
    Object.values(somas).forEach(s => {
        const g = 24 / Math.max(1, 7.5 - Math.floor(s.bl));
        assert(g >= 3 && g <= 10, `${g.toFixed(1)} golpes`);
    }));
checa('preços novos da faixa Leve não viram o item mais eficiente dela', () => {
    const gibao = item('Gibão Acolchoado'), teto = blDe(gibao) / gibao.preco;
    ['Armadura Leve', 'Manto de Linho'].forEach(n => assert(blDe(item(n)) / item(n).preco <= teto, n));
});
checa('regra B pela borda — nenhuma rota mista de 13 slots fica 10% abaixo do Torneio', () =>
    rotas.forEach(r => assert(r.preco >= torneio.preco * 0.9,
        `${r.corpo}: ${r.preco} (${((r.preco / torneio.preco - 1) * 100).toFixed(0)}%)`)));
checa('nenhum nome novo usa "Reforçado" — o termo é de melhoria de ferreiro', () =>
    novos.forEach(n => assert(!/refor[çc]ad/i.test(n.p.nome), n.p.nome)));

if (!APPLY) {
    console.log(`\nDRY-RUN — ${novos.length} peças novas + ${patchesPreco.length} preços. Rode com --apply.\n`);
    process.exit();
}

const lote = db.batch();
novos.forEach(n => lote.set(db.collection('system/data/equipment').doc(), n.doc));
patchesPreco.forEach(({ e, preco }) => lote.update(db.doc(`system/data/equipment/${e.id}`), { preco, atualizadoEm: new Date() }));
await lote.commit();
console.log(`\n✔ ${novos.length} peças criadas e ${patchesPreco.length} preços corrigidos — num batch só.\n`);
process.exit();
