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

    // IDs e valores iniciais de DVs vinculados à raça selecionada
    const raceDVIds = new Set();
    const raceDVInitials = {};  // dvId -> valorInicial
    if (racaNome && window._systemData?.races) {
        const raceData = window._systemData.races.find(r => r.nome === racaNome);
        if (raceData?.derivedValueIds) {
            raceData.derivedValueIds.forEach(item => {
                const isObj = typeof item === 'object' && item !== null;
                const dvId = isObj ? item.id : item;
                raceDVIds.add(dvId);
                if (isObj && item.valorInicial) {
                    raceDVInitials[dvId] = item.valorInicial;
                }
            });
        }
    }

    // IDs de valores derivados vinculados à classe selecionada
    const classDVIds = new Set();
    const classDVInitials = {};  // dvId -> valorInicial
    if (classeNome && window._systemData?.classes) {
        const classData = window._systemData.classes.find(c => c.nome === classeNome);
        if (classData?.derivedValueIds) {
            classData.derivedValueIds.forEach(item => {
                const isObj = typeof item === 'object' && item !== null;
                const dvId = isObj ? item.id : item;
                classDVIds.add(dvId);
                if (isObj && item.valorInicial) {
                    classDVInitials[dvId] = item.valorInicial;
                }
            });
        }
    }

    // Filtrar: universais OU vinculados à raça/classe
    const applicableDVs = allDVs.filter(dv =>
        dv.todoPersonagem || raceDVIds.has(dv.id) || classDVIds.has(dv.id)
    );

    // Guardar mapa de valores iniciais para uso no recalcAll
    window._dvInitialValues = { ...raceDVInitials, ...classDVInitials };

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

        // Input Máximo (calculado)
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `dv_${dv.key}_display`;
        input.className = 'derived-field';
        input.value = '0';

        if (!dv.campoEditavel) {
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
        }

        miniField.appendChild(label);

        // === Campo Atual / Máx ===
        if (dv.campoAtual) {
            const atualRow = document.createElement('div');
            atualRow.className = 'dv-atual-row';

            // Input Atual (editável)
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

            // Separador /
            const sep = document.createElement('span');
            sep.className = 'dv-atual-sep';
            sep.textContent = '/';

            // Máximo é readOnly no modo Atual/Máx
            input.readOnly = true;
            input.classList.add('dv-atual-max');

            // Prefixo antes do row, sufixo depois
            if (dv.prefixo || dv.sufixo) {
                const outerRow = document.createElement('div');
                outerRow.className = 'dv-value-row';
                input.classList.add('dv-input-inline');
                atualInput.classList.add('dv-input-inline');

                if (dv.prefixo) {
                    const prefixSpan = document.createElement('span');
                    prefixSpan.className = 'dv-affix';
                    prefixSpan.textContent = dv.prefixo;
                    outerRow.appendChild(prefixSpan);
                }
                outerRow.appendChild(atualInput);
                outerRow.appendChild(sep);
                outerRow.appendChild(input);
                if (dv.sufixo) {
                    const suffixSpan = document.createElement('span');
                    suffixSpan.className = 'dv-affix';
                    suffixSpan.textContent = dv.sufixo;
                    outerRow.appendChild(suffixSpan);
                }
                miniField.appendChild(outerRow);
            } else {
                atualRow.appendChild(atualInput);
                atualRow.appendChild(sep);
                atualRow.appendChild(input);
                miniField.appendChild(atualRow);
            }
        }
        // === Campo normal (sem Atual) ===
        else {
            const hasPrefixOrSuffix = !!(dv.prefixo || dv.sufixo);
            if (hasPrefixOrSuffix) {
                const valueRow = document.createElement('div');
                valueRow.className = 'dv-value-row';

                if (!dv.campoEditavel && window.isCreator) {
                    valueRow.style.border = '2px solid #f59e0b';
                    input.style.border = 'none';
                }

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
        }

        grid.appendChild(miniField);
    });

    // Setup tooltips after rendering
    initDerivedTooltips();
}

/* ===== TOOLTIPS FLUTUANTES (Valores Derivados + Status Vitais + Perícias) ===== */

