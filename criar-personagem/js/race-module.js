/* ===== PHASE 1 — Raças ===== */

/** Raça de criatura (tag 'Criatura') não entra em lista de escolha de jogador. */
function ehRacaDeCriatura(r) { return /criatura/i.test(String(r?.tags || '')); }

function initPhase1(container) {
    let html = '';

    // === RAÇA ===
    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_raca);
    html += `<div class="section"><div class="section-title">🧬 Escolha sua Raça</div>`;
    html += `<div class="selection-grid selection-grid-visual" id="raceGrid">`;

    const races = window._systemData.races
        // raça de bicho é publicada para as fichas de NPC referenciarem; jogador não escolhe
        .filter(r => r.publicado !== false && !ehRacaDeCriatura(r))
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const race of races) {
        const sel = wizardState.racaSelecionada === race.nome ? 'selected' : '';
        html += `
            <div class="selection-card card-visual ${sel}" data-race="${escHtml(race.nome)}" onclick="selectRace(this.dataset.race)">
                ${race.imagemUrl ? `<img class="selection-card-img-full" src="${escHtml(race.imagemUrl)}" alt="${escHtml(race.nome)}" loading="lazy">` : '<div class="selection-card-img-placeholder">🧬</div>'}
                <div class="selection-card-title">${escHtml(race.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(race.subtitulo || '')}</div>
                <button type="button" class="selection-card-info-btn" title="Ver detalhes de ${escHtml(race.nome)}" onclick="openRaceModal(this.closest('.selection-card').dataset.race, event)">
                    <span class="info-icon">ℹ️</span>
                    <span class="info-text">Ver detalhes</span>
                </button>
            </div>
        `;
    }
    html += `</div>`;
    html += `</div>`;

    // Memory for race
    html += createMemoryBox('linhagem_raca', 'O que você viu pela primeira vez quando se olhou no espelho e percebeu que era diferente dos outros? Descreva essa memória. Quando você se olha no espelho, tem algo que te incomoda? Há algo na sua aparência que reflete o caminho que você escolheu?', false);

    container.innerHTML = html;
}

/* ===== PHASE 1B — Classes ===== */

function initPhase1B(container) {
    let html = '';

    html += createNarratorBox(NARRADOR_TEXTOS.linhagem_classe);
    html += `<div class="section"><div class="section-title">⚔️ Escolha sua Classe</div>`;
    html += `<div class="selection-grid selection-grid-visual" id="classGrid">`;

    const classes = window._systemData.classes
        .filter(c => c.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    for (const cls of classes) {
        const sel = wizardState.classeSelecionada === cls.nome ? 'selected' : '';
        const citacao = cls.citacao || cls.citacaoIconica || '';
        html += `
            <div class="selection-card card-visual ${sel}" data-class="${escHtml(cls.nome)}" onclick="selectClass(this.dataset.class)">
                ${cls.imagemUrl ? `<img class="selection-card-img-full" src="${escHtml(cls.imagemUrl)}" alt="${escHtml(cls.nome)}" loading="lazy">` : '<div class="selection-card-img-placeholder">⚔️</div>'}
                <div class="selection-card-title">${escHtml(cls.nome)}</div>
                <div class="selection-card-subtitle">${escHtml(cls.arquetipo || '')}</div>
                ${citacao ? `<div class="selection-card-quote">"${escHtml(citacao).substring(0, 60)}${citacao.length > 60 ? '...' : ''}"</div>` : ''}
                <button type="button" class="selection-card-info-btn" title="Ver detalhes de ${escHtml(cls.nome)}" onclick="openClassModal(this.closest('.selection-card').dataset.class, event)">
                    <span class="info-icon">ℹ️</span>
                    <span class="info-text">Ver detalhes</span>
                </button>
            </div>
        `;
    }
    html += `</div>`;
    html += `</div>`;

    // Memory for class
    html += createMemoryBox('linhagem_classe', 'Qual foi o momento em que você percebeu que esse era o seu caminho? Foi uma escolha ou uma imposição? Descreva. Quem te ensinou isso? Um mentor, um livro, a necessidade? Descreva essa pessoa ou momento.', false);

    container.innerHTML = html;
}

function selectRace(raceName) {
    wizardState.racaSelecionada = raceName;

    // Update card selection
    document.querySelectorAll('#raceGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.race === raceName);
    });

    updateMiniPreview();
    saveWizardToStorage();
    forceRerender(getPhaseIndex(2.5)); // Peculiaridades Herdadas
}

