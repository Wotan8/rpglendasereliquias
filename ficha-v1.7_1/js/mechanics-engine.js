/* ===== MECHANICS ENGINE — Interpreta mecânicas do Firebase ===== */

/**
 * TARGET_MAP: Mapeia config.alvo (nome legível) → campo na ficha
 * Categorias:
 *   "attr_xxx"    → aplica em state.mechanicBonuses como bônus separado
 *   "sk_xxx"      → aplica em state.mechanicBonuses como bônus separado
 *   "DERIVED:XXX" → aplica como modificador na fórmula derivada (recalcAll)
 *   "field:xxx"   → aplica no campo data-key do DOM
 *   "INFO:xxx"    → apenas informativo, não altera cálculo
 */
const TARGET_MAP = {
    // === ATRIBUTOS ===
    "INT": "attr_int",
    "RAC": "attr_rac",
    "PRS": "attr_prs",
    "FOR": "attr_for",
    "DES": "attr_des",
    "VIG": "attr_vig",
    "PRE": "attr_pre",
    "MAN": "attr_man",
    "AUT": "attr_aut",

    // === STATUS VITAIS (gerenciados por mecânicas do Firebase) ===
    "Vitalidade Máxima": "DERIVED:VIT_MAX",
    "Energia Máxima": "DERIVED:ENER_MAX",
    "Sanidade Máxima": "DERIVED:SAN_MAX",

    // === CAMPOS DA FICHA ===
    "Blindagem": "field:blindagem",

    // === VALORES DERIVADOS: vêm do Firebase via populateTargetMapFromDerivedValues() ===

    // === PERÍCIAS MENTAIS ===
    "Abismo": "sk_mental_abismo",
    "Alquimancia": "sk_mental_alquimia",
    "Alquimia": "sk_mental_alquimia",
    "Essência": "sk_mental_essencia",
    "Fluxomancia": "sk_mental_essencia",
    "Erudição": "sk_mental_historia",
    "História": "sk_mental_historia",
    "Herbalismo": "sk_mental_herbalismo",
    "Investigação": "sk_mental_investigacao",
    "Medicina": "sk_mental_medicina",
    "Ofícios": "sk_mental_oficio_int",
    "Ofício Intel.": "sk_mental_oficio_int",
    "Religião": "sk_mental_reliquia",
    "Relíquia": "sk_mental_reliquia",
    "Runomancia": "sk_mental_runomancia",

    // === PERÍCIAS FÍSICAS ===
    "Agilidade": "sk_fisico_agilidade",
    "Arma": "sk_fisico_arma",
    "Arremessar": "sk_fisico_arremessar",
    "Atletismo": "sk_fisico_atletismo",
    "Briga": "sk_fisico_briga",
    "Disparo": "sk_fisico_disparo",
    "Furtividade": "sk_fisico_furtividade",
    "Montaria": "sk_fisico_montaria",
    "Ofício Braç.": "sk_fisico_oficio_brac",
    "Sobrevivência": "sk_fisico_sobrevivencia",

    // === PERÍCIAS SOCIAIS ===
    "Barganha": "sk_social_barganha",
    "Diplomacia": "sk_social_diplomacia",
    "Domar": "sk_social_domar",
    "Empatia": "sk_social_empatia",
    "Intimidação": "sk_social_intimidacao",
    "Liderança": "sk_social_lideranca",
    "Malandragem": "sk_social_malandragem",
    "Performance": "sk_social_performance",
    "Sedução": "sk_social_seducao",
    "Observação": "sk_social_observacao",

    // === PERÍCIAS DEFENSIVAS / COMBATE ===
    "Esquiva": "sk_combate_esquiva",
    "Aparar": "sk_combate_aparar",
    "Bloquear": "sk_combate_bloquear",
    "Desviar": "sk_combate_desviar",
    "Evadir": "sk_combate_evadir",
    "Cobertura": "sk_combate_cobertura",
    "Proteger": "sk_combate_proteger",
    "Reflexo": "sk_combate_reflexo",
    "Contra-Ataque": "sk_combate_contra_ataque",
    "Contra-Ataq.": "sk_combate_contra_ataque",
    "Ambidestria": "sk_combate_ambidestria",

    // === PROPRIEDADES DE COMBATE (informativos) ===
    "Alvo de Ataque": "INFO:alvo_ataque",
    "Alvo de Defesa": "INFO:alvo_defesa",
    "Dano": "INFO:dano",
    "Dano Crítico": "INFO:dano_critico",
    "Ações por turno": "INFO:acoes_turno",
};

/**
 * Popula TARGET_MAP com perícias carregadas dinamicamente do Firebase.
 * Chamada após buildSkillsFromFirebase() para registrar skills criadas no painel.
 */
function populateTargetMapFromSkills() {
    if (!window.SKILLS) return;
    const CATEGORY_PREFIX = {
        'mental': 'sk_mental_', 'fisico': 'sk_fisico_',
        'social': 'sk_social_', 'combate': 'sk_combate_',
        'exclusivo': 'sk_exclusivo_'
    };
    for (const cat of Object.keys(window.SKILLS)) {
        const pfx = CATEGORY_PREFIX[cat] || 'sk_mental_';
        for (const sk of window.SKILLS[cat]) {
            // SEMPRE sobrescreve para garantir que o key dinâmico (Firebase)
            // coincida com o key usado nos dots/state (pode ter acentos)
            TARGET_MAP[sk.name] = pfx + sk.key;
        }
    }
    console.log('✅ TARGET_MAP atualizado com perícias do Firebase');
}

