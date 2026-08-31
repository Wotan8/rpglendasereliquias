/* ===== SYSTEM DATA LOADER — Carrega dados do Firestore ===== */
/* Este arquivo é carregado como script regular (não module).
   As funções ficam disponíveis globalmente. O firebase.js (module)
   chama loadSystemData() passando db/collection/getDocs. */

/** Raça de criatura (tag 'Criatura') não entra em lista de escolha de jogador. */
function ehRacaDeCriatura(r) { return /criatura/i.test(String(r?.tags || '')); }

window._adjustMechanicForLevel = function(m, level) {
    const prog = m.progressao?.[String(level)];
    if (!prog) return m;

    const adjustedMech = JSON.parse(JSON.stringify(m));
    delete adjustedMech.previewTexto;
    adjustedMech._previewLevel = level;

    if (m.tipo === 'modificar' || m.tipo === 'limitar') {
        if (prog.termos && Array.isArray(adjustedMech.config?.calculos)) {
            for (const calc of adjustedMech.config.calculos) {
                if (Array.isArray(calc.equacao)) {
                    let fixoIdx = 0;
                    for (const term of calc.equacao) {
                        if (!term.tipo || term.tipo === 'fixo') {
                            const overrideVal = prog.termos[String(fixoIdx)];
                            if (overrideVal !== undefined && overrideVal !== '') {
                                term.valor = overrideVal;
                            }
                            fixoIdx++;
                        }
                    }
                }
            }
        } else if (m.tipo === 'modificar') {
            if (prog.valor !== undefined) {
                adjustedMech.config = { ...adjustedMech.config, valor: prog.valor };
            }
        } else if (m.tipo === 'limitar') {
            const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
            if (limVal !== undefined) {
                if (!adjustedMech.config) adjustedMech.config = {};
                const tipoLim = adjustedMech.config.tipoLimite;
                if (tipoLim === 'maximo' || adjustedMech.config.valorMaximo !== undefined) {
                    adjustedMech.config.valorMaximo = limVal;
                }
                if (tipoLim === 'minimo' || adjustedMech.config.valorMinimo !== undefined) {
                    adjustedMech.config.valorMinimo = limVal;
                }
                if (adjustedMech.config.valorMaximo === undefined && adjustedMech.config.valorMinimo === undefined) {
                    adjustedMech.config.valorMaximo = limVal;
                }
            }
        }
    } else if (m.tipo === 'distribuir') {
        if (prog.valorPorAlvo !== undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valorPorAlvo };
        if (prog.quantidadeAlvos !== undefined) adjustedMech.config = { ...adjustedMech.config, quantidadeAlvos: prog.quantidadeAlvos };
    } else if (m.tipo === 'narrativo') {
        if (prog.textoEfeito) {
            adjustedMech.config = { ...adjustedMech.config, textoEfeito: prog.textoEfeito };
        } else if (prog.descricao && adjustedMech.config) {
            delete adjustedMech.config.textoEfeito;
        }
    } else if (m.tipo === 'conceder') {
        if (prog.descricaoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, descricaoConcessao: prog.descricaoConcessao };
        if (prog.tipoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, tipoConcessao: prog.tipoConcessao };
    } else if (m.tipo === 'condicional') {
        if (prog.gatilho !== undefined) adjustedMech.config = { ...adjustedMech.config, gatilho: prog.gatilho };
        if (prog.textoSucesso !== undefined) adjustedMech.config = { ...adjustedMech.config, textoSucesso: prog.textoSucesso };
        if (prog.textoFalha !== undefined) adjustedMech.config = { ...adjustedMech.config, textoFalha: prog.textoFalha };
    }
    if (prog.descricao) {
        adjustedMech.descricao = prog.descricao;
    }

    return adjustedMech;
};

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
    derivedValues: [],
    vitalStats: [],
    specializations: [],  // kept for backward compat but no longer loaded
    auras: [],
    itemRules: [],
    runicElements: [],
    classModules: [],
    loaded: false,
    error: null
};

/* Inicializar CLASS_SKILLS e CLASS_TESTS como globais vazios
   (anteriormente hardcoded em data.js / class-tests-data.js, agora vêm do Firebase) */
window.CLASS_SKILLS = {};
// CLASS_TESTS será populado por buildClassTestsFromFirebase() ou pelo fallback em class-tests-data.js
window._classModules = {};

/**
 * Carrega todas as coleções system/data/* do Firestore.
 * Chamada pelo firebase.js (module) que passa as referências do Firestore.
 * @param {object} db - instância do Firestore
 * @param {function} collectionFn - firebase collection()
 * @param {function} getDocsFn - firebase getDocs()
 */
