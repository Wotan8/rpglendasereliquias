/* ===== APP.JS — Inicialização e Navegação do Wizard ===== */

let _wizardInitialized = false;

/** Chamada após dados do Firebase carregados */
window.initWizard = function () {
    if (_wizardInitialized) return;
    _wizardInitialized = true;

    console.log('🧙 Iniciando Wizard de Criação...');

    // Check for saved state
    if (hasWizardSave()) {
        if (confirm('📂 Encontramos um personagem em progresso. Deseja continuar de onde parou?')) {
            loadWizardFromStorage();
        } else {
            clearWizardStorage();
            // Preserve mesaVinculada (set from URL param before initWizard)
            const savedMesa = wizardState.mesaVinculada;
            const savedMesaExp = wizardState.expInicial;
            resetWizardState();
            if (savedMesa) {
                wizardState.mesaVinculada = savedMesa;
                wizardState.expInicial = savedMesaExp;
            }
        }
    }

    // If mesa is linked (from URL), ensure EXP is registered
    if (wizardState.mesaVinculada) {
        ExpTracker.addSource('exp_inicial', wizardState.mesaVinculada.expInicial ?? 100, 'EXP Inicial (Mesa)');
        if (wizardState.mesaVinculada.sessaoAtual > 0) {
            ExpTracker.addSource('exp_sessao', wizardState.mesaVinculada.sessaoAtual, 'Nível da sessão da mesa');
        }
    }

    // Initialize EXP display
    ExpTracker.updateDisplay();

    // Build progress bar
    buildProgressBar();

    // Render current phase
    goToPhase(wizardState.faseAtual || 0);

    // Hide loading, show content
    const loading = document.getElementById('loadingScreen');
    const toolbar = document.querySelector('.toolbar');
    const wrap = document.querySelector('.wrap');
    const footer = document.querySelector('.wizard-footer');

    if (loading) loading.style.display = 'none';
    if (toolbar) toolbar.style.display = '';
    if (wrap) wrap.style.display = '';
    if (footer) footer.style.display = '';

    const expDisplay = document.getElementById('expDisplay');
    if (expDisplay) expDisplay.style.display = '';

    // Re-apply EXP sources from restored state
    if (wizardState.expSources && Object.keys(wizardState.expSources).length > 0) {
        ExpTracker.updateDisplay();
    }
};

function resetWizardState() {
    wizardState.nomePersonagem = '';
    wizardState.nivelInicio = null;
    wizardState.expInicial = 0;
    wizardState.expVip = 0;
    wizardState.itensRepertorioSelecionados = [];
    wizardState.mesaVinculada = null;
    wizardState.racaSelecionada = null;
    wizardState.classeSelecionada = null;
    wizardState.triboSelecionada = null;
    wizardState.peculiaridadesIndividuais = [];
    wizardState.grupoPrimario = null;
    wizardState.grupoFraco = null;
    wizardState.atributos = {
        attr_int: 0, attr_rac: 0, attr_prs: 0,
        attr_for: 0, attr_des: 0, attr_vig: 0,
        attr_pre: 0, attr_man: 0, attr_aut: 0
    };
    wizardState.grupoPericiaPrimario = null;
    wizardState.pericias = {};
    wizardState.virtudeSelecionada = null;
    wizardState.vicioSelecionado = null;
    wizardState.npcs = [];
    wizardState.kitInicialSelecionado = null;
    wizardState.equipamentoSelecionado = [];
    wizardState.luns = 0;
    wizardState.objetoPessoal = null;
    wizardState.nomeCompleto = '';
    wizardState.aparencia = '';
    wizardState.imagemPersonagem = null;
    wizardState.motivacao = '';
    wizardState.medo = '';
    wizardState.ultimaPergunta = '';
    wizardState.memorias = {};
    wizardState.faseAtual = 0;
    wizardState.fasesCompletas = new Set();
    wizardState.expSources = {};
}

/* ===== PROGRESS BAR ===== */

