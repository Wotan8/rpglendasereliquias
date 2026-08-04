// =============================================
console.log("🧩 painel-mechanics v2.1 — múltiplos booleanos ATIVOS");
// VISUAL MECHANICS EDITOR — Lendas e Relíquias
// Handles: inline form, preview, mechanic cards,
//          MechanicSelector component
// =============================================

// --- Shared state (set by painel-firebase.js) ---
// window._mechState = { db, collection, getDocs, addDoc, updateDoc, doc, Timestamp, currentUser, ... }

// =====================================================================
// ᛟ ELEMENTOS RÚNICOS COMO ALVOS (usado no Pool da mecânica "Distribuir")
// ---------------------------------------------------------------------
// Os elementos vêm de system/data/runicElements (window._runicElementsCache,
// populado por refreshRunicElementsCache() em painel-firebase.js).
// O valor gravado no alvo usa o prefixo abaixo para que a ficha consiga
// distinguir um Elemento Rúnico de uma perícia/atributo.
// =====================================================================
export const RUNIC_TARGET_PREFIX = 'Elemento Rúnico: ';

const RUNIC_FAMILY_LABELS = { artus: 'Artus (a Ação)', aspectus: 'Aspectus (a Essência)', sigilus: 'Sigilus (as Engrenagens)' };
const RUNIC_FAMILY_ICON = { artus: '⚙️', aspectus: '✨', sigilus: 'ᛟ' };
const RUNIC_CAT_LABELS = { captador: 'Captador', condutor: 'Condutor', modulador: 'Modulador', logico: 'Lógico', armazenador: 'Armazenador', emissor: 'Emissor', exaustor: 'Exaustor' };

function _runicCache() {
    return (window._runicElementsCache || []).filter(e => e && e.nome);
}

/** Rótulo do grupo (família / categoria) de um elemento rúnico. */
function _runicGroupLabel(el) {
    const fam = String(el.tipoElemento || '').toLowerCase();
    if (fam === 'sigilus') return `ᛟ Sigilus — ${RUNIC_CAT_LABELS[el.categoria] || 'Outros'}`;
    return `${RUNIC_FAMILY_ICON[fam] || 'ᛟ'} ${RUNIC_FAMILY_LABELS[fam] || 'Elementos Rúnicos'}`;
}

/**
 * <optgroup>s com TODOS os Elementos Rúnicos cadastrados, agrupados por
 * família (Artus / Aspectus) e por categoria (dentro de Sigilus).
 */
