/* ===== PHASE 2B — Peculiaridades Individuais (Lógica Reescrita) ===== */
/* Classificação explícita via campo do Creator Panel:
   - pec.ehVantagem === true  → 🟢 Vantagem (custa EXP ao selecionar)
   - pec.ehVantagem === false → 🔴 Desvantagem (concede EXP ao selecionar)
   A mecânica de EXP aplicada na criação é pec.mecanicaExpCriacao (array de IDs) */

/* Quantas avulsas de cada tipo a mesa deixa pegar na criação (Painel do Mestre →
   Configurações da Campanha). Mesa antiga sem o campo cai no mesmo padrão que o
   painel mostra; criação avulsa (sem mesa) é livre, porque não há Mestre para
   configurar o teto. Isto limita a CONTAGEM; o teto de EXP em exp-tracker.js
   limita o ORÇAMENTO — os dois valem juntos. */
const LIMITE_PADRAO_AVULSAS = 3;

function limiteAvulsas(ehVantagem) {
    const mesa = wizardState.mesaVinculada;
    if (!mesa) return Infinity;
    const v = ehVantagem ? mesa.maxPecVantagens : mesa.maxPecDesvantagens;
    return Number.isFinite(v) ? v : LIMITE_PADRAO_AVULSAS;
}

/** "2/3" numa mesa com teto; só "2" na criação avulsa, que não tem teto. */
function rotuloContagemAvulsas(ehVantagem) {
    const lim = limiteAvulsas(ehVantagem);
    return Number.isFinite(lim) ? `${contarAvulsas(ehVantagem)}/${lim}` : `${contarAvulsas(ehVantagem)}`;
}

/** Quantas avulsas do mesmo tipo já estão escolhidas. */
function contarAvulsas(ehVantagem) {
    const todas = window.INDIVIDUAL_PECULIARITIES || [];
    return (wizardState.peculiaridadesIndividuais || []).filter(sel => {
        const pec = todas.find(p => p.id === sel.id);
        return pec && (pec.ehVantagem === true) === ehVantagem;
    }).length;
}

/** Repinta os contadores "(2/3)" dos dois títulos de seção. */
function atualizarContadoresAvulsas() {
    for (const [id, ehVantagem] of [['pecContaVantagens', true], ['pecContaDesvantagens', false]]) {
        const el = document.getElementById(id);
        if (el) el.textContent = rotuloContagemAvulsas(ehVantagem);
    }
}

/* Tirar a peculiaridade herdada da vitrine não basta: o jogador pode tê-la
   comprado como avulsa ANTES de escolher a classe/raça/tribo que a concede, ou
   voltado no wizard e trocado a classe. A escolha velha fica no estado e chega
   na ficha como peculiaridade dobrada — que soma as mecânicas duas vezes.
   Quem herda já muda o nível pelo card de Herdadas; o EXP pago volta. */
function purgarAvulsasHerdadas(idsHerdados) {
    const sel = wizardState.peculiaridadesIndividuais || [];
    const dobradas = sel.filter(p => p && idsHerdados.has(p.id));
    if (dobradas.length === 0) return;

    wizardState.peculiaridadesIndividuais = sel.filter(p => !dobradas.includes(p));
    for (const p of dobradas) ExpTracker.removeSource('pec_' + p.id);
    saveWizardToStorage();
}

