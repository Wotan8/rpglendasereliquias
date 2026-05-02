/* ===== PHASE 2B — Peculiaridades Individuais (Lógica Reescrita) ===== */
/* Classificação explícita via campo do Creator Panel:
   - pec.ehVantagem === true  → 🟢 Vantagem (custa EXP ao selecionar)
   - pec.ehVantagem === false → 🔴 Desvantagem (concede EXP ao selecionar)
   A mecânica de EXP aplicada na criação é pec.mecanicaExpCriacao (array de IDs) */

function initPhase2B(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.peculiaridades);

    html += `
        <div class="section">
            <div class="section-title">✨ Peculiaridades Individuais</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Escolha marcas que fazem seu personagem único.
                <strong style="color:var(--success);">🟢 Vantagens</strong> custam EXP.
                <strong style="color:var(--danger);">🔴 Desvantagens</strong> concedem EXP.
            </p>
        </div>
    `;

    // Classify peculiarities by explicit ehVantagem field
    const vantagens = [];
    const desvantagens = [];

    for (const pec of window.INDIVIDUAL_PECULIARITIES) {
        const expInfo = getExpInfo(pec);
        if (pec.ehVantagem === true) {
            vantagens.push({ ...pec, _expInfo: expInfo });
        } else {
            // ehVantagem === false OR undefined → desvantagem
            desvantagens.push({ ...pec, _expInfo: expInfo });
        }
    }

    // Vantagens (custo EXP)
    if (vantagens.length) {
        html += `<div class="section"><div class="section-title">🟢 Vantagens <span style="font-size:.78rem;font-weight:400;color:var(--muted);">(custam EXP)</span></div>`;
        html += `<div class="selection-grid" id="pecPosGrid">`;
        for (const pec of vantagens) {
            const sel = wizardState.peculiaridadesIndividuais.some(p => p.id === pec.id) ? 'selected' : '';
            html += buildPecCard2(pec, sel);
        }
        html += `</div></div>`;
    }

    // Desvantagens (ganho EXP)
    if (desvantagens.length) {
        html += `<div class="section"><div class="section-title">🔴 Desvantagens <span style="font-size:.78rem;font-weight:400;color:var(--muted);">(concedem EXP)</span></div>`;
        html += `<div class="selection-grid" id="pecNegGrid">`;
        for (const pec of desvantagens) {
            const sel = wizardState.peculiaridadesIndividuais.some(p => p.id === pec.id) ? 'selected' : '';
            html += buildPecCard2(pec, sel);
        }
        html += `</div></div>`;
    }

    if (vantagens.length === 0 && desvantagens.length === 0) {
        html += `<div style="text-align:center;padding:30px;color:var(--muted);">Nenhuma peculiaridade individual encontrada no banco de dados.</div>`;
    }

    // Memória
    html += createMemoryBox('peculiaridades', 'Escreva uma ou várias memórias sobre quando alguma ou todas essas peculiaridades que seu personagem tem, tiveram uma influência, positiva ou negativa. Te ajudando ou atrapalhando.', false);

    container.innerHTML = html;
}

/**
 * Resolve the EXP mechanic linked via mecanicaExpCriacao.
 * Extracts the operation (+/-) and the value from the mechanic's config.calculos structure.
 *
 * Mechanic structure (tipo: 'modificar'):
 *   config.calculos[] → array of calc rows
 *     calc.alvo       → 'EXP' (the target)
 *     calc.operacao   → '+' (somar) or '-' (subtrair)
 *     calc.equacao[]  → array of equation terms
 *       term.tipo     → 'fixo' or 'ficha'
 *       term.valor    → the numeric value (when tipo === 'fixo')
 *
 * Returns { expAmount: number, operacao: '+' | '-' }
 */
