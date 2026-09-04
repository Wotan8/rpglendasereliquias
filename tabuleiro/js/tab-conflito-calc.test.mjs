/**
 * Conta do conflito (Núcleo v2, Livro p. 5). Roda com:
 *   node tabuleiro/js/tab-conflito-calc.test.mjs
 */
import assert from 'node:assert/strict';
import { ajusteDeTamanho, TAMANHO_POR_PONTO, TAMANHO_TETO, penalidadeDuasArmas } from './tab-conflito-calc.js';
import { grausDoAtaque, golpePassa, abriuGuarda, rolarFormula, danoFinal,
         defesasLivres, custoDaDefesa, soODado, podeContraAtacar,
         precisaRolarDano } from './tab-conflito-calc.js';

// --- Graus ---
assert.equal(grausDoAtaque(7, 4), 3, 'Alvo 7, dado 4 → 3 Graus');
assert.equal(grausDoAtaque(7, 1), 9, 'crítico: Graus = Alvo + 2');
assert.equal(grausDoAtaque(7, 1, 3), 10, 'o extra do crítico vem de config/regras');
assert.equal(grausDoAtaque(7, 10), -3, 'falha crítica: Alvo − 10');
assert.equal(grausDoAtaque(12, 10), -1, 'Alvo alto no 10 ainda é falha (teto −1)');

// --- Passa ou não (o exemplo do Livro §6.4) ---
assert.equal(golpePassa(3, 2, 4), true, '3 Graus contra Aparar 2: passa');
assert.equal(golpePassa(1, 2, 6), false, '1 Grau contra Aparar 2: aparou');
assert.equal(golpePassa(2, 2, 5), true, 'empate passa (iguais OU maiores)');
assert.equal(golpePassa(9, 9, 1), true, 'crítico com Graus 9 passa uma Defesa 9');
assert.equal(golpePassa(9, 10, 1), false, '🔒 mas uma Defesa MAIOR ainda segura o crítico (Livro, p. 5)');
assert.equal(golpePassa(99, 0, 10), false, '10 nunca passa');
assert.equal(golpePassa(1, 0, 5), true, 'sem defesa declarada, qualquer sucesso passa');

// --- Abertura para contra-ataque (§6.8) ---
assert.equal(abriuGuarda(0, 5), true, 'Graus 0 abre a guarda');
assert.equal(abriuGuarda(-2, 8), true, 'Graus negativos abrem a guarda');
assert.equal(abriuGuarda(5, 10), true, '10 abre a guarda mesmo com Alvo alto');
assert.equal(abriuGuarda(1, 4), false, 'acerto raspando não abre a guarda');

// --- Fórmula de dano ---
const fixo = (v) => () => v;
assert.equal(rolarFormula('1d8+3', { rng: fixo(5) }).total, 8, '1d8+3 com dado 5');
assert.equal(rolarFormula('2d6-1', { rng: fixo(4) }).total, 7, '2d6−1 com dois 4');
assert.equal(rolarFormula('1d8+3', { critico: true }).total, 11, 'crítico: dado cheio 8+3');
assert.equal(rolarFormula('1d8', { critico: true }).dados[0], 8, 'dado cheio não rola');
assert.equal(rolarFormula('4').total, 4, 'fórmula sem dado é dano fixo');
assert.equal(rolarFormula('').total, 0, 'sem fórmula, sem dano');
assert.equal(rolarFormula('1d4', { rng: fixo(1) }).total, 1, 'mínimo do dado');
assert.equal(rolarFormula('1d6-10', { rng: fixo(2) }).total, 0, 'dano nunca fica negativo');

// --- Blindagem e o piso 1 ---
assert.equal(danoFinal(9, 2), 7, 'dano menos Blindagem');
assert.equal(danoFinal(3, 5), 1, 'Blindagem maior que o dano ainda machuca 1');
assert.equal(danoFinal(9, 2, true, true), 7, 'o Absorver saiu: argumento extra não parte nada ao meio');

