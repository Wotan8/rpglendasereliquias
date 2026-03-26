/**
 * Mapeamento de Limitadores: agora construído DINAMICAMENTE pelo buildSkillsFromFirebase()
 * em system-data-loader.js → window.SKILL_LIMITERS
 * Formato: dotKey → { keys: [...attrKeys], mode: 'min'|undefined }
 */
// SKILL_LIMITERS is now dynamic: window.SKILL_LIMITERS (set by buildSkillsFromFirebase)

/**
 * Mapeamento de Limitadores de ESPECIALIZAÇÕES.
 * Chave = nome normalizado da especialização, valor = { type, keys }
 * type pode ser 'attr' (busca em attr_*) ou 'skill' (busca em sk_*_*)
 */
const SPEC_LIMITERS = {
    /* COMUNS */
    'espadas': { type: 'skill', search: 'arma' },
    'machados': { type: 'skill', search: 'arma' },
    'macas e martelos': { type: 'skill', search: 'arma' },
    'maças e martelos': { type: 'skill', search: 'arma' },
    'lancas e hastes': { type: 'skill', search: 'arma' },
    'lanças e hastes': { type: 'skill', search: 'arma' },
    'adagas e punhais': { type: 'skill', search: 'arma' },
    'arcos': { type: 'skill', search: 'disparo' },
    'bestas': { type: 'skill', search: 'disparo' },
    'arremesso': { type: 'skill', search: 'arremessar' },
    'armaduras leves': { type: 'attr', key: 'attr_for' },
    'armaduras medias': { type: 'attr', key: 'attr_for' },
    'armaduras médias': { type: 'attr', key: 'attr_for' },
    'armaduras pesadas': { type: 'attr', key: 'attr_for' },
    'escudos': { type: 'attr', key: 'attr_for' },
    /* GUERREIRO */
    'armas de uma mao': { type: 'skill', search: 'arma' },
    'armas de uma mão': { type: 'skill', search: 'arma' },
    'armas de duas maos': { type: 'skill', search: 'arma' },
    'armas de duas mãos': { type: 'skill', search: 'arma' },
    'armas de haste': { type: 'skill', search: 'arma' },
    'armas duplas': { type: 'skill', search: 'arma' },
    /* LADINO */
    'armas de punho': { type: 'skill', search: 'arma' },
    'ferramentas do crime': { type: 'skill', search: 'arrombamento' },
    /* CAÇADOR */
    'armas de precisao a distancia': { type: 'skill', search: 'arma' },
    'armas de precisão à distância': { type: 'skill', search: 'arma' },
    /* ALQUIMANCIA — LOÇÕES */
    'locoes toxicas': { type: 'skill', search: 'erudicao_ofensiva' },
    'loções tóxicas': { type: 'skill', search: 'erudicao_ofensiva' },
    'locoes paralisantes': { type: 'skill', search: 'erudicao_ofensiva' },
    'loções paralisantes': { type: 'skill', search: 'erudicao_ofensiva' },
    'locoes corrosivas': { type: 'skill', search: 'erudicao_ofensiva' },
    'loções corrosivas': { type: 'skill', search: 'erudicao_ofensiva' },
    'locoes sedativas': { type: 'skill', search: 'erudicao_ofensiva' },
    'loções sedativas': { type: 'skill', search: 'erudicao_ofensiva' },
    'locoes ilusorias': { type: 'skill', search: 'erudicao_ofensiva' },
    'loções ilusórias': { type: 'skill', search: 'erudicao_ofensiva' },
    'locoes curativas': { type: 'skill', search: 'erudicao_defensiva' },
    'loções curativas': { type: 'skill', search: 'erudicao_defensiva' },
    'locoes antidotos': { type: 'skill', search: 'erudicao_defensiva' },
    'loções antídotos': { type: 'skill', search: 'erudicao_defensiva' },
    'locoes estimulantes': { type: 'skill', search: 'erudicao_defensiva' },
    'loções estimulantes': { type: 'skill', search: 'erudicao_defensiva' },
    'locoes de resistencia': { type: 'skill', search: 'erudicao_defensiva' },
    'loções de resistência': { type: 'skill', search: 'erudicao_defensiva' },
    'locoes sensoriais': { type: 'skill', search: 'erudicao_defensiva' },
    'loções sensoriais': { type: 'skill', search: 'erudicao_defensiva' },
    /* DRUIDA — CRIATURAS */
    'mamiferos': { type: 'skill', search: 'domar' },
    'mamíferos': { type: 'skill', search: 'domar' },
    'aves': { type: 'skill', search: 'domar' },
    'repteis': { type: 'skill', search: 'domar' },
    'répteis': { type: 'skill', search: 'domar' },
    'insetos/aracnideos': { type: 'skill', search: 'domar' },
    'insetos/aracnídeos': { type: 'skill', search: 'domar' },
    'aquaticos': { type: 'skill', search: 'domar' },
    'aquáticos': { type: 'skill', search: 'domar' },
    'feras misticas': { type: 'skill', search: ['aliado_animal', 'linguagem_animal'], mode: 'min' },
    'feras místicas': { type: 'skill', search: ['aliado_animal', 'linguagem_animal'], mode: 'min' },
    /* ADEPTO DE THANNATHOG */
    'necromancia': { type: 'skill', search: 'essencia' },
    'talisma profano': { type: 'skill', search: ['essencia', 'performance'], mode: 'min' },
    'talismã profano': { type: 'skill', search: ['essencia', 'performance'], mode: 'min' },
    'vozes do tumulo': { type: 'skill', search: ['essencia', 'empatia'], mode: 'min' },
    'vozes do túmulo': { type: 'skill', search: ['essencia', 'empatia'], mode: 'min' },
    /* INVOCADOR DO ABISMO */
    'abismancia': { type: 'skill', search: 'essencia' },
    /* PALLACERDOTE */
    'pallomancia': { type: 'skill', search: 'essencia' },
    'simbolo sagrado': { type: 'skill', search: ['essencia', 'performance'], mode: 'min' },
    'símbolo sagrado': { type: 'skill', search: ['essencia', 'performance'], mode: 'min' },
    'cura radiante': { type: 'skill', search: 'pallomancia' },
    /* RUNIMAGO */
    'artus': { type: 'skill', search: 'runomancia' },
    'aspectus': { type: 'skill', search: 'runomancia' },
    'sigilus': { type: 'skill', search: 'runomancia' },
    /* SANGRAL */
    'hemomancia': { type: 'skill', search: 'essencia' },
    'armas de sangue': { type: 'skill', search: 'solidif__hematica' },
    'defesas de sangue': { type: 'skill', search: 'solidif__hematica' },
    'sangue vivo': { type: 'skill', search: ['manip__de_sangue', 'empatia_sanguinea'], mode: 'min' },
    'sangue morto': { type: 'skill', search: 'manip__de_sangue' },
    'transfusao avancada': { type: 'skill', search: ['cirurgia_hematica', 'empatia_sanguinea'], mode: 'min' },
    'transfusão avançada': { type: 'skill', search: ['cirurgia_hematica', 'empatia_sanguinea'], mode: 'min' },
    'laminas hematicas': { type: 'skill', search: 'solidif__hematica' },
    'lâminas hemáticas': { type: 'skill', search: 'solidif__hematica' },
    'perfurantes hematicas': { type: 'skill', search: 'solidif__hematica' },
    'perfurantes hemáticas': { type: 'skill', search: 'solidif__hematica' },
    'contundentes hematicas': { type: 'skill', search: 'solidif__hematica' },
    'contundentes hemáticas': { type: 'skill', search: 'solidif__hematica' },
    'chicotes hematicos': { type: 'skill', search: 'solidif__hematica' },
    'chicotes hemáticos': { type: 'skill', search: 'solidif__hematica' },
    /* XAMÃ */
    'totemancia': { type: 'skill', search: 'essencia' },
    /* BARDO */
    'sonoromancia': { type: 'skill', search: ['essencia', 'performance'], mode: 'min' },
    'canto': { type: 'skill', search: 'performance' },
    'instrumentos de corda': { type: 'skill', search: 'performance' },
    'instrumentos de percussao': { type: 'skill', search: 'performance' },
    'instrumentos de percussão': { type: 'skill', search: 'performance' },
    'instrumentos de sopro': { type: 'skill', search: 'performance' },
    'instrumento foco': { type: 'skill', search: 'performance' },
};

