/**
 * Xamã jogável: os Golpes do Verde, as Dádivas buffadas, e a busca fora do
 * combate.
 *
 * O DIAGNÓSTICO. O laço de combate do Xamã rendia 0,28× — o pior número do
 * sistema. Ele gastava duas Ações Padrão e 3 Energia (Buscar + Receptor) antes
 * de a Dádiva valer, e ela só rodava 3 das 5 rodadas. Sem isso, ele não tinha
 * ataque nenhum: ficava assistindo.
 *
 * TRÊS CONSERTOS
 *  1. Buscar Vestígio sai do combate. O cânone da classe já dizia que "os Ecos
 *     sem morada precisam ser chamados a cada vez" e que o Totem de Ancestral é
 *     "consagrado a um Eco específico" — quem tem o totem chega com o Eco à mão,
 *     como o Runimago chega com a runa gravada.
 *  2. As cinco Dádivas sobem. Com custo real de 2 Energia + 1 Ação = 3,00 e
 *     quatro rodadas de proveito, Braço +1/+1 rendia 0,61×. Vai a +2/+2 = 1,23×.
 *  3. GOLPES DO VERDE — cinco, um por estágio de Qualidade.
 *
 * A LORE DOS GOLPES é do dono do mundo: a Essência Verde se alimenta da Azul
 * quando alguém morre; o Xamã força a Natureza a agredir a Azul ANTES da morte.
 * Daí a identidade e a fraqueza: só fere quem está VIVO. Contra morto-vivo,
 * construto ou Eco não há Azul para morder, e o golpe não acontece — o inverso
 * exato do Adepto.
 * Condição aplicada: Imobilizado, a negativa canônica da Verde (Régua §7).
 *
 * CALIBRAGEM — a unidade encolhe com a Qualidade (§0.4): 3,445 no Q0, 2,385 no
 * Q5. Cada golpe foi medido na faixa dele, contra o teto hostil de 2,00× (§0.7).
 *
 *   node functions/xama-verde-e-dadivas.mjs            (dry-run)
 *   node functions/xama-verde-e-dadivas.mjs --apply
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
const MOD = 'mod_verde_xama';

const U = q => 3.445 - (3.445 - 2.385) * q / 5;
const med = (n, f, b) => n * (f + 1) / 2 + b;

/* Nome do Q5 vem da epígrafe canônica do capítulo de Totemancia:
   "A morte não é o fim. É o momento em que a gota retorna ao rio." */
const GOLPES = [
    { q: 1, nome: 'Toque do Húmus', ener: 1, n: 2, f: 6, b: 1, per: 1,
      alcance: 3, forma: 'nenhuma', tam: null, cond: null,
      txt: 'A terra sob o alvo lembra do que ele vai ser. 2d6+1 de dano de Natureza. Só fere alvo VIVO — onde não há Essência Azul, a Verde não tem o que morder.' },
    { q: 2, nome: 'Mordida Verde', ener: 2, n: 2, f: 8, b: 2, per: 2,
      alcance: 9, forma: 'nenhuma', tam: null, cond: { condicao: 'Imobilizado', portao: 'chance', chance: 5, alvos: 1, rodadas: 2 },
      txt: 'Raízes finas atravessam a bota e procuram o sangue quente. 2d8+2 de dano de Natureza, e o alvo fica Imobilizado por 2 rodadas (Chance 5). Só fere alvo VIVO.' },
    { q: 3, nome: 'Colheita Antecipada', ener: 3, n: 3, f: 8, b: 0, per: 3,
      alcance: 9, forma: 'nenhuma', tam: null, cond: { condicao: 'Imobilizado', portao: 'chance', chance: 7, alvos: 1, rodadas: 2 },
      txt: 'A Natureza cobra adiantado o que receberia de qualquer jeito. 3d8 de dano de Natureza, e o alvo fica Imobilizado por 2 rodadas (Chance 7). Só fere alvo VIVO.' },
    { q: 4, nome: 'A Terra Reclama', ener: 4, n: 2, f: 8, b: 0, per: 4,
      alcance: 6, forma: 'cone', tam: 6, cond: { condicao: 'Imobilizado', portao: 'chance', chance: 7, alvos: 2, rodadas: 2 },
      txt: 'O chão abre a boca num arco à sua frente. 2d8 de dano de Natureza em cone de 6m, e os atingidos ficam Imobilizados por 2 rodadas (Chance 7). Só fere alvos VIVOS.' },
    { q: 5, nome: 'Retorno ao Rio', ener: 5, n: 4, f: 10, b: 0, per: 5,
      alcance: 9, forma: 'nenhuma', tam: null, cond: { condicao: 'Imobilizado', portao: 'chance', chance: 8, alvos: 1, rodadas: 3 },
      txt: 'O Xamã não espera a gota cair: puxa o rio até ela. 4d10 de dano de Natureza, e o alvo fica Imobilizado por 3 rodadas (Chance 8). Só fere alvo VIVO. Se o alvo cair por este golpe, o Eco dele se forma na hora e pode ser buscado sem Cravar Totem novo.' },
];

