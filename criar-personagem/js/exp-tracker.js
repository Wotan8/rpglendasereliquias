/* ===== EXP TRACKER — Controle centralizado de EXP ===== */

const ExpTracker = {
    _listeners: [],

    /** Registra uma fonte de EXP */
    addSource(key, amount, label) {
        wizardState.expSources[key] = { amount, label };
        this._notify();
    },

    /** Remove uma fonte de EXP */
    removeSource(key) {
        delete wizardState.expSources[key];
        this._notify();
    },

    /** Retorna o EXP atual do pool (restante) */
    getTotal() {
        let total = 0;
        for (const src of Object.values(wizardState.expSources)) {
            total += src.amount;
        }
        return total;
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
        const ws = wizardState;
        const base = REGRAS_CRIACAO.atributos.base_inicial;
        let total = 0;

        for (const grupo of GRUPOS_ATRIBUTOS) {
            for (const attr of ATRIBUTOS[grupo]) {
                const nivelFinal = (ws.atributos[attr.key] || 0) + base;
                for (let nv = 1; nv <= nivelFinal; nv++) {
                    total += nv * 5;
                }
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
        const ws = wizardState;
        let total = 0;

        for (const [dotKey, nivel] of Object.entries(ws.pericias)) {
            if (nivel <= 0) continue;

            const skKey = dotKey.replace('sk_', '');
            let custoExp = 4;
            for (const cat of Object.values(window.SKILLS)) {
                const found = cat.find(s => s.key === skKey);
                if (found) {
                    custoExp = found.custoExp || 4;
                    break;
                }
            }

            for (let nv = 1; nv <= nivel; nv++) {
                total += nv * custoExp;
            }
        }
        return total;
    },

    calcExpTotal() {
        let totalSourcesGained = 0;
        for (const src of Object.values(wizardState.expSources)) {
            if (src.amount > 0) totalSourcesGained += src.amount;
        }
        return this.calcAttrExpTotal() + this.calcSkillExpTotal() + totalSourcesGained;
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
