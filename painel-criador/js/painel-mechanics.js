// =============================================
// VISUAL MECHANICS EDITOR â€” Lendas e RelÃ­quias
// Handles: inline form, preview, mechanic cards,
//          MechanicSelector component
// =============================================

// --- Shared state (set by painel-firebase.js) ---
// window._mechState = { db, collection, getDocs, addDoc, updateDoc, doc, Timestamp, currentUser, ... }

function getMechanicTargetsHTML() {
    let html = `
<optgroup label="Atributos">
<option value="INT">INT</option><option value="RAC">RAC</option><option value="PRS">PRS</option>
<option value="FOR">FOR</option><option value="DES">DES</option><option value="VIG">VIG</option>
<option value="PRE">PRE</option><option value="MAN">MAN</option><option value="AUT">AUT</option>
</optgroup>
`;

    // Status Vitais â€” dinÃ¢mico do Firebase
    const vsCache = window._vitalStatsCache || [];
    const publishedVS = vsCache.filter(v => v.publicado !== false);
    if (publishedVS.length > 0) {
        publishedVS.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Status Vitais">`;
        for (const vs of publishedVS) {
            const icon = vs.icone || 'â¤ï¸';
            html += `\n<option value="${esc(vs.nome)} MÃ¡xima">${icon} ${esc(vs.nome)} MÃ¡xima</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache nÃ£o carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade MÃ¡xima">Vitalidade MÃ¡xima</option>`;
        html += `\n<option value="Energia MÃ¡xima">Energia MÃ¡xima</option>`;
        html += `\n<option value="Sanidade MÃ¡xima">Sanidade MÃ¡xima</option>`;
        html += `\n</optgroup>`;
    }

    // Valores Derivados â€” dinÃ¢mico do Firebase
    const dvCache = window._derivedValuesCache || [];
    const publishedDVs = dvCache.filter(d => d.publicado !== false);
    if (publishedDVs.length > 0) {
        publishedDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Valores Derivados">`;
        for (const dv of publishedDVs) {
            const icon = dv.icone || 'ðŸ“Š';
            html += `\n<option value="${esc(dv.nome)}">${icon} ${esc(dv.nome)}</option>`;
            if (dv.campoAtual) {
                html += `\n<option value="${esc(dv.nome)} (Atual)">${icon} ${esc(dv.nome)} (Atual)</option>`;
                html += `\n<option value="${esc(dv.nome)} (MÃ¡ximo)">${icon} ${esc(dv.nome)} (MÃ¡ximo)</option>`;
            }
        }
        html += `\n</optgroup>`;
    }

    html += `
<optgroup label="Campos da Ficha">
<option value="Blindagem">Blindagem</option>
<option value="Tamanho">Tamanho</option>
</optgroup>`;

    // Build skill options dynamically from skills cache
    const cache = window._skillsCache || [];
    if (cache.length > 0) {
        const byCategory = {};
        for (const sk of cache) {
            const cat = (sk.categoria || 'mental').toLowerCase();
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(sk.nome);
        }
        for (const cat of ['mental', 'fisico', 'social', 'combate', 'exclusivo']) {
            const skills = byCategory[cat];
            if (!skills || skills.length === 0) continue;
            skills.sort((a, b) => a.localeCompare(b));
            const label = CATEGORY_LABELS[cat] || cat;
            html += `\n<optgroup label="${label}">`;
            for (const nome of skills) {
                html += `\n<option value="${esc(nome)}">${esc(nome)}</option>`;
            }
            html += `\n</optgroup>`;
        }
    }

    html += `
<optgroup label="Propriedades de Combate">
<option value="Alvo de Ataque">Alvo de Ataque</option><option value="Alvo de Defesa">Alvo de Defesa</option>
<option value="Dano">Dano</option><option value="Dano CrÃ­tico">Dano CrÃ­tico</option>
</optgroup>
<optgroup label="ExperiÃªncia">
<option value="EXP">â­ EXP</option>
</optgroup>
<optgroup label="Outros">
<option value="PerÃ­cias (qualquer)">PerÃ­cias (qualquer)</option>
<option value="PerÃ­cias Mentais (qualquer)">PerÃ­cias Mentais (qualquer)</option>
<option value="PerÃ­cias FÃ­sicas (qualquer)">PerÃ­cias FÃ­sicas (qualquer)</option>
<option value="PerÃ­cias Sociais (qualquer)">PerÃ­cias Sociais (qualquer)</option>
<option value="AÃ§Ãµes por turno">AÃ§Ãµes por turno</option>
<option value="EXP NecessÃ¡ria">EXP NecessÃ¡ria</option>
</optgroup>`;

    // Limites de MÃ³dulos de Classe (dinÃ¢mico)
    html += _getModuleLimitOptions();

    return html;
}

export const FONTE_LABELS = { raca: 'ðŸ§¬ RaÃ§a', classe: 'âš”ï¸ Classe', tribo: 'ðŸ•ï¸ Tribo', peculiaridade: 'âœ¨ Pecul.', item: 'ðŸ—¡ï¸ Item', condicao: 'ðŸ’€ CondiÃ§Ã£o', manobra: 'ðŸ’¥ Manobra', magia: 'ðŸ”® Magia', individual: 'ðŸ‘¤ Individual', generica: 'âš™ï¸ GenÃ©rica' };
export const TIPO_ICONS = { modificar: 'âž•', limitar: 'ðŸ”’', conceder: 'ðŸŽ', condicional: 'âš¡', narrativo: 'ðŸ“', distribuir: 'ðŸŽ²' };
export const TIPO_LABELS = { modificar: 'Modificar', limitar: 'Limitar', conceder: 'Conceder', condicional: 'Condicional', narrativo: 'Narrativo', distribuir: 'Distribuir' };

function esc(text) {
    if (text === null || text === undefined) return '';
    const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML;
}

/**
 * Gera optgroup com opÃ§Ãµes de "Limite: <titulo>" para cada mÃ³dulo de classe.
 * Percorre window._classesCache ou window._systemData.classes.
 */
function _getModuleLimitOptions() {
    const classes = window._classesCache || (window._systemData?.classes) || [];
    const options = [];
    for (const cls of classes) {
        if (cls.publicado === false) continue;
        if (!cls.modulosDaClasse || !Array.isArray(cls.modulosDaClasse)) continue;
        for (const mod of cls.modulosDaClasse) {
            const titulo = mod.titulo || mod.id || '';
            if (!titulo) continue;
            options.push({ value: `Limite: ${titulo}`, label: `ðŸ“¦ Limite: ${titulo} (${cls.nome})` });
        }
    }
    if (options.length === 0) return '';
    let html = `\n<optgroup label="Limites de M\u00f3dulos de Classe">`;
    for (const opt of options) {
        html += `\n<option value="${esc(opt.value)}">${esc(opt.label)}</option>`;
    }
    html += `\n</optgroup>`;
    return html;
}

// ===== HELPER: Format a single calc value for display =====
function _formatCalcValue(calc) {
    if (!calc) return '?';
    // New equation format
    if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
        return _formatEquation(calc.equacao);
    }
    // Legacy format
    if (calc.valorTipo === 'ficha') {
        const ref = calc.valorRef || '?';
        const mult = calc.valorMultiplicador && calc.valorMultiplicador !== 1 ? ` Ã— ${calc.valorMultiplicador}` : '';
        return `[${ref}${mult}]`;
    }
    return calc.valor ?? '?';
}

function _formatEquation(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return '?';
    // Check if any term uses min/max â€” if so, format as min(A, B, ...) or max(A, B, ...)
    const hasMinMax = equacao.some(t => t.op === 'min' || t.op === 'max');
    if (hasMinMax && equacao.length > 1) {
        const fnName = equacao[1].op === 'min' ? 'menor' : 'maior';
        const parts = equacao.map(t => {
            if (t.tipo === 'ficha') return `[${t.ref || '?'}]`;
            return (t.valor ?? '?');
        });
        return `${fnName}(${parts.join(', ')})`;
    }
    let str = '';
    for (let i = 0; i < equacao.length; i++) {
        const t = equacao[i];
        if (i > 0 && t.op) str += ` ${t.op} `;
        if (t.tipo === 'ficha') str += `[${t.ref || '?'}]`;
        else str += (t.valor ?? '?');
    }
    return equacao.length > 1 ? `(${str})` : str;
}

// ===== PREVIEW TEXT GENERATOR =====
export function generatePreviewText(data) {
    const tipo = data.tipo || '';
    const config = data.config || {};
    const cond = data.condicaoAplicacao ? ` (${data.condicaoAplicacao})` : '';
    const dur = data.duracao && data.duracao !== 'permanente' ? ` â€” DuraÃ§Ã£o: ${data.duracao === 'turno' ? (data.duracaoTurnos || '?') + ' turno(s)' : data.duracao}` : '';
    const evo = data.evoluivel ? ` ðŸ“ˆ Nv1-${data.nivelMaximo || '?'}${data.progressaoApenasCriacao ? ' ðŸ—ï¸' : ''}` : '';

    let text = '';
    if (tipo === 'modificar') {
        // Support new multi-calc format
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            text = config.calculos.map(c => {
                // EXP: use standard equation format, target shows qualExp label
                if (c.alvo === 'EXP') {
                    const op = c.operacao || '+';
                    const val = _formatCalcValue(c);
                    const qualLabels = { exp_total: 'EXP Total', exp_restante: 'EXP Restante', ambos: 'EXP Total + Restante' };
                    const qualLabel = qualLabels[c.qualExp] || 'EXP';
                    // quandoAplica is at top-level data, not in calc
                    const quandoLabels = { na_criacao: 'Na CriaÃ§Ã£o', por_sessao: 'Por SessÃ£o', por_descanso_longo: 'Por Descanso Longo', por_descanso_curto: 'Por Descanso Curto', por_arco: 'Por Arco', por_masmorra: 'Por Masmorra', ao_ativar: 'Ao Ativar', ao_desativar: 'Ao Desativar', condicional: 'Condicional', permanente: 'Permanente', por_uso_recurso: 'Por Uso de Recurso', por_morte: 'Por Morte/RessurreiÃ§Ã£o' };
                    const quandoLabel = quandoLabels[data.quandoAplica] || '';
                    const triggerSuffix = quandoLabel ? ` â€” ${quandoLabel}` : '';
                    return `${op}${val} em ${qualLabel}${triggerSuffix}`;
                }
                const op = c.operacao || '+';
                const val = _formatCalcValue(c);
                return `${op}${val} em ${c.alvo || '?'}`;
            }).join('; ');
        } else {
            // Backward compatible: old single-calc format
            const alvo = Array.isArray(config.alvo) ? config.alvo.join(', ') : (config.alvo || '?');
            const op = config.operacao || '+';
            const val = config.valor ?? '?';
            text = `${op}${val} em ${alvo}`;
        }
    } else if (tipo === 'limitar') {
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            text = config.calculos.map(c => {
                const alvo = c.alvo || '?';
                if (c.tipoLimite === 'bloqueio') return `${alvo}: bloqueado (= 0)`;
                const valStr = _formatCalcValue(c);
                if (c.tipoLimite === 'maximo') return `${alvo}: mÃ¡ximo ${valStr}`;
                if (c.tipoLimite === 'minimo') return `${alvo}: mÃ­nimo ${valStr}`;
                if (c.tipoLimite === 'clamp') return `${alvo}: min ${_formatCalcValue({...c, valor: c.valorMinimo, valorRef: c.valorRefMin})}, max ${valStr}`;
                return `${alvo}: limite`;
            }).join('; ');
        } else {
            const alvo = config.alvo || '?';
            if (config.tipoLimite === 'bloqueio') text = `${alvo}: bloqueado (= 0)`;
            else if (config.tipoLimite === 'maximo') text = `${alvo}: mÃ¡ximo ${config.valorMaximo ?? '?'}`;
            else if (config.tipoLimite === 'minimo') text = `${alvo}: mÃ­nimo ${config.valorMinimo ?? '?'}`;
            else if (config.tipoLimite === 'clamp') text = `${alvo}: min ${config.valorMinimo ?? '?'}, max ${config.valorMaximo ?? '?'}`;
            else text = `${alvo}: limite`;
        }
    } else if (tipo === 'conceder') {
        const label = { capacidade: 'Concede', imunidade: 'Imunidade', vulnerabilidade: 'Vulnerabilidade', resistencia: 'ResistÃªncia', vantagem: 'Vantagem', desvantagem: 'Desvantagem', acesso: 'Acesso', remover_acesso: 'Remove acesso' };
        text = `${label[config.tipoConcessao] || 'Concede'}: ${config.descricaoConcessao || '?'}`;
    } else if (tipo === 'condicional') {
        // Build conditional preview with resolved sub-mechanic previews
        const parts = [];
        parts.push(config.gatilho || '?');
        const cache = window._mechCache || [];
        const sucessoIds = config.efeitoSucessoIds || [];
        const falhaIds = config.efeitoFalhaIds || [];
        if (sucessoIds.length > 0) {
            const sucessoPreviews = sucessoIds.map(id => {
                const m = cache.find(x => x.id === id);
                if (!m) return '?';
                return m.previewTexto || generatePreviewText({ tipo: m.tipo, config: m.config || {}, condicaoAplicacao: m.condicaoAplicacao, duracao: m.duracao, duracaoTurnos: m.duracaoTurnos, evoluivel: m.evoluivel, nivelMaximo: m.nivelMaximo, progressaoApenasCriacao: m.progressaoApenasCriacao });
            }).join('; ');
            parts.push(`Se Sucesso: ${sucessoPreviews}`);
        }
        if (falhaIds.length > 0) {
            const falhaPreviews = falhaIds.map(id => {
                const m = cache.find(x => x.id === id);
                if (!m) return '?';
                return m.previewTexto || generatePreviewText({ tipo: m.tipo, config: m.config || {}, condicaoAplicacao: m.condicaoAplicacao, duracao: m.duracao, duracaoTurnos: m.duracaoTurnos, evoluivel: m.evoluivel, nivelMaximo: m.nivelMaximo, progressaoApenasCriacao: m.progressaoApenasCriacao });
            }).join('; ');
            parts.push(`Se Falha: ${falhaPreviews}`);
        }
        text = parts.join('\n');
    } else if (tipo === 'narrativo') {
        const t = config.textoEfeito || '';
        text = `Narrativo: ${t.length > 60 ? t.substring(0, 60) + '...' : t}`;
    } else if (tipo === 'distribuir') {
        const pool = config.pool || '?';
        const qty = config.quantidadeAlvos || '?';
        const val = config.valorPorAlvo || '?';
        const op = config.operacao || '+';
        const rest = config.restricao === 'diferentes' ? ' (diferentes)' : '';
        const poolLabel = pool === 'Personalizado' && Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.length
            ? `Personalizado: ${config.poolPersonalizado.join(', ')}` : pool;
        text = `Distribuir: ${op}${val} em ${qty} alvos${rest} de [${poolLabel}]`;
    }
    return text + evo + cond + dur || 'Efeito nÃ£o definido';
}

