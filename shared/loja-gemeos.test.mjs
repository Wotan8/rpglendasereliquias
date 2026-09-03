// Rodar: node shared/loja-gemeos.test.mjs
import assert from 'node:assert/strict';
import { nomeBase, gemeosDoCatalogo, idsGemeos } from './loja-gemeos.js';

// ===== nome base =====
assert.equal(nomeBase('Desejo Narrativo 1x'), 'desejo narrativo');
assert.equal(nomeBase('Desejo Narrativo'), 'desejo narrativo');
assert.equal(nomeBase('Manter Inventário 1x'), 'manter inventario', 'acento não separa');
assert.equal(nomeBase('Roleta 3×'), 'roleta', 'o × de multiplicação também');
assert.equal(nomeBase('  Salvar  da   Morte  '), 'salvar da morte', 'espaço sobrando não separa');
assert.equal(nomeBase('Poção 3'), 'poção 3'.normalize('NFD').replace(/\p{Diacritic}/gu, ''),
    'número solto no fim NÃO é sufixo de quantidade');
assert.equal(nomeBase(null), '');

// ===== os pares reais do catálogo em 02/09/2026 =====
const CATALOGO = [
    { id: 'MG2Nb', nome: 'Desejo Narrativo', isNarrativo: true },
    { id: 'vCbXi', nome: 'Desejo Narrativo 1x', isNarrativo: true },
    // Nome parecido, efeito DIFERENTE: produtos legítimos, não são gêmeos.
    { id: '6G0C6', nome: 'Roleta 3x', isRoleta: true, roletaGiros: 3 },
    { id: 'XmMaX', nome: 'Roleta 1x', isRoleta: true, roletaGiros: 1 },
    // Sem efeito nenhum: fora do julgamento (o que os separa é a descrição).
    { id: '6zAvS', nome: 'Manter Inventário' },
    { id: 'WA7gm', nome: 'Manter Inventário 1x' },
    { id: 'o9dhY', nome: 'Salvar da Morte' },
    { id: 'jyLN0', nome: 'Salvar da Morte 1x' },
];

const g = gemeosDoCatalogo(CATALOGO);
assert.equal(g.length, 1, 'um par indistinguível, e só');
assert.equal(g[0].base, 'desejo narrativo');
assert.deepEqual(g[0].itens.map(i => i.id).sort(), ['MG2Nb', 'vCbXi']);

assert.deepEqual([...idsGemeos(CATALOGO)].sort(), ['MG2Nb', 'vCbXi']);

// Roleta 3x/1x fora — este é o falso positivo que um detector por nome daria,
// e aviso falso é aviso que o criador aprende a ignorar.
assert.ok(!idsGemeos(CATALOGO).has('6G0C6'));
assert.ok(!idsGemeos(CATALOGO).has('XmMaX'));

// ===== casos de borda =====
assert.deepEqual(gemeosDoCatalogo([]), []);
assert.deepEqual(gemeosDoCatalogo(null), []);
assert.deepEqual(gemeosDoCatalogo([{ nome: 'Só um', isExp: true, expAmount: 10 }]), []);
assert.deepEqual(gemeosDoCatalogo([{ isExp: true, expAmount: 10 }]), [], 'item sem nome é ignorado');

// Nome IGUAL e efeito igual também é gêmeo — é o caso mais óbvio.
const iguais = [
    { id: 'a', nome: 'Pacote', isExp: true, expAmount: 50 },
    { id: 'b', nome: 'Pacote', isExp: true, expAmount: 50 },
];
assert.equal(gemeosDoCatalogo(iguais).length, 1);

// Nome igual e efeito diferente NÃO é gêmeo: são dois produtos, e foi
// justamente para isso que o empilhamento passou a olhar o efeito.
const nomeIgualEfeitoOutro = [
    { id: 'a', nome: 'Pacote', isExp: true, expAmount: 50 },
    { id: 'b', nome: 'Pacote', isExp: true, expAmount: 500 },
];
assert.deepEqual(gemeosDoCatalogo(nomeIgualEfeitoOutro), []);

// Três do mesmo cai num grupo só, não em três pares.
const tres = [
    { id: 'a', nome: 'Eco', isRerolagem: true, rerolagensAmount: 1 },
    { id: 'b', nome: 'Eco 1x', isRerolagem: true, rerolagensAmount: 1 },
    { id: 'c', nome: 'Eco 1×', isRerolagem: true, rerolagensAmount: 1 },
];
assert.equal(gemeosDoCatalogo(tres).length, 1);
assert.equal(gemeosDoCatalogo(tres)[0].itens.length, 3);

console.log('loja-gemeos: ok');