function openRaceModal(raceName, event) {
    if (event) event.stopPropagation();
    
    const raceData = window._systemData.races.find(r => r.nome === raceName);
    const raceBuilt = window.RACES[raceName];
    if (!raceData) return;

    let html = `
    <div class="detail-modal" id="raceModal" onclick="this.remove()">
        <div class="detail-modal-content" onclick="event.stopPropagation()">
            <button class="detail-modal-close" onclick="document.getElementById('raceModal').remove()">✕</button>
            <h3 style="margin:0 0 8px;">${escHtml(raceData.nome)}</h3>`;

    if (raceData.subtitulo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(raceData.subtitulo)}</p>`;

    // Fields grid
    const fields = [
        ['Tamanho', raceData.tamanho],
        ['Expectativa de Vida', raceData.expectativaVida],
        ['Tendência', raceData.tendencia],
        ['Aparência', raceData.aparencia],
        ['Habitat', raceData.habitat]
    ].filter(f => f[1]);

    if (fields.length) {
        html += `<div class="detail-fields-grid">`;
        for (const [label, val] of fields) {
            html += `<div class="detail-field"><span class="detail-field-label">${escHtml(label)}</span><span class="detail-field-value">${escHtml(val)}</span></div>`;
        }
        html += `</div>`;
    }

    // Historia
    if (raceData.historia || raceData.lore) {
        html += `<div class="detail-section"><div class="detail-section-title">📜 História</div><div class="detail-section-text">${escHtml(raceData.historia || raceData.lore)}</div></div>`;
    }

    // Curiosidades
    if (raceData.curiosidades) {
        const curios = Array.isArray(raceData.curiosidades) ? raceData.curiosidades : [raceData.curiosidades];
        html += `<div class="detail-section"><div class="detail-section-title">💡 Curiosidades</div><div class="detail-tag-list">`;
        for (const c of curios) {
            html += `<span class="detail-tag">${escHtml(c)}</span>`;
        }
        html += `</div></div>`;
    }

    // 📖 Livro vinculado (Worldbuilding) — leitura dos capítulos liberados
    html += window.lvSecaoHTML ? window.lvSecaoHTML(raceData) : '';

    // 🧮 Valores Derivados da Raça — o valor inicial é o traço racial
    const dvsRaca = resolveDerivedValueEntries(raceData.derivedValueIds);
    if (dvsRaca.length) {
        html += `<div class="detail-section"><div class="detail-section-title">🧮 Valores Derivados</div><div class="detail-collapse-list">`;
        for (const { dv, valorInicial } of dvsRaca) html += renderDerivedValue(dv, valorInicial);
        html += `</div></div>`;
    }

    // Peculiaridades Raciais — um bloco retrátil por pec, igual a classes
    if (raceBuilt?.peculiaridades?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades Raciais</div><div class="detail-collapse-list">`;
        for (const pec of raceBuilt.peculiaridades) html += renderPecCollapse(pec);
        html += `</div></div>`;
    }

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

/** 🔮 O ramo que vem de graça com a classe (Livro, p. 7). */
window.selectRamoInicial = function (modId) {
    wizardState.ramoInicial = modId;
    saveWizardToStorage();
    document.querySelectorAll('input[name="ramoInicial"]').forEach(r => { r.checked = r.value === modId; });
};

function selectClass(className) {
    wizardState.classeSelecionada = className;
    wizardState.kitInicialSelecionado = null; // Reseta o kit ao trocar de classe
    wizardState.ramoInicial = null;           // e o ramo inicial

    document.querySelectorAll('#classGrid .selection-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.class === className);
    });

    updateMiniPreview();
    saveWizardToStorage();
    forceRerender(getPhaseIndex(2.5)); // Peculiaridades Herdadas
    forceRerender(getPhaseIndex(4));   // Perícias de Classe
    forceRerender(getPhaseIndex(7));   // Equipamento (Kits Iniciais)
}