async function loadSystemData(db, collectionFn, getDocsFn) {
    const collections = ['races', 'classes', 'tribes', 'peculiarities', 'mechanics',
        'skills', 'conditions', 'equipment', 'maneuvers', 'spells', 'derivedValues', 'vitalStats', 'auras', 'itemRules', 'bodyParts', 'runicElements', 'classModules'];

    try {
        await Promise.all(collections.map(async (col) => {
            const snap = await getDocsFn(collectionFn(db, `system/data/${col}`));
            window._systemData[col] = [];
            snap.forEach(d => {
                const data = d.data();
                data.id = d.id;
                window._systemData[col].push(data);
            });
        }));

        window._systemData.loaded = true;

        // Disparar evento para scripts antigos saberem que os dados chegaram
        document.dispatchEvent(new Event('systemDataLoaded'));

        // Preencher options dos selects (Raças e Classes) se existirem
        populateRaceSelect();
        populateClassSelect();

        return true;
    } catch (e) {
        window._systemData.error = e.message;
        console.error("🔴 Erro ao carregar System Data:", e);
        throw e;
    }
}

/**
 * Preenche o select #selRaca a partir dos dados do Firebase.
 */
function populateRaceSelect() {
    const racaEl = document.getElementById('selRaca');
    if (!racaEl) return;

    // Limpar options existentes
    racaEl.innerHTML = '<option value="">(Raça)</option>';

    const racas = window._systemData.races
        // raça de bicho é publicada para as fichas de NPC referenciarem; jogador não escolhe
        .filter(r => r.publicado !== false && !ehRacaDeCriatura(r))
        .sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    racas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nome;
        opt.textContent = r.nome;
        opt.dataset.raceId = r.id;
        racaEl.appendChild(opt);
    });
}

/**
 * Preenche o select #selClasse a partir dos dados do Firebase.
 */
function populateClassSelect() {
    const classeEl = document.getElementById('selClasse');
    if (!classeEl) return;

    // Limpar options existentes
    classeEl.innerHTML = '<option value="">(Classe)</option>';

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

    // Construir CLASS_SKILLS a partir do Firebase
    buildClassDataFromFirebase();
}

/**
 * Constrói CLASS_SKILLS global a partir dos dados do Firebase.
 */
function buildClassDataFromFirebase() {
    window.CLASS_SKILLS = {};

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;

        // Perícias de classe (agora são IDs de skills)
        if (cls.pericClasse && Array.isArray(cls.pericClasse)) {
            window.CLASS_SKILLS[cls.nome] = cls.pericClasse.map(skillId => {
                // Pode ser um ID string ou um objeto antigo {nome}
                if (typeof skillId === 'object' && skillId.nome) return skillId.nome;
                // Buscar nome da perícia por ID
                const skill = window._systemData.skills.find(s => s.id === skillId);
                return skill ? skill.nome : skillId;
            });
        }
    }

    // Construir CLASS_TESTS a partir do Firebase (campo testesDeClasse de cada classe)
    buildClassTestsFromFirebase();

    // Construir módulos de classe a partir do Firebase (campo modulosDaClasse de cada classe)
    buildClassModulesFromFirebase();

    // Construir peculiaridades de classe a partir do Firebase (campo bonusIniciais de cada classe)
    buildClassPeculiaritiesFromFirebase();
}

/**
 * Tokens genéricos que devem ser ignorados ao extrair parts de uma fórmula.
 * São termos de equipamento/bônus que não correspondem a atributos, perícias ou referências DOM.
 */
const _FORMULA_IGNORE_TOKENS = new Set([
    'equip', 'equip.', 'b.arma', 'b.simbolo', 'b.símbolo', 'ferramenta', 'ferramentas',
    'instrumento', 'sacrifício', 'sacrificio', 'complexidade',
    'talismã profano', 'talismã', 'símbolo sagrado', 'simbolo sagrado'
]);

/**
 * Lista de abreviações de atributos reconhecidas.
 */
const _KNOWN_ATTRS = new Set(['FOR', 'DES', 'VIG', 'INT', 'RAC', 'PRS', 'PRE', 'MAN', 'AUT']);

/**
 * Extrai tokens de parts[] automaticamente a partir de uma string de fórmula.
 * Usado quando o criador não definir parts explicitamente no Firebase.
 * Reconhece:
 *   - Atributos: FOR, DES, INT, etc.
 *   - "X ou Y" → "X|Y" (escolha do maior)
 *   - Nomes de perícias/especializações (qualquer token não-genérico)
 *   - Referências DOM: @id
 * Ignora tokens genéricos como Equip., B.Arma, Ferramenta, etc.
 * @param {string} formula - ex: "FOR ou DES + Arma + Equip."
 * @returns {string[]} - ex: ["FOR|DES", "Arma"]
 */
