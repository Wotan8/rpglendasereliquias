/* ===== PHASE 8 — A Véspera da Partida ===== */

function initPhase8(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.vespera);

    html += `
        <div class="section">
            <div class="section-title">📝 Identidade Final</div>
            <div class="row" style="margin-bottom:8px;">
                <div class="field">
                    <label>Nome Completo</label>
                    <input type="text" id="nomeCompleto" value="${escHtml(wizardState.nomeCompleto || wizardState.nomePersonagem)}"
                        placeholder="Nome completo do personagem"
                        oninput="wizardState.nomeCompleto = this.value; saveWizardToStorage();">
                </div>
                <div class="field">
                    <label>Apelido (opcional)</label>
                    <input type="text" id="apelido" value="${escHtml(wizardState.apelido)}"
                        placeholder="Como é chamado pelos amigos?"
                        oninput="wizardState.apelido = this.value; saveWizardToStorage();">
                </div>
            </div>
            <div class="field" style="margin-bottom:8px;">
                <label>Aparência</label>
                <textarea id="aparencia" rows="3" placeholder="Descreva a aparência do seu personagem..."
                    oninput="wizardState.aparencia = this.value; saveWizardToStorage();">${escHtml(wizardState.aparencia)}</textarea>
            </div>
        </div>

        <div class="section">
            <div class="section-title">💭 Últimas Reflexões</div>
            <div class="field" style="margin-bottom:8px;">
                <label>Motivação — O que te faz levantar toda manhã?</label>
                <textarea id="motivacao" rows="2" placeholder="Por que você escolheu este caminho?"
                    oninput="wizardState.motivacao = this.value; saveWizardToStorage();">${escHtml(wizardState.motivacao)}</textarea>
            </div>
            <div class="field" style="margin-bottom:8px;">
                <label>Medo — O que te mantém acordado à noite?</label>
                <textarea id="medo" rows="2" placeholder="O que mais te assusta?"
                    oninput="wizardState.medo = this.value; saveWizardToStorage();">${escHtml(wizardState.medo)}</textarea>
            </div>
            <div class="field">
                <label>Última Pergunta — Se soubesse que amanhã morreria, o que faria esta noite?</label>
                <textarea id="ultimaPergunta" rows="2" placeholder="Sua resposta..."
                    oninput="wizardState.ultimaPergunta = this.value; saveWizardToStorage();">${escHtml(wizardState.ultimaPergunta)}</textarea>
            </div>
        </div>
    `;

    // Memória final
    html += createMemoryBox('vespera', 'Na última noite antes de tudo mudar — sozinho com seus pensamentos — o que passa pela sua cabeça?', false);

    container.innerHTML = html;
}

/* ===== PHASE 9 — Resumo Final ===== */

