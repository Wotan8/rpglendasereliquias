/* ===== CLASS MODULES RENDERER — Renderiza módulos de classe dinâmicos ===== */

/**
 * Injetar CSS de módulos de classe (será movido para styles.css depois).
 */
(function _injectClassModuleStyles() {
    if (document.getElementById('classModulesCSS')) return;
    const style = document.createElement('style');
    style.id = 'classModulesCSS';
    style.textContent = `
        .class-module-section {
            margin-top: 16px;
            border: 1px solid var(--soft, var(--lr-border-soft));
            border-radius: 10px;
            background: var(--card, rgba(30,41,59,.55));
            overflow: hidden;
        }
        .class-module-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(139,92,246,.08);
            border-bottom: 1px solid var(--soft, var(--lr-border-soft));
            cursor: pointer;
            gap: 8px;
        }
        /* Recolher: seta no header, conteúdo some. A impressão ignora — ficha
           impressa com bloco fechado seria ficha incompleta.
           O glifo e o giro vêm de shared/sanfona.css (.lr-seta); aqui fica só
           QUANDO está aberto, que é o que só esta tela sabe. Era ▼ aqui e ▸ no
           resto do projeto — mesma ação, duas gramáticas. */
        .class-module-header .cm-caret,
        .class-module-item-header .cm-caret { font-size: .7rem; }
        .class-module-section:not(.cm-collapsed) > .class-module-header .cm-caret,
        .class-module-item:not(.cm-collapsed) > .class-module-item-header .cm-caret {
            transform: rotate(90deg);
        }
        .class-module-section.cm-collapsed > .class-module-items,
        .class-module-section.cm-collapsed > .class-module-add-btn,
        .class-module-item.cm-collapsed > .class-module-fields {
            display: none;
        }
        @media print {
            .class-module-section.cm-collapsed > .class-module-items { display: block; }
            .class-module-item.cm-collapsed > .class-module-fields { display: grid; }
        }
        .class-module-header h4 {
            margin: 0;
            font-size: .9rem;
            font-weight: 700;
            color: var(--text, #e2e8f0);
        }
        .class-module-header .module-slots {
            font-size: .75rem;
            color: var(--muted, #94a3b8);
            background: rgba(139,92,246,.15);
            padding: 2px 8px;
            border-radius: 6px;
        }
        .class-module-header .module-cost-label {
            font-size: .7rem;
            color: var(--muted, #94a3b8);
            margin-left: 8px;
        }
        .class-module-items {
            padding: 8px;
        }
        .class-module-item {
            border: 1px solid var(--soft, var(--lr-border-soft));
            border-radius: 8px;
            margin-bottom: 8px;
            background:var(--lr-bg-1);
            overflow: hidden;
        }
        .class-module-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 10px;
            background:var(--lr-bg-1);
            border-bottom: 1px solid var(--soft, rgba(148,163,184,.06));
        }
        .class-module-item-header span {
            font-size: .78rem;
            font-weight: 600;
            color: var(--text, #e2e8f0);
        }
        .class-module-item-header button {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: .85rem;
            padding: 2px 6px;
            border-radius: 4px;
            transition: background .15s;
        }
        .class-module-item-header button:hover {
            background: rgba(239,68,68,.15);
        }
        .class-module-fields {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 8px;
            padding: 8px 10px;
        }
        .class-module-fields .field-full {
            grid-column: 1 / -1;
        }
        .class-module-fields .cm-field.span-3 { grid-column: span 3; }
        .class-module-fields .cm-field.span-4 { grid-column: span 4; }
        .class-module-fields .cm-field.span-6 { grid-column: span 6; }
        .class-module-fields .cm-field.span-8 { grid-column: span 8; }
        .class-module-fields .cm-field.span-9 { grid-column: span 9; }
        .class-module-fields .cm-field.span-12 { grid-column: 1 / -1; }
        @media (max-width: 560px) {
            .class-module-fields .cm-field.span-3,
            .class-module-fields .cm-field.span-4 { grid-column: span 6; }
            .class-module-fields .cm-field.span-8,
            .class-module-fields .cm-field.span-9 { grid-column: 1 / -1; }
        }
        /* Separador de seção */
        .cm-separador {
            border-bottom: 1px solid rgba(139,92,246,.35);
            color: var(--lr-abyssal);
            font-size: .72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .05em;
            padding-bottom: 2px;
            margin-top: 4px;
        }
        /* Checkbox */
        .class-module-fields input.cm-checkbox {
            width: 18px;
            height: 18px;
            accent-color: var(--lr-abyssal);
            cursor: pointer;
        }
        /* Cor */
        .class-module-fields input.cm-color {
            padding: 2px;
            height: 30px;
            cursor: pointer;
        }
        /* Link */
        .cm-link-wrap { display: flex; gap: 4px; align-items: center; }
        .cm-link-wrap input { flex: 1; }
        .cm-link-go { text-decoration: none; font-size: .9rem; }
        /* Imagem */
        .cm-img-preview {
            display: block;
            max-width: 100%;
            max-height: 180px;
            margin-top: 6px;
            border-radius: 8px;
            border: 1px solid var(--soft, rgba(148,163,184,.15));
            object-fit: contain;
            background:var(--lr-bg-1);
        }
        /* Avaliação (estrelas) */
        .cm-rating { display: flex; gap: 2px; font-size: 1.1rem; line-height: 1; user-select: none; }
        .cm-star { cursor: pointer; color: var(--muted, #94a3b8); transition: color .12s, transform .12s; }
        .cm-star.filled { color: #facc15; }
        .cm-star:hover { transform: scale(1.15); }
        /* Contador */
        .cm-counter { display: flex; align-items: center; gap: 4px; }
        .cm-counter input { width: 60px; text-align: center; }
        .cm-counter button {
            width: 26px; height: 26px;
            border: 1px solid var(--soft, var(--lr-border));
            border-radius: 6px;
            background: var(--lr-bg-1);
            color: var(--text, #e2e8f0);
            font-weight: 700;
            cursor: pointer;
        }
        .cm-counter button:hover { border-color: var(--lr-abyssal); color: var(--lr-abyssal); }
        /* Tags */
        .cm-tags {
            display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
            border: 1px solid var(--soft, var(--lr-border-soft));
            border-radius: 6px; padding: 4px 6px;
            background: var(--input-bg, var(--lr-bg-1));
        }
        .cm-tag {
            display: inline-flex; align-items: center; gap: 2px;
            background: rgba(139,92,246,.18);
            border: 1px solid rgba(139,92,246,.35);
            color: var(--text, #e2e8f0);
            border-radius: 10px;
            padding: 1px 7px;
            font-size: .7rem;
        }
        .cm-tag button { background: none; border: none; color: #ef4444; cursor: pointer; font-size: .75rem; padding: 0 2px; }
        .cm-tags .cm-tag-input {
            flex: 1; min-width: 70px;
            border: none !important; background: none !important;
            padding: 2px !important; font-size: .72rem;
        }
        /* Dado */
        .cm-dice { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .cm-dice input { width: 80px; }
        .cm-dice-btn {
            border: 1px solid var(--soft, var(--lr-border));
            border-radius: 6px; background: var(--lr-bg-1);
            font-size: .9rem; cursor: pointer; padding: 3px 8px;
        }
        .cm-dice-btn:hover { border-color: var(--lr-abyssal); }
        .cm-dice-result { font-size: .75rem; font-weight: 700; color: var(--lr-abyssal); }
        /* Botão de ação (mecânicas) */
        .cm-action-wrap { position: relative; display: flex; flex-direction: column; gap: 2px; }
        .cm-action-btn {
            padding: 7px 12px;
            border: 1px solid rgba(139,92,246,.45);
            border-radius: 8px;
            background: linear-gradient(180deg, rgba(139,92,246,.25), rgba(139,92,246,.12));
            color: var(--text, #e2e8f0);
            font-size: .78rem;
            font-weight: 700;
            cursor: pointer;
            transition: transform .1s, box-shadow .15s;
        }
        .cm-action-btn:hover { box-shadow: 0 0 10px rgba(139,92,246,.35); }
        .cm-action-btn:active { transform: scale(.97); }
        .cm-btn-toast {
            font-size: .68rem;
            color: var(--lr-abyssal);
            opacity: 0;
            transition: opacity .2s;
            min-height: 1em;
        }
        .cm-btn-toast.show { opacity: 1; }
        .cm-btn-toast .cm-toast-line { line-height: 1.4; text-align: left; }
        .cm-btn-toast .cm-toast-head { font-weight: 800; color: var(--lr-abyssal); }
        .cm-btn-toast .cm-toast-ok { color: #34d399; }
        .cm-btn-toast .cm-toast-fail { color: #f87171; }
        /* Modal de itens pré-cadastrados */
        .cm-predef-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(2,6,23,.7);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
        }
        .cm-predef-box {
            width: 100%; max-width: 480px; max-height: 80vh;
            overflow-y: auto;
            background: var(--card, #0f172a);
            border: 1px solid rgba(139,92,246,.4);
            border-radius: 12px;
            padding: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,.5);
        }
        .cm-predef-box-title {
            font-weight: 800; font-size: .9rem;
            color: var(--text, #e2e8f0);
            margin-bottom: 10px;
        }
        .cm-predef-box-list { display: flex; flex-direction: column; gap: 8px; }
        .cm-predef-option {
            text-align: left;
            border: 1px solid var(--soft, rgba(148,163,184,.15));
            border-radius: 10px;
            background:var(--lr-bg-1);
            padding: 10px 12px;
            cursor: pointer;
            transition: border-color .15s, background .15s;
        }
        .cm-predef-option:hover { border-color: var(--lr-abyssal); background: rgba(139,92,246,.1); }
        .cm-predef-option-nome { font-weight: 700; font-size: .82rem; color: var(--text, #e2e8f0); }
        .cm-predef-option-desc { font-size: .72rem; color: var(--muted, #94a3b8); margin-top: 2px; }
        .cm-predef-option-custos { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .cm-predef-option-custos span {
            font-size: .65rem;
            background: rgba(139,92,246,.12);
            border: 1px solid rgba(139,92,246,.3);
            border-radius: 8px;
            padding: 1px 6px;
            color: var(--muted, #cbd5e1);
        }
        .cm-predef-option-custom { border-style: dashed; }
        .cm-predef-cancel {
            display: block; width: 100%;
            margin-top: 10px;
            padding: 8px;
            border: 1px solid var(--soft, var(--lr-border));
            border-radius: 8px;
            background: none;
            color: var(--muted, #94a3b8);
            cursor: pointer;
        }
        .cm-predef-cancel:hover { color: var(--text, #e2e8f0); }
        .module-req-label {
            font-size: .65rem;
            color: var(--muted, #94a3b8);
            margin-left: 8px;
        }
        .class-module-fields label {
            display: block;
            font-size: .68rem;
            font-weight: 600;
            color: var(--muted, #94a3b8);
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: .03em;
        }
        .class-module-fields input,
        .class-module-fields textarea,
        .class-module-fields select {
            width: 100%;
            background: var(--input-bg, var(--lr-bg-1));
            border: 1px solid var(--soft, var(--lr-border-soft));
            color: var(--text, #e2e8f0);
            padding: 5px 8px;
            border-radius: 6px;
            font-size: .8rem;
            font-family: inherit;
            box-sizing: border-box;
        }
        .class-module-fields textarea {
            min-height: 48px;
            resize: vertical;
        }
        .class-module-fields .progress-inputs {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .class-module-fields .progress-inputs input {
            flex: 1;
            text-align: center;
        }
        .class-module-fields .progress-inputs .sep {
            color: var(--muted, #94a3b8);
            font-weight: 700;
        }
        /* Steps field */
        .class-module-steps {
            margin-top: 4px;
        }
        .class-module-step {
            border: 1px solid var(--soft, rgba(148,163,184,.08));
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 4px;
            background:var(--lr-bg-1);
        }
        .class-module-step-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }
        .class-module-step-header input {
            flex: 1;
        }
        .class-module-step-header button {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: .75rem;
            padding: 2px 4px;
        }
        .class-module-step textarea {
            width: 100%;
            min-height: 32px;
            background: var(--input-bg, var(--lr-bg-1));
            border: 1px solid var(--soft, rgba(148,163,184,.08));
            color: var(--text, #e2e8f0);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: .75rem;
            font-family: inherit;
            resize: vertical;
            box-sizing: border-box;
        }
        .class-module-add-btn {
            display: block;
            width: 100%;
            padding: 8px;
            border: 1px dashed var(--soft, rgba(148,163,184,.18));
            border-radius: 8px;
            background: none;
            color: var(--muted, #94a3b8);
            font-size: .8rem;
            cursor: pointer;
            transition: border-color .15s, color .15s;
            margin-top: 4px;
        }
        .class-module-add-btn:hover {
            border-color: var(--lr-abyssal);
            color: var(--lr-abyssal);
        }
        .class-module-add-step-btn {
            background: none;
            border: 1px dashed var(--soft, var(--lr-border-soft));
            border-radius: 4px;
            color: var(--muted, #94a3b8);
            font-size: .7rem;
            cursor: pointer;
            padding: 3px 8px;
            margin-top: 2px;
            transition: color .15s;
        }
        .class-module-add-step-btn:hover {
            color: var(--lr-abyssal);
        }
        /* Valor Derivado chip */
        .cm-dv-chip {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(139,92,246,.12);
            border: 1px solid rgba(139,92,246,.35);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: .78rem;
            color: var(--text, #e2e8f0);
        }
        .cm-dv-icon { font-size: 1rem; }
        .cm-dv-name { font-weight: 600; }
        .cm-dv-value { font-weight: 800; color: var(--lr-abyssal); margin-left: 4px; }
        /* Select VD (dropdown de Valor Derivado) */
        .cm-select-vd-wrap {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cm-select-vd-wrap select {
            width: 100%;
            background: var(--input-bg, var(--lr-bg-1));
            border: 1px solid var(--soft, var(--lr-border-soft));
            color: var(--text, #e2e8f0);
            padding: 5px 8px;
            border-radius: 6px;
            font-size: .78rem;
            font-family: inherit;
        }
        .cm-select-vd-preview {
            display: none;
            align-items: center;
            gap: 6px;
            background: rgba(139,92,246,.10);
            border: 1px solid rgba(139,92,246,.25);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: .75rem;
            color: var(--text, #e2e8f0);
            transition: opacity .2s;
        }
        .cm-select-vd-preview.visible { display: inline-flex; }
        .cm-select-vd-preview .cm-dv-icon { font-size: .95rem; }
        .cm-select-vd-preview .cm-dv-name { font-weight: 600; font-size: .75rem; }
        .cm-select-vd-preview .cm-dv-value { font-weight: 800; color: var(--lr-abyssal); margin-left: 4px; font-size: .75rem; }
        @media print {
            .class-module-item-header button,
            .class-module-add-btn,
            .class-module-add-step-btn,
            .class-module-step-header button {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Renderiza os módulos de classe no container #classModulesContainer.
 * Chamada por onClassChange().
 * @param {string} classeNome - Nome da classe selecionada
 */
function renderClassModules(classeNome) {
    const container = document.getElementById('classModulesContainer');
    if (!container) return;

    // Remove APENAS os elementos com a classe 'class-module-container'
    // preservando outros componentes (como loções, ritos)
    container.querySelectorAll('.class-module-container').forEach(e => e.remove());

    if (!classeNome) return;
    const modules = window._classModules[classeNome];
    if (!modules || modules.length === 0) {
        const sec = document.getElementById('classModulesSection');
        if (sec) sec.style.display = 'none';
        return;
    }

    // Ensure section is visible
    const resSection = document.getElementById('classModulesSection');
    if (resSection) resSection.style.display = '';

    /* Habilidade pré-cadastrada é copiada para a ficha ao ser adquirida. Antes
       de desenhar, os campos 🔒 voltam a seguir o cadastro — assim uma correção
       no Painel do Criador chega a quem já tem a habilidade. */
    modules.forEach(mod => window.PredefCampos?.sincronizarItens(mod, state.classModuleData?.[mod.id]));

    modules.forEach(mod => {
        // 🔮 Ramo opcional (Livro, p. 7): a classe dá um na criação; o outro se compra.
        const fechado = mod.ramoOpcional && !(state.ramosComprados && state.ramosComprados[mod.id]);
        const section = fechado ? _buildRamoFechado(mod) : _buildModuleSection(mod);
        container.appendChild(section);
    });
    // O botão "Expandir/Recolher tudo" precisa reencontrar os módulos novos.
    window.LRSanfona?.ligarSanfona(document.getElementById('classModulesSection'));
}

/**
 * 🔒 Ramo que a classe não deu de graça: aparece fechado, com o preço do Livro
 * (p. 7): 10 EXP e Perícia da Escola 2 — os números vêm de config/regras.
 */
function _buildRamoFechado(mod) {
    const R = window.REGRAS?.exp || {};
    const custo = Number(R.segundoRamo) || 10, minimo = Number(R.segundoRamoPericiaMinima) || 2;
    const chave = window.LR_DOMINIO?.chaveDaPericiaPorId?.(mod.periciaId, window._systemData?.skills) || null;
    const nivel = chave ? (typeof getEffectiveDotValue === 'function' ? getEffectiveDotValue(chave) : (state.dots?.[chave] || 0)) : 0;
    const escola = (window._systemData?.escolas || []).find(e => e.id === mod.escolaId);
    const pode = nivel >= minimo;
    const section = document.createElement('div');
    section.className = 'class-module-section cm-ramo-fechado';
    section.dataset.moduleId = mod.id;
    section.innerHTML = `<div class="class-module-header">
        <h4 style="margin-right:auto">🔒 ${_cmEsc(mod.icone || '📦')} ${_cmEsc(mod.titulo || mod.id)} <small style="opacity:.7">ramo não comprado</small></h4>
        <button type="button" class="cm-btn" ${pode ? '' : 'disabled'} onclick="cmComprarRamo('${_cmEsc(mod.id)}')"
            title="${pode ? `Comprar este ramo por ${custo} EXP` : `Exige ${_cmEsc(escola?.periciaNome || 'a Perícia da Escola')} ${minimo} (você tem ${nivel})`}">🔓 Comprar ramo — ${custo} EXP</button>
    </div>
    <div class="cm-hint" style="padding:6px 10px;opacity:.8">Segundo ramo da mesma Escola: ${custo} EXP e ${_cmEsc(escola?.periciaNome || 'Perícia da Escola')} ${minimo} (Livro, p. 7).${pode ? '' : ` Você tem ${nivel}.`}</div>`;
    return section;
}
function _cmEsc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

window.cmComprarRamo = async function (modId) {
    const mod = Object.values(window._classModules || {}).flat().find(m => m.id === modId);
    if (!mod) return;
    const custo = Number(window.REGRAS?.exp?.segundoRamo) || 10;
    const atual = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
    if (atual < custo) { (typeof showUpgradeBlocked === 'function' ? showUpgradeBlocked : alert)(`EXP insuficiente! Custo: ${custo} EXP, disponível: ${atual} EXP`); return; }
    const ok = window.LRDialogo?.confirmar ? await window.LRDialogo.confirmar(`Comprar o ramo ${mod.titulo} por ${custo} EXP?`, { titulo: 'Segundo ramo', ok: 'Comprar' }) : confirm(`Comprar o ramo ${mod.titulo} por ${custo} EXP?`);
    if (!ok) return;
    if (typeof spendExp === 'function') spendExp(custo);
    state.ramosComprados = { ...(state.ramosComprados || {}), [modId]: { exp: custo, em: new Date().toISOString() } };
    const cl = document.querySelector('[data-key="classe"]')?.value || state.fields?.classe || '';
    renderClassModules(cl);
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
};

/**
 * Constrói a seção DOM de um módulo.
 */
function _buildModuleSection(mod) {
    const section = document.createElement('div');
    section.className = 'class-module-section';
    section.dataset.moduleId = mod.id;
    // Dobra comandada pelo botão "Expandir/Recolher tudo" da seção.
    section.dataset.sanfonaItem = '';

    // Header
    const header = document.createElement('div');
    header.className = 'class-module-header';

    /* A seta vem de shared/sanfona.css: era ▼ aqui e ▸ em todo o resto.
       O glifo e o giro sao de la; o estado aberto e a linha de cm-collapsed. */
    const caret = document.createElement('span');
    caret.className = 'cm-caret lr-seta';
    header.appendChild(caret);

    const title = document.createElement('h4');
    title.textContent = `${mod.icone || '📦'} ${mod.titulo || mod.id}`;
    title.style.marginRight = 'auto';
    header.appendChild(title);

    header.title = 'Clique para recolher/expandir';
    header.addEventListener('click', () => section.classList.toggle('cm-collapsed'));

    // Slots indicator
    const limit = _getModuleLimit(mod);
    if (limit !== Infinity) {
        const slotsSpan = document.createElement('span');
        slotsSpan.className = 'module-slots';
        slotsSpan.id = `modSlots_${mod.id}`;
        const savedItems = state.classModuleData?.[mod.id] || [];
        slotsSpan.textContent = `${savedItems.length}/${limit} slots`;
        header.appendChild(slotsSpan);
    }

    if (mod.custoExpLabel) {
        const costSpan = document.createElement('span');
        costSpan.className = 'module-cost-label';
        costSpan.textContent = mod.custoExpLabel;
        header.appendChild(costSpan);
    }

    // Resumo de requisitos de equipamento
    if (Array.isArray(mod.custoEquipamentos) && mod.custoEquipamentos.length > 0) {
        const reqSpan = document.createElement('span');
        reqSpan.className = 'module-req-label';
        const custos = _cmFormatarCustos(0, mod.custoEquipamentos);
        reqSpan.textContent = custos.join(' · ');
        reqSpan.title = 'Requisitos para adicionar itens neste módulo';
        header.appendChild(reqSpan);
    }

    section.appendChild(header);

    const blockMessage = _checkModuleBlockStatus(mod);
    if (blockMessage) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'cm-block-message';
        blockDiv.style.padding = '15px';
        blockDiv.style.textAlign = 'center';
        blockDiv.style.color = 'var(--text-muted, #888)';
        blockDiv.style.fontStyle = 'italic';
        blockDiv.style.background = 'rgba(255, 0, 0, 0.05)';
        blockDiv.style.border = '1px dashed rgba(255, 0, 0, 0.3)';
        blockDiv.style.borderRadius = '4px';
        blockDiv.style.margin = '10px 0';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = mod.titulo || mod.id;
        
        const msgSpan = document.createElement('b');
        msgSpan.textContent = blockMessage;
        
        blockDiv.appendChild(document.createTextNode('🔒 Requer '));
        blockDiv.appendChild(msgSpan);
        blockDiv.appendChild(document.createTextNode(', para desbloquear '));
        blockDiv.appendChild(titleSpan);
        
        section.appendChild(blockDiv);
        return section;
    }

    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'class-module-items';
    itemsContainer.id = `modItems_${mod.id}`;

    // Load saved data
    const savedItems = state.classModuleData?.[mod.id] || [];
    savedItems.forEach((itemData, idx) => {
        const itemEl = _buildModuleItem(mod, idx, itemData);
        itemsContainer.appendChild(itemEl);
    });

    section.appendChild(itemsContainer);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'class-module-add-btn no-print';
    addBtn.textContent = `+ Adicionar ${mod.titulo || 'item'}`;
    addBtn.addEventListener('click', () => _addModuleItem(mod));
    section.appendChild(addBtn);

    return section;
}

/**
 * Verifica se o módulo está bloqueado por mecânicas.
 * Retorna null se não houver bloqueio, ou a string de mensagem se bloqueado.
 */
function _checkModuleBlockStatus(mod) {
    if (!mod.cadastrarBloqueio || !Array.isArray(mod.bloqueioMecanicaIds) || mod.bloqueioMecanicaIds.length === 0) return null;
    
    for (const mechId of mod.bloqueioMecanicaIds) {
        const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
        if (!mech || mech.tipo !== 'booleano') continue;
        
        const config = mech.config || {};
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            
            if (!r) {
                return config.valorFalso || 'Requisito não atendido';
            }
        } catch (e) {
            // ignorar e prosseguir
        }
    }
    return null;
}

function _getModuleLimit(mod) {
    const candidatos = [];

    // 1) Bônus legado via TARGET_MAP ("Limite: Título") — mecânicas aplicadas ao personagem
    const limitKey = 'MODULE_LIMIT:' + mod.id;
    const bonus = state.mechanicBonuses?.[limitKey] || 0;
    if (bonus > 0) candidatos.push(bonus);

    // 2) Limite fixo definido pelo criador
    const fixo = mod.limiteFixo;
    const temFixo = fixo !== null && fixo !== undefined && fixo !== '' && !isNaN(Number(fixo));
    if (temFixo) candidatos.push(Number(fixo));

    // 3) Mecânicas vinculadas — os valores resolvidos são SOMADOS entre si
    const ids = Array.isArray(mod.limiteMecanicaIds) ? mod.limiteMecanicaIds : [];
    if (ids.length > 0) {
        let soma = 0, resolvidas = false;
        ids.forEach(id => {
            const v = _resolveModuleMechanicValue(id);
            if (v !== null) { soma += v; resolvidas = true; }
        });
        if (resolvidas) candidatos.push(soma);
    }

    const temConfig = temFixo || ids.length > 0 || !!mod.mecanicaLimiteId;
    if (!temConfig) return Infinity; // Sem configuração = ilimitado

    // Fixo + mecânica: vale o MAIOR valor
    if (candidatos.length === 0) return 0;
    return Math.max(0, Math.max(...candidatos));
}

/**
 * Resolve o valor numérico configurado em uma mecânica (para Limite de Itens).
 * Suporta: modificar/limitar (cálculos/equações), booleano (avalia e usa saída),
 * e formatos legados (valor / valorMaximo fixos).
 */
function _resolveModuleMechanicValue(mechId) {
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (!mech) return null;
    const config = mech.config || {};

    if (mech.tipo === 'booleano') {
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            const out = r ? config.valorVerdadeiro : config.valorFalso;
            const n = parseFloat(out);
            return isNaN(n) ? 0 : n;
        } catch (e) { return null; }
    }

    if (mech.tipo === 'condicional_encadeado') {
        try {
            if (typeof resolveChainedConditional !== 'function') return null;
            const res = resolveChainedConditional(config);
            const n = parseFloat(res.valorSaida);
            return isNaN(n) ? 0 : n;
        } catch (e) { return null; }
    }

    const calculos = Array.isArray(config.calculos) ? config.calculos : null;
    if (calculos && calculos.length && typeof resolveCalcValue === 'function') {
        let total = 0;
        calculos.forEach(c => { total += resolveCalcValue(c) || 0; });
        return total;
    }
    if (config.valorMaximo !== undefined && config.valorMaximo !== null) return parseFloat(config.valorMaximo) || 0;
    if (config.valor !== undefined && config.valor !== null) return parseFloat(config.valor) || 0;
    return null;
}

/**
 * Atualiza o indicador de slots de um módulo.
 */
function _updateModuleSlots(mod) {
    const slotsEl = document.getElementById(`modSlots_${mod.id}`);
    if (!slotsEl) return;
    const limit = _getModuleLimit(mod);
    if (limit === Infinity) return;
    const currentCount = (state.classModuleData?.[mod.id] || []).length;
    slotsEl.textContent = `${currentCount}/${limit} slots`;
}

/* ===== CUSTOS DE EQUIPAMENTO ===== */

/** Normaliza o alvo de um requisito de equipamento (equipamento específico, tag ou tipo). */
function _cmReqTarget(req) {
    req = req || {};
    if (req.targetTipo === 'tag' || (req.tag && !req.equipamentoId)) return { kind: 'tag', value: req.tag || '' };
    if (req.targetTipo === 'tipo' || (req.tipoEquipamento && !req.equipamentoId)) return { kind: 'tipo', value: req.tipoEquipamento || '' };
    return { kind: 'equipamento', value: req.equipamentoId || req.id || '' };
}

/** Nome de exibição do alvo de um requisito. */
function _cmReqNome(req) {
    const t = _cmReqTarget(req);
    if (t.kind === 'tag') return `equipamento com tag "${t.value}"`;
    if (t.kind === 'tipo') return `equipamento do tipo ${t.value}`;
    const catalog = window._inventoryState?.catalog || [];
    const tpl = catalog.find(x => x.id === t.value);
    return tpl?.nome || t.value;
}

/** Normaliza as formas de equipar exigidas (compat: exigeEfeitosOn legado → ['efeitos']). */
function _cmReqFormas(req) {
    req = req || {};
    if (Array.isArray(req.formasEquip)) return req.formasEquip.filter(f => ['efeitos', 'segurando', 'fixado'].includes(f));
    return req.exigeEfeitosOn === true ? ['efeitos'] : [];
}

const _CM_FORMA_LABELS = { efeitos: '⚡ Efeitos Ativos', segurando: '🖐️ Segurando', fixado: '📌 Fixado' };

/** Rótulo legível das formas exigidas (ex: "Efeitos Ativos ou Fixado"). */
function _cmFormasLabel(formas) {
    if (!formas || formas.length === 0) return '';
    return formas.map(f => _CM_FORMA_LABELS[f] || f).join(' ou ');
}

/** Retorna as categorias de forma que o item equipado satisfaz: 'efeitos', 'segurando' e/ou 'fixado'.
 *  Regra canônica em inventory.js (itemFormasAtuais) — aqui só delega. */
function _cmItemFormasAtuais(item) {
    return typeof itemFormasAtuais === 'function' ? itemFormasAtuais(item) : [];
}

/**
 * Verifica se um item está equipado de forma válida para o requisito.
 * Se o requisito não exige nenhuma forma específica, qualquer forma equipada serve.
 */
function _cmItemEquipadoValido(item, req) {
    if (!item.equipado || item.parentItemId || item.estadoEquip === 'armazenado') return false;
    const exigidas = _cmReqFormas(req);
    if (exigidas.length === 0) return true; // Qualquer forma equipada serve
    const atuais = _cmItemFormasAtuais(item);
    return exigidas.some(f => atuais.includes(f));
}

/** Localiza itens do personagem que correspondem a um equipamento do catálogo. */
function _cmMatchInventoryItems(eqId) {
    const items = window._inventoryState?.items || [];
    const catalog = window._inventoryState?.catalog || [];
    const tpl = catalog.find(t => t.id === eqId);
    return items.filter(i => i.modeloId === eqId || (tpl && i.nome === tpl.nome));
}

// Ver _meSameNome: nome do item na ficha pode ter espaços das pontas.
function _cmSameNome(a, b) {
    return (a || '').trim() === (b || '').trim();
}

/** Localiza itens do personagem que correspondem a um requisito (equipamento, tag ou tipo). */
function _cmMatchInventoryItemsByReq(req) {
    const target = _cmReqTarget(req);
    if (target.kind === 'equipamento') return _cmMatchInventoryItems(target.value);

    const items = window._inventoryState?.items || [];
    const catalog = window._inventoryState?.catalog || [];

    if (target.kind === 'tag') {
        const tag = target.value;
        return items.filter(i => {
            if (Array.isArray(i.tags) && i.tags.includes(tag)) return true;
            const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => _cmSameNome(t.nome, i.nome));
            return !!(tpl && Array.isArray(tpl.tags) && tpl.tags.includes(tag));
        });
    }

    // target.kind === 'tipo'
    const tipo = target.value;
    return items.filter(i => {
        if (i.tipo) return i.tipo === tipo;
        const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => _cmSameNome(t.nome, i.nome));
        return !!(tpl && tpl.tipo === tipo);
    });
}

/**
 * Valida os custos de equipamento de um módulo/item pré-cadastrado.
 * @returns {{ok: boolean, faltas: string[], consumos: Array}}
 */
function _cmValidarCustosEquipamento(reqs) {
    const faltas = [];
    const consumos = [];

    for (const req of (reqs || [])) {
        const target = _cmReqTarget(req);
        if (!target.value) continue;
        const qtdMin = Math.max(1, parseInt(req.quantidade, 10) || 1);
        const nome = _cmReqNome(req);
        const matches = _cmMatchInventoryItemsByReq(req);

        if (req.consumir) {
            const disponivel = matches.reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
            if (disponivel < qtdMin) {
                faltas.push(`🎒 ${nome} ×${qtdMin} (possui ${disponivel}) — seria consumido`);
            } else {
                consumos.push({ req, eqId: target.kind === 'equipamento' ? target.value : null, nome, qtd: qtdMin });
            }
        } else {
            const validos = matches.filter(i => _cmItemEquipadoValido(i, req));
            const total = validos.reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
            if (total < qtdMin) {
                const formasLbl = _cmFormasLabel(_cmReqFormas(req));
                faltas.push(`🎒 ${nome} ×${qtdMin} equipado${formasLbl ? ` (${formasLbl})` : ''}`);
            }
        }
    }
    return { ok: faltas.length === 0, faltas, consumos };
}

/** Consome equipamentos do inventário (itens soltos primeiro, depois equipados). */
async function _cmConsumirEquipamentos(consumos) {
    if (!consumos || consumos.length === 0) return;
    const inv = window._inventoryState;
    for (const c of consumos) {
        let restante = c.qtd;
        // Itens soltos primeiro, depois equipados
        const matches = (c.req ? _cmMatchInventoryItemsByReq(c.req) : _cmMatchInventoryItems(c.eqId))
            .sort((a, b) => (a.equipado === b.equipado) ? 0 : (a.equipado ? 1 : -1));
        for (const item of matches) {
            if (restante <= 0) break;
            const qtdItem = parseInt(item.quantidade, 10) || 1;
            if (qtdItem > restante) {
                item.quantidade = qtdItem - restante;
                item.lastModified = new Date().toISOString();
                restante = 0;
                try {
                    if (typeof _firestoreSetDoc === 'function') await _firestoreSetDoc('items', item.id, { quantidade: item.quantidade, lastModified: item.lastModified });
                } catch (e) { console.error('❌ Erro ao consumir item:', e); }
            } else {
                restante -= qtdItem;
                inv.items = inv.items.filter(i => i.id !== item.id);
                try {
                    if (typeof _firestoreDeleteDoc === 'function') await _firestoreDeleteDoc('items', item.id);
                } catch (e) { console.error('❌ Erro ao remover item consumido:', e); }
            }
        }
    }
    if (typeof renderInventoryTab === 'function') renderInventoryTab();
    if (typeof renderEquippedItems === 'function') renderEquippedItems();
    if (typeof recalcInventoryPressure === 'function') recalcInventoryPressure();
}

/** Formata o resumo de custos de um item/módulo para exibição. */
function _cmFormatarCustos(custoExp, reqs) {
    const partes = [];
    if (custoExp > 0) partes.push(`💠 ${custoExp} EXP`);
    (reqs || []).forEach(req => {
        const target = _cmReqTarget(req);
        if (!target.value) return;
        const nome = _cmReqNome(req);
        const qtd = Math.max(1, parseInt(req.quantidade, 10) || 1);
        if (req.consumir) {
            partes.push(`🔥 Consome ${nome}${qtd > 1 ? ` ×${qtd}` : ''}`);
        } else {
            const formasLbl = _cmFormasLabel(_cmReqFormas(req));
            partes.push(`🎒 Requer ${nome}${qtd > 1 ? ` ×${qtd}` : ''} equipado${formasLbl ? ` (${formasLbl})` : ''}`);
        }
    });
    return partes;
}

/* ===== ADIÇÃO DE ITENS ===== */

/**
 * Adiciona um item a um módulo, com verificação de slots, EXP,
 * custos de equipamento e seleção de itens pré-cadastrados.
 */
function _addModuleItem(mod) {
    const limit = _getModuleLimit(mod);
    const currentItems = state.classModuleData?.[mod.id] || [];

    // Verificar slots
    if (limit !== Infinity && currentItems.length >= limit) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked(`Limite de slots atingido! (${currentItems.length}/${limit})`);
        }
        return;
    }

    const todosPredefs = Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [];
    const podeCriar = mod.permitirCriacaoJogador !== false;

    // O que o personagem já tem não volta para a lista de escolha.
    const jaTem = new Set(currentItems.map(it => it && it._predefId).filter(Boolean));
    const predefs = todosPredefs.filter(pd => !jaTem.has(pd.id));

    if (predefs.length > 0) {
        _cmAbrirSelecaoPredef(mod, predefs, podeCriar);
        return;
    }

    if (todosPredefs.length > 0 && !podeCriar) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked('Você já adquiriu tudo o que este módulo oferece.');
        }
        return;
    }

    if (!podeCriar) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked('Este módulo não permite criação livre e não possui itens pré-cadastrados.');
        }
        return;
    }

    _cmValidarECobrar(mod, null);
}

/** Modal de seleção de itens pré-cadastrados. */
function _cmAbrirSelecaoPredef(mod, predefs, podeCriar) {
    document.getElementById('cmPredefModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cmPredefModal';
    overlay.className = 'cm-predef-overlay no-print';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.className = 'cm-predef-box';

    const title = document.createElement('div');
    title.className = 'cm-predef-box-title';
    title.textContent = `${mod.icone || '📦'} ${mod.titulo} — Escolha um item`;
    box.appendChild(title);

    const list = document.createElement('div');
    list.className = 'cm-predef-box-list';

    predefs.forEach(pd => {
        const custoExp = _cmCustoExpDoItem(mod, pd);
        const reqs = Array.isArray(pd.custoEquipamentos) ? pd.custoEquipamentos : (mod.custoEquipamentos || []);
        const custos = _cmFormatarCustos(custoExp, reqs);
        
        const criacaoIds = Array.isArray(pd.custoCriacaoMecanicaIds) ? pd.custoCriacaoMecanicaIds : _cmGetCostMechanics(mod, 'custoCriacao');
        if (criacaoIds.length > 0) {
            criacaoIds.forEach(id => {
                const m = (window._systemData?.mechanics || []).find(x => x.id === id);
                if (m && m.tipo === 'booleano') {
                    const check = _cmCheckMechanicCost(id);
                    custos.push(check.label);
                }
            });
        }

        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'cm-predef-option';
        opt.innerHTML = `
            <div class="cm-predef-option-nome">${pd.nome}</div>
            ${pd.descricao ? `<div class="cm-predef-option-desc"></div>` : ''}
            ${custos.length ? `<div class="cm-predef-option-custos">${custos.map(c => `<span>${c}</span>`).join('')}</div>` : '<div class="cm-predef-option-custos"><span>✔️ Sem custo</span></div>'}
        `;
        if (pd.descricao) opt.querySelector('.cm-predef-option-desc').textContent = pd.descricao;
        opt.addEventListener('click', () => {
            overlay.remove();
            _cmValidarECobrar(mod, pd);
        });
        list.appendChild(opt);
    });

    if (podeCriar) {
        const custom = document.createElement('button');
        custom.type = 'button';
        custom.className = 'cm-predef-option cm-predef-option-custom';
        const custosMod = _cmFormatarCustos(mod.custoExpPorItem || 0, mod.custoEquipamentos || []);
        custom.innerHTML = `
            <div class="cm-predef-option-nome">✏️ Criar item personalizado</div>
            ${custosMod.length ? `<div class="cm-predef-option-custos">${custosMod.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
        `;
        custom.addEventListener('click', () => {
            overlay.remove();
            _cmValidarECobrar(mod, null);
        });
        list.appendChild(custom);
    }

    box.appendChild(list);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cm-predef-cancel';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => overlay.remove());
    box.appendChild(cancel);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

/**
 * ⭐ Quanto custa comprar a habilidade (Livro, p. 7): ramo com Qualidade custa
 * Qualidade × exp.habilidadePorQualidade (config/regras); predef com custo fixo
 * ou módulo sem Escola seguem o cadastro. Espelho de custoExpDaHabilidade em
 * shared/skill-custo.js — este arquivo é script clássico, sem import.
 */
function _cmCustoExpDoItem(mod, pd) {
    if (pd && pd.custoExpProprio !== null && pd.custoExpProprio !== undefined) return Number(pd.custoExpProprio) || 0;
    const q = Number(pd?.qualidade ?? pd?.valores?.qualidade) || 0;
    if (mod?.escolaId && q >= 1) return q * (Number(window.REGRAS?.exp?.habilidadePorQualidade) || 4);
    return Number(mod?.custoExpPorItem) || 0;
}

/** Valida EXP + equipamentos + mecânicas, confirma, cobra e adiciona o item. */
async function _cmValidarECobrar(mod, predef) {
    const custoExp = _cmCustoExpDoItem(mod, predef);
    const reqs = predef && Array.isArray(predef.custoEquipamentos)
        ? predef.custoEquipamentos : (mod.custoEquipamentos || []);

    // 1) Verificar equipamentos
    const check = _cmValidarCustosEquipamento(reqs);
    if (!check.ok) {
        if (typeof showUpgradeBlocked === 'function') {
            showUpgradeBlocked(`Equipamentos necessários em falta:\n${check.faltas.join('\n')}`);
        } else {
            LRDialogo.toast(`Equipamentos necessários em falta:\n${check.faltas.join('\n')}`, 'aviso');
        }
        return;
    }

    // 2) Verificar EXP
    if (custoExp > 0) {
        const currentExp = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        if (currentExp < custoExp) {
            if (typeof showUpgradeBlocked === 'function') {
                showUpgradeBlocked(`EXP insuficiente! Custo: ${custoExp} EXP, disponível: ${currentExp} EXP`);
            }
            return;
        }
    }

    let criacaoIds = [];
    if (predef && Array.isArray(predef.custoCriacaoMecanicaIds)) {
        criacaoIds = predef.custoCriacaoMecanicaIds.slice();
    } else {
        criacaoIds = _cmGetCostMechanics(mod, 'custoCriacao');
    }
    
    let mechCheck = { ok: true, label: 'Sem custo', costs: [] };
    if (criacaoIds.length > 0) {
        mechCheck = _cmCheckMechanicsCosts(criacaoIds);
        if (!mechCheck.ok) {
            showUpgradeBlocked(`Bloqueado: ${mechCheck.label}`);
            return;
        }
    }

    // comExp = false quando o mestre concede sem cobrar (ver showUpgradeConfirm).
    const executar = (comExp = true) => {
        if (custoExp > 0) {
            if (comExp && typeof spendExp === 'function') spendExp(custoExp);
            else if (!comExp && typeof concederSemGastar === 'function') concederSemGastar(custoExp);
        }
        if (check.consumos.length > 0) _cmConsumirEquipamentos(check.consumos);
        if (criacaoIds.length > 0) _cmApplyMechanicsCosts(criacaoIds);
        _doAddModuleItem(mod, predef);
    };

    const nomeItem = predef ? predef.nome : `Nova ${mod.titulo || 'item'}`;
    const currentItems = state.classModuleData?.[mod.id] || [];

    // Montar texto de custos de adição (previews dos efeitos, não nomes internos)
    let extraCosts = [];
    if (check.consumos.length > 0) {
        extraCosts.push('Equipamentos: ' + check.consumos.map(c => `${c.nome} ×${c.qtd}`).join(', '));
    }
    if (mechCheck.costs.length > 0) {
        extraCosts.push(...mechCheck.costs);
    }

    if (custoExp > 0 && typeof showUpgradeConfirm === 'function') {
        if (extraCosts.length > 0) {
             // Diálogo próprio por causa dos custos extras, que o
             // showUpgradeConfirm não sabe listar.
             if (await LRDialogo.confirmar(`Custo para adicionar:\n- ${custoExp} EXP\n- ${extraCosts.join('\n- ')}`,
                 { titulo: `Adicionar "${nomeItem}"?`, ok: 'Adicionar' })) {
                 executar();
             }
        } else {
             showUpgradeConfirm(nomeItem, currentItems.length + 1, custoExp, executar);
        }
    } else if (extraCosts.length > 0) {
        if (await LRDialogo.confirmar(`Custo para adicionar:\n- ${extraCosts.join('\n- ')}`,
            { titulo: `Adicionar "${nomeItem}"?`, ok: 'Adicionar' })) {
            executar();
        }
    } else {
        executar();
    }
}

/**
 * Executa a adição de um item após validação/cobrança.
 * @param {Object|null} predef - Item pré-cadastrado escolhido (ou null para item livre)
 */
/**
 * Valor na Régua de uma habilidade. Mora no item PRÉ-DEFINIDO (campo `regua`,
 * carimbado por functions/audit-regua-controle.mjs --gravar-regua), não na
 * cópia do jogador — assim uma remedição do sistema chega a todas as fichas
 * sem tocar em ficha nenhuma. Item livre do jogador não tem régua.
 */
function _cmReguaDoItem(mod, data) {
    if (!data?._predefId || !Array.isArray(mod?.itensPredefinidos)) return null;
    const pd = mod.itensPredefinidos.find(p => p.id === data._predefId);
    const r = pd?.regua;
    return (r && typeof r.razao === 'number') ? r : null;
}

/**
 * 🎓 O redutor desta linha (Livro, p. 6 e p. 7: a perícia é a porta).
 *
 * A conta inteira mora em shared/dominio-redutor.js, chamada também pelo
 * Tabuleiro. Aqui só se junta o que a ficha sabe: os níveis em `state.dots` e o
 * avaliador de equação que o motor de mecânicas já expõe.
 */
function _cmRedutorDoDominio(mod, data, alvoKey) {
    const M = window.LR_DOMINIO;
    if (!M?.redutorDaLinha) return null;
    return M.redutorDaLinha({
        mod, item: data, alvoKey,
        predef: data?._predefId ? (mod?.itensPredefinidos || []).find(p => p.id === data._predefId) : null,
        dots: state.dots || {},
        resolveEq: typeof resolveEquation === 'function' ? resolveEquation : null,
        focos: _cmFocosEquipados(),
        chave: M.chaveDaPericiaPorId(mod?.periciaId, window._systemData?.skills),
    });
}

/**
 * 🔮 Os focos equipados, para o redutor saber o que o Domínio está sustentando.
 *
 * O foco soma a própria Qualidade no Alvo (25 mecânicas fazem isso). Sem olhar
 * para ele, um talismã caro compraria Alvo com dinheiro no lugar de EXP — por
 * isso a perícia responde ao MAIOR entre a Qualidade da magia e a do foco.
 *
 * `periciaId` diz de que Perícia de Arte a peça é; a instância manda, o modelo
 * é o padrão, como em todo lugar que lê item. Peça armazenada ou dentro de container não
 * conta: só o que está de fato em uso.
 */
function _cmFocosEquipados() {
    const inv = window._inventoryState;
    const M = window.LR_DOMINIO;
    if (!inv?.items || !M?.chaveDaPericiaPorId) return [];
    const catalog = inv.catalog || [];
    return inv.items
        .filter(i => i.equipado && i.estadoEquip !== 'armazenado' && !i.parentItemId)
        .map(i => {
            const tpl = i.templateId ? catalog.find(x => x.id === i.templateId) : null;
            return {
                chave: M.chaveDaPericiaPorId(i.periciaId ?? tpl?.periciaId ?? null, window._systemData?.skills),
                qualidade: Number(i.qualidade ?? tpl?.qualidade) || 0,
            };
        })
        .filter(f => f.chave);
}

/**
 * Põe o redutor no chip do VD: o valor mostrado passa a ser o Alvo JÁ reduzido,
 * e a conta ao lado é o rastro de como se chegou nele. Cada parcela vem nomeada
 * no tooltip — o jogador precisa saber de onde saiu cada ponto perdido.
 */
function _cmAplicarRedutorNoChip(chip, valSpan, valor, info) {
    if (!info || typeof valor !== 'number') return;
    valSpan.textContent = String(valor - info.redutor);
    chip.classList.add('cm-dv-reduzido');
    const conta = document.createElement('span');
    conta.className = 'cm-dv-formula';
    conta.textContent = `${valor} ${info.partes.map(p => `− ${p.valor}`).join(' ')} =`;
    conta.title = [
        info.partes.map(p => `− ${p.valor} (${p.nome})`).join('\n'),
        info.semDominio ? '\n⚠️ Sem a Perícia desta Arte ela não abre (Livro, p. 6).' : '',
    ].filter(Boolean).join('');
    valSpan.parentNode.insertBefore(conta, valSpan);
}

function _doAddModuleItem(mod, predef) {
    if (!state.classModuleData) state.classModuleData = {};
    if (!state.classModuleData[mod.id]) state.classModuleData[mod.id] = [];

    const idx = state.classModuleData[mod.id].length;
    const newItemData = {};

    // Inicializar campos do schema com valores vazios
    (mod.schema || []).forEach(f => {
        if (f.tipo === 'progress') {
            newItemData[f.key + '_atual'] = '';
            newItemData[f.key + '_total'] = '';
        } else if (f.tipo === 'steps' || f.tipo === 'tags') {
            newItemData[f.key] = [];
        } else if (f.tipo === 'checkbox') {
            newItemData[f.key] = false;
        } else if (f.tipo === 'avaliacao' || f.tipo === 'contador') {
            newItemData[f.key] = 0;
        } else if (f.tipo === 'botao' || f.tipo === 'separador') {
            // sem dado
        } else {
            newItemData[f.key] = '';
        }
    });

    // Aplicar valores pré-definidos
    if (predef) {
        newItemData._predefId = predef.id || '';
        newItemData._predefNome = predef.nome || '';
        if (predef.valores && typeof predef.valores === 'object') {
            Object.keys(predef.valores).forEach(k => {
                const v = predef.valores[k];
                if (v !== undefined && v !== null && v !== '') newItemData[k] = v;
            });
        }
    }

    state.classModuleData[mod.id].push(newItemData);

    // Render o novo item no DOM
    const itemsContainer = document.getElementById(`modItems_${mod.id}`);
    if (itemsContainer) {
        const itemEl = _buildModuleItem(mod, idx, newItemData, !predef);
        itemsContainer.appendChild(itemEl);
    }

    _updateModuleSlots(mod);
    scheduleAutosave();
}

/* ===== INTERAÇÕES DE CAMPO (Botão / Dado) ===== */

/** Aplica as mecânicas vinculadas a um campo tipo 'botao'. */
function _cmAplicarMecanicasBotao(field, btnEl) {
    const ids = Array.isArray(field.mecanicaIds) ? field.mecanicaIds : [];
    if (ids.length === 0) {
        _cmToastBotao(btnEl, '🚫 Nenhuma mecânica vinculada');
        return;
    }
    
    for (const id of ids) {
        const check = _cmCheckMechanicCost(id);
        if (!check.ok) {
            _cmToastBotao(btnEl, `❌ ${check.label}`);
            return;
        }
    }

    const mechs = window._systemData?.mechanics || [];
    const nomes = [];
    const canCollect = typeof meBeginMessageCollection === 'function' && typeof meEndMessageCollection === 'function';
    let msgs = [];
    if (canCollect) meBeginMessageCollection();
    try {
        ids.forEach(id => {
            const m = mechs.find(x => x.id === id);
            if (m && typeof applyMechanicToSheet === 'function') {
                applyMechanicToSheet(m, null, true);
                nomes.push(m.nome);
            }
        });
    } finally {
        if (canCollect) msgs = meEndMessageCollection();
    }
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    const header = nomes.length ? `✅ Aplicado: ${nomes.join(', ')}` : '🚫 Mecânica(s) não encontrada(s)';
    if (msgs.length > 0) {
        _cmToastBotaoCadeia(btnEl, header, msgs);
    } else {
        _cmToastBotao(btnEl, header);
    }
}

/** Toast empilhado: cabeçalho + mensagem de cada mecânica da cadeia, na ordem
 *  de acionamento. Mensagens de mecânicas encadeadas aparecem abaixo (e
 *  levemente indentadas) da mecânica que as acionou. */
function _cmToastBotaoCadeia(btnEl, header, msgs) {
    if (!btnEl) return;
    let toast = btnEl.parentElement?.querySelector('.cm-btn-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cm-btn-toast';
        btnEl.parentElement?.appendChild(toast);
    }
    toast.textContent = '';
    const head = document.createElement('div');
    head.className = 'cm-toast-line cm-toast-head';
    head.textContent = header;
    toast.appendChild(head);
    msgs.forEach(m => {
        const line = document.createElement('div');
        line.className = 'cm-toast-line ' + (m.ok ? 'cm-toast-ok' : 'cm-toast-fail');
        line.style.paddingLeft = `${Math.min(m.depth || 0, 6) * 12}px`;
        const prefixo = m.nome ? `${m.nome} — ` : '';
        line.textContent = `${m.ok ? '✅' : '❌'} ${prefixo}${m.texto}`;
        toast.appendChild(line);
    });
    toast.classList.add('show');
    clearTimeout(toast._timer);
    // Mais mensagens = mais tempo de leitura
    const dur = Math.min(3200 + msgs.length * 1800, 12000);
    toast._timer = setTimeout(() => toast.classList.remove('show'), dur);
}

function _cmToastBotao(btnEl, msg) {
    if (!btnEl) return;
    let toast = btnEl.parentElement?.querySelector('.cm-btn-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cm-btn-toast';
        btnEl.parentElement?.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/** Rola uma fórmula de dados simples: NdM+K / NdM-K / dM. */
function _cmRolarDado(formula) {
    const m = String(formula || '').trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i);
    if (!m) return null;
    const n = Math.max(1, parseInt(m[1] || '1', 10));
    const faces = Math.max(2, parseInt(m[2], 10));
    const bonus = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    const rolagens = [];
    let total = bonus;
    for (let i = 0; i < Math.min(n, 100); i++) {
        const r = 1 + Math.floor(Math.random() * faces);
        rolagens.push(r);
        total += r;
    }
    return { total, rolagens, bonus };
}

/**
 * Constrói o DOM de um item de módulo.
 */
function _buildModuleItem(mod, idx, data, isCustomNew = false, isUnlocked = false) {
    data = data || {};

    const item = document.createElement('div');
    item.className = 'class-module-item';
    item.dataset.moduleId = mod.id;
    item.dataset.itemIndex = idx;

    const isLocked = mod.custoEdicaoAtivo && !isCustomNew && !isUnlocked;
    if (isLocked) {
        item.classList.add('locked-for-edit');
    }

    // Item header
    const header = document.createElement('div');
    header.className = 'class-module-item-header';
    header.style.cursor = 'pointer';
    header.title = 'Clique para recolher/expandir';
    // Recolher a habilidade — os botões do header (editar/remover) seguem
    // funcionando: só o clique no "vazio" do cabeçalho dobra o item.
    header.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, a')) return;
        item.classList.toggle('cm-collapsed');
    });

    const caret = document.createElement('span');
    caret.className = 'cm-caret lr-seta';
    header.appendChild(caret);

    const numSpan = document.createElement('span');
    numSpan.className = 'module-item-number';
    numSpan.style.marginRight = 'auto';
    numSpan.textContent = data._predefNome ? `#${idx + 1} · ${data._predefNome}` : `#${idx + 1}`;
    header.appendChild(numSpan);

    // Valor na Régua de Balanceamento — carimbado pelo audit-regua-controle
    // (--gravar-regua). Miúdo ao lado do nome: quanto a habilidade entrega
    // por ponto de recurso que ela cobra. 1,00× é o mínimo da casa.
    const _regua = _cmReguaDoItem(mod, data);
    if (_regua) {
        const rSpan = document.createElement('span');
        rSpan.className = 'module-item-regua';
        rSpan.textContent = `${_regua.razao.toFixed(2).replace('.', ',')}×`;
        rSpan.title = `Régua: entrega ${_regua.unidades} unidades por ${_regua.custo} de custo`
            + (_regua.em ? ` · medido em ${_regua.em}` : '')
            + '\n1 unidade = uma rodada de guerreiro. Abaixo de 1,00× a habilidade cobra mais do que entrega.';
        if (_regua.razao < 1) rSpan.classList.add('abaixo');
        header.appendChild(rSpan);
    }

    if (data._predefId) {
        const predefHidden = document.createElement('input');
        predefHidden.type = 'hidden';
        predefHidden.dataset.modField = '_predefId';
        predefHidden.value = data._predefId;
        header.appendChild(predefHidden);
        const predefNomeHidden = document.createElement('input');
        predefNomeHidden.type = 'hidden';
        predefNomeHidden.dataset.modField = '_predefNome';
        predefNomeHidden.value = data._predefNome || '';
        header.appendChild(predefNomeHidden);
    }

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    if (mod.custoEdicaoAtivo) {
        if (isLocked) {
            const btnUnlock = document.createElement('button');
            btnUnlock.className = 'no-print cm-edit-btn';
            btnUnlock.textContent = '✏️ Editar';
            btnUnlock.title = 'Desbloquear edição (Sujeito a custo)';
            btnUnlock.addEventListener('click', async () => {
                const edIds = _cmGetCostMechanics(mod, 'custoEdicao');
                if (edIds.length > 0) {
                    const check = _cmCheckMechanicsCosts(edIds);
                    if (!check.ok) {
                        showUpgradeBlocked(`Edição Bloqueada: ${check.label}`);
                        return;
                    }
                    if (await LRDialogo.confirmar(`Custo: ${check.label.replace('Custo: ', '')}`,
                        { titulo: 'Desbloquear edição?', ok: 'Desbloquear' })) {
                        _cmApplyMechanicsCosts(edIds);
                        
                        // Recriar o item no DOM como editável
                        const parent = item.parentElement;
                        const unlockedItem = _buildModuleItem(mod, idx, data, isCustomNew, true);
                        parent.insertBefore(unlockedItem, item);
                        item.remove();
                    }
                } else {
                    // Sem mecânica vinculada, desbloqueia direto
                    const parent = item.parentElement;
                    const unlockedItem = _buildModuleItem(mod, idx, data, isCustomNew, true);
                    parent.insertBefore(unlockedItem, item);
                    item.remove();
                }
            });
            btnGroup.appendChild(btnUnlock);
        } else {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'no-print cm-done-btn';
            doneBtn.textContent = '✅ Concluir';
            doneBtn.title = 'Salvar e trancar edição';
            doneBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            doneBtn.style.color = '#10b981';
            doneBtn.style.border = '1px solid rgba(16, 185, 129, 0.5)';
            doneBtn.addEventListener('click', () => {
                _saveModuleData(mod.id);
                
                // Buscar o index atual do item no DOM
                const currentItems = Array.from(item.parentElement.querySelectorAll('.class-module-item'));
                const myIdx = currentItems.indexOf(item);
                
                // Usar os dados recém-salvos (que incluem as edições) em vez da variável 'data' obsoleta
                let updatedData = data;
                if (myIdx >= 0 && state.classModuleData && state.classModuleData[mod.id]) {
                    updatedData = state.classModuleData[mod.id][myIdx] || data;
                }

                // Repintar item trancado com os dados atualizados
                const newItem = _buildModuleItem(mod, myIdx >= 0 ? myIdx : idx, updatedData, false, false);
                item.replaceWith(newItem);
            });
            btnGroup.appendChild(doneBtn);
        }
    }

    const rmBtn = document.createElement('button');
    rmBtn.className = 'no-print';
    rmBtn.textContent = '✕';
    rmBtn.title = 'Remover item';
    rmBtn.addEventListener('click', () => _removeModuleItem(mod, item));
    btnGroup.appendChild(rmBtn);
    
    header.appendChild(btnGroup);

    item.appendChild(header);

    // Fields grid
    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'class-module-fields';

    /* O 🔒 do cadastro protege o que o cadastro manda. Item que o JOGADOR
       inventou (sem _predefId) não tem cadastro para proteger — travar os
       campos dele deixaria a criação livre do módulo impossível de preencher.
       O travamento por custo de edição (isLocked) continua valendo para todos. */
    const doPreCadastro = !!data._predefId;

    (mod.schema || []).forEach(originalField => {
        const field = { ...originalField };
        if (isLocked) field.somenteLeitura = true;
        else if (!doPreCadastro) field.somenteLeitura = false;
        // Check "Hide if empty" (👁️) logic
        if (field.ocultarSeVazio) {
            let isEmpty = false;
            const val = data[field.key];
            if (field.tipo === 'progress') {
                isEmpty = !data[field.key + '_atual'] && !data[field.key + '_total'];
            } else if (field.tipo === 'steps' || field.tipo === 'tags') {
                isEmpty = !val || !Array.isArray(val) || val.length === 0;
            } else if (field.tipo === 'checkbox') {
                isEmpty = !val;
            } else if (field.tipo === 'avaliacao' || field.tipo === 'contador') {
                isEmpty = val == null || val === 0;
            } else if (field.tipo === 'botao' || field.tipo === 'separador' || field.tipo === 'dado') {
                isEmpty = false;
            } else {
                isEmpty = val === undefined || val === null || val === '';
            }

            if (isEmpty && !isCustomNew) {
                return; // suppress rendering
            }
        }

        const fieldWrap = document.createElement('div');
        // Larguras: grid de 12 colunas
        const spanMap = { '': 'span-6', 'full': 'span-12', 'terco': 'span-4', 'quarto': 'span-3', 'dois_tercos': 'span-8', 'tres_quartos': 'span-9' };
        fieldWrap.classList.add('cm-field', spanMap[field.largura] || 'span-6');
        if (field.largura === 'full') fieldWrap.classList.add('field-full');

        // Separador não tem label padrão nem input
        if (field.tipo === 'separador') {
            fieldWrap.className = 'cm-field span-12 cm-field-separador';
            const sep = document.createElement('div');
            sep.className = 'cm-separador';
            sep.textContent = field.label || '';
            fieldWrap.appendChild(sep);
            fieldsDiv.appendChild(fieldWrap);
            return;
        }

        if (field.tipo !== 'botao' && field.tipo !== 'select_botao') {
            const label = document.createElement('label');
            label.textContent = field.label || field.key;
            fieldWrap.appendChild(label);
        }

        if (field.tipo === 'textarea') {
            const ta = document.createElement('textarea');
            ta.dataset.modField = field.key;
            ta.placeholder = field.placeholder || '';
            ta.value = data[field.key] || '';
            if (field.somenteLeitura) ta.readOnly = true;
            ta.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(ta);
        } else if (field.tipo === 'select') {
            const sel = document.createElement('select');
            sel.dataset.modField = field.key;
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Selecionar —';
            sel.appendChild(emptyOpt);
            (field.opcoes || []).forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (data[field.key] === opt) o.selected = true;
                sel.appendChild(o);
            });
            if (field.somenteLeitura) sel.disabled = true;
            sel.addEventListener('change', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(sel);
        } else if (field.tipo === 'progress') {
            const progDiv = document.createElement('div');
            progDiv.className = 'progress-inputs';

            const inpAtual = document.createElement('input');
            inpAtual.type = 'text';
            inpAtual.dataset.modField = field.key + '_atual';
            inpAtual.placeholder = '0';
            inpAtual.value = data[field.key + '_atual'] || '';
            inpAtual.addEventListener('input', () => _saveModuleData(mod.id));

            const sep = document.createElement('span');
            sep.className = 'sep';
            sep.textContent = '/';

            const inpTotal = document.createElement('input');
            inpTotal.type = 'text';
            inpTotal.dataset.modField = field.key + '_total';
            inpTotal.placeholder = '0';
            inpTotal.value = data[field.key + '_total'] || '';
            inpTotal.addEventListener('input', () => _saveModuleData(mod.id));

            progDiv.appendChild(inpAtual);
            progDiv.appendChild(sep);
            progDiv.appendChild(inpTotal);
            fieldWrap.appendChild(progDiv);
        } else if (field.tipo === 'steps') {
            fieldWrap.classList.remove('span-6', 'span-4', 'span-3', 'span-8', 'span-9');
            fieldWrap.classList.add('span-12', 'field-full');
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'class-module-steps';
            stepsContainer.dataset.modField = field.key;

            const readOnly = !!field.somenteLeitura;
            const steps = Array.isArray(data[field.key]) ? data[field.key] : [];
            steps.forEach((step, si) => {
                const stepEl = _buildModuleStep(mod.id, field.key, si, step, readOnly);
                stepsContainer.appendChild(stepEl);
            });

            if (!readOnly) {
                const addStepBtn = document.createElement('button');
                addStepBtn.className = 'class-module-add-step-btn no-print';
                addStepBtn.type = 'button';
                addStepBtn.textContent = '+ Passo';
                addStepBtn.addEventListener('click', () => {
                    const stepIdx = stepsContainer.querySelectorAll('.class-module-step').length;
                    const stepEl = _buildModuleStep(mod.id, field.key, stepIdx, {}, readOnly);
                    stepsContainer.insertBefore(stepEl, addStepBtn);
                    _saveModuleData(mod.id);
                });
                stepsContainer.appendChild(addStepBtn);
            }
            fieldWrap.appendChild(stepsContainer);
        } else if (field.tipo === 'number') {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || '';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'checkbox') {
            const inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.className = 'cm-checkbox';
            inp.dataset.modField = field.key;
            inp.checked = data[field.key] === true || data[field.key] === 'true';
            if (field.somenteLeitura) inp.disabled = true;
            inp.addEventListener('change', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'data') {
            const inp = document.createElement('input');
            inp.type = 'date';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'cor') {
            const inp = document.createElement('input');
            inp.type = 'color';
            inp.className = 'cm-color';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] || '#8b5cf6';
            if (field.somenteLeitura) inp.disabled = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        } else if (field.tipo === 'link') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-link-wrap';
            const inp = document.createElement('input');
            inp.type = 'url';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || 'https://...';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            const anchor = document.createElement('a');
            anchor.className = 'cm-link-go no-print';
            anchor.textContent = '🔗';
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            const syncLink = () => {
                const v = (inp.value || '').trim();
                anchor.href = v || '#';
                anchor.style.visibility = v ? 'visible' : 'hidden';
            };
            syncLink();
            inp.addEventListener('input', () => { syncLink(); _saveModuleData(mod.id); });
            wrap.appendChild(inp);
            wrap.appendChild(anchor);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'imagem') {
            const campo = CampoImagem.el({
                valor: data[field.key] || '', pasta: 'imagens/modulos', preview: false,
                placeholder: field.placeholder || 'URL da imagem ou envie um arquivo',
            });
            const inp = campo.querySelector('input[type="text"]');
            inp.dataset.modField = field.key;
            if (field.somenteLeitura) inp.readOnly = true;
            const img = document.createElement('img');
            img.className = 'cm-img-preview';
            img.alt = field.label || field.key;
            img.loading = 'lazy';
            const syncImg = () => {
                const v = (inp.value || '').trim();
                if (v) { img.src = v; img.style.display = ''; }
                else { img.removeAttribute('src'); img.style.display = 'none'; }
            };
            img.addEventListener('error', () => { img.style.display = 'none'; });
            syncImg();
            inp.addEventListener('input', () => { syncImg(); _saveModuleData(mod.id); });
            fieldWrap.appendChild(campo);
            fieldWrap.appendChild(img);
        } else if (field.tipo === 'avaliacao') {
            const stars = document.createElement('div');
            stars.className = 'cm-rating';
            stars.dataset.modRating = field.key;
            const val = parseInt(data[field.key], 10) || 0;
            stars.dataset.value = String(val);
            for (let s = 1; s <= 5; s++) {
                const star = document.createElement('span');
                star.className = 'cm-star' + (s <= val ? ' filled' : '');
                star.textContent = s <= val ? '★' : '☆';
                if (!field.somenteLeitura) {
                    star.addEventListener('click', () => {
                        const atual = parseInt(stars.dataset.value, 10) || 0;
                        const novo = (atual === s) ? 0 : s; // clicar na mesma estrela zera
                        stars.dataset.value = String(novo);
                        stars.querySelectorAll('.cm-star').forEach((el, i) => {
                            el.textContent = (i + 1) <= novo ? '★' : '☆';
                            el.classList.toggle('filled', (i + 1) <= novo);
                        });
                        _saveModuleData(mod.id);
                    });
                }
                stars.appendChild(star);
            }
            fieldWrap.appendChild(stars);
        } else if (field.tipo === 'contador') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-counter';
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'no-print';
            minus.textContent = '−';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.dataset.modField = field.key;
            inp.value = data[field.key] !== undefined && data[field.key] !== '' ? data[field.key] : 0;
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'no-print';
            plus.textContent = '+';
            const step = (delta) => {
                inp.value = (parseInt(inp.value, 10) || 0) + delta;
                _saveModuleData(mod.id);
            };
            if (field.somenteLeitura) { inp.readOnly = true; minus.disabled = true; plus.disabled = true; }
            minus.addEventListener('click', () => step(-1));
            plus.addEventListener('click', () => step(1));
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            wrap.appendChild(minus);
            wrap.appendChild(inp);
            wrap.appendChild(plus);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'tags') {
            const tagsWrap = document.createElement('div');
            tagsWrap.className = 'cm-tags';
            tagsWrap.dataset.modTags = field.key;
            const renderTag = (txt) => {
                const t = document.createElement('span');
                t.className = 'cm-tag';
                t.dataset.tagValue = txt;
                t.textContent = txt + ' ';
                if (!field.somenteLeitura) {
                    const x = document.createElement('button');
                    x.type = 'button';
                    x.className = 'no-print';
                    x.textContent = '×';
                    x.addEventListener('click', () => { t.remove(); _saveModuleData(mod.id); });
                    t.appendChild(x);
                }
                return t;
            };
            (Array.isArray(data[field.key]) ? data[field.key] : []).forEach(txt => tagsWrap.appendChild(renderTag(txt)));
            if (!field.somenteLeitura) {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'cm-tag-input no-print';
                inp.placeholder = field.placeholder || '+ tag (Enter)';
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = inp.value.trim().replace(/,$/, '');
                        if (!v) return;
                        tagsWrap.insertBefore(renderTag(v), inp);
                        inp.value = '';
                        _saveModuleData(mod.id);
                    }
                });
                tagsWrap.appendChild(inp);
            }
            fieldWrap.appendChild(tagsWrap);
        } else if (field.tipo === 'dado') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-dice';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || 'Ex: 2d6+1';
            const formulaFixa = (field.formula || '').trim();
            inp.value = data[field.key] || formulaFixa || '';
            if (formulaFixa) { inp.value = data[field.key] || formulaFixa; }
            if (field.somenteLeitura || formulaFixa) inp.readOnly = !!formulaFixa || !!field.somenteLeitura;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            const rollBtn = document.createElement('button');
            rollBtn.type = 'button';
            rollBtn.className = 'cm-dice-btn no-print';
            rollBtn.textContent = '🎲';
            const result = document.createElement('span');
            result.className = 'cm-dice-result';
            rollBtn.addEventListener('click', () => {
                const formula = formulaFixa || inp.value;
                const r = _cmRolarDado(formula);
                if (!r) { result.textContent = '⚠️ Fórmula inválida'; return; }
                result.textContent = `= ${r.total} (${r.rolagens.join(', ')}${r.bonus ? (r.bonus > 0 ? ` +${r.bonus}` : ` ${r.bonus}`) : ''})`;
            });
            wrap.appendChild(inp);
            wrap.appendChild(rollBtn);
            wrap.appendChild(result);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'botao') {
            const wrap = document.createElement('div');
            wrap.className = 'cm-action-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cm-action-btn no-print';
            btn.textContent = field.label || field.key || 'Ativar';
            btn.title = field.placeholder || 'Aplica as mecânicas vinculadas';
            btn.addEventListener('click', () => _cmAplicarMecanicasBotao(field, btn));
            wrap.appendChild(btn);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'select_botao') {
            // Sem mecânica configurada não há o que pagar — um custo como
            // "2 Ações" se paga na mesa, não no clique. O botão só existia
            // para reclamar que não tinha mecânica; agora nem aparece.
            let _mechId = data[field.key];
            if (!_mechId && data._predefId && Array.isArray(mod?.itensPredefinidos)) {
                const _pd = mod.itensPredefinidos.find(p => p.id === data._predefId);
                _mechId = _pd?.valores?.[field.key];
            }
            if (!_mechId) return;   // forEach: `return` é o continue daqui

            const wrap = document.createElement('div');
            wrap.className = 'cm-action-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cm-action-btn no-print';
            btn.textContent = field.label || field.key || 'Ativar';
            btn.title = field.placeholder || 'Aplica a mecânica vinculada a este botão';
            btn.addEventListener('click', () => {
                let mechId = data[field.key];
                
                if (!mechId && data._predefId && mod && mod.itensPredefinidos) {
                    const pd = mod.itensPredefinidos.find(p => p.id === data._predefId);
                    if (pd && pd.valores && pd.valores[field.key]) {
                        mechId = pd.valores[field.key];
                        data[field.key] = mechId;
                        if (typeof _saveModuleData === 'function') _saveModuleData(mod.id);
                    }
                }

                if (!mechId) {
                    if (typeof showUpgradeBlocked === 'function') {
                        showUpgradeBlocked('Nenhuma mecânica configurada para este botão.');
                    } else if (typeof alert === 'function') {
                        LRDialogo.toast('Nenhuma mecânica configurada para este botão.', 'aviso');
                    }
                    return;
                }
                const pseudoField = {
                    key: field.key,
                    label: field.label,
                    mecanicaIds: [mechId]
                };
                _cmAplicarMecanicasBotao(pseudoField, btn);
            });
            wrap.appendChild(btn);
            fieldWrap.appendChild(wrap);
        } else if (field.tipo === 'select_vd') {
            // Select de Valor Derivado interativo
            const selectVdWrap = document.createElement('div');
            selectVdWrap.className = 'cm-select-vd-wrap';

            const sel = document.createElement('select');
            sel.dataset.modField = field.key;

            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Selecionar Valor Derivado —';
            sel.appendChild(emptyOpt);

            const allDVs = window.DERIVED_VALUES || [];
            allDVs.forEach(dv => {
                const o = document.createElement('option');
                o.value = dv.id;
                o.textContent = `${dv.icone || '📊'} ${dv.nome}`;
                if (data[field.key] === dv.id) o.selected = true;
                sel.appendChild(o);
            });

            if (field.somenteLeitura) sel.disabled = true;

            // Preview chip do DV selecionado
            const preview = document.createElement('div');
            preview.className = 'cm-select-vd-preview';

            const _updatePreview = () => {
                const dvId = sel.value;
                const dvDef = allDVs.find(d => d.id === dvId);
                if (dvDef) {
                    const rawVal = state.derived?.[dvDef.key];
                    const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(2))) : '—';
                    preview.innerHTML = '';
                    preview.dataset.dvId = dvDef.id;
                    preview.dataset.dvKeyRef = dvDef.key;
                    const iconSp = document.createElement('span');
                    iconSp.className = 'cm-dv-icon';
                    iconSp.textContent = dvDef.icone || '📊';
                    const nameSp = document.createElement('span');
                    nameSp.className = 'cm-dv-name';
                    nameSp.textContent = dvDef.nome;
                    const valSp = document.createElement('span');
                    valSp.className = 'cm-dv-value';
                    valSp.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
                    preview.appendChild(iconSp);
                    preview.appendChild(nameSp);
                    preview.appendChild(valSp);
                    _cmAplicarRedutorNoChip(preview, valSp, valor, _cmRedutorDoDominio(mod, data, field.key));
                    preview.classList.add('visible');
                } else {
                    preview.classList.remove('visible');
                    preview.innerHTML = '';
                    delete preview.dataset.dvId;
                    delete preview.dataset.dvKeyRef;
                }
            };

            sel.addEventListener('change', () => {
                _updatePreview();
                _saveModuleData(mod.id);
            });

            selectVdWrap.appendChild(sel);
            selectVdWrap.appendChild(preview);
            fieldWrap.appendChild(selectVdWrap);

            // Inicializar preview se já houver valor
            _updatePreview();
        } else if (field.tipo === 'redutor') {
            // Campo de conta, não de digitação: o valor dele já saiu subtraído no
            // chip do Alvo a que se vincula. Desenhar um input aqui mostraria o
            // mesmo número duas vezes, uma delas editável — e o jogador editaria
            // um número que a equação recalcula por cima.
            const M = window.LR_DOMINIO;
            const val = Array.isArray(field.equacao) && field.equacao.length && typeof resolveEquation === 'function'
                ? Math.abs(Number(resolveEquation(field.equacao)) || 0) : 0;
            if (!field.vinculadoA && val) {
                const chip = document.createElement('div');
                chip.className = 'cm-dv-chip cm-dv-reduzido';
                chip.innerHTML = `<span class="cm-dv-icon">➖</span><span class="cm-dv-name">${field.label || 'Redutor'}</span><span class="cm-dv-value">−${val}</span>`;
                fieldWrap.appendChild(chip);
            }
            void M;
        } else if (field.tipo === 'valor_derivado') {
            // Exibe o valor derivado resolvido (chip + valor calculado)
            const dvId = field.derivedValueId || '';
            const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === dvId);
            if (dvDef) {
                const rawVal = state.derived?.[dvDef.key];
                const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(2))) : '—';
                const chipDiv = document.createElement('div');
                chipDiv.className = 'cm-dv-chip';
                chipDiv.dataset.dvKeyRef = dvDef.key;
                const iconSpan = document.createElement('span');
                iconSpan.className = 'cm-dv-icon';
                iconSpan.textContent = dvDef.icone || '📊';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'cm-dv-name';
                nameSpan.textContent = dvDef.nome;
                const valSpan = document.createElement('span');
                valSpan.className = 'cm-dv-value';
                valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
                chipDiv.appendChild(iconSpan);
                chipDiv.appendChild(nameSpan);
                chipDiv.appendChild(valSpan);
                _cmAplicarRedutorNoChip(chipDiv, valSpan, valor, _cmRedutorDoDominio(mod, data, field.key));
                fieldWrap.appendChild(chipDiv);
            } else {
                const warn = document.createElement('span');
                warn.style.cssText = 'color:#ef4444;font-size:.72rem';
                warn.textContent = `⚠️ DV não encontrado: ${dvId}`;
                fieldWrap.appendChild(warn);
            }
        } else {
            // default: text
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.dataset.modField = field.key;
            inp.placeholder = field.placeholder || '';
            inp.value = data[field.key] || '';
            if (field.somenteLeitura) inp.readOnly = true;
            inp.addEventListener('input', () => _saveModuleData(mod.id));
            fieldWrap.appendChild(inp);
        }

        fieldsDiv.appendChild(fieldWrap);
    });

    item.appendChild(fieldsDiv);

    if (isCustomNew) {
        item.dataset.isCustomEdit = "true";
    }

    return item;
}

