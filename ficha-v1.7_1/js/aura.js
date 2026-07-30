/* ===== SISTEMA DE AURAS — Ficha v1.7 ===== */

/**
 * Retorna a quantidade base de bolinhas para uma propriedade.
 * Lê de mechanicLimits.max (teto do limitador) ou retorna 5 por padrão.
 * @param {string} dotKey
 * @returns {number}
 */
function getPropertyBaseDots(dotKey) {
    const limit = state.mechanicLimits?.[dotKey];
    if (limit) {
        if (limit.tipo === 'bloqueio') return 0;
        if ((limit.tipo === 'maximo' || limit.tipo === 'clamp') && limit.max != null) {
            return limit.max;
        }
    }
    return 5; // padrão
}

/**
 * Retorna informações da Aura vinculada a um dotKey, se houver.
 * Considera apenas auras que o personagem possui (state.auras).
 * @param {string} dotKey
 * @returns {{ aura: object, grauDesbloqueado: number, graus: Array }|null}
 */
function getAuraInfoForDot(dotKey) {
    const auraDef = window.AURA_BY_DOTKEY?.[dotKey];
    if (!auraDef) return null;

    const playerAura = state.auras?.[auraDef.id];
    if (!playerAura) return null;

    return {
        aura: auraDef,
        grauDesbloqueado: playerAura.grauDesbloqueado || 0,
        graus: auraDef.graus || []
    };
}

/**
 * Retorna o nível máximo permitido para uma propriedade considerando Auras.
 * Sem aura: retorna baseDots (5 padrão ou limitador).
 * Com aura: retorna (grauDesbloqueado + 1) × baseDots (grau 0 = implícito).
 * @param {string} dotKey
 * @returns {number}
 */
function getAuraMaxLevel(dotKey) {
    const baseDots = getPropertyBaseDots(dotKey);
    const auraInfo = getAuraInfoForDot(dotKey);
    if (!auraInfo) return baseDots;
    // grau 0 é implícito (range base), cada grau desbloqueado adiciona +1 faixa
    return (auraInfo.grauDesbloqueado + 1) * baseDots;
}

/**
 * Retorna o grau atual para um dado nível absoluto.
 * @param {number} level - Nível absoluto (1-based)
 * @param {number} baseDots - Quantidade de bolinhas por grau
 * @returns {number} Número do grau (0-based: 0=padrão, 1=grau 1, etc.)
 */
function getAuraGradeForLevel(level, baseDots) {
    if (level <= 0 || baseDots <= 0) return 0;
    return Math.floor((level - 1) / baseDots);
}

/**
 * Retorna a posição dentro do grau (1-based).
 * @param {number} level - Nível absoluto
 * @param {number} baseDots - Quantidade de bolinhas por grau
 * @returns {number} Posição 1-based dentro do grau
 */
function getAuraPosInGrade(level, baseDots) {
    if (level <= 0 || baseDots <= 0) return 0;
    return ((level - 1) % baseDots) + 1;
}

/**
 * Retorna a cor da aura para um dado grau.
 * Grau 0 retorna null (usa cor padrão do sistema).
 * @param {object} auraDef - Definição da aura (window.AURA_BY_DOTKEY[key])
 * @param {number} grade - Número do grau (0=padrão)
 * @returns {string|null} Cor hexadecimal ou null
 */
function getAuraColorForGrade(auraDef, grade) {
    if (!auraDef || grade <= 0) return null;
    const grauDef = auraDef.graus.find(g => g.grau === grade);
    return grauDef?.cor || null;
}

/* ===== RENDERIZAR ABA DE AURAS ===== */

/**
 * Renderiza a aba de Auras com base nas auras do personagem (state.auras)
 * e nas definições globais (window.AURAS).
 */
function renderAurasTab() {
    const mortalidadeContainer = document.getElementById('auraMortalidadeContainer');
    const propriedadeContainer = document.getElementById('aurasPropriedadeContainer');
    const emptyHint = document.getElementById('auraEmptyHint');
    if (!mortalidadeContainer || !propriedadeContainer) return;

    mortalidadeContainer.innerHTML = '';
    propriedadeContainer.innerHTML = '';

    const auras = window.AURAS || [];
    const playerAuras = state.auras || {};
    let hasAny = false;

    // Renderizar auras que o personagem possui
    for (const auraDef of auras) {
        const playerData = playerAuras[auraDef.id];
        if (!playerData) continue;
        hasAny = true;

        const card = _buildAuraCard(auraDef, playerData);

        if (auraDef.tipo === 'mortalidade') {
            mortalidadeContainer.appendChild(card);
        } else {
            propriedadeContainer.appendChild(card);
        }
    }

    if (emptyHint) {
        emptyHint.style.display = hasAny ? 'none' : 'block';
    }
}

function _buildAuraCard(auraDef, playerData) {
    const card = document.createElement('div');
    card.className = 'aura-card' + (auraDef.tipo === 'mortalidade' ? ' aura-mortalidade' : '');

    const grauDesbloqueado = playerData.grauDesbloqueado || 0;

    // Header
    const header = document.createElement('div');
    header.className = 'aura-card-header';
    header.innerHTML = `
        <div class="aura-card-title">
            <span class="aura-card-icon">${auraDef.tipo === 'mortalidade' ? '💀' : '🌟'}</span>
            <span>${auraDef.nome}</span>
        </div>
        <div class="aura-card-type">${auraDef.tipo === 'mortalidade' ? 'Mortalidade' : auraDef.propriedadeVinculada}</div>
    `;
    card.appendChild(header);

    // Graus
    if (auraDef.graus && auraDef.graus.length > 0) {
        const grausContainer = document.createElement('div');
        grausContainer.className = 'aura-graus-list';

        for (const grau of auraDef.graus) {
            const isUnlocked = grau.grau <= grauDesbloqueado;
            const grauEl = document.createElement('div');
            grauEl.className = 'aura-grau-display' + (isUnlocked ? ' unlocked' : ' locked');

            const badge = document.createElement('span');
            badge.className = 'aura-grau-badge-display';
            if (grau.cor) badge.style.background = isUnlocked ? grau.cor : '#4b5563';
            badge.textContent = `Grau ${grau.grau}`;

            const nomeGrau = document.createElement('span');
            nomeGrau.className = 'aura-grau-nome';
            nomeGrau.textContent = grau.nomeGrau || '';

            grauEl.appendChild(badge);
            grauEl.appendChild(nomeGrau);

            if (grau.descricaoNarrativa) {
                const descEl = document.createElement('div');
                descEl.className = 'aura-grau-desc';
                descEl.textContent = grau.descricaoNarrativa;
                grauEl.appendChild(descEl);
            }

            // Mecânicas vinculadas
            const mechs = auraDef.mecanicasPorGrau?.[grau.grau] || [];
            if (mechs.length > 0) {
                const mechsEl = document.createElement('div');
                mechsEl.className = 'aura-grau-mechs-display';
                for (const mech of mechs) {
                    const preview = typeof generatePreviewText === 'function'
                        ? generatePreviewText(mech) : (mech.nome || '');
                    const mechTag = document.createElement('span');
                    mechTag.className = 'aura-mech-tag';
                    mechTag.textContent = preview;
                    mechsEl.appendChild(mechTag);
                }
                grauEl.appendChild(mechsEl);
            }

            if (!isUnlocked) {
                const lockIcon = document.createElement('span');
                lockIcon.className = 'aura-lock-icon';
                lockIcon.textContent = '🔒';
                grauEl.appendChild(lockIcon);
            }

            grausContainer.appendChild(grauEl);
        }

        card.appendChild(grausContainer);
    }

    return card;
}
