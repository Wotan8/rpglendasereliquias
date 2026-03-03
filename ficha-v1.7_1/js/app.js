/* ===== ESTADO GLOBAL E INICIALIZAÇÃO ===== */

let state = {
    dots: {}, notes: [], charImg: '', specs: [], customTests: [], mainTestsOrder: [],
    mechanicBonuses: {}, mechanicLimits: {}, mecanicasAplicadas: {},
    mecanicasPendentes: [], capacidades: []
};
let editingNoteId = null, testCount = 3, specCount = 0;

/* Contadores de recursos de classe */
let sigilusCount = 0, runaPrepCount = 0, estudoCount = 0;
state.sigilus = state.sigilus || [];
state.runasPrep = state.runasPrep || [];
state.estudos = state.estudos || [];

let locaoCount = 0;
state.locacoes = state.locacoes || [];

let ritualCount = 0;
state.rituais = state.rituais || [];

let ritoCount = 0;
state.ritos = state.ritos || [];

/* Contadores de equipamento */
let wC = 0, aC = 0, pC = 0, cC = 0;
let iC = 0;

/* Flag para evitar dupla inicialização */
let _appInitialized = false;

/* ===== initApp — chamada pelo firebase.js (pós-auth) ou DOMContentLoaded (fallback offline) ===== */
window.initApp = function () {
    if (_appInitialized) return;
    _appInitialized = true;

    initTabs(); initDots(); initSkills(); initCharImg();
    addWeapon(); addArmor(); addProjectile();
    addInventoryItem(); addInventoryItem(); addInventoryItem();

    // Se o Firebase já carregou dados, não recarregar do localStorage
    if (!window._firebaseLoaded) {
        loadFromStorage();
    }

    document.getElementById('selClasse').addEventListener('change', onClassChange);
    onClassChange();
    document.getElementById('selRaca').addEventListener('change', onRaceChange);
    onRaceChange();
    if (typeof initDerivedListeners === 'function') initDerivedListeners();
    if (typeof recalcAll === 'function') recalcAll();
};

/* ===== DOMContentLoaded — fallback se firebase.js não estiver presente ===== */
document.addEventListener('DOMContentLoaded', () => {
    // Esperar um pouco para dar chance ao firebase.js (module) de carregar
    setTimeout(() => {
        if (!_appInitialized) {
            console.log('⚠️ Firebase não detectado, inicializando offline...');
            window.initApp();
        }
    }, 1500);
});

