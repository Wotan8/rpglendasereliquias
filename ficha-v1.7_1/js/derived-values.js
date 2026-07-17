/* ===== DERIVED VALUES â€” CÃ¡lculo AutomÃ¡tico de Valores Derivados ===== */

/* ===== FÃ“RMULAS DE STATUS VITAIS =====
 * Status Vitais (VIT_MAX, ENER_MAX, SAN_MAX) agora sÃ£o gerenciados
 * exclusivamente por mecÃ¢nicas do Painel de Criador (Firebase).
 * As fÃ³rmulas hardcoded foram removidas.
 * O campo base comeÃ§a em 0 e as mecÃ¢nicas vinculadas definem o cÃ¡lculo.
 */
const DERIVED_FORMULAS = {
    // Vazio â€” gerenciado por mecÃ¢nicas do Firebase
};

/* Mapa: campo de Status Vital â†’ { display, atual }
 * Mapeia as keys (VIT_MAX, ENER_MAX, SAN_MAX) para os IDs
 * dos campos HTML fixos na seÃ§Ã£o Status Vitais.
 * As fÃ³rmulas sÃ£o definidas por mecÃ¢nicas do Firebase.
 */
const DERIVED_FIELDS_MAP = {
    VIT_MAX: { display: 'vit_max_display', atual: 'vit_atual' },
    ENER_MAX: { display: 'ener_max_display', atual: 'ener_atual' },
    SAN_MAX: { display: 'san_max_display', atual: 'san_atual' },
};

/* ===== KEYS de derivados que sÃ£o renderizados dinamicamente na grid ===== */
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
        // Teto: hard cap â€” but if aura extends ceiling, use aura max instead
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
 * Filtra por: todoPersonagem=true OU vinculado Ã  raÃ§a/classe selecionada.
 */