/**
 * Constrói um step individual dentro de um campo tipo 'steps'.
 */
function _buildModuleStep(moduleId, fieldKey, stepIdx, data, readOnly = false) {
    data = data || {};
    const step = document.createElement('div');
    step.className = 'class-module-step';

    const stepHeader = document.createElement('div');
    stepHeader.className = 'class-module-step-header';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.dataset.stepField = 'name';
    nameInp.placeholder = `Passo ${stepIdx + 1}`;
    nameInp.value = data.name || '';
    if (readOnly) nameInp.readOnly = true;
    nameInp.addEventListener('input', () => _saveModuleData(moduleId));
    stepHeader.appendChild(nameInp);

    if (!readOnly) {
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'no-print';
        rmBtn.textContent = '✕';
        rmBtn.addEventListener('click', () => {
            step.remove();
            _saveModuleData(moduleId);
        });
        stepHeader.appendChild(rmBtn);
    }
    step.appendChild(stepHeader);

    const descTa = document.createElement('textarea');
    descTa.dataset.stepField = 'desc';
    descTa.placeholder = 'Descrição do passo...';
    descTa.value = data.desc || '';
    if (readOnly) descTa.readOnly = true;
    descTa.addEventListener('input', () => _saveModuleData(moduleId));
    step.appendChild(descTa);

    return step;
}

