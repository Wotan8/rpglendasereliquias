// =============================================
// AREA MESAS — Peculiaridades dos Personagens
// =============================================
import { db, collection, getDocs, doc, getDoc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadPersonagensPeculiaridades = loadPersonagensPeculiaridades;

async function _fetchMesaCharacters() {
    const chars = S.mesaCharacters || [];
    if (!chars.length) {
        const snap = await getDocs(collection(db, 'char'));
        snap.forEach(d => {
            const raw = d.data();
            const f = raw.fields || {};
            if (raw.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores||[]).includes(raw.ownerUid)) {
                chars.push({ id: d.id, nome: f.nome || raw.nome || '', ownerUid: raw.ownerUid || '', ownerEmail: raw.ownerEmail || '', ...raw });
            }
        });
        S.setMesaCharacters(chars);
    }
    return chars;
}

async function loadPersonagensPeculiaridades() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaCharactersPeculiaridadesContainer'); 
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando peculiaridades...</div>';
    
    // Ensure system peculiarities are loaded
    await _ensureSystemPeculiaritiesLoaded();

    try {
        const chars = await _fetchMesaCharacters();

        let html = '';

        if (!chars.length) {
            html += '<div style="text-align:center;padding:30px;color:var(--muted)">Nenhum personagem nesta mesa</div>';
        } else {
            html += `<div style="margin-top: 10px;">
                        <h3 style="color:var(--light);margin-bottom:10px;padding-left:10px;border-left:4px solid var(--primary)">Peculiaridades dos Personagens</h3>
                        <div class="accordion-group">`;
            for (const c of chars) {
                html += _buildCharacterPeculiaridadesAccordionHTML(c);
            }
            html += `</div></div>`;
        }

        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar peculiaridades', 'danger'); }
}

async function _ensureSystemPeculiaritiesLoaded() {
    if (!window._systemData) window._systemData = {};
    if (!window._systemData.peculiarities || window._systemData.peculiarities.length === 0) {
        try {
            const snap = await getDocs(collection(db, 'system/data/peculiarities'));
            window._systemData.peculiarities = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) window._systemData.peculiarities.push({ id: d.id, ...data });
            });
        } catch(e) {
            console.error("Erro ao carregar peculiaridades do sistema:", e);
            window._systemData.peculiarities = [];
        }
    }
}

window.togglePeculiaridadesAccordion = function(elId) {
    const el = document.getElementById(elId);
    if(el) {
        el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    }
};

function _buildCharacterPeculiaridadesAccordionHTML(char) {
    const cid = char.id;
    const bodyId = `acc_pec_body_${cid}`;
    const f = char.fields || {};
    const nomeReal = f.nome || char.nome || 'Sem nome';
    const peculiaridades = char.peculiaridadesIndividuais || [];

    return `
    <div class="accordion-item" style="margin-bottom:8px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px;">
        <div class="accordion-header" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="togglePeculiaridadesAccordion('${bodyId}')">
            <div style="font-weight:bold; color:var(--light);">🎭 ${escapeHtml(nomeReal)}</div>
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="font-size:0.8rem; color:var(--muted);">${peculiaridades.length} peculiaridade(s)</span>
                <span style="color:var(--muted);">▼</span>
            </div>
        </div>
        <div class="accordion-body" id="${bodyId}" style="display:none; padding:16px; border-top:1px solid var(--border);">
            <div style="margin-bottom:12px; text-align:right;">
                <button class="btn btn-secondary btn-small" onclick="_openMestrePeculiaridadeFormModal('${cid}')">➕ Adicionar Peculiaridade</button>
            </div>
            ${_buildPeculiaridadesListHTML(peculiaridades, cid)}
        </div>
    </div>`;
}

