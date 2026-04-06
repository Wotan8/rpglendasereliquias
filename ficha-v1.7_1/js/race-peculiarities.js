/* ===== LÓGICA DE PECULIARIDADES RACIAIS ===== */

/* Guarda a raça anterior para poder reverter bônus corretamente */
let _previousRace = '';
let _previousRaceData = null;

// Default fallback to prevent crash if not initialized elsewhere
window._raceBonuses = window._raceBonuses || {
    ener_max: 0,
    vit_max: 0,
    perc: 0,
    is_yotun: false,
    carga_mult: 1,
    desloc_ar_override: false
};

/**
 * Define os valores iniciais dos Valores Derivados vinculados à raça.
 * Itera derivedValueIds da raça e aplica valorInicial no state.derived + display.
 */
function _setDerivedInitialValues(raceData) {
    if (!state.derived) state.derived = {};
    const dvIds = raceData?.derivedValueIds || [];
    for (const dvEntry of dvIds) {
        const isObj = typeof dvEntry === 'object' && dvEntry !== null;
        const dvId = isObj ? dvEntry.id : dvEntry;
        const valorInicial = isObj ? (parseFloat(dvEntry.valorInicial) || 0) : 0;

        // Encontrar a key dinâmica do Valor Derivado
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (dvDef) {
            state.derived[dvDef.key] = valorInicial;
            // Atualizar display na grid
            const displayEl = document.getElementById(`dv_${dvDef.key}_display`);
            if (displayEl) {
                displayEl.value = Number.isInteger(valorInicial) ? valorInicial : parseFloat(valorInicial.toFixed(1));
            }
        }
    }
}

/**
 * Limpa os valores iniciais dos DVs de uma raça anterior.
 */
function _clearDerivedInitialValues(raceData) {
    if (!state.derived) return;
    const dvIds = raceData?.derivedValueIds || [];
    for (const dvEntry of dvIds) {
        const isObj = typeof dvEntry === 'object' && dvEntry !== null;
        const dvId = isObj ? dvEntry.id : dvEntry;
        const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
        if (dvDef) {
            state.derived[dvDef.key] = 0;
            const displayEl = document.getElementById(`dv_${dvDef.key}_display`);
            if (displayEl) displayEl.value = '0';
        }
    }
}

function onRaceChange() {
    const selRaca = document.getElementById('selRaca');
    if (!selRaca) return;
    const racaNome = selRaca.value;

    // --- Limpar bônus da raça anterior ANTES de tudo ---
    clearRaceBonuses(_previousRace);
    // Limpar valores iniciais de DVs da raça anterior
    if (_previousRaceData) _clearDerivedInitialValues(_previousRaceData);

    // Atualizar subtitulo da raça
    const subtitleEl = document.getElementById('raceSubtitle');
    const grid = document.getElementById('peculiaridadesGrid');

    if (!grid) return;
    grid.innerHTML = ''; // Limpar peculiaridades atuais

    if (!racaNome || racaNome === '') {
        if (subtitleEl) subtitleEl.textContent = '';
        // Limpar valores iniciais dos DVs da raça anterior
        if (_previousRaceData) _clearDerivedInitialValues(_previousRaceData);
        const hint = document.createElement('div');
        hint.className = 'hint-text';
        hint.id = 'raceHint';
        hint.textContent = 'Selecione uma raça para visualizar suas peculiaridades.';
        grid.appendChild(hint);
        updateYotunForcaUI('');
        updateDaereoVisibility('');
        _previousRace = '';
        _previousRaceData = null;
        window._dvInitialValues = {};
        if (typeof recalcAll === 'function') recalcAll();
        scheduleAutosave();
        return;
    }

    const raca = RACES[racaNome];
    if (!raca) return;

    // Preencher subtítulo e valores iniciais dos DVs vinculados
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
    _previousRaceData = raca;

    // Atualizar grid de Valores Derivados (raça pode adicionar novos valores)
    if (typeof renderDerivedValuesGrid === 'function') renderDerivedValuesGrid();
    // Aplicar valores iniciais dos DVs vinculados à raça
    _setDerivedInitialValues(raca);
    if (typeof recalcAll === 'function') recalcAll();

    // Re-inicializar tooltips (raça pode adicionar mecânicas que afetam perícias/vitais)
    if (typeof initVitalStatsTooltips === 'function') initVitalStatsTooltips();
    if (typeof initSkillTooltips === 'function') initSkillTooltips();
    if (typeof initAttributeTooltips === 'function') initAttributeTooltips();

    scheduleAutosave();
}

