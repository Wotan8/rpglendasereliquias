/* ===== PHASE 3 — O Corpo e a Mente (Atributos) ===== */

function initPhase3(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.corpo);

    // Step 1: Select primary group
    html += `
        <div class="section" id="attrStep1">
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Passo 1 — Grupo Primário (${REGRAS_CRIACAO.atributos.primario} pontos)</span>
                <button class="btn btn-primary" style="font-size: 0.75rem; padding: 4px 8px; background: var(--primary); border: none; border-radius: 4px; color: #fff; cursor: pointer;" onclick="window.randomizeAttributes()">🎲 Aleatorizar Atributos</button>
            </div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual área define você? O grupo primário recebe <strong>${REGRAS_CRIACAO.atributos.primario} pontos</strong>,
                o intermediário <strong>${REGRAS_CRIACAO.atributos.intermediario}</strong>,
                e o fraco <strong>${REGRAS_CRIACAO.atributos.fraco}</strong>.
            </p>
            <div class="group-selector" id="primaryGroupSelector">
    `;

    for (const grupo of GRUPOS_ATRIBUTOS) {
        const sel = wizardState.grupoPrimario === grupo ? 'selected' : '';
        const dis = wizardState.grupoFraco === grupo ? 'disabled' : '';
        html += `
            <div class="group-card ${sel} ${dis}" data-group="${grupo}" onclick="selectPrimaryGroup('${grupo}')">
                <div class="group-card-title">${getGroupEmoji(grupo)} ${grupo}</div>
                <div class="group-card-points">${getGroupPoints(grupo)}</div>
                <div class="group-card-label">${getGroupRole(grupo)}</div>
            </div>
        `;
    }
    html += `</div></div>`;

    // Step 2: Select weak group
    html += `
        <div class="section" id="attrStep2">
            <div class="section-title">Passo 2 — Grupo Fraco (${REGRAS_CRIACAO.atributos.fraco} pontos)</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">Qual área é sua fraqueza?</p>
            <div class="group-selector" id="weakGroupSelector">
    `;

    for (const grupo of GRUPOS_ATRIBUTOS) {
        const sel = wizardState.grupoFraco === grupo ? 'selected' : '';
        const dis = wizardState.grupoPrimario === grupo ? 'disabled' : '';
        html += `
            <div class="group-card ${sel} ${dis}" data-group="${grupo}" onclick="selectWeakGroup('${grupo}')">
                <div class="group-card-title">${getGroupEmoji(grupo)} ${grupo}</div>
                <div class="group-card-points">${getGroupPoints(grupo)}</div>
                <div class="group-card-label">${getGroupRole(grupo)}</div>
            </div>
        `;
    }
    html += `</div></div>`;

    // Step 3: Distribution
    html += `
        <div class="section" id="attrStep3">
            <div class="section-title">Passo 3 — Distribuir Pontos</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Todos os atributos começam com 1 (grátis). Distribua os pontos restantes.
                A 5ª bolinha custa <strong>2 pontos</strong> em vez de 1.
                Máximo: <strong>${REGRAS_CRIACAO.atributos.limite_max_por_atributo}</strong> por atributo na criação.
            </p>
            <div class="attr-dist-grid" id="attrDistGrid">
    `;

    for (const grupo of GRUPOS_ATRIBUTOS) {
        html += `
            <div class="attr-dist-block">
                <div class="attr-dist-title">${getGroupEmoji(grupo)} ${grupo}</div>
                <div class="attr-dist-counter" id="counter_${grupo}">Restante: ?</div>
        `;

        for (const attr of ATRIBUTOS[grupo]) {
            const val = (wizardState.atributos[attr.key] || 0) + REGRAS_CRIACAO.atributos.base_inicial;
            html += `
                <div class="attr-dist-row" title="${escHtml(attr.tooltip)}">
                    <span class="attr-dist-name">${attr.id}</span>
                    <span style="font-size:.75rem;color:var(--muted);flex:1;">${escHtml(attr.nome)}</span>
                    <div class="attr-dist-dots dots5">
            `;
            for (let d = 1; d <= 5; d++) {
                const filled = d <= val ? 'filled' : '';
                const bonus = d === 1 ? 'bonus' : '';
                html += `<button class="dot ${filled} ${bonus}" data-attr="${attr.key}" data-dot="${d}" onclick="clickAttrDot('${attr.key}', ${d}, '${grupo}')"></button>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }

    html += `</div></div>`;

    // Memórias
    html += createMemoryBox('corpo', 'Por que seu personagem é forte nessa área? Foi treino, talento natural, ou uma experiência traumática que o forçou a se desenvolver?', false, '✍️ Memória dos pontos forte');
    html += createMemoryBox('corpo_adicional', 'E a fraqueza — é algo que ele tenta superar, ou que simplesmente aceita?', false, '✍️ Memória dos pontos fraco');

    container.innerHTML = html;
    updateAllAttrCounters();
}

function getGroupEmoji(grupo) {
    return { Mental: '🧠', Fisico: '💪', Social: '🗣️' }[grupo] || '📋';
}

function getGroupRole(grupo) {
    if (!wizardState.grupoPrimario && !wizardState.grupoFraco) return 'Selecione';
    if (wizardState.grupoPrimario === grupo) return `Primário (${REGRAS_CRIACAO.atributos.primario}p)`;
    if (wizardState.grupoFraco === grupo) return `Fraco (${REGRAS_CRIACAO.atributos.fraco}p)`;
    return `Intermediário (${REGRAS_CRIACAO.atributos.intermediario}p)`;
}

function getGroupPoints(grupo) {
    if (wizardState.grupoPrimario === grupo) return REGRAS_CRIACAO.atributos.primario;
    if (wizardState.grupoFraco === grupo) return REGRAS_CRIACAO.atributos.fraco;
    if (wizardState.grupoPrimario && wizardState.grupoFraco) return REGRAS_CRIACAO.atributos.intermediario;
    return '?';
}

function selectPrimaryGroup(grupo) {
    if (wizardState.grupoFraco === grupo) return;
    wizardState.grupoPrimario = grupo;
    resetAttrPoints();
    forceRerender(getPhaseIndex(3));
    saveWizardToStorage();
}

function selectWeakGroup(grupo) {
    if (wizardState.grupoPrimario === grupo) return;
    wizardState.grupoFraco = grupo;
    resetAttrPoints();
    forceRerender(getPhaseIndex(3));
    saveWizardToStorage();
}

function resetAttrPoints() {
    for (const key of Object.keys(wizardState.atributos)) {
        wizardState.atributos[key] = 0;
    }
}

function clickAttrDot(attrKey, dotLevel, grupo) {
    if (!wizardState.grupoPrimario || !wizardState.grupoFraco) {
        showWizardToast('Selecione os grupos primário e fraco primeiro.', 'error');
        return;
    }

    const base = REGRAS_CRIACAO.atributos.base_inicial;
    const targetLevel = dotLevel - base; // Points to distribute (0 = just base)
    const currentLevel = wizardState.atributos[attrKey] || 0;
    const maxPerAttr = REGRAS_CRIACAO.atributos.limite_max_por_atributo;

    // Toggle off if clicking the same level
    if (targetLevel === currentLevel) {
        wizardState.atributos[attrKey] = 0;
    } else {
        // Check max per attribute
        if (targetLevel > maxPerAttr) {
            showWizardToast(`Máximo ${maxPerAttr + base} por atributo na criação.`, 'error');
            return;
        }

        // Check pool availability
        const costDelta = calcAttrCost(targetLevel) - calcAttrCost(currentLevel);
        const remaining = getGroupRemainingPoints(grupo);

        if (costDelta > remaining) {
            showWizardToast(`Pontos insuficientes! Restam ${remaining} ponto(s) no grupo ${grupo}.`, 'error');
            return;
        }

        wizardState.atributos[attrKey] = targetLevel;
    }

    // Update dots UI
    updateAttrDotsUI(attrKey);
    updateAllAttrCounters();
    ExpTracker.updateDisplay();
    saveWizardToStorage();
}

function calcAttrCost(level) {
    let cost = 0;
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    for (let i = 1; i <= level; i++) {
        cost += (i + base >= 5) ? REGRAS_CRIACAO.atributos.custo_quinta_bolinha : 1;
    }
    return cost;
}

function updateAttrDotsUI(attrKey) {
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    const val = (wizardState.atributos[attrKey] || 0) + base;

    document.querySelectorAll(`[data-attr="${attrKey}"]`).forEach(dot => {
        const d = parseInt(dot.dataset.dot);
        dot.classList.toggle('filled', d <= val);
    });
}

function updateAllAttrCounters() {
    for (const grupo of GRUPOS_ATRIBUTOS) {
        const el = document.getElementById(`counter_${grupo}`);
        if (!el) continue;
        const remaining = getGroupRemainingPoints(grupo);
        el.textContent = `Restante: ${remaining} ponto(s)`;
        el.style.color = remaining === 0 ? 'var(--success)' : 'var(--accent)';
    }
}

window.randomizeAttributes = function() {
    const groups = [...GRUPOS_ATRIBUTOS];
    groups.sort(() => Math.random() - 0.5);
    wizardState.grupoPrimario = groups[0];
    wizardState.grupoFraco = groups[1];
    
    resetAttrPoints();
    
    for (const grupo of GRUPOS_ATRIBUTOS) {
        const maxPerAttr = REGRAS_CRIACAO.atributos.limite_max_por_atributo;
        const attrs = ATRIBUTOS[grupo].map(a => a.key);
        
        let attempts = 0;
        while (getGroupRemainingPoints(grupo) > 0 && attempts < 100) {
            attempts++;
            const attrKey = attrs[Math.floor(Math.random() * attrs.length)];
            const currentLevel = wizardState.atributos[attrKey] || 0;
            const targetLevel = currentLevel + 1;
            
            if (targetLevel > maxPerAttr) continue;
            
            const costDelta = calcAttrCost(targetLevel) - calcAttrCost(currentLevel);
            if (costDelta <= getGroupRemainingPoints(grupo)) {
                wizardState.atributos[attrKey] = targetLevel;
                attempts = 0; // reset attempts when successful
            }
        }
    }
    
    forceRerender(getPhaseIndex(3));
    saveWizardToStorage();
};
