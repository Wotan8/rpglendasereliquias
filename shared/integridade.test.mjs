// Rodar: node --test shared/integridade.test.mjs
//
// INTEGRIDADE — quanto a peça aguenta antes de parar de servir.
// Faixa: round((Liga + Tamanho×3) × 3), mínimo 3 — Tamanho em METROS, e o ×3
// é a cascata do §2.8 (Tamanho do personagem = Altura × 3). Grava-se `avaria`
// (dano acumulado), nunca "quanto resta".
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    integridadeMax, integridadeDe, integridadeZerada,
    perdaSobrecarga, perdaFalhaCritica, cabeNoConteiner, GATILHO, desgastarConteiner,
} from './inventario-motor.js';

const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} ≠ ${b}`);

// ===== A FAIXA =====

test('a faixa sai de round((Liga + Tamanho×3) × 3), Tamanho em metros', () => {
    // Adaga: liga 2, 0,30 m — as âncoras do Livro §5
    assert.equal(integridadeMax({ liga: 2, tamanho: 0.3 }), 9);
    // Espada longa: liga 3, 1,20 m
    assert.equal(integridadeMax({ liga: 3, tamanho: 1.2 }), 20);
    // Armadura completa: liga 3, 1,70 m — mesma escala do corpo que veste
    assert.equal(integridadeMax({ liga: 3, tamanho: 1.7 }), 24);
    // Mochila Média de Couro: liga 2, 0,60 m
    assert.equal(integridadeMax({ liga: 2, tamanho: 0.6 }), 11);
});

test('arredonda para o inteiro mais próximo', () => {
    // (2 + 0,9) × 3 = 8,7 → 9; (5 + 4,5) × 3 = 28,5 → 29
    assert.equal(integridadeMax({ liga: 5, tamanho: 1.5 }), 29);
    assert.ok(Number.isInteger(integridadeMax({ liga: 2, tamanho: 0.37 })));
});

test('Liga ausente lê 1 (Bruta), não 0', () => {
    // §5.5: Liga 0 é "improvisada — pedra, galho". Peça de catálogo não é.
    assert.equal(integridadeMax({ tamanho: 1 }), 12, 'sem liga = Bruta');
    // Liga 0 DECLARADA é outra coisa: improvisada — só o porte segura
    assert.equal(integridadeMax({ liga: 0, tamanho: 1 }), 9, 'galho de 1 m');
});

test('nunca abaixo de 3', () => {
    assert.equal(integridadeMax({ liga: 0, tamanho: 0.1 }), 3, 'caco de 10 cm cai no piso');
    assert.equal(integridadeMax({ liga: 0, tamanho: 0 }), 9, 'tamanho 0/vazio lê o padrão de 1 m');
    assert.equal(integridadeMax({}), 12, 'sem nada: liga 1 + tamanho 1 m');
});

test('integridadeBase do cadastro vence a derivação', () => {
    assert.equal(integridadeMax({ liga: 1, tamanho: 1, integridadeBase: 40 }), 40);
    assert.equal(integridadeMax({ liga: 1, tamanho: 1 }, { integridadeBase: 40 }), 40, 'e herda do modelo');
});

// ===== AVARIA, NÃO "QUANTO RESTA" =====

test('o que resta é o máximo menos a avaria', () => {
    const m = { liga: 2, tamanho: 0.6, avaria: 5 };
    assert.equal(integridadeDe(m), 6);
    assert.equal(integridadeZerada(m), false);
});

test('avaria além do máximo não vira negativo', () => {
    const m = { liga: 1, tamanho: 1, avaria: 999 };
    assert.equal(integridadeDe(m), 0);
    assert.equal(integridadeZerada(m), true);
});

// ===== A FÓRMULA DE SOBRECARGA, NOS CONTÊINERES REAIS =====

test('Aljava de Caça a 1,20 kg num teto de 1: perde', () => {
    // item-s2-YcxIyuamOvgjy6Qws0ro-1 — peça viva de campanha ativa
    // 24 flechas × 0,05 = 1,20 kg
    const aljava = { id: 'c', ehContainer: true, pesoMaximoContainer: 1, liga: 1, tamanho: 1 };
    const dentro = [{ id: 'f', parentItemId: 'c', peso: 0.05, quantidade: 24 }];
    perto(perdaSobrecarga(aljava, dentro, null, GATILHO.conteudo), 0.20, 'por inserção');
    perto(perdaSobrecarga(aljava, dentro, null, GATILHO.movimento), 0.0667, 'por rodada movida');
});

test('a mesma Aljava com o teto corrigido para 1,5: silêncio absoluto', () => {
    const aljava = { id: 'c', ehContainer: true, pesoMaximoContainer: 1.5 };
    const dentro = [{ id: 'f', parentItemId: 'c', peso: 0.05, quantidade: 24 }];
    assert.equal(perdaSobrecarga(aljava, dentro, null, GATILHO.conteudo), 0);
});

test('Mochida Média com a carga de hoje: no-op, zero write', () => {
    // LlfVkp0rLFL5EwuBemcZ — 4 itens, 7,10 kg num teto de 20
    const mochila = { id: 'c', ehContainer: true, pesoMaximoContainer: 20, liga: 2, tamanho: 0.6 };
    const dentro = [{ id: 'x', parentItemId: 'c', peso: 7.1, quantidade: 1 }];
    assert.equal(perdaSobrecarga(mochila, dentro, null, GATILHO.conteudo), 0);
});

test('Mochila Média com o dobro do peso rompe dentro da sessão', () => {
    const mochila = { id: 'c', ehContainer: true, pesoMaximoContainer: 20, liga: 2, tamanho: 0.6 };
    const dentro = [{ id: 'x', parentItemId: 'c', peso: 40, quantidade: 1 }];
    perto(perdaSobrecarga(mochila, dentro, null, GATILHO.conteudo), 1.0, 'por inserção');
    perto(perdaSobrecarga(mochila, dentro, null, GATILHO.movimento), 0.3333, 'por rodada');
    // 10 inserções + 3 rodadas movidas = 11 num pool de 11: o couro cede
    const abuso = 10 * 1.0 + 3 * (1 / 3);
    assert.ok(abuso >= integridadeMax(mochila), `${abuso.toFixed(2)} esgota o pool de ${integridadeMax(mochila)}`);
});

test('o lixo do banco satura em vez de virar Infinity', () => {
    // item-1782691146677-bjs6wt: Espada ×4444 @4444 kg num teto de 10
    const caixa = { id: 'c', ehContainer: true, pesoMaximoContainer: 10, liga: 1, tamanho: 1 };
    const dentro = [{ id: 'x', parentItemId: 'c', peso: 4444, quantidade: 4444 }];
    const perda = perdaSobrecarga(caixa, dentro, null, GATILHO.conteudo);
    assert.equal(perda, 2, 'teto de excesso em 2 (3× o limite)');
    assert.ok(Number.isFinite(perda));
});

test('sem teto cadastrado a regra não existe', () => {
    // 30 dos 43 contêineres vivos estão assim: inventar padrão puniria todos
    const sem = { id: 'c', ehContainer: true };
    const dentro = [{ id: 'x', parentItemId: 'c', peso: 500, quantidade: 1 }];
    assert.equal(perdaSobrecarga(sem, dentro, null, GATILHO.conteudo), 0);
});

test('dentro do teto nunca perde, nem no limite exato', () => {
    const c = { id: 'c', ehContainer: true, pesoMaximoContainer: 10 };
    assert.equal(perdaSobrecarga(c, [{ id: 'x', parentItemId: 'c', peso: 10, quantidade: 1 }], null, GATILHO.conteudo), 0);
    assert.equal(perdaSobrecarga(c, [{ id: 'x', parentItemId: 'c', peso: 9.99, quantidade: 1 }], null, GATILHO.conteudo), 0);
});

test('sem floor: o gatilho de movimento é alcançável mesmo no pool pequeno', () => {
    // Era a falha do desenho com arredondamento: floor() zerava o movimento
    // para metade dos contêineres em QUALQUER carga.
    const saco = { id: 'c', ehContainer: true, pesoMaximoContainer: 20, liga: 1, tamanho: 1 };
    const dentro = [{ id: 'x', parentItemId: 'c', peso: 21, quantidade: 1 }];
    const perda = perdaSobrecarga(saco, dentro, null, GATILHO.movimento);
    assert.ok(perda > 0, 'a 1,05× de carga o movimento já cobra');
    perto(perda, 0.0167, 'e cobra pouco: 360 rodadas até romper');
});

// ===== FALHA CRÍTICA =====

test('Falha Crítica custa 1 ponto, e a escada sai da faixa', () => {
    const adaga = { liga: 2, tamanho: 0.3 };        // máximo 9
    const espadao = { liga: 5, tamanho: 1.5 };      // máximo 29
    assert.equal(perdaFalhaCritica(adaga), 1);
    assert.equal(perdaFalhaCritica(espadao), 1);
    assert.equal(integridadeMax(adaga), 9, 'adaga aguenta 8 falhas e cai na nona');
    assert.equal(integridadeMax(espadao), 29, 'montante aguenta 28 e cai na 29ª');
});

test('arma improvisada (Liga 0) é destruída na falha crítica — §5.5', () => {
    const galho = { liga: 0, tamanho: 0.8 };
    assert.equal(perdaFalhaCritica(galho), integridadeMax(galho));
    assert.equal(integridadeZerada({ ...galho, avaria: perdaFalhaCritica(galho) }), true);
});

test('desarmado não tem peça para quebrar', () => {
    assert.equal(perdaFalhaCritica({ desarmado: true, liga: 0 }), 0);
    assert.equal(perdaFalhaCritica(null), 0);
});

// ===== O VEREDITO QUE O HOST TRADUZ EM ESCRITA =====

test('desgastarConteiner devolve perda, ruptura e quem cai fora', () => {
    const c = { id: 'c', ehContainer: true, pesoMaximoContainer: 10, liga: 1, tamanho: 1, avaria: 11.9 };
    const dentro = [{ id: 'a', parentItemId: 'c', peso: 20, quantidade: 1 },
                    { id: 'b', parentItemId: 'c', peso: 0.1, quantidade: 1 }];
    const r = desgastarConteiner(c, dentro, null, GATILHO.conteudo);
    assert.ok(r.perda > 0);
    assert.equal(r.rompeu, true, '11,9 + 1,0 passa do maximo 12');
    assert.deepEqual(r.filhos.sort(), ['a', 'b'], 'os dois vao para Soltos');
});

test('sem perda nao ha ruptura nem filhos', () => {
    const c = { id: 'c', ehContainer: true, pesoMaximoContainer: 100 };
    const r = desgastarConteiner(c, [{ id: 'a', parentItemId: 'c', peso: 1, quantidade: 1 }], null, GATILHO.conteudo);
    assert.deepEqual(r, { perda: 0, rompeu: false, filhos: [] });
});

// ===== ROMPIDO PARA DE RECEBER =====

test('contêiner rompido recusa carga', () => {
    const roto = { id: 'c', nome: 'Mochila', ehContainer: true, liga: 1, tamanho: 1, avaria: 12 };
    const item = { id: 'i', nome: 'Corda', peso: 1, quantidade: 1 };
    const r = cabeNoConteiner(item, roto, [roto, item]);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /rompid/i);
});

test('contêiner inteiro continua recebendo', () => {
    const bom = { id: 'c', nome: 'Mochila', ehContainer: true, liga: 1, tamanho: 1, avaria: 11.9 };
    const item = { id: 'i', nome: 'Corda', peso: 1, quantidade: 1 };
    assert.equal(cabeNoConteiner(item, bom, [bom, item]).ok, true);
});

// ===== RELÍQUIA NÃO TEM INTEGRIDADE (§5.8) =====

test('Relíquia devolve null, não zero — a régua não se aplica', () => {
    const r = { tipo: 'Relíquia', nome: 'Especulum Fatu', liga: 5, tamanho: 0.3 };
    assert.equal(integridadeMax(r), null);
    assert.equal(integridadeDe(r), null);
    assert.equal(integridadeZerada(r), false, 'null não pode ser lido como arruinada');
});

test('Relíquia não lasca em Falha Crítica nem com avaria no doc', () => {
    const r = { tipo: 'Relíquia', liga: 0, tamanho: 0.3, avaria: 99 };
    assert.equal(perdaFalhaCritica(r), 0);
    assert.equal(integridadeZerada(r), false, 'avaria legada não arruina Relíquia');
});

test('o tipo vem do modelo quando a instância não diz', () => {
    assert.equal(integridadeMax({ liga: 5, tamanho: 0.3 }, { tipo: 'Relíquia' }), null);
});

test('peça comum segue com Integridade — a exceção é só da Relíquia', () => {
    assert.equal(integridadeMax({ tipo: 'Arma', liga: 2, tamanho: 0.3 }), 9);
});

test('a TAG Relíquia também isenta — peça que é arma E relíquia', () => {
    // O Sussurro Final: tipo Arma (precisa, para ter dano e slot de mão) com
    // tag Relíquia. Não quebra, e o tipo Arma segue valendo no combate.
    const sussurro = { nome: 'O Sussurro Final', tipo: 'Arma', tags: ['Adaga', 'Relíquia'], tamanho: 0.45 };
    assert.equal(integridadeMax(sussurro), null);
    assert.equal(perdaFalhaCritica(sussurro), 0);
    assert.equal(integridadeZerada(sussurro), false);
});

test('a tag vem do modelo quando a instância não a copiou', () => {
    assert.equal(integridadeMax({ tipo: 'Arma', tamanho: 0.45 }, { tags: ['Relíquia'] }), null);
});

test('tag parecida não isenta — só "Relíquia" mesmo', () => {
    assert.equal(integridadeMax({ tipo: 'Arma', tags: ['Relicário'], liga: 2, tamanho: 0.3 }), 9);
});