function getRunicTargetsHTML() {
    const cache = _runicCache();
    if (!cache.length) return '';

    const groups = {};
    for (const el of cache) {
        const label = _runicGroupLabel(el);
        (groups[label] = groups[label] || []).push(el);
    }

    let html = '';
    for (const label of Object.keys(groups).sort((a, b) => a.localeCompare(b))) {
        const list = groups[label].sort(
            (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || (a.nome || '').localeCompare(b.nome || '')
        );
        html += `\n<optgroup label="${esc(label)}">`;
        for (const el of list) {
            const icon = RUNIC_FAMILY_ICON[String(el.tipoElemento || '').toLowerCase()] || 'ᛟ';
            const latim = el.nomeLatim ? ` (${el.nomeLatim})` : '';
            html += `\n<option value="${esc(RUNIC_TARGET_PREFIX + el.nome)}">${icon} ${esc(el.nome)}${esc(latim)}</option>`;
        }
        html += `\n</optgroup>`;
    }
    return html;
}

export function getMechanicTargetsHTML() {
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
            html += `\n<option value="${esc(vs.nome)} Atual">${icon} ${esc(vs.nome)} Atual</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache não carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade Máxima">Vitalidade Máxima</option>`;
        html += `\n<option value="Vitalidade Atual">Vitalidade Atual</option>`;
        html += `\n<option value="Energia Máxima">Energia Máxima</option>`;
        html += `\n<option value="Energia Atual">Energia Atual</option>`;
        html += `\n<option value="Sanidade Máxima">Sanidade Máxima</option>`;
        html += `\n<option value="Sanidade Atual">Sanidade Atual</option>`;
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
                html += `\n<option value="Perícia: ${esc(nome)}">${esc(nome)}</option>`;
            }
            html += `\n</optgroup>`;
        }
    }

    // "Propriedades de Combate" (Alvo de Ataque/Defesa, Dano, Dano Crítico) foi
    // removido: eram alvos informativos que a ficha nunca lia — a mecânica salvava
    // e não fazia nada. Cadastre-os como Valores Derivados (com Escopo por Item,
    // se quiser um valor por arma equipada) e eles aparecem no grupo acima.
    html += `
<optgroup label="Propriedades de Item (só com item em escopo)">
<option value="Item: Peso/Pressão">⚖️ Peso / Pressão do Item</option>
<option value="Item: Tamanho">📐 Tamanho do Item</option>
<option value="Item: Preço">💰 Preço do Item (L$)</option>
<option value="Item: Liga">⚒️ Liga do Item (0–5)</option>
<option value="Item: Qualidade">⭐ Qualidade do Item (0–5)</option>
<option value="Item: Afiação">🗡️ Afiação do Item</option>
<option value="Item: Quantidade">🔢 Quantidade do Item</option>
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

export const FONTE_LABELS = { raca: '🧬 Raça', classe: '⚔️ Classe', tribo: '🏕️ Tribo', peculiaridade: '✨ Pecul.', item: '🗡️ Item', condicao: '💀 Condição', booleana: '🔀 Booleana', manobra: '💥 Manobra', magia: '🔮 Magia', individual: '👤 Individual', generica: '⚙️ Genérica' };
export const TIPO_ICONS = { modificar: '➕', limitar: '🔒', conceder: '🎁', condicional: '⚡', narrativo: '📝', distribuir: '🎲', booleano: '🔀', condicional_encadeado: '🔗' };
export const TIPO_LABELS = { modificar: 'Modificar', limitar: 'Limitar', conceder: 'Conceder', condicional: 'Condicional', narrativo: 'Narrativo', distribuir: 'Distribuir', booleano: 'Booleano', condicional_encadeado: 'Cond. Encadeada' };

function esc(text) {
    if (text === null || text === undefined) return '';
    // Escapa também aspas — este helper é usado dentro de atributos HTML
    // (value="...", onclick='...'); sem isso, nomes com aspas quebravam o DOM.
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Gera optgroup com opções de "Limite: <titulo>" para cada módulo de classe.
 * Percorre window._classesCache ou window._systemData.classes.
 * Suporta tanto IDs de referência (novo) quanto objetos inline (legado).
 */
function _getModuleLimitOptions() {
    const classes = window._classesCache || (window._systemData?.classes) || [];
    const classModulesCache = window._classModulesCache || [];
    const options = [];
    for (const cls of classes) {
        if (cls.publicado === false) continue;
        if (!cls.modulosDaClasse || !Array.isArray(cls.modulosDaClasse)) continue;
        for (const entry of cls.modulosDaClasse) {
            let titulo = '';
            if (typeof entry === 'string') {
                // Novo formato: ID referenciando classModules collection
                const mod = classModulesCache.find(m => m.id === entry);
                titulo = mod ? (mod.titulo || mod.id) : entry;
            } else if (typeof entry === 'object' && entry !== null) {
                // Formato legado: objeto inline
                titulo = entry.titulo || entry.id || '';
            }
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
    // Só usa a forma menor(A, B, …) quando a equação INTEIRA é um min/max.
    // Equação mista (fold sequencial) mostraria a conta errada nessa forma.
    const soMinMax = equacao.length > 1 && equacao.slice(1).every(t => t.op === 'min' || t.op === 'max');
    if (soMinMax) {
        const fnName = equacao[1].op === 'min' ? 'menor' : 'maior';
        const parts = equacao.map(t => {
            if (t.tipo === 'ficha') return `[${t.ref || '?'}]`;
            if (t.tipo === 'sort') return `🎲${t.min ?? '?'}~${t.max ?? '?'}`;
            return (t.valor ?? '?');
        });
        return `${fnName}(${parts.join(', ')})`;
    }
    let str = '';
    for (let i = 0; i < equacao.length; i++) {
        const t = equacao[i];
        if (i > 0 && t.op) str += (t.op === 'min' || t.op === 'max') ? ` ⌊${t.op}⌋ ` : ` ${t.op} `;
        if (t.tipo === 'ficha') str += `[${t.ref || '?'}]`;
        else if (t.tipo === 'sort') str += `🎲${t.min ?? '?'}~${t.max ?? '?'}`;
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
                if (c.alvo === 'EXP') {
                    const op = c.operacao || '+';
                    const val = _formatCalcValue(c);
                    const qualLabels = { exp_total: 'EXP Total', exp_restante: 'EXP Restante', ambos: 'EXP Total + Restante' };
                    const qualLabel = qualLabels[c.qualExp] || 'EXP';
                    const quandoLabels = { na_criacao: 'Na Criação', por_sessao: 'Por Sessão', por_descanso_longo: 'Por Descanso Longo', por_descanso_curto: 'Por Descanso Curto', por_arco: 'Por Arco', por_masmorra: 'Por Masmorra', ao_ativar: 'Ao Ativar', ao_desativar: 'Ao Desativar', condicional: 'Condicional', permanente: 'Permanente', instantanea: 'Instantânea', por_uso_recurso: 'Por Uso de Recurso', por_morte: 'Por Morte/Ressurreição' };
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
        } else if (config.tipoConcessao === 'conceder_equipamento') {
            const eqCache = window._equipmentCache || [];
            const lista = (Array.isArray(config.equipamentosConcedidos) ? config.equipamentosConcedidos : [])
                .map(g => {
                    const eq = eqCache.find(e => e.id === g.id);
                    return `${eq ? eq.nome : g.id}${(g.quantidade || 1) > 1 ? ` ×${g.quantidade}` : ''}`;
                }).join(', ');
            text = `🎒 Concede como Item Solto: ${lista || '?'}`;
        } else if (_MECH_TC_RESTRICAO.includes(config.tipoConcessao)) {
            const alvos = (Array.isArray(config.equipReqs) ? config.equipReqs : []).map(_mechReqLabel).join(', ');
            const verbo = {
                bloquear_equipar: '🚫 Não pode equipar',
                bloquear_equipar_efeitos: '⚡ Não pode equipar com efeitos ativos (pode segurar/fixar)',
                permitir_equipar: '✅ Pode equipar (libera bloqueio)'
            }[config.tipoConcessao];
            text = `${verbo}: ${alvos || '?'}`;
        } else {
            text = `${label[config.tipoConcessao] || 'Concede'}: ${config.descricaoConcessao || '?'}`;
        }
    } else if (tipo === 'condicional') {
        // Build conditional preview with resolved sub-mechanic previews
        const parts = [];
        if (config.condicaoMecanica && config.condicaoMecanicaIds && config.condicaoMecanicaIds.length > 0) {
            const cache = window._mechCache || [];
            const boolNames = config.condicaoMecanicaIds.map(id => {
                const m = cache.find(x => x.id === id);
                return m ? m.nome : '?';
            }).join(', ');
            parts.push(`🔀 Condição: ${boolNames}`);
        } else {
            parts.push(config.gatilho || '?');
        }
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
        let poolLabel = pool;
        if (pool === 'Personalizado' && Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.length) {
            const lista = config.poolPersonalizado.map(v => v.replace(RUNIC_TARGET_PREFIX, 'ᛟ '));
            poolLabel = lista.length > 8
                ? `Personalizado: ${lista.slice(0, 8).join(', ')} … (+${lista.length - 8})`
                : `Personalizado: ${lista.join(', ')}`;
        }
        const rune = String(pool).startsWith('Elementos Rúnicos')
            || (Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.some(v => String(v).startsWith(RUNIC_TARGET_PREFIX)));
        text = `Distribuir: ${op}${val} em ${qty} alvos${rest} de [${poolLabel}]`;
        if (rune) text += `\nᛟ Alvos rúnicos concedem níveis de domínio na aba Runomancia da ficha.`;
    } else if (tipo === 'booleano') {
        const vTrue = config.valorVerdadeiro ?? '?';
        const vFalse = config.valorFalso ?? '?';
        const verifsPrev = (Array.isArray(config.verificacoes) && config.verificacoes.length > 0)
            ? config.verificacoes : [config];
        const joinLbl = config.operadorLogico === 'ou' ? ' OU ' : ' E ';
        const opLabel = { '==': '==', '!=': '!=', '>': '>', '>=': '≥', '<': '<', '<=': '≤' };
        const parts = verifsPrev.map(v => {
            if (v?.modoVerificacao === 'equipamento') {
                const reqs = Array.isArray(v.equipReqs) ? v.equipReqs : [];
                const qtdStr = (Array.isArray(v.equacaoQtdMin) && v.equacaoQtdMin.length > 0)
                    ? _formatEquation(v.equacaoQtdMin) : '1';
                const reqParts = reqs.map(r => {
                    const formas = _mechReqFormas(r);
                    const formasLbl = formas.length ? ` (${formas.map(f => _MECH_FORMA_LABELS[f]).join(' ou ')})` : '';
                    return `${_mechReqLabel(r)}${formasLbl}`;
                });
                return `🎒 Equipado: ${reqParts.join(' E ') || '?'} — cada um ×≥ ${qtdStr}`;
            }
            if (v?.modoVerificacao === 'classe') {
                const cls = (Array.isArray(v.classesReq) ? v.classesReq : []).filter(Boolean);
                return `⚔️ Personagem tem as classes: ${cls.join(' E ') || '?'}`;
            }
            const sideA = _formatEquation(v?.equacaoA || []);
            const op = opLabel[v?.operadorComparacao] || v?.operadorComparacao || '?';
            const sideB = _formatEquation(v?.equacaoB || []);
            return `${sideA} ${op} ${sideB}`;
        });
        const condStr = parts.length > 1 ? parts.map(p => `(${p})`).join(joinLbl) : parts[0];
        text = `${condStr} ? ✅${vTrue} : ❌${vFalse}`;
        const trigParts = [];
        const cacheT = window._mechCache || [];
        const nameOf = id => (cacheT.find(x => x.id === id)?.nome || '?');
        if (Array.isArray(config.efeitoTrueIds) && config.efeitoTrueIds.length) trigParts.push(`✅→ ${config.efeitoTrueIds.map(nameOf).join(', ')}`);
        if (Array.isArray(config.efeitoFalseIds) && config.efeitoFalseIds.length) trigParts.push(`❌→ ${config.efeitoFalseIds.map(nameOf).join(', ')}`);
        if (trigParts.length) text += ` | Aciona: ${trigParts.join(' ; ')}`;
    } else if (tipo === 'condicional_encadeado') {
        const compLabel = { '<': 'Menor que', '<=': 'Menor ou igual a', '==': 'Igual a', '!=': 'Diferente de', '>=': 'Maior ou igual a', '>': 'Maior que', 'entre': 'Entre' };
        const condicoes = Array.isArray(config.condicoes) ? config.condicoes : [];
        const cacheT = window._mechCache || [];
        const nameOf = id => (cacheT.find(x => x.id === id)?.nome || '?');
        const mechSuffix = c => (Array.isArray(c.efeitoMecanicaIds) && c.efeitoMecanicaIds.length)
            ? ` (aciona: ${c.efeitoMecanicaIds.map(nameOf).join(', ')})` : '';
        let condParts;
        let eqStr;
        if (config.modoVerificacao === 'equipamento') {
            const reqs = Array.isArray(config.equipReqs) ? config.equipReqs : [];
            eqStr = `🎒 [${reqs.map(r => _mechReqLabel(r)).join(', ') || '?'}]`;
            condParts = condicoes.map(c => {
                const vers = Array.isArray(c.verificacoes) ? c.verificacoes : [];
                const vParts = vers.map(v => {
                    const alvoLbl = v.alvo === 'total' ? 'Σ Total' : `#${(parseInt(v.alvo, 10) || 0) + 1} ${_mechReqLabel(reqs[parseInt(v.alvo, 10) || 0] || {})}`;
                    if ((v.comparacao || '>=') === 'entre') return `${alvoLbl} entre ${v.valorA ?? '?'} e ${v.valorB ?? '?'}`;
                    return `${alvoLbl} ${compLabel[v.comparacao] || v.comparacao || '?'} ${v.valorA ?? '?'}`;
                });
                return `Se ${vParts.join(' E ') || '?'} = "${c.resultado ?? '?'}"${mechSuffix(c)}`;
            });
        } else if (config.modoVerificacao === 'classe') {
            eqStr = `⚔️ [Classes do personagem]`;
            condParts = condicoes.map(c => {
                const cls = (Array.isArray(c.classesReq) ? c.classesReq : []).filter(Boolean);
                return `Se tiver [${cls.join(' E ') || '?'}] = "${c.resultado ?? '?'}"${mechSuffix(c)}`;
            });
        } else {
            eqStr = _formatEquation(config.equacaoValor || []);
            condParts = condicoes.map(c => {
                const comp = c.comparacao || '<';
                const base = comp === 'entre'
                    ? `${compLabel[comp]} ${c.valorA ?? '?'} e ${c.valorB ?? '?'} = "${c.resultado ?? '?'}"`
                    : `${compLabel[comp] || comp} ${c.valorA ?? '?'} = "${c.resultado ?? '?'}"`;
                return base + mechSuffix(c);
            });
        }
        const padrao = (config.valorPadrao !== undefined && config.valorPadrao !== null && config.valorPadrao !== '') ? ` | Padrão: "${config.valorPadrao}"` : '';
        text = `🔗 ${eqStr} → ${condParts.join(' | ') || 'sem condições'}${padrao}`;
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
                    <button class="btn-delete-card" onclick="event.stopPropagation(); openDeleteModal('${item.id}')" title="Excluir">🗑️</button>
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
            html += `\n<option value="${esc(vs.nome)} Atual">${icon} ${esc(vs.nome)} Atual</option>`;
        }
        html += `\n</optgroup>`;
    } else {
        // Fallback hardcoded para quando cache não carregou
        html += `\n<optgroup label="Status Vitais">`;
        html += `\n<option value="Vitalidade Máxima">Vitalidade Máxima</option>`;
        html += `\n<option value="Vitalidade Atual">Vitalidade Atual</option>`;
        html += `\n<option value="Energia Máxima">Energia Máxima</option>`;
        html += `\n<option value="Energia Atual">Energia Atual</option>`;
        html += `\n<option value="Sanidade Máxima">Sanidade Máxima</option>`;
        html += `\n<option value="Sanidade Atual">Sanidade Atual</option>`;
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
                html += `\n<option value="Perícia: ${esc(nome)}">${esc(nome)}</option>`;
            }
            html += `\n</optgroup>`;
        }
    }

    // "Item: X" só resolve com um item em escopo: mecânica do próprio item, ou
    // mecânica com Escopo de Aplicação = itens equipados. Fora disso vale 0.
    html += `\n<optgroup label="Propriedades de Item (só com item em escopo)">
<option value="Item: Peso/Pressão">⚖️ Peso / Pressão do Item</option>
<option value="Item: Tamanho">📐 Tamanho do Item</option>
<option value="Item: Preço">💰 Preço do Item (L$)</option>
<option value="Item: Liga">⚒️ Liga do Item (0–5)</option>
<option value="Item: Qualidade">⭐ Qualidade do Item (0–5)</option>
<option value="Item: Afiação">🗡️ Afiação do Item</option>
<option value="Item: Quantidade">🔢 Quantidade do Item</option>
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

    const isFicha = t.tipo === 'ficha';
    const isSort = t.tipo === 'sort';
    const isFixo = !isFicha && !isSort;
    return `
    <div class="eq-term" data-term-index="${termIndex}">
        ${opHtml}
        <select class="eq-term-tipo" onchange="window._mechTermTipoChange(${calcIndex}, ${termIndex}); window._mechUpdatePreview()">
            <option value="fixo" ${isFixo ? 'selected' : ''}>🔢 Fixo</option>
            <option value="ficha" ${isFicha ? 'selected' : ''}>📋 Ficha</option>
            <option value="sort" ${isSort ? 'selected' : ''}>🎲 Sort</option>
        </select>
        <div class="eq-term-fixo-wrap" style="display:${isFixo ? '' : 'none'}">
            <input type="text" class="eq-term-valor" value="${esc(String(t.valor ?? ''))}" placeholder="Valor" oninput="window._mechUpdatePreview()">
        </div>
        <div class="eq-term-ficha-wrap" style="display:${isFicha ? '' : 'none'}">
            <select class="eq-term-ref" onchange="window._mechUpdatePreview()">
                <option value="">— Ref —</option>${getValueSourceHTML()}
            </select>
        </div>
        <div class="eq-term-sort-wrap" style="display:${isSort ? '' : 'none'}">
            <input type="text" class="eq-term-sort-min" value="${esc(String(t.min ?? ''))}" placeholder="mín" title="Valor mínimo" oninput="window._mechUpdatePreview()">
            <span class="eq-term-sort-sep" title="Sorteia um valor entre mínimo e máximo">🎲</span>
            <input type="text" class="eq-term-sort-max" value="${esc(String(t.max ?? ''))}" placeholder="máx" title="Valor máximo" oninput="window._mechUpdatePreview()">
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
                <option value="conceder_equipamento" ${tc === 'conceder_equipamento' ? 'selected' : ''}>🎒 Conceder Equipamento (cria Item Solto)</option>
                <option value="bloquear_equipar" ${tc === 'bloquear_equipar' ? 'selected' : ''}>🚫 Bloqueia Equipar (de qualquer forma)</option>
                <option value="bloquear_equipar_efeitos" ${tc === 'bloquear_equipar_efeitos' ? 'selected' : ''}>⚡ Bloqueia Equipar com Efeito</option>
                <option value="permitir_equipar" ${tc === 'permitir_equipar' ? 'selected' : ''}>✅ Permite Equipar (libera bloqueio)</option>
            </select>
        </div>
        <div class="form-group"><label>Descrição da concessão <span class="required">*</span></label>
            <input type="text" id="mech_config_descricaoConcessao" value="${esc(config?.descricaoConcessao || '')}" placeholder="Ex: Voo, Visão de Essência" oninput="window._mechUpdatePreview()">
        </div>
        </div>
    </div>
    <div id="mech_bodyParts_container" style="display: ${(tc === 'adicionar_parte_corpo' || tc === 'remover_parte_corpo') ? 'block' : 'none'}">
        ${_renderBodyPartsConcessao(config)}
    </div>
    <div id="mech_equipConcessao_container" style="display: ${tc === 'conceder_equipamento' ? 'block' : 'none'}">
        ${_renderEquipamentosConcessao(config)}
    </div>
    <div id="mech_equipRestricao_container" style="display: ${_MECH_TC_RESTRICAO.includes(tc) ? 'block' : 'none'}">
        ${_renderRestricaoEquipar(config)}
    </div>`;
}

// ===== BLOQUEAR / PERMITIR EQUIPAR =====
const _MECH_TC_RESTRICAO = ['bloquear_equipar', 'bloquear_equipar_efeitos', 'permitir_equipar'];

/** Vínculos (equipamento específico / tag / tipo) que a restrição alcança.
 *  Reusa as mesmas linhas da Verificação de Equipamento, sem as "formas":
 *  a restrição vale para qualquer forma de equipar. */
function _renderRestricaoEquipar(config) {
    const reqs = Array.isArray(config?.equipReqs) ? config.equipReqs : [];
    const rows = reqs.map((r, i) => _renderMechEquipReqRow(r, i, false, true)).join('');
    return `
    <div style="margin-top:16px">
        <label>🎒 Equipamentos alcançados pela regra <span class="required">*</span></label>
        <div class="mech-equipreqs" id="mech_restricaoEquipReqs">${rows}</div>
        ${_renderMechEquipReqSelect('mech_restricaoEquipReqs')}
        <div class="cm-hint">
            <b>🚫 Bloqueia Equipar:</b> a ficha recusa equipar de qualquer forma — nem segurar, nem fixar.<br>
            <b>⚡ Bloqueia Equipar com Efeito:</b> pode segurar, fixar e guardar em contêiner, mas não
            nos modos que ativam os efeitos (Empunhado / Vestido). É o caso da armadura que o personagem
            carrega mas não sabe usar.<br>
            <b>✅ Permite:</b> libera o que outra mecânica bloqueou — vence os dois tipos de bloqueio.<br>
            Itens <b>já equipados</b> que a regra alcança saem do corpo no recálculo seguinte, com aviso ao jogador.
        </div>
    </div>`;
}

function _renderEquipamentosConcessao(config) {
    const eqCache = window._equipmentCache || [];
    const concedidos = Array.isArray(config?.equipamentosConcedidos) ? config.equipamentosConcedidos : [];

    const rows = concedidos.map(g => {
        const eq = eqCache.find(e => e.id === g.id);
        const nome = eq ? eq.nome : `⚠️ ${g.id}`;
        return `
        <div class="mech-equip-conc-row" data-eq-id="${esc(g.id)}" style="display:flex;align-items:center;gap:10px;padding:5px 8px;margin-bottom:5px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-panel)">
            <span style="flex:1;font-size:13px;font-weight:600">🎒 ${esc(nome)}</span>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">Quantidade:
                <input type="number" class="eq-conc-qtd" min="1" value="${Math.max(1, parseInt(g.quantidade, 10) || 1)}" style="width:70px;padding:3px 6px;font-size:13px" oninput="window._mechUpdatePreview()">
            </label>
            <button type="button" onclick="this.closest('.mech-equip-conc-row').remove();window._mechUpdatePreview()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px">✕</button>
        </div>`;
    }).join('');

    const options = eqCache.map(e => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join('');
    const warning = eqCache.length === 0 ? '<div class="alert alert-warning" style="margin-top:12px">Nenhum equipamento cadastrado no sistema.</div>' : '';

    return `
    <div style="margin-top:16px">
        <label>🎒 Equipamentos concedidos (criados como <b>Item Solto</b> na ficha ao aplicar a mecânica): <span class="required">*</span></label>
        ${warning}
        <div id="mech_equipConc_list" style="margin-top:8px">${rows}</div>
        <select onchange="window._mechAddEquipConcessao(this)" style="margin-top:6px;width:100%;padding:6px 8px;font-size:13px">
            <option value="">+ Vincular Equipamento...</option>
            ${options}
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">A concessão acontece <b>uma única vez</b> por personagem (rastreada na ficha). Os itens ficam em "📋 Itens Soltos" no inventário.</div>
    </div>`;
}

window._mechAddEquipConcessao = function (select) {
    const eqId = select.value;
    if (!eqId) return;
    const list = document.getElementById('mech_equipConc_list');
    if (!list) { select.value = ''; return; }
    if (list.querySelector(`.mech-equip-conc-row[data-eq-id="${eqId}"]`)) { select.value = ''; return; }
    const eq = (window._equipmentCache || []).find(e => e.id === eqId);
    const temp = document.createElement('div');
    temp.innerHTML = `
        <div class="mech-equip-conc-row" data-eq-id="${esc(eqId)}" style="display:flex;align-items:center;gap:10px;padding:5px 8px;margin-bottom:5px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-panel)">
            <span style="flex:1;font-size:13px;font-weight:600">🎒 ${esc(eq?.nome || eqId)}</span>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">Quantidade:
                <input type="number" class="eq-conc-qtd" min="1" value="1" style="width:70px;padding:3px 6px;font-size:13px" oninput="window._mechUpdatePreview()">
            </label>
            <button type="button" onclick="this.closest('.mech-equip-conc-row').remove();window._mechUpdatePreview()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px">✕</button>
        </div>`;
    list.appendChild(temp.firstElementChild);
    select.value = '';
    window._mechUpdatePreview();
};

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
    const textoSucesso = config?.textoSucesso || '';
    const textoFalha = config?.textoFalha || '';
    const condicaoMecanica = config?.condicaoMecanica || false;
    const condicaoMecanicaIds = config?.condicaoMecanicaIds || [];

    // Filter cache to only show mechanics with fonte === 'booleana'
    const boolCache = mechanicsCache.filter(m => m.fonte === 'booleana' && m.publicado);

    return `
    <div class="mech-condicao-toggle-row">
        <label class="toggle-publish"><input type="checkbox" id="mech_condicaoMecanica" ${condicaoMecanica ? 'checked' : ''} onchange="window._mechCondicaoMecanicaToggle()"><span class="toggle-slider"></span></label>
        <span class="toggle-label">🔀 Condição mecânica?</span>
    </div>
    <div class="form-grid">
        <div class="form-group full-width" id="mech_gatilho_wrap" style="display:${condicaoMecanica ? 'none' : ''}"><label>Gatilho / Quando se aplica <span class="required">*</span></label>
            <textarea id="mech_config_gatilho" placeholder="Ex: Teste de AUT por cena" oninput="window._mechUpdatePreview()">${esc(gatilho)}</textarea>
        </div>
        <div class="form-group full-width" id="mech_condicaoMecanicaSelector_wrap" style="display:${condicaoMecanica ? '' : 'none'}">
            ${buildInlineMechSelector('mech_config_condicaoMecanicaIds', '🔀 Vincular Mecânica Booleana (fonte: Booleana)', condicaoMecanicaIds, boolCache, false)}
        </div>
        <div class="form-group full-width">
            <label>Texto de Sucesso (Narrativo)</label>
            <textarea id="mech_config_textoSucesso" placeholder="Ex: O alvo fica atordoado com o impacto" oninput="window._mechUpdatePreview()">${esc(textoSucesso)}</textarea>
        </div>
        <div class="form-group full-width">
            ${buildInlineMechSelector('mech_config_efeitoSucessoIds', 'Efeito Sucesso (mecânicas)', sucessoIds, mechanicsCache, true)}
        </div>
        <div class="form-group full-width">
            <label>Texto de Falha (Opcional)</label>
            <textarea id="mech_config_textoFalha" placeholder="Ex: O alvo resiste e nada acontece" oninput="window._mechUpdatePreview()">${esc(textoFalha)}</textarea>
        </div>
        <div class="form-group full-width">
            ${buildInlineMechSelector('mech_config_efeitoFalhaIds', 'Efeito Falha (mecânicas, opcional)', falhaIds, mechanicsCache, true)}
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

    // Build checkboxes from getMechanicTargetsHTML() + getRunicTargetsHTML()
    // (ᛟ Elementos Rúnicos entram no mesmo pool personalizado dos demais alvos)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `<select>${getMechanicTargetsHTML()}${getRunicTargetsHTML()}</select>`;
    const allOptions = Array.from(tempDiv.querySelectorAll('option'));

    const knownValues = new Set(allOptions.map(o => o.value));
    // Alvos salvos que não existem mais no cadastro (ou cache ainda não carregado)
    // continuam visíveis e marcados — assim nunca são perdidos silenciosamente.
    const orphans = poolCustom.filter(v => !knownValues.has(v));

    const buildCb = (value, label, grupo, isOrphan) => {
        const checked = poolCustom.includes(value) ? 'checked' : '';
        const runic = value.startsWith(RUNIC_TARGET_PREFIX);
        const style = runic
            ? 'padding:4px 6px;border:1px solid rgba(139,92,246,.35);border-radius:6px'
            : 'padding:4px 6px';
        return `<label class="mechsel-result mech-pool-opt" data-search="${esc((label + ' ' + grupo).toLowerCase())}" title="${esc(grupo)}" style="${style}">
            <input type="checkbox" value="${esc(value)}" ${checked} onchange="window._mechUpdatePreview()" data-runic="${runic ? '1' : '0'}">
            <span class="mechsel-result-name">${esc(label)}${isOrphan ? ' <em>(não cadastrado)</em>' : ''}</span></label>`;
    };

    const checkboxesHtml =
        orphans.map(v => buildCb(v, v, 'órfão', true)).join('') +
        allOptions.map(opt => {
            const grupo = opt.parentElement?.label || '';
            return buildCb(opt.value, opt.textContent, grupo, false);
        }).join('');

    const runicCount = _runicCache().length;

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
                <optgroup label="ᛟ Elementos Rúnicos (Runomancia)">
                    <option value="Elementos Rúnicos (qualquer)" ${poolVal === 'Elementos Rúnicos (qualquer)' ? 'selected' : ''}>ᛟ Elementos Rúnicos (qualquer)</option>
                    <option value="Elementos Rúnicos: Artus" ${poolVal === 'Elementos Rúnicos: Artus' ? 'selected' : ''}>⚙️ Elementos Rúnicos — Artus</option>
                    <option value="Elementos Rúnicos: Aspectus" ${poolVal === 'Elementos Rúnicos: Aspectus' ? 'selected' : ''}>✨ Elementos Rúnicos — Aspectus</option>
                    <option value="Elementos Rúnicos: Sigilus" ${poolVal === 'Elementos Rúnicos: Sigilus' ? 'selected' : ''}>ᛟ Elementos Rúnicos — Sigilus</option>
                    ${Object.entries(RUNIC_CAT_LABELS).map(([k, lbl]) => {
        const v = `Elementos Rúnicos: Sigilus ${lbl}`;
        return `<option value="${esc(v)}" ${poolVal === v ? 'selected' : ''}>ᛟ Sigilus — ${esc(lbl)}</option>`;
    }).join('')}
                    ${['iniciante', 'intermediario', 'avancado', 'mestre'].map(c => {
        const lbl = c === 'intermediario' ? 'Intermediário' : c === 'avancado' ? 'Avançado' : c.charAt(0).toUpperCase() + c.slice(1);
        const v = `Elementos Rúnicos: Complexidade ${lbl}`;
        return `<option value="${esc(v)}" ${poolVal === v ? 'selected' : ''}>ᛟ Sigilus — Complexidade ${esc(lbl)}</option>`;
    }).join('')}
                </optgroup>
                <option value="Personalizado" ${poolVal === 'Personalizado' ? 'selected' : ''}>Personalizado</option>
            </select>
            <div style="font-size:.62rem;color:var(--muted);margin-top:4px">
                ᛟ Pools rúnicos concedem <b>níveis de domínio</b> do elemento na ficha (aba Runomancia), respeitando o Nível Máximo de cada elemento.
                ${runicCount ? `${runicCount} elemento(s) cadastrado(s).` : '⚠️ Nenhum Elemento Rúnico cadastrado ainda (aba ᛟ Elementos Rúnicos).'}
            </div>
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
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
                <input type="text" id="mech_config_poolFiltro" placeholder="🔎 Filtrar alvos (ex: fogo, perícia, sigilus…)"
                    oninput="window._mechPoolFiltrar(this.value)" style="flex:1;min-width:180px;font-size:.75rem">
                <button type="button" class="btn-sm" onclick="window._mechPoolMarcar('runic', true)" title="Marca todos os Elementos Rúnicos visíveis no filtro">ᛟ Marcar rúnicos</button>
                <button type="button" class="btn-sm" onclick="window._mechPoolMarcar('runic', false)">ᛟ Desmarcar rúnicos</button>
                <button type="button" class="btn-sm" onclick="window._mechPoolMarcar('all', false)">✕ Limpar tudo</button>
            </div>
            <div id="mech_config_poolPersonalizado" style="max-height:220px;overflow-y:auto;border:2px solid var(--soft);border-radius:8px;padding:8px;display:flex;flex-wrap:wrap;gap:2px">
                ${checkboxesHtml}
            </div>
            <div id="mech_config_poolResumo" style="font-size:.62rem;color:var(--muted);margin-top:4px"></div>
        </div>
    </div>`;
}

// ===== RENDER A BOOLEAN EQUATION TERM (for side A or B) =====
function _renderBoolEquationTerm(term, side, termIndex) {
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

    const isFicha = t.tipo === 'ficha';
    const isSort = t.tipo === 'sort';
    const isFixo = !isFicha && !isSort;
    return `
    <div class="eq-term" data-term-index="${termIndex}">
        ${opHtml}
        <select class="eq-term-tipo" onchange="window._mechBoolTermTipoChange('${side}', ${termIndex}); window._mechUpdatePreview()">
            <option value="fixo" ${isFixo ? 'selected' : ''}>🔢 Fixo</option>
            <option value="ficha" ${isFicha ? 'selected' : ''}>📋 Ficha</option>
            <option value="sort" ${isSort ? 'selected' : ''}>🎲 Sort</option>
        </select>
        <div class="eq-term-fixo-wrap" style="display:${isFixo ? '' : 'none'}">
            <input type="text" class="eq-term-valor" value="${esc(String(t.valor ?? ''))}" placeholder="Valor" oninput="window._mechUpdatePreview()">
        </div>
        <div class="eq-term-ficha-wrap" style="display:${isFicha ? '' : 'none'}">
            <select class="eq-term-ref" onchange="window._mechUpdatePreview()">
                <option value="">— Ref —</option>${getValueSourceHTML()}
            </select>
        </div>
        <div class="eq-term-sort-wrap" style="display:${isSort ? '' : 'none'}">
            <input type="text" class="eq-term-sort-min" value="${esc(String(t.min ?? ''))}" placeholder="mín" title="Valor mínimo" oninput="window._mechUpdatePreview()">
            <span class="eq-term-sort-sep" title="Sorteia um valor entre mínimo e máximo">🎲</span>
            <input type="text" class="eq-term-sort-max" value="${esc(String(t.max ?? ''))}" placeholder="máx" title="Valor máximo" oninput="window._mechUpdatePreview()">
        </div>
        ${termIndex > 0 ? `<button type="button" class="eq-term-remove" onclick="window._mechBoolRemoveTerm('${side}', ${termIndex})" title="Remover termo">✕</button>` : ''}
    </div>`;
}

// ===== VERIFICAÇÃO DE EQUIPAMENTO (compartilhado: booleano + condicional_encadeado) =====

const _MECH_EQUIP_TIPOS = ['Arma', 'Vestimenta', 'Acessório', 'Projétil', 'Container', 'Objeto', 'Consumível', 'Relíquia'];
const _MECH_FORMA_LABELS = { efeitos: '⚡ Efeitos Ativos', segurando: '🖐️ Segurando', fixado: '📌 Fixado' };

function _mechEquipAllTags() {
    const set = new Set();
    (window._equipmentCache || []).forEach(e => {
        if (Array.isArray(e.tags)) e.tags.forEach(t => { if (t) set.add(String(t)); });
    });
    return [...set].sort((a, b) => a.localeCompare(b));
}

/** Normaliza o alvo de um requisito (equipamento específico, tag ou tipo). */
function _mechReqTarget(req) {
    req = req || {};
    if (req.targetTipo === 'tag' || (req.tag && !req.equipamentoId)) return { kind: 'tag', value: req.tag || '' };
    if (req.targetTipo === 'tipo' || (req.tipoEquipamento && !req.equipamentoId)) return { kind: 'tipo', value: req.tipoEquipamento || '' };
    return { kind: 'equipamento', value: req.equipamentoId || req.id || '' };
}

function _mechReqLabel(req) {
    const t = _mechReqTarget(req);
    if (t.kind === 'tag') return `🏷️ Tag: ${t.value}`;
    if (t.kind === 'tipo') return `📦 Tipo: ${t.value}`;
    const eq = (window._equipmentCache || []).find(e => e.id === t.value);
    return `🎒 ${eq ? eq.nome : t.value}`;
}

function _mechReqFormas(req) {
    req = req || {};
    if (Array.isArray(req.formasEquip)) return req.formasEquip.filter(f => ['efeitos', 'segurando', 'fixado'].includes(f));
    return [];
}

/** Linha de um requisito de equipamento no editor de mecânicas (sem qtd/modo — a Qtd mín. vem da Equação de Valor).
 *  `semFormas` esconde os checkboxes de forma: usado por quem só precisa do alvo
 *  (bloquear/permitir equipar vale para qualquer forma). */
function _renderMechEquipReqRow(req, index, showIndex, semFormas) {
    const target = _mechReqTarget(req);
    const formas = _mechReqFormas(req);
    const formaChk = (key) => `
        <label class="cm-forma-check">
            <input type="checkbox" data-ce-forma="${key}" ${formas.includes(key) ? 'checked' : ''} onchange="window._mechUpdatePreview()">
            <span>${_MECH_FORMA_LABELS[key]}</span>
        </label>`;
    return `
        <div class="cm-equip-cost-row" data-target-tipo="${target.kind}" data-eq-id="${target.kind === 'equipamento' ? esc(target.value) : ''}" data-eq-tag="${target.kind === 'tag' ? esc(target.value) : ''}" data-eq-tipo="${target.kind === 'tipo' ? esc(target.value) : ''}">
            ${showIndex ? `<span class="mech-eqreq-index">#${index + 1}</span>` : ''}
            <span class="cm-equip-cost-name">${esc(_mechReqLabel(req))}</span>
            ${semFormas ? '' : `<div class="cm-equip-cost-formas">
                <span class="cm-mini-label">Precisa estar (nenhum = qualquer forma):</span>
                <div class="cm-forma-checks">
                    ${formaChk('efeitos')}${formaChk('segurando')}${formaChk('fixado')}
                </div>
            </div>`}
            <button type="button" class="cm-chip-remove" onclick="window._mechEquipReqRemove(this)">✕</button>
        </div>
    `;
}

function _renderMechEquipReqSelect(containerId) {
    const eqOpts = (window._equipmentCache || [])
        .map(e => `<option value="eq::${esc(e.id)}">${esc(e.nome)}</option>`).join('');
    const tagOpts = _mechEquipAllTags().map(t => `<option value="tag::${esc(t)}">🏷️ ${esc(t)}</option>`).join('');
    const tipoOpts = _MECH_EQUIP_TIPOS.map(t => `<option value="tipo::${esc(t)}">📦 ${esc(t)}</option>`).join('');
    return `
        <select class="aura-mech-select" onchange="window._mechEquipReqAdd(this, '${containerId}')">
            <option value="">+ Vincular Equipamento, Tag ou Tipo...</option>
            <optgroup label="🗡️ Equipamentos específicos">${eqOpts}</optgroup>
            <optgroup label="🏷️ Por Tag (qualquer equipamento com a tag)">
                ${tagOpts}
                <option value="tag::__nova__">✏️ Digitar tag...</option>
            </optgroup>
            <optgroup label="📦 Por Tipo (qualquer equipamento do tipo)">${tipoOpts}</optgroup>
        </select>
    `;
}

/** Coleta os requisitos de equipamento de um container de linhas. */
function _collectMechEquipReqs(containerId) {
    const list = document.getElementById(containerId);
    if (!list) return [];
    const reqs = [];
    list.querySelectorAll('.cm-equip-cost-row').forEach(row => {
        const targetTipo = row.dataset.targetTipo || 'equipamento';
        const formasEquip = [...row.querySelectorAll('[data-ce-forma]')].filter(c => c.checked).map(c => c.dataset.ceForma);
        const req = { targetTipo, formasEquip };
        if (targetTipo === 'tag') { if (!row.dataset.eqTag) return; req.tag = row.dataset.eqTag; }
        else if (targetTipo === 'tipo') { if (!row.dataset.eqTipo) return; req.tipoEquipamento = row.dataset.eqTipo; }
        else { if (!row.dataset.eqId) return; req.equipamentoId = row.dataset.eqId; }
        reqs.push(req);
    });
    return reqs;
}

window._mechEquipReqAdd = function (select, containerId) {
    const raw = select.value;
    if (!raw) return;
    const list = document.getElementById(containerId);
    if (!list) { select.value = ''; return; }

    let req, dupKind, dupValue;
    if (raw.startsWith('tag::')) {
        dupKind = 'tag'; dupValue = raw.slice(5);
        // Tag ainda não usada por nenhum equipamento (ex: cadastrar a regra das
        // adagas antes de criar as adagas) — digita na hora.
        if (dupValue === '__nova__') {
            dupValue = (prompt('Tag do equipamento (escreva igual à do cadastro):') || '').trim();
            if (!dupValue) { select.value = ''; return; }
        }
        req = { targetTipo: 'tag', tag: dupValue, formasEquip: [] };
    } else if (raw.startsWith('tipo::')) {
        dupKind = 'tipo'; dupValue = raw.slice(6);
        req = { targetTipo: 'tipo', tipoEquipamento: dupValue, formasEquip: [] };
    } else {
        dupKind = 'equipamento'; dupValue = raw.startsWith('eq::') ? raw.slice(4) : raw;
        req = { targetTipo: 'equipamento', equipamentoId: dupValue, formasEquip: [] };
    }
    const isDup = [...list.querySelectorAll('.cm-equip-cost-row')].some(r => {
        if ((r.dataset.targetTipo || 'equipamento') !== dupKind) return false;
        const v = dupKind === 'tag' ? r.dataset.eqTag : (dupKind === 'tipo' ? r.dataset.eqTipo : r.dataset.eqId);
        return v === dupValue;
    });
    if (isDup) { select.value = ''; return; }

    const showIndex = containerId === 'mech_enc_equipReqs';
    const index = list.querySelectorAll('.cm-equip-cost-row').length;
    const temp = document.createElement('div');
    temp.innerHTML = _renderMechEquipReqRow(req, index, showIndex, containerId === 'mech_restricaoEquipReqs');
    list.appendChild(temp.firstElementChild);
    select.value = '';
    if (showIndex) window._mechEncEqSyncAfterReqChange();
    window._mechUpdatePreview();
};

window._mechEquipReqRemove = function (btn) {
    const row = btn.closest('.cm-equip-cost-row');
    const list = row?.parentElement;
    if (!row || !list) return;
    row.remove();
    if (list.id === 'mech_enc_equipReqs') window._mechEncEqSyncAfterReqChange();
    window._mechUpdatePreview();
};

// ===== VERIFICAÇÃO DE CLASSE (compartilhado: booleano + condicional_encadeado) =====

/** Lista os nomes de todas as classes cadastradas no registro. */
function _mechAllClasses() {
    const classes = window._classesCache || (window._systemData?.classes) || [];
    return classes
        .filter(c => c && c.nome)
        .map(c => c.nome)
        .sort((a, b) => a.localeCompare(b));
}

/** Checkbox list de classes (lado direito da Verificação de Classe).
 *  Preserva classes salvas que não existem mais no registro. */
function _renderMechClasseChecks(containerId, selected) {
    const sel = (Array.isArray(selected) ? selected : []).filter(Boolean);
    const all = _mechAllClasses();
    const extras = sel.filter(n => !all.includes(n));
    const items = [...all, ...extras].map(nome => `
        <label class="cm-forma-check mech-classe-check">
            <input type="checkbox" value="${esc(nome)}" ${sel.includes(nome) ? 'checked' : ''} onchange="window._mechUpdatePreview()">
            <span>⚔️ ${esc(nome)}${extras.includes(nome) ? ' <small>(fora do registro)</small>' : ''}</span>
        </label>`).join('');
    return `<div class="cm-forma-checks mech-classe-checks" id="${containerId}" style="flex-wrap:wrap;gap:6px">${items || '<span class="cm-hint">Nenhuma classe cadastrada no registro.</span>'}</div>`;
}

/** Coleta os nomes de classes marcados em um container de checkboxes. */
function _collectMechClasseReqs(containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return [];
    return [...cont.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
}

/** Normaliza a config do booleano para uma lista de verificações.
 *  Formato novo: config.verificacoes = [{ modoVerificacao, equacaoA, operadorComparacao,
 *  equacaoB, equipReqs, equacaoQtdMin }, ...] combinadas por config.operadorLogico ('e'|'ou').
 *  Formato legado (uma verificação nos campos de topo) é convertido automaticamente. */
function _boolVerifsFromConfig(config) {
    if (Array.isArray(config?.verificacoes) && config.verificacoes.length > 0) {
        return config.verificacoes.map(v => ({ ...(v || {}) }));
    }
    return [{
        modoVerificacao: ['equipamento', 'classe'].includes(config?.modoVerificacao) ? config.modoVerificacao : 'numerico',
        equacaoA: config?.equacaoA || [{ tipo: 'fixo', valor: '' }],
        operadorComparacao: config?.operadorComparacao || '>=',
        equacaoB: config?.equacaoB || [{ tipo: 'fixo', valor: '' }],
        equipReqs: Array.isArray(config?.equipReqs) ? config.equipReqs : [],
        equacaoQtdMin: (Array.isArray(config?.equacaoQtdMin) && config.equacaoQtdMin.length > 0)
            ? config.equacaoQtdMin : [{ tipo: 'fixo', valor: '1' }],
        classesReq: Array.isArray(config?.classesReq) ? config.classesReq : []
    }];
}

/** Renderiza um bloco de verificação booleana (#i). Os containers de equação usam
 *  sufixo por índice ('A_0', 'B_0', 'Q_0'...) — compatível com os handlers
 *  _mechBoolAddTerm / _mechBoolRemoveTerm / _mechBoolTermTipoChange existentes. */
function _renderBoolVerifBlock(v, i, total) {
    const modo = ['equipamento', 'classe'].includes(v?.modoVerificacao) ? v.modoVerificacao : 'numerico';
    const classesReq = Array.isArray(v?.classesReq) ? v.classesReq : [];
    const equacaoA = (Array.isArray(v?.equacaoA) && v.equacaoA.length) ? v.equacaoA : [{ tipo: 'fixo', valor: '' }];
    const equacaoB = (Array.isArray(v?.equacaoB) && v.equacaoB.length) ? v.equacaoB : [{ tipo: 'fixo', valor: '' }];
    const equipReqs = Array.isArray(v?.equipReqs) ? v.equipReqs : [];
    const equacaoQtdMin = (Array.isArray(v?.equacaoQtdMin) && v.equacaoQtdMin.length) ? v.equacaoQtdMin : [{ tipo: 'fixo', valor: '1' }];
    const operador = v?.operadorComparacao || '>=';

    const termsA = equacaoA.map((t, ti) => _renderBoolEquationTerm(t, `A_${i}`, ti)).join('');
    const termsB = equacaoB.map((t, ti) => _renderBoolEquationTerm(t, `B_${i}`, ti)).join('');
    const termsQ = equacaoQtdMin.map((t, ti) => _renderBoolEquationTerm(t, `Q_${i}`, ti)).join('');
    const reqRows = equipReqs.map((r, ri) => _renderMechEquipReqRow(r, ri, false)).join('');

    return `
    <div class="bool-verif-block" data-verif-index="${i}" style="border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:10px;margin-bottom:10px;background:var(--lr-bg-1)">
        <div class="bool-verif-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span class="bool-verif-title" style="font-weight:800;font-size:.8rem;color:var(--lr-gold)">🔀 Booleano #${i + 1}</span>
            ${total > 1 ? `<button type="button" class="eq-term-remove" onclick="window._mechBoolRemoveVerif(${i})" title="Remover este booleano">✕</button>` : ''}
        </div>

        <div class="form-group full-width">
            <label>Tipo de Lógica</label>
            <select id="mech_config_modoVerificacao_${i}" class="bool-verif-modo" onchange="window._mechBoolModoChange(${i})">
                <option value="numerico" ${modo === 'numerico' ? 'selected' : ''}>🧮 Lógica Numérica (equação comparativa)</option>
                <option value="equipamento" ${modo === 'equipamento' ? 'selected' : ''}>🎒 Verificação de Equipamento (inventário do personagem)</option>
                <option value="classe" ${modo === 'classe' ? 'selected' : ''}>⚔️ Verificação de Classe (classes do personagem)</option>
            </select>
        </div>

        <div id="mech_bool_numerico_wrap_${i}" style="display:${modo === 'numerico' ? '' : 'none'}">
        <div class="bool-equation-wrap">
            <div class="bool-equation-side">
                <div class="bool-equation-side-label">Lado Esquerdo (A)</div>
                <div class="eq-terms-container" id="boolEquacaoA_${i}">
                    ${termsA}
                </div>
                <button type="button" class="eq-add-term-btn" onclick="window._mechBoolAddTerm('A_${i}')">➕ Adicionar Termo</button>
            </div>

            <div class="bool-comparator-row">
                <div class="bool-vs-label">COMPARAR COM</div>
                <select class="bool-comparator bool-verif-operador" id="mech_config_operadorComparacao_${i}" onchange="window._mechUpdatePreview()">
                    <option value="==" ${operador === '==' ? 'selected' : ''}>== Igual</option>
                    <option value="!=" ${operador === '!=' ? 'selected' : ''}>!= Diferente</option>
                    <option value=">" ${operador === '>' ? 'selected' : ''}>> Maior que</option>
                    <option value=">=" ${operador === '>=' ? 'selected' : ''}>≥ Maior ou igual</option>
                    <option value="<" ${operador === '<' ? 'selected' : ''}>< Menor que</option>
                    <option value="<=" ${operador === '<=' ? 'selected' : ''}>≤ Menor ou igual</option>
                </select>
            </div>

            <div class="bool-equation-side">
                <div class="bool-equation-side-label">Lado Direito (B)</div>
                <div class="eq-terms-container" id="boolEquacaoB_${i}">
                    ${termsB}
                </div>
                <button type="button" class="eq-add-term-btn" onclick="window._mechBoolAddTerm('B_${i}')">➕ Adicionar Termo</button>
            </div>
        </div>
        </div>

        <div id="mech_bool_equip_wrap_${i}" style="display:${modo === 'equipamento' ? '' : 'none'}">
            <div class="bool-equation-side">
                <div class="bool-equation-side-label">🎒 Equipamentos verificados no inventário</div>
                <div class="mech-equipreqs" id="mech_bool_equipReqs_${i}">${reqRows}</div>
                ${_renderMechEquipReqSelect(`mech_bool_equipReqs_${i}`)}
                <div class="cm-hint">Retorna <b>Verdadeiro</b> se <b>todos</b> os vínculos tiverem itens equipados nas formas marcadas (nenhuma marcada = qualquer forma equipada) em quantidade ≥ à Equação de Valor abaixo.</div>
            </div>
            <div class="bool-equation-side" style="margin-top:8px">
                <div class="bool-equation-side-label">🧮 Equação de Valor — Qtd mín. exigida de cada vínculo (vazio = 1)</div>
                <div class="eq-terms-container" id="boolEquacaoQ_${i}">
                    ${termsQ}
                </div>
                <button type="button" class="eq-add-term-btn" onclick="window._mechBoolAddTerm('Q_${i}')">➕ Adicionar Termo</button>
            </div>
        </div>

        <div id="mech_bool_classe_wrap_${i}" style="display:${modo === 'classe' ? '' : 'none'}">
            <div class="bool-equation-wrap">
                <div class="bool-equation-side">
                    <div class="bool-equation-side-label">Lado Esquerdo (A) — Classes do personagem</div>
                    <div class="cm-hint">Preenchido <b>automaticamente</b> na ficha com as classes do personagem.</div>
                </div>
                <div class="bool-comparator-row">
                    <div class="bool-vs-label">POSSUI TODAS</div>
                </div>
                <div class="bool-equation-side">
                    <div class="bool-equation-side-label">Lado Direito (B) — Classes exigidas</div>
                    ${_renderMechClasseChecks(`mech_bool_classeReqs_${i}`, classesReq)}
                    <div class="cm-hint">Retorna <b>✅ Verdadeiro</b> se o personagem tiver <b>todas</b> as classes selecionadas; se faltar alguma delas, retorna <b>❌ Falso</b>.</div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderConfigBooleano(config) {
    const verifs = _boolVerifsFromConfig(config);
    const operadorLogico = config?.operadorLogico === 'ou' ? 'ou' : 'e';
    const valTrue = config?.valorVerdadeiro ?? '';
    const valFalse = config?.valorFalso ?? '';
    const efeitoTrueIds = Array.isArray(config?.efeitoTrueIds) ? config.efeitoTrueIds : [];
    const efeitoFalseIds = Array.isArray(config?.efeitoFalseIds) ? config.efeitoFalseIds : [];
    const cache = window._mechCache || [];

    const blocks = verifs.map((v, i) => _renderBoolVerifBlock(v, i, verifs.length)).join('');

    return `
    <div id="mech_bool_verif_list">${blocks}</div>
    <button type="button" class="calc-add-btn" onclick="window._mechBoolAddVerif()">➕ Adicionar Booleano</button>

    <div class="form-group full-width" id="mech_bool_logico_wrap" style="display:${verifs.length > 1 ? '' : 'none'};margin-top:8px">
        <label>Combinação dos Booleanos</label>
        <select id="mech_config_operadorLogico" onchange="window._mechUpdatePreview()">
            <option value="e" ${operadorLogico === 'e' ? 'selected' : ''}>E — ✅ Verdadeiro somente se TODAS as verificações forem verdadeiras</option>
            <option value="ou" ${operadorLogico === 'ou' ? 'selected' : ''}>OU — ✅ Verdadeiro se QUALQUER verificação for verdadeira</option>
        </select>
    </div>

    <div class="bool-output-section">
        <div class="bool-output-card true-card">
            <label>✅ Valor se Verdadeiro</label>
            <input type="text" id="mech_config_valorVerdadeiro" value="${esc(String(valTrue))}" placeholder="Ex: 2" oninput="window._mechUpdatePreview()">
        </div>
        <div class="bool-output-card false-card">
            <label>❌ Valor se Falso</label>
            <input type="text" id="mech_config_valorFalso" value="${esc(String(valFalse))}" placeholder="Ex: -1" oninput="window._mechUpdatePreview()">
        </div>
    </div>

    <div class="form-group full-width" style="margin-top:8px">
        ${buildInlineMechSelector('mech_config_efeitoTrueIds', '✅ Se Verdadeiro → acionar Mecânicas (opcional)', efeitoTrueIds, cache, true)}
    </div>
    <div class="form-group full-width">
        ${buildInlineMechSelector('mech_config_efeitoFalseIds', '❌ Se Falso → acionar Mecânicas (opcional)', efeitoFalseIds, cache, true)}
    </div>`;
}

