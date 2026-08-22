/* ===== PHASE 3 — O Corpo e a Mente (Atributos) ===== */

function initPhase3(container) {
    clampAttributesToCreationLimits(); // fonte pode ter mudado o teto desde a última visita
    revalidarCompras();                // e o EXP gasto em compras é recalculado do estado
    let html = createNarratorBox(NARRADOR_TEXTOS.corpo);

    // Step 1: Select primary group
    html += `
        <div class="section" id="attrStep1">
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Passo 1 — Grupo Primário (${REGRAS_CRIACAO.atributos.primario} pontos)</span>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.randomizeAttributes()">🎲 Aleatorizar Atributos</button>
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
        html += `
            <div class="group-card ${sel}" data-group="${grupo}" onclick="selectPrimaryGroup('${grupo}')">
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
        html += `
            <div class="group-card ${sel}" data-group="${grupo}" onclick="selectWeakGroup('${grupo}')">
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
                Máximo padrão: <strong>${REGRAS_CRIACAO.atributos.limite_max_por_atributo}</strong> por atributo na criação (Peculiaridades podem alterar esse teto).
            </p>
            ${criarGuiaCompraExp('atributo')}
            <div class="attr-dist-grid" id="attrDistGrid">${renderAttrDistribution()}</div>
        </div>`;

    // Memórias
    html += createMemoryBox('corpo', 'Por que seu personagem é forte nessa área? Foi treino, talento natural, ou uma experiência traumática que o forçou a se desenvolver?', false, '✍️ Memória dos pontos forte');
    html += createMemoryBox('corpo_adicional', 'E a fraqueza — é algo que ele tenta superar, ou que simplesmente aceita?', false, '✍️ Memória dos pontos fraco');

    container.innerHTML = html;
    updateAllAttrCounters();
}

/** Teto de pontos INICIAIS deste atributo, em bolinhas (peculiaridades podem elevar). */
function getAttrMaxDots(attrKey, attrId) {
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    const padrao = REGRAS_CRIACAO.atributos.limite_max_por_atributo + base;
    if (!window.getDynamicCreationLimit) return padrao;
    return window.getDynamicCreationLimit(attrId || attrKey.toUpperCase().replace('ATTR_', ''), padrao, wizardState);
}

function estadoCompraAtributo(attrKey) {
    const teto = REGRAS_CRIACAO.compra_exp.teto_nivel;
    return avaliarCompraExp({
        nivel: nivelAtributo(attrKey),
        comprados: wizardState.atributosExp[attrKey] || 0,
        custoPorNivel: REGRAS_CRIACAO.compra_exp.custo_atributo_por_nivel,
        teto,
        motivoTeto: `Nível ${teto} é o teto do sistema — nem com EXP passa disso.`
    });
}

function renderAttrDistribution() {
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    let html = '';

    for (const grupo of GRUPOS_ATRIBUTOS) {
        html += `
            <div class="attr-dist-block">
                <div class="attr-dist-title">${getGroupEmoji(grupo)} ${grupo}</div>
                <div class="attr-dist-counter" id="counter_${grupo}">Restante: ?</div>
        `;

        for (const attr of ATRIBUTOS[grupo]) {
            const pontos = base + (wizardState.atributos[attr.key] || 0);
            const total = nivelAtributo(attr.key);
            const maxDots = getAttrMaxDots(attr.key, attr.id);
            const est = estadoCompraAtributo(attr.key);

            html += `
                <div class="attr-dist-row" title="${escHtml(attr.tooltip)}">
                    <span class="attr-dist-name">${attr.id}</span>
                    <span class="attr-dist-desc">${escHtml(attr.nome)}</span>
                    <div class="attr-dist-dots dots5">
            `;
            for (let d = 1; d <= 5; d++) {
                const classes = ['dot'];
                if (d === 1) classes.push('bonus');
                if (d <= pontos) classes.push('filled');
                else if (d <= total) classes.push('filled', 'exp');

                // Acima do teto de pontos a bolinha só sobe pelo botão + (EXP).
                const soExp = d > maxDots;
                const titulo = soExp
                    ? `Acima do teto de pontos iniciais (${maxDots}) — só sobe comprando com EXP no +.`
                    : `Nível ${d} com os pontos iniciais`;
                html += `<button class="${classes.join(' ')}" data-attr="${attr.key}" data-dot="${d}"
                    title="${escHtml(titulo)}" ${soExp ? 'disabled' : `onclick="clickAttrDot('${attr.key}', ${d}, '${grupo}')"`}></button>`;
            }
            html += `</div>
                    ${criarBotoesCompraExp('comprarAtributoExp', 'venderAtributoExp', attr.key, est)}
                </div>`;
        }
        html += `</div>`;
    }
    return html;
}

/* ===== COMPRA DE ATRIBUTO COM EXP ===== */

function comprarAtributoExp(attrKey) {
    const est = estadoCompraAtributo(attrKey);
    if (est.bloqueio) { showWizardToast(est.bloqueio.motivo, 'error'); return; }

    wizardState.atributosExp[attrKey] = (wizardState.atributosExp[attrKey] || 0) + 1;
    aposMudarAtributos();
}