function _parsePartsFromFormula(formula) {
    if (!formula || typeof formula !== 'string') return [];

    const parts = [];

    // Primeiro, tratar padrões "X ou Y" → combinar antes de split
    // Ex: "FOR ou DES + Arma" → tokens pré-processados
    const normalized = formula
        .replace(/−/g, '-')  // normalizar traço
        .replace(/\s*\+\s*/g, ' + ')  // normalizar espaçamento de +
        .replace(/\s*-\s*/g, ' - ');  // normalizar espaçamento de -

    // Split por + e - (separadores de termos)
    const rawTerms = normalized.split(/\s*[+\-]\s*/).map(t => t.trim()).filter(Boolean);

    for (const term of rawTerms) {
        // Detectar padrão "X ou Y" (escolha do maior)
        const ouMatch = term.match(/^(.+?)\s+ou\s+(.+)$/i);
        if (ouMatch) {
            const left = ouMatch[1].trim();
            const right = ouMatch[2].trim();
            // Só combinar se ambos forem atributos conhecidos
            if (_KNOWN_ATTRS.has(left) && _KNOWN_ATTRS.has(right)) {
                parts.push(`${left}|${right}`);
                continue;
            }
            // Se não são ambos atributos, tratar cada um separadamente
            if (!_FORMULA_IGNORE_TOKENS.has(left.toLowerCase())) parts.push(left);
            if (!_FORMULA_IGNORE_TOKENS.has(right.toLowerCase())) parts.push(right);
            continue;
        }

        // Referência DOM: @id
        if (term.startsWith('@')) {
            parts.push(term);
            continue;
        }

        // Ignorar tokens genéricos
        if (_FORMULA_IGNORE_TOKENS.has(term.toLowerCase())) continue;

        // Ignorar modificadores numéricos puros (ex: "2", "−2")
        if (/^\d+$/.test(term)) continue;

        // Token válido (atributo ou perícia)
        parts.push(term);
    }

    return parts;
}

/**
 * Constrói window.CLASS_TESTS a partir do campo testesDeClasse de cada classe no Firebase.
 * Se a classe não tiver testesDeClasse, usa CLASS_TESTS_FALLBACK (o hardcoded renomeado).
 * Suporta tanto o formato novo (mecanicaId) quanto o formato antigo (formula/parts).
 */
function buildClassTestsFromFirebase() {
    window.CLASS_TESTS = {};

    const fallback = (typeof CLASS_TESTS_FALLBACK !== 'undefined') ? CLASS_TESTS_FALLBACK : {};
    let fromFirebase = 0;
    let fromFallback = 0;

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;

        if (cls.testesDeClasse && Array.isArray(cls.testesDeClasse) && cls.testesDeClasse.length > 0) {
            // Usar dados do Firebase
            window.CLASS_TESTS[cls.nome] = {
                nome: cls.nome,
                testes: cls.testesDeClasse.map(t => {
                    // New format: mecanicaId linked
                    if (t.mecanicaId) {
                        const mech = window._systemData.mechanics.find(m => m.id === t.mecanicaId);
                        if (mech) {
                            const formula = _buildFormulaFromMechanic(mech);
                            const parts = _buildPartsFromMechanic(mech);
                            return {
                                nome: t.nome || '',
                                formula: formula,
                                quando: '',
                                parts: parts,
                                mecanicaId: t.mecanicaId,
                                mechData: mech
                            };
                        }
                        // Mechanic not found — show placeholder
                        return {
                            nome: t.nome || '',
                            formula: '(mecânica não encontrada)',
                            quando: '',
                            parts: [],
                            mecanicaId: t.mecanicaId
                        };
                    }
                    // Legacy format: manual formula/parts
                    return {
                        nome: t.nome || '',
                        formula: t.formula || '',
                        quando: t.quando || '',
                        parts: (t.parts && Array.isArray(t.parts) && t.parts.length > 0)
                            ? t.parts
                            : _parsePartsFromFormula(t.formula)
                    };
                })
            };
            fromFirebase++;
        } else if (fallback[cls.nome]) {
            // Usar fallback hardcoded
            window.CLASS_TESTS[cls.nome] = fallback[cls.nome];
            fromFallback++;
        }
        // Se não tem nem Firebase nem fallback, a classe simplesmente não aparece em CLASS_TESTS
    }

}

/**
 * Gera uma string de fórmula descritiva a partir de uma mecânica do tipo 'modificar'.
 * Ex: "+FOR + Briga + Equip." a partir dos calculos da mecânica.
 */
