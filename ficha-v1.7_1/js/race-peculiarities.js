/* ===== LÓGICA DE PECULIARIDADES RACIAIS ===== */

/* Guarda a raça anterior para poder reverter bônus corretamente */
let _previousRace = '';

// Default fallback to prevent crash if not initialized elsewhere
window._raceBonuses = window._raceBonuses || {
    det_max: 0,
    vit_max: 0,
    perc: 0,
    is_yotun: false,
    carga_mult: 1,
    desloc_ar_override: false
};

function onRaceChange() {
    const selRaca = document.getElementById('selRaca');
    if (!selRaca) return;
    const racaNome = selRaca.value;

    // --- Limpar bônus da raça anterior ANTES de tudo ---
    clearRaceBonuses(_previousRace);

    // Atualizar subtitulo da raça
    const subtitleEl = document.getElementById('raceSubtitle');
    const tamanhoInput = document.querySelector('[data-key="tamanho"]');
    const grid = document.getElementById('peculiaridadesGrid');

    if (!grid) return;
    grid.innerHTML = ''; // Limpar peculiaridades atuais

    if (!racaNome || racaNome === '') {
        if (subtitleEl) subtitleEl.textContent = '';
        if (tamanhoInput) tamanhoInput.value = '';
        const hint = document.createElement('div');
        hint.className = 'hint-text';
        hint.id = 'raceHint';
        hint.textContent = 'Selecione uma raça para visualizar suas peculiaridades.';
        grid.appendChild(hint);
        updateYotunForcaUI('');
        updateDaereoVisibility('');
        _previousRace = '';
        if (typeof recalcAll === 'function') recalcAll();
        scheduleAutosave();
        return;
    }

    const raca = RACES[racaNome];
    if (!raca) return;

    // Preencher tamanho e subtítulo
    if (tamanhoInput) tamanhoInput.value = raca.tamanho;
    if (subtitleEl) subtitleEl.textContent = raca.subtitulo || '';

    // Renderizar peculiaridades
    raca.peculiaridades.forEach(pec => {
        renderPeculiaridadeCard(pec, racaNome, grid);
    });

    updateYotunForcaUI(racaNome);
    updateDaereoVisibility(racaNome);

    // --- Aplicar bônus da nova raça ---
    applyRaceBonuses(racaNome);
    // Aplicar mecânicas dinâmicas do Firebase (painel criador)
    if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(racaNome);
    _previousRace = racaNome;

    if (typeof recalcAll === 'function') recalcAll();
    scheduleAutosave();
}

function updateDaereoVisibility(racaNome) {
    const deslocArDisplay = document.getElementById('desloc_ar_display');
    if (!deslocArDisplay) return;
    const parent = deslocArDisplay.parentElement;
    if (racaNome === 'Picxi') {
        parent.style.display = '';
    } else {
        parent.style.display = 'none';
    }
}

function updateYotunForcaUI(racaNome) {
    const forcaDotsContainer = document.querySelector('.dots5[data-attr="attr_for"]');
    if (!forcaDotsContainer) return;

    let dot6 = forcaDotsContainer.querySelector('.dot[data-val="6"]');

    if (racaNome === 'Yotun') {
        if (!dot6) {
            dot6 = document.createElement('button');
            dot6.className = 'dot';
            dot6.dataset.val = '6';
            dot6.title = 'Nível 6';
            dot6.addEventListener('click', () => {
                if (typeof handleDotUpgrade === 'function') {
                    handleDotUpgrade(forcaDotsContainer, 'attr_for', 6);
                }
            });
            forcaDotsContainer.appendChild(dot6);
        }
    } else {
        if (dot6) {
            dot6.remove();
            if (state.dots['attr_for'] === 6) {
                state.dots['attr_for'] = 5;
                if (typeof recalcAll === 'function') recalcAll();
                if (typeof recalcMainTests === 'function') recalcMainTests();
            }
        }
    }

    if (typeof refreshDots === 'function') {
        refreshDots(forcaDotsContainer, 'attr_for');
    }
}

/* ===== BÔNUS RACIAIS — CLEAR / APPLY ===== */

/**
 * Reseta TODOS os bônus raciais para valores neutros e reverte dots alterados.
 */