function buildProgressBar() {
    const bar = document.getElementById('progressBar');
    if (!bar) return;

    bar.innerHTML = '';
    FASES_WIZARD.forEach((fase, idx) => {
        if (idx > 0) {
            const line = document.createElement('div');
            line.className = 'wizard-step-line';
            line.id = `stepLine${idx}`;
            bar.appendChild(line);
        }

        const step = document.createElement('div');
        step.className = 'wizard-step';
        step.id = `step${idx}`;
        step.onclick = () => tryGoToPhase(idx);

        step.innerHTML = `
            <div class="wizard-step-dot">${fase.icon}</div>
            <div class="wizard-step-label">${fase.titulo}</div>
        `;
        bar.appendChild(step);
    });

    updateProgressBar();
}

function updateProgressBar() {
    FASES_WIZARD.forEach((fase, idx) => {
        const step = document.getElementById(`step${idx}`);
        const line = document.getElementById(`stepLine${idx}`);
        if (!step) return;

        step.classList.remove('active', 'completed', 'locked');

        if (idx === wizardState.faseAtual) {
            step.classList.add('active');
        } else if (wizardState.fasesCompletas.has(idx)) {
            step.classList.add('completed');
        }

        if (line) {
            line.classList.toggle('completed', wizardState.fasesCompletas.has(idx - 1));
        }
    });

    // Update navigation buttons
    updateNavButtons();
}

/* ===== NAVIGATION ===== */

function goToPhase(index) {
    if (index < 0 || index >= FASES_WIZARD.length) return;

    // Hide all phases
    document.querySelectorAll('.phase-container').forEach(el => el.classList.remove('active'));

    // Show target phase
    const target = document.getElementById(`phase${index}`);
    if (target) {
        target.classList.add('active');
        
        // Auto re-render dynamic phases to guarantee they use the latest state from previous phases
        const fase = FASES_WIZARD[index];
        if (fase && ['corpo', 'habilidades', 'vespera', 'resumo'].includes(fase.key)) {
            target.dataset.rendered = '';
            target.innerHTML = '';
        }
    }

    wizardState.faseAtual = index;
    updateProgressBar();
    updateMiniPreview();

    // Render phase content
    renderPhase(index);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-save
    saveWizardToStorage();
}

function tryGoToPhase(index) {
    // Navegação livre permitida
    goToPhase(index);
}

function goNext() {
    const current = wizardState.faseAtual;

    // If on the last phase (resumo), trigger character creation
    if (current === FASES_WIZARD.length - 1) {
        if (typeof createCharacter === 'function') createCharacter();
        return;
    }

    // Check validity just to mark visually as complete, but don't block navigation
    const result = validatePhase(current);
    if (result.valid) {
        setPhaseComplete(current);
    } else {
        wizardState.fasesCompletas.delete(current);
        updateProgressBar();
    }

    if (current + 1 < FASES_WIZARD.length) {
        goToPhase(current + 1);
    }
}

function goBack() {
    if (wizardState.faseAtual > 0) {
        goToPhase(wizardState.faseAtual - 1);
    }
}

function updateNavButtons() {
    const btnBack = document.getElementById('btnBack');
    const btnNext = document.getElementById('btnNext');
    const footerInfo = document.getElementById('footerInfo');

    if (btnBack) {
        btnBack.disabled = wizardState.faseAtual === 0;
    }

    if (btnNext) {
        const isLast = wizardState.faseAtual === FASES_WIZARD.length - 1;
        btnNext.textContent = isLast ? '🎉 Criar Personagem' : 'Avançar →';
        if (isLast) {
            btnNext.className = 'btn btn-success';
        } else {
            btnNext.className = 'btn btn-primary';
        }
    }

    if (footerInfo) {
        const fase = FASES_WIZARD[wizardState.faseAtual];
        footerInfo.textContent = fase ? `${fase.icon} ${fase.titulo}` : '';
    }
}

