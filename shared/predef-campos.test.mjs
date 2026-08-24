// node shared/predef-campos.test.mjs
// A habilidade pré-cadastrada é copiada para a ficha ao ser adquirida. Editar o
// pré-cadastro tem de chegar a quem já a tem — sem levar junto o estado de mesa
// (contador, checkbox, anotação), que é do jogador e não do cadastro.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(dir, 'predef-campos.js'), 'utf8'), ctx);
const { chavesTravadas, predefDoItem, sincronizarItem, sincronizarItens } = ctx.PredefCampos;

/** Módulo no formato do registro: o 🔒 do Painel é `somenteLeitura`. */
const modulo = () => ({
    id: 'mod_rituais',
    schema: [
        { key: '1', tipo: 'textarea', label: 'O que faz:', somenteLeitura: true },
        { key: '2', tipo: 'number', label: 'Custo em Energia', somenteLeitura: true },
        { key: '8', tipo: 'contador', label: 'Graus Obtidos' },          // do jogador
        { key: '9', tipo: 'botao', label: 'Conjurar', somenteLeitura: true }, // não guarda dado
        { key: '10', tipo: 'progress', label: 'Usos', somenteLeitura: true },
        { key: '11', tipo: 'separador', label: 'Notas', somenteLeitura: true },
    ],
    itensPredefinidos: [{
        id: 'pdi_1', nome: 'Invocação Abissal',
        valores: { '1': 'Rasga o véu.', '2': '1', '8': '0', '10_atual': '0', '10_total': '3' },
    }],
});

// --- Só as chaves travadas que guardam dado; progresso conta duas ---
assert.equal(chavesTravadas(modulo()).join(','), '1,2,10_atual,10_total');
assert.equal(chavesTravadas(null).length, 0, 'módulo sem schema não quebra');

// --- Item adquirido do pré-cadastro, com o texto e o custo já velhos ---
const mod = modulo();
const item = {
    _predefId: 'pdi_1', _predefNome: 'Invocação Abissal',
    '1': 'Texto antigo.', '2': '4', '8': '7', '10_atual': '2', '10_total': '3',
};
mod.itensPredefinidos[0].valores['1'] = 'Texto novo do cadastro.';
mod.itensPredefinidos[0].valores['2'] = '2';

const mudou = sincronizarItem(mod, item);
assert.equal(item['1'], 'Texto novo do cadastro.', 'campo 🔒 segue o cadastro');
assert.equal(item['2'], '2', 'custo corrigido no cadastro chega na ficha');
assert.equal(item['8'], '7', 'contador do jogador NÃO é resetado pelo cadastro');
assert.equal(item['10_atual'], '0', 'progresso travado segue o cadastro nas duas chaves');
assert.equal(mudou.sort().join(','), '1,10_atual,2', 'só reporta o que mudou');

// --- Rodar de novo não muda nada (idempotente, não suja o autosave) ---
assert.equal(sincronizarItem(mod, item).length, 0, 'segunda passada é no-op');

// --- Renomear a habilidade no cadastro renomeia na ficha ---
mod.itensPredefinidos[0].nome = 'Invocação do Abismo';
assert.equal(sincronizarItem(mod, item).join(','), '_predefNome');
assert.equal(item._predefNome, 'Invocação do Abismo');

// --- "2" do cadastro e 2 da ficha são o mesmo valor: não marca mudança ---
item['2'] = 2;
assert.equal(sincronizarItem(mod, item).length, 0, 'número e string do mesmo valor não divergem');

// --- Item livre do jogador (sem _predefId) não segue cadastro nenhum ---
const livre = { '1': 'Minha invenção', '2': '9' };
assert.equal(sincronizarItem(mod, livre).length, 0);
assert.equal(livre['1'], 'Minha invenção', 'item criado pelo jogador fica intacto');

// --- Pré-definido apagado do cadastro: a cópia da ficha continua de pé ---
const orfao = { _predefId: 'pdi_sumiu', '1': 'Herança de um cadastro que não existe mais' };
assert.equal(sincronizarItem(mod, orfao).length, 0);
assert.equal(orfao['1'], 'Herança de um cadastro que não existe mais');
assert.equal(predefDoItem(mod, orfao), null);

// --- Campo travado que o cadastro deixou em branco não apaga o da ficha ---
delete mod.itensPredefinidos[0].valores['2'];
item['2'] = 5;
assert.equal(sincronizarItem(mod, item).length, 0);
assert.equal(item['2'], 5, 'cadastro sem valor não vira apagador');

// --- Array vem copiado: registro e ficha não podem compartilhar referência ---
mod.schema.push({ key: '12', tipo: 'tags', label: 'Escolas', somenteLeitura: true });
mod.itensPredefinidos[0].valores['12'] = ['fogo', 'sangue'];
const comTags = { _predefId: 'pdi_1' };
sincronizarItem(mod, comTags);
comTags['12'].push('luz');
assert.equal(mod.itensPredefinidos[0].valores['12'].join(','), 'fogo,sangue',
    'mexer na ficha não pode mexer no registro');

// --- A lista inteira de um módulo, e a contagem de quem mudou ---
const mod2 = modulo();
const nome = mod2.itensPredefinidos[0].nome;
const itens = [
    { _predefId: 'pdi_1', _predefNome: nome, '1': 'velho', '2': '1', '10_atual': '0', '10_total': '3' },
    { _predefId: 'pdi_1', _predefNome: nome, '1': 'Rasga o véu.', '2': '1', '10_atual': '0', '10_total': '3' },
    null,
];
assert.equal(sincronizarItens(mod2, itens), 1, 'só o desatualizado conta como mudado');
assert.equal(itens[0]['1'], 'Rasga o véu.');
assert.equal(sincronizarItens(mod2, null), 0, 'módulo sem itens não quebra');

console.log('ok — campos 🔒 seguem o pré-cadastro; contador e item livre do jogador ficam');
