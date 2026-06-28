/* ===== PHASE 8 — A Véspera da Partida ===== */

function initPhase8(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.vespera);

    html += `
        <div class="section">
            <div class="section-title">📝 Identidade Final</div>
            <div class="field" style="margin-bottom:8px;">
                <label>Nome Completo</label>
                <input type="text" id="nomeCompleto" value="${escHtml(wizardState.nomeCompleto || wizardState.nomePersonagem)}"
                    placeholder="Nome do personagem"
                    oninput="wizardState.nomeCompleto = this.value; saveWizardToStorage();">
            </div>
            <div class="field" style="margin-bottom:8px;">
                <label>Aparência</label>
                <textarea id="aparencia" rows="3" placeholder="Descreva a aparência do seu personagem..."
                    oninput="wizardState.aparencia = this.value; saveWizardToStorage();">${escHtml(wizardState.aparencia)}</textarea>
            </div>
            <div class="field" style="margin-bottom:8px;">
                <label>📷 Imagem do Personagem (opcional)</label>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 8px;">Faça upload de uma imagem para o seu personagem. Ela aparecerá na ficha.</p>
                <input type="file" id="charImgUpload" accept="image/*" onchange="handleCharImgUpload(this)"
                    style="font-size:.85rem;font-family:var(--font);">
                <div id="charImgPreviewWrap" style="margin-top:10px;text-align:center;${wizardState.imagemPersonagem ? '' : 'display:none;'}">
                    <img id="charImgPreviewImg" src="${escHtml(wizardState.imagemPersonagem || '')}"
                        style="max-width:200px;max-height:200px;border-radius:12px;border:2px solid var(--soft);object-fit:cover;">
                    <div style="margin-top:6px;">
                        <button class="btn" style="font-size:.75rem;" onclick="removeCharImg()">🗑️ Remover imagem</button>
                    </div>
                </div>
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
                <label>Arrependimento — Do que seu personagem se arrepende?</label>
                <textarea id="ultimaPergunta" rows="2" placeholder="O que te faz querer voltar no tempo?"
                    oninput="wizardState.ultimaPergunta = this.value; saveWizardToStorage();">${escHtml(wizardState.ultimaPergunta)}</textarea>
            </div>
        </div>
    `;

    // Memória final
    html += createMemoryBox('vespera', 'Na última noite antes de tudo mudar — sozinho com seus pensamentos — o que passa pela sua cabeça?', false);

    container.innerHTML = html;
}

function handleCharImgUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
        wizardState.imagemPersonagem = ev.target.result;
        const wrap = document.getElementById('charImgPreviewWrap');
        const img = document.getElementById('charImgPreviewImg');
        if (img) img.src = ev.target.result;
        if (wrap) wrap.style.display = '';
        saveWizardToStorage();
    };
    reader.readAsDataURL(file);
}

function removeCharImg() {
    wizardState.imagemPersonagem = null;
    const wrap = document.getElementById('charImgPreviewWrap');
    if (wrap) wrap.style.display = 'none';
    const input = document.getElementById('charImgUpload');
    if (input) input.value = '';
    saveWizardToStorage();
}

/* ===== PHASE 9 — Resumo Final ===== */