function getExpInfo(pec) {
    const result = { expAmount: 0, operacao: '+' };

    // Get linked mechanic IDs
    const expMechIds = Array.isArray(pec.mecanicaExpCriacao) ? pec.mecanicaExpCriacao : [];
    if (expMechIds.length === 0) {
        // Fallback: try mecanicaIds for backward compat
        return result;
    }

    // Find the mechanic in _systemData.mechanics
    const allMechanics = window._systemData?.mechanics || [];
    const mech = allMechanics.find(m => m.id === expMechIds[0]);
    if (!mech) {
        console.warn(`⚠️ Mecânica de EXP não encontrada: ${expMechIds[0]} para peculiaridade "${pec.nome}"`);
        return result;
    }

    // Extract value from the mechanic's config
    const config = mech.config || {};

    // New multi-calc format: config.calculos[]
    if (Array.isArray(config.calculos) && config.calculos.length > 0) {
        for (const calc of config.calculos) {
            // Find the calc that targets EXP
            if (calc.alvo === 'EXP' || !calc.alvo) {
                result.operacao = calc.operacao || '+';

                // Extract value from equation terms
                if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
                    // Sum all fixed terms (tipo === 'fixo')
                    let total = 0;
                    for (const term of calc.equacao) {
                        if (term.tipo === 'fixo' || !term.tipo) {
                            total += Math.abs(parseFloat(term.valor) || 0);
                        }
                    }
                    result.expAmount = total;
                } else if (calc.valor != null) {
                    // Legacy: single valor field
                    result.expAmount = Math.abs(parseFloat(calc.valor) || 0);
                }

                break; // Use first EXP calc found
            }
        }
    }
    // Legacy single-calc format
    else if (config.alvo) {
        result.operacao = config.operacao || '+';
        if (config.valor != null) {
            result.expAmount = Math.abs(parseFloat(config.valor) || 0);
        }
    }

    return result;
}

function buildPecCard2(pec, selectedClass) {
    const expInfo = pec._expInfo || getExpInfo(pec);
    const isVantagem = pec.ehVantagem === true;

    // Determine EXP display text
    let expText = '';
    let expClass = '';
    if (expInfo.expAmount > 0) {
        if (isVantagem) {
            // Vantagem = custar EXP
            expText = `-${expInfo.expAmount} EXP`;
            expClass = 'cost';
        } else {
            // Desvantagem = conceder EXP
            expText = `+${expInfo.expAmount} EXP`;
            expClass = 'gain';
        }
    }

    // Multi-level: show current selected level
    const selectedPec = wizardState.peculiaridadesIndividuais.find(p => p.id === pec.id);
    const hasLevels = pec.tipo === 'evolutivo' && pec.nivelMax > 1;
    const currentLevel = selectedPec?.nivel || 1;

    let levelSelectorHtml = '';
    if (hasLevels && selectedPec) {
        levelSelectorHtml = `<div class="pec-level-selector" onclick="event.stopPropagation()">`;
        for (let i = 1; i <= pec.nivelMax; i++) {
            const active = currentLevel >= i ? 'active' : '';
            levelSelectorHtml += `<button class="pec-level-btn ${active}" onclick="setPecLevel('${pec.id}', ${i})" title="Nível ${i}">${i}</button>`;
        }
        levelSelectorHtml += `</div>`;
    }

    return `
        <div class="pec-card ${isVantagem ? 'positivo' : 'negativo'} ${selectedClass}"
             data-pec-id="${pec.id}" onclick="togglePeculiarity2('${pec.id}')">
            <div class="pec-card-header">
                <span class="pec-card-icon">${pec.icone || '📋'}</span>
                <span class="pec-card-name">${escHtml(pec.nome)}</span>
                ${expText ? `<span class="pec-card-exp ${expClass}">${expText}</span>` : ''}
            </div>
            <div class="pec-card-desc">${escHtml(pec.descricao || '').substring(0, 150)}${(pec.descricao || '').length > 150 ? '...' : ''}</div>
            ${levelSelectorHtml}
        </div>
    `;
}