function _buildFormulaFromMechanic(mech) {
    if (!mech || mech.tipo !== 'modificar') return '';
    const config = mech.config || {};
    if (!Array.isArray(config.calculos) || config.calculos.length === 0) {
        // Legacy single-calc format
        const op = config.operacao || '+';
        const val = config.valor ?? '?';
        const alvo = Array.isArray(config.alvo) ? config.alvo.join(', ') : (config.alvo || '?');
        return `${op}${val} em ${alvo}`;
    }
    return config.calculos.map(c => {
        const op = c.operacao || '+';
        const val = _formatEquationForFormula(c.equacao);
        return `${op}${val} em ${c.alvo || '?'}`;
    }).join('; ');
}

/**
 * Formata uma equação para exibição como string de fórmula.
 */
function _formatEquationForFormula(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return '?';
    let str = '';
    for (let i = 0; i < equacao.length; i++) {
        const t = equacao[i];
        if (i > 0 && t.op) str += ` ${t.op} `;
        if (t.tipo === 'ficha') str += `[${t.ref || '?'}]`;
        else if (t.tipo === 'sort') str += `🎲${t.min ?? '?'}~${t.max ?? '?'}`;
        else str += (t.valor ?? '?');
    }
    return str;
}

/**
 * Constrói parts[] automaticamente a partir de uma mecânica do tipo 'modificar'.
 * Extrai referências da equação como tokens para o resolvedor de testes.
 */
function _buildPartsFromMechanic(mech) {
    if (!mech || mech.tipo !== 'modificar') return [];
    const config = mech.config || {};
    const parts = [];

    const processEquacao = (equacao) => {
        if (!Array.isArray(equacao)) return;
        for (const term of equacao) {
            if (term.tipo === 'ficha' && term.ref) {
                parts.push('@' + term.ref);
            } else if (term.tipo === 'fixo' && term.valor !== undefined && term.valor !== '') {
                // Check if it's a known attribute or skill name
                const val = String(term.valor).trim();
                if (/^[A-Z]{2,4}$/.test(val)) {
                    // Looks like an attribute abbreviation
                    parts.push(val);
                }
                // Skip numeric constants
            }
        }
    };

    if (Array.isArray(config.calculos)) {
        config.calculos.forEach(c => processEquacao(c.equacao));
    }

    return parts;
}


/**
 * Constrói window._classModules a partir do campo modulosDaClasse de cada classe no Firebase.
 * Suporta tanto o formato legado (objetos inline) quanto o novo formato (IDs referenciando classModules).
 * Cada módulo é normalizado com: id, tipo, titulo, icone, custoExpPorItem, custoExpLabel, mecanicaLimiteId, schema
 */
function buildClassModulesFromFirebase() {
    window._classModules = {};
    let totalModules = 0;
    const classModulesCollection = window._systemData.classModules || [];

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;
        if (!cls.modulosDaClasse || !Array.isArray(cls.modulosDaClasse) || cls.modulosDaClasse.length === 0) continue;

        window._classModules[cls.nome] = cls.modulosDaClasse.map(entry => {
            let mod;
            if (typeof entry === 'string') {
                // Novo formato: ID referenciando classModules collection
                mod = classModulesCollection.find(m => m.id === entry);
                if (!mod) {
                    console.warn(`⚠️ Módulo de classe não encontrado: ${entry} (classe: ${cls.nome})`);
                    return null;
                }
            } else if (typeof entry === 'object' && entry !== null) {
                // Formato legado: objeto inline
                mod = entry;
            } else {
                return null;
            }
            totalModules++;
            return {
                // Preserva campos extras (parâmetros de Runomancia, etc.)
                ...mod,
                id: mod.id || ('mod_' + (mod.titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '_')),
                tipo: mod.tipo || 'lista',
                titulo: mod.titulo || 'Módulo',
                icone: mod.icone || '📦',
                custoExpPorItem: mod.custoExpPorItem ?? 0,
                custoExpLabel: mod.custoExpLabel || '',
                mecanicaLimiteId: mod.mecanicaLimiteId || null,
                // Novos campos de configuração avançada
                limiteFixo: (mod.limiteFixo === undefined || mod.limiteFixo === null || mod.limiteFixo === '') ? null : Number(mod.limiteFixo),
                limiteMecanicaIds: Array.isArray(mod.limiteMecanicaIds) ? mod.limiteMecanicaIds : [],
                custoEquipamentos: Array.isArray(mod.custoEquipamentos) ? mod.custoEquipamentos : [],
                permitirCriacaoJogador: mod.permitirCriacaoJogador !== false,
                itensPredefinidos: Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [],
                schema: Array.isArray(mod.schema) ? mod.schema : []
            };
        }).filter(Boolean); // Remover nulls (módulos não encontrados)
    }


    // Registrar entradas MODULE_LIMIT no TARGET_MAP do mechanics-engine
    if (typeof populateTargetMapFromClassModules === 'function') {
        populateTargetMapFromClassModules();
    }
}