// ===== MECHANIC CARD (for grid) =====
export function renderMechanicCard(item) {
    const name = esc(item.nome || 'Sem nome');
    const tipo = item.tipo || 'modificar';
    const fonte = item.fonte || 'generica';
    const preview = esc(item.previewTexto || 'â€”');
    const isPublished = item.publicado === true;
    return `
        <div class="mech-card" data-type="${tipo}" onclick="openMechanicEditor('${item.id}')">
            <div class="mech-card-header">
                <div class="mech-card-name">${TIPO_ICONS[tipo] || 'ðŸ”§'} ${name}</div>
                <div class="mech-card-badges">
                    <span class="badge-fonte" style="background:var(--fonte-${fonte})">${FONTE_LABELS[fonte] || fonte}</span>
                    <span class="badge-tipo" style="background:var(--type-${tipo})">${TIPO_LABELS[tipo] || tipo}</span>
                </div>
            </div>
            <div class="mech-card-preview">"${preview}"</div>
            <div class="mech-card-footer">
                <div class="item-card-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); openMechanicEditor('${item.id}')" title="Editar">âœï¸</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); duplicateItem('${item.id}')" title="Duplicar" style="border-color:var(--warning);color:var(--warning)">ðŸ“‹</button>
                    <button class="btn-delete-card" onclick="event.stopPropagation(); openDeleteModal('${item.id}','${esc(name).replace(/'/g, "\\'")}')" title="Excluir">ðŸ—‘ï¸</button>
                </div>
                <span class="badge-status ${isPublished ? 'badge-published' : 'badge-draft'}">${isPublished ? 'âœ… Pub' : 'ðŸ“ Rasc'}</span>
            </div>
        </div>`;
}

// ===== VALUE SOURCE OPTIONS (dynamic from skills cache) =====
const CATEGORY_LABELS = {
    'mental': 'PerÃ­cias Mentais',
    'fisico': 'PerÃ­cias FÃ­sicas',
    'social': 'PerÃ­cias Sociais',
    'combate': 'PerÃ­cias Defensivas',
    'exclusivo': 'PerÃ­cias Exclusivas'
};

