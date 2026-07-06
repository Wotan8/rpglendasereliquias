// =============================================
// VISUAL MECHANICS EDITOR — Lendas e Relíquias
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

    // Status Vitais — dinâmico do Firebase
    const vsCache = window._vitalStatsCache || [];
    const publishedVS = vsCache.filter(v => v.publicado !== false);
    if (publishedVS.length > 0) {
        publishedVS.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Status Vitais">`;
        for (const vs of publishedVS) {
            const icon = vs.icone || '❤️';
            html += `\n<option value="${esc(vs.nome)} Máxima">${icon} ${esc(vs.nome)} Máxima</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache não carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade Máxima">Vitalidade Máxima</option>`;
        html += `\n<option value="Energia Máxima">Energia Máxima</option>`;
        html += `\n<option value="Sanidade Máxima">Sanidade Máxima</option>`;
        html += `\n</optgroup>`;
    }

    // Valores Derivados — dinâmico do Firebase
    const dvCache = window._derivedValuesCache || [];
    const publishedDVs = dvCache.filter(d => d.publicado !== false);
    if (publishedDVs.length > 0) {
        publishedDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Valores Derivados">`;
        for (const dv of publishedDVs) {
            const icon = dv.icone || '📊';
            html += `\n<option value="${esc(dv.nome)}">${icon} ${esc(dv.nome)}</option>`;
            if (dv.campoAtual) {
                html += `\n<option value="${esc(dv.nome)} (Atual)">${icon} ${esc(dv.nome)} (Atual)</option>`;
                html += `\n<option value="${esc(dv.nome)} (Máximo)">${icon} ${esc(dv.nome)} (Máximo)</option>`;
            }
        }
        html += `\n</optgroup>`;
    }

    html += `
<optgroup label="Campos da Ficha">
<option value="Blindagem">Blindagem</option>
<option value="Tamanho">Tamanho</option>
</optgroup>`;

    // Partes do Corpo — dinâmico do Firebase
    const bpCache = window._bodyPartsCache || [];
    if (bpCache.length > 0) {
        bpCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Partes do Corpo (Slots)">`;
        for (const bp of bpCache) {
            const icon = bp.icone || '🦴';
            html += `\n<option value="Parte do Corpo: ${esc(bp.nome)}">${icon} Parte do Corpo: ${esc(bp.nome)}</option>`;
        }
        html += `\n</optgroup>`;
    }

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
<option value="Dano">Dano</option><option value="Dano Crítico">Dano Crítico</option>
</optgroup>
<optgroup label="Propriedades de Item">
<option value="Item: Peso/Pressão">⚖️ Peso / Pressão do Item</option>
<option value="Item: Tamanho">📐 Tamanho do Item</option>
<option value="Item: Multiplicador de Pressão">📦 Multiplicador de Pressão (conteúdo)</option>
<option value="Item: Capacidade do Container">🎒 Capacidade do Container (itens)</option>
<option value="Pressão Total (Equipados)">⚖️ Pressão Total (Itens Equipados)</option>
</optgroup>
<optgroup label="Experiência">
<option value="EXP">⭐ EXP</option>
</optgroup>
<optgroup label="Outros">
<option value="Perícias (qualquer)">Perícias (qualquer)</option>
<option value="Perícias Mentais (qualquer)">Perícias Mentais (qualquer)</option>
<option value="Perícias Físicas (qualquer)">Perícias Físicas (qualquer)</option>
<option value="Perícias Sociais (qualquer)">Perícias Sociais (qualquer)</option>
<option value="Ações por turno">Ações por turno</option>
<option value="EXP Necessária">EXP Necessária</option>
</optgroup>`;

    // Limites de Módulos de Classe (dinâmico)
    html += _getModuleLimitOptions();

    return html;
}

export const FONTE_LABELS = { raca: '🧬 Raça', classe: '⚔️ Classe', tribo: '🏕️ Tribo', peculiaridade: '✨ Pecul.', item: '🗡️ Item', condicao: '💀 Condição', manobra: '💥 Manobra', magia: '🔮 Magia', individual: '👤 Individual', generica: '⚙️ Genérica' };
export const TIPO_ICONS = { modificar: '➕', limitar: '🔒', conceder: '🎁', condicional: '⚡', narrativo: '📝', distribuir: '🎲' };
export const TIPO_LABELS = { modificar: 'Modificar', limitar: 'Limitar', conceder: 'Conceder', condicional: 'Condicional', narrativo: 'Narrativo', distribuir: 'Distribuir' };

function esc(text) {
    if (text === null || text === undefined) return '';
    const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML;
}

/**
 * Gera optgroup com opções de "Limite: <titulo>" para cada módulo de classe.
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
            options.push({ value: `Limite: ${titulo}`, label: `📦 Limite: ${titulo} (${cls.nome})` });
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
        const mult = calc.valorMultiplicador && calc.valorMultiplicador !== 1 ? ` × ${calc.valorMultiplicador}` : '';
        return `[${ref}${mult}]`;
    }
    return calc.valor ?? '?';
}

function _formatEquation(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return '?';
    // Check if any term uses min/max — if so, format as min(A, B, ...) or max(A, B, ...)
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
    const dur = data.duracao && data.duracao !== 'permanente' ? ` — Duração: ${data.duracao === 'turno' ? (data.duracaoTurnos || '?') + ' turno(s)' : data.duracao}` : '';
    const evo = data.evoluivel ? ` 📈 Nv1-${data.nivelMaximo || '?'}${data.progressaoApenasCriacao ? ' 🏗️' : ''}` : '';

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
                    const quandoLabels = { na_criacao: 'Na Criação', por_sessao: 'Por Sessão', por_descanso_longo: 'Por Descanso Longo', por_descanso_curto: 'Por Descanso Curto', por_arco: 'Por Arco', por_masmorra: 'Por Masmorra', ao_ativar: 'Ao Ativar', ao_desativar: 'Ao Desativar', condicional: 'Condicional', permanente: 'Permanente', por_uso_recurso: 'Por Uso de Recurso', por_morte: 'Por Morte/Ressurreição' };
                    const quandoLabel = quandoLabels[data.quandoAplica] || '';
                    const triggerSuffix = quandoLabel ? ` — ${quandoLabel}` : '';
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
                if (c.tipoLimite === 'maximo') return `${alvo}: máximo ${valStr}`;
                if (c.tipoLimite === 'minimo') return `${alvo}: mínimo ${valStr}`;
                if (c.tipoLimite === 'clamp') return `${alvo}: min ${_formatCalcValue({...c, valor: c.valorMinimo, valorRef: c.valorRefMin})}, max ${valStr}`;
                return `${alvo}: limite`;
            }).join('; ');
        } else {
            const alvo = config.alvo || '?';
            if (config.tipoLimite === 'bloqueio') text = `${alvo}: bloqueado (= 0)`;
            else if (config.tipoLimite === 'maximo') text = `${alvo}: máximo ${config.valorMaximo ?? '?'}`;
            else if (config.tipoLimite === 'minimo') text = `${alvo}: mínimo ${config.valorMinimo ?? '?'}`;
            else if (config.tipoLimite === 'clamp') text = `${alvo}: min ${config.valorMinimo ?? '?'}, max ${config.valorMaximo ?? '?'}`;
            else text = `${alvo}: limite`;
        }
    } else if (tipo === 'conceder') {
        const label = { capacidade: 'Concede', imunidade: 'Imunidade', vulnerabilidade: 'Vulnerabilidade', resistencia: 'Resistência', vantagem: 'Vantagem', desvantagem: 'Desvantagem', acesso: 'Acesso', remover_acesso: 'Remove acesso' };
        if (config.tipoConcessao === 'adicionar_parte_corpo' || config.tipoConcessao === 'remover_parte_corpo') {
            const verb = config.tipoConcessao === 'adicionar_parte_corpo' ? 'Adiciona' : 'Remove';
            const count = Array.isArray(config.partesCorpo) ? config.partesCorpo.length : 0;
            text = `${verb} ${count} Parte(s) do Corpo`;
        } else {
            text = `${label[config.tipoConcessao] || 'Concede'}: ${config.descricaoConcessao || '?'}`;
        }
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
    return text + evo + cond + dur || 'Efeito não definido';
}

// ===== MECHANIC CARD (for grid) =====
export function renderMechanicCard(item) {
    const name = esc(item.nome || 'Sem nome');
    const tipo = item.tipo || 'modificar';
    const fonte = item.fonte || 'generica';
    const preview = esc(item.previewTexto || '—');
    const isPublished = item.publicado === true;
    return `
        <div class="mech-card" data-type="${tipo}" onclick="openMechanicEditor('${item.id}')">
            <div class="mech-card-header">
                <div class="mech-card-name">${TIPO_ICONS[tipo] || '🔧'} ${name}</div>
                <div class="mech-card-badges">
                    <span class="badge-fonte" style="background:var(--fonte-${fonte})">${FONTE_LABELS[fonte] || fonte}</span>
                    <span class="badge-tipo" style="background:var(--type-${tipo})">${TIPO_LABELS[tipo] || tipo}</span>
                </div>
            </div>
            <div class="mech-card-preview">"${preview}"</div>
            <div class="mech-card-footer">
                <div class="item-card-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); openMechanicEditor('${item.id}')" title="Editar">✏️</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); duplicateItem('${item.id}')" title="Duplicar" style="border-color:var(--warning);color:var(--warning)">📋</button>
                    <button class="btn-delete-card" onclick="event.stopPropagation(); openDeleteModal('${item.id}','${esc(name).replace(/'/g, "\\'")}')" title="Excluir">🗑️</button>
                </div>
                <span class="badge-status ${isPublished ? 'badge-published' : 'badge-draft'}">${isPublished ? '✅ Pub' : '📝 Rasc'}</span>
            </div>
        </div>`;
}

// ===== VALUE SOURCE OPTIONS (dynamic from skills cache) =====
const CATEGORY_LABELS = {
    'mental': 'Perícias Mentais',
    'fisico': 'Perícias Físicas',
    'social': 'Perícias Sociais',
    'combate': 'Perícias Defensivas',
    'exclusivo': 'Perícias Exclusivas'
};

function getValueSourceHTML() {
    let html = `
