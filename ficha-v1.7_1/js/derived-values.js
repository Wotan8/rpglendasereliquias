/* ===== DERIVED VALUES — Cálculo Automático de Valores Derivados ===== */

/* ===== FÓRMULAS DE VALORES DERIVADOS =====
 * IMPORTANTE: Perícias NÃO participam das fórmulas base.
 * Qualquer contribuição de perícia deve ser criada como
 * mecânica no Painel de Criador (tipo Modificar → alvo derivado).
 * Isso evita valores duplicados e garante flexibilidade total.
 */
const DERIVED_FORMULAS = {
    VIT_MAX: (a, f) => (a.VIG + f.tamanho) * 3,
    PERC: (a, f) => a.RAC + a.PRE,
    INI: (a, f) => a.RAC + a.DES + a.AUT - f.tamanho,
    DET_MAX: (a, f) => a.PRS + a.AUT,
    REA: (a, f) => Math.min(a.DES, a.RAC),
    DESLOC_T: (a, f) => a.FOR + a.DES + f.tamanho,
    DESLOC_A: (a, f) => Math.floor((a.FOR + a.DES + f.tamanho) / 3),
    DESLOC_AR: (a, f) => a.FOR + a.DES + f.tamanho,
    DESLOC_V: (a, f) => 0,
    SAN_MAX: (a, f) => (a.INT + a.AUT + a.PRS) * 2,
    CARGA: (a, f) => a.FOR + a.VIG,
};

/* Mapa: campo derivado → { display, atual (se aplicável) } */
const DERIVED_FIELDS_MAP = {
    VIT_MAX: { display: 'vit_max_display', atual: 'vit_atual' },
    DET_MAX: { display: 'det_max_display', atual: 'det_atual' },
    SAN_MAX: { display: 'san_max_display', atual: 'san_atual' },
    PERC: { display: 'perc_display' },
    INI: { display: 'ini_display' },
    REA: { display: 'rea_display' },
    DESLOC_T: { display: 'desloc_t_display' },
    DESLOC_A: { display: 'desloc_a_display' },
    DESLOC_AR: { display: 'desloc_ar_display' },
    DESLOC_V: { display: 'desloc_v_display' },
    CARGA: { display: 'carga_display' },
};

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
    const tamEl = document.querySelector('[data-key="tamanho"]');
    return {
        tamanho: parseInt(tamEl ? tamEl.value : '0', 10) || 0,
    };
}