/**
 * Popula TARGET_MAP com valores derivados do Firebase.
 * Chamada após buildDerivedValuesFromFirebase().
 */
function populateTargetMapFromDerivedValues() {
    if (!window.DERIVED_VALUES) return;
    for (const dv of window.DERIVED_VALUES) {
        // Registrar/sobrescrever por nome legível → DERIVED:KEY
        // SEMPRE sobrescreve para garantir que o key dinâmico (Firebase)
        // coincida com o key usado em recalcAll/_applyMechanicModifiers
        TARGET_MAP[dv.nome] = `DERIVED:${dv.key}`;

        // Se DV tem campoAtual, registrar também entries para (Atual) e (Máximo)
        if (dv.campoAtual) {
            TARGET_MAP[`${dv.nome} (Atual)`] = `field:dv_${dv.key}_atual`;
            TARGET_MAP[`${dv.nome} (Máximo)`] = `DERIVED:${dv.key}`;
        }
    }
    console.log('✅ TARGET_MAP atualizado com valores derivados do Firebase');
}

/**
 * Popula TARGET_MAP com status vitais do Firebase.
 * Chamada após buildVitalStatsFromFirebase().
 * Os status vitais usam DERIVED:KEY (ex: DERIVED:VITALIDADE_MAX)
 * e os entries hardcoded (ex: "Vitalidade Máxima" → DERIVED:VIT_MAX)
 * já existem no TARGET_MAP estático, mas esta função garante
 * que nomes do Firebase sobrescrevam corretamente.
 */
function populateTargetMapFromVitalStats() {
    if (!window.VITAL_STATS) return;
    for (const vs of window.VITAL_STATS) {
        // Registrar como DERIVED:KEY (mesma lógica dos DVs)
        TARGET_MAP[`${vs.nome} Máxima`] = `DERIVED:${vs.key}`;
        TARGET_MAP[`${vs.nome} Máximo`] = `DERIVED:${vs.key}`;
    }
    console.log('✅ TARGET_MAP atualizado com status vitais do Firebase');
}

/**
 * Pool map: mapeia nomes de pool (usados em mecânicas distribuir) para listas de alvos válidos.
 * Usa o array SKILLS (data.js) como fonte canônica de nomes para evitar aliases/duplicatas.
 */
function getDistribuirPool(poolName) {
    if (!poolName) return [];
    const p = poolName.toLowerCase();

    // Helper: extrai nomes canônicos de uma ou mais categorias do SKILLS
    const fromSkills = (...categories) => {
        const names = [];
        for (const cat of categories) {
            if (SKILLS[cat]) {
                for (const sk of SKILLS[cat]) {
                    names.push(sk.name);
                }
            }
        }
        return names;
    };

    if (p.includes('perícia') && p.includes('qualquer')) {
        return fromSkills('mental', 'fisico', 'social', 'combate');
    }
    if (p.includes('perícia') && p.includes('mental')) {
        return fromSkills('mental');
    }
    if (p.includes('perícia') && p.includes('físic')) {
        return fromSkills('fisico');
    }
    if (p.includes('perícia') && p.includes('social')) {
        return fromSkills('social');
    }
    if (p.includes('perícia') && p.includes('combate')) {
        return fromSkills('combate');
    }
    if (p.includes('atributo')) {
        return Object.keys(TARGET_MAP).filter(k => TARGET_MAP[k]?.startsWith('attr_'));
    }

    // Fallback: tentar encontrar o alvo direto
    return [poolName];
}

/* ===== ARMAZENA MECÂNICAS BRUTAS DE VALORES DERIVADOS para re-avaliação dinâmica ===== */
let _derivedValueMechanicsRaw = [];

/* ===== RASTREIA contribuições de equações dinâmicas para subtração seletiva ===== */
let _dynamicMechContributions = {};

/* ===== LIMPAR BÔNUS DE MECÂNICAS ===== */
function clearMechanicBonuses() {
    state.mechanicBonuses = {};
    state.mechanicLimits = {};
    state.capacidades = [];
    state.mecanicasPendentes = [];
    _derivedValueMechanicsRaw = [];
    _dynamicMechContributions = {};
}

/* ===== RESOLVER VALOR DINÂMICO DE CÁLCULO ===== */
function resolveCalcValue(calc) {
    if (!calc) return 0;
    // New equation format
    if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
        return resolveEquation(calc.equacao);
    }
    // Legacy format
    if (calc.valorTipo !== 'ficha') {
        return parseFloat(calc.valor) || 0;
    }
    // Resolve valor de ficha (legacy)
    return _resolveSheetRef(calc.valorRef, calc.valorMultiplicador || 1);
}

/* ===== RESOLVER EQUAÇÃO MULTI-TERMO ===== */
function resolveEquation(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return 0;
    let result = _resolveTermValue(equacao[0]);
    for (let i = 1; i < equacao.length; i++) {
        const t = equacao[i];
        const val = _resolveTermValue(t);
        const op = t.op || '+';
        if (op === '+') result += val;
        else if (op === '-') result -= val;
        else if (op === '×' || op === '*') result *= val;
        else if (op === '÷' || op === '/') result = val !== 0 ? result / val : result;
        else if (op === 'min') result = Math.min(result, val);
        else if (op === 'max') result = Math.max(result, val);
    }
    return result;
}

function _resolveTermValue(term) {
    if (!term) return 0;
    if (term.tipo === 'ficha') {
        return _resolveSheetRef(term.ref, 1);
    }
    return parseFloat(term.valor) || 0;
}