/** Coleta todas as verificações booleanas do editor (uma por bloco). */
function _collectBoolVerificacoes() {
    const list = document.getElementById('mech_bool_verif_list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.bool-verif-block')).map(block => {
        const i = block.dataset.verifIndex;
        const modoRaw = block.querySelector('.bool-verif-modo')?.value;
        const modoVerificacao = ['equipamento', 'classe'].includes(modoRaw) ? modoRaw : 'numerico';
        const contA = document.getElementById(`boolEquacaoA_${i}`);
        const contB = document.getElementById(`boolEquacaoB_${i}`);
        const contQ = document.getElementById(`boolEquacaoQ_${i}`);
        return {
            modoVerificacao,
            equacaoA: contA ? _collectEquacaoFromContainer(contA) : [{ tipo: 'fixo', valor: '' }],
            operadorComparacao: block.querySelector('.bool-verif-operador')?.value || '>=',
            equacaoB: contB ? _collectEquacaoFromContainer(contB) : [{ tipo: 'fixo', valor: '' }],
            equipReqs: _collectMechEquipReqs(`mech_bool_equipReqs_${i}`),
            equacaoQtdMin: contQ ? _collectEquacaoFromContainer(contQ) : [],
            classesReq: _collectMechClasseReqs(`mech_bool_classeReqs_${i}`)
        };
    });
}

