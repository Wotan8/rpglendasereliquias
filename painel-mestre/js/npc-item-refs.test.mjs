/**
 * Refs "Item: ..." e "Projétil: ..." no motor de NPC — e o acordo com a ficha.
 *
 * Os dois motores são reimplementações paralelas por design. O que este teste
 * protege não é o cálculo em si: é a IGUALDADE entre eles. Um NPC com a mesma
 * arma de um personagem tem que bater o mesmo dano, senão o mestre e o jogador
 * discutem número no meio da sessão.
 *
 * Roda com: node painel-mestre/js/npc-item-refs.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { calcularNpc } from './npc-calc-engine.js';

/* ---------- 1) Os dois mapas se COMPORTAM igual ----------
   Comparar o texto-fonte seria frágil (um comentário no meio já quebra).
   O que precisa bater é a resposta de cada getter, inclusive nas bordas:
   campo ausente, alias antigo `fio`, e override da instância sobre o modelo. */

const bloco = (src, marca, nome) => {
    const i = src.indexOf(marca);
    assert.ok(i > 0, `bloco "${marca}" não encontrado`);
    return src.slice(i, src.indexOf('\n};', i) + 3).replace(marca.split(' ')[1], nome);
};
const ficha = readFileSync(new URL('../../ficha-v1.7_1/js/mechanics-engine.js', import.meta.url), 'utf8');
const npc = readFileSync(new URL('./npc-calc-engine.js', import.meta.url), 'utf8');

const carrega = codigo => {
    const sandbox = { SAIDA: null };
    vm.createContext(sandbox);
    vm.runInContext(codigo + '\nSAIDA = MAPA_X;', sandbox);
    return sandbox.SAIDA;
};
const mapaFicha = carrega(bloco(ficha, 'const _ME_ITEM_PROPS = {', 'MAPA_X'));
const mapaNpc = carrega(bloco(npc, 'const _NPC_ITEM_PROPS = {', 'MAPA_X'));

assert.deepEqual(Object.keys(mapaNpc).sort(), Object.keys(mapaFicha).sort(),
    'os dois motores expõem propriedades diferentes de item');

const FIXTURES = [
    [{ qualidade: '4', afiacao: 3, peso: 2, tamanho: 1, quantidade: 7 }, {}],
    [{ fio: '2' }, {}],                               // instância no nome antigo
    [{}, { qualidade: '3', afiacao: 1 }],   // valor só no modelo
    [{ qualidade: '1' }, { qualidade: '5' }],          // instância vence modelo
    [{}, {}],                                          // tudo ausente → nunca NaN
    [{ pressaoBase: 4, pressaoOverride: 0.5 }, {}],
];
for (const prop of Object.keys(mapaFicha)) {
    for (const [it, tpl] of FIXTURES) {
        const a = mapaFicha[prop](it, tpl), b = mapaNpc[prop](it, tpl);
        assert.deepEqual(b, a,
            `getter "${prop}" divergiu: ficha=${JSON.stringify(a)} painel=${JSON.stringify(b)} para ${JSON.stringify(it)}`);
    }
}

/* ---------- 2) O NPC resolve Item: e Projétil: de verdade ---------- */

const DV_DANO = { id: 'dvDano', key: 'DANO', nome: 'Dano', escopoItem: 'dano', ordem: 1, publicado: true };
const ATTR_FOR = { id: 'aFor', nome: 'Força', sigla: 'FOR', ordem: 1, publicado: true };

const TPL_ESPADA = { id: 'tplEspada', nome: 'Espada Longa', formulaDano: '1d8', qualidade: '4', afiacao: 3 };
const TPL_ARCO = { id: 'tplArco', nome: 'Arco Longo', formulaDano: '1d10' };
const TPL_FLECHA = { id: 'tplFlecha', nome: 'Flecha de Guerra', qualidade: '2', afiacao: 2 };

const sys = {
    attributes: [ATTR_FOR], derivedValues: [DV_DANO], skills: [], vitalStats: [],
    equipment: [TPL_ESPADA, TPL_ARCO, TPL_FLECHA],
    mechsById: {}, pecsById: {}, classesById: {}
};

/** NPC com um item equipado que soma Dano por uma Equação de Valor. */
function danoDoItem(equacao, itens) {
    // equipado + estado válido = o item entra com Efeitos Ativos (_npcItemFormas)
    const items = itens.map(i => ({ equipado: true, estadoEquip: 'empunhado', ...i }));
    const alvo = items[0];
    alvo.valoresDerivadosVinculados = [{ id: 'dvDano', equacao }];
    const r = calcularNpc(
        { nivel: 1, atributos: [{ refId: 'aFor', valor: 4 }], periciasEstruturadas: [], peculiaridades: [] },
        sys, { items }
    );
    const linha = r.porItem.find(p => p.itemId === alvo.id);
    return { dano: linha ? linha.dano : null, avisos: r.avisos };
}

const REF = r => ({ tipo: 'ficha', ref: r });

// Espada: Qualidade 4 + Afiação 3 = +7 no dado
{
    const { dano, avisos } = danoDoItem(
        [REF('Item: Qualidade'), { op: '+', ...REF('Item: Afiação') }],
        [{ id: 'w1', nome: 'Espada Longa', modeloId: 'tplEspada' }]
    );
    assert.equal(dano, '1d8+7', 'Item: Qualidade/Afiação devem resolver contra o item em escopo');
    assert.ok(![...avisos].some(a => a.includes('Item:')), `refs Item: não podem gerar aviso: ${[...avisos]}`);
}

// Arco apontando o maço: o poder vem da ponta, não da arma
{
    const { dano } = danoDoItem(
        [REF('Projétil: Qualidade'), { op: '+', ...REF('Projétil: Afiação') }],
        [{ id: 'w1', nome: 'Arco Longo', modeloId: 'tplArco', projetilId: 'p1' },
         { id: 'p1', nome: 'Flecha de Guerra', modeloId: 'tplFlecha', quantidade: 20 }]
    );
    assert.equal(dano, '1d10+4', 'Projétil: deve ler o maço apontado (Qualidade 2 + Afiação 2)');
}

// Arco sem maço apontado dispara só o dado — e sem NaN
{
    const { dano } = danoDoItem(
        [REF('Projétil: Qualidade'), { op: '+', ...REF('Projétil: Afiação') }],
        [{ id: 'w1', nome: 'Arco Longo', modeloId: 'tplArco' }]
    );
    assert.equal(dano, '1d10', 'sem projétil apontado, a arma dispara só o dado');
}

// O fold do min (Domínio) também vale no painel do mestre
{
    const { dano } = danoDoItem(
        [REF('Item: Qualidade'), { op: '+', ...REF('Item: Afiação') }, { op: 'min', valor: 2 }, { op: '+', valor: 4 }],
        [{ id: 'w1', nome: 'Espada Longa', modeloId: 'tplEspada' }]
    );
    assert.equal(dano, '1d8+6', 'min(4+3, 2) + 4 = 6 — o teto do Domínio morde igual');
}

console.log('✅ NPC resolve Item:/Projétil: e concorda com a ficha');
