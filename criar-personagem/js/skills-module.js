/* ===== PHASE 4 — As Habilidades (Perícias) ===== */

function initPhase4(container) {
    revalidarCompras(); // derruba o que o limitador não sustenta mais e recobra o EXP
    let html = createNarratorBox(NARRADOR_TEXTOS.habilidades);

    const regras = REGRAS_CRIACAO.pericias;

    // Step 1: Select highest (6 points)
    html += `
        <div class="section" id="skillStep1">
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Passo 1 — A Maior (${regras.primario} pontos)</span>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.randomizeSkills()">🎲 Aleatorizar Perícias</button>
            </div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual grupo de perícias define você? Esse grupo recebe <strong>${regras.primario} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep1Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 2: Select second (4 points)
    html += `
        <div class="section" id="skillStep2">
            <div class="section-title">Passo 2 — A Segunda (${regras.segundo} pontos)</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual é seu segundo forte? Esse grupo recebe <strong>${regras.segundo} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep2Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 3: Select worst (2 points)
    html += `
        <div class="section" id="skillStep3">
            <div class="section-title">Passo 3 — A Pior (${regras.fraco} pontos)</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Qual área é sua fraqueza? Esse grupo recebe apenas <strong>${regras.fraco} pontos</strong>.
                O grupo restante ficará automaticamente com <strong>${regras.terceiro} pontos</strong>.
            </p>
            <div class="group-selector" id="skillStep3Selector" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>
    `;

    // Step 4: Distribute skills
    html += `
        <div class="section">
            <div class="section-title">Passo 4 — Distribuir Perícias</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                Máximo padrão <strong>${regras.limite_max_por_pericia}</strong> por perícia com os pontos iniciais
                (Peculiaridades podem alterar esse teto). A sigla ao lado do nome é o
                <strong>atributo limitador</strong>: a perícia nunca passa do nível dele.
            </p>
            ${criarGuiaCompraExp('pericia')}
            <div id="skillDistGrid" class="attr-dist-grid"></div>
        </div>
    `;

    // Step 5: Exclusivas da classe (só com EXP)
    html += `
        <div class="section" id="skillExclusivasSection">
            <div class="section-title">Passo 5 — Perícias Exclusivas da Classe</div>
            <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
                São as perícias que só a sua classe conhece — o que separa um Bardo de qualquer
                pessoa que sabe cantar. <strong>Os pontos iniciais não entram aqui</strong>: os quatro
                grupos acima pagam apenas perícias comuns. Exclusiva só sobe <strong>gastando EXP</strong>,
                pelo botão <strong>+</strong>, e vale o mesmo teto de nível ${REGRAS_CRIACAO.compra_exp.teto_nivel}
                e o mesmo atributo limitador das demais.
            </p>
            <div id="skillExclusivasGrid"></div>
        </div>
    `;

    // Memórias
    html += createMemoryBox('habilidades', 'Descreva como você aprendeu essas habilidades. Foi com um mentor? Sozinho? Por necessidade desesperada?', false, '✍️ Memória das melhores habilidades');
    html += createMemoryBox('habilidades_fraco', 'Essas são as coisas que você nunca praticou muito. Por quê? Falta de interesse, de oportunidade, ou algo te afastou delas?', false, '✍️ Memória das piores habilidades');

    container.innerHTML = html;

    renderSkillStepSelectors();
    renderSkillDistribution();
}

const _skillGroupLabels = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate' };
const _skillGroups = ['mental', 'fisico', 'social', 'combate'];

