/* ===== DERIVED VALUES — Cálculo Automático de Valores Derivados ===== */

/* ===== FÓRMULAS DE STATUS VITAIS =====
 * Status Vitais (VIT_MAX, ENER_MAX, SAN_MAX) agora são gerenciados
 * exclusivamente por mecânicas do Painel de Criador (Firebase).
 * As fórmulas hardcoded foram removidas.
 * O campo base começa em 0 e as mecânicas vinculadas definem o cálculo.
 */
const DERIVED_FORMULAS = {
    // Vazio — gerenciado por mecânicas do Firebase
};

/* Mapa: campo de Status Vital → { display, atual }
 * Mapeia as keys (VIT_MAX, ENER_MAX, SAN_MAX) para os IDs
 * dos campos HTML fixos na seção Status Vitais.
 * As fórmulas são definidas por mecânicas do Firebase.
 */
const DERIVED_FIELDS_MAP = {
    VIT_MAX: { display: 'vit_max_display', atual: 'vit_atual' },
    ENER_MAX: { display: 'ener_max_display', atual: 'ener_atual' },
    SAN_MAX: { display: 'san_max_display', atual: 'san_atual' },
};

/* ===== KEYS de derivados que são renderizados dinamicamente na grid ===== */
let _dynamicDerivedKeys = new Set();

function getEffectiveDotValue(key) {
    let val = (state.dots[key] || 0) + (state.mechanicBonuses?.[key] || 0);
    const limit = state.mechanicLimits?.[key];
    if (limit) {
        if (limit.tipo === 'bloqueio') return 0;
        // Piso: additive bonus (floor levels count as real levels)
        if ((limit.tipo === 'minimo' || limit.tipo === 'clamp') && limit.min != null) {
            val += limit.min;
        }
        // Teto: hard cap — but if aura extends ceiling, use aura max instead
        if ((limit.tipo === 'maximo' || limit.tipo === 'clamp' || limit.tipo === 'bloqueio') && limit.max != null) {
            const auraMax = typeof getAuraMaxLevel === 'function' ? getAuraMaxLevel(key) : limit.max;
            val = Math.min(val, auraMax);
        }
    }
    // If no limit but aura exists, still apply aura max
    if (!limit) {
        const auraMax = typeof getAuraMaxLevel === 'function' ? getAuraMaxLevel(key) : 5;
        if (val > auraMax) val = auraMax;
    }
    return val;
}

function gatherAttributes() {
    return {
        FOR: getEffectiveDotValue('attr_for'),
        DES: getEffectiveDotValue('attr_des'),
        VIG: getEffectiveDotValue('attr_vig'),
        INT: getEffectiveDotValue('attr_int'),
        RAC: getEffectiveDotValue('attr_rac'),
        PRS: getEffectiveDotValue('attr_prs'),
        PRE: getEffectiveDotValue('attr_pre'),
        MAN: getEffectiveDotValue('attr_man'),
        AUT: getEffectiveDotValue('attr_aut'),
    };
}

function gatherDerivedFields() {
    return {};
}

/* ===== RENDER DERIVED VALUES GRID (DYNAMIC FROM FIREBASE) ===== */

/**
 * Lê o `derivedValueIds` de um cadastro (raça, classe ou peculiaridade) e
 * despeja no acumulador. Cada entrada é o id cru ou `{ id, valorInicial }`.
 */
function _dvColetarVinculos(cadastro, ids, iniciais) {
    if (!cadastro?.derivedValueIds) return;
    cadastro.derivedValueIds.forEach(entrada => {
        const ehObj = typeof entrada === 'object' && entrada !== null;
        const dvId = ehObj ? entrada.id : entrada;
        ids.add(dvId);
        if (ehObj && entrada.valorInicial) iniciais[dvId] = entrada.valorInicial;
    });
}

/** Resolve o cadastro completo de uma peculiaridade (id cru ou objeto). */
function _dvResolverPec(pecObj) {
    if (typeof _resolvePeculiaridade === 'function') return _resolvePeculiaridade(pecObj);
    const pId = typeof pecObj === 'object' ? pecObj.id : pecObj;
    return (window._systemData?.peculiarities || []).find(p => p.id === pId) || null;
}

/**
 * Quais Valores Derivados este personagem enxerga, e com que constante inicial.
 * Cinco fontes vinculam VD: a raça, a classe e as peculiaridades das QUATRO
 * origens (raça, classe, tribo e individuais).
 * Devolve `{ ids, iniciais }` — a ordem de preenchimento define quem vence o
 * `valorInicial` quando duas fontes trazem o mesmo VD (raça < classe < pec).
 */
function _dvVinculosDoPersonagem() {
    const ids = new Set();
    const iniciais = {};   // dvId -> valorInicial

    const racaNome = document.getElementById('selRaca')?.value || '';
    const classeNome = document.getElementById('selClasse')?.value || '';
    const triboNome = document.getElementById('selTribo')?.value || '';

    if (racaNome) {
        _dvColetarVinculos((window._systemData?.races || []).find(r => r.nome === racaNome), ids, iniciais);
    }
    if (classeNome) {
        _dvColetarVinculos((window._systemData?.classes || []).find(c => c.nome === classeNome), ids, iniciais);
    }

    const daPeculiaridades = (lista) => (lista || [])
        .forEach(pecObj => _dvColetarVinculos(_dvResolverPec(pecObj), ids, iniciais));

    if (racaNome) daPeculiaridades(window.RACES?.[racaNome]?.peculiaridades);
    // window.CLASS_PECULIARITIES[nome] JÁ É o array de peculiaridades — não há
    // window.CLASSES nesta página (o loader nunca criou esse global), então a
    // versão anterior deixava todo VD trazido por peculiaridade de classe invisível.
    if (classeNome) daPeculiaridades(window.CLASS_PECULIARITIES?.[classeNome]);
    if (triboNome) daPeculiaridades(window.TRIBES?.[triboNome]?.peculiaridades);
    daPeculiaridades(window.state?.peculiaridadesIndividuais);

    return { ids, iniciais };
}

/** Agrupa os VDs aplicáveis em blocos já ordenados ("Geral" sempre por último). */
function _dvAgruparEmBlocos(dvs) {
    const porId = new Map();
    dvs.forEach(dv => {
        const bId = dv.blocoId || 'geral';
        if (!porId.has(bId)) {
            porId.set(bId, {
                id: bId,
                nome: dv.blocoNome || (bId === 'geral' ? 'Geral' : bId),
                ordem: (dv.blocoOrdem !== undefined && dv.blocoOrdem !== '') ? Number(dv.blocoOrdem) : 999,
                dvs: []
            });
        }
        porId.get(bId).dvs.push(dv);
    });

    return Array.from(porId.values()).sort((a, b) => {
        if (a.id === 'geral') return 1;
        if (b.id === 'geral') return -1;
        return a.ordem - b.ordem;
    });
}

/**
 * Renderiza a grid de Valores Derivados baseada nos dados do Firebase.
 * Filtra por: todoPersonagem=true OU vinculado à raça/classe selecionada.
 */