function updateDaereoVisibility(racaNome) {
    // No-op: Valores Derivados agora são renderizados dinamicamente pelo Firebase.
    // D.AÉREO será exibido apenas se vinculado à raça/classe via Painel de Criador.
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
    rb.ener_max = 0;
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
            // Força de Vontade Natural: +1 ENER Máxima
            rb.ener_max = 1;
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
        const currentLvl = state.dots['pec_' + pec.key] || pec.nivelAtual || 1;
        if (pec.niveis && pec.niveis[currentLvl]) {
            custo.textContent = pec.niveis[currentLvl].custo;
            efeito.querySelector('.efeito-text').textContent = pec.niveis[currentLvl].efeito;
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

    } else {
        card.appendChild(efeitoContainer);
    }

    // Renderizar UI de distribuição (pendente, parcial ou completa)
    if (pec.mecanicas && typeof renderDistribuirUI === 'function') {
        for (const mech of pec.mecanicas) {
            if (mech.tipo !== 'distribuir') continue;
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            const isCreation = mech.duracao === 'criacao';
            if (!isPermanent && !isCreation) continue;

            // Sempre renderizar — a função decide se mostra selects ou apenas resumo
            renderDistribuirUI(card, mech, pec);
        }
    }

    container.appendChild(card);

    // Chamar DEPOIS do appendChild para que document.getElementById funcione
    if (pec.tipo === 'evolutivo') {
        const dotKey = 'pec_' + pec.key;
        updatePeculiaridadeLevel(raceKey, pec.key, state.dots[dotKey] || pec.nivelAtual || 1, pec);
    }
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
                if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(raceKey);
                if (typeof recalcAll === 'function') recalcAll();
                if (typeof recalcMainTests === 'function') recalcMainTests();
                if (typeof checkDistribuirOnLevelUp === 'function') checkDistribuirOnLevelUp(pec);
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
                        if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(raceKey);
                        if (typeof recalcAll === 'function') recalcAll();
                        if (typeof recalcMainTests === 'function') recalcMainTests();
                        if (typeof checkDistribuirOnLevelUp === 'function') checkDistribuirOnLevelUp(pec);
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
                        if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(raceKey);
                        if (typeof recalcAll === 'function') recalcAll();
                        if (typeof recalcMainTests === 'function') recalcMainTests();
                        if (typeof checkDistribuirOnLevelUp === 'function') checkDistribuirOnLevelUp(pec);
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
        // Regenerar efeito dinamicamente a partir de TODAS as mecânicas
        let efeitoTexto = '';
        if (pecData.mecanicas && typeof generatePreviewText === 'function') {
            const efeitosNivel = [];
            for (const m of pecData.mecanicas) {
                // --- Mecânica evoluível: ajustar config com valores da progressão ---
                if (m.evoluivel === true && m.progressao) {
                    const prog = m.progressao[String(newLevel)];
                    if (prog) {
                        const adjustedMech = JSON.parse(JSON.stringify(m));
                        delete adjustedMech.previewTexto; // Forçar geração dinâmica

                        if (m.tipo === 'modificar') {
                            if (prog.valor !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, valor: prog.valor };
                            }
                        } else if (m.tipo === 'limitar') {
                            // Aplicar valorLimite/valor diretamente sem depender do campo base existir
                            const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
                            if (limVal !== undefined) {
                                if (!adjustedMech.config) adjustedMech.config = {};
                                // Detectar tipo do limite para atribuir ao campo correto
                                const tipoLim = adjustedMech.config.tipoLimite;
                                if (tipoLim === 'maximo' || adjustedMech.config.valorMaximo !== undefined) {
                                    adjustedMech.config.valorMaximo = limVal;
                                }
                                if (tipoLim === 'minimo' || adjustedMech.config.valorMinimo !== undefined) {
                                    adjustedMech.config.valorMinimo = limVal;
                                }
                                // Fallback: se nenhum campo foi setado, definir ambos
                                if (adjustedMech.config.valorMaximo === undefined && adjustedMech.config.valorMinimo === undefined) {
                                    adjustedMech.config.valorMaximo = limVal;
                                }
                            }
                        } else if (m.tipo === 'distribuir') {
                            if (prog.valorPorAlvo !== undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valorPorAlvo };
                            if (prog.quantidadeAlvos !== undefined) adjustedMech.config = { ...adjustedMech.config, quantidadeAlvos: prog.quantidadeAlvos };
                            if (prog.valor !== undefined && prog.valorPorAlvo === undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valor };
                        } else if (m.tipo === 'narrativo') {
                            // Narrativo: usar descricao ou textoEfeito da progressão
                            if (prog.descricao) {
                                efeitosNivel.push(prog.descricao);
                                continue;
                            }
                            if (prog.textoEfeito) {
                                adjustedMech.config = { ...adjustedMech.config, textoEfeito: prog.textoEfeito };
                            }
                        } else if (m.tipo === 'conceder') {
                            // Conceder: usar descrição/tipo da progressão
                            if (prog.descricaoConcessao !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, descricaoConcessao: prog.descricaoConcessao };
                            }
                            if (prog.tipoConcessao !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, tipoConcessao: prog.tipoConcessao };
                            }
                            if (prog.descricao) {
                                efeitosNivel.push(prog.descricao);
                                continue;
                            }
                        } else if (m.tipo === 'condicional') {
                            // Condicional: usar gatilho da progressão
                            if (prog.gatilho !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, gatilho: prog.gatilho };
                            }
                            if (prog.descricao) {
                                efeitosNivel.push(prog.descricao);
                                continue;
                            }
                        } else if (prog.descricao) {
                            // Tipo desconhecido com descrição: usar direto
                            efeitosNivel.push(prog.descricao);
                            continue;
                        }
                        efeitosNivel.push(generatePreviewText(adjustedMech));
                    }
                } else {
                    // --- Mecânica NÃO-evoluível: incluir texto estático ---
                    efeitosNivel.push(generatePreviewText(m));
                }
            }
            if (efeitosNivel.length > 0) {
                efeitoTexto = efeitosNivel.join('; ');
            }
        }
        // Fallback: usar texto pré-computado se não conseguiu gerar dinamicamente
        if (!efeitoTexto) {
            efeitoTexto = pecData.niveis[newLevel].efeito;
        }
        efeitoEl.querySelector('.efeito-text').textContent = efeitoTexto;
        if (custoEl) {
            custoEl.textContent = pecData.niveis[newLevel].custo;
        }
    }

    // Auto-update blindagem if "blindagem_natural" is upgraded
    if (pecKey === 'blindagem_natural') {
        // Atualizar o valor base no state — recalcAll() aplicará bônus por cima
        if (!state.fieldBaseValues) state.fieldBaseValues = {};
        state.fieldBaseValues['blindagem'] = newLevel;
        const bldField = document.querySelector('[data-key="blindagem"]');
        if (bldField) {
            bldField.value = newLevel;
        }
    }

    // Auto-update Percepção para Tamano: Olfato Excepcional
    if (pecKey === 'olfato_excepcional') {
        window._raceBonuses.perc = newLevel + 1; // nv1→+2, nv2→+3, nv3→+4
        if (typeof recalcAll === 'function') recalcAll();
    }
}