/* ===== RENDER PHASE ===== */

function renderPhase(index) {
    const fase = FASES_WIZARD[index];
    if (!fase) return;

    const container = document.getElementById(`phase${index}`);
    if (!container) return;

    // Only render if empty (avoid re-rendering)
    if (container.dataset.rendered === 'true') return;

    switch (fase.key) {
        case 'convite':     renderPhase0(container); break;
        case 'linhagem':    renderPhase1(container); break;
        case 'origens':     renderPhase2(container); break;
        case 'peculiaridades': renderPhase2B(container); break;
        case 'corpo':       renderPhase3(container); break;
        case 'habilidades': renderPhase4(container); break;
        case 'alma':        renderPhase5(container); break;
        case 'lacos':       renderPhase6(container); break;
        case 'equipamento': renderPhase7(container); break;
        case 'vespera':     renderPhase8(container); break;
        case 'resumo':      renderResumo(container); break;
    }

    container.dataset.rendered = 'true';

    // Inject inline name field at the top of phases 1+ (if not phase 0 or resumo)
    if (index >= 1 && fase.key !== 'resumo') {
        injectInlineNameField(container);
    }
}

/** Forces a phase to re-render (e.g., after going back and changing something) */
function forceRerender(index) {
    const container = document.getElementById(`phase${index}`);
    if (container) {
        container.dataset.rendered = '';
        container.innerHTML = '';
        renderPhase(index);
    }
}

/* ===== MINI PREVIEW ===== */

function updateMiniPreview() {
    const el = document.getElementById('miniPreview');
    if (!el) return;

    const parts = [];
    if (wizardState.nomePersonagem) parts.push(wizardState.nomePersonagem);
    if (wizardState.racaSelecionada) parts.push(wizardState.racaSelecionada);
    if (wizardState.classeSelecionada) parts.push(wizardState.classeSelecionada);
    if (wizardState.triboSelecionada) parts.push(wizardState.triboSelecionada);

    if (parts.length === 0) {
        el.style.display = 'none';
        return;
    }

    el.style.display = '';
    const name = parts[0];
    const details = parts.slice(1).join(' · ');
    el.innerHTML = `
        <span class="mini-preview-name">${escHtml(name)}</span>
        ${details ? `<span class="mini-preview-detail">${escHtml(details)}</span>` : ''}
    `;
}

/* ===== TOAST ===== */