function openClassModal(className, event) {
    if (event) event.stopPropagation();

    const cls = window._systemData.classes.find(c => c.nome === className);
    if (!cls) return;

    let html = `
    <div class="detail-modal" id="classModal" onclick="this.remove()">
        <div class="detail-modal-content" onclick="event.stopPropagation()">
            <button class="detail-modal-close" onclick="document.getElementById('classModal').remove()">✕</button>
            <h3 style="margin:0 0 8px;">${escHtml(cls.nome)}</h3>`;

    if (cls.arquetipo) html += `<p style="color:var(--muted);font-style:italic;margin:0 0 12px;">${escHtml(cls.arquetipo)}</p>`;

    // Citação
    const citacao = cls.citacao || cls.citacaoIconica;
    if (citacao) html += `<div class="detail-quote">"${escHtml(citacao)}"</div>`;

    // Descrição
    if (cls.descricao) {
        html += `<div class="detail-section"><div class="detail-section-title">📖 Descrição</div><div class="detail-section-text">${escHtml(cls.descricao)}</div></div>`;
    }

    // Papel em Cena
    const papelCombate = cls.papelEmCena?.[0]?.combate || cls.papelEmCombate;
    const papelFora = cls.papelEmCena?.[0]?.foraCombate || cls.papelForaCombate;
    if (papelCombate || papelFora) {
        html += `<div class="detail-section"><div class="detail-section-title">🎭 Papel em Cena</div>`;
        if (papelCombate) html += `<div class="detail-role-item"><strong>⚔️ Em Combate:</strong> ${escHtml(papelCombate)}</div>`;
        if (papelFora) html += `<div class="detail-role-item"><strong>🏕️ Fora de Combate:</strong> ${escHtml(papelFora)}</div>`;
        html += `</div>`;
    }

    // Recursos da Classe
    const recursos = cls.recursosDaClasse?.[0];
    if (recursos) {
        html += `<div class="detail-section"><div class="detail-section-title">🔋 Recursos da Classe</div><div class="detail-fields-grid">`;
        if (recursos.primario) html += `<div class="detail-field"><span class="detail-field-label">Primário</span><span class="detail-field-value">${escHtml(recursos.primario)}</span></div>`;
        if (recursos.secundario) html += `<div class="detail-field"><span class="detail-field-label">Secundário</span><span class="detail-field-value">${escHtml(recursos.secundario)}</span></div>`;
        if (recursos.risco) html += `<div class="detail-field"><span class="detail-field-label">Risco</span><span class="detail-field-value">${escHtml(recursos.risco)}</span></div>`;
        html += `</div></div>`;
    }

    // 🎯 No que a Classe se apoia — atributos e perícias por importância
    const focos = classeFocos(className);
    const listaFoco = itens => itens.map((it, i) =>
        `<span class="detail-tag"><strong>${i + 1}.</strong> ${escHtml(it.nome)}</span>`).join('');
    if (focos.atributos.length || focos.pericias.length) {
        html += `<div class="detail-section"><div class="detail-section-title">🎯 No que a Classe se Apoia</div>`;
        if (focos.atributos.length) {
            html += `<div class="detail-role-item"><strong>💪 Atributos:</strong></div>
                     <div class="detail-tag-list">${listaFoco(focos.atributos.slice(0, 4))}</div>`;
        }
        if (focos.pericias.length) {
            html += `<div class="detail-role-item" style="margin-top:8px;"><strong>📚 Perícias:</strong></div>
                     <div class="detail-tag-list">${listaFoco(focos.pericias.slice(0, 8))}</div>`;
        }
        html += `</div>`;
    }

    // Perícias de Classe — a lista completa, sem ranking
    if (window.CLASS_SKILLS[className]?.length) {
        html += `<div class="detail-section"><div class="detail-section-title">📚 Perícias de Classe</div><div class="detail-tag-list">`;
        for (const sk of window.CLASS_SKILLS[className]) {
            html += `<span class="detail-tag">${escHtml(sk)}</span>`;
        }
        html += `</div></div>`;
    }

    // Manobras/Técnicas
    if (cls.manobras?.length) {
        const maneuverData = (cls.manobras || []).map(mId => {
            return window._systemData.maneuvers?.find(m => m.id === mId);
        }).filter(Boolean);
        if (maneuverData.length) {
            html += `<div class="detail-section"><div class="detail-section-title">💥 Manobras / Técnicas</div><div class="detail-fields-grid">`;
            for (const man of maneuverData) {
                const rotulo = man.custo ? `${man.nome} · ${man.custo}` : man.nome;
                html += `<div class="detail-field"><span class="detail-field-label">${escHtml(rotulo)}</span><span class="detail-field-value">${escHtml(man.efeito || '—')}</span></div>`;
            }
            html += `</div></div>`;
        }
    }

    // 📦 Módulos da Classe — o que o jogador vai poder cadastrar na ficha.
    // Entradas podem ser ID (novo formato) ou objeto inline (legado).
    const modulos = (cls.modulosDaClasse || []).map(entry =>
        typeof entry === 'string'
            ? (window._systemData.classModules || []).find(m => m.id === entry)
            : entry
    ).filter(Boolean);
    if (modulos.length) {
        html += `<div class="detail-section"><div class="detail-section-title">📦 Módulos da Classe</div><div class="detail-collapse-list">`;
        for (const mod of modulos) {
            const itens = Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [];
            const meta = [`${itens.length} ${itens.length === 1 ? 'opção' : 'opções'}`];
            const lim = mod.limiteFixo;
            if (lim !== null && lim !== undefined && lim !== '') meta.push(`${lim} ${Number(lim) === 1 ? 'slot' : 'slots'}`);
            // 🔮 Ramo opcional (Livro, p. 7): um de graça na criação, o outro por EXP depois.
            const ramoOpc = !!mod.ramoOpcional;
            if (ramoOpc) meta.push(wizardState.ramoInicial === mod.id ? '✅ ramo inicial' : 'ramo opcional — marque um');
            if (mod.custoExpLabel) meta.push(mod.custoExpLabel);
            else if (mod.custoExpPorItem) meta.push(`${mod.custoExpPorItem} EXP/item`);
            html += `<details class="detail-collapse lr-sanfona">
                <summary class="detail-collapse-summary">
                    <span class="detail-collapse-title">${ramoOpc ? `<input type="radio" name="ramoInicial" value="${escHtml(mod.id)}" ${wizardState.ramoInicial === mod.id ? 'checked' : ''} onclick="event.stopPropagation(); selectRamoInicial(this.value)" title="Ramo inicial (de graça)"> ` : ''}${escHtml(mod.icone || '📦')} ${escHtml(mod.titulo || mod.id)}</span>
                    <span class="detail-collapse-meta">${escHtml(meta.join(' · '))}</span>
                </summary>`;
            if (itens.length) {
                html += `<div class="detail-collapse-body"><div class="cm-item-list">`;
                for (const it of itens) html += renderModuleItem(mod, it);
                html += `</div></div>`;
            } else {
                html += `<div class="detail-collapse-empty">${mod.permitirCriacaoJogador === false ? 'Nenhuma opção cadastrada.' : 'Sem opções pré-cadastradas — o item é criado na ficha.'}</div>`;
            }
            html += `</details>`;
        }
        html += `</div></div>`;
    }

    // 🧮 Valores Derivados da Classe
    // ᛟ Runomancia — a classe usa o subsistema do Laboratorium no lugar de
    // módulos, então o acesso entra onde os módulos apareceriam.
    if (cls.usaRunomancia === true) {
        html += `<div class="detail-section">
            <div class="detail-section-title">ᛟ Runomancia</div>
            <a class="btn" href="../laboratorium-runarum/laboratorium.html" target="_blank" rel="noopener"
               style="margin-top:4px;text-decoration:none">ᛟ&nbsp; Explorar o Laboratorium Runarum</a>
        </div>`;
    }

    const dvsClasse = resolveDerivedValueEntries(cls.derivedValueIds);
    if (dvsClasse.length) {
        html += `<div class="detail-section"><div class="detail-section-title">🧮 Valores Derivados</div><div class="detail-collapse-list">`;
        for (const { dv, valorInicial } of dvsClasse) html += renderDerivedValue(dv, valorInicial);
        html += `</div></div>`;
    }

    // 📖 Livro vinculado (Worldbuilding) — leitura dos capítulos liberados
    html += window.lvSecaoHTML ? window.lvSecaoHTML(cls) : '';

    // Peculiaridades de Classe — um bloco retrátil por pec, igual aos módulos
    const pecsClasse = window.CLASS_PECULIARITIES[className] || [];
    if (pecsClasse.length) {
        html += `<div class="detail-section"><div class="detail-section-title">⚡ Peculiaridades de Classe</div><div class="detail-collapse-list">`;
        for (const pec of pecsClasse) html += renderPecCollapse(pec);
        html += `</div></div>`;
    }

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

/* ===== SHARED: Render a peculiarity with its linked mechanics ===== */

/* ===== SHARED: Valor Derivado em bloco retrátil =====
   Não existe campo 'formula' no cadastro — o cálculo mora nas mecânicas
   vinculadas (dv.mecanicaIds), que generatePreviewText() traduz para texto. */
/* ===== SHARED: peculiaridade em bloco retrátil (classe, raça, tribo) ===== */
function renderPecCollapse(pec) {
    const nNiveis = (pec.tipo === 'evolutivo' && pec.niveis) ? Object.keys(pec.niveis).length : 0;
    // Só afirmamos "Desvantagem" quando o flag está marcado. Chamar de
    // "Vantagem" tudo que não está marcado mentiria, porque o cadastro
    // hoje deixa 'negativo' em false mesmo em traços que são penalidade.
    const meta = nNiveis
        ? `${nNiveis} ${nNiveis === 1 ? 'nível' : 'níveis'}`
        : (pec.negativo ? 'Desvantagem' : '');
    return `<details class="detail-collapse lr-sanfona">
        <summary class="detail-collapse-summary">
            <span class="detail-collapse-title">${escHtml(pec.icone || '📋')} ${escHtml(pec.nome)}</span>
            ${meta ? `<span class="detail-collapse-meta">${escHtml(meta)}</span>` : ''}
        </summary>
        <div class="detail-collapse-body">${renderPecWithMechanics(pec)}</div>
    </details>`;
}

/* ===== SHARED: no que a Classe se apoia, por ordem de importância =====
   Não existe campo "atributos principais" no cadastro: o que a classe usa está
   espalhado nos testes de classe, nas perícias de classe e nas mecânicas das
   peculiaridades dela. Contamos as citações, com peso por fonte, e ordenamos.
   Quem aparece em teste de classe pesa mais que quem só consta da lista. */
const _FOCO_PESOS = { teste: 4, pericClasse: 2, mecanica: 2, pool: 1 };

function _focoAtributo(ref) {
    const t = String(ref || '').trim();
    if (!t) return null;
    return Object.values(ATRIBUTOS).flat()
        .find(a => a.id === t || a.nome === t || a.key === t) || null;
}

function _focoPericia(ref) {
    let t = String(ref || '').trim();
    if (t.startsWith('Perícia: ')) t = t.slice('Perícia: '.length);
    if (!t) return null;
    for (const lista of Object.values(window.SKILLS || {})) {
        const sk = lista.find(s => s.name === t || s.key === t);
        if (sk) return sk;
    }
    return null;
}

/* Tudo que uma mecânica cita da ficha: alvos das contas, refs das equações e o
   pool de uma "distribuir" (esse pesa menos — é opção, não garantia). */
function _focoRefsDaMecanica(mech) {
    const cfg = mech?.config || {};
    const refs = [];
    const calculos = Array.isArray(cfg.calculos) ? cfg.calculos : (cfg.alvo ? [cfg] : []);
    for (const c of calculos) {
        for (const alvo of (Array.isArray(c.alvo) ? c.alvo : [c.alvo])) if (alvo) refs.push([alvo, 'mecanica']);
        for (const t of (c.equacao || [])) if (t.tipo === 'ficha' && t.ref) refs.push([t.ref, 'mecanica']);
    }
    for (const alvo of (cfg.poolPersonalizado || [])) refs.push([alvo, 'pool']);
    return refs;
}

/** { atributos: [{nome, peso}], pericias: [{nome, peso}] } — já ordenados. */
function classeFocos(className) {
    const cls = (window._systemData?.classes || []).find(c => c.nome === className);
    if (!cls) return { atributos: [], pericias: [] };

    const citacoes = [];

    // Perícias de Classe: a perícia e o atributo que a governa.
    for (const nome of (window.CLASS_SKILLS?.[className] || [])) {
        citacoes.push([nome, 'pericClasse']);
        const sk = _focoPericia(nome);
        if (sk?.attrLabel || sk?.attr) citacoes.push([sk.attrLabel || sk.attr, 'pericClasse']);
    }

    // Testes de Classe: a assinatura da classe — fórmula manual ou mecânica.
    for (const t of (cls.testesDeClasse || [])) {
        for (const p of (t.parts || [])) for (const alt of String(p).replace(/^@/, '').split('|')) citacoes.push([alt, 'teste']);
        const mech = t.mecanicaId && (window._systemData.mechanics || []).find(m => m.id === t.mecanicaId);
        if (mech) for (const [ref] of _focoRefsDaMecanica(mech)) citacoes.push([ref, 'teste']);
    }

    // Mecânicas da classe e das peculiaridades/bônus iniciais dela.
    const mechIds = [...(cls.mecanicaIds || [])];
    for (const entry of [...(cls.peculiaridadeIds || []), ...(cls.bonusIniciais || [])]) {
        const pecId = typeof entry === 'object' && entry !== null ? entry.id : entry;
        const pec = (window._systemData.peculiarities || []).find(p => p.id === pecId);
        if (pec) mechIds.push(...(pec.mecanicaIds || []));
    }
    for (const id of new Set(mechIds)) {
        const mech = (window._systemData.mechanics || []).find(m => m.id === id);
        if (mech) citacoes.push(..._focoRefsDaMecanica(mech));
    }

    const attrs = new Map(), skills = new Map();
    const somar = (mapa, chave, peso) => mapa.set(chave, (mapa.get(chave) || 0) + peso);
    for (const [ref, fonte] of citacoes) {
        const peso = _FOCO_PESOS[fonte] || 1;
        const attr = _focoAtributo(ref);
        if (attr) { somar(attrs, attr.nome, peso); continue; }
        const sk = _focoPericia(ref);
        if (!sk) continue;
        somar(skills, sk.name, peso);
        // A perícia puxa o atributo dela junto: é ele que se rola no teste.
        const nomeAttr = _focoAtributo(sk.attrLabel || sk.attr)?.nome;
        if (nomeAttr) somar(attrs, nomeAttr, peso);
    }

    const ordenar = m => [...m.entries()]
        .map(([nome, peso]) => ({ nome, peso }))
        .sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome, 'pt-BR'));

    return { atributos: ordenar(attrs), pericias: ordenar(skills) };
}