/**
 * Verifica se o personagem possui saldo suficiente para a mecânica de custo.
 */
function _cmCheckMechanicCost(mechId) {
    if (!mechId) return { ok: true, label: 'Sem custo' };
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (!mech) return { ok: true, label: 'Mecânica não encontrada' };
    
    if (mech.tipo === 'booleano') {
        const config = mech.config || {};
        try {
            const valA = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoA || []) : 0;
            const valB = typeof resolveEquation === 'function' ? resolveEquation(config.equacaoB || []) : 0;
            const op = config.operadorComparacao || '>=';
            let r = false;
            if (op === '==') r = valA === valB;
            else if (op === '!=') r = valA !== valB;
            else if (op === '>') r = valA > valB;
            else if (op === '>=') r = valA >= valB;
            else if (op === '<') r = valA < valB;
            else r = valA <= valB;
            
            const formatEq = (eq) => {
                if (!Array.isArray(eq)) return String(eq);
                return eq.map((e, idx) => {
                    const txt = e.tipo === 'ficha' ? `[${e.ref}]` : String(e.valor || 0);
                    const op = idx > 0 ? (e.op ? ` ${e.op} ` : ' + ') : '';
                    return op + txt;
                }).join('');
            };
            
            const eqAStr = formatEq(config.equacaoA);
            const eqBStr = formatEq(config.equacaoB);
            const labelStr = `${eqAStr} ${op} ${eqBStr} ? ${r ? '✅' : '❌ ' + (config.valorFalso || 'Requisito não atendido')}`;
            
            return { ok: r, label: labelStr };
        } catch (e) {
            return { ok: false, label: 'Erro ao avaliar requisito' };
        }
    }
    
    if (mech.tipo === 'condicional_encadeado') {
        const config = mech.config || {};
        try {
            if (typeof resolveChainedConditional !== 'function') return { ok: true, label: 'Sem custo' };
            const res = resolveChainedConditional(config);
            return { ok: true, label: `🔗 ${res.valorEquacao} → "${res.valorSaida}"` };
        } catch (e) {
            return { ok: false, label: 'Erro ao avaliar condicional' };
        }
    }
    
    let isSubtracao = false;
    let requiredVal = 0;
    let fieldKey = '';
    
    if (mech.tipo === 'modificar' && mech.config?.calculos) {
        for (const calc of mech.config.calculos) {
            if (calc.operacao === '-') {
                isSubtracao = true;
                requiredVal = typeof resolveCalcValue === 'function' ? resolveCalcValue(calc) : 0;
                fieldKey = calc.alvo;
                break;
            }
        }
    } else if (mech.tipo === 'modificar' && mech.config?.operacao === '-') {
        isSubtracao = true;
        requiredVal = parseInt(mech.config.valor || 0, 10);
        fieldKey = mech.config.alvo;
    }

    if (isSubtracao && fieldKey) {
        let current = 0;
        // O valor pode estar em diferentes locais do state
        const targetMap = (typeof TARGET_MAP !== 'undefined') ? TARGET_MAP : (window.TARGET_MAP || {});
        const rawTarget = targetMap[fieldKey] || fieldKey;
        const cleanKey = rawTarget.replace(/^(DERIVED|BASE|INFO|SET|MULT|DIV|ATUAL):/, '');
        
        if (rawTarget.startsWith('ATUAL:')) {
            const input = document.querySelector(`[data-key="${cleanKey}"]`);
            if (input) current = Number(input.value) || 0;
            else if (state.derivedValues && state.derivedValues[cleanKey] !== undefined) current = Number(state.derivedValues[cleanKey]) || 0;
        } else if (state.derived && state.derived[cleanKey] !== undefined) {
            current = state.derived[cleanKey];
        } else if (state.atributos && state.atributos[cleanKey] !== undefined) {
            current = state.atributos[cleanKey];
        } else if (state.vitalStats && state.vitalStats[cleanKey] !== undefined) {
            current = state.vitalStats[cleanKey];
        } else if (cleanKey.toLowerCase() === 'exp' || fieldKey.toLowerCase() === 'exp') {
            current = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        } else if (fieldKey.toLowerCase() === 'ouro' || fieldKey.toLowerCase() === 'dinheiro') {
            current = window._inventoryState?.dinheiro || 0;
        }

        if (current < requiredVal) {
            return { ok: false, label: `Saldo insuficiente de ${fieldKey} (Requer ${requiredVal}, possui ${current})` };
        }
    }

    return { ok: true, label: `Custo: ${_cmMechPreviewLabel(mech)}` };
}

