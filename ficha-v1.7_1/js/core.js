/* ===== CORE: Tabs, Dots, Skills, Class Change, Specs, Tests ===== */

function initTabs() { document.querySelectorAll('.tab').forEach(b => { b.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); }); }); }

function initDots() {
    document.querySelectorAll('.dots5[data-attr]').forEach(c => {
        const k = c.dataset.attr; state.dots[k] = state.dots[k] || 0;
        for (let i = 1; i <= 5; i++) { const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = i; d.title = 'Nível ' + i; d.addEventListener('click', () => { state.dots[k] = (state.dots[k] === i) ? i - 1 : i; refreshDots(c, k); scheduleAutosave(); if (typeof recalcAll === 'function') recalcAll(); if (typeof recalcMainTests === 'function') recalcMainTests(); }); c.appendChild(d); }
        refreshDots(c, k);
    });
}
function refreshDots(c, k) { const v = state.dots[k] || 0; c.querySelectorAll('.dot').forEach(d => { d.classList.toggle('filled', +d.dataset.val <= v); }); }
function createDotsHTML(k) {
    state.dots[k] = state.dots[k] || 0;
    const div = document.createElement('div'); div.className = 'dots5'; div.dataset.attr = k;
    for (let i = 1; i <= 5; i++) { const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = i; d.title = 'Nível ' + i; d.addEventListener('click', () => { state.dots[k] = (state.dots[k] === i) ? i - 1 : i; refreshDots(div, k); scheduleAutosave(); if (typeof recalcAll === 'function') recalcAll(); if (typeof recalcMainTests === 'function') recalcMainTests(); }); div.appendChild(d); }
    refreshDots(div, k); return div;
}

function initSkills() {
    renderBlock('skillsMental', SKILLS.mental, 'sk_mental_');
    renderBlock('skillsFisico', SKILLS.fisico, 'sk_fisico_');
    renderBlock('skillsSocial', SKILLS.social, 'sk_social_');
    renderBlock('skillsCombate', SKILLS.combate, 'sk_combate_');
}
function renderBlock(id, skills, pfx) {
    const c = document.getElementById(id);
    skills.forEach(s => {
        const row = document.createElement('div'); row.className = 'sk-row';
        const lbl = document.createElement('div'); lbl.className = 'sk-label';
        lbl.innerHTML = `<div class="sk-name">${s.name}</div><div class="sk-attr">${s.sub}</div>`;
        row.appendChild(lbl); row.appendChild(createDotsHTML(pfx + s.key)); c.appendChild(row);
    });
}

function onClassChange() {
    const cl = document.getElementById('selClasse').value;
    const g = document.getElementById('classSkillsGrid'), h = document.getElementById('classSkillsHint');
    const title = document.getElementById('classSkillBlockTitle');
    g.innerHTML = '';
    if (cl && CLASS_SKILLS[cl]) {
        h.style.display = 'none';
        title.textContent = cl;
        CLASS_SKILLS[cl].forEach(sk => {
            const key = 'sk_classe_' + sk.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const row = document.createElement('div'); row.className = 'sk-row';
            const lbl = document.createElement('div'); lbl.className = 'sk-label';
            lbl.innerHTML = `<div class="sk-name">${sk}</div><div class="sk-attr">Classe</div>`;
            row.appendChild(lbl); row.appendChild(createDotsHTML(key)); g.appendChild(row);
        });
    } else {
        h.style.display = '';
        title.textContent = 'Classe';
    }

    /* Resources */
    const resSection = document.getElementById('classResourcesSection');
    const resGrid = document.getElementById('classResourcesGrid');
    const extraRes = document.getElementById('classExtraResources');
    resGrid.innerHTML = ''; extraRes.innerHTML = '';

    const res = (cl && CLASS_RESOURCES[cl]) ? CLASS_RESOURCES[cl] : [];
    if (res.length > 0 || (cl === 'Caçador') || (cl === 'Druida') || (cl === 'Adepto') || (cl === 'Invocador') || (cl === 'Pallacerdote') || (cl === 'Runimago')) {
        resSection.style.display = '';
    } else {
        resSection.style.display = 'none';
    }

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
    item.appendChild(createDotsHTML(dk));
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
