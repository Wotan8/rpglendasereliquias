/**
 * 🎯 O Alvo de uma linha de ataque sai da coluna que O ITEM alimenta.
 *
 * O que a mesa pegou: a Rabeca empunhada não aparecia em ⚔️ ATAQUES. Faltava
 * cadastro (nenhum instrumento tinha fórmula de dano) — mas havia um segundo
 * furo esperando logo atrás: `colunaDeAcerto` escolhia a coluna pelo TIPO da
 * linha, então tudo que não fosse arco nem soco caía em "Acerto Corpo a
 * Corpo". A rabeca cadastrada mostraria o Alvo errado, quase sempre 0.
 *
 * A regra nova é o cadastro falando: a espada vincula Acerto Corpo a Corpo, o
 * arco vincula Acerto à Distância, o instrumento vincula Acerto Mágico — vale
 * a coluna que o item mexeu.
 *
 * Roda com: node tabuleiro/js/tab-coluna-acerto.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./tab-ficha-win.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('function colunaDeAcerto(');
assert.ok(ini > 0, 'colunaDeAcerto não encontrada');
const sb = {}; vm.createContext(sb);
vm.runInContext(src.slice(ini, src.indexOf('\n}\n', ini) + 3), sb);
const escolhe = (l) => { sb.l = l; vm.runInContext('x = JSON.stringify(colunaDeAcerto(l) || null)', sb); return JSON.parse(sb.x); };

/** As cinco colunas de acerto, como chegam da ficha. `bonus` é o que o item somou. */
const cols = (bonusPorNome = {}) => [
    'Acerto', 'Acerto Corpo a Corpo', 'Acerto à Distância', 'Acerto Desarmado', 'Acerto Mágico',
].map(nome => ({ nome, base: 4, bonus: bonusPorNome[nome] || 0, total: 4 + (bonusPorNome[nome] || 0) }));

/* ===== o caso novo: a Rabeca ===== */
const rabeca = { nome: 'Rabeca', colunas: cols({ 'Acerto Mágico': 3 }) };
assert.equal(escolhe(rabeca).nome, 'Acerto Mágico',
    '🔒 instrumento entrega por Acerto Mágico — era aqui que caía em Corpo a Corpo');

/* ===== e as armas continuam iguais ===== */
assert.equal(escolhe({ nome: 'Estilete', colunas: cols({ 'Acerto Corpo a Corpo': 2 }) }).nome, 'Acerto Corpo a Corpo');
assert.equal(escolhe({ nome: 'Arco Longo', distancia: true, colunas: cols({ 'Acerto à Distância': 5 }) }).nome, 'Acerto à Distância');

/* ===== item que não alimenta nada: vale o tipo da linha, como sempre ===== */
assert.equal(escolhe({ nome: 'Cabeça', desarmado: true, colunas: cols() }).nome, 'Acerto Desarmado');
assert.equal(escolhe({ nome: 'Pedra', colunas: cols() }).nome, 'Acerto Corpo a Corpo');
assert.equal(escolhe({ nome: 'Funda', distancia: true, colunas: cols() }).nome, 'Acerto à Distância');

/* ===== bônus NEGATIVO também é vínculo: peça ruim piora o acerto dela ===== */
assert.equal(escolhe({ nome: 'Alaúde Rachado', colunas: cols({ 'Acerto Mágico': -1 }) }).nome, 'Acerto Mágico',
    'penalidade é o item falando tanto quanto bônus');

/* ===== duas colunas alimentadas: desempata pelo tipo da linha ===== */
const hibrida = { nome: 'Lâmina Cantante', colunas: cols({ 'Acerto Mágico': 2, 'Acerto Corpo a Corpo': 3 }) };
assert.equal(escolhe(hibrida).nome, 'Acerto Corpo a Corpo', 'linha corpo a corpo desempata para a sua');
assert.equal(escolhe({ ...hibrida, distancia: true }).nome, 'Acerto Corpo a Corpo',
    'nenhuma das alimentadas é "à Distância": fica a PRIMEIRA alimentada, nunca uma coluna que o item não tocou');

/* ===== sem coluna específica sobra o "Acerto" genérico ===== */
const soGenerico = [{ nome: 'Acerto', base: 6, bonus: 0, total: 6 }];
assert.equal(escolhe({ nome: 'Improviso', colunas: soGenerico }).nome, 'Acerto');
assert.equal(escolhe({ nome: 'Nada', colunas: [] }), null, 'sem coluna nenhuma não inventa Alvo');

/* ===== NPC: as colunas do motor não trazem `bonus` — não pode quebrar ===== */
const npc = { nome: 'Garra', colunas: [{ nome: 'Acerto Corpo a Corpo', total: 7 }, { nome: 'Acerto Mágico', total: 2 }] };
assert.equal(escolhe(npc).nome, 'Acerto Corpo a Corpo', 'sem bonus declarado, vale o tipo da linha (comportamento antigo)');

console.log('✅ coluna de acerto OK — vale o vínculo do item, e sem vínculo vale o tipo da linha');
