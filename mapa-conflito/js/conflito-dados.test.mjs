// Rodar: node mapa-conflito/js/conflito-dados.test.mjs
import assert from 'node:assert/strict';
import {
    lerHabilidade, agruparPorAcao, habilidadesDaClasse, norm, SEM_ACAO,
    lerCondicoes, rotuloCondicao, perfilDaClasse, vocacaoDominante, FAIXAS,
    radarSVG, opacidadeRadar, PALETA, VOCACOES,
    auditoriaDaClasse, auditoriaSVG, tabelaAuditoria, FAIXA_REGUA,
} from './conflito-dados.js';

/* Fixtures com o formato REAL do banco (copiado de system/data/classModules).
   O ponto do teste: chaves numéricas fora de ordem, rótulo "Ação:" com chave
   'acao' anexada depois, e valores de Teste que são id de perícia. */
const mapas = {
    vds: { KfTc5BpUE0u7qedNrjsX: 'Bênção' },   // Teste: aponta para VALOR DERIVADO
};

const bispo = {
    titulo: 'Círculo do Bispo da Luz',
    schema: [
        { key: '1', label: 'Nome' }, { key: '2', label: 'Teste:' },
        { key: '3', label: 'Redutor:' }, { key: '4', label: 'Custo:' },
        { key: 'acao', label: 'Ação:' }, { key: '6', label: 'Pagar Energia' },
        { key: '5', label: 'Efeito:' }, { key: '8', label: 'Falha:' },
    ],
};

const luz = {
    nome: 'Luz do Manto de Palla I',
    descricao: 'Alvo recebe +1 Blindagem e ignora Exaustão por 1 cena.',
    valores: {
        1: 'Luz do Manto de Palla I', 2: 'KfTc5BpUE0u7qedNrjsX', 3: '-3',
        4: '1D ou 1G', 5: 'texto do efeito', 6: 'gT5DZcIaG69aYuEjdXwQ',
        8: 'Só +1 de Blindagem.', acao: 'Ação Padrão',
    },
    duracaoValor: 1, duracaoUnidade: 'cena', formaArea: 'nenhuma', alcance: null,
    condicoesAplicadas: [], regua: { razao: 1.02 },
};

// --- lerHabilidade: casamento por RÓTULO, nunca por posição ---
const h = lerHabilidade(bispo, luz, mapas);
assert.equal(h.custo, '1D ou 1G', 'Custo veio da chave 4, não da 4ª posição');
assert.equal(h.acao, 'Ação Padrão');
assert.equal(h.teste, 'Bênção -3', 'id de VALOR DERIVADO resolvido + redutor colado');
assert.equal(h.falha, 'Só +1 de Blindagem.');
assert.equal(h.duracao, '1 cena', 'campo estruturado ganha do schema');
assert.equal(h.efeito, luz.descricao, 'descricao tem prioridade sobre o campo Efeito');
assert.equal(h.razao, 1.02);
assert.equal(h.alcance, null, 'formaArea "nenhuma" não vira alcance');

// --- id que não resolve NUNCA vaza cru para a tela ---
const semMapa = lerHabilidade(bispo, luz, {});
assert.equal(semMapa.teste, null, 'VD desconhecido some, não vira hash na tela');

// --- a armadilha: "Alcance/Raio/Duração:" casa com /alcance/ E com /dura/ ---
const armadilha = lerHabilidade(
    { titulo: 'M', schema: [{ key: 'a', label: 'Alcance/Raio/Duração:' }] },
    { nome: 'X', valores: { a: '15m · 1 cena' } }, mapas);
assert.equal(armadilha.alcance, '15m · 1 cena');
assert.equal(armadilha.duracao, null, 'o rótulo composto não pode virar duração também');

// --- condições são OBJETO com portão, não id. Tratar como id devolvia
//     "[object Object]", não casava com nada e o chip sumia calado. ---
const comCond = lerHabilidade(bispo, { ...luz, condicoesAplicadas: [
    { condicao: 'Atordoado', portao: 'chance', chance: 10, alvos: 1, rodadas: 1 },
    { condicao: 'Amedrontado', portao: 'resistencia', chance: null, alvos: 3, rodadas: 5 },
    'id-solto-do-formato-velho', null,
] }, mapas);
assert.equal(comCond.condicoes.length, 2, 'lixo e formato velho caem fora, objeto bom entra');
assert.equal(rotuloCondicao(comCond.condicoes[0]), 'Atordoado · 1r · chance 10');
assert.equal(rotuloCondicao(comCond.condicoes[1]), 'Amedrontado · 5r · 3 alvos · resistência',
    'alvo múltiplo aparece; alvo único não polui o chip');