function renderDerivedValuesGrid() {
    const grid = document.getElementById('derivedValuesGrid');
    if (!grid) return;

    const allDVs = window.DERIVED_VALUES || [];
    if (allDVs.length === 0) {
        // Fallback: se não há valores no Firebase, não renderizar nada
        grid.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">Nenhum valor derivado cadastrado.</div>';
        _dynamicDerivedKeys = new Set();
        return;
    }

    const { ids: vinculados, iniciais } = _dvVinculosDoPersonagem();

    // Filtrar: universais OU vinculados à raça/classe/peculiaridades
    const applicableDVs = allDVs.filter(dv => dv.todoPersonagem || vinculados.has(dv.id));

    // Guardar mapa de valores iniciais para uso no recalcAll
    window._dvInitialValues = iniciais;

    // Ordenar por ordem
    applicableDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    // Rastrear keys dinâmicos
    _dynamicDerivedKeys = new Set(applicableDVs.map(dv => dv.key));

    // Renderizar grid
    grid.innerHTML = '';

    const blocksArray = _dvAgruparEmBlocos(applicableDVs);

    blocksArray.forEach(block => {
        // <details> nativo, recolhido: sem JS de toggle e sem estado para guardar.
        // É a mesma peça que a aba Combate usa (.cbt-block); aqui todos nascem
        // fechados, porque a Principal tem bloco demais para caber de uma vez.
        const blockContainer = document.createElement('details');
        blockContainer.className = 'dv-block-container';
        // A aba Combate usa a ordem para decidir quais blocos nascem abertos.
        blockContainer.dataset.blocoOrdem = block.ordem;

        const resumo = document.createElement('summary');
        // O título continua sendo .attr-block-title: é por ele que o
        // combat-panel identifica o bloco em collectBlocks().
        const titleEl = document.createElement('span');
        titleEl.className = 'attr-block-title';
        titleEl.textContent = block.nome || 'Geral';
        resumo.appendChild(titleEl);

        const contador = document.createElement('span');
        contador.className = 'dv-block-n';
        contador.textContent = block.dvs.length;
        resumo.appendChild(contador);
        blockContainer.appendChild(resumo);

        const blockGrid = document.createElement('div');
        blockGrid.className = 'combat-grid';

        block.dvs.forEach(dv => blockGrid.appendChild(_dvCriarCampo(dv)));

        blockContainer.appendChild(blockGrid);
        grid.appendChild(blockContainer);
    });

    // Limpar cache de bônus para campos "Atual" recriados, forçando
    // _applyFieldBonuses() a re-aplicar os bônus de mecânica.
    // Sem isso, o sistema vê que previousBonus === bonus e pula a
    // atualização do DOM, deixando o campo em '0'.
    if (state.appliedFieldBonuses || state.fieldBaseValues) {
        for (const dvKey of _dynamicDerivedKeys) {
            const dataKey = `dv_${dvKey}_atual`;
            if (state.appliedFieldBonuses) delete state.appliedFieldBonuses[dataKey];
            if (state.fieldBaseValues) delete state.fieldBaseValues[dataKey];
        }
    }

    _dvRestaurarAtuais();

    // Setup tooltips after rendering
    initDerivedTooltips();
}

/** Span de prefixo/sufixo do campo (ex.: "m", "kg", "+"). */
function _dvAfixo(texto) {
    const span = document.createElement('span');
    span.className = 'dv-affix';
    span.textContent = texto;
    return span;
}

/** Label do campo: ícone + nome, marca de tooltip e etiqueta de escopo por item. */
function _dvCriarLabel(dv, miniField) {
    const label = document.createElement('label');
    label.className = 'dv-label';
    if (dv.descricao || (dv.mechPreviews && dv.mechPreviews.length) || dv.arredondaMesa) {
        label.classList.add('has-tooltip');
    }
    label.textContent = `${dv.icone} ${dv.nome}`;
    label.dataset.dvId = dv.id;

    // DV escopado por item: o número aqui é a BASE do personagem; o total
    // com cada item equipado sai na aba Combate → Ataques e Efeitos Ativos.
    if (dv.escopoItem) {
        miniField.classList.add('dv-escopo-item');
        const tag = document.createElement('span');
        tag.className = 'dv-escopo-tag';
        tag.textContent = '🎒 base';
        tag.title = 'Valor base do personagem. O total com cada item equipado aparece na aba Combate → Ataques e Efeitos Ativos.';
        label.appendChild(tag);
    }
    return label;
}

/** Input do Máximo (calculado). Só o Criador digita num campo não editável. */
function _dvCriarInputMaximo(dv) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `dv_${dv.key}_display`;
    input.className = 'derived-field';
    input.value = '0';

    if (dv.campoEditavel) return input;

    if (window.isCreator) {
        input.style.border = '2px solid #f59e0b';
        input.title = '🛡️ Modo Criador: edição livre';
        input.addEventListener('input', () => {
            if (!state.derivedOverrides) state.derivedOverrides = {};
            state.derivedOverrides[dv.key] = input.value;
            if (typeof scheduleAutosave === 'function') scheduleAutosave();
        });
    } else {
        input.readOnly = true;
    }
    return input;
}

/** Input do Atual (editável pelo jogador), gravado em state.dvAtual. */
function _dvCriarInputAtual(dv) {
    const atualInput = document.createElement('input');
    atualInput.type = 'text';
    atualInput.id = `dv_${dv.key}_atual`;
    atualInput.dataset.key = `dv_${dv.key}_atual`;
    atualInput.className = 'dv-atual-input';
    atualInput.placeholder = '0';
    atualInput.value = '0';
    atualInput.addEventListener('input', () => {
        if (!state.dvAtual) state.dvAtual = {};
        // Sem clamp automático: o valor digitado pelo jogador é preservado.
        // Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
        state.dvAtual[dv.key] = atualInput.value;
        if (typeof scheduleAutosave === 'function') scheduleAutosave();
    });
    return atualInput;
}

/** Linha "Atual / Máx". Com prefixo ou sufixo os afixos abraçam o par inteiro. */
function _dvLinhaAtualMax(dv, input) {
    const atualInput = _dvCriarInputAtual(dv);

    const sep = document.createElement('span');
    sep.className = 'dv-atual-sep';
    sep.textContent = '/';

    // Máximo é readOnly no modo Atual/Máx
    input.readOnly = true;
    input.classList.add('dv-atual-max');

    if (!dv.prefixo && !dv.sufixo) {
        const atualRow = document.createElement('div');
        atualRow.className = 'dv-atual-row';
        atualRow.appendChild(atualInput);
        atualRow.appendChild(sep);
        atualRow.appendChild(input);
        return atualRow;
    }

    const outerRow = document.createElement('div');
    outerRow.className = 'dv-value-row';
    input.classList.add('dv-input-inline');
    atualInput.classList.add('dv-input-inline');

    if (dv.prefixo) outerRow.appendChild(_dvAfixo(dv.prefixo));
    outerRow.appendChild(atualInput);
    outerRow.appendChild(sep);
    outerRow.appendChild(input);
    if (dv.sufixo) outerRow.appendChild(_dvAfixo(dv.sufixo));
    return outerRow;
}