function initPhase2B(container) {
    try {
        let html = createNarratorBox(NARRADOR_TEXTOS.peculiaridades);

        // === Peculiaridades Herdadas (Raça, Classe, Tribo) ===
        const pecsHerdadas = [];
        if (wizardState.racaSelecionada && window.RACES && window.RACES[wizardState.racaSelecionada]) {
            (window.RACES[wizardState.racaSelecionada].peculiaridades || []).forEach(p => pecsHerdadas.push({ pec: p, label: 'Raça' }));
        }
        if (wizardState.classeSelecionada && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[wizardState.classeSelecionada]) {
            (window.CLASS_PECULIARITIES[wizardState.classeSelecionada] || []).forEach(p => pecsHerdadas.push({ pec: p, label: 'Classe' }));
        }
        if (wizardState.triboSelecionada && window.TRIBES && window.TRIBES[wizardState.triboSelecionada]) {
            (window.TRIBES[wizardState.triboSelecionada].peculiaridades || []).forEach(p => pecsHerdadas.push({ pec: p, label: 'Tribo' }));
        }

        if (pecsHerdadas.length > 0) {
            html += `<div class="section">
                <div class="section-title">🧬 Peculiaridades Herdadas</div>
                <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                    Características que você adquiriu da sua linhagem e origens. Você pode usar sua EXP para evoluí-las agora, caso possuam níveis extras.
                </p>
                <div class="pec-list">
            `;
            for (const { pec, label } of pecsHerdadas) {
                html += buildInheritedPecCard(pec, label);
            }
            html += `</div></div>`;
        }

        html += `
            <div class="section">
                <div class="section-title">✨ Peculiaridades Individuais</div>
                <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                    Escolha marcas que fazem seu personagem único.
                    <strong style="color:var(--success);">🟢 Vantagens</strong> custam EXP.
                    <strong style="color:var(--danger);">🔴 Desvantagens</strong> concedem EXP.
                </p>
            </div>
        `;

        const vantagens = [];
        const desvantagens = [];
        // Domínio herdado da classe é o MESMO doc que a avulsa: sem este filtro o
        // Guerreiro compra de novo o próprio Domínio e leva o teto em dobro.
        const idsHerdados = new Set(pecsHerdadas.map(h => h.pec.id).filter(Boolean));
        purgarAvulsasHerdadas(idsHerdados);
        const indPecs = (window.INDIVIDUAL_PECULIARITIES || []).filter(p => !idsHerdados.has(p.id));
        const savedPecs = wizardState.peculiaridadesIndividuais || [];

        for (const pec of indPecs) {
            const expInfo = getExpInfo(pec);
            if (pec.ehVantagem === true) {
                vantagens.push({ ...pec, _expInfo: expInfo });
            } else {
                desvantagens.push({ ...pec, _expInfo: expInfo });
            }
        }

        if (vantagens.length) {
            html += `<div class="section"><div class="section-title">🟢 Vantagens <span style="font-size:.78rem;font-weight:400;color:var(--muted);">(custam EXP · <span id="pecContaVantagens">${rotuloContagemAvulsas(true)}</span>)</span></div>`;
            html += `<div class="pec-list" id="pecPosGrid">`;
            for (const pec of vantagens) {
                const sel = savedPecs.some(p => p.id === pec.id) ? 'selected' : '';
                html += buildPecCard2(pec, sel);
            }
            html += `</div></div>`;
        }

        if (desvantagens.length) {
            html += `<div class="section"><div class="section-title">🔴 Desvantagens <span style="font-size:.78rem;font-weight:400;color:var(--muted);">(concedem EXP · <span id="pecContaDesvantagens">${rotuloContagemAvulsas(false)}</span>)</span></div>`;
            html += `<div class="pec-list" id="pecNegGrid">`;
            for (const pec of desvantagens) {
                const sel = savedPecs.some(p => p.id === pec.id) ? 'selected' : '';
                html += buildPecCard2(pec, sel);
            }
            html += `</div></div>`;
        }

        if (vantagens.length === 0 && desvantagens.length === 0) {
            html += `<div style="text-align:center;padding:30px;color:var(--muted);">Nenhuma peculiaridade individual encontrada no banco de dados.</div>`;
        }

        html += createMemoryBox('peculiaridades', 'Escreva uma ou várias memórias sobre quando alguma ou todas essas peculiaridades que seu personagem tem, tiveram uma influência, positiva ou negativa. Te ajudando ou atrapalhando.', false);

        container.innerHTML = html;
    } catch (e) {
        console.error("Erro no initPhase2B:", e);
        container.innerHTML = `<div style="padding:20px;color:var(--danger);text-align:center;"><strong>Erro ao carregar peculiaridades:</strong><br>${e.message}</div>`;
    }
}