// --- Rolar dano só quando há em quem cair ---
// O machado errou e a janela mesmo assim pedia "💥 Rolar 1d12+4". Dado que não
// tem alvo não se rola: a janela vai direto para o fim.
const levou = { nome: 'A', passou: true }, defendeu = { nome: 'B', passou: false };
assert.equal(precisaRolarDano('1d12+4', [levou]), true, 'alguém levou: rola');
assert.equal(precisaRolarDano('1d12+4', [defendeu]), false, 'todo mundo defendeu: não rola');
assert.equal(precisaRolarDano('1d12+4', [defendeu, levou]), true, 'basta um ter levado');
assert.equal(precisaRolarDano('', [levou]), false, 'sem fórmula não há dado, mesmo acertando');
assert.equal(precisaRolarDano('  ', [levou]), false, 'fórmula em branco também não');
assert.equal(precisaRolarDano('1d6', []), false, 'sem alvo nenhum não rola');
assert.equal(precisaRolarDano('1d6', null), false, 'lista ausente não explode');

// --- Orçamento de defesas da rodada (Livro, p. 5) ---
assert.equal(defesasLivres(), 1, 'a primeira defesa da rodada é grátis');
assert.equal(defesasLivres({ comEscudo: true }), 2, 'com escudo, a segunda também (se for Bloquear)');
assert.equal(defesasLivres({ gratis: 2, comEscudo: true, extraEscudo: 1 }), 3, 'os números vêm do cadastro');
assert.equal(defesasLivres({ gratis: 0 }), 1, 'nunca menos de uma');
assert.equal(custoDaDefesa(0, 1), 0, 'primeira defesa é grátis');
assert.equal(custoDaDefesa(1, 2), 0, 'a última grátis ainda é grátis');
assert.equal(custoDaDefesa(1, 1), 1, 'acabaram as grátis: 1 Energia');
assert.equal(custoDaDefesa(9, 1, 2), 2, 'o custo da extra também é do cadastro');

// --- Duas armas (Livro, p. 5) ---
assert.equal(penalidadeDuasArmas(0), -3, 'sem o Dom: −3');
assert.equal(penalidadeDuasArmas(1), -2, 'Ambidestria 1 tira 1');
assert.equal(penalidadeDuasArmas(3), 0, 'Ambidestria 3 zera');
assert.equal(penalidadeDuasArmas(5), 0, 'nunca vira bônus');
assert.equal(penalidadeDuasArmas(1, -4), -3, 'a base vem de config/regras');

// --- Dado cru da arma (contra-ataque não soma bônus) ---
assert.equal(soODado('1d8+3'), '1d8', 'o +3 fica de fora do contra-ataque');
assert.equal(soODado('2d6 - 1'), '2d6', 'espaço e menos não confundem');
assert.equal(soODado('4'), '', 'dano fixo não tem dado para o contra-ataque');

// --- Quem pode contra-atacar (§6.8) ---
const espada = { nome: 'Espada', alcanceM: 1.5, distancia: false };
const lanca  = { nome: 'Lança',  alcanceM: 3,   distancia: false };
const arco   = { nome: 'Arco',   alcanceM: 30,  distancia: true };
const base = { pericia: 2, energia: 5, jaContraAtacou: false, distanciaM: 1.5, golpes: [espada] };

assert.equal(podeContraAtacar(base).ok, true, 'perícia, energia e alcance: pode');
assert.equal(podeContraAtacar({ ...base, pericia: 0 }).ok, false, 'sem Aparar não contra-ataca');
assert.match(podeContraAtacar({ ...base, pericia: 0 }).motivo, /Aparar/, 'o motivo diz qual é a trava: é o trunfo do Aparar');
assert.equal(podeContraAtacar({ ...base, pericia: 1 }).ok, true, 'nível 1 já basta');
assert.equal(podeContraAtacar({ ...base, energia: 0 }).ok, false, 'sem Energia não contra-ataca');
assert.equal(podeContraAtacar({ ...base, energia: null }).ok, true, 'Energia desconhecida não bloqueia');
assert.equal(podeContraAtacar({ ...base, jaContraAtacou: true }).ok, false, 'um contra-ataque por golpe');

