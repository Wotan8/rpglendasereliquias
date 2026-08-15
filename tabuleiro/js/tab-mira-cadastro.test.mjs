/**
 * Leitura da MIRA do cadastro (miraDaReguaV2, em tab-turno.js).
 *
 * Os casos são pré-definidos REAIS de system/data/classModules, um por forma
 * que o Painel do Criador grava. O que se trava aqui:
 *   · "onda"/"zona"/"circulo" com tamanho = área de geometria, e o alcance é
 *     que decide se o círculo nasce no token ou solto no mapa;
 *   · "proprio"/"nenhuma"/"unico"/"ponto" com alcance 0 = só em quem usa —
 *     vira raio 0 no próprio token e cai como aliado, sem janela de conflito
 *     contra si mesmo (eram 28 habilidades mirando a 0 m em modo "alvos");
 *   · TODAS as condições do cadastro viajam, não só a primeira (Postura
 *     Defensiva dá Blindado E Abalado);
 *   · sem área e sem alvos não há mira — a habilidade cai no diálogo manual.
 *
 * Roda com: node tabuleiro/js/tab-mira-cadastro.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ehFormula, resolverMedida } from '../../shared/medida-formula.js';

const src = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function miraDaReguaV2(');
assert.ok(ini > 0, 'miraDaReguaV2 não encontrada');
const fim = src.indexOf('\n}\n', ini) + 3;

// `ehFormula` vem do módulo de verdade — o temMedida sai do próprio fonte.
const iTem = src.indexOf('const temMedida =');
assert.ok(iTem > 0 && iTem < ini, 'temMedida não encontrado antes de miraDaReguaV2');
const sandbox = { r: null, ehFormula };
vm.createContext(sandbox);
vm.runInContext(src.slice(iTem, src.indexOf('\n', iTem)) + '\n' + src.slice(ini, fim), sandbox);
// JSON no meio do caminho: objeto criado dentro do vm tem outro protótipo, e
// o deepEqual estrito reprova comparação entre realms.
const mira = (pd) => {
    sandbox.pd = pd;
    vm.runInContext('r = JSON.stringify(miraDaReguaV2(pd) ?? null)', sandbox);
    return JSON.parse(sandbox.r);
};

/* ===== Bardo: "onda" — área a partir do próprio conjurador ===== */
const grito = mira({
    nome: 'GRITO DISSONANTE [V, S]', formaArea: 'onda', tamanhoArea: 3,
    alcance: null, alvosMax: null, anguloCone: null, faccao: 'inimigo',
    condicoesAplicadas: [{ condicao: 'Atordoado', portao: 'chance', chance: 8, alvos: 2, rodadas: 1 }],
    regua: { custo: 2 },
});
assert.equal(grito.tipo, 'geometria');
assert.equal(grito.forma, 'circulo');
assert.equal(grito.origem, 'token', 'onda sem alcance nasce no token de quem canta');
assert.equal(grito.raioM, 3);
assert.equal(grito.afeta, 'inimigos');
assert.deepEqual(grito.condicoes, [{ nome: 'Atordoado', rodadas: 1, maxAlvos: 2 }]);
assert.equal(grito.condicaoPortao, 'chance', 'o portão é o que torna a habilidade contestável');

/* ===== círculo COM alcance: solto no mapa ===== */
const solto = mira({ formaArea: 'circulo', tamanhoArea: 4, alcance: 12, faccao: 'ambos' });
assert.equal(solto.origem, 'livre', 'círculo com alcance é largado onde o mestre clicar');
assert.equal(solto.alcanceM, 12);
assert.equal(solto.afeta, 'todos', 'faccao "ambos" atinge todo mundo');

/* ===== cone e linha ===== */
const cone = mira({ formaArea: 'cone', tamanhoArea: 6, anguloCone: 45, faccao: 'inimigo' });
assert.equal(cone.forma, 'cone');
assert.equal(cone.origem, 'token', 'cone sempre sai do conjurador');
assert.equal(cone.angGraus, 45);
assert.equal(mira({ formaArea: 'cone', tamanhoArea: 6 }).angGraus, 60, 'sem ângulo cadastrado, 60°');
const linha = mira({ formaArea: 'linha', tamanhoArea: 9 });
assert.equal(linha.forma, 'linha');
assert.equal(linha.comprimentoM, 9);
assert.equal(linha.larguraM, 3, 'a largura da linha é um terço do comprimento');

