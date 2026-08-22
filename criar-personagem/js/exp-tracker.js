/* ===== EXP TRACKER — Controle centralizado de EXP ===== */

/* Teto de EXP líquida que as Desvantagens avulsas podem render na criação.
   ≈8 sessões de jogo (a rubrica do Mestre paga 2-4 EXP por sessão). Sem ele,
   pegar todas as desvantagens rende ~200 EXP contra os ~62 da EXP Inicial —
   empilhar defeito viraria a estratégia dominante da criação. Só limita as
   individuais (`pec_`); as herdadas de raça/classe/tribo não são escolhidas.
   30 paga o Nanismo até quase o Nv4; o Nv5 fica de propósito como escolha de
   sabor, não de otimização. */
const TETO_GANHO_DESVANTAGENS = 30;

/** Perícia (e sua categoria) a partir do dotKey `sk_<key>` usado no wizard. */
function findSkillByDotKey(dotKey) {
    const key = String(dotKey).replace(/^sk_/, '');
    for (const [cat, lista] of Object.entries(window.SKILLS || {})) {
        const found = (lista || []).find(s => s.key === key);
        if (found) return { skill: found, cat };
    }
    return null;
}

/**
 * Chave desta perícia no formato da ficha v1.7.
 * Exclusiva de classe entra na ficha injetada pela CLASSE, com a chave
 * `sk_classe_<nome>` e SEM tirar acento — é assim que ficha-v1.7_1/js/core.js
 * monta em onClassChange, e é o que está gravado nos personagens existentes.
 * Gravar `sk_exclusivo_*` para elas deixaria o nível órfão: a ficha só renderiza
 * linha `sk_exclusivo_*` para exclusiva marcada como `todoPersonagem`.
 */