function renderDerivedValuesGrid() {
    const grid = document.getElementById('derivedValuesGrid');
    if (!grid) return;

    const allDVs = window.DERIVED_VALUES || [];
    if (allDVs.length === 0) {
        // Fallback: se nÃ£o hÃ¡ valores no Firebase, nÃ£o renderizar nada
        grid.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">Nenhum valor derivado cadastrado.</div>';
        _dynamicDerivedKeys = new Set();
        return;
    }

    // Determinar quais DVs sÃ£o aplicÃ¡veis ao personagem
    const racaNome = document.getElementById('selRaca')?.value || '';
    const classeNome = document.getElementById('selClasse')?.value || '';

    // IDs e valores iniciais de DVs vinculados Ã  raÃ§a selecionada
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

    // IDs de valores derivados vinculados Ã  classe selecionada
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

    // IDs de valores derivados vinculados Ã s peculiaridades ativas
    const pecDVIds = new Set();
    const pecDVInitials = {};
    const processPecDV = (pecList) => {
        if (!pecList) return;
        pecList.forEach(pecObj => {
            let pecData = null;
            if (typeof _resolvePeculiaridade === 'function') {
                pecData = _resolvePeculiaridade(pecObj);
            } else {
                const pId = typeof pecObj === 'object' ? pecObj.id : pecObj;
                pecData = (window._systemData?.peculiarities || []).find(p => p.id === pId);
            }
            if (pecData?.derivedValueIds) {
                pecData.derivedValueIds.forEach(item => {
                    const isObj = typeof item === 'object' && item !== null;
                    const dvId = isObj ? item.id : item;
                    pecDVIds.add(dvId);
                    if (isObj && item.valorInicial) {
                        pecDVInitials[dvId] = item.valorInicial;
                    }
                });
            }
        });
    };

    if (racaNome && window.RACES?.[racaNome]?.peculiaridades) {
        processPecDV(window.RACES[racaNome].peculiaridades);
    }
    if (classeNome && window.CLASSES?.[classeNome]?.peculiaridades) {
        processPecDV(window.CLASSES[classeNome].peculiaridades);
    }
    const triboNome = document.getElementById('selTribo')?.value || '';
    if (triboNome && window.TRIBES?.[triboNome]?.peculiaridades) {
        processPecDV(window.TRIBES[triboNome].peculiaridades);
    }
    if (window.state?.peculiaridadesIndividuais) {
        processPecDV(window.state.peculiaridadesIndividuais);
    }

    // Filtrar: universais OU vinculados Ã  raÃ§a/classe/peculiaridades
    const applicableDVs = allDVs.filter(dv =>
        dv.todoPersonagem || raceDVIds.has(dv.id) || classDVIds.has(dv.id) || pecDVIds.has(dv.id)
    );

    // Guardar mapa de valores iniciais para uso no recalcAll
    window._dvInitialValues = { ...raceDVInitials, ...classDVInitials, ...pecDVInitials };

    // Ordenar por ordem
    applicableDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    // Rastrear keys dinÃ¢micos
    _dynamicDerivedKeys = new Set(applicableDVs.map(dv => dv.key));

    // Renderizar grid
    grid.innerHTML = '';

    // Agrupar por Blocos
    const blocksMap = new Map();

    applicableDVs.forEach(dv => {
        const bId = dv.blocoId || 'geral';
        if (!blocksMap.has(bId)) {
            blocksMap.set(bId, {
                id: bId,
                nome: dv.blocoNome || (bId === 'geral' ? 'Geral' : bId),
                ordem: (dv.blocoOrdem !== undefined && dv.blocoOrdem !== '') ? Number(dv.blocoOrdem) : 999,
                dvs: []
            });
        }
        blocksMap.get(bId).dvs.push(dv);
    });

    const blocksArray = Array.from(blocksMap.values());
    blocksArray.sort((a, b) => {
        if (a.id === 'geral') return 1;
        if (b.id === 'geral') return -1;
        return a.ordem - b.ordem;
    });

    blocksArray.forEach(block => {
        const blockContainer = document.createElement('div');
        blockContainer.className = 'dv-block-container';
        blockContainer.style.marginBottom = '16px';

        if (block.nome) {
            const titleEl = document.createElement('div');
            titleEl.className = 'attr-block-title';
            titleEl.style.marginBottom = '8px';
            titleEl.textContent = block.nome;
            blockContainer.appendChild(titleEl);
        }

        const blockGrid = document.createElement('div');
        blockGrid.className = 'combat-grid';

        block.dvs.forEach(dv => {
            const miniField = document.createElement('div');
        miniField.className = 'mini-field';
        miniField.dataset.dvId = dv.id;
        miniField.dataset.dvKey = dv.key;

        // Label com Ã­cone + nome curto
        const label = document.createElement('label');
        label.className = 'dv-label';
        if (dv.descricao || (dv.mechPreviews && dv.mechPreviews.length)) {
            label.classList.add('has-tooltip');
        }
        label.textContent = `${dv.icone} ${dv.nome}`;
        label.dataset.dvId = dv.id;

        // Input MÃ¡ximo (calculado)
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `dv_${dv.key}_display`;
        input.className = 'derived-field';
        input.value = '0';

        if (!dv.campoEditavel) {
            if (window.isCreator) {
                input.style.border = '2px solid #f59e0b';
                input.title = 'ðŸ›¡ï¸ Modo Criador: ediÃ§Ã£o livre';
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

        // === Campo Atual / MÃ¡x ===
        if (dv.campoAtual) {
            const atualRow = document.createElement('div');
            atualRow.className = 'dv-atual-row';

            // Input Atual (editÃ¡vel)
            const atualInput = document.createElement('input');
            atualInput.type = 'text';
            atualInput.id = `dv_${dv.key}_atual`;
            atualInput.dataset.key = `dv_${dv.key}_atual`;
            atualInput.className = 'dv-atual-input';
            atualInput.placeholder = '0';
            atualInput.value = '0';
            atualInput.addEventListener('input', () => {
                if (!state.dvAtual) state.dvAtual = {};
                // Sem clamp automÃ¡tico: o valor digitado pelo jogador Ã© preservado.
                // MecÃ¢nicas do tipo "limitar" (teto/piso) tratam limites quando necessÃ¡rio.
                state.dvAtual[dv.key] = atualInput.value;
                if (typeof scheduleAutosave === 'function') scheduleAutosave();
            });

            // Separador /
            const sep = document.createElement('span');
            sep.className = 'dv-atual-sep';
            sep.textContent = '/';

            // MÃ¡ximo Ã© readOnly no modo Atual/MÃ¡x
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

        blockGrid.appendChild(miniField);
        });

        blockContainer.appendChild(blockGrid);
        grid.appendChild(blockContainer);
    });

    // Limpar cache de bÃ´nus para campos "Atual" recriados, forÃ§ando
    // _applyFieldBonuses() a re-aplicar os bÃ´nus de mecÃ¢nica.
    // Sem isso, o sistema vÃª que previousBonus === bonus e pula a
    // atualizaÃ§Ã£o do DOM, deixando o campo em '0'.
    if (state.appliedFieldBonuses || state.fieldBaseValues) {
        for (const dvKey of _dynamicDerivedKeys) {
            const dataKey = `dv_${dvKey}_atual`;
            if (state.appliedFieldBonuses) delete state.appliedFieldBonuses[dataKey];
            if (state.fieldBaseValues) delete state.fieldBaseValues[dataKey];
        }
    }

    // Restaurar valores de state.dvAtual nos campos "Atual" recÃ©m-criados
    if (state.dvAtual) {
        for (const [dvKey, val] of Object.entries(state.dvAtual)) {
            const atualEl = document.getElementById(`dv_${dvKey}_atual`);
            if (atualEl && val !== undefined && val !== '') {
                atualEl.value = val;
            }
        }
    }

    // Setup tooltips after rendering
    initDerivedTooltips();
}

/* ===== TOOLTIPS FLUTUANTES (Valores Derivados + Status Vitais + PerÃ­cias) ===== */

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
        label.addEventListener('touchend', hideDvTooltip);
    });
}

