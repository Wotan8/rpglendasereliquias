/* ===== PHASE 1 — A Linhagem (Raça + Classe) ===== */

function initPhase1(container) {
    let html = '';

    // === RAÇA ===
    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_raca);
    html += `<div class="section"><div class="section-title">🧬 Escolha sua Raça</div>`;
    html += `<div class="selection-grid selection-grid-visual" id="raceGrid">`;

    const races = window._systemData.races
        .filter(r => r.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const race of races) {
        const sel = wizardState.racaSelecionada === race.nome ? 'selected' : '';
        html += `
            <div class="selection-card card-visual ${sel}" data-race="${escHtml(race.nome)}" onclick="selectRace('${escHtml(race.nome)}')">
                ${race.imagemUrl ? `<img class="selection-card-img-full" src="${escHtml(race.imagemUrl)}" alt="${escHtml(race.nome)}" loading="lazy">` : '<div class="selection-card-img-placeholder">🧬</div>'}
                <div class="selection-card-title">${escHtml(race.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(race.subtitulo || '')}</div>
                <button class="selection-card-info-btn" onclick="openRaceModal('${escHtml(race.nome)}', event)">
                    <span class="info-text">Mais Detalhes Clique Aqui ></span>
                    <span class="info-icon">ℹ️</span>
                </button>
            </div>
        `;
    }
    html += `</div>`;
    html += `</div>`;

    // Memory for race
    html += createMemoryBox('linhagem_raca', 'O que você viu pela primeira vez quando se olhou no espelho e percebeu que era diferente dos outros? Descreva essa memória. Quando você se olha no espelho, tem algo que te incomoda? Há algo na sua aparência que reflete o caminho que você escolheu?', false);

    // === CLASSE ===
    html += `<hr style="border:none;border-top:2px solid var(--soft);margin:30px 0;">`;
    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_classe);
    html += `<div class="section"><div class="section-title">⚔️ Escolha sua Classe</div>`;
    html += `<div class="selection-grid selection-grid-visual" id="classGrid">`;

    const classes = window._systemData.classes
        .filter(c => c.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const cls of classes) {
        const sel = wizardState.classeSelecionada === cls.nome ? 'selected' : '';
        const citacao = cls.citacao || cls.citacaoIconica || '';
        html += `
            <div class="selection-card card-visual ${sel}" data-class="${escHtml(cls.nome)}" onclick="selectClass('${escHtml(cls.nome)}')">
                ${cls.imagemUrl ? `<img class="selection-card-img-full" src="${escHtml(cls.imagemUrl)}" alt="${escHtml(cls.nome)}" loading="lazy">` : '<div class="selection-card-img-placeholder">⚔️</div>'}
                <div class="selection-card-title">${escHtml(cls.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(cls.arquetipo || '')}</div>
                ${citacao ? `<div class="selection-card-quote">"${escHtml(citacao).substring(0, 60)}${citacao.length > 60 ? '...' : ''}"</div>` : ''}
                <button class="selection-card-info-btn" onclick="openClassModal('${escHtml(cls.nome)}', event)">
                    <span class="info-text">Mais Detalhes Clique Aqui ></span>
                    <span class="info-icon">ℹ️</span>
                </button>
            </div>
        `;
    }
    html += `</div>`;
    html += `</div>`;

    // Memory for class
    html += createMemoryBox('linhagem_classe', 'Qual foi o momento em que você percebeu que esse era o seu caminho? Foi uma escolha ou uma imposição? Descreva. Quem te ensinou isso? Um mentor, um livro, a necessidade? Descreva essa pessoa ou momento.', false);

    container.innerHTML = html;
}

function selectRace(raceName) {
    wizardState.racaSelecionada = raceName;

    // Update card selection
    document.querySelectorAll('#raceGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.race === raceName);
    });

    updateMiniPreview();
    saveWizardToStorage();
    forceRerender(3); // Força atualização de Peculiaridades Herdadas
}