// alcance: é corpo a corpo, tem que CHEGAR no agressor
assert.equal(podeContraAtacar({ ...base, distanciaM: 4 }).ok, false, 'espada não alcança a 4 m');
assert.equal(podeContraAtacar({ ...base, distanciaM: 3, golpes: [espada, lanca] }).ok, true, 'a lança alcança');
assert.deepEqual(podeContraAtacar({ ...base, distanciaM: 3, golpes: [espada, lanca] }).linhas.map(g => g.nome),
    ['Lança'], 'só entram os golpes que realmente alcançam');
assert.equal(podeContraAtacar({ ...base, golpes: [arco] }).ok, false, 'arma a distância não contra-ataca');
assert.equal(podeContraAtacar({ ...base, golpes: [] }).ok, false, 'sem golpe físico não há contra-ataque');
assert.equal(podeContraAtacar({ ...base, distanciaM: null }).ok, false, 'sem distância medida não libera');

// o motivo CURTO é o que aparece na tela ao lado do botão apagado
assert.equal(podeContraAtacar({ ...base, pericia: 0 }).curto, 'sem Aparar');
assert.equal(podeContraAtacar({ ...base, energia: 0 }).curto, 'sem Energia');
assert.equal(podeContraAtacar({ ...base, jaContraAtacou: true }).curto, 'já contra-atacou');
assert.equal(podeContraAtacar({ ...base, distanciaM: 4 }).curto, 'fora de alcance (4 m)',
    'com arma na mão, o motivo é a distância — e diz quantos metros');
assert.equal(podeContraAtacar({ ...base, golpes: [arco] }).curto, 'sem golpe corpo a corpo',
    'só arma a distância: o motivo não é o alcance, é não ter com o que');
assert.equal(podeContraAtacar(base).curto, '', 'podendo, não há motivo a mostrar');
assert.match(podeContraAtacar({ ...base, distanciaM: 4 }).motivo, /maior alcance é 1.5 m/,
    'o motivo longo compara a distância com o braço mais comprido');

// 🪄 MAGIA DE PERTO ABRE A GUARDA (regra de mesa, decidida em 16/08/2026)
// O que o agressor usou não entra na conta: quem conjurou coladinho e errou
// feio se expôs igual a quem errou uma espada. Quem decide é a distância até
// ele e o que o DEFENSOR tem para revidar — arma OU parte do corpo.
{
    // a régua não recebe nem sabe o tipo do ataque: os mesmos argumentos valem
    // para espada, arco ou magia do agressor. É isso que este bloco tranca.
    const punho = { nome: 'Punho', alcanceM: 1, distancia: false, desarmado: true };
    const colado = { pericia: 2, energia: 5, jaContraAtacou: false, distanciaM: 0 };

    assert.equal(podeContraAtacar({ ...colado, golpes: [punho] }).ok, true,
        'conjurador colado, defensor desarmado: a parte do corpo revida');
    assert.equal(podeContraAtacar({ ...colado, golpes: [espada] }).ok, true,
        'colado com arma na mão: revida');
    assert.equal(podeContraAtacar({ ...colado, distanciaM: 1.5, golpes: [punho] }).ok, false,
        'conjurou a uma célula: o punho (1 m) não alcança, sem contra-ataque');
    assert.equal(podeContraAtacar({ ...colado, distanciaM: 1.5, golpes: [punho, espada] }).ok, true,
        'a uma célula, quem tem espada alcança');
    assert.deepEqual(podeContraAtacar({ ...colado, distanciaM: 1.5, golpes: [punho, espada] }).linhas.map(g => g.nome),
        ['Espada'], 'e só a espada entra na escolha — o punho não chega lá');
    assert.equal(podeContraAtacar({ ...colado, golpes: [arco] }).ok, false,
        'só arco na mão: não há golpe corpo a corpo para revidar');
    assert.equal(podeContraAtacar({ ...colado, distanciaM: 30, golpes: [punho, espada] }).ok, false,
        'magia de longe não abre guarda nenhuma: ninguém alcança o conjurador');
}

