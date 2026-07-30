/* ===== PHASE 5 — A Alma (Virtude e Vício) ===== */

function initPhase5(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.alma);

    // Virtudes
    html += `
        <div class="section">
            <div class="section-title">💫 Escolha sua Virtude</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                A virtude é o ideal mais nobre que seu personagem persegue.
                Quando agir de acordo com ela em momentos de sacrifício, você recupera Energia.
            </p>
            <div class="selection-grid" id="virtueGrid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
    `;

    for (const v of VIRTUDES) {
        const isSelected = wizardState.virtudeSelecionada === v.id;
        const sel = isSelected ? 'selected expanded' : '';
        html += `
            <div class="soul-card ${sel}" data-virtue="${v.id}" onclick="selectVirtue('${v.id}')">
                <div class="soul-card-header">
                    <span class="soul-card-icon">${v.icone}</span>
                    <span class="soul-card-name">${escHtml(v.nome)}</span>
                </div>
                <div class="soul-card-subtitle">${escHtml(v.subtitulo)}</div>
                <div class="soul-card-desc">${escHtml(v.descricao)}</div>
                <div class="soul-card-recupera">
                    <strong>🔄 Recupera Energia quando:</strong>
                    ${escHtml(v.recupera)}
                </div>
            </div>
        `;
    }
    html += `</div></div>`;

    // Memória virtude
    html += createMemoryBox('alma_virtude', 'Descreva o momento em que essa Virtude salvou você — ou salvou alguém por sua causa.', false, '✍️ Memória da Virtude');

    // Separador
    html += `<hr style="border:none;border-top:2px solid var(--soft);margin:30px 0;">`;

    // Vícios
    html += `
        <div class="section">
            <div class="section-title">🔥 Escolha seu Vício</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                O vício é a fraqueza que habita seu coração.
                Quando ceder a ele com consequências reais, você recupera Energia.
            </p>
            <div class="selection-grid" id="viceGrid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
    `;

    for (const v of VICIOS) {
        const isSelected = wizardState.vicioSelecionado === v.id;
        const sel = isSelected ? 'selected expanded' : '';
        html += `
            <div class="soul-card ${sel}" data-vice="${v.id}" onclick="selectVice('${v.id}')">
                <div class="soul-card-header">
                    <span class="soul-card-icon">${v.icone}</span>
                    <span class="soul-card-name">${escHtml(v.nome)}</span>
                </div>
                <div class="soul-card-subtitle">${escHtml(v.subtitulo)}</div>
                <div class="soul-card-desc">${escHtml(v.descricao)}</div>
                <div class="soul-card-recupera">
                    <strong>🔄 Recupera 1 Energia quando:</strong>
                    ${escHtml(v.recupera)}
                </div>
            </div>
        `;
    }
    html += `</div></div>`;

    // Memória vício
    html += createMemoryBox('alma_vicio', 'Descreva o momento em que seu Vício te dominou. O que você perdeu por causa dele?', false, '✍️ Memória do Vicio');

    // Opcional
    html += createMemoryBox('alma_adicional', 'Sonho ou Pesadelo — Qual sonho recorrente te persegue? Ou qual pesadelo?', true);

    container.innerHTML = html;
}

function selectVirtue(virtueId) {
    const isSame = wizardState.virtudeSelecionada === virtueId;
    wizardState.virtudeSelecionada = virtueId;

    document.querySelectorAll('#virtueGrid .soul-card').forEach(c => {
        const isThis = c.dataset.virtue === virtueId;
        c.classList.toggle('selected', isThis);
        
        if (isThis) {
            if (isSame) {
                c.classList.toggle('expanded');
            } else {
                c.classList.add('expanded');
            }
        } else {
            c.classList.remove('expanded');
        }
    });

    saveWizardToStorage();
}

function selectVice(viceId) {
    const isSame = wizardState.vicioSelecionado === viceId;
    wizardState.vicioSelecionado = viceId;

    document.querySelectorAll('#viceGrid .soul-card').forEach(c => {
        const isThis = c.dataset.vice === viceId;
        c.classList.toggle('selected', isThis);

        if (isThis) {
            if (isSame) {
                c.classList.toggle('expanded');
            } else {
                c.classList.add('expanded');
            }
        } else {
            c.classList.remove('expanded');
        }
    });

    saveWizardToStorage();
}