/* Entradas de derivedValueIds vêm como ID puro (classes) ou como objeto
   { id, valorInicial } (raças, onde o valor inicial é o traço racial). */
function resolveDerivedValueEntries(entries) {
    return (entries || []).map(x => {
        const obj = (typeof x === 'object' && x !== null);
        const dv = (window._systemData.derivedValues || []).find(d => d.id === (obj ? x.id : x));
        return dv ? { dv, valorInicial: obj ? x.valorInicial : undefined } : null;
    }).filter(Boolean);
}

/* As fórmulas de um Valor Derivado, uma por linha. Uma mecânica pode ter várias
   contas, que generatePreviewText junta com "; ". Separamos e tiramos o sufixo
   " em <nome>" de cada uma — o alvo já é o título do bloco, repetir só polui.
   Usado no modal de detalhes e nos Ajustes de Personagem da Véspera. */
function dvFormulaLines(dv) {
    const nome = String(dv.nome || dv.key || dv.id || '').trim();
    return (dv.mecanicaIds || [])
        .map(id => (window._systemData.mechanics || []).find(m => m.id === id))
        .filter(Boolean)
        .flatMap(m => {
            const txt = String(m.previewTexto || (typeof generatePreviewText === 'function' ? generatePreviewText(m) : '') || '');
            return txt.split(';').map(parte => {
                let p = parte.trim();
                const sufixo = ' em ' + nome;
                if (p.endsWith(sufixo)) p = p.slice(0, -sufixo.length);
                if (p.startsWith('+')) p = p.slice(1);
                return p.trim();
            });
        })
        .filter(Boolean);
}

