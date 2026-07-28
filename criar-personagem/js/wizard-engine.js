/* ===== WIZARD ENGINE — Estado global da criação de personagem ===== */

window.wizardState = {
    // Marca o layout de fases pós-separação Raças/Classes. Estado salvo sem
    // esta flag tem índices do wizard antigo e é migrado ao restaurar.
    wizardFasesV2: true,

    // Fase 0
    nomePersonagem: '',
    nivelInicio: null, // { id, nome, exp } — legado, mantido para compat
    expInicial: 0,     // EXP manual ou da mesa
    expVip: 0,
    mesaVinculada: null, // { id, nome, mestreNome, expInicial, introducao } ou null
    itensRepertorioSelecionados: [], // Itens de repertório utilizados

    // Fase 1
    racaSelecionada: null,   // nome da raça
    classeSelecionada: null, // nome da classe

    // Fase 2
    triboSelecionada: null,  // nome da tribo

    // Fase 2B
    peculiaridadesIndividuais: [], // [{ id, nome, nivel }]
    niveisPeculiaridadesHerdadas: {}, // { id: nivel }

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

    // Fase 6
    npcs: [], // [{ nome, relacao, memoria, vinculo, confirmado }]

    // Fase 7
    kitInicialSelecionado: null,
    equipamentoSelecionado: [], // [string]
    luns: 0,
    objetoPessoal: null, // { nome, descricao } ou null

    // Fase 8
    nomeCompleto: '',
    idade: '',
    aparencia: '',
    imagemPersonagem: null, // base64 data URL da imagem do personagem
    motivacao: '',
    medo: '',
    ultimaPergunta: '',

    // Memórias
    memorias: {}, // phaseKey → texto

    // Modificadores de Valores Derivados (Fase 8)
    derivedModifiers: {},

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
            // Fase 0 nunca bloqueia — nome e EXP são opcionais aqui
            return { valid: true };

        case 'linhagem':
            if (!wizardState.racaSelecionada) return { valid: false, reason: 'Selecione uma raça.' };
            return { valid: true };

        case 'classes':
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

        case 'vespera': {
            const name = (wizardState.nomeCompleto || wizardState.nomePersonagem || '').trim();
            if (!name) return { valid: false, reason: 'Digite o nome do personagem.' };
            return { valid: true };
        }

        case 'resumo': {
            const charName = (wizardState.nomeCompleto || wizardState.nomePersonagem || '').trim();
            if (!charName) {
                return { valid: false, reason: 'Dê um nome ao seu personagem para finalizar.' };
            }
            return { valid: true };
        }

        default:
            return { valid: true };
    }
}

function validateAttributes() {
    if (!wizardState.grupoPrimario || !wizardState.grupoFraco) {
        return { valid: false, reason: 'Selecione os grupos primário e fraco.' };
    }
    // Permite avançar sem distribuir todos os pontos — validação completa ocorre ao finalizar
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

    // Custo por atributo (5ª bolinha custa 2) centralizado em calcAttrCost
    const spent = ATRIBUTOS[grupoNome]
        .reduce((sum, attr) => sum + calcAttrCost(wizardState.atributos[attr.key] || 0), 0);
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

        // MIGRAÇÃO — separação de Raças/Classes.
        // faseAtual e fasesCompletas são índices do array FASES_WIZARD, não ids.
        // A etapa "Classes" entrou no índice 2, então tudo de 2 pra frente
        // andou uma casa. Sem isto, quem tem criação salva volta uma etapa e
        // a barra de progresso marca as fases erradas como concluídas.
        if (!s.wizardFasesV2) {
            const desloca = i => (typeof i === 'number' && i >= 2 ? i + 1 : i);
            s.faseAtual = desloca(s.faseAtual);
            s.fasesCompletas = new Set([...s.fasesCompletas].map(desloca));
            s.wizardFasesV2 = true;
        }

        Object.assign(wizardState, s);
    } catch (e) {
        console.error('Erro ao restaurar wizard state:', e);
    }
}