/**
 * Rótulo de custo de uma mecânica: usa o PREVIEW (resumo dos efeitos,
 * ex: "-1 em Presas") em vez do nome interno, deixando claro quais
 * atributos/status do personagem sofrerão mutação.
 */
function _cmMechPreviewLabel(mech) {
    if (!mech) return '';
    let preview = '';
    try {
        if (typeof generatePreviewText === 'function') {
            preview = generatePreviewText(mech) || '';
        }
    } catch (e) {
        preview = '';
    }
    if (!preview && mech.previewTexto) preview = mech.previewTexto;
    return preview || mech.nome || 'Custo';
}

/**
 * Aplica a mecânica de custo.
 */
function _cmApplyMechanicCost(mechId) {
    if (!mechId) return;
    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
    if (mech && typeof applyMechanicToSheet === 'function') {
        applyMechanicToSheet(mech, null, true);
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof scheduleAutosave === 'function') scheduleAutosave();
    }
}

/**
 * Obtém a lista de mecânicas de custo de um módulo (suporta legado e novo array).
 */
function _cmGetCostMechanics(mod, type) {
    const ids = Array.isArray(mod[`${type}MecanicaIds`]) ? mod[`${type}MecanicaIds`].slice() : [];
    if (mod[`${type}MecanicaId`] && !ids.includes(mod[`${type}MecanicaId`])) ids.push(mod[`${type}MecanicaId`]);
    return ids;
}

