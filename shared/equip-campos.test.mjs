// Rodar: node shared/equip-campos.test.mjs
// Cobre a spec de campos de Equipamento e a parte do render que não precisa de
// DOM. Os seletores (mecânicas, Equação de Valor) e a coleta são exercitados ao
// vivo em painel-mestre/__check-npc-inventario.html.
import assert from 'node:assert/strict';
import {
    CAMPOS_EQUIPAMENTO, camposDaInstancia, valorDoItem, herdaDoModelo, htmlCampo,
    instanciarDoModelo, itemAplicaEfeito, normalizaFormaEquipar,
    modeloDaInstancia,
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

// ===== tipos de golpe (1 ou mais) =====
const fTG = campo('tipoGolpe');
assert.equal(fTG.type, 'multi_select', 'tipoGolpe permite mais de um');
assert.deepEqual(fTG.options.map(o => o.value), ['cortante', 'perfurante', 'contundente']);
assert.equal(herdaDoModelo('tipoGolpe'), true, 'em branco herda do modelo');
// legado string marca a caixinha certa; lista marca as duas
const hTG1 = htmlCampo(fTG, 'cortante', {});
assert.match(hTG1, /value="cortante" checked/);
assert.equal(/value="perfurante" checked/.test(hTG1), false);
const hTG2 = htmlCampo(fTG, ['perfurante', 'contundente'], {});
assert.match(hTG2, /value="perfurante" checked/);
assert.match(hTG2, /value="contundente" checked/);
// herança anuncia a LISTA legível, não "(definido)"
const hTGherda = htmlCampo(fTG, null, { modelo: { tipoGolpe: ['perfurante', 'cortante'] } });
assert.match(hTGherda, /herda do modelo: perfurante, cortante/);

// ===== instanciar a partir do catálogo =====
const tpl = {
    id: 'eq-adaga', nome: 'Adaga de Lastro', tipo: 'Arma', peso: 1, tamanho: 1,
    descricao: 'Lâmina curta lastreada.', imagemUrl: 'adaga.png',
    formaEquipar: 'empunhar', categoriaArma: 'uma_mao', equipavelEm: ['bp-mao'],
    ehContainer: false, pressaoBase: 1,
    // tudo abaixo HERDA — não pode ser copiado para a instância
    liga: '3', qualidade: '2', afiacao: 1, reforco: 0, blindagemQ0: 0, preco: 90,
    formulaDano: '1d4', tags: ['metálico'], tipoGolpe: ['perfurante', 'cortante'],
    valoresDerivadosVinculados: [{ id: 'dv1', modificador: 2 }],
    statusVitaisVinculados: [{ id: 'vs1', modificador: 1 }],
    atributosVinculados: [{ id: 'FOR', modificador: -1 }],
    periciasVinculadas: [{ id: 'sk1', modificador: 1 }],
    condicaoIds: [{ id: 'cd1' }], slotsAdicionais: [{ id: 'bp-mao', quantidade: 1 }],
    quantidade: 5,   // "padrão ao instanciar": é de catálogo, não vai junto
};
const semente = instanciarDoModelo(tpl);

assert.equal(semente.modeloId, 'eq-adaga', 'a instância guarda a procedência');

// CÓPIA INTEGRAL: todo campo do cadastro que tem valor vem junto.
// Nada de "fica em branco para herdar" — o Mestre quer a peça inteira na mão.
for (const f of CAMPOS_EQUIPAMENTO) {
    const orig = f.key === 'imagemUrl' ? tpl.imagemUrl : tpl[f.key];
    if (orig === undefined || orig === null || orig === '') continue;
    const chave = f.key === 'imagemUrl' ? 'imagem' : f.key;
    assert.deepEqual(semente[chave], orig, `${chave} veio do cadastro`);
}
assert.equal(semente.imagemUrl, undefined, 'chave do catálogo não fica sobrando');
assert.equal(semente.quantidade, 5, '"padrão ao instanciar" vira a pilha inicial');

// o que motivou a mudança: vínculos COM as equações
assert.deepEqual(semente.valoresDerivadosVinculados, [{ id: 'dv1', modificador: 2 }]);
assert.deepEqual(semente.statusVitaisVinculados, [{ id: 'vs1', modificador: 1 }]);
assert.deepEqual(semente.atributosVinculados, [{ id: 'FOR', modificador: -1 }]);
assert.deepEqual(semente.periciasVinculadas, [{ id: 'sk1', modificador: 1 }]);
assert.deepEqual(semente.condicaoIds, [{ id: 'cd1' }]);
assert.deepEqual(semente.slotsAdicionais, [{ id: 'bp-mao', quantidade: 1 }]);
assert.deepEqual(semente.tags, ['metálico']);
assert.equal(semente.liga, '3');
assert.equal(semente.qualidade, '2');
assert.equal(semente.preco, 90);
assert.equal(semente.formulaDano, '1d4');
assert.deepEqual(semente.tipoGolpe, ['perfurante', 'cortante'], 'tipos de golpe vêm na cópia');

// VD com equação: a estrutura aninhada tem de vir inteira
const comEq = instanciarDoModelo({ id: 'x', nome: 'Y', valoresDerivadosVinculados: [
    { id: 'dv1', equacao: [{ tipo: 'ficha', ref: 'DES' }, { op: '+', tipo: 'ficha', ref: 'Arma' }] },
] });
assert.deepEqual(comEq.valoresDerivadosVinculados[0].equacao,
    [{ tipo: 'ficha', ref: 'DES' }, { op: '+', tipo: 'ficha', ref: 'Arma' }],
    'a equação do VD vem junto, termo a termo');

// clone PROFUNDO: mexer na cópia não pode tocar o catálogo
const orig = { id: 'z', nome: 'Z', valoresDerivadosVinculados: [{ id: 'dv1', equacao: [{ tipo: 'fixo', valor: 1 }] }] };
const c1 = instanciarDoModelo(orig);
c1.valoresDerivadosVinculados[0].equacao[0].valor = 999;
assert.equal(orig.valoresDerivadosVinculados[0].equacao[0].valor, 1,
    'editar o item não pode alterar o modelo do catálogo em memória');

// esvaziar um campo à mão ainda derruba para o modelo (rede de segurança)
const hVazio = htmlCampo(CAMPOS_EQUIPAMENTO.find(f => f.key === 'liga'), null, { modelo: tpl });
assert.match(hVazio, /herda do modelo: 3/);
assert.deepEqual(instanciarDoModelo(null), {}, 'sem modelo, sem semente');

// ===== trava do "Segurar" =====
// Segurar não aciona efeito nenhum: peça que faz alguma coisa tem de ser Empunhar.
assert.equal(itemAplicaEfeito({ tipo: 'Objeto' }), false, 'peça inerte não aplica efeito');
assert.equal(itemAplicaEfeito({ tipo: 'Arma' }), true, 'arma se empunha, mesmo sem dano cadastrado');
assert.equal(itemAplicaEfeito({ tipo: 'Objeto', formulaDano: '1d6' }), true);
for (const k of ['mecanicaIds', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
                 'condicaoIds', 'atributosVinculados', 'periciasVinculadas']) {
    assert.equal(itemAplicaEfeito({ tipo: 'Objeto', [k]: [{ id: 'x' }] }), true, `${k} conta como efeito`);
    assert.equal(itemAplicaEfeito({ tipo: 'Objeto', [k]: [] }), false, `${k} vazio não conta`);
}

const arco = { tipo: 'Arma', formaEquipar: 'segurar' };
assert.equal(normalizaFormaEquipar(arco), true, 'avisa que corrigiu');
assert.equal(arco.formaEquipar, 'empunhar');

const totem = { tipo: 'Objeto', formaEquipar: 'segurar', valoresDerivadosVinculados: [{ id: 'dv1' }] };
normalizaFormaEquipar(totem);
assert.equal(totem.formaEquipar, 'empunhar', 'objeto com vínculo também sobe para empunhar');

// o caso que Segurar existe para atender: continua intocado
const erva = { tipo: 'Objeto', formaEquipar: 'segurar' };
assert.equal(normalizaFormaEquipar(erva), false);
assert.equal(erva.formaEquipar, 'segurar', 'peça inerte fica Segurar de propósito');

// as outras formas nunca são mexidas
for (const f of ['empunhar', 'vestir', 'fixar', undefined]) {
    const i = { tipo: 'Arma', formaEquipar: f };
    assert.equal(normalizaFormaEquipar(i), false, `${f} não é assunto desta trava`);
    assert.equal(i.formaEquipar, f);
}
assert.equal(normalizaFormaEquipar(null), false, 'sem dado, sem crash');

// ===== O CAMINHO DE VOLTA: instância → modelo do catálogo =====
// É o que a caixa "Salvar no Catálogo" grava. Duas chaves são renomeadas, e
// NENHUM campo de dono pode vazar para o cadastro do sistema.
const instancia = {
    id: 'item-1', nome: 'Colar de Ametista', tipo: 'Acessório',
    imagem: 'colar.png', mecanicaIdsProprias: ['me1'],
    peso: 0.1, tamanho: 0.1, quantidade: 3,
    // tudo abaixo é do DONO, não do cadastro
    characterId: 'char-1', ownerUid: 'u1', ownerId: 'u1', equipado: true,
    slotAnatomico: 'bp-pescoco', slotsOcupados: ['bp-pescoco'], estadoEquip: 'vestido',
    maosUsadas: 1, parentItemId: 'cont-9', modeloId: 'tpl-antigo',
    lastModified: 'x', criadoPor: 'mestre',
};
const modelo = modeloDaInstancia(instancia);
assert.equal(modelo.imagemUrl, 'colar.png', 'imagem vira imagemUrl');
assert.deepEqual(modelo.mecanicaIds, ['me1'], 'mecanicaIdsProprias vira mecanicaIds');
assert.equal(modelo.quantidade, 3, 'a pilha vira o "padrão ao instanciar"');
for (const k of ['characterId', 'ownerUid', 'ownerId', 'equipado', 'slotAnatomico', 'slotsOcupados',
                 'estadoEquip', 'maosUsadas', 'parentItemId', 'modeloId', 'lastModified', 'criadoPor', 'imagem']) {
    assert.ok(!(k in modelo), `"${k}" é do dono e não pode vazar para o catálogo`);
}

// Lista VAZIA em mecanicaIds não pode engolir a que tem conteúdo: um doc antigo
// com `mecanicaIds: []` apagava as mecânicas de verdade ao reabrir o formulário.
const comSombra = { mecanicaIds: [], mecanicaIdsProprias: ['me9'] };
assert.deepEqual(valorDoItem(comSombra, { key: 'mecanicaIds' }), ['me9'], 'vence quem tem conteúdo');
assert.deepEqual(modeloDaInstancia(comSombra).mecanicaIds, ['me9']);

// Ida e volta: o que sai do catálogo e volta para ele não perde campo.
const tplRedondo = { id: 'tpl9', nome: 'Adaga', tipo: 'Arma', categoriaArma: 'uma_mao',
    liga: '3', qualidade: '2', peso: 0.5, tamanho: 0.3, formulaDano: '1d4',
    tags: ['metálico'], tipoGolpe: ['perfurante'], alcanceFator: 1, quantidade: 1 };
const volta = modeloDaInstancia(instanciarDoModelo(tplRedondo));
for (const k of ['nome', 'tipo', 'categoriaArma', 'liga', 'qualidade', 'peso', 'tamanho',
                 'formulaDano', 'alcanceFator', 'quantidade']) {
    assert.deepEqual(volta[k], tplRedondo[k], `ida e volta preservou ${k}`);
}
assert.deepEqual(volta.tags, tplRedondo.tags);
assert.deepEqual(volta.tipoGolpe, tplRedondo.tipoGolpe);

console.log('✅ campos de equipamento: spec, herança instância→modelo, semente do catálogo, volta ao catálogo, render e trava do Segurar OK');