function getValueSourceHTML() {
    let html = `
<optgroup label="Atributos">
<option value="INT">INT</option><option value="RAC">RAC</option><option value="PRS">PRS</option>
<option value="FOR">FOR</option><option value="DES">DES</option><option value="VIG">VIG</option>
<option value="PRE">PRE</option><option value="MAN">MAN</option><option value="AUT">AUT</option>
</optgroup>
`;

    // Status Vitais â€” dinÃ¢mico do Firebase
    const vsCache3 = window._vitalStatsCache || [];
    const publishedVS3 = vsCache3.filter(v => v.publicado !== false);
    if (publishedVS3.length > 0) {
        publishedVS3.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Status Vitais">`;
        for (const vs of publishedVS3) {
            const icon = vs.icone || 'â¤ï¸';
            html += `\n<option value="${esc(vs.nome)} MÃ¡xima">${icon} ${esc(vs.nome)} MÃ¡xima</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache nÃ£o carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade MÃ¡xima">Vitalidade MÃ¡xima</option>`;
        html += `\n<option value="Energia MÃ¡xima">Energia MÃ¡xima</option>`;
        html += `\n<option value="Sanidade MÃ¡xima">Sanidade MÃ¡xima</option>`;
        html += `\n</optgroup>`;
    }

    // Valores Derivados â€” dinÃ¢mico do Firebase
    const dvCache = window._derivedValuesCache || [];
    const publishedDVs = dvCache.filter(d => d.publicado !== false);
    if (publishedDVs.length > 0) {
        publishedDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Valores Derivados">`;
        for (const dv of publishedDVs) {
            const icon = dv.icone || 'ðŸ“Š';
            html += `\n<option value="${esc(dv.nome)}">${icon} ${esc(dv.nome)}</option>`;
            if (dv.campoAtual) {
                html += `\n<option value="${esc(dv.nome)} (Atual)">${icon} ${esc(dv.nome)} (Atual)</option>`;
                html += `\n<option value="${esc(dv.nome)} (MÃ¡ximo)">${icon} ${esc(dv.nome)} (MÃ¡ximo)</option>`;
            }
        }
        html += `\n</optgroup>`;
    }

    html += `
<optgroup label="Campos da Ficha">
<option value="Blindagem">Blindagem</option>
<option value="Tamanho">Tamanho</option>
</optgroup>`;

    // Build skill options dynamically from skills cache
    const cache = window._skillsCache || [];
    if (cache.length > 0) {
        const byCategory = {};
        for (const sk of cache) {
            const cat = (sk.categoria || 'mental').toLowerCase();
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(sk.nome);
        }
        // Render in preferred order
        for (const cat of ['mental', 'fisico', 'social', 'combate', 'exclusivo']) {
            const skills = byCategory[cat];
            if (!skills || skills.length === 0) continue;
            skills.sort((a, b) => a.localeCompare(b));
            const label = CATEGORY_LABELS[cat] || cat;
            html += `\n<optgroup label="${label}">`;
            for (const nome of skills) {
                html += `\n<option value="${esc(nome)}">${esc(nome)}</option>`;
            }
            html += `\n</optgroup>`;
        }
    }

    html += `\n<optgroup label="Outros">\n<option value="NÃ­vel">NÃ­vel</option>\n</optgroup>`;

    // Limites de MÃ³dulos de Classe (dinÃ¢mico)
    html += _getModuleLimitOptions();

    return html;
}

// ===== MIGRATE OLD CALC FORMAT TO EQUATION =====
function _migrateCalcToEquacao(c) {
    if (Array.isArray(c.equacao) && c.equacao.length > 0) return c.equacao;
    // Convert old format to equation
    if (c.valorTipo === 'ficha') {
        const terms = [{ tipo: 'ficha', ref: c.valorRef || '' }];
        if (c.valorMultiplicador && c.valorMultiplicador !== 1) {
            terms.push({ op: 'Ã—', tipo: 'fixo', valor: c.valorMultiplicador });
        }
        return terms;
    }
    return [{ tipo: 'fixo', valor: c.valor ?? '' }];
}

// ===== RENDER A SINGLE EQUATION TERM =====
function _renderEquationTerm(term, calcIndex, termIndex) {
    const t = term || { tipo: 'fixo', valor: '' };
    const showOp = termIndex > 0;
    const opHtml = showOp ? `
        <select class="eq-term-op" onchange="window._mechUpdatePreview()">
            <optgroup label="AritmÃ©ticos">
            <option value="+" ${t.op === '+' ? 'selected' : ''}>+</option>
            <option value="-" ${t.op === '-' ? 'selected' : ''}>âˆ’</option>
            <option value="Ã—" ${t.op === 'Ã—' ? 'selected' : ''}>Ã—</option>
            <option value="Ã·" ${t.op === 'Ã·' ? 'selected' : ''}>Ã·</option>
            </optgroup>
            <optgroup label="LÃ³gicos">
            <option value="min" ${t.op === 'min' ? 'selected' : ''}>â†“ Menor entre</option>
            <option value="max" ${t.op === 'max' ? 'selected' : ''}>â†‘ Maior entre</option>
            </optgroup>
        </select>` : '';

    return `
    <div class="eq-term" data-term-index="${termIndex}">
        ${opHtml}
        <select class="eq-term-tipo" onchange="window._mechTermTipoChange(${calcIndex}, ${termIndex}); window._mechUpdatePreview()">
            <option value="fixo" ${t.tipo !== 'ficha' ? 'selected' : ''}>ðŸ”¢ Fixo</option>
            <option value="ficha" ${t.tipo === 'ficha' ? 'selected' : ''}>ðŸ“‹ Ficha</option>
        </select>
        <div class="eq-term-fixo-wrap" style="display:${t.tipo !== 'ficha' ? '' : 'none'}">
            <input type="text" class="eq-term-valor" value="${esc(String(t.valor ?? ''))}" placeholder="Valor" oninput="window._mechUpdatePreview()">
        </div>
        <div class="eq-term-ficha-wrap" style="display:${t.tipo === 'ficha' ? '' : 'none'}">
            <select class="eq-term-ref" onchange="window._mechUpdatePreview()">
                <option value="">â€” Ref â€”</option>${getValueSourceHTML()}
            </select>
        </div>
        ${termIndex > 0 ? `<button type="button" class="eq-term-remove" onclick="window._mechRemoveTerm(${calcIndex}, ${termIndex})" title="Remover termo">âœ•</button>` : ''}
    </div>`;
}

// ===== RENDER A SINGLE CALC ROW (Modificar) =====
function _renderCalcRowModificar(calc, index) {
    const c = calc || { alvo: '', operacao: '+', equacao: [{ tipo: 'fixo', valor: '' }] };
    const isEXP = c.alvo === 'EXP';
    const equacao = _migrateCalcToEquacao(c);
    const termsHtml = equacao.map((t, ti) => _renderEquationTerm(t, index, ti)).join('');
    const qualExp = c.qualExp || 'ambos';
    return `
    <div class="calc-row" data-calc-index="${index}">
        <div class="calc-row-header">
            <span class="calc-row-num">#${index + 1}</span>
            <button type="button" class="calc-row-remove" onclick="window._mechRemoveCalc(${index})" title="Remover cÃ¡lculo">ðŸ—‘ï¸</button>
        </div>
        <div class="form-grid">
            <div class="form-group full-width"><label>O que Ã© afetado? <span class="required">*</span></label>
                <select class="calc-alvo" onchange="window._mechAlvoChange(${index}); window._mechUpdatePreview()">
                    <option value="">â€” Selecionar alvo â€”</option>${getMechanicTargetsHTML()}
                </select>
            </div>
        </div>
        <div class="calc-exp-qual-wrap" style="display:${isEXP ? '' : 'none'}">
            <div class="form-grid">
                <div class="form-group"><label>â­ Qual EXP Ã© afetado? <span class="required">*</span></label>
                    <select class="calc-qualExp" onchange="window._mechUpdatePreview()">
                        <option value="ambos" ${qualExp === 'ambos' ? 'selected' : ''}>Ambos (Total + Restante)</option>
                        <option value="exp_total" ${qualExp === 'exp_total' ? 'selected' : ''}>EXP Total</option>
                        <option value="exp_restante" ${qualExp === 'exp_restante' ? 'selected' : ''}>EXP Restante</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group"><label>OperaÃ§Ã£o <span class="required">*</span></label>
                <select class="calc-operacao" onchange="window._mechUpdatePreview()">
                    <option value="+" ${c.operacao === '+' ? 'selected' : ''}>+ Somar</option>
                    <option value="-" ${c.operacao === '-' ? 'selected' : ''}>âˆ’ Subtrair</option>
                    <option value="Ã—" ${c.operacao === 'Ã—' ? 'selected' : ''}>Ã— Multiplicar</option>
                    <option value="Ã·" ${c.operacao === 'Ã·' ? 'selected' : ''}>Ã· Dividir</option>
                    <option value="=" ${c.operacao === '=' ? 'selected' : ''}>=  Definir fixo</option>
                </select>
            </div>
        </div>
        <div class="eq-builder-section">
            <label class="eq-builder-label">EquaÃ§Ã£o de Valor <span class="required">*</span></label>
            <div class="eq-terms-container" data-calc-index="${index}">
                ${termsHtml}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechAddTerm(${index})">âž• Adicionar Termo</button>
        </div>
    </div>`;
}

// ===== RENDER A SINGLE CALC ROW (Limitar) =====
function _renderCalcRowLimitar(calc, index) {
    const c = calc || { alvo: '', tipoLimite: '', equacao: [{ tipo: 'fixo', valor: '' }] };
    const tl = c.tipoLimite || '';
    const showValor = tl && tl !== 'bloqueio';
    const equacao = _migrateCalcToEquacao(c);
    const termsHtml = equacao.map((t, ti) => _renderEquationTerm(t, index, ti)).join('');
    return `
    <div class="calc-row" data-calc-index="${index}">
        <div class="calc-row-header">
            <span class="calc-row-num">#${index + 1}</span>
            <button type="button" class="calc-row-remove" onclick="window._mechRemoveCalc(${index})" title="Remover cÃ¡lculo">ðŸ—‘ï¸</button>
        </div>
        <div class="form-grid">
            <div class="form-group full-width"><label>O que Ã© limitado? <span class="required">*</span></label>
                <select class="calc-alvo" onchange="window._mechUpdatePreview()">
                    <option value="">â€” Selecionar alvo â€”</option>${getMechanicTargetsHTML()}
                </select>
            </div>
            <div class="form-group"><label>Tipo de Limite <span class="required">*</span></label>
                <select class="calc-tipoLimite" onchange="window._mechCalcLimitChange(${index}); window._mechUpdatePreview()">
                    <option value="">â€” Selecionar â€”</option>
                    <option value="maximo" ${tl === 'maximo' ? 'selected' : ''}>Teto (mÃ¡ximo)</option>
                    <option value="minimo" ${tl === 'minimo' ? 'selected' : ''}>Piso (mÃ­nimo)</option>
                    <option value="clamp" ${tl === 'clamp' ? 'selected' : ''}>Ambos (clamp)</option>
                    <option value="bloqueio" ${tl === 'bloqueio' ? 'selected' : ''}>Bloqueio (= 0)</option>
                </select>
            </div>
        </div>
        <div class="calc-limit-valor-area" style="display:${showValor ? '' : 'none'}">
            <div class="eq-builder-section">
                <label class="eq-builder-label">EquaÃ§Ã£o de Valor do Limite</label>
                <div class="eq-terms-container" data-calc-index="${index}">
                    ${termsHtml}
                </div>
                <button type="button" class="eq-add-term-btn" onclick="window._mechAddTerm(${index})">âž• Adicionar Termo</button>
            </div>
        </div>
    </div>`
}

// ===== CONFIG SECTION RENDERERS =====
function renderConfigModificar(config) {
    let calculos = config?.calculos;
    if (!Array.isArray(calculos) || calculos.length === 0) {
        if (config?.alvo) {
            calculos = [{
                alvo: Array.isArray(config.alvo) ? config.alvo[0] : config.alvo,
                operacao: config.operacao || '+',
                valorTipo: 'fixo',
                valor: config.valor ?? '',
                valorRef: '',
                valorMultiplicador: 1
            }];
        } else {
            calculos = [{ alvo: '', operacao: '+', valorTipo: 'fixo', valor: '', valorRef: '', valorMultiplicador: 1 }];
        }
    }
    const rows = calculos.map((c, i) => _renderCalcRowModificar(c, i)).join('');
    return `
    <div id="mechCalcList" data-calc-type="modificar">
        ${rows}
    </div>
    <button type="button" class="calc-add-btn" onclick="window._mechAddCalc('modificar')">âž• Adicionar CÃ¡lculo</button>`;
}

function renderConfigLimitar(config) {
    let calculos = config?.calculos;
    if (!Array.isArray(calculos) || calculos.length === 0) {
        if (config?.alvo) {
            calculos = [{
                alvo: config.alvo,
                tipoLimite: config.tipoLimite || '',
                valorTipo: 'fixo',
                valor: config.valorMaximo ?? config.valorMinimo ?? '',
                valorRef: '',
                valorMultiplicador: 1
            }];
        } else {
            calculos = [{ alvo: '', tipoLimite: '', valorTipo: 'fixo', valor: '', valorRef: '', valorMultiplicador: 1 }];
        }
    }
    const rows = calculos.map((c, i) => _renderCalcRowLimitar(c, i)).join('');
    return `
    <div id="mechCalcList" data-calc-type="limitar">
        ${rows}
    </div>
    <button type="button" class="calc-add-btn" onclick="window._mechAddCalc('limitar')">âž• Adicionar CÃ¡lculo</button>`;
}


function renderConfigConceder(config) {
    const tc = config?.tipoConcessao || '';
    return `
    <div class="form-grid">
        <div class="form-group"><label>O que concede? <span class="required">*</span></label>
            <select id="mech_config_tipoConcessao" onchange="window._mechUpdatePreview()">
                <option value="">â€” Selecionar â€”</option>
                <option value="capacidade" ${tc === 'capacidade' ? 'selected' : ''}>Capacidade especial</option>
                <option value="imunidade" ${tc === 'imunidade' ? 'selected' : ''}>Imunidade</option>
                <option value="vulnerabilidade" ${tc === 'vulnerabilidade' ? 'selected' : ''}>Vulnerabilidade</option>
                <option value="resistencia" ${tc === 'resistencia' ? 'selected' : ''}>ResistÃªncia</option>
                <option value="vantagem" ${tc === 'vantagem' ? 'selected' : ''}>Vantagem em testes</option>
                <option value="desvantagem" ${tc === 'desvantagem' ? 'selected' : ''}>Desvantagem em testes</option>
                <option value="acesso" ${tc === 'acesso' ? 'selected' : ''}>Acesso a recurso</option>
                <option value="remover_acesso" ${tc === 'remover_acesso' ? 'selected' : ''}>Remove acesso</option>
            </select>
        </div>
        <div class="form-group"><label>DescriÃ§Ã£o da concessÃ£o <span class="required">*</span></label>
            <input type="text" id="mech_config_descricaoConcessao" value="${esc(config?.descricaoConcessao || '')}" placeholder="Ex: Voo, VisÃ£o de EssÃªncia" oninput="window._mechUpdatePreview()">
        </div>
    </div>`;
}

function renderConfigCondicional(config, mechanicsCache) {
    const gatilho = config?.gatilho || '';
    const sucessoIds = config?.efeitoSucessoIds || [];
    const falhaIds = config?.efeitoFalhaIds || [];
    return `
    <div class="form-grid">
        <div class="form-group full-width"><label>Gatilho / Quando se aplica <span class="required">*</span></label>
            <textarea id="mech_config_gatilho" placeholder="Ex: Teste de AUT por cena" oninput="window._mechUpdatePreview()">${esc(gatilho)}</textarea>
        </div>
        <div class="form-group full-width">
            ${buildInlineMechSelector('mech_config_efeitoSucessoIds', 'Efeito Sucesso (mecÃ¢nicas)', sucessoIds, mechanicsCache, true)}
        </div>
        <div class="form-group full-width">
            ${buildInlineMechSelector('mech_config_efeitoFalhaIds', 'Efeito Falha (opcional)', falhaIds, mechanicsCache, true)}
        </div>
    </div>`;
}

function renderConfigNarrativo(config) {
    return `<div class="form-group"><label>DescriÃ§Ã£o do efeito narrativo <span class="required">*</span></label>
        <textarea id="mech_config_textoEfeito" placeholder="Texto livre descrevendo o efeito qualitativo" oninput="window._mechUpdatePreview()">${esc(config?.textoEfeito || '')}</textarea></div>`;
}

function renderConfigDistribuir(config) {
    const poolVal = config?.pool || '';
    const qtyVal = config?.quantidadeAlvos ?? '';
    const valVal = config?.valorPorAlvo ?? '';
    const opVal = config?.operacao || '+';
    const restVal = config?.restricao || 'diferentes';
    const poolCustom = Array.isArray(config?.poolPersonalizado) ? config.poolPersonalizado : [];

    // Build checkboxes from getMechanicTargetsHTML() by extracting option values
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `<select>${getMechanicTargetsHTML()}</select>`;
    const allOptions = Array.from(tempDiv.querySelectorAll('option'));
    const checkboxesHtml = allOptions.map(opt => {
        const v = opt.value;
        const checked = poolCustom.includes(v) ? 'checked' : '';
        return `<label class="mechsel-result" style="padding:4px 6px"><input type="checkbox" value="${esc(v)}" ${checked} onchange="window._mechUpdatePreview()"><span class="mechsel-result-name">${esc(opt.textContent)}</span></label>`;
    }).join('');

    return `
    <div class="form-grid">
        <div class="form-group full-width"><label>Pool de Alvos <span class="required">*</span></label>
            <select id="mech_config_pool" onchange="window._mechPoolChange(); window._mechUpdatePreview()">
                <option value="" ${!poolVal ? 'selected' : ''}>â€” Selecionar pool â€”</option>
                <option value="PerÃ­cias (qualquer)" ${poolVal === 'PerÃ­cias (qualquer)' ? 'selected' : ''}>PerÃ­cias (qualquer)</option>
                <option value="PerÃ­cias Mentais (qualquer)" ${poolVal === 'PerÃ­cias Mentais (qualquer)' ? 'selected' : ''}>PerÃ­cias Mentais (qualquer)</option>
                <option value="PerÃ­cias FÃ­sicas (qualquer)" ${poolVal === 'PerÃ­cias FÃ­sicas (qualquer)' ? 'selected' : ''}>PerÃ­cias FÃ­sicas (qualquer)</option>
                <option value="PerÃ­cias Sociais (qualquer)" ${poolVal === 'PerÃ­cias Sociais (qualquer)' ? 'selected' : ''}>PerÃ­cias Sociais (qualquer)</option>
                <option value="Atributos (qualquer)" ${poolVal === 'Atributos (qualquer)' ? 'selected' : ''}>Atributos (qualquer)</option>
                <option value="Atributos Mentais" ${poolVal === 'Atributos Mentais' ? 'selected' : ''}>Atributos Mentais</option>
                <option value="Atributos FÃ­sicos" ${poolVal === 'Atributos FÃ­sicos' ? 'selected' : ''}>Atributos FÃ­sicos</option>
                <option value="Atributos Sociais" ${poolVal === 'Atributos Sociais' ? 'selected' : ''}>Atributos Sociais</option>
                <option value="Personalizado" ${poolVal === 'Personalizado' ? 'selected' : ''}>Personalizado</option>
            </select>
        </div>
        <div class="form-group"><label>Quantos alvos diferentes? <span class="required">*</span></label>
            <input type="number" id="mech_config_quantidadeAlvos" value="${esc(String(qtyVal))}" placeholder="Ex: 4" min="1" oninput="window._mechUpdatePreview()">
        </div>
        <div class="form-group"><label>Valor por alvo <span class="required">*</span></label>
            <input type="text" id="mech_config_valorPorAlvo" value="${esc(String(valVal))}" placeholder="Ex: 1" oninput="window._mechUpdatePreview()">
        </div>
        <div class="form-group"><label>OperaÃ§Ã£o <span class="required">*</span></label>
            <select id="mech_config_operacao_dist" onchange="window._mechUpdatePreview()">
                <option value="+" ${opVal === '+' ? 'selected' : ''}>+ Somar</option>
                <option value="-" ${opVal === '-' ? 'selected' : ''}>âˆ’ Subtrair</option>
                <option value="=" ${opVal === '=' ? 'selected' : ''}>= Definir</option>
            </select>
        </div>
        <div class="form-group"><label>RestriÃ§Ã£o</label>
            <select id="mech_config_restricao" onchange="window._mechUpdatePreview()">
                <option value="diferentes" ${restVal === 'diferentes' ? 'selected' : ''}>Alvos devem ser diferentes</option>
                <option value="livre" ${restVal === 'livre' ? 'selected' : ''}>Pode repetir alvos</option>
            </select>
        </div>
        <div class="form-group full-width" id="mech_config_poolCustomWrap" style="display:${poolVal === 'Personalizado' ? '' : 'none'}">
            <label>Pool Personalizado â€” Selecione os alvos permitidos</label>
            <div id="mech_config_poolPersonalizado" style="max-height:200px;overflow-y:auto;border:2px solid var(--soft);border-radius:8px;padding:8px;display:flex;flex-wrap:wrap;gap:2px">
                ${checkboxesHtml}
            </div>
        </div>
    </div>`;
}

// ===== PROGRESSION / LEVEL TABLE =====

// Returns indices and labels of fixo terms across all calc rows for progression columns
function _getEquacaoFixoTerms() {
    const list = document.getElementById('mechCalcList');
    if (!list) return [];
    const fixoTerms = [];
    const calcRows = list.querySelectorAll('.calc-row');
    calcRows.forEach((row, ci) => {
        const terms = row.querySelectorAll('.eq-term');
        terms.forEach((term, ti) => {
            const tipo = term.querySelector('.eq-term-tipo')?.value || 'fixo';
            if (tipo === 'fixo') {
                const calcNum = calcRows.length > 1 ? `C${ci + 1}.` : '';
                fixoTerms.push({ calcIndex: ci, termIndex: ti, label: `${calcNum}Termo ${fixoTerms.length + 1}` });
            }
        });
    });
    return fixoTerms;
}

function _getProgressaoHeaders(tipo, tipoExp, fixoTerms) {
    const expLabel = tipoExp === 'ganho' ? 'Ganho EXP' : 'Custo EXP';
    if (tipo === 'modificar' || tipo === 'limitar') {
        if (fixoTerms && fixoTerms.length > 0) {
            return ['NÃ­vel', expLabel, ...fixoTerms.map(ft => ft.label)];
        }
        // Fallback: single valor column
        return ['NÃ­vel', expLabel, tipo === 'limitar' ? 'Valor do Limite' : 'Valor'];
    }
    if (tipo === 'distribuir') return ['NÃ­vel', expLabel, 'Qtd Alvos', 'Valor por Alvo'];
    return ['NÃ­vel', expLabel, 'DescriÃ§Ã£o do Efeito'];
}

function _renderProgressaoRow(i, p, tipo, fixoTerms) {
    const nvCell = `<td style="text-align:center;font-weight:700;color:var(--accent)">${i}</td>`;
    const custoCell = `<td><input type="number" class="prog-custo" data-nivel="${i}" value="${p.custoExp ?? (i === 1 ? 0 : '')}" placeholder="0" min="0" style="width:100%" oninput="window._mechUpdatePreview()"></td>`;

    if (tipo === 'modificar' || tipo === 'limitar') {
        if (fixoTerms && fixoTerms.length > 0) {
            const termCells = fixoTerms.map((ft, ftIdx) => {
                const termValues = p.termos || {};
                const val = termValues[String(ftIdx)] ?? '';
                return `<td><input type="text" class="prog-termo" data-nivel="${i}" data-termo-index="${ftIdx}" value="${esc(String(val))}" placeholder="Ex: ${i + ftIdx}" style="width:100%" oninput="window._mechUpdatePreview()"></td>`;
            }).join('');
            return `<tr>${nvCell}${custoCell}${termCells}</tr>`;
        }
        // Fallback: single valor column (backward compat)
        if (tipo === 'limitar') {
            return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-valorLimite" data-nivel="${i}" value="${esc(String(p.valorLimite ?? ''))}" placeholder="Ex: ${i * 2}" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
        }
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-valor" data-nivel="${i}" value="${esc(String(p.valor ?? ''))}" placeholder="Ex: ${i}" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
    } else if (tipo === 'distribuir') {
        return `<tr>${nvCell}${custoCell}<td><input type="number" class="prog-quantidadeAlvos" data-nivel="${i}" value="${p.quantidadeAlvos ?? ''}" placeholder="Ex: ${i + 1}" min="1" style="width:100%" oninput="window._mechUpdatePreview()"></td><td><input type="text" class="prog-valorPorAlvo" data-nivel="${i}" value="${esc(String(p.valorPorAlvo ?? ''))}" placeholder="Ex: 1" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
    } else {
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-descricao" data-nivel="${i}" value="${esc(String(p.descricao ?? ''))}" placeholder="Descrever o efeito neste nÃ­vel" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
    }
}

function renderConfigProgressao(data, tipo) {
    const evoluivel = data?.evoluivel || false;
    const nivelMax = data?.nivelMaximo || 3;
    const progressao = data?.progressao || {};
    const apenasCriacao = data?.progressaoApenasCriacao || false;
    const tipoExp = data?.progressaoTipoExp || 'custo';
    tipo = tipo || data?.tipo || 'modificar';

    // fixoTerms will be empty on initial render (calc rows not in DOM yet)
    // _mechRefreshProgressao will re-render with correct terms later
    const fixoTerms = _getEquacaoFixoTerms();
    const headers = _getProgressaoHeaders(tipo, tipoExp, fixoTerms);
    let tabelaRows = '';
    if (evoluivel) {
        for (let i = 1; i <= nivelMax; i++) {
            const p = progressao[String(i)] || {};
            tabelaRows += _renderProgressaoRow(i, p, tipo, fixoTerms);
        }
    }

    return `
    <div class="mech-form-section" id="mechProgressaoSection">
        <div class="mech-section-label">ðŸ“ˆ ProgressÃ£o por NÃ­vel</div>
        <div class="form-grid">
            <div class="form-group">
                <div class="form-toggle">
                    <label class="toggle-publish"><input type="checkbox" id="mech_evoluivel" ${evoluivel ? 'checked' : ''} onchange="window._mechEvoluivelChange()"><span class="toggle-slider"></span></label>
                    <span class="toggle-label">EvoluÃ­vel (permite subir de nÃ­vel com EXP)</span>
                </div>
            </div>
            <div class="form-group" id="mech_apenasCriacaoWrap" style="display:${evoluivel ? '' : 'none'}">
                <div class="form-toggle">
                    <label class="toggle-publish"><input type="checkbox" id="mech_progressaoApenasCriacao" ${apenasCriacao ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    <span class="toggle-label">ðŸ—ï¸ Apenas na CriaÃ§Ã£o (nÃ£o pode upar depois)</span>
                </div>
            </div>
            <div class="form-group" id="mech_tipoExpWrap" style="display:${evoluivel ? '' : 'none'}">
                <label>Tipo de EXP na ProgressÃ£o</label>
                <select id="mech_progressaoTipoExp" onchange="window._mechTipoExpChange()">
                    <option value="custo" ${tipoExp === 'custo' ? 'selected' : ''}>ðŸ’° Custo de EXP (mecÃ¢nica benÃ©fica â€” subtrai EXP)</option>
                    <option value="ganho" ${tipoExp === 'ganho' ? 'selected' : ''}>ðŸŽ Ganho de EXP (mecÃ¢nica prejudicial â€” adiciona EXP)</option>
                </select>
            </div>
            <div class="form-group" id="mech_nivelMaxWrap" style="display:${evoluivel ? '' : 'none'}">
                <label>NÃ­vel MÃ¡ximo <span class="required">*</span></label>
                <input type="number" id="mech_nivelMaximo" value="${nivelMax}" min="2" max="10" onchange="window._mechNivelMaxChange()">
            </div>
        </div>
        <div id="mech_progressaoTabela" style="display:${evoluivel ? '' : 'none'}">
            <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <thead id="mech_progressaoHead"><tr style="background:var(--bg-secondary);color:var(--text-secondary)">
                    ${headers.map(h => `<th style="padding:6px 8px${h === 'NÃ­vel' ? ';width:60px' : ''}">${h}</th>`).join('')}
                </tr></thead>
                <tbody id="mech_progressaoBody">${tabelaRows}</tbody>
            </table>
        </div>
    </div>`;
}

window._mechPoolChange = function () {
    const pool = document.getElementById('mech_config_pool')?.value || '';
    const wrap = document.getElementById('mech_config_poolCustomWrap');
    if (wrap) wrap.style.display = pool === 'Personalizado' ? '' : 'none';
};

// ===== EXP SUBFORM HANDLERS =====
window._mechAlvoChange = function (calcIndex) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const row = list.querySelectorAll('.calc-row')[calcIndex];
    if (!row) return;
    const alvo = row.querySelector('.calc-alvo')?.value || '';
    const qualWrap = row.querySelector('.calc-exp-qual-wrap');
    if (qualWrap) qualWrap.style.display = alvo === 'EXP' ? '' : 'none';
    // Check if ANY calc row targets EXP to toggle DuraÃ§Ã£o section
    window._mechSyncDuracaoForExp();
    window._mechRefreshProgressao();
};

// Checks all calc rows; if any targets EXP, swap DuraÃ§Ã£o for EXP triggers
window._mechSyncDuracaoForExp = function () {
    const list = document.getElementById('mechCalcList');
    const hasExp = list ? Array.from(list.querySelectorAll('.calc-alvo')).some(s => s.value === 'EXP') : false;
    const stdDuracao = document.getElementById('mech_duracao_standard_wrap');
    const expDuracao = document.getElementById('mech_duracao_exp_wrap');
    if (stdDuracao) stdDuracao.style.display = hasExp ? 'none' : '';
    if (expDuracao) expDuracao.style.display = hasExp ? '' : 'none';
};

window._mechDuracaoExpChange = function () {
    const d = document.getElementById('mech_duracao_exp')?.value || '';
    const condicaoWrap = document.getElementById('mech_expCondicaoWrap');
    const recursoWrap = document.getElementById('mech_expRecursoWrap');
    if (condicaoWrap) condicaoWrap.style.display = d === 'condicional' ? '' : 'none';
    if (recursoWrap) recursoWrap.style.display = d === 'por_uso_recurso' ? '' : 'none';
    window._mechUpdatePreview();
};

window._mechRecursoExpChange = function () {
    const r = document.getElementById('mech_expRecurso')?.value || '';
    const outroWrap = document.getElementById('mech_expRecursoOutroWrap');
    if (outroWrap) outroWrap.style.display = r === 'outro' ? '' : 'none';
    window._mechUpdatePreview();
};

// ===== INLINE MECH SELECTOR (for condicional sub-effects) =====
function buildInlineMechSelector(id, label, currentIds, cache, excludeCondicional) {
    const filtered = excludeCondicional ? cache.filter(m => m.tipo !== 'condicional' && m.publicado) : cache.filter(m => m.publicado);
    const chips = currentIds.map(mid => {
        const m = cache.find(x => x.id === mid);
        return m ? `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || 'ðŸ”§'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${id}','${mid}')">âœ•</button></div>` : '';
    }).join('');
    const opts = filtered.map(m => `<label class="mechsel-result"><input type="checkbox" value="${m.id}" ${currentIds.includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">${TIPO_ICONS[m.tipo] || 'ðŸ”§'} ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.previewTexto || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="${id}_wrap">
        <span class="mechsel-label">${label}</span>
        <div class="mechsel-chips" id="${id}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecÃ¢nica vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('${id}_search').classList.toggle('open')">âž• Adicionar MecÃ¢nica</button>
        <div class="mechsel-search" id="${id}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="ðŸ” Buscar mecÃ¢nica..." oninput="window._mechSelFilter('${id}', this.value)">
            </div>
            <div class="mechsel-results" id="${id}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._mechSelConfirm('${id}')">âœ”ï¸ Confirmar SeleÃ§Ã£o</button>
        </div>
        <input type="hidden" id="${id}" value='${JSON.stringify(currentIds)}'>
    </div>`;
}

// ===== OPEN MECHANIC EDITOR (inline) =====
export function openMechanicEditor(itemId, allItems, mechanicsCache, callbacks, initialTags) {
    const { db, collection: col, addDoc, updateDoc, doc, Timestamp, currentUser, showAlert, loadModule, escapeHtml } = callbacks;
    const isEditing = !!itemId;
    const existingData = isEditing ? allItems.find(i => i.id === itemId) : {};
    const data = existingData || {};

    // Hide standard content, show editor
    document.getElementById('moduleContent').style.display = 'none';
    const area = document.getElementById('mechanicsEditorArea');
    area.style.display = '';

    const title = isEditing ? `âœï¸ Editar MecÃ¢nica` : `âž• Criar Nova MecÃ¢nica`;
    const tipo = data.tipo || 'modificar';
    const config = data.config || {};
    // Merge initialTags (from filter chips) with existing tags, avoiding duplicates
    const existingTags = Array.isArray(data.tags) ? data.tags : [];
    const mergedInitial = Array.isArray(initialTags) ? initialTags : [];
    const tags = [...new Set([...existingTags, ...mergedInitial])];

    area.innerHTML = `
    <div class="mech-editor-wrap">
        <div class="mech-editor-form">
            <button class="mech-editor-back" onclick="window._mechBack()">â† Voltar Ã  Lista</button>
            <div class="mech-editor-title">${title}</div>

            <div class="mech-form-section">
                <div class="mech-section-label">ðŸ“‹ InformaÃ§Ãµes BÃ¡sicas</div>
                <div class="form-grid">
                    <div class="form-group"><label>Nome <span class="required">*</span></label>
                        <input type="text" id="mech_nome" value="${esc(data.nome || '')}" placeholder="Ex: Aprendizado Acelerado IV" oninput="window._mechUpdatePreview()"></div>
                    <div class="form-group"><label>Fonte <span class="required">*</span></label>
                        <select id="mech_fonte" onchange="window._mechUpdatePreview()">
                            <option value="">â€” Selecionar â€”</option>
                            ${Object.entries(FONTE_LABELS).map(([k, v]) => `<option value="${k}" ${data.fonte === k ? 'selected' : ''}>${v}</option>`).join('')}
                        </select></div>
                    <div class="form-group full-width"><label>DescriÃ§Ã£o <span class="required">*</span></label>
                        <textarea id="mech_descricao" placeholder="Texto explicando o efeito">${esc(data.descricao || '')}</textarea></div>
                </div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">âš™ï¸ Tipo de Efeito</div>
                <div class="form-group">
                    <select id="mech_tipo" onchange="window._mechTipoChange()">
                        <option value="modificar" ${tipo === 'modificar' ? 'selected' : ''}>âž• Modificar (altera valor numÃ©rico)</option>
                        <option value="limitar" ${tipo === 'limitar' ? 'selected' : ''}>ðŸ”’ Limitar (impÃµe teto/piso/bloqueio)</option>
                        <option value="conceder" ${tipo === 'conceder' ? 'selected' : ''}>ðŸŽ Conceder (dÃ¡ ou remove capacidade)</option>
                        <option value="condicional" ${tipo === 'condicional' ? 'selected' : ''}>âš¡ Condicional (efeito com gatilho)</option>
                        <option value="narrativo" ${tipo === 'narrativo' ? 'selected' : ''}>ðŸ“ Narrativo (efeito descritivo)</option>
                        <option value="distribuir" ${tipo === 'distribuir' ? 'selected' : ''}>ðŸŽ² Distribuir (distribui pontos entre mÃºltiplos alvos)</option>
                    </select>
                </div>
                <div class="mech-config-area" id="mechConfigArea"></div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">ðŸ• Quando se Aplica</div>
                <div class="form-grid">
                    <div id="mech_duracao_standard_wrap">
                        <div class="form-group"><label>DuraÃ§Ã£o</label>
                            <select id="mech_duracao" onchange="window._mechDuracaoChange(); window._mechUpdatePreview()">
                                <option value="permanente" ${(data.duracao || 'permanente') === 'permanente' ? 'selected' : ''}>Permanente</option>
                                <option value="cena" ${data.duracao === 'cena' ? 'selected' : ''}>1 Cena</option>
                                <option value="turno" ${data.duracao === 'turno' ? 'selected' : ''}>X Turnos</option>
                                <option value="ate_remover" ${data.duracao === 'ate_remover' ? 'selected' : ''}>AtÃ© ser removido</option>
                                <option value="criacao" ${data.duracao === 'criacao' ? 'selected' : ''}>Na criaÃ§Ã£o do personagem</option>
                                <option value="especial" ${data.duracao === 'especial' ? 'selected' : ''}>Especial</option>
                            </select>
                        </div>
                        <div class="form-group" id="mech_turnosWrap" style="display:${data.duracao === 'turno' ? '' : 'none'}"><label>Quantos turnos?</label>
                            <input type="number" id="mech_duracaoTurnos" value="${data.duracaoTurnos || ''}" min="1" oninput="window._mechUpdatePreview()"></div>
                        <div class="form-group" id="mech_especWrap" style="display:${data.duracao === 'especial' ? '' : 'none'}"><label>Descrever duraÃ§Ã£o</label>
                            <input type="text" id="mech_duracaoEspecial" value="${esc(data.duracaoEspecial || '')}" oninput="window._mechUpdatePreview()"></div>
                    </div>
                    <div id="mech_duracao_exp_wrap" style="display:none">
                        <div class="form-group"><label>â­ Quando o EXP se Aplica? <span class="required">*</span></label>
                            <select id="mech_duracao_exp" onchange="window._mechDuracaoExpChange()">
                                <option value="na_criacao" ${data.quandoAplica === 'na_criacao' ? 'selected' : ''}>ðŸ—ï¸ Na CriaÃ§Ã£o de Personagem</option>
                                <option value="por_sessao" ${data.quandoAplica === 'por_sessao' ? 'selected' : ''}>ðŸ“… Por SessÃ£o</option>
                                <option value="por_descanso_longo" ${data.quandoAplica === 'por_descanso_longo' ? 'selected' : ''}>ðŸ›ï¸ Por Descanso Longo</option>
                                <option value="por_descanso_curto" ${data.quandoAplica === 'por_descanso_curto' ? 'selected' : ''}>â˜• Por Descanso Curto</option>
                                <option value="por_arco" ${data.quandoAplica === 'por_arco' ? 'selected' : ''}>ðŸ“– Por Arco</option>
                                <option value="por_masmorra" ${data.quandoAplica === 'por_masmorra' ? 'selected' : ''}>ðŸ° Por Masmorra</option>
                                <option value="ao_ativar" ${data.quandoAplica === 'ao_ativar' ? 'selected' : ''}>âš¡ Ao Ativar</option>
                                <option value="ao_desativar" ${data.quandoAplica === 'ao_desativar' ? 'selected' : ''}>ðŸ”Œ Ao Desativar</option>
                                <option value="condicional" ${data.quandoAplica === 'condicional' ? 'selected' : ''}>ðŸŽ¯ Condicional</option>
                                <option value="permanente" ${(!data.quandoAplica || data.quandoAplica === 'permanente') ? 'selected' : ''}>â™¾ï¸ Permanente (Passivo)</option>
                                <option value="por_uso_recurso" ${data.quandoAplica === 'por_uso_recurso' ? 'selected' : ''}>ðŸ”‹ Por Uso de Recurso</option>
                                <option value="por_morte" ${data.quandoAplica === 'por_morte' ? 'selected' : ''}>ðŸ’€ Por Morte e RessurreiÃ§Ã£o</option>
                            </select>
                        </div>
                        <div id="mech_expCondicaoWrap" style="display:${data.quandoAplica === 'condicional' ? '' : 'none'}">
                            <div class="form-group full-width"><label>CondiÃ§Ã£o <span class="required">*</span></label>
                                <textarea id="mech_expCondicao" placeholder="Ex: Quando o personagem mata um inimigo com AI superior ao dele" oninput="window._mechUpdatePreview()">${esc(data.condicaoExp || '')}</textarea>
                            </div>
                        </div>
                        <div id="mech_expRecursoWrap" style="display:${data.quandoAplica === 'por_uso_recurso' ? '' : 'none'}">
                            <div class="form-grid">
                                <div class="form-group"><label>Recurso <span class="required">*</span></label>
                                    <select id="mech_expRecurso" onchange="window._mechRecursoExpChange()">
                                        <option value="energia" ${(data.recursoExp || 'energia') === 'energia' ? 'selected' : ''}>âš¡ Energia</option>
                                        <option value="sanidade" ${data.recursoExp === 'sanidade' ? 'selected' : ''}>ðŸ§  Sanidade</option>
                                        <option value="graca" ${data.recursoExp === 'graca' ? 'selected' : ''}>âœ¨ GraÃ§a</option>
                                        <option value="vitalidade" ${data.recursoExp === 'vitalidade' ? 'selected' : ''}>â¤ï¸ Vitalidade</option>
                                        <option value="outro" ${data.recursoExp === 'outro' ? 'selected' : ''}>ðŸ“ Outro</option>
                                    </select>
                                </div>
                                <div class="form-group" id="mech_expRecursoOutroWrap" style="display:${data.recursoExp === 'outro' ? '' : 'none'}">
                                    <label>Qual recurso?</label>
                                    <input type="text" id="mech_expRecursoOutro" value="${esc(data.recursoExpOutro || '')}" placeholder="Nome do recurso" oninput="window._mechUpdatePreview()">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group"><label>Quem Ã© afetado?</label>
                        <select id="mech_escopo" onchange="window._mechUpdatePreview()">
                            <option value="proprio" ${(data.escopo || 'proprio') === 'proprio' ? 'selected' : ''}>O prÃ³prio personagem</option>
                            <option value="aliado" ${data.escopo === 'aliado' ? 'selected' : ''}>1 Aliado</option>
                            <option value="aliados_area" ${data.escopo === 'aliados_area' ? 'selected' : ''}>Aliados em Ã¡rea</option>
                            <option value="inimigo" ${data.escopo === 'inimigo' ? 'selected' : ''}>1 Inimigo</option>
                            <option value="inimigos_area" ${data.escopo === 'inimigos_area' ? 'selected' : ''}>Inimigos em Ã¡rea</option>
                            <option value="todos_area" ${data.escopo === 'todos_area' ? 'selected' : ''}>Todos em Ã¡rea</option>
                        </select></div>
                    <div class="form-group full-width"><label>CondiÃ§Ã£o de AplicaÃ§Ã£o</label>
                        <textarea id="mech_condicaoAplicacao" placeholder="Ex: Apenas em ambientes urbanos, Em testes de IntimidaÃ§Ã£o..." oninput="window._mechUpdatePreview()">${esc(data.condicaoAplicacao || '')}</textarea></div>
                    <div class="form-group"><label>Empilhamento</label>
                        <select id="mech_empilhamento">
                            <option value="soma" ${(data.empilhamento || 'soma') === 'soma' ? 'selected' : ''}>Soma com outros iguais</option>
                            <option value="maior" ${data.empilhamento === 'maior' ? 'selected' : ''}>SÃ³ o maior valor</option>
                            <option value="nao_empilha" ${data.empilhamento === 'nao_empilha' ? 'selected' : ''}>NÃ£o empilha</option>
                        </select></div>
                </div>
            </div>

            ${renderConfigProgressao(data, tipo)}

            <div class="mech-form-section">
                <div class="mech-section-label">ðŸ·ï¸ Tags e PublicaÃ§Ã£o</div>
                <div class="form-grid">
                    <div class="form-group full-width"><label>Tags de busca</label>
                        <div class="tags-container" id="mech_tags_container" onclick="this.querySelector('input').focus()">
                            ${tags.map(t => `<span class="tag">${esc(t)}<button type="button" onclick="this.closest('.tag').remove()">Ã—</button></span>`).join('')}
                            <input type="text" placeholder="Digite e pressione Enter" onkeydown="window._mechTagKey(event)">
                        </div></div>
                    <div class="form-group">
                        <div class="form-toggle">
                            <label class="toggle-publish"><input type="checkbox" id="mech_publicado" ${data.publicado ? 'checked' : ''}><span class="toggle-slider"></span></label>
                            <span class="toggle-label">Publicado</span>
                        </div></div>
                </div>
            </div>

            <div class="mech-form-actions">
                <button type="button" class="btn-modal btn-cancel" onclick="window._mechBack()">Cancelar</button>
                <button type="button" class="btn-save" id="mechBtnSave" onclick="window._mechSave()">ðŸ’¾ Salvar</button>
            </div>
        </div>

        <div class="mech-preview-panel">
            <div class="mech-preview-header">ðŸ“‹ Preview do Efeito</div>
            <div class="mech-preview-text" id="mechPreviewText">Preencha os campos para ver o preview</div>
            <div class="mech-preview-meta" id="mechPreviewMeta"></div>
        </div>
    </div>`;

    // Store editing state
    window._mechEditingId = itemId || null;
    window._mechCallbacks = callbacks;
    window._mechAllItems = allItems;
    window._mechCache = mechanicsCache;

    // Render initial config
    window._mechTipoChange();
    setTimeout(() => window._mechUpdatePreview(), 50);
}

// ===== GLOBAL HANDLERS (attached to window) =====
window._mechBack = function () {
    document.getElementById('mechanicsEditorArea').style.display = 'none';
    document.getElementById('moduleContent').style.display = '';
};

window._mechTipoChange = function () {
    const tipo = document.getElementById('mech_tipo')?.value || 'modificar';
    const area = document.getElementById('mechConfigArea');
    const data = window._mechAllItems?.find(i => i.id === window._mechEditingId);
    const config = (data && data.tipo === tipo) ? (data.config || {}) : {};

    if (tipo === 'modificar') area.innerHTML = renderConfigModificar(config);
    else if (tipo === 'limitar') area.innerHTML = renderConfigLimitar(config);
    else if (tipo === 'conceder') area.innerHTML = renderConfigConceder(config);
    else if (tipo === 'condicional') area.innerHTML = renderConfigCondicional(config, window._mechCache || []);
    else if (tipo === 'narrativo') area.innerHTML = renderConfigNarrativo(config);
    else if (tipo === 'distribuir') area.innerHTML = renderConfigDistribuir(config);

    // Set alvo values and ficha refs in calc rows after DOM is ready
    if (tipo === 'modificar' || tipo === 'limitar') {
        setTimeout(() => {
            const calcList = document.getElementById('mechCalcList');
            if (!calcList) return;
            let calculos = config?.calculos;
            // Backward compat
            if (!Array.isArray(calculos) || calculos.length === 0) {
                if (config?.alvo) {
                    if (tipo === 'modificar') {
                        calculos = [{ alvo: Array.isArray(config.alvo) ? config.alvo[0] : config.alvo }];
                    } else {
                        calculos = [{ alvo: config.alvo }];
                    }
                } else {
                    calculos = [{}];
                }
            }
            const rows = calcList.querySelectorAll('.calc-row');
            rows.forEach((row, i) => {
                const c = calculos[i] || {};
                const alvoSel = row.querySelector('.calc-alvo');
                if (alvoSel && c.alvo) alvoSel.value = c.alvo;

                // Toggle qualExp selector visibility
                const isEXP = c.alvo === 'EXP';
                const qualWrap = row.querySelector('.calc-exp-qual-wrap');
                if (qualWrap) qualWrap.style.display = isEXP ? '' : 'none';

                // Restore qualExp value
                if (isEXP) {
                    const qualExpSel = row.querySelector('.calc-qualExp');
                    if (qualExpSel && c.qualExp) qualExpSel.value = c.qualExp;
                }

                // Restore equation term ficha refs
                const equacao = c.equacao || _migrateCalcToEquacao(c);
                const termEls = row.querySelectorAll('.eq-term');
                termEls.forEach((termEl, ti) => {
                    const t = equacao[ti];
                    if (t && t.tipo === 'ficha' && t.ref) {
                        const refSel = termEl.querySelector('.eq-term-ref');
                        if (refSel) refSel.value = t.ref;
                    }
                });
            });
            // Sync DuraÃ§Ã£o section for EXP after calc rows are restored
            window._mechSyncDuracaoForExp();
            // Refresh progression after equacao is set in DOM
            window._mechRefreshProgressao(tipo);
        }, 0);
    }

    // Re-render progression table with correct columns for new type
    window._mechRefreshProgressao(tipo);
    window._mechUpdatePreview();
};

// ===== CALC ROW HANDLERS =====
window._mechAddCalc = function (calcType) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const index = list.querySelectorAll('.calc-row').length;
    const html = calcType === 'limitar'
        ? _renderCalcRowLimitar(null, index)
        : _renderCalcRowModificar(null, index);
    list.insertAdjacentHTML('beforeend', html);
    window._mechUpdatePreview();
};

window._mechRemoveCalc = function (index) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const rows = list.querySelectorAll('.calc-row');
    if (rows.length <= 1) return; // Keep at least 1
    if (rows[index]) rows[index].remove();
    // Re-index remaining rows
    list.querySelectorAll('.calc-row').forEach((row, i) => {
        row.dataset.calcIndex = i;
        const num = row.querySelector('.calc-row-num');
        if (num) num.textContent = `#${i + 1}`;
    });
    window._mechUpdatePreview();
};