function showWizardToast(message, type) {
    const existing = document.querySelector('.wizard-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `wizard-toast wizard-toast-${type || 'info'}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 10000; padding: 12px 24px; border-radius: 10px;
        font-family: var(--font); font-weight: 700; font-size: .9rem;
        animation: phaseIn .3s ease-out;
        ${type === 'error' ? 'background:#ef4444;color:#fff;' : 
          type === 'success' ? 'background:#10b981;color:#fff;' :
          'background:var(--accent);color:#fff;'}
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity .3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ===== UTILITY ===== */

function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function createNarratorBox(text) {
    return `
        <div class="narrator-box">
            <div class="narrator-icon">🎭</div>
            <div class="narrator-text">${escHtml(text)}</div>
        </div>
    `;
}

function createMemoryBox(phaseKey, placeholder, optional, customTitle) {
    const saved = MemoryManager.get(phaseKey);
    const label = customTitle || (optional ? '✍ Memória Adicional' : '✍️ Memória');
    return `
        <div class="memory-box ${optional ? 'optional' : ''}">
            <div class="memory-box-label">
                ${label}
            </div>
            <textarea
                id="memory_${phaseKey}"
                placeholder="${escHtml(placeholder)}"
                oninput="MemoryManager.set('${phaseKey}', this.value)"
            >${escHtml(saved)}</textarea>
        </div>
    `;
}

/** Inject an inline name field at the top of a phase container */
function injectInlineNameField(container) {
    // Don't double-inject
    if (container.querySelector('.inline-name-field')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-name-field';
    wrapper.innerHTML = `
        <div class="inline-name-inner">
            <label class="inline-name-label">🏷️ Nome do Personagem</label>
            <input type="text" class="inline-name-input" id="inlineName_${container.id}"
                placeholder="Digite o nome do seu personagem..."
                value="${escHtml(wizardState.nomePersonagem)}"
                oninput="wizardState.nomePersonagem = this.value; syncAllNameFields(); updateMiniPreview(); saveWizardToStorage();">
        </div>
    `;
    container.insertBefore(wrapper, container.firstChild);
}

/** Keep all inline name fields in sync */
function syncAllNameFields() {
    document.querySelectorAll('.inline-name-input').forEach(input => {
        if (input.value !== wizardState.nomePersonagem) {
            input.value = wizardState.nomePersonagem;
        }
    });
    // Also sync the phase 0 name field if present
    const phase0Input = document.getElementById('inputNome');
    if (phase0Input && phase0Input.value !== wizardState.nomePersonagem) {
        phase0Input.value = wizardState.nomePersonagem;
    }
}

/* ===== PHASE 0 — O Convite (Reestruturado) ===== */

function renderPhase0(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.convite);

    // Nome do personagem — opcional
    html += `
        <div class="section">
            <div class="section-title">Seu Nome</div>
            <div class="field">
                <label>Como deseja ser chamado? <span style="font-size:.78rem;color:var(--muted);font-weight:400;">(pode preencher depois)</span></label>
                <input type="text" id="inputNome" placeholder="Digite o nome do seu personagem"
                    value="${escHtml(wizardState.nomePersonagem)}"
                    oninput="wizardState.nomePersonagem = this.value; syncAllNameFields(); updateMiniPreview(); saveWizardToStorage();">
            </div>
        </div>
    `;

    // EXP Inicial — manual ou da mesa
    const mesaExp = wizardState.mesaVinculada?.expInicial;
    const expValue = mesaExp != null ? mesaExp : (wizardState.expInicial || 0);
    const expReadonly = mesaExp != null ? 'readonly' : '';
    const expLabel = mesaExp != null
        ? `EXP Inicial <span style="font-size:.78rem;color:var(--muted);">(definido pelo Mestre — ${escHtml(wizardState.mesaVinculada.mestreNome || 'Mesa')})</span>`
        : `EXP Inicial <span style="font-size:.78rem;color:var(--muted);">(definido pelo Mestre)</span>`;

    html += `
        <div class="section">
            <div class="section-title">⭐ Experiência Inicial</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                A quantidade de EXP inicial determina quão experiente seu personagem é ao começar.
                Se você está criando para uma mesa, o Mestre define esse valor.
            </p>
            <div class="field">
                <label>${expLabel}</label>
                <input type="number" id="inputExpInicial" min="0" step="1"
                    value="${expValue}" ${expReadonly}
                    placeholder="0"
                    style="max-width:200px;font-size:1.2rem;font-weight:900;text-align:center;"
                    oninput="setExpInicial(parseInt(this.value) || 0)">
            </div>
        </div>
    `;

    // Introdução à Campanha / Vasteluna
    const introText = wizardState.mesaVinculada?.introducao || VASTELUNA_INTRO;
    const introTitle = wizardState.mesaVinculada
        ? `🎭 ${escHtml(wizardState.mesaVinculada.nome)} — Introdução`
        : '🌍 Bem-vindo a Vasteluna';

    html += `
        <div class="section">
            <div class="section-title">${introTitle}</div>
            <div class="campaign-intro">
                ${escHtml(introText).replace(/\n/g, '<br>')}
            </div>
        </div>
    `;

    // Itens de Repertório
    html += `
        <div class="section">
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>🎒 Itens de Repertório</span>
                <button class="btn btn-secondary" onclick="openRepertorioModal()" style="padding: 6px 12px; font-size: 0.85rem;">Adicionar Repertório</button>
            </div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Você pode consumir Itens de Repertório da sua conta (como consumíveis de EXP ou Pacotes Especiais) para iniciar com vantagens.
            </p>
            <div id="repertorioSelecionadoContainer">
                <!-- Preenchido via JS se houver itens -->
            </div>
        </div>
    `;

    // SEM memória na Etapa 0

    container.innerHTML = html;
    
    // Atualizar UI dos itens de repertório
    renderRepertorioSelecionado();
}

function renderRepertorioSelecionado() {
    const container = document.getElementById('repertorioSelecionadoContainer');
    if (!container) return;

    const itens = wizardState.itensRepertorioSelecionados || [];
    if (itens.length === 0) {
        container.innerHTML = '<div style="color:var(--muted); font-size:0.85rem; font-style:italic;">Nenhum item selecionado.</div>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    itens.forEach((item, idx) => {
        let tagHtml = '';
        if (item.isExp) tagHtml += `<span style="background:var(--primary);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:8px;">+${item.expAmount * item.quantidadeConsumida} EXP${item.isExpVip ? ' (VIP)' : ''}</span>`;
        if (item.isItemPersonagem && item.personagemItensVinculados?.length) tagHtml += `<span style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:8px;">🎒 Equipamentos: ${item.personagemItensVinculados.length}</span>`;

        html += `
            <div style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-weight:bold; font-size:0.9rem;">${item.quantidadeConsumida}x ${escHtml(item.nome)}</span>
                    ${tagHtml}
                </div>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="removeRepertorioSelecionado(${idx})">Remover</button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

window.openRepertorioModal = async function() {
    if (!window.currentUser) {
        showWizardToast('Você precisa estar logado para acessar o repertório.', 'error');
        return;
    }

    const modalExistente = document.getElementById('wizardRepertorioModal');
    if (modalExistente) modalExistente.remove();

    const modalHtml = `
        <div id="wizardRepertorioModal" class="modal active" style="z-index: 10000; position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center;">
            <div class="modal-content" style="background:var(--paper); border:1px solid var(--soft); border-radius:12px; max-width:500px; width:90%; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div class="modal-header" style="padding:16px; border-bottom:1px solid var(--soft); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem; color:var(--ink);">🎒 Seu Repertório</h3>
                    <button class="btn" style="background:transparent; border:none; color:var(--muted); font-size:1.2rem; cursor:pointer;" onclick="document.getElementById('wizardRepertorioModal').remove()">✕</button>
                </div>
                <div class="modal-body" id="wizardRepertorioBody" style="padding:16px; overflow-y:auto; flex:1;">
                    <div style="text-align:center; padding:20px; color:var(--muted);">Carregando itens...</div>
                </div>
                <div class="modal-footer" style="padding:16px; border-top:1px solid var(--soft); display:flex; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="document.getElementById('wizardRepertorioModal').remove()">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    try {
        const inventario = await window.getUserInventory(window.currentUser.uid);
        const body = document.getElementById('wizardRepertorioBody');
        
        // Filtrar roleta, rerolagem e narrativo
        const itensValidos = inventario.map((item, idx) => ({...item, originalIndex: idx}))
            .filter(item => !item.isRoleta && !item.isRerolagem && !item.isNarrativo);

        if (itensValidos.length === 0) {
            body.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">Você não possui itens consumíveis no repertório.</div>';
            return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
        
        itensValidos.forEach(item => {
            // Checar quantos já foram selecionados
            const selItem = (wizardState.itensRepertorioSelecionados || []).find(i => i.originalIndex === item.originalIndex);
            const qtdSelecionada = selItem ? selItem.quantidadeConsumida : 0;
            const qtdDisponivel = item.quantidade - qtdSelecionada;

            if (qtdDisponivel <= 0) return; // Pula se já consumiu tudo

            let descHtml = item.descricao ? `<div style="font-size:0.8rem; color:var(--muted); margin-bottom:8px;">${escHtml(item.descricao)}</div>` : '';
            
            let tagsHtml = '';
            if (item.isExp) tagsHtml += `<span style="background:var(--primary);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-right:4px;">⭐ +${item.expAmount} EXP${item.isExpVip ? ' (VIP)' : ''}</span>`;
            if (item.personagemItensVinculados?.length > 0) tagsHtml += `<span style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">🎒 Equipamentos Especiais</span>`;

            html += `
                <div style="background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                        <div style="font-weight:bold; color:var(--light); font-size:1rem;">${escHtml(item.nome)} <span style="color:var(--muted); font-size:0.8rem;">(Possui: ${qtdDisponivel})</span></div>
                    </div>
                    ${descHtml}
                    <div style="margin-bottom:12px;">${tagsHtml}</div>
                    
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="qtd_repertorio_${item.originalIndex}" value="1" min="1" max="${qtdDisponivel}" class="form-input" style="width:70px; padding:6px; text-align:center;">
                        <button class="btn btn-success" style="padding:6px 16px; font-size:0.85rem;" onclick="addRepertorioSelecionado(${item.originalIndex})">Adicionar</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        
        if (html === '<div style="display:flex; flex-direction:column; gap:12px;"></div>') {
            body.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">Você não possui mais itens disponíveis para seleção.</div>';
        } else {
            body.innerHTML = html;
        }

    } catch (err) {
        document.getElementById('wizardRepertorioBody').innerHTML = '<div style="color:var(--danger); padding:20px;">Erro ao carregar repertório.</div>';
    }
};

window.addRepertorioSelecionado = async function(originalIndex) {
    try {
        if (!window.currentUser) return;
        
        const inventario = await window.getUserInventory(window.currentUser.uid);
        let item = inventario[originalIndex];
        
        // --- ENRIQUECIMENTO DE DADOS PARA ITENS ANTIGOS ---
        // Se o item veio quebrado do banco (sem as props de sistema), buscar a fonte na Loja
        if (item && item.nome && item.isExp === undefined && item.isItemPersonagem === undefined) {
            try {
                showWizardToast('Sincronizando item com o servidor...', 'info');
                const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const lojaRef = collection(window.db, 'loja');
                const q = query(lojaRef, where('nome', '==', item.nome));
                const lojaSnap = await getDocs(q);
                
                if (!lojaSnap.empty) {
                    const lojaData = lojaSnap.docs[0].data();
                    if (lojaData.isExp !== undefined) item.isExp = lojaData.isExp;
                    if (lojaData.expAmount !== undefined) item.expAmount = lojaData.expAmount;
                    if (lojaData.isExpVip !== undefined) item.isExpVip = lojaData.isExpVip;
                    if (lojaData.isItemPersonagem !== undefined) item.isItemPersonagem = lojaData.isItemPersonagem;
                    if (lojaData.personagemItensVinculados !== undefined) item.personagemItensVinculados = lojaData.personagemItensVinculados;
                    console.log('✅ Item enriquecido com dados da loja:', item);
                }
            } catch (e) {
                console.warn('Erro ao tentar enriquecer item do repertório:', e);
            }
        }
        
        const maxQtd = item.quantidade || 1;
        const input = document.getElementById(`qtd_repertorio_${originalIndex}`);
        const qtdStr = input ? input.value : '1';
        const qtdToConsume = parseInt(qtdStr, 10);

        if (isNaN(qtdToConsume) || qtdToConsume <= 0) return;

        wizardState.itensRepertorioSelecionados = wizardState.itensRepertorioSelecionados || [];
        
        let existing = wizardState.itensRepertorioSelecionados.find(i => i.originalIndex === originalIndex);
        
        if (existing) {
            if (existing.quantidadeConsumida + qtdToConsume > item.quantidade) {
                showWizardToast('Quantidade insuficiente no repertório.', 'error');
                return;
            }
            existing.quantidadeConsumida += qtdToConsume;
        } else {
            if (qtdToConsume > item.quantidade) {
                showWizardToast('Quantidade insuficiente no repertório.', 'error');
                return;
            }
            wizardState.itensRepertorioSelecionados.push({
                ...item,
                originalIndex: originalIndex,
                quantidadeConsumida: qtdToConsume
            });
        }

        window.updateRepertorioExpTracker();
        saveWizardToStorage();
        document.getElementById('wizardRepertorioModal').remove();
        renderRepertorioSelecionado();
        showWizardToast('Item adicionado!', 'success');
        
    } catch (e) {
        console.error(e);
        showWizardToast('Erro ao processar item.', 'error');
    }
};

window.removeRepertorioSelecionado = function(idx) {
    if (!wizardState.itensRepertorioSelecionados || !wizardState.itensRepertorioSelecionados[idx]) return;
    
    wizardState.itensRepertorioSelecionados.splice(idx, 1);
    
    window.updateRepertorioExpTracker();
    saveWizardToStorage();
    renderRepertorioSelecionado();
};

window.updateRepertorioExpTracker = function() {
    wizardState.expVip = 0;
    
    // Rastrear todas as sources de repertório ativas
    const activeSources = [];
    
    (wizardState.itensRepertorioSelecionados || []).forEach(item => {
        if (item.isExp) {
            const amount = parseFloat(item.expAmount) || 0;
            const expTotalAdicionada = amount * item.quantidadeConsumida;
            const sourceId = `repertorio_${item.originalIndex}`;
            
            ExpTracker.addSource(sourceId, expTotalAdicionada, `Item: ${item.nome}`);
            activeSources.push(sourceId);
            
            if (item.isExpVip) {
                wizardState.expVip += expTotalAdicionada;
            }
        }
    });
    
    // Remover sources que não estão mais na lista de selecionados
    for (const key in wizardState.expSources) {
        if (key.startsWith('repertorio_') && !activeSources.includes(key)) {
            ExpTracker.removeSource(key);
        }
    }
};

function setExpInicial(value) {
    wizardState.expInicial = value;
    ExpTracker.addSource('exp_inicial', value, 'EXP Inicial');
    saveWizardToStorage();
}

// Legacy compat — keep selectNivel working if called
function selectNivel(nivelId) {
    const nivel = NIVEIS_INICIO.find(n => n.id === nivelId);
    if (!nivel) return;
    wizardState.nivelInicio = nivel;
    wizardState.expInicial = nivel.exp;
    ExpTracker.addSource('exp_inicial', nivel.exp, `Nível: ${nivel.nome}`);
    saveWizardToStorage();
}

/* ===== PHASE STUBS (will be implemented in modules) ===== */

function renderPhase1(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 1...</p>'; if (typeof initPhase1 === 'function') initPhase1(c); }
function renderPhase2(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 2...</p>'; if (typeof initPhase2 === 'function') initPhase2(c); }
function renderPhase2B(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 2B...</p>'; if (typeof initPhase2B === 'function') initPhase2B(c); }
function renderPhase3(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 3...</p>'; if (typeof initPhase3 === 'function') initPhase3(c); }
function renderPhase4(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 4...</p>'; if (typeof initPhase4 === 'function') initPhase4(c); }
function renderPhase5(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 5...</p>'; if (typeof initPhase5 === 'function') initPhase5(c); }
function renderPhase6(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 6...</p>'; if (typeof initPhase6 === 'function') initPhase6(c); }
function renderPhase7(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 7...</p>'; if (typeof initPhase7 === 'function') initPhase7(c); }
function renderPhase8(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Fase 8...</p>'; if (typeof initPhase8 === 'function') initPhase8(c); }
function renderResumo(c) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px;">Carregando Resumo...</p>'; if (typeof initResumo === 'function') initResumo(c); }

/* ===== DOMContentLoaded fallback ===== */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!_wizardInitialized) {
            console.log('⚠️ Firebase não detectado, tentando inicializar offline...');
            window.initWizard();
        }
    }, 2000);
});
