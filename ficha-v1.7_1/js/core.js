/* ===== CORE: Tabs, Dots, Skills, Class Change, Tests ===== */

function initTabs() { document.querySelectorAll('.tab').forEach(b => { b.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); }); }); }

/**
 * Handler centralizado para clicks de dots com EXP.
 * @param {HTMLElement} container - o .dots5
 * @param {string} k - dotKey
 * @param {number} clickedVal - nível clicado (1-5)
 */
function handleDotUpgrade(container, k, clickedVal, specName) {
    const current = state.dots[k] || 0;
    const limit = state.mechanicLimits?.[k];
    const mechBonus = state.mechanicBonuses?.[k] || 0;

    // Extract floor and ceiling from limits
    let floorVal = 0;
    let baseCeiling = 5;
    if (limit) {
        if (limit.tipo === 'bloqueio') { baseCeiling = 0; floorVal = 0; }
        else {
            if ((limit.tipo === 'minimo' || limit.tipo === 'clamp') && limit.min != null) floorVal = limit.min;
            if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) baseCeiling = limit.max;
        }
    }

    // === AURA SYSTEM: extend ceiling if aura is active ===
    const auraInfo = typeof getAuraInfoForDot === 'function' ? getAuraInfoForDot(k) : null;
    const baseDots = typeof getPropertyBaseDots === 'function' ? getPropertyBaseDots(k) : baseCeiling;
    let ceiling = baseCeiling;
    if (auraInfo && auraInfo.grauDesbloqueado > 0) {
        ceiling = (auraInfo.grauDesbloqueado + 1) * baseDots;
    }

    // === AURA SYSTEM: map clicked dot value to actual target level ===
    let targetLevel;
    if (auraInfo && auraInfo.grauDesbloqueado > 0) {
        // Calculate current position in grade context
        const totalLevel = current + floorVal;
        const currentGrade = totalLevel > 0 ? Math.floor((totalLevel - 1) / baseDots) : 0;
        const posInGrade = totalLevel > 0 ? ((totalLevel - 1) % baseDots) + 1 : 0;

        if (posInGrade >= baseDots && clickedVal === 1) {
            // Advancing to next grade (all dots filled, click first dot)
            targetLevel = totalLevel + 1;
        } else if (clickedVal === posInGrade + 1) {
            // Normal sequential advance within grade
            targetLevel = totalLevel + 1;
        } else if (posInGrade === 0 && clickedVal === 1) {
            // First dot from zero
            targetLevel = 1;
        } else {
            // Invalid click
            return;
        }

        const newRawLevel = targetLevel - floorVal;
        if (newRawLevel < 0) return;

        // Check ceiling with aura
        const newTotal = newRawLevel + floorVal + mechBonus;
        if (newTotal > ceiling) {
            if (typeof showUpgradeBlocked === 'function')
                showUpgradeBlocked(`Já está no máximo da Aura! (${current + floorVal + mechBonus}/${ceiling})`);
            return;
        }

        const type = typeof detectDotType === 'function' ? detectDotType(k) : null;
        if (!type) {
            state.dots[k] = newRawLevel;
            refreshDots(container, k); scheduleAutosave();
            if (typeof applyAllRaceMechanics === 'function') {
                const raca = document.getElementById('selRaca')?.value;
                applyAllRaceMechanics(raca);
            }
            if (typeof recalcAll === 'function') recalcAll();
            if (typeof recalcMainTests === 'function') recalcMainTests();
            return;
        }

        const check = canUpgrade(k, newRawLevel, type, specName, floorVal);
        if (!check.allowed) { showUpgradeBlocked(check.reason); return; }

        const label = getDotLabel(k, container, specName);
        const displayLevel = newRawLevel + floorVal;
        const newGrade = Math.floor((displayLevel - 1) / baseDots);
        const grauDef = auraInfo.graus.find(g => g.grau === newGrade);
        const grauName = grauDef?.nomeGrau ? ` (${grauDef.nomeGrau})` : '';
        showUpgradeConfirm(`${label}${grauName}`, displayLevel, check.cost, () => {
            spendExp(check.cost);
            state.dots[k] = newRawLevel;
            refreshDots(container, k); scheduleAutosave();
            if (typeof applyAllRaceMechanics === 'function') {
                const raca = document.getElementById('selRaca')?.value;
                applyAllRaceMechanics(raca);
            }
            if (typeof recalcAll === 'function') recalcAll();
            if (typeof recalcMainTests === 'function') recalcMainTests();
            showUpgradeSuccess(`${label}${grauName}`, displayLevel, check.cost);
        });
        return;
    }

    // --- Standard (non-aura) flow ---
    const filledForClick = current + floorVal;
    if (clickedVal <= filledForClick) return;

    if (ceiling <= 0) {
        if (typeof showUpgradeBlocked === 'function')
            showUpgradeBlocked('Esta propriedade está bloqueada (= 0).');
        return;
    }

    const nextClickLevel = filledForClick + 1;
    if (clickedVal !== nextClickLevel) {
        if (typeof showUpgradeBlocked === 'function')
            showUpgradeBlocked(`Só é possível subir 1 nível por vez! Nível base+piso: ${filledForClick}, próximo: ${nextClickLevel}.`);
        return;
    }

    const newRawLevel = current + 1;
    const newTotal = newRawLevel + floorVal + mechBonus;
    if (newTotal > ceiling) {
        if (typeof showUpgradeBlocked === 'function')
            showUpgradeBlocked(`Já está no máximo! (Base: ${current} + Piso: ${floorVal} + Bônus: ${mechBonus} = ${current + floorVal + mechBonus}/${ceiling})`);
        return;
    }

    const type = typeof detectDotType === 'function' ? detectDotType(k) : null;
    if (!type) {
        state.dots[k] = newRawLevel;
        refreshDots(container, k); scheduleAutosave();
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
        return;
    }

    const check = canUpgrade(k, newRawLevel, type, specName, floorVal);
    if (!check.allowed) { showUpgradeBlocked(check.reason); return; }

    const label = getDotLabel(k, container, specName);
    const displayLevel = newRawLevel + floorVal;
    showUpgradeConfirm(label, displayLevel, check.cost, () => {
        spendExp(check.cost);
        state.dots[k] = newRawLevel;
        refreshDots(container, k); scheduleAutosave();
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
        showUpgradeSuccess(label, displayLevel, check.cost);
    });
}