let _dvTooltipEl = null;

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
        label.addEventListener('mouseenter', showDvTooltip);
        label.addEventListener('mouseleave', hideDvTooltip);
        label.addEventListener('touchstart', showDvTooltip, { passive: true });
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
        label.addEventListener('mouseenter', showDvTooltip);
        label.addEventListener('mouseleave', hideDvTooltip);
        label.addEventListener('touchstart', showDvTooltip, { passive: true });
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
        nameEl.addEventListener('mouseenter', showDvTooltip);
        nameEl.addEventListener('mouseleave', hideDvTooltip);
        nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
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
                nameEl.addEventListener('mouseenter', showDvTooltip);
                nameEl.addEventListener('mouseleave', hideDvTooltip);
                nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
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
        nameEl.addEventListener('mouseenter', showDvTooltip);
        nameEl.addEventListener('mouseleave', hideDvTooltip);
        nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
    });
}

function showDvTooltip(e) {
    const label = e.currentTarget;
    if (!_dvTooltipEl) return;

    let html = '';
    const tooltipType = label.dataset.tooltipType;

    if (tooltipType === 'vital') {
        // === Status Vital ===
        const key = label.dataset.vitalKey;
        const vs = (window.VITAL_STATS || []).find(v => v.key === key);
        if (!vs) return;
        if (vs.descricao) {
            html += `<div class="dv-tooltip-desc">${_escHtml(vs.descricao)}</div>`;
        }
        // Mecânicas vinculadas
        if (vs.mechPreviews && vs.mechPreviews.length) {
            html += '<div class="dv-tooltip-mechs">';
            html += '<div class="dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:</div>';
            vs.mechPreviews.forEach(preview => {
                html += `<div class="dv-tooltip-mech-item">• ${_escHtml(preview)}</div>`;
            });
            html += '</div>';
        }
        // Buscar TODAS as mecânicas que afetam este vital stat
        // Usar variantes de nome para cobrir aliases no TARGET_MAP
        const propNames = [`${vs.nome} Máxima`, `${vs.nome} Máximo`, vs.nome];
        const linkedIds = vs.mecanicaIds || [];
        let extras = [];
        for (const propName of propNames) {
            const found = typeof getAffectingMechanics === 'function'
                ? getAffectingMechanics(propName, { skipLinked: linkedIds })
                : [];
            for (const f of found) {
                if (!extras.some(e => e.preview === f.preview && e.fonte === f.fonte)) {
                    extras.push(f);
                }
            }
        }
        if (extras.length > 0) {
            html += '<div class="dv-tooltip-mechs dv-tooltip-extras">';
            html += '<div class="dv-tooltip-mechs-title">🔗 Outras fontes que afetam:</div>';
            extras.forEach(item => {
                html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
            });
            html += '</div>';
        }

    } else if (tooltipType === 'attribute') {
        // === Atributo ===
        const attrKey = label.dataset.attrKey;
        const fullName = ATTRIBUTE_FULL_NAMES[attrKey] || attrKey;
        const desc = ATTRIBUTE_DESCRIPTIONS[attrKey];
        if (desc) {
            html += `<div class="dv-tooltip-desc">${_escHtml(desc)}</div>`;
        }
        // Buscar mecânicas que afetam este atributo (por abreviação e nome completo)
        if (typeof getAffectingMechanics === 'function') {
            let extras = [];
            const lookups = [attrKey, fullName];
            for (const propName of lookups) {
                const found = getAffectingMechanics(propName, { skipLinked: [] });
                for (const f of found) {
                    if (!extras.some(e => e.preview === f.preview && e.fonte === f.fonte)) {
                        extras.push(f);
                    }
                }
            }
            if (extras.length > 0) {
                html += '<div class="dv-tooltip-mechs">';
                html += '<div class="dv-tooltip-mechs-title">⚙️ Mecânicas que afetam:</div>';
                extras.forEach(item => {
                    html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
                });
                html += '</div>';
            }
        }

    } else if (tooltipType === 'skill') {
        // === Perícia ===
        const skillName = label.textContent.trim();
        const allSkills = window.SKILLS || {};
        let skill = null;
        for (const cat of Object.values(allSkills)) {
            skill = cat.find(s => s.name === skillName);
            if (skill) break;
        }
        if (!skill) return;
        if (skill.descricao) {
            html += `<div class="dv-tooltip-desc">${_escHtml(skill.descricao)}</div>`;
        }
        // Mecânicas vinculadas à perícia
        const linkedMechIds = skill.mecanicaIds || [];
        if (linkedMechIds.length > 0) {
            const linkedPreviews = linkedMechIds.map(mid => {
                const m = (window._systemData?.mechanics || []).find(m => m.id === mid);
                if (!m) return null;
                return typeof generatePreviewText === 'function'
                    ? generatePreviewText(m) : (m.descricao || '');
            }).filter(Boolean);
            if (linkedPreviews.length > 0) {
                html += '<div class="dv-tooltip-mechs">';
                html += '<div class="dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:</div>';
                linkedPreviews.forEach(preview => {
                    html += `<div class="dv-tooltip-mech-item">• ${_escHtml(preview)}</div>`;
                });
                html += '</div>';
            }
        }
        // Buscar TODAS as mecânicas que afetam esta perícia
        const extras = typeof getAffectingMechanics === 'function'
            ? getAffectingMechanics(skillName, { skipLinked: linkedMechIds })
            : [];
        if (extras.length > 0) {
            html += '<div class="dv-tooltip-mechs dv-tooltip-extras">';
            html += '<div class="dv-tooltip-mechs-title">🔗 Outras fontes que afetam:</div>';
            extras.forEach(item => {
                html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
            });
            html += '</div>';
        }

    } else if (tooltipType === 'peculiaridade') {
        // === Peculiaridade ===
        const pecKey = label.dataset.pecKey;
        const raceKey = label.dataset.raceKey;
        if (typeof buildPeculiarityTooltipHTML === 'function') {
            html = buildPeculiarityTooltipHTML(pecKey, raceKey);
        }

    } else {
        // === Valor Derivado (padrão) ===
        const dvId = label.dataset.dvId;
        const dv = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (!dv) return;
        if (dv.descricao) {
            html += `<div class="dv-tooltip-desc">${_escHtml(dv.descricao)}</div>`;
        }
        // Mecânicas vinculadas
        if (dv.mechPreviews && dv.mechPreviews.length) {
            html += '<div class="dv-tooltip-mechs">';
            html += '<div class="dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:</div>';
            dv.mechPreviews.forEach(preview => {
                html += `<div class="dv-tooltip-mech-item">• ${_escHtml(preview)}</div>`;
            });
            html += '</div>';
        }
        // Buscar TODAS as mecânicas que afetam este DV
        const linkedIds = dv.mecanicaIds || [];
        // Tentar com nome e variantes (com/sem sufixos Máxima/Máximo)
        const propNames = [dv.nome, `${dv.nome} (Máximo)`, `${dv.nome} Máxima`, `${dv.nome} Máximo`];
        let extras = [];
        for (const propName of propNames) {
            const found = typeof getAffectingMechanics === 'function'
                ? getAffectingMechanics(propName, { skipLinked: linkedIds })
                : [];
            for (const f of found) {
                if (!extras.some(e => e.preview === f.preview && e.fonte === f.fonte)) {
                    extras.push(f);
                }
            }
        }
        if (extras.length > 0) {
            html += '<div class="dv-tooltip-mechs dv-tooltip-extras">';
            html += '<div class="dv-tooltip-mechs-title">🔗 Outras fontes que afetam:</div>';
            extras.forEach(item => {
                html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
            });
            html += '</div>';
        }
    }

    if (!html) {
        // Mesmo sem mecânicas vinculadas, verificar fontes externas
        // para habilitar tooltip quando só há fontes externas
        return;
    }

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

/* ===== RECALC ALL — Status Vitais (mecânicas) + Dinâmicos (Firebase) ===== */

function recalcAll() {
    // Re-avaliar equações de mecânicas de valores derivados com valores atuais
    // Algumas mecânicas vinculadas a DVs usam equações com referências à ficha
    // (atributos, perícias) e precisam ser recalculadas a cada chamada de recalcAll
    if (typeof resolveDerivedValueMechanicsLive === 'function'
        && typeof _getDynamicMechContributions === 'function') {
        // Subtrair APENAS as contribuições dinâmicas anteriores (equações com ref à ficha),
        // preservando bônus de outras fontes (ex: peculiaridades raciais, mecânicas fixas)
        const prevContributions = _getDynamicMechContributions();
        const bonuses = state.mechanicBonuses || {};
        for (const [key, contribution] of Object.entries(prevContributions)) {
            if (key.startsWith('SET:') || key.startsWith('MULT:') || key.startsWith('DIV:')) {
                // Para SET/MULT/DIV, remover a chave inteira (são overrides, não somas)
                delete bonuses[key];
            } else {
                // Para + e -, subtrair a contribuição anterior
                bonuses[key] = (bonuses[key] || 0) - contribution;
            }
        }
        // Re-resolver equações dinâmicas com valores atuais de state.dots
        resolveDerivedValueMechanicsLive();
    }

    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    // 1) Calcular Status Vitais (via mecânicas do Firebase — base 0)
    for (const [key, mapping] of Object.entries(DERIVED_FIELDS_MAP)) {
        // Se este key está renderizado na grid dinâmica, pular
        if (_dynamicDerivedKeys.has(key)) continue;

        let value = 0; // Base 0 — mecânicas definem o cálculo
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

        // Usar valorInicial de raça/classe como base (se definido)
        const initials = window._dvInitialValues || {};
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.key === dvKey);
        if (dvDef && initials[dvDef.id]) {
            value = initials[dvDef.id];
        }

        value = _applyMechanicModifiers(dvKey, value, bonuses, limits);

        // Atualizar campo na grid dinâmica
        const displayEl = document.getElementById(`dv_${dvKey}_display`);
        if (displayEl) {
            displayEl.value = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
        }

        // Se DV tem campoAtual, atualizar o atributo max (informativo) — sem clampar o valor atual.
        // O valor digitado pelo jogador é preservado.
        // Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
        if (dvDef && dvDef.campoAtual) {
            const atualEl = document.getElementById(`dv_${dvKey}_atual`);
            if (atualEl) {
                atualEl.max = value;
            }
        }

        // Atualizar também o campo hardcoded, se existir (ex: ENER_MAX)
        if (DERIVED_FIELDS_MAP[dvKey]) {
            updateDerivedField(dvKey, value);
        }

        // Guardar em state.derived para referências cruzadas
        if (!state.derived) state.derived = {};
        state.derived[dvKey] = value;
    }

    // 3) Aplicar limites em atributos e perícias (teto trunca state.dots)
    for (const [field, limit] of Object.entries(limits)) {
        if (field.startsWith('attr_') || field.startsWith('sk_')) {
            if (limit.tipo === 'bloqueio') {
                // Bloqueio: force to 0
                if ((state.dots[field] || 0) > 0) {
                    state.dots[field] = 0;
                    const dotsEl = document.querySelector(`.dots5[data-attr="${field}"]`);
                    if (dotsEl && typeof refreshDots === 'function') refreshDots(dotsEl, field);
                }
            } else if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) {
                // Teto: cap state.dots at (max - floor - bonus) so effective doesn't exceed max
                const floorBonus = ((limit.tipo === 'clamp') && limit.min != null) ? limit.min : 0;
                const mechBonus = state.mechanicBonuses?.[field] || 0;
                const rawCap = limit.max - floorBonus - mechBonus;
                const currentVal = state.dots[field] || 0;
                if (currentVal > Math.max(0, rawCap)) {
                    state.dots[field] = Math.max(0, rawCap);
                    const dotsEl = document.querySelector(`.dots5[data-attr="${field}"]`);
                    if (dotsEl && typeof refreshDots === 'function') refreshDots(dotsEl, field);
                }
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
    const limits = state.mechanicLimits || {};

    // Collect all dotKeys that need processing (bonuses + limits)
    const allKeys = new Set();
    for (const key of Object.keys(bonuses)) {
        if (key.startsWith('sk_') || key.startsWith('attr_')) allKeys.add(key);
    }
    for (const key of Object.keys(limits)) {
        if (key.startsWith('sk_') || key.startsWith('attr_')) allKeys.add(key);
    }

    // Also process ALL dot containers to clear stale visual states
    document.querySelectorAll('.dots5[data-attr]').forEach(c => {
        allKeys.add(c.dataset.attr);
    });

    for (const key of allKeys) {
        const container = document.querySelector(`.dots5[data-attr="${key}"]`);
        if (!container) continue;

        const baseVal = state.dots[key] || 0;
        const bonus = bonuses[key] || 0;
        const limit = limits[key];

        // Calculate floor and ceiling
        let floorVal = 0;
        let ceiling = 5;
        if (limit) {
            if (limit.tipo === 'bloqueio') {
                ceiling = 0;
                floorVal = 0;
            } else {
                if ((limit.tipo === 'minimo' || limit.tipo === 'clamp') && limit.min != null) {
                    floorVal = limit.min;
                }
                if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) {
                    ceiling = limit.max;
                }
            }
        }

        // === AURA SYSTEM: check for aura on this dotKey ===
        const auraInfo = typeof getAuraInfoForDot === 'function' ? getAuraInfoForDot(key) : null;
        const baseDots = typeof getPropertyBaseDots === 'function' ? getPropertyBaseDots(key) : ceiling;

        if (auraInfo && auraInfo.grauDesbloqueado > 0) {
            // Aura active: use grade-cycling visual
            const auraCeiling = (auraInfo.grauDesbloqueado + 1) * baseDots;
            const totalLevel = baseVal + floorVal + bonus;
            const clampedLevel = Math.min(totalLevel, auraCeiling);
            const currentGrade = clampedLevel > 0 ? Math.floor((clampedLevel - 1) / baseDots) : 0;
            const posInGrade = clampedLevel > 0 ? ((clampedLevel - 1) % baseDots) + 1 : 0;
            const auraColor = typeof getAuraColorForGrade === 'function' ? getAuraColorForGrade(auraInfo.aura, currentGrade) : null;

            container.querySelectorAll('.dot').forEach(d => {
                const val = +d.dataset.val;
                d.classList.remove('filled', 'bonus', 'floor', 'capped', 'aura-filled');
                d.style.removeProperty('--aura-color');

                if (val > baseDots) {
                    d.classList.add('capped');
                    return;
                }

                if (val <= posInGrade) {
                    d.classList.add('filled');
                    if (auraColor) {
                        d.classList.add('aura-filled');
                        d.style.setProperty('--aura-color', auraColor);
                    }
                }
            });

            // Update grade indicator
            if (typeof _updateGradeIndicator === 'function') {
                _updateGradeIndicator(container, key, currentGrade, auraInfo, baseDots, clampedLevel);
            }
        } else {
            // Standard (non-aura) visual
            // Apply ceiling visual: hide dots above ceiling
            container.querySelectorAll('.dot').forEach(d => {
                const val = +d.dataset.val;
                d.classList.remove('filled', 'bonus', 'floor', 'capped', 'aura-filled');
                d.style.removeProperty('--aura-color');

                if (val > ceiling) {
                    d.classList.add('capped');
                    return;
                }

                if (val <= floorVal) {
                    d.classList.add('filled', 'floor');
                } else if (val <= floorVal + baseVal) {
                    d.classList.add('filled');
                } else if (val <= floorVal + baseVal + bonus) {
                    d.classList.add('filled', 'bonus');
                }
            });
        }
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
            // Sem clamp automático: o valor digitado pelo jogador é preservado.
            // Mecânicas do tipo "limitar" (teto/piso) tratam limites quando necessário.
        }
    }

    // Guardar em state.derived
    if (!state.derived) state.derived = {};
    state.derived[key] = value;
}

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
    if (state.dvAtual) {
        for (const [dvKey, val] of Object.entries(state.dvAtual)) {
            const atualEl = document.getElementById(`dv_${dvKey}_atual`);
            if (atualEl && val !== undefined && val !== '') {
                atualEl.value = val;
            }
        }
    }
}
