// Rodar: node mapa-conflito/js/conflito-dados.test.mjs
import assert from 'node:assert/strict';
import { lerHabilidade, agruparPorAcao, habilidadesDaClasse, norm, SEM_ACAO } from './conflito-dados.js';

/* Fixtures com o formato REAL do banco (copiado de system/data/classModules).
   O ponto do teste: chaves numéricas fora de ordem, rótulo "Ação:" com chave
   'acao' anexada depois, e valores de Teste que são id de perícia. */
const mapas = {
    pericias: { KfTc5BpUE0u7qedNrjsX: 'Fé' },
    condicoes: { cond_atordoado: 'Atordoado' },
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
assert.equal(h.teste, 'Fé -3', 'id de perícia resolvido + redutor colado');
assert.equal(h.falha, 'Só +1 de Blindagem.');
assert.equal(h.duracao, '1 cena', 'campo estruturado ganha do schema');
assert.equal(h.efeito, luz.descricao, 'descricao tem prioridade sobre o campo Efeito');
assert.equal(h.razao, 1.02);
assert.equal(h.alcance, null, 'formaArea "nenhuma" não vira alcance');

// --- id que não resolve NUNCA vaza cru para a tela ---
const semMapa = lerHabilidade(bispo, luz, {});
assert.equal(semMapa.teste, null, 'perícia desconhecida some, não vira hash na tela');

// --- a armadilha: "Alcance/Raio/Duração:" casa com /alcance/ E com /dura/ ---
const armadilha = lerHabilidade(
    { titulo: 'M', schema: [{ key: 'a', label: 'Alcance/Raio/Duração:' }] },
    { nome: 'X', valores: { a: '15m · 1 cena' } }, mapas);
assert.equal(armadilha.alcance, '15m · 1 cena');
assert.equal(armadilha.duracao, null, 'o rótulo composto não pode virar duração também');

// --- condições viram nome; as desconhecidas caem fora ---
const comCond = lerHabilidade(bispo,
    { ...luz, condicoesAplicadas: ['cond_atordoado', { id: 'cond_atordoado' }, 'fantasma'] }, mapas);
assert.deepEqual(comCond.condicoes, ['Atordoado', 'Atordoado'], 'aceita id cru e objeto; ignora o que não existe');

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

console.log('✅ conflito-dados: todos os asserts passaram.');
