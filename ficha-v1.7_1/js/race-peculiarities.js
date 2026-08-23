/* ===== LÓGICA DE PECULIARIDADES RACIAIS ===== */

/* Guarda a raça anterior para poder reverter bônus corretamente */
let _previousRace = '';
let _previousRaceData = null;

// Default fallback to prevent crash if not initialized elsewhere
window._raceBonuses = window._raceBonuses || {
    ener_max: 0,
    vit_max: 0,
    perc: 0,
    is_yotun: false,
    carga_mult: 1,
    desloc_ar_override: false
};

/* ===== FONTE LABELS e ÍCONES ===== */
const PEC_FONTE_CONFIG = {
    raca:       { label: '🧬 Peculiaridades Raciais',     icon: '🧬', order: 1 },
    individual: { label: '👤 Peculiaridades Individuais',  icon: '👤', order: 2 },
    classe:     { label: '⚔️ Peculiaridades de Classe',    icon: '⚔️', order: 3 },
    tribo:      { label: '🏕️ Peculiaridades de Tribo',     icon: '🏕️', order: 4 },
    // Fallback para fontes desconhecidas
    _default:   { label: '📋 Outras Peculiaridades',       icon: '📋', order: 99 }
};

/**
 * Define os valores iniciais dos Valores Derivados vinculados à raça.
 * Itera derivedValueIds da raça e aplica valorInicial no state.derived + display.
 */
function _setDerivedInitialValues(raceData) {
    if (!state.derived) state.derived = {};
    const dvIds = raceData?.derivedValueIds || [];
    for (const dvEntry of dvIds) {
        const isObj = typeof dvEntry === 'object' && dvEntry !== null;
        const dvId = isObj ? dvEntry.id : dvEntry;
        const valorInicial = isObj ? (parseFloat(dvEntry.valorInicial) || 0) : 0;

        // Encontrar a key dinâmica do Valor Derivado
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (dvDef) {
            state.derived[dvDef.key] = valorInicial;
            // Atualizar display na grid
            const displayEl = document.getElementById(`dv_${dvDef.key}_display`);
            if (displayEl) {
                displayEl.value = Number.isInteger(valorInicial) ? valorInicial : parseFloat(valorInicial.toFixed(2));
            }
        }
    }
}

/**
 * Limpa os valores iniciais dos DVs de uma raça anterior.
 */
function _clearDerivedInitialValues(raceData) {
    if (!state.derived) return;
    const dvIds = raceData?.derivedValueIds || [];
    for (const dvEntry of dvIds) {
        const isObj = typeof dvEntry === 'object' && dvEntry !== null;
        const dvId = isObj ? dvEntry.id : dvEntry;
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (dvDef) {
            state.derived[dvDef.key] = 0;
            const displayEl = document.getElementById(`dv_${dvDef.key}_display`);
            if (displayEl) displayEl.value = '0';
        }
    }
}

function onRaceChange() {
    const selRaca = document.getElementById('selRaca');
    if (!selRaca) return;
    const racaNome = selRaca.value;

    // --- Limpar bônus da raça anterior ANTES de tudo ---
    clearRaceBonuses(_previousRace);
    // Limpar valores iniciais de DVs da raça anterior
    if (_previousRaceData) _clearDerivedInitialValues(_previousRaceData);

    // Atualizar subtitulo da raça
    const subtitleEl = document.getElementById('raceSubtitle');
    const grid = document.getElementById('peculiaridadesGrid');
    const hintEl = document.getElementById('raceHint');

    if (!grid) return;

    // Limpar apenas blocos raciais (preservar blocos de classe/tribo)
    _clearPeculiaridadeBlocksByFonte(grid, 'raca');

    if (!racaNome || racaNome === '') {
        if (subtitleEl) subtitleEl.textContent = '';
        // Limpar valores iniciais dos DVs da raça anterior
        if (_previousRaceData) _clearDerivedInitialValues(_previousRaceData);
        // Mostrar hint apenas se não houver nenhum bloco (nem classe nem tribo)
        if (hintEl) hintEl.style.display = grid.children.length === 0 ? '' : 'none';
        updateYotunForcaUI('');
        updateDaereoVisibility('');
        _previousRace = '';
        _previousRaceData = null;
        window._dvInitialValues = {};
        if (typeof recalcAll === 'function') recalcAll();
        scheduleAutosave();
        return;
    }

    const raca = RACES[racaNome];
    if (!raca) return;

    // Esconder hint
    if (hintEl) hintEl.style.display = 'none';

    // Preencher subtítulo e valores iniciais dos DVs vinculados
    if (subtitleEl) subtitleEl.textContent = raca.subtitulo || '';

    // Renderizar peculiaridades raciais como blocos dentro do grid (inserir no início)
    _renderSourceBlock(raca.peculiaridades, racaNome, grid, 'raca');

    updateYotunForcaUI(racaNome);
    updateDaereoVisibility(racaNome);

    // --- Aplicar bônus da nova raça ---
    applyRaceBonuses(racaNome);
    // Aplicar mecânicas dinâmicas do Firebase (painel criador)
    if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(racaNome);
    _previousRace = racaNome;
    _previousRaceData = raca;

    // Atualizar grid de Valores Derivados (raça pode adicionar novos valores)
    if (typeof renderDerivedValuesGrid === 'function') renderDerivedValuesGrid();
    // Aplicar valores iniciais dos DVs vinculados à raça
    _setDerivedInitialValues(raca);
    if (typeof recalcAll === 'function') recalcAll();

    // Re-inicializar tooltips (raça pode adicionar mecânicas que afetam perícias/vitais)
    if (typeof initVitalStatsTooltips === 'function') initVitalStatsTooltips();
    if (typeof initSkillTooltips === 'function') initSkillTooltips();
    if (typeof initAttributeTooltips === 'function') initAttributeTooltips();

    scheduleAutosave();

    /* Bloquear selects se necessário */
    if (typeof lockSelectsIfNeeded === 'function') lockSelectsIfNeeded();
}