/**
 * Verifica os custos de um array de mecânicas.
 */
function _cmCheckMechanicsCosts(mechIds) {
    if (!mechIds || mechIds.length === 0) return { ok: true, label: 'Sem custo', costs: [] };
    const labels = [];
    for (const id of mechIds) {
        const check = _cmCheckMechanicCost(id);
        if (!check.ok) return check; 
        if (check.label !== 'Sem custo' && !check.label.includes('não encontrada')) {
            labels.push(check.label.replace('Custo: ', ''));
        }
    }
    return { ok: true, label: labels.length ? `Custo: ${labels.join(' · ')}` : 'Sem custo', costs: labels };
}

/**
 * Aplica os custos de um array de mecânicas.
 */
function _cmApplyMechanicsCosts(mechIds) {
    if (!mechIds || mechIds.length === 0) return;
    for (const id of mechIds) {
        _cmApplyMechanicCost(id);
    }
}

/**
 * Remove um item de módulo com confirmação e validação de custo.
 */
async function _removeModuleItem(mod, itemEl) {
    const remIds = _cmGetCostMechanics(mod, 'custoRemocao');
    if (mod.custoRemocaoAtivo && remIds.length > 0) {
        const check = _cmCheckMechanicsCosts(remIds);
        if (!check.ok) {
            if (typeof showUpgradeBlocked === 'function') {
                showUpgradeBlocked(`Bloqueado: ${check.label}`);
            } else {
                LRDialogo.toast(`Bloqueado: ${check.label}`, 'aviso');
            }
            return; // Impede exclusão
        }
        
        if (!await LRDialogo.confirmar(`Isso consumirá: ${check.label.replace('Custo: ', '')}`,
            { titulo: 'Remover este item?', ok: 'Remover', perigo: true })) return;
        _cmApplyMechanicsCosts(remIds);
    } else {
        if (!await LRDialogo.confirmar('Remover este item?', { ok: 'Remover', perigo: true })) return;
    }

    const container = itemEl.parentElement;
    itemEl.remove();

    // Re-index remaining items
    if (container) {
        container.querySelectorAll('.class-module-item').forEach((el, i) => {
            el.dataset.itemIndex = i;
            const num = el.querySelector('.module-item-number');
            if (num) num.textContent = `#${i + 1}`;
        });
    }

    _saveModuleData(mod.id);
    _updateModuleSlots(mod);
}

