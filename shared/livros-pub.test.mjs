// Rodar: node shared/livros-pub.test.mjs
// O que se protege aqui é o LEGADO: livro salvo antes das quatro publicações
// não pode mudar de lugar sozinho — `public: true` aparecia na ficha só para
// quem tinha vínculo, e é assim que tem que continuar.
import assert from 'node:assert/strict';
import { pubDoLivro, livroNaFicha, livroDoMestre, versaoDoLivro } from './livros-pub.js';

// --- legado ---
assert.deepEqual(pubDoLivro({ public: true }), { geral: false, conhGeral: false, conhVinculo: true, mestre: true });
assert.deepEqual(pubDoLivro({ public: false }), { geral: false, conhGeral: false, conhVinculo: false, mestre: true });
assert.equal(livroNaFicha({ public: true }, true), true, 'legado público + vínculo = aparece');
assert.equal(livroNaFicha({ public: true }, false), false, 'legado público sem vínculo = não aparece');
assert.equal(livroDoMestre({ public: false }), true, 'o mestre sempre enxergou os livros antigos');

// --- as quatro publicações ---
const so = (k) => ({ pub: { [k]: true } });
assert.equal(livroNaFicha(so('conhGeral'), false), true);
assert.equal(livroNaFicha(so('conhVinculo'), false), false);
assert.equal(livroNaFicha(so('conhVinculo'), true), true);
assert.equal(livroNaFicha(so('geral'), false), true, 'geral é em todo lugar, ficha inclusive');
assert.equal(livroNaFicha(so('mestre'), true), false, 'publicação de mestre não vaza para a ficha');
assert.equal(livroDoMestre(so('mestre')), true);
assert.equal(livroDoMestre(so('geral')), true);
assert.equal(livroDoMestre(so('conhGeral')), false, 'livro só de jogador não polui a lista do mestre');

// --- `pub` presente manda, mesmo contradizendo o campo antigo ---
assert.equal(livroNaFicha({ public: true, pub: {} }, true), false);

// --- versão: o selo tem que ser IDÊNTICO nas sete telas que listam livro ---
assert.equal(versaoDoLivro({ versao: '2' }), 'v2', 'número puro ganha o v');
assert.equal(versaoDoLivro({ versao: '2.1' }), 'v2.1');
assert.equal(versaoDoLivro({ versao: ' 3 ' }), 'v3', 'espaço sobrando não vira selo torto');
assert.equal(versaoDoLivro({ versao: 2 }), 'v2', 'número, não string');
assert.equal(versaoDoLivro({ versao: 'v2' }), 'v2', 'autor que já escreveu o v não ganha "vv2"');
assert.equal(versaoDoLivro({ versao: 'V2' }), 'V2', 'a caixa do autor é respeitada');
assert.equal(versaoDoLivro({ versao: 'Ed. revista' }), 'Ed. revista', 'texto do autor passa inteiro');
assert.equal(versaoDoLivro({ versao: 'Édition 2' }), 'Édition 2', 'acento no começo também é letra');

// Livro sem versão NÃO desenha selo — os 13 que já existem não podem
// nascer com "v" ou "v1" que o autor nunca escreveu.
assert.equal(versaoDoLivro({}), '', 'livro antigo fica sem selo');
assert.equal(versaoDoLivro({ versao: '' }), '');
assert.equal(versaoDoLivro({ versao: '   ' }), '', 'só espaço é o mesmo que vazio');
assert.equal(versaoDoLivro({ versao: null }), '');
assert.equal(versaoDoLivro(null), '', 'sem livro não quebra');
assert.equal(versaoDoLivro(undefined), '');

console.log('✅ livros-pub: legado preservado, quatro publicações separadas e selo de versão');