assert.deepEqual(lerCondicoes({}), [], 'habilidade sem condição não quebra');
assert.equal(lerCondicoes({ condicoesAplicadas: [{ portao: 'chance' }] }).length, 0,
    'objeto sem o nome da condição não vira chip vazio');

// --- agruparPorAcao: ordem do turno, e o buraco de cadastro fica VISÍVEL ---
const grupos = agruparPorAcao([
    { nome: 'Investida', acao: 'Ação Padrão' },
    { nome: 'Postura Ofensiva', acao: 'Ação Livre' },
    { nome: 'Dança das Lâminas', acao: 'Ação Completa (turno inteiro)' },
    { nome: 'Órfã', acao: null },
    { nome: 'Exótica', acao: 'Meia Ação Inventada' },
]);
assert.deepEqual(grupos.map(g => g.nome), [
    'Ação Livre', 'Ação Padrão', 'Ação Completa (turno inteiro)', SEM_ACAO, 'Meia Ação Inventada',
], 'faixas conhecidas na ordem do turno; desconhecidas no fim');
assert.equal(grupos.filter(g => g.lista.length === 0).length, 0, 'faixa vazia não é renderizada');
assert.equal(grupos.at(-1).conhecida, false, 'rótulo fora do catálogo é sinalizado');
assert.equal(grupos.at(-2).conhecida, false, 'sem ação também é sinalizado');
assert.equal(grupos[0].icone, '⚡');

// --- habilidadesDaClasse: aceita ref como string ou {id} ---
const modulos = { m1: { ...bispo, id: 'm1', itensPredefinidos: [luz] } };
assert.equal(habilidadesDaClasse({ modulosDaClasse: ['m1'] }, modulos, mapas).length, 1);
assert.equal(habilidadesDaClasse({ modulosDaClasse: [{ id: 'm1' }] }, modulos, mapas).length, 1);
assert.equal(habilidadesDaClasse({ modulosDaClasse: ['sumiu'] }, modulos, mapas).length, 0,
    'módulo apagado no Painel não derruba a página');
assert.equal(habilidadesDaClasse({}, modulos, mapas).length, 0);

// --- busca sem acento ---
assert.ok(norm('Cólera').includes(norm('colera')));

// --- Reação NÃO existe mais no sistema: não pode voltar ao catálogo ---
assert.equal(FAIXAS.some(([n]) => /rea[çc][ãa]o/i.test(n)), false,
    'Reação saiu do sistema — habilidade cadastrada com ela tem que cair na faixa marcada');
assert.equal(agruparPorAcao([{ nome: 'X', acao: 'Reação' }])[0].conhecida, false,
    'e ser sinalizada como fora do catálogo, não desenhada como se valesse');

/* --- perfilDaClasse: as coordenadas do mapa ---
   Uma classe marcial (Livre + Padrão, sem VD) e uma conjuradora (tudo
   Padrão com VD) têm que cair em cantos opostos. */
const mods2 = {
    marcial: {
        titulo: 'Manobras', schema: [{ key: 'e', label: 'Efeito:' }],
        itensPredefinidos: [
            { nome: 'Postura', valores: { e: 'ganha +2 de Blindagem', acao: 'Ação Livre' } },
            { nome: 'Investida', valores: { e: 'causa 2d6 de dano', acao: 'Ação Livre' } },
            { nome: 'Golpe', valores: { e: 'causa 1d8 de dano', acao: 'Ação Padrão' } },
            { nome: 'Salto', valores: { e: 'avança 6m', acao: 'Ação Padrão' } },
        ],
    },
    conjurador: {
        titulo: 'Círculo', schema: [{ key: 't', label: 'Teste:' }, { key: 'e', label: 'Efeito:' }],
        itensPredefinidos: [
            { nome: 'Rito', valores: { t: 'vd1', e: 'cura 2d6', acao: 'Ação Padrão' } },
            { nome: 'Transe', valores: { t: 'vd1', e: 'invoca um espírito', acao: 'Ação Completa (turno inteiro)' } },
            { nome: 'Vigília', valores: { t: 'vd1', e: 'restaura o santuário', acao: 'Fora de combate' } },
        ],
    },
};
const mapas2 = { vds: { vd1: 'Bênção' } };
const pM = perfilDaClasse({ id: 'a', nome: 'Marcial', modulosDaClasse: ['marcial'] }, mods2, mapas2);
const pC = perfilDaClasse({ id: 'b', nome: 'Conjurador', modulosDaClasse: ['conjurador'] }, mods2, mapas2);