function recalcAll() {
    const attrs = gatherAttributes();
    const fields = gatherDerivedFields();
    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    for (const [key, formula] of Object.entries(DERIVED_FORMULAS)) {
        let value = formula(attrs, fields);

        // Aplicar bônus de mecânicas para este derivado
        const bonusKey = `DERIVED:${key}`;

        // "Definir fixo" (=) — overrides the base formula entirely
        const setKey = `SET:${bonusKey}`;
        if (bonuses[setKey] !== undefined) {
            value = bonuses[setKey];
        }

        value += (bonuses[bonusKey] || 0);

        // Aplicar multiplicadores de mecânicas (ex: Yotun dobra carga)
        const multKey = `MULT:DERIVED:${key}`;
        if (bonuses[multKey]) {
            value = Math.floor(value * bonuses[multKey]);
        }

        // Aplicar divisores de mecânicas (÷)
        const divKey = `DIV:${bonusKey}`;
        if (bonuses[divKey] && bonuses[divKey] !== 0) {
            value = Math.floor(value / bonuses[divKey]);
        }

        // Aplicar limites de mecânicas
        const limit = limits[bonusKey];
        if (limit) {
            if (limit.tipo === 'bloqueio') value = 0;
            if (limit.tipo === 'maximo' && limit.max != null) value = Math.min(value, limit.max);
            if (limit.tipo === 'minimo' && limit.min != null) value = Math.max(value, limit.min);
        }

        updateDerivedField(key, value);
    }

    // Aplicar limites em atributos (ex: Pogo FOR max 3)
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

    // Aplicar bônus de mecânicas em campos DOM (field:xxx, ex: blindagem, tamanho)
    // Usa state.appliedFieldBonuses para rastrear bônus já aplicados.
    // Só atualiza o campo quando o bônus de mecânica MUDA (ex: level-up).
    // Se o bônus é o mesmo, o campo não é tocado — preservando edições manuais do usuário.
    if (!state.fieldBaseValues) state.fieldBaseValues = {};
    if (!state.appliedFieldBonuses) state.appliedFieldBonuses = {};

    // Coletar bônus agrupados por campo
    const fieldBonuses = {};
    const fieldSets = {};   // SET: overrides for field targets
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

    // Resetar campos que tinham bônus mas agora não têm mais
    document.querySelectorAll('[data-mechanic-field-bonus]').forEach(el => {
        const dk = el.dataset.key;
        if (!dk || fieldBonuses[dk] !== undefined || fieldSets[dk] !== undefined) return; // ainda tem bônus/set, será tratado abaixo
        // Bônus removido: restaurar valor base
        if (state.fieldBaseValues[dk] !== undefined) {
            el.value = state.fieldBaseValues[dk];
        }
        el.removeAttribute('data-mechanic-field-bonus');
        delete state.appliedFieldBonuses[dk];
    });

    // Aplicar bônus atuais — MAS só se o bônus mudou
    for (const [dataKey, bonus] of Object.entries(fieldBonuses)) {
        const el = document.querySelector(`[data-key="${dataKey}"]`);
        if (!el) continue;

        const previousBonus = state.appliedFieldBonuses[dataKey];

        // Se o bônus é idêntico ao já aplicado, NÃO tocar no campo
        // → preserva edições manuais do usuário
        if (previousBonus !== undefined && previousBonus === bonus) {
            el.setAttribute('data-mechanic-field-bonus', 'true');
            continue;
        }

        // Bônus mudou (ou é novo): capturar base e recalcular
        if (state.fieldBaseValues[dataKey] === undefined) {
            // Se tinha bônus anterior, subtrair para achar o base
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

    // Aplicar SET: overrides (= Definir fixo) para campos DOM
    for (const [dataKey, setVal] of Object.entries(fieldSets)) {
        const el = document.querySelector(`[data-key="${dataKey}"]`);
        if (!el) continue;
        // Capture base value if not already captured
        if (state.fieldBaseValues[dataKey] === undefined) {
            state.fieldBaseValues[dataKey] = parseFloat(el.value) || 0;
        }
        // SET ignores base — applies the equation value directly, plus any additive bonus
        const bonus = fieldBonuses[dataKey] || 0;
        el.value = setVal + bonus;
        el.setAttribute('data-mechanic-field-bonus', 'true');
        state.appliedFieldBonuses[dataKey] = setVal + bonus;
    }

    // Aplicar bônus de mecânicas visualmente nos dots (sk_* e attr_*)
    applyMechanicBonusesToDots();
}

/**
 * Aplica visualmente os bônus de mecânicas (sk_* e attr_*) nos dots.
 * Dots de bônus recebem a classe 'bonus' para destaque visual.
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

    // Atualizar campo display (readonly)
    const displayEl = document.getElementById(mapping.display);
    if (displayEl) {
        displayEl.value = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
    }

    // Se tem campo ATUAL, validar que não excede o MAX
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

/* Inicializar listeners em campos fonte */
function initDerivedListeners() {
    // Validação de campos ATUAL ≤ MAX
    validateAtualField('vit_atual', 'vit_max_display');
    validateAtualField('det_atual', 'det_max_display');
    validateAtualField('san_atual', 'san_max_display');

    // Listener no campo Tamanho
    const tamEl = document.querySelector('[data-key="tamanho"]');
    if (tamEl) {
        tamEl.addEventListener('input', recalcAll);
        tamEl.addEventListener('change', recalcAll);
    }

    // Listener no campo Blindagem: quando o usuário editar manualmente,
    // NÃO atualizar fieldBaseValues — o valor manual será preservado até
    // que uma mecânica force recálculo (level-up de peculiaridade).
    // A edição manual do usuário é salva diretamente pelo autosave normal.
}
