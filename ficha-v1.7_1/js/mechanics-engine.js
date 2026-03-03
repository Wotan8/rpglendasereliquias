/* ===== MECHANICS ENGINE — Interpreta mecânicas do Firebase ===== */

/**
 * TARGET_MAP: Mapeia config.alvo (nome legível) → campo na ficha
 * Categorias:
 *   "attr_xxx"    → aplica em state.mechanicBonuses como bônus separado
 *   "sk_xxx"      → aplica em state.mechanicBonuses como bônus separado
 *   "DERIVED:XXX" → aplica como modificador na fórmula derivada (recalcAll)
 *   "field:xxx"   → aplica no campo data-key do DOM
 *   "INFO:xxx"    → apenas informativo, não altera cálculo
 */
const TARGET_MAP = {
    // === ATRIBUTOS ===
    "INT": "attr_int",
    "RAC": "attr_rac",
    "PRS": "attr_prs",
    "FOR": "attr_for",
    "DES": "attr_des",
    "VIG": "attr_vig",
    "PRE": "attr_pre",
    "MAN": "attr_man",
    "AUT": "attr_aut",

    // === VALORES DERIVADOS ===
    "Vitalidade Máxima": "DERIVED:VIT_MAX",
    "Determinação Máxima": "DERIVED:DET_MAX",
    "Sanidade Máxima": "DERIVED:SAN_MAX",
    "Percepção": "DERIVED:PERC",
    "Iniciativa": "DERIVED:INI",
    "Reação": "DERIVED:REA",
    "Blindagem": "field:blindagem",
    "Deslocamento Terrestre": "DERIVED:DESLOC_T",
    "Deslocamento Aquático": "DERIVED:DESLOC_A",
    "Deslocamento Aéreo": "DERIVED:DESLOC_AR",
    "Tamanho": "field:tamanho",
    "Carga Máxima": "DERIVED:CARGA",

    // === PERÍCIAS MENTAIS ===
    "Abismo": "sk_mental_abismo",
    "Alquimancia": "sk_mental_alquimia",
    "Alquimia": "sk_mental_alquimia",
    "Essência": "sk_mental_essencia",
    "Fluxomancia": "sk_mental_essencia",
    "Erudição": "sk_mental_historia",
    "História": "sk_mental_historia",
    "Herbalismo": "sk_mental_herbalismo",
    "Investigação": "sk_mental_investigacao",
    "Medicina": "sk_mental_medicina",
    "Ofícios": "sk_mental_oficio_int",
    "Ofício Intel.": "sk_mental_oficio_int",
    "Religião": "sk_mental_reliquia",
    "Relíquia": "sk_mental_reliquia",
    "Runomancia": "sk_mental_runomancia",

    // === PERÍCIAS FÍSICAS ===
    "Agilidade": "sk_fisico_agilidade",
    "Arma": "sk_fisico_arma",
    "Arremessar": "sk_fisico_arremessar",
    "Atletismo": "sk_fisico_atletismo",
    "Briga": "sk_fisico_briga",
    "Disparo": "sk_fisico_disparo",
    "Furtividade": "sk_fisico_furtividade",
    "Montaria": "sk_fisico_montaria",
    "Ofício Braç.": "sk_fisico_oficio_brac",
    "Sobrevivência": "sk_fisico_sobrevivencia",

    // === PERÍCIAS SOCIAIS ===
    "Barganha": "sk_social_barganha",
    "Diplomacia": "sk_social_diplomacia",
    "Domar": "sk_social_domar",
    "Empatia": "sk_social_empatia",
    "Intimidação": "sk_social_intimidacao",
    "Liderança": "sk_social_lideranca",
    "Malandragem": "sk_social_malandragem",
    "Performance": "sk_social_performance",
    "Sedução": "sk_social_seducao",
    "Observação": "sk_social_observacao",

    // === PERÍCIAS DEFENSIVAS / COMBATE ===
    "Esquiva": "sk_combate_esquiva",
    "Aparar": "sk_combate_aparar",
    "Bloquear": "sk_combate_bloquear",
    "Desviar": "sk_combate_desviar",
    "Evadir": "sk_combate_evadir",
    "Cobertura": "sk_combate_cobertura",
    "Proteger": "sk_combate_proteger",
    "Reflexo": "sk_combate_reflexo",
    "Contra-Ataque": "sk_combate_contra_ataque",
    "Contra-Ataq.": "sk_combate_contra_ataque",
    "Ambidestria": "sk_combate_ambidestria",

    // === PROPRIEDADES DE COMBATE (informativos) ===
    "Alvo de Ataque": "INFO:alvo_ataque",
    "Alvo de Defesa": "INFO:alvo_defesa",
    "Dano": "INFO:dano",
    "Dano Crítico": "INFO:dano_critico",
    "Ações por turno": "INFO:acoes_turno",
};

