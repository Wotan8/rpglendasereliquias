/* ===== STORAGE — Auto-save do wizard no localStorage ===== */

const STORAGE_KEY = 'lr_wizard_state';
let _saveTimeout = null;

function saveWizardToStorage() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, serializeWizardState());
            console.log('💾 Wizard auto-saved');
        } catch (e) {
            console.error('Erro ao salvar wizard:', e);
        }
    }, 800);
}

function loadWizardFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        deserializeWizardState(raw);
        console.log('📂 Wizard state restaurado do localStorage');
        return true;
    } catch (e) {
        console.error('Erro ao carregar wizard:', e);
        return false;
    }
}

function clearWizardStorage() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Wizard state limpo');
}

function hasWizardSave() {
    return !!localStorage.getItem(STORAGE_KEY);
}
