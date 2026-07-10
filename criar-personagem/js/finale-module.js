/* ===== PHASE 8 — A Véspera da Partida ===== */

function initPhase8(container) {
        let html = createNarratorBox(NARRADOR_TEXTOS.vespera);

    // Ajustes Finos (Valores Derivados)
    if (typeof window.simulateDerivedValues === 'function') {
        const simulatedValues = window.simulateDerivedValues();
        const raca = window._systemData?.races?.find(r => r.nome === wizardState.racaSelecionada);
        const classe = window._systemData?.classes?.find(c => c.nome === wizardState.classeSelecionada);
        const tribo = window._systemData?.tribes?.find(t => t.nome === wizardState.triboSelecionada);

        const elegiveis = (window.DERIVED_VALUES || []).filter(dv => {
            const checkSource = (source) => {
                if (!source || !source.derivedValueIds) return false;
                return source.derivedValueIds.some(x => typeof x === 'object' ? x.id === dv.id : x === dv.id);
            };
            
            const isLinked = checkSource(raca) || checkSource(classe) || checkSource(tribo);
            
            return isLinked || (dv.todoPersonagem && dv.characterCreationRule);
        });

        if (elegiveis.length > 0) {
            // Sort by blocoOrdem and then by ordem
            elegiveis.sort((a, b) => {
                const bOrdemA = a.blocoOrdem || 99;
                const bOrdemB = b.blocoOrdem || 99;
                if (bOrdemA !== bOrdemB) return bOrdemA - bOrdemB;
                const ordemA = a.ordem || 99;
                const ordemB = b.ordem || 99;
                return ordemA - ordemB;
            });
            
            // Group by blocoNome
            const grupos = {};
            elegiveis.forEach(dv => {
                const bNome = dv.blocoNome || 'Geral';
                if (!grupos[bNome]) grupos[bNome] = [];
                grupos[bNome].push(dv);
            });

            html += `
                <div class="section">
                    <div class="section-title">⚙️ Ajustes de Personagem</div>
                    <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                        Distribua os modificadores iniciais para os seguintes valores. Os limites dependem da sua Raça, Classe ou Tribo. Valores fixos serão exibidos automaticamente.
                    </p>
            `;
            
            for (const [bloco, dvs] of Object.entries(grupos)) {
                html += `
                    <div style="margin-bottom:20px; border-left: 3px solid rgba(79,110,247,0.4); padding-left:12px; margin-top: 16px;">
                        <h4 style="margin:0 0 12px 0; font-size:.95rem; color:var(--accent); text-transform:uppercase; letter-spacing:1px; opacity:0.8;">
                            ${escHtml(bloco)}
                        </h4>
                `;
                
                dvs.forEach(dv => {
                    const baseVal = parseFloat((simulatedValues[dv.id] || 0).toFixed(2));
                    
                    let linkedMin = null;
                    let linkedMax = null;
                    let hasLink = false;
                    
                    const checkBounds = (source) => {
                        if (!source || !source.derivedValueIds) return;
                        const match = source.derivedValueIds.find(x => typeof x === 'object' ? x.id === dv.id : x === dv.id);
                        if (match) {
                            hasLink = true;
                            if (typeof match === 'object') {
                                if (match.characterCreationMin !== undefined) {
                                    linkedMin = linkedMin === null ? match.characterCreationMin : Math.min(linkedMin, match.characterCreationMin);
                                }
                                if (match.characterCreationMax !== undefined) {
                                    linkedMax = linkedMax === null ? match.characterCreationMax : Math.max(linkedMax, match.characterCreationMax);
                                }
                            }
                        }
                    };
                    
                    checkBounds(raca);
                    checkBounds(classe);
                    checkBounds(tribo);
                    
                    let minBound, maxBound;
                    if (hasLink) {
                        minBound = linkedMin !== null ? linkedMin : 0;
                        maxBound = linkedMax !== null ? linkedMax : 0;
                    } else {
                        minBound = dv.characterCreationMin !== undefined ? dv.characterCreationMin : -20;
                        maxBound = dv.characterCreationMax !== undefined ? dv.characterCreationMax : 20;
                    }
                    
                    const minVal = parseFloat((baseVal + minBound).toFixed(2));
                    const maxVal = parseFloat((baseVal + maxBound).toFixed(2));
                    
                    // Condição de Leitura: Se limites efetivos (Min e Max) são ambos 0
                    const readOnly = (minBound === 0 && maxBound === 0);
                    
                    wizardState.derivedModifiers = wizardState.derivedModifiers || {};
                    let currentMod = wizardState.derivedModifiers[dv.id] || 0;
                    
                    if (readOnly) {
                        currentMod = 0; // Força modificador a 0 se for readonly
                    } else {
                        if (currentMod < minBound) currentMod = minBound;
                        if (currentMod > maxBound) currentMod = maxBound;
                    }
                    
                    wizardState.derivedModifiers[dv.id] = currentMod;
                    const currentSliderVal = parseFloat((baseVal + currentMod).toFixed(2));
                    const fmtVal = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
                    
                    if (readOnly) {
                        html += `
                            <div class="field" style="margin-bottom:16px; background:rgba(79,110,247,0.02); border-radius:10px; padding:12px 14px; border:1px solid rgba(79,110,247,0.08);">
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <label style="margin:0; font-weight:600; font-size:.95rem; color:var(--text); opacity:0.9;">${escHtml(dv.nome)}</label>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span style="font-size:1.3rem; font-weight:900; color:var(--accent); min-width:36px; text-align:right;">${fmtVal(baseVal)}</span>
                                    </div>
                                </div>
                                <div style="font-size:0.75rem; color:var(--muted); margin-top:4px; opacity:0.8;">
                                    Valor Calculado Automático
                                </div>
                            </div>
                        `;
                    } else {
                        const stepVal = (Number.isInteger(minVal) && Number.isInteger(maxVal) && Number.isInteger(baseVal)) ? '1' : '0.01';
                        const modSign = currentMod > 0 ? '+' : '';
                        const modDisplay = currentMod === 0 ? '±0' : `${modSign}${fmtVal(currentMod)}`;

                        html += `
                            <div class="field" style="margin-bottom:16px; background:rgba(79,110,247,0.04); border-radius:10px; padding:12px 14px; border:1px solid rgba(79,110,247,0.12);">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                                    <label style="margin:0; font-weight:600; font-size:.95rem;">${escHtml(dv.nome)}</label>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span id="dv_mod_${dv.id}" style="font-size:.75rem; padding:2px 8px; border-radius:6px; font-weight:700;
                                            background:${currentMod === 0 ? 'rgba(107,114,128,0.15)' : currentMod > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};
                                            color:${currentMod === 0 ? 'var(--muted)' : currentMod > 0 ? 'var(--success)' : 'var(--danger)'};">${modDisplay}</span>
                                        <span id="dv_val_${dv.id}" style="font-size:1.3rem; font-weight:900; color:var(--accent); min-width:36px; text-align:right;">${fmtVal(currentSliderVal)}</span>
                                    </div>
                                </div>
                                <input type="range" 
                                       min="${minVal}" max="${maxVal}" step="${stepVal}" 
                                       value="${currentSliderVal}"
                                       oninput="
                                            const val = parseFloat(this.value);
                                            const mod = parseFloat((val - ${baseVal}).toFixed(2));
                                            const fmt = Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/0+$/, '').replace(/\\\\.$/, '');
                                            const modSign = mod > 0 ? '+' : '';
                                            const modFmt = mod === 0 ? '±0' : modSign + (Number.isInteger(mod) ? String(mod) : mod.toFixed(2).replace(/0+$/, '').replace(/\\\\.$/, ''));
                                            document.getElementById('dv_val_${dv.id}').textContent = fmt;
                                            const modEl = document.getElementById('dv_mod_${dv.id}');
                                            modEl.textContent = modFmt;
                                            modEl.style.background = mod === 0 ? 'rgba(107,114,128,0.15)' : mod > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
                                            modEl.style.color = mod === 0 ? 'var(--muted)' : mod > 0 ? 'var(--success)' : 'var(--danger)';
                                            const breakdownEl = document.getElementById('dv_breakdown_${dv.id}');
                                            if (breakdownEl) breakdownEl.textContent = '${fmtVal(baseVal)} ' + (mod >= 0 ? '+ ' + (Number.isInteger(mod) ? String(mod) : mod.toFixed(2).replace(/0+$/, '').replace(/\\\\.$/, '')) : '− ' + (Number.isInteger(Math.abs(mod)) ? String(Math.abs(mod)) : Math.abs(mod).toFixed(2).replace(/0+$/, '').replace(/\\\\.$/, ''))) + ' = ' + fmt;
                                            wizardState.derivedModifiers['${dv.id}'] = mod;
                                            saveWizardToStorage();
                                        "
                                       style="width:100%;">
                                <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--muted); margin-top:2px;">
                                    <span>Min: ${fmtVal(minVal)}</span>
                                    <span id="dv_breakdown_${dv.id}" style="font-weight:600; color:var(--ink); opacity:0.7;">${fmtVal(baseVal)} ${currentMod >= 0 ? '+ ' + fmtVal(currentMod) : '− ' + fmtVal(Math.abs(currentMod))} = ${fmtVal(currentSliderVal)}</span>
                                    <span>Max: ${fmtVal(maxVal)}</span>
                                </div>
                            </div>
                        `;
                    }
                });
                
                html += `</div>`;
            }
            html += `</div>`;
        }
    }

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
                <label>Idade</label>
                <input type="number" id="idade" value="${escHtml(wizardState.idade || '')}"
                    placeholder="Idade do personagem"
                    oninput="wizardState.idade = this.value; saveWizardToStorage();">
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
            <div class="summary-item"><div class="summary-item-label">Idade</div><div class="summary-item-value">${escHtml(ws.idade || '—')}</div></div>
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
    
    // VIP EXP (Repertório)
    if (ws.expVip > 0) {
        html += `<tr style="border-top:1px solid var(--soft);"><td colspan="2" style="padding:6px 0;font-weight:700;color:var(--muted);">👑 Bônus VIP</td></tr>`;
        html += `<tr><td style="padding:4px 0;padding-left:12px;">EXP VIP (Repertório)</td><td style="text-align:right;font-weight:700;color:var(--success);">+${ws.expVip} EXP</td></tr>`;
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
    
    // Validar Itens de Repertório
    if (wizardState.itensRepertorioSelecionados && wizardState.itensRepertorioSelecionados.length > 0) {
        if (!confirm('Você selecionou Itens de Repertório.\nAo confirmar a criação do personagem, estes itens serão deduzidos definitivamente do inventário da sua conta.\n\nDeseja continuar?')) {
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
    
    // Inherited peculiarity levels (upgrades)
    if (ws.niveisPeculiaridadesHerdadas) {
        for (const [pecId, nivel] of Object.entries(ws.niveisPeculiaridadesHerdadas)) {
            if (nivel > 1) {
                dots['pec_' + pecId] = nivel;
            }
        }
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
        idade: ws.idade || '',
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

    // Objeto pessoal note (legacy view, opcional, mas mantém a nota na ficha)
    if (ws.customItem?.nome) {
        notes.push({
            id: 'note-objeto-' + Date.now(),
            titulo: `🎒 ${ws.customItem.nome}`,
            conteudo: ws.customItem.descricao || 'Item inicial personalizado.',
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

    // Build equipment list (lista de nomes de itens pra compatibilidade)
    const equipamento = [...(ws.equipamentoSelecionado || [])];

    // Build structured inventory items (with name, desc, qtd) for ficha v1.7 legacy
    const inventoryItems = (ws.equipamentoSelecionado || []).map(name => ({
        name: name, desc: '', qtd: '1'
    }));

    // Injeta os itens do kit inicial diretamente na ficha (embedded)
    if (ws.kitInicialSelecionado && ws.classeSelecionada) {
        const classData = window._systemData?.classes?.find(c => c.nome === ws.classeSelecionada);
        if (classData && classData.kitsIniciais) {
            const kit = classData.kitsIniciais.find((k, index) => {
                const kid = k.id || `kit_${index}`;
                return kid === ws.kitInicialSelecionado;
            });
            if (kit && kit.equipamentos) {
                for (const eqId of kit.equipamentos) {
                    const eqData = window._systemData?.equipment?.find(e => e.id === eqId);
                    if (eqData) {
                        equipamento.push(eqData.nome);
                        inventoryItems.push({
                            name: eqData.nome,
                            desc: eqData.descricao || '',
                            qtd: String(eqData.quantidade || '1')
                        });
                    }
                }
            }
        }
    }

    // Injeta os itens de Repertório no inventário (se houver)
    if (ws.itensRepertorioSelecionados && ws.itensRepertorioSelecionados.length > 0) {
        ws.itensRepertorioSelecionados.forEach(repItem => {
            if (repItem.personagemItensVinculados && repItem.personagemItensVinculados.length > 0) {
                repItem.personagemItensVinculados.forEach(eqId => {
                    const eqData = window._systemData?.equipment?.find(e => String(e.id) === String(eqId));
                    if (eqData) {
                        equipamento.push(eqData.nome);
                        inventoryItems.push({
                            name: eqData.nome,
                            desc: eqData.descricao || `Vindo de pacote: ${repItem.nome}`,
                            qtd: String(eqData.quantidade || '1')
                        });
                    }
                });
            }
        });
    }

    // === Consolidar Partes do Corpo (Raça + Peculiaridades) ===
    let partesDoCorpo = [];
    const racaData = window._systemData?.races?.find(r => r.nome === ws.racaSelecionada);
    
    // Extrair partes base e garantir que são objetos completos
    let baseParts = [];
    if (racaData && racaData.partesDoCorpo && racaData.partesDoCorpo.length > 0) {
        baseParts = racaData.partesDoCorpo.map(p => {
            const id = typeof p === 'string' ? p : p.id;
            const slots = typeof p === 'object' ? (p.slots || 1) : 1;
            const bpDef = window._systemData?.bodyParts?.find(b => b.id === id);
            return bpDef ? { ...JSON.parse(JSON.stringify(bpDef)), slots } : null;
        }).filter(Boolean);
    }
    
    if (baseParts.length > 0) {
        partesDoCorpo = baseParts;
    } else {
        const defaultParts = window._systemData?.bodyParts?.filter(bp => bp.ehPadrao) || [];
        partesDoCorpo = JSON.parse(JSON.stringify(defaultParts));
    }
    
    // Assegurar que cada parte tenha .slots base, padrão 1 se não definido
    partesDoCorpo.forEach(bp => {
        if (typeof bp.slots === 'undefined') bp.slots = 1;
    });

    // Coletar peculiaridades da Raça, Classe, Tribo e Individuais
    const allPecIds = [];
    if (racaData && racaData.peculiaridadeIds) allPecIds.push(...racaData.peculiaridadeIds);
    
    const classData = window._systemData?.classes?.find(c => c.nome === ws.classeSelecionada);
    if (classData && classData.peculiaridadeIds) allPecIds.push(...classData.peculiaridadeIds);
    if (classData && classData.bonusIniciais) allPecIds.push(...classData.bonusIniciais);

    const triboData = window._systemData?.tribes?.find(t => t.nome === ws.triboSelecionada);
    if (triboData && triboData.peculiaridadeIds) allPecIds.push(...triboData.peculiaridadeIds);

    if (ws.peculiaridadesIndividuais) {
        ws.peculiaridadesIndividuais.forEach(pec => allPecIds.push(pec.id));
    }

    // Avaliar mecânicas que afetam Partes do Corpo (ex: 'Parte do Corpo: Braço')
    if (window._systemData && window._systemData.peculiarities && window._systemData.mechanics) {
        const uniquePecs = [...new Set(allPecIds)];
        uniquePecs.forEach(pecId => {
            const pec = window._systemData.peculiarities.find(p => p.id === pecId);
            if (pec && pec.mecanicaIds && pec.mecanicaIds.length > 0) {
                pec.mecanicaIds.forEach(mId => {
                    const mech = window._systemData.mechanics.find(m => m.id === mId);
                    if (mech && mech.tipo === 'modificar' && mech.config && mech.config.alvo && mech.config.alvo.startsWith('Parte do Corpo: ')) {
                        const targetName = mech.config.alvo.replace('Parte do Corpo: ', '').trim();
                        
                        // Parse da expressão do valor
                        let calcStr = String(mech.config.calculo || mech.config.valorFixo || '0');
                        calcStr = calcStr.replace(/\b(FOR|DES|VIG|INT|RAC|PRS|PRE|MAN|AUT)\b/g, match => {
                            const attrKey = 'attr_' + match.toLowerCase();
                            return (dots[attrKey] || 0);
                        });
                        let val = 0;
                        try { val = Math.floor(new Function('"use strict"; return (' + calcStr + ')')()); } catch(e) {}
                        
                        const bpIndex = partesDoCorpo.findIndex(bp => bp.nome === targetName);
                        if (bpIndex !== -1) {
                            if (mech.config.operacao === '+') partesDoCorpo[bpIndex].slots += val;
                            else if (mech.config.operacao === '-') partesDoCorpo[bpIndex].slots -= val;
                            else if (mech.config.operacao === '=') partesDoCorpo[bpIndex].slots = val;
                            
                            if (partesDoCorpo[bpIndex].slots < 0) partesDoCorpo[bpIndex].slots = 0;
                        } else {
                            // Adicionar a parte se não existia na base da raça, pegando dados canônicos
                            const globalBp = window._systemData.bodyParts?.find(bp => bp.nome === targetName);
                            if (globalBp) {
                                const newBp = JSON.parse(JSON.stringify(globalBp));
                                newBp.slots = mech.config.operacao === '=' ? val : Math.max(0, val);
                                if (newBp.slots > 0) {
                                    partesDoCorpo.push(newBp);
                                }
                            }
                        }
                    }
                });
            }
        });
    }

    // Limpar partes com 0 slots para não poluir UI de equipar
    partesDoCorpo = partesDoCorpo.filter(bp => bp.slots > 0);

    // === GUARD: Garantir partes do corpo nunca vazias ===
    if (partesDoCorpo.length === 0) {
        console.warn('⚠️ partesDoCorpo vazio após consolidação! Usando fallback padrão.');
        const defaultParts = window._systemData?.bodyParts?.filter(bp => bp.ehPadrao) || [];
        partesDoCorpo = JSON.parse(JSON.stringify(defaultParts));
        partesDoCorpo.forEach(bp => { if (typeof bp.slots === 'undefined') bp.slots = 1; });
    }
    console.log('🦴 partesDoCorpo consolidado:', partesDoCorpo.length, 'parte(s)',
        partesDoCorpo.map(bp => `${bp.nome}(${bp.slots})`).join(', '));

    // Assemble final charData
    const charData = {
        dots,
        fields,
        notes,
        equipamento,
        inventoryItems,
        peculiaridadesIndividuais: ws.peculiaridadesIndividuais || [],
        partesDoCorpo, // <== Injetado no momento da criação
        mecanicasAplicadas: {},
        mechanicBonuses: {},
        derivedModifiers: ws.derivedModifiers || {},
        mecanicasPendentes: [],
        nivelInicio: ws.nivelInicio?.id || 'iniciante',
        expInicial: ws.expInicial || (ws.nivelInicio?.exp || 0),
        expVip: ws.expVip || 0,
        itensRepertorioSelecionados: ws.itensRepertorioSelecionados || [], // Armazenado para rastreabilidade
        mesaVinculada: ws.mesaVinculada ? { id: ws.mesaVinculada.id, nome: ws.mesaVinculada.nome } : null,
        mesaId: ws.mesaVinculada?.id || null
    };

    // Include character image (base64 — will be uploaded to Storage by the v1.7 sheet on first save)
    if (ws.imagemPersonagem) {
        charData.charImg = ws.imagemPersonagem;
    }

    // === Inicializar Status Vitais ===
    // Calcula o valor máximo baseado nos atributos finais e atribui ao valor atual.
    if (window.VITAL_STATS) {
        const hardcodedVitalsMap = {
            'VIT_MAX': 'vit_atual',
            'ENER_MAX': 'ener_atual',
            'SAN_MAX': 'san_atual'
        };
        charData.dvAtual = charData.dvAtual || {};

        window.VITAL_STATS.forEach(vs => {
            let maxVal = 0;
            // 1. Calcular usando as mecânicas vinculadas ao status vital
            if (vs.mecanicaIds && vs.mecanicaIds.length > 0 && window._systemData && window._systemData.mechanics) {
                vs.mecanicaIds.forEach(mId => {
                    const mech = window._systemData.mechanics.find(m => m.id === mId);
                    if (mech && mech.tipo === 'modificar' && mech.config) {
                        let calcStr = String(mech.config.calculo || mech.config.valorFixo || '0');
                        // Substitui atributos (ex: FOR -> dots.attr_for)
                        calcStr = calcStr.replace(/\b(FOR|DES|VIG|INT|RAC|PRS|PRE|MAN|AUT)\b/g, match => {
                            const attrKey = 'attr_' + match.toLowerCase();
                            return (charData.dots[attrKey] || 0);
                        });
                        try {
                            const result = new Function('"use strict"; return (' + calcStr + ')')();
                            if (mech.config.operacao === '+') maxVal += result;
                            else if (mech.config.operacao === '=') maxVal = result;
                            else if (mech.config.operacao === '*') maxVal *= result;
                        } catch (e) {
                            console.error(`Erro ao calcular mecânica para ${vs.key}:`, e);
                        }
                    }
                });
            } 
            // 2. Fallback para string de fórmula antiga, se existir
            else if (vs.formula) {
                let calcStr = String(vs.formula);
                calcStr = calcStr.replace(/\b(FOR|DES|VIG|INT|RAC|PRS|PRE|MAN|AUT)\b/g, match => {
                    const attrKey = 'attr_' + match.toLowerCase();
                    return (charData.dots[attrKey] || 0);
                });
                try {
                    maxVal = new Function('"use strict"; return (' + calcStr + ')')();
                } catch (e) {
                    console.error(`Erro ao calcular fórmula para ${vs.key}:`, e);
                }
            }

            maxVal = Math.floor(maxVal);

            // 3. Atribui o valor máximo à respectiva variável atual (fields ou dvAtual)
            if (hardcodedVitalsMap[vs.key]) {
                charData.fields[hardcodedVitalsMap[vs.key]] = maxVal;
            } else {
                charData.dvAtual[vs.key] = maxVal;
            }
        });
    }

    // Show saving indicator
    showWizardToast('💾 Salvando personagem...', 'info');
    // Capture state variables BEFORE createCharacterInFirebase clears the wizardState!
    const savedKitId = ws.kitInicialSelecionado;
    const savedClass = ws.classeSelecionada;
    const savedCustomItem = ws.customItem;
    const savedNpcs = ws.npcs ? JSON.parse(JSON.stringify(ws.npcs)) : [];
    const savedCharName = charName;
    const savedItensRepertorio = ws.itensRepertorioSelecionados ? JSON.parse(JSON.stringify(ws.itensRepertorioSelecionados)) : [];

    try {
        if (typeof window.createCharacterInFirebase === 'function') {
            const charId = await window.createCharacterInFirebase(charData);

            // === Save NPCs to Master Panel (collection 'npcs') ===
            await saveNpcsToMasterPanel(savedNpcs, savedCharName, charId, ws.mesaVinculada);

            // === Save custom item to 'items' collection ===
            if (savedCustomItem) {
                await saveCustomItemToFirebase(savedCustomItem, charId, ws.mesaVinculada?.id);
            }

            // === Save starter kit items to 'items' collection ===
            if (savedKitId && savedClass) {
                const classData = window._systemData?.classes?.find(c => c.nome === savedClass);
                if (classData && classData.kitsIniciais) {
                    const kit = classData.kitsIniciais.find((k, index) => {
                        const kid = k.id || `kit_${index}`;
                        return kid === savedKitId;
                    });
                    if (kit && kit.equipamentos) {
                        for (const eqId of kit.equipamentos) {
                            const eqData = window._systemData?.equipment?.find(e => e.id === eqId);
                            if (eqData) {
                                await saveEquipmentAsItemToFirebase(eqData, charId);
                            }
                        }
                    }
                }
            }

            // === Save Repertory items to 'items' collection ===
            if (savedItensRepertorio.length > 0) {
                for (const repItem of savedItensRepertorio) {
                    if (repItem.personagemItensVinculados && repItem.personagemItensVinculados.length > 0) {
                        for (const eqId of repItem.personagemItensVinculados) {
                            const eqData = window._systemData?.equipment?.find(e => String(e.id) === String(eqId));
                            if (eqData) {
                                await saveEquipmentAsItemToFirebase(eqData, charId);
                            }
                        }
                    }
                }
            }

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

async function saveCustomItemToFirebase(customItem, charId, mesaId) {
    if (!customItem || !customItem.nome) return;
    try {
        const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db;
        const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        let mecanicasDaMesa = [];
        if (mesaId) {
            try {
                const mesaSnap = await getDoc(doc(db, 'mesas', mesaId));
                if (mesaSnap.exists()) {
                    mecanicasDaMesa = mesaSnap.data().config?.mecanicasObjetoPessoal || [];
                }
            } catch(e) { console.warn('Erro ao buscar mesa para objeto pessoal', e); }
        }
        
        const itemData = {
            ...customItem,
            id: itemId,
            characterId: charId,
            equipado: false,
            estadoEquip: null,
            slotAnatomico: null,
            maosUsadas: null,
            parentItemId: null,
            criadoPor: 'jogador',
            mecanicaIdsProprias: mecanicasDaMesa,
            lastModified: new Date().toISOString()
        };

        const user = window.currentUser;
        if (user) {
            itemData.ownerUid = user.uid;
            itemData.ownerId = user.uid;
        }

        await setDoc(doc(db, 'items', itemId), itemData);
        console.log(`✅ Item customizado "${customItem.nome}" salvo no inventário`);
    } catch (e) {
        console.error('⚠️ Erro ao salvar item customizado:', e);
    }
}

async function saveEquipmentAsItemToFirebase(equipData, charId) {
    if (!equipData) return;
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db;
        const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        const itemData = {
            ...JSON.parse(JSON.stringify(equipData)), // clonagem segura
            id: itemId,
            originalEquipId: equipData.id,
            characterId: charId,
            equipado: false,
            parentItemId: null,
            quantidade: equipData.quantidade || 1,
            lastModified: new Date().toISOString()
        };

        const user = window.currentUser;
        if (user) {
            itemData.ownerUid = user.uid;
            itemData.ownerId = user.uid;
        }

        await setDoc(doc(db, 'items', itemId), itemData);
        console.log(`✅ Item de kit "${equipData.nome}" salvo no inventário`);
    } catch (e) {
        console.error('⚠️ Erro ao salvar item de kit:', e);
    }
}

/* ===== SAVE NPCS TO MASTER PANEL ===== */

async function saveNpcsToMasterPanel(npcsList, charName, charId, mesaVinculada) {
    const confirmedNpcs = npcsList.filter(n => n.confirmado && n.nome);
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

            if (mesaVinculada) {
                if (mesaVinculada.nome) tags.push(`MESA: ${mesaVinculada.nome}`);
                if (mesaVinculada.mestreNome) tags.push(`MESTRE: ${mesaVinculada.mestreNome}`);
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
