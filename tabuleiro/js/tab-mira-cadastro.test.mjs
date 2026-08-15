/**
 * Leitura da MIRA do cadastro — agora em shared/skill-runtime.js
 * (miraDeCadastro), a MESMA função que o Painel do Criador usa. Antes havia
 * uma cópia em tab-turno e este teste apontava para ela; duas cópias da mesma
 * regra foi o que produziu o bug do sombreamento, então ficou uma só.
 *
 * Os casos são pré-definidos REAIS de system/data/classModules, um por forma
 * que o Painel do Criador grava.
 *
 * Roda com: node tabuleiro/js/tab-mira-cadastro.test.mjs
 */
import assert from 'node:assert/strict';
import { ehFormula, resolverMedida } from '../../shared/medida-formula.js';
import { miraDeCadastro } from '../../shared/skill-runtime.js';

const mira = (pd) => miraDeCadastro(pd);

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
assert.deepEqual(grito.condicoes,
    [{ nome: 'Atordoado', rodadas: 1, maxAlvos: 2, nivel: 1, faccao: '', rotulo: '' }],
    'cadastro sem nível nem facção continua saindo com os padrões (nível 1, sem facção)');
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

/* ===== 📍 nova forma de mira: LOCAIS no mapa ===== */
const manada = mira({
    nome: 'Convocar Manada', formaArea: 'locais', alcance: 12, alvosMax: 3, faccao: 'aliado',
});
assert.equal(manada.tipo, 'locais', 'formaArea "locais" abre a mira de chão');
assert.equal(manada.alcanceM, 12);
assert.equal(manada.maxAlvos, 3, 'alvosMax vira quantos pontos podem ser marcados');
assert.equal(manada.afeta, 'aliados');

// "locais" ganha de "ponto": intenção declarada não vira "só em si"
const semAlcance = mira({ formaArea: 'locais', alcance: 0, alvosMax: 2 });
assert.equal(semAlcance.tipo, 'locais', 'locais sem alcance ainda é locais, não "só em si"');

// o resto das formas não foi contaminado
assert.equal(mira({ formaArea: 'ponto', alcance: 0, alvosMax: 1 }).raioM, 0, '"ponto" continua só em si');
assert.equal(mira({ formaArea: 'onda', tamanhoArea: 3 }).tipo, 'geometria');

// alcance por fórmula também vale na mira de locais
const porFormula = mira({ formaArea: 'locais', alcance: '(Liderança + PRE)', alvosMax: 5 });
assert.equal(porFormula.tipo, 'locais');
assert.equal(resolverMedida(porFormula.alcanceM, valorDe), 7);

console.log('✅ mira de LOCAIS OK — chão vazio, quantidade por alvosMax, alcance fixo ou por fórmula');

/* ===== 🎲 quantidade pelos Graus (Convocar Manada) ===== */
const porGraus = mira({
    nome: 'Convocar Manada', formaArea: 'locais', alcance: 'Percepção * 2',
    alvosMax: 5, alvosPorGraus: true, faccao: 'aliado',
});
assert.equal(porGraus.tipo, 'locais');
assert.equal(porGraus.alvosPorGraus, true, 'a flag viaja para o runtime rolar antes de mirar');
assert.equal(porGraus.maxAlvos, 5, 'alvosMax vira o TETO — os Graus dizem quantos de fato');
assert.equal(resolverMedida(porGraus.alcanceM, (n) => (n === 'Percepção' ? 6 : null)), 12,
    'Percepção 6 × 2 = 12 m de alcance');

// sem a flag, a quantidade é fixa
assert.equal(mira({ formaArea: 'locais', alcance: 10, alvosMax: 3 }).alvosPorGraus, false);

console.log('✅ quantidade pelos Graus OK — teto no cadastro, número no dado');