function updateDaereoVisibility(racaNome) {
    // No-op: Valores Derivados agora são renderizados dinamicamente pelo Firebase.
    // D.AÉREO será exibido apenas se vinculado à raça/classe via Painel de Criador.
}

function updateYotunForcaUI(racaNome) {
    const forcaDotsContainer = document.querySelector('.dots5[data-attr="attr_for"]');
    if (!forcaDotsContainer) return;

    let dot6 = forcaDotsContainer.querySelector('.dot[data-val="6"]');

    if (racaNome === 'Yotun') {
        if (!dot6) {
            dot6 = document.createElement('button');
            dot6.className = 'dot';
            dot6.dataset.val = '6';
            dot6.title = 'Nível 6';
            dot6.addEventListener('click', () => {
                if (typeof handleDotUpgrade === 'function') {
                    handleDotUpgrade(forcaDotsContainer, 'attr_for', 6);
                }
            });
            forcaDotsContainer.appendChild(dot6);
        }
    } else {
        if (dot6) {
            dot6.remove();
            if (state.dots['attr_for'] === 6) {
                state.dots['attr_for'] = 5;
                if (typeof recalcAll === 'function') recalcAll();
                if (typeof recalcMainTests === 'function') recalcMainTests();
            }
        }
    }

    if (typeof refreshDots === 'function') {
        refreshDots(forcaDotsContainer, 'attr_for');
    }
}

/* ===== BÔNUS RACIAIS — CLEAR / APPLY ===== */

/**
 * Reseta TODOS os bônus raciais para valores neutros e reverte dots alterados.
 */
function clearRaceBonuses(oldRace) {
    // Limpar bônus dinâmicos das mecânicas do Firebase
    if (typeof clearMechanicBonuses === 'function') clearMechanicBonuses();
    const rb = window._raceBonuses;
    rb.ener_max = 0;
    rb.vit_max = 0;
    rb.perc = 0;
    rb.is_yotun = false;
    rb.carga_mult = 1;
    rb.desloc_ar_override = false;

    // Karu-Selvagem: reverter +1 em Briga e Esquiva
    if (oldRace === 'Karu-Selvagem') {
        if (state.dots['sk_fisico_briga'] && state.dots['sk_fisico_briga'] > 0)
            state.dots['sk_fisico_briga'] = Math.max(0, (state.dots['sk_fisico_briga'] || 0) - 1);
        if (state.dots['sk_combate_esquiva'] && state.dots['sk_combate_esquiva'] > 0)
            state.dots['sk_combate_esquiva'] = Math.max(0, (state.dots['sk_combate_esquiva'] || 0) - 1);
        // Refresh visual dos dots
        const brigaCont = document.querySelector('.dots5[data-attr="sk_fisico_briga"]');
        const esquivaCont = document.querySelector('.dots5[data-attr="sk_combate_esquiva"]');
        if (brigaCont && typeof refreshDots === 'function') refreshDots(brigaCont, 'sk_fisico_briga');
        if (esquivaCont && typeof refreshDots === 'function') refreshDots(esquivaCont, 'sk_combate_esquiva');
    }

    // Pogo: restaurar dots 4 e 5 de FOR
    if (oldRace === 'Pogo') {
        updatePogoForUI(false);
    }
}

/**
 * Aplica os bônus da raça selecionada.
 */