/** Obtém nome legível do parâmetro pela UI */
function getDotLabel(k, container) {
    // Tenta achar label no sk-row pai ou attr-item pai
    const parent = container.closest('.sk-row, .attr-item');
    if (parent) {
        const nameEl = parent.querySelector('.sk-name, .abbr');
        if (nameEl) return nameEl.textContent.trim();
        const inp = parent.querySelector('input[data-key]');
        if (inp && inp.value) return inp.value;
    }
    return k.replace(/^(attr_|sk_\w+_)/, '').replace(/_/g, ' ');
}

function initDots() {
    document.querySelectorAll('.dots5[data-attr]').forEach(c => {
        const k = c.dataset.attr; state.dots[k] = state.dots[k] || 0;
        for (let i = 1; i <= 5; i++) {
            const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = i; d.title = 'Nível ' + i;
            d.addEventListener('click', () => handleDotUpgrade(c, k, i));
            c.appendChild(d);
        }
        refreshDots(c, k);
    });
}
function refreshDots(c, k) {
    const v = state.dots[k] || 0;
    const auraInfo = typeof getAuraInfoForDot === 'function' ? getAuraInfoForDot(k) : null;
    let finalPrintValue = v;

    if (auraInfo && auraInfo.grauDesbloqueado > 0) {
        const floorVal = _getFloorForRefresh(k);
        finalPrintValue = v + floorVal;
    }
    c.setAttribute('data-print-val', finalPrintValue);

    if (auraInfo && auraInfo.grauDesbloqueado > 0) {
        const baseDots = typeof getPropertyBaseDots === 'function' ? getPropertyBaseDots(k) : 5;
        const floorVal = _getFloorForRefresh(k);
        const totalLevel = v + floorVal;
        const currentGrade = totalLevel > 0 ? Math.floor((totalLevel - 1) / baseDots) : 0;
        const posInGrade = totalLevel > 0 ? ((totalLevel - 1) % baseDots) + 1 : 0;
        const auraColor = typeof getAuraColorForGrade === 'function' ? getAuraColorForGrade(auraInfo.aura, currentGrade) : null;

        c.querySelectorAll('.dot').forEach(d => {
            const val = +d.dataset.val;
            d.classList.remove('filled', 'bonus', 'floor', 'capped', 'aura-filled');
            d.style.removeProperty('--aura-color');

            if (val <= posInGrade) {
                d.classList.add('filled');
                if (auraColor) {
                    d.classList.add('aura-filled');
                    d.style.setProperty('--aura-color', auraColor);
                }
            }
        });

        // Show current grade indicator
        _updateGradeIndicator(c, k, currentGrade, auraInfo, baseDots, totalLevel);
    } else {
        c.querySelectorAll('.dot').forEach(d => {
            d.classList.toggle('filled', +d.dataset.val <= v);
            d.classList.remove('aura-filled');
            d.style.removeProperty('--aura-color');
        });
    }
}