function renderDerivedValue(dv, valorInicial) {
    const nome = String(dv.nome || dv.key || dv.id || '').trim();
    const formulas = dvFormulaLines(dv);

    const desc = String(dv.descricao || '').trim();
    const temDesc = desc && desc !== nome;
    const unidade = [dv.prefixo, dv.sufixo].filter(Boolean).join(' ').trim();

    const meta = [dv.blocoNome, unidade].filter(Boolean).join(' · ');

    let html = `<details class="detail-collapse lr-sanfona">
        <summary class="detail-collapse-summary">
            <span class="detail-collapse-title">${escHtml(dv.icone || '🧮')} ${escHtml(nome)}</span>
            ${meta ? `<span class="detail-collapse-meta">${escHtml(meta)}</span>` : ''}
        </summary>
        <div class="detail-collapse-body">`;

    // Valor inicial: o traço racial em si (Altura do Yotun, Flutuação do Picxi).
    // Zero costuma significar "só o cálculo vale", então não vira chip.
    const temInicial = valorInicial !== undefined && valorInicial !== null
        && valorInicial !== '' && Number(valorInicial) !== 0;
    if (temInicial) {
        const mostrado = [dv.prefixo, valorInicial, dv.sufixo].filter(v => v !== '' && v !== undefined && v !== null).join(' ');
        html += `<div class="cm-item-stats"><div class="cm-stat"><span class="cm-stat-label">Valor inicial</span><span class="cm-stat-valor">${escHtml(mostrado)}</span></div></div>`;
    }

    if (formulas.length) {
        html += `<div class="cm-item-bloco"><span class="cm-stat-label">Fórmula</span>`;
        for (const f of formulas) html += `<span class="cm-formula">${escHtml(f)}</span>`;
        html += `</div>`;
    } else if (!temInicial) {
        html += `<div class="cm-item-bloco"><span class="cm-stat-label">Fórmula</span><span class="cm-item-texto">Sem cálculo cadastrado.</span></div>`;
    }

    if (temDesc) {
        html += `<div class="cm-item-bloco"><span class="cm-stat-label">Descrição</span><span class="cm-item-texto">${escHtml(desc)}</span></div>`;
    }

    return html + `</div></details>`;
}

