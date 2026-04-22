/* ===== PHASE 4 — As Habilidades (Perícias) ===== */

function initPhase4(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.habilidades);

    const regras = REGRAS_CRIACAO.pericias;
    const groups = ['mental', 'fisico', 'social', 'combate'];
    const pools = [regras.primario, regras.segundo, regras.terceiro, regras.fraco];
    const groupLabels = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate' };

    // Step 1: Priority selection
    html += `
        <div class="section">
            <div class="section-title">Passo 1 — Prioridade de Perícias</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Distribua as prioridades: <strong>${pools.join(' / ')}</strong> pontos entre os 4 grupos.
                Arraste ou selecione qual grupo recebe quantos pontos.
            </p>
            <div id="skillPrioritySelector"></div>
        </div>
    `;

    // Step 2: Distribute skills
    html += `
        <div class="section">
            <div class="section-title">Passo 2 — Distribuir Perícias</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Máximo <strong>${regras.limite_max_por_pericia}</strong> por perícia na criação.
                Perícias de classe são marcadas com ⭐.
            </p>
            <div id="skillDistGrid" class="attr-dist-grid" style="grid-template-columns: repeat(2, 1fr);"></div>
        </div>
    `;

    // Memórias
    html += createMemoryBox('habilidades', 'Qual foi a perícia que mais suou para aprender? Quem te ensinou?', false);

    container.innerHTML = html;

    renderSkillPrioritySelector();
    renderSkillDistribution();
}

function renderSkillPrioritySelector() {
    const container = document.getElementById('skillPrioritySelector');
    if (!container) return;

    const groups = ['mental', 'fisico', 'social', 'combate'];
    const groupLabels = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate' };
    const pools = [
        REGRAS_CRIACAO.pericias.primario,
        REGRAS_CRIACAO.pericias.segundo,
        REGRAS_CRIACAO.pericias.terceiro,
        REGRAS_CRIACAO.pericias.fraco
    ];

    // Get current assignment
    const assigned = {};
    if (wizardState.grupoPericiaPrimario) assigned[wizardState.grupoPericiaPrimario] = pools[0];
    if (wizardState.grupoPericia2) assigned[wizardState.grupoPericia2] = pools[1];
    if (wizardState.grupoPericia3) assigned[wizardState.grupoPericia3] = pools[2];
    if (wizardState.grupoPericiaFraco) assigned[wizardState.grupoPericiaFraco] = pools[3];

    let html = `<div class="group-selector" style="grid-template-columns: repeat(4, 1fr);">`;
    for (const grp of groups) {
        const pts = assigned[grp] || '?';
        html += `
            <div class="group-card" data-skill-group="${grp}" onclick="cycleSkillPriority('${grp}')" style="cursor:pointer;">
                <div class="group-card-title">${groupLabels[grp]}</div>
                <div class="group-card-points">${pts}</div>
                <div class="group-card-label" id="skillPriorityLabel_${grp}">Clique para definir</div>
            </div>
        `;
    }
    html += `</div>`;

    // Quick assign buttons
    html += `<div style="text-align:center;margin-top:8px;">`;
    html += `<button class="btn" style="font-size:11px;" onclick="autoAssignSkillPriority()">🎲 Distribuir Automaticamente</button>`;
    html += `</div>`;

    container.innerHTML = html;
    updateSkillPriorityLabels();
}

let _skillPriorityOrder = [];

function cycleSkillPriority(group) {
    // Remove if already in list
    _skillPriorityOrder = _skillPriorityOrder.filter(g => g !== group);
    // Add to end
    _skillPriorityOrder.push(group);
    // Keep max 4
    if (_skillPriorityOrder.length > 4) _skillPriorityOrder = _skillPriorityOrder.slice(-4);

    // Assign pools
    const pools = [
        REGRAS_CRIACAO.pericias.primario,
        REGRAS_CRIACAO.pericias.segundo,
        REGRAS_CRIACAO.pericias.terceiro,
        REGRAS_CRIACAO.pericias.fraco
    ];

    wizardState.grupoPericiaPrimario = _skillPriorityOrder[0] || null;
    wizardState.grupoPericia2 = _skillPriorityOrder[1] || null;
    wizardState.grupoPericia3 = _skillPriorityOrder[2] || null;
    wizardState.grupoPericiaFraco = _skillPriorityOrder[3] || null;

    updateSkillPriorityLabels();
    renderSkillDistribution();
    saveWizardToStorage();
}