// ===== EQUATION TERM HANDLERS =====
window._mechTermTipoChange = function (calcIndex, termIndex) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const row = list.querySelectorAll('.calc-row')[calcIndex];
    if (!row) return;
    const term = row.querySelectorAll('.eq-term')[termIndex];
    if (!term) return;
    const tipo = term.querySelector('.eq-term-tipo')?.value || 'fixo';
    const fixoWrap = term.querySelector('.eq-term-fixo-wrap');
    const fichaWrap = term.querySelector('.eq-term-ficha-wrap');
    if (fixoWrap) fixoWrap.style.display = tipo === 'fixo' ? '' : 'none';
    if (fichaWrap) fichaWrap.style.display = tipo === 'ficha' ? '' : 'none';
    // Refresh progression columns when term type changes
    window._mechRefreshProgressao();
};

window._mechAddTerm = function (calcIndex) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const row = list.querySelectorAll('.calc-row')[calcIndex];
    if (!row) return;
    const container = row.querySelector('.eq-terms-container');
    if (!container) return;
    const termIndex = container.querySelectorAll('.eq-term').length;
    const html = _renderEquationTerm({ op: '+', tipo: 'fixo', valor: '' }, calcIndex, termIndex);
    container.insertAdjacentHTML('beforeend', html);
    // Refresh progression columns
    window._mechRefreshProgressao();
    window._mechUpdatePreview();
};

