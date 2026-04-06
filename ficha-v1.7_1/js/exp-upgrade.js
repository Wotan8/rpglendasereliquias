/**
 * Mapeamento de Limitadores: agora construído DINAMICAMENTE pelo buildSkillsFromFirebase()
 * em system-data-loader.js → window.SKILL_LIMITERS
 * Formato: dotKey → { keys: [...attrKeys], mode: 'min'|undefined }
 */
// SKILL_LIMITERS is now dynamic: window.SKILL_LIMITERS (set by buildSkillsFromFirebase)

/**
 * Mapeamento de Limitadores de ESPECIALIZAÇÕES.
 * Agora construído DINAMICAMENTE pelo buildSpecializationsFromFirebase()
 * em system-data-loader.js → window.SPEC_LIMITERS_DYNAMIC
 * Formato: dotKey → { keys: [...attrKeys, ...skillKeys], mode: 'min', names: [...] }
 *
 * LEGACY: O const SPEC_LIMITERS antigo foi removido.
 * A função getSpecLimiterLevel agora usa window.SPEC_LIMITERS_DYNAMIC.
 */

/* ===== FUNÇÕES DE CUSTO ===== */

function getExpCost(type, newLevel, dotKey) {
    if (type === 'attr') return newLevel * 5;
    if (type === 'skill') {
        // Use custom cost from window.SKILL_COSTS if available
        const customCost = window.SKILL_COSTS && window.SKILL_COSTS[dotKey];
        const costPerLevel = customCost || 4;
        return newLevel * costPerLevel;
    }
    if (type === 'spec') {
        const customCost = window.SPEC_COSTS && window.SPEC_COSTS[dotKey];
        const costPerLevel = customCost || 2;
        return newLevel * costPerLevel;
    }
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
    if (dotKey.startsWith('spec_mental_') || dotKey.startsWith('spec_fisico_') ||
        dotKey.startsWith('spec_social_') || dotKey.startsWith('spec_combate_') ||
        dotKey.startsWith('spec_exclusivo_') || dotKey.startsWith('spec_')) return 'spec';
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
 * Busca o nível do limitador de uma especialização.
 * Agora usa window.SPEC_LIMITERS_DYNAMIC (construído por buildSpecializationsFromFirebase).
 * Se o dotKey está no mapa dinâmico, usa o menor entre todos os limitadores.
 * Caso contrário, tenta fallback pelo specName (legado).
 */
function getSpecLimiterLevel(specName, dotKey) {
    // Primeiro: checar SPEC_LIMITERS_DYNAMIC pelo dotKey
    const dynamicLimiters = window.SPEC_LIMITERS_DYNAMIC || {};
    if (dotKey && dynamicLimiters[dotKey]) {
        const limiter = dynamicLimiters[dotKey];
        const getVal = (k) => {
            if (typeof getEffectiveDotValue === 'function') return getEffectiveDotValue(k);
            return (state.dots[k] || 0) + (state.mechanicBonuses?.[k] || 0);
        };
        if (limiter.mode === 'min') {
            return Math.min(...limiter.keys.map(k => getVal(k)));
        }
        return getVal(limiter.keys[0]);
    }

    // Fallback: sem limitador dinâmico
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

    if (type === 'spec') {
        // Dynamic: use SPEC_LIMITERS_DYNAMIC
        const dynamicLimiters = window.SPEC_LIMITERS_DYNAMIC || {};
        if (dynamicLimiters[dotKey]) {
            const limiter = dynamicLimiters[dotKey];
            return limiter.names ? limiter.names.join('/') : null;
        }
        return null;
    }

    return null;
}

/**
 * Verifica se um upgrade é possível.
 * @param {string} dotKey
 * @param {number} newLevel - raw new level (state.dots + 1)
 * @param {string} type - 'attr', 'skill', 'spec', 'pec'
 * @param {string} [specName]
 * @param {number} [floorBonus=0] - piso bonus from mechanicLimits
 * @returns {{ allowed: boolean, reason: string, cost: number }}
 */
function canUpgrade(dotKey, newLevel, type, specName, floorBonus) {
    floorBonus = floorBonus || 0;
    const effectiveNewLevel = newLevel + floorBonus;
    const cost = getExpCost(type, effectiveNewLevel, dotKey);
    const currentExp = getCurrentExp();

    // Verificar se base + bônus de mecânica + piso ultrapassaria o máximo
    if (type === 'attr' || type === 'skill' || type === 'spec') {
        const mechBonus = state.mechanicBonuses?.[dotKey] || 0;
        const limit = state.mechanicLimits?.[dotKey];
        let maxLevel = 5;
        if (limit) {
            if (limit.tipo === 'bloqueio') maxLevel = 0;
            else if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) maxLevel = limit.max;
        }
        const effectiveTotal = effectiveNewLevel + mechBonus;
        if (effectiveTotal > maxLevel) {
            const currentBase = state.dots[dotKey] || 0;
            const effectiveCurrent = currentBase + floorBonus + mechBonus;
            return {
                allowed: false,
                reason: `Já está no máximo! (Nível efetivo: ${effectiveCurrent}/${maxLevel})`,
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
        if (limiterLevel !== Infinity && effectiveNewLevel > limiterLevel) {
            const limiterName = getLimiterName(dotKey) || 'Limitador';
            return { allowed: false, reason: `${limiterName} está no nível ${limiterLevel}. Suba o atributo primeiro!`, cost };
        }
    }

    // Verificar limitador para especializações
    if (type === 'spec') {
        const limiterLevel = getSpecLimiterLevel(specName, dotKey);
        if (limiterLevel !== Infinity && effectiveNewLevel > limiterLevel) {
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
