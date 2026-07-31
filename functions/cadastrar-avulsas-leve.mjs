/**
 * Linha Leve avulsa — 4 peças que dão à faixa Leve um teto visível na mesa.
 *
 * O problema: com a Armadura Leve em 4 slots (0,80), nenhuma cobertura Leve
 * passava de 1 depois do arredondamento. A faixa existia no catálogo e não
 * existia no jogo.
 *
 * A solução NÃO é uma linha Leve completa de 13 slots. Um conjunto Leve cheio
 * daria 2,60, que arredonda pro mesmo 2 do conjunto Médio (2,86) — e como Leve
 * é a classe sem penalidade, a Média morreria. A linha cobre só Cabeça, Pescoço,
 * Braço e Cintura, o que faz o MÁXIMO Leve possível ser:
 *
 *   Armadura Leve (4 slots, 0,80) + as 4 avulsas (5 slots, 1,00) = 1,80
 *
 * 1,80 arredonda pra 1. Então cada classe passa a ter um teto próprio na mesa:
 * Leve chega a 1, Média a 2, Pesada a 3. Pernas e Pé ficam de fora de propósito
 * — é o que segura o teto.
 *
 *   node functions/cadastrar-avulsas-leve.mjs            (dry-run)
 *   node functions/cadastrar-avulsas-leve.mjs --apply
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const TAXA_LEVE = 0.20;
const DONO = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const PECAS = [
    { nome: 'Capuz Acolchoado',    slot: 'Cabeça',  pares: 0, peso: 1, preco: 900, furt: -1,
      descricao: 'Capuz de linho em várias camadas costuradas, atado sob o queixo. Abafa o som do mundo tanto quanto o golpe.' },
    { nome: 'Gola de Couro',       slot: 'Pescoço', pares: 0, peso: 1, preco: 400,
      descricao: 'Colar rígido de couro cru que impede a lâmina de encontrar a garganta de raspão.' },
    { nome: 'Mangas Acolchoadas',  slot: 'Braço',   pares: 1, peso: 1, preco: 800, des: -1, furt: -1,
      descricao: 'Par de mangas de estofo amarradas ao ombro. Engrossam o braço e tiram a soltura do pulso.' },
    { nome: 'Cinta Acolchoada',    slot: 'Cintura', pares: 0, peso: 1, preco: 400,
      descricao: 'Faixa larga de estofo enrolada na cintura, presa por tiras de couro.' },
];

/* Slots deixados de fora da linha Leve, e por quê. */
const FORA = {
    'Pernas e Pé': 'é o que segura o teto da faixa em 1,80. Com eles a Leve chegaria a 2,60 e '
        + 'atropelaria o conjunto Médio (2,86), que arredonda pro mesmo 2 e ainda paga penalidade.',
    'Torso, Costas e Ombro': 'a Armadura Leve já cobre os 4 por 1.200 — peça avulsa aqui seria variação inútil.',
    'Mão': 'slot de arma e escudo; o Broquel entrega 0,30 por 200 sem penalidade e domina qualquer luva.',
};

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, dvs, bp, skills] = await Promise.all(['equipment', 'derivedValues', 'bodyParts', 'skills'].map(grab));
const idPor = (col, nome) => {
    const d = col.find(x => x.nome === nome);
    if (!d) throw new Error(`não achei "${nome}" no Firestore`);
    return d.id;
};
const BL = idPor(dvs, 'Blindagem');
const FURT = idPor(skills, 'Furtividade');
const PARTE = n => idPor(bp, n);
const item = n => {
    const e = eq.find(x => (x.nome || '').trim() === n);
    if (!e) throw new Error(`item "${n}" não está no catálogo`);
    return e;
};
const blDe = e => (e.valoresDerivadosVinculados || []).find(v => v.id === BL)?.modificador ?? 0;
const slotsDe = e => 1 + (e.slotsAdicionais || []).reduce((a, s) => a + s.quantidade, 0);
const penDe = e => ({
    des: (e.atributosVinculados || []).find(a => a.id === 'attr_des')?.modificador ?? 0,
    furt: (e.periciasVinculadas || []).find(p => p.id === FURT)?.modificador ?? 0,
});
const num = n => n.toFixed(2).replace('.', ',');
const penTxt = t => [t.des && `DES ${t.des}`, t.furt && `Furt ${t.furt}`].filter(Boolean).join(' · ') || '—';
const golpes = bl => 24 / Math.max(1, 7.5 - Math.floor(bl));

const novos = PECAS.map(p => {
    const extras = p.pares ? { [p.slot]: p.pares } : {};
    const slots = 1 + Object.values(extras).reduce((a, b) => a + b, 0);
    const bl = Math.round(TAXA_LEVE * slots * 100) / 100;
    return {
        p, slots, bl,
        jaExiste: eq.find(x => (x.nome || '').trim() === p.nome),
        doc: {
            nome: p.nome, tipo: 'Vestimenta', descricao: p.descricao,
            categoriaArma: null, formaEquipar: 'vestir',
            equipavelEm: [PARTE(p.slot)],
            slotsAdicionais: Object.entries(extras).map(([n, q]) => ({ id: PARTE(n), quantidade: q })),
            peso: p.peso, tamanho: p.peso, formulaDano: '', liga: '1', preco: p.preco,
            pressaoBase: null, multiplicadorPressao: null, quantidade: null,
            ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
            mecanicaIds: [], imagemUrl: '',
            tags: ['Avulsa', 'Leve', 'Armadura'],
            valoresDerivadosVinculados: [{ id: BL, modificador: bl }],
            atributosVinculados: p.des ? [{ id: 'attr_des', modificador: p.des }] : [],
            periciasVinculadas: p.furt ? [{ id: FURT, modificador: p.furt }] : [],
            publicado: true, versao: 1, criadoPor: DONO,
            criadoEm: new Date(), atualizadoEm: new Date(),
        },
    };
});

