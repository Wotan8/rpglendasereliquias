/**
 * Mapeamento de Limitadores: agora construído DINAMICAMENTE pelo buildSkillsFromFirebase()
 * em system-data-loader.js → window.SKILL_LIMITERS
 * Formato: dotKey → { keys: [...attrKeys], mode: 'min'|undefined }
 */
// SKILL_LIMITERS is now dynamic: window.SKILL_LIMITERS (set by buildSkillsFromFirebase)

/* ===== FUNÇÕES DE CUSTO ===== */

function getExpCost(type, newLevel, dotKey) {
    if (type === 'attr') return newLevel * 5;
    if (type === 'skill') {
        // Use custom cost from window.SKILL_COSTS if available
        const customCost = window.SKILL_COSTS && window.SKILL_COSTS[dotKey];
        const costPerLevel = customCost || 4;
        return newLevel * costPerLevel;
    }
    return 0;
}

/**
 * Custo de ir do nível efetivo `de` até `ate` — a soma de cada degrau, porque
 * o custo é por nível (5×N, 4×N...). Serve tanto para cobrar quanto para
 * devolver no retrocesso.
 */
function somaCustoDegraus(type, dotKey, de, ate) {
    let total = 0;
    for (let lv = de + 1; lv <= ate; lv++) total += getExpCost(type, lv, dotKey);
    return total;
}

function getCurrentExp() {
    const el = document.querySelector('[data-key="exp"]');
    return parseInt(el ? el.value : '0', 10) || 0;
}

function setCurrentExp(val) {
    const el = document.querySelector('[data-key="exp"]');
    if (el) el.value = val;
}

/**
 * Devolve EXP ao personagem SEM mexer no Total.
 * Usado no retrocesso de nível pelo mestre: o EXP volta para "Restante",
 * porque o Total é o histórico do que o personagem já ganhou na mesa.
 */
function refundExp(amount) {
    setCurrentExp(getCurrentExp() + amount);
    scheduleAutosave();
}

/** É mestre/criador nesta ficha? Só eles retrocedem níveis. */
function podeRetroceder() {
    return !!(window.isMestre || window.isCreator);
}

/**
 * Mestre e Criador sobem nível com o custo em EXP OPCIONAL: o confirm oferece
 * "gastar" e "sem gastar", e o EXP do personagem só se mexe se ele escolher
 * gastar. Serve para corrigir ficha e para conceder nível fora da economia da
 * mesa, sem ter que dar EXP antes e tomar de volta depois.
 */
function podeGastarDeGraca() {
    return !!(window.isMestre || window.isCreator);
}

/**
 * Concessão do mestre: o nível entra sem tirar nada de "Restante", mas o custo
 * entra no "Total". O Total é o quanto o personagem VALE — um nível dado de
 * graça que não somasse ali faria a ficha subestimar o personagem, e quem lê o
 * Total (lista do Menu, painel do Mestre, régua de balanceamento) passaria a
 * comparar personagens com pesos diferentes.
 *
 * Custo negativo — desvantagem que RENDE EXP e o mestre optou por não dar —
 * não mexe em nada: não houve ganho para registrar.
 */
function concederSemGastar(amount) {
    if (!(amount > 0)) return;
    const totalEl = document.querySelector('[data-key="exp_total"]');
    if (totalEl) {
        const atual = parseInt(totalEl.value || '0', 10) || 0;
        totalEl.value = atual + amount;
    }
    scheduleAutosave();
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

    return null;
}

/**
 * Verifica se um upgrade é possível.
 * @param {string} dotKey
 * @param {number} newLevel - raw new level (state.dots + 1)
 * @param {string} type - 'attr', 'skill', 'spec', 'pec'
 * @param {string} [specName]
 * @param {number} [floorBonus=0] - piso bonus from mechanicLimits
 * @param {number} [fromLevel] - nível raw de partida; permite subir vários de
 *        uma vez cobrando a soma de cada degrau. Omitido = 1 degrau (padrão).
 * @returns {{ allowed: boolean, reason: string, cost: number }}
 */