/* Delta de EXP acumulado ao levar a peculiaridade até `target`.
   Negativo = o jogador paga; positivo = o jogador recebe.

   Nível 1 vem de mecanicaExpCriacao; níveis 2+ leem pec.niveis[i].custoExp
   (progressão das mecânicas evoluíveis). Sem niveis, cai no linear antigo.

   FONTE ÚNICA: setPecLevel cobra por aqui e a tabela de níveis exibe por
   aqui. Se divergirem, a tela mente sobre o preço. */
function pecDeltaAcumulado(pec, target) {
    // Nível 0 = não pegou a peculiaridade, não paga nada. Sem isto o degrau
    // do Nv.1 (total(1) − total(0)) daria zero e a tabela diria "Grátis"
    // para um nível que cobra.
    if (!(target >= 1)) return 0;
    const nv1 = (pec.ehVantagem === true ? -1 : 1) * getExpInfo(pec).expAmount;
    if (!pec.niveis) return nv1 * target;
    let d = nv1;
    for (let i = 2; i <= target; i++) {
        const nv = pec.niveis[i];
        if (nv) d += (nv.tipoExp === 'ganho' ? 1 : -1) * (nv.custoExp || 0);
    }
    return d;
}

/** "−9 EXP" / "+4 EXP" / "Grátis" */
function fmtExpDelta(delta) {
    if (!delta) return 'Grátis';
    return `${delta < 0 ? '−' : '+'}${Math.abs(delta)} EXP`;
}

/* Valor grande do card, para o nível dado. Vazio quando não há EXP em jogo
   (pec inteiramente grátis), preservando o card limpo. Mesma fonte dos
   botões e da tabela: os três nunca discordam. */
function pecCardExpTexto(pec, level) {
    const delta = pecDeltaAcumulado(pec, level);
    return delta ? fmtExpDelta(delta) : '';
}

/* Repinta o valor grande de um card já renderizado. */
function atualizarPecCardExp(pecId, level) {
    const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
    if (!pec) return;
    const texto = pecCardExpTexto(pec, level);
    document.querySelectorAll(`[data-pec-id="${pecId}"] .pec-list-cost`).forEach(el => {
        el.textContent = texto;
    });
}

/* Botão de nível — usado tanto na montagem do card quanto na inserção
   dinâmica ao selecionar. Um só lugar para os dois não divergirem.
   data-level é a fonte do nível: o rótulo agora tem texto além do número. */
function pecLevelBtnHtml(pec, i, active) {
    const totalNv = fmtExpDelta(pecDeltaAcumulado(pec, i));
    return `<button class="pec-level-btn pec-level-btn--exp ${active ? 'active' : ''}" data-level="${i}"
        onclick="setPecLevel('${pec.id}', ${i})" title="Nível ${i} — total ${totalNv}"
        ><span class="pec-level-num">${i}</span><span class="pec-level-exp">${escHtml(totalNv)}</span></button>`;
}

/* Tabela de níveis: quanto custa cada degrau e quanto sai no total.
   O jogador precisa ver o preço do nível 3 antes de clicar no nível 3. */
function generatePecLevelTable(pec, currentLevel) {
    if (pec.tipo !== 'evolutivo' || !(pec.nivelMax > 1)) return '';

    let linhas = '';
    for (let i = 1; i <= pec.nivelMax; i++) {
        const total = pecDeltaAcumulado(pec, i);
        const degrau = total - pecDeltaAcumulado(pec, i - 1);
        const dados = pec.niveis && pec.niveis[i];
        const efeito = dados && dados.efeitosArray && dados.efeitosArray.length
            ? dados.efeitosArray.join(' · ')
            : (pec.descricaoNivel && pec.descricaoNivel[i]) || '—';
        const atual = i === currentLevel;

        linhas += `<tr class="${atual ? 'atual' : ''}">
            <td class="pec-nv">${atual ? '▸ ' : ''}Nv.${i}</td>
            <td class="pec-degrau">${escHtml(fmtExpDelta(degrau))}</td>
            <td class="pec-total">${escHtml(fmtExpDelta(total))}</td>
            <td class="pec-efeito">${escHtml(efeito)}</td>
        </tr>`;
    }

    return `<div class="pec-tabela-niveis">
        <div class="pec-tabela-titulo">📊 Custo por nível</div>
        <div class="pec-tabela-scroll">
            <table>
                <thead><tr>
                    <th>Nível</th><th>Este nível</th><th>Total acumulado</th><th>O que ganha</th>
                </tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
        <div class="pec-tabela-legenda">
            <b>Total acumulado</b> é o que você paga ou recebe ao escolher aquele nível —
            já inclui os anteriores, não some com eles.
            <b>−</b> sai da sua EXP · <b>+</b> entra na sua EXP.
        </div>
    </div>`;
}

