/* ===== SYSTEM DATA LOADER — Wizard de Criação =====
   Versão simplificada do loader da ficha v1.7.
   Carrega as mesmas coleções, usa as mesmas funções de build.
   NÃO popula selects (o wizard renderiza cards).
   ===== */

window._systemData = {
    races: [], classes: [], tribes: [], peculiarities: [], mechanics: [],
    skills: [], conditions: [], equipment: [], maneuvers: [], spells: [],
    derivedValues: [], vitalStats: [], auras: [],
    loaded: false, error: null
};

window.RACES = {};
window.TRIBES = {};
window.SKILLS = {};
window.CLASS_SKILLS = {};
window.CLASS_RESOURCES = {};
window.CLASS_PECULIARITIES = {};
window.DERIVED_VALUES = [];
window.VITAL_STATS = [];
window.AURAS = [];
window.INDIVIDUAL_PECULIARITIES = [];

/**
 * Carrega todas as coleções system/data/* do Firestore.
 * Usa o db global (setado pelo firebase.js module).
 */
window.loadSystemData = async function () {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const collections = [
        'races', 'classes', 'tribes', 'peculiarities', 'mechanics',
        'skills', 'conditions', 'equipment', 'maneuvers', 'spells',
        'derivedValues', 'vitalStats', 'auras', 'bodyParts'
    ];

    try {
        await Promise.all(collections.map(async (col) => {
            const snap = await getDocs(collection(window.db, `system/data/${col}`));
            window._systemData[col] = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) {
                    window._systemData[col].push({ id: d.id, ...data });
                }
            });
        }));

        window._systemData.loaded = true;
        console.log('✅ Dados do sistema carregados:', {
            races: window._systemData.races.length,
            classes: window._systemData.classes.length,
            peculiarities: window._systemData.peculiarities.length,
            mechanics: window._systemData.mechanics.length,
            skills: window._systemData.skills.length,
            tribes: window._systemData.tribes.length
        });

        // Build derived structures
        buildSkillsFromFirebase();
        window.RACES = buildRacesFromFirebase();
        buildClassDataFromFirebase();
        buildTribesFromFirebase();
        buildIndividualPeculiarities();
        buildDerivedValuesFromFirebase();
        buildVitalStatsFromFirebase();

        if (window._systemData.auras) {
            window.AURAS = window._systemData.auras;
        }

        return true;
    } catch (err) {
        window._systemData.error = err;
        console.error('❌ Erro ao carregar dados do sistema:', err);
        throw err;
    }
};