function applyRaceBonuses(racaNome) {
    const rb = window._raceBonuses;

    switch (racaNome) {
        case 'Humano':
            // Força de Vontade Natural: +1 ENER Máxima
            rb.ener_max = 1;
            break;

        case 'Karu-Selvagem':
            // Pés Invertidos: +1 Briga, +1 Esquiva
            state.dots['sk_fisico_briga'] = (state.dots['sk_fisico_briga'] || 0) + 1;
            state.dots['sk_combate_esquiva'] = (state.dots['sk_combate_esquiva'] || 0) + 1;
            const brigaCont = document.querySelector('.dots5[data-attr="sk_fisico_briga"]');
            const esquivaCont = document.querySelector('.dots5[data-attr="sk_combate_esquiva"]');
            if (brigaCont && typeof refreshDots === 'function') refreshDots(brigaCont, 'sk_fisico_briga');
            if (esquivaCont && typeof refreshDots === 'function') refreshDots(esquivaCont, 'sk_combate_esquiva');
            break;

        case 'Picxi':
            // Descendência Luxiana: D.Aéreo = (FOR+DES+Tam+Atletismo)*3
            rb.desloc_ar_override = true;
            // Fragilidade Física: −1 VIT Máxima
            rb.vit_max = -1;
            break;

        case 'Pogo':
            // Corpo Frágil: limita FOR a no máximo 3
            updatePogoForUI(true);
            break;

        case 'Tamano': {
            // Olfato Excepcional: somar nível+1 à Percepção
            const olfatoLevel = state.dots['pec_olfato_excepcional'] || 1;
            rb.perc = olfatoLevel + 1; // nv1→+2, nv2→+3, nv3→+4
            break;
        }

        case 'Yotun': {
            // Passos de Gigante: dobrar desloc terrestre se tamanho >= 10 (verificado dinamicamente no recalcAll)
            rb.is_yotun = true;
            // Alta Carga: dobrar carga
            rb.carga_mult = 2;
            break;
        }
    }
}

/**
 * Pogo: esconde/mostra dots 4 e 5 de FOR e capeia o valor em 3.
 */
function updatePogoForUI(isPogo) {
    const forcaDotsContainer = document.querySelector('.dots5[data-attr="attr_for"]');
    if (!forcaDotsContainer) return;

    const dot4 = forcaDotsContainer.querySelector('.dot[data-val="4"]');
    const dot5 = forcaDotsContainer.querySelector('.dot[data-val="5"]');

    if (isPogo) {
        if (dot4) dot4.style.display = 'none';
        if (dot5) dot5.style.display = 'none';
        // Capear valor atual de FOR em 3
        if ((state.dots['attr_for'] || 0) > 3) {
            state.dots['attr_for'] = 3;
        }
    } else {
        if (dot4) dot4.style.display = '';
        if (dot5) dot5.style.display = '';
    }

    if (typeof refreshDots === 'function') refreshDots(forcaDotsContainer, 'attr_for');
}

/* ===== RENDERIZAÇÃO AGRUPADA (BLOCOS RETRÁTEIS POR FONTE) ===== */

/**
 * Renderiza todas as peculiaridades em blocos retráteis agrupados por fonte.
 * Usado internamente e por renderização legacy.
 */
function renderPeculiaridadesGrouped(peculiaridades, sourceKey, container) {
    container.innerHTML = '';

    // Agrupar por fonte
    const groups = {};
    for (const pec of peculiaridades) {
        const fonte = pec.fonte || 'raca'; // default: racial
        if (!groups[fonte]) groups[fonte] = [];
        groups[fonte].push(pec);
    }

    // Ordenar fontes
    const sortedFontes = Object.keys(groups).sort((a, b) => {
        const oa = (PEC_FONTE_CONFIG[a] || PEC_FONTE_CONFIG._default).order;
        const ob = (PEC_FONTE_CONFIG[b] || PEC_FONTE_CONFIG._default).order;
        return oa - ob;
    });

    for (const fonte of sortedFontes) {
        _renderSingleSourceBlock(groups[fonte], sourceKey, container, fonte);
    }

    // Inicializar tooltips para as pills
    initPeculiarityTooltips();
}

/**
 * Limpa blocos de peculiaridades de uma fonte específica dentro do container.
 */
function _clearPeculiaridadeBlocksByFonte(container, fonte) {
    container.querySelectorAll(`.pec-source-block[data-fonte="${fonte}"]`).forEach(b => b.remove());
    // Também remover wrappers de distribuir vinculados à fonte
    container.querySelectorAll(`.pec-dist-wrapper[data-fonte="${fonte}"]`).forEach(b => b.remove());
}

/**
 * Renderiza um bloco retrátil de uma única fonte e insere no container
 * na posição correta (ordenado por PEC_FONTE_CONFIG.order).
 */
function _renderSourceBlock(peculiaridades, sourceKey, container, fonteOverride) {
    if (!peculiaridades || peculiaridades.length === 0) return;

    // Agrupar por fonte (dentro das peculiaridades passadas)
    const groups = {};
    for (const pec of peculiaridades) {
        const fonte = fonteOverride || pec.fonte || 'raca';
        if (!groups[fonte]) groups[fonte] = [];
        groups[fonte].push(pec);
    }

    for (const fonte of Object.keys(groups)) {
        _renderSingleSourceBlock(groups[fonte], sourceKey, container, fonte);
    }

    initPeculiarityTooltips();
}

/**
 * Renderiza um único bloco retrátil para uma fonte e insere na posição correta.
 */