function generatePecDetailsHtml(pec, level = 1) {
    let mecsHtml = '';
    if (pec.mecanicas && pec.mecanicas.length > 0) {
        mecsHtml = `<div style="margin-top:12px; border-top:1px solid var(--line); padding-top:8px;">
            <strong style="color:var(--accent); font-size:0.8rem; text-transform:uppercase;">⚙️ Efeitos Vinculados (Nv. ${level}):</strong>
            <ul style="margin:4px 0 0 16px; padding:0; color:var(--text); font-size:0.8rem; list-style-type:circle;">`;
            
        const niveisData = pec.niveis && pec.niveis[level];
        if (niveisData && niveisData.efeitosArray && niveisData.efeitosArray.length > 0) {
            niveisData.efeitosArray.forEach(txt => {
                mecsHtml += `<li style="margin-bottom:4px;">${escHtml(txt)}</li>`;
            });
        } else {
            pec.mecanicas.forEach(m => {
                const mText = m.previewTexto || (typeof generatePreviewText === 'function' ? generatePreviewText(m) : m.nome);
                mecsHtml += `<li style="margin-bottom:4px;">${escHtml(mText)}</li>`;
            });
        }
        mecsHtml += `</ul></div>`;
    }
    
    let desc = pec.descricao || 'Sem descrição.';
    if (pec.descricaoNivel && pec.descricaoNivel[level]) {
        desc = pec.descricaoNivel[level];
    }
    
    return `
        <strong>${escHtml(pec.nome)}</strong><br>
        <div style="margin-top:8px;">${escHtml(desc)}</div>
        ${mecsHtml}
        ${generatePecLevelTable(pec, level)}
    `;
}

/**
 * Resolve the EXP mechanic linked via mecanicaExpCriacao.
 * Extracts the operation (+/-) and the value from the mechanic's config.calculos structure.
 *
 * Mechanic structure (tipo: 'modificar'):
 *   config.calculos[] → array of calc rows
 *     calc.alvo       → 'EXP' (the target)
 *     calc.operacao   → '+' (somar) or '-' (subtrair)
 *     calc.equacao[]  → array of equation terms
 *       term.tipo     → 'fixo' or 'ficha'
 *       term.valor    → the numeric value (when tipo === 'fixo')
 *
 * Returns { expAmount: number, operacao: '+' | '-' }
 */
