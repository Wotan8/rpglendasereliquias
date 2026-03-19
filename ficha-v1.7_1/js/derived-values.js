/* ===== DERIVED VALUES — Cálculo Automático de Valores Derivados ===== */

/* ===== FÓRMULAS DE STATUS VITAIS (hardcoded — campos fixos no HTML) =====
 * Apenas VIT_MAX, ENER_MAX e SAN_MAX permanecem aqui pois possuem
 * campos atual/max fixos no HTML. Todos os outros valores derivados
 * são gerenciados exclusivamente pelo Firebase (Painel de Criador).
 */
const DERIVED_FORMULAS = {
    VIT_MAX: (a) => (a.VIG) * 3,
    ENER_MAX: (a) => a.PRS + a.AUT,
    SAN_MAX: (a) => (a.INT + a.AUT + a.PRS) * 2,
};

/* Mapa: campo derivado → { display, atual (se aplicável) }
 * Usado APENAS para os "Status Vitais" que ficam hardcoded no HTML
 * (VIT_MAX, ENER_MAX, SAN_MAX) — a seção dinâmica usa IDs gerados.
 */
const DERIVED_FIELDS_MAP = {
    VIT_MAX: { display: 'vit_max_display', atual: 'vit_atual' },
    ENER_MAX: { display: 'ener_max_display', atual: 'ener_atual' },
    SAN_MAX: { display: 'san_max_display', atual: 'san_atual' },
};

/* ===== KEYS de derivados que são renderizados dinamicamente na grid ===== */
let _dynamicDerivedKeys = new Set();

function getEffectiveDotValue(key) {
    return (state.dots[key] || 0) + (state.mechanicBonuses?.[key] || 0);
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

    // Determinar quais DVs são aplicáveis ao personagem
    const racaNome = document.getElementById('selRaca')?.value || '';
    const classeNome = document.getElementById('selClasse')?.value || '';

    // IDs de valores derivados vinculados à raça selecionada
    const raceDVIds = new Set();
    if (racaNome && window._systemData?.races) {
        const raceData = window._systemData.races.find(r => r.nome === racaNome);
        if (raceData?.derivedValueIds) {
            raceData.derivedValueIds.forEach(id => raceDVIds.add(id));
        }
    }

    // IDs de valores derivados vinculados à classe selecionada
    const classDVIds = new Set();
    if (classeNome && window._systemData?.classes) {
        const classData = window._systemData.classes.find(c => c.nome === classeNome);
        if (classData?.derivedValueIds) {
            classData.derivedValueIds.forEach(id => classDVIds.add(id));
        }
    }

    // Filtrar: universais OU vinculados à raça/classe
    const applicableDVs = allDVs.filter(dv =>
        dv.todoPersonagem || raceDVIds.has(dv.id) || classDVIds.has(dv.id)
    );

    // Ordenar por ordem
    applicableDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    // Rastrear keys dinâmicos
    _dynamicDerivedKeys = new Set(applicableDVs.map(dv => dv.key));

    // Renderizar grid
    grid.innerHTML = '';

    applicableDVs.forEach(dv => {
        const miniField = document.createElement('div');
        miniField.className = 'mini-field';
        miniField.dataset.dvId = dv.id;
        miniField.dataset.dvKey = dv.key;

        // Label com ícone + nome curto
        const label = document.createElement('label');
        label.className = 'dv-label';
        if (dv.descricao || (dv.mechPreviews && dv.mechPreviews.length)) {
            label.classList.add('has-tooltip');
        }
        label.textContent = `${dv.icone} ${dv.nome}`;
        label.dataset.dvId = dv.id;

        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `dv_${dv.key}_display`;
        input.className = 'derived-field';
        input.value = '0';

        if (!dv.campoEditavel) {
            if (window.isCreator) {
                // Criador pode editar qualquer campo — destaque visual
                input.style.border = '2px solid #f59e0b';
                input.title = '🛡️ Modo Criador: edição livre';
                // Salvar override quando Criador editar manualmente
                input.addEventListener('input', () => {
                    if (!state.derivedOverrides) state.derivedOverrides = {};
                    state.derivedOverrides[dv.key] = input.value;
                    if (typeof scheduleAutosave === 'function') scheduleAutosave();
                });
            } else {
                input.readOnly = true;
            }
        }

        miniField.appendChild(label);

        // Wrapper com prefixo + input + sufixo — tudo DENTRO do campo
        const hasPrefixOrSuffix = !!(dv.prefixo || dv.sufixo);
        if (hasPrefixOrSuffix) {
            const valueRow = document.createElement('div');
            valueRow.className = 'dv-value-row';

            // Copiar borda do Criador para o wrapper se necessário
            if (!dv.campoEditavel && window.isCreator) {
                valueRow.style.border = '2px solid #f59e0b';
                input.style.border = 'none';
            }

            // Remover borda/bg do input — o wrapper assume o visual
            input.classList.add('dv-input-inline');

            if (dv.prefixo) {
                const prefixSpan = document.createElement('span');
                prefixSpan.className = 'dv-affix';
                prefixSpan.textContent = dv.prefixo;
                valueRow.appendChild(prefixSpan);
            }

            valueRow.appendChild(input);

            if (dv.sufixo) {
                const suffixSpan = document.createElement('span');
                suffixSpan.className = 'dv-affix';
                suffixSpan.textContent = dv.sufixo;
                valueRow.appendChild(suffixSpan);
            }

            miniField.appendChild(valueRow);
        } else {
            miniField.appendChild(input);
        }

        grid.appendChild(miniField);
    });

    // Setup tooltips after rendering
    initDerivedTooltips();
}