/**
 * Pool map: mapeia nomes de pool (usados em mecânicas distribuir) para listas de alvos válidos.
 * Usa o array SKILLS (data.js) como fonte canônica de nomes para evitar aliases/duplicatas.
 */
function getDistribuirPool(poolName) {
    if (!poolName) return [];
    const p = poolName.toLowerCase();

    // Helper: extrai nomes canônicos de uma ou mais categorias do SKILLS
    const fromSkills = (...categories) => {
        const names = [];
        for (const cat of categories) {
            if (SKILLS[cat]) {
                for (const sk of SKILLS[cat]) {
                    names.push(sk.name);
                }
            }
        }
        return names;
    };

    if (p.includes('perícia') && p.includes('qualquer')) {
        return fromSkills('mental', 'fisico', 'social', 'combate');
    }
    if (p.includes('perícia') && p.includes('mental')) {
        return fromSkills('mental');
    }
    if (p.includes('perícia') && p.includes('físic')) {
        return fromSkills('fisico');
    }
    if (p.includes('perícia') && p.includes('social')) {
        return fromSkills('social');
    }
    if (p.includes('perícia') && p.includes('combate')) {
        return fromSkills('combate');
    }
    if (p.includes('atributo')) {
        return Object.keys(TARGET_MAP).filter(k => TARGET_MAP[k]?.startsWith('attr_'));
    }

    // Fallback: tentar encontrar o alvo direto
    return [poolName];
}

/* ===== LIMPAR BÔNUS DE MECÂNICAS ===== */
function clearMechanicBonuses() {
    state.mechanicBonuses = {};
    state.mechanicLimits = {};
    state.capacidades = [];
    state.mecanicasPendentes = [];
}

/* ===== APLICAR TODAS AS MECÂNICAS DE UMA RAÇA ===== */
function applyAllRaceMechanics(racaNome) {
    clearMechanicBonuses();

    if (!racaNome || !window.RACES) return;
    const raca = window.RACES[racaNome];
    if (!raca) return;

    for (const pec of raca.peculiaridades) {
        if (!pec.mecanicas) continue;
        for (const mech of pec.mecanicas) {
            applyMechanicToSheet(mech, pec);
        }
    }
}

