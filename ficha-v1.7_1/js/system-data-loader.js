/* ===== SYSTEM DATA LOADER — Carrega dados do Firestore ===== */
/* Este arquivo é carregado como script regular (não module).
   As funções ficam disponíveis globalmente. O firebase.js (module)
   chama loadSystemData() passando db/collection/getDocs. */

window._systemData = {
    races: [],
    classes: [],
    tribes: [],
    peculiarities: [],
    mechanics: [],
    skills: [],
    conditions: [],
    equipment: [],
    maneuvers: [],
    spells: [],
    loaded: false,
    error: null
};

/* Inicializar CLASS_SKILLS e CLASS_RESOURCES como globais vazios
   (anteriormente hardcoded em data.js, agora vêm do Firebase) */
window.CLASS_SKILLS = {};
window.CLASS_RESOURCES = {};

/**
 * Carrega todas as coleções system/data/* do Firestore.
 * Chamada pelo firebase.js (module) que passa as referências do Firestore.
 * @param {object} db - instância do Firestore
 * @param {function} collectionFn - firebase collection()
 * @param {function} getDocsFn - firebase getDocs()
 */
async function loadSystemData(db, collectionFn, getDocsFn) {
    const collections = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics',
        'skills', 'conditions', 'equipment', 'maneuvers', 'spells'];

    try {
        await Promise.all(collections.map(async (col) => {
            const snap = await getDocsFn(collectionFn(db, `system/data/${col}`));
            window._systemData[col] = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) {
                    window._systemData[col].push({ id: d.id, ...data });
                }
            });
        }));

        window._systemData.loaded = true;
        console.log('✅ Dados do sistema carregados do Firebase:', {
            races: window._systemData.races.length,
            classes: window._systemData.classes.length,
            peculiarities: window._systemData.peculiarities.length,
            mechanics: window._systemData.mechanics.length,
        });

        return true;
    } catch (err) {
        window._systemData.error = err;
        console.error('❌ Erro ao carregar dados do sistema:', err);
        throw err; // Re-throw para o firebase.js tratar
    }
}

/**
 * Preenche o select #selRaca a partir dos dados do Firebase.
 */
function populateRaceSelect() {
    const racaEl = document.getElementById('selRaca');
    if (!racaEl) return;

    // Limpar options existentes (exceto a primeira "Selecione")
    racaEl.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

    const racas = window._systemData.races
        .filter(r => r.publicado !== false)
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    racas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nome;
        opt.textContent = r.nome;
        opt.dataset.raceId = r.id;
        racaEl.appendChild(opt);
    });

    console.log(`✅ Select de raças populado: ${racas.length} raças`);
}

/**
 * Preenche o select #selClasse a partir dos dados do Firebase.
 */
function populateClassSelect() {
    const classeEl = document.getElementById('selClasse');
    if (!classeEl) return;

    // Limpar options existentes (exceto a primeira "Selecione")
    classeEl.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

    const classes = window._systemData.classes
        .filter(c => c.publicado !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = c.nome;
        opt.dataset.classId = c.id;
        classeEl.appendChild(opt);
    });

    // Construir CLASS_SKILLS e CLASS_RESOURCES a partir do Firebase
    buildClassDataFromFirebase();

    console.log(`✅ Select de classes populado: ${classes.length} classes`);
}

/**
 * Constrói CLASS_SKILLS e CLASS_RESOURCES globais a partir dos dados do Firebase.
 */
function buildClassDataFromFirebase() {
    window.CLASS_SKILLS = {};
    window.CLASS_RESOURCES = {};

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;

        // Perícias de classe
        if (cls.pericClasse && Array.isArray(cls.pericClasse)) {
            window.CLASS_SKILLS[cls.nome] = cls.pericClasse.map(p => p.nome || p);
        }

        // Recursos de classe
        if (cls.recursosDaClasse && Array.isArray(cls.recursosDaClasse)) {
            window.CLASS_RESOURCES[cls.nome] = cls.recursosDaClasse.map(r => {
                // Adaptar formato do Firebase para o formato esperado pelo core.js
                if (typeof r === 'string') {
                    return { label: r, keys: [`cr_${r.toLowerCase()}`], single: true };
                }
                return r; // Já está no formato correto
            });
        } else {
            window.CLASS_RESOURCES[cls.nome] = [];
        }
    }
}

/**
 * Determina o ícone para uma peculiaridade com base em suas mecânicas.
 */
function determineIcon(pec, mecanicas) {
    if (pec.icone) return pec.icone;

    const hasNegativo = mecanicas.some(m =>
        m.tipo === 'modificar' && m.config?.operacao === '-'
    ) || (pec.tags || []).includes('negativo');

    if (hasNegativo) return '⚠️';
    if (mecanicas.some(m => m.tipo === 'conceder')) return '✨';
    if (mecanicas.some(m => m.tipo === 'distribuir')) return '📖';
    if (mecanicas.some(m => m.tipo === 'condicional')) return '🎲';
    if (mecanicas.some(m => m.tipo === 'modificar')) return '⚡';
    if (mecanicas.some(m => m.tipo === 'limitar')) return '🔒';
    return '📋';
}

/**
 * Constrói o objeto RACES a partir dos dados do Firebase.
 * Resolve peculiaridades e mecânicas por ID.
 */