function initResumo(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.resumo);

    const ws = wizardState;

    // === Character Summary ===
    html += `<div class="summary-section">
        <div class="summary-title">📋 Identidade</div>
        <div class="summary-grid">
            <div class="summary-item"><div class="summary-item-label">Nome</div><div class="summary-item-value">${escHtml(ws.nomeCompleto || ws.nomePersonagem)}</div></div>
            <div class="summary-item"><div class="summary-item-label">Raça</div><div class="summary-item-value">${escHtml(ws.racaSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">Classe</div><div class="summary-item-value">${escHtml(ws.classeSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">Tribo</div><div class="summary-item-value">${escHtml(ws.triboSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">Nível</div><div class="summary-item-value">${escHtml(ws.nivelInicio?.nome || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">EXP Total</div><div class="summary-item-value">${ExpTracker.getTotal()}</div></div>
        </div>
    </div>`;

    // Virtude/Vício
    const virtude = VIRTUDES.find(v => v.id === ws.virtudeSelecionada);
    const vicio = VICIOS.find(v => v.id === ws.vicioSelecionado);
    html += `<div class="summary-section">
        <div class="summary-title">💫 Alma</div>
        <div class="summary-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="summary-item"><div class="summary-item-label">Virtude</div><div class="summary-item-value">${virtude ? virtude.icone + ' ' + escHtml(virtude.nome) : '—'}</div></div>
            <div class="summary-item"><div class="summary-item-label">Vício</div><div class="summary-item-value">${vicio ? vicio.icone + ' ' + escHtml(vicio.nome) : '—'}</div></div>
        </div>
    </div>`;

    // Attributes
    html += `<div class="summary-section">
        <div class="summary-title">💪 Atributos</div>
        <div class="summary-grid">`;
    for (const grupo of GRUPOS_ATRIBUTOS) {
        for (const attr of ATRIBUTOS[grupo]) {
            const val = (ws.atributos[attr.key] || 0) + REGRAS_CRIACAO.atributos.base_inicial;
            html += `<div class="summary-item"><div class="summary-item-label">${attr.id}</div><div class="summary-item-value">${val}</div></div>`;
        }
    }
    html += `</div></div>`;

    // Skills (only non-zero)
    const nonZeroSkills = Object.entries(ws.pericias).filter(([k, v]) => v > 0);
    if (nonZeroSkills.length) {
        html += `<div class="summary-section"><div class="summary-title">📚 Perícias</div><div class="summary-grid">`;
        for (const [dotKey, val] of nonZeroSkills) {
            const skKey = dotKey.replace('sk_', '');
            let skName = skKey;
            for (const cat of Object.values(window.SKILLS || {})) {
                const found = cat.find(s => s.key === skKey);
                if (found) { skName = found.name; break; }
            }
            html += `<div class="summary-item"><div class="summary-item-label">${escHtml(skName)}</div><div class="summary-item-value">${val}</div></div>`;
        }
        html += `</div></div>`;
    }

    // Peculiaridades Individuais
    if (ws.peculiaridadesIndividuais.length) {
        html += `<div class="summary-section"><div class="summary-title">✨ Peculiaridades Individuais</div><div class="detail-tag-list">`;
        for (const p of ws.peculiaridadesIndividuais) {
            html += `<span class="detail-tag">${escHtml(p.nome)}</span>`;
        }
        html += `</div></div>`;
    }

    // NPCs
    if (ws.npcs.length) {
        html += `<div class="summary-section"><div class="summary-title">🤝 NPCs</div>`;
        for (const npc of ws.npcs) {
            if (npc.nome) html += `<div class="detail-tag" style="margin-bottom:4px;">${escHtml(npc.nome)} — ${escHtml(npc.relacao || 'Sem relação')}</div>`;
        }
        html += `</div>`;
    }

    // EXP Breakdown
    const breakdown = ExpTracker.getBreakdown();
    if (breakdown.length) {
        html += `<div class="summary-section"><div class="summary-title">⭐ Detalhamento de EXP</div>`;
        html += `<table style="width:100%;font-size:.85rem;border-collapse:collapse;">`;
        for (const src of breakdown) {
            const color = src.amount >= 0 ? 'var(--success)' : 'var(--danger)';
            html += `<tr><td style="padding:4px 0;">${escHtml(src.label)}</td><td style="text-align:right;font-weight:700;color:${color};">${src.amount > 0 ? '+' : ''}${src.amount}</td></tr>`;
        }
        html += `<tr style="border-top:2px solid var(--soft);"><td style="padding:6px 0;font-weight:900;">Total</td><td style="text-align:right;font-weight:900;font-size:1.1rem;">${ExpTracker.getTotal()} EXP</td></tr>`;
        html += `</table></div>`;
    }

    // Memórias status
    const memWritten = MemoryManager.getWrittenCount();
    const memTotal = MemoryManager.getRequiredCount();
    html += `<div class="summary-section"><div class="summary-title">✍️ Memórias</div>
        <p style="font-size:.85rem;color:var(--muted);">
            ${memWritten}/${memTotal} memórias obrigatórias escritas
            ${MemoryManager.hasBonus() ? `— <span style="color:var(--success);font-weight:700;">+${REGRAS_CRIACAO.memorias.exp_bonus_completo} EXP de bônus!</span>` : ''}
        </p>
    </div>`;

    // Create Character Button
    html += `
        <div style="text-align:center;padding:30px 0;">
            <button class="btn btn-success" style="font-size:1.1rem;padding:16px 40px;" onclick="createCharacter()">
                🎉 Criar Personagem
            </button>
            <p style="font-size:.8rem;color:var(--muted);margin-top:8px;">
                Seu personagem será salvo na nuvem e você será redirecionado para a ficha.
            </p>
        </div>
    `;

    container.innerHTML = html;
}