function openRaceModal(raceName, event) {
    if (event) event.stopPropagation();
    
    const raceData = window._systemData.races.find(r => r.nome === raceName);
    const raceBuilt = window.RACES[raceName];
    if (!raceData) return;

    let html = `
    <div class="detail-modal" id="raceModal" onclick="this.remove()">
        <div class="detail-modal-content" onclick="event.stopPropagation()">
            <button class="detail-modal-close" onclick="document.getElementById('raceModal').remove()">✕</button>
            <h3 style="margin:0 0 8px;">${escHtml(raceData.nome)}</h3>`;

    if (raceData.subtitulo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(raceData.subtitulo)}</p>`;

    // Fields grid
    const fields = [
        ['Tamanho', raceData.tamanho],
        ['Expectativa de Vida', raceData.expectativaVida],
        ['Tendência', raceData.tendencia],
        ['Aparência', raceData.aparencia],
        ['Habitat', raceData.habitat]
    ].filter(f => f[1]);

    if (fields.length) {
        html += `<div class="detail-fields-grid">`;
        for (const [label, val] of fields) {
            html += `<div class="detail-field"><span class="detail-field-label">${escHtml(label)}</span><span class="detail-field-value">${escHtml(val)}</span></div>`;
        }
        html += `</div>`;
    }

    // Historia
    if (raceData.historia || raceData.lore) {
        html += `<div class="detail-section"><div class="detail-section-title">📜 História</div><div class="detail-section-text">${escHtml(raceData.historia || raceData.lore)}</div></div>`;
    }

    // Curiosidades
    if (raceData.curiosidades) {
        const curios = Array.isArray(raceData.curiosidades) ? raceData.curiosidades : [raceData.curiosidades];
        html += `<div class="detail-section"><div class="detail-section-title">💡 Curiosidades</div><div class="detail-tag-list">`;
        for (const c of curios) {
            html += `<span class="detail-tag">${escHtml(c)}</span>`;
        }
        html += `</div></div>`;
    }

    // Peculiaridades com mecânicas detalhadas
    if (raceBuilt?.peculiaridades?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades Raciais</div><div class="detail-pec-list">`;
        for (const pec of raceBuilt.peculiaridades) {
            html += renderPecWithMechanics(pec);
        }
        html += `</div></div>`;
    }

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function selectClass(className) {
    wizardState.classeSelecionada = className;

    document.querySelectorAll('#classGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.class === className);
    });

    updateMiniPreview();
    saveWizardToStorage();
    forceRerender(3); // Força atualização de Peculiaridades Herdadas
    forceRerender(5); // Força atualização de Perícias de Classe
}