/* ===== TOOLTIPS FLUTUANTES ===== */

let _dvTooltipEl = null;

function initDerivedTooltips() {
    // Criar tooltip global se não existir
    if (!_dvTooltipEl) {
        _dvTooltipEl = document.createElement('div');
        _dvTooltipEl.className = 'dv-tooltip';
        _dvTooltipEl.style.display = 'none';
        document.body.appendChild(_dvTooltipEl);
    }

    // Vincular eventos nos labels
    document.querySelectorAll('.dv-label.has-tooltip').forEach(label => {
        label.addEventListener('mouseenter', showDvTooltip);
        label.addEventListener('mouseleave', hideDvTooltip);
        label.addEventListener('touchstart', showDvTooltip, { passive: true });
    });
}

function showDvTooltip(e) {
    const label = e.currentTarget;
    const dvId = label.dataset.dvId;
    const dv = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
    if (!dv || !_dvTooltipEl) return;

    // Montar conteúdo do tooltip
    let html = '';
    if (dv.descricao) {
        html += `<div class="dv-tooltip-desc">${_escHtml(dv.descricao)}</div>`;
    }
    if (dv.mechPreviews && dv.mechPreviews.length) {
        html += '<div class="dv-tooltip-mechs">';
        html += '<div class="dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:</div>';
        dv.mechPreviews.forEach(preview => {
            html += `<div class="dv-tooltip-mech-item">• ${_escHtml(preview)}</div>`;
        });
        html += '</div>';
    }

    if (!html) return;

    _dvTooltipEl.innerHTML = html;
    _dvTooltipEl.style.display = 'block';

    // Posicionar
    const rect = label.getBoundingClientRect();
    _dvTooltipEl.style.left = rect.left + 'px';
    _dvTooltipEl.style.top = (rect.bottom + 6) + 'px';

    // Ajustar se sair da tela
    requestAnimationFrame(() => {
        const tipRect = _dvTooltipEl.getBoundingClientRect();
        if (tipRect.right > window.innerWidth - 10) {
            _dvTooltipEl.style.left = (window.innerWidth - tipRect.width - 10) + 'px';
        }
        if (tipRect.bottom > window.innerHeight - 10) {
            _dvTooltipEl.style.top = (rect.top - tipRect.height - 6) + 'px';
        }
    });
}