function _resolveSheetRef(ref, mult) {
    if (!ref) return 0;
    mult = mult || 1;

    // Check attributes (includes mechanic bonuses / highlighted levels)
    const attrKey = TARGET_MAP[ref];
    if (attrKey && attrKey.startsWith('attr_')) {
        const attrVal = typeof getEffectiveDotValue === 'function'
            ? getEffectiveDotValue(attrKey)
            : (state.dots[attrKey] || 0) + (state.mechanicBonuses?.[attrKey] || 0);
        return attrVal * mult;
    }

    // Check skills (includes mechanic bonuses / highlighted levels)
    if (attrKey && attrKey.startsWith('sk_')) {
        const skVal = typeof getEffectiveDotValue === 'function'
            ? getEffectiveDotValue(attrKey)
            : (state.dots[attrKey] || 0) + (state.mechanicBonuses?.[attrKey] || 0);
        return skVal * mult;
    }

    // Check Nível
    if (ref === 'Nível') {
        const nivel = parseInt(document.querySelector('[data-key="nivel"]')?.value) || 1;
        return nivel * mult;
    }

    // Check DV (Atual) — reads editable Atual field from state.dvAtual
    if (attrKey && attrKey.startsWith('field:dv_') && attrKey.endsWith('_atual')) {
        const dvKey = attrKey.replace('field:dv_', '').replace('_atual', '');
        const atualVal = parseFloat(state.dvAtual?.[dvKey] || '0') || 0;
        return atualVal * mult;
    }

    // Check derived values
    if (attrKey && attrKey.startsWith('DERIVED:')) {
        const derivedKey = attrKey.replace('DERIVED:', '');
        const derivedVal = state.derived?.[derivedKey] || 0;
        return derivedVal * mult;
    }

    // Check field values
    if (attrKey && attrKey.startsWith('field:')) {
        const fieldKey = attrKey.replace('field:', '');
        const fieldEl = document.querySelector(`[data-key="${fieldKey}"]`);
        const fieldVal = parseFloat(String(fieldEl?.value || '0').replace(',', '.')) || 0;
        return fieldVal * mult;
    }

    return 0;
}