/** Linha do campo simples. Sem prefixo nem sufixo é o input pelado. */
function _dvLinhaValor(dv, input) {
    if (!dv.prefixo && !dv.sufixo) return input;

    const valueRow = document.createElement('div');
    valueRow.className = 'dv-value-row';

    // A moldura do Modo Criador passa para a linha; o input fica sem borda.
    if (!dv.campoEditavel && window.isCreator) {
        valueRow.style.border = '2px solid #f59e0b';
        input.style.border = 'none';
    }

    input.classList.add('dv-input-inline');
    if (dv.prefixo) valueRow.appendChild(_dvAfixo(dv.prefixo));
    valueRow.appendChild(input);
    if (dv.sufixo) valueRow.appendChild(_dvAfixo(dv.sufixo));
    return valueRow;
}

/** Um campo da grid: label + (Atual/Máx) ou (valor único). */
function _dvCriarCampo(dv) {
    const miniField = document.createElement('div');
    miniField.className = 'mini-field';
    miniField.dataset.dvId = dv.id;
    miniField.dataset.dvKey = dv.key;

    const input = _dvCriarInputMaximo(dv);
    miniField.appendChild(_dvCriarLabel(dv, miniField));
    miniField.appendChild(dv.campoAtual ? _dvLinhaAtualMax(dv, input) : _dvLinhaValor(dv, input));
    return miniField;
}

/** Devolve aos campos "Atual" recém-criados o que o jogador tinha digitado. */
function _dvRestaurarAtuais() {
    if (!state.dvAtual) return;
    for (const [dvKey, val] of Object.entries(state.dvAtual)) {
        const atualEl = document.getElementById(`dv_${dvKey}_atual`);
        if (atualEl && val !== undefined && val !== '') atualEl.value = val;
    }
}

/* ===== TOOLTIPS FLUTUANTES (Valores Derivados + Status Vitais + Perícias) ===== */

let _dvTooltipEl = null;

/** Liga mostrar/esconder do tooltip num elemento — mouse e toque. */
function _dvLigarTooltip(el) {
    el.addEventListener('mouseenter', showDvTooltip);
    el.addEventListener('mouseleave', hideDvTooltip);
    el.addEventListener('click', abrirDetalheDoRotulo);
    /* No toque não há hover: o dedo abre a janela direto, que é onde a
       fórmula cabe de verdade. */
    el.addEventListener('touchstart', showDvTooltip, { passive: true });
    el.addEventListener('touchend', hideDvTooltip);
}

function _ensureTooltipEl() {
    if (!_dvTooltipEl) {
        _dvTooltipEl = document.createElement('div');
        _dvTooltipEl.className = 'dv-tooltip';
        _dvTooltipEl.style.display = 'none';
        document.body.appendChild(_dvTooltipEl);
    }
}

function initDerivedTooltips() {
    _ensureTooltipEl();

    // Vincular eventos nos labels de Valores Derivados
    document.querySelectorAll('.dv-label.has-tooltip').forEach(label => {
        _dvLigarTooltip(label);
    });
}

/**
 * Inicializa tooltips nos labels de Status Vitais.
 * Chamada após VITAL_STATS ser carregado do Firebase.
 */
function initVitalStatsTooltips() {
    _ensureTooltipEl();
    const vitalStats = window.VITAL_STATS || [];
    if (!vitalStats.length) return;

    document.querySelectorAll('.vital-label[data-vital-key]').forEach(label => {
        // Evitar bind duplicado
        if (label.dataset.tooltipBound) return;
        const key = label.dataset.vitalKey;
        const vs = vitalStats.find(v => v.key === key);
        if (!vs) return;

        // Verificar conteúdo direto
        let hasContent = vs.descricao || (vs.mechPreviews && vs.mechPreviews.length);

        // Verificar mecânicas externas que afetam este vital stat
        if (!hasContent && typeof getAffectingMechanics === 'function') {
            const linkedIds = vs.mecanicaIds || [];
            const propNames = [`${vs.nome} Máxima`, `${vs.nome} Máximo`, vs.nome];
            for (const propName of propNames) {
                const extras = getAffectingMechanics(propName, { skipLinked: linkedIds });
                if (extras.length > 0) { hasContent = true; break; }
            }
        }

        if (!hasContent) return;

        label.dataset.tooltipBound = '1';
        label.classList.add('has-tooltip');
        label.dataset.tooltipType = 'vital';
        _dvLigarTooltip(label);
    });
}

/**
 * Inicializa tooltips flutuantes nos nomes das Perícias.
 * Chamada após SKILLS ser carregado do Firebase e renderizado via initSkills().
 */
function initSkillTooltips() {
    _ensureTooltipEl();

    // Bind em skills que já têm has-tooltip (via descrição)
    document.querySelectorAll('.sk-name.has-tooltip').forEach(nameEl => {
        if (nameEl.dataset.tooltipBound) return;
        nameEl.dataset.tooltipBound = '1';
        nameEl.dataset.tooltipType = 'skill';
        _dvLigarTooltip(nameEl);
    });

    // Verificar skills SEM has-tooltip mas que são afetadas por mecânicas externas
    if (typeof getAffectingMechanics === 'function') {
        document.querySelectorAll('.sk-name:not(.has-tooltip)').forEach(nameEl => {
            if (nameEl.dataset.tooltipBound) return;
            const skillName = nameEl.textContent.trim();
            // Verificar se há mecânicas afetando esta perícia
            const extras = getAffectingMechanics(skillName, { skipLinked: [] });
            if (extras.length > 0) {
                nameEl.classList.add('has-tooltip');
                nameEl.dataset.tooltipBound = '1';
                nameEl.dataset.tooltipType = 'skill';
                _dvLigarTooltip(nameEl);
            }
        });
    }
}

/* ===== HARDCODED ATTRIBUTE DESCRIPTIONS ===== */
const ATTRIBUTE_DESCRIPTIONS = {
    INT: 'Representa a sabedoria, memória e conhecimento acumulado do personagem. É o quanto ele sabe e o quão esperto ele é.',
    RAC: 'Velocidade de pensamento, percepção e capacidade de reagir mentalmente. É a agilidade da mente, o "pensar rápido".',
    PRS: 'Força de vontade prolongada, resistência mental e foco sob pressão. É o que impede o personagem de desistir quando tudo parece perdido.',
    FOR: 'Potência muscular, capacidade de carga e poder de dano corpo-a-corpo. Determina o quanto o personagem consegue carregar, empurrar e golpear.',
    DES: 'Agilidade, coordenação motora e precisão de movimentos. Governa reflexos, equilíbrio e a capacidade de realizar ações que exigem fineza física.',
    VIG: 'Resistência física, saúde e capacidade de suportar dano. É o que mantém o personagem de pé após levar uma surra ou correr por horas.',
    PRE: 'Magnetismo pessoal, capacidade de impressionar e intimidar. É aquela força invisível que faz as pessoas prestarem atenção quando o personagem entra numa sala.',
    MAN: 'Habilidade de influenciar, persuadir e enganar outros. É a arte de fazer as pessoas fazerem o que você quer, muitas vezes sem que percebam.',
    AUT: 'Domínio sobre as próprias emoções e calma sob pressão. É o que separa quem age racionalmente de quem é dominado pelo medo ou pela raiva no calor do momento.',
};