/* Dádivas — o multiplicador do Receptor sobe. Braço vai de +1/+1 a +2/+2. */
const DADIVA_DE = '· BRAÇO (lutou, caçou, matou) — +1 de dano e +1 no Alvo dos seus ataques\n'
    + '· PELE (aguentou; fera de couro) — +3 de Blindagem\n'
    + '· OLHO (batedor, vigia, ave) — +2 no Alvo de ataques à distância e +2 em Observação\n'
    + '· PASSO (corria; fera veloz) — +3m de Deslocamento, +2 em Furtividade e Atletismo\n'
    + '· BOCA (orador, líder, sacerdote) — +2 no Alvo de testes sociais';
const DADIVA_PARA = '· BRAÇO (lutou, caçou, matou) — +2 de dano e +2 no Alvo dos seus ataques\n'
    + '· PELE (aguentou; fera de couro) — +5 de Blindagem\n'
    + '· OLHO (batedor, vigia, ave) — +3 no Alvo de ataques à distância e +3 em Observação\n'
    + '· PASSO (corria; fera veloz) — +6m de Deslocamento, +3 em Furtividade e Atletismo\n'
    + '· BOCA (orador, líder, sacerdote) — +3 no Alvo de testes sociais';

/* Buscar Vestígio sai do combate. */
const BUSCA_DE = 'Busca Ecos da Alma na essência verde local. Os Graus de Sucesso determinam a clareza e o poder do Eco encontrado.';
const BUSCA_PARA = 'Busca Ecos da Alma na essência verde local, FORA DE COMBATE — chamar um Eco leva o tempo que leva. '
    + 'Os Graus determinam quantos Ecos respondem (1 + Graus) e qual o melhor Estado disponível para o Mestre escolher. '
    + 'Quem carrega um Totem de Ancestral já consagrado àquele Eco dispensa a busca: ele vem junto.';

/* ═══ ASSERTS ═══ */
for (const g of GOLPES) {
    const custo = g.ener + 1;
    const dano = med(g.n, g.f, g.b);
    const alvos = g.forma === 'cone' ? 2 : 1;
    const un = dano * alvos / U(g.q) + (g.cond ? 1.32 * (g.cond.chance / 10) * Math.min(g.cond.rodadas, 5) * 0.25 : 0);
    g.razao = Math.round(un / custo * 100) / 100;
    assert.ok(g.razao >= 1.00, `${g.nome}: ${g.razao}× abaixo do piso`);
    assert.ok(g.razao <= 2.00, `${g.nome}: ${g.razao}× acima do teto hostil (§0.7)`);
    assert.ok(/VIVO/.test(g.txt), `${g.nome}: a limitação de alvo vivo é a identidade, tem que estar no texto`);
}
assert.equal(GOLPES.length, 5, 'um golpe por estágio');
assert.ok(GOLPES.every((g, i) => g.q === i + 1 && g.per === i + 1), 'portão de Totemismo acompanha o estágio');
assert.ok(GOLPES.every((g, i) => i === 0 || g.ener > GOLPES[i - 1].ener), 'custo sobe a cada estágio');
console.log(`✅ ${GOLPES.length * 3 + 3} asserts.\n`);

const [modsSnap, clsSnap] = await Promise.all(
    ['classModules', 'classes'].map(c => db.collection('system/data/' + c).get()));
const erros = [];
if (modsSnap.docs.some(d => d.id === MOD)) erros.push('módulo dos Golpes já existe');
const xama = clsSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(c => /Xam/i.test(c.nome || ''));
if (!xama) erros.push('classe Xamã não achada');
const totem = modsSnap.docs.find(d => d.id === 'mod_totem');
if (!totem) erros.push('mod_totem não achado');