function renderSkillStepSelectors() {
    const regras = REGRAS_CRIACAO.pericias;
    const pools = [regras.primario, regras.segundo, regras.fraco];
    const stateKeys = ['grupoPericiaPrimario', 'grupoPericia2', 'grupoPericiaFraco'];
    const stepIds = ['skillStep1Selector', 'skillStep2Selector', 'skillStep3Selector'];

    for (let step = 0; step < 3; step++) {
        const container = document.getElementById(stepIds[step]);
        if (!container) continue;

        let html = '';
        for (const grp of _skillGroups) {
            const isSelectedHere = wizardState[stateKeys[step]] === grp;

            html += `
                <div class="group-card ${isSelectedHere ? 'selected' : ''}"
                     data-skill-group="${grp}"
                     onclick="selectSkillStep(${step}, '${grp}')"
                     style="cursor:pointer;">
                    <div class="group-card-title">${_skillGroupLabels[grp]}</div>
                    <div class="group-card-points">${isSelectedHere ? pools[step] : '?'}</div>
                    <div class="group-card-label">${isSelectedHere ? ['1º Maior', '2º Segundo', '3º Pior'][step] : _getSkillStepLabel(grp)}</div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
}

function _getSkillStepLabel(grp) {
    if (wizardState.grupoPericiaPrimario === grp) return '1º Maior';
    if (wizardState.grupoPericia2 === grp) return '2º Segundo';
    if (wizardState.grupoPericiaFraco === grp) return '3º Pior';
    if (wizardState.grupoPericia3 === grp) return '4º Terceiro';
    return 'Selecione';
}

// Mesma regra dos atributos: reclicar desmarca, e escolher um grupo já usado em
// outro passo libera esse outro passo. Toda mudança zera as perícias distribuídas.
function selectSkillStep(step, group) {
    const stateKeys = ['grupoPericiaPrimario', 'grupoPericia2', 'grupoPericiaFraco'];

    wizardState[stateKeys[step]] = wizardState[stateKeys[step]] === group ? null : group;
    for (let i = 0; i < stateKeys.length; i++) {
        if (i !== step && wizardState[stateKeys[i]] === group) wizardState[stateKeys[i]] = null;
    }

    for (const key of Object.keys(wizardState.pericias || {})) wizardState.pericias[key] = 0;

    // Auto-assign the remaining group as "terceiro" (3 points)
    _autoAssignThirdGroup();

    aposMudarPericias();
}

function _autoAssignThirdGroup() {
    const assigned = [wizardState.grupoPericiaPrimario, wizardState.grupoPericia2, wizardState.grupoPericiaFraco].filter(Boolean);
    if (assigned.length === 3) {
        const remaining = _skillGroups.find(g => !assigned.includes(g));
        wizardState.grupoPericia3 = remaining || null;
    } else {
        wizardState.grupoPericia3 = null;
    }
}

function autoAssignSkillPriority() {
    const shuffled = [..._skillGroups].sort(() => Math.random() - 0.5);

    wizardState.grupoPericiaPrimario = shuffled[0];
    wizardState.grupoPericia2 = shuffled[1];
    wizardState.grupoPericiaFraco = shuffled[2];
    wizardState.grupoPericia3 = shuffled[3];

    aposMudarPericias();
}

function getSkillGroupPool(group) {
    if (group === wizardState.grupoPericiaPrimario) return REGRAS_CRIACAO.pericias.primario;
    if (group === wizardState.grupoPericia2) return REGRAS_CRIACAO.pericias.segundo;
    if (group === wizardState.grupoPericia3) return REGRAS_CRIACAO.pericias.terceiro;
    if (group === wizardState.grupoPericiaFraco) return REGRAS_CRIACAO.pericias.fraco;
    return 0;
}

const _ATTR_KEY_MAP = {
    'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
    'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
    'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut'
};

function _resolveAttrKey(nome) {
    const upper = String(nome).trim().toUpperCase();
    if (_ATTR_KEY_MAP[upper]) return _ATTR_KEY_MAP[upper];
    if (upper.startsWith('ATTR_')) return upper.toLowerCase();
    for (const group of Object.values(ATRIBUTOS)) {
        for (const attr of group) {
            if (attr.id.toUpperCase() === upper || attr.nome.toUpperCase() === upper || attr.key.toUpperCase() === upper) {
                return attr.key;
            }
        }
    }
    return null;
}

/**
 * Nível do atributo que limita esta perícia. Perícia com mais de um atributo
 * base é limitada pelo MENOR deles — é a mesma regra da ficha (SKILL_LIMITERS
 * mode 'min'); lendo só o primeiro, a criação deixava passar nível que a ficha
 * depois recusava.
 */
function getSkillParentAttributeLevel(sk) {
    const attrSource = sk.atributoBase || sk.attr;
    if (!attrSource) return Infinity;

    const nomes = Array.isArray(attrSource) ? attrSource : String(attrSource).split('/');
    // Mesmo nível que a ficha usa como limitador: dots + bônus de mecânica.
    const bonus = bonusDeMecanicas();
    const niveis = nomes.map(_resolveAttrKey).filter(Boolean)
        .map(k => nivelAtributo(k) + (bonus[k] || 0));
    return niveis.length ? Math.min(...niveis) : Infinity;
}

/** Teto de PONTOS INICIAIS desta perícia: teto de criação e atributo limitador. */
function getSkillMaxPontos(sk) {
    const parentLevel = getSkillParentAttributeLevel(sk);
    let defaultMax = REGRAS_CRIACAO.pericias.limite_max_por_pericia;
    let wasModified = false;
    if (window.getDynamicCreationLimit) {
        const dynamicGroup = window.getDynamicCreationLimit('Perícias (qualquer)', defaultMax, wizardState);
        const dynamicSpecific = window.getDynamicCreationLimit(sk.name, dynamicGroup, wizardState);
        if (dynamicSpecific > defaultMax) {
            defaultMax = dynamicSpecific;
            wasModified = true;
        }
    }
    return { max: wasModified ? defaultMax : Math.min(defaultMax, parentLevel), parentLevel, tetoCriacao: defaultMax };
}

/** Teto de nível comprando com EXP: o 5 do sistema, ou o atributo limitador, o que vier antes. */
function getSkillTetoExp(sk) {
    return Math.min(REGRAS_CRIACAO.compra_exp.teto_nivel, getSkillParentAttributeLevel(sk));
}

function estadoCompraPericia(sk) {
    const dotKey = 'sk_' + sk.key;
    const teto = getSkillTetoExp(sk);
    const parentLevel = getSkillParentAttributeLevel(sk);
    const motivoTeto = parentLevel < REGRAS_CRIACAO.compra_exp.teto_nivel
        ? `Travada em ${parentLevel} pelo atributo limitador (${sk.attrLabel}). Suba o atributo primeiro.`
        : `Nível ${REGRAS_CRIACAO.compra_exp.teto_nivel} é o teto do sistema — nem com EXP passa disso.`;

    return avaliarCompraExp({
        nivel: nivelPericia(dotKey),
        comprados: wizardState.periciasExp[dotKey] || 0,
        custoPorNivel: sk.custoExp,
        teto,
        motivoTeto
    });
}

/** Uma linha de perícia. `grupo` null = exclusiva (sem pontos iniciais, só EXP). */
function renderSkillRow(sk, grupo, bonus) {
    const dotKey = 'sk_' + sk.key;
    const pontos = wizardState.pericias[dotKey] || 0;
    const total = nivelPericia(dotKey);
    // O que a peculiaridade soma por cima (fixo da classe ou distribuído). Fica
    // FORA de nivelPericia: a ficha reaplica a mecânica, somar aqui dobraria.
    const mec = (bonus || bonusDeMecanicas())[dotKey] || 0;
    const comMec = total + mec;
    const maxPontos = grupo ? getSkillMaxPontos(sk).max : 0;
    const est = estadoCompraPericia(sk);

    const tooltip = `${sk.name} (${sk.attrLabel}) — ${sk.custoExp} EXP por nível.\n${sk.descricao || ''}`;

    let dots = '';
    for (let d = 1; d <= 5; d++) {
        const classes = ['dot'];
        if (d <= pontos) classes.push('filled');
        else if (d <= total) classes.push('filled', 'exp');
        else if (d <= comMec) classes.push('filled', 'mec');

        const soExp = d > maxPontos;
        const titulo = d > total && d <= comMec
            ? `Vem de peculiaridade (${mec > 0 ? '+' : ''}${mec}) — soma por cima do que você treinar.`
            : (!grupo
                ? 'Exclusiva: não recebe ponto inicial, só EXP pelo botão +.'
                : (soExp ? `Acima do que os pontos iniciais alcançam (${maxPontos}) — daqui pra cima só com EXP no +.`
                         : `Nível ${d} com os pontos iniciais do grupo`));

        dots += `<button class="${classes.join(' ')}" data-skill="${dotKey}" data-dot="${d}"
            title="${escHtml(titulo)}" ${soExp ? 'disabled' : `onclick="clickSkillDot('${dotKey}', ${d}, '${grupo}')"`}></button>`;
    }

    return `
        <div class="attr-dist-row skill-row" title="${escHtml(tooltip)}">
            <span class="attr-dist-name skill-name">${escHtml(sk.name)}</span>
            <span class="skill-attr" title="Atributo limitador">${escHtml(sk.attrLabel)}</span>
            <div class="attr-dist-dots dots5">${dots}</div>
            ${criarBotoesCompraExp('comprarPericiaExp', 'venderPericiaExp', sk.key, est)}
        </div>`;
}

function renderSkillDistribution() {
    const container = document.getElementById('skillDistGrid');
    if (!container) return;

    let html = '';
    const bonus = bonusDeMecanicas();
    for (const grp of _skillGroups) {
        const skills = window.SKILLS?.[grp] || [];
        const pool = getSkillGroupPool(grp);
        const remaining = getSkillGroupRemaining(grp);

        html += `
            <div class="attr-dist-block">
                <div class="attr-dist-title">${_skillGroupLabels[grp]}</div>
                <div class="attr-dist-counter" id="skillCounter_${grp}">Restante: ${remaining}/${pool}</div>
        `;
        for (const sk of skills) html += renderSkillRow(sk, grp, bonus);
        html += `</div>`;
    }
    container.innerHTML = html;

    renderSkillExclusivas();
}

/**
 * Exclusivas visíveis a este personagem: as da classe escolhida (pericClasse) mais
 * as marcadas como `todoPersonagem` no cadastro. Mesma conta que a ficha faz.
 */
function getExclusivasDisponiveis() {
    const exclusivas = window.SKILLS?.exclusivo || [];
    const daClasse = wizardState.classeSelecionada
        ? (window.CLASS_SKILLS[wizardState.classeSelecionada] || [])
        : [];
    return exclusivas.filter(sk => sk.todoPersonagem || daClasse.includes(sk.name));
}

function renderSkillExclusivas() {
    const container = document.getElementById('skillExclusivasGrid');
    if (!container) return;

    const skills = getExclusivasDisponiveis();
    if (!skills.length) {
        container.innerHTML = `
            <div class="guia-box">
                ${wizardState.classeSelecionada
                    ? `A classe <strong>${escHtml(wizardState.classeSelecionada)}</strong> não tem perícias exclusivas cadastradas.`
                    : 'Escolha uma classe na Etapa 2 para ver as perícias exclusivas dela aqui.'}
            </div>`;
        return;
    }

    const gasto = ExpTracker.custoComprasPericias();
    let html = `
        <div class="attr-dist-block">
            <div class="attr-dist-title">🌟 ${escHtml(wizardState.classeSelecionada || 'Exclusivas')}</div>
            <div class="attr-dist-counter">${skills.length} exclusiva(s) · ${gasto} EXP gastos em perícias · ${ExpTracker.getTotal()} EXP no pool</div>`;

    const bonus = bonusDeMecanicas();
    for (const sk of skills) {
        html += renderSkillRow(sk, null, bonus);
        if (sk.descricao) {
            html += `<div class="skill-desc" title="${escHtml(sk.descricao)}">${escHtml(sk.descricao)}</div>`;
        }
    }
    container.innerHTML = html + `</div>`;
}

/* ===== COMPRA DE PERÍCIA COM EXP ===== */

function _skillPorKey(key) {
    for (const lista of Object.values(window.SKILLS || {})) {
        const found = (lista || []).find(s => s.key === key);
        if (found) return found;
    }
    return null;
}

function comprarPericiaExp(key) {
    const sk = _skillPorKey(key);
    if (!sk) return;

    const est = estadoCompraPericia(sk);
    if (est.bloqueio) { showWizardToast(est.bloqueio.motivo, 'error'); return; }

    const dotKey = 'sk_' + key;
    wizardState.periciasExp[dotKey] = (wizardState.periciasExp[dotKey] || 0) + 1;
    aposMudarPericias();
}

function venderPericiaExp(key) {
    const dotKey = 'sk_' + key;
    if (!wizardState.periciasExp[dotKey]) return;
    wizardState.periciasExp[dotKey]--;
    aposMudarPericias();
}

/** Derruba nível comprado que o teto 5 ou o atributo limitador não sustentam mais. */
function clampComprasPericias() {
    for (const [dotKey, comprados] of Object.entries(wizardState.periciasExp || {})) {
        if (!comprados) continue;
        const sk = _skillPorKey(dotKey.replace(/^sk_/, ''));
        if (!sk) continue;
        const sobra = getSkillTetoExp(sk) - (wizardState.pericias[dotKey] || 0);
        if (comprados > sobra) wizardState.periciasExp[dotKey] = Math.max(0, sobra);
    }
}

// A revalidação roda aqui, e não só no render: o EXP do pool não pode depender
// de a fase estar montada na tela.
function aposMudarPericias() {
    revalidarCompras();
    forceRerender(getPhaseIndex(4));
    saveWizardToStorage();
}

function clickSkillDot(dotKey, dotLevel, group) {
    if (!wizardState.grupoPericiaPrimario) {
        showWizardToast('Defina as prioridades de perícias primeiro.', 'error');
        return;
    }

    const current = wizardState.pericias[dotKey] || 0;
    const skills = window.SKILLS?.[group] || [];
    const sk = skills.find(s => 'sk_' + s.key === dotKey);
    if (!sk) return;

    const { max: maxAllowed, parentLevel, tetoCriacao } = getSkillMaxPontos(sk);

    // Toggle off if same
    if (dotLevel === current) {
        wizardState.pericias[dotKey] = 0;
    } else {
        if (dotLevel > maxAllowed) {
            if (dotLevel > parentLevel) {
                showWizardToast(`${sk.name} trava em ${parentLevel}: é o nível do atributo limitador (${sk.attrLabel}). Suba o atributo primeiro.`, 'error');
            } else {
                showWizardToast(`Máximo ${tetoCriacao} por perícia com os pontos iniciais — acima disso, só comprando com EXP no botão +.`, 'error');
            }
            return;
        }

        const delta = dotLevel - current;
        const remaining = getSkillGroupRemaining(group);
        if (delta > remaining) {
            showWizardToast(`Pontos insuficientes! Restam ${remaining} no grupo. Você ainda pode subir esta perícia com EXP no botão +.`, 'error');
            return;
        }

        // Ponto inicial ocupa o degrau que o EXP já tinha pago — devolve o EXP.
        if (wizardState.periciasExp[dotKey] > 0) {
            wizardState.periciasExp[dotKey] = Math.max(0, wizardState.periciasExp[dotKey] - delta);
        }
        wizardState.pericias[dotKey] = dotLevel;
    }

    aposMudarPericias();
}

function getSkillGroupRemaining(group) {
    const pool = getSkillGroupPool(group);
    const skills = window.SKILLS?.[group] || [];
    let spent = 0;
    for (const sk of skills) {
        const dotKey = 'sk_' + sk.key;
        spent += (wizardState.pericias[dotKey] || 0);
    }
    return pool - spent;
}

window.randomizeSkills = function() {
    const shuffled = [..._skillGroups].sort(() => Math.random() - 0.5);
    wizardState.grupoPericiaPrimario = shuffled[0];
    wizardState.grupoPericia2 = shuffled[1];
    wizardState.grupoPericiaFraco = shuffled[2];
    wizardState.grupoPericia3 = shuffled[3];
    
    if (!wizardState.pericias) wizardState.pericias = {};
    for (const key of Object.keys(wizardState.pericias)) {
        wizardState.pericias[key] = 0;
    }
    
    for (const grp of _skillGroups) {
        const skills = window.SKILLS?.[grp] || [];
        if (skills.length === 0) continue;
        
        let attempts = 0;
        while (getSkillGroupRemaining(grp) > 0 && attempts < 100) {
            attempts++;
            const sk = skills[Math.floor(Math.random() * skills.length)];
            const dotKey = 'sk_' + sk.key;
            const currentLevel = wizardState.pericias[dotKey] || 0;
            const targetLevel = currentLevel + 1;
            
            if (targetLevel > getSkillMaxPontos(sk).max) continue;
            
            wizardState.pericias[dotKey] = targetLevel;
            attempts = 0;
        }
    }

    aposMudarPericias();
};