function clearRaceBonuses(oldRace) {
    // Limpar bônus dinâmicos das mecânicas do Firebase
    if (typeof clearMechanicBonuses === 'function') clearMechanicBonuses();
    const rb = window._raceBonuses;
    rb.det_max = 0;
    rb.vit_max = 0;
    rb.perc = 0;
    rb.is_yotun = false;
    rb.carga_mult = 1;
    rb.desloc_ar_override = false;

    // Karu-Selvagem: reverter +1 em Briga e Esquiva
    if (oldRace === 'Karu-Selvagem') {
        if (state.dots['sk_fisico_briga'] && state.dots['sk_fisico_briga'] > 0)
            state.dots['sk_fisico_briga'] = Math.max(0, (state.dots['sk_fisico_briga'] || 0) - 1);
        if (state.dots['sk_combate_esquiva'] && state.dots['sk_combate_esquiva'] > 0)
            state.dots['sk_combate_esquiva'] = Math.max(0, (state.dots['sk_combate_esquiva'] || 0) - 1);
        // Refresh visual dos dots
        const brigaCont = document.querySelector('.dots5[data-attr="sk_fisico_briga"]');
        const esquivaCont = document.querySelector('.dots5[data-attr="sk_combate_esquiva"]');
        if (brigaCont && typeof refreshDots === 'function') refreshDots(brigaCont, 'sk_fisico_briga');
        if (esquivaCont && typeof refreshDots === 'function') refreshDots(esquivaCont, 'sk_combate_esquiva');
    }

    // Pogo: restaurar dots 4 e 5 de FOR
    if (oldRace === 'Pogo') {
        updatePogoForUI(false);
    }
}

/**
 * Aplica os bônus da raça selecionada.
 */
function applyRaceBonuses(racaNome) {
    const rb = window._raceBonuses;

    switch (racaNome) {
        case 'Humano':
            // Força de Vontade Natural: +1 DET Máxima
            rb.det_max = 1;
            break;

        case 'Karu-Selvagem':
            // Pés Invertidos: +1 Briga, +1 Esquiva
            state.dots['sk_fisico_briga'] = (state.dots['sk_fisico_briga'] || 0) + 1;
            state.dots['sk_combate_esquiva'] = (state.dots['sk_combate_esquiva'] || 0) + 1;
            const brigaCont = document.querySelector('.dots5[data-attr="sk_fisico_briga"]');
            const esquivaCont = document.querySelector('.dots5[data-attr="sk_combate_esquiva"]');
            if (brigaCont && typeof refreshDots === 'function') refreshDots(brigaCont, 'sk_fisico_briga');
            if (esquivaCont && typeof refreshDots === 'function') refreshDots(esquivaCont, 'sk_combate_esquiva');
            break;

        case 'Picxi':
            // Descendência Luxiana: D.Aéreo = (FOR+DES+Tam+Atletismo)*3
            rb.desloc_ar_override = true;
            // Fragilidade Física: −1 VIT Máxima
            rb.vit_max = -1;
            break;

        case 'Pogo':
            // Corpo Frágil: limita FOR a no máximo 3
            updatePogoForUI(true);
            break;

        case 'Tamano': {
            // Olfato Excepcional: somar nível+1 à Percepção
            const olfatoLevel = state.dots['pec_olfato_excepcional'] || 1;
            rb.perc = olfatoLevel + 1; // nv1→+2, nv2→+3, nv3→+4
            break;
        }

        case 'Yotun': {
            // Passos de Gigante: dobrar desloc terrestre se tamanho >= 10 (verificado dinamicamente no recalcAll)
            rb.is_yotun = true;
            // Alta Carga: dobrar carga
            rb.carga_mult = 2;
            break;
        }
    }
}

/**
 * Pogo: esconde/mostra dots 4 e 5 de FOR e capeia o valor em 3.
 */
function updatePogoForUI(isPogo) {
    const forcaDotsContainer = document.querySelector('.dots5[data-attr="attr_for"]');
    if (!forcaDotsContainer) return;

    const dot4 = forcaDotsContainer.querySelector('.dot[data-val="4"]');
    const dot5 = forcaDotsContainer.querySelector('.dot[data-val="5"]');

    if (isPogo) {
        if (dot4) dot4.style.display = 'none';
        if (dot5) dot5.style.display = 'none';
        // Capear valor atual de FOR em 3
        if ((state.dots['attr_for'] || 0) > 3) {
            state.dots['attr_for'] = 3;
        }
    } else {
        if (dot4) dot4.style.display = '';
        if (dot5) dot5.style.display = '';
    }

    if (typeof refreshDots === 'function') refreshDots(forcaDotsContainer, 'attr_for');
}