/* ===== CREATE CHARACTER ===== */

async function createCharacter() {
    // Validate all phases
    for (let i = 0; i < FASES_WIZARD.length - 1; i++) { // Skip resumo
        const result = validatePhase(i);
        if (!result.valid) {
            showWizardToast(`Fase "${FASES_WIZARD[i].titulo}" incompleta: ${result.reason}`, 'error');
            return;
        }
    }

    const ws = wizardState;
    const base = REGRAS_CRIACAO.atributos.base_inicial;

    // Build dots object (format compatible with ficha v1.7)
    const dots = {};

    // Attributes
    for (const grupo of GRUPOS_ATRIBUTOS) {
        for (const attr of ATRIBUTOS[grupo]) {
            dots[attr.key] = (ws.atributos[attr.key] || 0) + base;
        }
    }

    // Skills
    for (const [key, val] of Object.entries(ws.pericias)) {
        if (val > 0) dots[key] = val;
    }

    // Peculiarity dots
    for (const pec of ws.peculiaridadesIndividuais) {
        dots['pec_' + pec.id] = pec.nivel || 1;
    }

    // Build fields object
    const fields = {
        nome: ws.nomeCompleto || ws.nomePersonagem,
        apelido: ws.apelido || '',
        raca: ws.racaSelecionada || '',
        classe: ws.classeSelecionada || '',
        tribo: ws.triboSelecionada || '',
        exp_total: ExpTracker.getTotal(),
        aparencia: ws.aparencia || '',
        motivacao: ws.motivacao || '',
        medo: ws.medo || '',
        virtude: ws.virtudeSelecionada || '',
        vicio: ws.vicioSelecionado || '',
        vicioEspecificacao: ws.vicioEspecificacao || '',
        luns: ws.luns || 0,
        sessoes: 0
    };

    // Build notes
    const notes = [];

    // Memories note
    const memoriesNote = MemoryManager.compile(fields.nome);
    if (memoriesNote) notes.push(memoriesNote);

    // NPC notes
    for (const npc of ws.npcs) {
        if (!npc.nome) continue;
        notes.push({
            id: 'note-npc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            titulo: `🤝 ${npc.nome}`,
            conteudo: `<b>Relação:</b> ${npc.relacao || '—'}<br><b>Memória:</b> ${npc.memoria || '—'}<br><b>Vínculo:</b> ${npc.vinculo || '—'}`,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
    }

    // Objeto pessoal note
    if (ws.objetoPessoal?.nome) {
        notes.push({
            id: 'note-objeto-' + Date.now(),
            titulo: `🎒 ${ws.objetoPessoal.nome}`,
            conteudo: ws.objetoPessoal.descricao || 'Objeto pessoal sem descrição.',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
    }

    // Véspera note
    if (ws.motivacao || ws.medo || ws.ultimaPergunta) {
        notes.push({
            id: 'note-vespera-' + Date.now(),
            titulo: '🌅 A Véspera da Partida',
            conteudo: `<b>Motivação:</b> ${ws.motivacao || '—'}<br><b>Medo:</b> ${ws.medo || '—'}<br><b>Última Pergunta:</b> ${ws.ultimaPergunta || '—'}`,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
    }

    // Assemble final charData
    const charData = {
        dots,
        fields,
        notes,
        equipamento: ws.equipamentoSelecionado || [],
        mecanicasAplicadas: {},
        mechanicBonuses: {},
        mecanicasPendentes: [],
        nivelInicio: ws.nivelInicio?.id || 'iniciante'
    };

    // Show saving indicator
    showWizardToast('💾 Salvando personagem...', 'info');

    try {
        if (typeof window.createCharacterInFirebase === 'function') {
            const charId = await window.createCharacterInFirebase(charData);
            showConfetti();
            showWizardToast('🎉 Personagem criado com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = `../ficha-v1.7_1/ficha-v1.7_1.html?id=${charId}`;
            }, 2000);
        } else {
            showWizardToast('❌ Erro: Firebase não disponível.', 'error');
        }
    } catch (e) {
        console.error('Erro ao criar personagem:', e);
        showWizardToast('❌ Erro ao salvar: ' + e.message, 'error');
    }
}

/* ===== CONFETTI ===== */

function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#4f6ef7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 2 + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 5000);
}