/**
 * Remove acentos/diacríticos de uma string.
 * Garante que chaves geradas (sk_, dv_) sejam ASCII puras,
 * compatíveis com TARGET_MAP hardcoded e state.dots salvos.
 */
function _stripAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Constrói o objeto SKILLS e SKILL_LIMITERS a partir dos dados do Firebase.
 * Substitui os dados hardcoded em data.js e exp-upgrade.js.
 */
function buildSkillsFromFirebase() {
    const ATTR_KEY_MAP = {
        'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
        'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
        'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut'
    };
    const CATEGORY_MAP = {
        'mental': 'mental', 'fisico': 'fisico', 'social': 'social',
        'combate': 'combate', 'exclusivo': 'exclusivo',
        // Legacy mappings
        'fisica': 'fisico', 'defensiva': 'combate', 'classe': 'exclusivo'
    };
    const CATEGORY_PREFIX = {
        'mental': 'sk_mental_', 'fisico': 'sk_fisico_',
        'social': 'sk_social_', 'combate': 'sk_combate_',
        'exclusivo': 'sk_exclusivo_'
    };

    window.SKILLS = { mental: [], fisico: [], social: [], combate: [], exclusivo: [] };
    window.SKILL_LIMITERS = {};
    window.SKILL_COSTS = {};

    const skills = window._systemData.skills.filter(s => s.publicado !== false);

    for (const s of skills) {
        const rawCat = (s.categoria || 'mental').toLowerCase();
        const cat = CATEGORY_MAP[rawCat] || 'mental';
        const prefix = CATEGORY_PREFIX[cat] || 'sk_mental_';
        const key = _stripAccents(s.nome.toLowerCase()).replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');

        // Build atributo display string
        const attrs = Array.isArray(s.atributoBase) ? s.atributoBase : (typeof s.atributoBase === 'string' && s.atributoBase ? s.atributoBase.split('/') : []);
        const sub = attrs.length > 0 ? attrs.join('/') : '—';

        // Add to SKILLS
        if (!window.SKILLS[cat]) window.SKILLS[cat] = [];
        window.SKILLS[cat].push({
            key: key,
            name: s.nome,
            sub: sub,
            descricao: s.descricao || '',
            custoEvolucao: s.custoEvolucao || 4,
            id: s.id,
            mecanicaIds: Array.isArray(s.mecanicaIds) ? s.mecanicaIds : [],
            // Perícia "exclusivo" SEM o flag é exclusiva de ninguém: entra na ficha
            // só pelo pericClasse da classe. O default true valia para as categorias
            // base (todas cadastradas com true) e vazava as exclusivas cadastradas por
            // script — as 3 rúnicas do Runimago apareciam para todo personagem.
            todoPersonagem: cat === 'exclusivo' ? s.todoPersonagem === true : s.todoPersonagem !== false
        });

        // Build SKILL_LIMITERS
        const fullKey = prefix + key;
        if (attrs.length > 0) {
            const attrKeys = attrs.map(a => ATTR_KEY_MAP[a.trim().toUpperCase()]).filter(Boolean);
            if (attrKeys.length > 0) {
                window.SKILL_LIMITERS[fullKey] = {
                    keys: attrKeys,
                    mode: attrKeys.length > 1 ? 'min' : undefined
                };
            }
        }

        // Build SKILL_COSTS
        window.SKILL_COSTS[fullKey] = s.custoEvolucao || 4;
    }

    // Sort each category alphabetically
    for (const cat of Object.keys(window.SKILLS)) {
        window.SKILLS[cat].sort((a, b) => a.name.localeCompare(b.name));
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
 * Resolve uma entrada de peculiaridade (ID ou {id, nivelInicial}) em um objeto completo.
 * Reutilizado por buildRacesFromFirebase(), buildClassPeculiaritiesFromFirebase(), buildTribesFromFirebase().
 * @param {string|object} pecData - ID da peculiaridade ou objeto {id, nivelInicial}
 * @param {string} sourceLabel - Label para mensagens de erro (ex: "raça Humano")
 * @returns {object|null} - Objeto de peculiaridade resolvido ou null
 */
function _resolvePeculiaridade(pecData, sourceLabel) {
    if (!pecData) return null;
    const isObject = typeof pecData === 'object' && pecData !== null;
    const pecId = isObject ? pecData.id : pecData;
    if (!pecId) return null;
    const nivelInicial = isObject ? (pecData.nivelInicial || 1) : 1;

    const pec = window._systemData.peculiarities.find(p => p.id === pecId);
    if (!pec) {
        console.warn(`⚠️ Peculiaridade ID "${pecId}" não encontrada para ${sourceLabel}`);
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
                    delete adjustedMech.previewTexto;
                    adjustedMech._previewLevel = i;

                    if (m.tipo === 'modificar' || m.tipo === 'limitar') {
                        if (prog.termos && Array.isArray(adjustedMech.config?.calculos)) {
                            for (const calc of adjustedMech.config.calculos) {
                                if (Array.isArray(calc.equacao)) {
                                    let fixoIdx = 0;
                                    for (const term of calc.equacao) {
                                        if (!term.tipo || term.tipo === 'fixo') {
                                            const overrideVal = prog.termos[String(fixoIdx)];
                                            if (overrideVal !== undefined && overrideVal !== '') {
                                                term.valor = overrideVal;
                                            }
                                            fixoIdx++;
                                        }
                                    }
                                }
                            }
                        } else if (m.tipo === 'modificar') {
                            if (prog.valor !== undefined) {
                                adjustedMech.config = { ...adjustedMech.config, valor: prog.valor };
                            }
                        } else if (m.tipo === 'limitar') {
                            const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
                            if (limVal !== undefined) {
                                if (!adjustedMech.config) adjustedMech.config = {};
                                const tipoLim = adjustedMech.config.tipoLimite;
                                if (tipoLim === 'maximo' || adjustedMech.config.valorMaximo !== undefined) {
                                    adjustedMech.config.valorMaximo = limVal;
                                }
                                if (tipoLim === 'minimo' || adjustedMech.config.valorMinimo !== undefined) {
                                    adjustedMech.config.valorMinimo = limVal;
                                }
                                if (adjustedMech.config.valorMaximo === undefined && adjustedMech.config.valorMinimo === undefined) {
                                    adjustedMech.config.valorMaximo = limVal;
                                }
                            }
                        }
                    } else if (m.tipo === 'distribuir') {
                        if (prog.valorPorAlvo !== undefined) adjustedMech.config = { ...adjustedMech.config, valorPorAlvo: prog.valorPorAlvo };
                        if (prog.quantidadeAlvos !== undefined) adjustedMech.config = { ...adjustedMech.config, quantidadeAlvos: prog.quantidadeAlvos };
                    } else if (m.tipo === 'narrativo') {
                        if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                        if (prog.textoEfeito) adjustedMech.config = { ...adjustedMech.config, textoEfeito: prog.textoEfeito };
                    } else if (m.tipo === 'conceder') {
                        if (prog.descricaoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, descricaoConcessao: prog.descricaoConcessao };
                        if (prog.tipoConcessao !== undefined) adjustedMech.config = { ...adjustedMech.config, tipoConcessao: prog.tipoConcessao };
                        if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                    } else if (m.tipo === 'condicional') {
                        if (prog.gatilho !== undefined) adjustedMech.config = { ...adjustedMech.config, gatilho: prog.gatilho };
                        if (prog.descricao) { efeitosNivel.push(prog.descricao); continue; }
                    } else if (prog.descricao) {
                        efeitosNivel.push(prog.descricao); continue;
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
            if (typeof generatePreviewText === 'function') return generatePreviewText(m);
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
        tipo: tipo,
        nivelAtual: nivelAtual,
        nivelMax: nivelMax,
        niveis: niveis,
        auraVinculadaId: pec.auraVinculadaId || null,
        auraGrauConcedido: pec.auraGrauConcedido || 1,
        derivedValueIds: pec.derivedValueIds || [],
    };
}

/**
 * Constrói o objeto RACES a partir dos dados do Firebase.
 * Resolve peculiaridades e mecânicas por ID.
 */
function buildRacesFromFirebase() {
    const RACES = {};

    for (const race of window._systemData.races) {
        if (race.publicado === false) continue;

        // Resolver peculiaridades por ID usando função reutilizável
        const peculiaridades = (race.peculiaridadeIds || []).map(pecData =>
            _resolvePeculiaridade(pecData, `raça "${race.nome}"`)
        ).filter(Boolean);

        // Parse derivedValueIds — suporta objetos {id, valorInicial} e strings legadas
        const parsedDVIds = (race.derivedValueIds || []).map(item =>
            typeof item === 'object' ? item : { id: item, valorInicial: 0 }
        );
        // Resolver partes do corpo
        const partesDoCorpo = (race.partesDoCorpo || []).map(pRef => {
            const bp = window._systemData.bodyParts.find(b => b.id === pRef.id);
            if (!bp) return null;
            return {
                ...bp,
                slots: pRef.slots || 1
            };
        }).filter(Boolean);

        RACES[race.nome] = {
            id: race.id,
            subtitulo: race.subtitulo || '',
            peculiaridades: peculiaridades,
            derivedValueIds: parsedDVIds,
            partesDoCorpo: partesDoCorpo,
        };
    }

    return RACES;
}

/**
 * Constrói window.CLASS_PECULIARITIES a partir do campo bonusIniciais de cada classe.
 * Resolve IDs de peculiaridades exatamente como buildRacesFromFirebase faz.
 * Chamada dentro de buildClassDataFromFirebase().
 */
function buildClassPeculiaritiesFromFirebase() {
    window.CLASS_PECULIARITIES = {};
    let total = 0;

    for (const cls of window._systemData.classes) {
        if (cls.publicado === false) continue;
        const bonus = Array.isArray(cls.bonusIniciais) ? cls.bonusIniciais : [];
        const pecs = Array.isArray(cls.peculiaridadeIds) ? cls.peculiaridadeIds : [];
        const pecIds = [...bonus, ...pecs];
        if (pecIds.length === 0) continue;

        const resolved = pecIds.map(pecData =>
            _resolvePeculiaridade(pecData, `classe "${cls.nome}"`)
        ).filter(Boolean);

        if (resolved.length > 0) {
            window.CLASS_PECULIARITIES[cls.nome] = resolved;
            total += resolved.length;
        }
    }

}

/**
 * Constrói window.TRIBES a partir dos dados do Firebase.
 * Resolve peculiaridades vinculadas por ID (campo peculiaridadeIds de cada tribo).
 */
function buildTribesFromFirebase() {
    window.TRIBES = {};

    for (const tribe of window._systemData.tribes) {
        if (tribe.publicado === false) continue;

        const peculiaridades = (tribe.peculiaridadeIds || []).map(pecData =>
            _resolvePeculiaridade(pecData, `tribo "${tribe.nome}"`)
        ).filter(Boolean);

        window.TRIBES[tribe.nome] = {
            id: tribe.id,
            peculiaridades: peculiaridades,
        };
    }

}

/**
 * Preenche o select #selTribo a partir dos dados do Firebase.
 */
function populateTribesSelect() {
    const el = document.getElementById('selTribo');
    if (!el) return;

    el.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

    const tribos = window._systemData.tribes
        .filter(t => t.publicado !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    tribos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.nome;
        opt.textContent = t.nome;
        opt.dataset.tribeId = t.id;
        el.appendChild(opt);
    });

}

/**
 * Constrói o array DERIVED_VALUES a partir do Firebase.
 * Resolve mecânicas vinculadas e prepara para renderização.
 */
function buildDerivedValuesFromFirebase() {
    const all = window._systemData.derivedValues.filter(d => d.publicado !== false);
    all.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    window.DERIVED_VALUES = all.map(dv => {
        // Resolver mecânicas vinculadas
        const mecanicas = (dv.mecanicaIds || []).map(mid => {
            return window._systemData.mechanics.find(m => m.id === mid);
        }).filter(Boolean);

        // Gerar key único para o valor derivado (usado em TARGET_MAP e display IDs)
        const key = _stripAccents(dv.nome.toUpperCase())
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/__+/g, '_')
            .replace(/^_|_$/g, '');

        // Gerar preview text das mecânicas
        const mechPreviews = mecanicas.map(m => {
            if (typeof generatePreviewText === 'function') return generatePreviewText(m);
            return m.previewTexto || m.descricao || '';
        }).filter(Boolean);

        return {
            id: dv.id,
            key: key,
            nome: dv.nome,
            icone: dv.icone || '📊',
            prefixo: dv.prefixo || '',
            sufixo: dv.sufixo || '',
            descricao: dv.descricao || '',
            ordem: dv.ordem || 99,
            todoPersonagem: dv.todoPersonagem === true,
            mecanicas: mecanicas,
            mecanicaIds: dv.mecanicaIds || [],
            mechPreviews: mechPreviews,
            campoAtual: dv.campoAtual === true,
            campoEditavel: dv.campoEditavel === true,
            // Fixa este VD no topo da aba Combate da ficha (Painel do Criador)
            statusCombate: dv.statusCombate === true,
            // '' = global (padrão) | 'coluna' = por item | 'dano' = por item, concatena no dano
            escopoItem: dv.escopoItem || '',
            // Exibe o valor de mesa (arredondado p/ baixo, mín. 1 se > 0) no campo,
            // e a fração exata no tooltip do nome. Ver Livro de Regras, 5.4.
            arredondaMesa: dv.arredondaMesa === true,
            // Nome do VD que este espelha (Blindagem Cortante espelha Blindagem).
            // Some da grid enquanto for igual ao espelhado.
            espelhaVD: dv.espelhaVD || '',
            blocoId: dv.blocoId || '',
            blocoNome: dv.blocoNome || '',
            blocoOrdem: dv.blocoOrdem,
        };
    });

    return window.DERIVED_VALUES;
}

/**
 * Constrói o array VITAL_STATS a partir do Firebase.
 * Resolve mecânicas vinculadas e prepara para uso no mechanics-engine.
 */
function buildVitalStatsFromFirebase() {
    const all = window._systemData.vitalStats.filter(d => d.publicado !== false);
    all.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    window.VITAL_STATS = all.map(vs => {
        // Resolver mecânicas vinculadas
        const mecanicas = (vs.mecanicaIds || []).map(mid => {
            return window._systemData.mechanics.find(m => m.id === mid);
        }).filter(Boolean);

        // Usar chaveInterna definida pelo criador (VIT_MAX, SAN_MAX, ENER_MAX)
        // Fallback: gerar key automaticamente a partir do nome
        const key = vs.chaveInterna || (_stripAccents(vs.nome.toUpperCase())
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/__+/g, '_')
            .replace(/^_|_$/g, '') + '_MAX');

        // Gerar preview text das mecânicas
        const mechPreviews = mecanicas.map(m => {
            if (typeof generatePreviewText === 'function') return generatePreviewText(m);
            return m.previewTexto || m.descricao || '';
        }).filter(Boolean);

        return {
            id: vs.id,
            key: key,
            nome: vs.nome,
            icone: vs.icone || '❤️',
            descricao: vs.descricao || '',
            ordem: vs.ordem || 99,
            mecanicas: mecanicas,
            mecanicaIds: vs.mecanicaIds || [],
            mechPreviews: mechPreviews,
        };
    });

    return window.VITAL_STATS;
}



