/* ===== DERIVED VALUES — Cálculo Automático de Valores Derivados ===== */

/* --- Modificadores raciais aplicados pelo sistema de peculiaridades --- */
window._raceBonuses = {
    det_max: 0,       // somado à DET_MAX
    vit_max: 0,       // somado à VIT_MAX (negativo para Picxi)
    perc: 0,          // somado à PERC (Tamano: Olfato Excepcional)
    is_yotun: false,  // se true, verifica tamanho >=10 para dobrar desloc terrestre
    carga_mult: 1,    // multiplicador da Carga (Yotun: ×2)
    desloc_ar_override: false, // true = fórmula Picxi: (FOR+DES+Tam+Atletismo)*3
};

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

function gatherAttributes() {
    return {
        FOR: state.dots['attr_for'] || 0,
        DES: state.dots['attr_des'] || 0,
        VIG: state.dots['attr_vig'] || 0,
        INT: state.dots['attr_int'] || 0,
        RAC: state.dots['attr_rac'] || 0,
        PRS: state.dots['attr_prs'] || 0,
        PRE: state.dots['attr_pre'] || 0,
        MAN: state.dots['attr_man'] || 0,
        AUT: state.dots['attr_aut'] || 0,
    };
}

function gatherDerivedSkills() {
    return {
        agilidade: state.dots['sk_fisico_agilidade'] || 0,
        atletismo: state.dots['sk_fisico_atletismo'] || 0,
        abismo: state.dots['sk_mental_abismo'] || 0,
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
    const rb = window._raceBonuses;

    for (const [key, formula] of Object.entries(DERIVED_FORMULAS)) {
        let value = formula(attrs, skills, fields);

        // Aplicar modificadores raciais
        switch (key) {
            case 'VIT_MAX': value += rb.vit_max; break;
            case 'DET_MAX': value += rb.det_max; break;
            case 'PERC': value += rb.perc; break;
            case 'DESLOC_T':
                if (rb.is_yotun && fields.tamanho >= 10) value = value * 2;
                break;
            case 'CARGA': value = Math.floor(value * rb.carga_mult); break;
            case 'DESLOC_AR':
                if (rb.desloc_ar_override) {
                    value = (attrs.FOR + attrs.DES + fields.tamanho + skills.atletismo) * 3;
                }
                break;
        }

        updateDerivedField(key, value);
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
}