const ATTRIBUTE_FULL_NAMES = {
    INT: 'Inteligência',
    RAC: 'Raciocínio',
    PRS: 'Perseverança',
    FOR: 'Força',
    DES: 'Destreza',
    VIG: 'Vigor',
    PRE: 'Presença',
    MAN: 'Manipulação',
    AUT: 'Autocontrole',
};

/**
 * Inicializa tooltips flutuantes nos nomes dos Atributos.
 * Chamada após o carregamento dos dados do Firebase.
 */
function initAttributeTooltips() {
    _ensureTooltipEl();

    document.querySelectorAll('.attr-name[data-attr-key]').forEach(nameEl => {
        if (nameEl.dataset.tooltipBound) return;
        const attrKey = nameEl.dataset.attrKey;
        if (!ATTRIBUTE_DESCRIPTIONS[attrKey]) return;

        nameEl.classList.add('has-tooltip');
        nameEl.dataset.tooltipBound = '1';
        nameEl.dataset.tooltipType = 'attribute';
        _dvLigarTooltip(nameEl);
    });
}

/* ----- Peças de HTML do tooltip (as mesmas nos quatro tipos) ----- */

/**
 * Monta a janelinha pelo conteúdo COMPARTILHADO (shared/detalhe.js): nome em
 * ouro no topo, descrição, fórmula e onde o valor é usado. É o mesmo miolo da
 * Ficha de NPC e da do Aliado.
 *
 * Os previews que esta ficha já calculava (mecânicas vinculadas e as de fora
 * que afetam o valor) entram como fórmula: eles SÃO o que forma o número.
 */
function _dvMontar({ nome, icone, descricao, vinculadas = [], externas = [], nota = '' }) {
    const formula = [
        ...vinculadas.map(p => ({ fonte: 'Vinculada', texto: p })),
        ...externas.map(f => ({ fonte: f.fonte, texto: f.preview })),
    ];
    return { nome, icone, descricao, formula, nota, sys: window._systemData || null };
}

const _dvDesc = (texto) => texto ? `<div class="dv-tooltip-desc">${_escHtml(texto)}</div>` : '';

/* Os dois blocos de HTML que moravam aqui (Mecânicas Vinculadas e Outras
   fontes) saíram: quem monta a janelinha agora é shared/detalhe.js, e as
   duas listas entram lá como FÓRMULA — que é o que elas sempre foram. */

/**
 * Mecânicas de fora que afetam a propriedade, procurando por cada variante de
 * nome (o TARGET_MAP guarda aliases tipo "X Máxima"/"X Máximo") e juntando o
 * resultado sem repetir o mesmo par fonte+preview.
 */
function _dvMecanicasQueAfetam(nomes, linkedIds = []) {
    if (typeof getAffectingMechanics !== 'function') return [];
    const achadas = [];
    for (const nome of nomes) {
        for (const f of getAffectingMechanics(nome, { skipLinked: linkedIds })) {
            if (!achadas.some(a => a.preview === f.preview && a.fonte === f.fonte)) achadas.push(f);
        }
    }
    return achadas;
}


/* ----- Um construtor de conteúdo por tipo de tooltip ----- */

function _dvTooltipVital(label) {
    const vs = (window.VITAL_STATS || []).find(v => v.key === label.dataset.vitalKey);
    if (!vs) return '';
    // Variantes de nome cobrem os aliases do TARGET_MAP.
    const extras = _dvMecanicasQueAfetam(
        [`${vs.nome} Máxima`, `${vs.nome} Máximo`, vs.nome], vs.mecanicaIds || []);
    return _dvMontar({
        nome: vs.nome, icone: vs.icone, descricao: vs.descricao,
        vinculadas: vs.mechPreviews || [], externas: extras,
    });
}

function _dvTooltipAtributo(label) {
    const attrKey = label.dataset.attrKey;
    const fullName = ATTRIBUTE_FULL_NAMES[attrKey] || attrKey;
    // Procura pela abreviação e pelo nome completo.
    const extras = _dvMecanicasQueAfetam([attrKey, fullName]);
    return _dvMontar({
        nome: fullName, descricao: ATTRIBUTE_DESCRIPTIONS[attrKey], externas: extras,
    });
}

function _dvTooltipPericia(label) {
    const skillName = label.textContent.trim();
    const skill = Object.values(window.SKILLS || {})
        .map(cat => cat.find(s => s.name === skillName)).find(Boolean);
    if (!skill) return '';

    const linkedMechIds = skill.mecanicaIds || [];
    const linkedPreviews = linkedMechIds.map(mid => {
        const m = (window._systemData?.mechanics || []).find(x => x.id === mid);
        if (!m) return null;
        return typeof generatePreviewText === 'function' ? generatePreviewText(m) : (m.descricao || '');
    }).filter(Boolean);

    const extras = _dvMecanicasQueAfetam([skillName], linkedMechIds);
    return _dvMontar({
        nome: skill.nome || skillName, descricao: skill.descricao,
        vinculadas: linkedPreviews, externas: extras,
    });
}

function _dvTooltipPeculiaridade(label) {
    return typeof buildPeculiarityDetalhe === 'function'
        ? buildPeculiarityDetalhe(label.dataset.pecKey, label.dataset.raceKey)
        : null;
}

function _dvTooltipValorDerivado(label) {
    const dvId = label.dataset.dvId;
    const dv = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
    if (!dv) return '';

    // O que esta ficha sabe DESTE personagem e o registro não sabe: o valor
    // exato antes do arredondamento de mesa e a constante da criação. Vai como
    // nota, depois dos blocos.
    let notas = [];

    // Valor exato de um VD que exibe arredondado na mesa (ex.: Blindagem).
    if (dv.arredondaMesa) {
        const exato = Number(state.derived?.[dv.key] || 0);
        if (!Number.isInteger(exato)) {
            notas.push(`Valor exato: ${exato.toFixed(2).replace('.', ',')}`
                + ` · na mesa vale ${dvValorDeMesa(exato)}`);
        }
    }

    // Constante de Criação (modificador definido no slider da Véspera da Partida)
    const creationMod = state.derivedModifiers?.[dvId];
    if (creationMod && creationMod !== 0) {
        const sign = creationMod > 0 ? '+' : '';
        const fmtMod = Number.isInteger(creationMod) ? String(creationMod) : creationMod.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        notas.push(`🎯 Constante de Criação: ${sign}${fmtMod}`);
    }

    // Variantes de nome cobrem os aliases com/sem sufixo Máxima/Máximo.
    const extras = _dvMecanicasQueAfetam(
        [dv.nome, `${dv.nome} (Máximo)`, `${dv.nome} Máxima`, `${dv.nome} Máximo`], dv.mecanicaIds || []);

    return _dvMontar({
        nome: dv.nome, icone: dv.icone, descricao: dv.descricao,
        vinculadas: dv.mechPreviews || [], externas: extras,
        nota: notas.join(' · '),
    });
}

