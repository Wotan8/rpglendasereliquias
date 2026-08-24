/* ===== DISTRIBUIÇÕES NA CRIAÇÃO =====
   Peculiaridade com mecânica `distribuir` abre um pool de alvos para o jogador
   escolher (+X em N alvos). Isso só existia na ficha; aqui ele pode adiantar —
   ou não. Slot deixado vazio chega na ficha como distribuição pendente, do
   jeito que já era.

   O escolhido mora em wizardState.distribuicoes = { [mechId]: [{nome, valor}] }
   e vira charData.mecanicasAplicadas no formato do mechanics-engine.

   Trocar raça/classe/tribo, largar a avulsa ou baixar o nível da peculiaridade
   tira a mecânica (ou slots dela) da lista — sincronizarDistribuicoes() apaga a
   escolha órfã. Uma função só, chamada em todo render E na finalização, porque
   a peculiaridade pode sumir sem ninguém reabrir a etapa de Peculiaridades. */

const DIST_PREFIXO_RUNICO = 'Elemento Rúnico: ';

/** Peculiaridades ativas do personagem, com o rótulo da fonte. */
function _distPecsAtivas() {
    const ws = wizardState;
    const out = [];
    if (ws.racaSelecionada) {
        (window.RACES?.[ws.racaSelecionada]?.peculiaridades || []).forEach(p => out.push({ pec: p, fonte: 'Raça' }));
    }
    if (ws.classeSelecionada) {
        (window.CLASS_PECULIARITIES?.[ws.classeSelecionada] || []).forEach(p => out.push({ pec: p, fonte: 'Classe' }));
    }
    if (ws.triboSelecionada) {
        (window.TRIBES?.[ws.triboSelecionada]?.peculiaridades || []).forEach(p => out.push({ pec: p, fonte: 'Tribo' }));
    }
    (ws.peculiaridadesIndividuais || []).forEach(sel => {
        const pec = (window.INDIVIDUAL_PECULIARITIES || []).find(p => p.id === sel.id);
        if (pec) out.push({ pec, fonte: 'Individual' });
    });
    return out;
}

/** Nível escolhido da peculiaridade — é ele que dita quantos alvos a mecânica dá. */
function _distNivelDaPec(pec) {
    const ind = (wizardState.peculiaridadesIndividuais || []).find(p => p.id === pec.id);
    if (ind && ind.nivel) return ind.nivel;
    return (wizardState.niveisPeculiaridadesHerdadas || {})[pec.id] || pec.nivelAtual || 1;
}

/** Toda mecânica `distribuir` disponível agora, com pool e quantidade já resolvidos. */
function distribuicoesDisponiveis() {
    const lista = [];
    const vistos = new Set();

    for (const { pec, fonte } of _distPecsAtivas()) {
        for (const bruta of (pec.mecanicas || [])) {
            if (!bruta || bruta.tipo !== 'distribuir') continue;
            if (vistos.has(bruta.id)) continue; // mesma mecânica em duas pecs distribui uma vez só
            vistos.add(bruta.id);

            const mech = (bruta.evoluivel && typeof window._adjustMechanicForLevel === 'function')
                ? window._adjustMechanicForLevel(bruta, _distNivelDaPec(pec))
                : bruta;
            const cfg = mech.config || {};

            const pool = (cfg.pool === 'Personalizado' && Array.isArray(cfg.poolPersonalizado) && cfg.poolPersonalizado.length)
                ? cfg.poolPersonalizado
                : (typeof getDistribuirPool === 'function' ? getDistribuirPool(cfg.pool) : []);

            /* Elemento Rúnico é nível de domínio, não bônus numérico, e a coleção
               runicElements nem é carregada no wizard. Esses ficam para a ficha. */
            const alvos = pool.filter(n => n && !String(n).startsWith(DIST_PREFIXO_RUNICO));
            if (!alvos.length) continue;

            lista.push({
                mech, pec, fonte, alvos,
                quantidade: Number(cfg.quantidadeAlvos) || 1,
                valor: Number(cfg.valorPorAlvo) || 1,
                operacao: cfg.operacao || '+',
                restricao: cfg.restricao || ''
            });
        }
    }
    return lista;
}

/**
 * Reescreve wizardState.distribuicoes com o que ainda é válido e devolve as
 * distribuições disponíveis. Escolha de mecânica que saiu do personagem, alvo
 * que saiu do pool e slot além da quantidade atual são descartados aqui.
 */