/* ===== _resolvePeculiaridade ===== */
function _resolvePeculiaridade(pecData, sourceLabel) {
    const isObject = typeof pecData === 'object' && pecData !== null;
    const pecId = isObject ? pecData.id : pecData;
    const nivelInicial = isObject ? (pecData.nivelInicial || 1) : 1;

    const pec = window._systemData.peculiarities.find(p => p.id === pecId);
    if (!pec) {
        console.warn(`⚠️ Peculiaridade "${pecId}" não encontrada para ${sourceLabel}`);
        return null;
    }

    const mecanicas = (pec.mecanicaIds || []).map(mechId => {
        return window._systemData.mechanics.find(m => m.id === mechId);
    }).filter(Boolean);

    const evoluiveis = mecanicas.filter(m => m.evoluivel === true);
    let tipo = pec.tipo || 'fixo';
    let nivelMax = pec.nivelMax || null;
    let nivelAtual = nivelInicial;
    let niveis = pec.niveis || null;

    if (evoluiveis.length > 0) {
        tipo = 'evolutivo';
        nivelMax = Math.max(...evoluiveis.map(m => m.nivelMaximo || 3));
        const isGanhoExp = evoluiveis.some(m => m.progressaoTipoExp === 'ganho');

        niveis = {};
        for (let i = 1; i <= nivelMax; i++) {
            let custoTotal = 0;
            const efeitosNivel = [];
            for (const m of evoluiveis) {
                const prog = m.progressao?.[String(i)];
                if (prog) {
                    custoTotal += (prog.custoExp || 0);
                    const adjustedMech = JSON.parse(JSON.stringify(m));
                    if (m.tipo === 'narrativo') {
                        efeitosNivel.push(prog.textoEfeito || prog.descricao || m.config?.textoEfeito || '');
                    } else if (prog.descricao) {
                        efeitosNivel.push(prog.descricao);
                    } else {
                        efeitosNivel.push(`Nível ${i}`);
                    }
                }
            }
            const expLabel = isGanhoExp ? 'Ganho' : 'Custo';
            niveis[i] = {
                custo: custoTotal > 0 ? `${expLabel}: ${custoTotal} EXP` : 'Grátis',
                custoExp: custoTotal,
                tipoExp: isGanhoExp ? 'ganho' : 'custo',
                efeito: efeitosNivel.join('; ')
            };
        }
    }

    // Determine negativity
    const isNegativo = mecanicas.some(m =>
        m.tipo === 'modificar' && m.config?.operacao === '-'
    ) || (pec.tags || []).includes('negativo');

    // Icon
    let icone = pec.icone || '📋';
    if (!pec.icone) {
        if (isNegativo) icone = '⚠️';
        else if (mecanicas.some(m => m.tipo === 'conceder')) icone = '✨';
        else if (mecanicas.some(m => m.tipo === 'modificar')) icone = '⚡';
        else if (mecanicas.some(m => m.tipo === 'limitar')) icone = '🔒';
    }

    // Generate effect text
    let efeito = '';
    if (tipo !== 'evolutivo') {
        efeito = pec.descricao || '';
    }

    return {
        id: pec.id, key: pec.id, nome: pec.nome,
        descricao: pec.descricao || '', efeito,
        fonte: pec.fonte, mecanicas,
        negativo: isNegativo, icone, tipo,
        nivelAtual, nivelMax, niveis,
        auraVinculadaId: pec.auraVinculadaId || null,
        auraGrauConcedido: pec.auraGrauConcedido || 1,
        tags: pec.tags || [],
        ehVantagem: pec.ehVantagem === true,
        mecanicaExpCriacao: pec.mecanicaExpCriacao || [],
        quandoSeAplica: pec.quandoSeAplica || 'passivo'
    };
}
window._resolvePeculiaridade = _resolvePeculiaridade;

/* ===== buildRacesFromFirebase ===== */
function buildRacesFromFirebase() {
    const RACES = {};
    for (const race of window._systemData.races) {
        if (race.publicado === false) continue;
        const peculiaridades = (race.peculiaridadeIds || []).map(pd =>
            _resolvePeculiaridade(pd, `raça "${race.nome}"`)
        ).filter(Boolean);

        RACES[race.nome] = {
            id: race.id, subtitulo: race.subtitulo || '',
            peculiaridades
        };
    }
    console.log(`✅ RACES construído: ${Object.keys(RACES).length} raças`);
    return RACES;
}

/* ===== buildClassDataFromFirebase ===== */
function buildClassDataFromFirebase() {
    window.CLASS_SKILLS = {};
    window.CLASS_RESOURCES = {};
    window.CLASS_PECULIARITIES = {};

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;

        // Skills
        if (cls.periciasDaClasse && Array.isArray(cls.periciasDaClasse)) {
            window.CLASS_SKILLS[cls.nome] = cls.periciasDaClasse.map(sk =>
                typeof sk === 'object' ? sk.nome : sk
            ).filter(Boolean);
        }

        // Resources
        if (cls.recursosDaClasse && Array.isArray(cls.recursosDaClasse)) {
            window.CLASS_RESOURCES[cls.nome] = cls.recursosDaClasse;
        }

        // Peculiarities (bonusIniciais)
        if (cls.bonusIniciais && Array.isArray(cls.bonusIniciais) && cls.bonusIniciais.length > 0) {
            window.CLASS_PECULIARITIES[cls.nome] = cls.bonusIniciais.map(pd =>
                _resolvePeculiaridade(pd, `classe "${cls.nome}"`)
            ).filter(Boolean);
        }
    }
    console.log(`✅ Classes processadas: ${window._systemData.classes.length}`);
}