/* ===== APLICAR UMA MECÂNICA INDIVIDUAL ===== */
function applyMechanicToSheet(mech, parentPec) {
    const tipo = mech.tipo;

    // Se a mecânica é evoluível, resolver o valor com base no nível atual da peculiaridade
    let config = mech.config || {};
    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || parentPec.nivel || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog && prog.valor !== undefined) {
            // Criar config ajustada ao nível
            config = JSON.parse(JSON.stringify(config));
            if (tipo === 'modificar') {
                config.valor = prog.valor;
            } else if (tipo === 'limitar') {
                if (config.valorMaximo !== undefined) config.valorMaximo = prog.valor;
                if (config.valorMinimo !== undefined) config.valorMinimo = prog.valor;
            } else if (tipo === 'distribuir') {
                if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
                if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
                if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
            }
            // narrativo e conceder não alteram cálculos, só exibição
        }
    }

    // Verificar condições
    const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
    const isPermanent = !mech.duracao || mech.duracao === 'permanente';
    const isCreation = mech.duracao === 'criacao';

    // === TIPO: MODIFICAR ===
    if (tipo === 'modificar' && isPermanent && !isConditional) {
        const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
        for (const alvo of alvos) {
            if (!alvo) continue;
            const field = TARGET_MAP[alvo];
            if (!field) {
                console.warn(`⚠️ Mecânica "${mech.nome}": alvo "${alvo}" não encontrado no TARGET_MAP`);
                continue;
            }

            const val = parseFloat(config.valor) || 0;
            const op = config.operacao;

            if (op === '+') state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + val;
            else if (op === '-') state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - val;
            else if (op === '×' || op === '*') {
                // Multiplicadores: armazenar como "MULT:field"
                const multKey = 'MULT:' + field;
                state.mechanicBonuses[multKey] = (state.mechanicBonuses[multKey] || 1) * val;
            }
        }
    }

    // === TIPO: LIMITAR ===
    if (tipo === 'limitar' && isPermanent && !isConditional) {
        const field = TARGET_MAP[config.alvo];
        if (field) {
            state.mechanicLimits[field] = {
                tipo: config.tipoLimite,
                max: config.valorMaximo,
                min: config.valorMinimo
            };
        }
    }

    // === TIPO: CONCEDER ===
    if (tipo === 'conceder') {
        state.capacidades.push({
            tipo: config.tipoConcessao,
            descricao: config.descricaoConcessao,
            fonte: parentPec?.nome || mech.nome
        });
    }

    // === TIPO: DISTRIBUIR ===
    if (tipo === 'distribuir' && (isCreation || isPermanent)) {
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaAplicada = dados?.aplicada;

        // Restaurar bônus de alvos já escolhidos (parcial ou completo)
        if (dados?.alvosEscolhidos) {
            for (const alvo of dados.alvosEscolhidos) {
                const field = TARGET_MAP[alvo.nome];
                if (field) {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + alvo.valor;
                }
            }
        }

        // Se não totalmente aplicada, marcar como pendente para mostrar slots restantes
        if (!jaAplicada) {
            state.mecanicasPendentes.push(mech);
        }
    }

    // Condicional e Narrativo: apenas informativo (exibido no card)
}

/* ===== GERAR TEXTO DE PREVIEW ===== */
function generatePreviewText(mech) {
    if (mech.previewTexto) return mech.previewTexto;
    const config = mech.config || {};
    const tipo = mech.tipo;

    if (tipo === 'modificar') {
        const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
        const alvosStr = alvos.filter(Boolean).join(', ');
        return `${config.operacao || '+'}${config.valor || 0} em ${alvosStr}`;
    }
    if (tipo === 'limitar') {
        if (config.tipoLimite === 'bloqueio') return `Bloqueio: ${config.alvo}`;
        if (config.tipoLimite === 'maximo') return `${config.alvo} máximo ${config.valorMaximo}`;
        if (config.tipoLimite === 'minimo') return `${config.alvo} mínimo ${config.valorMinimo}`;
        return `Limite em ${config.alvo}`;
    }
    if (tipo === 'conceder') {
        return `${config.tipoConcessao || 'Capacidade'}: ${config.descricaoConcessao || ''}`;
    }
    if (tipo === 'distribuir') {
        return `Distribuir: ${config.operacao || '+'}${config.valorPorAlvo || 1} em ${config.quantidadeAlvos || '?'} alvos de [${config.pool || '?'}]`;
    }
    if (tipo === 'condicional') {
        return `Condicional: ${config.gatilho || ''}`;
    }
    if (tipo === 'narrativo') {
        return config.textoEfeito || mech.descricao || '';
    }
    return mech.descricao || '';
}