/* ===== SHARED: item pré-cadastrado de um módulo de classe =====
   As estatísticas vivem em it.valores, indexadas pelas chaves de mod.schema.
   Campo curto vira chip; textarea ou texto longo vira bloco. Botões e o
   campo que repete o nome do item ficam de fora. */
function renderModuleItem(mod, it) {
    const valores = it.valores || {};
    // ⭐ Livro, p. 7: ramo com Qualidade custa Qualidade × 4 (config/regras); espelho de shared/skill-custo.js
    const qIt = Number(it.qualidade ?? valores.qualidade) || 0;
    const custoIt = (it.custoExpProprio !== null && it.custoExpProprio !== undefined) ? it.custoExpProprio
        : (mod.escolaId && qIt >= 1) ? qIt * (Number(window.REGRAS?.exp?.habilidadePorQualidade) || 4) : mod.custoExpPorItem;

    const chips = [], blocos = [];
    for (const campo of (mod.schema || [])) {
        if (campo.tipo === 'botao' || campo.tipo === 'select_botao' || campo.tipo === 'separador') continue;
        let valor = valores[campo.key];

        if (campo.tipo === 'checkbox') {
            if (valor === null || valor === undefined) continue;
            valor = valor ? 'Sim' : 'Não';
        } else if (campo.tipo === 'tags' || Array.isArray(valor)) {
            if (!Array.isArray(valor) || !valor.length) continue;
            valor = valor.join(', ');
        } else if (campo.tipo === 'select_vd' || campo.tipo === 'valor_derivado') {
            const dv = (window._systemData.derivedValues || []).find(d => d.id === valor);
            valor = dv ? (dv.nome || dv.key || '') : '';
        }

        if (valor === null || valor === undefined || valor === '') continue;
        valor = String(valor).trim();
        if (!valor) continue;
        // Só o campo de texto que repete o título é redundante. Um Valor Derivado
        // homônimo do ritual segue sendo estatística — é o teste que se rola.
        if (campo.tipo === 'text' && valor === String(it.nome || '').trim()) continue;

        const rotulo = String(campo.label || campo.key).replace(/\s*:\s*$/, '');
        (campo.tipo === 'textarea' || valor.length > 60 ? blocos : chips).push({ rotulo, valor });
    }

    // Módulo sem schema preenchido: cai para a descrição solta.
    if (!chips.length && !blocos.length && it.descricao) blocos.push({ rotulo: 'Efeito', valor: it.descricao });

    let html = `<div class="cm-item"><div class="cm-item-head"><span class="cm-item-nome">${escHtml(it.nome)}</span>`;
    if (custoIt) html += `<span class="cm-item-exp">${escHtml(custoIt)} EXP</span>`;
    html += `</div>`;

    if (chips.length) {
        html += `<div class="cm-item-stats">`;
        for (const c of chips) {
            html += `<div class="cm-stat"><span class="cm-stat-label">${escHtml(c.rotulo)}</span><span class="cm-stat-valor">${escHtml(c.valor)}</span></div>`;
        }
        html += `</div>`;
    }
    for (const b of blocos) {
        html += `<div class="cm-item-bloco"><span class="cm-stat-label">${escHtml(b.rotulo)}</span><span class="cm-item-texto">${escHtml(b.valor)}</span></div>`;
    }
    return html + `</div>`;
}

