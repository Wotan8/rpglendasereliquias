/* ===== MEMORY MANAGER — Coleta e compilação de memórias ===== */

const MemoryManager = {
    /** Fases que contam para o bônus de EXP (obrigatórias) */
    REQUIRED_PHASES: [
        'convite', 'linhagem_raca', 'linhagem_classe',
        'origens', 'peculiaridades', 'corpo', 'habilidades',
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
            convite: '📜 O Convite',
            linhagem_raca: '🧬 A Linhagem — Raça',
            linhagem_classe: '⚔️ A Linhagem — Classe',
            origens: '🏕️ As Origens',
            origens_opcional: '🍖 O Sabor de Casa',
            peculiaridades: '✨ Peculiaridades',
            corpo: '💪 O Corpo e a Mente',
            corpo_opcional: '🩹 A Cicatriz',
            habilidades: '📚 As Habilidades',
            alma_virtude: '💫 A Alma — Virtude',
            alma_vicio: '🔥 A Alma — Vício',
            alma_opcional: '💭 Sonho ou Pesadelo',
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
