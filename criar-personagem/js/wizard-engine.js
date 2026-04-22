/* ===== WIZARD ENGINE — Estado global da criação de personagem ===== */

window.wizardState = {
    // Fase 0
    nomePersonagem: '',
    nivelInicio: null, // { id, nome, exp }

    // Fase 1
    racaSelecionada: null,   // nome da raça
    classeSelecionada: null, // nome da classe

    // Fase 2
    triboSelecionada: null,  // nome da tribo

    // Fase 2B
    peculiaridadesIndividuais: [], // [{ id, nome, nivel }]

    // Fase 3
    grupoPrimario: null,       // 'Mental' | 'Fisico' | 'Social'
    grupoFraco: null,
    atributos: {               // key → nível distribuído (sem base)
        attr_int: 0, attr_rac: 0, attr_prs: 0,
        attr_for: 0, attr_des: 0, attr_vig: 0,
        attr_pre: 0, attr_man: 0, attr_aut: 0
    },

    // Fase 4
    grupoPericiaPrimario: null,
    grupoPericia2: null,
    grupoPericia3: null,
    grupoPericiaFraco: null,
    pericias: {}, // dotKey → nível distribuído

    // Fase 5
    virtudeSelecionada: null,  // id da virtude
    vicioSelecionado: null,    // id do vício
    vicioEspecificacao: '',     // texto livre (para Gula/Luxúria)

    // Fase 6
    npcs: [], // [{ nome, relacao, memoria, vinculo }]

    // Fase 7
    equipamentoSelecionado: [], // [string]
    luns: 0,
    objetoPessoal: null, // { nome, descricao } ou null

    // Fase 8
    nomeCompleto: '',
    apelido: '',
    aparencia: '',
    motivacao: '',
    medo: '',
    ultimaPergunta: '',

    // Memórias
    memorias: {}, // phaseKey → texto

    // Controle
    faseAtual: 0,
    fasesCompletas: new Set(),
    expSources: {}  // key → { amount, label }
};

/* ===== FASE MANAGEMENT ===== */

function setPhaseComplete(phaseIndex) {
    wizardState.fasesCompletas.add(phaseIndex);
    updateProgressBar();
}

function isPhaseComplete(phaseIndex) {
    return wizardState.fasesCompletas.has(phaseIndex);
}

function getPhaseIndex(phaseId) {
    return FASES_WIZARD.findIndex(f => f.id === phaseId);
}

/* ===== VALIDATION ===== */

function validatePhase(phaseIndex) {
    const fase = FASES_WIZARD[phaseIndex];
    if (!fase) return { valid: true, reason: '' };

    switch (fase.key) {
        case 'convite':
            if (!wizardState.nomePersonagem.trim()) return { valid: false, reason: 'Digite o nome do personagem.' };
            if (!wizardState.nivelInicio) return { valid: false, reason: 'Selecione o nível de início.' };
            return { valid: true };

        case 'linhagem':
            if (!wizardState.racaSelecionada) return { valid: false, reason: 'Selecione uma raça.' };
            if (!wizardState.classeSelecionada) return { valid: false, reason: 'Selecione uma classe.' };
            return { valid: true };

        case 'origens':
            if (!wizardState.triboSelecionada) return { valid: false, reason: 'Selecione uma tribo.' };
            return { valid: true };

        case 'peculiaridades':
            return { valid: true }; // Sempre válida (peculiaridades são opcionais)

        case 'corpo':
            return validateAttributes();

        case 'habilidades':
            return validateSkills();

        case 'alma':
            if (!wizardState.virtudeSelecionada) return { valid: false, reason: 'Selecione uma virtude.' };
            if (!wizardState.vicioSelecionado) return { valid: false, reason: 'Selecione um vício.' };
            return { valid: true };

        case 'lacos':
            return { valid: true }; // NPCs são opcionais

        case 'equipamento':
            return { valid: true }; // Equipamento é informativo

        case 'vespera':
            if (!wizardState.nomeCompleto.trim()) return { valid: false, reason: 'Digite o nome completo.' };
            return { valid: true };

        default:
            return { valid: true };
    }
}

function validateAttributes() {
    if (!wizardState.grupoPrimario || !wizardState.grupoFraco) {
        return { valid: false, reason: 'Selecione os grupos primário e fraco.' };
    }
    // Check all groups have distributed their points
    for (const grupo of GRUPOS_ATRIBUTOS) {
        const remaining = getGroupRemainingPoints(grupo);
        if (remaining > 0) {
            return { valid: false, reason: `Distribua todos os pontos do grupo ${grupo}.` };
        }
    }
    return { valid: true };
}

function validateSkills() {
    if (!wizardState.grupoPericiaPrimario) {
        return { valid: false, reason: 'Selecione as prioridades de perícias.' };
    }
    return { valid: true };
}

function getGroupRemainingPoints(grupoNome) {
    const regras = REGRAS_CRIACAO.atributos;
    let totalPool;
    if (grupoNome === wizardState.grupoPrimario) totalPool = regras.primario;
    else if (grupoNome === wizardState.grupoFraco) totalPool = regras.fraco;
    else totalPool = regras.intermediario;

    const attrs = ATRIBUTOS[grupoNome];
    let spent = 0;
    for (const attr of attrs) {
        const val = wizardState.atributos[attr.key] || 0;
        // Quinta bolinha custa 2
        if (val >= 4) spent += (val - 1) + 1; // 1+1+1+2 = 5 for level 4
        else spent += val;
    }
    // Recalculate properly: each level costs 1 except 4th which costs 2
    spent = 0;
    for (const attr of attrs) {
        const val = wizardState.atributos[attr.key] || 0;
        for (let i = 1; i <= val; i++) {
            spent += (i + regras.base_inicial >= 5) ? regras.custo_quinta_bolinha : 1;
        }
    }
    return totalPool - spent;
}

/* ===== SERIALIZE / DESERIALIZE ===== */

function serializeWizardState() {
    const s = { ...wizardState };
    s.fasesCompletas = Array.from(s.fasesCompletas);
    return JSON.stringify(s);
}

function deserializeWizardState(json) {
    try {
        const s = JSON.parse(json);
        if (s.fasesCompletas) s.fasesCompletas = new Set(s.fasesCompletas);
        else s.fasesCompletas = new Set();
        Object.assign(wizardState, s);
    } catch (e) {
        console.error('Erro ao restaurar wizard state:', e);
    }
}