window._mechRemoveTerm = function (calcIndex, termIndex) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const row = list.querySelectorAll('.calc-row')[calcIndex];
    if (!row) return;
    const container = row.querySelector('.eq-terms-container');
    if (!container) return;
    const terms = container.querySelectorAll('.eq-term');
    if (terms.length <= 1) return; // Keep at least 1
    if (terms[termIndex]) terms[termIndex].remove();
    // Re-index remaining terms â€” re-render to fix onclick indices
    const currentEquacao = _collectEquacaoFromContainer(container);
    container.innerHTML = currentEquacao.map((t, ti) => _renderEquationTerm(t, calcIndex, ti)).join('');
    // Restore ficha ref values after re-render
    _restoreEquacaoRefs(container, currentEquacao);
    // Refresh progression columns
    window._mechRefreshProgressao();
    window._mechUpdatePreview();
};

// ===== COLLECT EQUATION FROM A CALC ROW =====
function _collectEquacaoFromRow(row) {
    const container = row.querySelector('.eq-terms-container');
    if (!container) return [{ tipo: 'fixo', valor: '' }];
    return _collectEquacaoFromContainer(container);
}

function _collectEquacaoFromContainer(container) {
    const terms = container.querySelectorAll('.eq-term');
    return Array.from(terms).map((term, i) => {
        const tipo = term.querySelector('.eq-term-tipo')?.value || 'fixo';
        const entry = { tipo };
        if (i > 0) entry.op = term.querySelector('.eq-term-op')?.value || '+';
        if (tipo === 'ficha') {
            entry.ref = term.querySelector('.eq-term-ref')?.value || '';
        } else {
            const rawVal = term.querySelector('.eq-term-valor')?.value?.trim() ?? '';
            entry.valor = isNaN(Number(rawVal)) || rawVal === '' ? rawVal : Number(rawVal);
        }
        return entry;
    });
}

