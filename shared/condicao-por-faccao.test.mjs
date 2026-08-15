// Rodar: node shared/condicao-por-faccao.test.mjs
//
// O caso que a mesa pegou: COMPOSIÇÃO DE BATALHA diz "Escolha na conjuração:
// todos os aliados no raio ficam Fortalecido 2, OU todos os inimigos ficam
// Abalado 2". A onda pegou um aliado e um inimigo, e os DOIS ficaram
// Fortalecido.
//
// Eram três furos empilhados:
//   1. a condição não tinha facção própria — quem a área pegava, recebia;
//   2. não havia "ou": a lista inteira era aplicada de uma vez;
//   3. o nível ("2") se perdia — tudo entrava em 1.
//
// Este teste tranca os três na decisão pura, com o cadastro real.
import assert from 'node:assert/strict';
import { miraDeCadastro, afetaDaCondicao, rotuloDaCondicao } from './skill-runtime.js';
import { alvoValido } from './combate-cenas.js';

/* O pré-definido como ficou no banco depois da migração. */
const COMPOSICAO = {
    nome: 'COMPOSIÇÃO DE BATALHA [Qualquer]',
    descricao: 'Escolha na conjuração: todos os aliados no raio ficam Fortalecido 2, ou todos os inimigos ficam Abalado 2, pela cena.',
    formaArea: 'onda', tamanhoArea: 4, faccao: 'ambos',
    condicoesExclusivas: true,
    condicoesAplicadas: [
        { condicao: 'Fortalecido', nivel: 2, faccao: 'aliado',  alvos: 3, rodadas: 5 },
        { condicao: 'Abalado',     nivel: 2, faccao: 'inimigo', alvos: 3, rodadas: 5 },
    ],
};

const m = miraDeCadastro(COMPOSICAO);
assert.ok(m, 'a mira tem de sair do cadastro');
assert.equal(m.afeta, 'todos', 'a ONDA continua varrendo os dois lados — quem separa é a condição');
assert.equal(m.condicoes.length, 2);
assert.equal(m.condicoesExclusivas, true, '"Escolha na conjuração" = uma OU a outra');

const [forte, abalo] = m.condicoes;
assert.equal(forte.nome, 'Fortalecido');
assert.equal(forte.faccao, 'aliado');
assert.equal(forte.nivel, 2, 'o "2" do cadastro tem de chegar ao Tabuleiro');
assert.equal(abalo.faccao, 'inimigo');
assert.equal(abalo.nivel, 2);

/* ===== a separação em si: a cena do relato ===== */
const MINHA = 'jogadores';
const NA_ONDA = [
    { nome: 'Umbe, o Que Empresta a Pele', faccao: 'jogadores' },   // aliado
    { nome: 'Avulso Inimigo',              faccao: 'inimigos' },
];
const alcanca = (cd) => {
    const afeta = afetaDaCondicao(cd);
    return NA_ONDA.filter(o => !afeta || alvoValido(afeta, MINHA, o.faccao)).map(o => o.nome);
};

assert.deepEqual(alcanca(forte), ['Umbe, o Que Empresta a Pele'],
    '🔒 Fortalecido NÃO pode encostar no inimigo — foi exatamente o bug relatado');
assert.deepEqual(alcanca(abalo), ['Avulso Inimigo'],
    '🔒 e Abalado não pode encostar no aliado');

/* ===== condição sem facção continua valendo para quem a área pegou ===== */
assert.equal(afetaDaCondicao({ nome: 'Atordoado' }), null);
assert.deepEqual(alcanca({ nome: 'Atordoado' }), NA_ONDA.map(o => o.nome),
    'sem facção declarada nada muda: o comportamento antigo segue valendo');

/* ===== o rótulo do picker diz em quem cai ===== */
assert.equal(rotuloDaCondicao(forte), 'Fortalecido nos aliados',
    'sem rótulo cadastrado, o texto sai do nome + facção');
assert.equal(rotuloDaCondicao({ ...abalo, rotulo: 'Abalado 2 nos inimigos' }), 'Abalado 2 nos inimigos',
    'rótulo cadastrado vence');

/* ===== exclusividade exige mais de uma: uma só não vira pergunta ===== */
const umaSo = miraDeCadastro({ ...COMPOSICAO, condicoesAplicadas: [COMPOSICAO.condicoesAplicadas[0]] });
assert.equal(umaSo.condicoesExclusivas, false, 'com uma condição só não há escolha a fazer');

/* ===== nível: ausente vale 1, e nunca 0 ===== */
const semNivel = miraDeCadastro({ ...COMPOSICAO, condicoesAplicadas: [{ condicao: 'Cego', alvos: 1, rodadas: 1 }] });
assert.equal(semNivel.condicoes[0].nivel, 1, 'cadastro antigo sem nível continua entrando em 1');
const nivelZero = miraDeCadastro({ ...COMPOSICAO, condicoesAplicadas: [{ condicao: 'Cego', nivel: 0 }] });
assert.equal(nivelZero.condicoes[0].nivel, 1, 'nível 0 não existe — condição aplicada é pelo menos 1');

console.log('✅ condição por facção OK — Fortalecido no aliado, Abalado no inimigo, e uma de cada vez');