/* ===== APLICAR TODAS AS MECÂNICAS DE UMA RAÇA ===== */
function applyAllRaceMechanics(racaNome) {
    clearMechanicBonuses();

    // Always apply skill mechanics, even without a race selected
    applySkillMechanics();

    // Apply mechanics linked to derived values
    applyDerivedValueMechanics();

    // Apply mechanics linked to vital stats (from Firebase)
    applyVitalStatsMechanics();

    if (!racaNome || !window.RACES) return;
    const raca = window.RACES[racaNome];
    if (!raca) return;

    for (const pec of raca.peculiaridades) {
        if (!pec.mecanicas) continue;
        for (const mech of pec.mecanicas) {
            applyMechanicToSheet(mech, pec);
        }
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A PERÍCIAS ===== */
function applySkillMechanics() {
    if (!window.SKILLS || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    for (const cat of Object.keys(window.SKILLS)) {
        for (const skill of window.SKILLS[cat]) {
            if (!skill.mecanicaIds || skill.mecanicaIds.length === 0) continue;
            for (const mechId of skill.mecanicaIds) {
                const mech = mechanicsById[mechId];
                if (!mech) continue;
                applyMechanicToSheet(mech, null);
            }
        }
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A STATUS VITAIS (Firebase) ===== */
function applyVitalStatsMechanics() {
    if (!window.VITAL_STATS || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    const processedMechIds = new Set();

    for (const vs of window.VITAL_STATS) {
        if (!vs.mecanicaIds || vs.mecanicaIds.length === 0) continue;
        for (const mechId of vs.mecanicaIds) {
            if (processedMechIds.has(mechId)) continue;
            processedMechIds.add(mechId);

            const mech = mechanicsById[mechId];
            if (!mech) continue;

            // Se a mecânica tem referências à ficha, armazenar para re-avaliação dinâmica
            if (mech.tipo === 'modificar'
                && (!mech.duracao || mech.duracao === 'permanente')
                && !mech.condicaoAplicacao?.trim()
                && _mechHasSheetRefs(mech)) {
                _derivedValueMechanicsRaw.push(mech);
                continue;
            }

            applyMechanicToSheet(mech, null);
        }
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A VALORES DERIVADOS ===== */
function applyDerivedValueMechanics() {
    if (!window.DERIVED_VALUES || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    // Evitar duplicatas: se o mesmo mechId está vinculado a múltiplos DVs,
    // processar apenas uma vez.
    const processedMechIds = new Set();

    for (const dv of window.DERIVED_VALUES) {
        if (!dv.mecanicaIds || dv.mecanicaIds.length === 0) continue;
        for (const mechId of dv.mecanicaIds) {
            if (processedMechIds.has(mechId)) continue;
            processedMechIds.add(mechId);

            const mech = mechanicsById[mechId];
            if (!mech) continue;

            // Se a mecânica é "modificar" permanente com equação que referencia a ficha,
            // armazenar para re-avaliação dinâmica em recalcAll()
            if (mech.tipo === 'modificar'
                && (!mech.duracao || mech.duracao === 'permanente')
                && !mech.condicaoAplicacao?.trim()
                && _mechHasSheetRefs(mech)) {
                _derivedValueMechanicsRaw.push(mech);
                // Não chamar applyMechanicToSheet — será resolvido em recalcAll
                continue;
            }

            applyMechanicToSheet(mech, null);
        }
    }
}

/**
 * Verifica se uma mecânica "modificar" contém referências à ficha
 * (tipo 'ficha' em algum termo de equação) — ou seja, seu valor depende
 * de atributos/perícias que mudam dinamicamente.
 */
function _mechHasSheetRefs(mech) {
    const config = mech.config || {};
    const calculos = Array.isArray(config.calculos) ? config.calculos
        : [{ equacao: config.equacao }];
    for (const calc of calculos) {
        if (Array.isArray(calc.equacao)) {
            for (const term of calc.equacao) {
                if (term.tipo === 'ficha') return true;
            }
        }
        // Legacy format
        if (calc.valorTipo === 'ficha') return true;
    }
    return false;
}

/**
 * Re-avalia dinamicamente todas as mecânicas brutas de valores derivados.
 * Chamada por recalcAll() para garantir que equações com referências à ficha
 * sempre reflitam os valores atuais de atributos/perícias.
 */
function resolveDerivedValueMechanicsLive() {
    // Limpar contribuições anteriores rastreadas
    _dynamicMechContributions = {};

    for (const mech of _derivedValueMechanicsRaw) {
        const config = mech.config || {};
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: 'fixo' }];

        for (const calc of calculos) {
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (!field) {
                    console.warn(`⚠️ Mecânica DV "${mech.nome}": alvo "${alvo}" não encontrado no TARGET_MAP`);
                    continue;
                }

                const val = resolveCalcValue(calc);
                const op = calc.operacao;

                console.log(`🔧 DV Mech "${mech.nome}": ${op}${val} → ${alvo} (${field})`);

                if (op === '+') {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + val;
                    _dynamicMechContributions[field] = (_dynamicMechContributions[field] || 0) + val;
                }
                else if (op === '-') {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - val;
                    _dynamicMechContributions[field] = (_dynamicMechContributions[field] || 0) - val;
                }
                else if (op === '×' || op === '*') {
                    const multKey = 'MULT:' + field;
                    state.mechanicBonuses[multKey] = (state.mechanicBonuses[multKey] || 1) * val;
                    _dynamicMechContributions[multKey] = val;
                }
                else if (op === '=') {
                    const setKey = 'SET:' + field;
                    state.mechanicBonuses[setKey] = val;
                    _dynamicMechContributions[setKey] = val;
                }
                else if (op === '÷' || op === '/') {
                    const divKey = 'DIV:' + field;
                    state.mechanicBonuses[divKey] = (state.mechanicBonuses[divKey] || 1) * val;
                    _dynamicMechContributions[divKey] = val;
                }
            }
        }
    }
}

/**
 * Retorna as contribuições dinâmicas rastreadas para subtração seletiva em recalcAll().
 * Isso permite que recalcAll() remova APENAS os bônus de equações dinâmicas,
 * preservando bônus de outras fontes (ex: peculiaridades raciais).
 */
function _getDynamicMechContributions() {
    return _dynamicMechContributions;
}

/**
 * Retorna as chaves DERIVED: que são gerenciadas por _derivedValueMechanicsRaw.
 * Usado por recalcAll() para limpar apenas essas chaves antes de re-resolver.
 */
function _getDerivedMechKeys() {
    const keys = new Set();
    for (const mech of _derivedValueMechanicsRaw) {
        const config = mech.config || {};
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo }];
        for (const calc of calculos) {
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (field) keys.add(field);
            }
        }
    }
    return keys;
}

/* ===== APLICAR UMA MECÂNICA INDIVIDUAL ===== */
function applyMechanicToSheet(mech, parentPec) {
    const tipo = mech.tipo;

    // Se a mecânica é evoluível, resolver o valor com base no nível atual da peculiaridade
    let config = mech.config || {};
    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || parentPec.nivel || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog) {
            // Criar config ajustada ao nível
            config = JSON.parse(JSON.stringify(config));
            if (tipo === 'modificar' || tipo === 'limitar') {
                // New equation-based progression: override fixo term values
                if (prog.termos && Array.isArray(config.calculos)) {
                    for (const calc of config.calculos) {
                        if (Array.isArray(calc.equacao)) {
                            let fixoIdx = 0;
                            for (const term of calc.equacao) {
                                if (term.tipo !== 'ficha') {
                                    const overrideVal = prog.termos[String(fixoIdx)];
                                    if (overrideVal !== undefined && overrideVal !== '') {
                                        term.valor = overrideVal;
                                    }
                                    fixoIdx++;
                                }
                            }
                        }
                    }
                } else if (tipo === 'modificar' && prog.valor !== undefined) {
                    // Legacy single-value progression
                    config.valor = prog.valor;
                } else if (tipo === 'limitar') {
                    const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
                    if (limVal !== undefined) {
                        if (config.valorMaximo !== undefined) config.valorMaximo = limVal;
                        if (config.valorMinimo !== undefined) config.valorMinimo = limVal;
                    }
                }
            } else if (tipo === 'distribuir') {
                if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
                if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
                if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
            }
            // narrativo, conceder e condicional não alteram cálculos, só exibição
        }
    }

    // Verificar condições
    const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
    const isPermanent = !mech.duracao || mech.duracao === 'permanente';
    const isCreation = mech.duracao === 'criacao';

    // === TIPO: MODIFICAR ===
    if (tipo === 'modificar' && isPermanent && !isConditional) {
        // Support new multi-calc format
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: 'fixo' }];

        for (const calc of calculos) {
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (!field) {
                    console.warn(`⚠️ Mecânica "${mech.nome}": alvo "${alvo}" não encontrado no TARGET_MAP`);
                    continue;
                }

                const val = resolveCalcValue(calc);
                const op = calc.operacao;

                if (op === '+') state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + val;
                else if (op === '-') state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - val;
                else if (op === '×' || op === '*') {
                    const multKey = 'MULT:' + field;
                    state.mechanicBonuses[multKey] = (state.mechanicBonuses[multKey] || 1) * val;
                }
                else if (op === '=') {
                    // "Definir fixo": overrides the base formula entirely
                    const setKey = 'SET:' + field;
                    state.mechanicBonuses[setKey] = val;
                }
                else if (op === '÷' || op === '/') {
                    const divKey = 'DIV:' + field;
                    state.mechanicBonuses[divKey] = (state.mechanicBonuses[divKey] || 1) * val;
                }
            }
        }
    }

    // === TIPO: LIMITAR ===
    if (tipo === 'limitar' && isPermanent && !isConditional) {
        // Support new multi-calc format
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, tipoLimite: config.tipoLimite, valor: config.valorMaximo ?? config.valorMinimo, valorTipo: 'fixo' }];

        for (const calc of calculos) {
            const field = TARGET_MAP[calc.alvo];
            if (!field) continue;

            const resolvedVal = resolveCalcValue(calc);

            if (calc.tipoLimite === 'bloqueio') {
                state.mechanicLimits[field] = { tipo: 'bloqueio', max: 0, min: 0 };
            } else if (calc.tipoLimite === 'maximo') {
                state.mechanicLimits[field] = { tipo: 'maximo', max: resolvedVal, min: null };
            } else if (calc.tipoLimite === 'minimo') {
                state.mechanicLimits[field] = { tipo: 'minimo', max: null, min: resolvedVal };
            } else if (calc.tipoLimite === 'clamp') {
                state.mechanicLimits[field] = { tipo: 'clamp', max: resolvedVal, min: calc.valorMinimo ?? 0 };
            }
        }
    }

    // === TIPO: CONCEDER ===
    if (tipo === 'conceder') {
        state.capacidades.push({
            tipo: config.tipoConcessao,
            descricao: config.descricaoConcessao,
            fonte: parentPec?.nome || mech.nome
        });
    }

    // === TIPO: DISTRIBUIR ===
    if (tipo === 'distribuir' && (isCreation || isPermanent)) {
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaAplicada = dados?.aplicada;

        // Restaurar bônus de alvos já escolhidos (parcial ou completo)
        if (dados?.alvosEscolhidos) {
            for (const alvo of dados.alvosEscolhidos) {
                const field = TARGET_MAP[alvo.nome];
                if (field) {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + alvo.valor;
                }
            }
        }

        // Se não totalmente aplicada, marcar como pendente para mostrar slots restantes
        if (!jaAplicada) {
            state.mecanicasPendentes.push(mech);
        }
    }

    // Condicional e Narrativo: apenas informativo (exibido no card)
}
/* ===== FORMAT EQUATION PREVIEW ===== */
function _formatEquationPreview(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return '?';
    // Check if any term uses min/max — format as menor(A, B) or maior(A, B)
    const hasMinMax = equacao.some(t => t.op === 'min' || t.op === 'max');
    if (hasMinMax && equacao.length > 1) {
        const fnName = equacao[1].op === 'min' ? 'menor' : 'maior';
        const parts = equacao.map(t => {
            if (t.tipo === 'ficha') return `[${t.ref || '?'}]`;
            return (t.valor ?? '?');
        });
        return `${fnName}(${parts.join(', ')})`;
    }
    let str = '';
    for (let i = 0; i < equacao.length; i++) {
        const t = equacao[i];
        if (i > 0 && t.op) str += ` ${t.op} `;
        if (t.tipo === 'ficha') str += `[${t.ref || '?'}]`;
        else str += (t.valor ?? '?');
    }
    return equacao.length > 1 ? `(${str})` : str;
}

