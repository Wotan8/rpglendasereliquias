/* ===== MEMORY MANAGER — Coleta e compilação de memórias ===== */

const MemoryManager = {
    /** Fases que contam para o bônus de EXP (obrigatórias) */
    REQUIRED_PHASES: [
        'linhagem_raca', 'linhagem_classe',
        'origens', 'peculiaridades', 'corpo', 'corpo_adicional',
        'habilidades', 'habilidades_fraco',
        'alma_virtude', 'alma_vicio', 'vespera'
    ],

    /** Salva uma memória */
    set(phaseKey, text) {
        wizardState.memorias[phaseKey] = text;
        this._updateExpBonus();
        if (typeof saveWizardToStorage === 'function') saveWizardToStorage();
    },

    /** Retorna uma memória */
    get(phaseKey) {
        return wizardState.memorias[phaseKey] || '';
    },

    /** Retorna todas as memórias não-vazias */
    getAll() {
        const result = {};
        for (const [key, val] of Object.entries(wizardState.memorias)) {
            if (val && val.trim()) result[key] = val;
        }
        return result;
    },

    /** Total de fases obrigatórias */
    getRequiredCount() {
        return this.REQUIRED_PHASES.length;
    },

    /** Quantas obrigatórias foram escritas */
    getWrittenCount() {
        let count = 0;
        for (const key of this.REQUIRED_PHASES) {
            if (wizardState.memorias[key] && wizardState.memorias[key].trim()) count++;
        }
        return count;
    },

    /** True se TODAS as obrigatórias foram escritas */
    hasBonus() {
        return this.getWrittenCount() >= this.getRequiredCount();
    },

    /** Atualiza o EXP de bônus de memórias */
    _updateExpBonus() {
        if (this.hasBonus()) {
            ExpTracker.addSource('memorias_bonus', REGRAS_CRIACAO.memorias.exp_bonus_completo, 'Bônus: Todas as memórias escritas');
        } else {
            ExpTracker.removeSource('memorias_bonus');
        }
    },

    /** Compila todas as memórias em uma Nota formatada */
    compile(charName) {
        const memorias = this.getAll();
        if (Object.keys(memorias).length === 0) return null;

        const PHASE_LABELS = {
            linhagem_raca: '🧬 Raça',
            linhagem_classe: '⚔️ Classe',
            origens: '🏕️ Tribo',
            origens_adicional: '🍖 O Sabor de Casa',
            peculiaridades: '✨ Peculiaridades',
            corpo: '💪 Memória dos pontos forte',
            corpo_adicional: '💪 Memória dos pontos fraco',
            habilidades: '📚 Memória das melhores habilidades',
            habilidades_fraco: '📚 Memória das piores habilidades',
            alma_virtude: '💫 Memória da Virtude',
            alma_vicio: '🔥 Memória do Vicio',
            alma_adicional: '💭 Sonho ou Pesadelo',
            lacos_promessa: '🤝 A Promessa',
            equipamento_objeto: '🎒 O Objeto Pessoal',
            vespera: '🌅 A Véspera da Partida'
        };

        let conteudo = '';
        for (const [key, text] of Object.entries(memorias)) {
            const label = PHASE_LABELS[key] || key;
            conteudo += `<b>${label}</b><br>${text.replace(/\n/g, '<br>')}<br><br>`;
        }

        return {
            id: 'note-memories-' + Date.now(),
            titulo: `📖 Memórias de ${charName || 'Personagem'}`,
            conteudo: conteudo.trim(),
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };
    }
};
