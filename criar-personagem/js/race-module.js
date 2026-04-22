/* ===== PHASE 1 — A Linhagem (Raça + Classe) ===== */

function initPhase1(container) {
    let html = '';

    // === RAÇA ===
    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_raca);
    html += `<div class="section"><div class="section-title">🧬 Escolha sua Raça</div>`;
    html += `<div class="selection-grid" id="raceGrid">`;

    const races = window._systemData.races
        .filter(r => r.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const race of races) {
        const sel = wizardState.racaSelecionada === race.nome ? 'selected' : '';
        html += `
            <div class="selection-card ${sel}" data-race="${escHtml(race.nome)}" onclick="selectRace('${escHtml(race.nome)}')">
                ${race.imagemUrl ? `<img class="selection-card-img" src="${escHtml(race.imagemUrl)}" alt="${escHtml(race.nome)}" loading="lazy">` : ''}
                <div class="selection-card-title">${escHtml(race.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(race.subtitulo || '')}</div>
                <div class="selection-card-desc">${escHtml(race.descricao || race.historia || '').substring(0, 120)}${(race.descricao || race.historia || '').length > 120 ? '...' : ''}</div>
            </div>
        `;
    }
    html += `</div>`;

    // Expanded detail area
    html += `<div id="raceExpandedDetail"></div>`;
    html += `</div>`;

    // Memory for race
    html += createMemoryBox('linhagem_raca', 'Quando soube que pertencia a este povo, o que sentiu? Orgulho? Vergonha? Indiferença?', false);

    // === CLASSE ===
    html += `<hr style="border:none;border-top:2px solid var(--soft);margin:30px 0;">`;
    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_classe);
    html += `<div class="section"><div class="section-title">⚔️ Escolha sua Classe</div>`;
    html += `<div class="selection-grid" id="classGrid">`;

    const classes = window._systemData.classes
        .filter(c => c.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const cls of classes) {
        const sel = wizardState.classeSelecionada === cls.nome ? 'selected' : '';
        const citacao = cls.citacao || cls.citacaoIconica || '';
        html += `
            <div class="selection-card ${sel}" data-class="${escHtml(cls.nome)}" onclick="selectClass('${escHtml(cls.nome)}')">
                ${cls.imagemUrl ? `<img class="selection-card-img" src="${escHtml(cls.imagemUrl)}" alt="${escHtml(cls.nome)}" loading="lazy">` : ''}
                <div class="selection-card-title">${escHtml(cls.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(cls.arquetipo || '')}</div>
                ${citacao ? `<div class="selection-card-desc" style="font-style:italic;opacity:.7;">"${escHtml(citacao).substring(0, 80)}"</div>` : ''}
            </div>
        `;
    }
    html += `</div>`;

    // Expanded detail area
    html += `<div id="classExpandedDetail"></div>`;
    html += `</div>`;

    // Memory for class
    html += createMemoryBox('linhagem_classe', 'Quando descobriu sua vocação — o primeiro dia de treino, a primeira lição — o que mudou em você?', false);

    container.innerHTML = html;

    // Restore expanded details if selections exist
    if (wizardState.racaSelecionada) showRaceDetail(wizardState.racaSelecionada);
    if (wizardState.classeSelecionada) showClassDetail(wizardState.classeSelecionada);
}

function selectRace(raceName) {
    wizardState.racaSelecionada = raceName;

    // Update card selection
    document.querySelectorAll('#raceGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.race === raceName);
    });

    // Show detail
    showRaceDetail(raceName);
    updateMiniPreview();
    saveWizardToStorage();
}

function showRaceDetail(raceName) {
    const container = document.getElementById('raceExpandedDetail');
    if (!container) return;

    const raceData = window._systemData.races.find(r => r.nome === raceName);
    const raceBuilt = window.RACES[raceName];
    if (!raceData) { container.innerHTML = ''; return; }

    let html = `<div class="expanded-detail">`;
    html += `<button class="expanded-detail-close" onclick="this.parentElement.remove()">✕ Fechar</button>`;
    html += `<h3 style="margin:0 0 8px;">${escHtml(raceData.nome)}</h3>`;

    if (raceData.subtitulo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(raceData.subtitulo)}</p>`;

    // Fields grid
    const fields = [
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
        html += `<div class="detail-section"><div class="detail-section-title">💡 Curiosidades</div><div class="detail-section-text">${escHtml(raceData.curiosidades)}</div></div>`;
    }

    // Peculiaridades
    if (raceBuilt?.peculiaridades?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades Raciais</div><div class="detail-pec-list">`;
        for (const pec of raceBuilt.peculiaridades) {
            html += `<div class="detail-pec-item ${pec.negativo ? 'negativo' : 'positivo'}">
                <span class="detail-pec-icon">${pec.icone || '📋'}</span>
                <span class="detail-pec-name">${escHtml(pec.nome)}</span>
                ${pec.descricao ? `<span class="detail-pec-desc">${escHtml(pec.descricao).substring(0, 80)}...</span>` : ''}
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function selectClass(className) {
    wizardState.classeSelecionada = className;

    document.querySelectorAll('#classGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.class === className);
    });

    showClassDetail(className);
    updateMiniPreview();
    saveWizardToStorage();
}

function showClassDetail(className) {
    const container = document.getElementById('classExpandedDetail');
    if (!container) return;

    const cls = window._systemData.classes.find(c => c.nome === className);
    if (!cls) { container.innerHTML = ''; return; }

    let html = `<div class="expanded-detail">`;
    html += `<button class="expanded-detail-close" onclick="this.parentElement.remove()">✕ Fechar</button>`;
    html += `<h3 style="margin:0 0 8px;">${escHtml(cls.nome)}</h3>`;

    if (cls.arquetipo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(cls.arquetipo)}</p>`;

    // Citação
    const citacao = cls.citacao || cls.citacaoIconica;
    if (citacao) html += `<div class="detail-quote">"${escHtml(citacao)}"</div>`;

    // Descrição
    if (cls.descricao) {
        html += `<div class="detail-section"><div class="detail-section-title">📖 Descrição</div><div class="detail-section-text">${escHtml(cls.descricao)}</div></div>`;
    }

    // Papel
    if (cls.papelEmCombate || cls.papelForaCombate) {
        html += `<div class="detail-section"><div class="detail-section-title">🎭 Papel em Cena</div>`;
        if (cls.papelEmCombate) html += `<div class="detail-role-item"><strong>⚔️ Em Combate:</strong> ${escHtml(cls.papelEmCombate)}</div>`;
        if (cls.papelForaCombate) html += `<div class="detail-role-item"><strong>🏕️ Fora de Combate:</strong> ${escHtml(cls.papelForaCombate)}</div>`;
        html += `</div>`;
    }

    // Perícias de Classe
    if (window.CLASS_SKILLS[className]?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">📚 Perícias de Classe</div><div class="detail-tag-list">`;
        for (const sk of window.CLASS_SKILLS[className]) {
            html += `<span class="detail-tag">${escHtml(sk)}</span>`;
        }
        html += `</div></div>`;
    }

    // Peculiaridades de Classe
    if (window.CLASS_PECULIARITIES[className]?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades de Classe</div><div class="detail-pec-list">`;
        for (const pec of window.CLASS_PECULIARITIES[className]) {
            html += `<div class="detail-pec-item ${pec.negativo ? 'negativo' : 'positivo'}">
                <span class="detail-pec-icon">${pec.icone || '📋'}</span>
                <span class="detail-pec-name">${escHtml(pec.nome)}</span>
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}