/**
 * Salva dados de um módulo no state e dispara autosave.
 */
function _saveModuleData(moduleId, skipAutosave = false) {
    if (!state.classModuleData) state.classModuleData = {};

    const container = document.getElementById(`modItems_${moduleId}`);
    if (!container) return;

    const items = [];
    container.querySelectorAll('.class-module-item').forEach(itemEl => {
        const data = {};

        // Campos simples (text, number, textarea, select, date, color, url, hidden...)
        itemEl.querySelectorAll('[data-mod-field]').forEach(el => {
            const key = el.dataset.modField;
            if (el.type === 'checkbox') {
                data[key] = el.checked;
            } else {
                data[key] = el.value;
            }
        });

        // Campos de avaliação (estrelas)
        itemEl.querySelectorAll('[data-mod-rating]').forEach(el => {
            data[el.dataset.modRating] = parseInt(el.dataset.value, 10) || 0;
        });

        // Campos de tags
        itemEl.querySelectorAll('[data-mod-tags]').forEach(el => {
            const tags = [];
            el.querySelectorAll('.cm-tag').forEach(t => {
                const v = t.dataset.tagValue || t.textContent.replace('×', '').trim();
                if (v) tags.push(v);
            });
            data[el.dataset.modTags] = tags;
        });

        // Campos de steps
        itemEl.querySelectorAll('.class-module-steps[data-mod-field]').forEach(stepsContainer => {
            const fieldKey = stepsContainer.dataset.modField;
            const steps = [];
            stepsContainer.querySelectorAll('.class-module-step').forEach(stepEl => {
                const nameEl = stepEl.querySelector('[data-step-field="name"]');
                const descEl = stepEl.querySelector('[data-step-field="desc"]');
                steps.push({
                    name: nameEl?.value || '',
                    desc: descEl?.value || ''
                });
            });
            data[fieldKey] = steps;
        });

        items.push(data);
    });

    state.classModuleData[moduleId] = items;
    if (!skipAutosave) {
        scheduleAutosave();
    }
}

