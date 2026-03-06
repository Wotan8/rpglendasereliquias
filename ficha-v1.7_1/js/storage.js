/* ===== AUTOSAVE, GATHER DATA, SAVE/LOAD ===== */

let saveTimeout = null;
function scheduleAutosave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToStorage();
        if (typeof window.saveToFirebase === 'function') window.saveToFirebase();
    }, 1500);
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.key) scheduleAutosave(); });

function gatherData() {
    const d = { dots: state.dots, notes: state.notes, charImg: state.charImg, fields: {}, specs: [], locacoes: [], rituais: [], ritos: [], mecanicasAplicadas: state.mecanicasAplicadas || {}, fieldBaseValues: state.fieldBaseValues || {}, appliedFieldBonuses: state.appliedFieldBonuses || {} };
    document.querySelectorAll('[data-key]').forEach(el => {
        // Salvar o valor do DOM como está (incluindo edições manuais do usuário).
        // O sistema de appliedFieldBonuses garante que o bônus não será re-aplicado no reload.
        d.fields[el.dataset.key] = el.value || '';
    });
    document.querySelectorAll('.spec-item').forEach(item => {
        const inp = item.querySelector('input[data-key]');
        const dotsEl = item.querySelector('.dots5');
        if (inp && dotsEl) { d.specs.push({ name: inp.value, dotsKey: dotsEl.dataset.attr, level: state.dots[dotsEl.dataset.attr] || 0 }); }
    });
    // Gather loções
    document.querySelectorAll('.receita-item').forEach(item => {
        const id = item.dataset.locaoId;
        d.locacoes.push({
            name: (item.querySelector(`[data-lkey="locao_name_${id}"]`) || {}).value || '',
            tipo: (item.querySelector(`[data-lkey="locao_tipo_${id}"]`) || {}).value || '',
            duracao: (item.querySelector(`[data-lkey="locao_duracao_${id}"]`) || {}).value || '',
            custo: (item.querySelector(`[data-lkey="locao_custo_${id}"]`) || {}).value || '',
            redutor: (item.querySelector(`[data-lkey="locao_redutor_${id}"]`) || {}).value || '',
            dosagem: (item.querySelector(`[data-lkey="locao_dosagem_${id}"]`) || {}).value || '',
            ingredientes: (item.querySelector(`[data-lkey="locao_ingred_${id}"]`) || {}).value || '',
            efeito: (item.querySelector(`[data-lkey="locao_efeito_${id}"]`) || {}).value || ''
        });
    });
    // Gather runas preparadas
    document.querySelectorAll('.runa-card').forEach((card, idx) => {
        d.runasPrep = d.runasPrep || [];
        const runa = {
            name: (card.querySelector(`[data-rpkey="rp_name_${idx}"]`) || {}).value || '',
            alvo: (card.querySelector(`[data-rpkey="rp_alvo_${idx}"]`) || {}).value || '',
            qtd: (card.querySelector(`[data-rpkey="rp_qtd_${idx}"]`) || {}).value || '',
            suporte: (card.querySelector(`[data-rpkey="rp_suporte_${idx}"]`) || {}).value || '',
            efeito: (card.querySelector(`[data-rpkey="rp_efeito_${idx}"]`) || {}).value || '',
            notas: (card.querySelector(`[data-rpkey="rp_notas_${idx}"]`) || {}).value || '',
            comps: []
        };
        card.querySelectorAll('.runa-comp-row').forEach(row => {
            runa.comps.push({
                name: (row.querySelector('input') || {}).value || '',
                cat: (row.querySelector('select') || {}).value || ''
            });
        });
        d.runasPrep.push(runa);
    });
    // Gather estudos
    document.querySelectorAll('.estudo-row').forEach((item, idx) => {
        d.estudos = d.estudos || [];
        d.estudos.push({
            name: (item.querySelector(`[data-eskey="es_name_${idx}"]`) || {}).value || '',
            tipo: (item.querySelector(`[data-eskey="es_tipo_${idx}"]`) || {}).value || '',
            nivel: (item.querySelector(`[data-eskey="es_nivel_${idx}"]`) || {}).value || '',
            progAtual: (item.querySelector(`[data-eskey="es_prog_atual_${idx}"]`) || {}).value || '',
            progTotal: (item.querySelector(`[data-eskey="es_prog_total_${idx}"]`) || {}).value || ''
        });
    });
    // Gather sigilus
    document.querySelectorAll('.sigilus-item').forEach(item => {
        d.sigilus = d.sigilus || [];
        const dotsEl = item.querySelector('.dots3');
        const dk = item.dataset.dotsKey;
        d.sigilus.push({
            name: (item.querySelector('input') || {}).value || '',
            cat: (item.querySelector('select') || {}).value || '',
            dotsKey: dk,
            level: state.dots[dk] || 0
        });
    });
    // Gather rituais
    document.querySelectorAll('.ritual-item').forEach(item => {
        const id = item.dataset.ritualId;
        const ritual = {
            name: (item.querySelector(`[data-rkey="ritual_name_${id}"]`) || {}).value || '',
            objetivo: (item.querySelector(`[data-rkey="ritual_obj_${id}"]`) || {}).value || '',
            requer: (item.querySelector(`[data-rkey="ritual_req_${id}"]`) || {}).value || '',
            custo: (item.querySelector(`[data-rkey="ritual_custo_${id}"]`) || {}).value || '',
            tempo: (item.querySelector(`[data-rkey="ritual_tempo_${id}"]`) || {}).value || '',
            alcance: (item.querySelector(`[data-rkey="ritual_alcance_${id}"]`) || {}).value || '',
            quando: (item.querySelector(`[data-rkey="ritual_quando_${id}"]`) || {}).value || '',
            passos: []
        };
        item.querySelectorAll('.ritual-step').forEach((step, pi) => {
            ritual.passos.push({
                name: (step.querySelector(`[data-rskey="ritual_${id}_step_name_${pi}"]`) || {}).value || '',
                desc: (step.querySelector(`[data-rskey="ritual_${id}_step_desc_${pi}"]`) || {}).value || ''
            });
        });
        d.rituais.push(ritual);
    });
    // Gather ritos
    document.querySelectorAll('.rito-item').forEach(item => {
        const id = item.dataset.ritoId;
        d.ritos.push({
            name: (item.querySelector(`[data-rtkey="rito_name_${id}"]`) || {}).value || '',
            teste: (item.querySelector(`[data-rtkey="rito_teste_${id}"]`) || {}).value || '',
            redutor: (item.querySelector(`[data-rtkey="rito_redutor_${id}"]`) || {}).value || '',
            custo: (item.querySelector(`[data-rtkey="rito_custo_${id}"]`) || {}).value || '',
            efeito: (item.querySelector(`[data-rtkey="rito_efeito_${id}"]`) || {}).value || '',
            falha: (item.querySelector(`[data-rtkey="rito_falha_${id}"]`) || {}).value || ''
        });
    });
    // Gather customTests (values might have changed)
    // We already have state.customTests, but we should ensure values are up to date from DOM if valid
    // Actually, input listeners update state.customTests directly, so we can just save valid objects.
    d.customTests = state.customTests || [];
    d.mainTestsOrder = state.mainTestsOrder || [];
    d.testColors = state.testColors || {};

    // Gather peculiaridade levels
    d.peculiaridadeLevels = {};
    const raca = document.getElementById('selRaca').value;
    if (raca && window.RACES && window.RACES[raca]) {
        window.RACES[raca].peculiaridades.forEach(pec => {
            if (pec.tipo === 'evolutivo') {
                const savedLevel = state.dots['pec_' + pec.key] || pec.nivelAtual;
                d.peculiaridadeLevels[pec.key] = savedLevel;
            }
        });
    }
    // Gather derived current values
    d.derivedValues = {
        vit_atual: (document.querySelector('[data-key="vit_atual"]') || {}).value || '',
        det_atual: (document.querySelector('[data-key="det_atual"]') || {}).value || '',
        san_atual: (document.querySelector('[data-key="san_atual"]') || {}).value || '',
        blindagem: (document.querySelector('[data-key="blindagem"]') || {}).value || '',
    };
    return d;
}