/* ===== GERAR TEXTO DE PREVIEW ===== */
function generatePreviewText(mech) {
    if (mech.previewTexto) return mech.previewTexto;
    const config = mech.config || {};
    const tipo = mech.tipo;

    if (tipo === 'modificar') {
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            return config.calculos.map(c => {
                const op = c.operacao || '+';
                let val;
                if (Array.isArray(c.equacao) && c.equacao.length > 0) {
                    val = _formatEquationPreview(c.equacao);
                } else if (c.valorTipo === 'ficha') {
                    const mult = c.valorMultiplicador && c.valorMultiplicador !== 1 ? ` × ${c.valorMultiplicador}` : '';
                    val = `[${c.valorRef || '?'}${mult}]`;
                } else {
                    val = c.valor ?? 0;
                }
                return `${op}${val} em ${c.alvo || '?'}`;
            }).join('; ');
        }
        const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
        const alvosStr = alvos.filter(Boolean).join(', ');
        return `${config.operacao || '+'}${config.valor || 0} em ${alvosStr}`;
    }
    if (tipo === 'limitar') {
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            return config.calculos.map(c => {
                const alvo = c.alvo || '?';
                if (c.tipoLimite === 'bloqueio') return `Bloqueio: ${alvo}`;
                let val;
                if (Array.isArray(c.equacao) && c.equacao.length > 0) {
                    val = _formatEquationPreview(c.equacao);
                } else if (c.valorTipo === 'ficha') {
                    const mult = c.valorMultiplicador && c.valorMultiplicador !== 1 ? ` × ${c.valorMultiplicador}` : '';
                    val = `[${c.valorRef || '?'}${mult}]`;
                } else {
                    val = c.valor ?? '?';
                }
                if (c.tipoLimite === 'maximo') return `${alvo} máximo ${val}`;
                if (c.tipoLimite === 'minimo') return `${alvo} mínimo ${val}`;
                return `Limite em ${alvo}`;
            }).join('; ');
        }
        if (config.tipoLimite === 'bloqueio') return `Bloqueio: ${config.alvo}`;
        if (config.tipoLimite === 'maximo') return `${config.alvo} máximo ${config.valorMaximo}`;
        if (config.tipoLimite === 'minimo') return `${config.alvo} mínimo ${config.valorMinimo}`;
        return `Limite em ${config.alvo}`;
    }
    if (tipo === 'conceder') {
        return `${config.tipoConcessao || 'Capacidade'}: ${config.descricaoConcessao || ''}`;
    }
    if (tipo === 'distribuir') {
        return `Distribuir: ${config.operacao || '+'}${config.valorPorAlvo || 1} em ${config.quantidadeAlvos || '?'} alvos de [${config.pool || '?'}]`;
    }
    if (tipo === 'condicional') {
        return `Condicional: ${config.gatilho || ''}`;
    }
    if (tipo === 'narrativo') {
        return config.textoEfeito || mech.descricao || '';
    }
    return mech.descricao || '';
}

