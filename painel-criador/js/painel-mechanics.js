// =============================================
// VISUAL MECHANICS EDITOR — Lendas e Relíquias
// Handles: inline form, preview, mechanic cards,
//          MechanicSelector component
// =============================================

// --- Shared state (set by painel-firebase.js) ---
// window._mechState = { db, collection, getDocs, addDoc, updateDoc, doc, Timestamp, currentUser, ... }

const MECHANIC_TARGETS_HTML = `
<optgroup label="Atributos">
<option value="INT">INT</option><option value="RAC">RAC</option><option value="PRS">PRS</option>
<option value="FOR">FOR</option><option value="DES">DES</option><option value="VIG">VIG</option>
<option value="PRE">PRE</option><option value="MAN">MAN</option><option value="AUT">AUT</option>
</optgroup>
<optgroup label="Valores Derivados">
<option value="Vitalidade Máxima">Vitalidade Máxima</option><option value="Determinação Máxima">Determinação Máxima</option>
<option value="Sanidade Máxima">Sanidade Máxima</option><option value="Percepção">Percepção</option>
<option value="Iniciativa">Iniciativa</option><option value="Reação">Reação</option>
<option value="Blindagem">Blindagem</option><option value="Deslocamento Terrestre">Desl. Terrestre</option>
<option value="Deslocamento Aquático">Desl. Aquático</option><option value="Deslocamento Aéreo">Desl. Aéreo</option>
<option value="Tamanho">Tamanho</option><option value="Carga Máxima">Carga Máxima</option>
</optgroup>
<optgroup label="Perícias Mentais">
<option value="Abismo">Abismo</option><option value="Alquimancia">Alquimancia</option>
<option value="Essência">Essência</option><option value="Erudição">Erudição</option>
<option value="Fluxomancia">Fluxomancia</option><option value="História">História</option>
<option value="Investigação">Investigação</option><option value="Medicina">Medicina</option>
<option value="Ofícios">Ofícios</option><option value="Religião">Religião</option>
<option value="Runomancia">Runomancia</option>
</optgroup>
<optgroup label="Perícias Físicas">
<option value="Agilidade">Agilidade</option><option value="Arma">Arma</option>
<option value="Atletismo">Atletismo</option><option value="Briga">Briga</option>
<option value="Disparo">Disparo</option><option value="Furtividade">Furtividade</option>
<option value="Montaria">Montaria</option><option value="Sobrevivência">Sobrevivência</option>
</optgroup>
<optgroup label="Perícias Sociais">
<option value="Diplomacia">Diplomacia</option><option value="Empatia">Empatia</option>
<option value="Intimidação">Intimidação</option><option value="Liderança">Liderança</option>
<option value="Malandragem">Malandragem</option><option value="Performance">Performance</option>
<option value="Sedução">Sedução</option>
</optgroup>
<optgroup label="Perícias Defensivas">
<option value="Esquiva">Esquiva</option><option value="Aparar">Aparar</option>
<option value="Bloquear">Bloquear</option><option value="Desviar">Desviar</option>
<option value="Evadir">Evadir</option><option value="Cobertura">Cobertura</option>
<option value="Proteger">Proteger</option><option value="Reflexo">Reflexo</option>
<option value="Contra-Ataque">Contra-Ataque</option><option value="Ambidestria">Ambidestria</option>
</optgroup>
<optgroup label="Propriedades de Combate">
<option value="Alvo de Ataque">Alvo de Ataque</option><option value="Alvo de Defesa">Alvo de Defesa</option>
<option value="Dano">Dano</option><option value="Dano Crítico">Dano Crítico</option>
</optgroup>
<optgroup label="Outros">
<option value="Perícias (qualquer)">Perícias (qualquer)</option>
<option value="Perícias Mentais (qualquer)">Perícias Mentais (qualquer)</option>
<option value="Perícias Físicas (qualquer)">Perícias Físicas (qualquer)</option>
<option value="Perícias Sociais (qualquer)">Perícias Sociais (qualquer)</option>
<option value="Ações por turno">Ações por turno</option>
<option value="EXP Necessária">EXP Necessária</option>
</optgroup>`;