function openClassModal(className, event) {
    if (event) event.stopPropagation();

    const cls = window._systemData.classes.find(c => c.nome === className);
    if (!cls) return;

    let html = `
    <div class="detail-modal" id="classModal" onclick="this.remove()">
        <div class="detail-modal-content" onclick="event.stopPropagation()">
            <button class="detail-modal-close" onclick="document.getElementById('classModal').remove()">✕</button>
            <h3 style="margin:0 0 8px;">${escHtml(cls.nome)}</h3>`;

    if (cls.arquetipo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(cls.arquetipo)}</p>`;

    // Citação
    const citacao = cls.citacao || cls.citacaoIconica;
    if (citacao) html += `<div class="detail-quote">"${escHtml(citacao)}"</div>`;

    // Descrição
    if (cls.descricao) {
        html += `<div class="detail-section"><div class="detail-section-title">📖 Descrição</div><div class="detail-section-text">${escHtml(cls.descricao)}</div></div>`;
    }

    // Papel em Cena
    const papelCombate = cls.papelEmCena?.[0]?.combate || cls.papelEmCombate;
    const papelFora = cls.papelEmCena?.[0]?.foraCombate || cls.papelForaCombate;
    if (papelCombate || papelFora) {
        html += `<div class="detail-section"><div class="detail-section-title">🎭 Papel em Cena</div>`;
        if (papelCombate) html += `<div class="detail-role-item"><strong>⚔️ Em Combate:</strong> ${escHtml(papelCombate)}</div>`;
        if (papelFora) html += `<div class="detail-role-item"><strong>🏕️ Fora de Combate:</strong> ${escHtml(papelFora)}</div>`;
        html += `</div>`;
    }

    // Recursos da Classe
    const recursos = cls.recursosDaClasse?.[0];
    if (recursos) {
        html += `<div class="detail-section"><div class="detail-section-title">🔋 Recursos da Classe</div><div class="detail-fields-grid">`;
        if (recursos.primario) html += `<div class="detail-field"><span class="detail-field-label">Primário</span><span class="detail-field-value">${escHtml(recursos.primario)}</span></div>`;
        if (recursos.secundario) html += `<div class="detail-field"><span class="detail-field-label">Secundário</span><span class="detail-field-value">${escHtml(recursos.secundario)}</span></div>`;
        if (recursos.risco) html += `<div class="detail-field"><span class="detail-field-label">Risco</span><span class="detail-field-value">${escHtml(recursos.risco)}</span></div>`;
        html += `</div></div>`;
    }

    // Perícias de Classe
    if (window.CLASS_SKILLS[className]?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">📚 Perícias de Classe</div><div class="detail-tag-list">`;
        for (const sk of window.CLASS_SKILLS[className]) {
            html += `<span class="detail-tag">${escHtml(sk)}</span>`;
        }
        html += `</div></div>`;
    }

    // Manobras/Técnicas
    if (cls.manobras?.length) {
        const maneuverData = (cls.manobras || []).map(mId => {
            return window._systemData.maneuvers?.find(m => m.id === mId);
        }).filter(Boolean);
        if (maneuverData.length) {
            html += `<div class="detail-section"><div class="detail-section-title">💥 Manobras / Técnicas</div><div class="detail-tag-list">`;
            for (const man of maneuverData) {
                html += `<span class="detail-tag">${escHtml(man.nome)}</span>`;
            }
            html += `</div></div>`;
        }
    }

    // Peculiaridades de Classe com mecânicas detalhadas
    if (window.CLASS_PECULIARITIES[className]?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades de Classe</div><div class="detail-pec-list">`;
        for (const pec of window.CLASS_PECULIARITIES[className]) {
            html += renderPecWithMechanics(pec);
        }
        html += `</div></div>`;
    }

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

/* ===== SHARED: Render a peculiarity with its linked mechanics ===== */

function renderPecWithMechanics(pec) {
    let html = `<div class="detail-pec-item-full ${pec.negativo ? 'negativo' : 'positivo'}">`;
    html += `<div class="detail-pec-header">`;
    html += `<span class="detail-pec-icon">${pec.icone || '📋'}</span>`;
    html += `<span class="detail-pec-name">${escHtml(pec.nome)}</span>`;
    html += `</div>`;

    if (pec.descricao) {
        html += `<div class="detail-pec-desc-full">${escHtml(pec.descricao)}</div>`;
    }

    // Mecânicas vinculadas detalhadas
    if (pec.mecanicas?.length) {
        html += `<div class="detail-pec-mechanics">`;
        for (const mech of pec.mecanicas) {
            html += `<div class="detail-mechanic-item">`;
            html += `<span class="detail-mechanic-name">${escHtml(mech.nome || 'Mecânica')}</span>`;

            const parts = [];
            if (mech.tipo) parts.push(`Tipo: ${escHtml(mech.tipo)}`);
            if (mech.config?.alvo) parts.push(`Alvo: ${escHtml(mech.config.alvo)}`);
            if (mech.config?.operacao) parts.push(`Operação: ${escHtml(mech.config.operacao)}`);
            if (mech.config?.valor != null) parts.push(`Valor: ${mech.config.valor}`);
            if (mech.config?.textoEfeito) parts.push(escHtml(mech.config.textoEfeito));

            if (parts.length) {
                html += `<span class="detail-mechanic-info">${parts.join(' · ')}</span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Níveis evolutivos
    if (pec.tipo === 'evolutivo' && pec.niveis) {
        html += `<div class="detail-pec-levels">`;
        for (const [lvl, info] of Object.entries(pec.niveis)) {
            html += `<div class="detail-pec-level">`;
            html += `<span class="detail-pec-level-num">Nv.${lvl}</span>`;
            html += `<span class="detail-pec-level-cost">${info.custo || ''}</span>`;
            if (info.efeito) html += `<span class="detail-pec-level-effect">${escHtml(info.efeito)}</span>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}