function chaveDaFicha({ skill, cat }) {
    if (cat === 'exclusivo' && !skill.todoPersonagem) {
        return 'sk_classe_' + skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    return `sk_${cat}_${skill.key}`;
}

/** Custo de EXP por nível desta perícia (campo "Custo de Evolução" do cadastro). */
function custoNivelPericia(dotKey) {
    return findSkillByDotKey(dotKey)?.skill.custoExp
        || REGRAS_CRIACAO.compra_exp.custo_pericia_padrao;
}

const ExpTracker = {
    _listeners: [],

    /** Registra uma fonte de EXP */
    addSource(key, amount, label) {
        wizardState.expSources[key] = { amount, label };
        if (key.startsWith('pec_') && this._ganhoPecBruto() > TETO_GANHO_DESVANTAGENS
            && typeof showWizardToast === 'function') {
            showWizardToast(`⚠️ Teto de ${TETO_GANHO_DESVANTAGENS} EXP em Desvantagens atingido — o excedente não conta.`, 'error');
        }
        this._notify();
    },

    /** Soma bruta do que as desvantagens individuais renderiam, sem o teto. */
    _ganhoPecBruto() {
        let g = 0;
        for (const [key, src] of Object.entries(wizardState.expSources)) {
            if (key.startsWith('pec_') && src.amount > 0) g += src.amount;
        }
        return g;
    },

    /** Remove uma fonte de EXP */
    removeSource(key) {
        delete wizardState.expSources[key];
        this._notify();
    },

    /** Retorna o EXP atual do pool (restante), já com o teto de desvantagens */
    getTotal() {
        let total = 0;
        for (const [key, src] of Object.entries(wizardState.expSources)) {
            if (key.startsWith('pec_') && src.amount > 0) continue;
            total += src.amount;
        }
        return total + Math.min(this._ganhoPecBruto(), TETO_GANHO_DESVANTAGENS);
    },

    /** Retorna EXP restante (alias para getTotal) */
    getRestante() {
        return this.getTotal();
    },

    /** Retorna o detalhamento de todas as fontes */
    getBreakdown() {
        return Object.entries(wizardState.expSources).map(([key, src]) => ({
            key,
            amount: src.amount,
            label: src.label
        }));
    },

    /** Registra listener para mudanças */
    onChange(callback) {
        this._listeners.push(callback);
    },

    /** Notifica listeners */
    _notify() {
        const total = this.getTotal();
        for (const cb of this._listeners) {
            try { cb(total); } catch (e) { console.error(e); }
        }
        this.updateDisplay();
    },

    /* ===== CÁLCULO DE EXP TOTAL (tempo real) ===== */

    /**
     * Calcula o custo total de EXP dos atributos iniciais.
     * Fórmula: para cada atributo no nível N, soma (nv × 5) de nv=1 até N.
     * Todos os atributos começam no mínimo em nível 1 (base_inicial).
     * Exemplo: FOR=3 → (1×5)+(2×5)+(3×5) = 30 EXP
     */
    calcAttrExpTotal() {
        if (typeof REGRAS_CRIACAO === 'undefined' || typeof GRUPOS_ATRIBUTOS === 'undefined' || typeof ATRIBUTOS === 'undefined') return 0;
        const custo = REGRAS_CRIACAO.compra_exp.custo_atributo_por_nivel;
        let total = 0;

        for (const grupo of GRUPOS_ATRIBUTOS) {
            for (const attr of ATRIBUTOS[grupo]) {
                total += this.custoFaixa(0, nivelAtributo(attr.key), custo);
            }
        }
        return total;
    },

    /**
     * Calcula o custo total de EXP das perícias iniciais.
     * Fórmula: para cada perícia no nível N, soma (nv × custoExp) de nv=1 até N.
     * custoExp vem do campo "Custo de Evolução" no Firebase (padrão: 4).
     */
    calcSkillExpTotal() {
        if (!window.SKILLS) return 0;
        let total = 0;
        for (const [dotKey, nivel] of periciasComNivel()) {
            total += this.custoFaixa(0, nivel, custoNivelPericia(dotKey));
        }
        return total;
    },

    /* ===== COMPRA COM EXP =====
       Níveis comprados com EXP ficam sempre no topo: custam a soma dos degraus
       acima do que os pontos iniciais já pagaram. O custo é recalculado do
       estado a cada mudança, então desfazer uma compra devolve o EXP sozinho —
       não existe "saldo gasto" guardado em lugar nenhum. */

    /** Soma dos degraus de `de`+1 até `ate`, cada degrau N custando N × custoPorNivel. */
    custoFaixa(de, ate, custoPorNivel) {
        let total = 0;
        for (let nv = de + 1; nv <= ate; nv++) total += nv * custoPorNivel;
        return total;
    },

    custoComprasAtributos() {
        const base = REGRAS_CRIACAO.atributos.base_inicial;
        const custo = REGRAS_CRIACAO.compra_exp.custo_atributo_por_nivel;
        let total = 0;
        for (const [key, comprados] of Object.entries(wizardState.atributosExp || {})) {
            if (!comprados) continue;
            const dePontos = base + (wizardState.atributos[key] || 0);
            total += this.custoFaixa(dePontos, dePontos + comprados, custo);
        }
        return total;
    },

    custoComprasPericias() {
        let total = 0;
        for (const [dotKey, comprados] of Object.entries(wizardState.periciasExp || {})) {
            if (!comprados) continue;
            const dePontos = wizardState.pericias[dotKey] || 0;
            total += this.custoFaixa(dePontos, dePontos + comprados, custoNivelPericia(dotKey));
        }
        return total;
    },

    /** Reflete as compras com EXP no pool. Chamar após mexer em atributosExp/periciasExp. */
    sincronizarCompras() {
        const atributos = this.custoComprasAtributos();
        const pericias = this.custoComprasPericias();

        if (atributos > 0) this.addSource('compra_atributos', -atributos, 'Atributos comprados com EXP');
        else this.removeSource('compra_atributos');

        if (pericias > 0) this.addSource('compra_pericias', -pericias, 'Perícias compradas com EXP');
        else this.removeSource('compra_pericias');
    },

    calcExpTotal() {
        let totalSourcesGained = 0;
        for (const [key, src] of Object.entries(wizardState.expSources)) {
            if (key.startsWith('pec_')) continue;   // entra abaixo, já com o teto
            if (src.amount > 0) totalSourcesGained += src.amount;
        }
        return this.calcAttrExpTotal() + this.calcSkillExpTotal() + totalSourcesGained
            + Math.min(this._ganhoPecBruto(), TETO_GANHO_DESVANTAGENS);
    },

    /* ===== DISPLAY ===== */

    /** Atualiza o display visual de EXP (Restante + Total) */
    updateDisplay() {
        // === EXP Restante ===
        const el = document.getElementById('expValue');
        if (el) {
            const restante = this.getTotal();
            const prev = parseInt(el.textContent) || 0;
            el.textContent = restante;

            if (restante !== prev) {
                el.classList.remove('flash-green', 'flash-red');
                void el.offsetWidth;
                el.classList.add(restante > prev ? 'flash-green' : 'flash-red');
                setTimeout(() => el.classList.remove('flash-green', 'flash-red'), 600);
            }
        }

        // === EXP Total ===
        const totalEl = document.getElementById('expTotalValue');
        if (totalEl) {
            const total = this.calcExpTotal();
            const prevTotal = parseInt(totalEl.textContent) || 0;
            totalEl.textContent = total;

            if (total !== prevTotal) {
                totalEl.classList.remove('flash-green', 'flash-red');
                void totalEl.offsetWidth;
                totalEl.classList.add(total > prevTotal ? 'flash-green' : 'flash-red');
                setTimeout(() => totalEl.classList.remove('flash-green', 'flash-red'), 600);
            }
        }
    }
};