/* ===== AURAS ===== */

/**
 * Atributos key → dotKey (attr_xxx)
 */
const _AURA_ATTR_TO_DOTKEY = {
    'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
    'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
    'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut'
};

/**
 * Constrói window.AURAS (array de definições de auras) e
 * window.AURA_BY_DOTKEY (mapa dotKey → aura definition) a partir dos dados do Firebase.
 */
function buildAurasFromFirebase() {
    const raw = window._systemData.auras || [];
    window.AURAS = [];
    window.AURA_BY_DOTKEY = {};

    for (const aura of raw) {
        const entry = {
            id: aura.id,
            nome: aura.nome || 'Aura sem nome',
            tipo: aura.tipo || 'propriedade',
            propriedadeVinculada: aura.propriedadeVinculada || '',
            propriedadeTipo: aura.propriedadeTipo || 'atributo',
            graus: (aura.graus || []).sort((a, b) => (a.grau || 0) - (b.grau || 0)),
            mecanicasPorGrau: {}
        };

        // Resolver mecânicas de cada grau
        for (const g of entry.graus) {
            const mechs = [];
            if (g.mecanicaIds && g.mecanicaIds.length > 0) {
                for (const mechId of g.mecanicaIds) {
                    const mech = (window._systemData.mechanics || []).find(m => m.id === mechId);
                    if (mech) mechs.push(mech);
                }
            }
            entry.mecanicasPorGrau[g.grau] = mechs;
        }

        window.AURAS.push(entry);

        // Build reverse index: dotKey → aura (only for 'propriedade' type)
        if (entry.tipo === 'propriedade' && entry.propriedadeVinculada) {
            const dotKey = _resolveAuraPropToDotKey(entry.propriedadeVinculada, entry.propriedadeTipo);
            if (dotKey) {
                window.AURA_BY_DOTKEY[dotKey] = entry;
            }
        }
    }

}

/**
 * Resolve o nome da propriedade vinculada ao dotKey correspondente.
 * @param {string} propName - Nome ou key da propriedade (e.g., 'FOR', 'Agilidade')
 * @param {string} propTipo - 'atributo', 'pericia', ou 'especializacao'
 * @returns {string|null} dotKey
 */
function _resolveAuraPropToDotKey(propName, propTipo) {
    if (!propName) return null;

    // Atributo: map abbreviation to dotKey
    if (propTipo === 'atributo') {
        const key = propName.toUpperCase();
        return _AURA_ATTR_TO_DOTKEY[key] || null;
    }

    // Perícia: find by name in loaded skills
    if (propTipo === 'pericia') {
        if (window.SKILLS) {
            for (const cat of Object.keys(window.SKILLS)) {
                for (const sk of window.SKILLS[cat]) {
                    if (sk.name === propName) return sk.dotKey;
                }
            }
        }
        return null;
    }



    return null;
}