function venderAtributoExp(attrKey) {
    if (!wizardState.atributosExp[attrKey]) return;
    wizardState.atributosExp[attrKey]--;
    aposMudarAtributos();
}

/** Níveis comprados que passaram do teto 5 (o ponto inicial subiu por baixo). */
function clampComprasAtributos() {
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    const teto = REGRAS_CRIACAO.compra_exp.teto_nivel;
    for (const key of Object.keys(wizardState.atributosExp || {})) {
        const sobra = teto - base - (wizardState.atributos[key] || 0);
        if (wizardState.atributosExp[key] > sobra) {
            wizardState.atributosExp[key] = Math.max(0, sobra);
        }
    }
}

// Mexer em atributo mexe no limitador das perícias — por isso a revalidação é global.
// Ela roda aqui, e não só no render: o EXP do pool não pode depender de a fase
// estar montada na tela.
function aposMudarAtributos() {
    revalidarCompras();
    forceRerender(getPhaseIndex(3));
    saveWizardToStorage();
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

function selectPrimaryGroup(grupo) { setAttrGroup('grupoPrimario', 'grupoFraco', grupo); }
function selectWeakGroup(grupo)    { setAttrGroup('grupoFraco', 'grupoPrimario', grupo); }

// Reclicar no card selecionado desmarca; escolher um grupo já usado no outro
// passo libera esse outro passo. Qualquer mudança zera os pontos distribuídos,
// porque as pools mudam de tamanho junto com os grupos.
function setAttrGroup(key, otherKey, grupo) {
    wizardState[key] = wizardState[key] === grupo ? null : grupo;
    if (wizardState[otherKey] === grupo) wizardState[otherKey] = null;
    resetAttrPoints();
    forceRerender(getPhaseIndex(3));
    ExpTracker.updateDisplay();
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
    const maxAllowedDots = getAttrMaxDots(attrKey);

    // Toggle off if clicking the same level
    if (targetLevel === currentLevel) {
        wizardState.atributos[attrKey] = 0;
    } else {
        // Check max per attribute
        if (dotLevel > maxAllowedDots) {
            showWizardToast(`Máximo ${maxAllowedDots} por atributo com os pontos iniciais — acima disso, só comprando com EXP no botão +.`, 'error');
            return;
        }

        // Check pool availability
        const costDelta = calcAttrCost(targetLevel) - calcAttrCost(currentLevel);
        const remaining = getGroupRemainingPoints(grupo);

        if (costDelta > remaining) {
            showWizardToast(`Pontos insuficientes! Restam ${remaining} ponto(s) no grupo ${grupo}. Você ainda pode subir este atributo com EXP no botão +.`, 'error');
            return;
        }

        // O ponto inicial ocupa o degrau que o EXP já tinha pago — devolve o EXP,
        // porque ponto é de graça e nível comprado mora sempre no topo.
        const ganhos = targetLevel - currentLevel;
        if (ganhos > 0 && wizardState.atributosExp[attrKey] > 0) {
            wizardState.atributosExp[attrKey] = Math.max(0, wizardState.atributosExp[attrKey] - ganhos);
        }
        wizardState.atributos[attrKey] = targetLevel;
    }

    aposMudarAtributos();
}

// Re-valida os atributos já distribuídos contra o teto dinâmico atual.
// Chamado ao renderizar os atributos e no finale, para que trocar/desmarcar
// uma fonte (raça/classe/tribo/peculiaridade) que elevava o teto puxe de volta
// qualquer valor agora ilegal para o máximo permitido.
function clampAttributesToCreationLimits() {
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    const defaultMaxDots = REGRAS_CRIACAO.atributos.limite_max_por_atributo + base;
    let changed = false;
    for (const grupo of GRUPOS_ATRIBUTOS) {
        for (const attr of ATRIBUTOS[grupo]) {
            const val = wizardState.atributos[attr.key] || 0;
            if (val === 0) continue;
            const maxDots = window.getDynamicCreationLimit
                ? window.getDynamicCreationLimit(attr.id, defaultMaxDots, wizardState)
                : defaultMaxDots;
            const maxLevel = maxDots - base;
            if (val > maxLevel) {
                wizardState.atributos[attr.key] = maxLevel;
                changed = true;
            }
        }
    }
    if (changed) saveWizardToStorage();
    return changed;
}

function calcAttrCost(level) {
    let cost = 0;
    const base = REGRAS_CRIACAO.atributos.base_inicial;
    for (let i = 1; i <= level; i++) {
        cost += (i + base >= 5) ? REGRAS_CRIACAO.atributos.custo_quinta_bolinha : 1;
    }
    return cost;
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
        const defaultMax = REGRAS_CRIACAO.atributos.limite_max_por_atributo;
        const attrs = ATRIBUTOS[grupo].map(a => a.key);
        
        let attempts = 0;
        while (getGroupRemainingPoints(grupo) > 0 && attempts < 100) {
            attempts++;
            const attrKey = attrs[Math.floor(Math.random() * attrs.length)];
            const currentLevel = wizardState.atributos[attrKey] || 0;
            const targetLevel = currentLevel + 1;
            const dotLevel = targetLevel + REGRAS_CRIACAO.atributos.base_inicial;
            
            if (dotLevel > getAttrMaxDots(attrKey)) continue;
            
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