/* ===================== 📏 TAMANHO =====================
   O VD é o TRIPLO da Altura, então 3 pontos ≈ 1 metro. Alvo maior é mais fácil
   de acertar; e no corpo a corpo quem é maior bate mais forte. O MESMO número
   com sinais opostos — é a mesma diferença física lida de dois jeitos. */
assert.equal(TAMANHO_POR_PONTO, 2, '2 pontos de Tamanho ≈ 66 cm de altura');

const HUMANO = 5.25;   // 1,75 m
const OGRO = 9;        // 3 m
const HALFLING = 3;    // 1 m
const DRAGAO = 18;     // 6 m

let a1 = ajusteDeTamanho(HUMANO, HUMANO);
assert.deepEqual(a1, { pontos: 0, acerto: 0, danoCaC: 0 }, 'iguais: nada muda');

a1 = ajusteDeTamanho(HUMANO, OGRO);
assert.equal(a1.acerto, 2, '🔒 alvo MAIOR é mais fácil de acertar');
assert.equal(a1.danoCaC, -2, 'e o humano bate mais fraco nele, no corpo a corpo');

a1 = ajusteDeTamanho(OGRO, HUMANO);
assert.equal(a1.acerto, -2, '🔒 alvo MENOR é mais difícil');
assert.equal(a1.danoCaC, 2, 'e o ogro bate mais forte — o mesmo número, invertido');

a1 = ajusteDeTamanho(HUMANO, HALFLING);
assert.equal(a1.acerto, -1, 'halfling é alvo pequeno');

/* 🐲 O DRAGÃO. Acertar tem de ser fácil, e a patada tem de ser mortal —
   por isso ele fica LONGE do teto: +6 nos dois lados da conta. */
a1 = ajusteDeTamanho(HUMANO, DRAGAO);
assert.equal(a1.acerto, 6, '🔒 um dragão de 6 m é +6 no Alvo: quase impossível errar');
assert.equal(ajusteDeTamanho(DRAGAO, HUMANO).danoCaC, 6, '🔒 e a patada dele leva +6 de dano');
assert.ok(a1.acerto < TAMANHO_TETO, 'e nem ele encosta no teto — o teto é para o absurdo colossal');
assert.equal(ajusteDeTamanho(HUMANO, 999).acerto, TAMANHO_TETO, 'nada fura o teto');
assert.equal(ajusteDeTamanho(999, HUMANO).acerto, -TAMANHO_TETO, 'e ele vale para os dois lados');

/* simetria: trocar os lados inverte o sinal, sempre */
const inv = (n) => -n || 0;   // -0 e 0 são a mesma coisa para a mesa
for (const [x, y] of [[HUMANO, OGRO], [HALFLING, DRAGAO], [OGRO, OGRO], [3, 7.5]]) {
    assert.equal(ajusteDeTamanho(x, y).acerto, inv(ajusteDeTamanho(y, x).acerto),
        `simetria entre ${x} e ${y}`);
    assert.equal(ajusteDeTamanho(x, y).acerto, inv(ajusteDeTamanho(x, y).danoCaC),
        'acerto e dano são o mesmo número com sinais opostos');
}

/* um palmo não move nada: a régua ainda é grossa, só menos que antes */
assert.equal(ajusteDeTamanho(HUMANO, HUMANO + 0.9).acerto, 0, 'menos de meio degrau não conta');
assert.equal(ajusteDeTamanho(HUMANO, HUMANO + 1.1).acerto, 1, 'passou da metade, arredonda para 1');

/* sem Tamanho na ficha (NPC legado) não quebra nem inventa vantagem */
assert.deepEqual(ajusteDeTamanho(null, null), { pontos: 0, acerto: 0, danoCaC: 0 });
assert.equal(ajusteDeTamanho(undefined, HUMANO).acerto, 3, 'quem não tem Tamanho conta como 0');

console.log('✅ conta do conflito OK — graus, três defesas, crítico, blindagem, orçamento, duas armas e contra-ataque');