const _DV_TOOLTIP_POR_TIPO = {
    vital: _dvTooltipVital,
    attribute: _dvTooltipAtributo,
    skill: _dvTooltipPericia,
    peculiaridade: _dvTooltipPeculiaridade,
    // Texto pronto em `data-tooltip-text`, para o que NÃO é Valor Derivado —
    // o alcance do disparo sai da arma equipada e da FOR, não do cadastro.
    // Sem isto o chip só teria `title`, que no celular ninguém vê.
    /* Texto pronto em `data-tooltip-text`, para o que NÃO é Valor Derivado.
       Ganha nome no topo como todo o resto — `data-tooltip-nome` diz qual. */
    texto: el => el.dataset.tooltipText
        ? _dvMontar({ nome: el.dataset.tooltipNome || el.textContent.trim(), descricao: el.dataset.tooltipText })
        : null,
};

/** Encosta o tooltip no label sem deixar nada dele fora da tela.
 *  A conta mora em shared/detalhe.js: as três telas tinham a mesma e as três
 *  jogavam a caixa para cima sem conferir se cabia lá. */
function _dvPosicionarTooltip(label) {
    if (window.LRDetalhe) return window.LRDetalhe.posicionarCaixa(_dvTooltipEl, label);
    _dvTooltipEl.style.left = label.getBoundingClientRect().left + 'px';
    _dvTooltipEl.style.top = (label.getBoundingClientRect().bottom + 6) + 'px';
}

/* O descritor deste rótulo. Os construtores por tipo sabem ONDE mora a
   descrição e a lista de mecânicas de cada coisa; o formato é o mesmo. */
function _dvDescritor(label) {
    const construir = _DV_TOOLTIP_POR_TIPO[label.dataset.tooltipType] || _dvTooltipValorDerivado;
    const o = construir(label);
    return (o && o.nome) ? o : null;
}

/**
 * O hover mostra RESUMO — nome, descrição e o convite. A fórmula inteira só
 * na janela, pelo clique: valor denso (a Sanidade tem doze linhas) estourava
 * a tela quando tudo vinha aqui, porque caixa flutuante não tem para onde
 * crescer sem sair do viewport.
 */
function showDvTooltip(e) {
    const label = e.currentTarget;
    if (!_dvTooltipEl) return;
    const o = _dvDescritor(label);
    if (!o) return;   // nada a dizer: o tooltip continua escondido
    const html = window.LRDetalhe
        ? window.LRDetalhe.detalheHTML(o, 'resumo')
        : _dvDesc(o.descricao);
    if (!html) return;

    _dvTooltipEl.innerHTML = html;
    _dvTooltipEl.style.display = 'block';
    _dvPosicionarTooltip(label);
}

/** Clique no rótulo: a janela, com tudo. É por aqui que o celular chega aos
 *  detalhes — lá hover não existe. */
function abrirDetalheDoRotulo(e) {
    if (!window.LRDetalhe) return;
    const o = _dvDescritor(e.currentTarget);
    if (!o || !window.LRDetalhe.temDetalhe(o)) return;
    hideDvTooltip();
    window.LRDetalhe.abrirDetalhe(o);
}

function hideDvTooltip() {
    if (_dvTooltipEl) _dvTooltipEl.style.display = 'none';
}

function _escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ===== RECALC ALL — Status Vitais (mecânicas) + Dinâmicos (Firebase) ===== */

/**
 * Zera o que a passada anterior deixou de contribuição DINÂMICA (mecânicas de VD
 * cuja equação referencia a ficha) e re-resolve com os valores de agora. Só as
 * dinâmicas saem: bônus fixos de peculiaridade racial e afins ficam de pé.
 */
function _dvDesfazerContribuicoesDinamicas() {
    if (typeof resolveDerivedValueMechanicsLive !== 'function'
        || typeof _getDynamicMechContributions !== 'function') return;

    const bonuses = state.mechanicBonuses || {};
    for (const [key, contribution] of Object.entries(_getDynamicMechContributions())) {
        if (key.startsWith('SET:') || key.startsWith('BASE_SET:')) {
            // SET é override absoluto: não há o que subtrair, some a chave inteira
            delete bonuses[key];
        } else if (key.startsWith('MULT:') || key.startsWith('DIV:') || key.startsWith('BASE_MULT:') || key.startsWith('BASE_DIV:')) {
            // × e ÷ se desfazem dividindo pela contribuição anterior
            if (contribution && contribution !== 0) bonuses[key] = (bonuses[key] || 1) / contribution;
            else delete bonuses[key];
        } else {
            // + e − se desfazem subtraindo
            bonuses[key] = (bonuses[key] || 0) - contribution;
        }
    }
    resolveDerivedValueMechanicsLive();
}

/** Criador editou o campo à mão: o valor digitado manda, sem recalcular nada. */
function _dvUsarOverride(dvKey, overrideVal) {
    const displayEl = document.getElementById(`dv_${dvKey}_display`);
    if (displayEl && displayEl.value !== String(overrideVal)) displayEl.value = overrideVal;
    if (!state.derived) state.derived = {};
    state.derived[dvKey] = parseFloat(String(overrideVal).replace(',', '.')) || 0;
}

/** Calcula um Valor Derivado, escreve no campo e guarda em state.derived. */
function _dvRecalcularUm(dvKey, bonuses, limits) {
    const overrideVal = state.derivedOverrides?.[dvKey];
    if (overrideVal !== undefined && overrideVal !== '') return _dvUsarOverride(dvKey, overrideVal);

    const dvDef = (window.DERIVED_VALUES || []).find(d => d.key === dvKey);
    const initials = window._dvInitialValues || {};
    const initialConstant = (dvDef && initials[dvDef.id]) ? initials[dvDef.id] : 0;

    // A constante inicial de Raça/Classe/Tribo entra como BASE, antes dos
    // modificadores gerais: sem isso um "×1,1 na Altura" (Gigantismo)
    // multiplicaria 0 em vez de multiplicar a altura da raça.
    let value = _applyMechanicModifiers(dvKey, 0, bonuses, limits, initialConstant);

    // A constante da Véspera da Partida (Criar Personagem) entra SEMPRE depois das mecânicas
    if (dvDef && state.derivedModifiers?.[dvDef.id]) value += state.derivedModifiers[dvDef.id];

    const displayEl = document.getElementById(`dv_${dvKey}_display`);
    if (displayEl) displayEl.value = dvFormatarExibicao(value, dvDef);

    // Campo "Atual": o max é informativo, sem clampar o que o jogador digitou.
    // Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
    if (dvDef?.campoAtual) {
        const atualEl = document.getElementById(`dv_${dvKey}_atual`);
        if (atualEl) atualEl.max = value;
    }

    // Atualizar também o campo hardcoded, se existir (ex: ENER_MAX)
    if (DERIVED_FIELDS_MAP[dvKey]) updateDerivedField(dvKey, value);

    if (!state.derived) state.derived = {};
    state.derived[dvKey] = value;

    // VD espelho (Blindagem Cortante, Blindagem Vermelha...): nasce igual ao
    // geral e só interessa quando alguma peça vestida foge do padrão. Igual
    // ao espelhado, some da grid — senão são dezesseis linhas repetindo o
    // mesmo número. Diferente, marca se é fraqueza ou resistência.
    _dvAplicarEspelho(dvDef, dvKey, value);
}