function _renderSingleSourceBlock(pecList, sourceKey, container, fonte) {
    const config = PEC_FONTE_CONFIG[fonte] || PEC_FONTE_CONFIG._default;

    // Bloco retrátil
    const block = document.createElement('div');
    block.className = 'pec-source-block';
    block.dataset.fonte = fonte;

    // Header
    const header = document.createElement('div');
    header.className = 'pec-source-header';
    header.innerHTML = `
        <span class="pec-source-chevron">▼</span>
        <span class="pec-source-title">${config.label}</span>
        <span class="pec-source-count">${pecList.length}</span>
    `;
    header.addEventListener('click', () => {
        block.classList.toggle('collapsed');
    });
    block.appendChild(header);

    // Content (flex-wrap de pills)
    const content = document.createElement('div');
    content.className = 'pec-source-content';

    for (const pec of pecList) {
        renderPeculiaridadeCompact(pec, sourceKey, content);
    }

    block.appendChild(content);

    // Inserir na posição correta (ordenado por order da fonte)
    const targetOrder = config.order;
    let inserted = false;
    for (const existing of container.querySelectorAll('.pec-source-block')) {
        const existingFonte = existing.dataset.fonte || '';
        const existingOrder = (PEC_FONTE_CONFIG[existingFonte] || PEC_FONTE_CONFIG._default).order;
        if (existingOrder > targetOrder) {
            container.insertBefore(block, existing);
            inserted = true;
            break;
        }
    }
    if (!inserted) container.appendChild(block);
}

/* ===== RENDERIZAÇÃO DE PECULIARIDADES POR FONTE (CLASSE / TRIBO / INDIVIDUAL) ===== */

/**
 * Renderiza peculiaridades de classe no grid de peculiaridades.
 * Chamada por onClassChange() em core.js.
 */
function renderClassPeculiaridades(classeNome) {
    const grid = document.getElementById('peculiaridadesGrid');
    if (!grid) return;

    _clearPeculiaridadeBlocksByFonte(grid, 'classe');

    const hintEl = document.getElementById('raceHint');
    if (hintEl) hintEl.style.display = 'none';

    let pecList = [];
    if (classeNome && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[classeNome]) {
        pecList = window.CLASS_PECULIARITIES[classeNome];
    }
    
    // Sempre renderiza o bloco, mesmo que vazio
    _renderSingleSourceBlock(pecList, classeNome || 'Nenhuma', grid, 'classe');
}

/**
 * Renderiza peculiaridades de tribo no grid de peculiaridades.
 * Chamada por onTriboChange() em core.js.
 */
function renderTriboPeculiaridades(triboNome) {
    const grid = document.getElementById('peculiaridadesGrid');
    if (!grid) return;

    _clearPeculiaridadeBlocksByFonte(grid, 'tribo');

    if (!triboNome || !window.TRIBES || !window.TRIBES[triboNome]) {
        return;
    }
    const pecList = window.TRIBES[triboNome].peculiaridades;
    if (!pecList || pecList.length === 0) return;

    _renderSourceBlock(pecList, triboNome, grid, 'tribo');
}

/**
 * Renderiza peculiaridades individuais no grid de peculiaridades.
 */
function renderIndividualPeculiaridades() {
    const grid = document.getElementById('peculiaridadesGrid');
    if (!grid) return;

    _clearPeculiaridadeBlocksByFonte(grid, 'individual');

    if (!state.peculiaridadesIndividuais) {
        state.peculiaridadesIndividuais = [];
    }

    /* NÃO reconstruir a lista a partir de state.dots['pec_*']. O dot é escrito
       por QUALQUER fonte que renderize a pec (a de classe inclusive), e quase
       toda pec de raça/classe tem fonte 'individual' no catálogo — então a
       reconstrução inventava uma cópia avulsa da pec herdada, e ressuscitava o
       que o Mestre apagava pelo painel. Auditoria em 11/08/2026: os 4 únicos
       personagens com dot fora da lista eram todos esse falso positivo, nenhum
       dependia da reconstrução (functions/audit-pec-dots-orfaos.mjs). */
    const indPecs = state.peculiaridadesIndividuais.map(p => {
        if (typeof _resolvePeculiaridade === 'function') {
            return _resolvePeculiaridade(p, 'Individual');
        }
        return null;
    }).filter(Boolean);

    _renderSingleSourceBlock(indPecs, 'Individual', grid, 'individual');
}

/* ===== RENDERIZAÇÃO COMPACTA (PILL/CHIP) ===== */

/**
 * Renderiza uma peculiaridade como pill/chip compacta.
 */
