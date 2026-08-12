// Rodar: node shared/equip-campos.test.mjs
// Cobre a spec de campos de Equipamento e a parte do render que não precisa de
// DOM. Os seletores (mecânicas, Equação de Valor) e a coleta são exercitados ao
// vivo em painel-mestre/__check-npc-inventario.html.
import assert from 'node:assert/strict';
import {
    CAMPOS_EQUIPAMENTO, camposDaInstancia, valorDoItem, herdaDoModelo, htmlCampo,
    instanciarDoModelo,
} from './equip-campos.js';

// ===== integridade da spec =====
const chaves = CAMPOS_EQUIPAMENTO.map(f => f.key);
assert.equal(new Set(chaves).size, chaves.length, 'nenhuma chave repetida');
for (const f of CAMPOS_EQUIPAMENTO) {
    assert.ok(f.key && f.label && f.type, `campo completo: ${JSON.stringify(f)}`);
    if (f.type === 'select') assert.ok(Array.isArray(f.options) && f.options.length, `${f.key} tem opções`);
    if (f.type === 'mechanic_selector' && f.selectorTarget) {
        assert.ok(['bodyPartsQuantidade', 'equipmentDerivedValues', 'vitalStatus', 'attributes', 'skillsModificador', 'conditions']
            .includes(f.selectorTarget), `${f.key}: alvo de seletor conhecido`);
    }
}
// os campos que o Mestre precisa ter (o pedido: mesmas configurações do Criador)
for (const k of ['liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'preco', 'tags',
                 'slotsAdicionais', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
                 'atributosVinculados', 'periciasVinculadas', 'condicaoIds', 'capacidadeContainer']) {
    assert.ok(chaves.includes(k), `spec tem ${k}`);
}

// ===== instância x catálogo =====
const inst = camposDaInstancia().map(f => f.key);
assert.ok(!inst.includes('quantidade'), 'a instância tem quantidade real, não a "padrão ao instanciar"');
assert.equal(inst.length, CAMPOS_EQUIPAMENTO.length - 1, 'só quantidade é de catálogo');
assert.ok(inst.includes('nome') && inst.includes('liga'), 'o resto todo aparece na instância');

// ===== herança =====
assert.equal(herdaDoModelo('liga'), true);
assert.equal(herdaDoModelo('valoresDerivadosVinculados'), true);
assert.equal(herdaDoModelo('nome'), false, 'nome é sempre da instância');
assert.equal(herdaDoModelo('peso'), false, 'peso é sempre da instância');

// ===== chave da imagem: instância usa `imagem`, catálogo usa `imagemUrl` =====
const fImg = CAMPOS_EQUIPAMENTO.find(f => f.key === 'imagemUrl');
assert.equal(valorDoItem({ imagem: 'a.png' }, fImg), 'a.png');
assert.equal(valorDoItem({ imagemUrl: 'b.png' }, fImg), 'b.png');
assert.equal(valorDoItem({ nome: 'X' }, { key: 'nome' }), 'X');

// ===== render sem DOM (tipos simples) =====
const campo = (k) => CAMPOS_EQUIPAMENTO.find(f => f.key === k);

const hNome = htmlCampo(campo('nome'), 'Punhal', {});
assert.match(hNome, /id="field_nome"/);
assert.match(hNome, /value="Punhal"/);
assert.match(hNome, /<span class="required">\*<\/span>/, 'obrigatório sai marcado');

// placeholder mostra o que seria herdado quando a instância está vazia
const hLiga = htmlCampo(campo('liga'), null, { modelo: { liga: '3' } });
assert.match(hLiga, /herda do modelo: 3/, 'vazio anuncia o valor do modelo');
const hLigaPropria = htmlCampo(campo('liga'), '5', { modelo: { liga: '3' } });
assert.match(hLigaPropria, /value="5" selected/, 'valor próprio da instância vence');
assert.equal(/herda do modelo/.test(hLigaPropria), false, 'e some o aviso de herança');

// número, textarea, boolean
assert.match(htmlCampo(campo('afiacao'), 2, {}), /type="number"[^>]*value="2"/);
assert.match(htmlCampo(campo('descricao'), 'Lâmina curta.', {}), /<textarea[^>]*>Lâmina curta\.<\/textarea>/);
assert.match(htmlCampo(campo('ehContainer'), true, {}), /id="field_ehContainer" checked>/);
assert.match(htmlCampo(campo('ehContainer'), false, {}), /id="field_ehContainer" >/);

