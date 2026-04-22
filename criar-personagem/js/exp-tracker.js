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

    /** Retorna o EXP total ganho */
    getTotal() {
        let total = 0;
        for (const src of Object.values(wizardState.expSources)) {
            total += src.amount;
        }
        return total;
    },

    /** Retorna EXP restante (total - gasto) */
    getRestante() {
        return this.getTotal(); // Na criação, EXP = restante (não há gasto separado)
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

    /** Atualiza o display visual de EXP */
    updateDisplay() {
        const el = document.getElementById('expValue');
        if (!el) return;
        const total = this.getTotal();
        const prev = parseInt(el.textContent) || 0;

        el.textContent = total;

        // Flash effect
        if (total !== prev) {
            el.classList.remove('flash-green', 'flash-red');
            void el.offsetWidth; // force reflow
            el.classList.add(total > prev ? 'flash-green' : 'flash-red');
            setTimeout(() => el.classList.remove('flash-green', 'flash-red'), 600);
        }
    }
};