function renderPeculiaridadeCompact(pec, raceKey, container) {
    const pill = document.createElement('div');
    pill.className = 'pec-compact';
    pill.dataset.pecKey = pec.key;
    if (pec.negativo) pill.classList.add('negativo');
    else pill.classList.add('positivo');

    // Ícone
    const iconEl = document.createElement('span');
    iconEl.className = 'pec-compact-icon';
    iconEl.textContent = pec.icone || '📋';
    pill.appendChild(iconEl);

    // Nome (com tooltip)
    const nameEl = document.createElement('span');
    nameEl.className = 'pec-compact-name has-tooltip';
    nameEl.textContent = pec.nome;
    nameEl.dataset.tooltipType = 'peculiaridade';
    nameEl.dataset.pecKey = pec.key;
    nameEl.dataset.raceKey = raceKey;
    pill.appendChild(nameEl);

    // Badge de nível
    const nivelDisplay = pec.tipo === 'evolutivo'
        ? (state.dots['pec_' + pec.key] || pec.nivelAtual || 1)
        : pec.nivel;

    if (nivelDisplay !== null && nivelDisplay !== undefined) {
        const badge = document.createElement('span');
        badge.className = 'pec-compact-badge';
        badge.id = `pec_badge_${pec.key}`;
        badge.textContent = `Nv ${nivelDisplay}`;
        pill.appendChild(badge);
    }

    // Se evolutivo: dots inline
    if (pec.tipo === 'evolutivo') {
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'pec-dots-inline';
        dotsDiv.dataset.attr = 'pec_' + pec.key;
        renderEvolutableDotsInline(dotsDiv, raceKey, pec, pec.nivelAtual, pec.nivelMax);
        pill.appendChild(dotsDiv);

        // Garantir que o valor inicial esteja no state
        const dotKey = 'pec_' + pec.key;
        if (typeof state.dots[dotKey] === 'undefined' || state.dots[dotKey] < pec.nivelAtual) {
            state.dots[dotKey] = pec.nivelAtual;
        }
        refreshPecDots(dotsDiv, dotKey, pec.nivelAtual);
    }

    // Click na pill abre modal de detalhes (exceto se clicar em dots de evolução)
    pill.addEventListener('click', (e) => {
        if (e.target.closest('.pec-dots-inline')) return;
        if (e.target.closest('.distribuir-ui')) return;
        if (typeof openDetailModal === 'function') {
            openDetailModal('peculiaridade', pec.key, raceKey);
        }
    });
    pill.style.cursor = 'pointer';

    container.appendChild(pill);

    // Chamar DEPOIS do appendChild para que document.getElementById funcione
    if (pec.tipo === 'evolutivo') {
        const dotKey = 'pec_' + pec.key;
        updatePeculiaridadeLevel(raceKey, pec.key, state.dots[dotKey] || pec.nivelAtual || 1, pec);
    }

    // Renderizar UI de distribuição (fora da pill, direto no container)
    if (pec.mecanicas && typeof renderDistribuirUI === 'function') {
        for (const mech of pec.mecanicas) {
            if (mech.tipo !== 'distribuir') continue;
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            const isCreation = mech.duracao === 'criacao';
            if (!isPermanent && !isCreation) continue;

            // Criar wrapper para a UI de distribuição no nível do content
            const distWrapper = document.createElement('div');
            distWrapper.style.width = '100%';
            distWrapper.style.flexBasis = '100%';
            renderDistribuirUI(distWrapper, mech, pec);
            container.appendChild(distWrapper);
        }
    }
}

/* ===== DOTS INLINE PARA EVOLUTIVAS ===== */

/**
 * Custo líquido em EXP de ir do nível `de` até o nível `ate` de uma
 * peculiaridade — a soma degrau a degrau, porque cada nível tem preço próprio
 * no cadastro. Nível com `tipoExp: 'ganho'` entra NEGATIVO (o personagem
 * recebe EXP por uma desvantagem). Serve para cobrar e para devolver.
 */
function _pecCustoLiquido(pec, de, ate) {
    let total = 0;
    for (let n = de + 1; n <= ate; n++) {
        const nivel = pec.niveis?.[n];
        if (!nivel) continue;
        const m = String(nivel.custo || '').match(/(\d+)/);
        const c = m ? parseInt(m[1], 10) : 0;
        total += nivel.tipoExp === 'ganho' ? -c : c;
    }
    return total;
}