function togglePeculiarity2(pecId) {
    const idx = wizardState.peculiaridadesIndividuais.findIndex(p => p.id === pecId);
    const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
    if (!pec) return;

    const expInfo = getExpInfo(pec);
    const isVantagem = pec.ehVantagem === true;

    if (idx >= 0) {
        // === DESSELECIONAR: reverter a mecânica ===
        wizardState.peculiaridadesIndividuais.splice(idx, 1);
        ExpTracker.removeSource('pec_' + pecId);

        // Update card UI
        document.querySelectorAll(`[data-pec-id="${pecId}"]`).forEach(card => {
            card.classList.remove('selected');
            const selector = card.querySelector('.pec-level-selector');
            if (selector) selector.remove();
        });
    } else {
        // === SELECIONAR: aplicar a mecânica ===

        // Calcular quanto EXP vai mudar
        let expDelta = 0;
        if (expInfo.expAmount > 0) {
            if (isVantagem) {
                // Vantagem: custa EXP (subtrai do total)
                expDelta = -expInfo.expAmount;
            } else {
                // Desvantagem: concede EXP (soma ao total)
                expDelta = expInfo.expAmount;
            }
        }

        // Verificar se EXP ficaria negativo
        if (expDelta < 0) {
            const futureTotal = ExpTracker.getTotal() + expDelta;
            if (futureTotal < 0) {
                showWizardToast(`⚠️ EXP insuficiente! Faltam ${Math.abs(futureTotal)} EXP para esta vantagem.`, 'error');
                return;
            }
        }

        // Adicionar ao estado
        wizardState.peculiaridadesIndividuais.push({ id: pecId, nome: pec.nome, nivel: 1 });

        // Aplicar EXP
        if (expDelta !== 0) {
            const label = isVantagem ? `Vantagem: ${pec.nome}` : `Desvantagem: ${pec.nome}`;
            ExpTracker.addSource('pec_' + pecId, expDelta, label);
        }

        // Update card UI
        document.querySelectorAll(`[data-pec-id="${pecId}"]`).forEach(card => {
            card.classList.add('selected');

            // Inject level selector if needed
            if (pec.tipo === 'evolutivo' && pec.nivelMax > 1 && !card.querySelector('.pec-level-selector')) {
                const selectorDiv = document.createElement('div');
                selectorDiv.className = 'pec-level-selector';
                selectorDiv.onclick = (e) => e.stopPropagation();
                let btns = '';
                for (let i = 1; i <= pec.nivelMax; i++) {
                    btns += `<button class="pec-level-btn ${i <= 1 ? 'active' : ''}" onclick="setPecLevel('${pec.id}', ${i})" title="Nível ${i}">${i}</button>`;
                }
                selectorDiv.innerHTML = btns;
                card.appendChild(selectorDiv);
            }
        });
    }

    saveWizardToStorage();
}

function setPecLevel(pecId, level) {
    const pecState = wizardState.peculiaridadesIndividuais.find(p => p.id === pecId);
    if (!pecState) return;

    const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
    if (!pec) return;

    const isVantagem = pec.ehVantagem === true;
    const expInfo = getExpInfo(pec);
    const oldLevel = pecState.nivel || 1;

    // Each level costs/grants the same expAmount (multiply by level)
    const newTotalExp = expInfo.expAmount * level;
    const oldTotalExp = expInfo.expAmount * oldLevel;

    // Calculate the delta from old level to new level
    let newDelta = 0;
    if (isVantagem) {
        newDelta = -newTotalExp;
    } else {
        newDelta = newTotalExp;
    }

    // Check if EXP would go below 0
    if (isVantagem && newTotalExp > 0) {
        // Remove current source to check available
        const currentSource = wizardState.expSources['pec_' + pecId];
        const currentDelta = currentSource ? currentSource.amount : 0;
        const futureTotal = ExpTracker.getTotal() - currentDelta + newDelta;
        if (futureTotal < 0) {
            showWizardToast(`⚠️ EXP insuficiente para nível ${level}. Faltam ${Math.abs(futureTotal)} EXP.`, 'error');
            return;
        }
    }

    // Update level
    pecState.nivel = level;

    // Update EXP source
    if (newDelta !== 0) {
        const label = isVantagem
            ? `Vantagem: ${pec.nome} Nv.${level}`
            : `Desvantagem: ${pec.nome} Nv.${level}`;
        ExpTracker.addSource('pec_' + pecId, newDelta, label);
    }

    // Update level button UI
    document.querySelectorAll(`[data-pec-id="${pecId}"] .pec-level-btn`).forEach(btn => {
        const btnLevel = parseInt(btn.textContent);
        btn.classList.toggle('active', btnLevel <= level);
    });

    saveWizardToStorage();
}