<optgroup label="Atributos">
<option value="INT">INT</option><option value="RAC">RAC</option><option value="PRS">PRS</option>
<option value="FOR">FOR</option><option value="DES">DES</option><option value="VIG">VIG</option>
<option value="PRE">PRE</option><option value="MAN">MAN</option><option value="AUT">AUT</option>
</optgroup>
`;

    // Status Vitais — dinâmico do Firebase
    const vsCache3 = window._vitalStatsCache || [];
    const publishedVS3 = vsCache3.filter(v => v.publicado !== false);
    if (publishedVS3.length > 0) {
        publishedVS3.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Status Vitais">`;
        for (const vs of publishedVS3) {
            const icon = vs.icone || '❤️';
            html += `\n<option value="${esc(vs.nome)} Máxima">${icon} ${esc(vs.nome)} Máxima</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache não carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade Máxima">Vitalidade Máxima</option>`;
        html += `\n<option value="Energia Máxima">Energia Máxima</option>`;
        html += `\n<option value="Sanidade Máxima">Sanidade Máxima</option>`;
        html += `\n</optgroup>`;
    }

    // Valores Derivados — dinâmico do Firebase
    const dvCache = window._derivedValuesCache || [];
    const publishedDVs = dvCache.filter(d => d.publicado !== false);
    if (publishedDVs.length > 0) {
        publishedDVs.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Valores Derivados">`;
        for (const dv of publishedDVs) {
            const icon = dv.icone || '📊';
            html += `\n<option value="${esc(dv.nome)}">${icon} ${esc(dv.nome)}</option>`;
            if (dv.campoAtual) {
                html += `\n<option value="${esc(dv.nome)} (Atual)">${icon} ${esc(dv.nome)} (Atual)</option>`;
                html += `\n<option value="${esc(dv.nome)} (Máximo)">${icon} ${esc(dv.nome)} (Máximo)</option>`;
            }
        }
        html += `\n</optgroup>`;
    }

    html += `
<optgroup label="Campos da Ficha">
<option value="Blindagem">Blindagem</option>
<option value="Tamanho">Tamanho</option>
</optgroup>`;

    // Partes do Corpo — dinâmico do Firebase
    const bpCache2 = window._bodyPartsCache || [];
    if (bpCache2.length > 0) {
        bpCache2.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        html += `\n<optgroup label="Partes do Corpo (Slots)">`;
        for (const bp of bpCache2) {
            const icon = bp.icone || '🦴';
            html += `\n<option value="Parte do Corpo: ${esc(bp.nome)}">${icon} Parte do Corpo: ${esc(bp.nome)}</option>`;
        }
        html += `\n</optgroup>`;
    }

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

    html += `\n<optgroup label="Propriedades de Item">
<option value="Item: Peso/Pressão">⚖️ Peso / Pressão do Item</option>
<option value="Item: Tamanho">📐 Tamanho do Item</option>
<option value="Item: Multiplicador de Pressão">📦 Multiplicador de Pressão (conteúdo)</option>
<option value="Item: Capacidade do Container">🎒 Capacidade do Container (itens)</option>
<option value="Pressão Total (Equipados)">⚖️ Pressão Total (Itens Equipados)</option>
</optgroup>`;

    html += `\n<optgroup label="Outros">\n<option value="Nível">Nível</option>\n</optgroup>`;

    // Limites de Módulos de Classe (dinâmico)
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
            terms.push({ op: '×', tipo: 'fixo', valor: c.valorMultiplicador });
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
            <optgroup label="Aritméticos">
            <option value="+" ${t.op === '+' ? 'selected' : ''}>+</option>
            <option value="-" ${t.op === '-' ? 'selected' : ''}>−</option>
            <option value="×" ${t.op === '×' ? 'selected' : ''}>×</option>
            <option value="÷" ${t.op === '÷' ? 'selected' : ''}>÷</option>
            </optgroup>
            <optgroup label="Lógicos">
            <option value="min" ${t.op === 'min' ? 'selected' : ''}>↓ Menor entre</option>
            <option value="max" ${t.op === 'max' ? 'selected' : ''}>↑ Maior entre</option>
            </optgroup>
        </select>` : '';

    return `
    <div class="eq-term" data-term-index="${termIndex}">
        ${opHtml}
        <select class="eq-term-tipo" onchange="window._mechTermTipoChange(${calcIndex}, ${termIndex}); window._mechUpdatePreview()">
            <option value="fixo" ${t.tipo !== 'ficha' ? 'selected' : ''}>🔢 Fixo</option>
            <option value="ficha" ${t.tipo === 'ficha' ? 'selected' : ''}>📋 Ficha</option>
        </select>
        <div class="eq-term-fixo-wrap" style="display:${t.tipo !== 'ficha' ? '' : 'none'}">
            <input type="text" class="eq-term-valor" value="${esc(String(t.valor ?? ''))}" placeholder="Valor" oninput="window._mechUpdatePreview()">
        </div>
        <div class="eq-term-ficha-wrap" style="display:${t.tipo === 'ficha' ? '' : 'none'}">
            <select class="eq-term-ref" onchange="window._mechUpdatePreview()">
                <option value="">— Ref —</option>${getValueSourceHTML()}
            </select>
        </div>
        ${termIndex > 0 ? `<button type="button" class="eq-term-remove" onclick="window._mechRemoveTerm(${calcIndex}, ${termIndex})" title="Remover termo">✕</button>` : ''}
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
            <button type="button" class="calc-row-remove" onclick="window._mechRemoveCalc(${index})" title="Remover cálculo">🗑️</button>
        </div>
        <div class="form-grid">
            <div class="form-group full-width"><label>O que é afetado? <span class="required">*</span></label>
                <select class="calc-alvo" onchange="window._mechAlvoChange(${index}); window._mechUpdatePreview()">
                    <option value="">— Selecionar alvo —</option>${getMechanicTargetsHTML()}
                </select>
            </div>
        </div>
        <div class="calc-exp-qual-wrap" style="display:${isEXP ? '' : 'none'}">
            <div class="form-grid">
                <div class="form-group"><label>⭐ Qual EXP é afetado? <span class="required">*</span></label>
                    <select class="calc-qualExp" onchange="window._mechUpdatePreview()">
                        <option value="ambos" ${qualExp === 'ambos' ? 'selected' : ''}>Ambos (Total + Restante)</option>
                        <option value="exp_total" ${qualExp === 'exp_total' ? 'selected' : ''}>EXP Total</option>
                        <option value="exp_restante" ${qualExp === 'exp_restante' ? 'selected' : ''}>EXP Restante</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group"><label>Operação <span class="required">*</span></label>
                <select class="calc-operacao" onchange="window._mechUpdatePreview()">
                    <option value="+" ${c.operacao === '+' ? 'selected' : ''}>+ Somar</option>
                    <option value="-" ${c.operacao === '-' ? 'selected' : ''}>− Subtrair</option>
                    <option value="×" ${c.operacao === '×' ? 'selected' : ''}>× Multiplicar</option>
                    <option value="÷" ${c.operacao === '÷' ? 'selected' : ''}>÷ Dividir</option>
                    <option value="=" ${c.operacao === '=' ? 'selected' : ''}>=  Definir fixo</option>
                </select>
            </div>
        </div>
        <div class="eq-builder-section">
            <label class="eq-builder-label">Equação de Valor <span class="required">*</span></label>
            <div class="eq-terms-container" data-calc-index="${index}">
                ${termsHtml}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechAddTerm(${index})">➕ Adicionar Termo</button>
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
            <button type="button" class="calc-row-remove" onclick="window._mechRemoveCalc(${index})" title="Remover cálculo">🗑️</button>
        </div>
        <div class="form-grid">
            <div class="form-group full-width"><label>O que é limitado? <span class="required">*</span></label>
                <select class="calc-alvo" onchange="window._mechUpdatePreview()">
                    <option value="">— Selecionar alvo —</option>${getMechanicTargetsHTML()}
                </select>
            </div>
            <div class="form-group"><label>Tipo de Limite <span class="required">*</span></label>
                <select class="calc-tipoLimite" onchange="window._mechCalcLimitChange(${index}); window._mechUpdatePreview()">
                    <option value="">— Selecionar —</option>
                    <option value="maximo" ${tl === 'maximo' ? 'selected' : ''}>Teto (máximo)</option>
                    <option value="minimo" ${tl === 'minimo' ? 'selected' : ''}>Piso (mínimo)</option>
                    <option value="clamp" ${tl === 'clamp' ? 'selected' : ''}>Ambos (clamp)</option>
                    <option value="bloqueio" ${tl === 'bloqueio' ? 'selected' : ''}>Bloqueio (= 0)</option>
                </select>
            </div>
        </div>
        <div class="calc-limit-valor-area" style="display:${showValor ? '' : 'none'}">
            <div class="eq-builder-section">
                <label class="eq-builder-label">Equação de Valor do Limite</label>
                <div class="eq-terms-container" data-calc-index="${index}">
                    ${termsHtml}
                </div>
                <button type="button" class="eq-add-term-btn" onclick="window._mechAddTerm(${index})">➕ Adicionar Termo</button>
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
    <button type="button" class="calc-add-btn" onclick="window._mechAddCalc('modificar')">➕ Adicionar Cálculo</button>`;
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
    <button type="button" class="calc-add-btn" onclick="window._mechAddCalc('limitar')">➕ Adicionar Cálculo</button>`;
}


