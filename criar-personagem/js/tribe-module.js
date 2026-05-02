/* ===== PHASE 2 — As Origens (Tribo) ===== */

function initPhase2(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.origens);

    html += `<div class="section"><div class="section-title">🏕️ Escolha sua Tribo</div>`;
    html += `<div class="selection-grid selection-grid-visual" id="tribeGrid">`;

    const tribes = window._systemData.tribes
        .filter(t => t.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const tribe of tribes) {
        const sel = wizardState.triboSelecionada === tribe.nome ? 'selected' : '';
        html += `
            <div class="selection-card card-visual ${sel}" data-tribe="${escHtml(tribe.nome)}" onclick="selectTribe('${escHtml(tribe.nome)}')">
                ${tribe.imagemUrl ? `<img class="selection-card-img-full" src="${escHtml(tribe.imagemUrl)}" alt="${escHtml(tribe.nome)}" loading="lazy">` : '<div class="selection-card-img-placeholder">🏕️</div>'}
                <div class="selection-card-title">${escHtml(tribe.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(tribe.subtitulo || tribe.lema || '')}</div>
            </div>
        `;
    }

    html += `</div>`;
    html += `<div id="tribeExpandedDetail"></div>`;
    html += `</div>`;

    // Memória principal
    html += createMemoryBox('origens', 'Descreva um momento da sua infância na tribo. Algo que marcou — uma festa, uma punição, um segredo que você descobriu.', false);

    // Memória Adicional (renomeada de Opcional)
    html += createMemoryBox('origens_adicional', 'Qual o sabor de casa. Quando você sente saudade, qual cheiro ou sabor te leva de volta para casa? O tempero da cozinha? O couro curtido? A fumaça das forjas?', true);

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

    let html = `<div class="expanded-detail" style="animation: expandIn .3s ease-out;">`;
    html += `<button class="expanded-detail-close" onclick="this.parentElement.style.animation='expandOut .2s ease-in forwards'; setTimeout(()=>this.parentElement.remove(),200)">✕ Fechar</button>`;
    html += `<h3 style="margin:0 0 8px;">${escHtml(tribeData.nome)}</h3>`;

    if (tribeData.subtitulo || tribeData.lema) {
        html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(tribeData.subtitulo || tribeData.lema)}</p>`;
    }

    // Descrição
    if (tribeData.descricao) {
        html += `<div class="detail-section"><div class="detail-section-title">📖 Descrição</div><div class="detail-section-text">${escHtml(tribeData.descricao)}</div></div>`;
    }

    // Fields grid
    const fields = [
        ['Cultura', tribeData.cultura],
        ['Governo', tribeData.governo],
        ['Economia', tribeData.economia],
        ['Militar', tribeData.militar]
    ].filter(f => f[1]);

    if (fields.length) {
        for (const [label, val] of fields) {
            html += `<div class="detail-section"><div class="detail-section-title">${getFieldIcon(label)} ${escHtml(label)}</div><div class="detail-section-text">${escHtml(val)}</div></div>`;
        }
    }

    // Unidades Militares
    if (tribeData.unidadesMilitares?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚔️ Unidades Militares</div>`;
        for (const unit of tribeData.unidadesMilitares) {
            html += `<div class="detail-unit">`;
            html += `<div class="detail-unit-name">${escHtml(unit.nome)}</div>`;
            if (unit.funcao) html += `<div class="detail-unit-role">${escHtml(unit.funcao)}</div>`;
            if (unit.descricao) html += `<div class="detail-unit-desc">${escHtml(unit.descricao)}</div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Perícias concedidas pela tribo
    if (tribeData.pericias?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">📚 Perícias da Tribo</div><div class="detail-tag-list">`;
        for (const sk of tribeData.pericias) {
            const skName = typeof sk === 'object' ? sk.nome : sk;
            const skLevel = typeof sk === 'object' ? sk.nivel : null;
            const skOpcao = typeof sk === 'object' ? sk.opcao : null;
            let label = escHtml(skName);
            if (skLevel) label += ` (Nv.${skLevel})`;
            if (skOpcao) label += ` ou ${escHtml(skOpcao)}`;
            html += `<span class="detail-tag">${label}</span>`;
        }
        html += `</div></div>`;
    }

    // Peculiaridades com mecânicas detalhadas
    if (tribeBuilt?.peculiaridades?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades da Tribo</div><div class="detail-pec-list">`;
        for (const pec of tribeBuilt.peculiaridades) {
            html += renderPecWithMechanics(pec);
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function getFieldIcon(label) {
    const icons = { 'Cultura': '🎭', 'Governo': '🏛️', 'Economia': '💰', 'Militar': '⚔️' };
    return icons[label] || '📋';
}