function saveToStorage() { const d = gatherData(); try { const storageKey = 'lr_ficha_v17_' + (window.currentCharacterId || 'default'); localStorage.setItem(storageKey, JSON.stringify(d)); document.querySelectorAll('#classResourcesGrid [data-key]').forEach(el => { localStorage.setItem('lr_' + el.dataset.key, el.value); }); } catch (e) { } }

/* ===== LOAD FROM DATA (reusável: chamada do localStorage e do Firebase) ===== */
function loadFromData(d) {
    try {
        if (d.dots) { state.dots = d.dots; document.querySelectorAll('.dots5[data-attr]').forEach(c => refreshDots(c, c.dataset.attr)); }
        if (d.fields) Object.entries(d.fields).forEach(([k, v]) => { const el = document.querySelector(`[data-key="${k}"]`); if (el) el.value = v; });
        if (d.notes) { state.notes = d.notes; renderNotes(); }
        if (d.charImg) { state.charImg = d.charImg; const img = document.getElementById('charImgPreview'); img.src = state.charImg; img.style.display = 'block'; document.getElementById('charImgPlaceholder').style.display = 'none'; }
        if (d.specs && d.specs.length) { d.specs.forEach(s => { const item = addSpec(s.name, s.dotsKey); if (s.level) { state.dots[s.dotsKey] = s.level; const dotsEl = item.querySelector('.dots5'); if (dotsEl) refreshDots(dotsEl, s.dotsKey); } }); }
        if (d.locacoes) state.locacoes = d.locacoes;
        if (d.rituais) state.rituais = d.rituais;
        if (d.ritos) state.ritos = d.ritos;
        if (d.sigilus) state.sigilus = d.sigilus;
        if (d.runasPrep) state.runasPrep = d.runasPrep;
        if (d.estudos) state.estudos = d.estudos;

        // Restore custom tests and order
        if (d.customTests) state.customTests = d.customTests;
        if (d.mainTestsOrder) state.mainTestsOrder = d.mainTestsOrder;
        if (d.testColors) state.testColors = d.testColors;

        if (d.peculiaridadeLevels) {
            Object.entries(d.peculiaridadeLevels).forEach(([key, level]) => {
                state.dots['pec_' + key] = level;
            });
        }
        // Restore mecanicasAplicadas
        if (d.mecanicasAplicadas) state.mecanicasAplicadas = d.mecanicasAplicadas;
        // Restore fieldBaseValues e appliedFieldBonuses
        if (d.fieldBaseValues) state.fieldBaseValues = d.fieldBaseValues;
        else state.fieldBaseValues = {};
        if (d.appliedFieldBonuses) state.appliedFieldBonuses = d.appliedFieldBonuses;
        else state.appliedFieldBonuses = {};

        onClassChange();
        onRaceChange();

        // Force render main tests with restored data
        const cl = document.getElementById('selClasse').value;
        if (typeof renderMainTests === 'function') renderMainTests(cl);

        setTimeout(() => { document.querySelectorAll('.dots5[data-attr]').forEach(c => refreshDots(c, c.dataset.attr)); }, 50);
        // Recalcular valores derivados e inicializar listeners
        if (typeof initDerivedListeners === 'function') initDerivedListeners();
        if (typeof recalcAll === 'function') setTimeout(recalcAll, 100);
    } catch (e) { console.error('loadFromData error:', e); }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem('lr_ficha_v17_' + (window.currentCharacterId || 'default')); if (!raw) return;
        const d = JSON.parse(raw);
        loadFromData(d);
    } catch (e) { console.error(e); }
}

