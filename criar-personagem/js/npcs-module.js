/* ===== PHASE 6 — Os Laços (NPCs) ===== */

function initPhase6(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.lacos);

    const regras = REGRAS_CRIACAO.npcs;

    html += `
        <div class="section">
            <div class="section-title">🤝 Personagens Importantes</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                <strong>Opcional.</strong> Cada NPC criado concede <strong>+${regras.exp_por_npc} EXP</strong> (máx ${regras.max_exp_npcs}).
                Criar NPCs enriquece sua história e dá ferramentas ao Narrador.
            </p>
            <div id="npcExpIndicator" style="font-size:.85rem;font-weight:700;color:var(--accent);margin-bottom:12px;">
                EXP de NPCs: 0/${regras.max_exp_npcs}
            </div>
            <div id="npcList"></div>
            <button class="btn" onclick="addNpc()" style="margin-top:8px;">
                ➕ Adicionar NPC
            </button>
        </div>
    `;

    // Memória opcional
    html += createMemoryBox('lacos_promessa', 'A Promessa — Você fez uma promessa a alguém? Se sim, qual foi? Você pretende cumpri-la? Se não fez, pode seguir em frente.', true);

    container.innerHTML = html;
    renderNpcList();
    updateNpcExpDisplay();
}

function addNpc() {
    if (wizardState.npcs.length > 0) {
        const lastNpc = wizardState.npcs[wizardState.npcs.length - 1];
        if (!lastNpc.confirmado) {
            showWizardToast('Preencha e crie o NPC atual antes de adicionar outro.', 'error');
            return;
        }
    }

    wizardState.npcs.push({
        nome: '',
        relacao: '',
        memoria: '',
        vinculo: '',
        confirmado: false
    });
    renderNpcList();
    saveWizardToStorage();
}

function removeNpc(index) {
    wizardState.npcs.splice(index, 1);
    renderNpcList();
    updateNpcExp();
    saveWizardToStorage();
}

function isNpcComplete(npc) {
    return npc.nome && npc.nome.trim() &&
           npc.relacao && npc.relacao.trim() &&
           npc.memoria && npc.memoria.trim() &&
           npc.vinculo && npc.vinculo.trim();
}

/* Destrava um NPC já criado para correção. O EXP volta a ser recontado —
   enquanto estiver em edição ele não conta, como qualquer NPC incompleto. */
function editNpc(index) {
    wizardState.npcs[index].confirmado = false;
    renderNpcList();
    updateNpcExp();
    saveWizardToStorage();
}

function confirmNpc(index) {
    const npc = wizardState.npcs[index];
    if (!isNpcComplete(npc)) {
        showWizardToast('Preencha todos os campos do NPC antes de criar.', 'error');
        return;
    }
    npc.confirmado = true;
    renderNpcList();
    updateNpcExp();
    saveWizardToStorage();
}

function renderNpcList() {
    const container = document.getElementById('npcList');
    if (!container) return;

    if (wizardState.npcs.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:var(--muted);font-size:.85rem;padding:16px;">Nenhum NPC criado ainda. Clique em "Adicionar NPC" para começar.</p>`;
        return;
    }

    let html = '';
    wizardState.npcs.forEach((npc, idx) => {
        const complete = isNpcComplete(npc);
        const confirmed = npc.confirmado === true;

        html += `
            <div class="npc-card" style="${confirmed ? 'border-color:var(--success);opacity:0.9;' : ''}">
                <button class="npc-card-remove" onclick="removeNpc(${idx})" title="Remover NPC">🗑️</button>
                ${confirmed ? '<div style="position:absolute;top:8px;left:12px;font-size:.75rem;font-weight:800;color:var(--success);">✅ CRIADO</div>' : ''}
                <div class="row" style="margin-bottom:8px;">
                    <div class="field">
                        <label>Nome do NPC</label>
                        <input type="text" value="${escHtml(npc.nome)}" placeholder="Nome..."
                            ${confirmed ? 'readonly' : ''}
                            oninput="wizardState.npcs[${idx}].nome = this.value; onNpcFieldChange(${idx}); saveWizardToStorage();">
                    </div>
                    <div class="field">
                        <label>Relação</label>
                        <select ${confirmed ? 'disabled' : ''} onchange="wizardState.npcs[${idx}].relacao = this.value; onNpcFieldChange(${idx}); saveWizardToStorage();">
                            <option value="">Selecione...</option>
                            ${RELACOES_NPC.map(r => `<option value="${escHtml(r)}" ${npc.relacao === r ? 'selected' : ''}>${escHtml(r)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field" style="margin-bottom:8px;">
                    <label>Memória com este NPC</label>
                    <textarea rows="2" placeholder="Uma memória marcante com esta pessoa..."
                        ${confirmed ? 'readonly' : ''}
                        oninput="wizardState.npcs[${idx}].memoria = this.value; onNpcFieldChange(${idx}); saveWizardToStorage();">${escHtml(npc.memoria)}</textarea>
                </div>
                <div class="field" style="margin-bottom:8px;">
                    <label>Pergunta do Vínculo</label>
                    <textarea rows="2" placeholder="O que esta pessoa significa para você?"
                        ${confirmed ? 'readonly' : ''}
                        oninput="wizardState.npcs[${idx}].vinculo = this.value; onNpcFieldChange(${idx}); saveWizardToStorage();">${escHtml(npc.vinculo)}</textarea>
                </div>
                <div style="text-align:right;margin-top:4px;">
                    ${confirmed ? `
                        <button class="btn" onclick="editNpc(${idx})">✏️ Editar NPC</button>
                    ` : `
                        <button class="btn btn-confirm-npc ${complete ? 'btn-success' : ''}"
                                ${!complete ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}
                                onclick="confirmNpc(${idx})">
                            ✅ Criar NPC
                        </button>
                    `}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function onNpcFieldChange(idx) {
    // Update only the confirm button state without re-rendering
    // (re-rendering destroys focus on the active input field)
    const npc = wizardState.npcs[idx];
    const complete = isNpcComplete(npc);
    const cards = document.querySelectorAll('#npcList .npc-card');
    if (cards[idx]) {
        const btn = cards[idx].querySelector('.btn-confirm-npc');
        if (btn) {
            btn.disabled = !complete;
            btn.style.opacity = complete ? '' : '0.5';
            btn.style.cursor = complete ? '' : 'not-allowed';
            if (complete) {
                btn.classList.add('btn-success');
            } else {
                btn.classList.remove('btn-success');
            }
        }
    }
}

function updateNpcExp() {
    const regras = REGRAS_CRIACAO.npcs;
    const confirmedNpcs = wizardState.npcs.filter(n => n.confirmado === true);
    const expCount = Math.min(confirmedNpcs.length, regras.max_exp_npcs);

    if (expCount > 0) {
        ExpTracker.addSource('npcs', expCount * regras.exp_por_npc, `${expCount} NPC(s) criados`);
    } else {
        ExpTracker.removeSource('npcs');
    }

    updateNpcExpDisplay();
}

function updateNpcExpDisplay() {
    const regras = REGRAS_CRIACAO.npcs;
    const confirmedNpcs = wizardState.npcs.filter(n => n.confirmado === true);
    const expCount = Math.min(confirmedNpcs.length, regras.max_exp_npcs);

    const indicator = document.getElementById('npcExpIndicator');
    if (indicator) {
        indicator.textContent = `EXP de NPCs: ${expCount}/${regras.max_exp_npcs}`;
    }
}
