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
            grid-template-columns: repeat(12, 1fr);
            gap: 8px;
            padding: 8px 10px;
        }
        .class-module-fields .field-full {
            grid-column: 1 / -1;
        }
        .class-module-fields .cm-field.span-3 { grid-column: span 3; }
        .class-module-fields .cm-field.span-4 { grid-column: span 4; }
        .class-module-fields .cm-field.span-6 { grid-column: span 6; }
        .class-module-fields .cm-field.span-8 { grid-column: span 8; }
        .class-module-fields .cm-field.span-9 { grid-column: span 9; }
        .class-module-fields .cm-field.span-12 { grid-column: 1 / -1; }
        @media (max-width: 560px) {
            .class-module-fields .cm-field.span-3,
            .class-module-fields .cm-field.span-4 { grid-column: span 6; }
            .class-module-fields .cm-field.span-8,
            .class-module-fields .cm-field.span-9 { grid-column: 1 / -1; }
        }
        /* Separador de seção */
        .cm-separador {
            border-bottom: 1px solid rgba(139,92,246,.35);
            color: #a78bfa;
            font-size: .72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .05em;
            padding-bottom: 2px;
            margin-top: 4px;
        }
        /* Checkbox */
        .class-module-fields input.cm-checkbox {
            width: 18px;
            height: 18px;
            accent-color: #8b5cf6;
            cursor: pointer;
        }
        /* Cor */
        .class-module-fields input.cm-color {
            padding: 2px;
            height: 30px;
            cursor: pointer;
        }
        /* Link */
        .cm-link-wrap { display: flex; gap: 4px; align-items: center; }
        .cm-link-wrap input { flex: 1; }
        .cm-link-go { text-decoration: none; font-size: .9rem; }
        /* Imagem */
        .cm-img-preview {
            display: block;
            max-width: 100%;
            max-height: 180px;
            margin-top: 6px;
            border-radius: 8px;
            border: 1px solid var(--soft, rgba(148,163,184,.15));
            object-fit: contain;
            background: rgba(15,23,42,.4);
        }
        /* Avaliação (estrelas) */
        .cm-rating { display: flex; gap: 2px; font-size: 1.1rem; line-height: 1; user-select: none; }
        .cm-star { cursor: pointer; color: var(--muted, #94a3b8); transition: color .12s, transform .12s; }
        .cm-star.filled { color: #facc15; }
        .cm-star:hover { transform: scale(1.15); }
        /* Contador */
        .cm-counter { display: flex; align-items: center; gap: 4px; }
        .cm-counter input { width: 60px; text-align: center; }
        .cm-counter button {
            width: 26px; height: 26px;
            border: 1px solid var(--soft, rgba(148,163,184,.2));
            border-radius: 6px;
            background: rgba(51,65,85,.4);
            color: var(--text, #e2e8f0);
            font-weight: 700;
            cursor: pointer;
        }
        .cm-counter button:hover { border-color: #8b5cf6; color: #a78bfa; }
        /* Tags */
        .cm-tags {
            display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
            border: 1px solid var(--soft, rgba(148,163,184,.12));
            border-radius: 6px; padding: 4px 6px;
            background: var(--input-bg, rgba(15,23,42,.6));
        }
        .cm-tag {
            display: inline-flex; align-items: center; gap: 2px;
            background: rgba(139,92,246,.18);
            border: 1px solid rgba(139,92,246,.35);
            color: var(--text, #e2e8f0);
            border-radius: 10px;
            padding: 1px 7px;
            font-size: .7rem;
        }
        .cm-tag button { background: none; border: none; color: #ef4444; cursor: pointer; font-size: .75rem; padding: 0 2px; }
        .cm-tags .cm-tag-input {
            flex: 1; min-width: 70px;
            border: none !important; background: none !important;
            padding: 2px !important; font-size: .72rem;
        }
        /* Dado */
        .cm-dice { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .cm-dice input { width: 80px; }
        .cm-dice-btn {
            border: 1px solid var(--soft, rgba(148,163,184,.2));
            border-radius: 6px; background: rgba(51,65,85,.4);
            font-size: .9rem; cursor: pointer; padding: 3px 8px;
        }
        .cm-dice-btn:hover { border-color: #8b5cf6; }
        .cm-dice-result { font-size: .75rem; font-weight: 700; color: #a78bfa; }
        /* Botão de ação (mecânicas) */
        .cm-action-wrap { position: relative; display: flex; flex-direction: column; gap: 2px; }
        .cm-action-btn {
            padding: 7px 12px;
            border: 1px solid rgba(139,92,246,.45);
            border-radius: 8px;
            background: linear-gradient(180deg, rgba(139,92,246,.25), rgba(139,92,246,.12));
            color: var(--text, #e2e8f0);
            font-size: .78rem;
            font-weight: 700;
            cursor: pointer;
            transition: transform .1s, box-shadow .15s;
        }
        .cm-action-btn:hover { box-shadow: 0 0 10px rgba(139,92,246,.35); }
        .cm-action-btn:active { transform: scale(.97); }
        .cm-btn-toast {
            font-size: .68rem;
            color: #a78bfa;
            opacity: 0;
            transition: opacity .2s;
            min-height: 1em;
        }
        .cm-btn-toast.show { opacity: 1; }
        /* Modal de itens pré-cadastrados */
        .cm-predef-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(2,6,23,.7);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
        }
        .cm-predef-box {
            width: 100%; max-width: 480px; max-height: 80vh;
            overflow-y: auto;
            background: var(--card, #0f172a);
            border: 1px solid rgba(139,92,246,.4);
            border-radius: 12px;
            padding: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,.5);
        }
        .cm-predef-box-title {
            font-weight: 800; font-size: .9rem;
            color: var(--text, #e2e8f0);
            margin-bottom: 10px;
        }
        .cm-predef-box-list { display: flex; flex-direction: column; gap: 8px; }
        .cm-predef-option {
            text-align: left;
            border: 1px solid var(--soft, rgba(148,163,184,.15));
            border-radius: 10px;
            background: rgba(30,41,59,.5);
            padding: 10px 12px;
            cursor: pointer;
            transition: border-color .15s, background .15s;
        }
        .cm-predef-option:hover { border-color: #8b5cf6; background: rgba(139,92,246,.1); }
        .cm-predef-option-nome { font-weight: 700; font-size: .82rem; color: var(--text, #e2e8f0); }
        .cm-predef-option-desc { font-size: .72rem; color: var(--muted, #94a3b8); margin-top: 2px; }
        .cm-predef-option-custos { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .cm-predef-option-custos span {
            font-size: .65rem;
            background: rgba(139,92,246,.12);
            border: 1px solid rgba(139,92,246,.3);
            border-radius: 8px;
            padding: 1px 6px;
            color: var(--muted, #cbd5e1);
        }
        .cm-predef-option-custom { border-style: dashed; }
        .cm-predef-cancel {
            display: block; width: 100%;
            margin-top: 10px;
            padding: 8px;
            border: 1px solid var(--soft, rgba(148,163,184,.2));
            border-radius: 8px;
            background: none;
            color: var(--muted, #94a3b8);
            cursor: pointer;
        }
        .cm-predef-cancel:hover { color: var(--text, #e2e8f0); }
        .module-req-label {
            font-size: .65rem;
            color: var(--muted, #94a3b8);
            margin-left: 8px;
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
        /* Valor Derivado chip */
        .cm-dv-chip {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(139,92,246,.12);
            border: 1px solid rgba(139,92,246,.35);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: .78rem;
            color: var(--text, #e2e8f0);
        }
        .cm-dv-icon { font-size: 1rem; }
        .cm-dv-name { font-weight: 600; }
        .cm-dv-value { font-weight: 800; color: #a78bfa; margin-left: 4px; }
        /* Select VD (dropdown de Valor Derivado) */
        .cm-select-vd-wrap {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cm-select-vd-wrap select {
            width: 100%;
            background: var(--input-bg, rgba(15,23,42,.6));
            border: 1px solid var(--soft, rgba(148,163,184,.12));
            color: var(--text, #e2e8f0);
            padding: 5px 8px;
            border-radius: 6px;
            font-size: .78rem;
            font-family: inherit;
        }
        .cm-select-vd-preview {
            display: none;
            align-items: center;
            gap: 6px;
            background: rgba(139,92,246,.10);
            border: 1px solid rgba(139,92,246,.25);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: .75rem;
            color: var(--text, #e2e8f0);
            transition: opacity .2s;
        }
        .cm-select-vd-preview.visible { display: inline-flex; }
        .cm-select-vd-preview .cm-dv-icon { font-size: .95rem; }
        .cm-select-vd-preview .cm-dv-name { font-weight: 600; font-size: .75rem; }
        .cm-select-vd-preview .cm-dv-value { font-weight: 800; color: #a78bfa; margin-left: 4px; font-size: .75rem; }
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
 * Renderiza os módulos de classe no container #classModulesContainer.
 * Chamada por onClassChange().
 * @param {string} classeNome - Nome da classe selecionada
 */
function renderClassModules(classeNome) {
    const container = document.getElementById('classModulesContainer');
    if (!container) return;

    // Remove APENAS os elementos com a classe 'class-module-container'
    // preservando outros componentes (como loções, ritos)
    container.querySelectorAll('.class-module-container').forEach(e => e.remove());

    if (!classeNome) return;
    const modules = window._classModules[classeNome];
    if (!modules || modules.length === 0) {
        const sec = document.getElementById('classModulesSection');
        if (sec) sec.style.display = 'none';
        return;
    }

    // Ensure section is visible
    const resSection = document.getElementById('classModulesSection');
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

    // Resumo de requisitos de equipamento
    if (Array.isArray(mod.custoEquipamentos) && mod.custoEquipamentos.length > 0) {
        const reqSpan = document.createElement('span');
        reqSpan.className = 'module-req-label';
        const custos = _cmFormatarCustos(0, mod.custoEquipamentos);
        reqSpan.textContent = custos.join(' · ');
        reqSpan.title = 'Requisitos para adicionar itens neste módulo';
        header.appendChild(reqSpan);
    }

    section.appendChild(header);

    const blockMessage = _checkModuleBlockStatus(mod);
    if (blockMessage) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'cm-block-message';
        blockDiv.style.padding = '15px';
        blockDiv.style.textAlign = 'center';
        blockDiv.style.color = 'var(--text-muted, #888)';
        blockDiv.style.fontStyle = 'italic';
        blockDiv.style.background = 'rgba(255, 0, 0, 0.05)';
        blockDiv.style.border = '1px dashed rgba(255, 0, 0, 0.3)';
        blockDiv.style.borderRadius = '4px';
        blockDiv.style.margin = '10px 0';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = mod.titulo || mod.id;
        
        const msgSpan = document.createElement('b');
        msgSpan.textContent = blockMessage;
        
        blockDiv.appendChild(document.createTextNode('🔒 Requer '));
        blockDiv.appendChild(msgSpan);
        blockDiv.appendChild(document.createTextNode(', para desbloquear '));
        blockDiv.appendChild(titleSpan);
        
        section.appendChild(blockDiv);
        return section;
    }

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
 * Verifica se o módulo está bloqueado por mecânicas.
 * Retorna null se não houver bloqueio, ou a string de mensagem se bloqueado.
 */
function _checkModuleBlockStatus(mod) {
    if (!mod.cadastrarBloqueio || !Array.isArray(mod.bloqueioMecanicaIds) || mod.bloqueioMecanicaIds.length === 0) return null;
    
    for (const mechId of mod.bloqueioMecanicaIds) {
        const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
        if (!mech || mech.tipo !== 'booleano') continue;
        
        const config = mech.config || {};
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            
            if (!r) {
                return config.valorFalso || 'Requisito não atendido';
            }
        } catch (e) {
            // ignorar e prosseguir
        }
    }
    return null;
}

function _getModuleLimit(mod) {
    const candidatos = [];

    // 1) Bônus legado via TARGET_MAP ("Limite: Título") — mecânicas aplicadas ao personagem
    const limitKey = 'MODULE_LIMIT:' + mod.id;
    const bonus = state.mechanicBonuses?.[limitKey] || 0;
    if (bonus > 0) candidatos.push(bonus);

    // 2) Limite fixo definido pelo criador
    const fixo = mod.limiteFixo;
    const temFixo = fixo !== null && fixo !== undefined && fixo !== '' && !isNaN(Number(fixo));
    if (temFixo) candidatos.push(Number(fixo));

    // 3) Mecânicas vinculadas — os valores resolvidos são SOMADOS entre si
    const ids = Array.isArray(mod.limiteMecanicaIds) ? mod.limiteMecanicaIds : [];
    if (ids.length > 0) {
        let soma = 0, resolvidas = false;
        ids.forEach(id => {
            const v = _resolveModuleMechanicValue(id);
            if (v !== null) { soma += v; resolvidas = true; }
        });
        if (resolvidas) candidatos.push(soma);
    }

    const temConfig = temFixo || ids.length > 0 || !!mod.mecanicaLimiteId;
    if (!temConfig) return Infinity; // Sem configuração = ilimitado

    // Fixo + mecânica: vale o MAIOR valor
    if (candidatos.length === 0) return 0;
    return Math.max(0, Math.max(...candidatos));
}

/**
 * Resolve o valor numérico configurado em uma mecânica (para Limite de Itens).
 * Suporta: modificar/limitar (cálculos/equações), booleano (avalia e usa saída),
 * e formatos legados (valor / valorMaximo fixos).
 */
function _resolveModuleMechanicValue(mechId) {
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (!mech) return null;
    const config = mech.config || {};

    if (mech.tipo === 'booleano') {
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            const out = r ? config.valorVerdadeiro : config.valorFalso;
            const n = parseFloat(out);
            return isNaN(n) ? 0 : n;
        } catch (e) { return null; }
    }

    if (mech.tipo === 'condicional_encadeado') {
        try {
            if (typeof resolveChainedConditional !== 'function') return null;
            const res = resolveChainedConditional(config);
            const n = parseFloat(res.valorSaida);
            return isNaN(n) ? 0 : n;
        } catch (e) { return null; }
    }

    const calculos = Array.isArray(config.calculos) ? config.calculos : null;
    if (calculos && calculos.length && typeof resolveCalcValue === 'function') {
        let total = 0;
        calculos.forEach(c => { total += resolveCalcValue(c) || 0; });
        return total;
    }
    if (config.valorMaximo !== undefined && config.valorMaximo !== null) return parseFloat(config.valorMaximo) || 0;
    if (config.valor !== undefined && config.valor !== null) return parseFloat(config.valor) || 0;
    return null;
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

/* ===== CUSTOS DE EQUIPAMENTO ===== */

/** Verifica se um item está equipado de forma válida para custo (Efeitos ON ou qualquer forma). */
function _cmItemEquipadoValido(item, exigeEfeitosOn) {
    if (!item.equipado || item.parentItemId) return false;
    if (!exigeEfeitosOn) return true; // Qualquer forma equipada serve
    // Réplica da regra de applyEquippedItemsMechanics: estados sem efeito não contam
    if (item.estadoEquip === 'fixado' || item.estadoEquip === 'armazenado' || item.estadoEquip === 'segurar') return false;
    if (item.formaEquipar) {
        const equipToStateMap = { 'segurar': 'segurar', 'empunhar': 'empunhado', 'vestir': 'vestido', 'fixar': 'fixado' };
        if (item.estadoEquip !== equipToStateMap[item.formaEquipar]) return false;
    }
    return true;
}

/** Localiza itens do personagem que correspondem a um equipamento do catálogo. */
function _cmMatchInventoryItems(eqId) {
    const items = window._inventoryState?.items || [];
    const catalog = window._inventoryState?.catalog || [];
    const tpl = catalog.find(t => t.id === eqId);
    return items.filter(i => i.modeloId === eqId || (tpl && i.nome === tpl.nome));
}

/**
 * Valida os custos de equipamento de um módulo/item pré-cadastrado.
 * @returns {{ok: boolean, faltas: string[], consumos: Array}}
 */
function _cmValidarCustosEquipamento(reqs) {
    const faltas = [];
    const consumos = [];
    const catalog = window._inventoryState?.catalog || [];

    for (const req of (reqs || [])) {
        const eqId = req.equipamentoId || req.id;
        if (!eqId) continue;
        const qtdMin = Math.max(1, parseInt(req.quantidade, 10) || 1);
        const tpl = catalog.find(t => t.id === eqId);
        const nome = tpl?.nome || eqId;
        const matches = _cmMatchInventoryItems(eqId);

        if (req.consumir) {
            const disponivel = matches.reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
            if (disponivel < qtdMin) {
                faltas.push(`🎒 ${nome} ×${qtdMin} (possui ${disponivel}) — seria consumido`);
            } else {
                consumos.push({ eqId, nome, qtd: qtdMin });
            }
        } else {
            const validos = matches.filter(i => _cmItemEquipadoValido(i, req.exigeEfeitosOn === true));
            const total = validos.reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
            if (total < qtdMin) {
                faltas.push(`🎒 ${nome} ×${qtdMin} equipado${req.exigeEfeitosOn ? ' (Efeitos = ON)' : ''}`);
            }
        }
    }
    return { ok: faltas.length === 0, faltas, consumos };
}

/** Consome equipamentos do inventário (itens soltos primeiro, depois equipados). */
async function _cmConsumirEquipamentos(consumos) {
    if (!consumos || consumos.length === 0) return;
    const inv = window._inventoryState;
    for (const c of consumos) {
        let restante = c.qtd;
        // Itens soltos primeiro, depois equipados
        const matches = _cmMatchInventoryItems(c.eqId)
            .sort((a, b) => (a.equipado === b.equipado) ? 0 : (a.equipado ? 1 : -1));
        for (const item of matches) {
            if (restante <= 0) break;
            const qtdItem = parseInt(item.quantidade, 10) || 1;
            if (qtdItem > restante) {
                item.quantidade = qtdItem - restante;
                item.lastModified = new Date().toISOString();
                restante = 0;
                try {
                    if (typeof _firestoreSetDoc === 'function') await _firestoreSetDoc('items', item.id, { quantidade: item.quantidade, lastModified: item.lastModified });
                } catch (e) { console.error('❌ Erro ao consumir item:', e); }
            } else {
                restante -= qtdItem;
                inv.items = inv.items.filter(i => i.id !== item.id);
                try {
                    if (typeof _firestoreDeleteDoc === 'function') await _firestoreDeleteDoc('items', item.id);
                } catch (e) { console.error('❌ Erro ao remover item consumido:', e); }
            }
        }
        console.log(`🔥 Consumido: ${c.nome} ×${c.qtd}`);
    }
    if (typeof renderInventoryTab === 'function') renderInventoryTab();
    if (typeof renderEquippedItems === 'function') renderEquippedItems();
    if (typeof recalcInventoryPressure === 'function') recalcInventoryPressure();
}

/** Formata o resumo de custos de um item/módulo para exibição. */
function _cmFormatarCustos(custoExp, reqs) {
    const partes = [];
    if (custoExp > 0) partes.push(`💠 ${custoExp} EXP`);
    const catalog = window._inventoryState?.catalog || [];
    (reqs || []).forEach(req => {
        const eqId = req.equipamentoId || req.id;
        const tpl = catalog.find(t => t.id === eqId);
        const nome = tpl?.nome || eqId;
        const qtd = Math.max(1, parseInt(req.quantidade, 10) || 1);
        if (req.consumir) partes.push(`🔥 Consome ${nome}${qtd > 1 ? ` ×${qtd}` : ''}`);
        else partes.push(`🎒 Requer ${nome}${qtd > 1 ? ` ×${qtd}` : ''} equipado${req.exigeEfeitosOn ? ' (Efeitos ON)' : ''}`);
    });
    return partes;
}

/* ===== ADIÇÃO DE ITENS ===== */

/**
 * Adiciona um item a um módulo, com verificação de slots, EXP,
 * custos de equipamento e seleção de itens pré-cadastrados.
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

    const predefs = Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [];
    const podeCriar = mod.permitirCriacaoJogador !== false;

    if (predefs.length > 0) {
        _cmAbrirSelecaoPredef(mod, predefs, podeCriar);
        return;
    }

    if (!podeCriar) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked('Este módulo não permite criação livre e não possui itens pré-cadastrados.');
        }
        return;
    }

    _cmValidarECobrar(mod, null);
}

/** Modal de seleção de itens pré-cadastrados. */
function _cmAbrirSelecaoPredef(mod, predefs, podeCriar) {
    document.getElementById('cmPredefModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cmPredefModal';
    overlay.className = 'cm-predef-overlay no-print';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.className = 'cm-predef-box';

    const title = document.createElement('div');
    title.className = 'cm-predef-box-title';
    title.textContent = `${mod.icone || '📦'} ${mod.titulo} — Escolha um item`;
    box.appendChild(title);

    const list = document.createElement('div');
    list.className = 'cm-predef-box-list';

    predefs.forEach(pd => {
        const custoExp = (pd.custoExpProprio !== null && pd.custoExpProprio !== undefined)
            ? pd.custoExpProprio : (mod.custoExpPorItem || 0);
        const reqs = Array.isArray(pd.custoEquipamentos) ? pd.custoEquipamentos : (mod.custoEquipamentos || []);
        const custos = _cmFormatarCustos(custoExp, reqs);
        
        const criacaoIds = Array.isArray(pd.custoCriacaoMecanicaIds) ? pd.custoCriacaoMecanicaIds : _cmGetCostMechanics(mod, 'custoCriacao');
        if (criacaoIds.length > 0) {
            criacaoIds.forEach(id => {
                const m = (window._systemData?.mechanics || []).find(x => x.id === id);
                if (m && m.tipo === 'booleano') {
                    const check = _cmCheckMechanicCost(id);
                    custos.push(check.label);
                }
            });
        }

        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'cm-predef-option';
        opt.innerHTML = `
            <div class="cm-predef-option-nome">${pd.nome}</div>
            ${pd.descricao ? `<div class="cm-predef-option-desc"></div>` : ''}
            ${custos.length ? `<div class="cm-predef-option-custos">${custos.map(c => `<span>${c}</span>`).join('')}</div>` : '<div class="cm-predef-option-custos"><span>✔️ Sem custo</span></div>'}
        `;
        if (pd.descricao) opt.querySelector('.cm-predef-option-desc').textContent = pd.descricao;
        opt.addEventListener('click', () => {
            overlay.remove();
            _cmValidarECobrar(mod, pd);
        });
        list.appendChild(opt);
    });

    if (podeCriar) {
        const custom = document.createElement('button');
        custom.type = 'button';
        custom.className = 'cm-predef-option cm-predef-option-custom';
        const custosMod = _cmFormatarCustos(mod.custoExpPorItem || 0, mod.custoEquipamentos || []);
        custom.innerHTML = `
            <div class="cm-predef-option-nome">✏️ Criar item personalizado</div>
            ${custosMod.length ? `<div class="cm-predef-option-custos">${custosMod.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
        `;
        custom.addEventListener('click', () => {
            overlay.remove();
            _cmValidarECobrar(mod, null);
        });
        list.appendChild(custom);
    }

    box.appendChild(list);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cm-predef-cancel';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => overlay.remove());
    box.appendChild(cancel);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

/** Valida EXP + equipamentos + mecânicas, confirma, cobra e adiciona o item. */
function _cmValidarECobrar(mod, predef) {
    const custoExp = predef && predef.custoExpProprio !== null && predef.custoExpProprio !== undefined
        ? predef.custoExpProprio : (mod.custoExpPorItem || 0);
    const reqs = predef && Array.isArray(predef.custoEquipamentos)
        ? predef.custoEquipamentos : (mod.custoEquipamentos || []);

    // 1) Verificar equipamentos
    const check = _cmValidarCustosEquipamento(reqs);
    if (!check.ok) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked(`Equipamentos necessários em falta:\n${check.faltas.join('\n')}`);
        } else {
            alert(`Equipamentos necessários em falta:\n${check.faltas.join('\n')}`);
        }
        return;
    }

    // 2) Verificar EXP
    if (custoExp > 0) {
        const currentExp = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        if (currentExp < custoExp) {
            if (typeof showUpgradeBlocked === 'function') {
                showUpgradeBlocked(`EXP insuficiente! Custo: ${custoExp} EXP, disponível: ${currentExp} EXP`);
            }
            return;
        }
    }

    let criacaoIds = [];
    if (predef && Array.isArray(predef.custoCriacaoMecanicaIds)) {
        criacaoIds = predef.custoCriacaoMecanicaIds.slice();
    } else {
        criacaoIds = _cmGetCostMechanics(mod, 'custoCriacao');
    }
    
    let mechCheck = { ok: true, label: 'Sem custo', costs: [] };
    if (criacaoIds.length > 0) {
        mechCheck = _cmCheckMechanicsCosts(criacaoIds);
        if (!mechCheck.ok) {
            showUpgradeBlocked(`Bloqueado: ${mechCheck.label}`);
            return;
        }
    }

    const executar = () => {
        if (custoExp > 0 && typeof spendExp === 'function') spendExp(custoExp);
        if (check.consumos.length > 0) _cmConsumirEquipamentos(check.consumos);
        if (criacaoIds.length > 0) _cmApplyMechanicsCosts(criacaoIds);
        _doAddModuleItem(mod, predef);
    };

    const nomeItem = predef ? predef.nome : `Nova ${mod.titulo || 'item'}`;
    const currentItems = state.classModuleData?.[mod.id] || [];

    // Montar texto de custos de adição (previews dos efeitos, não nomes internos)
    let extraCosts = [];
    if (check.consumos.length > 0) {
        extraCosts.push('Equipamentos: ' + check.consumos.map(c => `${c.nome} ×${c.qtd}`).join(', '));
    }
    if (mechCheck.costs.length > 0) {
        extraCosts.push(...mechCheck.costs);
    }

    if (custoExp > 0 && typeof showUpgradeConfirm === 'function') {
        if (extraCosts.length > 0) {
             // Exibe o confirm do navegador por causa dos custos extras não suportados nativamente pelo showUpgradeConfirm
             if (confirm(`Adicionar "${nomeItem}"?\n\nCusto para Adicionar:\n- ${custoExp} EXP\n- ${extraCosts.join('\n- ')}`)) {
                 executar();
             }
        } else {
             showUpgradeConfirm(nomeItem, currentItems.length + 1, custoExp, executar);
        }
    } else if (extraCosts.length > 0) {
        if (confirm(`Adicionar "${nomeItem}"?\n\nCusto para Adicionar:\n- ${extraCosts.join('\n- ')}`)) {
            executar();
        }
    } else {
        executar();
    }
}

/**
 * Executa a adição de um item após validação/cobrança.
 * @param {Object|null} predef - Item pré-cadastrado escolhido (ou null para item livre)
 */
function _doAddModuleItem(mod, predef) {
    if (!state.classModuleData) state.classModuleData = {};
    if (!state.classModuleData[mod.id]) state.classModuleData[mod.id] = [];

    const idx = state.classModuleData[mod.id].length;
    const newItemData = {};

    // Inicializar campos do schema com valores vazios
    (mod.schema || []).forEach(f => {
        if (f.tipo === 'progress') {
            newItemData[f.key + '_atual'] = '';
            newItemData[f.key + '_total'] = '';
        } else if (f.tipo === 'steps' || f.tipo === 'tags') {
            newItemData[f.key] = [];
        } else if (f.tipo === 'checkbox') {
            newItemData[f.key] = false;
        } else if (f.tipo === 'avaliacao' || f.tipo === 'contador') {
            newItemData[f.key] = 0;
        } else if (f.tipo === 'botao' || f.tipo === 'separador') {
            // sem dado
        } else {
            newItemData[f.key] = '';
        }
    });

    // Aplicar valores pré-definidos
    if (predef) {
        newItemData._predefId = predef.id || '';
        newItemData._predefNome = predef.nome || '';
        if (predef.valores && typeof predef.valores === 'object') {
            Object.keys(predef.valores).forEach(k => {
                const v = predef.valores[k];
                if (v !== undefined && v !== null && v !== '') newItemData[k] = v;
            });
        }
    }

    state.classModuleData[mod.id].push(newItemData);

    // Render o novo item no DOM
    const itemsContainer = document.getElementById(`modItems_${mod.id}`);
    if (itemsContainer) {
        const itemEl = _buildModuleItem(mod, idx, newItemData, !predef);
        itemsContainer.appendChild(itemEl);
    }

    _updateModuleSlots(mod);
    scheduleAutosave();
}

/* ===== INTERAÇÕES DE CAMPO (Botão / Dado) ===== */

/** Aplica as mecânicas vinculadas a um campo tipo 'botao'. */
function _cmAplicarMecanicasBotao(field, btnEl) {
    const ids = Array.isArray(field.mecanicaIds) ? field.mecanicaIds : [];
    if (ids.length === 0) {
        _cmToastBotao(btnEl, '🚫 Nenhuma mecânica vinculada');
        return;
    }
    
    for (const id of ids) {
        const check = _cmCheckMechanicCost(id);
        if (!check.ok) {
            _cmToastBotao(btnEl, `❌ ${check.label}`);
            return;
        }
    }

    const mechs = window._systemData?.mechanics || [];
    const nomes = [];
    ids.forEach(id => {
        const m = mechs.find(x => x.id === id);
        if (m && typeof applyMechanicToSheet === 'function') {
            applyMechanicToSheet(m, null, true);
            nomes.push(m.nome);
        }
    });
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    _cmToastBotao(btnEl, nomes.length ? `✅ Aplicado: ${nomes.join(', ')}` : '🚫 Mecânica(s) não encontrada(s)');
    console.log(`⚡ Botão de módulo aplicou mecânicas: ${nomes.join(', ')}`);
}

function _cmToastBotao(btnEl, msg) {
    if (!btnEl) return;
    let toast = btnEl.parentElement?.querySelector('.cm-btn-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cm-btn-toast';
        btnEl.parentElement?.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/** Rola uma fórmula de dados simples: NdM+K / NdM-K / dM. */
function _cmRolarDado(formula) {
    const m = String(formula || '').trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i);
    if (!m) return null;
    const n = Math.max(1, parseInt(m[1] || '1', 10));
    const faces = Math.max(2, parseInt(m[2], 10));
    const bonus = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    const rolagens = [];
    let total = bonus;
    for (let i = 0; i < Math.min(n, 100); i++) {
        const r = 1 + Math.floor(Math.random() * faces);
        rolagens.push(r);
        total += r;
    }
    return { total, rolagens, bonus };
}

/**
 * Constrói o DOM de um item de módulo.
 */
function _buildModuleItem(mod, idx, data, isCustomNew = false, isUnlocked = false) {
    data = data || {};

    const item = document.createElement('div');
    item.className = 'class-module-item';
    item.dataset.moduleId = mod.id;
    item.dataset.itemIndex = idx;

    const isLocked = mod.custoEdicaoAtivo && !isCustomNew && !isUnlocked;
    if (isLocked) {
        item.classList.add('locked-for-edit');
    }

    // Item header
    const header = document.createElement('div');
    header.className = 'class-module-item-header';

    const numSpan = document.createElement('span');
    numSpan.className = 'module-item-number';
    numSpan.textContent = data._predefNome ? `#${idx + 1} · ${data._predefNome}` : `#${idx + 1}`;
    header.appendChild(numSpan);

    if (data._predefId) {
        const predefHidden = document.createElement('input');
        predefHidden.type = 'hidden';
        predefHidden.dataset.modField = '_predefId';
        predefHidden.value = data._predefId;
        header.appendChild(predefHidden);
        const predefNomeHidden = document.createElement('input');
        predefNomeHidden.type = 'hidden';
        predefNomeHidden.dataset.modField = '_predefNome';
        predefNomeHidden.value = data._predefNome || '';
        header.appendChild(predefNomeHidden);
    }

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    if (mod.custoEdicaoAtivo) {
        if (isLocked) {
            const btnUnlock = document.createElement('button');
            btnUnlock.className = 'no-print cm-edit-btn';
            btnUnlock.textContent = '✏️ Editar';
            btnUnlock.title = 'Desbloquear edição (Sujeito a custo)';
            btnUnlock.addEventListener('click', () => {
                const edIds = _cmGetCostMechanics(mod, 'custoEdicao');
                if (edIds.length > 0) {
                    const check = _cmCheckMechanicsCosts(edIds);
                    if (!check.ok) {
                        showUpgradeBlocked(`Edição Bloqueada: ${check.label}`);
                        return;
                    }
                    if (confirm(`Desbloquear edição?\nCusto: ${check.label.replace('Custo: ', '')}`)) {
                        _cmApplyMechanicsCosts(edIds);
                        
                        // Recriar o item no DOM como editável
                        const parent = item.parentElement;
                        const unlockedItem = _buildModuleItem(mod, idx, data, isCustomNew, true);
                        parent.insertBefore(unlockedItem, item);
                        item.remove();
                    }
                } else {
                    // Sem mecânica vinculada, desbloqueia direto
                    const parent = item.parentElement;
                    const unlockedItem = _buildModuleItem(mod, idx, data, isCustomNew, true);
                    parent.insertBefore(unlockedItem, item);
                    item.remove();
                }
            });
            btnGroup.appendChild(btnUnlock);
        } else {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'no-print cm-done-btn';
            doneBtn.textContent = '✅ Concluir';
            doneBtn.title = 'Salvar e trancar edição';
            doneBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            doneBtn.style.color = '#10b981';
            doneBtn.style.border = '1px solid rgba(16, 185, 129, 0.5)';
            doneBtn.addEventListener('click', () => {
                _saveModuleData(mod.id);
                
                // Buscar o index atual do item no DOM
                const currentItems = Array.from(item.parentElement.querySelectorAll('.class-module-item'));
                const myIdx = currentItems.indexOf(item);
                
                // Usar os dados recém-salvos (que incluem as edições) em vez da variável 'data' obsoleta
                let updatedData = data;
                if (myIdx >= 0 && state.classModuleData && state.classModuleData[mod.id]) {
                    updatedData = state.classModuleData[mod.id][myIdx] || data;
                }

                // Repintar item trancado com os dados atualizados
                const newItem = _buildModuleItem(mod, myIdx >= 0 ? myIdx : idx, updatedData, false, false);
                item.replaceWith(newItem);
            });
            btnGroup.appendChild(doneBtn);
        }
    }

    const rmBtn = document.createElement('button');
    rmBtn.className = 'no-print';
    rmBtn.textContent = '✕';
    rmBtn.title = 'Remover item';
    rmBtn.addEventListener('click', () => _removeModuleItem(mod, item));
    btnGroup.appendChild(rmBtn);
    
    header.appendChild(btnGroup);

    item.appendChild(header);

    // Fields grid
    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'class-module-fields';

    (mod.schema || []).forEach(originalField => {
        const field = { ...originalField };
        if (isLocked) {
            field.somenteLeitura = true;
        }
        // Check "Hide if empty" (👁️) logic
        if (field.ocultarSeVazio) {
            let isEmpty = false;
            const val = data[field.key];
            if (field.tipo === 'progress') {
                isEmpty = !data[field.key + '_atual'] && !data[field.key + '_total'];
            } else if (field.tipo === 'steps' || field.tipo === 'tags') {
                isEmpty = !val || !Array.isArray(val) || val.length === 0;
            } else if (field.tipo === 'checkbox') {
                isEmpty = !val;
            } else if (field.tipo === 'avaliacao' || field.tipo === 'contador') {
                isEmpty = val == null || val === 0;
            } else if (field.tipo === 'botao' || field.tipo === 'separador' || field.tipo === 'dado') {
                isEmpty = false;
            } else {
                isEmpty = val === undefined || val === null || val === '';
            }

            if (isEmpty && !isCustomNew) {
                return; // suppress rendering
            }
        }

        const fieldWrap = document.createElement('div');
        // Larguras: grid de 12 colunas
        const spanMap = { '': 'span-6', 'full': 'span-12', 'terco': 'span-4', 'quarto': 'span-3', 'dois_tercos': 'span-8', 'tres_quartos': 'span-9' };
        fieldWrap.classList.add('cm-field', spanMap[field.largura] || 'span-6');
        if (field.largura === 'full') fieldWrap.classList.add('field-full');

        // Separador não tem label padrão nem input
        if (field.tipo === 'separador') {
            fieldWrap.className = 'cm-field span-12 cm-field-separador';
            const sep = document.createElement('div');
            sep.className = 'cm-separador';
            sep.textContent = field.label || '';
            fieldWrap.appendChild(sep);
            fieldsDiv.appendChild(fieldWrap);
            return;
        }

        if (field.tipo !== 'botao' && field.tipo !== 'select_botao') {
            const label = document.createElement('label');
            label.textContent = field.label || field.key;
            fieldWrap.appendChild(label);
        }

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
            fieldWrap.classList.remove('span-6', 'span-4', 'span-3', 'span-8', 'span-9');
            fieldWrap.classList.add('span-12', 'field-full');
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'class-module-steps';
            stepsContainer.dataset.modField = field.key;

            const readOnly = !!field.somenteLeitura;
            const steps = Array.isArray(data[field.key]) ? data[field.key] : [];
            steps.forEach((step, si) => {
                const stepEl = _buildModuleStep(mod.id, field.key, si, step, readOnly);
                stepsContainer.appendChild(stepEl);
            });

            if (!readOnly) {
                const addStepBtn = document.createElement('button');
                addStepBtn.className = 'class-module-add-step-btn no-print';
                addStepBtn.type = 'button';
                addStepBtn.textContent = '+ Passo';
                addStepBtn.addEventListener('click', () => {
                    const stepIdx = stepsContainer.querySelectorAll('.class-module-step').length;
                    const stepEl = _buildModuleStep(mod.id, field.key, stepIdx, {}, readOnly);
                    stepsContainer.insertBefore(stepEl, addStepBtn);
                    _saveModuleData(mod.id);
                });
                stepsContainer.appendChild(addStepBtn);
            }
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
        } else if (field.tipo === 'checkbox') {
            const inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.className = 'cm-checkbox';
            inp.dataset.modField = field.key;
            inp.checked = data[field.key] === true || data[field.key] === 'true';
            if (field.somenteLeitura) inp.disabled = true;
            inp.addEventListener('change', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'data') {
            const inp = document.createElement('input');
            inp.type = 'date';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'cor') {
            const inp = document.createElement('input');
            inp.type = 'color';
            inp.className = 'cm-color';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] || '#8b5cf6';
            if (field.somenteLeitura) inp.disabled = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'link') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-link-wrap';
            const inp = document.createElement('input');
            inp.type = 'url';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || 'https://...';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            const anchor = document.createElement('a');
            anchor.className = 'cm-link-go no-print';
            anchor.textContent = '🔗';
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            const syncLink = () => {
                const v = (inp.value || '').trim();
                anchor.href = v || '#';
                anchor.style.visibility = v ? 'visible' : 'hidden';
            };
            syncLink();
            inp.addEventListener('input', () => { syncLink(); _saveModuleData(mod.id); });
            wrap.appendChild(inp);
            wrap.appendChild(anchor);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'imagem') {
            const inp = document.createElement('input');
            inp.type = 'url';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || 'URL da imagem (https://...)';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            const img = document.createElement('img');
            img.className = 'cm-img-preview';
            img.alt = field.label || field.key;
            img.loading = 'lazy';
            const syncImg = () => {
                const v = (inp.value || '').trim();
                if (v) { img.src = v; img.style.display = ''; }
                else { img.removeAttribute('src'); img.style.display = 'none'; }
            };
            img.addEventListener('error', () => { img.style.display = 'none'; });
            syncImg();
            inp.addEventListener('input', () => { syncImg(); _saveModuleData(mod.id); });
            fieldWrap.appendChild(inp);
            fieldWrap.appendChild(img);
        } else if (field.tipo === 'avaliacao') {
            const stars = document.createElement('div');
            stars.className = 'cm-rating';
            stars.dataset.modRating = field.key;
            const val = parseInt(data[field.key], 10) || 0;
            stars.dataset.value = String(val);
            for (let s = 1; s <= 5; s++) {
                const star = document.createElement('span');
                star.className = 'cm-star' + (s <= val ? ' filled' : '');
                star.textContent = s <= val ? '★' : '☆';
                if (!field.somenteLeitura) {
                    star.addEventListener('click', () => {
                        const atual = parseInt(stars.dataset.value, 10) || 0;
                        const novo = (atual === s) ? 0 : s; // clicar na mesma estrela zera
                        stars.dataset.value = String(novo);
                        stars.querySelectorAll('.cm-star').forEach((el, i) => {
                            el.textContent = (i + 1) <= novo ? '★' : '☆';
                            el.classList.toggle('filled', (i + 1) <= novo);
                        });
                        _saveModuleData(mod.id);
                    });
                }
                stars.appendChild(star);
            }
            fieldWrap.appendChild(stars);
        } else if (field.tipo === 'contador') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-counter';
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'no-print';
            minus.textContent = '−';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] !== undefined && data[field.key] !== '' ? data[field.key] : 0;
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'no-print';
            plus.textContent = '+';
            const step = (delta) => {
                inp.value = (parseInt(inp.value, 10) || 0) + delta;
                _saveModuleData(mod.id);
            };
            if (field.somenteLeitura) { inp.readOnly = true; minus.disabled = true; plus.disabled = true; }
            minus.addEventListener('click', () => step(-1));
            plus.addEventListener('click', () => step(1));
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            wrap.appendChild(minus);
            wrap.appendChild(inp);
            wrap.appendChild(plus);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'tags') {
            const tagsWrap = document.createElement('div');
            tagsWrap.className = 'cm-tags';
            tagsWrap.dataset.modTags = field.key;
            const renderTag = (txt) => {
                const t = document.createElement('span');
                t.className = 'cm-tag';
                t.dataset.tagValue = txt;
                t.textContent = txt + ' ';
                if (!field.somenteLeitura) {
                    const x = document.createElement('button');
                    x.type = 'button';
                    x.className = 'no-print';
                    x.textContent = '×';
                    x.addEventListener('click', () => { t.remove(); _saveModuleData(mod.id); });
                    t.appendChild(x);
                }
                return t;
            };
            (Array.isArray(data[field.key]) ? data[field.key] : []).forEach(txt => tagsWrap.appendChild(renderTag(txt)));
            if (!field.somenteLeitura) {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'cm-tag-input no-print';
                inp.placeholder = field.placeholder || '+ tag (Enter)';
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = inp.value.trim().replace(/,$/, '');
                        if (!v) return;
                        tagsWrap.insertBefore(renderTag(v), inp);
                        inp.value = '';
                        _saveModuleData(mod.id);
                    }
                });
                tagsWrap.appendChild(inp);
            }
            fieldWrap.appendChild(tagsWrap);
        } else if (field.tipo === 'dado') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-dice';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || 'Ex: 2d6+1';
            const formulaFixa = (field.formula || '').trim();
            inp.value = data[field.key] || formulaFixa || '';
            if (formulaFixa) { inp.value = data[field.key] || formulaFixa; }
            if (field.somenteLeitura || formulaFixa) inp.readOnly = !!formulaFixa || !!field.somenteLeitura;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            const rollBtn = document.createElement('button');
            rollBtn.type = 'button';
            rollBtn.className = 'cm-dice-btn no-print';
            rollBtn.textContent = '🎲';
            const result = document.createElement('span');
            result.className = 'cm-dice-result';
            rollBtn.addEventListener('click', () => {
                const formula = formulaFixa || inp.value;
                const r = _cmRolarDado(formula);
                if (!r) { result.textContent = '⚠️ Fórmula inválida'; return; }
                result.textContent = `= ${r.total} (${r.rolagens.join(', ')}${r.bonus ? (r.bonus > 0 ? ` +${r.bonus}` : ` ${r.bonus}`) : ''})`;
            });
            wrap.appendChild(inp);
            wrap.appendChild(rollBtn);
            wrap.appendChild(result);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'botao') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-action-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cm-action-btn no-print';
            btn.textContent = field.label || field.key || 'Ativar';
            btn.title = field.placeholder || 'Aplica as mecânicas vinculadas';
            btn.addEventListener('click', () => _cmAplicarMecanicasBotao(field, btn));
            wrap.appendChild(btn);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'select_botao') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-action-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cm-action-btn no-print';
            btn.textContent = field.label || field.key || 'Ativar';
            btn.title = field.placeholder || 'Aplica a mecânica vinculada a este botão';
            btn.addEventListener('click', () => {
                let mechId = data[field.key];
                
                if (!mechId && data._predefId && mod && mod.itensPredefinidos) {
                    const pd = mod.itensPredefinidos.find(p => p.id === data._predefId);
                    if (pd && pd.valores && pd.valores[field.key]) {
                        mechId = pd.valores[field.key];
                        data[field.key] = mechId;
                        if (typeof _saveModuleData === 'function') _saveModuleData(mod.id);
                    }
                }

                if (!mechId) {
                    if (typeof showUpgradeBlocked === 'function') {
                        showUpgradeBlocked('Nenhuma mecânica configurada para este botão.');
                    } else if (typeof alert === 'function') {
                        alert('Nenhuma mecânica configurada para este botão.');
                    }
                    return;
                }
                const pseudoField = {
                    key: field.key,
                    label: field.label,
                    mecanicaIds: [mechId]
                };
                _cmAplicarMecanicasBotao(pseudoField, btn);
            });
            wrap.appendChild(btn);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'select_vd') {
            // Select de Valor Derivado interativo
            const selectVdWrap = document.createElement('div');
            selectVdWrap.className = 'cm-select-vd-wrap';

            const sel = document.createElement('select');
            sel.dataset.modField = field.key;

            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Selecionar Valor Derivado —';
            sel.appendChild(emptyOpt);

            const allDVs = window.DERIVED_VALUES || [];
            allDVs.forEach(dv => {
                const o = document.createElement('option');
                o.value = dv.id;
                o.textContent = `${dv.icone || '📊'} ${dv.nome}`;
                if (data[field.key] === dv.id) o.selected = true;
                sel.appendChild(o);
            });

            if (field.somenteLeitura) sel.disabled = true;

            // Preview chip do DV selecionado
            const preview = document.createElement('div');
            preview.className = 'cm-select-vd-preview';

            const _updatePreview = () => {
                const dvId = sel.value;
                const dvDef = allDVs.find(d => d.id === dvId);
                if (dvDef) {
                    const rawVal = state.derived?.[dvDef.key];
                    const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(1))) : '—';
                    preview.innerHTML = '';
                    preview.dataset.dvId = dvDef.id;
                    preview.dataset.dvKeyRef = dvDef.key;
                    const iconSp = document.createElement('span');
                    iconSp.className = 'cm-dv-icon';
                    iconSp.textContent = dvDef.icone || '📊';
                    const nameSp = document.createElement('span');
                    nameSp.className = 'cm-dv-name';
                    nameSp.textContent = dvDef.nome;
                    const valSp = document.createElement('span');
                    valSp.className = 'cm-dv-value';
                    valSp.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
                    preview.appendChild(iconSp);
                    preview.appendChild(nameSp);
                    preview.appendChild(valSp);
                    preview.classList.add('visible');
                } else {
                    preview.classList.remove('visible');
                    preview.innerHTML = '';
                    delete preview.dataset.dvId;
                    delete preview.dataset.dvKeyRef;
                }
            };

            sel.addEventListener('change', () => {
                _updatePreview();
                _saveModuleData(mod.id);
            });

            selectVdWrap.appendChild(sel);
            selectVdWrap.appendChild(preview);
            fieldWrap.appendChild(selectVdWrap);

            // Inicializar preview se já houver valor
            _updatePreview();
        } else if (field.tipo === 'valor_derivado') {
            // Exibe o valor derivado resolvido (chip + valor calculado)
            const dvId = field.derivedValueId || '';
            const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
            if (dvDef) {
                const rawVal = state.derived?.[dvDef.key];
                const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(1))) : '—';
                const chipDiv = document.createElement('div');
                chipDiv.className = 'cm-dv-chip';
                chipDiv.dataset.dvKeyRef = dvDef.key;
                const iconSpan = document.createElement('span');
                iconSpan.className = 'cm-dv-icon';
                iconSpan.textContent = dvDef.icone || '📊';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'cm-dv-name';
                nameSpan.textContent = dvDef.nome;
                const valSpan = document.createElement('span');
                valSpan.className = 'cm-dv-value';
                valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
                chipDiv.appendChild(iconSpan);
                chipDiv.appendChild(nameSpan);
                chipDiv.appendChild(valSpan);
                fieldWrap.appendChild(chipDiv);
            } else {
                const warn = document.createElement('span');
                warn.style.cssText = 'color:#ef4444;font-size:.72rem';
                warn.textContent = `⚠️ DV não encontrado: ${dvId}`;
                fieldWrap.appendChild(warn);
            }
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

    if (isCustomNew) {
        item.dataset.isCustomEdit = "true";
    }

    return item;
}

/**
 * Constrói um step individual dentro de um campo tipo 'steps'.
 */
function _buildModuleStep(moduleId, fieldKey, stepIdx, data, readOnly = false) {
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
    if (readOnly) nameInp.readOnly = true;
    nameInp.addEventListener('input', () => _saveModuleData(moduleId));
    stepHeader.appendChild(nameInp);

    if (!readOnly) {
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'no-print';
        rmBtn.textContent = '✕';
        rmBtn.addEventListener('click', () => {
            step.remove();
            _saveModuleData(moduleId);
        });
        stepHeader.appendChild(rmBtn);
    }
    step.appendChild(stepHeader);

    const descTa = document.createElement('textarea');
    descTa.dataset.stepField = 'desc';
    descTa.placeholder = 'Descrição do passo...';
    descTa.value = data.desc || '';
    if (readOnly) descTa.readOnly = true;
    descTa.addEventListener('input', () => _saveModuleData(moduleId));
    step.appendChild(descTa);

    return step;
}

/**
 * Verifica se o personagem possui saldo suficiente para a mecânica de custo.
 */
function _cmCheckMechanicCost(mechId) {
    if (!mechId) return { ok: true, label: 'Sem custo' };
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (!mech) return { ok: true, label: 'Mecânica não encontrada' };
    
    if (mech.tipo === 'booleano') {
        const config = mech.config || {};
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            
            const formatEq = (eq) => {
                if (!Array.isArray(eq)) return String(eq);
                return eq.map((e, idx) => {
                    const txt = e.tipo === 'ficha' ? `[${e.ref}]` : String(e.valor || 0);
                    const op = idx > 0 ? (e.op ? ` ${e.op} ` : ' + ') : '';
                    return op + txt;
                }).join('');
            };
            
            const eqAStr = formatEq(config.equacaoA);
            const eqBStr = formatEq(config.equacaoB);
            const labelStr = `${eqAStr} ${op} ${eqBStr} ? ${r ? '✅' : '❌ ' + (config.valorFalso || 'Requisito não atendido')}`;
            
            return { ok: r, label: labelStr };
        } catch (e) {
            return { ok: false, label: 'Erro ao avaliar requisito' };
        }
    }
    
    if (mech.tipo === 'condicional_encadeado') {
        const config = mech.config || {};
        try {
            if (typeof resolveChainedConditional !== 'function') return { ok: true, label: 'Sem custo' };
            const res = resolveChainedConditional(config);
            return { ok: true, label: `🔗 ${res.valorEquacao} → "${res.valorSaida}"` };
        } catch (e) {
            return { ok: false, label: 'Erro ao avaliar condicional' };
        }
    }
    
    let isSubtracao = false;
    let requiredVal = 0;
    let fieldKey = '';
    
    if (mech.tipo === 'modificar' && mech.config?.calculos) {
        for (const calc of mech.config.calculos) {
            if (calc.operacao === '-') {
                isSubtracao = true;
                requiredVal = typeof resolveCalcValue === 'function' ? resolveCalcValue(calc) : 0;
                fieldKey = calc.alvo;
                break;
            }
        }
    } else if (mech.tipo === 'modificar' && mech.config?.operacao === '-') {
        isSubtracao = true;
        requiredVal = parseInt(mech.config.valor || 0, 10);
        fieldKey = mech.config.alvo;
    }

    if (isSubtracao && fieldKey) {
        let current = 0;
        // O valor pode estar em diferentes locais do state
        const targetMap = (typeof TARGET_MAP !== 'undefined') ? TARGET_MAP : (window.TARGET_MAP || {});
        const rawTarget = targetMap[fieldKey] || fieldKey;
        const cleanKey = rawTarget.replace(/^(DERIVED|BASE|INFO|SET|MULT|DIV|ATUAL):/, '');
        
        if (rawTarget.startsWith('ATUAL:')) {
            const input = document.querySelector(`[data-key="${cleanKey}"]`);
            if (input) current = Number(input.value) || 0;
            else if (state.derivedValues && state.derivedValues[cleanKey] !== undefined) current = Number(state.derivedValues[cleanKey]) || 0;
        } else if (state.derived && state.derived[cleanKey] !== undefined) {
            current = state.derived[cleanKey];
        } else if (state.atributos && state.atributos[cleanKey] !== undefined) {
            current = state.atributos[cleanKey];
        } else if (state.vitalStats && state.vitalStats[cleanKey] !== undefined) {
            current = state.vitalStats[cleanKey];
        } else if (cleanKey.toLowerCase() === 'exp' || fieldKey.toLowerCase() === 'exp') {
            current = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        } else if (fieldKey.toLowerCase() === 'ouro' || fieldKey.toLowerCase() === 'dinheiro') {
            current = window._inventoryState?.dinheiro || 0;
        }

        if (current < requiredVal) {
            return { ok: false, label: `Saldo insuficiente de ${fieldKey} (Requer ${requiredVal}, possui ${current})` };
        }
    }

    return { ok: true, label: `Custo: ${_cmMechPreviewLabel(mech)}` };
}

/**
 * Rótulo de custo de uma mecânica: usa o PREVIEW (resumo dos efeitos,
 * ex: "-1 em Presas") em vez do nome interno, deixando claro quais
 * atributos/status do personagem sofrerão mutação.
 */
function _cmMechPreviewLabel(mech) {
    if (!mech) return '';
    let preview = '';
    try {
        if (typeof generatePreviewText === 'function') {
            preview = generatePreviewText(mech) || '';
        }
    } catch (e) {
        preview = '';
    }
    if (!preview && mech.previewTexto) preview = mech.previewTexto;
    return preview || mech.nome || 'Custo';
}

/**
 * Aplica a mecânica de custo.
 */
function _cmApplyMechanicCost(mechId) {
    if (!mechId) return;
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (mech && typeof applyMechanicToSheet === 'function') {
        applyMechanicToSheet(mech, null, true);
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof scheduleAutosave === 'function') scheduleAutosave();
        console.log(`💸 Custo condicional pago: ${mech.nome}`);
    }
}

/**
 * Obtém a lista de mecânicas de custo de um módulo (suporta legado e novo array).
 */
function _cmGetCostMechanics(mod, type) {
    const ids = Array.isArray(mod[`${type}MecanicaIds`]) ? mod[`${type}MecanicaIds`].slice() : [];
    if (mod[`${type}MecanicaId`] && !ids.includes(mod[`${type}MecanicaId`])) ids.push(mod[`${type}MecanicaId`]);
    return ids;
}

/**
 * Verifica os custos de um array de mecânicas.
 */
function _cmCheckMechanicsCosts(mechIds) {
    if (!mechIds || mechIds.length === 0) return { ok: true, label: 'Sem custo', costs: [] };
    const labels = [];
    for (const id of mechIds) {
        const check = _cmCheckMechanicCost(id);
        if (!check.ok) return check; 
        if (check.label !== 'Sem custo' && !check.label.includes('não encontrada')) {
            labels.push(check.label.replace('Custo: ', ''));
        }
    }
    return { ok: true, label: labels.length ? `Custo: ${labels.join(' · ')}` : 'Sem custo', costs: labels };
}

/**
 * Aplica os custos de um array de mecânicas.
 */
function _cmApplyMechanicsCosts(mechIds) {
    if (!mechIds || mechIds.length === 0) return;
    for (const id of mechIds) {
        _cmApplyMechanicCost(id);
    }
}

/**
 * Remove um item de módulo com confirmação e validação de custo.
 */
function _removeModuleItem(mod, itemEl) {
    const remIds = _cmGetCostMechanics(mod, 'custoRemocao');
    if (mod.custoRemocaoAtivo && remIds.length > 0) {
        const check = _cmCheckMechanicsCosts(remIds);
        if (!check.ok) {
            if (typeof showUpgradeBlocked === 'function') {
                showUpgradeBlocked(`Bloqueado: ${check.label}`);
            } else {
                alert(`Bloqueado: ${check.label}`);
            }
            return; // Impede exclusão
        }
        
        if (!confirm(`Remover este item?\nIsso consumirá: ${check.label.replace('Custo: ', '')}`)) return;
        _cmApplyMechanicsCosts(remIds);
    } else {
        if (!confirm('Remover este item?')) return;
    }

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

        // Campos simples (text, number, textarea, select, date, color, url, hidden...)
        itemEl.querySelectorAll('[data-mod-field]').forEach(el => {
            const key = el.dataset.modField;
            if (el.type === 'checkbox') {
                data[key] = el.checked;
            } else {
                data[key] = el.value;
            }
        });

        // Campos de avaliação (estrelas)
        itemEl.querySelectorAll('[data-mod-rating]').forEach(el => {
            data[el.dataset.modRating] = parseInt(el.dataset.value, 10) || 0;
        });

        // Campos de tags
        itemEl.querySelectorAll('[data-mod-tags]').forEach(el => {
            const tags = [];
            el.querySelectorAll('.cm-tag').forEach(t => {
                const v = t.dataset.tagValue || t.textContent.replace('×', '').trim();
                if (v) tags.push(v);
            });
            data[el.dataset.modTags] = tags;
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

/**
 * Atualiza todos os previews de Select VD e chips de Valor Derivado
 * com os valores calculados atuais de state.derived.
 * Deve ser chamada após recalcAll().
 */
function _updateAllDVDisplaysInModules() {
    const allDVs = window.DERIVED_VALUES || [];
    if (!allDVs.length) return;

    // Atualizar previews de Select VD
    document.querySelectorAll('.cm-select-vd-preview[data-dv-key-ref]').forEach(preview => {
        const dvKey = preview.dataset.dvKeyRef;
        const dvDef = allDVs.find(d => d.id === preview.dataset.dvId) || allDVs.find(d => d.key === dvKey);
        if (!dvDef) return;
        const rawVal = state.derived?.[dvDef.key];
        const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(1))) : '—';
        const valSpan = preview.querySelector('.cm-dv-value');
        if (valSpan) valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
    });

    // Atualizar chips estáticos de valor_derivado
    document.querySelectorAll('.cm-dv-chip[data-dv-key-ref]').forEach(chip => {
        const dvKey = chip.dataset.dvKeyRef;
        const dvDef = allDVs.find(d => d.key === dvKey);
        if (!dvDef) return;
        const rawVal = state.derived?.[dvDef.key];
        const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(1))) : '—';
        const valSpan = chip.querySelector('.cm-dv-value');
        if (valSpan) valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
    });
}

window.addEventListener('beforeunload', (e) => {
    let warningMessages = [];
    document.querySelectorAll('.class-module-item[data-is-custom-edit="true"]').forEach(itemEl => {
        const modId = itemEl.dataset.moduleId;
        let modObj;
        for (const cls of Object.values(window._classModules || {})) {
            modObj = cls.find(m => m.id === modId);
            if (modObj) break;
        }
        if (!modObj) return;

        let lostFields = [];
        modObj.schema.forEach(field => {
            if (field.ocultarSeVazio) {
                let isEmpty = false;
                if (field.tipo === 'progress') {
                    const elAtual = itemEl.querySelector(`[data-mod-field="${field.key}_atual"]`);
                    const elTotal = itemEl.querySelector(`[data-mod-field="${field.key}_total"]`);
                    isEmpty = (!elAtual || !elAtual.value) && (!elTotal || !elTotal.value);
                } else if (field.tipo === 'steps') {
                    const elSteps = itemEl.querySelectorAll(`.class-module-steps[data-mod-field="${field.key}"] .class-module-step`);
                    isEmpty = elSteps.length === 0;
                } else if (field.tipo === 'tags') {
                    const elTags = itemEl.querySelectorAll(`[data-mod-tags="${field.key}"] .cm-tag`);
                    isEmpty = elTags.length === 0;
                } else if (field.tipo === 'checkbox') {
                    const elCb = itemEl.querySelector(`[data-mod-field="${field.key}"]`);
                    isEmpty = !elCb || !elCb.checked;
                } else if (field.tipo === 'avaliacao' || field.tipo === 'contador') {
                    const elRat = itemEl.querySelector(`[data-mod-rating="${field.key}"]`);
                    isEmpty = !elRat || parseInt(elRat.dataset.value, 10) === 0;
                } else if (field.tipo === 'botao' || field.tipo === 'separador' || field.tipo === 'dado') {
                    isEmpty = false;
                } else {
                    const el = itemEl.querySelector(`[data-mod-field="${field.key}"]`);
                    isEmpty = !el || !el.value;
                }

                if (isEmpty) {
                    lostFields.push(field.label || field.key);
                }
            }
        });

        if (lostFields.length > 0) {
            warningMessages.push(`Você irá perder os campos [${lostFields.join(', ')}] do módulo [${modObj.titulo}] ao atualizar a página.`);
        }
    });

    if (warningMessages.length > 0) {
        const msg = `Tem certeza? ${warningMessages.join(' ')}`;
        e.preventDefault();
        e.returnValue = msg;
        return msg;
    }
});