/* ===== UI DE DISTRIBUIÇÃO ===== */

/**
 * Resolve a config de distribuição considerando nível evoluível.
 */
function _resolveDistribuirConfig(mech, parentPec) {
    let config = mech.config ? JSON.parse(JSON.stringify(mech.config)) : {};

    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog) {
            if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
            if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
            if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
        }
    }
    return config;
}

/**
 * Renderiza a UI de distribuição.
 * Se já houver alvos confirmados parcialmente, mostra-os travados e oferece os slots restantes.
 * Se todos os slots estiverem preenchidos, mostra apenas o resumo.
 */
function renderDistribuirUI(container, mech, parentPec) {
    const config = _resolveDistribuirConfig(mech, parentPec);

    const pool = getDistribuirPool(config.pool);
    const totalQty = config.quantidadeAlvos || 1;
    const valorPorAlvo = config.valorPorAlvo || 1;
    const restricao = config.restricao || '';

    // Buscar alvos já confirmados
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const remaining = totalQty - jaEscolhidos.length;

    const wrapper = document.createElement('div');
    wrapper.className = 'distribuir-ui';
    wrapper.dataset.mechId = mech.id;

    // --- Resumo do que já foi escolhido ---
    if (jaEscolhidos.length > 0) {
        const resumo = document.createElement('div');
        resumo.className = 'distribuir-resumo';
        const linhas = jaEscolhidos.map(a => `${a.nome} (+${a.valor})`).join(', ');
        resumo.innerHTML = `<strong>✅ Distribuído:</strong> ${linhas}`;
        wrapper.appendChild(resumo);
    }

    // Se todos os slots foram preenchidos, não mostrar mais selects
    if (remaining <= 0) {
        container.appendChild(wrapper);
        return;
    }

    // --- Título ---
    const titulo = document.createElement('div');
    titulo.className = 'distribuir-titulo';
    titulo.innerHTML = `⚠️ <strong>DISTRIBUIÇÃO PENDENTE</strong><br>
        Escolha até ${remaining} ${restricao === 'diferentes' ? 'perícias diferentes' : 'alvos'} para receber +${valorPorAlvo} (${jaEscolhidos.length}/${totalQty} distribuído${jaEscolhidos.length !== 1 ? 's' : ''}):`;
    wrapper.appendChild(titulo);

    // --- Selects apenas para os slots restantes ---
    const selectsContainer = document.createElement('div');
    selectsContainer.className = 'distribuir-selects';

    // Nomes já escolhidos (para desabilitar em restricao="diferentes")
    const nomesJaEscolhidos = jaEscolhidos.map(a => a.nome);

    for (let i = 0; i < remaining; i++) {
        const sel = document.createElement('select');
        sel.className = 'distribuir-select';
        sel.dataset.slotIndex = i;
        sel.innerHTML = `<option value="">— Selecione —</option>`;
        pool.forEach(alvoName => {
            const opt = document.createElement('option');
            opt.value = alvoName;
            opt.textContent = alvoName;
            // Desabilitar nomes que já foram confirmados anteriormente
            if (restricao === 'diferentes' && nomesJaEscolhidos.includes(alvoName)) {
                opt.disabled = true;
            }
            sel.appendChild(opt);
        });

        sel.addEventListener('change', () => {
            if (restricao === 'diferentes') {
                updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos);
            }
        });

        selectsContainer.appendChild(sel);
    }
    wrapper.appendChild(selectsContainer);

    // --- Botão de confirmar ---
    const btnConfirmar = document.createElement('button');
    btnConfirmar.className = 'btn-distribuir-confirmar';
    btnConfirmar.textContent = '✅ Confirmar Distribuição';
    btnConfirmar.addEventListener('click', () => confirmarDistribuicao(mech, wrapper, parentPec));
    wrapper.appendChild(btnConfirmar);

    container.appendChild(wrapper);
}

function updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const selectedValues = Array.from(selects).map(s => s.value).filter(Boolean);
    const allUsed = [...(nomesJaEscolhidos || []), ...selectedValues];

    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.querySelectorAll('option').forEach(opt => {
            if (!opt.value) return; // skip placeholder
            opt.disabled = allUsed.includes(opt.value) && opt.value !== currentVal;
        });
    });
}

