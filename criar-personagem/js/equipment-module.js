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

    // Luns (dinheiro) — 1d100
    html += `
        <div class="section">
            <div class="section-title">💰 Luns Iniciais</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Role 1d100 para determinar seus Luns iniciais. Você também pode editar o valor manualmente caso prefira rolar o dado físico.
            </p>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="rollLuns()">🎲 Rolar 1d100</button>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:.9rem;color:var(--muted);">💰</span>
                    <input type="number" id="lunsInput" min="0" max="100"
                        value="${wizardState.luns || ''}"
                        placeholder="0"
                        style="width:80px;font-size:1.2rem;font-weight:900;text-align:center;color:var(--accent);border:2px solid var(--soft);border-radius:8px;padding:6px;background:var(--chip);font-family:var(--font);"
                        oninput="updateLunsManual(this.value)">
                    <span style="font-size:.9rem;font-weight:700;color:var(--accent);">Luns</span>
                </div>
            </div>
            <div id="lunsRollResult" style="font-size:.85rem;color:var(--muted);margin-top:6px;">
                ${wizardState.luns > 0 ? `Resultado: ${wizardState.luns}` : ''}
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
    const result = Math.floor(Math.random() * 100) + 1;
    wizardState.luns = result;

    const input = document.getElementById('lunsInput');
    if (input) {
        input.value = result;
        input.style.animation = 'none';
        void input.offsetWidth;
        input.style.animation = 'phaseIn .3s ease-out';
    }

    const resultEl = document.getElementById('lunsRollResult');
    if (resultEl) {
        resultEl.textContent = `🎲 Resultado: ${result}`;
    }

    saveWizardToStorage();
}

function updateLunsManual(value) {
    const num = parseInt(value) || 0;
    wizardState.luns = num;

    const resultEl = document.getElementById('lunsRollResult');
    if (resultEl) {
        resultEl.textContent = num > 0 ? `Valor definido: ${num}` : '';
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
