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
    /* Onde a peça é só CARREGADA, sem efeito: arco nas Costas, escudo no Braço,
       alaúde pendurado no Pescoço. Sempre resolve para o estado "Fixado", que
       não aplica mecânica. Sem esta lista, o cadastro tentava dizer a mesma
       coisa pondo a parte em `equipavelEm` — e ela virava letra morta, porque
       Costas não empunha. Ver formaNoSlot em shared/equip-slots.js. */
    { key: 'equipavelEmGuardado', label: '🎒 Guardável em (carregada sem efeito)', type: 'body_parts_selector' },
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
    /* Quanto a peça aguenta. Vazio = derivar de round((Liga + Tamanho×3) × 3):
       Tamanho em METROS e o ×3 é a cascata do §2.8 (Altura → Tamanho), a forma
       do §7.6 numa escala só — ver integridadeMax em shared/inventario-motor.js.
       Este campo é a manopla de calibração, como pressaoBase: só preencha para
       fugir da régua. */
    { key: 'integridadeBase', label: '🧱 Integridade máxima (vazio = derivar de Liga + Tamanho)', type: 'number', placeholder: '0 = derivar' },
    { key: 'preco', label: '💰 Preço base (L$)', type: 'number', placeholder: 'Ex: 1100' },
    { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
    { key: 'imagemUrl', label: 'Imagem (URL)', type: 'text', placeholder: 'https://...' },
    { key: 'peso', label: 'Peso (kg)', type: 'number', required: true, placeholder: 'kg — ex: 0,5' },
    // Metros, fracionado: 0,1 = 10 cm. Nunca arredondar para inteiro.
    { key: 'tamanho', label: 'Tamanho (m)', type: 'number', required: true, placeholder: 'm — ex: 0,1 (10 cm) · 1,2' },
    /* Peso SENTIDO ao equipar = peso × conforto (doutrina de 25/08/2026):
       ×1 é o normal e fica VAZIO (pressão = peso, sem espelho para defasar).
       Menor que 1 só para peça bem distribuída no corpo, muito confortável ou
       de luxo — o ápice é ×0,5 (sente metade). Maior que 1 para peça
       desajeitada — o teto é ×1,5 (um caixote). Grave o PRODUTO em kg. */
    { key: 'pressaoBase', label: 'Pressão Base (peso sentido ao equipar — conforto ×0,5 a ×1,5)', type: 'number', placeholder: 'vazio = igual ao Peso · ex: 22,5 (25 kg × 0,9)' },
    { key: 'quantidade', label: 'Quantidade (Padrão ao instanciar)', type: 'number', placeholder: '1', soCatalogo: true },
    { key: 'ehContainer', label: '📦 É Container?', type: 'boolean' },
    { key: 'multiplicadorPressao', label: 'Multiplicador de Pressão (conteúdo)', type: 'number', placeholder: '1', showWhenBoolean: 'ehContainer' },
    { key: 'pesoMaximoContainer', label: '⚖️ Peso Máximo Suportado (kg) — AVISO: passar disso desgasta, não trava', type: 'number', placeholder: 'kg — ex: 20', showWhenBoolean: 'ehContainer' },
    { key: 'capacidadeContainer', label: '🔢 Capacidade (nº de pilhas) — TRAVA', type: 'number', placeholder: '10', showWhenBoolean: 'ehContainer' },
    /* A boca do contêiner e o que ele foi feito para levar — as duas TRAVAM,
       como a capacidade. Vazio = sem restrição (ver cabeNoConteiner). */
    { key: 'tamanhoMaximoItem', label: '📐 Tamanho máximo do item que entra (m) — TRAVA', type: 'number', placeholder: 'm — ex: 0,8 (nada maior passa na boca)', showWhenBoolean: 'ehContainer' },
    { key: 'tagsAceitas', label: '🏷️ Só aceita itens com estas tags — TRAVA (vazio = aceita tudo)', type: 'tags', placeholder: 'Ex: Flecha, Virote · Moeda', showWhenBoolean: 'ehContainer' },
    { key: 'formulaDano', label: '💥 Fórmula de Dano', type: 'text', placeholder: 'Ex: 1d10, 2d6 — bônus numéricos vêm dos Valores Derivados' },
    // Segundo dado da MESMA peça, para quando ela é empunhada com as duas mãos.
    // Vale só onde a categoria deixa escolher (Versátil, A Distância); arma de
    // duas mãos fixa já usa a fórmula normal. Vazio = mesmo dado nos dois modos.
    { key: 'formulaDano2Maos', label: '💥 Fórmula de Dano (empunhada com 2 mãos)', type: 'text', placeholder: 'Ex: 1d12 — vazio = o mesmo dado de 1 mão' },
    // ⚔️ Régua do golpe no Tabuleiro: alcance efetivo = alcanceM + 5% do VD
    // Tamanho do usuário, nunca menor que 1 m — contado da BORDA do token.
    { key: 'alcanceM', label: '📏 Alcance (m) — corpo a corpo: soma 5% do Tamanho, vazio = mínimo 1 m · a distância: até onde a arma lança', type: 'number', placeholder: 'Ex: 0,5 adaga · 2 lança · 60 arco longo', showWhen: { field: 'tipo', value: 'Arma' } },
    // 🏹 O braço do atirador limita o tiro: alcance real = menor entre o
    // alcance da arma e FOR × 10 m (1 ponto de FOR = 1 Deslocamento base).
    // A BESTA escapa: é armada por manivela ANTES do tiro, então a força do
    // braço no momento do disparo não entra — é o que a torna a arma de tiro
    // de quem não tem Força. Ver shared/alcance-disparo.js.
    { key: 'ignoraLimiteForDisparo', label: '🎯 Alcance NÃO é limitado pela FOR (besta, arma de manivela)', type: 'boolean', showWhen: { field: 'tipo', value: 'Arma' } },
    // 🤾 ARREMESSO — o inverso da besta. A peça não tem alcance próprio: ela
    // chega a (FOR + Atletismo + Arremessar) × este fator. Preenchido = a peça
    // é arremessável, e ganha a coluna de Acerto à Distância na aba Combate
    // SEM perder a de Corpo a Corpo: a adaga continua sendo adaga na mão.
    // Sem showWhen de propósito: frasco e pó também se arremessam, e eles são
    // tipo Consumível. Ver shared/alcance-disparo.js.
    { key: 'alcanceFator', label: '🤾 Fator de Arremesso — alcance = (FOR + Atletismo + Arremessar) × este fator · vazio = não arremessável', type: 'number', placeholder: 'Ex: 0,75 machadinha · 1 adaga · 1,5 lança' },
    // 🏹 Munição: a arma gasta projétil, e SÓ do tipo certo. As tags são as que
    // o próprio projétil já carrega (Flecha, Virote, Zarabatana), então nada
    // precisa ser recadastrado do lado dele. Vazio = arma que não gasta munição.
    { key: 'tipoProjetil', label: '🏹 Munição que esta arma gasta (tags do projétil)', type: 'tags', placeholder: 'Ex: Flecha · Virote — vazio = não gasta munição', showWhen: { field: 'tipo', value: 'Arma' } },
    // 🎯 Quanto do que foi disparado dá para catar de volta depois da luta.
    // 0 = sempre quebra; 100 = sempre recupera. Vazio usa o padrão do sistema.
    { key: 'chanceRecuperar', label: '♻️ Chance de sobrar inteiro para recolher (%)', type: 'number', placeholder: 'Ex: 50 — vazio usa o padrão', showWhen: { field: 'tipo', value: 'Projétil' } },
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

/** Chave onde a instância guarda o valor — a instância renomeia duas: `imagem`
 *  (o modelo diz `imagemUrl`) e `mecanicaIdsProprias` (o modelo diz `mecanicaIds`).
 *  Sem este de-para o formulário abria vazio e a gravação apagava o que existia. */
export const valorDoItem = (item, f) => {
    if (f.key === 'imagemUrl') return item?.imagem ?? item?.imagemUrl;
    if (f.key === 'mecanicaIds') {
        // `??` não basta: lista VAZIA é um valor, e um `mecanicaIds: []` que
        // sobrou no doc engolia as mecânicas de verdade, que moram na outra
        // chave. Vence quem tem conteúdo.
        const propria = item?.mecanicaIds;
        return (Array.isArray(propria) && propria.length) ? propria : (item?.mecanicaIdsProprias ?? propria);
    }
    return item?.[f.key];
};

/** Campo cujo valor VAZIO na instância cai no modelo do catálogo. */
const HERDA_DO_MODELO = new Set([
    'liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'preco', 'formulaDano', 'formulaDano2Maos',
    'valoresDerivadosVinculados', 'statusVitaisVinculados', 'atributosVinculados',
    'periciasVinculadas', 'condicaoIds', 'slotsAdicionais', 'tags', 'tipoGolpe',
    'equipavelEmGuardado', 'integridadeBase',
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

/**
 * O INVERSO de instanciarDoModelo: o que gravar em system/data/equipment a
 * partir de uma peça que nasceu no inventário.
 *
 * Iterar CAMPOS_EQUIPAMENTO já é a lista de permissão — characterId, ownerUid,
 * equipado, slotAnatomico, parentItemId e companhia não são campos de
 * Equipamento e por isso não têm como vazar para o catálogo. `valorDoItem`
 * resolve os dois renomes da instância (imagem→imagemUrl,
 * mecanicaIdsProprias→mecanicaIds).
 */
export function modeloDaInstancia(item) {
    const m = {};
    for (const f of CAMPOS_EQUIPAMENTO) {
        const v = valorDoItem(item, f);
        m[f.key] = (v === undefined) ? null : v;
    }
    // "Quantidade (Padrão ao instanciar)": a pilha com que a peça nasce
    m.quantidade = Math.max(1, parseInt(item?.quantidade) || 1);
    normalizaFormaEquipar(m);
    return m;
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
    const larga = ['textarea', 'tags', 'mechanic_selector', 'body_parts_selector'].includes(f.type)
        || f.key === 'imagemUrl';
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

    // Imagem: mesmo campo do Criador — cola URL OU envia arquivo do aparelho.
    // O input de texto de dentro mantém o `id`, então coletarCampo não muda.
    if (f.key === 'imagemUrl' && typeof CampoImagem !== 'undefined') {
        return `${abre}${rot}${CampoImagem.html({ id, classe: 'inv-form-input', valor: valor || '', pasta: 'imagens/itens' })}</div>`;
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
/* =============================================================
   SEÇÕES DO FORMULÁRIO
   Os mesmos campos de CAMPOS_EQUIPAMENTO, agrupados pela PERGUNTA que o
   criador faz — em vez de uma coluna dupla com 39 rótulos seguidos. A lista
   acima continua sendo a única fonte da verdade: aqui só se diz em que gaveta
   cada chave aparece. Chave que ninguém citar cai sozinha em "Outros campos",
   então esquecer de encaixar um campo novo não esconde ele de ninguém.
   ============================================================= */
export const SECOES_EQUIPAMENTO = [
    {
        id: 'identidade', icone: '📜', titulo: 'Identidade', aberta: true,
        dica: 'O que é a peça e como ela aparece na lista.',
        campos: ['nome', 'tipo', 'tags', 'descricao', 'imagemUrl'],
    },
    {
        id: 'fisico', icone: '⚖️', titulo: 'Física e preço', aberta: true,
        dica: 'Quanto a peça pesa, quanto ocupa e quanto custa.',
        campos: ['peso', 'tamanho', 'pressaoBase', 'preco', 'quantidade'],
    },
    {
        id: 'qualidade', icone: '⚒️', titulo: 'Qualidade e durabilidade',
        dica: 'A Liga é o teto e a Qualidade nunca passa dela. Afiação e Reforço são o acabamento pago.',
        campos: ['liga', 'qualidade', 'afiacao', 'reforco', 'blindagemQ0', 'integridadeBase'],
    },
    {
        id: 'equipar', icone: '🧍', titulo: 'Como se veste',
        dica: 'Onde a peça entra no corpo e o que ela ocupa. Segurar não aciona efeito nenhum.',
        campos: ['formaEquipar', 'categoriaArma', 'equipavelEm', 'equipavelEmGuardado', 'slotsAdicionais'],
    },
    {
        id: 'combate', icone: '⚔️', titulo: 'Combate',
        dica: 'Dado, alcance e munição. Só preencha o que a peça realmente faz.',
        campos: ['formulaDano', 'formulaDano2Maos', 'tipoGolpe', 'alcanceM', 'alcanceFator',
            'ignoraLimiteForDisparo', 'tipoProjetil', 'chanceRecuperar'],
    },
    {
        id: 'conteiner', icone: '📦', titulo: 'Contêiner',
        dica: 'Só vale para peça que guarda outras dentro.',
        campos: ['ehContainer', 'multiplicadorPressao', 'pesoMaximoContainer', 'capacidadeContainer',
                 'tamanhoMaximoItem', 'tagsAceitas'],
    },
    {
        id: 'efeitos', icone: '✨', titulo: 'Efeitos e vínculos',
        dica: 'O que a peça faz em quem a usa. Preencher qualquer um aqui obriga a forma Empunhar.',
        campos: ['mecanicaIds', 'valoresDerivadosVinculados', 'statusVitaisVinculados',
            'atributosVinculados', 'periciasVinculadas', 'condicaoIds'],
    },
];

const SECAO_SOBRA = {
    id: 'outros', icone: '🗂️', titulo: 'Outros campos',
    dica: 'Campos ainda não encaixados em nenhuma seção.',
};

/** Um valor conta como "preenchido"? Checkbox só marcado; zero conta. */
const preenchido = (f, v) => f.type === 'boolean' ? v === true : !vazio(v);

/** Distribui os campos recebidos pelas seções, sem perder nenhum. */
function agruparCampos(campos) {
    const porChave = new Map(campos.map(f => [f.key, f]));
    const usados = new Set();
    const grupos = SECOES_EQUIPAMENTO.map(s => {
        const meus = s.campos.map(k => porChave.get(k)).filter(Boolean);
        meus.forEach(f => usados.add(f.key));
        return { s, meus };
    }).filter(g => g.meus.length);
    const sobra = campos.filter(f => !usados.has(f.key));
    if (sobra.length) grupos.push({ s: SECAO_SOBRA, meus: sobra });
    return grupos;
}

/**
 * O formulário inteiro, em seções recolhíveis.
 *
 * `valorDe(campo)` devolve o valor atual daquele campo — quem chama passa
 * `f => valorDoItem(item, f)`, que é o de-para da instância. `opts` é o mesmo
 * objeto de htmlCampo ({ sel, caches, modelo, prefixo }).
 *
 * A seção abre sozinha quando é essencial OU quando já tem algo preenchido: ao
 * editar, o que existe fica à vista; ao criar, só as duas primeiras.
 */
export function htmlFormulario(campos, valorDe, opts = {}) {
    const secoes = agruparCampos(campos).map(({ s, meus }) => {
        const vals = meus.map(f => valorDe(f));
        const cheios = meus.filter((f, i) => preenchido(f, vals[i])).length;
        const aberta = s.aberta || cheios > 0;
        return `<details class="ef-sec" data-secao="${esc(s.id)}"${aberta ? ' open' : ''}>
            <summary class="ef-sec-head">
                <span class="ef-sec-ico" aria-hidden="true">${s.icone}</span>
                <span class="ef-sec-tit">${esc(s.titulo)}</span>
                <span class="ef-sec-badge" data-ef-badge>${cheios}/${meus.length}</span>
                <span class="ef-sec-seta" aria-hidden="true"></span>
            </summary>
            <p class="ef-sec-dica">${esc(s.dica)}</p>
            <div class="inv-form-grid">${meus.map((f, i) => htmlCampo(f, vals[i], opts)).join('')}</div>
        </details>`;
    }).join('');
    return secoes + '<p class="ef-sem-resultado" data-ef-vazio hidden>Nenhum campo com esse nome.</p>';
}

/** Barra do topo do formulário: buscar campo e abrir/recolher tudo. */
export function htmlBarraFerramentas() {
    return `<div class="ef-barra">
        <input type="search" class="ef-busca" data-ef-busca autocomplete="off"
            placeholder="🔍 Buscar campo (ex: dano, peso, alcance)" aria-label="Buscar campo do formulário">
    </div>`;
}

/**
 * A mesma divisão em gavetas, mas para quem já construiu os campos como
 * ELEMENTOS — o Painel do Criador monta o formulário com createElement, não
 * com string. Só move nós de lugar: nenhum campo é recriado, nenhum id muda.
 *
 * `grade` é o contêiner com um filho por campo, cada um marcado com
 * `data-campo="<chave>"`. `temValor(chave)` diz se a gaveta nasce aberta.
 * `classeGrade` é a classe da grade interna de cada gaveta, porque o Criador
 * chama a dele de `form-grid` e as janelas de item, de `inv-form-grid`.
 *
 * Chave que nenhuma seção citar cai em "Outros campos" — esquecer de encaixar
 * um campo novo não some com ele.
 */
export function agruparEmSecoesDOM(grade, secoes, temValor = () => false, classeGrade = 'inv-form-grid') {
    const frag = document.createDocumentFragment();
    const usados = new Set();

    const gaveta = (s, campos) => {
        const det = document.createElement('details');
        det.className = 'ef-sec';
        det.dataset.secao = s.id;
        det.open = !!s.aberta || campos.some(el => temValor(el.dataset.campo));
        det.innerHTML = '<summary class="ef-sec-head">'
            + '<span class="ef-sec-ico" aria-hidden="true"></span>'
            + '<span class="ef-sec-tit"></span>'
            + '<span class="ef-sec-badge" data-ef-badge>0/0</span>'
            + '<span class="ef-sec-seta" aria-hidden="true"></span></summary>'
            + '<p class="ef-sec-dica"></p><div class="' + classeGrade + '"></div>';
        det.querySelector('.ef-sec-ico').textContent = s.icone || '';
        det.querySelector('.ef-sec-tit').textContent = s.titulo;
        det.querySelector('.ef-sec-dica').textContent = s.dica || '';
        const dentro = det.querySelector('.' + classeGrade);
        campos.forEach(el => dentro.appendChild(el));
        frag.appendChild(det);
    };

    for (const s of secoes) {
        const campos = s.campos
            .map(k => grade.querySelector('[data-campo="' + k + '"]'))
            .filter(Boolean);
        if (!campos.length) continue;
        campos.forEach(el => usados.add(el));
        gaveta(s, campos);
    }

    const sobra = [...grade.children].filter(el => el.dataset.campo && !usados.has(el));
    if (sobra.length) gaveta({ ...SECAO_SOBRA }, sobra);

    grade.replaceChildren(frag);
    grade.classList.remove(classeGrade);   // as gavetas trazem a grade dentro
    grade.insertAdjacentHTML('beforeend',
        '<p class="ef-sem-resultado" data-ef-vazio hidden>Nenhum campo com esse nome.</p>');
    return grade;
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
    atualizarResumo(raiz);
}

/** Grupo que o usuário enxerga agora: nem escondido por regra, nem cortado pela busca. */
const grupoVisivel = (g) => g.style.display !== 'none' && !g.hasAttribute('data-fora-busca');

/**
 * Reconta o "3/5" de cada seção e some com a seção que ficou sem campo nenhum.
 * Conta só o visível: escolher Arma faz o contador de Combate crescer, e uma
 * peça que não é contêiner não fica devendo 4 campos que nem existem para ela.
 */
export function atualizarResumo(raiz) {
    let algum = false;
    raiz.querySelectorAll('details.ef-sec').forEach(sec => {
        const grupos = [...sec.querySelectorAll('[data-campo]')].filter(grupoVisivel);
        sec.hidden = grupos.length === 0;
        if (!sec.hidden) algum = true;
        const badge = sec.querySelector('[data-ef-badge]');
        if (!badge) return;
        const cheios = grupos.filter(grupoPreenchido).length;
        badge.textContent = `${cheios}/${grupos.length}`;
        badge.classList.toggle('ef-sec-badge-cheio', cheios > 0);
    });
    const aviso = raiz.querySelector('[data-ef-vazio]');
    if (aviso) aviso.hidden = algum;
}

/**
 * Um controle conta como preenchido? Lido do DOM, sem consultar spec nenhuma —
 * é o que deixa o contador servir a qualquer cadastro do Painel do Criador.
 * Seletor de mecânica/VD guarda JSON num input escondido: lista vazia é vazio.
 */
const controlePreenchido = (el) => {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    if (el.multiple) return el.selectedOptions.length > 0;
    const v = String(el.value ?? '').trim();
    if (!v) return false;
    if (v[0] === '[' || v[0] === '{') {
        try {
            const j = JSON.parse(v);
            return Array.isArray(j) ? j.length > 0 : Object.keys(j).length > 0;
        } catch { return true; }
    }
    return true;
};

/** O grupo de UM campo está preenchido se qualquer controle dele estiver. */
const grupoPreenchido = (g) => [...g.querySelectorAll('input, select, textarea')].some(controlePreenchido);

/** Busca por nome do campo: corta o que não casa e abre as seções que sobraram. */
export function filtrarCampos(raiz, termo) {
    const q = String(termo || '').trim().toLowerCase();
    raiz.querySelectorAll('[data-campo]').forEach(g => {
        const alvo = (g.textContent + ' ' + (g.dataset.campo || '')).toLowerCase();
        if (!q || alvo.includes(q)) g.removeAttribute('data-fora-busca');
        else g.setAttribute('data-fora-busca', '');
    });
    atualizarResumo(raiz);
    if (q) raiz.querySelectorAll('details.ef-sec').forEach(s => { if (!s.hidden) s.open = true; });
}

/**
 * Liga o formulário: busca, abrir/recolher tudo, campos condicionais e o
 * contador das seções. Substitui o listener de `change` que cada tela repetia
 * só para o Tipo e o "É Container?".
 */
export function ligarFormulario(raiz, prefixo = '', { visibilidade = true } = {}) {
    // `visibilidade: false` = o Painel do Criador, que já tem o wiring dele
    // para showWhen/showWhenBoolean/showWhenNotNull. Ligar os dois faria o
    // mesmo campo ser mostrado e escondido duas vezes por tecla.
    const repintar = () => visibilidade ? aplicarVisibilidade(raiz, prefixo) : atualizarResumo(raiz);
    raiz.addEventListener('input', e => {
        if (e.target.matches('[data-ef-busca]')) filtrarCampos(raiz, e.target.value);
        else atualizarResumo(raiz);
    });
    raiz.addEventListener('change', repintar);

    /* "Abrir tudo" e "Recolher" eram dois botões próprios desta barra. Viraram
       o botão único de shared/sanfona.js — o mesmo de todo bloco retrátil do
       projeto, que diz o que VAI fazer em vez de oferecer as duas opções, e que
       encolhe para só o ícone quando a janela é estreita.

       A gaveta continua sendo `.ef-sec` com a seta própria dela (um chevron,
       não a setinha): quem muda aqui é o comando, não o desenho da gaveta. */
    const barra = raiz.querySelector('.ef-barra');
    if (barra) {
        raiz.dataset.sanfona = '';
        barra.dataset.sanfonaBarra = '';
        raiz.querySelectorAll('details.ef-sec').forEach(s => { s.dataset.sanfonaItem = ''; });
        window.LRSanfona?.ligarSanfona(raiz);
    }
    // o wiring do Criador se resolve num setTimeout(0); recontar antes disso
    // marcaria como visível o campo que ele ainda vai esconder.
    if (visibilidade) aplicarVisibilidade(raiz, prefixo);
    else setTimeout(() => atualizarResumo(raiz), 0);
}
