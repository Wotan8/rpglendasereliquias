/* ===== PHASE 4 — As Habilidades (Perícias) ===== */

function initPhase4(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.habilidades);

    const regras = REGRAS_CRIACAO.pericias;

    // Step 1: Select highest (6 points)
    html += `
        <div class="section" id="skillStep1">
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Passo 1 — A Maior (${regras.primario} pontos)</span>
                <button class="btn btn-primary" style="font-size: 0.75rem; padding: 4px 8px; background: #6E5413; border: none; border-radius: 4px; color: #fff; cursor: pointer;" onclick="window.randomizeSkills()">🎲 Aleatorizar Perícias</button>
            </div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual grupo de perícias define você? Esse grupo recebe <strong>${regras.primario} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep1Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 2: Select second (4 points)
    html += `
        <div class="section" id="skillStep2">
            <div class="section-title">Passo 2 — A Segunda (${regras.segundo} pontos)</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual é seu segundo forte? Esse grupo recebe <strong>${regras.segundo} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep2Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 3: Select worst (2 points)
    html += `
        <div class="section" id="skillStep3">
            <div class="section-title">Passo 3 — A Pior (${regras.fraco} pontos)</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual área é sua fraqueza? Esse grupo recebe apenas <strong>${regras.fraco} pontos</strong>.
                O grupo restante ficará automaticamente com <strong>${regras.terceiro} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep3Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 4: Distribute skills
    html += `
        <div class="section">
            <div class="section-title">Passo 4 — Distribuir Perícias</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Máximo padrão <strong>${regras.limite_max_por_pericia}</strong> por perícia na criação (Peculiaridades podem alterar esse teto).
                Perícias de classe são marcadas com ⭐.
            </p>
            <div id="skillDistGrid" class="attr-dist-grid" style="grid-template-columns: repeat(2, 1fr);"></div>
        </div>
    `;

    // Memórias
    html += createMemoryBox('habilidades', 'Descreva como você aprendeu essas habilidades. Foi com um mentor? Sozinho? Por necessidade desesperada?', false, '✍️ Memória das melhores habilidades');
    html += createMemoryBox('habilidades_fraco', 'Essas são as coisas que você nunca praticou muito. Por quê? Falta de interesse, de oportunidade, ou algo te afastou delas?', false, '✍️ Memória das piores habilidades');

    container.innerHTML = html;

    renderSkillStepSelectors();
    renderSkillDistribution();
}

const _skillGroupLabels = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate' };
const _skillGroups = ['mental', 'fisico', 'social', 'combate'];

function renderSkillStepSelectors() {
    const regras = REGRAS_CRIACAO.pericias;
    const pools = [regras.primario, regras.segundo, regras.fraco];
    const stateKeys = ['grupoPericiaPrimario', 'grupoPericia2', 'grupoPericiaFraco'];
    const stepIds = ['skillStep1Selector', 'skillStep2Selector', 'skillStep3Selector'];

    for (let step = 0; step < 3; step++) {
        const container = document.getElementById(stepIds[step]);
        if (!container) continue;

        let html = '';
        for (const grp of _skillGroups) {
            // Is this group already selected in another step?
            const selectedInStep = stateKeys.findIndex(k => wizardState[k] === grp);
            const isSelectedHere = wizardState[stateKeys[step]] === grp;
            const isDisabled = selectedInStep >= 0 && selectedInStep !== step;

            html += `
                <div class="group-card ${isSelectedHere ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                     data-skill-group="${grp}"
                     onclick="${isDisabled ? '' : `selectSkillStep(${step}, '${grp}')`}"
                     style="cursor:${isDisabled ? 'not-allowed' : 'pointer'};">
                    <div class="group-card-title">${_skillGroupLabels[grp]}</div>
                    <div class="group-card-points">${isSelectedHere ? pools[step] : '?'}</div>
                    <div class="group-card-label">${isSelectedHere ? ['1º Maior', '2º Segundo', '3º Pior'][step] : (isDisabled ? _getSkillStepLabel(grp) : 'Selecione')}</div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
}

function _getSkillStepLabel(grp) {
    if (wizardState.grupoPericiaPrimario === grp) return '1º Maior';
    if (wizardState.grupoPericia2 === grp) return '2º Segundo';
    if (wizardState.grupoPericiaFraco === grp) return '3º Pior';
    if (wizardState.grupoPericia3 === grp) return '4º Terceiro';
    return 'Selecione';
}

function selectSkillStep(step, group) {
    const stateKeys = ['grupoPericiaPrimario', 'grupoPericia2', 'grupoPericiaFraco'];

    // Don't allow selecting a group already used in another step
    for (let i = 0; i < stateKeys.length; i++) {
        if (i !== step && wizardState[stateKeys[i]] === group) return;
    }

    wizardState[stateKeys[step]] = group;

    // Auto-assign the remaining group as "terceiro" (3 points)
    _autoAssignThirdGroup();

    renderSkillStepSelectors();
    renderSkillDistribution();
    saveWizardToStorage();
}