function getExpInfo(pec) {
    const result = { expAmount: 0, operacao: '+' };

    // Get linked mechanic IDs
    const expMechIds = Array.isArray(pec.mecanicaExpCriacao) ? pec.mecanicaExpCriacao : [];
    if (expMechIds.length === 0) {
        // Fallback: try mecanicaIds for backward compat
        return result;
    }

    // Find the mechanic in _systemData.mechanics
    const allMechanics = window._systemData?.mechanics || [];
    const mech = allMechanics.find(m => m.id === expMechIds[0]);
    if (!mech) {
        console.warn(`⚠️ Mecânica de EXP não encontrada: ${expMechIds[0]} para peculiaridade "${pec.nome}"`);
        return result;
    }

    // Extract value from the mechanic's config
    const config = mech.config || {};

    // New multi-calc format: config.calculos[]
    if (Array.isArray(config.calculos) && config.calculos.length > 0) {
        for (const calc of config.calculos) {
            // Find the calc that targets EXP
            if (calc.alvo === 'EXP' || !calc.alvo) {
                result.operacao = calc.operacao || '+';

                // Extract value from equation terms
                if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
                    // Sum all fixed terms (tipo === 'fixo')
                    let total = 0;
                    for (const term of calc.equacao) {
                        if (term.tipo === 'fixo' || !term.tipo) {
                            total += Math.abs(parseFloat(term.valor) || 0);
                        }
                    }
                    result.expAmount = total;
                } else if (calc.valor != null) {
                    // Legacy: single valor field
                    result.expAmount = Math.abs(parseFloat(calc.valor) || 0);
                }

                break; // Use first EXP calc found
            }
        }
    }
    // Legacy single-calc format
    else if (config.alvo) {
        result.operacao = config.operacao || '+';
        if (config.valor != null) {
            result.expAmount = Math.abs(parseFloat(config.valor) || 0);
        }
    }

    return result;
}

function buildPecCard2(pec, selectedClass) {
    const isVantagem = pec.ehVantagem === true;

    // Multi-level: show current selected level
    const selectedPec = wizardState.peculiaridadesIndividuais.find(p => p.id === pec.id);
    const hasLevels = pec.tipo === 'evolutivo' && pec.nivelMax > 1;
    const currentLevel = selectedPec?.nivel || 1;

    // Valor grande do card: acompanha o nível escolhido. Sem seleção, mostra
    // o Nv.1 — que é o que o jogador vai pagar se clicar.
    const expText = pecCardExpTexto(pec, currentLevel);
    const expClass = isVantagem ? 'cost' : 'gain';

    let levelSelectorHtml = '';
    if (hasLevels && selectedPec) {
        levelSelectorHtml = `<div class="pec-level-selector" onclick="event.stopPropagation()">`;
        for (let i = 1; i <= pec.nivelMax; i++) {
            levelSelectorHtml += pecLevelBtnHtml(pec, i, currentLevel >= i);
        }
        levelSelectorHtml += `</div>`;
    }

    let apenasCriacaoBadge = '';
    
    if (pec.mecanicas && pec.mecanicas.length > 0) {
        const apenasCriacao = pec.mecanicas.some(m => m.progressaoApenasCriacao === true);
        if (apenasCriacao) {
            apenasCriacaoBadge = `<div style="font-size:0.75rem; color:var(--warning); margin-top:2px;" title="Esta peculiaridade só pode ser aprimorada durante a criação do personagem.">🏗️ Apenas na Criação</div>`;
        }
    }

    const detailsHtml = generatePecDetailsHtml(pec, currentLevel);

    return `
        <div class="pec-list-item-wrapper" style="width:100%; display:flex; flex-direction:column; gap:4px;">
            <div class="pec-list-item ${selectedClass}" data-pec-id="${pec.id}" onclick="togglePeculiarity2('${pec.id}')">
                <div class="pec-list-icon">${pec.icone || '✨'}</div>
                <div class="pec-list-content">
                    <div class="pec-list-title">${escHtml(pec.nome)}</div>
                    ${apenasCriacaoBadge}
                    ${levelSelectorHtml}
                </div>
                <div class="pec-list-cost ${expClass}" style="color:${isVantagem ? 'var(--success)' : 'var(--danger)'};">${escHtml(expText)}</div>
                <button class="pec-info-btn" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-left:8px; padding:4px; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="togglePecInfo(event, '${pec.id}')" title="Ver detalhes">ℹ️</button>
            </div>
            <div class="pec-details-panel" id="pec-details-${pec.id}" style="display:none; padding:12px; background:var(--bg); border:1px dashed var(--soft); border-radius:8px; font-size:0.85rem; color:var(--text);">
                ${detailsHtml}
            </div>
        </div>
    `;
}

