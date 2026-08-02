// Rodar: node shared/livros-pub.test.mjs
// O que se protege aqui é o LEGADO: livro salvo antes das quatro publicações
// não pode mudar de lugar sozinho — `public: true` aparecia na ficha só para
// quem tinha vínculo, e é assim que tem que continuar.
import assert from 'node:assert/strict';
import { pubDoLivro, livroNaFicha, livroDoMestre } from './livros-pub.js';

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

console.log('✅ livros-pub: legado preservado e as quatro publicações separadas');