function _autoAssignThirdGroup() {
    const assigned = [wizardState.grupoPericiaPrimario, wizardState.grupoPericia2, wizardState.grupoPericiaFraco].filter(Boolean);
    if (assigned.length === 3) {
        const remaining = _skillGroups.find(g => !assigned.includes(g));
        wizardState.grupoPericia3 = remaining || null;
    } else {
        wizardState.grupoPericia3 = null;
    }
}

function autoAssignSkillPriority() {
    const shuffled = [..._skillGroups].sort(() => Math.random() - 0.5);

    wizardState.grupoPericiaPrimario = shuffled[0];
    wizardState.grupoPericia2 = shuffled[1];
    wizardState.grupoPericiaFraco = shuffled[2];
    wizardState.grupoPericia3 = shuffled[3];

    renderSkillStepSelectors();
    renderSkillDistribution();
    saveWizardToStorage();
}

function getSkillGroupPool(group) {
    if (group === wizardState.grupoPericiaPrimario) return REGRAS_CRIACAO.pericias.primario;
    if (group === wizardState.grupoPericia2) return REGRAS_CRIACAO.pericias.segundo;
    if (group === wizardState.grupoPericia3) return REGRAS_CRIACAO.pericias.terceiro;
    if (group === wizardState.grupoPericiaFraco) return REGRAS_CRIACAO.pericias.fraco;
    return 0;
}

function getSkillParentAttributeLevel(sk) {
    const attrSource = sk.atributoBase || sk.attr;
    if (!attrSource) return Infinity;

    // Use the first attribute if it's an array, or the string itself
    const primaryAttr = Array.isArray(attrSource) ? attrSource[0] : String(attrSource).split('/')[0];
    const upperAttr = String(primaryAttr).trim().toUpperCase();

    const ATTR_KEY_MAP = {
        'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
        'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
        'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut'
    };

    let attrKey = null;

    if (ATTR_KEY_MAP[upperAttr]) {
        attrKey = ATTR_KEY_MAP[upperAttr];
    } else if (upperAttr.startsWith('ATTR_')) {
        attrKey = primaryAttr.toLowerCase();
    } else {
        for (const group of Object.values(ATRIBUTOS)) {
            for (const attr of group) {
                if (attr.id.toUpperCase() === upperAttr || attr.nome.toUpperCase() === upperAttr || attr.key.toUpperCase() === upperAttr) {
                    attrKey = attr.key;
                    break;
                }
            }
            if (attrKey) break;
        }
    }

    if (attrKey) {
        const baseLevel = REGRAS_CRIACAO.atributos.base_inicial || 1;
        const addedLevel = wizardState.atributos[attrKey] || 0;
        return baseLevel + addedLevel;
    }

    return Infinity;
}