function renderConfigConceder(config) {
    const tc = config?.tipoConcessao || '';
    return `
    <div class="form-grid">
        <div class="form-group"><label>O que concede? <span class="required">*</span></label>
            <select id="mech_config_tipoConcessao" onchange="window._mechTipoConcessaoChange()">
                <option value="">— Selecionar —</option>
                <option value="capacidade" ${tc === 'capacidade' ? 'selected' : ''}>Capacidade especial</option>
                <option value="imunidade" ${tc === 'imunidade' ? 'selected' : ''}>Imunidade</option>
                <option value="vulnerabilidade" ${tc === 'vulnerabilidade' ? 'selected' : ''}>Vulnerabilidade</option>
                <option value="resistencia" ${tc === 'resistencia' ? 'selected' : ''}>Resistência</option>
                <option value="vantagem" ${tc === 'vantagem' ? 'selected' : ''}>Vantagem em testes</option>
                <option value="desvantagem" ${tc === 'desvantagem' ? 'selected' : ''}>Desvantagem em testes</option>
                <option value="acesso" ${tc === 'acesso' ? 'selected' : ''}>Acesso a recurso</option>
                <option value="remover_acesso" ${tc === 'remover_acesso' ? 'selected' : ''}>Remove acesso</option>
                <option value="adicionar_parte_corpo" ${tc === 'adicionar_parte_corpo' ? 'selected' : ''}>Adicionar Parte do Corpo</option>
                <option value="remover_parte_corpo" ${tc === 'remover_parte_corpo' ? 'selected' : ''}>Remover Parte do Corpo</option>
            </select>
        </div>
        <div class="form-group"><label>Descrição da concessão <span class="required">*</span></label>
            <input type="text" id="mech_config_descricaoConcessao" value="${esc(config?.descricaoConcessao || '')}" placeholder="Ex: Voo, Visão de Essência" oninput="window._mechUpdatePreview()">
        </div>
        </div>
    </div>
    <div id="mech_bodyParts_container" style="display: ${(tc === 'adicionar_parte_corpo' || tc === 'remover_parte_corpo') ? 'block' : 'none'}">
        ${_renderBodyPartsConcessao(config)}
    </div>`;
}

