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
    html += createMemoryBox('lacos_promessa', 'A Promessa — Existe uma promessa que fez a alguém antes de partir? O que prometeu?', true);

    container.innerHTML = html;
    renderNpcList();
}

function addNpc() {
    wizardState.npcs.push({
        nome: '',
        relacao: '',
        memoria: '',
        vinculo: ''
    });
    renderNpcList();
    updateNpcExp();
    saveWizardToStorage();
}

function removeNpc(index) {
    wizardState.npcs.splice(index, 1);
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
        html += `
            <div class="npc-card">
                <button class="npc-card-remove" onclick="removeNpc(${idx})" title="Remover NPC">🗑️</button>
                <div class="row" style="margin-bottom:8px;">
                    <div class="field">
                        <label>Nome do NPC</label>
                        <input type="text" value="${escHtml(npc.nome)}" placeholder="Nome..."
                            oninput="wizardState.npcs[${idx}].nome = this.value; saveWizardToStorage();">
                    </div>
                    <div class="field">
                        <label>Relação</label>
                        <select onchange="wizardState.npcs[${idx}].relacao = this.value; saveWizardToStorage();">
                            <option value="">Selecione...</option>
                            ${RELACOES_NPC.map(r => `<option value="${escHtml(r)}" ${npc.relacao === r ? 'selected' : ''}>${escHtml(r)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field" style="margin-bottom:8px;">
                    <label>Memória com este NPC</label>
                    <textarea rows="2" placeholder="Uma memória marcante com esta pessoa..."
                        oninput="wizardState.npcs[${idx}].memoria = this.value; saveWizardToStorage();">${escHtml(npc.memoria)}</textarea>
                </div>
                <div class="field">
                    <label>Pergunta do Vínculo</label>
                    <textarea rows="2" placeholder="O que esta pessoa significava para você antes de partir?"
                        oninput="wizardState.npcs[${idx}].vinculo = this.value; saveWizardToStorage();">${escHtml(npc.vinculo)}</textarea>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function updateNpcExp() {
    const regras = REGRAS_CRIACAO.npcs;
    const validNpcs = wizardState.npcs.filter(n => n.nome && n.nome.trim());
    const expCount = Math.min(validNpcs.length, regras.max_exp_npcs);

    if (expCount > 0) {
        ExpTracker.addSource('npcs', expCount * regras.exp_por_npc, `${expCount} NPC(s) criados`);
    } else {
        ExpTracker.removeSource('npcs');
    }

    const indicator = document.getElementById('npcExpIndicator');
    if (indicator) {
        indicator.textContent = `EXP de NPCs: ${expCount}/${regras.max_exp_npcs}`;
    }
}