/* ===== FUNÇÕES DE CUSTO ===== */

function getExpCost(type, newLevel, dotKey) {
    if (type === 'attr') return newLevel * 5;
    if (type === 'skill') {
        // Use custom cost from window.SKILL_COSTS if available
        const customCost = window.SKILL_COSTS && window.SKILL_COSTS[dotKey];
        const costPerLevel = customCost || 4;
        return newLevel * costPerLevel;
    }
    if (type === 'spec') return newLevel * 2;
    return 0;
}

function getCurrentExp() {
    const el = document.querySelector('[data-key="exp"]');
    return parseInt(el ? el.value : '0', 10) || 0;
}

function setCurrentExp(val) {
    const el = document.querySelector('[data-key="exp"]');
    if (el) el.value = val;
}

function spendExp(amount) {
    const current = getCurrentExp();
    setCurrentExp(current - amount);

    // Se estiver ganhando EXP (amount negativo), adiciona também ao Total
    if (amount < 0) {
        const totalEl = document.querySelector('[data-key="exp_total"]');
        if (totalEl) {
            const currentTotal = parseInt(totalEl.value || '0', 10) || 0;
            totalEl.value = currentTotal + Math.abs(amount);
        }
    }

    scheduleAutosave();
}

/* ===== FUNÇÕES DE LIMITADOR ===== */