function _restoreEquacaoRefs(container, equacao) {
    const terms = container.querySelectorAll('.eq-term');
    terms.forEach((term, i) => {
        const t = equacao[i];
        if (!t) return;
        if (t.tipo === 'ficha') {
            const refSel = term.querySelector('.eq-term-ref');
            if (refSel && t.ref) refSel.value = t.ref;
        }
    });
}

window._mechCalcLimitChange = function (index) {
    const list = document.getElementById('mechCalcList');
    if (!list) return;
    const row = list.querySelectorAll('.calc-row')[index];
    if (!row) return;
    const tl = row.querySelector('.calc-tipoLimite')?.value || '';
    const valorArea = row.querySelector('.calc-limit-valor-area');
    if (valorArea) valorArea.style.display = (tl && tl !== 'bloqueio') ? '' : 'none';
};

window._mechLimitChange = function () {
    const tl = document.getElementById('mech_config_tipoLimite')?.value || '';
    const maxW = document.getElementById('mech_maxWrap');
    const minW = document.getElementById('mech_minWrap');
    if (maxW) maxW.style.display = ['maximo', 'clamp'].includes(tl) ? '' : 'none';
    if (minW) minW.style.display = ['minimo', 'clamp'].includes(tl) ? '' : 'none';
};

window._mechDuracaoChange = function () {
    const d = document.getElementById('mech_duracao')?.value || '';
    const tw = document.getElementById('mech_turnosWrap');
    const ew = document.getElementById('mech_especWrap');
    if (tw) tw.style.display = d === 'turno' ? '' : 'none';
    if (ew) ew.style.display = d === 'especial' ? '' : 'none';
};

window._mechEvoluivelChange = function () {
    const checked = document.getElementById('mech_evoluivel')?.checked || false;
    const maxWrap = document.getElementById('mech_nivelMaxWrap');
    const tabelaWrap = document.getElementById('mech_progressaoTabela');
    const criacaoWrap = document.getElementById('mech_apenasCriacaoWrap');
    const tipoExpWrap = document.getElementById('mech_tipoExpWrap');
    if (maxWrap) maxWrap.style.display = checked ? '' : 'none';
    if (tabelaWrap) tabelaWrap.style.display = checked ? '' : 'none';
    if (criacaoWrap) criacaoWrap.style.display = checked ? '' : 'none';
    if (tipoExpWrap) tipoExpWrap.style.display = checked ? '' : 'none';
    if (checked) window._mechNivelMaxChange();
};

window._mechTipoExpChange = function () {
    // Refresh table headers with new EXP type label
    const evoluivel = document.getElementById('mech_evoluivel')?.checked || false;
    if (!evoluivel) return;
    window._mechNivelMaxChange();
    window._mechUpdatePreview();
};