/**
 * Teto e bloqueio de mecânica truncam o state.dots de atributos e perícias — o
 * valor guardado não pode ficar acima do que o efetivo permite.
 */
function _dvTruncarDotsPorLimite(limits) {
    const truncar = (field, novoValor) => {
        state.dots[field] = novoValor;
        const dotsEl = document.querySelector(`.dots5[data-attr="${field}"]`);
        if (dotsEl && typeof refreshDots === 'function') refreshDots(dotsEl, field);
    };

    for (const [field, limit] of Object.entries(limits)) {
        if (!field.startsWith('attr_') && !field.startsWith('sk_')) continue;
        const atual = state.dots[field] || 0;

        if (limit.tipo === 'bloqueio') {
            if (atual > 0) truncar(field, 0);
        } else if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) {
            // O teto vale sobre o EFETIVO: desconta o piso e o bônus de mecânica
            // para achar quanto o jogador ainda pode ter de pontos próprios.
            const floorBonus = (limit.tipo === 'clamp' && limit.min != null) ? limit.min : 0;
            const mechBonus = state.mechanicBonuses?.[field] || 0;
            const teto = Math.max(0, limit.max - floorBonus - mechBonus);
            if (atual > teto) truncar(field, teto);
        }
    }
}

function recalcAll() {
    _dvDesfazerContribuicoesDinamicas();

    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    // 1) Calcular Status Vitais (via mecânicas do Firebase — base 0)
    for (const key of Object.keys(DERIVED_FIELDS_MAP)) {
        // Se este key está renderizado na grid dinâmica, pular
        if (_dynamicDerivedKeys.has(key)) continue;
        updateDerivedField(key, _applyMechanicModifiers(key, 0, bonuses, limits));
    }

    // 2) Calcular valores derivados dinâmicos (Firebase-driven)
    // Inclui DVs fora da grid: as mecânicas deles já são aplicadas
    // (applyDerivedValueMechanics percorre TODOS os DVs), mas sem passar por
    // aqui o state.derived fica vazio e quem os referencia — chips de módulos
    // de classe (ex: Manobras do Guerreiro) — exibe "—".
    const dvKeysToCalc = new Set([
        ..._dynamicDerivedKeys,
        ...(window.DERIVED_VALUES || []).map(d => d.key),
    ]);
    for (const dvKey of dvKeysToCalc) _dvRecalcularUm(dvKey, bonuses, limits);

    // Bloco cujos VDs sumiram todos (as 16 Blindagens espelho, quando nenhuma
    // peça vestida foge do padrão) fica com o título órfão e nada embaixo.
    _dvOcultarBlocosVazios();

    // 3) Aplicar limites em atributos e perícias (teto trunca state.dots)
    _dvTruncarDotsPorLimite(limits);

    // 4) Aplicar bônus de mecânicas em campos DOM (field:xxx, ex: blindagem, tamanho)
    _applyFieldBonuses(bonuses);

    // 5) Aplicar bônus visuais nos dots
    applyMechanicBonusesToDots();

    // 6) Sincronizar componentes reativos dos módulos de classe (VD)
    if (typeof syncModuleDerivedValuesUI === 'function') syncModuleDerivedValuesUI();

    // 7) Tabela "Ataques e Efeitos Ativos" — depende de state.derived já calculado
    //    acima. Só lê e escreve no DOM; não recalcula nada (evita laço infinito).
    if (typeof renderActiveEffects === 'function') renderActiveEffects();

    // 8) Painel de Combate — espelha Status Vitais e Valores Derivados já
    //    calculados. Também só lê e escreve no DOM.
    if (typeof renderCombatPanel === 'function') renderCombatPanel();
}

/**
 * Aplica modificadores de mecânicas (bônus, mult, div, set, limites) a um valor derivado.
 */
function _applyMechanicModifiers(key, value, bonuses, limits, baseExtra = 0) {
    const bonusKey = `DERIVED:${key}`;

    // === 1. AVALIAR MECÂNICAS BASE (Vinculadas) ===
    const baseSetKey = `BASE_SET:${bonusKey}`;
    if (bonuses[baseSetKey] !== undefined) {
        value = bonuses[baseSetKey];
    }

    const baseAddKey = `BASE:${bonusKey}`;
    value += (bonuses[baseAddKey] || 0);

    // × e ÷ das fórmulas BASE arredondam a 2 casas, igual aos gerais abaixo.
    // Truncar aqui zerava Blindagem tipada e qualquer VD fracionário.
    const baseMultKey = `BASE_MULT:${bonusKey}`;
    if (bonuses[baseMultKey]) {
        value = Math.round(value * bonuses[baseMultKey] * 100) / 100;
    }

    const baseDivKey = `BASE_DIV:${bonusKey}`;
    if (bonuses[baseDivKey] && bonuses[baseDivKey] !== 0) {
        value = Math.round(value / bonuses[baseDivKey] * 100) / 100;
    }

    // Constante de Raça/Classe/Tribo: faz parte da base, então os modificadores
    // gerais abaixo (incluindo × e ÷) incidem sobre ela.
    value += baseExtra;

    // === 2. AVALIAR MODIFICADORES GERAIS (Peculiaridades, Itens, Condições) ===
    // "Definir fixo" (=) — overrides the base formula entirely
    const setKey = `SET:${bonusKey}`;
    if (bonuses[setKey] !== undefined) {
        value = bonuses[setKey];
    }

    value += (bonuses[bonusKey] || 0);

    // Teto sobre a parcela de PEÇAS (tipoLimite 'maximo_itens'). O bag geral
    // acima já somou tudo; aqui devolvemos só o excesso que veio de item, para
    // que peculiaridade e condição continuem passando inteiras. Ver Domínio de
    // proteção: sem o treino, o que o aço rende para no atributo.
    const capItens = bonuses[`ITEMCAP:${bonusKey}`];
    if (capItens !== undefined) {
        const dasPecas = bonuses[`ITEM:${bonusKey}`] || 0;
        if (dasPecas > capItens) value -= (dasPecas - capItens);
    }

    // Multiplicadores e divisores de mecânicas. Sem Math.floor (ao contrário das
    // fórmulas BASE acima): estes incidem sobre valores fracionários — Altura em
    // metros, onde 1,70 × 1,1 truncado viraria 1.
    const multKey = `MULT:${bonusKey}`;
    if (bonuses[multKey]) {
        value = Math.round(value * bonuses[multKey] * 100) / 100;
    }

    const divKey = `DIV:${bonusKey}`;
    if (bonuses[divKey] && bonuses[divKey] !== 0) {
        value = Math.round(value / bonuses[divKey] * 100) / 100;
    }

    // Limites
    const limit = limits[bonusKey];
    if (limit) {
        // Teto e piso são independentes — 'clamp' traz os dois de uma vez.
        if (limit.tipo === 'bloqueio') value = 0;
        if (limit.max != null) value = Math.min(value, limit.max);
        if (limit.min != null) value = Math.max(value, limit.min);
    }

    return value;
}

/**
 * Aplica bônus de mecânicas em campos DOM (field:xxx).
 */
