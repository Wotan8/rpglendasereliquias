// Rodar: node shared/projeteis.test.mjs
// Arco come Flecha, besta come Virote, e a flecha DENTRO DA ALJAVA conta.
import assert from 'node:assert/strict';
import {
    projeteisCompativeis, municaoDaArma, destinoDoProjetil, gastarUm, chanceDe,
    CHANCE_RECUPERAR_PADRAO,
} from './projeteis.js';

const CAT = [
    { id: 'tpl_arco', tipo: 'Arma', categoriaArma: 'distancia', tipoProjetil: ['Flecha'] },
    { id: 'tpl_besta', tipo: 'Arma', categoriaArma: 'distancia', tipoProjetil: ['Virote'] },
    { id: 'tpl_espada', tipo: 'Arma', categoriaArma: 'media' },
    { id: 'tpl_flecha', tipo: 'Projétil', tags: ['Flecha'], chanceRecuperar: 60 },
    { id: 'tpl_virote', tipo: 'Projétil', tags: ['Virote'] },          // sem chance = padrão
    { id: 'tpl_aljava', tipo: 'Acessório', tags: ['Aljava'], ehContainer: true },
];

const ARCO = { id: 'w1', nome: 'Arco Longo', modeloId: 'tpl_arco' };
const BESTA = { id: 'w2', nome: 'Besta Leve', modeloId: 'tpl_besta' };
const ESPADA = { id: 'w3', nome: 'Espada', modeloId: 'tpl_espada' };

const INV = [
    { id: 'aljava', nome: 'Aljava', modeloId: 'tpl_aljava' },
    // DENTRO da aljava — é o caso que importa: ninguém em mesa acha que a
    // flecha na aljava não está disponível.
    { id: 'f1', nome: 'Flecha de Penacho', modeloId: 'tpl_flecha', quantidade: 12, parentItemId: 'aljava' },
    { id: 'f2', nome: 'Flecha Envenenada', modeloId: 'tpl_flecha', quantidade: 3 },
    { id: 'v1', nome: 'Virote Perfurante', modeloId: 'tpl_virote', quantidade: 8 },
    { id: 'f0', nome: 'Flecha (acabou)', modeloId: 'tpl_flecha', quantidade: 0 },
];

/* ═══ a arma diz o que come ═══ */
assert.deepEqual(municaoDaArma(ARCO, CAT), ['flecha']);
assert.deepEqual(municaoDaArma(ESPADA, CAT), [], 'espada não gasta munição');

/* ═══ o que serve para o arco ═══ */
const paraArco = projeteisCompativeis(INV, CAT, ARCO);
assert.deepEqual(paraArco.map(p => p.nome), ['Flecha de Penacho', 'Flecha Envenenada'],
    'as duas flechas entram; o virote não, e o maço zerado também não');
assert.equal(paraArco[0].dentroDe, 'aljava', 'flecha dentro da aljava conta, e a tela pode dizer de onde sai');
assert.equal(paraArco[0].quantidade, 12);
assert.equal(paraArco[0].chanceRecuperar, 60, 'chance vem do modelo do projétil');

/* ═══ besta só come virote ═══ */
assert.deepEqual(projeteisCompativeis(INV, CAT, BESTA).map(p => p.nome), ['Virote Perfurante']);
assert.equal(projeteisCompativeis(INV, CAT, BESTA)[0].chanceRecuperar, CHANCE_RECUPERAR_PADRAO,
    'projétil sem chance cadastrada usa o padrão do sistema');

/* ═══ arma que não gasta munição não abre picker ═══ */
assert.deepEqual(projeteisCompativeis(INV, CAT, ESPADA), []);

/* ═══ instância vence modelo ═══ */
const especial = [{ id: 'f9', nome: 'Flecha Élfica', modeloId: 'tpl_flecha', quantidade: 1, chanceRecuperar: 95 }];
assert.equal(projeteisCompativeis(especial, CAT, ARCO)[0].chanceRecuperar, 95);

/* ═══ para onde vai o projétil ═══ */
// `rnd` injetado: 0 sempre cai, 0.99 sempre quebra — sem sorte no teste.
assert.deepEqual(destinoDoProjetil({ acertou: true, chanceRecuperar: 60, rnd: () => 0 }),
    { caiu: true, onde: 'alvo', quebrou: false }, 'acertou e sobrou: cai onde o alvo está');
assert.deepEqual(destinoDoProjetil({ acertou: false, chanceRecuperar: 60, rnd: () => 0 }),
    { caiu: true, onde: 'perto', quebrou: false }, 'errou e sobrou: cai por perto');
assert.deepEqual(destinoDoProjetil({ acertou: true, chanceRecuperar: 60, rnd: () => 0.99 }),
    { caiu: false, onde: null, quebrou: true }, 'não sobrou: quebrou, mesmo tendo acertado');

// os extremos são absolutos, não "quase sempre"
assert.equal(destinoDoProjetil({ acertou: true, chanceRecuperar: 100, rnd: () => 0.999 }).caiu, true);
assert.equal(destinoDoProjetil({ acertou: true, chanceRecuperar: 0, rnd: () => 0 }).caiu, false);

/* ═══ gastar do maço ═══ */
assert.deepEqual(gastarUm({ quantidade: 12 }), { acabou: false, restante: 11 });
assert.deepEqual(gastarUm({ quantidade: 1 }), { acabou: true, restante: 0 });
assert.deepEqual(gastarUm({}), { acabou: true, restante: 0 }, 'item avulso vale 1 e acaba');

/* ═══ bordas ═══ */
assert.deepEqual(projeteisCompativeis(null, CAT, ARCO), []);
assert.deepEqual(projeteisCompativeis(INV, null, ARCO), [], 'sem catálogo não há tipo de arma a casar');
assert.deepEqual(municaoDaArma(null, CAT), []);
assert.equal(chanceDe({ chanceRecuperar: 150 }, CAT), 100, 'chance não passa de 100');
assert.equal(chanceDe({ chanceRecuperar: -5 }, CAT), 0, 'nem fica negativa');
// tipoProjetil escrito como texto separado por vírgula também vale
assert.deepEqual(municaoDaArma({ tipoProjetil: 'Flecha, Virote' }, []), ['flecha', 'virote']);

console.log('✅ projeteis: tipo por tag, flecha na aljava conta, maço zerado fora, destino alvo/perto/quebrou e gasto do maço OK');