function renderPecWithMechanics(pec) {
    let html = `<div class="detail-pec-item-full ${pec.negativo ? 'negativo' : 'positivo'}">`;
    html += `<div class="detail-pec-header">`;
    html += `<span class="detail-pec-icon">${pec.icone || '📋'}</span>`;
    html += `<span class="detail-pec-name">${escHtml(pec.nome)}</span>`;
    html += `</div>`;

    if (pec.descricao) {
        html += `<div class="detail-pec-desc-full">${escHtml(pec.descricao)}</div>`;
    }

    // Mecânicas vinculadas: só o efeito legível, nunca o nome interno da mecânica
    if (pec.mecanicas?.length) {
        const efeitos = pec.mecanicas
            .map(mech => mech.previewTexto || (typeof generatePreviewText === 'function' ? generatePreviewText(mech) : ''))
            .filter(txt => txt && txt.trim());
        if (efeitos.length) {
            html += `<div class="detail-pec-mechanics">`;
            for (const txt of efeitos) {
                html += `<div class="detail-mechanic-item"><span class="detail-mechanic-info">${escHtml(txt)}</span></div>`;
            }
            html += `</div>`;
        }
    }

    // Níveis evolutivos
    if (pec.tipo === 'evolutivo' && pec.niveis) {
        html += `<div class="detail-pec-levels">`;
        for (const [lvl, info] of Object.entries(pec.niveis)) {
            html += `<div class="detail-pec-level">`;
            html += `<span class="detail-pec-level-num">Nv.${lvl}</span>`;
            html += `<span class="detail-pec-level-cost">${info.custo || ''}</span>`;
            if (info.efeito) html += `<span class="detail-pec-level-effect">${escHtml(info.efeito)}</span>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}