function renderSkillDistribution() {
    const container = document.getElementById('skillDistGrid');
    if (!container) return;

    const classSkills = wizardState.classeSelecionada ? (window.CLASS_SKILLS[wizardState.classeSelecionada] || []) : [];

    let html = '';
    for (const grp of _skillGroups) {
        const skills = window.SKILLS?.[grp] || [];
        const pool = getSkillGroupPool(grp);
        const remaining = getSkillGroupRemaining(grp);

        html += `
            <div class="attr-dist-block">
                <div class="attr-dist-title">${_skillGroupLabels[grp]}</div>
                <div class="attr-dist-counter" id="skillCounter_${grp}">Restante: ${remaining}/${pool}</div>
        `;

        for (const sk of skills) {
            const dotKey = 'sk_' + sk.key;
            const val = wizardState.pericias[dotKey] || 0;
            const isClassSkill = classSkills.includes(sk.name);
            const parentLevel = getSkillParentAttributeLevel(sk);
            let defaultMax = REGRAS_CRIACAO.pericias.limite_max_por_pericia;
            let wasModified = false;
            if (window.getDynamicCreationLimit) {
                const dynamicGroup = window.getDynamicCreationLimit('Perícias (qualquer)', defaultMax, wizardState);
                const dynamicSpecific = window.getDynamicCreationLimit(sk.name, dynamicGroup, wizardState);
                if (dynamicSpecific > defaultMax) {
                    defaultMax = dynamicSpecific;
                    wasModified = true;
                }
            }
            const maxAllowed = wasModified ? defaultMax : Math.min(defaultMax, parentLevel);

            html += `
                <div class="attr-dist-row" title="${escHtml(sk.descricao || '')}">
                    <span class="attr-dist-name" style="min-width:80px;">
                        ${isClassSkill ? '⭐ ' : ''}${escHtml(sk.name)}
                    </span>
                    <div class="attr-dist-dots dots5">
            `;
            for (let d = 1; d <= 5; d++) {
                const filled = d <= val ? 'filled' : '';
                const disabled = d > maxAllowed ? 'disabled' : '';
                html += `<button class="dot ${filled}" data-skill="${dotKey}" data-dot="${d}" onclick="${disabled ? '' : `clickSkillDot('${dotKey}', ${d}, '${grp}')`}" ${disabled}></button>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
}

function clickSkillDot(dotKey, dotLevel, group) {
    if (!wizardState.grupoPericiaPrimario) {
        showWizardToast('Defina as prioridades de perícias primeiro.', 'error');
        return;
    }

    const current = wizardState.pericias[dotKey] || 0;
    let max = REGRAS_CRIACAO.pericias.limite_max_por_pericia;
    const skills = window.SKILLS?.[group] || [];
    const sk = skills.find(s => 'sk_' + s.key === dotKey);
    const parentLevel = sk ? getSkillParentAttributeLevel(sk) : Infinity;
    
    let wasModified = false;
    if (sk && window.getDynamicCreationLimit) {
        const dynamicGroup = window.getDynamicCreationLimit('Perícias (qualquer)', max, wizardState);
        const dynamicSpecific = window.getDynamicCreationLimit(sk.name, dynamicGroup, wizardState);
        if (dynamicSpecific > max) {
            max = dynamicSpecific;
            wasModified = true;
        }
    }
    
    const maxAllowed = wasModified ? max : Math.min(max, parentLevel);

    // Toggle off if same
    if (dotLevel === current) {
        wizardState.pericias[dotKey] = 0;
    } else {
        if (dotLevel > maxAllowed) {
            if (dotLevel > parentLevel) {
                showWizardToast(`Máximo ${parentLevel} por causa do atributo limitador.`, 'error');
            } else {
                showWizardToast(`Máximo ${max} por perícia na criação.`, 'error');
            }
            return;
        }

        const delta = dotLevel - current;
        const remaining = getSkillGroupRemaining(group);
        if (delta > remaining) {
            showWizardToast(`Pontos insuficientes! Restam ${remaining} no grupo.`, 'error');
            return;
        }

        wizardState.pericias[dotKey] = dotLevel;
    }

    // Update dots UI
    document.querySelectorAll(`[data-skill="${dotKey}"]`).forEach(dot => {
        const d = parseInt(dot.dataset.dot);
        dot.classList.toggle('filled', d <= (wizardState.pericias[dotKey] || 0));
    });

    updateSkillCounters();
    ExpTracker.updateDisplay();
    saveWizardToStorage();
}

function getSkillGroupRemaining(group) {
    const pool = getSkillGroupPool(group);
    const skills = window.SKILLS?.[group] || [];
    let spent = 0;
    for (const sk of skills) {
        const dotKey = 'sk_' + sk.key;
        spent += (wizardState.pericias[dotKey] || 0);
    }
    return pool - spent;
}

function updateSkillCounters() {
    for (const grp of _skillGroups) {
        const el = document.getElementById(`skillCounter_${grp}`);
        if (!el) continue;
        const pool = getSkillGroupPool(grp);
        const remaining = getSkillGroupRemaining(grp);
        el.textContent = `Restante: ${remaining}/${pool}`;
        el.style.color = remaining === 0 ? 'var(--success)' : 'var(--accent)';
    }
}

window.randomizeSkills = function() {
    const shuffled = [..._skillGroups].sort(() => Math.random() - 0.5);
    wizardState.grupoPericiaPrimario = shuffled[0];
    wizardState.grupoPericia2 = shuffled[1];
    wizardState.grupoPericiaFraco = shuffled[2];
    wizardState.grupoPericia3 = shuffled[3];
    
    if (!wizardState.pericias) wizardState.pericias = {};
    for (const key of Object.keys(wizardState.pericias)) {
        wizardState.pericias[key] = 0;
    }
    
    for (const grp of _skillGroups) {
        const skills = window.SKILLS?.[grp] || [];
        if (skills.length === 0) continue;
        
        let attempts = 0;
        while (getSkillGroupRemaining(grp) > 0 && attempts < 100) {
            attempts++;
            const sk = skills[Math.floor(Math.random() * skills.length)];
            const dotKey = 'sk_' + sk.key;
            const currentLevel = wizardState.pericias[dotKey] || 0;
            const targetLevel = currentLevel + 1;
            
            const parentLevel = getSkillParentAttributeLevel(sk);
            let defaultMax = REGRAS_CRIACAO.pericias.limite_max_por_pericia;
            let wasModified = false;
            if (window.getDynamicCreationLimit) {
                const dynamicGroup = window.getDynamicCreationLimit('Perícias (qualquer)', defaultMax, wizardState);
                const dynamicSpecific = window.getDynamicCreationLimit(sk.name, dynamicGroup, wizardState);
                if (dynamicSpecific > defaultMax) {
                    defaultMax = dynamicSpecific;
                    wasModified = true;
                }
            }
            const maxAllowed = wasModified ? defaultMax : Math.min(defaultMax, parentLevel);
            
            if (targetLevel > maxAllowed) continue;
            
            wizardState.pericias[dotKey] = targetLevel;
            attempts = 0;
        }
    }
    
    renderSkillStepSelectors();
    renderSkillDistribution();
    saveWizardToStorage();
};
