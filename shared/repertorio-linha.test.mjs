// Rodar: node shared/repertorio-linha.test.mjs
//
// Este arquivo tem duas tarefas. A segunda é a que importa:
//
//   1. testar a regra do lado do navegador;
//   2. provar que ela diz A MESMA COISA que `functions/repertorio.js`.
//
// São dois arquivos porque `functions/` sobe para o Cloud Functions sem a pasta
// `shared/` e é CommonJS — não há import possível entre eles. Duas cópias da
// mesma regra divergem em silêncio, e aqui a divergência vira teste vermelho.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { assinaturaDeEfeito, ehMesmaLinha, empilhar, consolidar, CAMPOS_DE_EFEITO } from './repertorio-linha.js';

const require = createRequire(import.meta.url);
const servidor = require('../functions/repertorio.js');

// ===== A REGRA =====
const pacote = { nome: 'Bênção', isExp: true, expAmount: 500 };
const bugiganga = { nome: 'Bênção' };
assert.equal(ehMesmaLinha(pacote, bugiganga), false, 'mesmo nome, efeitos diferentes: itens diferentes');
assert.equal(ehMesmaLinha(pacote, { ...pacote }), true);
assert.equal(ehMesmaLinha({ itemId: 'a', nome: 'X' }, { itemId: 'a', nome: 'Y' }), true, 'id manda');
assert.equal(ehMesmaLinha({ itemId: 'a', nome: 'X' }, { itemId: 'b', nome: 'X' }), false);
assert.equal(ehMesmaLinha(null, pacote), false);

// zero e ausente sao a mesma coisa (o catalogo grava expAmount: 0)
assert.equal(assinaturaDeEfeito({ expAmount: 0, roletaGiros: 0 }), assinaturaDeEfeito({}));

// ===== empilhar (o painel do mestre usa) =====
const inv = [{ nome: 'Poção', quantidade: 2 }];
assert.equal(empilhar(inv, { nome: 'Poção', quantidade: 3 })[0].quantidade, 5);
assert.equal(empilhar(inv, { nome: 'Poção', quantidade: 3 }).length, 1);
assert.equal(inv[0].quantidade, 2, 'o original nao e tocado');
assert.equal(empilhar(inv, { nome: 'Outra', quantidade: 1 }).length, 2);
assert.equal(empilhar(inv, { nome: 'Poção', isExp: true, expAmount: 9, quantidade: 1 }).length, 2,
    'homonimo com efeito abre linha propria');
assert.equal(empilhar(inv, { nome: 'Poção' })[0].quantidade, 3, 'quantidade ausente vale 1');
assert.equal(empilhar(null, { nome: 'X', quantidade: 1 }).length, 1);

// ===== consolidar (a faxina de linhas repetidas) =====
const tresEXP = [
    { nome: 'EXP', quantidade: 2, isExp: true, expAmount: 2 },
    { nome: 'Amuleto', quantidade: 1 },
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
];
const junto = consolidar(tresEXP);
assert.equal(junto.length, 2, 'as tres linhas de EXP viram uma');
assert.equal(junto.find(l => l.nome === 'EXP').quantidade, 4, 'e a soma esta certa');
assert.equal(junto.find(l => l.nome === 'Amuleto').quantidade, 1);
assert.equal(tresEXP.length, 4, 'o original nao e tocado');

// homonimo com outro efeito NAO se junta
const homonimos = [
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 2 },
    { nome: 'EXP', quantidade: 1, isExp: true, expAmount: 500 },
];
assert.equal(consolidar(homonimos).length, 2, 'consolidar nao pode fundir o que e diferente');
assert.equal(consolidar([]).length, 0);
assert.equal(consolidar(null).length, 0);

// ===== OS GEMEOS DIZEM A MESMA COISA =====
assert.deepEqual(CAMPOS_DE_EFEITO, servidor.CAMPOS_DE_EFEITO, 'a lista de campos de efeito divergiu');

const amostras = [
    {}, { isExp: true }, { isExp: true, expAmount: 50 }, { isExp: true, expAmount: '50' },
    { expAmount: 0 }, { expAmount: '0' }, { roletaGiros: 3, isRoleta: true },
    { isRerolagem: true, rerolagensAmount: 1 }, { rerolagensAmount: 0 },
    { isNarrativo: true }, { isItemPersonagem: true }, { isExpVip: true, isExp: true, expAmount: 1 },
    { isExp: null }, { isExp: false }, { isExp: '' }, { nome: 'só nome' },
];
for (const a of amostras) {
    assert.equal(assinaturaDeEfeito(a), servidor.assinaturaDeEfeito(a),
        'assinatura divergiu entre navegador e servidor para ' + JSON.stringify(a));
}
for (const a of amostras) for (const b of amostras) {
    assert.equal(
        ehMesmaLinha({ nome: 'X', ...a }, { nome: 'X', ...b }),
        servidor.ehMesmaLinha({ nome: 'X', ...a }, { nome: 'X', ...b }, ''),
        `ehMesmaLinha divergiu para ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}

console.log(`repertorio-linha.test.mjs: OK (gêmeos conferidos em ${amostras.length * amostras.length} pares)`);
