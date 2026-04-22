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
            resetWizardState();
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
    wizardState.vicioEspecificacao = '';
    wizardState.npcs = [];
    wizardState.equipamentoSelecionado = [];
    wizardState.luns = 0;
    wizardState.objetoPessoal = null;
    wizardState.nomeCompleto = '';
    wizardState.apelido = '';
    wizardState.aparencia = '';
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
        } else if (idx > wizardState.faseAtual && !wizardState.fasesCompletas.has(idx - 1) && idx !== 0) {
            step.classList.add('locked');
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
    // Can always go back to completed phases
    if (wizardState.fasesCompletas.has(index) || index <= wizardState.faseAtual) {
        goToPhase(index);
        return;
    }
    // Can go forward only if current phase is valid
    if (index === wizardState.faseAtual + 1) {
        goNext();
    }
}

function goNext() {
    const current = wizardState.faseAtual;
    const result = validatePhase(current);

    if (!result.valid) {
        showWizardToast(result.reason, 'error');
        return;
    }

    setPhaseComplete(current);

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

function createMemoryBox(phaseKey, placeholder, optional) {
    const saved = MemoryManager.get(phaseKey);
    return `
        <div class="memory-box ${optional ? 'optional' : ''}">
            <div class="memory-box-label">
                ${optional ? '❓ Memória Opcional' : '✍️ Memória'}
            </div>
            <textarea
                id="memory_${phaseKey}"
                placeholder="${escHtml(placeholder)}"
                oninput="MemoryManager.set('${phaseKey}', this.value)"
            >${escHtml(saved)}</textarea>
        </div>
    `;
}

/* ===== PHASE 0 — O Convite ===== */

function renderPhase0(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.convite);

    // Nome do personagem
    html += `
        <div class="section">
            <div class="section-title">Seu Nome</div>
            <div class="field">
                <label>Como deseja ser chamado?</label>
                <input type="text" id="inputNome" placeholder="Digite o nome do seu personagem"
                    value="${escHtml(wizardState.nomePersonagem)}"
                    oninput="wizardState.nomePersonagem = this.value; updateMiniPreview(); saveWizardToStorage();">
            </div>
        </div>
    `;

    // Nível de início
    html += `
        <div class="section">
            <div class="section-title">Nível de Início</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                O nível de início determina quanta experiência você terá para moldar seu personagem.
                Converse com seu Narrador sobre qual nível usar.
            </p>
            <div class="selection-grid" id="nivelGrid">
    `;

    for (const nivel of NIVEIS_INICIO) {
        const selected = wizardState.nivelInicio?.id === nivel.id ? 'selected' : '';
        html += `
            <div class="selection-card ${selected}" onclick="selectNivel('${nivel.id}')">
                <div class="selection-card-title">⭐ ${escHtml(nivel.nome)}</div>
                <div class="selection-card-subtitle">${nivel.exp} EXP</div>
                <div class="selection-card-desc">${escHtml(nivel.desc)}</div>
            </div>
        `;
    }

    html += `</div></div>`;

    // Memória
    html += createMemoryBox('convite', 'Qual é a sua primeira memória? O que você vê quando fecha os olhos e pensa em "começo"?', false);

    container.innerHTML = html;
}

function selectNivel(nivelId) {
    const nivel = NIVEIS_INICIO.find(n => n.id === nivelId);
    if (!nivel) return;

    wizardState.nivelInicio = nivel;

    // Update EXP
    ExpTracker.addSource('nivel_inicio', nivel.exp, `Nível: ${nivel.nome}`);

    // Update UI
    document.querySelectorAll('#nivelGrid .selection-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

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