window._mechNivelMaxChange = function () {
    const max = parseInt(document.getElementById('mech_nivelMaximo')?.value) || 3;
    const tipo = document.getElementById('mech_tipo')?.value || 'modificar';
    const tipoExp = document.getElementById('mech_progressaoTipoExp')?.value || 'custo';
    const tbody = document.getElementById('mech_progressaoBody');
    const thead = document.getElementById('mech_progressaoHead');
    if (!tbody) return;

    const fixoTerms = (tipo === 'modificar' || tipo === 'limitar') ? _getEquacaoFixoTerms() : [];

    // Preserve existing values
    const existing = {};
    tbody.querySelectorAll('tr').forEach(row => {
        const nv = row.querySelector('.prog-custo')?.dataset.nivel;
        if (nv) {
            const p = { custoExp: row.querySelector('.prog-custo')?.value || '' };
            if ((tipo === 'modificar' || tipo === 'limitar') && fixoTerms.length > 0) {
                p.termos = {};
                row.querySelectorAll('.prog-termo').forEach(inp => {
                    p.termos[inp.dataset.termoIndex] = inp.value || '';
                });
            } else if (tipo === 'modificar') {
                p.valor = row.querySelector('.prog-valor')?.value || '';
            } else if (tipo === 'limitar') {
                p.valorLimite = row.querySelector('.prog-valorLimite')?.value || '';
            } else if (tipo === 'distribuir') {
                p.quantidadeAlvos = row.querySelector('.prog-quantidadeAlvos')?.value || '';
                p.valorPorAlvo = row.querySelector('.prog-valorPorAlvo')?.value || '';
            } else {
                p.descricao = row.querySelector('.prog-descricao')?.value || '';
            }
            existing[nv] = p;
        }
    });
    // Update headers
    if (thead) {
        const headers = _getProgressaoHeaders(tipo, tipoExp, fixoTerms);
        thead.innerHTML = `<tr style="background:var(--bg-secondary);color:var(--text-secondary)">${headers.map(h => `<th style="padding:6px 8px${h === 'NÃ­vel' ? ';width:60px' : ''}">${h}</th>`).join('')}</tr>`;
    }
    let html = '';
    for (let i = 1; i <= max; i++) {
        const prev = existing[String(i)] || {};
        html += _renderProgressaoRow(i, prev, tipo, fixoTerms);
    }
    tbody.innerHTML = html;
};

window._mechRefreshProgressao = function (tipo) {
    const evoluivel = document.getElementById('mech_evoluivel')?.checked || false;
    if (!evoluivel) return;
    window._mechNivelMaxChange();
};

window._mechUpdatePreview = function () {
    const formData = collectMechFormData();
    const text = generatePreviewText(formData);
    const el = document.getElementById('mechPreviewText');
    if (el) el.textContent = text || 'Preencha os campos para ver o preview';

    const meta = document.getElementById('mechPreviewMeta');
    if (meta) {
        const fonte = FONTE_LABELS[formData.fonte] || formData.fonte || 'â€”';
        const dur = formData.duracao || 'permanente';
        const esc2 = formData.escopo || 'proprio';
        meta.innerHTML = `
            <span>ðŸ“Œ <strong>Fonte:</strong> ${fonte}</span>
            <span>ðŸ• <strong>DuraÃ§Ã£o:</strong> ${dur}${dur === 'turno' ? ' (' + (formData.duracaoTurnos || '?') + ' turnos)' : ''}${dur === 'especial' ? ' â€” ' + (formData.duracaoEspecial || '?') : ''}</span>
            <span>ðŸ‘¤ <strong>Escopo:</strong> ${esc2}</span>
            ${formData.condicaoAplicacao ? `<span>ðŸ“Ž <strong>CondiÃ§Ã£o:</strong> ${esc(formData.condicaoAplicacao)}</span>` : ''}`;
    }
};

window._mechTagKey = function (e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const input = e.target;
        const val = input.value.trim().replace(/,$/g, '');
        if (!val) return;
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `${esc(val)}<button type="button" onclick="this.closest('.tag').remove()">Ã—</button>`;
        input.parentElement.insertBefore(tag, input);
        input.value = '';
    }
};

// ===== COLLECT FORM DATA =====
function collectMechFormData() {
    const tipo = document.getElementById('mech_tipo')?.value || 'modificar';
    const data = {
        nome: document.getElementById('mech_nome')?.value || '',
        descricao: document.getElementById('mech_descricao')?.value || '',
        fonte: document.getElementById('mech_fonte')?.value || '',
        tipo,
        duracao: document.getElementById('mech_duracao')?.value || 'permanente',
        duracaoTurnos: Number(document.getElementById('mech_duracaoTurnos')?.value) || null,
        duracaoEspecial: document.getElementById('mech_duracaoEspecial')?.value || '',
        escopo: document.getElementById('mech_escopo')?.value || 'proprio',
        condicaoAplicacao: document.getElementById('mech_condicaoAplicacao')?.value || '',
        empilhamento: document.getElementById('mech_empilhamento')?.value || 'soma',
        config: {}
    };

    if (tipo === 'modificar') {
        const calcRows = document.querySelectorAll('#mechCalcList .calc-row');
        const calculos = Array.from(calcRows).map(row => {
            const alvo = row.querySelector('.calc-alvo')?.value || '';
            if (alvo === 'EXP') {
                // EXP uses standard operacao + equacao, just adds qualExp
                return {
                    alvo: 'EXP',
                    qualExp: row.querySelector('.calc-qualExp')?.value || 'ambos',
                    operacao: row.querySelector('.calc-operacao')?.value || '+',
                    equacao: _collectEquacaoFromRow(row)
                };
            }
            return {
                alvo,
                operacao: row.querySelector('.calc-operacao')?.value || '+',
                equacao: _collectEquacaoFromRow(row)
            };
        });
        data.config = { calculos };

        // If any calc targets EXP, collect the EXP trigger info from DuraÃ§Ã£o section
        const hasExpCalc = calculos.some(c => c.alvo === 'EXP');
        if (hasExpCalc) {
            const recursoExp = document.getElementById('mech_expRecurso')?.value || 'energia';
            data.quandoAplica = document.getElementById('mech_duracao_exp')?.value || 'permanente';
            data.condicaoExp = document.getElementById('mech_expCondicao')?.value || '';
            data.recursoExp = recursoExp;
            data.recursoExpOutro = recursoExp === 'outro' ? (document.getElementById('mech_expRecursoOutro')?.value || '') : '';
        }
    } else if (tipo === 'limitar') {
        const calcRows = document.querySelectorAll('#mechCalcList .calc-row');
        const calculos = Array.from(calcRows).map(row => {
            return {
                alvo: row.querySelector('.calc-alvo')?.value || '',
                tipoLimite: row.querySelector('.calc-tipoLimite')?.value || '',
                equacao: _collectEquacaoFromRow(row)
            };
        });
        data.config = { calculos };
    } else if (tipo === 'conceder') {
        data.config = {
            tipoConcessao: document.getElementById('mech_config_tipoConcessao')?.value || '',
            descricaoConcessao: document.getElementById('mech_config_descricaoConcessao')?.value || ''
        };
    } else if (tipo === 'condicional') {
        data.config = {
            gatilho: document.getElementById('mech_config_gatilho')?.value || '',
            efeitoSucessoIds: JSON.parse(document.getElementById('mech_config_efeitoSucessoIds')?.value || '[]'),
            efeitoFalhaIds: JSON.parse(document.getElementById('mech_config_efeitoFalhaIds')?.value || '[]')
        };
    } else if (tipo === 'narrativo') {
        data.config = { textoEfeito: document.getElementById('mech_config_textoEfeito')?.value || '' };
    } else if (tipo === 'distribuir') {
        const poolCustomEl = document.getElementById('mech_config_poolPersonalizado');
        let poolPersonalizado = [];
        if (poolCustomEl) {
            poolPersonalizado = Array.from(
                poolCustomEl.querySelectorAll('input[type="checkbox"]:checked')
            ).map(cb => cb.value);
        }
        data.config = {
            pool: document.getElementById('mech_config_pool')?.value || '',
            quantidadeAlvos: Number(document.getElementById('mech_config_quantidadeAlvos')?.value) || 1,
            valorPorAlvo: Number(document.getElementById('mech_config_valorPorAlvo')?.value) || 1,
            operacao: document.getElementById('mech_config_operacao_dist')?.value || '+',
            restricao: document.getElementById('mech_config_restricao')?.value || 'diferentes',
            poolPersonalizado
        };
    }

    // ProgressÃ£o por nÃ­vel
    data.evoluivel = document.getElementById('mech_evoluivel')?.checked || false;
    if (data.evoluivel) {
        data.nivelMaximo = parseInt(document.getElementById('mech_nivelMaximo')?.value) || 3;
        data.progressaoApenasCriacao = document.getElementById('mech_progressaoApenasCriacao')?.checked || false;
        data.progressaoTipoExp = document.getElementById('mech_progressaoTipoExp')?.value || 'custo';
        const progressao = {};
        const tbody = document.getElementById('mech_progressaoBody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const custoEl = row.querySelector('.prog-custo');
                if (!custoEl) return;
                const nv = custoEl.dataset.nivel;
                const entry = { custoExp: parseInt(custoEl.value) || 0 };

                if (tipo === 'modificar' || tipo === 'limitar') {
                    // Check for per-term progression (new equation format)
                    const termoInputs = row.querySelectorAll('.prog-termo');
                    if (termoInputs.length > 0) {
                        entry.termos = {};
                        termoInputs.forEach(inp => {
                            const rawV = inp.value?.trim() ?? '';
                            entry.termos[inp.dataset.termoIndex] = isNaN(Number(rawV)) || rawV === '' ? rawV : Number(rawV);
                        });
                    } else if (tipo === 'modificar') {
                        const v = row.querySelector('.prog-valor')?.value?.trim() ?? '';
                        entry.valor = isNaN(Number(v)) || v === '' ? v : Number(v);
                    } else {
                        const v = row.querySelector('.prog-valorLimite')?.value?.trim() ?? '';
                        entry.valorLimite = isNaN(Number(v)) || v === '' ? v : Number(v);
                    }
                } else if (tipo === 'distribuir') {
                    entry.quantidadeAlvos = parseInt(row.querySelector('.prog-quantidadeAlvos')?.value) || null;
                    const v = row.querySelector('.prog-valorPorAlvo')?.value?.trim() ?? '';
                    entry.valorPorAlvo = isNaN(Number(v)) || v === '' ? v : Number(v);
                } else {
                    entry.descricao = row.querySelector('.prog-descricao')?.value?.trim() ?? '';
                }
                progressao[nv] = entry;
            });
        }
        data.progressao = progressao;
    } else {
        data.evoluivel = false;
        data.nivelMaximo = null;
        data.progressao = null;
        data.progressaoApenasCriacao = false;
        data.progressaoTipoExp = 'custo';
    }

    return data;
}

// ===== SAVE MECHANIC =====
window._mechSave = async function () {
    const cb = window._mechCallbacks;
    const data = collectMechFormData();

    // Collect tags
    const tagsContainer = document.getElementById('mech_tags_container');
    data.tags = tagsContainer ? Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('Ã—', '').trim()) : [];
    data.publicado = document.getElementById('mech_publicado')?.checked || false;
    data.previewTexto = generatePreviewText(data);

    // Validate
    if (!data.nome) { cb.showAlert('âš ï¸ Campo obrigatÃ³rio: Nome', 'danger'); return; }
    if (!data.descricao) { cb.showAlert('âš ï¸ Campo obrigatÃ³rio: DescriÃ§Ã£o', 'danger'); return; }

    // Metadata
    data.atualizadoEm = cb.Timestamp.now();
    const editId = window._mechEditingId;
    if (!editId) {
        data.criadoPor = cb.currentUser.uid;
        data.criadoEm = cb.Timestamp.now();
        data.versao = 1;
    } else {
        const ex = window._mechAllItems?.find(i => i.id === editId);
        data.versao = (ex?.versao || 0) + 1;
    }

    const btn = document.getElementById('mechBtnSave');
    btn.disabled = true; btn.textContent = 'â³ Salvando...';

    try {
        if (editId) {
            await cb.updateDoc(cb.doc(cb.db, 'system/data/mechanics', editId), data);
            cb.showAlert('âœ… MecÃ¢nica atualizada!', 'success');
        } else {
            await cb.addDoc(cb.collection(cb.db, 'system/data/mechanics'), data);
            cb.showAlert('âœ… MecÃ¢nica criada!', 'success');
        }
        window._mechBack();
        await cb.loadModule('mechanics');
    } catch (e) {
        console.error('Erro ao salvar mecÃ¢nica:', e);
        cb.showAlert('âŒ Erro ao salvar: ' + e.message, 'danger');
    } finally {
        btn.disabled = false; btn.textContent = 'ðŸ’¾ Salvar';
    }
};