/* ===== só em quem usa: postura, buff pessoal, loção ===== */
for (const forma of ['proprio', 'nenhuma', 'unico', 'ponto']) {
    const m = mira({ formaArea: forma, tamanhoArea: null, alcance: 0, alvosMax: 1 });
    assert.equal(m.tipo, 'geometria', `${forma}: vira geometria e não "alvos" a 0 m`);
    assert.equal(m.raioM, 0, `${forma}: raio 0 — ninguém mais entra`);
    assert.equal(m.origem, 'token');
    assert.equal(m.afeta, 'aliados', `${forma}: cai direto, sem conflito contra si mesmo`);
}

// Postura Defensiva: DUAS condições no mesmo uso
const postura = mira({
    nome: 'Postura Defensiva', formaArea: 'proprio', alcance: 0, alvosMax: 1,
    condicoesAplicadas: [
        { condicao: 'Blindado', rodadas: 0, alvos: 1 },
        { condicao: 'Abalado', rodadas: 0, alvos: 1 },
    ],
});
assert.deepEqual(postura.condicoes.map(c => c.nome), ['Blindado', 'Abalado'],
    'a segunda condição não pode se perder');

/* ===== alvos escolhidos, com alcance ===== */
const presa = mira({ nome: 'A PRESA', formaArea: 'nenhuma', alcance: 20, alvosMax: 1, faccao: 'inimigo' });
assert.equal(presa.tipo, 'alvos', 'com alcance de verdade continua sendo seleção de alvo');
assert.equal(presa.alcanceM, 20);
assert.equal(presa.maxAlvos, 1);
const dois = mira({ formaArea: 'nenhuma', alcance: 15, alvosMax: 2, faccao: 'aliado' });
assert.equal(dois.maxAlvos, 2);
assert.equal(dois.afeta, 'aliados');

/* ===== sem nada cadastrado: sem mira ===== */
assert.equal(mira({ nome: 'Ritual fora de combate' }), null);
assert.equal(mira({ formaArea: 'onda', tamanhoArea: 0 }), null, 'área de tamanho 0 não é área');
assert.equal(mira({ formaArea: '', alvosMax: 0 }), null);
assert.equal(mira(null), null);

console.log('✅ mira do cadastro OK — onda/cone/linha, só-em-si, alvos e todas as condições');

/* ===== medida por FÓRMULA (Raio: (Liderança + PRE) metros) ===== */
// A régua reconhece a área mesmo com a medida em fórmula...
const fantoches = mira({
    nome: 'ERGUER FANTOCHES', formaArea: 'onda', tamanhoArea: '(Liderança + PRE)',
    alcance: null, alvosMax: null, faccao: 'aliado',
});
assert.equal(fantoches.tipo, 'geometria', 'fórmula no tamanho ainda é área');
assert.equal(fantoches.forma, 'circulo');
assert.equal(fantoches.raioM, '(Liderança + PRE)',
    'a medida segue CRUA daqui — quem resolve tem a ficha na mão');
assert.equal(fantoches.larguraM, '((Liderança + PRE)) / 3',
    'o terço da largura viaja como conta, para ser feito com o número depois');

// ...e a resolução com a ficha do conjurador dá o número da mesa.
const ficha = { 'Liderança': 4, 'PRE': 3 };
const valorDe = (n) => (n in ficha ? ficha[n] : null);
assert.equal(resolverMedida(fantoches.raioM, valorDe), 7, 'Liderança 4 + PRE 3 = 7 m de raio');
assert.equal(resolverMedida(fantoches.larguraM, valorDe), 7 / 3);

// Fórmula no ALCANCE também conta como alcance de verdade (círculo solto)
const soltoF = mira({ formaArea: 'circulo', tamanhoArea: 3, alcance: 'Percepção * 2' });
assert.equal(soltoF.origem, 'livre', 'alcance por fórmula abre o círculo no mapa');
assert.equal(resolverMedida(soltoF.alcanceM, (n) => (n === 'Percepção' ? 5 : null)), 10);

// Número puro continua exatamente como era
const fixo = mira({ formaArea: 'onda', tamanhoArea: 3, faccao: 'inimigo' });
assert.equal(fixo.raioM, 3);
assert.equal(fixo.larguraM, 1, 'terço de 3 tem piso 1');

console.log('✅ mira com fórmula OK — medida crua na régua, número na hora de mirar');
