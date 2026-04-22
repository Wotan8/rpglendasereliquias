/* ===== PHASE 7 — O Equipamento ===== */

function initPhase7(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.equipamento);

    // Equipment from class
    const className = wizardState.classeSelecionada;
    const classData = className ? window._systemData.classes.find(c => c.nome === className) : null;
    const equipList = classData?.equipamentoInicial || classData?.equipInicial || [];

    html += `
        <div class="section">
            <div class="section-title">⚔️ Equipamento Inicial da Classe</div>
    `;

    if (equipList.length > 0) {
        html += `<p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">Marque os itens que deseja levar:</p>`;
        for (const item of equipList) {
            const itemName = typeof item === 'object' ? item.nome : item;
            const checked = wizardState.equipamentoSelecionado.includes(itemName) ? 'checked' : '';
            html += `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.9rem;">
                    <input type="checkbox" ${checked} onchange="toggleEquipItem('${escHtml(itemName)}', this.checked)">
                    <span>${escHtml(itemName)}</span>
                </label>
            `;
        }
    } else {
        html += `<p style="color:var(--muted);font-size:.85rem;">Nenhum equipamento inicial definido para ${escHtml(className || 'esta classe')}. Converse com seu Narrador.</p>`;
    }

    html += `</div>`;

    // Luns (dinheiro)
    html += `
        <div class="section">
            <div class="section-title">💰 Luns Iniciais</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Role 1d10 + 1d10 para determinar seus Luns iniciais.
            </p>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="btn btn-primary" onclick="rollLuns()">🎲 Rolar Luns</button>
                <span id="lunsResult" style="font-size:1.2rem;font-weight:900;color:var(--accent);">
                    ${wizardState.luns > 0 ? `💰 ${wizardState.luns} Luns` : ''}
                </span>
            </div>
        </div>
    `;

    // Objeto Pessoal
    html += `
        <div class="section">
            <div class="section-title">🎒 Objeto Pessoal</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                <strong>Opcional.</strong> Um objeto que não tem preço em ouro. Pode ser um amuleto, uma carta, uma ferramenta velha...
                algo que conta uma história.
            </p>
            <div class="row">
                <div class="field">
                    <label>Nome do Objeto</label>
                    <input type="text" id="objetoNome" placeholder="Ex: Anel da minha avó"
                        value="${escHtml(wizardState.objetoPessoal?.nome || '')}"
                        oninput="updateObjeto()">
                </div>
                <div class="field">
                    <label>Descrição</label>
                    <textarea id="objetoDesc" rows="2" placeholder="O que é? Por que é importante?"
                        oninput="updateObjeto()">${escHtml(wizardState.objetoPessoal?.descricao || '')}</textarea>
                </div>
            </div>
        </div>
    `;

    // Memória condicional ao objeto
    html += createMemoryBox('equipamento_objeto', 'Como este objeto chegou às suas mãos? Quem o possuía antes de você?', true);

    container.innerHTML = html;
}

function toggleEquipItem(itemName, checked) {
    if (checked) {
        if (!wizardState.equipamentoSelecionado.includes(itemName)) {
            wizardState.equipamentoSelecionado.push(itemName);
        }
    } else {
        wizardState.equipamentoSelecionado = wizardState.equipamentoSelecionado.filter(i => i !== itemName);
    }
    saveWizardToStorage();
}

function rollLuns() {
    const d1 = Math.floor(Math.random() * 10) + 1;
    const d2 = Math.floor(Math.random() * 10) + 1;
    wizardState.luns = d1 + d2;

    const el = document.getElementById('lunsResult');
    if (el) {
        el.textContent = `🎲 ${d1} + ${d2} = 💰 ${wizardState.luns} Luns`;
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'phaseIn .3s ease-out';
    }

    saveWizardToStorage();
}

function updateObjeto() {
    const nome = document.getElementById('objetoNome')?.value || '';
    const desc = document.getElementById('objetoDesc')?.value || '';

    if (nome.trim() || desc.trim()) {
        wizardState.objetoPessoal = { nome, descricao: desc };
    } else {
        wizardState.objetoPessoal = null;
    }
    saveWizardToStorage();
}