/** Re-renderiza a lista de verificações (após adicionar/remover), preservando os valores. */
function _rerenderBoolVerifs(verifs) {
    const list = document.getElementById('mech_bool_verif_list');
    if (!list) return;
    list.innerHTML = verifs.map((v, i) => _renderBoolVerifBlock(v, i, verifs.length)).join('');
    // Restaurar refs 'ficha' das equações após o re-render
    verifs.forEach((v, i) => {
        const ca = document.getElementById(`boolEquacaoA_${i}`); if (ca) _restoreEquacaoRefs(ca, v.equacaoA || []);
        const cb = document.getElementById(`boolEquacaoB_${i}`); if (cb) _restoreEquacaoRefs(cb, v.equacaoB || []);
        const cq = document.getElementById(`boolEquacaoQ_${i}`); if (cq) _restoreEquacaoRefs(cq, v.equacaoQtdMin || []);
    });
    const logicoWrap = document.getElementById('mech_bool_logico_wrap');
    if (logicoWrap) logicoWrap.style.display = verifs.length > 1 ? '' : 'none';
    window._mechUpdatePreview();
}

window._mechBoolAddVerif = function () {
    const verifs = _collectBoolVerificacoes();
    verifs.push({
        modoVerificacao: 'numerico',
        equacaoA: [{ tipo: 'fixo', valor: '' }],
        operadorComparacao: '>=',
        equacaoB: [{ tipo: 'fixo', valor: '' }],
        equipReqs: [],
        equacaoQtdMin: [{ tipo: 'fixo', valor: '1' }],
        classesReq: []
    });
    _rerenderBoolVerifs(verifs);
};

window._mechBoolRemoveVerif = function (i) {
    const verifs = _collectBoolVerificacoes();
    if (verifs.length <= 1) return;
    verifs.splice(i, 1);
    _rerenderBoolVerifs(verifs);
};

window._mechBoolModoChange = function (i) {
    i = i ?? 0;
    const modo = document.getElementById(`mech_config_modoVerificacao_${i}`)?.value || 'numerico';
    const numWrap = document.getElementById(`mech_bool_numerico_wrap_${i}`);
    const eqWrap = document.getElementById(`mech_bool_equip_wrap_${i}`);
    const clWrap = document.getElementById(`mech_bool_classe_wrap_${i}`);
    if (numWrap) numWrap.style.display = modo === 'numerico' ? '' : 'none';
    if (eqWrap) eqWrap.style.display = modo === 'equipamento' ? '' : 'none';
    if (clWrap) clWrap.style.display = modo === 'classe' ? '' : 'none';
    window._mechUpdatePreview();
};

