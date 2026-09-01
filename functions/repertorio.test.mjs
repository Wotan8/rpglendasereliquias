// Rodar: node functions/repertorio.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { assinaturaDeEfeito, ehMesmaLinha, acharLinha, empilhar } = require('./repertorio.js');

// ===== O CASO QUE ISTO EXISTE PARA IMPEDIR =====
// Mestre cadastra duas pecas de mesmo nome: uma bugiganga e um pacote de EXP.
// Comprar a bugiganga NAO pode somar unidade na linha do pacote.
const pacote   = { nome: 'Bênção', isExp: true, expAmount: 500 };
const bugiganga= { nome: 'Bênção' };
const inv0 = [{ ...pacote, quantidade: 1 }];

const depois = empilhar(inv0, bugiganga, { quantidade: 1 });
assert.equal(depois.length, 2, 'itens diferentes de mesmo nome viram DUAS linhas');
assert.equal(depois[0].quantidade, 1, 'a linha do pacote de EXP nao encostou');
assert.equal(depois.find(l => !l.isExp).quantidade, 1);
// e o inventario original nao foi tocado
assert.equal(inv0.length, 1);

// ===== o que E a mesma coisa continua empilhando =====
const maisUm = empilhar([{ ...pacote, quantidade: 2 }], pacote, { quantidade: 3 });
assert.equal(maisUm.length, 1);
assert.equal(maisUm[0].quantidade, 5);

// ===== id manda quando os dois lados tem =====
// O mestre corrigiu o nome no catalogo; a linha e a mesma.
assert.equal(ehMesmaLinha({ itemId: 'a1', nome: 'Nome Velho' }, { nome: 'Nome Novo' }, 'a1'), true);
// ids diferentes nao se juntam nem com nome igual
assert.equal(ehMesmaLinha({ itemId: 'a1', nome: 'X' }, { nome: 'X' }, 'a2'), false);
// so um lado com id: cai no nome + efeito
assert.equal(ehMesmaLinha({ nome: 'X' }, { nome: 'X' }, 'a1'), true);
assert.equal(ehMesmaLinha({ itemId: 'a1', nome: 'X' }, { nome: 'X' }, ''), true);

// linha antiga aprende o id ao ser reempilhada
const aprendeu = empilhar([{ nome: 'X', quantidade: 1 }], { nome: 'X' }, { quantidade: 1, itemId: 'a1' });
assert.equal(aprendeu.length, 1);
assert.equal(aprendeu[0].itemId, 'a1');
assert.equal(aprendeu[0].quantidade, 2);

// ===== assinatura: ausente, nulo e falso sao a mesma coisa =====
assert.equal(assinaturaDeEfeito({}), assinaturaDeEfeito({ isExp: false }));
assert.equal(assinaturaDeEfeito({}), assinaturaDeEfeito({ isExp: null, expAmount: '' }));
assert.notEqual(assinaturaDeEfeito({ isExp: true, expAmount: 50 }), assinaturaDeEfeito({ isExp: true, expAmount: 500 }));
assert.notEqual(assinaturaDeEfeito({ isExpVip: true, isExp: true, expAmount: 50 }),
                assinaturaDeEfeito({ isExp: true, expAmount: 50 }), 'VIP e outro item');
assert.notEqual(assinaturaDeEfeito({ isRoleta: true, roletaGiros: 1 }), assinaturaDeEfeito({ isRoleta: true, roletaGiros: 3 }));

// texto e numero do mesmo valor contam como iguais (o cadastro grava dos dois jeitos)
assert.equal(assinaturaDeEfeito({ isExp: true, expAmount: 50 }), assinaturaDeEfeito({ isExp: true, expAmount: '50' }));

// ZERO e AUSENTE sao a mesma coisa. O cadastro grava expAmount:0 / roletaGiros:0
// em item que nao concede nada; a linha antiga do jogador nao tem o campo.
// Sem isto, 19 das 30 linhas do banco se partiriam em duas na proxima recompra.
assert.equal(assinaturaDeEfeito({ expAmount: 0, roletaGiros: 0, rerolagensAmount: 0 }), assinaturaDeEfeito({}));
assert.equal(assinaturaDeEfeito({ expAmount: '0' }), assinaturaDeEfeito({}));
const cat = { nome: 'Vale-Compra', expAmount: 0, roletaGiros: 0, rerolagensAmount: 0 };
const linhaVelha = { nome: 'Vale-Compra', quantidade: 2 };
assert.equal(empilhar([linhaVelha], cat, { quantidade: 1 }).length, 1, 'linha antiga nao se parte ao recomprar');

// ...mas 0 e 1 continuam sendo coisas diferentes
assert.notEqual(assinaturaDeEfeito({ isRerolagem: true, rerolagensAmount: 1 }), assinaturaDeEfeito({ rerolagensAmount: 0 }));

// ===== descricao e imagem NAO partem a linha =====
// Corrigir um texto no catalogo nao pode partir o Repertorio de ninguem em dois.
const comTexto = empilhar([{ nome: 'X', descricao: 'antiga', quantidade: 1 }],
                          { nome: 'X', descricao: 'corrigida' }, { quantidade: 1 });
assert.equal(comTexto.length, 1);
assert.equal(comTexto[0].quantidade, 2);
assert.equal(comTexto[0].descricao, 'antiga', 'a linha existente manda no texto');

// ===== bordas =====
assert.equal(empilhar(null, { nome: 'X' }, {}).length, 1, 'inventario nulo nao explode');
assert.equal(empilhar([], { nome: 'X' }, { quantidade: 0 })[0].quantidade, 1, 'quantidade minima e 1');
assert.equal(empilhar([], { nome: 'X' }, { quantidade: -5 })[0].quantidade, 1);
assert.equal(acharLinha([], { nome: 'X' }), -1);
assert.equal(ehMesmaLinha(null, { nome: 'X' }), false);
assert.equal(ehMesmaLinha({ nome: 'X' }, null), false);

// formaRecebimento entra so na linha nova
const nova = empilhar([], { nome: 'X' }, { formaRecebimento: 'Prêmio da Roleta' });
assert.equal(nova[0].formaRecebimento, 'Prêmio da Roleta');

console.log('repertorio.test.mjs: OK');
