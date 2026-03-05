/* ===== DERIVED VALUES — Cálculo Automático de Valores Derivados ===== */

const DERIVED_FORMULAS = {
    VIT_MAX: (a, s, f) => (a.VIG + f.tamanho) * 3,
    PERC: (a, s, f) => a.RAC + a.PRE,
    INI: (a, s, f) => a.RAC + a.DES + a.AUT + s.agilidade - f.tamanho,
    DET_MAX: (a, s, f) => a.PRS + a.AUT,
    REA: (a, s, f) => Math.min(a.DES, a.RAC) + s.agilidade,
    DESLOC_T: (a, s, f) => a.FOR + a.DES + f.tamanho + s.agilidade,
    DESLOC_A: (a, s, f) => Math.floor((a.FOR + a.DES + f.tamanho + s.atletismo) / 3),
    DESLOC_AR: (a, s, f) => a.FOR + a.DES + f.tamanho + s.atletismo,
    DESLOC_V: (a, s, f) => Math.min(a.FOR, s.atletismo),
    SAN_MAX: (a, s, f) => (a.INT + a.AUT + a.PRS) * 2 - (s.abismo * 2),
    CARGA: (a, s, f) => a.FOR + a.VIG,
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

function gatherDerivedSkills() {
    return {
        agilidade: getEffectiveDotValue('sk_fisico_agilidade'),
        atletismo: getEffectiveDotValue('sk_fisico_atletismo'),
        abismo: getEffectiveDotValue('sk_mental_abismo'),
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
    const skills = gatherDerivedSkills();
    const fields = gatherDerivedFields();
    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    for (const [key, formula] of Object.entries(DERIVED_FORMULAS)) {
        let value = formula(attrs, skills, fields);

        // Aplicar bônus de mecânicas para este derivado
        const bonusKey = `DERIVED:${key}`;
        value += (bonuses[bonusKey] || 0);

        // Aplicar multiplicadores de mecânicas (ex: Yotun dobra carga)
        const multKey = `MULT:DERIVED:${key}`;
        if (bonuses[multKey]) {
            value = Math.floor(value * bonuses[multKey]);
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
    // Primeiro: resetar campos que foram previamente modificados por bônus de field:*
    document.querySelectorAll('[data-mechanic-field-bonus]').forEach(el => {
        const baseVal = parseFloat(el.dataset.baseValue) || 0;
        el.value = baseVal;
        el.removeAttribute('data-mechanic-field-bonus');
    });

    // Depois: aplicar bônus atuais
    for (const [bonusKey, bonusVal] of Object.entries(bonuses)) {
        if (!bonusKey.startsWith('field:')) continue;
        if (!bonusVal || bonusVal === 0) continue;

        const dataKey = bonusKey.slice(6); // remove "field:" prefix
        const el = document.querySelector(`[data-key="${dataKey}"]`);
        if (!el) continue;

        // Guardar o valor base original se ainda não foi salvo
        if (el.dataset.baseValue === undefined || !el.hasAttribute('data-base-value')) {
            el.dataset.baseValue = String(parseFloat(el.value) || 0);
        }
        const baseVal = parseFloat(el.dataset.baseValue) || 0;
        el.value = baseVal + bonusVal;
        el.setAttribute('data-mechanic-field-bonus', 'true');
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
        displayEl.value = value;
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
    // atualizar data-base-value com o valor digitado, para que o bônus de
    // mecânica seja somado POR CIMA do valor base do usuário no próximo recalcAll.
    const bldEl = document.querySelector('[data-key="blindagem"]');
    if (bldEl) {
        bldEl.addEventListener('input', () => {
            bldEl.dataset.baseValue = String(parseFloat(bldEl.value) || 0);
        });
    }
}
