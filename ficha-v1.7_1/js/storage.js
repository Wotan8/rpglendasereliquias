/* ===== AUTOSAVE, GATHER DATA, SAVE/LOAD ===== */

let saveTimeout = null;
function scheduleAutosave() {
    // GUARD: Nunca salvar antes dos dados estarem carregados!
    if (!window._dataReady) {
        console.log('⏳ scheduleAutosave BLOQUEADO — dados ainda não carregados.');
        return;
    }
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToStorage();
        if (typeof window.saveToFirebase === 'function') window.saveToFirebase();
    }, 1500);
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.key) scheduleAutosave(); });

function gatherData() {
    const d = { dots: state.dots, notes: state.notes, charImg: state.charImg, fields: {}, mecanicasAplicadas: state.mecanicasAplicadas || {}, fieldBaseValues: state.fieldBaseValues || {}, appliedFieldBonuses: state.appliedFieldBonuses || {}, derivedOverrides: state.derivedOverrides || {}, derivedModifiers: state.derivedModifiers || {}, auras: state.auras || {}, expApplied: state.expApplied || {}, dvAtual: state.dvAtual || {}, peculiaridadesIndividuais: state.peculiaridadesIndividuais || [], partesDoCorpo: state.partesDoCorpo || [] };
    document.querySelectorAll('[data-key]').forEach(el => {
        // Salvar o valor do DOM como está (incluindo edições manuais do usuário).
        // O sistema de appliedFieldBonuses garante que o bônus não será re-aplicado no reload.
        d.fields[el.dataset.key] = el.value || '';
    });

    // Atributos e perícias com bônus, pisos e tetos de mecânicas já aplicados.
    // state.mechanicBonuses é recalculado a cada carga e nunca foi persistido, então
    // quem lê a ficha de fora (Laboratorium) enxergava só os pontos comprados e perdia
    // os níveis concedidos por mecânica. Reusa getEffectiveDotValue para não duplicar regra.
    d.effectiveDots = {};
    if (typeof getEffectiveDotValue === 'function') {
        const keys = new Set([
            ...Object.keys(state.dots || {}),
            ...Object.keys(state.mechanicBonuses || {}),
            ...Object.keys(state.mechanicLimits || {}),
        ].filter(k => /^(attr_|sk_)/.test(k)));
        keys.forEach(k => { d.effectiveDots[k] = getEffectiveDotValue(k); });
    }


    // Gather customTests (values might have changed)
    // We already have state.customTests, but we should ensure values are up to date from DOM if valid
    // Actually, input listeners update state.customTests directly, so we can just save valid objects.
    d.customTests = state.customTests || [];
    d.mainTestsOrder = state.mainTestsOrder || [];
    d.testColors = state.testColors || {};
    d.conditions = state.conditions || [];

    // Gather peculiaridade levels (race, class, tribe)
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
    const classe = document.getElementById('selClasse')?.value;
    if (classe && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[classe]) {
        window.CLASS_PECULIARITIES[classe].forEach(pec => {
            if (pec.tipo === 'evolutivo') {
                const savedLevel = state.dots['pec_' + pec.key] || pec.nivelAtual;
                d.peculiaridadeLevels[pec.key] = savedLevel;
            }
        });
    }
    const tribo = document.getElementById('selTribo')?.value;
    if (tribo && window.TRIBES && window.TRIBES[tribo]) {
        (window.TRIBES[tribo].peculiaridades || []).forEach(pec => {
            if (pec.tipo === 'evolutivo') {
                const savedLevel = state.dots['pec_' + pec.key] || pec.nivelAtual;
                d.peculiaridadeLevels[pec.key] = savedLevel;
            }
        });
    }
    // Gather derived current values
    d.derivedValues = {
        vit_atual: (document.querySelector('[data-key="vit_atual"]') || {}).value || '',
        ener_atual: (document.querySelector('[data-key="ener_atual"]') || {}).value || '',
        san_atual: (document.querySelector('[data-key="san_atual"]') || {}).value || '',
        blindagem: (document.querySelector('[data-key="blindagem"]') || {}).value || '',
    };

    // ===== Espelhar Status Vitais como campos de topo =====
    // Permite que módulos externos (Combate, Tabuleiro HUD) leiam os
    // valores máximos e atuais sem replicar o motor de mecânicas.
    const _derived = (typeof state !== 'undefined' && state.derived) || {};
    const _vitalStats = window.VITAL_STATS || [];
    const _findVitalMax = (sigla) => {
        // 1) Busca pela chaveInterna exata (ex: VIT_MAX)
        const vs = _vitalStats.find(v => v.key === sigla + '_MAX');
        if (vs) return _derived[vs.key] ?? null;
        // 2) Busca por key parcial em state.derived
        for (const k of Object.keys(_derived)) {
            if (k.startsWith(sigla) && k.endsWith('_MAX')) return _derived[k];
        }
        // 3) Busca via DERIVED_FIELDS_MAP (display DOM fallback)
        const mapEntry = { VIT: 'vit_max_display', ENER: 'ener_max_display', SAN: 'san_max_display' }[sigla];
        if (mapEntry) {
            const el = document.getElementById(mapEntry);
            if (el && el.value !== '' && el.value !== '0') return parseFloat(el.value) || null;
        }
        return null;
    };
    const _parseAtual = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    const hpMax = _findVitalMax('VIT');
    const enerMax = _findVitalMax('ENER');
    const sanMax = _findVitalMax('SAN');
    if (hpMax !== null) d.hpMax = hpMax;
    if (enerMax !== null) d.enerMax = enerMax;
    if (sanMax !== null) d.sanMax = sanMax;
    const hpCur = _parseAtual(d.derivedValues.vit_atual);
    const enerCur = _parseAtual(d.derivedValues.ener_atual);
    const sanCur = _parseAtual(d.derivedValues.san_atual);
    if (hpCur !== null) d.hpCurrent = hpCur;
    if (enerCur !== null) d.enerCurrent = enerCur;
    if (sanCur !== null) d.sanCurrent = sanCur;

    // ===== Espelhar TODOS os Valores Derivados calculados =====
    // Mesma razão do espelho dos Status Vitais acima: módulos externos (Tabuleiro,
    // Combate) precisam ler VDs prontos sem replicar o motor de mecânicas. O
    // Tabuleiro usa PERCEPCAO_VISUAL / PERCEPCAO para o alcance de visão do token.
    // Chave = dv.key (nome sem acento, maiúsculas). Só números, nada de undefined
    // (o Firestore recusa) e nada de NaN.
    d.derivedTotals = {};
    for (const [k, v] of Object.entries(_derived)) {
        const n = typeof v === 'number' ? v : parseFloat(v);
        if (!isNaN(n)) d.derivedTotals[k] = n;
    }
    // Gather class module data
    d.classModuleData = typeof gatherClassModuleData === 'function'
        ? gatherClassModuleData()
        : (state.classModuleData || {});
    // ᛟ Runomancia (Lista de Estudo, elementos aprendidos e Grimório)
    d.runomancia = typeof gatherRunomanciaData === 'function'
        ? gatherRunomanciaData()
        : (state.runomancia || { estudos: [], aprendidos: {}, grimorio: [] });
    return d;
}