/**
 * Detecta o tipo de upgrade pelo prefixo do dotKey
 */
function detectDotType(dotKey) {
    if (dotKey.startsWith('attr_')) return 'attr';
    if (dotKey.startsWith('sk_mental_') || dotKey.startsWith('sk_fisico_') ||
        dotKey.startsWith('sk_social_') || dotKey.startsWith('sk_combate_') ||
        dotKey.startsWith('sk_exclusivo_') || dotKey.startsWith('sk_classe_')) return 'skill';
    if (dotKey.startsWith('spec_')) return 'spec';
    if (dotKey.startsWith('pec_')) return 'pec';
    return null;
}

/**
 * Busca o nível do limitador de uma perícia.
 * Retorna o nível do limitador (ou Infinity se não há limitador).
 */
function getSkillLimiterLevel(dotKey) {
    const limiters = window.SKILL_LIMITERS || {};
    const limiter = limiters[dotKey];
    if (!limiter) return Infinity; // sem limitador
    if (limiter.mode === 'min') {
        return Math.min(...limiter.keys.map(k => state.dots[k] || 0));
    }
    return state.dots[limiter.keys[0]] || 0;
}

/**
 * Busca o nível do limitador de uma especialização pelo nome digitado.
 */
function getSpecLimiterLevel(specName) {
    if (!specName) return Infinity;
    const normalized = specName.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos

    // Tenta buscar com o nome normalizado
    for (const [key, limiter] of Object.entries(SPEC_LIMITERS)) {
        const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedKey === normalized || key === specName.toLowerCase().trim()) {
            if (!limiter) return Infinity;

            if (limiter.type === 'attr') {
                return state.dots[limiter.key] || 0;
            }

            if (limiter.type === 'skill') {
                const searches = Array.isArray(limiter.search) ? limiter.search : [limiter.search];
                const levels = searches.map(s => findSkillDotLevel(s));
                return limiter.mode === 'min' ? Math.min(...levels) : levels[0];
            }
        }
    }

    // Se não encontrou mapeamento, sem limitador
    return Infinity;
}

/**
 * Busca o nível de uma perícia pelo nome da key (parcial).
 * Procura em sk_mental_*, sk_fisico_*, sk_social_*, sk_combate_*, sk_classe_*
 */
function findSkillDotLevel(searchKey) {
    // Tenta match direto em todas as categorias
    const prefixes = ['sk_mental_', 'sk_fisico_', 'sk_social_', 'sk_combate_', 'sk_classe_'];
    for (const pfx of prefixes) {
        const fullKey = pfx + searchKey;
        if (typeof state.dots[fullKey] !== 'undefined') {
            return state.dots[fullKey] || 0;
        }
    }
    // Se não achou, busca parcial
    for (const [k, v] of Object.entries(state.dots)) {
        if (k.includes(searchKey)) return v || 0;
    }
    return 0;
}

/**
 * Obtém o nome legível do limitador para exibir na mensagem de erro.
 */
function getLimiterName(dotKey, specName) {
    const type = detectDotType(dotKey);

    if (type === 'skill') {
        const limiters = window.SKILL_LIMITERS || {};
        const limiter = limiters[dotKey];
        if (!limiter) return null;
        const names = limiter.keys.map(k => k.replace('attr_', '').toUpperCase());
        return limiter.mode === 'min' ? `menor entre ${names.join('/')}` : names[0];
    }

    if (type === 'spec' && specName) {
        const normalized = specName.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const [key, limiter] of Object.entries(SPEC_LIMITERS)) {
            const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalizedKey === normalized || key === specName.toLowerCase().trim()) {
                if (!limiter) return null;
                if (limiter.type === 'attr') return limiter.key.replace('attr_', '').toUpperCase();
                const searches = Array.isArray(limiter.search) ? limiter.search : [limiter.search];
                return searches.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('/');
            }
        }
    }

    return null;
}

/* ===== VALIDAÇÃO PRINCIPAL ===== */

/**
 * Verifica se um upgrade é possível.
 * @returns {{ allowed: boolean, reason: string, cost: number }}
 */