// ===== MECHANIC SELECTOR GLOBAL HANDLERS =====
window._mechSelRemove = function (fieldId, mechId) {
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    let ids = JSON.parse(hidden.value || '[]');
    // Adapter to handle both objects ({id}) and strings
    ids = ids.filter(item => {
        if (typeof item === 'object') return item.id !== mechId;
        return item !== mechId;
    });
    hidden.value = JSON.stringify(ids);
    // Remove chip
    const chip = document.querySelector(`#${fieldId}_chips .mechsel-chip button[onclick*="${mechId}"]`);
    if (chip) chip.closest('.mechsel-chip').remove();
    if (!ids.length) {
        document.getElementById(`${fieldId}_chips`).innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecÃ¢nica ou peculiaridade vinculada</span>';
    }
};

window._mechSelFilter = function (fieldId, text) {
    const results = document.getElementById(`${fieldId}_results`);
    if (!results) return;
    const labels = results.querySelectorAll('.mechsel-result');
    const lower = text.toLowerCase();
    labels.forEach(l => {
        const name = l.querySelector('.mechsel-result-name')?.textContent.toLowerCase() || '';
        l.style.display = name.includes(lower) ? '' : 'none';
    });
};

window._mechSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;
    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    hidden.value = JSON.stringify(checked);
    document.getElementById(`${fieldId}_search`).classList.remove('open');
    // Refresh chips
    const cache = window._mechCache || [];
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecÃ¢nica vinculada</span>';
        } else {
            chipsEl.innerHTML = checked.map(mid => {
                const m = cache.find(x => x.id === mid);
                if (!m) return '';
                return `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || 'ðŸ”§'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">âœ•</button></div>`;
            }).join('');
        }
    }
};

// ===== REUSABLE MECHANIC SELECTOR BUILDER (for other module forms) =====
export function buildMechanicSelectorHTML(fieldKey, label, currentIds, cache, fontePreFilter) {
    const published = cache.filter(m => m.publicado);
    const chips = (currentIds || []).map(mid => {
        const m = cache.find(x => x.id === mid);
        return m ? `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || 'ðŸ”§'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${mid}')">âœ•</button></div>` : '';
    }).join('');
    const opts = published.map(m => `<label class="mechsel-result" data-fonte="${m.fonte || ''}"><input type="checkbox" value="${m.id}" ${(currentIds || []).includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">${TIPO_ICONS[m.tipo] || 'ðŸ”§'} ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.previewTexto || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecÃ¢nica vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">âž• Adicionar MecÃ¢nica</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="ðŸ” Buscar..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
                <select onchange="window._mechSelFilterFonte('field_${fieldKey}', this.value)">
                    <option value="">Todas fontes</option>
                    ${Object.entries(FONTE_LABELS).map(([k, v]) => `<option value="${k}" ${fontePreFilter === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._mechSelConfirm('field_${fieldKey}')">âœ”ï¸ Vincular Selecionadas</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(currentIds || [])}'>
    </div>`;
}

// Peculiarity selector (for races)
export function buildPecSelectorHTML(fieldKey, label, currentIds, cache, fontePreFilter) {
    const published = cache.filter(p => p.publicado);
    const parsedIds = (currentIds || []).map(item => typeof item === 'object' ? item : { id: item, nivelInicial: 1 });
    const selectedIds = parsedIds.map(p => p.id);

    const chips = parsedIds.map(pObj => {
        const pid = pObj.id;
        const p = cache.find(x => x.id === pid);
        return p ? `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p.fonte || 'generica'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">âœ¨ ${esc(p.nome)}</div><div class="mechsel-chip-preview">${esc(p.fonte || '')} â€” NÃ­vel Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('field_${fieldKey}', '${pid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${pid}')">âœ•</button></div>` : '';
    }).join('');
    const opts = published.map(p => `<label class="mechsel-result"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}><span class="mechsel-result-name">âœ¨ ${esc(p.nome)}</span><span class="mechsel-result-preview">${esc(p.fonte || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma peculiaridade vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">âž• Adicionar Peculiaridade</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="ðŸ” Buscar peculiaridade..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._pecSelConfirm('field_${fieldKey}')">âœ”ï¸ Vincular Selecionadas</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(parsedIds)}'>
    </div>`;
}

window._pecSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;

    // Get existing to preserve nivelInicial
    const existingIds = JSON.parse(hidden.value || '[]');
    const existingMap = new Map();
    existingIds.forEach(item => {
        if (typeof item === 'object') existingMap.set(item.id, item.nivelInicial);
        else existingMap.set(item, 1);
    });

    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => {
        return {
            id: cb.value,
            nivelInicial: existingMap.has(cb.value) ? existingMap.get(cb.value) : 1
        };
    });

    hidden.value = JSON.stringify(checked);
    document.getElementById(`${fieldId}_search`).classList.remove('open');

    // Refresh chips
    const cache = window._mechCache || []; // Usually peculiarities cache, handled well enough here
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma peculiaridade vinculada</span>';
        } else {
            chipsEl.innerHTML = checked.map(pObj => {
                const mid = pObj.id;
                // Try from both cache in case since _mechCache might be mechanics...
                // Firebase sets peculiaritiesCache but we only pass it to buildPecSelectorHTML.  
                // Assuming reload works if we close the modal and reopen it, or we rely on DOM reload.
                // To be safe, wait for visual update or use simple names based on existing cache.
                const p = window._mechAllItems ? window._mechAllItems.find(x => x.id === mid) : { nome: "Carregando...", fonte: "?" };
                if (!p && globals_for_cache) return ''; // just a fallback
                return `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p?.fonte || 'generica'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">âœ¨ ${esc(p?.nome || mid)}</div><div class="mechsel-chip-preview">${esc(p?.fonte || '')} â€” NÃ­vel Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('${fieldId}', '${mid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">âœ•</button></div>`;
            }).join('');
        }
    }
};

window._pecSelLevelChange = function (fieldId, mechId, newValue) {
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    let ids = JSON.parse(hidden.value || '[]');
    ids = ids.map(item => {
        if (typeof item === 'object' && item.id === mechId) {
            return { ...item, nivelInicial: parseInt(newValue) || 1 };
        }
        if (typeof item === 'string' && item === mechId) {
            return { id: item, nivelInicial: parseInt(newValue) || 1 };
        }
        return item;
    });
    hidden.value = JSON.stringify(ids);
};

// ===== SKILL SELECTOR (for classes pericClasse) =====
const CATEGORIA_LABELS = { mental: 'ðŸ§  Mental', fisico: 'ðŸ’ª FÃ­sico', social: 'ðŸ—£ï¸ Social', combate: 'âš”ï¸ Combate', exclusivo: 'ðŸŒŸ Exclusivo' };

export function buildSkillSelectorHTML(fieldKey, label, currentIds, cache) {
    const published = cache.filter(s => s.publicado !== false);
    const ids = currentIds || [];

    const chips = ids.map(sid => {
        const s = cache.find(x => x.id === sid);
        if (!s) return '';
        const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
        const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
        return `<div class="mechsel-chip" style="border-left-color:var(--accent)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">ðŸ“š ${esc(s.nome)}</div><div class="mechsel-chip-preview">${catLabel} â€” ${attrs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${sid}')">âœ•</button></div>`;
    }).join('');

    const opts = published.map(s => {
        const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
        const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
        return `<label class="mechsel-result" data-fonte="${s.categoria || ''}"><input type="checkbox" value="${s.id}" ${ids.includes(s.id) ? 'checked' : ''}><span class="mechsel-result-name">ðŸ“š ${esc(s.nome)}</span><span class="mechsel-result-preview">${catLabel} â€” ${attrs}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma perÃ­cia vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">âž• Adicionar PerÃ­cia</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="ðŸ” Buscar perÃ­cia..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._skillSelConfirm('field_${fieldKey}')">âœ”ï¸ Vincular Selecionadas</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(ids)}'>
    </div>`;
}

window._skillSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;
    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    hidden.value = JSON.stringify(checked);
    document.getElementById(`${fieldId}_search`).classList.remove('open');
    // Refresh chips
    const cache = window._skillsCache || [];
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma perÃ­cia vinculada</span>';
        } else {
            chipsEl.innerHTML = checked.map(sid => {
                const s = cache.find(x => x.id === sid);
                if (!s) return '';
                const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
                const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
                return `<div class="mechsel-chip" style="border-left-color:var(--accent)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">ðŸ“š ${esc(s.nome)}</div><div class="mechsel-chip-preview">${catLabel} â€” ${attrs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${sid}')">âœ•</button></div>`;
            }).join('');
        }
    }
};

window._mechSelFilterFonte = function (fieldId, fonte) {
    const results = document.getElementById(`${fieldId}_results`);
    if (!results) return;
    results.querySelectorAll('.mechsel-result').forEach(l => {
        if (!fonte) { l.style.display = ''; return; }
        l.style.display = (l.dataset.fonte === fonte) ? '' : 'none';
    });
};

// ===== DERIVED VALUE SELECTOR (for races/classes derivedValueIds) =====
export function buildDerivedValueSelectorHTML(fieldKey, label, currentIds, cache) {
    const published = cache.filter(d => d.publicado !== false);
    const parsedIds = (currentIds || []).map(item => typeof item === 'object' ? item : { id: item, valorInicial: 0 });
    const selectedIds = parsedIds.map(p => p.id);

    const chips = parsedIds.map(dvObj => {
        const did = dvObj.id;
        const d = cache.find(x => x.id === did);
        if (!d) return '';
        const icon = d.icone || 'ðŸ“Š';
        return `<div class="mechsel-chip" style="border-left-color:#8b5cf6"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? 'ðŸŒ Universal' : 'ðŸ”— Vinculado'} â€” Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('field_${fieldKey}', '${did}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${did}')">âœ•</button></div>`;
    }).join('');

    const opts = published.map(d => {
        const icon = d.icone || 'ðŸ“Š';
        return `<label class="mechsel-result"><input type="checkbox" value="${d.id}" ${selectedIds.includes(d.id) ? 'checked' : ''}><span class="mechsel-result-name">${icon} ${esc(d.nome)}</span><span class="mechsel-result-preview">Ordem: ${d.ordem || '?'}${d.todoPersonagem ? ' â€” Universal' : ''}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhum valor derivado vinculado</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">âž• Adicionar Valor Derivado</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="ðŸ” Buscar valor derivado..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._dvSelConfirm('field_${fieldKey}')">âœ”ï¸ Vincular Selecionados</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(parsedIds)}'>
    </div>`;
}

window._dvSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;

    // Preserve existing valorInicial
    const existingIds = JSON.parse(hidden.value || '[]');
    const existingMap = new Map();
    existingIds.forEach(item => {
        if (typeof item === 'object') existingMap.set(item.id, item.valorInicial);
        else existingMap.set(item, 0);
    });

    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => {
        return {
            id: cb.value,
            valorInicial: existingMap.has(cb.value) ? existingMap.get(cb.value) : 0
        };
    });

    hidden.value = JSON.stringify(checked);
    document.getElementById(`${fieldId}_search`).classList.remove('open');

    // Refresh chips
    const cache = window._derivedValuesCache || [];
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhum valor derivado vinculado</span>';
        } else {
            chipsEl.innerHTML = checked.map(dvObj => {
                const did = dvObj.id;
                const d = cache.find(x => x.id === did);
                if (!d) return '';
                const icon = d.icone || 'ðŸ“Š';
                return `<div class="mechsel-chip" style="border-left-color:#8b5cf6"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? 'ðŸŒ Universal' : 'ðŸ”— Vinculado'} â€” Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('${fieldId}', '${did}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${did}')">âœ•</button></div>`;
            }).join('');
        }
    }
};

window._dvSelLevelChange = function (fieldId, dvId, newValue) {
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    // Suportar vÃ­rgula como separador decimal (ex: 1,75 â†’ 1.75)
    const parsed = parseFloat(String(newValue).replace(',', '.')) || 0;
    let ids = JSON.parse(hidden.value || '[]');
    ids = ids.map(item => {
        if (typeof item === 'object' && item.id === dvId) {
            return { ...item, valorInicial: parsed };
        }
        if (typeof item === 'string' && item === dvId) {
            return { id: item, valorInicial: parsed };
        }
        return item;
    });
    hidden.value = JSON.stringify(ids);
};