// ===== RENDER A CHAINED CONDITION ROW (tipo condicional_encadeado) =====
function _renderEncCondRow(cond, index) {
    const c = cond || { comparacao: '<', valorA: '', valorB: '', resultado: '' };
    const comp = c.comparacao || '<';
    const isEntre = comp === 'entre';
    const mechIds = Array.isArray(c.efeitoMecanicaIds) ? c.efeitoMecanicaIds : [];
    return `
    <div class="enc-cond-item" data-cond-index="${index}">
        <div class="enc-cond-row">
            <span class="enc-cond-label">Se</span>
            <select class="enc-cond-comp" onchange="window._mechEncCompChange(${index}); window._mechUpdatePreview()">
                <option value="<" ${comp === '<' ? 'selected' : ''}>Menor que</option>
                <option value="<=" ${comp === '<=' ? 'selected' : ''}>Menor ou igual a</option>
                <option value="==" ${comp === '==' ? 'selected' : ''}>Igual a</option>
                <option value="!=" ${comp === '!=' ? 'selected' : ''}>Diferente de</option>
                <option value=">=" ${comp === '>=' ? 'selected' : ''}>Maior ou igual a</option>
                <option value=">" ${comp === '>' ? 'selected' : ''}>Maior que</option>
                <option value="entre" ${isEntre ? 'selected' : ''}>Entre (inclusivo)</option>
            </select>
            <input type="text" class="enc-cond-valorA" value="${esc(String(c.valorA ?? ''))}" placeholder="Valor" oninput="window._mechUpdatePreview()">
            <span class="enc-cond-e-sep" style="display:${isEntre ? '' : 'none'}">e</span>
            <input type="text" class="enc-cond-valorB" value="${esc(String(c.valorB ?? ''))}" placeholder="Valor" style="display:${isEntre ? '' : 'none'}" oninput="window._mechUpdatePreview()">
            <span class="enc-cond-label">=</span>
            <input type="text" class="enc-cond-resultado" value="${esc(String(c.resultado ?? ''))}" placeholder='Ex: "Fraco" ou 2' oninput="window._mechUpdatePreview()">
            <button type="button" class="eq-term-remove" onclick="window._mechEncRemoveCond(${index})" title="Remover condição">✕</button>
        </div>
        <div class="enc-cond-mechs">
            ${buildInlineMechSelector(`enc_cond_mech_${index}`, '⚙️ Acionar Mecânicas ao cumprir esta condição (opcional)', mechIds, window._mechCache || [], true)}
        </div>
    </div>`;
}

// ===== EQUIPMENT MODE — verificação por vínculo (individual/total) =====
function _mechEncEqAlvoOptions(reqs, selected) {
    const opts = [`<option value="total" ${String(selected) === 'total' ? 'selected' : ''}>Σ Total (todos somados)</option>`];
    (reqs || []).forEach((r, idx) => {
        opts.push(`<option value="${idx}" ${String(selected) === String(idx) ? 'selected' : ''}>#${idx + 1} ${esc(_mechReqLabel(r))}</option>`);
    });
    return opts.join('');
}

function _renderEncEqCheckRow(check, reqs) {
    const c = check || { alvo: 'total', comparacao: '>=', valorA: '', valorB: '' };
    const comp = c.comparacao || '>=';
    const isEntre = comp === 'entre';
    return `
    <div class="enc-eqcheck-row">
        <span class="enc-cond-label">Se</span>
        <select class="enc-eqcheck-alvo" onchange="window._mechUpdatePreview()">
            ${_mechEncEqAlvoOptions(reqs, c.alvo ?? 'total')}
        </select>
        <select class="enc-eqcheck-comp" onchange="window._mechEncEqCompChange(this); window._mechUpdatePreview()">
            <option value="<" ${comp === '<' ? 'selected' : ''}>Menor que</option>
            <option value="<=" ${comp === '<=' ? 'selected' : ''}>Menor ou igual a</option>
            <option value="==" ${comp === '==' ? 'selected' : ''}>Igual a</option>
            <option value="!=" ${comp === '!=' ? 'selected' : ''}>Diferente de</option>
            <option value=">=" ${comp === '>=' ? 'selected' : ''}>Maior ou igual a</option>
            <option value=">" ${comp === '>' ? 'selected' : ''}>Maior que</option>
            <option value="entre" ${isEntre ? 'selected' : ''}>Entre (inclusivo)</option>
        </select>
        <input type="text" class="enc-eqcheck-valorA" value="${esc(String(c.valorA ?? ''))}" placeholder="Qtd" oninput="window._mechUpdatePreview()">
        <span class="enc-eqcheck-sep" style="display:${isEntre ? '' : 'none'}">e</span>
        <input type="text" class="enc-eqcheck-valorB" value="${esc(String(c.valorB ?? ''))}" placeholder="Qtd" style="display:${isEntre ? '' : 'none'}" oninput="window._mechUpdatePreview()">
        <button type="button" class="eq-term-remove" onclick="window._mechEncEqRemoveCheck(this)" title="Remover verificação">✕</button>
    </div>`;
}

function _renderEncEqCondBlock(cond, index, reqs) {
    const c = cond || {};
    const checks = (Array.isArray(c.verificacoes) && c.verificacoes.length > 0)
        ? c.verificacoes : [{ alvo: 'total', comparacao: '>=', valorA: '', valorB: '' }];
    const mechIds = Array.isArray(c.efeitoMecanicaIds) ? c.efeitoMecanicaIds : [];
    const checksHtml = checks.map(ch => _renderEncEqCheckRow(ch, reqs)).join('');
    return `
    <div class="enc-eqcond-block" data-cond-index="${index}">
        <div class="enc-eqcond-head">
            <span class="enc-eqcond-title">⚡ Condição #${index + 1} <small>(todas as verificações devem passar)</small></span>
            <button type="button" class="eq-term-remove" onclick="window._mechEncEqRemoveCond(${index})" title="Remover condição">✕</button>
        </div>
        <div class="enc-eqcheck-list">${checksHtml}</div>
        <button type="button" class="eq-add-term-btn" onclick="window._mechEncEqAddCheck(this)">➕ Adicionar Verificação (E)</button>
        <div class="enc-eqcond-result-row">
            <span class="enc-cond-label">→ Resultado:</span>
            <input type="text" class="enc-eqcond-resultado" value="${esc(String(c.resultado ?? ''))}" placeholder='Ex: "Ativou modo Guerreiro Alimentado" ou 2' oninput="window._mechUpdatePreview()">
        </div>
        <div class="enc-cond-mechs">
            ${buildInlineMechSelector(`enc_eqcond_mech_${index}`, '⚙️ Acionar Mecânicas ao cumprir esta condição (opcional)', mechIds, window._mechCache || [], true)}
        </div>
    </div>`;
}

// ===== CLASS MODE — condição por classes do personagem (condicional_encadeado) =====
function _renderEncClasseCondBlock(cond, index) {
    const c = cond || {};
    const classesReq = Array.isArray(c.classesReq) ? c.classesReq : [];
    const mechIds = Array.isArray(c.efeitoMecanicaIds) ? c.efeitoMecanicaIds : [];
    return `
    <div class="enc-clcond-block enc-eqcond-block" data-cond-index="${index}">
        <div class="enc-eqcond-head">
            <span class="enc-eqcond-title">⚔️ Condição #${index + 1} <small>(o personagem precisa ter TODAS as classes marcadas)</small></span>
            <button type="button" class="eq-term-remove" onclick="window._mechEncClRemoveCond(${index})" title="Remover condição">✕</button>
        </div>
        <div class="enc-clcond-classes" style="margin-bottom:6px">
            <span class="enc-cond-label">Se o personagem tiver a(s) classe(s):</span>
            ${_renderMechClasseChecks(`enc_clcond_classes_${index}`, classesReq)}
        </div>
        <div class="enc-eqcond-result-row">
            <span class="enc-cond-label">→ Mensagem/Resultado:</span>
            <input type="text" class="enc-clcond-resultado" value="${esc(String(c.resultado ?? ''))}" placeholder='Ex: "Bônus de Guerreiro ativado" ou 2' oninput="window._mechUpdatePreview()">
        </div>
        <div class="enc-cond-mechs">
            ${buildInlineMechSelector(`enc_clcond_mech_${index}`, '⚙️ Acionar Mecânicas ao cumprir esta condição (opcional)', mechIds, window._mechCache || [], true)}
        </div>
    </div>`;
}

function renderConfigCondEncadeado(config) {
    const modo = ['equipamento', 'classe'].includes(config?.modoVerificacao) ? config.modoVerificacao : 'numerico';
    const equacaoValor = config?.equacaoValor || [{ tipo: 'ficha', ref: '' }];
    const condicoes = (Array.isArray(config?.condicoes) && config.condicoes.length > 0)
        ? config.condicoes
        : [{ comparacao: '<', valorA: '', valorB: '', resultado: '' }];
    const valorPadrao = config?.valorPadrao ?? '';
    const equipReqs = Array.isArray(config?.equipReqs) ? config.equipReqs : [];

    const termsV = equacaoValor.map((t, i) => _renderBoolEquationTerm(t, 'V', i)).join('');
    const condsHtml = condicoes.map((c, i) => _renderEncCondRow(c, i)).join('');
    const eqCondsHtml = condicoes.map((c, i) => _renderEncEqCondBlock(c, i, equipReqs)).join('');
    const clCondsHtml = condicoes.map((c, i) => _renderEncClasseCondBlock(c, i)).join('');
    const reqRows = equipReqs.map((r, i) => _renderMechEquipReqRow(r, i, true)).join('');

    return `
    <div class="form-group full-width">
        <label>Tipo de Lógica</label>
        <select id="mech_config_modoVerificacaoEnc" onchange="window._mechEncModoChange()">
            <option value="numerico" ${modo === 'numerico' ? 'selected' : ''}>🧮 Lógica Numérica (equação de valor)</option>
            <option value="equipamento" ${modo === 'equipamento' ? 'selected' : ''}>🎒 Verificação de Equipamento (inventário do personagem)</option>
            <option value="classe" ${modo === 'classe' ? 'selected' : ''}>⚔️ Verificação de Classe (classes do personagem)</option>
        </select>
    </div>
    <div class="bool-equation-wrap enc-wrap">
        <div id="mech_enc_numerico_wrap" style="display:${modo === 'numerico' ? '' : 'none'}">
        <div class="bool-equation-side">
            <div class="bool-equation-side-label">🧮 Equação de Valor</div>
            <div class="eq-terms-container" id="boolEquacaoV">
                ${termsV}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechBoolAddTerm('V')">➕ Adicionar Termo</button>
        </div>

        <div class="bool-equation-side">
            <div class="bool-equation-side-label">🔗 Condicionais (avaliadas em ordem — a primeira que casar define o resultado)</div>
            <div class="enc-cond-list" id="encCondList">
                ${condsHtml}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechEncAddCond()">➕ Adicionar Condição</button>
        </div>
        </div>

        <div id="mech_enc_equip_wrap" style="display:${modo === 'equipamento' ? '' : 'none'}">
        <div class="bool-equation-side">
            <div class="bool-equation-side-label">🎒 Equipamentos verificados no inventário</div>
            <div class="mech-equipreqs" id="mech_enc_equipReqs">${reqRows}</div>
            ${_renderMechEquipReqSelect('mech_enc_equipReqs')}
            <div class="cm-hint">Cada vínculo conta os itens equipados nas formas marcadas (nenhuma marcada = qualquer forma equipada). Nas condições abaixo, compare a quantidade de cada vínculo <b>individual</b> (#1, #2...) e/ou o <b>Σ Total somado</b>. Ex.: Se <b>#1 Espada == 1</b> E <b>#2 Tag "Comida" ≥ 5</b> → "Ativou modo Guerreiro Alimentado".</div>
        </div>
        <div class="bool-equation-side">
            <div class="bool-equation-side-label">🔗 Condicionais (avaliadas em ordem — a primeira que casar define o resultado)</div>
            <div class="enc-cond-list" id="encEquipCondList">
                ${eqCondsHtml}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechEncEqAddCond()">➕ Adicionar Condição</button>
        </div>
        </div>

        <div id="mech_enc_classe_wrap" style="display:${modo === 'classe' ? '' : 'none'}">
        <div class="bool-equation-side">
            <div class="bool-equation-side-label">⚔️ Classes verificadas</div>
            <div class="cm-hint">O lado esquerdo é preenchido <b>automaticamente</b> com as classes do personagem. Cada condição abaixo marca <b>uma ou mais classes</b>: se o personagem tiver todas as classes marcadas, a condição casa, exibe a mensagem e aciona as mecânicas vinculadas; se não, a próxima condição é verificada — até o Resultado Padrão.</div>
        </div>
        <div class="bool-equation-side">
            <div class="bool-equation-side-label">🔗 Condicionais (avaliadas em ordem — a primeira que casar define o resultado)</div>
            <div class="enc-cond-list" id="encClasseCondList">
                ${clCondsHtml}
            </div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechEncClAddCond()">➕ Adicionar Condição</button>
        </div>
        </div>

        <div class="bool-output-section" style="margin-top:0">
            <div class="bool-output-card">
                <label>🛟 Resultado Padrão (se nenhuma condição casar)</label>
                <input type="text" id="mech_config_valorPadrao" value="${esc(String(valorPadrao))}" placeholder="Ex: Indefinido" oninput="window._mechUpdatePreview()">
            </div>
        </div>
    </div>`;
}

window._mechEncModoChange = function () {
    const modo = document.getElementById('mech_config_modoVerificacaoEnc')?.value || 'numerico';
    const numWrap = document.getElementById('mech_enc_numerico_wrap');
    const eqWrap = document.getElementById('mech_enc_equip_wrap');
    const clWrap = document.getElementById('mech_enc_classe_wrap');
    if (numWrap) numWrap.style.display = modo === 'numerico' ? '' : 'none';
    if (eqWrap) eqWrap.style.display = modo === 'equipamento' ? '' : 'none';
    if (clWrap) clWrap.style.display = modo === 'classe' ? '' : 'none';
    window._mechUpdatePreview();
};

// ===== PROGRESSION / LEVEL TABLE =====

// Returns indices and labels of fixo terms across all calc rows for progression columns
function _getEquacaoFixoTerms(config) {
    const fixoTerms = [];
    
    // If config is provided, build from data (used during initial render before DOM is ready)
    if (config) {
        const calculos = Array.isArray(config.calculos) ? config.calculos : [];
        if (calculos.length === 0 && (config.alvo || config.equacao || config.valor !== undefined)) {
            calculos.push(config);
        }
        calculos.forEach((c, ci) => {
            const equacao = c.equacao || (typeof _migrateCalcToEquacao === 'function' ? _migrateCalcToEquacao(c) : []);
            equacao.forEach((t, ti) => {
                if (!t || t.tipo === 'fixo' || !t.tipo) {
                    const calcNum = calculos.length > 1 ? `C${ci + 1}.` : '';
                    fixoTerms.push({ calcIndex: ci, termIndex: ti, label: `${calcNum}Termo ${fixoTerms.length + 1}` });
                }
            });
        });
        if (fixoTerms.length > 0) return fixoTerms;
    }

    // Otherwise build from DOM
    const list = document.getElementById('mechCalcList');
    if (!list) return [];
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
    if (tipo === 'condicional') return ['Nível', expLabel, 'Texto Sucesso', 'Texto Falha'];
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
    } else if (tipo === 'condicional') {
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-textoSucesso" data-nivel="${i}" value="${esc(String(p.textoSucesso ?? ''))}" placeholder="Texto de Sucesso" style="width:100%" oninput="window._mechUpdatePreview()"></td><td><input type="text" class="prog-textoFalha" data-nivel="${i}" value="${esc(String(p.textoFalha ?? ''))}" placeholder="Texto de Falha (opcional)" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
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
    const config = data?.config || {};

    // fixoTerms will be built from config if provided (initial load) or DOM (refresh)
    const fixoTerms = _getEquacaoFixoTerms(config);
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
    window._mechPoolResumo();
};