function confirmarDistribuicao(mech, wrapper, parentPec) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const config = _resolveDistribuirConfig(mech, parentPec);
    const valorPorAlvo = config.valorPorAlvo || 1;

    // Coletar apenas os novos alvos selecionados (não vazios)
    const novosAlvos = [];
    for (const sel of selects) {
        if (sel.value) {
            novosAlvos.push({ nome: sel.value, valor: valorPorAlvo });
        }
    }

    if (novosAlvos.length === 0) {
        alert('Selecione pelo menos 1 alvo antes de confirmar.');
        return;
    }

    // Mesclar com alvos já confirmados anteriormente
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const todosAlvos = [...jaEscolhidos, ...novosAlvos];
    const totalQty = config.quantidadeAlvos || 1;
    const todosPreenchidos = todosAlvos.length >= totalQty;

    // Salvar no state (aplicada=true apenas quando todos preenchidos)
    state.mecanicasAplicadas[mech.id] = {
        aplicada: todosPreenchidos,
        timestamp: new Date().toISOString(),
        fonte: mech.fonte || '',
        alvosEscolhidos: todosAlvos
    };

    // Aplicar bônus dos NOVOS alvos apenas
    for (const alvo of novosAlvos) {
        const field = TARGET_MAP[alvo.nome];
        if (field) {
            state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + alvo.valor;
        }
    }

    // Se todos preenchidos, remover da lista de pendentes
    if (todosPreenchidos) {
        state.mecanicasPendentes = state.mecanicasPendentes.filter(m => m.id !== mech.id);
    }

    // Recalcular e salvar
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    // Re-renderizar peculiaridades para atualizar a UI
    _reRenderPeculiaridades();
}

/**
 * Re-renderiza toda a grid de peculiaridades para refletir mudanças.
 */
function _reRenderPeculiaridades() {
    const grid = document.getElementById('peculiaridadesGrid');
    const racaNome = document.getElementById('selRaca')?.value;
    if (grid && racaNome && window.RACES?.[racaNome]) {
        grid.innerHTML = '';
        window.RACES[racaNome].peculiaridades.forEach(pec => {
            if (typeof renderPeculiaridadeCard === 'function') {
                renderPeculiaridadeCard(pec, racaNome, grid);
            }
        });
    }
}

/**
 * Verifica se uma mecânica distribuir evoluível precisa reabrir a UI
 * porque o novo nível tem mais alvos disponíveis.
 * Chamada após level-up de peculiaridade.
 */
function checkDistribuirOnLevelUp(pec) {
    if (!pec.mecanicas) return;
    for (const mech of pec.mecanicas) {
        if (mech.tipo !== 'distribuir') continue;
        if (!mech.evoluivel || !mech.progressao) continue;

        const config = _resolveDistribuirConfig(mech, pec);
        const totalQty = config.quantidadeAlvos || 1;
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaEscolhidos = dados?.alvosEscolhidos || [];

        // Se o novo nível oferece mais slots do que os já preenchidos, reabrir
        if (jaEscolhidos.length < totalQty) {
            // Garantir que não está marcado como totalmente aplicada
            if (dados) {
                dados.aplicada = false;
            }
            // Adicionar de volta aos pendentes se não estiver lá
            if (!state.mecanicasPendentes.some(m => m.id === mech.id)) {
                state.mecanicasPendentes.push(mech);
            }
        }
    }
    // Re-renderizar para mostrar a UI
    _reRenderPeculiaridades();
}

/* ===== OBTER TODAS AS MECÂNICAS QUE AFETAM UMA PROPRIEDADE ===== */

/**
 * Retorna todas as mecânicas que afetam uma propriedade, de QUALQUER fonte.
 *
 * Fontes varridas:
 *   1. Mecânicas vinculadas (mecanicaIds) do próprio Status Vital / Valor Derivado / Perícia
 *   2. Mecânicas de peculiaridades da raça selecionada
 *   3. Mecânicas dinâmicas de equação (_derivedValueMechanicsRaw)
 *   4. Mecânicas de distribuição já aplicadas (state.mecanicasAplicadas)
 *   5. Mecânicas vinculadas a Perícias que têm como alvo a propriedade
 *   6. Mecânicas vinculadas a outros DVs / Status Vitais que têm como alvo a propriedade
 *
 * @param {string} propertyName - Nome legível da propriedade (ex: "Energia Máxima", "Agilidade")
 * @param {object} [opts] - Opções: { skipLinked: string[] } IDs de mecânicas vinculadas já listadas
 * @returns {Array<{fonte: string, preview: string, tipo: string}>}
 */