export const FONTE_LABELS = { raca: '🧬 Raça', classe: '⚔️ Classe', tribo: '🏕️ Tribo', peculiaridade: '✨ Pecul.', item: '🗡️ Item', condicao: '💀 Condição', manobra: '💥 Manobra', magia: '🔮 Magia', individual: '👤 Individual', generica: '⚙️ Genérica' };
export const TIPO_ICONS = { modificar: '➕', limitar: '🔒', conceder: '🎁', condicional: '⚡', narrativo: '📝', distribuir: '🎲' };
export const TIPO_LABELS = { modificar: 'Modificar', limitar: 'Limitar', conceder: 'Conceder', condicional: 'Condicional', narrativo: 'Narrativo', distribuir: 'Distribuir' };

function esc(text) {
    if (text === null || text === undefined) return '';
    const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML;
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
        const alvo = Array.isArray(config.alvo) ? config.alvo.join(', ') : (config.alvo || '?');
        const op = config.operacao || '+';
        const val = config.valor ?? '?';
        text = `${op}${val} em ${alvo}`;
    } else if (tipo === 'limitar') {
        const alvo = config.alvo || '?';
        if (config.tipoLimite === 'bloqueio') text = `${alvo}: bloqueado (= 0)`;
        else if (config.tipoLimite === 'maximo') text = `${alvo}: máximo ${config.valorMaximo ?? '?'}`;
        else if (config.tipoLimite === 'minimo') text = `${alvo}: mínimo ${config.valorMinimo ?? '?'}`;
        else if (config.tipoLimite === 'clamp') text = `${alvo}: min ${config.valorMinimo ?? '?'}, max ${config.valorMaximo ?? '?'}`;
        else text = `${alvo}: limite`;
    } else if (tipo === 'conceder') {
        const label = { capacidade: 'Concede', imunidade: 'Imunidade', vulnerabilidade: 'Vulnerabilidade', resistencia: 'Resistência', vantagem: 'Vantagem', desvantagem: 'Desvantagem', acesso: 'Acesso', remover_acesso: 'Remove acesso' };
        text = `${label[config.tipoConcessao] || 'Concede'}: ${config.descricaoConcessao || '?'}`;
    } else if (tipo === 'condicional') {
        text = `Se ${config.gatilho || '?'}: efeito condicional`;
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

// ===== CONFIG SECTION RENDERERS =====
function renderConfigModificar(config) {
    const alvoVal = config?.alvo || '';
    const opVal = config?.operacao || '+';
    const valVal = config?.valor ?? '';
    return `
    <div class="form-grid">
        <div class="form-group full-width"><label>O que é afetado? <span class="required">*</span></label>
            <select id="mech_config_alvo" onchange="window._mechUpdatePreview()">
                <option value="">— Selecionar alvo —</option>${MECHANIC_TARGETS_HTML}
            </select>
        </div>
        <div class="form-group"><label>Operação <span class="required">*</span></label>
            <select id="mech_config_operacao" onchange="window._mechUpdatePreview()">
                <option value="+" ${opVal === '+' ? 'selected' : ''}>+ Somar</option>
                <option value="-" ${opVal === '-' ? 'selected' : ''}>− Subtrair</option>
                <option value="×" ${opVal === '×' ? 'selected' : ''}>× Multiplicar</option>
                <option value="÷" ${opVal === '÷' ? 'selected' : ''}>÷ Dividir</option>
                <option value="=" ${opVal === '=' ? 'selected' : ''}>= Definir fixo</option>
            </select>
        </div>
        <div class="form-group"><label>Valor <span class="required">*</span></label>
            <input type="text" id="mech_config_valor" value="${esc(String(valVal))}" placeholder="Ex: 2, PRS + Nível" oninput="window._mechUpdatePreview()">
        </div>
    </div>`;
}

function renderConfigLimitar(config) {
    const tipoL = config?.tipoLimite || '';
    return `
    <div class="form-grid">
        <div class="form-group full-width"><label>O que é limitado? <span class="required">*</span></label>
            <select id="mech_config_alvo" onchange="window._mechUpdatePreview()">${MECHANIC_TARGETS_HTML}</select>
        </div>
        <div class="form-group"><label>Tipo de Limite <span class="required">*</span></label>
            <select id="mech_config_tipoLimite" onchange="window._mechLimitChange(); window._mechUpdatePreview()">
                <option value="">— Selecionar —</option>
                <option value="maximo" ${tipoL === 'maximo' ? 'selected' : ''}>Teto (máximo)</option>
                <option value="minimo" ${tipoL === 'minimo' ? 'selected' : ''}>Piso (mínimo)</option>
                <option value="clamp" ${tipoL === 'clamp' ? 'selected' : ''}>Ambos (clamp)</option>
                <option value="bloqueio" ${tipoL === 'bloqueio' ? 'selected' : ''}>Bloqueio (= 0)</option>
            </select>
        </div>
        <div class="form-group" id="mech_maxWrap" style="display:${['maximo', 'clamp'].includes(tipoL) ? '' : 'none'}"><label>Valor Máximo</label>
            <input type="number" id="mech_config_valorMaximo" value="${config?.valorMaximo ?? ''}" oninput="window._mechUpdatePreview()">
        </div>
        <div class="form-group" id="mech_minWrap" style="display:${['minimo', 'clamp'].includes(tipoL) ? '' : 'none'}"><label>Valor Mínimo</label>
            <input type="number" id="mech_config_valorMinimo" value="${config?.valorMinimo ?? ''}" oninput="window._mechUpdatePreview()">
        </div>
    </div>`;
}

function renderConfigConceder(config) {
    const tc = config?.tipoConcessao || '';
    return `
    <div class="form-grid">
        <div class="form-group"><label>O que concede? <span class="required">*</span></label>
            <select id="mech_config_tipoConcessao" onchange="window._mechUpdatePreview()">
                <option value="">— Selecionar —</option>
                <option value="capacidade" ${tc === 'capacidade' ? 'selected' : ''}>Capacidade especial</option>
                <option value="imunidade" ${tc === 'imunidade' ? 'selected' : ''}>Imunidade</option>
                <option value="vulnerabilidade" ${tc === 'vulnerabilidade' ? 'selected' : ''}>Vulnerabilidade</option>
                <option value="resistencia" ${tc === 'resistencia' ? 'selected' : ''}>Resistência</option>
                <option value="vantagem" ${tc === 'vantagem' ? 'selected' : ''}>Vantagem em testes</option>
                <option value="desvantagem" ${tc === 'desvantagem' ? 'selected' : ''}>Desvantagem em testes</option>
                <option value="acesso" ${tc === 'acesso' ? 'selected' : ''}>Acesso a recurso</option>
                <option value="remover_acesso" ${tc === 'remover_acesso' ? 'selected' : ''}>Remove acesso</option>
            </select>
        </div>
        <div class="form-group"><label>Descrição da concessão <span class="required">*</span></label>
            <input type="text" id="mech_config_descricaoConcessao" value="${esc(config?.descricaoConcessao || '')}" placeholder="Ex: Voo, Visão de Essência" oninput="window._mechUpdatePreview()">
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

    // Build checkboxes from MECHANIC_TARGETS_HTML by extracting option values
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `<select>${MECHANIC_TARGETS_HTML}</select>`;
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
function _getProgressaoHeaders(tipo, tipoExp) {
    const expLabel = tipoExp === 'ganho' ? 'Ganho EXP' : 'Custo EXP';
    if (tipo === 'modificar') return ['Nível', expLabel, 'Valor'];
    if (tipo === 'limitar') return ['Nível', expLabel, 'Valor do Limite'];
    if (tipo === 'distribuir') return ['Nível', expLabel, 'Qtd Alvos', 'Valor por Alvo'];
    return ['Nível', expLabel, 'Descrição do Efeito'];
}

function _renderProgressaoRow(i, p, tipo) {
    const nvCell = `<td style="text-align:center;font-weight:700;color:var(--accent)">${i}</td>`;
    const custoCell = `<td><input type="number" class="prog-custo" data-nivel="${i}" value="${p.custoExp ?? (i === 1 ? 0 : '')}" placeholder="0" min="0" style="width:100%" oninput="window._mechUpdatePreview()"></td>`;

    if (tipo === 'modificar') {
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-valor" data-nivel="${i}" value="${esc(String(p.valor ?? ''))}" placeholder="Ex: ${i}" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
    } else if (tipo === 'limitar') {
        return `<tr>${nvCell}${custoCell}<td><input type="text" class="prog-valorLimite" data-nivel="${i}" value="${esc(String(p.valorLimite ?? ''))}" placeholder="Ex: ${i * 2}" style="width:100%" oninput="window._mechUpdatePreview()"></td></tr>`;
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

    const headers = _getProgressaoHeaders(tipo, tipoExp);
    let tabelaRows = '';
    if (evoluivel) {
        for (let i = 1; i <= nivelMax; i++) {
            const p = progressao[String(i)] || {};
            tabelaRows += _renderProgressaoRow(i, p, tipo);
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
export function openMechanicEditor(itemId, allItems, mechanicsCache, callbacks) {
    const { db, collection: col, addDoc, updateDoc, doc, Timestamp, currentUser, showAlert, loadModule, escapeHtml } = callbacks;
    const isEditing = !!itemId;
    const existingData = isEditing ? allItems.find(i => i.id === itemId) : {};
    const data = existingData || {};

    // Hide standard content, show editor
    document.getElementById('moduleContent').style.display = 'none';
    const area = document.getElementById('mechanicsEditorArea');
    area.style.display = '';

    const title = isEditing ? `✏️ Editar Mecânica` : `➕ Criar Nova Mecânica`;
    const tipo = data.tipo || 'modificar';
    const config = data.config || {};
    const tags = Array.isArray(data.tags) ? data.tags : [];

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
                    <div class="form-group"><label>Duração</label>
                        <select id="mech_duracao" onchange="window._mechDuracaoChange(); window._mechUpdatePreview()">
                            <option value="permanente" ${(data.duracao || 'permanente') === 'permanente' ? 'selected' : ''}>Permanente</option>
                            <option value="cena" ${data.duracao === 'cena' ? 'selected' : ''}>1 Cena</option>
                            <option value="turno" ${data.duracao === 'turno' ? 'selected' : ''}>X Turnos</option>
                            <option value="ate_remover" ${data.duracao === 'ate_remover' ? 'selected' : ''}>Até ser removido</option>
                            <option value="criacao" ${data.duracao === 'criacao' ? 'selected' : ''}>Na criação do personagem</option>
                            <option value="especial" ${data.duracao === 'especial' ? 'selected' : ''}>Especial</option>
                        </select></div>
                    <div class="form-group" id="mech_turnosWrap" style="display:${data.duracao === 'turno' ? '' : 'none'}"><label>Quantos turnos?</label>
                        <input type="number" id="mech_duracaoTurnos" value="${data.duracaoTurnos || ''}" min="1" oninput="window._mechUpdatePreview()"></div>
                    <div class="form-group" id="mech_especWrap" style="display:${data.duracao === 'especial' ? '' : 'none'}"><label>Descrever duração</label>
                        <input type="text" id="mech_duracaoEspecial" value="${esc(data.duracaoEspecial || '')}" oninput="window._mechUpdatePreview()"></div>
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

    // Set alvo value after DOM is ready (for optgroup selects)
    if (tipo === 'modificar' || tipo === 'limitar') {
        setTimeout(() => {
            const sel = document.getElementById('mech_config_alvo');
            if (sel && config.alvo) sel.value = Array.isArray(config.alvo) ? config.alvo[0] : config.alvo;
        }, 0);
    }

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

    // Re-set alvo if editing same type
    if ((tipo === 'modificar' || tipo === 'limitar') && config.alvo) {
        setTimeout(() => {
            const sel = document.getElementById('mech_config_alvo');
            if (sel) sel.value = Array.isArray(config.alvo) ? config.alvo[0] : config.alvo;
        }, 0);
    }

    // Re-render progression table with correct columns for new type
    window._mechRefreshProgressao(tipo);
    window._mechUpdatePreview();
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
    // Preserve existing values
    const existing = {};
    tbody.querySelectorAll('tr').forEach(row => {
        const nv = row.querySelector('.prog-custo')?.dataset.nivel;
        if (nv) {
            const p = { custoExp: row.querySelector('.prog-custo')?.value || '' };
            if (tipo === 'modificar') p.valor = row.querySelector('.prog-valor')?.value || '';
            else if (tipo === 'limitar') p.valorLimite = row.querySelector('.prog-valorLimite')?.value || '';
            else if (tipo === 'distribuir') {
                p.quantidadeAlvos = row.querySelector('.prog-quantidadeAlvos')?.value || '';
                p.valorPorAlvo = row.querySelector('.prog-valorPorAlvo')?.value || '';
            } else p.descricao = row.querySelector('.prog-descricao')?.value || '';
            existing[nv] = p;
        }
    });
    // Update headers
    if (thead) {
        const headers = _getProgressaoHeaders(tipo, tipoExp);
        thead.innerHTML = `<tr style="background:var(--bg-secondary);color:var(--text-secondary)">${headers.map(h => `<th style="padding:6px 8px${h === 'Nível' ? ';width:60px' : ''}">${h}</th>`).join('')}</tr>`;
    }
    let html = '';
    for (let i = 1; i <= max; i++) {
        const prev = existing[String(i)] || {};
        html += _renderProgressaoRow(i, prev, tipo);
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
        data.config = {
            alvo: document.getElementById('mech_config_alvo')?.value || '',
            operacao: document.getElementById('mech_config_operacao')?.value || '+',
            valor: isNaN(Number(document.getElementById('mech_config_valor')?.value)) ? document.getElementById('mech_config_valor')?.value : Number(document.getElementById('mech_config_valor')?.value)
        };
    } else if (tipo === 'limitar') {
        data.config = {
            alvo: document.getElementById('mech_config_alvo')?.value || '',
            tipoLimite: document.getElementById('mech_config_tipoLimite')?.value || '',
            valorMaximo: document.getElementById('mech_config_valorMaximo')?.value ? Number(document.getElementById('mech_config_valorMaximo').value) : null,
            valorMinimo: document.getElementById('mech_config_valorMinimo')?.value ? Number(document.getElementById('mech_config_valorMinimo').value) : null
        };
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

                if (tipo === 'modificar') {
                    const v = row.querySelector('.prog-valor')?.value?.trim() ?? '';
                    entry.valor = isNaN(Number(v)) || v === '' ? v : Number(v);
                } else if (tipo === 'limitar') {
                    const v = row.querySelector('.prog-valorLimite')?.value?.trim() ?? '';
                    entry.valorLimite = isNaN(Number(v)) || v === '' ? v : Number(v);
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
        const ex = window._mechAllItems?.find(i => i.id === editId);
        data.versao = (ex?.versao || 0) + 1;
    }

    const btn = document.getElementById('mechBtnSave');
    btn.disabled = true; btn.textContent = '⏳ Salvando...';

    try {
        if (editId) {
            await cb.updateDoc(cb.doc(cb.db, 'system/data/mechanics', editId), data);
            cb.showAlert('✅ Mecânica atualizada!', 'success');
        } else {
            await cb.addDoc(cb.collection(cb.db, 'system/data/mechanics'), data);
            cb.showAlert('✅ Mecânica criada!', 'success');
        }
        window._mechBack();
        await cb.loadModule('mechanics');
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
            chipsEl.innerHTML = checked.map(mid => {
                const m = cache.find(x => x.id === mid);
                if (!m) return '';
                return `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">✕</button></div>`;
            }).join('');
        }
    }
};