function renderEvolutableDotsInline(dotsDiv, raceKey, pec, minLevel, maxLevel) {
    const dotKey = 'pec_' + pec.key;

    // Verificar se alguma mecânica é "Apenas na Criação"
    const isCreationOnly = pec.mecanicas &&
        pec.mecanicas.some(m => m.progressaoApenasCriacao === true);

    for (let i = 1; i <= maxLevel; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.dataset.val = i;
        dot.title = 'Nível ' + i;

        // Desabilitar dots abaixo do mínimo
        if (i < minLevel) {
            dot.disabled = true;
        }

        // Se é "Apenas na Criação": trava com aviso ao clicar (não usa disabled,
        // que engole o click e deixa o jogador sem explicação)
        if (isCreationOnly && i > minLevel) {
            dot.dataset.locked = 'criacao';
            dot.title = '🏗️ Apenas na Criação (não pode upar depois)';
        }

        // Verificar se o nível existe nos dados
        if (!pec.niveis[i]) {
            dot.disabled = true;
        }

        dot.addEventListener('click', () => {
            if (dot.disabled) return;
            // A trava é de EVOLUÇÃO; retroceder um nível já pago continua
            // valendo para o mestre (é conserto, não progressão).
            if (dot.dataset.locked === 'criacao' && i > (state.dots[dotKey] || minLevel)) {
                if (typeof showUpgradeBlocked === 'function')
                    showUpgradeBlocked(`🏗️ "${pec.nome}" só pode ser evoluída na criação de personagem.`);
                return;
            }
            const current = state.dots[dotKey] || minLevel;

            const aplicar = (novoNivel) => {
                state.dots[dotKey] = novoNivel;
                refreshPecDots(dotsDiv, dotKey, minLevel);
                updatePeculiaridadeLevel(raceKey, pec.key, novoNivel, pec);
                if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(raceKey);
                if (typeof recalcAll === 'function') recalcAll();
                if (typeof recalcMainTests === 'function') recalcMainTests();
                if (typeof checkDistribuirOnLevelUp === 'function') checkDistribuirOnLevelUp(pec);
                scheduleAutosave();
            };

            // Clique em nível já pago: só mestre/criador retrocede, devolvendo
            // o EXP dos níveis desfeitos em "Restante" (Total não muda).
            if (i <= current) {
                if (typeof podeRetroceder !== 'function' || !podeRetroceder()) return;
                const alvo = i >= current ? i - 1 : i;
                if (alvo < minLevel) {
                    if (typeof showUpgradeBlocked === 'function')
                        showUpgradeBlocked(`"${pec.nome}" não desce abaixo do nível inicial (${minLevel}).`);
                    return;
                }
                const devolve = _pecCustoLiquido(pec, alvo, current);
                showDowngradeConfirm(pec.nome, alvo, devolve, () => {
                    if (devolve > 0) refundExp(devolve);
                    else if (devolve < 0) spendExp(-devolve); // desfaz EXP ganho por nível prejudicial
                    aplicar(alvo);
                    showDowngradeSuccess(pec.nome, alvo, devolve);
                });
                return;
            }

            // Subir vários de uma vez: todo degrau até o clicado precisa existir
            for (let n = current + 1; n <= i; n++) {
                if (!pec.niveis[n]) return;
            }

            // Custo líquido: níveis "ganho" devolvem EXP, os demais cobram
            const custo = _pecCustoLiquido(pec, current, i);

            if (custo === 0) { aplicar(i); return; }

            if (typeof showUpgradeConfirm !== 'function') return;

            if (custo < 0) {
                // Mecânica prejudicial: GANHA EXP ao subir de nível
                const ganho = -custo;
                showUpgradeConfirm(`${pec.nome} (🎁 +${ganho} EXP)`, i, ganho, (comExp) => {
                    if (comExp) spendExp(custo); // negativo = adiciona EXP
                    else concederSemGastar(custo); // custo negativo aqui: não soma nada
                    aplicar(i);
                    const efeito = comExp ? `+${ganho} EXP` : '🛡️ sem mexer no EXP';
                    showExpToast(`✅ ${pec.nome} subiu para nível ${i}! (${efeito})`, 'success');
                    setTimeout(dismissExpToast, 2000);
                });
                return;
            }

            // Mestre/Criador não é barrado por falta de EXP: para ele o custo é
            // opcional, e o confirm só deixa de oferecer o botão de pagar.
            const currentExp = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
            const semExp = custo > currentExp;
            if (semExp && !(typeof podeGastarDeGraca === 'function' && podeGastarDeGraca())) {
                if (typeof showUpgradeBlocked === 'function')
                    showUpgradeBlocked(`EXP insuficiente! Precisa de ${custo} EXP, mas só tem ${currentExp}.`);
                return;
            }

            showUpgradeConfirm(pec.nome, i, custo, (comExp) => {
                if (comExp) spendExp(custo); else concederSemGastar(custo);
                aplicar(i);
                if (typeof showUpgradeSuccess === 'function') showUpgradeSuccess(pec.nome, i, custo, comExp);
            }, { semExp });
        });

        dotsDiv.appendChild(dot);
    }
}

function refreshPecDots(container, dotKey, minLevel) {
    const v = state.dots[dotKey] || minLevel;
    container.querySelectorAll('.dot').forEach(d => {
        d.classList.toggle('filled', +d.dataset.val <= v);
    });
}