const itensTotem = (totem?.data().itensPredefinidos || []).map(it => {
    if (it.nome === 'Transcendência — Receptor') {
        const t = String(it.descricao || '');
        if (!t.includes(DADIVA_DE)) { erros.push('Receptor: âncora das Dádivas não achada'); return it; }
        const novo = t.replace(DADIVA_DE, DADIVA_PARA);
        return { ...it, descricao: novo, valores: { ...(it.valores || {}), 6: novo } };
    }
    if (it.nome === 'Buscar Vestígio') {
        const t = String(it.descricao || '');
        if (!t.includes(BUSCA_DE)) { erros.push('Busca: âncora não achada'); return it; }
        const novo = t.replace(BUSCA_DE, BUSCA_PARA);
        return { ...it, descricao: novo,
                 valores: { ...(it.valores || {}), 6: novo, acao: 'Fora de combate' } };
    }
    return it;
});

console.log('=== Xamã jogável ===\n');
console.log('1. GOLPES DO VERDE — módulo novo, um por estágio de Qualidade:');
console.log('   golpe                  Totem.  custo        dano        condição              razão');
for (const g of GOLPES) {
    const c = `${g.ener} Energia`;
    console.log(`   ${g.nome.padEnd(22)} ${g.per}      ${c.padEnd(12)} ${g.n}d${g.f}${g.b ? '+' + g.b : ''}${g.forma === 'cone' ? ' cone 6m' : ''}`.padEnd(74)
        + `${(g.cond ? `Imobilizado C${g.cond.chance}/${g.cond.rodadas}r` : '—').padEnd(22)}${g.razao}×`);
}
console.log('\n2. DÁDIVAS buffadas: Braço +1/+1 → +2/+2 · Pele +3 → +5 Blindagem · Olho +2/+2 → +3/+3');
console.log('3. BUSCAR VESTÍGIO vira "Fora de combate"; Totem de Ancestral dispensa a busca.');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
batch.update(totem.ref, { itensPredefinidos: itensTotem, atualizadoEm: agora });
batch.set(db.collection('system/data/classModules').doc(MOD), {
    titulo: 'Golpes do Verde', icone: '🌿', tipo: 'lista',
    schema: [
        { key: '1', tipo: 'text', label: 'Nome:', largura: 'meio' },
        { key: '2', tipo: 'number', label: 'Perícia mínima (Totemismo):', largura: 'quarto' },
        { key: '3', tipo: 'text', label: 'Custo:', largura: 'quarto' },
        { key: '4', tipo: 'select_botao', label: 'Pagar Custo', largura: 'quarto' },
        { key: '5', tipo: 'text', label: 'Alcance:', largura: 'quarto' },
        { key: '6', tipo: 'textarea', label: 'Efeito:', largura: 'full' },
    ],
    itensPredefinidos: GOLPES.map(g => ({
        id: `pdi_verde_${g.q}`, nome: g.nome, descricao: g.txt,
        valores: { 1: g.nome, 2: g.per, 3: `${g.ener} Energia`, 5: `${g.alcance}m`, 6: g.txt, acao: 'Ação Padrão' },
        alcance: g.alcance, formaArea: g.forma, tamanhoArea: g.tam, alvosMax: g.forma === 'cone' ? 2 : 1,
        duracaoValor: 0, duracaoUnidade: 'instantaneo',
        condicoesAplicadas: g.cond ? [g.cond] : [],
        custoExpProprio: null, custoCriacaoMecanicaIds: [], custoEquipamentos: null,
    })),
    permitirCriacaoJogador: false,
    custoExpPorItem: null, custoExpLabel: '',
    custoCriacaoMecanicaId: '', custoCriacaoMecanicaIds: [],
    custoEdicaoAtivo: false, custoEdicaoMecanicaIds: [], custoRemocaoAtivo: false, custoRemocaoMecanicaIds: [],
    custoEquipamentos: null, bloqueioMecanicaIds: [], cadastrarBloqueio: false,
    limiteFixo: null, limiteMecanicaIds: [], mecanicaLimiteId: '',
    publicado: true, criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
});
batch.update(db.collection('system/data/classes').doc(xama.id), {
    modulosDaClasse: [...(xama.modulosDaClasse || []), MOD], atualizadoEm: agora,
});
await batch.commit();
console.log('\n✅ Golpes do Verde criados, Dádivas buffadas, busca fora do combate.');
process.exit(0);