function sincronizarDistribuicoes() {
    const disponiveis = distribuicoesDisponiveis();
    const antes = JSON.stringify(wizardState.distribuicoes || {});
    const limpo = {};

    for (const d of disponiveis) {
        const usados = new Set();
        const validos = [];
        for (const alvo of (wizardState.distribuicoes?.[d.mech.id] || [])) {
            if (validos.length >= d.quantidade) break;
            if (!alvo || !d.alvos.includes(alvo.nome)) continue;
            if (d.restricao === 'diferentes' && usados.has(alvo.nome)) continue;
            usados.add(alvo.nome);
            validos.push({ nome: alvo.nome, valor: d.valor });
        }
        if (validos.length) limpo[d.mech.id] = validos;
    }

    wizardState.distribuicoes = limpo;
    if (JSON.stringify(limpo) !== antes) saveWizardToStorage();
    return disponiveis;
}

/** Formato que a ficha lê em state.mecanicasAplicadas (mechanics-engine.js). */
function distribuicoesParaFicha() {
    const out = {};
    for (const d of sincronizarDistribuicoes()) {
        const alvos = wizardState.distribuicoes[d.mech.id];
        if (!alvos || !alvos.length) continue;
        out[d.mech.id] = {
            aplicada: alvos.length >= d.quantidade,
            timestamp: new Date().toISOString(),
            fonte: d.mech.fonte || d.pec.nome || '',
            alvosEscolhidos: alvos
        };
    }
    return out;
}

/* ===== UI ===== */

function distribuicoesHtml() {
    const disponiveis = sincronizarDistribuicoes();
    if (!disponiveis.length) return '';

    let html = `<div class="section">
        <div class="section-title">🎯 Distribuições</div>
        <p style="font-size:.85rem;color:var(--muted);margin:0 0 12px;">
            Suas peculiaridades abriram estas escolhas. Decida agora ou deixe para a
            ficha — nenhuma delas é obrigatória na criação.
        </p>`;

    for (const d of disponiveis) {
        const escolhidos = wizardState.distribuicoes[d.mech.id] || [];
        html += `<div class="attr-dist-block dist-block" style="margin-bottom:10px;">
            <div class="attr-dist-title">${escHtml(d.pec.nome)} · ${escHtml(d.fonte)}</div>
            <div class="attr-dist-counter">${escolhidos.length}/${d.quantidade} escolhido(s) · ${escHtml(d.operacao)}${d.valor} em cada</div>`;

        for (let i = 0; i < d.quantidade; i++) {
            const atual = escolhidos[i] ? escolhidos[i].nome : '';
            html += `<div class="field" style="margin-bottom:6px;">
                <select class="dist-select" data-mech="${escHtml(d.mech.id)}" onchange="setDistribuirAlvo(this)">
                    <option value="">— Não distribuir —</option>`;
            for (const alvo of d.alvos) {
                const usadoNoutroSlot = d.restricao === 'diferentes'
                    && alvo !== atual && escolhidos.some(a => a.nome === alvo);
                html += `<option value="${escHtml(alvo)}"${alvo === atual ? ' selected' : ''}${usadoNoutroSlot ? ' disabled' : ''}>${escHtml(alvo)}</option>`;
            }
            html += `</select></div>`;
        }
        html += `</div>`;
    }
    return html + `</div>`;
}

/** Repinta a caixa de distribuições, se a etapa de Peculiaridades estiver na tela. */
function renderDistribuicoes() {
    const box = document.getElementById('distribuicoesBox');
    if (box) box.innerHTML = distribuicoesHtml();
}

/* O nome do alvo trafega pelo value da <option> (já escapado), nunca dentro do
   onchange — apóstrofo em nome de perícia quebraria o handler. */
function setDistribuirAlvo(sel) {
    const mechId = sel.dataset.mech;
    const d = distribuicoesDisponiveis().find(x => x.mech.id === mechId);
    if (!d) return;

    const escolhidos = [];
    const bloco = sel.closest('.dist-block');
    (bloco ? bloco.querySelectorAll('.dist-select') : [sel]).forEach(s => {
        if (!s.value || escolhidos.length >= d.quantidade) return;
        if (d.restricao === 'diferentes' && escolhidos.some(a => a.nome === s.value)) return;
        escolhidos.push({ nome: s.value, valor: d.valor });
    });

    if (!wizardState.distribuicoes) wizardState.distribuicoes = {};
    if (escolhidos.length) wizardState.distribuicoes[mechId] = escolhidos;
    else delete wizardState.distribuicoes[mechId];

    renderDistribuicoes();
    saveWizardToStorage();
}
