/* ===== PHASE 2B — Peculiaridades Individuais ===== */

function initPhase2B(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.peculiaridades);

    const regras = REGRAS_CRIACAO.peculiaridades_individuais;

    html += `
        <div class="section">
            <div class="section-title">✨ Peculiaridades Individuais</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 8px;">
                Você pode escolher até <strong>${regras.max_positivas_gratis} positivas</strong> e
                <strong>${regras.max_negativas_gratis} negativas</strong> gratuitamente.
                Cada positiva extra custa <strong>${regras.custo_adicional_positiva} EXP</strong>;
                cada negativa extra concede <strong>${regras.ganho_adicional_negativa} EXP</strong>.
            </p>
            <div id="pecCounters" style="display:flex;gap:16px;margin-bottom:12px;">
                <span id="pecPosCounter" class="detail-tag" style="background:rgba(16,185,129,.1);color:var(--success);">✅ Positivas: 0/${regras.max_positivas_gratis}</span>
                <span id="pecNegCounter" class="detail-tag" style="background:rgba(239,68,68,.1);color:var(--danger);">⚠️ Negativas: 0/${regras.max_negativas_gratis}</span>
            </div>
        </div>
    `;

    // Positivas
    const positivas = window.INDIVIDUAL_PECULIARITIES.filter(p => !p.negativo);
    const negativas = window.INDIVIDUAL_PECULIARITIES.filter(p => p.negativo);

    if (positivas.length) {
        html += `<div class="section"><div class="section-title">✅ Peculiaridades Positivas</div>`;
        html += `<div class="selection-grid" id="pecPosGrid">`;
        for (const pec of positivas) {
            const sel = wizardState.peculiaridadesIndividuais.some(p => p.id === pec.id) ? 'selected' : '';
            html += buildPecCard(pec, sel);
        }
        html += `</div></div>`;
    }

    if (negativas.length) {
        html += `<div class="section"><div class="section-title">⚠️ Peculiaridades Negativas</div>`;
        html += `<div class="selection-grid" id="pecNegGrid">`;
        for (const pec of negativas) {
            const sel = wizardState.peculiaridadesIndividuais.some(p => p.id === pec.id) ? 'selected' : '';
            html += buildPecCard(pec, sel);
        }
        html += `</div></div>`;
    }

    if (positivas.length === 0 && negativas.length === 0) {
        html += `<div style="text-align:center;padding:30px;color:var(--muted);">Nenhuma peculiaridade individual encontrada no banco de dados.</div>`;
    }

    // Memória
    html += createMemoryBox('peculiaridades', 'Quando percebeu pela primeira vez que era diferente? O que fez com essa descoberta?', false);

    container.innerHTML = html;
    updatePecCounters();
}

function buildPecCard(pec, selectedClass) {
    // Calculate EXP impact
    let expText = '';
    let expClass = '';
    if (pec.tipo === 'evolutivo' && pec.niveis) {
        const lvl1 = pec.niveis[1];
        if (lvl1) {
            const cost = lvl1.custoExp || 0;
            if (lvl1.tipoExp === 'ganho') {
                expText = `+${cost} EXP`;
                expClass = 'gain';
            } else if (cost > 0) {
                expText = `-${cost} EXP`;
                expClass = 'cost';
            }
        }
    }

    return `
        <div class="pec-card ${pec.negativo ? 'negativo' : 'positivo'} ${selectedClass}"
             data-pec-id="${pec.id}" onclick="togglePeculiarity('${pec.id}')">
            <div class="pec-card-header">
                <span class="pec-card-icon">${pec.icone}</span>
                <span class="pec-card-name">${escHtml(pec.nome)}</span>
                ${expText ? `<span class="pec-card-exp ${expClass}">${expText}</span>` : ''}
            </div>
            <div class="pec-card-desc">${escHtml(pec.descricao || '').substring(0, 150)}${(pec.descricao || '').length > 150 ? '...' : ''}</div>
        </div>
    `;
}

function togglePeculiarity(pecId) {
    const idx = wizardState.peculiaridadesIndividuais.findIndex(p => p.id === pecId);

    if (idx >= 0) {
        // Remove
        wizardState.peculiaridadesIndividuais.splice(idx, 1);
        ExpTracker.removeSource('pec_' + pecId);
    } else {
        // Add
        const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
        if (!pec) return;

        wizardState.peculiaridadesIndividuais.push({ id: pecId, nome: pec.nome, nivel: 1 });

        // Calculate EXP
        const regras = REGRAS_CRIACAO.peculiaridades_individuais;
        const currentPos = wizardState.peculiaridadesIndividuais.filter(p => {
            const full = window.INDIVIDUAL_PECULIARITIES.find(ip => ip.id === p.id);
            return full && !full.negativo;
        }).length;
        const currentNeg = wizardState.peculiaridadesIndividuais.filter(p => {
            const full = window.INDIVIDUAL_PECULIARITIES.find(ip => ip.id === p.id);
            return full && full.negativo;
        }).length;

        if (pec.negativo) {
            // Negatives give EXP (if beyond free limit, give extra)
            if (pec.tipo === 'evolutivo' && pec.niveis?.[1]?.custoExp) {
                ExpTracker.addSource('pec_' + pecId, pec.niveis[1].custoExp, `Peculiaridade: ${pec.nome}`);
            }
            if (currentNeg > regras.max_negativas_gratis) {
                ExpTracker.addSource('pec_extra_' + pecId, regras.ganho_adicional_negativa, `Extra negativa: ${pec.nome}`);
            }
        } else {
            // Positives cost EXP (if beyond free limit, cost extra)
            if (pec.tipo === 'evolutivo' && pec.niveis?.[1]?.custoExp) {
                ExpTracker.addSource('pec_' + pecId, -pec.niveis[1].custoExp, `Peculiaridade: ${pec.nome}`);
            }
            if (currentPos > regras.max_positivas_gratis) {
                ExpTracker.addSource('pec_extra_' + pecId, -regras.custo_adicional_positiva, `Extra positiva: ${pec.nome}`);
            }
        }
    }

    // Update card UI
    document.querySelectorAll(`[data-pec-id="${pecId}"]`).forEach(card => {
        card.classList.toggle('selected', idx < 0);
    });

    updatePecCounters();
    saveWizardToStorage();
}

function updatePecCounters() {
    const posCount = wizardState.peculiaridadesIndividuais.filter(p => {
        const full = window.INDIVIDUAL_PECULIARITIES.find(ip => ip.id === p.id);
        return full && !full.negativo;
    }).length;
    const negCount = wizardState.peculiaridadesIndividuais.filter(p => {
        const full = window.INDIVIDUAL_PECULIARITIES.find(ip => ip.id === p.id);
        return full && full.negativo;
    }).length;

    const regras = REGRAS_CRIACAO.peculiaridades_individuais;
    const posEl = document.getElementById('pecPosCounter');
    const negEl = document.getElementById('pecNegCounter');

    if (posEl) posEl.textContent = `✅ Positivas: ${posCount}/${regras.max_positivas_gratis}${posCount > regras.max_positivas_gratis ? ' (extras custam EXP!)' : ''}`;
    if (negEl) negEl.textContent = `⚠️ Negativas: ${negCount}/${regras.max_negativas_gratis}${negCount > regras.max_negativas_gratis ? ' (extras dão EXP!)' : ''}`;
}