function getAffectingMechanics(propertyName, opts) {
    const results = [];
    const seenMechIds = new Set();
    const skipLinked = (opts && opts.skipLinked) || [];
    skipLinked.forEach(id => seenMechIds.add(id));

    // Resolver o campo-alvo desta propriedade no TARGET_MAP
    const targetField = TARGET_MAP[propertyName];
    if (!targetField) return results;

    // ---- Helper: verificar se uma mecânica afeta o campo-alvo ----
    function _mechAffectsTarget(mech) {
        if (!mech || !mech.config) return false;
        const config = mech.config;

        // Multi-calc format
        if (Array.isArray(config.calculos)) {
            for (const calc of config.calculos) {
                const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
                for (const alvo of alvos) {
                    if (!alvo) continue;
                    const field = TARGET_MAP[alvo];
                    if (field === targetField) return true;
                }
            }
        }

        // Legacy / single-alvo format
        if (config.alvo) {
            const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (field === targetField) return true;
            }
        }

        return false;
    }

    // ---- 1. Peculiaridades da raça selecionada ----
    const racaNome = document.getElementById('selRaca')?.value || '';
    if (racaNome && window.RACES && window.RACES[racaNome]) {
        const raca = window.RACES[racaNome];
        for (const pec of raca.peculiaridades) {
            if (!pec.mecanicas) continue;
            for (const mech of pec.mecanicas) {
                if (seenMechIds.has(mech.id)) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mech.id);

                // Se evoluível, ajustar preview ao nível atual
                let previewMech = mech;
                if (mech.evoluivel && mech.progressao) {
                    const dotKey = 'pec_' + (pec.key || pec.id);
                    const currentLevel = state.dots[dotKey] || pec.nivelAtual || 1;
                    const prog = mech.progressao[String(currentLevel)];
                    if (prog) {
                        previewMech = JSON.parse(JSON.stringify(mech));
                        delete previewMech.previewTexto;
                        if (mech.tipo === 'modificar' && prog.valor !== undefined) {
                            previewMech.config = { ...previewMech.config, valor: prog.valor };
                        }
                        // Override fixo terms in equation
                        if (prog.termos && Array.isArray(previewMech.config?.calculos)) {
                            for (const calc of previewMech.config.calculos) {
                                if (Array.isArray(calc.equacao)) {
                                    let fixoIdx = 0;
                                    for (const term of calc.equacao) {
                                        if (term.tipo !== 'ficha') {
                                            const ov = prog.termos[String(fixoIdx)];
                                            if (ov !== undefined && ov !== '') term.valor = ov;
                                            fixoIdx++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(previewMech) : (mech.descricao || '');
                results.push({
                    fonte: `${pec.nome} (${racaNome})`,
                    preview: preview,
                    tipo: 'peculiaridade'
                });
            }
        }
    }

    // ---- 2. Mecânicas dinâmicas de equação (DV/VS com ref à ficha) ----
    for (const mech of _derivedValueMechanicsRaw) {
        if (seenMechIds.has(mech.id)) continue;
        if (!_mechAffectsTarget(mech)) continue;
        seenMechIds.add(mech.id);
        const preview = typeof generatePreviewText === 'function'
            ? generatePreviewText(mech) : (mech.descricao || '');
        results.push({
            fonte: mech.nome || 'Equação Dinâmica',
            preview: preview,
            tipo: 'equacao_dinamica'
        });
    }

    // ---- 3. Mecânicas de distribuição aplicadas ----
    if (state.mecanicasAplicadas) {
        const allMechanics = window._systemData?.mechanics || [];
        for (const [mechId, dados] of Object.entries(state.mecanicasAplicadas)) {
            if (!dados || !dados.alvosEscolhidos) continue;
            for (const alvo of dados.alvosEscolhidos) {
                const field = TARGET_MAP[alvo.nome];
                if (field !== targetField) continue;
                // Encontrar a mecânica original para pegar o nome
                const mech = allMechanics.find(m => m.id === mechId);
                const mechNome = mech?.nome || dados.fonte || 'Distribuição';
                if (seenMechIds.has(mechId + ':dist:' + alvo.nome)) continue;
                seenMechIds.add(mechId + ':dist:' + alvo.nome);
                results.push({
                    fonte: mechNome,
                    preview: `+${alvo.valor} em ${alvo.nome} (distribuído)`,
                    tipo: 'distribuicao'
                });
            }
        }
    }

    // ---- 4. Mecânicas vinculadas a OUTROS Valores Derivados que afetam este alvo ----
    if (window.DERIVED_VALUES) {
        for (const dv of window.DERIVED_VALUES) {
            if (!dv.mecanicaIds || dv.mecanicaIds.length === 0) continue;
            for (const mechId of dv.mecanicaIds) {
                if (seenMechIds.has(mechId)) continue;
                const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                if (!mech) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mechId);
                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(mech) : (mech.descricao || '');
                results.push({
                    fonte: `Vínculo: ${dv.nome}`,
                    preview: preview,
                    tipo: 'vinculo_dv'
                });
            }
        }
    }

    // ---- 5. Mecânicas vinculadas a Status Vitais que afetam este alvo ----
    if (window.VITAL_STATS) {
        for (const vs of window.VITAL_STATS) {
            if (!vs.mecanicaIds || vs.mecanicaIds.length === 0) continue;
            for (const mechId of vs.mecanicaIds) {
                if (seenMechIds.has(mechId)) continue;
                const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                if (!mech) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mechId);
                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(mech) : (mech.descricao || '');
                results.push({
                    fonte: `Vínculo: ${vs.nome}`,
                    preview: preview,
                    tipo: 'vinculo_vs'
                });
            }
        }
    }

    // ---- 6. Mecânicas vinculadas a Perícias que afetam este alvo ----
    if (window.SKILLS) {
        for (const cat of Object.keys(window.SKILLS)) {
            for (const skill of window.SKILLS[cat]) {
                if (!skill.mecanicaIds || skill.mecanicaIds.length === 0) continue;
                for (const mechId of skill.mecanicaIds) {
                    if (seenMechIds.has(mechId)) continue;
                    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                    if (!mech) continue;
                    if (!_mechAffectsTarget(mech)) continue;
                    seenMechIds.add(mechId);
                    const preview = typeof generatePreviewText === 'function'
                        ? generatePreviewText(mech) : (mech.descricao || '');
                    results.push({
                        fonte: `Vínculo: ${skill.name}`,
                        preview: preview,
                        tipo: 'vinculo_skill'
                    });
                }
            }
        }
    }

    return results;
}
