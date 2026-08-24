const DEFAULT_SHORTCUTS = {
    'close_modal': 'Escape',
    'save_form': 'Ctrl+S',
    'toggle_published': 'Alt+P',
    'nav_races': 'Alt+1',
    'nav_classes': 'Alt+2',
    'nav_tribes': 'Alt+3',
    'nav_peculiarities': 'Alt+4',
    'nav_skills': 'Alt+5',
    'nav_equipment': 'Alt+6',
    'nav_mechanics': 'Alt+M'
};

const SHORTCUT_DEFS = [
    { id: 'close_modal', title: 'Fechar Modais', desc: 'Fecha qualquer modal aberto ou formulário.', category: 'Geral' },
    { id: 'save_form', title: 'Salvar Registro', desc: 'Salva o formulário aberto (Novo/Edição).', category: 'Ações de Formulário' },
    { id: 'toggle_published', title: 'Alternar Publicado', desc: 'Ativa/desativa o botão Publicado.', category: 'Ações de Formulário' },
    { id: 'nav_races', title: 'Ir para Raças', desc: 'Abre a listagem de Raças.', category: 'Navegação' },
    { id: 'nav_classes', title: 'Ir para Classes', desc: 'Abre a listagem de Classes.', category: 'Navegação' },
    { id: 'nav_tribes', title: 'Ir para Tribos', desc: 'Abre a listagem de Tribos.', category: 'Navegação' },
    { id: 'nav_peculiarities', title: 'Ir para Peculiaridades', desc: 'Abre a listagem de Peculiaridades.', category: 'Navegação' },
    { id: 'nav_skills', title: 'Ir para Perícias', desc: 'Abre a listagem de Perícias.', category: 'Navegação' },
    { id: 'nav_equipment', title: 'Ir para Equipamentos', desc: 'Abre a listagem de Equipamentos.', category: 'Navegação' },
    { id: 'nav_mechanics', title: 'Ir para Mecânicas', desc: 'Abre a listagem de Mecânicas soltas.', category: 'Navegação' }
];

let userShortcuts = { ...DEFAULT_SHORTCUTS };
let isListening = null; // Holds the ID of the shortcut currently being recorded

function loadShortcuts() {
    try {
        const saved = localStorage.getItem('creatorShortcuts');
        if (saved) {
            userShortcuts = { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error("Erro ao carregar atalhos:", e);
    }
}

function saveShortcuts() {
    localStorage.setItem('creatorShortcuts', JSON.stringify(userShortcuts));
}

function formatKeyEvent(e) {
    if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return null;
    let parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    
    // Format the key
    let k = e.key;
    if (k === ' ') k = 'Space';
    else if (k.length === 1) k = k.toUpperCase();
    
    parts.push(k);
    return parts.join('+');
}

function renderShortcutsUI() {
    const container = document.getElementById('shortcutsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    let currentCategory = '';
    
    SHORTCUT_DEFS.forEach(def => {
        if (def.category !== currentCategory) {
            currentCategory = def.category;
            const cat = document.createElement('div');
            cat.style.marginTop = '16px';
            cat.style.fontWeight = '900';
            cat.style.color = 'var(--primary)';
            cat.style.textTransform = 'uppercase';
            cat.style.fontSize = '0.75rem';
            cat.textContent = currentCategory;
            container.appendChild(cat);
        }
        
        const row = document.createElement('div');
        row.className = 'shortcut-row';
        
        const currentKeys = userShortcuts[def.id] || 'Nenhum';
        
        row.innerHTML = `
            <div class="shortcut-info">
                <span class="shortcut-title">${def.title}</span>
                <span class="shortcut-desc">${def.desc}</span>
            </div>
            <button class="shortcut-btn" data-id="${def.id}">${currentKeys}</button>
        `;
        
        container.appendChild(row);
    });
    
    // Attach events to buttons
    container.querySelectorAll('.shortcut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Cancel any ongoing listening
            container.querySelectorAll('.shortcut-btn').forEach(b => {
                b.classList.remove('listening');
                b.textContent = userShortcuts[b.dataset.id] || 'Nenhum';
            });
            
            isListening = btn.dataset.id;
            btn.classList.add('listening');
            btn.textContent = 'Pressione...';
            
            e.stopPropagation(); // prevent immediate body click
        });
    });
}