function _renderBodyPartsConcessao(config) {
    const bpCache = window._bodyPartsCache || [];
    if (bpCache.length === 0) return '<div class="alert alert-warning" style="margin-top:12px">Nenhuma parte do corpo cadastrada no sistema.</div>';
    
    // config.partesCorpo may look like [{ id: 'cabeca', slots: 1 }, { id: 'bracos', slots: null }]
    const savedParts = config?.partesCorpo || [];
    const getSavedSlots = (id) => {
        const found = savedParts.find(p => p.id === id);
        return found && found.slots !== null && found.slots !== undefined ? found.slots : '';
    };
    const isChecked = (id) => savedParts.some(p => p.id === id);

    let html = `<div style="margin-top:16px"><label>Selecione as Partes do Corpo e a quantidade opcional de Slots: <span class="required">*</span></label>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px; background:var(--bg-panel); padding:12px; border-radius:6px; border:1px solid var(--border-color);">`;
    
    // Sort by order or name
    const sorted = [...bpCache].sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    
    for (const bp of sorted) {
        const icon = bp.icone || '🦴';
        const checked = isChecked(bp.id) ? 'checked' : '';
        const slotsVal = getSavedSlots(bp.id);
        
        html += `
        <div class="mech-bp-concessao-item" style="display:flex; align-items:center; gap:12px;">
            <label style="flex:1; display:flex; align-items:center; gap:8px; margin:0; cursor:pointer;">
                <input type="checkbox" value="${esc(bp.id)}" ${checked} onchange="window._mechUpdatePreview()">
                <span>${icon} ${esc(bp.nome)}</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px; flex:1">
                <span style="font-size:12px; color:var(--text-muted)">Slots (opcional):</span>
                <input type="number" class="bp-slots-input" placeholder="Vazio" value="${slotsVal}" 
                    style="width:80px; padding:4px 8px; font-size:13px;" oninput="window._mechUpdatePreview()">
            </div>
        </div>`;
    }
    html += `</div></div>`;
    return html;
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
            ${buildInlineMechSelector('mech_config_efeitoSucessoIds', 'Efeito Sucesso (mecânicas)', sucessoIds, mechanicsCache, true)}
        </div>
        <div class="form-group full-width">
            ${buildInlineMechSelector('mech_config_efeitoFalhaIds', 'Efeito Falha (opcional)', falhaIds, mechanicsCache, true)}
        </div>
    </div>`;
}

function renderConfigNarrativo(config) {
    return `<div class="form-group"><label>Descrição do efeito narrativo <span class="required">*</span></label>
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
                <option value="" ${!poolVal ? 'selected' : ''}>— Selecionar pool —</option>
                <option value="Perícias (qualquer)" ${poolVal === 'Perícias (qualquer)' ? 'selected' : ''}>Perícias (qualquer)</option>
                <option value="Perícias Mentais (qualquer)" ${poolVal === 'Perícias Mentais (qualquer)' ? 'selected' : ''}>Perícias Mentais (qualquer)</option>
                <option value="Perícias Físicas (qualquer)" ${poolVal === 'Perícias Físicas (qualquer)' ? 'selected' : ''}>Perícias Físicas (qualquer)</option>
                <option value="Perícias Sociais (qualquer)" ${poolVal === 'Perícias Sociais (qualquer)' ? 'selected' : ''}>Perícias Sociais (qualquer)</option>
                <option value="Atributos (qualquer)" ${poolVal === 'Atributos (qualquer)' ? 'selected' : ''}>Atributos (qualquer)</option>
                <option value="Atributos Mentais" ${poolVal === 'Atributos Mentais' ? 'selected' : ''}>Atributos Mentais</option>
                <option value="Atributos Físicos" ${poolVal === 'Atributos Físicos' ? 'selected' : ''}>Atributos Físicos</option>
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
        <div class="form-group"><label>Operação <span class="required">*</span></label>
            <select id="mech_config_operacao_dist" onchange="window._mechUpdatePreview()">
                <option value="+" ${opVal === '+' ? 'selected' : ''}>+ Somar</option>
                <option value="-" ${opVal === '-' ? 'selected' : ''}>− Subtrair</option>
                <option value="=" ${opVal === '=' ? 'selected' : ''}>= Definir</option>
            </select>
        </div>
        <div class="form-group"><label>Restrição</label>
            <select id="mech_config_restricao" onchange="window._mechUpdatePreview()">
                <option value="diferentes" ${restVal === 'diferentes' ? 'selected' : ''}>Alvos devem ser diferentes</option>
                <option value="livre" ${restVal === 'livre' ? 'selected' : ''}>Pode repetir alvos</option>
            </select>
        </div>
        <div class="form-group full-width" id="mech_config_poolCustomWrap" style="display:${poolVal === 'Personalizado' ? '' : 'none'}">
            <label>Pool Personalizado — Selecione os alvos permitidos</label>
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
            return ['Nível', expLabel, ...fixoTerms.map(ft => ft.label)];
        }
        // Fallback: single valor column
        return ['Nível', expLabel, tipo === 'limitar' ? 'Valor do Limite' : 'Valor'];
    }
    if (tipo === 'distribuir') return ['Nível', expLabel, 'Qtd Alvos', 'Valor por Alvo'];
    return ['Nível', expLabel, 'Descrição do Efeito'];
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
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-descricao" data-nivel="${i}" value="${esc(String(p.descricao ?? ''))}" placeholder="Descrever o efeito neste nível" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
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
        <div class="mech-section-label">📈 Progressão por Nível</div>
        <div class="form-grid">
            <div class="form-group">
                <div class="form-toggle">
                    <label class="toggle-publish"><input type="checkbox" id="mech_evoluivel" ${evoluivel ? 'checked' : ''} onchange="window._mechEvoluivelChange()"><span class="toggle-slider"></span></label>
                    <span class="toggle-label">Evoluível (permite subir de nível com EXP)</span>
                </div>
            </div>
            <div class="form-group" id="mech_apenasCriacaoWrap" style="display:${evoluivel ? '' : 'none'}">
                <div class="form-toggle">
                    <label class="toggle-publish"><input type="checkbox" id="mech_progressaoApenasCriacao" ${apenasCriacao ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    <span class="toggle-label">🏗️ Apenas na Criação (não pode upar depois)</span>
                </div>
            </div>
            <div class="form-group" id="mech_tipoExpWrap" style="display:${evoluivel ? '' : 'none'}">
                <label>Tipo de EXP na Progressão</label>
                <select id="mech_progressaoTipoExp" onchange="window._mechTipoExpChange()">
                    <option value="custo" ${tipoExp === 'custo' ? 'selected' : ''}>💰 Custo de EXP (mecânica benéfica — subtrai EXP)</option>
                    <option value="ganho" ${tipoExp === 'ganho' ? 'selected' : ''}>🎁 Ganho de EXP (mecânica prejudicial — adiciona EXP)</option>
                </select>
            </div>
            <div class="form-group" id="mech_nivelMaxWrap" style="display:${evoluivel ? '' : 'none'}">
                <label>Nível Máximo <span class="required">*</span></label>
                <input type="number" id="mech_nivelMaximo" value="${nivelMax}" min="2" max="10" onchange="window._mechNivelMaxChange()">
            </div>
        </div>
        <div id="mech_progressaoTabela" style="display:${evoluivel ? '' : 'none'}">
            <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <thead id="mech_progressaoHead"><tr style="background:var(--bg-secondary);color:var(--text-secondary)">
                    ${headers.map(h => `<th style="padding:6px 8px${h === 'Nível' ? ';width:60px' : ''}">${h}</th>`).join('')}
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
    // Check if ANY calc row targets EXP to toggle Duração section
    window._mechSyncDuracaoForExp();
    window._mechRefreshProgressao();
};

// Checks all calc rows; if any targets EXP, swap Duração for EXP triggers
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
        return m ? `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${id}','${mid}')">✕</button></div>` : '';
    }).join('');
    const opts = filtered.map(m => `<label class="mechsel-result"><input type="checkbox" value="${m.id}" ${currentIds.includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.previewTexto || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="${id}_wrap">
        <span class="mechsel-label">${label}</span>
        <div class="mechsel-chips" id="${id}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('${id}_search').classList.toggle('open')">➕ Adicionar Mecânica</button>
        <div class="mechsel-search" id="${id}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar mecânica..." oninput="window._mechSelFilter('${id}', this.value)">
            </div>
            <div class="mechsel-results" id="${id}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._mechSelConfirm('${id}')">✔️ Confirmar Seleção</button>
        </div>
        <input type="hidden" id="${id}" value='${JSON.stringify(currentIds)}'>
    </div>`;
}