function canUpgrade(dotKey, newLevel, type, specName) {
    const cost = getExpCost(type, newLevel, dotKey);
    const currentExp = getCurrentExp();

    // Verificar se base + bônus de mecânica ultrapassaria o máximo de bolinhas
    if (type === 'attr' || type === 'skill' || type === 'spec') {
        const mechBonus = state.mechanicBonuses?.[dotKey] || 0;
        const limit = state.mechanicLimits?.[dotKey];
        const maxLevel = (limit && limit.tipo === 'maximo' && limit.max != null) ? limit.max : 5;
        if (newLevel + mechBonus > maxLevel) {
            const currentBase = state.dots[dotKey] || 0;
            return {
                allowed: false,
                reason: `Já está no máximo! (Nível: ${currentBase} + Bônus: ${mechBonus} = ${currentBase + mechBonus}/${maxLevel})`,
                cost: 0
            };
        }
    }

    // Verificar EXP suficiente
    if (cost > currentExp) {
        return { allowed: false, reason: `EXP insuficiente! Precisa de ${cost} EXP, mas só tem ${currentExp}.`, cost };
    }

    // Verificar limitador para perícias
    if (type === 'skill') {
        const limiterLevel = getSkillLimiterLevel(dotKey);
        if (limiterLevel !== Infinity && newLevel > limiterLevel) {
            const limiterName = getLimiterName(dotKey) || 'Limitador';
            return { allowed: false, reason: `${limiterName} está no nível ${limiterLevel}. Suba o atributo primeiro!`, cost };
        }
    }

    // Verificar limitador para especializações
    if (type === 'spec') {
        const limiterLevel = getSpecLimiterLevel(specName);
        if (limiterLevel !== Infinity && newLevel > limiterLevel) {
            const limiterName = getLimiterName(dotKey, specName) || 'Limitador';
            return { allowed: false, reason: `${limiterName} está no nível ${limiterLevel}. Suba a perícia/atributo primeiro!`, cost };
        }
    }

    // Verificar se é uma peculiaridade "Apenas na Criação"
    if (type === 'pec') {
        const pecKey = dotKey.replace('pec_', '');
        // Buscar a peculiaridade na raça atual do state ou na global
        let pecData = null;
        if (window.RACES) {
            const racaNome = document.getElementById('selRaca') ? document.getElementById('selRaca').value : null;
            if (racaNome && window.RACES[racaNome]) {
                pecData = window.RACES[racaNome].peculiaridades.find(p => p.key === pecKey || p.id === pecKey);
            } else {
                // Tentar buscar em todas as raças como fallback
                for (const rKey in window.RACES) {
                    pecData = window.RACES[rKey].peculiaridades.find(p => p.key === pecKey || p.id === pecKey);
                    if (pecData) break;
                }
            }
        }

        if (pecData && pecData.mecanicas) {
            const isCreationOnly = pecData.mecanicas.some(m => m.progressaoApenasCriacao === true);
            if (isCreationOnly) {
                return { allowed: false, reason: `🏗️ "${pecData.nome}" só pode ser upado na criação de personagem!`, cost: 0 };
            }
        }
    }

    return { allowed: true, reason: '', cost };
}

/* ===== UI DE CONFIRMAÇÃO ===== */

let _activeToast = null;

function showExpToast(msg, type, buttons) {
    // Remove toast anterior se existir
    dismissExpToast();

    const container = document.getElementById('expToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `exp-toast exp-toast-${type}`;

    const msgEl = document.createElement('div');
    msgEl.className = 'exp-toast-msg';
    msgEl.textContent = msg;
    toast.appendChild(msgEl);

    if (buttons && buttons.length) {
        const btnRow = document.createElement('div');
        btnRow.className = 'exp-toast-btns';
        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = `exp-toast-btn ${b.cls || ''}`;
            btn.textContent = b.label;
            btn.addEventListener('click', () => {
                dismissExpToast();
                if (b.action) b.action();
            });
            btnRow.appendChild(btn);
        });
        toast.appendChild(btnRow);
    }

    container.appendChild(toast);
    _activeToast = toast;

    // Auto-dismiss erros após 3s
    if (type === 'error') {
        setTimeout(() => {
            if (_activeToast === toast) dismissExpToast();
        }, 3000);
    }
}

function dismissExpToast() {
    if (_activeToast) {
        _activeToast.classList.add('exp-toast-exit');
        const t = _activeToast;
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
        _activeToast = null;
    }
}

/**
 * Exibe a confirmação de upgrade.
 */
function showUpgradeConfirm(label, newLevel, cost, onConfirm) {
    showExpToast(
        `⬆️ ${label} → Nível ${newLevel}? Custo: ${cost} EXP`,
        'confirm',
        [
            { label: '✓ Confirmar', cls: 'exp-btn-ok', action: onConfirm },
            { label: '✕ Cancelar', cls: 'exp-btn-cancel' }
        ]
    );
}

/**
 * Exibe mensagem de bloqueio.
 */
function showUpgradeBlocked(reason) {
    showExpToast(`🚫 ${reason}`, 'error');
}

/**
 * Exibe mensagem de sucesso.
 */
function showUpgradeSuccess(label, newLevel, cost) {
    showExpToast(`✅ ${label} subiu para nível ${newLevel}! (-${cost} EXP)`, 'success');
    setTimeout(dismissExpToast, 2000);
}