function togglePeculiarity2(pecId) {
    const idx = wizardState.peculiaridadesIndividuais.findIndex(p => p.id === pecId);
    const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
    if (!pec) return;

    const expInfo = getExpInfo(pec);
    const isVantagem = pec.ehVantagem === true;

    if (idx >= 0) {
        // === DESSELECIONAR: reverter a mecânica ===
        wizardState.peculiaridadesIndividuais.splice(idx, 1);
        ExpTracker.removeSource('pec_' + pecId);

        // Update card UI
        document.querySelectorAll(`[data-pec-id="${pecId}"]`).forEach(card => {
            card.classList.remove('selected');
            const selector = card.querySelector('.pec-level-selector');
            if (selector) selector.remove();
        });
        // Desselecionou: o valor grande volta a anunciar o Nv.1
        atualizarPecCardExp(pecId, 1);
    } else {
        // === SELECIONAR: aplicar a mecânica ===

        // Teto de contagem da mesa, antes de qualquer conta de EXP: uma vantagem
        // que o jogador não pode pegar não deveria nem checar se ele tem EXP.
        const limite = limiteAvulsas(isVantagem);
        if (contarAvulsas(isVantagem) >= limite) {
            const rotulo = isVantagem ? 'vantagens' : 'desvantagens';
            showWizardToast(limite === 0
                ? `⚠️ Esta mesa não permite ${rotulo} avulsas.`
                : `⚠️ Limite de ${limite} ${rotulo} avulsas nesta mesa. Desmarque uma para trocar.`, 'error');
            return;
        }

        // Calcular quanto EXP vai mudar
        let expDelta = 0;
        if (expInfo.expAmount > 0) {
            if (isVantagem) {
                // Vantagem: custa EXP (subtrai do total)
                expDelta = -expInfo.expAmount;
            } else {
                // Desvantagem: concede EXP (soma ao total)
                expDelta = expInfo.expAmount;
            }
        }

        // Verificar se EXP ficaria negativo
        if (expDelta < 0) {
            const futureTotal = ExpTracker.getTotal() + expDelta;
            if (futureTotal < 0) {
                showWizardToast(`⚠️ EXP insuficiente! Faltam ${Math.abs(futureTotal)} EXP para esta vantagem.`, 'error');
                return;
            }
        }

        // Adicionar ao estado
        wizardState.peculiaridadesIndividuais.push({ id: pecId, nome: pec.nome, nivel: 1 });

        // Aplicar EXP
        if (expDelta !== 0) {
            const label = isVantagem ? `Vantagem: ${pec.nome}` : `Desvantagem: ${pec.nome}`;
            ExpTracker.addSource('pec_' + pecId, expDelta, label);
        }

        // Update card UI
        document.querySelectorAll(`[data-pec-id="${pecId}"]`).forEach(card => {
            card.classList.add('selected');

            // Inject level selector if needed
            if (pec.tipo === 'evolutivo' && pec.nivelMax > 1 && !card.querySelector('.pec-level-selector')) {
                const selectorDiv = document.createElement('div');
                selectorDiv.className = 'pec-level-selector';
                selectorDiv.onclick = (e) => e.stopPropagation();
                let btns = '';
                for (let i = 1; i <= pec.nivelMax; i++) {
                    btns += pecLevelBtnHtml(pec, i, i <= 1);
                }
                selectorDiv.innerHTML = btns;
                card.appendChild(selectorDiv);
            }
        });
    }

    atualizarContadoresAvulsas();
    saveWizardToStorage();
}