function saveToStorage() {
    // GUARD: Nunca salvar antes dos dados estarem carregados!
    if (!window._dataReady) {
        console.log('⏳ saveToStorage BLOQUEADO — dados ainda não carregados.');
        return;
    }
    const d = gatherData(); try { const storageKey = 'lr_ficha_v17_' + (window.currentCharacterId || 'default'); localStorage.setItem(storageKey, JSON.stringify(d)); document.querySelectorAll('#classResourcesGrid [data-key]').forEach(el => { localStorage.setItem('lr_' + el.dataset.key, el.value); }); } catch (e) { }
}

/* ===== LOAD FROM DATA (reusável: chamada do localStorage e do Firebase) ===== */
function loadFromData(d) {
    try {
        if (d.dots) { state.dots = d.dots; document.querySelectorAll('.dots5[data-attr]').forEach(c => refreshDots(c, c.dataset.attr)); }
        if (d.fields) Object.entries(d.fields).forEach(([k, v]) => { const el = document.querySelector(`[data-key="${k}"]`); if (el) el.value = v; });
        if (d.notes) { state.notes = d.notes; renderNotes(); }
        if (d.charImg) { state.charImg = d.charImg; const img = document.getElementById('charImgPreview'); img.src = state.charImg; img.style.display = 'block'; document.getElementById('charImgPlaceholder').style.display = 'none'; }

        // ᛟ Runomancia — restaurar antes de onClassChange (que re-renderiza o módulo)
        if (typeof applyRunomanciaData === 'function') applyRunomanciaData(d.runomancia);

        // Restore custom tests and order
        if (d.customTests) state.customTests = d.customTests;
        if (d.mainTestsOrder) state.mainTestsOrder = d.mainTestsOrder;
        if (d.testColors) state.testColors = d.testColors;

        if (d.peculiaridadeLevels) {
            Object.entries(d.peculiaridadeLevels).forEach(([key, level]) => {
                state.dots['pec_' + key] = level;
            });
        }
        if (d.peculiaridadesIndividuais) state.peculiaridadesIndividuais = d.peculiaridadesIndividuais;
        else state.peculiaridadesIndividuais = [];
        // Restore mecanicasAplicadas
        if (d.mecanicasAplicadas) state.mecanicasAplicadas = d.mecanicasAplicadas;
        // Restore fieldBaseValues e appliedFieldBonuses
        if (d.fieldBaseValues) state.fieldBaseValues = d.fieldBaseValues;
        else state.fieldBaseValues = {};
        if (d.appliedFieldBonuses) state.appliedFieldBonuses = d.appliedFieldBonuses;
        else state.appliedFieldBonuses = {};
        if (d.derivedOverrides) state.derivedOverrides = d.derivedOverrides;
        else state.derivedOverrides = {};
        if (d.derivedModifiers) state.derivedModifiers = d.derivedModifiers;
        else state.derivedModifiers = {};
        if (d.auras) state.auras = d.auras;
        else state.auras = {};
        if (d.classModuleData) state.classModuleData = d.classModuleData;
        else state.classModuleData = {};
        if (d.expApplied) state.expApplied = d.expApplied;
        else state.expApplied = {};
        if (d.dvAtual) state.dvAtual = d.dvAtual;
        else state.dvAtual = {};

        // Restore partesDoCorpo
        if (d.partesDoCorpo && d.partesDoCorpo.length > 0) {
            state.partesDoCorpo = d.partesDoCorpo;
            console.log('✅ partesDoCorpo carregado do documento:', state.partesDoCorpo.length, 'parte(s)',
                state.partesDoCorpo.map(bp => bp.nome || bp.id).join(', '));
        } else {
            // Fallback for characters without body parts: load from race, else standard parts
            state.partesDoCorpo = [];
            const racaNome = d.fields && d.fields['raca'] ? d.fields['raca'] : null;
            let partsToLoad = null;

            if (racaNome && window.RACES && window.RACES[racaNome] && window.RACES[racaNome].partesDoCorpo && window.RACES[racaNome].partesDoCorpo.length > 0) {
                partsToLoad = window.RACES[racaNome].partesDoCorpo;
            } else if (window._systemData && window._systemData.bodyParts) {
                partsToLoad = window._systemData.bodyParts.filter(bp => bp.ehPadrao);
            }

            if (partsToLoad) {
                state.partesDoCorpo = JSON.parse(JSON.stringify(partsToLoad));
            }
        }


        // Restore conditions (novo sistema)
        if (d.conditions && Array.isArray(d.conditions)) {
            state.conditions = d.conditions;
        } else {
            state.conditions = [];
            // === MIGRAÇÃO: converter campos antigos cond_name_X / cond_tipo_X / cond_desc_X / cond_tempo_X ===
            if (d.fields) {
                const migrated = [];
                for (let i = 0; i < 50; i++) {
                    const nome = d.fields['cond_name_' + i];
                    if (!nome || !nome.trim()) continue;
                    migrated.push({
                        nome: nome.trim(),
                        descricao: (d.fields['cond_desc_' + i] || '').trim(),
                        tempoAtual: '',
                        tempoRestante: d.fields['cond_tempo_' + i] || '',
                        modeloId: null,
                        efeitoMecanicaIds: [],
                        icone: '💀'
                    });
                }
                if (migrated.length > 0) {
                    state.conditions = migrated;
                    console.log(`🔄 Migradas ${migrated.length} condição(ões) do formato antigo.`);
                }
            }
        }
        if (typeof renderConditions === 'function') renderConditions();

        // === INVENTÁRIO do wizard: carregar itens estruturados ou array de strings ===
        if (d.inventoryItems && Array.isArray(d.inventoryItems) && d.inventoryItems.length > 0) {
            // Structured format (name, desc, qtd) — preferred
            const invContainer = document.getElementById('inventoryContainer');
            if (invContainer) {
                for (const item of d.inventoryItems) {
                    if (!item.name || !item.name.trim()) continue;
                    addInventoryItem();
                    const rows = invContainer.querySelectorAll('.inv-row');
                    const lastRow = rows[rows.length - 1];
                    if (lastRow) {
                        const nameInput = lastRow.querySelector('input[data-key^="inv_name_"]');
                        if (nameInput) nameInput.value = item.name;
                        const descInput = lastRow.querySelector('input[data-key^="inv_desc_"]');
                        if (descInput) descInput.value = item.desc || '';
                        const qtdInput = lastRow.querySelector('input[data-key^="inv_qtd_"]');
                        if (qtdInput) qtdInput.value = item.qtd || '1';
                    }
                }
            }
        } else if (d.equipamento && Array.isArray(d.equipamento) && d.equipamento.length > 0) {
            // Fallback: simple string array (legacy)
            const invContainer = document.getElementById('inventoryContainer');
            if (invContainer) {
                for (const itemName of d.equipamento) {
                    if (!itemName || !itemName.trim()) continue;
                    addInventoryItem();
                    const rows = invContainer.querySelectorAll('.inv-row');
                    const lastRow = rows[rows.length - 1];
                    if (lastRow) {
                        const nameInput = lastRow.querySelector('input[data-key^="inv_name_"]');
                        if (nameInput) nameInput.value = itemName;
                        const qtdInput = lastRow.querySelector('input[data-key^="inv_qtd_"]');
                        if (qtdInput) qtdInput.value = '1';
                    }
                }
            }
        }

        try { onClassChange(); } catch (e) { console.error('Erro em onClassChange:', e); }
        try { onRaceChange(); } catch (e) { console.error('Erro em onRaceChange:', e); }
        if (typeof onTriboChange === 'function') {
            try { onTriboChange(); } catch (e) { console.error('Erro em onTriboChange:', e); }
        }

        // Force render main tests with restored data
        const cl = document.getElementById('selClasse').value;
        if (typeof renderMainTests === 'function') renderMainTests(cl);

        setTimeout(() => { document.querySelectorAll('.dots5[data-attr]').forEach(c => refreshDots(c, c.dataset.attr)); }, 50);
        // Recalcular valores derivados e inicializar listeners
        if (typeof initDerivedListeners === 'function') initDerivedListeners();
        if (typeof initVitalStatsTooltips === 'function') initVitalStatsTooltips();
        if (typeof initSkillTooltips === 'function') initSkillTooltips();
        if (typeof initAttributeTooltips === 'function') initAttributeTooltips();
        // Garantir que mecânicas estejam aplicadas antes de recalcular derivados
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') setTimeout(recalcAll, 150);
        if (typeof renderAurasTab === 'function') setTimeout(renderAurasTab, 200);

        // === Espelho dos Valores Derivados: preencher fichas antigas ao ABRIR ===
        // O Tabuleiro lê `derivedTotals` para o alcance de visão por Percepção.
        // Fichas salvas antes desse campo existir não o têm, e o autosave só
        // dispara no evento `input` — ou seja, dependeria de alguém editar cada
        // ficha. Aqui ela se corrige sozinha na primeira abertura (depois de
        // recalcAll ter populado state.derived) e para de forçar save nas próximas.
        if (!d.derivedTotals || !Object.keys(d.derivedTotals).length) {
            setTimeout(() => {
                if (typeof scheduleAutosave === 'function') scheduleAutosave();
            }, 400);
        }

        // === DESBLOQUEAR SAVES — dados totalmente carregados ===
        window._dataReady = true;
        console.log('✅ _dataReady = true — saves desbloqueados.');
    } catch (e) { console.error('loadFromData error:', e); }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem('lr_ficha_v17_' + (window.currentCharacterId || 'default')); if (!raw) return;
        const d = JSON.parse(raw);
        loadFromData(d);
    } catch (e) { console.error(e); }
}