function initResumo(container) {
    let html = createNarratorBox(NARRADOR_TEXTOS.resumo);

    const ws = wizardState;
    const expTotal = ExpTracker.calcExpTotal();
    const expRestante = ExpTracker.getTotal();

    // === Character Summary ===
    html += `<div class="summary-section">
        <div class="summary-title">📋 Identidade</div>
        <div class="summary-grid">
            <div class="summary-item"><div class="summary-item-label">Nome</div><div class="summary-item-value">${escHtml(ws.nomeCompleto || ws.nomePersonagem)}</div></div>
            <div class="summary-item"><div class="summary-item-label">Raça</div><div class="summary-item-value">${escHtml(ws.racaSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">Classe</div><div class="summary-item-value">${escHtml(ws.classeSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">Tribo</div><div class="summary-item-value">${escHtml(ws.triboSelecionada || '—')}</div></div>
            <div class="summary-item"><div class="summary-item-label">EXP Total</div><div class="summary-item-value" style="font-weight:900;color:var(--accent);">${expTotal}</div></div>
            <div class="summary-item"><div class="summary-item-label">EXP Restante</div><div class="summary-item-value">${expRestante}</div></div>
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
    const confirmedNpcs = ws.npcs.filter(n => n.confirmado && n.nome);
    if (confirmedNpcs.length) {
        html += `<div class="summary-section"><div class="summary-title">🤝 NPCs</div>`;
        for (const npc of confirmedNpcs) {
            html += `<div class="detail-tag" style="margin-bottom:4px;">${escHtml(npc.nome)} — ${escHtml(npc.relacao || 'Sem relação')}</div>`;
        }
        html += `</div>`;
    }

    // EXP Breakdown
    const breakdown = ExpTracker.getBreakdown();
    const attrExpCost = ExpTracker.calcAttrExpTotal();
    const skillExpCost = ExpTracker.calcSkillExpTotal();

    html += `<div class="summary-section"><div class="summary-title">⭐ Detalhamento de EXP</div>`;
    html += `<table style="width:100%;font-size:.85rem;border-collapse:collapse;">`;

    // Pool sources
    if (breakdown.length) {
        html += `<tr style="border-bottom:1px solid var(--soft);"><td colspan="2" style="padding:6px 0;font-weight:700;color:var(--muted);">📦 Pool de EXP</td></tr>`;
        for (const src of breakdown) {
            const color = src.amount >= 0 ? 'var(--success)' : 'var(--danger)';
            html += `<tr><td style="padding:4px 0;padding-left:12px;">${escHtml(src.label)}</td><td style="text-align:right;font-weight:700;color:${color};">${src.amount > 0 ? '+' : ''}${src.amount}</td></tr>`;
        }
        html += `<tr><td style="padding:4px 0;padding-left:12px;font-weight:700;">Pool Restante</td><td style="text-align:right;font-weight:700;">${ExpTracker.getTotal()} EXP</td></tr>`;
    }

    // Attribute & Skill costs
    html += `<tr style="border-top:1px solid var(--soft);border-bottom:1px solid var(--soft);"><td colspan="2" style="padding:6px 0;font-weight:700;color:var(--muted);">📊 Custo de Criação (calculado)</td></tr>`;
    html += `<tr><td style="padding:4px 0;padding-left:12px;">Atributos (Nv × 5)</td><td style="text-align:right;font-weight:700;">${attrExpCost} EXP</td></tr>`;
    html += `<tr><td style="padding:4px 0;padding-left:12px;">Perícias (Nv × custo)</td><td style="text-align:right;font-weight:700;">${skillExpCost} EXP</td></tr>`;

    // Totals
    const calcTotal = ExpTracker.calcExpTotal();
    html += `<tr style="border-top:2px solid var(--soft);"><td style="padding:6px 0;font-weight:900;">EXP Total</td><td style="text-align:right;font-weight:900;font-size:1.1rem;color:var(--accent);">${calcTotal} EXP</td></tr>`;
    html += `<tr><td style="padding:4px 0;font-weight:700;">EXP Restante</td><td style="text-align:right;font-weight:700;color:var(--success);">${ExpTracker.getTotal()} EXP</td></tr>`;
    html += `</table></div>`;

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
            goToPhase(i);
            return;
        }
    }

    // === Validate attributes are fully distributed (deferred from Etapa 4) ===
    if (wizardState.grupoPrimario && wizardState.grupoFraco) {
        for (const grupo of GRUPOS_ATRIBUTOS) {
            const remaining = getGroupRemainingPoints(grupo);
            if (remaining > 0) {
                showWizardToast(`Faltam pontos de atributos no grupo ${grupo}. Distribua todos os pontos antes de finalizar.`, 'error');
                goToPhase(4); // Vai para a fase de Atributos (corpo)
                return;
            }
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

    // Skills — convert wizard keys (sk_<key>) to ficha v1.7 format (sk_<category>_<key>)
    for (const [wizKey, val] of Object.entries(ws.pericias)) {
        if (val > 0) {
            const rawKey = wizKey.replace('sk_', '');
            // Find which category this skill belongs to
            let sheetKey = wizKey; // fallback: keep as-is
            for (const [cat, skills] of Object.entries(window.SKILLS || {})) {
                const found = skills.find(s => s.key === rawKey);
                if (found) {
                    sheetKey = `sk_${cat}_${rawKey}`;
                    break;
                }
            }
            dots[sheetKey] = val;
        }
    }

    // Peculiarity dots
    for (const pec of ws.peculiaridadesIndividuais) {
        dots['pec_' + pec.id] = pec.nivel || 1;
    }

    // Build fields object
    const charName = ws.nomeCompleto || ws.nomePersonagem;
    const expTotal = ExpTracker.calcExpTotal();
    const expRestante = ExpTracker.getTotal();

    // Fetch displayName from users collection (same pattern as novo-personagem.html)
    let jogadorName = window.currentUser?.displayName || 'Jogador';
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', window.currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            jogadorName = userData.displayName || userData.nome || window.currentUser.displayName || 'Jogador';
        }
    } catch (e) {
        console.warn('⚠️ Não foi possível buscar displayName do usuário:', e);
    }

    const fields = {
        nome: charName,
        jogador: jogadorName,
        raca: ws.racaSelecionada || '',
        classe: ws.classeSelecionada || '',
        tribo: ws.triboSelecionada || '',
        exp_total: expTotal,
        exp: expRestante,
        aparencia: ws.aparencia || '',
        motivacao: ws.motivacao || '',
        medo: ws.medo || '',
        virtude: ws.virtudeSelecionada || '',
        vicio: ws.vicioSelecionado || '',
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
        if (!npc.nome || !npc.confirmado) continue;
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
            conteudo: `<b>Motivação:</b> ${ws.motivacao || '—'}<br><b>Medo:</b> ${ws.medo || '—'}<br><b>Arrependimento:</b> ${ws.ultimaPergunta || '—'}`,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
    }

    // Build equipment list (including Objeto Pessoal)
    const equipamento = [...(ws.equipamentoSelecionado || [])];
    if (ws.objetoPessoal?.nome) {
        equipamento.push(ws.objetoPessoal.nome);
    }

    // Build structured inventory items (with name, desc, qtd) for ficha v1.7
    const inventoryItems = (ws.equipamentoSelecionado || []).map(name => ({
        name: name, desc: '', qtd: '1'
    }));
    if (ws.objetoPessoal?.nome) {
        inventoryItems.push({
            name: ws.objetoPessoal.nome,
            desc: ws.objetoPessoal.descricao || '',
            qtd: '1'
        });
    }

    // Assemble final charData
    const charData = {
        dots,
        fields,
        notes,
        equipamento,
        inventoryItems,
        peculiaridadesIndividuais: ws.peculiaridadesIndividuais || [],
        mecanicasAplicadas: {},
        mechanicBonuses: {},
        mecanicasPendentes: [],
        nivelInicio: ws.nivelInicio?.id || 'iniciante',
        expInicial: ws.expInicial || (ws.nivelInicio?.exp || 0),
        mesaVinculada: ws.mesaVinculada ? { id: ws.mesaVinculada.id, nome: ws.mesaVinculada.nome } : null,
        mesaId: ws.mesaVinculada?.id || null
    };

    // Include character image (base64 — will be uploaded to Storage by the v1.7 sheet on first save)
    if (ws.imagemPersonagem) {
        charData.charImg = ws.imagemPersonagem;
    }

    // Show saving indicator
    showWizardToast('💾 Salvando personagem...', 'info');

    try {
        if (typeof window.createCharacterInFirebase === 'function') {
            const charId = await window.createCharacterInFirebase(charData);

            // === Save NPCs to Master Panel (collection 'npcs') ===
            await saveNpcsToMasterPanel(ws, charName, charId);

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

/* ===== SAVE NPCS TO MASTER PANEL ===== */

async function saveNpcsToMasterPanel(ws, charName, charId) {
    const confirmedNpcs = ws.npcs.filter(n => n.confirmado && n.nome);
    if (confirmedNpcs.length === 0) return;

    try {
        // Import Firestore functions dynamically
        const { getFirestore, collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db;
        if (!db) {
            console.warn('⚠️ DB not available for NPC save to master panel');
            return;
        }

        for (const npc of confirmedNpcs) {
            // Build tags
            const tags = [];
            tags.push(`Vinculado com o Personagem ${charName}`);

            if (ws.mesaVinculada) {
                if (ws.mesaVinculada.nome) tags.push(`MESA: ${ws.mesaVinculada.nome}`);
                if (ws.mesaVinculada.mestreNome) tags.push(`MESTRE: ${ws.mesaVinculada.mestreNome}`);
            }

            // Build history string: 3 lines
            const historia = [
                npc.relacao || '',
                npc.memoria || '',
                npc.vinculo || ''
            ].join('\n');

            const npcData = {
                nome: npc.nome,
                tipo: 'npc',
                mesaId: ws.mesaVinculada?.id || '',
                tags: tags.join(', '),
                rolePlay: {
                    historia: historia,
                    personalidade: ['', '', ''],
                    trejeitos: '',
                    motivacao: '',
                    segredos: '',
                    relacoes: { aliado: '', rival: '', devedor: '' },
                    frases: ''
                },
                imagem: '',
                raca: '',
                porte: '',
                papel: '',
                local: '',
                tribo: '',
                ai: 0,
                classe: '',
                tamanho: '',
                atributos: { INT: 0, RAC: 0, PRS: 0, FOR: 0, DES: 0, VIG: 0, PRE: 0, MAN: 0, AUT: 0 },
                valoresDer: { VIT: 0, PERC: 0, INI: 0, ENER: 0, REA: 0, BLD: 0, DESLOCAMENTO: '', SAN: 0 },
                ataques: '',
                skills: '',
                loot: { itens: '', luns: '', pistas: '', complicacoes: '' },
                criatura: null,
                lastUpdate: new Date().toISOString(),
                lastUpdateBy: window.currentUser?.email || '',
                createdVia: 'wizard-v1',
                linkedCharId: charId
            };

            const npcId = 'npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            await setDoc(doc(db, 'npcs', npcId), npcData);
            console.log(`✅ NPC "${npc.nome}" salvo no Painel do Mestre`);
        }
    } catch (e) {
        console.error('⚠️ Erro ao salvar NPCs no Painel do Mestre:', e);
        // Non-blocking — character is already saved
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