function setPecLevel(pecId, level) {
    const pecState = wizardState.peculiaridadesIndividuais.find(p => p.id === pecId);
    if (!pecState) return;

    const pec = window.INDIVIDUAL_PECULIARITIES.find(p => p.id === pecId);
    if (!pec) return;

    const isVantagem = pec.ehVantagem === true;
    const newDelta = pecDeltaAcumulado(pec, level);

    // Check if EXP would go below 0
    if (newDelta < 0) {
        // Remove current source to check available
        const currentSource = wizardState.expSources['pec_' + pecId];
        const currentDelta = currentSource ? currentSource.amount : 0;
        const futureTotal = ExpTracker.getTotal() - currentDelta + newDelta;
        if (futureTotal < 0) {
            showWizardToast(`⚠️ EXP insuficiente para nível ${level}. Faltam ${Math.abs(futureTotal)} EXP.`, 'error');
            return;
        }
    }

    // Update level
    pecState.nivel = level;

    // Update EXP source
    if (newDelta !== 0) {
        const label = isVantagem
            ? `Vantagem: ${pec.nome} Nv.${level}`
            : `Desvantagem: ${pec.nome} Nv.${level}`;
        ExpTracker.addSource('pec_' + pecId, newDelta, label);
    } else {
        // Delta zerou (ex.: voltou a um nível grátis) — remove fonte pendurada
        ExpTracker.removeSource('pec_' + pecId);
    }

    // Update level button UI
    document.querySelectorAll(`[data-pec-id="${pecId}"] .pec-level-btn`).forEach(btn => {
        const btnLevel = parseInt(btn.dataset.level, 10);
        btn.classList.toggle('active', btnLevel <= level);
    });

    atualizarPecCardExp(pecId, level);
    
    // Update details panel dynamically
    const detailsPanel = document.getElementById(`pec-details-${pecId}`);
    if (detailsPanel) {
        detailsPanel.innerHTML = generatePecDetailsHtml(pec, level);
    }

    saveWizardToStorage();
}

/* ===== PECULIARIDADES HERDADAS ===== */

function buildInheritedPecCard(pec, sourceLabel) {
    const hasLevels = pec.tipo === 'evolutivo' && pec.nivelMax > 1;
    const baseLevel = pec.nivelAtual || 1;
    const currentLevel = (wizardState.niveisPeculiaridadesHerdadas || {})[pec.id] || baseLevel;
    
    let apenasCriacaoBadge = '';
    
    if (pec.mecanicas && pec.mecanicas.length > 0) {
        const apenasCriacao = pec.mecanicas.some(m => m.progressaoApenasCriacao === true);
        if (apenasCriacao) {
            apenasCriacaoBadge = `<div style="font-size:0.75rem; color:var(--warning); margin-top:2px;" title="Esta peculiaridade só pode ser aprimorada durante a criação do personagem.">🏗️ Apenas na Criação</div>`;
        }
    }

    const detailsHtml = generatePecDetailsHtml(pec, currentLevel);

    let html = `
        <div class="pec-list-item-wrapper" style="width:100%; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
            <div class="pec-list-item pec-list-item-inherited" data-inherited-pec-id="${pec.id}">
                <div class="pec-list-icon">${pec.icone || '🧬'}</div>
                <div class="pec-list-content">
                    <div class="pec-list-title">${escHtml(pec.nome)} <span style="font-size:.7rem;padding:2px 6px;background:var(--line);border-radius:4px;margin-left:6px;vertical-align:middle;">${escHtml(sourceLabel)}</span></div>
                    ${apenasCriacaoBadge}
    `;

    if (hasLevels) {
        // Build dots
        html += `<div class="pec-levels-container" style="margin-top:8px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">`;
        html += `<span style="font-size:0.8rem;color:var(--muted);margin-right:8px;">Níveis:</span>`;
        for (let i = 1; i <= pec.nivelMax; i++) {
            const isBase = i <= baseLevel;
            const isPurchased = i <= currentLevel;
            let dotClass = 'pec-level-btn';
            if (isBase) dotClass += ' base-level';
            if (isPurchased) dotClass += ' active';
            
            html += `<button class="${dotClass}" onclick="setInheritedPecLevel('${pec.id}', ${i})" title="${isBase ? 'Nível base garantido (clique para reverter upgrades)' : `Evoluir para o Nível ${i}`}">${i}</button>`;
        }
        html += `</div>`;
    } else {
        html += `<div style="font-size:0.8rem;color:var(--muted);margin-top:4px;">Nível Único</div>`;
    }

    html += `</div>`; // fecha content

    if (hasLevels && pec.custoNivel) {
        html += `<div class="pec-list-cost" style="color:var(--muted);font-size:0.9rem;">
            -${pec.custoNivel} EXP / nv
        </div>`;
    }

    html += `
                <button class="pec-info-btn" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-left:8px; padding:4px; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="togglePecInfo(event, '${pec.id}')" title="Ver detalhes">ℹ️</button>
            </div>
            <div class="pec-details-panel" id="pec-details-${pec.id}" style="display:none; padding:12px; background:var(--bg); border:1px dashed var(--soft); border-radius:8px; font-size:0.85rem; color:var(--text);">
                ${detailsHtml}
            </div>
        </div>
    `;
    return html;
}

