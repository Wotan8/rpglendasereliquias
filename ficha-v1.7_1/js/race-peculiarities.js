/* ===== LÓGICA DE PECULIARIDADES RACIAIS ===== */

function onRaceChange() {
    const selRaca = document.getElementById('selRaca');
    if (!selRaca) return;
    const racaNome = selRaca.value;

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

    scheduleAutosave();
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

    header.appendChild(nomeEl);

    if (pec.tipo === 'fixo' && pec.nivel !== null) {
        const badge = document.createElement('div');
        badge.className = 'pec-nivel-badge';
        badge.textContent = `Nível ${pec.nivel}`;
        header.appendChild(badge);
    }
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

    container.appendChild(card);
}

function renderEvolutableDots(dotsDiv, raceKey, pec, minLevel, maxLevel) {
    const dotKey = 'pec_' + pec.key;

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

        // Verificar se o nível existe nos dados
        if (!pec.niveis[i]) {
            dot.disabled = true;
            dot.style.opacity = '0.3';
            dot.style.cursor = 'not-allowed';
        }

        dot.addEventListener('click', () => {
            if (dot.disabled) return;
            const current = state.dots[dotKey];

            // Toggle modificado: respeitar o minLevel
            if (current === i && i > minLevel) {
                state.dots[dotKey] = i - 1 >= minLevel ? i - 1 : minLevel;
            } else {
                state.dots[dotKey] = i;
            }

            // Garantir que não pode ficar abaixo do mínimo
            if (state.dots[dotKey] < minLevel) {
                state.dots[dotKey] = minLevel;
            }

            refreshPecDots(dotsDiv, dotKey, minLevel);
            updatePeculiaridadeLevel(raceKey, pec.key, state.dots[dotKey], pec);
            scheduleAutosave();
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
}