/**
 * Inicializa tooltips nos labels de Status Vitais.
 * Chamada apÃ³s VITAL_STATS ser carregado do Firebase.
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

        // Verificar conteÃºdo direto
        let hasContent = vs.descricao || (vs.mechPreviews && vs.mechPreviews.length);

        // Verificar mecÃ¢nicas externas que afetam este vital stat
        if (!hasContent && typeof getAffectingMechanics === 'function') {
            const linkedIds = vs.mecanicaIds || [];
            const propNames = [`${vs.nome} MÃ¡xima`, `${vs.nome} MÃ¡ximo`, vs.nome];
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
        label.addEventListener('touchend', hideDvTooltip);
    });
}

/**
 * Inicializa tooltips flutuantes nos nomes das PerÃ­cias.
 * Chamada apÃ³s SKILLS ser carregado do Firebase e renderizado via initSkills().
 */
function initSkillTooltips() {
    _ensureTooltipEl();

    // Bind em skills que jÃ¡ tÃªm has-tooltip (via descriÃ§Ã£o)
    document.querySelectorAll('.sk-name.has-tooltip').forEach(nameEl => {
        if (nameEl.dataset.tooltipBound) return;
        nameEl.dataset.tooltipBound = '1';
        nameEl.dataset.tooltipType = 'skill';
        nameEl.addEventListener('mouseenter', showDvTooltip);
        nameEl.addEventListener('mouseleave', hideDvTooltip);
        nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
        nameEl.addEventListener('touchend', hideDvTooltip);
    });

    // Verificar skills SEM has-tooltip mas que sÃ£o afetadas por mecÃ¢nicas externas
    if (typeof getAffectingMechanics === 'function') {
        document.querySelectorAll('.sk-name:not(.has-tooltip)').forEach(nameEl => {
            if (nameEl.dataset.tooltipBound) return;
            const skillName = nameEl.textContent.trim();
            // Verificar se hÃ¡ mecÃ¢nicas afetando esta perÃ­cia
            const extras = getAffectingMechanics(skillName, { skipLinked: [] });
            if (extras.length > 0) {
                nameEl.classList.add('has-tooltip');
                nameEl.dataset.tooltipBound = '1';
                nameEl.dataset.tooltipType = 'skill';
                nameEl.addEventListener('mouseenter', showDvTooltip);
                nameEl.addEventListener('mouseleave', hideDvTooltip);
                nameEl.addEventListener('touchstart', showDvTooltip, { passive: true });
                nameEl.addEventListener('touchend', hideDvTooltip);
            }
        });
    }
}