/* ===== UI DE DISTRIBUIÇÃO ===== */

/**
 * Resolve a config de distribuição considerando nível evoluível.
 */
function _resolveDistribuirConfig(mech, parentPec) {
    let config = mech.config ? JSON.parse(JSON.stringify(mech.config)) : {};

    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog) {
            if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
            if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
            if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
        }
    }
    return config;
}

/**
 * Renderiza a UI de distribuição.
 * Se já houver alvos confirmados parcialmente, mostra-os travados e oferece os slots restantes.
 * Se todos os slots estiverem preenchidos, mostra apenas o resumo.
 */
function renderDistribuirUI(container, mech, parentPec) {
    const config = _resolveDistribuirConfig(mech, parentPec);

    const pool = getDistribuirPool(config.pool);
    const totalQty = config.quantidadeAlvos || 1;
    const valorPorAlvo = config.valorPorAlvo || 1;
    const restricao = config.restricao || '';

    // Buscar alvos já confirmados
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const remaining = totalQty - jaEscolhidos.length;

    const wrapper = document.createElement('div');
    wrapper.className = 'distribuir-ui';
    wrapper.dataset.mechId = mech.id;

    // --- Resumo do que já foi escolhido ---
    if (jaEscolhidos.length > 0) {
        const resumo = document.createElement('div');
        resumo.className = 'distribuir-resumo';
        const linhas = jaEscolhidos.map(a => `${a.nome} (+${a.valor})`).join(', ');
        resumo.innerHTML = `<strong>✅ Distribuído:</strong> ${linhas}`;
        wrapper.appendChild(resumo);
    }

    // Se todos os slots foram preenchidos, não mostrar mais selects
    if (remaining <= 0) {
        container.appendChild(wrapper);
        return;
    }

    // --- Título ---
    const titulo = document.createElement('div');
    titulo.className = 'distribuir-titulo';
    titulo.innerHTML = `⚠️ <strong>DISTRIBUIÇÃO PENDENTE</strong><br>
        Escolha até ${remaining} ${restricao === 'diferentes' ? 'perícias diferentes' : 'alvos'} para receber +${valorPorAlvo} (${jaEscolhidos.length}/${totalQty} distribuído${jaEscolhidos.length !== 1 ? 's' : ''}):`;
    wrapper.appendChild(titulo);

    // --- Selects apenas para os slots restantes ---
    const selectsContainer = document.createElement('div');
    selectsContainer.className = 'distribuir-selects';

    // Nomes já escolhidos (para desabilitar em restricao="diferentes")
    const nomesJaEscolhidos = jaEscolhidos.map(a => a.nome);

    for (let i = 0; i < remaining; i++) {
        const sel = document.createElement('select');
        sel.className = 'distribuir-select';
        sel.dataset.slotIndex = i;
        sel.innerHTML = `<option value="">— Selecione —</option>`;
        pool.forEach(alvoName => {
            const opt = document.createElement('option');
            opt.value = alvoName;
            opt.textContent = alvoName;
            // Desabilitar nomes que já foram confirmados anteriormente
            if (restricao === 'diferentes' && nomesJaEscolhidos.includes(alvoName)) {
                opt.disabled = true;
            }
            sel.appendChild(opt);
        });

        sel.addEventListener('change', () => {
            if (restricao === 'diferentes') {
                updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos);
            }
        });

        selectsContainer.appendChild(sel);
    }
    wrapper.appendChild(selectsContainer);

    // --- Botão de confirmar ---
    const btnConfirmar = document.createElement('button');
    btnConfirmar.className = 'btn-distribuir-confirmar';
    btnConfirmar.textContent = '✅ Confirmar Distribuição';
    btnConfirmar.addEventListener('click', () => confirmarDistribuicao(mech, wrapper, parentPec));
    wrapper.appendChild(btnConfirmar);

    container.appendChild(wrapper);
}

function updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const selectedValues = Array.from(selects).map(s => s.value).filter(Boolean);
    const allUsed = [...(nomesJaEscolhidos || []), ...selectedValues];

    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.querySelectorAll('option').forEach(opt => {
            if (!opt.value) return; // skip placeholder
            opt.disabled = allUsed.includes(opt.value) && opt.value !== currentVal;
        });
    });
}

function confirmarDistribuicao(mech, wrapper, parentPec) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const config = _resolveDistribuirConfig(mech, parentPec);
    const valorPorAlvo = config.valorPorAlvo || 1;

    // Coletar apenas os novos alvos selecionados (não vazios)
    const novosAlvos = [];
    for (const sel of selects) {
        if (sel.value) {
            novosAlvos.push({ nome: sel.value, valor: valorPorAlvo });
        }
    }

    if (novosAlvos.length === 0) {
        alert('Selecione pelo menos 1 alvo antes de confirmar.');
        return;
    }

    // Mesclar com alvos já confirmados anteriormente
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const todosAlvos = [...jaEscolhidos, ...novosAlvos];
    const totalQty = config.quantidadeAlvos || 1;
    const todosPreenchidos = todosAlvos.length >= totalQty;

    // Salvar no state (aplicada=true apenas quando todos preenchidos)
    state.mecanicasAplicadas[mech.id] = {
        aplicada: todosPreenchidos,
        timestamp: new Date().toISOString(),
        fonte: mech.fonte || '',
        alvosEscolhidos: todosAlvos
    };

    // Aplicar bônus dos NOVOS alvos apenas
    for (const alvo of novosAlvos) {
        const field = TARGET_MAP[alvo.nome];
        if (field) {
            state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + alvo.valor;
        }
    }

    // Se todos preenchidos, remover da lista de pendentes
    if (todosPreenchidos) {
        state.mecanicasPendentes = state.mecanicasPendentes.filter(m => m.id !== mech.id);
    }

    // Recalcular e salvar
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    // Re-renderizar peculiaridades para atualizar a UI
    _reRenderPeculiaridades();
}

/**
 * Re-renderiza toda a grid de peculiaridades para refletir mudanças.
 */
function _reRenderPeculiaridades() {
    const grid = document.getElementById('peculiaridadesGrid');
    const racaNome = document.getElementById('selRaca')?.value;
    if (grid && racaNome && window.RACES?.[racaNome]) {
        grid.innerHTML = '';
        window.RACES[racaNome].peculiaridades.forEach(pec => {
            if (typeof renderPeculiaridadeCard === 'function') {
                renderPeculiaridadeCard(pec, racaNome, grid);
            }
        });
    }
}

/**
 * Verifica se uma mecânica distribuir evoluível precisa reabrir a UI
 * porque o novo nível tem mais alvos disponíveis.
 * Chamada após level-up de peculiaridade.
 */
function checkDistribuirOnLevelUp(pec) {
    if (!pec.mecanicas) return;
    for (const mech of pec.mecanicas) {
        if (mech.tipo !== 'distribuir') continue;
        if (!mech.evoluivel || !mech.progressao) continue;

        const config = _resolveDistribuirConfig(mech, pec);
        const totalQty = config.quantidadeAlvos || 1;
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaEscolhidos = dados?.alvosEscolhidos || [];

        // Se o novo nível oferece mais slots do que os já preenchidos, reabrir
        if (jaEscolhidos.length < totalQty) {
            // Garantir que não está marcado como totalmente aplicada
            if (dados) {
                dados.aplicada = false;
            }
            // Adicionar de volta aos pendentes se não estiver lá
            if (!state.mecanicasPendentes.some(m => m.id === mech.id)) {
                state.mecanicasPendentes.push(mech);
            }
        }
    }
    // Re-renderizar para mostrar a UI
    _reRenderPeculiaridades();
}
