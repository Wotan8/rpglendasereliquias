/* ===== CLASS MODULES RENDERER — Renderiza módulos de classe dinâmicos ===== */

/**
 * Injetar CSS de módulos de classe (será movido para styles.css depois).
 */
(function _injectClassModuleStyles() {
    if (document.getElementById('classModulesCSS')) return;
    const style = document.createElement('style');
    style.id = 'classModulesCSS';
    style.textContent = `
        .class-module-section {
            margin-top: 16px;
            border: 1px solid var(--soft, rgba(148,163,184,.12));
            border-radius: 10px;
            background: var(--card, rgba(30,41,59,.55));
            overflow: hidden;
        }
        .class-module-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(139,92,246,.08);
            border-bottom: 1px solid var(--soft, rgba(148,163,184,.12));
        }
        .class-module-header h4 {
            margin: 0;
            font-size: .9rem;
            font-weight: 700;
            color: var(--text, #e2e8f0);
        }
        .class-module-header .module-slots {
            font-size: .75rem;
            color: var(--muted, #94a3b8);
            background: rgba(139,92,246,.15);
            padding: 2px 8px;
            border-radius: 6px;
        }
        .class-module-header .module-cost-label {
            font-size: .7rem;
            color: var(--muted, #94a3b8);
            margin-left: 8px;
        }
        .class-module-items {
            padding: 8px;
        }
        .class-module-item {
            border: 1px solid var(--soft, rgba(148,163,184,.12));
            border-radius: 8px;
            margin-bottom: 8px;
            background: rgba(15,23,42,.35);
            overflow: hidden;
        }
        .class-module-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 10px;
            background: rgba(51,65,85,.3);
            border-bottom: 1px solid var(--soft, rgba(148,163,184,.06));
        }
        .class-module-item-header span {
            font-size: .78rem;
            font-weight: 600;
            color: var(--text, #e2e8f0);
        }
        .class-module-item-header button {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: .85rem;
            padding: 2px 6px;
            border-radius: 4px;
            transition: background .15s;
        }
        .class-module-item-header button:hover {
            background: rgba(239,68,68,.15);
        }
        .class-module-fields {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 8px 10px;
        }
        .class-module-fields .field-full {
            grid-column: 1 / -1;
        }
        .class-module-fields label {
            display: block;
            font-size: .68rem;
            font-weight: 600;
            color: var(--muted, #94a3b8);
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: .03em;
        }
        .class-module-fields input,
        .class-module-fields textarea,
        .class-module-fields select {
            width: 100%;
            background: var(--input-bg, rgba(15,23,42,.6));
            border: 1px solid var(--soft, rgba(148,163,184,.12));
            color: var(--text, #e2e8f0);
            padding: 5px 8px;
            border-radius: 6px;
            font-size: .8rem;
            font-family: inherit;
            box-sizing: border-box;
        }
        .class-module-fields textarea {
            min-height: 48px;
            resize: vertical;
        }
        .class-module-fields .progress-inputs {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .class-module-fields .progress-inputs input {
            flex: 1;
            text-align: center;
        }
        .class-module-fields .progress-inputs .sep {
            color: var(--muted, #94a3b8);
            font-weight: 700;
        }
        /* Steps field */
        .class-module-steps {
            margin-top: 4px;
        }
        .class-module-step {
            border: 1px solid var(--soft, rgba(148,163,184,.08));
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 4px;
            background: rgba(30,41,59,.3);
        }
        .class-module-step-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }
        .class-module-step-header input {
            flex: 1;
        }
        .class-module-step-header button {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: .75rem;
            padding: 2px 4px;
        }
        .class-module-step textarea {
            width: 100%;
            min-height: 32px;
            background: var(--input-bg, rgba(15,23,42,.6));
            border: 1px solid var(--soft, rgba(148,163,184,.08));
            color: var(--text, #e2e8f0);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: .75rem;
            font-family: inherit;
            resize: vertical;
            box-sizing: border-box;
        }
        .class-module-add-btn {
            display: block;
            width: 100%;
            padding: 8px;
            border: 1px dashed var(--soft, rgba(148,163,184,.18));
            border-radius: 8px;
            background: none;
            color: var(--muted, #94a3b8);
            font-size: .8rem;
            cursor: pointer;
            transition: border-color .15s, color .15s;
            margin-top: 4px;
        }
        .class-module-add-btn:hover {
            border-color: #8b5cf6;
            color: #a78bfa;
        }
        .class-module-add-step-btn {
            background: none;
            border: 1px dashed var(--soft, rgba(148,163,184,.12));
            border-radius: 4px;
            color: var(--muted, #94a3b8);
            font-size: .7rem;
            cursor: pointer;
            padding: 3px 8px;
            margin-top: 2px;
            transition: color .15s;
        }
        .class-module-add-step-btn:hover {
            color: #a78bfa;
        }
        @media print {
            .class-module-item-header button,
            .class-module-add-btn,
            .class-module-add-step-btn,
            .class-module-step-header button {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Renderiza os módulos de classe no container #classExtraResources.
 * Chamada por onClassChange().
 * @param {string} classeNome - Nome da classe selecionada
 */
function renderClassModules(classeNome) {
    const container = document.getElementById('classExtraResources');
    if (!container) return;

    // Remove módulos anteriores (keep other extra resources intact)
    container.querySelectorAll('.class-module-section').forEach(el => el.remove());

    if (!classeNome || !window._classModules || !window._classModules[classeNome]) return;

    const modules = window._classModules[classeNome];
    if (!modules || modules.length === 0) return;

    // Ensure section is visible
    const resSection = document.getElementById('classResourcesSection');
    if (resSection) resSection.style.display = '';

    modules.forEach(mod => {
        const section = _buildModuleSection(mod);
        container.appendChild(section);
    });
}

/**
 * Constrói a seção DOM de um módulo.
 */
function _buildModuleSection(mod) {
    const section = document.createElement('div');
    section.className = 'class-module-section';
    section.dataset.moduleId = mod.id;

    // Header
    const header = document.createElement('div');
    header.className = 'class-module-header';

    const title = document.createElement('h4');
    title.textContent = `${mod.icone || '📦'} ${mod.titulo || mod.id}`;
    header.appendChild(title);

    // Slots indicator
    const limit = _getModuleLimit(mod);
    if (limit !== Infinity) {
        const slotsSpan = document.createElement('span');
        slotsSpan.className = 'module-slots';
        slotsSpan.id = `modSlots_${mod.id}`;
        const savedItems = state.classModuleData?.[mod.id] || [];
        slotsSpan.textContent = `${savedItems.length}/${limit} slots`;
        header.appendChild(slotsSpan);
    }

    if (mod.custoExpLabel) {
        const costSpan = document.createElement('span');
        costSpan.className = 'module-cost-label';
        costSpan.textContent = mod.custoExpLabel;
        header.appendChild(costSpan);
    }

    section.appendChild(header);

    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'class-module-items';
    itemsContainer.id = `modItems_${mod.id}`;

    // Load saved data
    const savedItems = state.classModuleData?.[mod.id] || [];
    savedItems.forEach((itemData, idx) => {
        const itemEl = _buildModuleItem(mod, idx, itemData);
        itemsContainer.appendChild(itemEl);
    });

    section.appendChild(itemsContainer);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'class-module-add-btn no-print';
    addBtn.textContent = `+ Adicionar ${mod.titulo || 'item'}`;
    addBtn.addEventListener('click', () => _addModuleItem(mod));
    section.appendChild(addBtn);

    return section;
}

/**
 * Obtém o limite de slots para um módulo.
 */
function _getModuleLimit(mod) {
    if (mod.mecanicaLimiteId) {
        const limitKey = 'MODULE_LIMIT:' + mod.id;
        const bonus = state.mechanicBonuses?.[limitKey] || 0;
        return bonus > 0 ? bonus : 0;
    }
    // Sem mecânica de limite = ilimitado
    return Infinity;
}

/**
 * Atualiza o indicador de slots de um módulo.
 */
function _updateModuleSlots(mod) {
    const slotsEl = document.getElementById(`modSlots_${mod.id}`);
    if (!slotsEl) return;
    const limit = _getModuleLimit(mod);
    if (limit === Infinity) return;
    const currentCount = (state.classModuleData?.[mod.id] || []).length;
    slotsEl.textContent = `${currentCount}/${limit} slots`;
}

/**
 * Adiciona um item a um módulo, com verificação de EXP e slots.
 */
function _addModuleItem(mod) {
    const limit = _getModuleLimit(mod);
    const currentItems = state.classModuleData?.[mod.id] || [];

    // Verificar slots
    if (limit !== Infinity && currentItems.length >= limit) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked(`Limite de slots atingido! (${currentItems.length}/${limit})`);
        }
        return;
    }

    const cost = mod.custoExpPorItem || 0;

    if (cost > 0) {
        // Verificar EXP
        const currentExp = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        if (currentExp < cost) {
            if (typeof showUpgradeBlocked === 'function') {
                showUpgradeBlocked(`EXP insuficiente! Custo: ${cost} EXP, disponível: ${currentExp} EXP`);
            }
            return;
        }

        // Confirmação com toast
        if (typeof showUpgradeConfirm === 'function') {
            showUpgradeConfirm(
                `Nova ${mod.titulo || 'item'}`,
                currentItems.length + 1,
                cost,
                () => {
                    if (typeof spendExp === 'function') spendExp(cost);
                    _doAddModuleItem(mod);
                }
            );
        } else {
            if (typeof spendExp === 'function') spendExp(cost);
            _doAddModuleItem(mod);
        }
    } else {
        _doAddModuleItem(mod);
    }
}

/**
 * Executa a adição de um item após validação.
 */
function _doAddModuleItem(mod) {
    if (!state.classModuleData) state.classModuleData = {};
    if (!state.classModuleData[mod.id]) state.classModuleData[mod.id] = [];

    const idx = state.classModuleData[mod.id].length;
    const newItemData = {};

    // Inicializar campos do schema com valores vazios
    (mod.schema || []).forEach(f => {
        if (f.tipo === 'progress') {
            newItemData[f.key + '_atual'] = '';
            newItemData[f.key + '_total'] = '';
        } else if (f.tipo === 'steps') {
            newItemData[f.key] = [];
        } else {
            newItemData[f.key] = '';
        }
    });

    state.classModuleData[mod.id].push(newItemData);

    // Render o novo item no DOM
    const itemsContainer = document.getElementById(`modItems_${mod.id}`);
    if (itemsContainer) {
        const itemEl = _buildModuleItem(mod, idx, newItemData);
        itemsContainer.appendChild(itemEl);
    }

    _updateModuleSlots(mod);
    scheduleAutosave();
}

/**
 * Constrói o DOM de um item de módulo.
 */
function _buildModuleItem(mod, idx, data) {
    data = data || {};

    const item = document.createElement('div');
    item.className = 'class-module-item';
    item.dataset.moduleId = mod.id;
    item.dataset.itemIndex = idx;

    // Item header
    const header = document.createElement('div');
    header.className = 'class-module-item-header';

    const numSpan = document.createElement('span');
    numSpan.className = 'module-item-number';
    numSpan.textContent = `#${idx + 1}`;
    header.appendChild(numSpan);

    const rmBtn = document.createElement('button');
    rmBtn.className = 'no-print';
    rmBtn.textContent = '✕';
    rmBtn.title = 'Remover item';
    rmBtn.addEventListener('click', () => _removeModuleItem(mod, item));
    header.appendChild(rmBtn);

    item.appendChild(header);

    // Fields grid
    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'class-module-fields';

    (mod.schema || []).forEach(field => {
        const fieldWrap = document.createElement('div');
        if (field.largura === 'full') fieldWrap.classList.add('field-full');

        const label = document.createElement('label');
        label.textContent = field.label || field.key;
        fieldWrap.appendChild(label);

        if (field.tipo === 'textarea') {
            const ta = document.createElement('textarea');
            ta.dataset.modField = field.key;
            ta.placeholder = field.placeholder || '';
            ta.value = data[field.key] || '';
            if (field.somenteLeitura) ta.readOnly = true;
            ta.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(ta);
        } else if (field.tipo === 'select') {
            const sel = document.createElement('select');
            sel.dataset.modField = field.key;
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Selecionar —';
            sel.appendChild(emptyOpt);
            (field.opcoes || []).forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (data[field.key] === opt) o.selected = true;
                sel.appendChild(o);
            });
            if (field.somenteLeitura) sel.disabled = true;
            sel.addEventListener('change', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(sel);
        } else if (field.tipo === 'progress') {
            const progDiv = document.createElement('div');
            progDiv.className = 'progress-inputs';

            const inpAtual = document.createElement('input');
            inpAtual.type = 'text';
            inpAtual.dataset.modField = field.key + '_atual';
            inpAtual.placeholder = '0';
            inpAtual.value = data[field.key + '_atual'] || '';
            inpAtual.addEventListener('input', () => _saveModuleData(mod.id));

            const sep = document.createElement('span');
            sep.className = 'sep';
            sep.textContent = '/';

            const inpTotal = document.createElement('input');
            inpTotal.type = 'text';
            inpTotal.dataset.modField = field.key + '_total';
            inpTotal.placeholder = '0';
            inpTotal.value = data[field.key + '_total'] || '';
            inpTotal.addEventListener('input', () => _saveModuleData(mod.id));

            progDiv.appendChild(inpAtual);
            progDiv.appendChild(sep);
            progDiv.appendChild(inpTotal);
            fieldWrap.appendChild(progDiv);
        } else if (field.tipo === 'steps') {
            fieldWrap.classList.add('field-full');
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'class-module-steps';
            stepsContainer.dataset.modField = field.key;

            const steps = Array.isArray(data[field.key]) ? data[field.key] : [];
            steps.forEach((step, si) => {
                const stepEl = _buildModuleStep(mod.id, field.key, si, step);
                stepsContainer.appendChild(stepEl);
            });

            const addStepBtn = document.createElement('button');
            addStepBtn.className = 'class-module-add-step-btn no-print';
            addStepBtn.type = 'button';
            addStepBtn.textContent = '+ Passo';
            addStepBtn.addEventListener('click', () => {
                const stepIdx = stepsContainer.querySelectorAll('.class-module-step').length;
                const stepEl = _buildModuleStep(mod.id, field.key, stepIdx, {});
                stepsContainer.insertBefore(stepEl, addStepBtn);
                _saveModuleData(mod.id);
            });
            stepsContainer.appendChild(addStepBtn);
            fieldWrap.appendChild(stepsContainer);
        } else if (field.tipo === 'number') {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || '';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else {
            // default: text
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || '';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        }

        fieldsDiv.appendChild(fieldWrap);
    });

    item.appendChild(fieldsDiv);
    return item;
}

/**
 * Constrói um step individual dentro de um campo tipo 'steps'.
 */
function _buildModuleStep(moduleId, fieldKey, stepIdx, data) {
    data = data || {};
    const step = document.createElement('div');
    step.className = 'class-module-step';

    const stepHeader = document.createElement('div');
    stepHeader.className = 'class-module-step-header';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.dataset.stepField = 'name';
    nameInp.placeholder = `Passo ${stepIdx + 1}`;
    nameInp.value = data.name || '';
    nameInp.addEventListener('input', () => _saveModuleData(moduleId));
    stepHeader.appendChild(nameInp);

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'no-print';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => {
        step.remove();
        _saveModuleData(moduleId);
    });
    stepHeader.appendChild(rmBtn);
    step.appendChild(stepHeader);

    const descTa = document.createElement('textarea');
    descTa.dataset.stepField = 'desc';
    descTa.placeholder = 'Descrição do passo...';
    descTa.value = data.desc || '';
    descTa.addEventListener('input', () => _saveModuleData(moduleId));
    step.appendChild(descTa);

    return step;
}

