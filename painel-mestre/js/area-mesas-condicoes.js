// =============================================
// AREA MESAS — Condições dos Personagens
// =============================================
import { db, collection, getDocs, doc, getDoc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { confirmar } from '../../shared/dialogo.js?v=2';

window._loadPersonagensCondicoes = loadPersonagensCondicoes;

async function _fetchMesaCharacters() {
    const chars = S.mesaCharacters || [];
    if (!chars.length) {
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        snap.forEach(d => {
            const raw = d.data();
            const f = raw.fields || {};
            chars.push({ id: d.id, nome: f.nome || raw.nome || '', ownerUid: raw.ownerUid || '', ownerEmail: raw.ownerEmail || '', ...raw });
        });
        S.setMesaCharacters(chars);
    }
    return chars;
}

async function loadPersonagensCondicoes() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaCharactersConditionsContainer'); 
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando condições...</div>';
    
    try {
        const chars = await _fetchMesaCharacters();

        let html = '';

        if (!chars.length) {
            html += '<div style="text-align:center;padding:30px;color:var(--muted)">Nenhum personagem nesta mesa</div>';
        } else {
            html += `<div style="margin-top: 10px;">
                        <h3 style="color:var(--light);margin-bottom:10px;padding-left:10px;border-left:4px solid var(--primary)">Condições dos Personagens</h3>
                        <div class="accordion-group">`;
            for (const c of chars) {
                html += _buildCharacterConditionsAccordionHTML(c);
            }
            html += `</div></div>`;
        }

        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar condições', 'danger'); }
}

window.toggleConditionsAccordion = function(elId) {
    const el = document.getElementById(elId);
    if(el) {
        el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    }
};

function _buildCharacterConditionsAccordionHTML(char) {
    const cid = char.id;
    const bodyId = `acc_cond_body_${cid}`;
    const f = char.fields || {};
    const nomeReal = f.nome || char.nome || 'Sem nome';
    const conditions = char.conditions || [];

    return `
    <div class="accordion-item" style="margin-bottom:8px; background:var(--lr-bg-1); border:1px solid var(--border); border-radius:8px;">
        <div class="accordion-header" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleConditionsAccordion('${bodyId}')">
            <div style="font-weight:bold; color:var(--light);">🎭 ${escapeHtml(nomeReal)}</div>
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="font-size:0.8rem; color:var(--muted);">${conditions.length} condição(ões)</span>
                <span style="color:var(--muted);">▼</span>
            </div>
        </div>
        <div class="accordion-body" id="${bodyId}" style="display:none; padding:16px; border-top:1px solid var(--border);">
            <div style="margin-bottom:12px; text-align:right;">
                <button class="btn btn-secondary btn-small" onclick="_openMestreConditionFormModal('${cid}')">➕ Criar Condição</button>
            </div>
            ${_buildConditionsListHTML(conditions, cid)}
        </div>
    </div>`;
}

function _buildConditionsListHTML(conditions, charId) {
    if (conditions.length === 0) {
        return '<div class="inv-empty-small">Nenhuma condição ativa</div>';
    }
    
    let html = '<div class="cond-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">';
    
    conditions.forEach((cond, idx) => {
        const icone = cond.icone || '💀';
        const nome = cond.nome || 'Sem nome';
        const desc = cond.descricao || '';
        const tAtual = cond.tempoAtual || '0';
        const tMax = cond.tempoRestante || '0';
        
        html += `<div class="cond-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; position: relative;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 1.5rem; margin-right: 8px;">${escapeHtml(icone)}</div>
                <div style="font-weight: bold; color: var(--light); flex: 1;">${escapeHtml(nome)}</div>
                <div class="cond-actions" style="display: flex; gap: 4px;">
                    <button class="inv-btn" style="background:rgba(139,92,246,.12);color:var(--primary)" onclick="_openMestreConditionFormModal('${charId}', ${idx})" title="Editar">✏️</button>
                    <button class="inv-btn inv-btn-delete" onclick="_deleteMestreCondition('${charId}', ${idx})" title="Excluir">🗑️</button>
                </div>
            </div>
            ${desc ? `<div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px;">${escapeHtml(desc)}</div>` : ''}
            <div style="font-size: 0.8rem; background:var(--lr-bg-1); padding: 4px 8px; border-radius: 4px; display: inline-block;">
                ⏱️ Tempo: ${escapeHtml(tAtual)} / ${escapeHtml(tMax)}
            </div>
        </div>`;
    });
    
    html += '</div>';
    return html;
}

window._openMestreConditionFormModal = async function(charId, editIndex = null) {
    let existing = document.getElementById('condFormModalMestre');
    if (existing) existing.remove();

    let condition = null;
    let char = null;
    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (snap.exists()) {
            char = { id: snap.id, ...snap.data() };
            if (editIndex !== null && char.conditions && char.conditions[editIndex]) {
                condition = char.conditions[editIndex];
            }
        }
    } catch(e) { console.error(e); }

    const isEdit = editIndex !== null && condition;
    
    if (!window._systemData) window._systemData = {};
    if (!window._systemData.conditions || window._systemData.conditions.length === 0) {
        try {
            const snap = await getDocs(collection(db, 'system/data/conditions'));
            window._systemData.conditions = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) window._systemData.conditions.push({ id: d.id, ...data });
            });
        } catch(e) {
            console.error("Erro ao carregar conditions:", e);
            window._systemData.conditions = [];
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'condFormModalMestre';
    
    const templates = window._systemData.conditions;
    let templatePickerHtml = '';
    if (!isEdit && templates.length > 0) {
        const options = templates.map(t => ({
            value: t.id,
            label: `${t.icone || '💀'} ${t.nome}`,
            sub: t.duracao ? `Duração: ${t.duracao}` : ''
        }));
        templatePickerHtml = `<div class="inv-form-group inv-form-wide" style="margin-bottom:12px;">
            <label class="inv-form-label">📚 Criar a partir de modelo</label>
            ${_createSearchableSelectHTML('mestreCondTemplatePicker', options, '— Condição personalizada —', 'Pesquisar condição...')}
        </div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${isEdit ? '✏️ Editar Condição' : '➕ Criar Condição'}</span>
            <button class="inv-modal-close" onclick="this.closest('.inv-modal').remove()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${templatePickerHtml}
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="mcondFormNome" class="inv-form-input" value="${escapeHtml(condition?.nome || '')}" placeholder="Nome da condição">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="mcondFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição da condição">${escapeHtml(condition?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Atual</label>
                    <input type="text" id="mcondFormTempoAtual" class="inv-form-input" value="${escapeHtml(condition?.tempoAtual || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Restante</label>
                    <input type="text" id="mcondFormTempoRestante" class="inv-form-input" value="${escapeHtml(condition?.tempoRestante || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Ícone / Emoji</label>
                    <input type="text" id="mcondFormIcone" class="inv-form-input" value="${escapeHtml(condition?.icone || '💀')}" placeholder="💀" maxlength="4">
                </div>
            </div>
            <input type="hidden" id="mcondFormCharId" value="${charId}">
            <input type="hidden" id="mcondFormModeloId" value="${condition?.modeloId || ''}">
            <input type="hidden" id="mcondFormMechIds" value="${(condition?.efeitoMecanicaIds || []).join(',')}">
            ${isEdit ? `<input type="hidden" id="mcondFormEditIndex" value="${editIndex}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="this.closest('.inv-modal').remove()">Cancelar</button>
            <button class="inv-btn-save" onclick="_saveMestreCondition()">💾 Salvar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    if (!isEdit && templates.length > 0) {
        _initSearchableSelect('mestreCondTemplatePicker', (value) => {
            _fillMestreConditionFromTemplate(value);
        });
    }
};

function _createSearchableSelectHTML(containerId, options, defaultLabel, placeholder) {
    const optionsHtml = options.map(opt =>
        `<div class="searchable-select-option" data-value="${escapeHtml(opt.value)}">
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

function _initSearchableSelect(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    const arrow = container.querySelector('.searchable-select-arrow');
    const dropdown = container.querySelector('.searchable-select-dropdown');
    const searchInput = dropdown.querySelector('.searchable-select-search input');
    const optionsList = container.querySelector('.searchable-select-options-list');
    const emptyMsg = container.querySelector('.searchable-select-empty');
    const defaultOpt = container.querySelector('.searchable-select-default');

    function toggleOpen(open) {
        if (open) {
            container.classList.add('open');
            searchInput.value = '';
            _filterOptions('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            container.classList.remove('open');
        }
    }

    function _filterOptions(query) {
        const q = query.toLowerCase().trim();
        const options = optionsList.querySelectorAll('.searchable-select-option');
        let visible = 0;
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const match = !q || text.includes(q);
            opt.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        if (defaultOpt) defaultOpt.style.display = q ? 'none' : '';
        emptyMsg.style.display = (visible === 0 && q) ? '' : 'none';
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
};

window._fillMestreConditionFromTemplate = function(templateId) {
    if (!templateId) {
        document.getElementById('mcondFormNome').value = '';
        document.getElementById('mcondFormDesc').value = '';
        document.getElementById('mcondFormTempoAtual').value = '';
        document.getElementById('mcondFormTempoRestante').value = '';
        document.getElementById('mcondFormIcone').value = '💀';
        document.getElementById('mcondFormModeloId').value = '';
        document.getElementById('mcondFormMechIds').value = '';
        return;
    }
    const tpl = (window._systemData?.conditions || []).find(c => c.id === templateId);
    if (!tpl) return;
    document.getElementById('mcondFormNome').value = tpl.nome || '';
    document.getElementById('mcondFormDesc').value = tpl.descricao || '';
    document.getElementById('mcondFormTempoAtual').value = '';
    document.getElementById('mcondFormTempoRestante').value = tpl.duracao || '';
    document.getElementById('mcondFormIcone').value = tpl.icone || '💀';
    document.getElementById('mcondFormModeloId').value = tpl.id;
    document.getElementById('mcondFormMechIds').value = (tpl.efeitoMecanicaIds || []).join(',');
};

window._saveMestreCondition = async function() {
    const charId = document.getElementById('mcondFormCharId')?.value;
    const nome = document.getElementById('mcondFormNome')?.value?.trim();
    if (!nome) { showAlert('Nome obrigatório', 'warning'); return; }

    const editIndexEl = document.getElementById('mcondFormEditIndex');
    const isEdit = !!editIndexEl;
    const editIndex = isEdit ? parseInt(editIndexEl.value) : -1;

    const condData = {
        nome,
        descricao: document.getElementById('mcondFormDesc')?.value?.trim() || '',
        tempoAtual: document.getElementById('mcondFormTempoAtual')?.value?.trim() || '',
        tempoRestante: document.getElementById('mcondFormTempoRestante')?.value?.trim() || '',
        icone: document.getElementById('mcondFormIcone')?.value?.trim() || '💀',
        modeloId: document.getElementById('mcondFormModeloId')?.value || null,
        efeitoMecanicaIds: (document.getElementById('mcondFormMechIds')?.value || '').split(',').filter(Boolean)
    };

    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (!snap.exists()) return;
        const charData = snap.data();
        let conditions = charData.conditions || [];

        if (isEdit && editIndex >= 0 && editIndex < conditions.length) {
            conditions[editIndex] = condData;
        } else {
            conditions.push(condData);
        }

        await updateDoc(doc(db, 'char', charId), { conditions });

        // 📜 Log da alteração
        if (window.addLog) {
            const charNome = (charData.fields && charData.fields.nome) || charData.nome || 'Sem nome';
            window.addLog(S.currentUser?.email,
                isEdit ? `💀 Condição "${nome}" editada pelo Mestre` : `💀 Condição "${nome}" aplicada pelo Mestre`,
                charNome, 'char', {
                    charId, mesaId: S.currentMesaId, category: 'Condições',
                    changes: [
                        { label: 'Condição', from: isEdit ? nome : '—', to: nome },
                        { label: 'Descrição', from: '', to: condData.descricao || '—' },
                        { label: 'Tempo Restante', from: '', to: condData.tempoRestante || '—' }
                    ]
                });
        }

        const charInCache = (S.mesaCharacters || []).find(c => c.id === charId);
        if (charInCache) {
            charInCache.conditions = conditions;
        }

        document.getElementById('condFormModalMestre')?.remove();
        showAlert('Condição salva com sucesso!', 'success');
        
        loadPersonagensCondicoes();
    } catch(e) {
        console.error(e);
        showAlert('Erro ao salvar condição', 'danger');
    }
};

window._deleteMestreCondition = async function(charId, idx) {
    if (!await confirmar('Deseja realmente excluir esta condição?', { perigo: true })) return;

    try {
        const snap = await getDoc(doc(db, 'char', charId));
        if (!snap.exists()) return;
        const charData = snap.data();
        let conditions = charData.conditions || [];

        if (idx >= 0 && idx < conditions.length) {
            const removida = conditions[idx];
            conditions.splice(idx, 1);
            await updateDoc(doc(db, 'char', charId), { conditions });

            // 📜 Log da remoção
            if (window.addLog) {
                const charNome = (charData.fields && charData.fields.nome) || charData.nome || 'Sem nome';
                window.addLog(S.currentUser?.email, `💀 Condição "${removida?.nome || ''}" removida pelo Mestre`,
                    charNome, 'char', {
                        charId, mesaId: S.currentMesaId, category: 'Condições',
                        changes: [{ label: 'Condição', from: removida?.nome || '—', to: '—' }]
                    });
            }

            const charInCache = (S.mesaCharacters || []).find(c => c.id === charId);
            if (charInCache) {
                charInCache.conditions = conditions;
            }

            showAlert('Condição excluída', 'success');
            loadPersonagensCondicoes();
        }
    } catch(e) {
        console.error(e);
        showAlert('Erro ao excluir condição', 'danger');
    }
};