// ===== OPEN MECHANIC EDITOR (inline) =====
export function openMechanicEditor(itemId, allItems, mechanicsCache, callbacks, initialTags, parentFieldKey = null) {
    const { db, collection: col, addDoc, updateDoc, doc, Timestamp, currentUser, showAlert, loadModule, escapeHtml } = callbacks;
    const isEditing = !!itemId;
    // When opened from another module, allItems contains the other module's items.
    // So we must also check mechanicsCache to find the mechanic data.
    const existingData = isEditing ? (mechanicsCache.find(i => i.id === itemId) || allItems.find(i => i.id === itemId)) : {};
    const data = existingData || {};

    // Store parent field key globally for when we save/back
    window._mechParentFieldKey = parentFieldKey;

    // Hide standard content, show editor
    document.getElementById('moduleContent').style.display = 'none';
    const formModal = document.getElementById('formModal');
    if (formModal && parentFieldKey) {
        formModal.style.display = 'none';
    }
    
    const area = document.getElementById('mechanicsEditorArea');
    area.style.display = '';

    const title = isEditing ? `✏️ Editar Mecânica` : `➕ Criar Nova Mecânica`;
    const tipo = data.tipo || 'modificar';
    const config = data.config || {};
    // Merge initialTags (from filter chips) with existing tags, avoiding duplicates
    const existingTags = Array.isArray(data.tags) ? data.tags : [];
    const mergedInitial = Array.isArray(initialTags) ? initialTags : [];
    const tags = [...new Set([...existingTags, ...mergedInitial])];

    area.innerHTML = `
    <div class="mech-editor-wrap">
        <div class="mech-editor-form">
            <button class="mech-editor-back" onclick="window._mechBack()">← Voltar à Lista</button>
            <div class="mech-editor-title">${title}</div>

            <div class="mech-form-section">
                <div class="mech-section-label">📋 Informações Básicas</div>
                <div class="form-grid">
                    <div class="form-group"><label>Nome <span class="required">*</span></label>
                        <input type="text" id="mech_nome" value="${esc(data.nome || '')}" placeholder="Ex: Aprendizado Acelerado IV" oninput="window._mechUpdatePreview()"></div>
                    <div class="form-group"><label>Fonte <span class="required">*</span></label>
                        <select id="mech_fonte" onchange="window._mechUpdatePreview()">
                            <option value="">— Selecionar —</option>
                            ${Object.entries(FONTE_LABELS).map(([k, v]) => `<option value="${k}" ${data.fonte === k ? 'selected' : ''}>${v}</option>`).join('')}
                        </select></div>
                    <div class="form-group full-width"><label>Descrição <span class="required">*</span></label>
                        <textarea id="mech_descricao" placeholder="Texto explicando o efeito">${esc(data.descricao || '')}</textarea></div>
                </div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">⚙️ Tipo de Efeito</div>
                <div class="form-group">
                    <select id="mech_tipo" onchange="window._mechTipoChange()">
                        <option value="modificar" ${tipo === 'modificar' ? 'selected' : ''}>➕ Modificar (altera valor numérico)</option>
                        <option value="limitar" ${tipo === 'limitar' ? 'selected' : ''}>🔒 Limitar (impõe teto/piso/bloqueio)</option>
                        <option value="conceder" ${tipo === 'conceder' ? 'selected' : ''}>🎁 Conceder (dá ou remove capacidade)</option>
                        <option value="condicional" ${tipo === 'condicional' ? 'selected' : ''}>⚡ Condicional (efeito com gatilho)</option>
                        <option value="narrativo" ${tipo === 'narrativo' ? 'selected' : ''}>📝 Narrativo (efeito descritivo)</option>
                        <option value="distribuir" ${tipo === 'distribuir' ? 'selected' : ''}>🎲 Distribuir (distribui pontos entre múltiplos alvos)</option>
                    </select>
                </div>
                <div class="mech-config-area" id="mechConfigArea"></div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">🕐 Quando se Aplica</div>
                <div class="form-grid">
                    <div id="mech_duracao_standard_wrap">
                        <div class="form-group"><label>Duração</label>
                            <select id="mech_duracao" onchange="window._mechDuracaoChange(); window._mechUpdatePreview()">
                                <option value="permanente" ${(data.duracao || 'permanente') === 'permanente' ? 'selected' : ''}>Permanente</option>
                                <option value="cena" ${data.duracao === 'cena' ? 'selected' : ''}>1 Cena</option>
                                <option value="turno" ${data.duracao === 'turno' ? 'selected' : ''}>X Turnos</option>
                                <option value="ate_remover" ${data.duracao === 'ate_remover' ? 'selected' : ''}>Até ser removido</option>
                                <option value="criacao" ${data.duracao === 'criacao' ? 'selected' : ''}>Na criação do personagem</option>
                                <option value="especial" ${data.duracao === 'especial' ? 'selected' : ''}>Especial</option>
                            </select>
                        </div>
                        <div class="form-group" id="mech_turnosWrap" style="display:${data.duracao === 'turno' ? '' : 'none'}"><label>Quantos turnos?</label>
                            <input type="number" id="mech_duracaoTurnos" value="${data.duracaoTurnos || ''}" min="1" oninput="window._mechUpdatePreview()"></div>
                        <div class="form-group" id="mech_especWrap" style="display:${data.duracao === 'especial' ? '' : 'none'}"><label>Descrever duração</label>
                            <input type="text" id="mech_duracaoEspecial" value="${esc(data.duracaoEspecial || '')}" oninput="window._mechUpdatePreview()"></div>
                    </div>
                    <div id="mech_duracao_exp_wrap" style="display:none">
                        <div class="form-group"><label>⭐ Quando o EXP se Aplica? <span class="required">*</span></label>
                            <select id="mech_duracao_exp" onchange="window._mechDuracaoExpChange()">
                                <option value="na_criacao" ${data.quandoAplica === 'na_criacao' ? 'selected' : ''}>🏗️ Na Criação de Personagem</option>
                                <option value="por_sessao" ${data.quandoAplica === 'por_sessao' ? 'selected' : ''}>📅 Por Sessão</option>
                                <option value="por_descanso_longo" ${data.quandoAplica === 'por_descanso_longo' ? 'selected' : ''}>🛏️ Por Descanso Longo</option>
                                <option value="por_descanso_curto" ${data.quandoAplica === 'por_descanso_curto' ? 'selected' : ''}>☕ Por Descanso Curto</option>
                                <option value="por_arco" ${data.quandoAplica === 'por_arco' ? 'selected' : ''}>📖 Por Arco</option>
                                <option value="por_masmorra" ${data.quandoAplica === 'por_masmorra' ? 'selected' : ''}>🏰 Por Masmorra</option>
                                <option value="ao_ativar" ${data.quandoAplica === 'ao_ativar' ? 'selected' : ''}>⚡ Ao Ativar</option>
                                <option value="ao_desativar" ${data.quandoAplica === 'ao_desativar' ? 'selected' : ''}>🔌 Ao Desativar</option>
                                <option value="condicional" ${data.quandoAplica === 'condicional' ? 'selected' : ''}>🎯 Condicional</option>
                                <option value="permanente" ${(!data.quandoAplica || data.quandoAplica === 'permanente') ? 'selected' : ''}>♾️ Permanente (Passivo)</option>
                                <option value="por_uso_recurso" ${data.quandoAplica === 'por_uso_recurso' ? 'selected' : ''}>🔋 Por Uso de Recurso</option>
                                <option value="por_morte" ${data.quandoAplica === 'por_morte' ? 'selected' : ''}>💀 Por Morte e Ressurreição</option>
                            </select>
                        </div>
                        <div id="mech_expCondicaoWrap" style="display:${data.quandoAplica === 'condicional' ? '' : 'none'}">
                            <div class="form-group full-width"><label>Condição <span class="required">*</span></label>
                                <textarea id="mech_expCondicao" placeholder="Ex: Quando o personagem mata um inimigo com AI superior ao dele" oninput="window._mechUpdatePreview()">${esc(data.condicaoExp || '')}</textarea>
                            </div>
                        </div>
                        <div id="mech_expRecursoWrap" style="display:${data.quandoAplica === 'por_uso_recurso' ? '' : 'none'}">
                            <div class="form-grid">
                                <div class="form-group"><label>Recurso <span class="required">*</span></label>
                                    <select id="mech_expRecurso" onchange="window._mechRecursoExpChange()">
                                        <option value="energia" ${(data.recursoExp || 'energia') === 'energia' ? 'selected' : ''}>⚡ Energia</option>
                                        <option value="sanidade" ${data.recursoExp === 'sanidade' ? 'selected' : ''}>🧠 Sanidade</option>
                                        <option value="graca" ${data.recursoExp === 'graca' ? 'selected' : ''}>✨ Graça</option>
                                        <option value="vitalidade" ${data.recursoExp === 'vitalidade' ? 'selected' : ''}>❤️ Vitalidade</option>
                                        <option value="outro" ${data.recursoExp === 'outro' ? 'selected' : ''}>📝 Outro</option>
                                    </select>
                                </div>
                                <div class="form-group" id="mech_expRecursoOutroWrap" style="display:${data.recursoExp === 'outro' ? '' : 'none'}">
                                    <label>Qual recurso?</label>
                                    <input type="text" id="mech_expRecursoOutro" value="${esc(data.recursoExpOutro || '')}" placeholder="Nome do recurso" oninput="window._mechUpdatePreview()">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group"><label>Quem é afetado?</label>
                        <select id="mech_escopo" onchange="window._mechUpdatePreview()">
                            <option value="proprio" ${(data.escopo || 'proprio') === 'proprio' ? 'selected' : ''}>O próprio personagem</option>
                            <option value="aliado" ${data.escopo === 'aliado' ? 'selected' : ''}>1 Aliado</option>
                            <option value="aliados_area" ${data.escopo === 'aliados_area' ? 'selected' : ''}>Aliados em área</option>
                            <option value="inimigo" ${data.escopo === 'inimigo' ? 'selected' : ''}>1 Inimigo</option>
                            <option value="inimigos_area" ${data.escopo === 'inimigos_area' ? 'selected' : ''}>Inimigos em área</option>
                            <option value="todos_area" ${data.escopo === 'todos_area' ? 'selected' : ''}>Todos em área</option>
                        </select></div>
                    <div class="form-group full-width"><label>Condição de Aplicação</label>
                        <textarea id="mech_condicaoAplicacao" placeholder="Ex: Apenas em ambientes urbanos, Em testes de Intimidação..." oninput="window._mechUpdatePreview()">${esc(data.condicaoAplicacao || '')}</textarea></div>
                    <div class="form-group"><label>Empilhamento</label>
                        <select id="mech_empilhamento">
                            <option value="soma" ${(data.empilhamento || 'soma') === 'soma' ? 'selected' : ''}>Soma com outros iguais</option>
                            <option value="maior" ${data.empilhamento === 'maior' ? 'selected' : ''}>Só o maior valor</option>
                            <option value="nao_empilha" ${data.empilhamento === 'nao_empilha' ? 'selected' : ''}>Não empilha</option>
                        </select></div>
                </div>
            </div>

            ${renderConfigProgressao(data, tipo)}

            <div class="mech-form-section">
                <div class="mech-section-label">🏷️ Tags e Publicação</div>
                <div class="form-grid">
                    <div class="form-group full-width"><label>Tags de busca</label>
                        <div class="tags-container" id="mech_tags_container" onclick="this.querySelector('input').focus()">
                            ${tags.map(t => `<span class="tag">${esc(t)}<button type="button" onclick="this.closest('.tag').remove()">×</button></span>`).join('')}
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
                <button type="button" class="btn-save" id="mechBtnSave" onclick="window._mechSave()">💾 Salvar</button>
            </div>
        </div>

        <div class="mech-preview-panel">
            <div class="mech-preview-header">📋 Preview do Efeito</div>
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
    
    if (window._mechParentFieldKey) {
        const formModal = document.getElementById('formModal');
        if (formModal) formModal.style.display = '';
        window._mechParentFieldKey = null; // Clear flag
    }
    
    // Always restore moduleContent because formModal is just an overlay on top of it.
    document.getElementById('moduleContent').style.display = '';
};

window._mechTipoChange = function () {
    const tipo = document.getElementById('mech_tipo')?.value || 'modificar';
    const area = document.getElementById('mechConfigArea');
    const cacheData = window._mechCache?.find(i => i.id === window._mechEditingId);
    const allData = window._mechAllItems?.find(i => i.id === window._mechEditingId);
    const data = cacheData || allData;
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
            // Sync Duração section for EXP after calc rows are restored
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
    // Re-index remaining terms — re-render to fix onclick indices
    const currentEquacao = _collectEquacaoFromContainer(container);
    container.innerHTML = currentEquacao.map((t, ti) => _renderEquationTerm(t, calcIndex, ti)).join('');
    // Restore ficha ref values after re-render
    _restoreEquacaoRefs(container, currentEquacao);
    // Refresh progression columns
    window._mechRefreshProgressao();
    window._mechUpdatePreview();
};

window._mechTipoConcessaoChange = function() {
    window._mechUpdatePreview();
    const tc = document.getElementById('mech_config_tipoConcessao')?.value;
    const container = document.getElementById('mech_bodyParts_container');
    if (container) {
        if (tc === 'adicionar_parte_corpo' || tc === 'remover_parte_corpo') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
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
        thead.innerHTML = `<tr style="background:var(--bg-secondary);color:var(--text-secondary)">${headers.map(h => `<th style="padding:6px 8px${h === 'Nível' ? ';width:60px' : ''}">${h}</th>`).join('')}</tr>`;
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
        const fonte = FONTE_LABELS[formData.fonte] || formData.fonte || '—';
        const dur = formData.duracao || 'permanente';
        const esc2 = formData.escopo || 'proprio';
        meta.innerHTML = `
            <span>📌 <strong>Fonte:</strong> ${fonte}</span>
            <span>🕐 <strong>Duração:</strong> ${dur}${dur === 'turno' ? ' (' + (formData.duracaoTurnos || '?') + ' turnos)' : ''}${dur === 'especial' ? ' — ' + (formData.duracaoEspecial || '?') : ''}</span>
            <span>👤 <strong>Escopo:</strong> ${esc2}</span>
            ${formData.condicaoAplicacao ? `<span>📎 <strong>Condição:</strong> ${esc(formData.condicaoAplicacao)}</span>` : ''}`;
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
        tag.innerHTML = `${esc(val)}<button type="button" onclick="this.closest('.tag').remove()">×</button>`;
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

        // If any calc targets EXP, collect the EXP trigger info from Duração section
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
        const tc = document.getElementById('mech_config_tipoConcessao')?.value || '';
        let partesCorpo = undefined;
        if (tc === 'adicionar_parte_corpo' || tc === 'remover_parte_corpo') {
            partesCorpo = [];
            document.querySelectorAll('.mech-bp-concessao-item').forEach(el => {
                const cb = el.querySelector('input[type="checkbox"]');
                if (cb && cb.checked) {
                    const numInput = el.querySelector('input[type="number"]');
                    const slots = numInput && numInput.value !== '' ? parseInt(numInput.value, 10) : null;
                    partesCorpo.push({ id: cb.value, slots });
                }
            });
        }
        data.config = {
            tipoConcessao: tc,
            descricaoConcessao: document.getElementById('mech_config_descricaoConcessao')?.value || '',
            ...(partesCorpo !== undefined ? { partesCorpo } : {})
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

    // Progressão por nível
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
    data.tags = tagsContainer ? Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim()) : [];
    data.publicado = document.getElementById('mech_publicado')?.checked || false;
    data.previewTexto = generatePreviewText(data);

    // Validate
    if (!data.nome) { cb.showAlert('⚠️ Campo obrigatório: Nome', 'danger'); return; }
    if (!data.descricao) { cb.showAlert('⚠️ Campo obrigatório: Descrição', 'danger'); return; }

    // Metadata
    data.atualizadoEm = cb.Timestamp.now();
    const editId = window._mechEditingId;
    if (!editId) {
        data.criadoPor = cb.currentUser.uid;
        data.criadoEm = cb.Timestamp.now();
        data.versao = 1;
    } else {
        const cacheEx = window._mechCache?.find(i => i.id === editId);
        const allEx = window._mechAllItems?.find(i => i.id === editId);
        const ex = cacheEx || allEx;
        data.versao = (ex?.versao || 0) + 1;
    }

    const btn = document.getElementById('mechBtnSave');
    btn.disabled = true; btn.textContent = '⏳ Salvando...';

    try {
        let savedId = editId;
        if (editId) {
            await cb.updateDoc(cb.doc(cb.db, 'system/data/mechanics', editId), data);
            cb.showAlert('✅ Mecânica atualizada!', 'success');
        } else {
            const docRef = await cb.addDoc(cb.collection(cb.db, 'system/data/mechanics'), data);
            savedId = docRef.id;
            cb.showAlert('✅ Mecânica criada!', 'success');
        }
        
        // Cache update for immediate rendering in sub-modal return
        if (window._mechCache) {
            const idx = window._mechCache.findIndex(m => m.id === savedId);
            if (idx >= 0) window._mechCache[idx] = { id: savedId, ...data };
            else window._mechCache.push({ id: savedId, ...data });
        }

        if (window._mechParentFieldKey && window._mechParentFieldKey !== 'null') {
            const parentField = document.getElementById('temp_field_' + window._mechParentFieldKey) || document.getElementById('field_' + window._mechParentFieldKey);
            if (parentField) {
                let currentIds = JSON.parse(parentField.value || '[]');
                if (!editId) {
                    currentIds.push(savedId);
                    parentField.value = JSON.stringify(currentIds);
                }
                const wrap = document.getElementById('temp_field_' + window._mechParentFieldKey + '_wrap') || document.getElementById('field_' + window._mechParentFieldKey + '_wrap');
                if (wrap) {
                    const labelSpan = wrap.querySelector('.mechsel-label');
                    const labelText = labelSpan ? labelSpan.textContent : 'Mecânicas';
                    const tempId = parentField.id.startsWith('temp_') ? 'temp_' : '';
                    let modifiedHtml = buildMechanicSelectorHTML(window._mechParentFieldKey, labelText, currentIds, window._mechCache || []);
                    if (tempId) {
                        modifiedHtml = modifiedHtml.replace(new RegExp(`id="field_${window._mechParentFieldKey}`, 'g'), `id="temp_field_${window._mechParentFieldKey}`);
                        modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelFilter\\('field_${window._mechParentFieldKey}'`, 'g'), `window._mechSelFilter('temp_field_${window._mechParentFieldKey}'`);
                        modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelRemove\\('field_${window._mechParentFieldKey}'`, 'g'), `window._mechSelRemove('temp_field_${window._mechParentFieldKey}'`);
                        modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelConfirm\\('field_${window._mechParentFieldKey}'`, 'g'), `window._mechSelConfirm('temp_field_${window._mechParentFieldKey}'`);
                    }
                    wrap.outerHTML = modifiedHtml;
                }
            }
        }

        const wasSubModal = !!window._mechParentFieldKey;
        window._mechBack();
        if (!wasSubModal) {
            await cb.loadModule('mechanics');
        }
    } catch (e) {
        console.error('Erro ao salvar mecânica:', e);
        cb.showAlert('❌ Erro ao salvar: ' + e.message, 'danger');
    } finally {
        btn.disabled = false; btn.textContent = '💾 Salvar';
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
        document.getElementById(`${fieldId}_chips`).innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica ou peculiaridade vinculada</span>';
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
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>';
        } else {
            const pKey = fieldId.replace(/^field_/, '');
            chipsEl.innerHTML = checked.map(mid => {
                const m = cache.find(x => x.id === mid);
                if (!m) return '';
                return `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'}); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window.openMechanicEditor('${mid}', '${pKey}')" title="Editar Mecânica"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">✕</button></div>`;
            }).join('');
        }
    }
};