/** Filtra visualmente as opções do Pool Personalizado (não altera seleção). */
window._mechPoolFiltrar = function (termo) {
    const box = document.getElementById('mech_config_poolPersonalizado');
    if (!box) return;
    const q = String(termo || '').trim().toLowerCase();
    box.querySelectorAll('.mech-pool-opt').forEach(lab => {
        const hay = lab.dataset.search || lab.textContent.toLowerCase();
        lab.style.display = (!q || hay.includes(q)) ? '' : 'none';
    });
};

/**
 * Marca/desmarca em lote as opções VISÍVEIS do Pool Personalizado.
 * escopo: 'runic' (só Elementos Rúnicos) | 'all' (tudo).
 */
window._mechPoolMarcar = function (escopo, valor) {
    const box = document.getElementById('mech_config_poolPersonalizado');
    if (!box) return;
    box.querySelectorAll('.mech-pool-opt').forEach(lab => {
        if (lab.style.display === 'none') return;
        const cb = lab.querySelector('input[type="checkbox"]');
        if (!cb) return;
        if (escopo === 'runic' && cb.dataset.runic !== '1') return;
        cb.checked = !!valor;
    });
    window._mechUpdatePreview();
};

/** Mostra o total de alvos marcados (e quantos são rúnicos). */
window._mechPoolResumo = function () {
    const box = document.getElementById('mech_config_poolPersonalizado');
    const out = document.getElementById('mech_config_poolResumo');
    if (!box || !out) return;
    const marcados = Array.from(box.querySelectorAll('input[type="checkbox"]:checked'));
    const runicos = marcados.filter(cb => cb.dataset.runic === '1').length;
    out.textContent = marcados.length
        ? `✅ ${marcados.length} alvo(s) no pool${runicos ? ` — ${runicos} Elemento(s) Rúnico(s)` : ''}.`
        : '⚠️ Nenhum alvo selecionado — o pool ficará vazio na ficha.';
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
export function openMechanicEditor(itemId, allItems, mechanicsCache, callbacks, initialTags, parentFieldKey = null, clonedData = null) {
    const { db, collection: col, addDoc, updateDoc, doc, Timestamp, currentUser, showAlert, loadModule, escapeHtml } = callbacks;
    const isEditing = !!itemId;
    // When opened from another module, allItems contains the other module's items.
    // So we must also check mechanicsCache to find the mechanic data.
    const existingData = isEditing ? (mechanicsCache.find(i => i.id === itemId) || allItems.find(i => i.id === itemId)) : {};
    const data = clonedData || existingData || {};

    // Store parent field key globally for when we save/back
    window._mechParentFieldKey = parentFieldKey;
    window._mechEditingId = itemId || null;
    window._mechClonedData = clonedData || null;

    // Hide standard content, show editor
    document.getElementById('moduleContent').style.display = 'none';
    const formModal = document.getElementById('formModal');
    if (formModal && parentFieldKey) {
        formModal.style.display = 'none';
    }

    // Esconde também sub-modais abertos (Peculiaridade / Valor Derivado):
    // sem isso, eles ficavam sobre o editor inline, cobrindo-o e bloqueando cliques.
    window._mechHiddenOverlays = [];
    ['subFormModalPeculiaridade', 'subFormModalValorDerivado'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') {
            el.style.display = 'none';
            window._mechHiddenOverlays.push(id);
        }
    });
    
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
                        <option value="booleano" ${tipo === 'booleano' ? 'selected' : ''}>🔀 Booleano (equação comparativa)</option>
                        <option value="condicional_encadeado" ${tipo === 'condicional_encadeado' ? 'selected' : ''}>🔗 Condicional (condições encadeadas)</option>
                    </select>
                </div>
                <div class="mech-config-area" id="mechConfigArea"></div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">🎯 Onde se Aplica</div>
                <div class="form-grid">
                    <div class="form-group full-width">
                        <label>Escopo de Aplicação</label>
                        <select id="mech_escopoAplicacao" onchange="window._mechEscopoAplicacaoChange()">
                            <option value="personagem" ${(data.escopoAplicacao || 'personagem') === 'personagem' ? 'selected' : ''}>👤 No personagem (padrão)</option>
                            <option value="itens" ${data.escopoAplicacao === 'itens' ? 'selected' : ''}>🎒 Nos itens equipados (por item)</option>
                        </select>
                        <div class="cm-hint">Só faz diferença em alvos que sejam Valores Derivados marcados com <b>Escopo por Item Equipado</b>. Ex.: "todo item com tag Adaga recebe +1 de Dano". Para efeitos globais <i>destravados</i> por ter um item equipado, use uma mecânica <b>Booleana</b> com Verificação de Equipamento.</div>
                    </div>
                    <div class="form-group full-width" id="mech_itemFiltroWrap" style="display:${data.escopoAplicacao === 'itens' ? '' : 'none'}">
                        <label>Filtrar itens afetados <small style="color:var(--muted)">(vazio = todos os itens com Efeitos Ativos)</small></label>
                        <div class="mech-equipreqs" id="mech_itemFiltro">
                            ${(Array.isArray(data.itemFiltro) ? data.itemFiltro : []).map((r, i) => _renderMechEquipReqRow(r, i, false)).join('')}
                        </div>
                        ${_renderMechEquipReqSelect('mech_itemFiltro')}
                    </div>
                </div>
            </div>

            <div class="mech-form-section">
                <div class="mech-section-label">🕐 Quando se Aplica</div>
                <div class="form-grid">
                    <div id="mech_duracao_standard_wrap">
                        <div class="form-group"><label>Duração</label>
                            <select id="mech_duracao" onchange="window._mechDuracaoChange(); window._mechUpdatePreview()">
                                <option value="permanente" ${(data.duracao || 'permanente') === 'permanente' ? 'selected' : ''}>Permanente</option>
                                <option value="instantanea" ${data.duracao === 'instantanea' ? 'selected' : ''}>Instantânea</option>
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

    // Restaura sub-modais que foram escondidos ao abrir o editor,
    // trazendo-os de volta ao topo da pilha de camadas.
    if (Array.isArray(window._mechHiddenOverlays)) {
        window._mechHiddenOverlays.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = '';
                if (window.bringModalToTop) window.bringModalToTop(el);
            }
        });
        window._mechHiddenOverlays = [];
    }
    
    // Always restore moduleContent because formModal is just an overlay on top of it.
    document.getElementById('moduleContent').style.display = '';
};

window._mechTipoChange = function () {
    const tipo = document.getElementById('mech_tipo')?.value || 'modificar';
    const area = document.getElementById('mechConfigArea');
    const cacheData = window._mechCache?.find(i => i.id === window._mechEditingId);
    const allData = window._mechAllItems?.find(i => i.id === window._mechEditingId);
    const data = window._mechClonedData || cacheData || allData;
    const config = (data && data.tipo === tipo) ? (data.config || {}) : {};

    if (tipo === 'modificar') area.innerHTML = renderConfigModificar(config);
    else if (tipo === 'limitar') area.innerHTML = renderConfigLimitar(config);
    else if (tipo === 'conceder') area.innerHTML = renderConfigConceder(config);
    else if (tipo === 'condicional') area.innerHTML = renderConfigCondicional(config, window._mechCache || []);
    else if (tipo === 'narrativo') area.innerHTML = renderConfigNarrativo(config);
    else if (tipo === 'distribuir') area.innerHTML = renderConfigDistribuir(config);
    else if (tipo === 'booleano') area.innerHTML = renderConfigBooleano(config);
    else if (tipo === 'condicional_encadeado') area.innerHTML = renderConfigCondEncadeado(config);

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
                if (alvoSel && c.alvo) window._setSelectValueWithFallback(alvoSel, c.alvo);

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
                        if (refSel) window._setSelectValueWithFallback(refSel, t.ref);
                    }
                });
            });
            // Sync Duração section for EXP after calc rows are restored
            window._mechSyncDuracaoForExp();
            // Refresh progression after equacao is set in DOM
            window._mechRefreshProgressao(tipo);
        }, 0);
    }

    // Restore booleano equation ficha refs after DOM is ready (todas as verificações)
    if (tipo === 'booleano') {
        setTimeout(() => {
            const verifs = _boolVerifsFromConfig(config);
            verifs.forEach((v, i) => {
                const ca = document.getElementById('boolEquacaoA_' + i); if (ca) _restoreEquacaoRefs(ca, v.equacaoA || []);
                const cb = document.getElementById('boolEquacaoB_' + i); if (cb) _restoreEquacaoRefs(cb, v.equacaoB || []);
                const cq = document.getElementById('boolEquacaoQ_' + i); if (cq) _restoreEquacaoRefs(cq, v.equacaoQtdMin || []);
            });
        }, 0);
    }

    // Restore condicional_encadeado equation ficha refs after DOM is ready
    if (tipo === 'condicional_encadeado') {
        setTimeout(() => {
            const container = document.getElementById('boolEquacaoV');
            if (container) _restoreEquacaoRefs(container, config?.equacaoValor || []);
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
    const sortWrap = term.querySelector('.eq-term-sort-wrap');
    if (fixoWrap) fixoWrap.style.display = tipo === 'fixo' ? '' : 'none';
    if (fichaWrap) fichaWrap.style.display = tipo === 'ficha' ? '' : 'none';
    if (sortWrap) sortWrap.style.display = tipo === 'sort' ? '' : 'none';
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
    const eqContainer = document.getElementById('mech_equipConcessao_container');
    if (eqContainer) {
        eqContainer.style.display = tc === 'conceder_equipamento' ? 'block' : 'none';
    }
    const restrContainer = document.getElementById('mech_equipRestricao_container');
    if (restrContainer) {
        restrContainer.style.display = _MECH_TC_RESTRICAO.includes(tc) ? 'block' : 'none';
    }
};

// ===== BOOLEAN EQUATION HANDLERS =====
window._mechBoolTermTipoChange = function (side, termIndex) {
    const container = document.getElementById('boolEquacao' + side);
    if (!container) return;
    const term = container.querySelectorAll('.eq-term')[termIndex];
    if (!term) return;
    const tipo = term.querySelector('.eq-term-tipo')?.value || 'fixo';
    const fixoWrap = term.querySelector('.eq-term-fixo-wrap');
    const fichaWrap = term.querySelector('.eq-term-ficha-wrap');
    const sortWrap = term.querySelector('.eq-term-sort-wrap');
    if (fixoWrap) fixoWrap.style.display = tipo === 'fixo' ? '' : 'none';
    if (fichaWrap) fichaWrap.style.display = tipo === 'ficha' ? '' : 'none';
    if (sortWrap) sortWrap.style.display = tipo === 'sort' ? '' : 'none';
};

window._mechBoolAddTerm = function (side) {
    const container = document.getElementById('boolEquacao' + side);
    if (!container) return;
    const termIndex = container.querySelectorAll('.eq-term').length;
    const html = _renderBoolEquationTerm({ op: '+', tipo: 'fixo', valor: '' }, side, termIndex);
    container.insertAdjacentHTML('beforeend', html);
    window._mechUpdatePreview();
};

window._mechBoolRemoveTerm = function (side, termIndex) {
    const container = document.getElementById('boolEquacao' + side);
    if (!container) return;
    const terms = container.querySelectorAll('.eq-term');
    if (terms.length <= 1) return;
    if (terms[termIndex]) terms[termIndex].remove();
    // Re-render to fix onclick indices
    const currentEquacao = _collectEquacaoFromContainer(container);
    container.innerHTML = currentEquacao.map((t, ti) => _renderBoolEquationTerm(t, side, ti)).join('');
    // Restore ficha ref values after re-render
    _restoreEquacaoRefs(container, currentEquacao);
    window._mechUpdatePreview();
};

// ===== CHAINED CONDITION HANDLERS (tipo condicional_encadeado) =====
function _collectEncCondFromList() {
    const list = document.getElementById('encCondList');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.enc-cond-item')).map(item => {
        const row = item.querySelector('.enc-cond-row') || item;
        const comparacao = row.querySelector('.enc-cond-comp')?.value || '<';
        const rawA = row.querySelector('.enc-cond-valorA')?.value?.trim() ?? '';
        const rawB = row.querySelector('.enc-cond-valorB')?.value?.trim() ?? '';
        const rawR = row.querySelector('.enc-cond-resultado')?.value?.trim() ?? '';
        let efeitoMecanicaIds = [];
        try {
            const hidden = item.querySelector('.enc-cond-mechs input[type="hidden"]');
            if (hidden) efeitoMecanicaIds = JSON.parse(hidden.value || '[]');
        } catch (e) { efeitoMecanicaIds = []; }
        return {
            comparacao,
            valorA: isNaN(Number(rawA)) || rawA === '' ? rawA : Number(rawA),
            valorB: comparacao === 'entre' ? (isNaN(Number(rawB)) || rawB === '' ? rawB : Number(rawB)) : '',
            resultado: isNaN(Number(rawR)) || rawR === '' ? rawR : Number(rawR),
            efeitoMecanicaIds
        };
    });
}

window._mechEncCompChange = function (index) {
    const list = document.getElementById('encCondList');
    if (!list) return;
    const item = list.querySelectorAll('.enc-cond-item')[index];
    if (!item) return;
    const isEntre = (item.querySelector('.enc-cond-comp')?.value || '<') === 'entre';
    const sep = item.querySelector('.enc-cond-e-sep');
    const valB = item.querySelector('.enc-cond-valorB');
    if (sep) sep.style.display = isEntre ? '' : 'none';
    if (valB) valB.style.display = isEntre ? '' : 'none';
};

window._mechEncAddCond = function () {
    const list = document.getElementById('encCondList');
    if (!list) return;
    const index = list.querySelectorAll('.enc-cond-item').length;
    list.insertAdjacentHTML('beforeend', _renderEncCondRow({ comparacao: '<', valorA: '', valorB: '', resultado: '', efeitoMecanicaIds: [] }, index));
    window._mechUpdatePreview();
};

window._mechEncRemoveCond = function (index) {
    const list = document.getElementById('encCondList');
    if (!list) return;
    const items = list.querySelectorAll('.enc-cond-item');
    if (items.length <= 1) return;
    if (items[index]) items[index].remove();
    // Re-render to fix onclick indices
    const current = _collectEncCondFromList();
    list.innerHTML = current.map((c, i) => _renderEncCondRow(c, i)).join('');
    window._mechUpdatePreview();
};