function _buildPeculiaridadesListHTML(peculiaridades, charId) {
    if (peculiaridades.length === 0) {
        return '<div class="inv-empty-small">Nenhuma peculiaridade individual</div>';
    }
    
    const sysPecs = window._systemData?.peculiarities || [];
    
    let html = '<div class="cond-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">';
    
    peculiaridades.forEach((pec, idx) => {
        const isObj = typeof pec === 'object' && pec !== null;
        const pecId = isObj ? pec.id : pec;
        const nivelInicial = isObj ? (pec.nivelInicial || 1) : 1;
        
        // Resolve from system data
        const sysPec = sysPecs.find(p => p.id === pecId);
        const nome = sysPec?.nome || pecId || 'Sem nome';
        const desc = sysPec?.descricao || '';
        const icone = sysPec?.icone || '✨';
        const fonte = sysPec?.fonte || 'individual';
        const tipo = sysPec?.tipo || 'fixo';
        const nivelMax = sysPec?.nivelMax || null;
        
        // Fonte label
        const fonteLabels = {
            'raca': '🧬 Racial',
            'classe': '⚔️ Classe',
            'tribo': '🏕️ Tribo',
            'individual': '👤 Individual',
            'condicao': '💀 Condição',
            'generica': '📋 Genérica'
        };
        const fonteLabel = fonteLabels[fonte] || `📋 ${fonte}`;
        
        html += `<div class="cond-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; position: relative;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 1.5rem; margin-right: 8px;">${escapeHtml(icone)}</div>
                <div style="font-weight: bold; color: var(--light); flex: 1;">${escapeHtml(nome)}</div>
                <div class="cond-actions" style="display: flex; gap: 4px;">
                    <button class="inv-btn" style="background:rgba(139,92,246,.12);color:var(--primary)" onclick="_openMestrePeculiaridadeFormModal('${charId}', ${idx})" title="Editar">✏️</button>
                    <button class="inv-btn inv-btn-delete" onclick="_deleteMestrePeculiaridade('${charId}', ${idx})" title="Excluir">🗑️</button>
                </div>
            </div>
            ${desc ? `<div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px;">${escapeHtml(desc)}</div>` : ''}
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <div style="font-size: 0.8rem; background: rgba(0, 0, 0, 0.2); padding: 4px 8px; border-radius: 4px; display: inline-block;">
                    ${escapeHtml(fonteLabel)}
                </div>
                <div style="font-size: 0.8rem; background: rgba(139, 92, 246, 0.15); padding: 4px 8px; border-radius: 4px; display: inline-block;">
                    ⭐ Nível: ${nivelInicial}${nivelMax ? ` / ${nivelMax}` : ''}
                </div>
                ${tipo === 'evolutivo' ? `<div style="font-size: 0.8rem; background: rgba(245, 158, 11, 0.15); padding: 4px 8px; border-radius: 4px; display: inline-block;">📈 Evolutiva</div>` : ''}
            </div>
        </div>`;
    });
    
    html += '</div>';
    return html;
}

// ===== MODAL DE FORMULÁRIO =====

window._openMestrePeculiaridadeFormModal = async function(charId, editIndex = null) {
    let existing = document.getElementById('pecFormModalMestre');
    if (existing) existing.remove();

    await _ensureSystemPeculiaritiesLoaded();

    let pecEntry = null;
    let char = null;
    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (snap.exists()) {
            char = { id: snap.id, ...snap.data() };
            if (editIndex !== null && char.peculiaridadesIndividuais && char.peculiaridadesIndividuais[editIndex]) {
                pecEntry = char.peculiaridadesIndividuais[editIndex];
            }
        }
    } catch(e) { console.error(e); }

    const isEdit = editIndex !== null && pecEntry;
    
    // Resolve current peculiarity data for edit mode
    let currentPecId = '';
    let currentNivel = 1;
    if (isEdit) {
        const isObj = typeof pecEntry === 'object' && pecEntry !== null;
        currentPecId = isObj ? pecEntry.id : pecEntry;
        currentNivel = isObj ? (pecEntry.nivelInicial || 1) : 1;
    }
    
    const templates = window._systemData?.peculiarities || [];
    
    // Build searchable select for templates
    let templatePickerHtml = '';
    if (templates.length > 0) {
        const options = templates.map(t => ({
            value: t.id,
            label: `${t.icone || '✨'} ${t.nome}`,
            sub: t.fonte ? `Fonte: ${t.fonte}` : '',
            fonte: t.fonte || ''
        }));
        templatePickerHtml = `<div class="inv-form-group inv-form-wide" style="margin-bottom:12px;">
            <label class="inv-form-label">Filtrar por Fonte</label>
            <select class="inv-form-input" id="mpecFormFilterFonte" style="margin-bottom: 8px;">
                <option value="">Todas</option>
                <option value="raca">Raça</option>
                <option value="classe">Classe</option>
                <option value="tribo">Tribo</option>
                <option value="individual">Individual</option>
                <option value="condicao">Condição</option>
                <option value="generica">Genérica</option>
            </select>
            <label class="inv-form-label">✨ Peculiaridade do Catálogo *</label>
            ${_createPecSearchableSelectHTML('mestrePecTemplatePicker', options, '— Selecionar Peculiaridade —', 'Pesquisar peculiaridade...')}
        </div>`;
    }

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'pecFormModalMestre';
    
    // Resolve current peculiarity for display in edit mode
    let currentPecData = null;
    if (isEdit && currentPecId) {
        currentPecData = templates.find(t => t.id === currentPecId);
    }
    const editPecName = currentPecData ? `${currentPecData.icone || '✨'} ${currentPecData.nome}` : '';

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Peculiaridade' : '➕ Adicionar Peculiaridade'}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${templatePickerHtml}
            <div id="mestrePecPreview" style="display:${isEdit && currentPecData ? 'block' : 'none'}; margin-bottom: 12px; padding: 12px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px;">
                <div id="mestrePecPreviewContent">
                    ${isEdit && currentPecData ? _buildPecPreviewHTML(currentPecData) : ''}
                </div>
            </div>
            <div class="inv-form-grid">
                <div class="inv-form-group">
                    <label class="inv-form-label">⭐ Nível Inicial</label>
                    <input type="number" id="mpecFormNivel" class="inv-form-input" value="${currentNivel}" min="1" max="10" placeholder="1">
                </div>
            </div>
            <input type="hidden" id="mpecFormCharId" value="${charId}">
            <input type="hidden" id="mpecFormPecId" value="${currentPecId}">
            ${isEdit ? `<input type="hidden" id="mpecFormEditIndex" value="${editIndex}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="_saveMestrePeculiaridade()">💾 Salvar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    if (templates.length > 0) {
        _initPecSearchableSelect('mestrePecTemplatePicker', (value) => {
            _onPecTemplateSelected(value);
        });
        
        // If editing, set the select to current value
        if (isEdit && currentPecId) {
            const container = document.getElementById('mestrePecTemplatePicker');
            if (container) {
                const input = container.querySelector('.searchable-select-input');
                if (input) input.value = editPecName;
                container.dataset.selectedValue = currentPecId;
            }
        }
    }
};

function _buildPecPreviewHTML(pecData) {
    if (!pecData) return '';
    const fonteLabels = {
        'raca': '🧬 Racial', 'classe': '⚔️ Classe', 'tribo': '🏕️ Tribo',
        'individual': '👤 Individual', 'condicao': '💀 Condição', 'generica': '📋 Genérica'
    };
    return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:1.3rem;">${escapeHtml(pecData.icone || '✨')}</span>
            <strong style="color:var(--light);">${escapeHtml(pecData.nome || '')}</strong>
            <span style="font-size:0.75rem;color:var(--muted);background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;">${fonteLabels[pecData.fonte] || pecData.fonte || ''}</span>
        </div>
        ${pecData.descricao ? `<div style="font-size:0.85rem;color:var(--muted);">${escapeHtml(pecData.descricao)}</div>` : ''}
        ${pecData.nivelMax ? `<div style="font-size:0.8rem;color:var(--primary);margin-top:4px;">Nível máximo: ${pecData.nivelMax}</div>` : ''}
    `;
}

window._onPecTemplateSelected = function(templateId) {
    const preview = document.getElementById('mestrePecPreview');
    const previewContent = document.getElementById('mestrePecPreviewContent');
    const pecIdInput = document.getElementById('mpecFormPecId');
    
    if (!templateId) {
        if (preview) preview.style.display = 'none';
        if (previewContent) previewContent.innerHTML = '';
        if (pecIdInput) pecIdInput.value = '';
        return;
    }
    
    const tpl = (window._systemData?.peculiarities || []).find(p => p.id === templateId);
    if (!tpl) return;
    
    if (pecIdInput) pecIdInput.value = tpl.id;
    if (preview) preview.style.display = 'block';
    if (previewContent) previewContent.innerHTML = _buildPecPreviewHTML(tpl);
    
    // Set max level if available
    const nivelInput = document.getElementById('mpecFormNivel');
    if (nivelInput && tpl.nivelMax) {
        nivelInput.max = tpl.nivelMax;
    }
};

// ===== SEARCHABLE SELECT (cloned from conditions for encapsulation) =====

function _createPecSearchableSelectHTML(containerId, options, defaultLabel, placeholder) {
    const optionsHtml = options.map(opt =>
        `<div class="searchable-select-option" data-value="${escapeHtml(opt.value)}" data-fonte="${escapeHtml(opt.fonte || '')}">
            <div>${escapeHtml(opt.label)}</div>
            ${opt.sub ? `<div class="searchable-select-option-sub">${escapeHtml(opt.sub)}</div>` : ''}
        </div>`
    ).join('');

    return `<div class="searchable-select" id="${containerId}">
        <input type="text" class="searchable-select-input" placeholder="${escapeHtml(placeholder || 'Selecionar...')}" readonly>
        <span class="searchable-select-arrow">▼</span>
        <div class="searchable-select-dropdown">
            <div class="searchable-select-search">
                <input type="text" placeholder="🔍 Pesquisar..." autocomplete="off">
            </div>
            <div class="searchable-select-default" data-value="">${escapeHtml(defaultLabel || '— Nenhum —')}</div>
            <div class="searchable-select-options-list">
                ${optionsHtml}
            </div>
            <div class="searchable-select-empty" style="display:none">Nenhum resultado encontrado</div>
        </div>
    </div>`;
}

function _initPecSearchableSelect(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    const dropdown = container.querySelector('.searchable-select-dropdown');
    const searchInput = dropdown.querySelector('.searchable-select-search input');
    const optionsList = container.querySelector('.searchable-select-options-list');
    const emptyMsg = container.querySelector('.searchable-select-empty');
    const defaultOpt = container.querySelector('.searchable-select-default');

    function toggleOpen(open) {
        const modalContent = container.closest('.inv-modal-content');
        if (open) {
            container.classList.add('open');
            if (modalContent) {
                // Save original height to restore later, increase size for dropdown
                if (!modalContent.dataset.origHeight) {
                    modalContent.dataset.origHeight = modalContent.style.minHeight || '';
                }
                modalContent.style.minHeight = '500px';
            }
            searchInput.value = '';
            _filterOptions('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            container.classList.remove('open');
            if (modalContent && modalContent.dataset.origHeight !== undefined) {
                modalContent.style.minHeight = modalContent.dataset.origHeight;
            }
        }
    }

    function _filterOptions(query) {
        const fonteFilter = document.getElementById('mpecFormFilterFonte')?.value || '';
        const q = query.toLowerCase().trim();
        const options = optionsList.querySelectorAll('.searchable-select-option');
        let visible = 0;
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const optFonte = opt.dataset.fonte || '';
            const matchQuery = !q || text.includes(q);
            const matchFonte = !fonteFilter || optFonte === fonteFilter;
            const match = matchQuery && matchFonte;
            opt.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        if (defaultOpt) defaultOpt.style.display = (q || fonteFilter) ? 'none' : '';
        emptyMsg.style.display = (visible === 0 && (q || fonteFilter)) ? '' : 'none';
    }

    const fonteSelect = document.getElementById('mpecFormFilterFonte');
    if (fonteSelect) {
        fonteSelect.addEventListener('change', () => {
            // Re-apply filter when dropdown changes, and optionally open select
            if (!container.classList.contains('open')) toggleOpen(true);
            else _filterOptions(searchInput.value);
        });
    }

    function selectOption(value, label) {
        input.value = label || '';
        container.dataset.selectedValue = value || '';
        toggleOpen(false);
        if (onChange) onChange(value);
    }

    input.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpen(!container.classList.contains('open'));
    });

    searchInput.addEventListener('input', () => {
        _filterOptions(searchInput.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    if (defaultOpt) {
        defaultOpt.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption('', '');
        });
    }

    optionsList.querySelectorAll('.searchable-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            const label = opt.querySelector('div').textContent;
            selectOption(val, label);
        });
    });

    document.addEventListener('click', () => toggleOpen(false));
    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// ===== SAVE =====

window._saveMestrePeculiaridade = async function() {
    const charId = document.getElementById('mpecFormCharId')?.value;
    const pecId = document.getElementById('mpecFormPecId')?.value?.trim();
    if (!pecId) { showAlert('Selecione uma peculiaridade do catálogo', 'warning'); return; }

    const editIndexEl = document.getElementById('mpecFormEditIndex');
    const isEdit = !!editIndexEl;
    const editIndex = isEdit ? parseInt(editIndexEl.value) : -1;

    const nivelInicial = parseInt(document.getElementById('mpecFormNivel')?.value) || 1;

    const pecData = {
        id: pecId,
        nivelInicial: nivelInicial
    };

    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (!snap.exists()) return;
        const charData = snap.data();
        let peculiaridadesIndividuais = charData.peculiaridadesIndividuais || [];

        if (isEdit && editIndex >= 0 && editIndex < peculiaridadesIndividuais.length) {
            peculiaridadesIndividuais[editIndex] = pecData;
        } else {
            // Check if already exists
            const alreadyExists = peculiaridadesIndividuais.some(p => {
                const id = typeof p === 'object' ? p.id : p;
                return id === pecId;
            });
            if (alreadyExists) {
                showAlert('⚠️ Esta peculiaridade já está atribuída a este personagem', 'warning');
                return;
            }
            peculiaridadesIndividuais.push(pecData);
        }

        await updateDoc(doc(db, 'char', charId), { peculiaridadesIndividuais });

        const charInCache = (S.mesaCharacters || []).find(c => c.id === charId);
        if (charInCache) {
            charInCache.peculiaridadesIndividuais = peculiaridadesIndividuais;
        }

        document.getElementById('pecFormModalMestre')?.remove();
        showAlert('✨ Peculiaridade salva com sucesso!', 'success');
        
        loadPersonagensPeculiaridades();
    } catch(e) {
        console.error(e);
        showAlert('Erro ao salvar peculiaridade', 'danger');
    }
};

// ===== DELETE =====

window._deleteMestrePeculiaridade = async function(charId, idx) {
    if (!confirm('Deseja realmente excluir esta peculiaridade?')) return;

    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (!snap.exists()) return;
        const charData = snap.data();
        let peculiaridadesIndividuais = charData.peculiaridadesIndividuais || [];

        if (idx >= 0 && idx < peculiaridadesIndividuais.length) {
            peculiaridadesIndividuais.splice(idx, 1);
            await updateDoc(doc(db, 'char', charId), { peculiaridadesIndividuais });
            
            const charInCache = (S.mesaCharacters || []).find(c => c.id === charId);
            if (charInCache) {
                charInCache.peculiaridadesIndividuais = peculiaridadesIndividuais;
            }

            showAlert('Peculiaridade excluída', 'success');
            loadPersonagensPeculiaridades();
        }
    } catch(e) {
        console.error(e);
        showAlert('Erro ao excluir peculiaridade', 'danger');
    }
};