assert.equal(pM.ritmo, 0.5, 'duas Livres em quatro = +0,50 de ritmo');
assert.equal(pM.portao, 0, 'marcial não rola VD');
assert.equal(pC.ritmo, (-1 - 1) / 3, 'Completa e Fora de combate puxam o ritmo para baixo');
assert.equal(pC.portao, 1, 'conjurador rola VD em tudo');
assert.ok(pM.ritmo > pC.ritmo, 'os dois têm que cair em lados opostos do mapa');
assert.equal(pC.ritual, 1, 'ritual fora de combate é contado à parte');

assert.equal(pM.vocacao.dano, 2, 'dano contado por habilidade, não por menção');
assert.equal(vocacaoDominante(pM), 'dano');
assert.equal(vocacaoDominante(pC), 'cura');
assert.equal(vocacaoDominante({ vocacao: {} }), null, 'classe sem efeito legível não inventa vocação');

// Classe sem habilidade nenhuma não pode virar ponto em (0,0) — ela não tem posição.
const pVazio = perfilDaClasse({ id: 'c', nome: 'Runimago', modulosDaClasse: [] }, mods2, mapas2);
assert.equal(pVazio.n, 0);
assert.equal(pVazio.ritmo, 0, 'sem repertório o ritmo fica neutro, e a tela filtra por n');

/* --- radar com N classes ---
   O radar tem que aguentar de 0 até todas as classes. Duas coisas quebram
   calado aqui: cor repetida (duas classes viram a mesma linha) e
   preenchimento que não sai (dez polígonos opacos empilhados = borrão). */
const serie = (nome, voc) => ({ id: nome, nome, n: 10, vocacao: voc, ritmo: 0, portao: 0 });
const conta = (svg, re) => (svg.match(re) || []).length;
const ANEIS = 4;

const r0 = radarSVG([]);
assert.equal(conta(r0, /<polygon/g), ANEIS, 'sem classe, só a teia');
assert.ok(r0.includes('Nenhuma classe marcada'), 'e a legenda diz isso');

const r1 = radarSVG([serie('A', { dano: 5 })]);
assert.equal(conta(r1, /<polygon/g), ANEIS + 1);
assert.equal(conta(r1, /class="mc-radar-chave"/g), 1, 'uma chave de legenda por classe');

const onze = Array.from({ length: 11 }, (_, i) => serie('C' + i, { dano: i }));
const r11 = radarSVG(onze);
assert.equal(conta(r11, /<polygon/g), ANEIS + 11, 'todas as 11 desenhadas');
assert.equal(conta(r11, /class="mc-radar-chave"/g), 11, 'e todas na legenda');

// Classe sem repertório não vira polígono achatado no centro.
assert.equal(conta(radarSVG([...onze, { id: 'z', nome: 'Runimago', n: 0, vocacao: {} }]), /<polygon/g),
    ANEIS + 11, 'classe sem habilidade fica fora do radar');

/* Cores: nenhuma repetida enquanto couber na paleta.
   Casa por `fill=`, não por `stroke=` — a teia também tem stroke, e contá-la
   dava 12 cores para 11 classes. As séries são as que têm fill colorido. */
const cores = [...r11.matchAll(/<polygon[^>]*fill="(var\([^)]+\))"/g)].map(m => m[1]);
assert.equal(cores.length, 11, 'só as séries, sem a teia (que tem fill="none")');
assert.equal(new Set(cores).size, 11, 'onze classes, onze cores distintas');
assert.ok(PALETA.length >= 11, 'a paleta precisa cobrir o número de classes de hoje');

/* CONTRATO do qual a cor da ficha depende: a k-ésima série recebe PALETA[k].
   A ficha marcada pinta a borda com PALETA[posição da classe entre as séries];
   se o radar mudasse essa correspondência, legenda e gráfico apontariam para
   classes diferentes — e calados. */
const ordem = [...radarSVG([serie('A', { dano: 1 }), serie('B', { dano: 2 }), serie('C', { dano: 3 })])
    .matchAll(/<polygon[^>]*fill="(var\([^)]+\))"/g)].map(m => m[1]);
assert.deepEqual(ordem, PALETA.slice(0, 3), 'a k-ésima série usa PALETA[k]');

// Passando da paleta, a cor recicla — mas com traço pontilhado para não
// confundir o par repetido.
const muitas = radarSVG(Array.from({ length: PALETA.length + 1 }, (_, i) => serie('X' + i, { dano: 1 })));
assert.ok(conta(muitas, /stroke-dasharray/g) > 0, 'as séries tardias mudam o traço');

// Preenchimento some conforme empilha.
assert.equal(opacidadeRadar(1), 0.22);
assert.equal(opacidadeRadar(2), 0.22, 'duas silhuetas cheias ainda se leem');
assert.equal(opacidadeRadar(4), 0.10);
assert.equal(opacidadeRadar(5), 0, 'a partir daqui é só contorno');
assert.equal(opacidadeRadar(11), 0);
assert.ok(r11.includes('fill-opacity="0"'), 'e o SVG de 11 classes sai sem preenchimento');
assert.ok(r1.includes('fill-opacity="0.22"'), 'com uma só, a silhueta é cheia');