function setInheritedPecLevel(pecId, level) {
    if (level < 1) return;
    
    let pec = null;
    if (wizardState.racaSelecionada && window.RACES && window.RACES[wizardState.racaSelecionada]) {
        pec = (window.RACES[wizardState.racaSelecionada].peculiaridades || []).find(p => p.id === pecId);
    }
    if (!pec && wizardState.classeSelecionada && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[wizardState.classeSelecionada]) {
        pec = (window.CLASS_PECULIARITIES[wizardState.classeSelecionada] || []).find(p => p.id === pecId);
    }
    if (!pec && wizardState.triboSelecionada && window.TRIBES && window.TRIBES[wizardState.triboSelecionada]) {
        pec = (window.TRIBES[wizardState.triboSelecionada].peculiaridades || []).find(p => p.id === pecId);
    }
    if (!pec) return;

    const baseLevel = pec.nivelAtual || 1;
    let targetLevel = level;
    
    const oldLevel = wizardState.niveisPeculiaridadesHerdadas[pecId] || baseLevel;
    
    // Toggle off if clicking the current max level (downgrade by 1)
    if (targetLevel === oldLevel && targetLevel > baseLevel) {
        targetLevel--;
    } else if (targetLevel < baseLevel) {
        targetLevel = baseLevel;
    }

    if (oldLevel === targetLevel) return;

    let oldCost = 0;
    for (let i = baseLevel + 1; i <= oldLevel; i++) {
        if (pec.niveis && pec.niveis[i]) {
            oldCost += (pec.niveis[i].tipoExp === 'ganho' ? -pec.niveis[i].custoExp : (pec.niveis[i].custoExp || 0));
        } else if (pec.custoNivel) {
            oldCost += pec.custoNivel;
        }
    }

    let newCost = 0;
    for (let i = baseLevel + 1; i <= targetLevel; i++) {
        if (pec.niveis && pec.niveis[i]) {
            newCost += (pec.niveis[i].tipoExp === 'ganho' ? -pec.niveis[i].custoExp : (pec.niveis[i].custoExp || 0));
        } else if (pec.custoNivel) {
            newCost += pec.custoNivel;
        }
    }

    const costDelta = newCost - oldCost;
    if (costDelta > 0) {
        const currentTotal = ExpTracker.getTotal();
        if (currentTotal - costDelta < 0) {
            showWizardToast(`⚠️ EXP insuficiente para evoluir ${pec.nome} para o nível ${targetLevel}. Faltam ${costDelta - currentTotal} EXP.`, 'error');
            return;
        }
    }

    wizardState.niveisPeculiaridadesHerdadas[pecId] = targetLevel;

    if (newCost !== 0) {
        ExpTracker.addSource('inherited_pec_' + pecId, -newCost, `Evolução: ${pec.nome} Nv.${targetLevel}`);
    } else {
        ExpTracker.removeSource('inherited_pec_' + pecId);
    }

    document.querySelectorAll(`[data-inherited-pec-id="${pecId}"] .pec-level-btn`).forEach(btn => {
        const btnLevel = parseInt(btn.textContent);
        btn.classList.toggle('active', btnLevel <= targetLevel);
    });

    // Update details panel dynamically
    const detailsPanel = document.getElementById(`pec-details-${pecId}`);
    if (detailsPanel) {
        detailsPanel.innerHTML = generatePecDetailsHtml(pec, targetLevel);
    }

    saveWizardToStorage();
}


function togglePecInfo(event, pecId) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('pec-details-' + pecId);
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}
