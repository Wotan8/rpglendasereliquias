/* ===== PHASE 2 — As Origens (Tribo) ===== */

function initPhase2(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.origens);

    html += `<div class="section"><div class="section-title">🏕️ Escolha sua Tribo</div>`;
    html += `<div class="selection-grid" id="tribeGrid">`;

    const tribes = window._systemData.tribes
        .filter(t => t.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const tribe of tribes) {
        const sel = wizardState.triboSelecionada === tribe.nome ? 'selected' : '';
        html += `
            <div class="selection-card ${sel}" data-tribe="${escHtml(tribe.nome)}" onclick="selectTribe('${escHtml(tribe.nome)}')">
                ${tribe.imagemUrl ? `<img class="selection-card-img" src="${escHtml(tribe.imagemUrl)}" alt="${escHtml(tribe.nome)}" loading="lazy">` : ''}
                <div class="selection-card-title">${escHtml(tribe.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(tribe.subtitulo || tribe.lema || '')}</div>
                <div class="selection-card-desc">${escHtml(tribe.descricao || '').substring(0, 120)}${(tribe.descricao || '').length > 120 ? '...' : ''}</div>
            </div>
        `;
    }

    html += `</div>`;
    html += `<div id="tribeExpandedDetail"></div>`;
    html += `</div>`;

    // Memória
    html += createMemoryBox('origens', 'O que lembra do lugar onde cresceu? Um cheiro, um som, um rosto?', false);

    // Memória opcional
    html += createMemoryBox('origens_opcional', 'Qual era sua comida favorita de casa? O gosto que carrega na memória?', true);

    container.innerHTML = html;

    if (wizardState.triboSelecionada) showTribeDetail(wizardState.triboSelecionada);
}

function selectTribe(tribeName) {
    wizardState.triboSelecionada = tribeName;

    document.querySelectorAll('#tribeGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.tribe === tribeName);
    });

    showTribeDetail(tribeName);
    updateMiniPreview();
    saveWizardToStorage();
}

function showTribeDetail(tribeName) {
    const container = document.getElementById('tribeExpandedDetail');
    if (!container) return;

    const tribeData = window._systemData.tribes.find(t => t.nome === tribeName);
    const tribeBuilt = window.TRIBES[tribeName];
    if (!tribeData) { container.innerHTML = ''; return; }

    let html = `<div class="expanded-detail">`;
    html += `<button class="expanded-detail-close" onclick="this.parentElement.remove()">✕ Fechar</button>`;
    html += `<h3 style="margin:0 0 8px;">${escHtml(tribeData.nome)}</h3>`;

    if (tribeData.subtitulo || tribeData.lema) {
        html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(tribeData.subtitulo || tribeData.lema)}</p>`;
    }

    // Fields
    const fields = [
        ['Governo', tribeData.governo],
        ['Economia', tribeData.economia],
        ['Militar', tribeData.militar],
        ['Cultura', tribeData.cultura]
    ].filter(f => f[1]);

    if (fields.length) {
        html += `<div class="detail-fields-grid">`;
        for (const [label, val] of fields) {
            html += `<div class="detail-field"><span class="detail-field-label">${escHtml(label)}</span><span class="detail-field-value">${escHtml(val)}</span></div>`;
        }
        html += `</div>`;
    }

    // Descrição
    if (tribeData.descricao) {
        html += `<div class="detail-section"><div class="detail-section-title">📖 Descrição</div><div class="detail-section-text">${escHtml(tribeData.descricao)}</div></div>`;
    }

    // Peculiaridades
    if (tribeBuilt?.peculiaridades?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades da Tribo</div><div class="detail-pec-list">`;
        for (const pec of tribeBuilt.peculiaridades) {
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