/** Helper: get floor value for refreshDots */
function _getFloorForRefresh(k) {
    const limit = state.mechanicLimits?.[k];
    if (!limit) return 0;
    if ((limit.tipo === 'minimo' || limit.tipo === 'clamp') && limit.min != null) return limit.min;
    return 0;
}

/** Update or create grade indicator badge near the dots */
function _updateGradeIndicator(container, dotKey, currentGrade, auraInfo, baseDots, totalLevel) {
    let indicator = container.parentElement?.querySelector('.aura-grade-indicator');
    if (currentGrade > 0 || totalLevel > baseDots) {
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'aura-grade-indicator';
            container.parentElement?.appendChild(indicator);
        }
        const grauDef = auraInfo.graus.find(g => g.grau === currentGrade);
        const color = grauDef?.cor || '#8b5cf6';
        indicator.textContent = `G${currentGrade} | ${totalLevel}`;
        indicator.style.background = color;
        indicator.title = `Grau ${currentGrade}${grauDef?.nomeGrau ? ': ' + grauDef.nomeGrau : ''} — Nível real: ${totalLevel}`;
    } else if (indicator) {
        indicator.remove();
    }
}
function createDotsHTML(k, specName) {
    state.dots[k] = state.dots[k] || 0;
    const div = document.createElement('div'); div.className = 'dots5'; div.dataset.attr = k;
    for (let i = 1; i <= 5; i++) {
        const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = i; d.title = 'Nível ' + i;
        d.addEventListener('click', () => handleDotUpgrade(div, k, i, specName));
        div.appendChild(d);
    }
    refreshDots(div, k); return div;
}

function initSkills() {
    const filterUniversal = (arr) => (arr || []).filter(s => s.todoPersonagem !== false);
    renderBlock('skillsMental', filterUniversal(SKILLS.mental), 'sk_mental_');
    renderBlock('skillsFisico', filterUniversal(SKILLS.fisico), 'sk_fisico_');
    renderBlock('skillsSocial', filterUniversal(SKILLS.social), 'sk_social_');
    renderBlock('skillsCombate', filterUniversal(SKILLS.combate), 'sk_combate_');
    renderBlock('skillsExclusivo', filterUniversal(SKILLS.exclusivo), 'sk_exclusivo_');
}
function renderBlock(id, skills, pfx) {
    const c = document.getElementById(id);
    if (!c) return;
    skills.forEach(s => {
        const row = document.createElement('div'); row.className = 'sk-row';
        const lbl = document.createElement('div'); lbl.className = 'sk-label';
        const nameSpan = document.createElement('div'); nameSpan.className = 'sk-name'; nameSpan.textContent = s.name;
        const attrSpan = document.createElement('div'); attrSpan.className = 'sk-attr'; attrSpan.textContent = s.sub;

        // Tooltip flutuante com descrição (inicializado por initSkillTooltips)
        if (s.descricao) {
            nameSpan.classList.add('has-tooltip');
        }

        lbl.appendChild(nameSpan);
        lbl.appendChild(attrSpan);
        row.appendChild(lbl); row.appendChild(createDotsHTML(pfx + s.key)); c.appendChild(row);
    });
}