function buildRacesFromFirebase() {
    const RACES = {};

    for (const race of window._systemData.races) {
        if (race.publicado === false) continue;

        // Resolver peculiaridades por ID
        const peculiaridades = (race.peculiaridadeIds || []).map(pecData => {
            const isObject = typeof pecData === 'object' && pecData !== null;
            const pecId = isObject ? pecData.id : pecData;
            const nivelInicial = isObject ? (pecData.nivelInicial || 1) : 1;

            const pec = window._systemData.peculiarities.find(p => p.id === pecId);
            if (!pec) {
                console.error(`⚠️ Peculiaridade ID "${pecId}" não encontrada para raça "${race.nome}"`);
                alert(`DEBUG: Peculiaridade ${pecId} não encontrada em ${window._systemData.peculiarities.length} peculiaridades carregadas.`);
                return null;
            }

            // Resolver mecânicas da peculiaridade
            const mecanicas = (pec.mecanicaIds || []).map(mechId => {
                const m = window._systemData.mechanics.find(m => m.id === mechId);
                if (!m) {
                    console.warn(`⚠️ Mecânica ID "${mechId}" não encontrada para peculiaridade "${pec.nome}"`);
                }
                return m;
            }).filter(Boolean);

            // Detectar se alguma mecânica é evoluível e construir progressão
            const evoluiveis = mecanicas.filter(m => m.evoluivel === true);
            let tipo = pec.tipo || 'fixo';
            let nivelMax = pec.nivelMax || null;
            let nivelAtual = nivelInicial;
            let niveis = pec.niveis || null;

            if (evoluiveis.length > 0) {
                tipo = 'evolutivo';
                // Usar o maior nivelMaximo entre todas as mecânicas evoluíveis
                nivelMax = Math.max(...evoluiveis.map(m => m.nivelMaximo || 3));

                // Detectar se alguma mecânica evoluível é do tipo "ganho" de EXP
                const isGanhoExp = evoluiveis.some(m => m.progressaoTipoExp === 'ganho');

                // Construir niveis{} a partir das progressões das mecânicas
                niveis = {};
                for (let i = 1; i <= nivelMax; i++) {
                    // Calcular custo: soma dos custos de todas as mecânicas evoluíveis neste nível
                    let custoTotal = 0;
                    const efeitosNivel = [];
                    for (const m of evoluiveis) {
                        const prog = m.progressao?.[String(i)];
                        if (prog) {
                            custoTotal += (prog.custoExp || 0);
                            // Gerar preview do efeito com config ajustada ao nível
                            const adjustedMech = JSON.parse(JSON.stringify(m));
                            delete adjustedMech.previewTexto; // Forçar geração dinâmica
                            if (m.tipo === 'modificar' && prog.valor !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, valor: prog.valor };
                            } else if (m.tipo === 'limitar' && prog.valorLimite !== undefined) {
                                if (adjustedMech.config.valorMaximo !== undefined) adjustedMech.config.valorMaximo = prog.valorLimite;
                                if (adjustedMech.config.valorMinimo !== undefined) adjustedMech.config.valorMinimo = prog.valorLimite;
                            } else if (m.tipo === 'distribuir') {
                                if (prog.valorPorAlvo !== undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valorPorAlvo };
                                if (prog.quantidadeAlvos !== undefined) adjustedMech.config = { ...adjustedMech.config, quantidadeAlvos: prog.quantidadeAlvos };
                            } else if (prog.descricao) {
                                // Narrativo/conceder: usar descrição do nível diretamente
                                efeitosNivel.push(prog.descricao);
                                continue;
                            }
                            efeitosNivel.push(typeof generatePreviewText === 'function' ? generatePreviewText(adjustedMech) : `${prog.valor}`);
                        }
                    }
                    const expLabel = isGanhoExp ? 'Ganho' : 'Custo';
                    niveis[i] = {
                        custo: custoTotal > 0 ? `${expLabel}: ${custoTotal} EXP` : 'Grátis',
                        custoExp: custoTotal,
                        tipoExp: isGanhoExp ? 'ganho' : 'custo',
                        efeito: efeitosNivel.join('; '),
                        // Guardar progressão individual de cada mecânica para este nível
                        mechProgressao: evoluiveis.reduce((acc, m) => {
                            const prog = m.progressao?.[String(i)];
                            if (prog) acc[m.id] = prog;
                            return acc;
                        }, {})
                    };
                }
            }

            // Gerar efeito a partir das mecânicas (para peculiaridades não-evolutivas)
            let efeito = '';
            if (tipo !== 'evolutivo') {
                const efeitoTexts = mecanicas.map(m => {
                    if (typeof generatePreviewText === 'function') {
                        return generatePreviewText(m);
                    }
                    // Fallback
                    if (m.tipo === 'narrativo') return m.config?.textoEfeito || m.descricao || '';
                    return m.descricao || '';
                }).filter(Boolean);
                efeito = efeitoTexts.join('; ') || pec.descricao || '';
            }

            return {
                id: pec.id,
                key: pec.id,
                nome: pec.nome,
                descricao: pec.descricao || '',
                efeito: efeito,
                nivel: pec.nivel || null,
                fonte: pec.fonte,
                mecanicas: mecanicas,
                negativo: mecanicas.some(m =>
                    m.tipo === 'modificar' && m.config?.operacao === '-'
                ) || (pec.tags || []).includes('negativo'),
                icone: determineIcon(pec, mecanicas),
                // Evolutivas
                tipo: tipo,
                nivelAtual: nivelAtual,
                nivelMax: nivelMax,
                niveis: niveis,
            };
        }).filter(Boolean);

        RACES[race.nome] = {
            id: race.id,
            tamanho: race.tamanho || 5,
            subtitulo: race.subtitulo || '',
            peculiaridades: peculiaridades,
        };
    }

    return RACES;
}