// ===== REUSABLE MECHANIC SELECTOR BUILDER (for other module forms) =====
export function buildMechanicSelectorHTML(fieldKey, label, currentIds, cache, fontePreFilter) {
    const published = cache.filter(m => m.publicado);
    const chips = (currentIds || []).map(mid => {
        const m = cache.find(x => x.id === mid);
        return m ? `<div class="mechsel-chip" style="border-left-color:var(--type-${m.tipo || 'modificar'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</div><div class="mechsel-chip-preview">${esc(m.previewTexto || '')}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${mid}')">✕</button></div>` : '';
    }).join('');
    const opts = published.map(m => `<label class="mechsel-result" data-fonte="${m.fonte || ''}"><input type="checkbox" value="${m.id}" ${(currentIds || []).includes(m.id) ? 'checked' : ''}><span class="mechsel-result-name">${TIPO_ICONS[m.tipo] || '🔧'} ${esc(m.nome)}</span><span class="mechsel-result-preview">${esc(m.previewTexto || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Mecânica</button>
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
        return p ? `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p.fonte || 'generica'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">✨ ${esc(p.nome)}</div><div class="mechsel-chip-preview">${esc(p.fonte || '')} — Nível Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('field_${fieldKey}', '${pid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('field_${fieldKey}','${pid}')">✕</button></div>` : '';
    }).join('');
    const opts = published.map(p => `<label class="mechsel-result"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}><span class="mechsel-result-name">✨ ${esc(p.nome)}</span><span class="mechsel-result-preview">${esc(p.fonte || '')}</span></label>`).join('');
    return `
    <div class="mechsel-wrap" id="field_${fieldKey}_wrap">
        <span class="mechsel-label">${esc(label)}</span>
        <div class="mechsel-chips" id="field_${fieldKey}_chips">${chips || '<span style="color:var(--muted);font-size:.75rem">Nenhuma peculiaridade vinculada</span>'}</div>
        <button type="button" class="mechsel-add-btn" onclick="document.getElementById('field_${fieldKey}_search').classList.toggle('open')">➕ Adicionar Peculiaridade</button>
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
                return `<div class="mechsel-chip" style="border-left-color:var(--fonte-${p?.fonte || 'generica'})"><div class="mechsel-chip-info"><div class="mechsel-chip-name">✨ ${esc(p?.nome || mid)}</div><div class="mechsel-chip-preview">${esc(p?.fonte || '')} — Nível Inicial: <input type="number" value="${pObj.nivelInicial || 1}" min="1" max="10" style="width:40px;padding:2px;font-size:0.7rem;" onchange="window._pecSelLevelChange('${fieldId}', '${mid}', this.value)"></div></div><button type="button" class="mechsel-chip-remove" onclick="window._mechSelRemove('${fieldId}','${mid}')">✕</button></div>`;
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

window._mechSelFilterFonte = function (fieldId, fonte) {
    const results = document.getElementById(`${fieldId}_results`);
    if (!results) return;
    results.querySelectorAll('.mechsel-result').forEach(l => {
        if (!fonte) { l.style.display = ''; return; }
        l.style.display = (l.dataset.fonte === fonte) ? '' : 'none';
    });
};