/**
 * Coleta dados de TODOS os módulos de classe para o gatherData().
 * @returns {Object} - { moduleId: [itemData, ...], ... }
 */
function gatherClassModuleData() {
    // Se temos módulos renderizados, salvar do DOM
    if (state.classModuleData) {
        // Atualizar dados do DOM antes de retornar
        const container = document.getElementById('classExtraResources');
        if (container) {
            container.querySelectorAll('.class-module-section').forEach(section => {
                const modId = section.dataset.moduleId;
                if (modId) _saveModuleData(modId, true);
            });
        }
    }
    return state.classModuleData || {};
}

/**
 * Carrega dados salvos de módulos de classe no state.
 * @param {Object} data - { moduleId: [itemData, ...], ... }
 */
function loadClassModuleData(data) {
    state.classModuleData = data || {};
}

/**
 * Atualiza todos os previews de Select VD e chips de Valor Derivado
 * com os valores calculados atuais de state.derived.
 * Deve ser chamada após recalcAll().
 */
function _updateAllDVDisplaysInModules() {
    const allDVs = window.DERIVED_VALUES || [];
    if (!allDVs.length) return;

    // Atualizar previews de Select VD
    document.querySelectorAll('.cm-select-vd-preview[data-dv-key-ref]').forEach(preview => {
        const dvKey = preview.dataset.dvKeyRef;
        const dvDef = allDVs.find(d => d.id === preview.dataset.dvId) || allDVs.find(d => d.key === dvKey);
        if (!dvDef) return;
        const rawVal = state.derived?.[dvDef.key];
        const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(2))) : '—';
        const valSpan = preview.querySelector('.cm-dv-value');
        if (valSpan) valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
    });

    // Atualizar chips estáticos de valor_derivado
    document.querySelectorAll('.cm-dv-chip[data-dv-key-ref]').forEach(chip => {
        const dvKey = chip.dataset.dvKeyRef;
        const dvDef = allDVs.find(d => d.key === dvKey);
        if (!dvDef) return;
        const rawVal = state.derived?.[dvDef.key];
        const valor = rawVal !== undefined ? (Number.isInteger(rawVal) ? rawVal : parseFloat(Number(rawVal).toFixed(2))) : '—';
        const valSpan = chip.querySelector('.cm-dv-value');
        if (valSpan) valSpan.textContent = `${dvDef.prefixo || ''}${valor}${dvDef.sufixo || ''}`;
    });
}