// Os oito eixos aparecem, e o valor é % do repertório DAQUELA classe.
assert.equal(conta(r11, /🎯|💥|🕸️|🛡️|💚|⬆️|💨|👁️|🔎/g) >= VOCACOES.length, true);

/* --- auditoria: SÓ número exato ---
   A diferença para o radar é justamente esta: aqui nada é inferido de texto.
   Habilidade sem `regua` não conta como aprovada nem como reprovada — ela
   não foi medida, e a cobertura tem que dizer isso. */
const modAud = {
    m: {
        titulo: 'Manobras', schema: [{ key: 'e', label: 'Efeito:' }],
        itensPredefinidos: [
            { nome: 'Boa', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { razao: 1.36, unidades: 1.36, custo: 1 } },
            { nome: 'No piso', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { razao: 1.00, unidades: 1.00, custo: 1 } },
            { nome: 'No teto', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { razao: 1.70, unidades: 3.40, custo: 2 } },
            { nome: 'Estourada', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { razao: 9.14, unidades: 9.14, custo: 1 } },
            { nome: 'Fraca', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { razao: 0.4, unidades: 0.4, custo: 1 } },
            { nome: 'Sem régua', valores: { e: 'x', acao: 'Ação Padrão' } },
            { nome: 'Régua podre', valores: { e: 'x', acao: 'Ação Padrão' }, regua: { em: '2026-01-01' } },
        ],
    },
};
const aud = auditoriaDaClasse({ id: 'g', nome: 'Guerreiro', modulosDaClasse: ['m'] }, modAud, {});

assert.equal(aud.n, 7);
assert.equal(aud.medidas.length, 5, 'sem régua e régua sem razão não entram na medição');
assert.equal(aud.cobertura, 5 / 7, 'cobertura é medidas ÷ total, não medidas ÷ medidas');
assert.deepEqual(aud.foraDaFaixa.map(m => m.nome), ['Estourada', 'Fraca'],
    'os dois extremos, do maior para o menor');
assert.deepEqual(FAIXA_REGUA, [1.00, 1.70]);
// As bordas da faixa são INCLUSIVAS: 1,00 e 1,70 passam.
assert.ok(!aud.foraDaFaixa.some(m => m.nome === 'No piso'), '1,00 exato está dentro');
assert.ok(!aud.foraDaFaixa.some(m => m.nome === 'No teto'), '1,70 exato está dentro');
assert.equal(aud.custo, 1 + 1 + 2 + 1 + 1, 'soma o custo só do que foi medido');

// Classe nunca auditada: cobertura 0, e NÃO pode passar por "tudo aprovado".
const zero = auditoriaDaClasse({ id: 'x', nome: 'Xamã', modulosDaClasse: ['m'] },
    { m: { titulo: 'M', schema: [], itensPredefinidos: [{ nome: 'A', valores: { acao: 'Ação Padrão' } }] } }, {});
assert.equal(zero.cobertura, 0);
assert.equal(zero.foraDaFaixa.length, 0, 'sem medida não há como estar fora da faixa…');
const tab = tabelaAuditoria([zero]);
assert.ok(/Sem régua nenhuma/.test(tab) && /Xamã/.test(tab), '…então a tabela precisa DENUNCIAR a falta');
assert.ok(/sem medição/i.test(tab), 'e dizer que falta medida, não que está tudo certo');
// A classe sem régua não pode sumir da tela por "não ter nada fora da faixa".
assert.ok(tab.indexOf('Xamã') < tab.indexOf('Nada fora da faixa'),
    'o aviso de falta de medição vem ANTES do "nada fora da faixa", senão engana');

// O pior caso não pode ser cortado pelo eixo: 9,14× fica fixado na borda COM o número.
const svgAud = auditoriaSVG([aud]);
assert.ok(svgAud.includes('9,14×'), 'razão acima do teto do eixo aparece escrita');
assert.equal((svgAud.match(/<circle/g) || []).length, 5, 'um ponto por habilidade medida');
assert.ok(auditoriaSVG([zero]).includes('nunca auditada'));
assert.equal(auditoriaSVG([]).includes('<circle'), false, 'sem classe, sem ponto');

// Número em português: vírgula decimal, como no resto do site.
assert.ok(svgAud.includes('1,36×') || svgAud.includes('>1,36'), 'decimal com vírgula');

console.log('✅ conflito-dados: todos os asserts passaram.');