function _applyFieldBonuses(bonuses) {
    if (!state.fieldBaseValues) state.fieldBaseValues = {};
    if (!state.appliedFieldBonuses) state.appliedFieldBonuses = {};

    const fieldBonuses = {};
    const fieldSets = {};
    for (const [bonusKey, bonusVal] of Object.entries(bonuses)) {
        if (bonusKey.startsWith('field:')) {
            if (!bonusVal || bonusVal === 0) continue;
            const dataKey = bonusKey.slice(6);
            fieldBonuses[dataKey] = (fieldBonuses[dataKey] || 0) + bonusVal;
        } else if (bonusKey.startsWith('SET:field:')) {
            const dataKey = bonusKey.slice(10);
            fieldSets[dataKey] = bonusVal;
        }
    }

    // Resetar campos sem bônus
    document.querySelectorAll('[data-mechanic-field-bonus]').forEach(el => {
        const dk = el.dataset.key;
        if (!dk || fieldBonuses[dk] !== undefined || fieldSets[dk] !== undefined) return;
        if (state.fieldBaseValues[dk] !== undefined) {
            el.value = state.fieldBaseValues[dk];
        }
        el.removeAttribute('data-mechanic-field-bonus');
        delete state.appliedFieldBonuses[dk];
    });

    // Aplicar bônus atuais
    for (const [dataKey, bonus] of Object.entries(fieldBonuses)) {
        const el = document.querySelector(`[data-key="${dataKey}"]`);
        if (!el) continue;
        const previousBonus = state.appliedFieldBonuses[dataKey];
        if (previousBonus !== undefined && previousBonus === bonus) {
            el.setAttribute('data-mechanic-field-bonus', 'true');
            continue;
        }
        if (state.fieldBaseValues[dataKey] === undefined) {
            if (previousBonus !== undefined) {
                state.fieldBaseValues[dataKey] = (parseFloat(el.value) || 0) - previousBonus;
            } else {
                state.fieldBaseValues[dataKey] = parseFloat(el.value) || 0;
            }
        }
        const baseVal = state.fieldBaseValues[dataKey];
        el.value = baseVal + bonus;
        el.setAttribute('data-mechanic-field-bonus', 'true');
        state.appliedFieldBonuses[dataKey] = bonus;
    }

    // SET: overrides
    for (const [dataKey, setVal] of Object.entries(fieldSets)) {
        const el = document.querySelector(`[data-key="${dataKey}"]`);
        if (!el) continue;
        if (state.fieldBaseValues[dataKey] === undefined) {
            state.fieldBaseValues[dataKey] = parseFloat(el.value) || 0;
        }
        const bonus = fieldBonuses[dataKey] || 0;
        el.value = setVal + bonus;
        el.setAttribute('data-mechanic-field-bonus', 'true');
        state.appliedFieldBonuses[dataKey] = setVal + bonus;
    }
}

/** Piso e teto visuais que a mecânica impõe a um dotKey. Sem mecânica: 0 a 5. */
function _dvPisoETeto(limit) {
    if (!limit) return { piso: 0, teto: 5 };
    if (limit.tipo === 'bloqueio') return { piso: 0, teto: 0 };
    const ehPiso = limit.tipo === 'minimo' || limit.tipo === 'clamp';
    const ehTeto = limit.tipo === 'maximo' || limit.tipo === 'clamp';
    return {
        piso: (ehPiso && limit.min != null) ? limit.min : 0,
        teto: (ehTeto && limit.max != null) ? limit.max : 5,
    };
}

/** Apaga todo estado visual da bolinha antes de repintar. */
function _dvLimparDot(d) {
    d.classList.remove('filled', 'bonus', 'floor', 'capped', 'aura-filled');
    d.style.removeProperty('--aura-color');
}

/**
 * Pintura padrão: piso primeiro, depois os pontos do jogador, depois o bônus.
 * O que passa do teto vira bolinha inativa.
 */
function _dvPintarDots(container, { piso, teto, baseVal, bonus }) {
    container.querySelectorAll('.dot').forEach(d => {
        const val = +d.dataset.val;
        _dvLimparDot(d);
        if (val > teto) return d.classList.add('capped');

        if (val <= piso) d.classList.add('filled', 'floor');
        else if (val <= piso + baseVal) d.classList.add('filled');
        else if (val <= piso + baseVal + bonus) d.classList.add('filled', 'bonus');
    });
}

/**
 * Pintura com Aura: a régua dá voltas. As bolinhas mostram só a posição DENTRO
 * do grau atual, tingidas com a cor daquele grau.
 */
function _dvPintarDotsComAura(container, key, auraInfo, { piso, baseVal, bonus, baseDots }) {
    const auraCeiling = (auraInfo.grauDesbloqueado + 1) * baseDots;
    const nivel = Math.min(baseVal + piso + bonus, auraCeiling);
    const grauAtual = nivel > 0 ? Math.floor((nivel - 1) / baseDots) : 0;
    const posNoGrau = nivel > 0 ? ((nivel - 1) % baseDots) + 1 : 0;
    const cor = typeof getAuraColorForGrade === 'function' ? getAuraColorForGrade(auraInfo.aura, grauAtual) : null;

    container.querySelectorAll('.dot').forEach(d => {
        const val = +d.dataset.val;
        _dvLimparDot(d);
        if (val > baseDots) return d.classList.add('capped');

        if (val <= posNoGrau) {
            d.classList.add('filled');
            if (cor) {
                d.classList.add('aura-filled');
                d.style.setProperty('--aura-color', cor);
            }
        }
    });

    if (typeof _updateGradeIndicator === 'function') {
        _updateGradeIndicator(container, key, grauAtual, auraInfo, baseDots, nivel);
    }
}

/**
 * Aplica visualmente os bônus de mecânicas (sk_* e attr_*) nos dots.
 */
function applyMechanicBonusesToDots() {
    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    // Todo dotKey com bônus ou limite, MAIS todos os que estão na tela — estes
    // últimos para apagar pintura velha de quem perdeu o efeito.
    const allKeys = new Set([...Object.keys(bonuses), ...Object.keys(limits)]
        .filter(k => k.startsWith('sk_') || k.startsWith('attr_')));
    document.querySelectorAll('.dots5[data-attr]').forEach(c => allKeys.add(c.dataset.attr));

    for (const key of allKeys) {
        const container = document.querySelector(`.dots5[data-attr="${key}"]`);
        if (!container) continue;

        const baseVal = state.dots[key] || 0;
        const bonus = bonuses[key] || 0;
        const { piso, teto } = _dvPisoETeto(limits[key]);

        const auraInfo = typeof getAuraInfoForDot === 'function' ? getAuraInfoForDot(key) : null;
        const baseDots = typeof getPropertyBaseDots === 'function' ? getPropertyBaseDots(key) : teto;

        if (auraInfo && auraInfo.grauDesbloqueado > 0) {
            _dvPintarDotsComAura(container, key, auraInfo, { piso, baseVal, bonus, baseDots });
        } else {
            _dvPintarDots(container, { piso, teto, baseVal, bonus });
        }
    }
}

/* ===== VALOR DE MESA =====
 * Alguns Valores Derivados são guardados fracionados mas usados inteiros na
 * mesa — a Blindagem é o caso: soma-se tudo que está vestido, arredonda para
 * baixo, e o total vale no mínimo 1 se for maior que zero (Livro, 5.4).
 * O VD marcado com `arredondaMesa` exibe o número de mesa; a fração exata
 * aparece no tooltip do nome. */