function executeAction(actionId, e) {
    // Collect possible modals in priority order (top-most first)
    const subPeculiaridade = document.getElementById('subFormModalPeculiaridade');
    const subValorDerivado = document.getElementById('subFormModalValorDerivado');
    const settingsModal = document.getElementById('settingsModal');
    const deleteModal = document.getElementById('deleteModal');
    const editorArea = document.getElementById('mechanicsEditorArea');
    const formModal = document.getElementById('formModal');

    switch(actionId) {
        case 'close_modal':
            // Usa o gerenciador de camadas: fecha sempre o modal que está no topo
            // da pilha (maior z-index), independente da ordem de abertura.
            if (window.closeTopModal && window.closeTopModal()) return true;
            // Fallback legado (caso o gerenciador não esteja disponível)
            if (subPeculiaridade) { window.closeSubFormPeculiaridade && window.closeSubFormPeculiaridade(); return true; }
            if (subValorDerivado) { window.closeSubFormValorDerivado && window.closeSubFormValorDerivado(); return true; }
            if (settingsModal && (settingsModal.style.display === 'flex' || settingsModal.classList.contains('active'))) { settingsModal.style.display = 'none'; settingsModal.classList.remove('active'); return true; }
            if (deleteModal && deleteModal.classList.contains('active')) { window.closeDeleteModal && window.closeDeleteModal(); return true; }
            if (editorArea && editorArea.style.display !== 'none') { window._mechBack && window._mechBack(); return true; }
            if (formModal && formModal.classList.contains('active')) { window.closeForm && window.closeForm(); return true; }
            break;
            
        case 'save_form':
            if (subPeculiaridade) {
                const btn = document.getElementById('btnSaveSubPec');
                if (btn) btn.click();
                return true;
            }
            if (subValorDerivado) {
                const btn = document.getElementById('btnSaveSubVD');
                if (btn) btn.click();
                return true;
            }
            if (formModal && formModal.classList.contains('active')) {
                const saveBtn = document.getElementById('btnSave');
                if (saveBtn) saveBtn.click();
                return true;
            }
            if (editorArea && editorArea.style.display !== 'none') {
                window._mechSave && window._mechSave();
                return true;
            }
            break;
            
        case 'toggle_published':
            // Published toggle only applies to main form modal usually.
            // If we are in a sub-modal, we don't have published toggle.
            if (subPeculiaridade || subValorDerivado) return false;
            
            if (formModal && formModal.classList.contains('active')) {
                const pubEl = document.getElementById('field_publicado');
                if (pubEl) pubEl.checked = !pubEl.checked;
                return true;
            }
            break;
            
        case 'nav_races': return clickTab('races');
        case 'nav_classes': return clickTab('classes');
        case 'nav_tribes': return clickTab('tribes');
        case 'nav_peculiarities': return clickTab('peculiarities');
        case 'nav_skills': return clickTab('skills');
        case 'nav_equipment': return clickTab('equipment');
        case 'nav_mechanics': return clickTab('mechanics');
    }
    return false;
}

function clickTab(moduleId) {
    const tab = document.querySelector(`.tab[data-module="${moduleId}"]`);
    if (tab) {
        tab.click();
        return true;
    }
    return false;
}

// Global Keydown Handler
window.addEventListener('keydown', (e) => {
    // If we are recording a shortcut
    if (isListening) {
        e.preventDefault();
        e.stopPropagation();
        
        // Escape cancels recording
        if (e.key === 'Escape') {
            isListening = null;
            renderShortcutsUI();
            return;
        }
        
        const combo = formatKeyEvent(e);
        if (combo) {
            // Check if combo is already used by another action
            for (let k in userShortcuts) {
                if (userShortcuts[k] === combo && k !== isListening) {
                    userShortcuts[k] = null; // Unbind previous
                }
            }
            userShortcuts[isListening] = combo;
            saveShortcuts();
            isListening = null;
            renderShortcutsUI();
        }
        return;
    }
    
    // Normal execution
    const combo = formatKeyEvent(e);
    if (!combo) return;
    
    // Don't intercept if user is typing in an input/textarea, UNLESS it's a combo with modifiers (Ctrl/Alt) or Escape
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    
    const hasModifiers = e.ctrlKey || e.altKey || e.metaKey;
    const isEscape = e.key === 'Escape';
    
    if (isTyping && !hasModifiers && !isEscape) {
        return; // Let the user type 'S', '1', etc.
    }

    // Find if combo matches any shortcut
    for (const [actionId, mappedCombo] of Object.entries(userShortcuts)) {
        if (mappedCombo === combo) {
            const handled = executeAction(actionId, e);
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                return; // Stop checking after first match
            }
        }
    }
});

// Click outside to cancel listening
document.addEventListener('click', (e) => {
    if (isListening && !e.target.closest('.shortcut-btn')) {
        isListening = null;
        renderShortcutsUI();
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadShortcuts();
    
    // Setup observer to render UI when settings modal is opened
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            renderShortcutsUI();
        });
    }
    
    // Render initially if it's open (e.g. during dev hot-reloads)
    renderShortcutsUI();
    
    // Reset button
    const btnReset = document.getElementById('btnResetShortcuts');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (await LRDialogo.confirmar('Deseja restaurar os atalhos para os padrões originais?')) {
                userShortcuts = { ...DEFAULT_SHORTCUTS };
                saveShortcuts();
                renderShortcutsUI();
            }
        });
    }
});