/* ===== HARDCODED ATTRIBUTE DESCRIPTIONS ===== */
const ATTRIBUTE_DESCRIPTIONS = {
    INT: 'Representa a sabedoria, memÃ³ria e conhecimento acumulado do personagem. Ã‰ o quanto ele sabe e o quÃ£o esperto ele Ã©.',
    RAC: 'Velocidade de pensamento, percepÃ§Ã£o e capacidade de reagir mentalmente. Ã‰ a agilidade da mente, o "pensar rÃ¡pido".',
    PRS: 'ForÃ§a de vontade prolongada, resistÃªncia mental e foco sob pressÃ£o. Ã‰ o que impede o personagem de desistir quando tudo parece perdido.',
    FOR: 'PotÃªncia muscular, capacidade de carga e poder de dano corpo-a-corpo. Determina o quanto o personagem consegue carregar, empurrar e golpear.',
    DES: 'Agilidade, coordenaÃ§Ã£o motora e precisÃ£o de movimentos. Governa reflexos, equilÃ­brio e a capacidade de realizar aÃ§Ãµes que exigem fineza fÃ­sica.',
    VIG: 'ResistÃªncia fÃ­sica, saÃºde e capacidade de suportar dano. Ã‰ o que mantÃ©m o personagem de pÃ© apÃ³s levar uma surra ou correr por horas.',
    PRE: 'Magnetismo pessoal, capacidade de impressionar e intimidar. Ã‰ aquela forÃ§a invisÃ­vel que faz as pessoas prestarem atenÃ§Ã£o quando o personagem entra numa sala.',
    MAN: 'Habilidade de influenciar, persuadir e enganar outros. Ã‰ a arte de fazer as pessoas fazerem o que vocÃª quer, muitas vezes sem que percebam.',
    AUT: 'DomÃ­nio sobre as prÃ³prias emoÃ§Ãµes e calma sob pressÃ£o. Ã‰ o que separa quem age racionalmente de quem Ã© dominado pelo medo ou pela raiva no calor do momento.',
};

const ATTRIBUTE_FULL_NAMES = {
    INT: 'InteligÃªncia',
    RAC: 'RaciocÃ­nio',
    PRS: 'PerseveranÃ§a',
    FOR: 'ForÃ§a',
    DES: 'Destreza',
    VIG: 'Vigor',
    PRE: 'PresenÃ§a',
    MAN: 'ManipulaÃ§Ã£o',
    AUT: 'Autocontrole',
};