function dvValorDeMesa(v) {
    if (!(v > 0)) return Math.floor(v) || 0;
    return Math.max(1, Math.floor(v));
}

/** Número que vai para o campo: de mesa se o VD pedir, senão até 2 casas. */
function dvFormatarExibicao(value, dvDef) {
    if (dvDef && dvDef.arredondaMesa) return dvValorDeMesa(value);
    return Number.isInteger(value) ? value : parseFloat(value.toFixed(2));
}

/* ===== VD ESPELHO =====
 * Um VD com `espelhaVD` herda o valor de outro (Blindagem Cortante lê Blindagem)
 * e só existe para o caso em que uma peça vestida cede ou resiste àquele tipo.
 * Enquanto for igual ao espelhado não tem o que dizer, então sai da grid.
 * Quando diverge, mostra de que lado: menor é fraqueza, maior é resistência.
 */
function _dvAplicarEspelho(dvDef, dvKey, value) {
    if (!dvDef || !dvDef.espelhaVD) return;
    const campo = document.querySelector(`.mini-field[data-dv-key="${dvKey}"]`);
    if (!campo) return;

    const espelhado = (window.DERIVED_VALUES || []).find(d => d.nome === dvDef.espelhaVD);
    // Sem o espelhado carregado não dá para comparar — melhor mostrar do que sumir.
    if (!espelhado) { campo.classList.remove('dv-espelho-igual'); return; }

    const base = Number(state.derived?.[espelhado.key] ?? 0);
    const mostrado = dvFormatarExibicao(value, dvDef);
    const baseMostrada = dvFormatarExibicao(base, espelhado);

    campo.classList.toggle('dv-espelho-igual', mostrado === baseMostrada);
    campo.classList.toggle('dv-fraqueza', mostrado < baseMostrada);
    campo.classList.toggle('dv-resistencia', mostrado > baseMostrada);

    // O ::after do CSS lê o atributo do PRÓPRIO elemento — tem que ir no label.
    const label = campo.querySelector('.dv-label');
    if (label) {
        label.dataset.dvMarca = mostrado < baseMostrada ? '▼ fraco'
            : mostrado > baseMostrada ? '▲ resiste' : '';
    }
}

/* Um bloco só existe pelos campos que mostra. Se todos estão escondidos —
 * caso normal das Blindagens por Golpe e por Essência, que espelham o geral —
 * o título sozinho é ruído. Reavaliado a cada recálculo: equipou a peça que
 * cede a um tipo, o bloco volta com ela. */
function _dvOcultarBlocosVazios() {
    document.querySelectorAll('.dv-block-container').forEach(bloco => {
        const campos = bloco.querySelectorAll('.mini-field');
        if (!campos.length) return;
        const visiveis = [...campos].filter(c => !c.classList.contains('dv-espelho-igual'));
        bloco.classList.toggle('dv-bloco-vazio', !visiveis.length);
        // Com o bloco recolhido o número no resumo é a única pista do que tem
        // dentro — então conta o que aparece, não o que foi renderizado.
        const contador = bloco.querySelector(':scope > summary > .dv-block-n');
        if (contador) contador.textContent = visiveis.length;
    });
}

function updateDerivedField(key, value) {
    const mapping = DERIVED_FIELDS_MAP[key];
    if (!mapping) return;

    const displayEl = document.getElementById(mapping.display);
    if (displayEl) {
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.key === key);
        displayEl.value = dvFormatarExibicao(value, dvDef);
    }

    if (mapping.atual) {
        const atualEl = document.querySelector(`[data-key="${mapping.atual}"]`);
        if (atualEl) {
            atualEl.max = value;
            // Sem clamp automático: o valor digitado pelo jogador é preservado.
            // Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
        }
    }

    // Guardar em state.derived
    if (!state.derived) state.derived = {};
    state.derived[key] = value;
}

/* Status Vitais: personagem novo nasce com 100%.
 * Campo "Atual" vazio (o wizard não grava vit/san/ener_atual) recebe o Máximo.
 * Deve ser chamada UMA vez, no fim do carregamento da ficha — os máximos são
 * montados em etapas pelas mecânicas, e preencher no meio congelaria um valor
 * parcial (ex: 1/21).
 */
function fillVitalsToMax() {
    // Garantir máximos finais agora (não depender dos recalcs agendados por timer)
    if (typeof recalcAll === 'function') recalcAll();

    let filled = false;
    for (const mapping of Object.values(DERIVED_FIELDS_MAP)) {
        if (!mapping.atual) continue;
        const atualEl = document.querySelector(`[data-key="${mapping.atual}"]`);
        const maxVal = parseFloat(document.getElementById(mapping.display)?.value);
        if (!atualEl || atualEl.value !== '' || !(maxVal > 0)) continue;
        atualEl.value = maxVal;
        filled = true;
    }
    if (filled && typeof scheduleAutosave === 'function') scheduleAutosave();
    return filled;
}
window.fillVitalsToMax = fillVitalsToMax;

/* Validação: ATUAL — sem clamp automático.
 * O valor digitado pelo jogador é preservado como está.
 * Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
 */
function validateAtualField(atualKey, maxDisplayId) {
    // No-op: removido clamp hardcoded para permitir que o jogador
    // defina qualquer valor no campo atual.
}

/* Inicializar listeners e renderizar grid dinâmica */
function initDerivedListeners() {
    // Validação de campos ATUAL ≤ MAX (Status Vitais — mecânicas do Firebase)
    validateAtualField('vit_atual', 'vit_max_display');
    validateAtualField('ener_atual', 'ener_max_display');
    validateAtualField('san_atual', 'san_max_display');

    // Renderizar grid dinâmica de valores derivados
    renderDerivedValuesGrid();

    // Restaurar valores de state.dvAtual (campos "Atual" editáveis de DVs)
    _dvRestaurarAtuais();
}

/**
 * Sincroniza os componentes reativos dos módulos de classe que exibem Valores Derivados (VD).
 */
function syncModuleDerivedValuesUI() {
    if (typeof window.DERIVED_VALUES === 'undefined' || !state.derived) return;

    document.querySelectorAll('[data-dv-key-ref]').forEach(el => {
        const dvKey = el.dataset.dvKeyRef;
        const dvDef = window.DERIVED_VALUES.find(d => d.key === dvKey);
        if (!dvDef) return;

        const rawVal = state.derived[dvKey];
        const valor = rawVal !== undefined ? dvFormatarExibicao(Number(rawVal), dvDef) : '—';
        const displayStr = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;

        const valSpan = el.querySelector('.cm-dv-value');
        if (valSpan && valSpan.textContent !== displayStr) {
            valSpan.textContent = displayStr;
        }
    });
}
window.syncModuleDerivedValuesUI = syncModuleDerivedValuesUI;

/* combat-panel.js e race-peculiarities.js ligam o clique deles nesta mesma
   funcao: sao arquivos separados, entao ela precisa estar no window. */
window.abrirDetalheDoRotulo = abrirDetalheDoRotulo;