function updatePeculiaridadeLevel(raceKey, pecKey, newLevel, pecData) {
    // Atualizar badge de nível
    const badgeEl = document.getElementById(`pec_badge_${pecKey}`);
    if (badgeEl) {
        badgeEl.textContent = `Nv ${newLevel}`;
    }

    // Auto-update blindagem if "blindagem_natural" is upgraded
    if (pecKey === 'blindagem_natural') {
        // Atualizar o valor base no state — recalcAll() aplicará bônus por cima
        if (!state.fieldBaseValues) state.fieldBaseValues = {};
        state.fieldBaseValues['blindagem'] = newLevel;
        const bldField = document.querySelector('[data-key="blindagem"]');
        if (bldField) {
            bldField.value = newLevel;
        }
    }

    // Auto-update Percepção para Tamano: Olfato Excepcional
    if (pecKey === 'olfato_excepcional') {
        window._raceBonuses.perc = newLevel + 1; // nv1→+2, nv2→+3, nv3→+4
        if (typeof recalcAll === 'function') recalcAll();
    }
}

/* ===== TOOLTIP DE PECULIARIDADES ===== */

/**
 * Inicializa tooltips nos nomes das peculiaridades compactas.
 * Reutiliza o sistema de tooltip flutuante compartilhado (dv-tooltip).
 */
function initPeculiarityTooltips() {
    if (typeof _ensureTooltipEl === 'function') _ensureTooltipEl();

    document.querySelectorAll('.pec-compact-name.has-tooltip').forEach(nameEl => {
        if (nameEl.dataset.tooltipBound) return;
        nameEl.dataset.tooltipBound = '1';
        nameEl.addEventListener('mouseenter', showDvTooltip);
        nameEl.addEventListener('mouseleave', hideDvTooltip);
        nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
    });
}

/**
 * Gera o efeito texto de uma peculiaridade para o tooltip.
 * Equivalente à lógica que existia em updatePeculiaridadeLevel.
 */
function _generatePecEffectText(pec) {
    const dotKey = 'pec_' + pec.key;

    if (pec.tipo === 'evolutivo') {
        const currentLevel = state.dots[dotKey] || pec.nivelAtual || 1;

        if (pec.mecanicas && typeof generatePreviewText === 'function') {
            const efeitosNivel = [];
            for (const m of pec.mecanicas) {
                if (m.evoluivel === true && m.progressao) {
                    const prog = m.progressao[String(currentLevel)];
                    if (prog) {
                        const adjustedMech = JSON.parse(JSON.stringify(m));
                        delete adjustedMech.previewTexto;

                        if (m.tipo === 'modificar' || m.tipo === 'limitar') {
                            if (prog.termos && Array.isArray(adjustedMech.config?.calculos)) {
                                for (const calc of adjustedMech.config.calculos) {
                                    if (Array.isArray(calc.equacao)) {
                                        let fixoIdx = 0;
                                        for (const term of calc.equacao) {
                                            if (!term.tipo || term.tipo === 'fixo') {
                                                const overrideVal = prog.termos[String(fixoIdx)];
                                                if (overrideVal !== undefined && overrideVal !== '') {
                                                    term.valor = overrideVal;
                                                }
                                                fixoIdx++;
                                            }
                                        }
                                    }
                                }
                            } else if (m.tipo === 'modificar') {
                                if (prog.valor !== undefined) {
                                    adjustedMech.config = { ...adjustedMech.config, valor: prog.valor };
                                }
                            } else if (m.tipo === 'limitar') {
                                const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
                                if (limVal !== undefined) {
                                    if (!adjustedMech.config) adjustedMech.config = {};
                                    const tipoLim = adjustedMech.config.tipoLimite;
                                    if (tipoLim === 'maximo' || adjustedMech.config.valorMaximo !== undefined) {
                                        adjustedMech.config.valorMaximo = limVal;
                                    }
                                    if (tipoLim === 'minimo' || adjustedMech.config.valorMinimo !== undefined) {
                                        adjustedMech.config.valorMinimo = limVal;
                                    }
                                    if (adjustedMech.config.valorMaximo === undefined && adjustedMech.config.valorMinimo === undefined) {
                                        adjustedMech.config.valorMaximo = limVal;
                                    }
                                }
                            }
                        } else if (m.tipo === 'distribuir') {
                            if (prog.valorPorAlvo !== undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valorPorAlvo };
                            if (prog.quantidadeAlvos !== undefined) adjustedMech.config = { ...adjustedMech.config, quantidadeAlvos: prog.quantidadeAlvos };
                            if (prog.valor !== undefined && prog.valorPorAlvo === undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valor };
                        } else if (m.tipo === 'narrativo') {
                            if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                            if (prog.textoEfeito) adjustedMech.config = { ...adjustedMech.config, textoEfeito: prog.textoEfeito };
                        } else if (m.tipo === 'conceder') {
                            if (prog.descricaoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, descricaoConcessao: prog.descricaoConcessao };
                            if (prog.tipoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, tipoConcessao: prog.tipoConcessao };
                            if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                        } else if (m.tipo === 'condicional') {
                            if (prog.gatilho !== undefined) adjustedMech.config = { ...adjustedMech.config, gatilho: prog.gatilho };
                            if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                        } else if (prog.descricao) {
                            efeitosNivel.push(prog.descricao); continue;
                        }
                        efeitosNivel.push(generatePreviewText(adjustedMech));
                    }
                } else {
                    efeitosNivel.push(generatePreviewText(m));
                }
            }
            if (efeitosNivel.length > 0) return efeitosNivel.join('; ');
        }

        // Fallback
        if (pec.niveis && pec.niveis[currentLevel]) {
            return pec.niveis[currentLevel].efeito;
        }
    }

    // Para fixas, usar efeito direto
    return pec.efeito || '';
}

