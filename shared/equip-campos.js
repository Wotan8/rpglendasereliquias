// =============================================================
// CAMPOS DE EQUIPAMENTO — spec única, render e coleta
//
// O cadastro de Equipamento do Painel do Criador e a edição de item da Ficha
// de NPC (Painel do Mestre e Tabuleiro) mostram OS MESMOS campos. A diferença
// é só onde o resultado é gravado:
//
//   Criador  → system/data/equipment/<id>   (o MODELO do catálogo)
//   Mestre   → items/<id>                   (UMA instância; o catálogo não muda)
//
// Por isso a lista de campos mora aqui e não em nenhum dos dois painéis: campo
// novo no cadastro aparece sozinho na edição de item.
//
// ⚠️ Herança: o motor lê `instancia.campo ?? modelo.campo` (ver
// npc-calc-engine.js:85-88). Campo VAZIO na instância = herda do modelo. Por
// isso o render marca o valor herdado no placeholder em vez de pré-preencher:
// preencher tudo desgrudaria a peça do catálogo sem o mestre perceber.
// =============================================================

/**
 * Campos do Equipamento, na ordem em que aparecem no formulário.
 * `soCatalogo: true` = só faz sentido no cadastro (o Mestre não vê na instância).
 */
export const CAMPOS_EQUIPAMENTO = [
    { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Espada Longa, Cota de Malha' },
    {
        key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
            { value: 'Arma', label: '⚔️ Arma' },
            { value: 'Vestimenta', label: '🧥 Vestimenta' },
            { value: 'Acessório', label: '💍 Acessório' },
            { value: 'Projétil', label: '🎯 Projétil' },
            { value: 'Container', label: '📦 Container' },
            { value: 'Objeto', label: '📦 Objeto' },
            { value: 'Consumível', label: '🧪 Consumível' },
            { value: 'Relíquia', label: '✨ Relíquia' }
        ]
    },
    { key: 'tags', label: '🏷️ Tags', type: 'tags', placeholder: 'Digite e Enter para adicionar (Ex: metálico, mágico, leve)' },
    { key: 'equipavelEm', label: 'Equipável em', type: 'body_parts_selector' },
    // Slots ALÉM do principal. Espada de duas mãos = +1 Mão; armadura
    // completa = +1 Pernas, +2 Braço. É COBERTURA, não requisito: o que não
    // existir no corpo ou estiver tomado simplesmente não é ocupado.
    { key: 'slotsAdicionais', label: '🧩 Slots Adicionais Ocupados (além do slot principal)', type: 'mechanic_selector', selectorTarget: 'bodyPartsQuantidade' },
    {
        // ⚠️ Segurar NÃO aciona efeito nenhum (ver normalizaFormaEquipar abaixo).
        // Item de mão que faz alguma coisa é Empunhar, sempre.
        key: 'formaEquipar', label: 'Forma de equipar', type: 'select', options: [
            { value: 'segurar', label: 'Segurar — só peça inerte (NÃO aplica efeito)' },
            { value: 'empunhar', label: 'Empunhar — item de mão que aplica efeito' },
            { value: 'vestir', label: 'Vestir' },
            { value: 'fixar', label: 'Fixar' }
        ]
    },
    {
        key: 'categoriaArma', label: 'Categoria da Arma', type: 'select', options: [
            { value: 'uma_mao', label: '🗡️ Arma de Uma Mão' },
            { value: 'duas_maos', label: '⚔️ Arma de Duas Mãos' },
            { value: 'versatil', label: '🔄 Arma Versátil' },
            { value: 'escudo', label: '🛡️ Escudo' },
            { value: 'distancia', label: '🏹 Arma a Distância' }
        ], showWhen: { field: 'tipo', value: 'Arma' }
    },
    {
        key: 'liga', label: '⚒️ Liga (qualidade da peça)', type: 'select', options: [
            { value: '0', label: '0 — Sem Liga (improvisado)' },
            { value: '1', label: '1 — Liga Bruta (baixa)' },
            { value: '2', label: '2 — Liga Justa (comum)' },
            { value: '3', label: '3 — Liga Nobre (boa)' },
            { value: '4', label: '4 — Liga Pura (alta)' },
            { value: '5', label: '5 — Liga Superior' }
        ]
    },
    {
        // A Qualidade é o poder da peça e o nome da faixa vai junto no rótulo.
        // Trava do Livro (5.5): a Qualidade nunca passa da Liga.
        key: 'qualidade', label: '⭐ Qualidade (poder da peça — nunca passa da Liga)', type: 'select', options: [
            { value: '0', label: '0 — Inicial' },
            { value: '1', label: '1 — Veterano' },
            { value: '2', label: '2 — Especialista' },
            { value: '3', label: '3 — Mestre' },
            { value: '4', label: '4 — Obra-Prima' },
            { value: '5', label: '5 — Graal' }
        ]
    },
    // Afiação comum (ferreiro, dano físico). A Arcana é tipada e entra
    // pelos Valores Derivados de Dano por Essência, um vínculo por canal.
    { key: 'afiacao', label: '⚔️ Afiação (acabamento — teto é a Qualidade da peça)', type: 'number', placeholder: '0 a 5' },
    // Reforço é a Afiação da proteção. Como a Qualidade, soma na Blindagem
    // GRAVADA da peça — o campo é o registro do que foi pago, e o audit
    // cobra que a Blindagem tenha subido junto.
    { key: 'reforco', label: '🛡️ Reforço (acabamento de proteção — teto é a Qualidade)', type: 'number', placeholder: '0 a 5' },
    { key: 'blindagemQ0', label: '⚓ Blindagem quando nova (âncora do audit — não editar à toa)', type: 'number', placeholder: '0' },
    { key: 'preco', label: '💰 Preço base (L$)', type: 'number', placeholder: 'Ex: 1100' },
    { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
    { key: 'imagemUrl', label: 'Imagem (URL)', type: 'text', placeholder: 'https://...' },
    { key: 'peso', label: 'Peso', type: 'number', required: true, placeholder: '1' },
    { key: 'tamanho', label: 'Tamanho', type: 'number', required: true, placeholder: '1' },
    { key: 'pressaoBase', label: 'Pressão Base (peso efetivo ao equipar)', type: 'number', placeholder: '0 = mesmo que Peso' },
    { key: 'quantidade', label: 'Quantidade (Padrão ao instanciar)', type: 'number', placeholder: '1', soCatalogo: true },
    { key: 'ehContainer', label: '📦 É Container?', type: 'boolean' },
    { key: 'multiplicadorPressao', label: 'Multiplicador de Pressão (conteúdo)', type: 'number', placeholder: '1', showWhenBoolean: 'ehContainer' },
    { key: 'pesoMaximoContainer', label: 'Peso Máximo Suportado (Container)', type: 'number', placeholder: '10', showWhenBoolean: 'ehContainer' },
    { key: 'capacidadeContainer', label: 'Capacidade do Container (slots antigos)', type: 'number', placeholder: '10', showWhenBoolean: 'ehContainer' },
    { key: 'formulaDano', label: '💥 Fórmula de Dano', type: 'text', placeholder: 'Ex: 1d10, 2d6 — bônus numéricos vêm dos Valores Derivados' },
    // Segundo dado da MESMA peça, para quando ela é empunhada com as duas mãos.
    // Vale só onde a categoria deixa escolher (Versátil, A Distância); arma de
    // duas mãos fixa já usa a fórmula normal. Vazio = mesmo dado nos dois modos.
    { key: 'formulaDano2Maos', label: '💥 Fórmula de Dano (empunhada com 2 mãos)', type: 'text', placeholder: 'Ex: 1d12 — vazio = o mesmo dado de 1 mão' },
    // ⚔️ Régua do golpe no Tabuleiro: alcance efetivo = alcanceM + 5% do VD
    // Tamanho do usuário, nunca menor que 1 m — contado da BORDA do token.
    { key: 'alcanceM', label: '📏 Alcance do golpe (m) — o Tabuleiro soma 5% do Tamanho; vazio = mínimo 1 m', type: 'number', placeholder: 'Ex: 0,5 adaga · 2 lança', showWhen: { field: 'tipo', value: 'Arma' } },
    {
        // Qual Blindagem TIPADA do alvo barra este dano. 1 ou mais — um machado
        // de guerra corta E esmaga. Antes só existia via script
        // (functions/tipo-golpe-armas.mjs, string única); os leitores
        // normalizam string → lista, então o legado continua valendo.
        key: 'tipoGolpe', label: '🗡️ Tipos de Golpe (qual Blindagem tipada barra — 1 ou mais)', type: 'multi_select',
        options: [
            { value: 'cortante', label: '🗡️ Cortante' },
            { value: 'perfurante', label: '🏹 Perfurante' },
            { value: 'contundente', label: '🔨 Contundente' },
        ]
    },
    { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: 'item' },
    { key: 'valoresDerivadosVinculados', label: 'Valores Derivados Vinculados', type: 'mechanic_selector', selectorTarget: 'equipmentDerivedValues' },
    // "Máxima" = bônus enquanto equipado. "Atual" = efeito de uso único,
    // só dispara no botão "Usar" da ficha (item consumível).
    { key: 'statusVitaisVinculados', label: '❤️ Status Vitais Vinculados (Máxima = ao equipar · Atual = ao usar)', type: 'mechanic_selector', selectorTarget: 'vitalStatus' },
    // Dispensa criar mecânica só para somar/subtrair: a penalidade da peça
    // mora na própria peça. Aplicados enquanto o item está equipado.
    { key: 'atributosVinculados', label: '🎲 Atributos Vinculados (modificador ao equipar)', type: 'mechanic_selector', selectorTarget: 'attributes' },
    { key: 'periciasVinculadas', label: '🎯 Perícias Vinculadas (modificador ao equipar)', type: 'mechanic_selector', selectorTarget: 'skillsModificador' },
    { key: 'condicaoIds', label: '💀 Condições Aplicadas ao Usar', type: 'mechanic_selector', selectorTarget: 'conditions' },
];

// ===== TRAVA DA FORMA DE EQUIPAR =====
/**
 * Campos que, preenchidos, fazem a peça produzir efeito em alguém.
 * Arma entra por tipo: arma se empunha, tendo dano cadastrado ou não.
 */
const VINCULOS_DE_EFEITO = ['mecanicaIds', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
    'condicaoIds', 'atributosVinculados', 'periciasVinculadas'];

export const itemAplicaEfeito = (i) => VINCULOS_DE_EFEITO.some(k => (i?.[k] || []).length > 0)
    || !!String(i?.formulaDano || '').trim()
    || i?.tipo === 'Arma';

/**
 * Trava de gravação: "Segurar" desliga TODO efeito do item — itemFormasAtuais()
 * em ficha-v1.7_1/js/inventory.js devolve ['segurando'] e nunca 'efeitos' para
 * o estado 'segurar'. Peça com vínculo mecânico cadastrada como Segurar fica
 * MUDA na ficha: o arco não soma acerto, o escudo não soma Blindagem.
 *
 * Segurar existe só para peça inerte (erva, receita, tinta, comida, moeda).
 * Qualquer outra coisa de mão é Empunhar — e esta função corrige em silêncio em
 * vez de deixar passar, porque o erro não dá sintoma nenhum na hora do cadastro.
 *
 * Corrige `dados` no lugar. Devolve true se mexeu.
 */
export function normalizaFormaEquipar(dados) {
    if (dados?.formaEquipar !== 'segurar' || !itemAplicaEfeito(dados)) return false;
    dados.formaEquipar = 'empunhar';
    return true;
}

/** Os campos que a edição de UMA instância mostra (tira os de catálogo). */
export const camposDaInstancia = () => CAMPOS_EQUIPAMENTO.filter(f => !f.soCatalogo);

/** Chave onde a instância guarda o valor — a instância usa `imagem`, o modelo `imagemUrl`. */
export const valorDoItem = (item, f) => (f.key === 'imagemUrl' ? (item?.imagem ?? item?.imagemUrl) : item?.[f.key]);

/** Campo cujo valor VAZIO na instância cai no modelo do catálogo. */
const HERDA_DO_MODELO = new Set([
    'liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'preco', 'formulaDano', 'formulaDano2Maos',
    'valoresDerivadosVinculados', 'statusVitaisVinculados', 'atributosVinculados',
    'periciasVinculadas', 'condicaoIds', 'slotsAdicionais', 'tags', 'tipoGolpe',
]);
export const herdaDoModelo = (key) => HERDA_DO_MODELO.has(key);

/**
 * Semente de uma instância a partir de um modelo do catálogo — CÓPIA INTEGRAL.
 *
 * Traz TODO o cadastro: identidade, físico, Liga/Qualidade/Afiação/Reforço,
 * preço, tags, e os vínculos completos (Valores Derivados COM suas equações,
 * Status Vitais, Atributos, Perícias, Condições, Slots Adicionais). O Mestre
 * abre a janela com a peça inteira preenchida e ajusta o que quiser.
 *
 * ⚠️ Cópia é retrato, não espelho: a partir daqui a peça tem vida própria e
 * afinar o modelo no Criador NÃO alcança mais os itens já criados — mesma
 * regra que o loot do mapa já segue. O `modeloId` fica só como procedência
 * (e como rede: campo que o Mestre esvaziar volta a cair no modelo).
 *
 * Clone profundo de propósito: as equações são arrays de objetos, e sem clonar
 * o item e o catálogo apontariam para a MESMA equação em memória.
 */
export function instanciarDoModelo(tpl) {
    if (!tpl) return {};
    const clonar = (v) => (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    const semente = { modeloId: tpl.id };
    for (const f of CAMPOS_EQUIPAMENTO) {
        const v = f.key === 'imagemUrl' ? (tpl.imagemUrl ?? tpl.imagem) : tpl[f.key];
        if (v === undefined || v === null || v === '') continue;
        semente[f.key] = clonar(v);
    }
    // a instância guarda a imagem em `imagem`; o valorDoItem lê as duas
    if (semente.imagemUrl) { semente.imagem = semente.imagemUrl; delete semente.imagemUrl; }
    // "Quantidade (Padrão ao instanciar)" do catálogo existe exatamente para
    // isto: é a pilha com que a peça nasce.
    semente.quantidade = Math.max(1, parseInt(tpl.quantidade) || 1);
    return semente;
}

const esc = (t) => t == null ? '' : String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const vazio = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * HTML de um campo. `sel` traz os construtores de seletor de
 * painel-criador/js/painel-mechanics.js; `caches` traz os registros do sistema.
 * `modelo` (opcional) é o item do catálogo: o que ele define vira placeholder
 * "herda: …" em vez de valor preenchido.
 */
export function htmlCampo(f, valor, { sel, caches, modelo, prefixo = '' } = {}) {
    const id = `field_${prefixo}${f.key}`;
    const req = f.required ? ' <span class="required">*</span>' : '';
    const herdado = modelo && herdaDoModelo(f.key) ? modelo[f.key] : undefined;
    const dica = (!vazio(herdado) && vazio(valor))
        ? `herda do modelo: ${esc(Array.isArray(herdado) ? herdado.join(', ') : (typeof herdado === 'object' ? '(definido)' : herdado))}`
        : (f.placeholder || '');
    const rot = `<label class="inv-form-label" for="${id}">${esc(f.label)}${req}</label>`;
    const larga = ['textarea', 'tags', 'mechanic_selector', 'body_parts_selector'].includes(f.type);
    const abre = `<div class="inv-form-group${larga ? ' inv-form-wide' : ''}" data-campo="${esc(f.key)}">`;

    if (f.type === 'mechanic_selector') {
        const ids = Array.isArray(valor) ? valor : [];
        const k = `${prefixo}${f.key}`;
        const t = f.selectorTarget;
        let html;
        if (t === 'equipmentDerivedValues') html = sel.buildEquipmentDerivedValueSelectorHTML(k, f.label, ids, caches.derivedValues, 'Valor Derivado', 'modificador', 'Modificador', true);
        else if (t === 'vitalStatus') html = sel.buildEquipmentDerivedValueSelectorHTML(k, f.label, ids, sel.vitalStatusOptions(caches.vitalStats), 'Status Vital');
        else if (t === 'bodyPartsQuantidade') html = sel.buildEquipmentDerivedValueSelectorHTML(k, f.label, ids, caches.bodyParts, 'Parte do Corpo', 'quantidade', 'Slots');
        else if (t === 'attributes') html = sel.buildEquipmentDerivedValueSelectorHTML(k, f.label, ids, sel.ATRIBUTOS_VINCULAVEIS, 'Atributo');
        else if (t === 'skillsModificador') html = sel.buildEquipmentDerivedValueSelectorHTML(k, f.label, ids, sel.periciaOptions(caches.skills), 'Perícia');
        else if (t === 'conditions') html = sel.buildConditionSelectorHTML(k, f.label, ids, caches.conditions);
        else html = sel.buildMechanicSelectorHTML(k, f.label, ids, caches.mechanics, f.fontePreFilter);
        return `${abre}${html}</div>`;
    }

    if (f.type === 'body_parts_selector') {
        const marcados = Array.isArray(valor) ? valor : [];
        const opts = (caches.bodyParts || []).map(bp =>
            `<option value="${esc(bp.id)}" ${marcados.includes(bp.id) ? 'selected' : ''}>${esc(bp.icone || '🦴')} ${esc(bp.nome)}</option>`).join('');
        return `${abre}${rot}<select id="${id}" class="inv-form-select" multiple size="5">${opts}</select>
            <small class="inv-form-hint">Ctrl para múltiplos. Vazio = Livre.</small></div>`;
    }

    if (f.type === 'tags') {
        const tags = Array.isArray(valor) ? valor : [];
        return `${abre}${rot}<input type="text" id="${id}" class="inv-form-input"
            value="${esc(tags.join(', '))}" placeholder="${esc(dica)}">
            <small class="inv-form-hint">Separe por vírgula.</small></div>`;
    }

    if (f.type === 'multi_select') {
        const marcados = Array.isArray(valor) ? valor : (valor ? [valor] : []);
        const boxes = (f.options || []).map(o =>
            `<label class="inv-form-check"><input type="checkbox" value="${esc(o.value)}" ${marcados.includes(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('');
        return `${abre}${rot}<div id="${id}" class="inv-form-multi">${boxes}</div>
            ${dica && vazio(valor) ? `<small class="inv-form-hint">${esc(dica)}</small>` : ''}</div>`;
    }

    if (f.type === 'select') {
        const opts = (f.options || []).map(o =>
            `<option value="${esc(o.value)}" ${String(valor ?? '') === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
        const nada = f.required ? '' : `<option value="">${esc(dica && dica.startsWith('herda') ? '— ' + dica + ' —' : '— Nenhum —')}</option>`;
        return `${abre}${rot}<select id="${id}" class="inv-form-select">${nada}${opts}</select></div>`;
    }

    if (f.type === 'boolean') {
        return `${abre}<label class="inv-form-check"><input type="checkbox" id="${id}" ${valor ? 'checked' : ''}>
            <span>${esc(f.label)}</span></label></div>`;
    }

    if (f.type === 'textarea') {
        return `${abre}${rot}<textarea id="${id}" class="inv-form-textarea" rows="3" placeholder="${esc(dica)}">${esc(valor || '')}</textarea></div>`;
    }

    const tipo = f.type === 'number' ? 'number' : 'text';
    const passo = f.type === 'number' ? ' step="any"' : '';
    return `${abre}${rot}<input type="${tipo}"${passo} id="${id}" class="inv-form-input"
        value="${esc(valor ?? '')}" placeholder="${esc(dica)}"></div>`;
}

/** Lê de volta o valor de um campo já renderizado. `undefined` = não mexeram. */
export function coletarCampo(f, prefixo = '') {
    const el = document.getElementById(`field_${prefixo}${f.key}`);
    if (!el) return undefined;
    if (f.type === 'mechanic_selector') {
        try { return JSON.parse(el.value || '[]'); } catch { return []; }
    }
    if (f.type === 'boolean') return el.checked;
    if (f.type === 'multi_select') return Array.from(el.querySelectorAll('input:checked')).map(x => x.value);
    if (f.type === 'body_parts_selector') return Array.from(el.selectedOptions).map(o => o.value);
    if (f.type === 'tags') return el.value.split(',').map(s => s.trim()).filter(Boolean);
    if (f.type === 'number') return el.value === '' ? null : Number(el.value);
    if (f.type === 'textarea') return el.value.replace(/\r\n/g, '\n');
    return el.value;
}

/** Lê todos os campos de uma vez. Vazio vira null nos que herdam do modelo. */
export function coletarCampos(campos, prefixo = '') {
    const out = {};
    for (const f of campos) {
        const v = coletarCampo(f, prefixo);
        if (v === undefined) continue;
        out[f.key] = (herdaDoModelo(f.key) && vazio(v)) ? null : v;
    }
    normalizaFormaEquipar(out);
    return out;
}

/** Campos que só aparecem sob condição (Categoria da Arma, campos de Container). */
export function aplicarVisibilidade(raiz, prefixo = '') {
    const val = (k) => document.getElementById(`field_${prefixo}${k}`);
    for (const f of CAMPOS_EQUIPAMENTO) {
        const grupo = raiz.querySelector(`[data-campo="${f.key}"]`);
        if (!grupo) continue;
        let mostra = true;
        if (f.showWhen) mostra = val(f.showWhen.field)?.value === f.showWhen.value;
        if (f.showWhenBoolean) mostra = !!val(f.showWhenBoolean)?.checked;
        grupo.style.display = mostra ? '' : 'none';
    }
}