// ===== EQUIPMENT-MODE CONDITION HANDLERS (tipo condicional_encadeado) =====
function _collectEncEquipCondFromList() {
    const list = document.getElementById('encEquipCondList');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.enc-eqcond-block')).map(block => {
        const verificacoes = Array.from(block.querySelectorAll('.enc-eqcheck-row')).map(row => {
            const comparacao = row.querySelector('.enc-eqcheck-comp')?.value || '>=';
            const rawA = row.querySelector('.enc-eqcheck-valorA')?.value?.trim() ?? '';
            const rawB = row.querySelector('.enc-eqcheck-valorB')?.value?.trim() ?? '';
            const alvoRaw = row.querySelector('.enc-eqcheck-alvo')?.value ?? 'total';
            return {
                alvo: alvoRaw === 'total' ? 'total' : (parseInt(alvoRaw, 10) || 0),
                comparacao,
                valorA: isNaN(Number(rawA)) || rawA === '' ? rawA : Number(rawA),
                valorB: comparacao === 'entre' ? (isNaN(Number(rawB)) || rawB === '' ? rawB : Number(rawB)) : ''
            };
        });
        const rawR = block.querySelector('.enc-eqcond-resultado')?.value?.trim() ?? '';
        let efeitoMecanicaIds = [];
        try {
            const hidden = block.querySelector('.enc-cond-mechs input[type="hidden"]');
            if (hidden) efeitoMecanicaIds = JSON.parse(hidden.value || '[]');
        } catch (e) { efeitoMecanicaIds = []; }
        return {
            verificacoes,
            resultado: isNaN(Number(rawR)) || rawR === '' ? rawR : Number(rawR),
            efeitoMecanicaIds
        };
    });
}

function _mechEncEqRerenderConds(conds) {
    const list = document.getElementById('encEquipCondList');
    if (!list) return;
    const reqs = _collectMechEquipReqs('mech_enc_equipReqs');
    const safe = (Array.isArray(conds) && conds.length > 0)
        ? conds : [{ verificacoes: [{ alvo: 'total', comparacao: '>=', valorA: '', valorB: '' }], resultado: '', efeitoMecanicaIds: [] }];
    list.innerHTML = safe.map((c, i) => _renderEncEqCondBlock(c, i, reqs)).join('');
}

/** Após adicionar/remover um vínculo: renumera as linhas e atualiza os selects de alvo das verificações. */
window._mechEncEqSyncAfterReqChange = function () {
    const conds = _collectEncEquipCondFromList();
    const reqs = _collectMechEquipReqs('mech_enc_equipReqs');
    // Sanitizar alvos que apontam para vínculos removidos
    conds.forEach(c => {
        c.verificacoes = (c.verificacoes || []).filter(v => v.alvo === 'total' || (typeof v.alvo === 'number' && v.alvo < reqs.length));
        if (c.verificacoes.length === 0) c.verificacoes = [{ alvo: 'total', comparacao: '>=', valorA: '', valorB: '' }];
    });
    // Renumerar as linhas de vínculo (badges #N)
    const reqList = document.getElementById('mech_enc_equipReqs');
    if (reqList) reqList.innerHTML = reqs.map((r, i) => _renderMechEquipReqRow(r, i, true)).join('');
    _mechEncEqRerenderConds(conds);
};

window._mechEncEqCompChange = function (compSel) {
    const row = compSel.closest('.enc-eqcheck-row');
    if (!row) return;
    const isEntre = compSel.value === 'entre';
    const sep = row.querySelector('.enc-eqcheck-sep');
    const valB = row.querySelector('.enc-eqcheck-valorB');
    if (sep) sep.style.display = isEntre ? '' : 'none';
    if (valB) valB.style.display = isEntre ? '' : 'none';
};

window._mechEncEqAddCheck = function (btn) {
    const block = btn.closest('.enc-eqcond-block');
    const list = block?.querySelector('.enc-eqcheck-list');
    if (!list) return;
    const reqs = _collectMechEquipReqs('mech_enc_equipReqs');
    list.insertAdjacentHTML('beforeend', _renderEncEqCheckRow({ alvo: 'total', comparacao: '>=', valorA: '', valorB: '' }, reqs));
    window._mechUpdatePreview();
};

window._mechEncEqRemoveCheck = function (btn) {
    const row = btn.closest('.enc-eqcheck-row');
    const list = row?.parentElement;
    if (!row || !list) return;
    if (list.querySelectorAll('.enc-eqcheck-row').length <= 1) return;
    row.remove();
    window._mechUpdatePreview();
};

window._mechEncEqAddCond = function () {
    const conds = _collectEncEquipCondFromList();
    conds.push({ verificacoes: [{ alvo: 'total', comparacao: '>=', valorA: '', valorB: '' }], resultado: '', efeitoMecanicaIds: [] });
    _mechEncEqRerenderConds(conds);
    window._mechUpdatePreview();
};

window._mechEncEqRemoveCond = function (index) {
    const conds = _collectEncEquipCondFromList();
    if (conds.length <= 1) return;
    conds.splice(index, 1);
    _mechEncEqRerenderConds(conds);
    window._mechUpdatePreview();
};

// ===== CLASS-MODE CONDITION HANDLERS (tipo condicional_encadeado) =====
function _collectEncClasseCondFromList() {
    const list = document.getElementById('encClasseCondList');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.enc-clcond-block')).map(block => {
        const classesReq = [...block.querySelectorAll('.mech-classe-checks input[type="checkbox"]:checked')].map(c => c.value);
        const rawR = block.querySelector('.enc-clcond-resultado')?.value?.trim() ?? '';
        let efeitoMecanicaIds = [];
        try {
            const hidden = block.querySelector('.enc-cond-mechs input[type="hidden"]');
            if (hidden) efeitoMecanicaIds = JSON.parse(hidden.value || '[]');
        } catch (e) { efeitoMecanicaIds = []; }
        return {
            classesReq,
            resultado: isNaN(Number(rawR)) || rawR === '' ? rawR : Number(rawR),
            efeitoMecanicaIds
        };
    });
}

function _mechEncClRerenderConds(conds) {
    const list = document.getElementById('encClasseCondList');
    if (!list) return;
    const safe = (Array.isArray(conds) && conds.length > 0)
        ? conds : [{ classesReq: [], resultado: '', efeitoMecanicaIds: [] }];
    list.innerHTML = safe.map((c, i) => _renderEncClasseCondBlock(c, i)).join('');
}

window._mechEncClAddCond = function () {
    const conds = _collectEncClasseCondFromList();
    conds.push({ classesReq: [], resultado: '', efeitoMecanicaIds: [] });
    _mechEncClRerenderConds(conds);
    window._mechUpdatePreview();
};

window._mechEncClRemoveCond = function (index) {
    const conds = _collectEncClasseCondFromList();
    if (conds.length <= 1) return;
    conds.splice(index, 1);
    _mechEncClRerenderConds(conds);
    window._mechUpdatePreview();
};

// ===== CONDIÇÃO MECÂNICA TOGGLE HANDLER =====
window._mechCondicaoMecanicaToggle = function () {
    const checked = document.getElementById('mech_condicaoMecanica')?.checked || false;
    const gatilhoWrap = document.getElementById('mech_gatilho_wrap');
    const selectorWrap = document.getElementById('mech_condicaoMecanicaSelector_wrap');
    if (gatilhoWrap) gatilhoWrap.style.display = checked ? 'none' : '';
    if (selectorWrap) selectorWrap.style.display = checked ? '' : 'none';
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
        } else if (tipo === 'sort') {
            const rawMin = term.querySelector('.eq-term-sort-min')?.value?.trim() ?? '';
            const rawMax = term.querySelector('.eq-term-sort-max')?.value?.trim() ?? '';
            entry.min = isNaN(Number(rawMin)) || rawMin === '' ? rawMin : Number(rawMin);
            entry.max = isNaN(Number(rawMax)) || rawMax === '' ? rawMax : Number(rawMax);
        } else {
            const rawVal = term.querySelector('.eq-term-valor')?.value?.trim() ?? '';
            entry.valor = isNaN(Number(rawVal)) || rawVal === '' ? rawVal : Number(rawVal);
        }
        return entry;
    });
}

window._setSelectValueWithFallback = function(selectEl, value) {
    if (!selectEl) return;
    if (Array.from(selectEl.options).some(o => o.value === value)) {
        selectEl.value = value;
    } else if (Array.from(selectEl.options).some(o => o.value === 'Perícia: ' + value)) {
        selectEl.value = 'Perícia: ' + value;
    } else {
        selectEl.value = value;
    }
};