// ===== REUSABLE MECHANIC SELECTOR BUILDER (for other module forms) =====
export function buildMechanicSelectorHTML(fieldKey, label, currentIds, cache, fontePreFilter) {
    const published = cache.filter(m => m.publicado);
    const chips = (currentIds || []).map(mid => {
        const m = cache.find(x => x.id === mid);
        return m ? `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'}); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window.openMechanicEditor('${mid}', '${fieldKey}')" title="Editar Mecânica"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${mid}')">✕</button></div>` : '';
    }).join('');
    const opts = published.map(m => `<label class="mechsel-result" data-fonte="${m.fonte || ''}"><input type="checkbox" value="${m.id}" ${(currentIds || []).includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.previewTexto || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>'}</div>
        <div>
            <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Mecânica</button>
            <button type="button" class="mechsel-add-btn" style="margin-left:5px;" onclick="window.openMechanicEditor(null, '${fieldKey}')">➕ Criar Mecânica</button>
        </div>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
                <select onchange="window._mechSelFilterFonte('field_${fieldKey}', this.value)">
                    <option value="">Todas fontes</option>
                    ${Object.entries(FONTE_LABELS).map(([k, v]) => `<option value="${k}" ${fontePreFilter === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._mechSelConfirm('field_${fieldKey}')">✔️ Vincular Selecionadas</button>
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
        return p ? `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p.fonte || 'generica'}); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window._openSubFormPeculiaridade('${pid}')" title="Editar Peculiaridade"><div class="mechsel-chip-info"><div class="mechsel-chip-name">✨ ${esc(p.nome)}</div><div class="mechsel-chip-preview">${esc(p.fonte || '')} — Nível Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('field_${fieldKey}', '${pid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${pid}')">✕</button></div>` : '';
    }).join('');
    const opts = published.map(p => `<label class="mechsel-result"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}><span class="mechsel-result-name">✨ ${esc(p.nome)}</span><span class="mechsel-result-preview">${esc(p.fonte || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma peculiaridade vinculada</span>'}</div>
        <div>
            <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Peculiaridade</button>
            <button type="button" class="mechsel-add-btn" style="margin-left:5px;" onclick="window._openSubFormPeculiaridade(null, '${fieldKey}')">➕ Criar Peculiaridade</button>
        </div>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar peculiaridade..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._pecSelConfirm('field_${fieldKey}')">✔️ Vincular Selecionadas</button>
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
                return `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p?.fonte || 'generica'}); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window._openSubFormPeculiaridade('${mid}')" title="Editar Peculiaridade"><div class="mechsel-chip-info"><div class="mechsel-chip-name">✨ ${esc(p?.nome || mid)}</div><div class="mechsel-chip-preview">${esc(p?.fonte || '')} — Nível Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('${fieldId}', '${mid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">✕</button></div>`;
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
const CATEGORIA_LABELS = { mental: '🧠 Mental', fisico: '💪 Físico', social: '🗣️ Social', combate: '⚔️ Combate', exclusivo: '🌟 Exclusivo' };

export function buildSkillSelectorHTML(fieldKey, label, currentIds, cache) {
    const published = cache.filter(s => s.publicado !== false);
    const ids = currentIds || [];

    const chips = ids.map(sid => {
        const s = cache.find(x => x.id === sid);
        if (!s) return '';
        const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
        const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
        return `<div class="mechsel-chip" style="border-left-color:var(--accent)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">📚 ${esc(s.nome)}</div><div class="mechsel-chip-preview">${catLabel} — ${attrs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${sid}')">✕</button></div>`;
    }).join('');

    const opts = published.map(s => {
        const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
        const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
        return `<label class="mechsel-result" data-fonte="${s.categoria || ''}"><input type="checkbox" value="${s.id}" ${ids.includes(s.id) ? 'checked' : ''}><span class="mechsel-result-name">📚 ${esc(s.nome)}</span><span class="mechsel-result-preview">${catLabel} — ${attrs}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma perícia vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Perícia</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar perícia..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._skillSelConfirm('field_${fieldKey}')">✔️ Vincular Selecionadas</button>
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
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma perícia vinculada</span>';
        } else {
            chipsEl.innerHTML = checked.map(sid => {
                const s = cache.find(x => x.id === sid);
                if (!s) return '';
                const catLabel = CATEGORIA_LABELS[s.categoria] || s.categoria || '';
                const attrs = Array.isArray(s.atributoBase) ? s.atributoBase.join('/') : (s.atributoBase || '');
                return `<div class="mechsel-chip" style="border-left-color:var(--accent)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">📚 ${esc(s.nome)}</div><div class="mechsel-chip-preview">${catLabel} — ${attrs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${sid}')">✕</button></div>`;
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
        const icon = d.icone || '📊';
        
        const minVal = dvObj.characterCreationMin !== undefined ? dvObj.characterCreationMin : -20;
        const maxVal = dvObj.characterCreationMax !== undefined ? dvObj.characterCreationMax : 20;
        const ruleInputs = ` Min: <input type="number" step="0.01" value="${minVal}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('field_${fieldKey}', '${did}', 'characterCreationMin', this.value)"> Max: <input type="number" step="0.01" value="${maxVal}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('field_${fieldKey}', '${did}', 'characterCreationMax', this.value)">`;

        
        return `<div class="mechsel-chip" style="border-left-color:#8b5cf6"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? '🌐 Universal' : '🔗 Vinculado'} — Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('field_${fieldKey}', '${did}', 'valorInicial', this.value)">${ruleInputs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${did}')">✕</button></div>`;
    }).join('');

    const opts = published.map(d => {
        const icon = d.icone || '📊';
        return `<label class="mechsel-result"><input type="checkbox" value="${d.id}" ${selectedIds.includes(d.id) ? 'checked' : ''}><span class="mechsel-result-name">${icon} ${esc(d.nome)}</span><span class="mechsel-result-preview">Ordem: ${d.ordem || '?'}${d.todoPersonagem ? ' — Universal' : ''}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhum valor derivado vinculado</span>'}</div>
        <div>
            <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Valor Derivado</button>
            <button type="button" class="mechsel-add-btn" style="margin-left:5px;" onclick="window._openSubFormValorDerivado(null, '${fieldKey}')">➕ Criar Valor Derivado</button>
        </div>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar valor derivado..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._dvSelConfirm('field_${fieldKey}')">✔️ Vincular Selecionados</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(parsedIds)}'>
    </div>`;
}

window._dvSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;

    // Preserve existing valorInicial, min, max
    const existingIds = JSON.parse(hidden.value || '[]');
    const existingMap = new Map();
    existingIds.forEach(item => {
        if (typeof item === 'object') existingMap.set(item.id, item);
        else existingMap.set(item, { id: item, valorInicial: 0 });
    });

    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => {
        const ex = existingMap.get(cb.value);
        return {
            id: cb.value,
            valorInicial: ex ? (ex.valorInicial || 0) : 0,
            characterCreationMin: ex && ex.characterCreationMin !== undefined ? ex.characterCreationMin : undefined,
            characterCreationMax: ex && ex.characterCreationMax !== undefined ? ex.characterCreationMax : undefined
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
                const icon = d.icone || '📊';
                
                const minVal = dvObj.characterCreationMin !== undefined ? dvObj.characterCreationMin : -20;
                const maxVal = dvObj.characterCreationMax !== undefined ? dvObj.characterCreationMax : 20;
                const ruleInputs = ` Min: <input type="number" step="0.01" value="${minVal}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('${fieldId}', '${did}', 'characterCreationMin', this.value)"> Max: <input type="number" step="0.01" value="${maxVal}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('${fieldId}', '${did}', 'characterCreationMax', this.value)">`;

                
                return `<div class="mechsel-chip" style="border-left-color:#8b5cf6"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? '🌐 Universal' : '🔗 Vinculado'} — Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('${fieldId}', '${did}', 'valorInicial', this.value)">${ruleInputs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${did}')">✕</button></div>`;
            }).join('');
        }
    }
};