function renderPeculiaridadeCard(pec, raceKey, container) {
    const card = document.createElement('div');
    card.className = 'peculiaridade-card';
    if (pec.negativo) card.classList.add('negativo');
    else card.classList.add('positivo');

    // Header: Nome e Badge de Nível (se fixo)
    const header = document.createElement('div');
    header.className = 'pec-header';

    const nomeEl = document.createElement('div');
    nomeEl.className = 'pec-nome';
    nomeEl.innerHTML = `${pec.icone} ${pec.nome}`;

    // Badge de Nível (antes do nome) — funciona para fixo e evolutivo
    const nivelDisplay = pec.tipo === 'evolutivo'
        ? (state.dots['pec_' + pec.key] || pec.nivelAtual || 1)
        : pec.nivel;

    if (nivelDisplay !== null && nivelDisplay !== undefined) {
        const badge = document.createElement('div');
        badge.className = 'pec-nivel-badge';
        badge.id = `pec_badge_${pec.key}`;
        badge.textContent = `Nível ${nivelDisplay}`;
        header.appendChild(badge);
    }

    header.appendChild(nomeEl);
    card.appendChild(header);

    // Descrição
    const desc = document.createElement('div');
    desc.className = 'pec-desc';
    desc.textContent = pec.descricao;
    card.appendChild(desc);

    // Efeito
    const efeitoContainer = document.createElement('div');
    efeitoContainer.className = 'pec-efeito-container';

    const efeito = document.createElement('div');
    efeito.className = 'pec-efeito';
    efeito.id = `pec_efeito_${pec.key}`;
    efeito.innerHTML = `<strong>Efeito:</strong> <span class="efeito-text">${pec.efeito}</span>`;

    efeitoContainer.appendChild(efeito);

    // Se for evolutivo, gerenciar níveis e custo
    if (pec.tipo === 'evolutivo') {
        const custo = document.createElement('div');
        custo.className = 'pec-custo';
        custo.id = `pec_custo_${pec.key}`;
        if (pec.niveis && pec.niveis[pec.nivelAtual]) {
            custo.textContent = `Custo: ${pec.niveis[pec.nivelAtual].custo}`;
            efeito.querySelector('.efeito-text').textContent = pec.niveis[pec.nivelAtual].efeito;
        }
        efeitoContainer.appendChild(custo);

        // Seletor de Nível (Dots)
        const selector = document.createElement('div');
        selector.className = 'pec-level-selector';

        const lbl = document.createElement('label');
        lbl.textContent = 'Nível Atual:';
        selector.appendChild(lbl);

        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'pec-dots dots5';
        dotsDiv.dataset.attr = 'pec_' + pec.key;
        renderEvolutableDots(dotsDiv, raceKey, pec, pec.nivelAtual, pec.nivelMax);

        selector.appendChild(dotsDiv);
        card.appendChild(efeitoContainer);
        card.appendChild(selector);

        // Garantir que o valor inicial esteja no state
        const dotKey = 'pec_' + pec.key;
        if (typeof state.dots[dotKey] === 'undefined' || state.dots[dotKey] < pec.nivelAtual) {
            state.dots[dotKey] = pec.nivelAtual;
        }
        refreshPecDots(dotsDiv, dotKey, pec.nivelAtual);
        updatePeculiaridadeLevel(raceKey, pec.key, state.dots[dotKey], pec);

    } else {
        card.appendChild(efeitoContainer);
    }

    // Renderizar UI de distribuição para mecânicas pendentes
    if (pec.mecanicas && typeof renderDistribuirUI === 'function') {
        for (const mech of pec.mecanicas) {
            if (mech.tipo !== 'distribuir') continue;
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            const isCreation = mech.duracao === 'criacao';
            if (!isPermanent && !isCreation) continue;

            const jaAplicada = state.mecanicasAplicadas?.[mech.id]?.aplicada;
            if (!jaAplicada) {
                renderDistribuirUI(card, mech);
            }
        }
    }

    container.appendChild(card);
}