function hideDvTooltip() {
    if (_dvTooltipEl) _dvTooltipEl.style.display = 'none';
}

function _escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ===== RECALC ALL — Combina fórmulas hardcoded + dinâmicas ===== */

function recalcAll() {
    // Re-avaliar equações de mecânicas de valores derivados com valores atuais
    // Algumas mecânicas vinculadas a DVs usam equações com referências à ficha
    // (atributos, perícias) e precisam ser recalculadas a cada chamada de recalcAll
    if (typeof resolveDerivedValueMechanicsLive === 'function'
        && typeof _getDerivedMechKeys === 'function') {
        // Limpar apenas as chaves DERIVED: que são gerenciadas dinamicamente
        const keysToReset = _getDerivedMechKeys();
        const bonuses = state.mechanicBonuses || {};
        for (const key of keysToReset) {
            delete bonuses[key];
            delete bonuses['SET:' + key];
            delete bonuses['MULT:' + key];
            delete bonuses['DIV:' + key];
        }
        // Re-resolver equações dinâmicas com valores atuais de state.dots
        resolveDerivedValueMechanicsLive();
    }

    const attrs = gatherAttributes();
    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    // 1) Calcular derivados com fórmulas hardcoded (fallback para Status Vitais)
    for (const [key, formula] of Object.entries(DERIVED_FORMULAS)) {
        // Se este key está renderizado na grid dinâmica, pular o fallback
        // (será calculado apenas pelas mecânicas vinculadas)
        if (_dynamicDerivedKeys.has(key)) continue;

        // Só calcular se tem campo de display (Status Vitais)
        if (!DERIVED_FIELDS_MAP[key]) continue;

        let value = formula(attrs);
        value = _applyMechanicModifiers(key, value, bonuses, limits);
        updateDerivedField(key, value);
    }

    // 2) Calcular valores derivados dinâmicos (Firebase-driven)
    for (const dvKey of _dynamicDerivedKeys) {
        // Se Criador fez override manual, preservar o valor editado
        const overrideVal = state.derivedOverrides?.[dvKey];
        if (overrideVal !== undefined && overrideVal !== '') {
            const displayEl = document.getElementById(`dv_${dvKey}_display`);
            if (displayEl && displayEl.value !== String(overrideVal)) {
                displayEl.value = overrideVal;
            }
            if (!state.derived) state.derived = {};
            state.derived[dvKey] = parseFloat(String(overrideVal).replace(',', '.')) || 0;
            continue;
        }

        let value = 0;

        // Se existe fórmula hardcoded para este key, usar como base
        if (DERIVED_FORMULAS[dvKey]) {
            value = DERIVED_FORMULAS[dvKey](attrs, fields);
        }

        value = _applyMechanicModifiers(dvKey, value, bonuses, limits);

        // Atualizar campo na grid dinâmica
        const displayEl = document.getElementById(`dv_${dvKey}_display`);
        if (displayEl) {
            displayEl.value = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
        }

        // Atualizar também o campo hardcoded, se existir (ex: ENER_MAX)
        if (DERIVED_FIELDS_MAP[dvKey]) {
            updateDerivedField(dvKey, value);
        }

        // Guardar em state.derived para referências cruzadas
        if (!state.derived) state.derived = {};
        state.derived[dvKey] = value;
    }

    // 3) Aplicar limites em atributos (ex: Pogo FOR max 3)
    for (const [field, limit] of Object.entries(limits)) {
        if (field.startsWith('attr_')) {
            const currentVal = state.dots[field] || 0;
            if (limit.tipo === 'maximo' && limit.max != null && currentVal > limit.max) {
                state.dots[field] = limit.max;
                const dotsEl = document.querySelector(`.dots5[data-attr="${field}"]`);
                if (dotsEl && typeof refreshDots === 'function') refreshDots(dotsEl, field);
            }
        }
    }

    // 4) Aplicar bônus de mecânicas em campos DOM (field:xxx, ex: blindagem, tamanho)
    _applyFieldBonuses(bonuses);

    // 5) Aplicar bônus visuais nos dots
    applyMechanicBonusesToDots();
}

