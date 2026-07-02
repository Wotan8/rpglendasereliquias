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
    const d = { dots: state.dots, notes: state.notes, charImg: state.charImg, fields: {}, locacoes: [], rituais: [], ritos: [], mecanicasAplicadas: state.mecanicasAplicadas || {}, fieldBaseValues: state.fieldBaseValues || {}, appliedFieldBonuses: state.appliedFieldBonuses || {}, derivedOverrides: state.derivedOverrides || {}, auras: state.auras || {}, expApplied: state.expApplied || {}, dvAtual: state.dvAtual || {}, peculiaridadesIndividuais: state.peculiaridadesIndividuais || [], partesDoCorpo: state.partesDoCorpo || [] };
    document.querySelectorAll('[data-key]').forEach(el => {
        // Salvar o valor do DOM como está (incluindo edições manuais do usuário).
        // O sistema de appliedFieldBonuses garante que o bônus não será re-aplicado no reload.
        d.fields[el.dataset.key] = el.value || '';
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
    // Gather class module data
    d.classModuleData = typeof gatherClassModuleData === 'function'
        ? gatherClassModuleData()
        : (state.classModuleData || {});
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

        onClassChange();
        onRaceChange();
        if (typeof onTriboChange === 'function') onTriboChange();

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