function renderEvolutableDots(dotsDiv, raceKey, pec, minLevel, maxLevel) {
    const dotKey = 'pec_' + pec.key;

    // Verificar se alguma mecânica é "Apenas na Criação"
    const isCreationOnly = pec.mecanicas &&
        pec.mecanicas.some(m => m.progressaoApenasCriacao === true);

    for (let i = 1; i <= maxLevel; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.dataset.val = i;
        dot.title = 'Nível ' + i;

        // Desabilitar dots abaixo do mínimo
        if (i < minLevel) {
            dot.disabled = true;
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
        }

        // Se é "Apenas na Criação", desabilitar todos os dots acima do nível atual
        if (isCreationOnly && i > minLevel) {
            dot.disabled = true;
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
            dot.title = '🏗️ Apenas na Criação (não pode upar depois)';
        }

        // Verificar se o nível existe nos dados
        if (!pec.niveis[i]) {
            dot.disabled = true;
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
        }

        dot.addEventListener('click', () => {
            if (dot.disabled) return;
            const current = state.dots[dotKey] || minLevel;

            // Click ≤ nível atual → nada acontece
            if (i <= current) return;

            // Só permite subir 1 nível por vez
            const newLevel = current + 1;
            if (i !== newLevel) {
                if (typeof showUpgradeBlocked === 'function')
                    showUpgradeBlocked(`Só é possível subir 1 nível por vez! Nível atual: ${current}, próximo: ${newLevel}.`);
                return;
            }

            // Verificar se o nível está disponível
            if (!pec.niveis[newLevel]) return;

            // Parsear custo do nível
            const custoStr = pec.niveis[newLevel].custo || '—';
            const custoMatch = custoStr.match(/(\d+)/);
            const custo = custoMatch ? parseInt(custoMatch[1], 10) : 0;
            const isGanho = pec.niveis[newLevel].tipoExp === 'ganho';

            // Se custo é 0 ou '—' (nível base), permite sem gastar
            if (custo === 0) {
                state.dots[dotKey] = newLevel;
                refreshPecDots(dotsDiv, dotKey, minLevel);
                updatePeculiaridadeLevel(raceKey, pec.key, newLevel, pec);
                scheduleAutosave();
                return;
            }

            if (isGanho) {
                // Mecânica prejudicial: GANHA EXP ao subir de nível
                if (typeof showUpgradeConfirm === 'function') {
                    showUpgradeConfirm(`${pec.nome} (🎁 +${custo} EXP)`, newLevel, custo, () => {
                        spendExp(-custo); // Negativo = adiciona EXP
                        state.dots[dotKey] = newLevel;
                        refreshPecDots(dotsDiv, dotKey, minLevel);
                        updatePeculiaridadeLevel(raceKey, pec.key, newLevel, pec);
                        scheduleAutosave();
                        if (typeof showUpgradeSuccess === 'function')
                            showExpToast(`✅ ${pec.nome} subiu para nível ${newLevel}! (+${custo} EXP)`, 'success');
                        setTimeout(dismissExpToast, 2000);
                    });
                }
            } else {
                // Mecânica benéfica: CUSTA EXP ao subir de nível
                // Verificar EXP
                const currentExp = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
                if (custo > currentExp) {
                    if (typeof showUpgradeBlocked === 'function')
                        showUpgradeBlocked(`EXP insuficiente! Precisa de ${custo} EXP, mas só tem ${currentExp}.`);
                    return;
                }

                // Confirmação
                if (typeof showUpgradeConfirm === 'function') {
                    showUpgradeConfirm(pec.nome, newLevel, custo, () => {
                        spendExp(custo);
                        state.dots[dotKey] = newLevel;
                        refreshPecDots(dotsDiv, dotKey, minLevel);
                        updatePeculiaridadeLevel(raceKey, pec.key, newLevel, pec);
                        scheduleAutosave();
                        if (typeof showUpgradeSuccess === 'function')
                            showUpgradeSuccess(pec.nome, newLevel, custo);
                    });
                }
            }
        });

        dotsDiv.appendChild(dot);
    }
}

function refreshPecDots(container, dotKey, minLevel) {
    const v = state.dots[dotKey] || minLevel;
    container.querySelectorAll('.dot').forEach(d => {
        d.classList.toggle('filled', +d.dataset.val <= v);
    });
}

function updatePeculiaridadeLevel(raceKey, pecKey, newLevel, pecData) {
    const efeitoEl = document.getElementById(`pec_efeito_${pecKey}`);
    const custoEl = document.getElementById(`pec_custo_${pecKey}`);

    // Atualizar badge de nível no header
    const badgeEl = document.getElementById(`pec_badge_${pecKey}`);
    if (badgeEl) {
        badgeEl.textContent = `Nível ${newLevel}`;
    }

    if (efeitoEl && pecData.niveis && pecData.niveis[newLevel]) {
        efeitoEl.querySelector('.efeito-text').textContent = pecData.niveis[newLevel].efeito;
        if (custoEl) {
            custoEl.textContent = `Custo: ${pecData.niveis[newLevel].custo}`;
        }
    }

    // Auto-update blindagem if "blindagem_natural" is upgraded
    if (pecKey === 'blindagem_natural') {
        const bldField = document.querySelector('[data-key="blindagem"]');
        if (bldField) bldField.value = newLevel;
    }

    // Auto-update Percepção para Tamano: Olfato Excepcional
    if (pecKey === 'olfato_excepcional') {
        window._raceBonuses.perc = newLevel + 1; // nv1→+2, nv2→+3, nv3→+4
        if (typeof recalcAll === 'function') recalcAll();
    }
}
