// Rodar: node functions/char-para-npc.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { charParaNpc, devolucaoExpVip, itemDevolucao, indicePericias, slug } = require('./char-para-npc.js');

// ===== slug: a mesma regra da ficha =====
assert.equal(slug('Percepção'), 'percepcao');
assert.equal(slug('Lâminas Longas'), 'laminas_longas');
assert.equal(slug('Ciências  Ocultas'), 'ciencias_ocultas', 'espaco duplo nao vira dois _');
assert.equal(slug(''), '');
assert.equal(slug(null), '');

// ===== indicePericias =====
const CATALOGO = [
    { id: 'sk1', nome: 'Percepção' },
    { id: 'sk2', nome: 'Lâminas Longas' },
    { id: 'sk3', nome: 'Atletismo' },
    { nome: 'Sem id' },            // ignorada
    { id: 'sk4' },                 // ignorada
    null,
];
const idx = indicePericias(CATALOGO);
assert.equal(idx.percepcao, 'sk1');
assert.equal(idx.laminas_longas, 'sk2');
assert.equal(Object.keys(idx).length, 3, 'entradas quebradas nao entram');
assert.deepEqual(indicePericias(), {});

// ===== devolucao: 60% =====
assert.equal(devolucaoExpVip(10), 6);
assert.equal(devolucaoExpVip(4), 2, '2,4 arredonda para 2');
assert.equal(devolucaoExpVip(5), 3, '3 exato');
assert.equal(devolucaoExpVip(7), 4, '4,2 arredonda para 4');
assert.equal(devolucaoExpVip(0), 0);
assert.equal(devolucaoExpVip(-8), 0, 'negativo nao devolve');
assert.equal(devolucaoExpVip(undefined), 0);
assert.equal(devolucaoExpVip('20'), 12, 'aceita texto');

// ===== itemDevolucao: tem de ser aplicavel pelo botao de EXP =====
const item = itemDevolucao(12, 'Rosvaldo');
assert.equal(item.isExp, true, 'sem isExp o botao de aplicar nao aparece');
assert.equal(item.expAmount, 12);
assert.equal(item.isExpVip, true, 'o que volta continua sendo VIP');
assert.equal(item.quantidade, 1);
assert.match(item.nome, /Rosvaldo/);
assert.equal(item.isVendaAtiva, false, 'nao e item de vitrine');

// ===== a conversao =====
const FICHA = {
    fields: {
        nome: 'Rosvaldo', raca: 'Humano', classe: 'Bardo', tribo: 'Sereni',
        exp: '140', exp_total: '414', idade: '31', virtude: 'Leal', vicio: 'Bebida',
        medo: 'Afogamento', aparencia: 'Cicatriz no rosto', altura: '1,78m',
    },
    dots: {
        attr_for: 3, attr_des: 4, attr_vig: 2, attr_int: 5,
        attr_rac: 1, attr_prs: 4, attr_pre: 2, attr_man: 3, attr_aut: 2,
        sk_mental_percepcao: 4,
        sk_combate_laminas_longas: 3,
        sk_fisico_atletismo: 0,             // zero nao entra
        sk_social_labia: 2,                 // fora do catalogo (a ficha ja grava sem acento)
        pec_ABC123: 2,
        pec_XYZ789: 1,
        pec_ZERO: 0,                        // zero nao entra
        outra_coisa: 9,                     // ignorada
    },
    peculiaridadesIndividuais: [{ nome: 'Sorte de Bêbado', efeito: 'Rerrola uma vez por sessão', nivel: 3 }],
    partesDoCorpo: [{ id: 'cabeca', nome: 'Cabeça' }],
    charImg: 'https://exemplo/rosvaldo.png',
    expVip: 20,
    notes: [{ titulo: 'Dívida', conteudo: '<p>Deve 300 Luns ao agiota</p>' }, { titulo: 'x', conteudo: '<p></p>' }],
    runomancia: { aprendidos: ['r1', 'r2'] },
    mecanicasAplicadas: { m1: {}, m2: {} },
    mesaId: 'mesa-7',
};

const { npc, perdido } = charParaNpc(FICHA, { skills: CATALOGO, autor: 'igor@x.com', charId: 'char_1' });