function autoAssignSkillPriority() {
    const groups = ['mental', 'fisico', 'social', 'combate'];
    _skillPriorityOrder = [...groups].sort(() => Math.random() - 0.5);

    wizardState.grupoPericiaPrimario = _skillPriorityOrder[0];
    wizardState.grupoPericia2 = _skillPriorityOrder[1];
    wizardState.grupoPericia3 = _skillPriorityOrder[2];
    wizardState.grupoPericiaFraco = _skillPriorityOrder[3];

    updateSkillPriorityLabels();
    renderSkillDistribution();
    saveWizardToStorage();
}

function updateSkillPriorityLabels() {
    const pools = [
        REGRAS_CRIACAO.pericias.primario,
        REGRAS_CRIACAO.pericias.segundo,
        REGRAS_CRIACAO.pericias.terceiro,
        REGRAS_CRIACAO.pericias.fraco
    ];
    const labels = ['1º Primário', '2º Segundo', '3º Terceiro', '4º Fraco'];

    const groups = ['mental', 'fisico', 'social', 'combate'];
    for (const grp of groups) {
        const idx = _skillPriorityOrder.indexOf(grp);
        const el = document.getElementById(`skillPriorityLabel_${grp}`);
        const pts = document.querySelector(`[data-skill-group="${grp}"] .group-card-points`);
        const card = document.querySelector(`[data-skill-group="${grp}"]`);

        if (el && idx >= 0) {
            el.textContent = labels[idx];
            if (pts) pts.textContent = pools[idx];
            if (card) card.classList.add('selected');
        } else {
            if (el) el.textContent = 'Clique para definir';
            if (pts) pts.textContent = '?';
            if (card) card.classList.remove('selected');
        }
    }
}

function getSkillGroupPool(group) {
    if (group === wizardState.grupoPericiaPrimario) return REGRAS_CRIACAO.pericias.primario;
    if (group === wizardState.grupoPericia2) return REGRAS_CRIACAO.pericias.segundo;
    if (group === wizardState.grupoPericia3) return REGRAS_CRIACAO.pericias.terceiro;
    if (group === wizardState.grupoPericiaFraco) return REGRAS_CRIACAO.pericias.fraco;
    return 0;
}

function renderSkillDistribution() {
    const container = document.getElementById('skillDistGrid');
    if (!container) return;

    const groups = ['mental', 'fisico', 'social', 'combate'];
    const groupLabels = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate' };
    const classSkills = wizardState.classeSelecionada ? (window.CLASS_SKILLS[wizardState.classeSelecionada] || []) : [];

    let html = '';
    for (const grp of groups) {
        const skills = window.SKILLS?.[grp] || [];
        const pool = getSkillGroupPool(grp);
        const remaining = getSkillGroupRemaining(grp);

        html += `
            <div class="attr-dist-block">
                <div class="attr-dist-title">${groupLabels[grp]}</div>
                <div class="attr-dist-counter" id="skillCounter_${grp}">Restante: ${remaining}/${pool}</div>
        `;

        for (const sk of skills) {
            const dotKey = 'sk_' + sk.key;
            const val = wizardState.pericias[dotKey] || 0;
            const isClassSkill = classSkills.includes(sk.name);

            html += `
                <div class="attr-dist-row" title="${escHtml(sk.descricao || '')}">
                    <span class="attr-dist-name" style="min-width:80px;">
                        ${isClassSkill ? '⭐ ' : ''}${escHtml(sk.name)}
                    </span>
                    <div class="attr-dist-dots dots5">
            `;
            for (let d = 1; d <= 5; d++) {
                const filled = d <= val ? 'filled' : '';
                html += `<button class="dot ${filled}" data-skill="${dotKey}" data-dot="${d}" onclick="clickSkillDot('${dotKey}', ${d}, '${grp}')"></button>`;
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
    const max = REGRAS_CRIACAO.pericias.limite_max_por_pericia;

    // Toggle off if same
    if (dotLevel === current) {
        wizardState.pericias[dotKey] = 0;
    } else {
        if (dotLevel > max) {
            showWizardToast(`Máximo ${max} por perícia na criação.`, 'error');
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
    const groups = ['mental', 'fisico', 'social', 'combate'];
    for (const grp of groups) {
        const el = document.getElementById(`skillCounter_${grp}`);
        if (!el) continue;
        const pool = getSkillGroupPool(grp);
        const remaining = getSkillGroupRemaining(grp);
        el.textContent = `Restante: ${remaining}/${pool}`;
        el.style.color = remaining === 0 ? 'var(--success)' : 'var(--accent)';
    }
}