/**
 * Inicializa tooltips flutuantes nos nomes dos Atributos.
 * Chamada apÃ³s o carregamento dos dados do Firebase.
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
        nameEl.addEventListener('touchend', hideDvTooltip);
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
        // MecÃ¢nicas vinculadas
        if (vs.mechPreviews && vs.mechPreviews.length) {
            html += '<div class="dv-tooltip-mechs">';
            html += '<div class="dv-tooltip-mechs-title">âš™ï¸ MecÃ¢nicas Vinculadas:</div>';
            vs.mechPreviews.forEach(preview => {
                html += `<div class="dv-tooltip-mech-item">â€¢ ${_escHtml(preview)}</div>`;
            });
            html += '</div>';
        }
        // Buscar TODAS as mecÃ¢nicas que afetam este vital stat
        // Usar variantes de nome para cobrir aliases no TARGET_MAP
        const propNames = [`${vs.nome} MÃ¡xima`, `${vs.nome} MÃ¡ximo`, vs.nome];
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
            html += '<div class="dv-tooltip-mechs-title">ðŸ”— Outras fontes que afetam:</div>';
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
        // Buscar mecÃ¢nicas que afetam este atributo (por abreviaÃ§Ã£o e nome completo)
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
                html += '<div class="dv-tooltip-mechs-title">âš™ï¸ MecÃ¢nicas que afetam:</div>';
                extras.forEach(item => {
                    html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
                });
                html += '</div>';
            }
        }

    } else if (tooltipType === 'skill') {
        // === PerÃ­cia ===
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
        // MecÃ¢nicas vinculadas Ã  perÃ­cia
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
                html += '<div class="dv-tooltip-mechs-title">âš™ï¸ MecÃ¢nicas Vinculadas:</div>';
                linkedPreviews.forEach(preview => {
                    html += `<div class="dv-tooltip-mech-item">â€¢ ${_escHtml(preview)}</div>`;
                });
                html += '</div>';
            }
        }
        // Buscar TODAS as mecÃ¢nicas que afetam esta perÃ­cia
        const extras = typeof getAffectingMechanics === 'function'
            ? getAffectingMechanics(skillName, { skipLinked: linkedMechIds })
            : [];
        if (extras.length > 0) {
            html += '<div class="dv-tooltip-mechs dv-tooltip-extras">';
            html += '<div class="dv-tooltip-mechs-title">ðŸ”— Outras fontes que afetam:</div>';
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
        // === Valor Derivado (padrÃ£o) ===
        const dvId = label.dataset.dvId;
        const dv = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (!dv) return;
        if (dv.descricao) {
            html += `<div class="dv-tooltip-desc">${_escHtml(dv.descricao)}</div>`;
        }
        // Constante de CriaÃ§Ã£o (modificador definido no slider da VÃ©spera da Partida)
        const creationMod = state.derivedModifiers?.[dvId];
        if (creationMod && creationMod !== 0) {
            const sign = creationMod > 0 ? '+' : '';
            const fmtMod = Number.isInteger(creationMod) ? String(creationMod) : creationMod.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
            html += `<div class="dv-tooltip-creation-const">ðŸŽ¯ Constante de CriaÃ§Ã£o: <span class="dv-tooltip-creation-val">${sign}${fmtMod}</span></div>`;
        }
        // MecÃ¢nicas vinculadas
        if (dv.mechPreviews && dv.mechPreviews.length) {
            html += '<div class="dv-tooltip-mechs">';
            html += '<div class="dv-tooltip-mechs-title">âš™ï¸ MecÃ¢nicas Vinculadas:</div>';
            dv.mechPreviews.forEach(preview => {
                html += `<div class="dv-tooltip-mech-item">â€¢ ${_escHtml(preview)}</div>`;
            });
            html += '</div>';
        }
        // Buscar TODAS as mecÃ¢nicas que afetam este DV
        const linkedIds = dv.mecanicaIds || [];
        // Tentar com nome e variantes (com/sem sufixos MÃ¡xima/MÃ¡ximo)
        const propNames = [dv.nome, `${dv.nome} (MÃ¡ximo)`, `${dv.nome} MÃ¡xima`, `${dv.nome} MÃ¡ximo`];
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
            html += '<div class="dv-tooltip-mechs-title">ðŸ”— Outras fontes que afetam:</div>';
            extras.forEach(item => {
                html += `<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">${_escHtml(item.fonte)}:</span> ${_escHtml(item.preview)}</div>`;
            });
            html += '</div>';
        }
    }

    if (!html) {
        // Mesmo sem mecÃ¢nicas vinculadas, verificar fontes externas
        // para habilitar tooltip quando sÃ³ hÃ¡ fontes externas
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

/* ===== RECALC ALL â€” Status Vitais (mecÃ¢nicas) + DinÃ¢micos (Firebase) ===== */

