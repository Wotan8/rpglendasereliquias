/**
 * 🏹 A munição vale para o ATAQUE COMUM, não só para a habilidade que dispara.
 *
 * O que a mesa pegou: a Vireu atirou de arco com a aljava vazia, e quando
 * tinha flecha o maço não diminuía. Causa — `tbTurnoGolpe` (o botão da lista
 * ⚔️ ATAQUES) nunca passava pelo pedágio da munição: só `tbTurnoSkill` o
 * chamava. Sem ele o tiro não é barrado E `meta.projetil` fica vazio, então a
 * janela de conflito não tem o que gastar depois.
 *
 * O teste anda pela CORRENTE inteira no fonte, porque o furo foi um elo
 * faltando, não uma conta errada.
 *
 * Roda com: node tabuleiro/js/tab-municao.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projeteisCompativeis, gastarUm, municaoDaArma } from '../../shared/projeteis.js';

const turno = readFileSync(new URL('./tab-turno.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const conflito = readFileSync(new URL('./tab-conflito.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fwin = readFileSync(new URL('./tab-ficha-win.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ===== elo 1: a linha de ataque carrega o que a arma come ===== */
assert.match(fwin, /l\.tipoProjetil\s*=/,
    'linhasDeAtaque tem de resolver tipoProjetil (instância > modelo), senão nada abaixo funciona');

/* ===== elo 2: o ataque COMUM passa pelo pedágio ===== */
const ini = turno.indexOf('window.tbTurnoGolpe');
assert.ok(ini > 0, 'tbTurnoGolpe não encontrada');
const corpo = turno.slice(ini, turno.indexOf('\n};\n', ini));
assert.match(corpo, /await\s+municaoParaOGolpe\(/,
    '🔒 o ataque comum TEM de pedir munição — era exatamente este elo que faltava');
assert.match(corpo, /if\s*\(\s*proj\s*===\s*false\s*\)\s*return/,
    'sem munição (ou cancelando), o tiro aborta antes de armar a mira');
assert.match(corpo, /meta\.projetil\s*=\s*proj/,
    'o maço escolhido tem de viajar no meta, senão não há o que gastar depois');
assert.match(turno.slice(ini, ini + 40), /async/, 'a função virou async ao esperar a escolha');

/* ===== elo 3: o meta chega à janela de conflito ===== */
assert.match(turno, /projetil:\s*meta\.projetil\s*\|\|\s*null/,
    'a aplicação da mira repassa o projétil para o conflito');
assert.match(conflito, /if\s*\(c\.acao\?\.projetil\)\s*await\s+resolverProjetil/,
    'e o conflito gasta o maço depois da rolagem');

/* ===== elo 4: a habilidade que dispara continua passando ===== */
assert.equal((turno.match(/await\s+municaoParaOGolpe\(/g) || []).length, 2,
    'os DOIS caminhos (ataque comum e habilidade) pedem munição');

/* ===== a decisão pura, com o caso da Vireu ===== */
const ARCO = { nome: 'Arco Longo', tipoProjetil: ['Flecha'], categoriaArma: 'distancia' };
assert.deepEqual(municaoDaArma(ARCO, []), ['flecha']);

// aljava vazia: nada casa, e quem chama aborta o tiro
assert.deepEqual(projeteisCompativeis([], [], ARCO), []);
assert.deepEqual(projeteisCompativeis([{ id: 'v', nome: 'Virote Perfurante', tipo: 'Projétil', tags: ['Virote'], quantidade: 20 }], [], ARCO), [],
    'virote não serve em arco');

// flecha DENTRO da aljava conta: ninguém em mesa tira da aljava antes de atirar
const naAljava = { id: 'f1', nome: 'Flecha de Penacho', tipo: 'Projétil', tags: ['Flecha'], quantidade: 12, parentItemId: 'aljava' };
const achados = projeteisCompativeis([naAljava], [], ARCO);
assert.equal(achados.length, 1);
assert.equal(achados[0].quantidade, 12);
assert.equal(achados[0].dentroDe, 'aljava');

// maço zerado não atira
assert.deepEqual(projeteisCompativeis([{ ...naAljava, quantidade: 0 }], [], ARCO), []);

// e o tiro tira exatamente 1
assert.deepEqual(gastarUm({ quantidade: 12 }), { acabou: false, restante: 11 });
assert.deepEqual(gastarUm({ quantidade: 1 }), { acabou: true, restante: 0 });

// arma sem munição cadastrada (Funda) segue atirando de graça — é cadastro, não código
assert.deepEqual(municaoDaArma({ nome: 'Funda' }, []), []);

console.log('✅ munição OK — o ataque comum pede flecha, e o maço perde 1 no disparo');