/**
 * Aplica modificadores de mecânicas (bônus, mult, div, set, limites) a um valor derivado.
 */
function _applyMechanicModifiers(key, value, bonuses, limits) {
    const bonusKey = `DERIVED:${key}`;

    // "Definir fixo" (=) — overrides the base formula entirely
    const setKey = `SET:${bonusKey}`;
    if (bonuses[setKey] !== undefined) {
        value = bonuses[setKey];
    }

    value += (bonuses[bonusKey] || 0);

    // Multiplicadores de mecânicas
    const multKey = `MULT:DERIVED:${key}`;
    if (bonuses[multKey]) {
        value = Math.floor(value * bonuses[multKey]);
    }

    // Divisores
    const divKey = `DIV:${bonusKey}`;
    if (bonuses[divKey] && bonuses[divKey] !== 0) {
        value = Math.floor(value / bonuses[divKey]);
    }

    // Limites
    const limit = limits[bonusKey];
    if (limit) {
        if (limit.tipo === 'bloqueio') value = 0;
        if (limit.tipo === 'maximo' && limit.max != null) value = Math.min(value, limit.max);
        if (limit.tipo === 'minimo' && limit.min != null) value = Math.max(value, limit.min);
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

/**
 * Aplica visualmente os bônus de mecânicas (sk_* e attr_*) nos dots.
 */
function applyMechanicBonusesToDots() {
    const bonuses = state.mechanicBonuses || {};
    for (const [key, bonus] of Object.entries(bonuses)) {
        if (!key.startsWith('sk_') && !key.startsWith('attr_')) continue;
        if (!bonus || bonus === 0) continue;
        const container = document.querySelector(`.dots5[data-attr="${key}"]`);
        if (!container) continue;
        const baseVal = state.dots[key] || 0;
        const effectiveVal = baseVal + bonus;
        container.querySelectorAll('.dot').forEach(d => {
            const val = +d.dataset.val;
            if (val <= baseVal) {
                d.classList.add('filled');
                d.classList.remove('bonus');
            } else if (val <= effectiveVal) {
                d.classList.add('filled', 'bonus');
            } else {
                d.classList.remove('filled', 'bonus');
            }
        });
    }
}

function updateDerivedField(key, value) {
    const mapping = DERIVED_FIELDS_MAP[key];
    if (!mapping) return;

    const displayEl = document.getElementById(mapping.display);
    if (displayEl) {
        displayEl.value = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
    }

    if (mapping.atual) {
        const atualEl = document.querySelector(`[data-key="${mapping.atual}"]`);
        if (atualEl) {
            atualEl.max = value;
            const current = parseInt(atualEl.value, 10);
            if (!isNaN(current) && current > value) {
                atualEl.value = value;
            }
        }
    }

    // Guardar em state.derived
    if (!state.derived) state.derived = {};
    state.derived[key] = value;
}

/* Validação: ATUAL ≤ MAX ao digitar */
function validateAtualField(atualKey, maxDisplayId) {
    const atualEl = document.querySelector(`[data-key="${atualKey}"]`);
    const maxEl = document.getElementById(maxDisplayId);
    if (!atualEl || !maxEl) return;
    atualEl.addEventListener('input', () => {
        const maxVal = parseInt(maxEl.value, 10) || 0;
        const curVal = parseInt(atualEl.value, 10);
        if (!isNaN(curVal) && curVal > maxVal) {
            atualEl.value = maxVal;
        }
    });
}

/* Inicializar listeners e renderizar grid dinâmica */
function initDerivedListeners() {
    // Validação de campos ATUAL ≤ MAX (Status Vitais hardcoded)
    validateAtualField('vit_atual', 'vit_max_display');
    validateAtualField('ener_atual', 'ener_max_display');
    validateAtualField('san_atual', 'san_max_display');

    // Renderizar grid dinâmica de valores derivados
    renderDerivedValuesGrid();
}