/**
 * Remove um item de módulo com confirmação.
 */
function _removeModuleItem(mod, itemEl) {
    if (!confirm('Remover este item?')) return;

    const container = itemEl.parentElement;
    itemEl.remove();

    // Re-index remaining items
    if (container) {
        container.querySelectorAll('.class-module-item').forEach((el, i) => {
            el.dataset.itemIndex = i;
            const num = el.querySelector('.module-item-number');
            if (num) num.textContent = `#${i + 1}`;
        });
    }

    _saveModuleData(mod.id);
    _updateModuleSlots(mod);
}

/**
 * Salva dados de um módulo no state e dispara autosave.
 */
function _saveModuleData(moduleId, skipAutosave = false) {
    if (!state.classModuleData) state.classModuleData = {};

    const container = document.getElementById(`modItems_${moduleId}`);
    if (!container) return;

    const items = [];
    container.querySelectorAll('.class-module-item').forEach(itemEl => {
        const data = {};

        // Campos simples (text, number, textarea, select)
        itemEl.querySelectorAll('[data-mod-field]').forEach(el => {
            const key = el.dataset.modField;
            if (el.tagName === 'SELECT') {
                data[key] = el.value;
            } else {
                data[key] = el.value;
            }
        });

        // Campos de steps
        itemEl.querySelectorAll('.class-module-steps[data-mod-field]').forEach(stepsContainer => {
            const fieldKey = stepsContainer.dataset.modField;
            const steps = [];
            stepsContainer.querySelectorAll('.class-module-step').forEach(stepEl => {
                const nameEl = stepEl.querySelector('[data-step-field="name"]');
                const descEl = stepEl.querySelector('[data-step-field="desc"]');
                steps.push({
                    name: nameEl?.value || '',
                    desc: descEl?.value || ''
                });
            });
            data[fieldKey] = steps;
        });

        items.push(data);
    });

    state.classModuleData[moduleId] = items;
    if (!skipAutosave) {
        scheduleAutosave();
    }
}

/**
 * Coleta dados de TODOS os módulos de classe para o gatherData().
 * @returns {Object} - { moduleId: [itemData, ...], ... }
 */
function gatherClassModuleData() {
    // Se temos módulos renderizados, salvar do DOM
    if (state.classModuleData) {
        // Atualizar dados do DOM antes de retornar
        const container = document.getElementById('classExtraResources');
        if (container) {
            container.querySelectorAll('.class-module-section').forEach(section => {
                const modId = section.dataset.moduleId;
                if (modId) _saveModuleData(modId, true);
            });
        }
    }
    return state.classModuleData || {};
}

/**
 * Carrega dados salvos de módulos de classe no state.
 * @param {Object} data - { moduleId: [itemData, ...], ... }
 */
function loadClassModuleData(data) {
    state.classModuleData = data || {};
}