// identidade
assert.equal(npc.nome, 'Rosvaldo');
assert.equal(npc.tipo, 'npc');
assert.equal(npc.schemaVersion, 2);
assert.equal(npc.imagem, 'https://exemplo/rosvaldo.png');
assert.equal(npc.raca, 'Humano');
assert.equal(npc.classe, 'Bardo');
assert.equal(npc.tribo, 'Sereni');
assert.equal(npc.tamanho, '1,78m');
assert.equal(npc.nivel, 1, 'a ficha nao tem nivel; 1 e o default do painel');

// atributos: minusculo -> SIGLA
assert.equal(npc.atributos.FOR, 3);
assert.equal(npc.atributos.INT, 5);
assert.equal(Object.keys(npc.atributos).length, 9, 'as nove siglas sempre presentes');
assert.equal(charParaNpc({}, {}).npc.atributos.AUT, 0, 'ficha vazia: atributos zerados, nao ausentes');

// pericias
assert.deepEqual(npc.periciasEstruturadas.sort((a, b) => a.refId.localeCompare(b.refId)),
    [{ refId: 'sk1', nivel: 4 }, { refId: 'sk2', nivel: 3 }]);
assert.equal(npc.periciasEstruturadas.some(p => p.nivel === 0), false, 'nivel zero fica de fora');

// peculiaridades: a chave do dot E o id do catalogo
const refs = npc.peculiaridades.filter(p => p.refId).map(p => p.refId).sort();
assert.deepEqual(refs, ['ABC123', 'XYZ789']);
const avulsa = npc.peculiaridades.find(p => !p.refId);
assert.equal(avulsa.nomeCustom, 'Sorte de Bêbado');
assert.equal(avulsa.nivel, 3);

// partes do corpo passam iguais
assert.deepEqual(npc.partesDoCorpo, [{ id: 'cabeca', nome: 'Cabeça' }]);

// valores derivados nascem limpos, para o motor do NPC recalcular
assert.deepEqual(npc.valoresDer, { overrides: {}, atual: {}, extras: [], vinculados: [] });

// mesa vira vinculo E espelho
assert.equal(npc.mesaId, 'mesa-7');
assert.deepEqual(npc.vinculos, [{ tipo: 'mesa', id: 'mesa-7' }]);
const semMesa = charParaNpc({ fields: { nome: 'X' } }, {}).npc;
assert.equal(semMesa.mesaId, '');
assert.deepEqual(semMesa.vinculos, []);

// mesaVinculada tambem serve de origem
assert.equal(charParaNpc({ mesaVinculada: { id: 'm9' } }, {}).npc.mesaId, 'm9');

// rastro
assert.equal(npc.origemCharId, 'char_1');
assert.equal(npc.origemJogador, 'igor@x.com');
assert.equal(npc.createdVia, 'entrega-do-jogador');

// ===== o que nao converte tem de aparecer na historia, nao sumir =====
const h = npc.rolePlay.historia;
assert.match(h, /EXP: 414 total, 140 disponível/);
assert.match(h, /EXP VIP aplicado: 20/);
assert.match(h, /Virtude: Leal/);
assert.match(h, /Medo: Afogamento/);
assert.match(h, /labia 2/, 'pericia fora do catalogo vira texto em vez de sumir');
assert.match(h, /Deve 300 Luns ao agiota/, 'nota do jogador preservada');
assert.match(h, /Runomancia: 2 runa/);
assert.match(h, /Mecânicas com escolha do jogador: 2/);
assert.ok(!/<p>/.test(h), 'o HTML das notas foi limpo');
assert.ok(perdido.length >= 6, 'a lista do que se perde e devolvida para quem chama');

// nota vazia nao vira linha
assert.ok(!/\bx:/.test(h), 'nota sem conteudo util fica de fora');

// ===== ficha degenerada nao derruba a conversao =====
const vazio = charParaNpc({}, {});
assert.equal(vazio.npc.nome, 'Personagem sem nome');
assert.deepEqual(vazio.npc.periciasEstruturadas, []);
assert.deepEqual(vazio.npc.peculiaridades, []);
assert.equal(charParaNpc(null, {}).npc.tipo, 'npc');
assert.equal(charParaNpc({ dots: { pec_A: 'abc' } }, {}).npc.peculiaridades.length, 0, 'nivel nao numerico fica de fora');

console.log('✅ char-para-npc: todos os casos passaram');