window.addEventListener('beforeunload', (e) => {
    let warningMessages = [];
    document.querySelectorAll('.class-module-item[data-is-custom-edit="true"]').forEach(itemEl => {
        const modId = itemEl.dataset.moduleId;
        let modObj;
        for (const cls of Object.values(window._classModules || {})) {
            modObj = cls.find(m => m.id === modId);
            if (modObj) break;
        }
        if (!modObj) return;

        let lostFields = [];
        modObj.schema.forEach(field => {
            if (field.ocultarSeVazio) {
                let isEmpty = false;
                if (field.tipo === 'progress') {
                    const elAtual = itemEl.querySelector(`[data-mod-field="${field.key}_atual"]`);
                    const elTotal = itemEl.querySelector(`[data-mod-field="${field.key}_total"]`);
                    isEmpty = (!elAtual || !elAtual.value) && (!elTotal || !elTotal.value);
                } else if (field.tipo === 'steps') {
                    const elSteps = itemEl.querySelectorAll(`.class-module-steps[data-mod-field="${field.key}"] .class-module-step`);
                    isEmpty = elSteps.length === 0;
                } else if (field.tipo === 'tags') {
                    const elTags = itemEl.querySelectorAll(`[data-mod-tags="${field.key}"] .cm-tag`);
                    isEmpty = elTags.length === 0;
                } else if (field.tipo === 'checkbox') {
                    const elCb = itemEl.querySelector(`[data-mod-field="${field.key}"]`);
                    isEmpty = !elCb || !elCb.checked;
                } else if (field.tipo === 'avaliacao' || field.tipo === 'contador') {
                    const elRat = itemEl.querySelector(`[data-mod-rating="${field.key}"]`);
                    isEmpty = !elRat || parseInt(elRat.dataset.value, 10) === 0;
                } else if (field.tipo === 'botao' || field.tipo === 'separador' || field.tipo === 'dado') {
                    isEmpty = false;
                } else {
                    const el = itemEl.querySelector(`[data-mod-field="${field.key}"]`);
                    isEmpty = !el || !el.value;
                }

                if (isEmpty) {
                    lostFields.push(field.label || field.key);
                }
            }
        });

        if (lostFields.length > 0) {
            warningMessages.push(`Você irá perder os campos [${lostFields.join(', ')}] do módulo [${modObj.titulo}] ao atualizar a página.`);
        }
    });

    if (warningMessages.length > 0) {
        const msg = `Tem certeza? ${warningMessages.join(' ')}`;
        e.preventDefault();
        e.returnValue = msg;
        return msg;
    }
});