function onClassChange() {
    const cl = document.getElementById('selClasse').value;
    const g = document.getElementById('skillsExclusivo');

    // Remove only class-injected skill rows (preserve Firebase-loaded exclusive skills)
    if (g) g.querySelectorAll('.sk-row[data-class-skill]').forEach(r => r.remove());

    if (cl && CLASS_SKILLS[cl]) {
        CLASS_SKILLS[cl].forEach(sk => {
            const key = 'sk_classe_' + sk.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const row = document.createElement('div'); row.className = 'sk-row'; row.dataset.classSkill = '1';
            const lbl = document.createElement('div'); lbl.className = 'sk-label';
            lbl.innerHTML = `<div class="sk-name">${sk}</div><div class="sk-attr">Classe</div>`;
            row.appendChild(lbl); row.appendChild(createDotsHTML(key)); g.appendChild(row);
        });
    }


    /* Resources */
    const resSection = document.getElementById('classResourcesSection');
    const resGrid = document.getElementById('classResourcesGrid');
    const extraRes = document.getElementById('classExtraResources');
    if (resGrid) resGrid.innerHTML = '';
    if (extraRes) extraRes.innerHTML = '';

    const res = (cl && CLASS_RESOURCES[cl]) ? CLASS_RESOURCES[cl] : [];
    if (res.length > 0 || (cl === 'Caçador') || (cl === 'Druida') || (cl === 'Adepto') || (cl === 'Invocador') || (cl === 'Pallacerdote') || (cl === 'Runimago')) {
        if (resSection) resSection.style.display = '';
    } else {
        if (resSection) resSection.style.display = 'none';
    }

    if (resGrid) {
        res.forEach(r => {
            const box = document.createElement('div'); box.className = 'vital-box';
            if (r.single) {
                box.innerHTML = `<label>${r.label}</label><div class="vital-inputs"><input type="text" data-key="${r.keys[0]}" placeholder="${r.placeholder || '0'}"></div>`;
            } else {
                box.innerHTML = `<label>${r.label}</label><div class="vital-inputs"><input type="text" data-key="${r.keys[0]}" placeholder="0"><span class="sep">/</span><input type="text" data-key="${r.keys[1]}" placeholder="0"></div>`;
            }
            resGrid.appendChild(box);
        });

        // Load saved values for class resources
        resGrid.querySelectorAll('[data-key]').forEach(el => {
            const sv = localStorage.getItem('lr_' + el.dataset.key);
            if (sv) el.value = sv;
            el.addEventListener('input', scheduleAutosave);
        });
    }

    // Extra resources per class
    if (cl === 'Caçador' || cl === 'Druida') {
        renderReceitaLocoes(extraRes);
        renderMarcaCaca(extraRes);
        // reload loções saved
        locaoCount = 0;
        const locoesC = document.getElementById('locoesContainer');
        if (locoesC) { locoesC.innerHTML = ''; state.locacoes.forEach(l => addLocao(l)); }
    }
    if (cl === 'Adepto' || cl === 'Invocador') {
        const sec = document.getElementById('rituaisSection');
        if (sec) { sec.style.display = ''; renderRituais(); }
    } else {
        const sec = document.getElementById('rituaisSection');
        if (sec) sec.style.display = 'none';
    }
    if (cl === 'Runimago') {
        const sec = document.getElementById('runimagoSection');
        if (sec) { sec.style.display = ''; renderRunimago(document.getElementById('runimagoContent')); }
    } else {
        const sec = document.getElementById('runimagoSection');
        if (sec) sec.style.display = 'none';
    }
    if (cl === 'Pallacerdote') {
        renderRitos(extraRes);
        ritoCount = 0;
        const ritosC = document.getElementById('ritosContainer');
        if (ritosC) { ritosC.innerHTML = ''; state.ritos.forEach(r => addRito(r)); }
    }

    /* Testes Opcionais por Classe */
    if (typeof renderMainTests === 'function') renderMainTests(cl);

    /* Módulos de classe dinâmicos (Firebase) */
    if (typeof renderClassModules === 'function') renderClassModules(cl);

    /* Atualizar grid de Valores Derivados (classe pode adicionar novos valores) */
    if (typeof renderDerivedValuesGrid === 'function') renderDerivedValuesGrid();

    /* Peculiaridades de Classe (bonusIniciais) */
    if (typeof renderClassPeculiaridades === 'function') renderClassPeculiaridades(cl);

    /* Peculiaridades Individuais */
    if (typeof renderIndividualPeculiaridades === 'function') renderIndividualPeculiaridades();

    /* Re-aplicar mecânicas (incluindo as de peculiaridades de classe) */
    if (typeof applyAllRaceMechanics === 'function') {
        const raca = document.getElementById('selRaca')?.value;
        applyAllRaceMechanics(raca);
    }
    if (typeof recalcAll === 'function') recalcAll();

    scheduleAutosave();

    /* Bloquear selects se necessário */
    if (typeof lockSelectsIfNeeded === 'function') lockSelectsIfNeeded();
}

/**
 * Handler para mudança de tribo.
 * Renderiza peculiaridades de tribo e aplica mecânicas.
 */
function onTriboChange() {
    const triboNome = document.getElementById('selTribo')?.value || '';

    /* Renderizar peculiaridades de tribo */
    if (typeof renderTriboPeculiaridades === 'function') renderTriboPeculiaridades(triboNome);

    /* Re-aplicar mecânicas (incluindo as de peculiaridades de tribo) */
    if (typeof applyAllRaceMechanics === 'function') {
        const raca = document.getElementById('selRaca')?.value;
        applyAllRaceMechanics(raca);
    }
    if (typeof recalcAll === 'function') recalcAll();

    scheduleAutosave();

    /* Bloquear selects se necessário */
    if (typeof lockSelectsIfNeeded === 'function') lockSelectsIfNeeded();
}



function addTest() {
    // New logic: Use state.customTests
    const id = 'cust_' + Date.now();
    const newTest = {
        id: id,
        name: '',
        formula: '',
        total: ''
    };

    state.customTests.push(newTest);

    // Add to order automatically at the end
    if (!state.mainTestsOrder) state.mainTestsOrder = [];
    state.mainTestsOrder.push(id);

    if (typeof renderMainTests === 'function') {
        const classeEl = document.getElementById('selClasse');
        const cl = classeEl ? classeEl.value : '';
        renderMainTests(cl);
    }

    scheduleAutosave();
}