/**
 * Gera HTML do tooltip para uma peculiaridade.
 * Chamada por showDvTooltip quando tooltipType === 'peculiaridade'.
 * Busca em RACES, CLASS_PECULIARITIES e TRIBES.
 */
function buildPeculiarityTooltipHTML(pecKey, sourceKey) {
    // Buscar peculiaridade em todas as fontes
    let pec = null;
    if (sourceKey && window.RACES && window.RACES[sourceKey]) {
        pec = window.RACES[sourceKey].peculiaridades.find(p => p.key === pecKey);
    }
    if (!pec && sourceKey && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[sourceKey]) {
        pec = window.CLASS_PECULIARITIES[sourceKey].find(p => p.key === pecKey);
    }
    if (!pec && sourceKey && window.TRIBES && window.TRIBES[sourceKey]) {
        pec = window.TRIBES[sourceKey].peculiaridades.find(p => p.key === pecKey);
    }
    // Fallback: buscar em todas as fontes independente da sourceKey
    if (!pec) {
        // Buscar em todas as raças
        if (window.RACES) {
            for (const rk of Object.keys(window.RACES)) {
                pec = window.RACES[rk].peculiaridades.find(p => p.key === pecKey);
                if (pec) break;
            }
        }
        // Buscar em todas as classes
        if (!pec && window.CLASS_PECULIARITIES) {
            for (const ck of Object.keys(window.CLASS_PECULIARITIES)) {
                pec = window.CLASS_PECULIARITIES[ck].find(p => p.key === pecKey);
                if (pec) break;
            }
        }
        // Buscar em todas as tribos
        if (!pec && window.TRIBES) {
            for (const tk of Object.keys(window.TRIBES)) {
                pec = window.TRIBES[tk].peculiaridades.find(p => p.key === pecKey);
                if (pec) break;
            }
        }
    }
    if (!pec) return '';

    let html = '';
    const esc = typeof _escHtml === 'function' ? _escHtml : (s => {
        const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
    });

    // Descrição
    if (pec.descricao) {
        html += `<div class="dv-tooltip-desc">${esc(pec.descricao)}</div>`;
    }

    // Efeito atual
    const efeito = _generatePecEffectText(pec);
    if (efeito) {
        html += `<div class="dv-tooltip-mechs">`;
        html += `<div class="dv-tooltip-mechs-title">⚡ Efeito:</div>`;
        html += `<div class="dv-tooltip-mech-item" style="white-space:pre-wrap">${esc(efeito)}</div>`;
        html += `</div>`;
    }

    // Custo (evolutivas)
    if (pec.tipo === 'evolutivo') {
        const dotKey = 'pec_' + pec.key;
        const currentLevel = state.dots[dotKey] || pec.nivelAtual || 1;
        if (pec.niveis && pec.niveis[currentLevel]) {
            const custoText = pec.niveis[currentLevel].custo || '';
            if (custoText) {
                html += `<div class="dv-tooltip-mech-item" style="font-style:italic;color:var(--muted)">💰 ${esc(custoText)}</div>`;
            }
        }
    }

    // Aura vinculada
    if (pec.auraVinculadaId && window.AURAS) {
        const auraDef = window.AURAS.find(a => a.id === pec.auraVinculadaId);
        if (auraDef) {
            html += `<div class="dv-tooltip-mech-item" style="color:#7c3aed">🌟 Concede: <strong>${esc(auraDef.nome)}</strong> (Grau ${pec.auraGrauConcedido || 1})</div>`;
        }
    }

    // Mecânicas vinculadas
    if (pec.mecanicas && pec.mecanicas.length > 0 && typeof generatePreviewText === 'function') {
        html += `<div class="dv-tooltip-mechs">`;
        html += `<div class="dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:</div>`;
        for (const m of pec.mecanicas) {
            const preview = generatePreviewText(m);
            if (preview) {
                html += `<div class="dv-tooltip-mech-item">• ${esc(preview)}</div>`;
            }
        }
        html += `</div>`;
    }

    return html;
}

// Legacy compatibility — old code may call renderPeculiaridadeCard
function renderPeculiaridadeCard(pec, raceKey, container) {
    renderPeculiaridadeCompact(pec, raceKey, container);
}

// Legacy compatibility — old code may call renderEvolutableDots
function renderEvolutableDots(dotsDiv, raceKey, pec, minLevel, maxLevel) {
    renderEvolutableDotsInline(dotsDiv, raceKey, pec, minLevel, maxLevel);
}