function _restoreEquacaoRefs(container, equacao) {
    const terms = container.querySelectorAll('.eq-term');
    terms.forEach((term, i) => {
        const t = equacao[i];
        if (!t) return;
        if (t.tipo === 'ficha') {
            const refSel = term.querySelector('.eq-term-ref');
            if (refSel && t.ref) window._setSelectValueWithFallback(refSel, t.ref);
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

window._mechEscopoAplicacaoChange = function () {
    const wrap = document.getElementById('mech_itemFiltroWrap');
    if (wrap) wrap.style.display = document.getElementById('mech_escopoAplicacao')?.value === 'itens' ? '' : 'none';
    window._mechUpdatePreview();
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

    // Resumo do Pool Personalizado (Distribuir)
    if (typeof window._mechPoolResumo === 'function') window._mechPoolResumo();
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
        // 'personagem' (padrão) | 'itens' — ver _meItensDoFiltro no mechanics-engine
        escopoAplicacao: document.getElementById('mech_escopoAplicacao')?.value || 'personagem',
        itemFiltro: document.getElementById('mech_escopoAplicacao')?.value === 'itens'
            ? _collectMechEquipReqs('mech_itemFiltro') : [],
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
        let equipamentosConcedidos = undefined;
        if (tc === 'conceder_equipamento') {
            equipamentosConcedidos = [];
            document.querySelectorAll('#mech_equipConc_list .mech-equip-conc-row').forEach(row => {
                const eqId = row.dataset.eqId;
                if (!eqId) return;
                const qtd = Math.max(1, parseInt(row.querySelector('.eq-conc-qtd')?.value, 10) || 1);
                equipamentosConcedidos.push({ id: eqId, quantidade: qtd });
            });
        }
        data.config = {
            tipoConcessao: tc,
            descricaoConcessao: document.getElementById('mech_config_descricaoConcessao')?.value || '',
            ...(partesCorpo !== undefined ? { partesCorpo } : {}),
            ...(equipamentosConcedidos !== undefined ? { equipamentosConcedidos } : {}),
            ...(_MECH_TC_RESTRICAO.includes(tc) ? { equipReqs: _collectMechEquipReqs('mech_restricaoEquipReqs') } : {})
        };
    } else if (tipo === 'condicional') {
        const condicaoMecanica = document.getElementById('mech_condicaoMecanica')?.checked || false;
        data.config = {
            condicaoMecanica,
            gatilho: condicaoMecanica ? '' : (document.getElementById('mech_config_gatilho')?.value || ''),
            condicaoMecanicaIds: condicaoMecanica ? JSON.parse(document.getElementById('mech_config_condicaoMecanicaIds')?.value || '[]') : [],
            textoSucesso: document.getElementById('mech_config_textoSucesso')?.value || '',
            textoFalha: document.getElementById('mech_config_textoFalha')?.value || '',
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
    } else if (tipo === 'booleano') {
        const rawTrue = document.getElementById('mech_config_valorVerdadeiro')?.value?.trim() ?? '';
        const rawFalse = document.getElementById('mech_config_valorFalso')?.value?.trim() ?? '';
        const verificacoes = _collectBoolVerificacoes();
        const v0 = verificacoes[0] || {
            modoVerificacao: 'numerico',
            equacaoA: [{ tipo: 'fixo', valor: '' }], operadorComparacao: '>=',
            equacaoB: [{ tipo: 'fixo', valor: '' }], equipReqs: [], equacaoQtdMin: [], classesReq: []
        };
        data.config = {
            verificacoes,
            operadorLogico: document.getElementById('mech_config_operadorLogico')?.value === 'ou' ? 'ou' : 'e',
            // Espelho da verificação #1 nos campos legados (compatibilidade com
            // leitores antigos: simulador de criação, dados já publicados etc.)
            modoVerificacao: v0.modoVerificacao,
            equacaoA: v0.equacaoA,
            operadorComparacao: v0.operadorComparacao,
            equacaoB: v0.equacaoB,
            equipReqs: v0.equipReqs,
            equacaoQtdMin: v0.equacaoQtdMin,
            classesReq: Array.isArray(v0.classesReq) ? v0.classesReq : [],
            valorVerdadeiro: isNaN(Number(rawTrue)) || rawTrue === '' ? rawTrue : Number(rawTrue),
            valorFalso: isNaN(Number(rawFalse)) || rawFalse === '' ? rawFalse : Number(rawFalse),
            efeitoTrueIds: JSON.parse(document.getElementById('mech_config_efeitoTrueIds')?.value || '[]'),
            efeitoFalseIds: JSON.parse(document.getElementById('mech_config_efeitoFalseIds')?.value || '[]')
        };
    } else if (tipo === 'condicional_encadeado') {
        const containerV = document.getElementById('boolEquacaoV');
        const rawPadrao = document.getElementById('mech_config_valorPadrao')?.value?.trim() ?? '';
        const modoRawEnc = document.getElementById('mech_config_modoVerificacaoEnc')?.value;
        const modoVerificacao = ['equipamento', 'classe'].includes(modoRawEnc) ? modoRawEnc : 'numerico';
        data.config = {
            modoVerificacao,
            equacaoValor: containerV ? _collectEquacaoFromContainer(containerV) : [{ tipo: 'fixo', valor: '' }],
            equipReqs: _collectMechEquipReqs('mech_enc_equipReqs'),
            condicoes: modoVerificacao === 'equipamento' ? _collectEncEquipCondFromList()
                : modoVerificacao === 'classe' ? _collectEncClasseCondFromList()
                : _collectEncCondFromList(),
            valorPadrao: isNaN(Number(rawPadrao)) || rawPadrao === '' ? rawPadrao : Number(rawPadrao)
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
                } else if (tipo === 'condicional') {
                    entry.textoSucesso = row.querySelector('.prog-textoSucesso')?.value?.trim() ?? '';
                    entry.textoFalha = row.querySelector('.prog-textoFalha')?.value?.trim() ?? '';
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
    const reg0 = window._eqSelCache?.[fieldId] || {};
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
    const cache = window._peculiaritiesCache || window._mechCache || []; 
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma peculiaridade vinculada</span>';
        } else {
            chipsEl.innerHTML = checked.map(pObj => {
                const mid = pObj.id;
                const p = cache.find(x => x.id === mid) || { nome: "Carregando...", fonte: "?" };
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

        
        return `<div class="mechsel-chip" style="border-left-color:var(--lr-abyssal); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window._openSubFormValorDerivado('${did}', '${fieldKey}')" title="Editar Valor Derivado"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? '🌐 Universal' : '🔗 Vinculado'} — Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('field_${fieldKey}', '${did}', 'valorInicial', this.value)">${ruleInputs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${did}')">✕</button></div>`;
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
    const reg0 = window._eqSelCache?.[fieldId] || {};
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

                
                return `<div class="mechsel-chip" style="border-left-color:var(--lr-abyssal); cursor:pointer;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') window._openSubFormValorDerivado('${did}', '${fieldId.replace('field_', '')}')" title="Editar Valor Derivado"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${d.todoPersonagem ? '🌐 Universal' : '🔗 Vinculado'} — Valor Inicial: <input type="text" inputmode="decimal" value="${dvObj.valorInicial || 0}" style="width:50px;padding:2px;font-size:0.7rem;" onchange="window._dvSelLevelChange('${fieldId}', '${did}', 'valorInicial', this.value)">${ruleInputs}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${did}')">✕</button></div>`;
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

// ===== EQUIPMENT DERIVED VALUE SELECTOR (for equipment modifiers) =====
/**
 * Status Vitais como opções de seletor: cada vital vira dois alvos, Máxima e Atual.
 * A distinção importa — Máxima é bônus enquanto equipado, Atual é efeito de uso
 * único (botão "Usar" na ficha). Ver aplicarStatusVitaisDeItem em inventory.js.
 */
export function vitalStatusOptions(vitalStatsCache) {
    const out = [];
    for (const v of (vitalStatsCache || []).filter(s => s.publicado !== false)) {
        const base = String(v.chaveInterna || '').replace(/_MAX$/, '');
        if (!base) continue;
        const icon = v.icone || '❤️';
        out.push({ id: `${base}_MAX`, nome: `${v.nome} Máxima`, icone: icon });
        out.push({ id: `${base}_ATUAL`, nome: `${v.nome} Atual`, icone: icon });
    }
    return out;
}

/**
 * Atributos como opções de seletor. O id JÁ é a chave usada nos dots da ficha
 * (state.mechanicBonuses['attr_des']), então não precisa de resolução depois.
 */
export const ATRIBUTOS_VINCULAVEIS = [
    { id: 'attr_for', nome: 'FOR — Força', icone: '💪' },
    { id: 'attr_des', nome: 'DES — Destreza', icone: '🤸' },
    { id: 'attr_vig', nome: 'VIG — Vigor', icone: '🫀' },
    { id: 'attr_int', nome: 'INT — Inteligência', icone: '📚' },
    { id: 'attr_rac', nome: 'RAC — Raciocínio', icone: '🧩' },
    { id: 'attr_prs', nome: 'PRS — Perseverança', icone: '🪨' },
    { id: 'attr_pre', nome: 'PRE — Presença', icone: '✨' },
    { id: 'attr_man', nome: 'MAN — Manipulação', icone: '🎭' },
    { id: 'attr_aut', nome: 'AUT — Autocontrole', icone: '🧘' },
];

/**
 * Perícias como opções de seletor. Guarda o ID do Firestore (não a chave), para
 * que renomear a perícia no painel não desfaça o vínculo — a ficha resolve
 * id → sk_<categoria>_<key> na hora de aplicar.
 */
export function periciaOptions(skillsCache) {
    const ICONE = { mental: '🧠', fisico: '💪', social: '💬', combate: '⚔️', exclusivo: '⭐' };
    return (skillsCache || []).map(s => ({
        id: s.id,
        nome: s.nome,
        icone: ICONE[String(s.categoria || '').toLowerCase()] || '🎯',
        publicado: s.publicado,
    }));
}

/**
 * Chip de um vínculo com modificador. Usado na montagem inicial e no redesenho
 * do confirm — estava duplicado nos dois, e o ON/OFF de escopo seria a terceira
 * cópia a divergir.
 *
 * O ON/OFF só aparece em Valor Derivado com `escopoItem` (hoje só Acerto e
 * Dano). Os outros 78 já são globais, e o botão ali seria um controle morto.
 */
function _eqDvChip(fieldId, dvObj, d) {
    const reg = window._eqSelCache?.[fieldId] || {};
    const campo = reg.campo || 'modificador';
    const rotulo = reg.rotulo || 'Modificador';
    const icon = d.icone || '📊';
    const mod = dvObj[campo] || 0;
    const escopoOn = dvObj.escopo === 'global';
    const toggle = d.escopoItem
        ? `<label style="margin-left:8px;font-size:.7rem;cursor:pointer" title="OFF: aplica no ${esc(d.nome)} deste item. ON: aplica no ${esc(d.nome)} do personagem.">
             <input type="checkbox" ${escopoOn ? 'checked' : ''} onchange="window._eqDvSelEscopoChange('${fieldId}','${d.id}',this.checked)"> global
           </label>`
        : '';
    const passo = campo === 'quantidade' ? '1" min="1' : '0.01';
    if (reg.comEquacao) {
        // A Equação de Valor SUBSTITUI o Modificador (sem input numérico).
        // Vínculo legado só com modificador aparece migrado: a equação abre
        // pré-preenchida com ele como termo fixo. Reusa o builder de termos
        // das mecânicas: side único ⇒ container id "boolEquacao<side>", que é
        // o que os handlers _mechBool* esperam. O wrapper sincroniza qualquer
        // edição (input/change/click borbulham) via _eqDvEqSync.
        const side = `_DV_${fieldId}_${d.id}`;
        let eq = Array.isArray(dvObj.equacao) ? dvObj.equacao : [];
        if (!eq.length && Number(mod)) eq = [{ tipo: 'fixo', valor: Number(mod) }];
        const terms = eq.map((t, ti) => _renderBoolEquationTerm(t, side, ti)).join('');
        const syncCall = `window._eqDvEqSync('${fieldId}','${d.id}')`;
        return `<div class="mechsel-chip" style="border-left-color:#3b82f6;"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div>${toggle ? `<div class="mechsel-chip-preview">${toggle}</div>` : ''}
        <div class="eq-builder-section" oninput="${syncCall}" onchange="${syncCall}" onclick="${syncCall}">
            <label class="eq-builder-label" style="font-size:.7rem">🧮 Equação de Valor <span id="boolEquacao${side}_preview" style="color:var(--muted);font-weight:normal">${esc(_eqDvEqPreviewStr(eq))}</span></label>
            <div class="eq-terms-container" id="boolEquacao${side}">${terms}</div>
            <button type="button" class="eq-add-term-btn" onclick="window._mechBoolAddTerm('${side}')">➕ Adicionar Termo</button>
            <button type="button" class="eq-add-term-btn" onclick="window._eqDvEqClear('${fieldId}','${d.id}')">🗑️ Limpar Equação</button>
        </div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${d.id}')">✕</button></div>`;
    }
    return `<div class="mechsel-chip" style="border-left-color:#3b82f6;"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${icon} ${esc(d.nome)}</div><div class="mechsel-chip-preview">${esc(rotulo)}: <input type="number" step="${passo}" value="${mod}" style="width:60px;padding:2px;font-size:0.7rem;" onchange="window._eqDvSelLevelChange('${fieldId}', '${d.id}', '${campo}', this.value)">${toggle}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${d.id}')">✕</button></div>`;
}

/** Preview do vínculo: total numérico quando a equação só tem termos fixos,
 *  senão a fórmula simbólica (o valor real só existe na ficha). */
function _eqDvEqPreviewStr(eq) {
    if (!Array.isArray(eq) || !eq.length) return '';
    if (eq.every(t => t.tipo !== 'ficha' && t.tipo !== 'sort')) {
        let r = parseFloat(eq[0]?.valor) || 0;
        for (let i = 1; i < eq.length; i++) {
            const v = parseFloat(eq[i].valor) || 0;
            const op = eq[i].op || '+';
            if (op === '+') r += v;
            else if (op === '-') r -= v;
            else if (op === '×') r *= v;
            else if (op === '÷') r = v !== 0 ? r / v : 0;
            else if (op === 'min') r = Math.min(r, v);
            else if (op === 'max') r = Math.max(r, v);
        }
        return `— Total: ${r}`;
    }
    return `— Total: ${_formatEquation(eq)}`;
}

/** Sincroniza a equação editada no chip para o hidden do seletor e refaz o preview. */
window._eqDvEqSync = function (fieldId, did) {
    const cont = document.getElementById(`boolEquacao_DV_${fieldId}_${did}`);
    const hidden = document.getElementById(fieldId);
    if (!cont || !hidden) return;
    let eq = _collectEquacaoFromContainer(cont);
    // Termo único fixo vazio = equação ainda não preenchida ⇒ não persiste
    if (eq.length === 1 && eq[0].tipo === 'fixo' && (eq[0].valor === '' || eq[0].valor === undefined)) eq = [];
    const data = JSON.parse(hidden.value || '[]');
    const idx = data.findIndex(p => (typeof p === 'object' ? p.id === did : p === did));
    if (idx < 0) return;
    if (typeof data[idx] !== 'object') data[idx] = { id: did, modificador: 0 };
    if (eq.length) {
        data[idx].equacao = eq;
        // Equação substitui o Modificador — zera o legado para o vínculo ter
        // uma fonte de valor só (a ficha ignora modificador quando há equação,
        // mas dado limpo evita confusão em quem ler o Firestore).
        data[idx].modificador = 0;
    } else {
        delete data[idx].equacao;
    }
    hidden.value = JSON.stringify(data);
    const prev = document.getElementById(`boolEquacao_DV_${fieldId}_${did}_preview`);
    if (prev) prev.textContent = _eqDvEqPreviewStr(eq);
};

window._eqDvEqClear = function (fieldId, did) {
    const cont = document.getElementById(`boolEquacao_DV_${fieldId}_${did}`);
    if (cont) cont.innerHTML = '';
    window._eqDvEqSync(fieldId, did);
};

window._eqDvSelEscopoChange = function (fieldId, did, global) {
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    const data = JSON.parse(hidden.value || '[]');
    const idx = data.findIndex(p => (typeof p === 'object' ? p.id === did : p === did));
    if (idx < 0) return;
    if (typeof data[idx] !== 'object') data[idx] = { id: did, modificador: 0 };
    if (global) data[idx].escopo = 'global';
    else delete data[idx].escopo;   // ausente = comportamento padrão do VD
    hidden.value = JSON.stringify(data);
};

export function buildEquipmentDerivedValueSelectorHTML(fieldKey, label, currentIds, cache, noun = 'Valor Derivado', campo = 'modificador', rotulo = 'Modificador', comEquacao = false) {
    // O confirm redesenha os chips e precisa do MESMO cache que montou as opções
    // (VDs, Status Vitais, Atributos, Perícias, Partes do Corpo). Sem isso ele
    // caía sempre no cache de VDs. `campo` diz que propriedade o número grava.
    // `comEquacao` liga o editor de Equação de Valor por vínculo (hoje só VDs).
    (window._eqSelCache ||= {})[`field_${fieldKey}`] = { cache, noun, campo, rotulo, comEquacao };
    const published = cache.filter(d => d.publicado !== false);
    const parsedIds = (currentIds || []).map(item => typeof item === 'object' ? item : { id: item, [campo]: 0 });
    const selectedIds = parsedIds.map(p => p.id);

    const chips = parsedIds.map(dvObj => {
        const did = dvObj.id;
        const d = cache.find(x => x.id === did);
        if (!d) return '';
        return _eqDvChip(`field_${fieldKey}`, dvObj, d);
    }).join('');

    const opts = published.map(d => {
        const icon = d.icone || '📊';
        return `<label class="mechsel-result"><input type="checkbox" value="${d.id}" ${selectedIds.includes(d.id) ? 'checked' : ''}><span class="mechsel-result-name">${icon} ${esc(d.nome)}</span></label>`;
    }).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || `<span style="color:var(--muted);font-size:.75rem">Nenhum ${esc(noun.toLowerCase())} vinculado</span>`}</div>
        <div>
            <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar ${esc(noun)}</button>
        </div>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar ${esc(noun.toLowerCase())}..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results">${opts}</div>
            <button type="button" class="mechsel-confirm" onclick="window._eqDvSelConfirm('field_${fieldKey}')">✔️ Vincular Selecionados</button>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(parsedIds)}'>
    </div>`;
}

window._eqDvSelConfirm = function (fieldId) {
    const results = document.getElementById(`${fieldId}_results`);
    const hidden = document.getElementById(fieldId);
    if (!results || !hidden) return;

    const reg0 = window._eqSelCache?.[fieldId] || {};
    const existingIds = JSON.parse(hidden.value || '[]');
    const existingMap = new Map();
    existingIds.forEach(item => {
        if (typeof item === 'object') existingMap.set(item.id, item);
        else existingMap.set(item, { id: item, modificador: 0 });
    });

    const checked = Array.from(results.querySelectorAll('input[type="checkbox"]:checked')).map(cb => {
        const ex = existingMap.get(cb.value);
        const campo = reg0.campo || 'modificador';
        const novo = { id: cb.value, [campo]: ex ? (ex[campo] || 0) : 0 };
        // Sem isto, reconfirmar o seletor zerava o ON/OFF de escopo já marcado.
        if (ex?.escopo) novo.escopo = ex.escopo;
        if (Array.isArray(ex?.equacao) && ex.equacao.length) novo.equacao = ex.equacao;
        return novo;
    });

    hidden.value = JSON.stringify(checked);
    document.getElementById(`${fieldId}_search`).classList.remove('open');

    // Refresh chips — usa o cache que montou ESTE campo (VDs ou Status Vitais)
    const reg = window._eqSelCache?.[fieldId];
    const cache = reg?.cache || window._derivedValuesCache || [];
    const noun = (reg?.noun || 'Valor Derivado').toLowerCase();
    const chipsEl = document.getElementById(`${fieldId}_chips`);
    if (chipsEl) {
        if (!checked.length) {
            chipsEl.innerHTML = `<span style="color:var(--muted);font-size:.75rem">Nenhum ${noun} vinculado</span>`;
        } else {
            chipsEl.innerHTML = checked.map(dvObj => {
                const d = cache.find(x => x.id === dvObj.id);
                return d ? _eqDvChip(fieldId, dvObj, d) : '';
            }).join('');
        }
    }
};

window._eqDvSelLevelChange = function (fieldId, did, prop, val) {
    const hidden = document.getElementById(fieldId);
    if (!hidden) return;
    const parsed = parseFloat(String(val).replace(',', '.')) || 0;
    let data = JSON.parse(hidden.value || '[]');
    const idx = data.findIndex(p => (typeof p === 'object' ? p.id === did : p === did));
    if (idx >= 0) {
        if (typeof data[idx] !== 'object') {
            data[idx] = { id: did, modificador: 0 };
        }
        data[idx][prop] = parsed;
        hidden.value = JSON.stringify(data);
        // Mudou o modificador ⇒ refaz o preview do Total da equação (se houver)
        if (document.getElementById(`boolEquacao_DV_${fieldId}_${did}`)) window._eqDvEqSync(fieldId, did);
    }
};

/** Condições vinculadas a um item — lista simples de ids, sem modificador. */
export function buildConditionSelectorHTML(fieldKey, label, currentIds, cache) {
    const published = (cache || []).filter(c => c.publicado !== false);
    const ids = currentIds || [];

    const chip = c => `<div class="mechsel-chip" style="border-left-color:var(--danger)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${c.icone || '💀'} ${esc(c.nome)}</div><div class="mechsel-chip-preview">${esc(c.duracao ? 'Duração: ' + c.duracao : '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${c.id}')">✕</button></div>`;

    const chips = ids.map(cid => {
        const c = (cache || []).find(x => x.id === cid);
        return c ? chip(c) : '';
    }).join('');

    const opts = published.map(c =>
        `<label class="mechsel-result"><input type="checkbox" value="${c.id}" ${ids.includes(c.id) ? 'checked' : ''}><span class="mechsel-result-name">${c.icone || '💀'} ${esc(c.nome)}</span><span class="mechsel-result-preview">${esc(c.duracao || '')}</span></label>`).join('');

    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma condição vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Condição</button>
        <div class="mechsel-search" id="field_${fieldKey}_search">
            <div class="mechsel-search-bar">
                <input type="text" placeholder="🔍 Buscar condição..." oninput="window._mechSelFilter('field_${fieldKey}', this.value)">
            </div>
            <div class="mechsel-results" id="field_${fieldKey}_results" onchange="window._mechSelChange('field_${fieldKey}')">
                ${opts}
            </div>
        </div>
        <input type="hidden" id="field_${fieldKey}" value='${JSON.stringify(ids)}'>
    </div>`;
}

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