// tags viram texto separado por vírgula
assert.match(htmlCampo(campo('tags'), ['metálico', 'leve'], {}), /value="metálico, leve"/);

// partes do corpo: multi-select marcando o que o item já aceita
const hBP = htmlCampo(campo('equipavelEm'), ['bp-mao'], { caches: { bodyParts: [
    { id: 'bp-mao', nome: 'Mão', icone: '🤚' }, { id: 'bp-torso', nome: 'Torso', icone: '🧍' },
] } });
assert.match(hBP, /multiple/);
assert.match(hBP, /value="bp-mao" selected/);
assert.equal(/value="bp-torso" selected/.test(hBP), false);

// campo condicional carrega a marca para o aplicarVisibilidade achar
assert.match(htmlCampo(campo('categoriaArma'), null, {}), /data-campo="categoriaArma"/);
assert.equal(campo('categoriaArma').showWhen.field, 'tipo');
assert.equal(campo('multiplicadorPressao').showWhenBoolean, 'ehContainer');

// escape: rótulo e valor são dado, nunca HTML
assert.match(htmlCampo(campo('nome'), '<img onerror=1>', {}), /&lt;img onerror=1&gt;/);

// ===== instanciar a partir do catálogo =====
const tpl = {
    id: 'eq-adaga', nome: 'Adaga de Lastro', tipo: 'Arma', peso: 1, tamanho: 1,
    descricao: 'Lâmina curta lastreada.', imagemUrl: 'adaga.png',
    formaEquipar: 'empunhar', categoriaArma: 'uma_mao', equipavelEm: ['bp-mao'],
    ehContainer: false, pressaoBase: 1,
    // tudo abaixo HERDA — não pode ser copiado para a instância
    liga: '3', qualidade: '2', afiacao: 1, reforco: 0, blindagemQ0: 0, preco: 90,
    formulaDano: '1d4', tags: ['metálico'],
    valoresDerivadosVinculados: [{ id: 'dv1', modificador: 2 }],
    statusVitaisVinculados: [{ id: 'vs1', modificador: 1 }],
    atributosVinculados: [{ id: 'FOR', modificador: -1 }],
    periciasVinculadas: [{ id: 'sk1', modificador: 1 }],
    condicaoIds: [{ id: 'cd1' }], slotsAdicionais: [{ id: 'bp-mao', quantidade: 1 }],
    quantidade: 5,   // "padrão ao instanciar": é de catálogo, não vai junto
};
const semente = instanciarDoModelo(tpl);

assert.equal(semente.modeloId, 'eq-adaga', 'a instância aponta para o modelo');
// o que É copiado: identidade e físico, que a instância pode divergir livremente
assert.equal(semente.nome, 'Adaga de Lastro');
assert.equal(semente.tipo, 'Arma');
assert.equal(semente.peso, 1);
assert.equal(semente.categoriaArma, 'uma_mao');
assert.deepEqual(semente.equipavelEm, ['bp-mao']);
assert.equal(semente.descricao, 'Lâmina curta lastreada.');
assert.equal(semente.imagem, 'adaga.png', 'imagemUrl do catálogo vira imagem na instância');
assert.equal(semente.imagemUrl, undefined, 'e a chave do catálogo não fica sobrando');

// o que NÃO é copiado: se fosse, mexer no catálogo depois não alcançaria a peça
for (const k of ['liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'preco', 'formulaDano',
                 'tags', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
                 'atributosVinculados', 'periciasVinculadas', 'condicaoIds', 'slotsAdicionais']) {
    assert.equal(semente[k], undefined, `${k} fica em branco para herdar do modelo`);
}
assert.equal(semente.quantidade, undefined, 'quantidade do catálogo é "padrão ao instanciar", não vem');

// a semente renderiza anunciando tudo que herda
const hSemente = htmlCampo(CAMPOS_EQUIPAMENTO.find(f => f.key === 'liga'), semente.liga, { modelo: tpl });
assert.match(hSemente, /herda do modelo: 3/);
assert.deepEqual(instanciarDoModelo(null), {}, 'sem modelo, sem semente');

console.log('✅ campos de equipamento: spec, herança instância→modelo, semente do catálogo e render OK');