window._dvSelLevelChange = function (fieldId, dvId, prop, newValue) {
    if (newValue === undefined) {
        // Suporte para assinatura antiga: (fieldId, dvId, newValue)
        newValue = prop;
        prop = 'valorInicial';
    }
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    // Suportar vírgula como separador decimal (ex: 1,75 → 1.75)
    const parsed = parseFloat(String(newValue).replace(',', '.')) || 0;
    let ids = JSON.parse(hidden.value || '[]');
    ids = ids.map(item => {
        if (typeof item === 'object' && item.id === dvId) {
            const newItem = { ...item };
            newItem[prop] = parsed;
            return newItem;
        }
        if (typeof item === 'string' && item === dvId) {
            const newItem = { id: item, valorInicial: 0 };
            newItem[prop] = parsed;
            return newItem;
        }
        return item;
    });
    hidden.value = JSON.stringify(ids);
};

export function buildManeuverSelectorHTML(fieldKey, label, currentIds, cache) {
    const published = cache.filter(m => m.publicado !== false);
    const ids = currentIds || [];

    const chips = ids.map(mid => {
        const m = cache.find(x => x.id === mid);
        if (!m) return '';
        const custo = m.custo || '';
        return `<div class="mechsel-chip" style="border-left-color:var(--danger)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">💥 ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.classe || '')} — Custo: ${esc(custo)}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${mid}')">✖</button></div>`;
    }).join('');

    const opts = published.map(m => {
        const custo = m.custo || '';
        return `<label class="mechsel-result" data-fonte="${esc(m.classe || '')}"><input type="checkbox" value="${m.id}" ${ids.includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">💥 ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.classe || '')} — Custo: ${esc(custo)}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma manobra vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Manobra</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar manobra..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results" onchange="window._mechSelChange('field_${fieldKey}')">
                ${opts}
            </div>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(ids)}'>
    </div>`;
}