console.log('\n=== 1. PEÇAS NOVAS ===\n');
console.log('  peça                  slot      slots    Bl   peso   preço  penalidade');
for (const n of novos) {
    console.log(`  ${n.p.nome.padEnd(21)} ${n.p.slot.padEnd(8)} ${String(n.slots).padStart(4)}   ${num(n.bl)}   ${String(n.p.peso).padStart(4)}   ${String(n.p.preco).padStart(5)}  ${penTxt({ des: n.p.des || 0, furt: n.p.furt || 0 })}`);
    if (n.jaExiste) console.log(`      ⚠ JÁ EXISTE (id ${n.jaExiste.id})`);
}

// --- o máximo Leve possível ------------------------------------------------
const armLeve = item('Armadura Leve');
const pilha = {
    slots: slotsDe(armLeve) + novos.reduce((a, n) => a + n.slots, 0),
    bl: Math.round((blDe(armLeve) + novos.reduce((a, n) => a + n.bl, 0)) * 100) / 100,
    peso: armLeve.peso + novos.reduce((a, n) => a + n.p.peso, 0),
    preco: armLeve.preco + novos.reduce((a, n) => a + n.p.preco, 0),
    pen: {
        des: penDe(armLeve).des + novos.reduce((a, n) => a + (n.p.des || 0), 0),
        furt: penDe(armLeve).furt + novos.reduce((a, n) => a + (n.p.furt || 0), 0),
    },
};

console.log('\n=== 2. O MÁXIMO LEVE POSSÍVEL (Armadura Leve + as 4) ===\n');
console.log('  conjunto            slots    Bl   na mesa   peso   preço  penalidade');
const linha = (nome, o) => console.log(`  ${nome.padEnd(19)} ${String(o.slots).padStart(4)}   ${num(o.bl)}      ${Math.floor(o.bl)}   ${String(o.peso).padStart(4)}   ${String(o.preco).padStart(5)}  ${penTxt(o.pen)}`);
linha('pilha Leve', pilha);
for (const n of ['Cota de Malha', 'Couro Reforçado']) {
    const e = item(n);
    linha(n, { slots: slotsDe(e), bl: blDe(e), peso: e.peso, preco: e.preco, pen: penDe(e) });
}
console.log(`\n  janela letal: ${golpes(blDe(armLeve)).toFixed(1)} golpes (só a Armadura Leve) -> ${golpes(pilha.bl).toFixed(1)} golpes (pilha completa)`);

console.log('\n=== 3. TETO DE CADA CLASSE NA MESA ===\n');
const tetos = [
    ['Leve  (pilha completa)', pilha.bl],
    ['Média (conjunto avulso)', Math.round(0.22 * 13 * 100) / 100],
    ['Pesada (conjunto avulso)', Math.round(0.30 * 13 * 100) / 100],
];
for (const [n, bl] of tetos) console.log(`  ${n.padEnd(26)} ${num(bl)}  ->  a mesa usa ${Math.floor(bl)}`);

console.log('\n=== 4. SLOTS DEIXADOS DE FORA ===\n');
for (const [k, v] of Object.entries(FORA)) console.log(`  ${k}: ${v}`);

console.log('\n=== 5. INVARIANTES ===\n');
const checa = (r, fn) => { fn(); console.log(`  ✔ ${r}`); };
checa('nenhuma peça duplicada', () => assert(!novos.some(n => n.jaExiste)));
checa('Blindagem de cada peça = 0,20 × slots', () =>
    novos.forEach(n => assert.equal(n.bl, Math.round(TAXA_LEVE * n.slots * 100) / 100)));
checa('a pilha Leve passa de 0 na mesa — a faixa deixa de ser inerte', () =>
    assert(Math.floor(pilha.bl) >= 1, `pilha em ${num(pilha.bl)}`));
checa('e não alcança o 2 da Média — cada classe tem seu teto', () =>
    assert(Math.floor(pilha.bl) < Math.floor(0.22 * 13), `pilha em ${num(pilha.bl)}`));
checa('pilha Leve não domina a Cota de Malha (paga em preço e peso)', () => {
    const m = item('Cota de Malha');
    assert(pilha.preco > m.preco, 'tinha que custar mais');
    assert(pilha.peso > m.peso, 'tinha que pesar mais');
    assert(pilha.pen.furt <= penDe(m).furt, 'Furtividade não pode ser melhor que a da Malha');
});
checa('nenhum nome novo usa "Reforçado"', () =>
    novos.forEach(n => assert(!/refor[çc]ad/i.test(n.p.nome), n.p.nome)));
checa('Pernas e Pé continuam sem peça Leve — é o que segura o teto', () =>
    novos.forEach(n => assert(!['Pernas', 'Pé'].includes(n.p.slot), n.p.nome)));

if (!APPLY) { console.log(`\nDRY-RUN — ${novos.length} peças. Rode com --apply.\n`); process.exit(); }

const lote = db.batch();
novos.forEach(n => lote.set(db.collection('system/data/equipment').doc(), n.doc));
await lote.commit();
console.log(`\n✔ ${novos.length} peças Leve avulsas criadas.\n`);
process.exit();
