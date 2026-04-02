/* ===== CORE: Tabs, Dots, Skills, Class Change, Specs, Tests ===== */

function initTabs() { document.querySelectorAll('.tab').forEach(b => { b.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); }); }); }

/**
 * Handler centralizado para clicks de dots com EXP.
 * @param {HTMLElement} container - o .dots5
 * @param {string} k - dotKey
 * @param {number} clickedVal - nível clicado (1-5)
 * @param {string} [specName] - nome da especialização (se for spec)
 */
function handleDotUpgrade(container, k, clickedVal, specName) {
    const current = state.dots[k] || 0;

    // Se click ≤ nível atual → nada acontece
    if (clickedVal <= current) return;

    // Só permite subir 1 nível por vez
    const newLevel = current + 1;
    if (clickedVal !== newLevel) {
        if (typeof showUpgradeBlocked === 'function')
            showUpgradeBlocked(`Só é possível subir 1 nível por vez! Nível atual: ${current}, próximo: ${newLevel}.`);
        return;
    }

    const type = typeof detectDotType === 'function' ? detectDotType(k) : null;
    if (!type) {
        // Fallback: validar cap antes de permitir
        const mechBonus = state.mechanicBonuses?.[k] || 0;
        const limit = state.mechanicLimits?.[k];
        const maxLevel = (limit && limit.tipo === 'maximo' && limit.max != null) ? limit.max : 5;
        if (newLevel + mechBonus > maxLevel) {
            if (typeof showUpgradeBlocked === 'function')
                showUpgradeBlocked(`Já está no máximo! (${state.dots[k] || 0} + ${mechBonus} = ${(state.dots[k] || 0) + mechBonus}/${maxLevel})`);
            return;
        }
        state.dots[k] = newLevel;
        refreshDots(container, k); scheduleAutosave();
        // Re-evaluate all mechanics (equations may reference this dot value)
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
        return;
    }

    const check = canUpgrade(k, newLevel, type, specName);
    if (!check.allowed) {
        showUpgradeBlocked(check.reason);
        return;
    }

    // Obter label legível para a confirmação
    const label = getDotLabel(k, container, specName);

    showUpgradeConfirm(label, newLevel, check.cost, () => {
        spendExp(check.cost);
        state.dots[k] = newLevel;
        refreshDots(container, k);
        scheduleAutosave();
        // Re-evaluate all mechanics (equations may reference this dot value)
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
        showUpgradeSuccess(label, newLevel, check.cost);
    });
}

/** Obtém nome legível do parâmetro pela UI */
function getDotLabel(k, container, specName) {
    if (specName) return specName || 'Especialização';
    // Tenta achar label no sk-row pai ou attr-item pai
    const parent = container.closest('.sk-row, .attr-item, .spec-item');
    if (parent) {
        const nameEl = parent.querySelector('.sk-name, .abbr');
        if (nameEl) return nameEl.textContent.trim();
        const inp = parent.querySelector('input[data-key]');
        if (inp && inp.value) return inp.value;
    }
    return k.replace(/^(attr_|sk_\w+_|spec_)/, '').replace(/_/g, ' ');
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
function refreshDots(c, k) { const v = state.dots[k] || 0; c.querySelectorAll('.dot').forEach(d => { d.classList.toggle('filled', +d.dataset.val <= v); }); }
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

    /* Testes Principais por Classe */
    if (typeof renderMainTests === 'function') renderMainTests(cl);

    /* Atualizar grid de Valores Derivados (classe pode adicionar novos valores) */
    if (typeof renderDerivedValuesGrid === 'function') renderDerivedValuesGrid();
    if (typeof recalcAll === 'function') recalcAll();

    scheduleAutosave();
}

/* SPECIALIZATIONS */
function addSpec(name, dotsKey) {
    const c = document.getElementById('specContainer');
    const i = specCount++;
    const dk = dotsKey || ('spec_' + i);
    const item = document.createElement('div'); item.className = 'spec-item'; item.dataset.specId = i;
    const inp = document.createElement('input'); inp.type = 'text'; inp.dataset.key = 'spec_name_' + i; inp.placeholder = 'Ex: Espadas (Arma)';
    if (name) inp.value = name;
    inp.addEventListener('input', scheduleAutosave);
    item.appendChild(inp);

    // Criar dots com referência dinâmica ao nome da especialização
    state.dots[dk] = state.dots[dk] || 0;
    const dotsDiv = document.createElement('div'); dotsDiv.className = 'dots5'; dotsDiv.dataset.attr = dk;
    for (let lvl = 1; lvl <= 5; lvl++) {
        const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = lvl; d.title = 'Nível ' + lvl;
        d.addEventListener('click', () => handleDotUpgrade(dotsDiv, dk, lvl, inp.value));
        dotsDiv.appendChild(d);
    }
    refreshDots(dotsDiv, dk);
    item.appendChild(dotsDiv);

    const rm = document.createElement('button'); rm.className = 'rm-spec no-print'; rm.textContent = '✕';
    rm.addEventListener('click', () => { item.remove(); scheduleAutosave(); });
    item.appendChild(rm);
    c.appendChild(item);
    return item;
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
