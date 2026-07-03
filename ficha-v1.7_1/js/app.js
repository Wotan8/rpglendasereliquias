/* ===== ESTADO GLOBAL E INICIALIZAÇÃO ===== */

/* === GUARD: Impede qualquer save antes dos dados estarem carregados === */
window._dataReady = false;

let state = {
    dots: {}, notes: [], charImg: '', customTests: [], mainTestsOrder: [],
    mechanicBonuses: {}, mechanicLimits: {}, mecanicasAplicadas: {},
    mecanicasPendentes: [], capacidades: [], auras: {}, classModuleData: {},
    expApplied: {}, expSessionTriggers: [], conditions: [], partesDoCorpo: []
};
let editingNoteId = null, testCount = 3;

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
    if (typeof renderConditions === 'function') renderConditions();

    // Se o Firebase já carregou dados, não recarregar do localStorage
    if (!window._firebaseLoaded) {
        loadFromStorage();
    }

    document.getElementById('selClasse').addEventListener('change', onClassChange);
    onClassChange();
    document.getElementById('selRaca').addEventListener('change', onRaceChange);
    onRaceChange();
    const selTribo = document.getElementById('selTribo');
    if (selTribo) {
        selTribo.addEventListener('change', onTriboChange);
        onTriboChange();
    }
    if (typeof initDerivedListeners === 'function') initDerivedListeners();
    if (typeof initVitalStatsTooltips === 'function') initVitalStatsTooltips();
    if (typeof initSkillTooltips === 'function') initSkillTooltips();
    if (typeof recalcAll === 'function') recalcAll();

    // Garantir que _dataReady é setado mesmo se loadFromData nunca foi chamado
    // (personagem novo ou localStorage vazio).
    // GUARD: Quando o Firebase está carregando (_firebaseLoaded=true), o loadFromData()
    // definirá _dataReady ao final. Liberar aqui causaria race condition com scheduleAutosave().
    if (!window._dataReady && !window._firebaseLoaded) {
        window._dataReady = true;
        console.log('✅ _dataReady = true (initApp fallback — nenhum dado carregado).');
    }
};

/* ===== DOMContentLoaded — fallback se firebase.js não estiver presente ===== */
document.addEventListener('DOMContentLoaded', () => {
    // Apenas inicializar offline se o firebase.js não foi incluído no HTML
    const hasFirebase = document.querySelector('script[src*="firebase.js"]') !== null;
    if (!hasFirebase) {
        if (!_appInitialized) {
            console.log('⚠️ Firebase não incluído no HTML, inicializando em modo estritamente offline...');
            window.initApp();
        }
    } else {
        console.log('⏳ Firebase detectado. Aguardando inicialização remota...');
    }
});

// Listener opcional para forçar re-render se os dados do sistema chegarem depois da inicialização
document.addEventListener('systemDataReady', () => {
    if (_appInitialized) {
        console.log('🔄 Dados do sistema prontos pós-inicialização. Re-renderizando...');
        if (typeof initSkills === 'function') initSkills();
        if (typeof recalcAll === 'function') recalcAll();
    }
});