function canUpgrade(dotKey, newLevel, type, specName, floorBonus, fromLevel) {
    floorBonus = floorBonus || 0;
    const effectiveNewLevel = newLevel + floorBonus;
    const cost = somaCustoDegraus(type, dotKey,
        (fromLevel == null ? newLevel - 1 : fromLevel) + floorBonus, effectiveNewLevel);
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
        // === AURA SYSTEM: extend maxLevel if aura is active ===
        const auraMax = typeof getAuraMaxLevel === 'function' ? getAuraMaxLevel(dotKey) : maxLevel;
        if (auraMax > maxLevel) maxLevel = auraMax;

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

    // Verificar EXP suficiente. Mestre/Criador passa: para ele o custo é
    // opcional, então falta de EXP só tira a opção de PAGAR — não o upgrade.
    // `semExp` avisa o confirm para não oferecer o botão de gastar.
    const semExp = cost > currentExp;
    if (semExp && !podeGastarDeGraca()) {
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

    return { allowed: true, reason: '', cost, semExp };
}

/* ===== MESTRE MEXENDO NO EXP RESTANTE À MÃO =====
 * Dar EXP à mesa mexe nos DOIS campos: o Restante, que o jogador gasta, e o
 * Total, que é o histórico do que o personagem já ganhou. Só mestre/criador
 * consegue editar esses campos (detail-modal.js os deixa readOnly para o
 * jogador), então digitar aqui quase sempre significa "concedi EXP" — mas às
 * vezes é só corrigir um erro de digitação. Por isso perguntamos em vez de
 * espelhar sozinho. */

let _expRestanteAntes = null;

/** Aplica no Total a mesma diferença que acabou de entrar no Restante. */
function _refletirNoTotal(delta) {
    const totalEl = document.querySelector('[data-key="exp_total"]');
    if (!totalEl) return;
    const atual = parseInt(totalEl.value || '0', 10) || 0;
    totalEl.value = Math.max(0, atual + delta);   // o Total nunca é negativo
    scheduleAutosave();
}

function _perguntarSobreOTotal(antes, agora) {
    const delta = agora - antes;
    const somando = delta > 0;
    const totalEl = document.querySelector('[data-key="exp_total"]');
    const total = parseInt(totalEl?.value || '0', 10) || 0;

    showExpToast(
        `⭐ EXP Restante: ${antes} → ${agora} (${somando ? '+' : ''}${delta}). `
        + `${somando ? 'Somar' : 'Subtrair'} ${Math.abs(delta)} no EXP Total também? `
        + `(${total} → ${Math.max(0, total + delta)})`,
        'confirm',
        [
            { label: somando ? `✓ Somar no Total` : `✓ Subtrair do Total`,
              cls: 'exp-btn-ok', action: () => _refletirNoTotal(delta) },
            { label: '✕ Só o Restante', cls: 'exp-btn-cancel' }
        ]
    );
}

/**
 * Liga o vigia no campo de EXP Restante. Idempotente: pode ser chamada de novo
 * sem duplicar o listener.
 *
 * O valor de partida é lido no `focus` porque só a edição manual passa por ele
 * — spendExp(), refundExp() e concederSemGastar() escrevem em `.value` direto,
 * e atribuição programática não dispara `change`. É o que impede a pergunta de
 * aparecer a cada upgrade comprado.
 */
function initVigiaExpRestante() {
    const el = document.querySelector('[data-key="exp"]');
    if (!el || el.dataset.vigiaExp) return;
    el.dataset.vigiaExp = '1';

    el.addEventListener('focus', () => {
        _expRestanteAntes = parseInt(el.value || '0', 10) || 0;
    });

    el.addEventListener('change', () => {
        const antes = _expRestanteAntes;
        const agora = parseInt(el.value || '0', 10) || 0;
        _expRestanteAntes = agora;
        if (antes === null || antes === agora) return;
        if (!podeGastarDeGraca()) return;   // jogador nem edita o campo
        _perguntarSobreOTotal(antes, agora);
    });
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
/**
 * Confirmação de upgrade.
 * @param {function(boolean)} onConfirm recebe `true` se o EXP deve ser cobrado
 *        e `false` na concessão gratuita do mestre. Todo chamador precisa
 *        respeitar a flag — é ela que decide se spendExp() roda.
 * @param {{semExp?: boolean, mensagem?: string}} [opcoes] semExp = o personagem
 *        não tem o custo, então só a concessão gratuita é oferecida. mensagem =
 *        texto próprio, para o que não é "→ Nível N" (acelerar estudo, por ex.).
 */
function showUpgradeConfirm(label, newLevel, cost, onConfirm, opcoes) {
    const gratis = podeGastarDeGraca();
    const semExp = !!(opcoes && opcoes.semExp);

    const botoes = [];
    if (!semExp) {
        botoes.push({
            label: gratis ? `✓ Gastar ${cost} EXP` : '✓ Confirmar',
            cls: 'exp-btn-ok',
            action: () => onConfirm(true)
        });
    }
    if (gratis) {
        botoes.push({
            label: '🛡️ Sem gastar',
            cls: 'exp-btn-free',
            action: () => onConfirm(false)
        });
    }
    botoes.push({ label: '✕ Cancelar', cls: 'exp-btn-cancel' });

    const custoTexto = semExp
        ? `Custo: ${cost} EXP — o personagem não tem esse EXP`
        : `Custo: ${cost} EXP`;
    const pergunta = (opcoes && opcoes.mensagem) || `⬆️ ${label} → Nível ${newLevel}?`;

    showExpToast(`${pergunta} ${custoTexto}`, 'confirm', botoes);
}

/**
 * Confirmação de retrocesso de nível (só mestre/criador).
 * O EXP devolvido volta para "Restante" — o Total não muda.
 */
function showDowngradeConfirm(label, newLevel, refund, onConfirm) {
    const efeito = refund >= 0
        ? `Devolve ${refund} EXP (só em Restante)`
        : `Retoma ${-refund} EXP que a desvantagem havia dado`;
    showExpToast(
        `⬇️ ${label} → Nível ${newLevel}? ${efeito}`,
        'confirm',
        [
            { label: '✓ Retroceder', cls: 'exp-btn-ok', action: onConfirm },
            { label: '✕ Cancelar', cls: 'exp-btn-cancel' }
        ]
    );
}

function showDowngradeSuccess(label, newLevel, refund) {
    const sinal = refund >= 0 ? `+${refund}` : `${refund}`;
    showExpToast(`↩️ ${label} voltou para nível ${newLevel}! (${sinal} EXP)`, 'success');
    setTimeout(dismissExpToast, 2000);
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
function showUpgradeSuccess(label, newLevel, cost, comExp) {
    const efeito = comExp === false
        ? (cost > 0 ? `🛡️ concedido pelo mestre · +${cost} no EXP Total` : '🛡️ concedido pelo mestre')
        : `-${cost} EXP`;
    showExpToast(`✅ ${label} subiu para nível ${newLevel}! (${efeito})`, 'success');
    setTimeout(dismissExpToast, 2000);
}