/* ===== buildTribesFromFirebase ===== */
function buildTribesFromFirebase() {
    window.TRIBES = {};
    for (const tribe of window._systemData.tribes) {
        if (tribe.publicado === false) continue;
        const peculiaridades = (tribe.peculiaridadeIds || []).map(pd =>
            _resolvePeculiaridade(pd, `tribo "${tribe.nome}"`)
        ).filter(Boolean);

        window.TRIBES[tribe.nome] = {
            id: tribe.id, subtitulo: tribe.subtitulo || '',
            peculiaridades
        };
    }
    console.log(`✅ TRIBES construído: ${Object.keys(window.TRIBES).length} tribos`);
}

/* ===== buildSkillsFromFirebase ===== */
function buildSkillsFromFirebase() {
    window.SKILLS = { mental: [], fisico: [], social: [], combate: [], exclusivo: [] };

    const sorted = [...window._systemData.skills].sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    for (const sk of sorted) {
        if (sk.publicado === false) continue;
        const cat = sk.categoria || 'mental';
        if (!window.SKILLS[cat]) window.SKILLS[cat] = [];

        const key = (sk.key || sk.nome || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_');

        window.SKILLS[cat].push({
            name: sk.nome,
            key: key,
            attr: sk.atributo || '',
            attrLabel: sk.atributoLabel || sk.atributo || '',
            atributoBase: sk.atributoBase,
            custoExp: sk.custoExp || 4,
            mecanicaIds: sk.mecanicaIds || [],
            descricao: sk.descricao || ''
        });
    }
    console.log('✅ Perícias carregadas:', {
        mental: window.SKILLS.mental.length,
        fisico: window.SKILLS.fisico.length,
        social: window.SKILLS.social.length,
        combate: window.SKILLS.combate.length
    });
}

/* ===== buildIndividualPeculiarities ===== */
function buildIndividualPeculiarities() {
    window.INDIVIDUAL_PECULIARITIES = window._systemData.peculiarities
        .filter(p => p.fonte === 'individual' && p.publicado !== false && (p.quandoSeAplica === 'na_criacao'))
        .map(p => _resolvePeculiaridade(p.id, 'individual'))
        .filter(Boolean);
    console.log(`✅ Peculiaridades individuais (na criação): ${window.INDIVIDUAL_PECULIARITIES.length}`);
}

/* ===== buildDerivedValuesFromFirebase ===== */
function buildDerivedValuesFromFirebase() {
    window.DERIVED_VALUES = window._systemData.derivedValues
        .filter(dv => dv.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
        .map(dv => ({
            id: dv.id,
            key: dv.key || dv.id,
            nome: dv.nome,
            formula: dv.formula || '',
            mecanicaIds: dv.mecanicaIds || [],
            campoAtual: dv.campoAtual || false,
            characterCreationRule: dv.characterCreationRule || false,
            characterCreationMin: dv.characterCreationMin !== undefined ? dv.characterCreationMin : -20,
            characterCreationMax: dv.characterCreationMax !== undefined ? dv.characterCreationMax : 20,
            todoPersonagem: dv.todoPersonagem || false
        }));
    console.log(`✅ Valores derivados: ${window.DERIVED_VALUES.length}`);
}

/* ===== buildVitalStatsFromFirebase ===== */
function buildVitalStatsFromFirebase() {
    window.VITAL_STATS = window._systemData.vitalStats
        .filter(vs => vs.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
        .map(vs => ({
            key: vs.key || vs.id,
            nome: vs.nome,
            icone: vs.icone || '❤️',
            mecanicaIds: vs.mecanicaIds || [],
            formula: vs.formula || ''
        }));
    console.log(`✅ Status vitais: ${window.VITAL_STATS.length}`);
}