function recalcAll() {
    // Re-avaliar equaÃ§Ãµes de mecÃ¢nicas de valores derivados com valores atuais
    // Algumas mecÃ¢nicas vinculadas a DVs usam equaÃ§Ãµes com referÃªncias Ã  ficha
    // (atributos, perÃ­cias) e precisam ser recalculadas a cada chamada de recalcAll
    if (typeof resolveDerivedValueMechanicsLive === 'function'
        && typeof _getDynamicMechContributions === 'function') {
        // Subtrair APENAS as contribuiÃ§Ãµes dinÃ¢micas anteriores (equaÃ§Ãµes com ref Ã  ficha),
        // preservando bÃ´nus de outras fontes (ex: peculiaridades raciais, mecÃ¢nicas fixas)
        const prevContributions = _getDynamicMechContributions();
        const bonuses = state.mechanicBonuses || {};
        for (const [key, contribution] of Object.entries(prevContributions)) {
            if (key.startsWith('SET:') || key.startsWith('BASE_SET:')) {
                // Para SET, remover a chave inteira (sÃ£o overrides absolutos)
                delete bonuses[key];
            } else if (key.startsWith('MULT:') || key.startsWith('DIV:') || key.startsWith('BASE_MULT:') || key.startsWith('BASE_DIV:')) {
                // Para MULT e DIV dinÃ¢micos, desfazer dividindo pela contribuiÃ§Ã£o anterior
                if (contribution && contribution !== 0) {
                    bonuses[key] = (bonuses[key] || 1) / contribution;
                } else {
                    delete bonuses[key];
                }
            } else {
                // Para + e -, subtrair a contribuiÃ§Ã£o anterior
                bonuses[key] = (bonuses[key] || 0) - contribution;
            }
        }
        // Re-resolver equaÃ§Ãµes dinÃ¢micas com valores atuais de state.dots
        resolveDerivedValueMechanicsLive();
    }

    const bonuses = state.mechanicBonuses || {};
    const limits = state.mechanicLimits || {};

    // 1) Calcular Status Vitais (via mecÃ¢nicas do Firebase â€” base 0)
    for (const [key, mapping] of Object.entries(DERIVED_FIELDS_MAP)) {
        // Se este key estÃ¡ renderizado na grid dinÃ¢mica, pular
        if (_dynamicDerivedKeys.has(key)) continue;

        let value = 0; // Base 0 â€” mecÃ¢nicas definem o cÃ¡lculo
        value = _applyMechanicModifiers(key, value, bonuses, limits);
        updateDerivedField(key, value);
    }

    // 2) Calcular valores derivados dinÃ¢micos (Firebase-driven)
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
        let initialConstant = 0;

        // Usar valorInicial de raÃ§a/classe como constante (se definido)
        const initials = window._dvInitialValues || {};
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.key === dvKey);
        if (dvDef && initials[dvDef.id]) {
            initialConstant = initials[dvDef.id];
        }

        // Aplicar mecÃ¢nicas (bÃ´nus, penalidades, equaÃ§Ãµes, multiplicadores)
        value = _applyMechanicModifiers(dvKey, value, bonuses, limits);

        // Aplicar constante inicial (RaÃ§a/Classe/Tribo)
        value += initialConstant;

        // Aplicar modificador constante da VÃ©spera da Partida (Criar Personagem) SEMPRE apÃ³s as mecÃ¢nicas
        if (dvDef && state.derivedModifiers && state.derivedModifiers[dvDef.id]) {
            value += state.derivedModifiers[dvDef.id];
        }

        // Atualizar campo na grid dinÃ¢mica
        const displayEl = document.getElementById(`dv_${dvKey}_display`);
        if (displayEl) {
            displayEl.value = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
        }

        // Se DV tem campoAtual, atualizar o atributo max (informativo) â€” sem clampar o valor atual.
        // O valor digitado pelo jogador Ã© preservado.
        // MecÃ¢nicas do tipo "limitar" (teto/piso) tratam limites quando necessÃ¡rio.
        if (dvDef && dvDef.campoAtual) {
            const atualEl = document.getElementById(`dv_${dvKey}_atual`);
            if (atualEl) {
                atualEl.max = value;
            }
        }

        // Atualizar tambÃ©m o campo hardcoded, se existir (ex: ENER_MAX)
        if (DERIVED_FIELDS_MAP[dvKey]) {
            updateDerivedField(dvKey, value);
        }

        // Guardar em state.derived para referÃªncias cruzadas
        if (!state.derived) state.derived = {};
        state.derived[dvKey] = value;
    }

    // 3) Aplicar limites em atributos e perÃ­cias (teto trunca state.dots)
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

    // 4) Aplicar bÃ´nus de mecÃ¢nicas em campos DOM (field:xxx, ex: blindagem, tamanho)
    _applyFieldBonuses(bonuses);

    // 5) Aplicar bÃ´nus visuais nos dots
    applyMechanicBonusesToDots();

    // 6) Sincronizar componentes reativos dos mÃ³dulos de classe (VD)
    if (typeof syncModuleDerivedValuesUI === 'function') syncModuleDerivedValuesUI();
}

/**
 * Aplica modificadores de mecÃ¢nicas (bÃ´nus, mult, div, set, limites) a um valor derivado.
 */
