// =============================================
// PAINEL DO MESTRE — Main Entry Point
// Orchestrates all modules
// =============================================

import { initAuth } from './auth.js';
import { showAlert, switchTab } from './ui-utils.js';
import { addLog } from './logs.js';

// ===== AREA MODULES (lazy-loaded on tab switch) =====
let mesasModule = null;
let npcsModule = null;
let economicaModule = null;
let apoioModule = null;
let historicoModule = null;

// ===== MESA SUB-MODULES (lazy-loaded on sub-tab switch) =====
let mesaSessoesLoaded = false;
let mesaConfigLoaded = false;
let mesaNpcsLoaded = false;
let mesaInventarioLoaded = false;
let mesaNotasLoaded = false;
let mesaLogsLoaded = false;

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
        }
    }
});

// ===== MESA SUB-MODULE LOADER =====
async function ensureMesaSubModules() {
    try {
        if (!mesaSessoesLoaded) { await import('./area-mesas-sessoes.js?v=' + Date.now()); mesaSessoesLoaded = true; }
        if (!mesaConfigLoaded) { await import('./area-mesas-config.js?v=' + Date.now()); mesaConfigLoaded = true; }
        if (!mesaNpcsLoaded) { await import('./area-mesas-npcs.js?v=' + Date.now()); mesaNpcsLoaded = true; }
        if (!mesaInventarioLoaded) { await import('./area-mesas-inventario.js?v=' + Date.now()); mesaInventarioLoaded = true; }
        if (!mesaNotasLoaded) { await import('./area-mesas-notas.js?v=' + Date.now()); mesaNotasLoaded = true; }
        if (!mesaLogsLoaded) { await import('./area-mesas-logs.js?v=' + Date.now()); mesaLogsLoaded = true; }
    } catch (error) {
        console.error('❌ Erro ao carregar sub-módulos de mesa:', error);
    }
}

// ===== TAB SWITCHING WITH LAZY LOAD =====
window.switchTab = async function (tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');

    // Lazy-load area modules
    try {
        switch (tabName) {
            case 'mesas':
                if (!mesasModule) {
                    mesasModule = await import('./area-mesas.js?v=' + Date.now());
                    // Also load sub-modules for mesa content
                    await ensureMesaSubModules();
                }
                if (mesasModule.onTabActivated) mesasModule.onTabActivated();
                break;

            case 'npcs':
                if (!npcsModule) {
                    npcsModule = await import('./area-npcs.js?v=' + Date.now());
                }
                if (npcsModule.onTabActivated) npcsModule.onTabActivated();
                break;

            case 'economica':
                if (!economicaModule) {
                    economicaModule = await import('./area-economica.js?v=' + Date.now());
                }
                if (economicaModule.onTabActivated) economicaModule.onTabActivated();
                break;

            case 'apoio':
                if (!apoioModule) {
                    apoioModule = await import('./area-apoio.js?v=' + Date.now() + '_3');
                }
                if (apoioModule.onTabActivated) apoioModule.onTabActivated();
                break;

            case 'historico':
                if (!historicoModule) {
                    historicoModule = await import('./area-historico.js?v=' + Date.now());
                }
                if (historicoModule.onTabActivated) historicoModule.onTabActivated();
                break;
        }
    } catch (error) {
        console.error(`❌ Erro ao carregar módulo ${tabName}:`, error);
        showAlert(`❌ Erro ao carregar aba: ${error.message}`, 'danger');
    }
};

// ===== INIT =====
initAuth(async (user) => {
    console.log('✅ Mestre autenticado:', user.email);

    // Load default tab (Mesas)
    await window.switchTab('mesas');
});