function _applyMechanicModifiers(key, value, bonuses, limits) {
    const bonusKey = `DERIVED:${key}`;

    // === 1. AVALIAR MECÃ‚NICAS BASE (Vinculadas) ===
    const baseSetKey = `BASE_SET:${bonusKey}`;
    if (bonuses[baseSetKey] !== undefined) {
        value = bonuses[baseSetKey];
    }

    const baseAddKey = `BASE:${bonusKey}`;
    value += (bonuses[baseAddKey] || 0);

    const baseMultKey = `BASE_MULT:${bonusKey}`;
    if (bonuses[baseMultKey]) {
        value = Math.floor(value * bonuses[baseMultKey]);
    }

    const baseDivKey = `BASE_DIV:${bonusKey}`;
    if (bonuses[baseDivKey] && bonuses[baseDivKey] !== 0) {
        value = Math.floor(value / bonuses[baseDivKey]);
    }

    // === 2. AVALIAR MODIFICADORES GERAIS (Peculiaridades, Itens, CondiÃ§Ãµes) ===
    // "Definir fixo" (=) â€” overrides the base formula entirely
    const setKey = `SET:${bonusKey}`;
    if (bonuses[setKey] !== undefined) {
        value = bonuses[setKey];
    }

    value += (bonuses[bonusKey] || 0);

    // Multiplicadores de mecÃ¢nicas
    const multKey = `MULT:${bonusKey}`;
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
 * Aplica bÃ´nus de mecÃ¢nicas em campos DOM (field:xxx).
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

    // Resetar campos sem bÃ´nus
    document.querySelectorAll('[data-mechanic-field-bonus]').forEach(el => {
        const dk = el.dataset.key;
        if (!dk || fieldBonuses[dk] !== undefined || fieldSets[dk] !== undefined) return;
        if (state.fieldBaseValues[dk] !== undefined) {
            el.value = state.fieldBaseValues[dk];
        }
        el.removeAttribute('data-mechanic-field-bonus');
        delete state.appliedFieldBonuses[dk];
    });

    // Aplicar bÃ´nus atuais
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
 * Aplica visualmente os bÃ´nus de mecÃ¢nicas (sk_* e attr_*) nos dots.
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
            // Sem clamp automÃ¡tico: o valor digitado pelo jogador Ã© preservado.
            // MecÃ¢nicas do tipo "limitar" (teto/piso) tratam limites quando necessÃ¡rio.
        }
    }

    // Guardar em state.derived
    if (!state.derived) state.derived = {};
    state.derived[key] = value;
}

/* ValidaÃ§Ã£o: ATUAL â€” sem clamp automÃ¡tico.
 * O valor digitado pelo jogador Ã© preservado como estÃ¡.
 * MecÃ¢nicas do tipo "limitar" (teto/piso) tratam limites quando necessÃ¡rio.
 */
function validateAtualField(atualKey, maxDisplayId) {
    // No-op: removido clamp hardcoded para permitir que o jogador
    // defina qualquer valor no campo atual.
}

/* Inicializar listeners e renderizar grid dinÃ¢mica */
function initDerivedListeners() {
    // ValidaÃ§Ã£o de campos ATUAL â‰¤ MAX (Status Vitais â€” mecÃ¢nicas do Firebase)
    validateAtualField('vit_atual', 'vit_max_display');
    validateAtualField('ener_atual', 'ener_max_display');
    validateAtualField('san_atual', 'san_max_display');

    // Renderizar grid dinÃ¢mica de valores derivados
    renderDerivedValuesGrid();

    // Restaurar valores de state.dvAtual (campos "Atual" editÃ¡veis de DVs)
    if (state.dvAtual) {
        for (const [dvKey, val] of Object.entries(state.dvAtual)) {
            const atualEl = document.getElementById(`dv_${dvKey}_atual`);
            if (atualEl && val !== undefined && val !== '') {
                atualEl.value = val;
            }
        }
    }
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
        const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(1))) : '—';
        const displayStr = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;

        const valSpan = el.querySelector('.cm-dv-value');
        if (valSpan && valSpan.textContent !== displayStr) {
            valSpan.textContent = displayStr;
        }
    });
}
window.syncModuleDerivedValuesUI = syncModuleDerivedValuesUI;

