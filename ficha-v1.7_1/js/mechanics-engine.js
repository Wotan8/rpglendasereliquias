console.log("🧩 mechanics-engine v2.1 — cadeias + multi-booleano ATIVOS");
/* ===== MECHANICS ENGINE — Interpreta mecânicas do Firebase ===== */

/**
 * TARGET_MAP: Mapeia config.alvo (nome legível) → campo na ficha
 * Categorias:
 *   "attr_xxx"    → aplica em state.mechanicBonuses como bônus separado
 *   "sk_xxx"      → aplica em state.mechanicBonuses como bônus separado
 *   "DERIVED:XXX" → aplica como modificador na fórmula derivada (recalcAll)
 *   "field:xxx"   → aplica no campo data-key do DOM
 *   "INFO:xxx"    → apenas informativo, não altera cálculo
 */
const TARGET_MAP = {
    // === ATRIBUTOS ===
    "INT": "attr_int",
    "RAC": "attr_rac",
    "PRS": "attr_prs",
    "FOR": "attr_for",
    "DES": "attr_des",
    "VIG": "attr_vig",
    "PRE": "attr_pre",
    "MAN": "attr_man",
    "AUT": "attr_aut",
    // Aliases por nome completo
    "Inteligência": "attr_int",
    "Raciocínio": "attr_rac",
    "Perseverança": "attr_prs",
    "Força": "attr_for",
    "Destreza": "attr_des",
    "Vigor": "attr_vig",
    "Presença": "attr_pre",
    "Manipulação": "attr_man",
    "Autocontrole": "attr_aut",

    // === STATUS VITAIS (gerenciados por mecânicas do Firebase) ===
    "Vitalidade Máxima": "DERIVED:VIT_MAX",
    "Energia Máxima": "DERIVED:ENER_MAX",
    "Sanidade Máxima": "DERIVED:SAN_MAX",

    // === CAMPOS DA FICHA ===
    "Blindagem": "field:blindagem",

    // === VALORES DERIVADOS: vêm do Firebase via populateTargetMapFromDerivedValues() ===

    // === PERÍCIAS MENTAIS ===
    "Abismo": "sk_mental_abismo",
    "Alquimancia": "sk_mental_alquimia",
    "Alquimia": "sk_mental_alquimia",
    "Essência": "sk_mental_essencia",
    "Fluxomancia": "sk_mental_essencia",
    "Erudição": "sk_mental_historia",
    "História": "sk_mental_historia",
    "Herbalismo": "sk_mental_herbalismo",
    "Investigação": "sk_mental_investigacao",
    "Medicina": "sk_mental_medicina",
    "Ofícios": "sk_mental_oficio_int",
    "Ofício Intel.": "sk_mental_oficio_int",
    "Religião": "sk_mental_reliquia",
    "Relíquia": "sk_mental_reliquia",
    "Runomancia": "sk_mental_runomancia",

    // === PERÍCIAS FÍSICAS ===
    "Agilidade": "sk_fisico_agilidade",
    "Arma": "sk_fisico_arma",
    "Arremessar": "sk_fisico_arremessar",
    "Atletismo": "sk_fisico_atletismo",
    "Briga": "sk_fisico_briga",
    "Disparo": "sk_fisico_disparo",
    "Furtividade": "sk_fisico_furtividade",
    "Montaria": "sk_fisico_montaria",
    "Ofício Braç.": "sk_fisico_oficio_brac",
    "Sobrevivência": "sk_fisico_sobrevivencia",

    // === PERÍCIAS SOCIAIS ===
    "Barganha": "sk_social_barganha",
    "Diplomacia": "sk_social_diplomacia",
    "Domar": "sk_social_domar",
    "Empatia": "sk_social_empatia",
    "Intimidação": "sk_social_intimidacao",
    "Liderança": "sk_social_lideranca",
    "Malandragem": "sk_social_malandragem",
    "Performance": "sk_social_performance",
    "Sedução": "sk_social_seducao",
    "Observação": "sk_social_observacao",

    // === PERÍCIAS DEFENSIVAS / COMBATE ===
    "Esquiva": "sk_combate_esquiva",
    "Aparar": "sk_combate_aparar",
    "Bloquear": "sk_combate_bloquear",
    "Desviar": "sk_combate_desviar",
    "Evadir": "sk_combate_evadir",
    "Cobertura": "sk_combate_cobertura",
    "Proteger": "sk_combate_proteger",
    "Reflexo": "sk_combate_reflexo",
    "Contra-Ataque": "sk_combate_contra_ataque",
    "Contra-Ataq.": "sk_combate_contra_ataque",
    "Ambidestria": "sk_combate_ambidestria",

    // === PROPRIEDADES DE COMBATE ===
    // "Alvo de Ataque", "Alvo de Defesa", "Dano" e "Dano Crítico" eram alvos
    // "INFO:" — gravavam em state.mechanicBonuses e ninguém lia: a mecânica
    // salvava e não acontecia nada. Foram removidos para que o alvo apareça
    // como aviso no console em vez de falhar em silêncio.
    // Migração: cadastre um Valor Derivado com esse nome no Painel do Criador
    // (ex: "Acerto", "Bônus de Dano") — populateTargetMapFromDerivedValues()
    // registra o nome automaticamente e a mecânica volta a funcionar, agora
    // com Escopo por Item se você quiser um valor por arma equipada.
    "Ações por turno": "INFO:acoes_turno",

    // === EXPERIÊNCIA ===
    "EXP": "EXP_MODIFIER",
};

/**
 * Popula TARGET_MAP com perícias carregadas dinamicamente do Firebase.
 * Chamada após buildSkillsFromFirebase() para registrar skills criadas no painel.
 */
function populateTargetMapFromSkills() {
    if (!window.SKILLS) return;
    const CATEGORY_PREFIX = {
        'mental': 'sk_mental_', 'fisico': 'sk_fisico_',
        'social': 'sk_social_', 'combate': 'sk_combate_',
        'exclusivo': 'sk_exclusivo_'
    };
    for (const cat of Object.keys(window.SKILLS)) {
        const pfx = CATEGORY_PREFIX[cat] || 'sk_mental_';
        for (const sk of window.SKILLS[cat]) {
            // SEMPRE sobrescreve para garantir que o key dinâmico (Firebase)
            // coincida com o key usado nos dots/state (pode ter acentos)
            TARGET_MAP[sk.name] = pfx + sk.key;
            TARGET_MAP['Perícia: ' + sk.name] = pfx + sk.key;
        }
    }
    if (window.CLASS_SKILLS) {
        for (const cl of Object.keys(window.CLASS_SKILLS)) {
            for (const sk of window.CLASS_SKILLS[cl]) {
                const key = 'sk_classe_' + sk.toLowerCase().replace(/[^a-z0-9]/g, '_');
                TARGET_MAP[sk] = key;
                TARGET_MAP['Perícia: ' + sk] = key;
            }
        }
    }
    console.log('✅ TARGET_MAP atualizado com perícias do Firebase (incluindo de classe)');
}

/**
 * Popula TARGET_MAP com valores derivados do Firebase.
 * Chamada após buildDerivedValuesFromFirebase().
 */
function populateTargetMapFromDerivedValues() {
    if (!window.DERIVED_VALUES) return;
    for (const dv of window.DERIVED_VALUES) {
        // Guarda de colisão: perícias/atributos são registrados ANTES dos DVs
        // (firebase.js chama populateTargetMapFromSkills primeiro). Um DV com o
        // mesmo nome de uma perícia sobrescreve o alvo dela e quebra, em silêncio,
        // toda mecânica que mirava a perícia. Renomeie o DV (ex: "Teste de Esquiva").
        const anterior = TARGET_MAP[dv.nome];
        if (anterior && !anterior.startsWith('DERIVED:')) {
            console.warn(
                `⚠️ Colisão de alvo: o Valor Derivado "${dv.nome}" sobrescreve "${anterior}" ` +
                `(perícia/atributo de mesmo nome) no TARGET_MAP. Mecânicas que miravam ` +
                `"${dv.nome}" passarão a afetar o Valor Derivado. Renomeie um dos dois ` +
                `no Painel do Criador — ex: "Teste de ${dv.nome}".`
            );
        }
        // Registrar/sobrescrever por nome legível → DERIVED:KEY
        // SEMPRE sobrescreve para garantir que o key dinâmico (Firebase)
        // coincida com o key usado em recalcAll/_applyMechanicModifiers
        TARGET_MAP[dv.nome] = `DERIVED:${dv.key}`;

        // Se DV tem campoAtual, registrar também entries para (Atual) e (Máximo)
        if (dv.campoAtual) {
            TARGET_MAP[`${dv.nome} (Atual)`] = `field:dv_${dv.key}_atual`;
            TARGET_MAP[`${dv.nome} (Máximo)`] = `DERIVED:${dv.key}`;
        }
    }
    console.log('✅ TARGET_MAP atualizado com valores derivados do Firebase');
}

/**
 * Popula TARGET_MAP com status vitais do Firebase.
 * Chamada após buildVitalStatsFromFirebase().
 * Os status vitais usam DERIVED:KEY (ex: DERIVED:VITALIDADE_MAX)
 * e os entries hardcoded (ex: "Vitalidade Máxima" → DERIVED:VIT_MAX)
 * já existem no TARGET_MAP estático, mas esta função garante
 * que nomes do Firebase sobrescrevam corretamente.
 */
function populateTargetMapFromVitalStats() {
    if (!window.VITAL_STATS) return;
    for (const vs of window.VITAL_STATS) {
        // Registrar como DERIVED:KEY (mesma lógica dos DVs)
        TARGET_MAP[`${vs.nome} Máxima`] = `DERIVED:${vs.key}`;
        TARGET_MAP[`${vs.nome} Máximo`] = `DERIVED:${vs.key}`;
        
        let baseKey = vs.key.replace(/_MAX$/i, '').replace(/_MAXIMO$/i, '').toLowerCase();
        TARGET_MAP[`${vs.nome} Atual`] = `ATUAL:${baseKey}_atual`;
    }
    console.log('✅ TARGET_MAP atualizado com status vitais do Firebase');
}

/**
 * Popula TARGET_MAP com partes do corpo do Firebase.
 * Permite que mecânicas alterem dinamicamente o número de slots anatômicos.
 */
function populateTargetMapFromBodyParts() {
    if (!window._systemData || !window._systemData.bodyParts) return;
    for (const bp of window._systemData.bodyParts) {
        TARGET_MAP[`Parte do Corpo: ${bp.nome}`] = `slot_${bp.id}`;
    }
    console.log('✅ TARGET_MAP atualizado com partes do corpo do Firebase');
}

/**
 * Popula TARGET_MAP com entradas MODULE_LIMIT para módulos de classe.
 * Permite que mecânicas usem "Limite: [titulo]" como alvo.
 * Chamada por buildClassModulesFromFirebase() após carregar os módulos.
 */
function populateTargetMapFromClassModules() {
    if (!window._classModules) return;
    let count = 0;
    for (const classeNome of Object.keys(window._classModules)) {
        for (const mod of window._classModules[classeNome]) {
            if (mod.mecanicaLimiteId) {
                TARGET_MAP['Limite: ' + mod.titulo] = 'MODULE_LIMIT:' + mod.id;
                count++;
            }
        }
    }
    if (count > 0) console.log(`✅ TARGET_MAP atualizado com ${count} limite(s) de módulo`);
}

/**
 * Pool map: mapeia nomes de pool (usados em mecânicas distribuir) para listas de alvos válidos.
 * Usa o array SKILLS (data.js) como fonte canônica de nomes para evitar aliases/duplicatas.
 */
/* =====================================================================
   ᛟ ELEMENTOS RÚNICOS COMO ALVOS DE DISTRIBUIÇÃO
   ---------------------------------------------------------------------
   O Painel do Criador grava alvos rúnicos como "Elemento Rúnico: <nome>".
   Aqui eles NÃO entram em state.mechanicBonuses (não são atributo nem
   perícia): eles concedem NÍVEIS DE DOMÍNIO, guardados em
   state.runomancia.concedidos = { [elementId]: nivel }.

   Esse mapa é RECONSTRUÍDO do zero a cada recálculo (clearMechanicBonuses),
   então aplicar a mesma mecânica várias vezes nunca duplica níveis.
   O nível efetivo do personagem = aprendidos (estudado) + concedidos.
   ===================================================================== */
const RUNIC_TARGET_PREFIX = 'Elemento Rúnico: ';

function _runicAll() {
    return (window._systemData?.runicElements || []).filter(e => e && e.nome);
}

function isRunicTarget(nome) {
    return typeof nome === 'string' && nome.startsWith(RUNIC_TARGET_PREFIX);
}

/** Resolve "Elemento Rúnico: Fogo" → doc do elemento (por nome, latim ou id). */
function runicElementFromTarget(nome) {
    if (!isRunicTarget(nome)) return null;
    const bruto = nome.slice(RUNIC_TARGET_PREFIX.length).trim();
    const alvo = bruto.toLowerCase();
    const all = _runicAll();

    const porNome = all.filter(e => String(e.nome || '').trim().toLowerCase() === alvo);
    if (porNome.length > 1) {
        console.warn(
            `ᛟ Há ${porNome.length} Elementos Rúnicos cadastrados com o nome "${bruto}" ` +
            `(ids: ${porNome.map(e => e.id).join(', ')}). O alvo é resolvido por nome, ` +
            `então o nível pode ser lido do documento errado. Remova a duplicata no ` +
            `Painel do Criador → ᛟ Elementos Rúnicos.`
        );
    }
    return porNome[0]
        || all.find(e => String(e.nomeLatim || '').trim().toLowerCase() === alvo)
        || all.find(e => String(e.id || '') === bruto)
        || null;
}

/** Nível máximo de um elemento (padrão do Compêndio: Sigilus 3, demais 5). */
function runicMaxNivel(el) {
    const n = Number(el?.maxNivel);
    if (Number.isFinite(n) && n > 0) return n;
    return String(el?.tipoElemento || '').toLowerCase() === 'sigilus' ? 3 : 5;
}

function _runoStateSafe() {
    // NÃO usar `window.state` aqui: `state` é um binding léxico global
    // (let, em app.js) e não é propriedade de window. Escrever
    // `window.state = {}` criaria um objeto decoy paralelo ao estado real.
    if (typeof state === 'undefined') return { estudos: [], aprendidos: {}, grimorio: [], concedidos: {}, concedidosDetalhe: [] };
    if (!state.runomancia) state.runomancia = { estudos: [], aprendidos: {}, grimorio: [] };
    if (!state.runomancia.aprendidos) state.runomancia.aprendidos = {};
    if (!state.runomancia.concedidos) state.runomancia.concedidos = {};
    if (!Array.isArray(state.runomancia.concedidosDetalhe)) state.runomancia.concedidosDetalhe = [];
    return state.runomancia;
}

/** Zera as concessões rúnicas vindas de mecânicas (chamado a cada recálculo). */
function clearRunicGrants() {
    const runo = _runoStateSafe();
    runo.concedidos = {};
    runo.concedidosDetalhe = [];
}

/**
 * Aplica (idempotentemente) um alvo rúnico escolhido numa distribuição.
 * Respeita o Nível Máximo do elemento, considerando o que já foi estudado.
 */
function applyRunicGrant(alvoNome, valor, operacao, mech, parentPec) {
    const el = runicElementFromTarget(alvoNome);
    if (!el) { console.warn(`ᛟ Elemento Rúnico não encontrado: ${alvoNome}`); return false; }

    const runo = _runoStateSafe();
    const base = Number(runo.aprendidos[el.id] || 0);
    const atualConcedido = Number(runo.concedidos[el.id] || 0);
    const v = Number(valor) || 0;
    const max = runicMaxNivel(el);

    let novo;
    if (operacao === '=') novo = Math.max(0, v - base);
    else if (operacao === '-') novo = atualConcedido - v;
    else novo = atualConcedido + v;

    // Teto: base + concedido nunca ultrapassa o Nível Máximo do elemento
    novo = Math.max(0, Math.min(novo, Math.max(0, max - base)));

    runo.concedidos[el.id] = novo;
    runo.concedidosDetalhe.push({
        elementId: el.id,
        nome: el.nome,
        valor: v,
        operacao: operacao || '+',
        mechId: mech?.id || '',
        fonte: parentPec?.nome || mech?.nome || ''
    });
    return true;
}

/** Nível concedido por mecânicas (sem contar o estudo). */
function runicNivelConcedido(elementId) {
    if (typeof state === 'undefined') return 0;
    return Number(state?.runomancia?.concedidos?.[elementId] || 0);
}

/** Nível efetivo = estudado + concedido por mecânicas. */
function runicNivelEfetivo(elementId) {
    if (typeof state === 'undefined') return 0;
    const runo = state?.runomancia || {};
    return Number(runo.aprendidos?.[elementId] || 0) + runicNivelConcedido(elementId);
}

window.isRunicTarget = isRunicTarget;
window.runicElementFromTarget = runicElementFromTarget;
window.runicMaxNivel = runicMaxNivel;
window.runicNivelConcedido = runicNivelConcedido;
window.runicNivelEfetivo = runicNivelEfetivo;
window.RUNIC_TARGET_PREFIX = RUNIC_TARGET_PREFIX;

/**
 * Normaliza um nome de pool para comparação: minúsculas, sem acentos e sem
 * diferença entre NFC/NFD. O texto do pool viaja Painel → Firestore → ficha e
 * pode ser editado à mão, então nunca comparamos a string crua.
 */
function _normPool(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Monta a lista de alvos de um pool rúnico ("Elementos Rúnicos: ...").
 * Retorna nomes já prefixados, prontos para o TARGET/alvo da distribuição.
 */
function getRunicPool(poolName) {
    const p = _normPool(poolName);
    let list = _runicAll();

    const fam = p.includes('artus') ? 'artus'
        : p.includes('aspectus') ? 'aspectus'
            : p.includes('sigilus') ? 'sigilus' : '';
    if (fam) list = list.filter(e => _normPool(e.tipoElemento) === fam);

    const CATS = ['captador', 'condutor', 'modulador', 'logico', 'armazenador', 'emissor', 'exaustor'];
    for (const cat of CATS) {
        if (p.includes(cat)) { list = list.filter(e => _normPool(e.categoria) === cat); break; }
    }

    const COMPLEX = ['iniciante', 'intermediario', 'avancado', 'mestre'];
    if (p.includes('complexidade')) {
        for (const cx of COMPLEX) {
            if (p.includes(cx)) { list = list.filter(e => _normPool(e.complexidade) === cx); break; }
        }
    }

    return list
        .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || (a.nome || '').localeCompare(b.nome || ''))
        .map(e => RUNIC_TARGET_PREFIX + e.nome);
}

/** Detecta se um nome de pool se refere a Elementos Rúnicos. */
function isRunicPool(poolName) {
    const p = _normPool(poolName);
    return p.includes('elemento') && p.includes('runic');
}

function getDistribuirPool(poolName) {
    if (!poolName) return [];
    const p = poolName.toLowerCase();

    // ᛟ Pools de Elementos Rúnicos (Runomancia)
    if (isRunicPool(poolName)) {
        const lista = getRunicPool(poolName);
        if (!lista.length) {
            console.warn(`ᛟ Pool rúnico "${poolName}" não retornou elementos. ` +
                `Elementos carregados: ${_runicAll().length}. ` +
                `Verifique se system/data/runicElements foi carregado em window._systemData.`);
        }
        return lista;
    }

    // Helper: extrai nomes canônicos de uma ou mais categorias do SKILLS
    const fromSkills = (...categories) => {
        const names = [];
        for (const cat of categories) {
            if (SKILLS[cat]) {
                for (const sk of SKILLS[cat]) {
                    names.push(sk.name);
                }
            }
        }
        return names;
    };

    if (p.includes('perícia') && p.includes('qualquer')) {
        return fromSkills('mental', 'fisico', 'social', 'combate');
    }
    if (p.includes('perícia') && p.includes('mental')) {
        return fromSkills('mental');
    }
    if (p.includes('perícia') && p.includes('físic')) {
        return fromSkills('fisico');
    }
    if (p.includes('perícia') && p.includes('social')) {
        return fromSkills('social');
    }
    if (p.includes('perícia') && p.includes('combate')) {
        return fromSkills('combate');
    }
    if (p.includes('atributo')) {
        return Object.keys(TARGET_MAP).filter(k => TARGET_MAP[k]?.startsWith('attr_'));
    }

    // Fallback: tentar encontrar o alvo direto
    return [poolName];
}

/* ===== ARMAZENA MECÂNICAS BRUTAS DE VALORES DERIVADOS para re-avaliação dinâmica ===== */
let _derivedValueMechanicsRaw = [];

/* ===== RASTREIA contribuições de equações dinâmicas para subtração seletiva ===== */
let _dynamicMechContributions = {};

/* ===== LIMPAR BÔNUS DE MECÂNICAS ===== */
function clearMechanicBonuses() {
    state.mechanicBonuses = {};
    // Bônus escopados a um item equipado: { [itemId]: { 'DERIVED:KEY': valor } }.
    // Reconstruído do zero a cada recálculo — sem isso os bônus de item
    // acumulariam a cada chamada de applyAllRaceMechanics.
    state.itemBonuses = {};
    _meItemScope = null;
    state.mechanicLimits = {};
    state.capacidades = [];
    state.mecanicasPendentes = [];
    state.booleanResults = {};
    state.chainedResults = {};
    // Restrições de equipar vindas de mecânicas "conceder" (bloquear/permitir_equipar).
    // Reconstruídas a cada recálculo, como qualquer outro efeito de mecânica.
    state.equipRestricoes = { bloqueios: [], bloqueiosEfeitos: [], liberacoes: [] };
    _derivedValueMechanicsRaw = [];
    _dynamicMechContributions = {};
    state._invPressureContrib = 0;
    // ᛟ Concessões de níveis rúnicos são reconstruídas a cada recálculo
    clearRunicGrants();
}

/* ===== CONCEDER EQUIPAMENTO (cria Itens Soltos no inventário) ===== */
const _grantEquipRetries = {};

/**
 * Cria os equipamentos configurados em uma mecânica "conceder_equipamento"
 * como Itens Soltos no inventário do personagem.
 * A concessão acontece UMA ÚNICA VEZ por personagem — rastreada em
 * state.mecanicasAplicadas[mech.id].equipamentosConcedidos (persistido).
 */
function _concederEquipamentosDeMecanica(mech, config, parentPec) {
    const lista = Array.isArray(config.equipamentosConcedidos) ? config.equipamentosConcedidos : [];
    if (lista.length === 0) return;

    state.mecanicasAplicadas = state.mecanicasAplicadas || {};
    if (state.mecanicasAplicadas[mech.id]?.equipamentosConcedidos) return; // já concedido

    const charId = window.currentCharacterId;
    const user = window.currentUser;
    const invPronto = window._inventoryState?.loaded === true;

    // Ficha/inventário ainda não carregados: agendar nova tentativa
    if (!charId || !user || !invPronto) {
        if (_grantEquipRetries[mech.id] === undefined) _grantEquipRetries[mech.id] = 0;
        if (_grantEquipRetries[mech.id] < 20) {
            _grantEquipRetries[mech.id]++;
            setTimeout(() => {
                if (!state.mecanicasAplicadas?.[mech.id]?.equipamentosConcedidos) {
                    _concederEquipamentosDeMecanica(mech, config, parentPec);
                }
            }, 1500);
        }
        return;
    }

    // Marcar IMEDIATAMENTE (síncrono) para evitar dupla concessão em recálculos
    state.mecanicasAplicadas[mech.id] = {
        ...(state.mecanicasAplicadas[mech.id] || {}),
        aplicada: true,
        equipamentosConcedidos: new Date().toISOString()
    };
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    const catalog = window._inventoryState.catalog || [];

    (async () => {
        for (const g of lista) {
            const eqId = g.id || g.equipamentoId;
            const tpl = catalog.find(t => t.id === eqId);
            const qtd = Math.max(1, parseInt(g.quantidade, 10) || 1);
            const isArma = tpl?.tipo === 'Arma';
            const isContainer = tpl?.tipo === 'Container' || tpl?.ehContainer;
            // Armas e Containers não podem ser "stackados" — criar unidades separadas
            const unidades = (isArma || isContainer) ? qtd : 1;

            for (let u = 0; u < unidades; u++) {
                const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
                const itemData = {
                    id: newId,
                    nome: tpl?.nome || eqId,
                    tipo: tpl?.tipo || 'Objeto',
                    categoriaArma: tpl?.tipo === 'Arma' ? (tpl?.categoriaArma || null) : null,
                    peso: tpl?.peso ?? 1,
                    pressaoBase: tpl?.peso ?? 1,
                    tamanho: tpl?.tamanho ?? 1,
                    quantidade: (isArma || isContainer) ? 1 : qtd,
                    descricao: tpl?.descricao || '',
                    imagem: tpl?.imagem || '',
                    formulaDano: tpl?.formulaDano || '',
                    modeloId: tpl?.id || null,
                    equipavelEm: tpl?.equipavelEm || null,
                    formaEquipar: tpl?.formaEquipar || null,
                    characterId: charId,
                    ownerUid: user.uid,
                    equipado: false,          // Item Solto
                    slotAnatomico: null,
                    estadoEquip: null,
                    maosUsadas: null,
                    parentItemId: null,
                    criadoPor: 'mecanica',
                    origemMecanicaId: mech.id,
                    lastModified: new Date().toISOString(),
                    ehContainer: !!(tpl?.ehContainer),
                    pesoMaximoContainer: tpl?.ehContainer ? (tpl?.pesoMaximoContainer || 10) : null,
                    multiplicadorPressao: tpl?.ehContainer ? (tpl?.multiplicadorPressao || 1) : null
                };
                try {
                    if (typeof _firestoreSetDoc === 'function') await _firestoreSetDoc('items', newId, itemData);
                } catch (e) {
                    console.error('❌ Erro ao criar item concedido:', e);
                }
                window._inventoryState.items.push(itemData);
            }
        }
        if (typeof renderInventoryTab === 'function') renderInventoryTab();
        if (typeof renderEquippedItems === 'function') renderEquippedItems();
        if (typeof recalcInventoryPressure === 'function') recalcInventoryPressure();
        if (typeof scheduleAutosave === 'function') scheduleAutosave();
        console.log(`🎒 Mecânica "${mech.nome}" concedeu ${lista.length} equipamento(s) como Item(ns) Solto(s).`);
    })();
}

/* ===== RESOLVER VALOR DINÂMICO DE CÁLCULO ===== */
function resolveCalcValue(calc) {
    if (!calc) return 0;
    // New equation format
    if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
        return resolveEquation(calc.equacao);
    }
    // Legacy format
    if (calc.valorTipo !== 'ficha') {
        return parseFloat(calc.valor) || 0;
    }
    // Resolve valor de ficha (legacy)
    return _resolveSheetRef(calc.valorRef, calc.valorMultiplicador || 1);
}

/* ===== RESOLVER EQUAÇÃO MULTI-TERMO ===== */
function resolveEquation(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return 0;
    let result = _resolveTermValue(equacao[0]) || 0;
    for (let i = 1; i < equacao.length; i++) {
        const t = equacao[i];
        const val = _resolveTermValue(t) || 0;
        const op = t.op || '+';
        if (op === '+') result += val;
        else if (op === '-') result -= val;
        else if (op === '×' || op === '*') result *= val;
        else if (op === '÷' || op === '/') result = val !== 0 ? result / val : 0;
        else if (op === 'min') result = Math.min(result, val);
        else if (op === 'max') result = Math.max(result, val);
    }
    return isNaN(result) ? 0 : result;
}

/* ===== VERIFICAÇÃO DE EQUIPAMENTO (mecânicas booleano / condicional_encadeado) =====
 * Conta itens do inventário do personagem que casam com um requisito
 * (equipamento específico, tag ou tipo) equipados nas formas exigidas
 * (efeitos ativos / segurando / fixado — nenhuma = qualquer forma equipada). */

function _meReqTarget(req) {
    req = req || {};
    if (req.targetTipo === 'tag' || (req.tag && !req.equipamentoId)) return { kind: 'tag', value: req.tag || '' };
    if (req.targetTipo === 'tipo' || (req.tipoEquipamento && !req.equipamentoId)) return { kind: 'tipo', value: req.tipoEquipamento || '' };
    return { kind: 'equipamento', value: req.equipamentoId || req.id || '' };
}

function _meReqFormas(req) {
    req = req || {};
    if (Array.isArray(req.formasEquip)) return req.formasEquip.filter(f => ['efeitos', 'segurando', 'fixado'].includes(f));
    return req.exigeEfeitosOn === true ? ['efeitos'] : [];
}

function _meReqNome(req) {
    const t = _meReqTarget(req);
    if (t.kind === 'tag') return `Tag "${t.value}"`;
    if (t.kind === 'tipo') return `Tipo ${t.value}`;
    const catalog = window._inventoryState?.catalog || [];
    const tpl = catalog.find(x => x.id === t.value);
    return tpl?.nome || t.value;
}

/** Categorias de forma que o item equipado satisfaz: 'efeitos', 'segurando' e/ou 'fixado'.
 *  Regra canônica em inventory.js (itemFormasAtuais) — aqui só delega. */
function _meItemFormasAtuais(item) {
    return typeof itemFormasAtuais === 'function' ? itemFormasAtuais(item) : [];
}

function _meItemEquipValido(item, formasExigidas) {
    if (!item.equipado || item.parentItemId || item.estadoEquip === 'armazenado') return false;
    if (!formasExigidas || formasExigidas.length === 0) return true;
    const atuais = _meItemFormasAtuais(item);
    return formasExigidas.some(f => atuais.includes(f));
}

// Itens antigos na ficha guardaram o nome com espaços das pontas; o catálogo já
// foi limpo. Comparar cru desfazia o vínculo item↔modelo em silêncio.
function _meSameNome(a, b) {
    return (a || '').trim() === (b || '').trim();
}

function _meMatchItemsByReq(req) {
    const target = _meReqTarget(req);
    const items = window._inventoryState?.items || [];
    const catalog = window._inventoryState?.catalog || [];
    if (target.kind === 'tag') {
        const tag = target.value;
        return items.filter(i => {
            if (Array.isArray(i.tags) && i.tags.includes(tag)) return true;
            const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => _meSameNome(t.nome, i.nome));
            return !!(tpl && Array.isArray(tpl.tags) && tpl.tags.includes(tag));
        });
    }
    if (target.kind === 'tipo') {
        const tipo = target.value;
        return items.filter(i => {
            if (i.tipo) return i.tipo === tipo;
            const tpl = i.modeloId ? catalog.find(t => t.id === i.modeloId) : catalog.find(t => _meSameNome(t.nome, i.nome));
            return !!(tpl && tpl.tipo === tipo);
        });
    }
    const eqId = target.value;
    const tpl = catalog.find(t => t.id === eqId);
    return items.filter(i => i.modeloId === eqId || (tpl && _meSameNome(i.nome, tpl.nome)));
}

/** Soma a quantidade dos itens que casam com o requisito, equipados nas formas exigidas. */
function _meCountEquipReq(req) {
    const formas = _meReqFormas(req);
    return _meMatchItemsByReq(req)
        .filter(i => _meItemEquipValido(i, formas))
        .reduce((s, i) => s + (parseInt(i.quantidade, 10) || 1), 0);
}

/* ===== RESTRIÇÃO DE EQUIPAR (mecânicas conceder) =====
 * Dois bloqueios independentes:
 *   bloquear_equipar          → não entra no corpo de forma nenhuma;
 *   bloquear_equipar_efeitos  → entra, mas só em modo sem efeitos (segurar,
 *                               fixar, guardar). Barra Empunhado/Vestido.
 * As regras são coletadas em state.equipRestricoes durante o recálculo, por
 * applyMechanicToSheet — o único ponto por onde toda mecânica ativa passa.
 * Uma liberação que alcance o item vence os DOIS bloqueios. */

const _ME_TC_EQUIP_BAG = {
    bloquear_equipar: 'bloqueios',
    bloquear_equipar_efeitos: 'bloqueiosEfeitos',
    permitir_equipar: 'liberacoes'
};
const _ME_TC_EQUIP_DESC = {
    bloquear_equipar: 'Não pode equipar certos itens',
    bloquear_equipar_efeitos: 'Não pode ativar os efeitos de certos itens',
    permitir_equipar: 'Liberado a equipar certos itens'
};

/** true se o item casa com algum vínculo (equipamento específico / tag / tipo) da lista. */
function _meItemCasaReqs(item, reqs) {
    return (Array.isArray(reqs) ? reqs : []).some(req => {
        const alvo = _meReqTarget(req);
        if (!alvo.value) return false;
        return _meMatchItemsByReq(req).some(i => i.id === item.id);
    });
}

/** Primeira regra de `lista` que alcança o item, respeitando as liberações.
 *  Devolve { fonte, descricao } ou null. */
function _meBuscaRestricao(item, lista) {
    if (!item) return null;
    const restr = state?.equipRestricoes;
    const regras = restr?.[lista];
    if (!Array.isArray(regras) || regras.length === 0) return null;

    const regra = regras.find(r => _meItemCasaReqs(item, r.reqs));
    if (!regra) return null;

    // Liberação vence bloqueio: basta uma regra "permitir_equipar" alcançar o item.
    if ((restr.liberacoes || []).some(l => _meItemCasaReqs(item, l.reqs))) return null;

    return { fonte: regra.fonte, descricao: regra.descricao };
}

/** Motivo pelo qual o item NÃO pode ser equipado de forma nenhuma, ou null. */
function equipBloqueioDoItem(item) {
    return _meBuscaRestricao(item, 'bloqueios');
}
window.equipBloqueioDoItem = equipBloqueioDoItem;

/** Motivo pelo qual o item não pode ficar com EFEITOS ATIVOS, ou null.
 *  Um bloqueio total também impede os efeitos — quem não pode equipar de jeito
 *  nenhum obviamente não ativa efeito. */
function equipBloqueioEfeitosDoItem(item) {
    return _meBuscaRestricao(item, 'bloqueiosEfeitos') || equipBloqueioDoItem(item);
}
window.equipBloqueioEfeitosDoItem = equipBloqueioEfeitosDoItem;

/* ===== ESCOPO POR ITEM =====
 * Valores Derivados marcados com `escopoItem` no Painel do Criador não somam
 * num único número do personagem: cada item equipado carrega o seu próprio
 * delta. Assim duas armas equipadas deixam de somar no mesmo "Acerto".
 *
 * O total exibido por item = base global (state.derived[key], que já reúne
 * raça/classe/peculiaridade/condição) + delta daquele item.
 */
let _meItemScope = null;   // id do item cujos bônus estão sendo aplicados

/** Liga/desliga o escopo de item. `null` volta a escrever no bag global. */
function _meSetItemScope(itemId) { _meItemScope = itemId || null; }

/** true se o alvo é um DV marcado como calculado por item ('coluna' ou 'dano'). */
function _meIsItemScopedTarget(rawField) {
    if (typeof rawField !== 'string' || !rawField.startsWith('DERIVED:')) return false;
    const key = rawField.slice('DERIVED:'.length);
    const dv = (window.DERIVED_VALUES || []).find(d => d.key === key);
    return !!(dv && dv.escopoItem);
}

/* Propriedades do item em escopo — refs "Item: ..." das Equações de Valor.
 * Só resolvem quando há um item em escopo (mecânica do próprio item ou mecânica
 * com escopoAplicacao='itens'); fora disso valem 0, como qualquer ref inexistente.
 * Preço, Liga e Capacidade só existem no catálogo — a instância do inventário não
 * os copia, então caem no modelo (modeloId). */
const _ME_ITEM_PROPS = {
    'Peso/Pressão': it => it.pressaoOverride ?? it.pressaoBase ?? it.peso,
    'Tamanho': it => it.tamanho,
    'Multiplicador de Pressão': (it, tpl) => it.multiplicadorPressao ?? tpl?.multiplicadorPressao ?? 1,
    'Capacidade do Container': (it, tpl) => it.capacidadeContainer ?? tpl?.capacidadeContainer,
    'Preço': (it, tpl) => it.preco ?? tpl?.preco,
    'Liga': (it, tpl) => it.liga ?? tpl?.liga,
    // Qualidade é o poder da peça (0–5) e Afiação o acabamento mantido sobre ela
    // (Livro, 5.5/5.6). Entram na Equação de Dano: `FOR + Item: Qualidade + Item: Afiação`.
    // Peça sem Qualidade vale 0 — não undefined, senão a equação inteira vira NaN.
    // `fio` (campo) e 'Fio' (ref) são o nome antigo — o alias fica enquanto houver
    // instância antiga em ficha de personagem, que a migração do catálogo não varre.
    'Qualidade': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Fio': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Afiação': (it, tpl) => it.afiacao ?? tpl?.afiacao ?? 0,
    'Quantidade': it => it.quantidade ?? 1
};

function _meItemProp(prop) {
    const fn = _ME_ITEM_PROPS[prop];
    if (!fn || !_meItemScope) return 0;
    const item = (window._inventoryState?.items || []).find(i => i.id === _meItemScope);
    if (!item) return 0;
    const tpl = item.modeloId ? (window._inventoryState?.catalog || []).find(t => t.id === item.modeloId) : null;
    const bruto = fn(item, tpl);              // Liga vem como string ('0'..'5') do catálogo
    const num = parseFloat(bruto);
    return isNaN(num) ? 0 : num;
}

/* Refs "Projétil: ..." — propriedades do maço apontado pela arma em escopo
 * (campo projetilId da instância). Arco e besta dão o dado; Qualidade e
 * Afiação vêm da ponta (Livro, 5.6 v2). O vínculo é explícito, escolhido na
 * ficha: com dois maços na aljava, dedução automática escolheria errado em
 * silêncio. Sem projétil apontado (ou apontando item que já não existe): 0. */
function _meProjetilProp(prop) {
    const fn = _ME_ITEM_PROPS[prop];
    if (!fn || !_meItemScope) return 0;
    const items = window._inventoryState?.items || [];
    const arma = items.find(i => i.id === _meItemScope);
    if (!arma || !arma.projetilId) return 0;
    const proj = items.find(i => i.id === arma.projetilId);
    if (!proj) return 0;
    const tpl = proj.modeloId ? (window._inventoryState?.catalog || []).find(t => t.id === proj.modeloId) : null;
    const num = parseFloat(fn(proj, tpl));
    return isNaN(num) ? 0 : num;
}

/** Bag de destino de um bônus: o do item em escopo, ou o global do personagem. */
function _meBonusBag(rawField) {
    if (_meItemScope && _meIsItemScopedTarget(rawField)) {
        if (!state.itemBonuses) state.itemBonuses = {};
        if (!state.itemBonuses[_meItemScope]) state.itemBonuses[_meItemScope] = {};
        return state.itemBonuses[_meItemScope];
    }
    return state.mechanicBonuses;
}

/**
 * Itens equipados que casam com o filtro de uma mecânica `escopoAplicacao: 'itens'`.
 * Filtro vazio = todos os itens com Efeitos Ativos. Reusa a mesma estrutura
 * `equipReqs` (equipamento específico / tag / tipo) das verificações de equipamento.
 */
function _meItensDoFiltro(filtro) {
    const items = window._inventoryState?.items || [];
    const reqs = Array.isArray(filtro)
        ? filtro.filter(r => r && (r.equipamentoId || r.tag || r.tipoEquipamento || r.targetTipo))
        : [];

    if (reqs.length === 0) return items.filter(i => _meItemEquipValido(i, ['efeitos']));

    const vistos = new Set();
    const out = [];
    for (const req of reqs) {
        const formas = _meReqFormas(req);
        for (const it of _meMatchItemsByReq(req)) {
            if (vistos.has(it.id)) continue;
            if (!_meItemEquipValido(it, formas.length ? formas : ['efeitos'])) continue;
            vistos.add(it.id);
            out.push(it);
        }
    }
    return out;
}

window._meSetItemScope = _meSetItemScope;
window._meIsItemScopedTarget = _meIsItemScopedTarget;
window._meItensDoFiltro = _meItensDoFiltro;

function _meCompare(valor, comp, a, b) {
    comp = comp || '>=';
    if (comp === 'entre') {
        if (isNaN(a) || isNaN(b)) return false;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return valor >= lo && valor <= hi;
    }
    if (isNaN(a)) return false;
    if (comp === '<') return valor < a;
    if (comp === '<=') return valor <= a;
    if (comp === '==') return valor === a;
    if (comp === '!=') return valor !== a;
    if (comp === '>=') return valor >= a;
    if (comp === '>') return valor > a;
    return false;
}

/* ===== COLETOR DE MENSAGENS DE MECÂNICAS (cadeias acionadas por botão) =====
 * Enquanto a coleta estiver ativa, cada mecânica avaliada registra sua mensagem:
 * booleano → "Valor se Verdadeiro" / "Valor se Falso";
 * condicional encadeado → mensagem da faixa (condição) que casou;
 * modificar (one-off) → resumo do que foi aplicado na ficha.
 * As mensagens são registradas na ordem de acionamento, com 'depth' indicando
 * o nível na cadeia (mensagens encadeadas aparecem abaixo da mecânica que as acionou). */
let _meMsgCollector = null;
let _meMsgDepth = 0;

function meBeginMessageCollection() {
    _meMsgCollector = [];
    _meMsgDepth = 0;
}
function meEndMessageCollection() {
    const msgs = _meMsgCollector || [];
    _meMsgCollector = null;
    _meMsgDepth = 0;
    return msgs;
}
function _mePushMsg(mech, texto, ok = true) {
    if (!_meMsgCollector) return;
    const t = String(texto ?? '').trim();
    if (!t) return;
    _meMsgCollector.push({ nome: mech?.nome || '', texto: t, ok: ok !== false, depth: _meMsgDepth });
}
window.meBeginMessageCollection = meBeginMessageCollection;
window.meEndMessageCollection = meEndMessageCollection;

/* ===== ACIONAR MECÂNICAS VINCULADAS (booleano / condicional_encadeado) =====
 * Aplica as mecânicas vinculadas ao resultado, com guarda contra ciclos.
 * IMPORTANTE: isOneOff é propagado para a cadeia — assim, mecânicas "modificar"
 * encadeadas que afetam valores ATUAIS (Sanidade Atual, Energia Atual...) são
 * aplicadas quando a cadeia parte de um botão de módulo. */
const _meTriggerStack = new Set();

function _meTriggerMechanics(ids, sourceMech, parentPec, isOneOff = false) {
    if (!Array.isArray(ids) || ids.length === 0 || !sourceMech) return;
    if (_meTriggerStack.has(sourceMech.id)) return;
    _meTriggerStack.add(sourceMech.id);
    _meMsgDepth++;
    try {
        for (const id of ids) {
            if (!id || id === sourceMech.id || _meTriggerStack.has(id)) continue;
            const target = window._systemData?.mechanics?.find(m => m.id === id);
            if (target) applyMechanicToSheet(target, parentPec, isOneOff);
        }
    } finally {
        _meMsgDepth--;
        _meTriggerStack.delete(sourceMech.id);
    }
}

/* ===== VERIFICAÇÃO DE CLASSE (booleano / condicional_encadeado) ===== */

/** Lista as classes atuais do personagem (nomes). Hoje a ficha usa uma classe
 *  (#selClasse), mas o helper devolve uma lista para suportar múltiplas. */
function _meGetCharacterClasses() {
    const out = [];
    const sel = document.getElementById('selClasse')?.value;
    if (sel) out.push(sel);
    return out;
}

function _meNormClasse(s) {
    return String(s || '').trim().toLowerCase();
}

/** true se o personagem possuir TODAS as classes exigidas (lista de nomes). */
function _meHasAllClasses(classesReq) {
    const reqs = (Array.isArray(classesReq) ? classesReq : []).filter(Boolean);
    if (reqs.length === 0) return false;
    const have = _meGetCharacterClasses().map(_meNormClasse);
    return reqs.every(c => have.includes(_meNormClasse(c)));
}

/** Avalia UMA verificação booleana (numérica, de equipamento ou de classe) e devolve
 *  { resultado, valA, valB, op, modo, counts? }. */
function _meEvalBoolVerif(v, mech) {
    v = v || {};
    if (v.modoVerificacao === 'classe') {
        // Verificação de Classe: lado esquerdo = classes do personagem (automático);
        // lado direito = classes exigidas. Verdadeiro se o personagem tiver TODAS.
        const reqs = (Array.isArray(v.classesReq) ? v.classesReq : []).filter(Boolean);
        const charClasses = _meGetCharacterClasses();
        const resultado = _meHasAllClasses(reqs);
        console.log(`⚔️ Booleano (classe) "${mech?.nome || '?'}": personagem [${charClasses.join(', ') || '—'}] precisa de [${reqs.join(', ') || '—'}] → ${resultado}`);
        return { resultado, valA: charClasses.length, valB: reqs.length, op: '>=', modo: 'classe', charClasses, classesReq: reqs };
    }
    if (v.modoVerificacao === 'equipamento') {
        // Verificação de Equipamento: todos os vínculos precisam ter
        // itens equipados nas formas exigidas em quantidade ≥ Equação de Valor
        const reqs = Array.isArray(v.equipReqs) ? v.equipReqs : [];
        const eqQ = Array.isArray(v.equacaoQtdMin) ? v.equacaoQtdMin : [];
        const qtdMin = eqQ.length > 0 ? resolveEquation(eqQ) : 1;
        const counts = reqs.map(r => _meCountEquipReq(r));
        const resultado = reqs.length > 0 && counts.every(c => c >= qtdMin);
        console.log(`🎒 Booleano (equipamento) "${mech?.nome || '?'}": [${reqs.map((r, i) => `${_meReqNome(r)}=${counts[i]}`).join(', ')}] ≥ ${qtdMin} cada → ${resultado}`);
        return { resultado, valA: counts.length ? Math.min(...counts) : 0, valB: qtdMin, op: '>=', modo: 'equipamento', counts };
    }
    const eqA = Array.isArray(v.equacaoA) ? v.equacaoA : [];
    const eqB = Array.isArray(v.equacaoB) ? v.equacaoB : [];
    const valA = resolveEquation(eqA);
    const valB = resolveEquation(eqB);
    const op = v.operadorComparacao || '>=';
    let resultado = false;
    if (op === '==') resultado = valA === valB;
    else if (op === '!=') resultado = valA !== valB;
    else if (op === '>') resultado = valA > valB;
    else if (op === '>=') resultado = valA >= valB;
    else if (op === '<') resultado = valA < valB;
    else if (op === '<=') resultado = valA <= valB;
    return { resultado, valA, valB, op, modo: 'numerico' };
}

/* ===== RESOLVER CONDICIONAL ENCADEADO =====
 * Modo numérico: avalia a equação de valor e percorre a tabela de resolução (condicoes) em ordem.
 * Modo equipamento: conta os itens de cada vínculo no inventário e avalia as
 * verificações de cada condição (individuais por vínculo e/ou Σ total).
 * A primeira condição que casar define o resultado (valorSaida).
 * Se nenhuma casar, usa config.valorPadrao. */
function resolveChainedConditional(config) {
    if (config?.modoVerificacao === 'equipamento') return _resolveChainedEquip(config);
    if (config?.modoVerificacao === 'classe') return _resolveChainedClasse(config);

    const eq = Array.isArray(config?.equacaoValor) ? config.equacaoValor : [];
    const valorEquacao = resolveEquation(eq);
    const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];

    let valorSaida = config?.valorPadrao ?? '';
    let condicaoIndex = -1;

    for (let i = 0; i < condicoes.length; i++) {
        const c = condicoes[i] || {};
        const ok = _meCompare(valorEquacao, c.comparacao || '<', parseFloat(c.valorA), parseFloat(c.valorB));
        if (ok) {
            valorSaida = c.resultado ?? '';
            condicaoIndex = i;
            break;
        }
    }

    return { valorEquacao, valorSaida, condicaoIndex };
}

function _resolveChainedEquip(config) {
    const reqs = Array.isArray(config?.equipReqs) ? config.equipReqs : [];
    const counts = reqs.map(r => _meCountEquipReq(r));
    const total = counts.reduce((s, c) => s + c, 0);
    const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];

    let valorSaida = config?.valorPadrao ?? '';
    let condicaoIndex = -1;

    for (let i = 0; i < condicoes.length; i++) {
        const c = condicoes[i] || {};
        const vers = Array.isArray(c.verificacoes) ? c.verificacoes : [];
        if (vers.length === 0) continue;
        let ok = true;
        for (const v of vers) {
            const val = v.alvo === 'total' ? total : (counts[parseInt(v.alvo, 10) || 0] ?? 0);
            if (!_meCompare(val, v.comparacao || '>=', parseFloat(v.valorA), parseFloat(v.valorB))) { ok = false; break; }
        }
        if (ok) {
            valorSaida = c.resultado ?? '';
            condicaoIndex = i;
            break;
        }
    }

    return { valorEquacao: total, valorSaida, condicaoIndex, counts };
}

/** Modo classe: cada condição exige uma ou mais classes (classesReq).
 *  A primeira condição cujas classes estejam TODAS entre as do personagem
 *  define o resultado (mensagem) e aciona as mecânicas vinculadas;
 *  se nenhuma casar, usa config.valorPadrao. */
function _resolveChainedClasse(config) {
    const charClasses = _meGetCharacterClasses();
    const condicoes = Array.isArray(config?.condicoes) ? config.condicoes : [];

    let valorSaida = config?.valorPadrao ?? '';
    let condicaoIndex = -1;

    for (let i = 0; i < condicoes.length; i++) {
        const c = condicoes[i] || {};
        const reqs = (Array.isArray(c.classesReq) ? c.classesReq : []).filter(Boolean);
        if (reqs.length === 0) continue;
        if (_meHasAllClasses(reqs)) {
            valorSaida = c.resultado ?? '';
            condicaoIndex = i;
            break;
        }
    }

    return { valorEquacao: charClasses.length, valorSaida, condicaoIndex, charClasses, modo: 'classe' };
}

function _resolveTermValue(term) {
    if (!term) return 0;
    if (term.tipo === 'ficha') {
        return _resolveSheetRef(term.ref, 1);
    }
    if (term.tipo === 'sort') {
        return _rollSortTerm(term);
    }
    return parseFloat(term.valor) || 0;
}

/* Sorteia um valor inteiro entre min e max (inclusive) para termos do tipo 'sort'. */
function _rollSortTerm(term) {
    let lo = parseFloat(term.min);
    let hi = parseFloat(term.max);
    if (isNaN(lo) && isNaN(hi)) return 0;
    if (isNaN(lo)) lo = hi;
    if (isNaN(hi)) hi = lo;
    lo = Math.round(lo);
    hi = Math.round(hi);
    if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function _resolveSheetRef(ref, mult) {
    if (!ref) return 0;
    mult = mult || 1;

    // Special: Pressão Total (Equipados) — reads from inventory module
    if (ref === 'Pressão Total (Equipados)') {
        const pressure = typeof calculateTotalPressure === 'function'
            ? calculateTotalPressure() : 0;
        return pressure * mult;
    }

    // Propriedades do item em escopo (peso, tamanho, preço, liga...)
    if (ref.startsWith('Item: ')) return _meItemProp(ref.slice(6)) * mult;
    if (ref.startsWith('Projétil: ')) return _meProjetilProp(ref.slice(10)) * mult;

    // Check attributes (includes mechanic bonuses / highlighted levels)
    const attrKey = TARGET_MAP[ref];
    if (attrKey && attrKey.startsWith('attr_')) {
        const attrVal = typeof getEffectiveDotValue === 'function'
            ? getEffectiveDotValue(attrKey)
            : (state.dots[attrKey] || 0) + (state.mechanicBonuses?.[attrKey] || 0);
        return attrVal * mult;
    }

    // Check skills (includes mechanic bonuses / highlighted levels)
    if (attrKey && attrKey.startsWith('sk_')) {
        let skVal = typeof getEffectiveDotValue === 'function'
            ? getEffectiveDotValue(attrKey)
            : (state.dots[attrKey] || 0) + (state.mechanicBonuses?.[attrKey] || 0);

        // Fallback robusto: se a perícia for validada por mecânica global, mas o personagem a possui 
        // como perícia de classe, compara as duas e pega o maior valor (Nível Total = Base + Bônus).
        // Isso resolve o conflito onde a mecânica salva "Perícia: X", mas a ficha tem a versão de classe, 
        // além de evitar falhas caso a perícia genérica tenha bônus isolados mas a de classe seja a verdadeira.
        if (!attrKey.startsWith('sk_classe_')) {
            const rawName = ref.replace(/^Perícia:\s*/i, '');
            const classKey = 'sk_classe_' + rawName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const classVal = typeof getEffectiveDotValue === 'function'
                ? getEffectiveDotValue(classKey)
                : (state.dots[classKey] || 0) + (state.mechanicBonuses?.[classKey] || 0);
            if (classVal > skVal) {
                skVal = classVal;
            }
        }
        return skVal * mult;
    }

    // Check Nível
    if (ref === 'Nível') {
        const nivel = parseInt(document.querySelector('[data-key="nivel"]')?.value) || 1;
        return nivel * mult;
    }

    // Check status vitais (Atual) — lê o input da ficha (ex: [Sanidade Atual])
    if (attrKey && attrKey.startsWith('ATUAL:')) {
        const atualKey = attrKey.replace('ATUAL:', '');
        const atualEl = document.querySelector(`[data-key="${atualKey}"]`);
        const atualVal = parseFloat(String(atualEl?.value ?? '0').replace(',', '.')) || 0;
        return atualVal * mult;
    }

    // Check DV (Atual) — reads editable Atual field from state.dvAtual
    if (attrKey && attrKey.startsWith('field:dv_') && attrKey.endsWith('_atual')) {
        const dvKey = attrKey.replace('field:dv_', '').replace('_atual', '');
        const atualVal = parseFloat(state.dvAtual?.[dvKey] || '0') || 0;
        return atualVal * mult;
    }

    // Check derived values
    if (attrKey && attrKey.startsWith('DERIVED:')) {
        const derivedKey = attrKey.replace('DERIVED:', '');
        const derivedVal = state.derived?.[derivedKey] || 0;
        return derivedVal * mult;
    }

    // Check field values
    if (attrKey && attrKey.startsWith('field:')) {
        const fieldKey = attrKey.replace('field:', '');
        const fieldEl = document.querySelector(`[data-key="${fieldKey}"]`);
        const fieldVal = parseFloat(String(fieldEl?.value || '0').replace(',', '.')) || 0;
        return fieldVal * mult;
    }

    // Check body part slots
    if (attrKey && attrKey.startsWith('slot_')) {
        const slotKey = attrKey.replace('slot_', '');
        const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : (typeof BODY_SLOTS !== 'undefined' ? BODY_SLOTS : {});
        const slotDef = bodySlots[slotKey];
        const base = slotDef ? slotDef.max : 0;
        const bonus = state.mechanicBonuses?.[attrKey] || 0;
        return (base + bonus) * mult;
    }

    return 0;
}

/* Uma peculiaridade aplica suas mecânicas UMA vez por passada, mesmo quando
   chega por dois caminhos — o Guerreiro que herda "Domínio de Armas de Braço"
   da classe E comprou o mesmo doc como avulsa. Sem isto o Teto de Ofício soma
   [FOR] duas vezes. O nível é o mesmo nos dois: sai de state.dots['pec_'+key]. */
const _pecsAplicadas = new Set();

function _aplicarPecUmaVez(pec) {
    const chave = pec && (pec.id || pec.key);
    if (!chave || _pecsAplicadas.has(chave)) return;
    _pecsAplicadas.add(chave);

    for (const mech of pec.mecanicas || []) {
        applyMechanicToSheet(mech, pec);
    }

    // === AURA SYSTEM: apply linked aura from peculiarity ===
    if (pec.auraVinculadaId && window.AURAS) {
        const auraDef = window.AURAS.find(a => a.id === pec.auraVinculadaId);
        if (!auraDef) return;
        const grau = pec.auraGrauConcedido || 1;
        if (!state.auras) state.auras = {};
        const existing = state.auras[pec.auraVinculadaId];
        if (!existing || existing.grauDesbloqueado < grau) {
            state.auras[pec.auraVinculadaId] = { grauDesbloqueado: grau, fonte: 'peculiaridade', fonteId: pec.id };
        }
    }
}

/* ===== APLICAR TODAS AS MECÂNICAS DE UMA RAÇA ===== */
function applyAllRaceMechanics(racaNome) {
    clearMechanicBonuses();
    _pecsAplicadas.clear();

    // Clear auras that came from peculiarities (will be re-applied below)
    if (state.auras) {
        for (const auraId of Object.keys(state.auras)) {
            if (state.auras[auraId]?.fonte === 'peculiaridade') {
                delete state.auras[auraId];
            }
        }
    }

    // Always apply skill mechanics, even without a race selected
    applySkillMechanics();


    // Apply mechanics linked to derived values
    applyDerivedValueMechanics();

    // Apply mechanics linked to class module limits
    applyClassModuleLimitMechanics();

    // Apply mechanics linked to vital stats (from Firebase)
    applyVitalStatsMechanics();

    if (typeof applyConditionMechanics === 'function') applyConditionMechanics();

    if (!racaNome || !window.RACES) {
        // Even without a race, apply class and tribe peculiarity mechanics
        _applyClassPeculiarityMechanics();
        _applyTribePeculiarityMechanics();
        _applyIndividualPeculiarityMechanics();
        if (typeof applyEquippedItemsMechanics === 'function') applyEquippedItemsMechanics();
        if (typeof recalcInventoryPressure === 'function') recalcInventoryPressure();
        if (typeof renderAurasTab === 'function') renderAurasTab();
        return;
    }
    const raca = window.RACES[racaNome];
    if (!raca) {
        _applyClassPeculiarityMechanics();
        _applyTribePeculiarityMechanics();
        if (typeof applyEquippedItemsMechanics === 'function') applyEquippedItemsMechanics();
        if (typeof recalcInventoryPressure === 'function') recalcInventoryPressure();
        if (typeof renderAurasTab === 'function') renderAurasTab();
        return;
    }

    for (const pec of raca.peculiaridades) {
        _aplicarPecUmaVez(pec);
    }

    // === Aplicar mecânicas de peculiaridades de CLASSE ===
    _applyClassPeculiarityMechanics();

    // === Aplicar mecânicas de peculiaridades de TRIBO ===
    _applyTribePeculiarityMechanics();

    // === Aplicar mecânicas de peculiaridades INDIVIDUAIS (Avulsas) ===
    _applyIndividualPeculiarityMechanics();

    // === Aplicar mecânicas dos ITENS EQUIPADOS ===
    if (typeof applyEquippedItemsMechanics === 'function') {
        applyEquippedItemsMechanics();
    }
    // === Recalcular Pressão do inventário (alimenta Carga) ===
    if (typeof recalcInventoryPressure === 'function') {
        recalcInventoryPressure();
    }

    // Render auras tab if available
    if (typeof renderAurasTab === 'function') renderAurasTab();

    // ᛟ Atualiza a aba Runomancia para refletir níveis concedidos por mecânicas
    if (typeof window.runoRefreshFromMechanics === 'function') window.runoRefreshFromMechanics();
    // ᛟ E os rótulos "Nv X/Y" dos selects de distribuição já renderizados
    if (typeof refreshRunicDistribuirLabels === 'function') refreshRunicDistribuirLabels();
}

/**
 * Aplica mecânicas das peculiaridades da classe selecionada.
 */
function _applyClassPeculiarityMechanics() {
    const classeNome = document.getElementById('selClasse')?.value;
    if (!classeNome || !window.CLASS_PECULIARITIES || !window.CLASS_PECULIARITIES[classeNome]) return;

    for (const pec of window.CLASS_PECULIARITIES[classeNome]) {
        _aplicarPecUmaVez(pec);
    }
}

/**
 * Aplica mecânicas das peculiaridades da tribo selecionada.
 */
function _applyTribePeculiarityMechanics() {
    const triboNome = document.getElementById('selTribo')?.value;
    if (!triboNome || !window.TRIBES || !window.TRIBES[triboNome]) return;

    for (const pec of window.TRIBES[triboNome].peculiaridades) {
        _aplicarPecUmaVez(pec);
    }
}

/**
 * Aplica mecânicas das peculiaridades individuais (avulsas).
 */
function _applyIndividualPeculiarityMechanics() {
    if (!state.peculiaridadesIndividuais || !window._systemData?.peculiarities) return;
    
    // Assegura que resolvePeculiaridade existe (de race-peculiarities.js)
    if (typeof _resolvePeculiaridade !== 'function') return;

    // Resgata o objeto completo de peculiaridade usando o _resolvePeculiaridade
    const indPecs = state.peculiaridadesIndividuais.map(p => {
        return _resolvePeculiaridade(p, 'Individual');
    }).filter(Boolean);

    for (const pec of indPecs) {
        _aplicarPecUmaVez(pec);
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A PERÍCIAS ===== */
function applySkillMechanics() {
    if (!window.SKILLS || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    for (const cat of Object.keys(window.SKILLS)) {
        for (const skill of window.SKILLS[cat]) {
            if (!skill.mecanicaIds || skill.mecanicaIds.length === 0) continue;
            for (const mechId of skill.mecanicaIds) {
                const mech = mechanicsById[mechId];
                if (!mech) continue;
                applyMechanicToSheet(mech, null);
            }
        }
    }
}



/* ===== APLICAR MECÂNICAS VINCULADAS A STATUS VITAIS (Firebase) ===== */
function applyVitalStatsMechanics() {
    if (!window.VITAL_STATS || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    const processedMechIds = new Set();

    for (const vs of window.VITAL_STATS) {
        if (!vs.mecanicaIds || vs.mecanicaIds.length === 0) continue;
        for (const mechId of vs.mecanicaIds) {
            if (processedMechIds.has(mechId)) continue;
            processedMechIds.add(mechId);

            const mech = mechanicsById[mechId];
            if (!mech) continue;

            const mechToApply = { ...mech, _isBaseCalc: true };

            // Se a mecânica tem referências à ficha, armazenar para re-avaliação dinâmica
            if (mech.tipo === 'modificar'
                && (!mech.duracao || mech.duracao === 'permanente')
                && !mech.condicaoAplicacao?.trim()
                && _mechHasSheetRefs(mech)) {
                _derivedValueMechanicsRaw.push(mechToApply);
                continue;
            }

            applyMechanicToSheet(mechToApply, null);
        }
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A CONDIÇÕES ===== */
function applyConditionMechanics() {
    if (!state.conditions || !Array.isArray(state.conditions) || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    const processedMechIds = new Set();

    for (const cond of state.conditions) {
        if (!cond.efeitoMecanicaIds || !Array.isArray(cond.efeitoMecanicaIds)) continue;
        for (const mechId of cond.efeitoMecanicaIds) {
            // Note: we don't skip processedMechIds here because multiple conditions might apply the same mechanic.
            // But we should track it if we want it to stack or not. Typically, mechanics from different sources stack unless specified.
            const mech = mechanicsById[mechId];
            if (!mech) continue;

            if (mech.tipo === 'modificar'
                && (!mech.duracao || mech.duracao === 'permanente')
                && !mech.condicaoAplicacao?.trim()
                && _mechHasSheetRefs(mech)) {
                _derivedValueMechanicsRaw.push(mech);
                continue;
            }

            const sourcePec = {
                nome: `Condição: ${cond.nome}`,
                id: cond.modeloId || 'cond_custom',
                nivelAtual: 1
            };

            applyMechanicToSheet(mech, sourcePec);
        }
    }
}

/* ===== APLICAR MECÂNICAS VINCULADAS A VALORES DERIVADOS ===== */
function applyDerivedValueMechanics() {
    if (!window.DERIVED_VALUES || !window._systemData?.mechanics) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    // Evitar duplicatas: se o mesmo mechId está vinculado a múltiplos DVs,
    // processar apenas uma vez.
    const processedMechIds = new Set();

    for (const dv of window.DERIVED_VALUES) {
        if (!dv.mecanicaIds || dv.mecanicaIds.length === 0) continue;
        for (const mechId of dv.mecanicaIds) {
            if (processedMechIds.has(mechId)) continue;
            processedMechIds.add(mechId);

            const mech = mechanicsById[mechId];
            if (!mech) continue;

            const mechToApply = { ...mech, _isBaseCalc: true };

            // Se a mecânica é "modificar" permanente com equação que referencia a ficha,
            // armazenar para re-avaliação dinâmica em recalcAll()
            if (mech.tipo === 'modificar'
                && (!mech.duracao || mech.duracao === 'permanente')
                && !mech.condicaoAplicacao?.trim()
                && _mechHasSheetRefs(mech)) {
                _derivedValueMechanicsRaw.push(mechToApply);
                // Não chamar applyMechanicToSheet — será resolvido em recalcAll
                continue;
            }

            applyMechanicToSheet(mechToApply, null);
        }
    }
}

/* ===== APLICAR MECÂNICAS DE LIMITE DE MÓDULOS DE CLASSE ===== */
function applyClassModuleLimitMechanics() {
    if (!window._classModules || !window._systemData?.mechanics) return;

    // Descobrir classe selecionada
    const classeEl = document.getElementById('selClasse');
    const classeNome = classeEl ? classeEl.value : '';
    if (!classeNome || !window._classModules[classeNome]) return;

    const mechanicsById = {};
    for (const m of window._systemData.mechanics) {
        mechanicsById[m.id] = m;
    }

    for (const mod of window._classModules[classeNome]) {
        if (!mod.mecanicaLimiteId) continue;
        const mech = mechanicsById[mod.mecanicaLimiteId];
        if (!mech) {
            console.warn(`⚠️ Módulo "${mod.titulo}": mecânica de limite "${mod.mecanicaLimiteId}" não encontrada`);
            continue;
        }
        applyMechanicToSheet(mech, null);
    }
}

/**
 * Verifica se uma mecânica "modificar" contém referências à ficha
 * (tipo 'ficha' em algum termo de equação) — ou seja, seu valor depende
 * de atributos/perícias que mudam dinamicamente.
 */
function _mechHasSheetRefs(mech) {
    const config = mech.config || {};
    const calculos = Array.isArray(config.calculos) ? config.calculos
        : [{ equacao: config.equacao }];
    for (const calc of calculos) {
        if (Array.isArray(calc.equacao)) {
            for (const term of calc.equacao) {
                if (term.tipo === 'ficha') return true;
            }
        }
        // Legacy format
        if (calc.valorTipo === 'ficha') return true;
    }
    return false;
}

/**
 * Re-avalia dinamicamente todas as mecânicas brutas de valores derivados.
 * Chamada por recalcAll() para garantir que equações com referências à ficha
 * sempre reflitam os valores atuais de atributos/perícias.
 */
function resolveDerivedValueMechanicsLive() {
    // Limpar contribuições anteriores rastreadas
    _dynamicMechContributions = {};

    for (const mech of _derivedValueMechanicsRaw) {
        const config = mech.config || {};
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: 'fixo' }];

        for (const calc of calculos) {
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const rawField = TARGET_MAP[alvo];
                if (!rawField) {
                    console.warn(`⚠️ Mecânica DV "${mech.nome}": alvo "${alvo}" não encontrado no TARGET_MAP`);
                    continue;
                }

                const field = mech._isBaseCalc ? 'BASE:' + rawField : rawField;

                const val = resolveCalcValue(calc);
                const op = calc.operacao;

                console.log(`🔧 DV Mech "${mech.nome}": ${op}${val} → ${alvo} (${field})`);

                if (op === '+') {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + val;
                    _dynamicMechContributions[field] = (_dynamicMechContributions[field] || 0) + val;
                }
                else if (op === '-') {
                    state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - val;
                    _dynamicMechContributions[field] = (_dynamicMechContributions[field] || 0) - val;
                }
                else if (op === '×' || op === '*') {
                    const multKey = (mech._isBaseCalc ? 'BASE_MULT:' : 'MULT:') + rawField;
                    state.mechanicBonuses[multKey] = (state.mechanicBonuses[multKey] || 1) * val;
                    _dynamicMechContributions[multKey] = val;
                }
                else if (op === '=') {
                    const setKey = (mech._isBaseCalc ? 'BASE_SET:' : 'SET:') + rawField;
                    state.mechanicBonuses[setKey] = val;
                    _dynamicMechContributions[setKey] = val;
                }
                else if (op === '÷' || op === '/') {
                    const divKey = (mech._isBaseCalc ? 'BASE_DIV:' : 'DIV:') + rawField;
                    state.mechanicBonuses[divKey] = (state.mechanicBonuses[divKey] || 1) * val;
                    _dynamicMechContributions[divKey] = val;
                }
            }
        }
    }
}

/**
 * Retorna as contribuições dinâmicas rastreadas para subtração seletiva em recalcAll().
 * Isso permite que recalcAll() remova APENAS os bônus de equações dinâmicas,
 * preservando bônus de outras fontes (ex: peculiaridades raciais).
 */
function _getDynamicMechContributions() {
    return _dynamicMechContributions;
}

/**
 * Retorna as chaves DERIVED: que são gerenciadas por _derivedValueMechanicsRaw.
 * Usado por recalcAll() para limpar apenas essas chaves antes de re-resolver.
 */
function _getDerivedMechKeys() {
    const keys = new Set();
    for (const mech of _derivedValueMechanicsRaw) {
        const config = mech.config || {};
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo }];
        for (const calc of calculos) {
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (field) keys.add(field);
            }
        }
    }
    return keys;
}

/* ===== APLICAR UMA MECÂNICA INDIVIDUAL ===== */
function applyMechanicToSheet(mech, parentPec, isOneOff = false) {
    const tipo = mech.tipo;

    // Se a mecânica é evoluível, resolver o valor com base no nível atual da peculiaridade
    let config = mech.config || {};
    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || parentPec.nivel || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog) {
            // Criar config ajustada ao nível
            config = JSON.parse(JSON.stringify(config));
            if (tipo === 'modificar' || tipo === 'limitar') {
                // New equation-based progression: override fixo term values
                if (prog.termos && Array.isArray(config.calculos)) {
                    for (const calc of config.calculos) {
                        if (Array.isArray(calc.equacao)) {
                            let fixoIdx = 0;
                            for (const term of calc.equacao) {
                                if (term.tipo !== 'ficha' && term.tipo !== 'sort') {
                                    const overrideVal = prog.termos[String(fixoIdx)];
                                    if (overrideVal !== undefined && overrideVal !== '') {
                                        term.valor = overrideVal;
                                    }
                                    fixoIdx++;
                                }
                            }
                        }
                    }
                } else if (tipo === 'modificar' && prog.valor !== undefined) {
                    // Legacy single-value progression
                    config.valor = prog.valor;
                } else if (tipo === 'limitar') {
                    const limVal = prog.valorLimite !== undefined ? prog.valorLimite : prog.valor;
                    if (limVal !== undefined) {
                        if (config.valorMaximo !== undefined) config.valorMaximo = limVal;
                        if (config.valorMinimo !== undefined) config.valorMinimo = limVal;
                    }
                }
            } else if (tipo === 'distribuir') {
                if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
                if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
                if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
            }
            // narrativo, conceder e condicional não alteram cálculos, só exibição
        }
    }

    // === ESCOPO DE APLICAÇÃO: mecânica que afeta ITENS EQUIPADOS ===
    // Ex: "todo item com tag Adaga recebe +1 de Dano". Reaplica a si mesma uma
    // vez por item que casa com o filtro, com o escopo ligado — os alvos
    // marcados como `escopoItem` caem no bag daquele item.
    // Este é o único ponto por onde TODA mecânica ativa passa, venha ela de
    // peculiaridade, raça, tribo, condição ou do próprio item.
    if (mech.escopoAplicacao === 'itens' && !_meItemScope) {
        for (const it of _meItensDoFiltro(mech.itemFiltro)) {
            const anterior = _meItemScope;
            _meItemScope = it.id;
            try {
                applyMechanicToSheet({ ...mech, escopoAplicacao: 'personagem' }, parentPec, isOneOff);
            } finally {
                _meItemScope = anterior;
            }
        }
        return;
    }

    // Verificar condições
    const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
    const isPermanent = !mech.duracao || mech.duracao === 'permanente';
    const isCreation = mech.duracao === 'criacao';

    // === TIPO: MODIFICAR ===
    if (tipo === 'modificar' && isPermanent && !isConditional) {
        // Support new multi-calc format
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, operacao: config.operacao, valor: config.valor, valorTipo: 'fixo' }];

        const _msgDescs = []; // resumo do que foi aplicado (coletor de mensagens)

        for (const calc of calculos) {
            // === EXP MODIFIER: special handling ===
            if (calc.alvo === 'EXP') {
                _handleExpCalc(calc, mech, parentPec);
                continue;
            }
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const rawField = TARGET_MAP[alvo];
                if (!rawField) {
                    console.warn(`⚠️ Mecânica "${mech.nome}": alvo "${alvo}" não encontrado no TARGET_MAP`);
                    continue;
                }

                const field = mech._isBaseCalc ? 'BASE:' + rawField : rawField;

                const val = resolveCalcValue(calc);
                const op = calc.operacao;

                if (_meMsgCollector) _msgDescs.push(`${op === '=' ? '= ' : (op || '+')}${val} em ${alvo}`);

                if (field.startsWith('ATUAL:')) {
                    if (isOneOff) {
                        const cleanKey = field.replace('ATUAL:', '');
                        const input = document.querySelector(`[data-key="${cleanKey}"]`);
                        if (input) {
                            let currentVal = Number(input.value) || 0;
                            if (op === '+') input.value = currentVal + val;
                            else if (op === '-') input.value = Math.max(0, currentVal - val);
                            else if (op === '=') input.value = val;
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    continue;
                }

                // Alvo escopado a um item em escopo → bag daquele item; senão, global.
                const bag = _meBonusBag(rawField);

                if (op === '+') bag[field] = (bag[field] || 0) + val;
                else if (op === '-') bag[field] = (bag[field] || 0) - val;
                else if (op === '×' || op === '*') {
                    const multKey = (mech._isBaseCalc ? 'BASE_MULT:' : 'MULT:') + rawField;
                    bag[multKey] = (bag[multKey] || 1) * val;
                }
                else if (op === '=') {
                    // "Definir fixo": overrides the base formula entirely
                    const setKey = (mech._isBaseCalc ? 'BASE_SET:' : 'SET:') + rawField;
                    bag[setKey] = val;
                }
                else if (op === '÷' || op === '/') {
                    const divKey = (mech._isBaseCalc ? 'BASE_DIV:' : 'DIV:') + rawField;
                    bag[divKey] = (bag[divKey] || 1) * val;
                }
            }
        }

        // Resumo do que foi aplicado (exibido na cadeia de mensagens do botão)
        if (_msgDescs.length) _mePushMsg(mech, _msgDescs.join('; '));
    }

    // === TIPO: LIMITAR ===
    if (tipo === 'limitar' && isPermanent && !isConditional) {
        // Support new multi-calc format
        const calculos = Array.isArray(config.calculos) ? config.calculos
            : [{ alvo: config.alvo, tipoLimite: config.tipoLimite, valor: config.valorMaximo ?? config.valorMinimo, valorTipo: 'fixo' }];

        for (const calc of calculos) {
            const field = TARGET_MAP[calc.alvo];
            if (!field) continue;

            const resolvedVal = resolveCalcValue(calc);

            if (calc.tipoLimite === 'bloqueio') {
                state.mechanicLimits[field] = { tipo: 'bloqueio', max: 0, min: 0 };
            } else if (calc.tipoLimite === 'maximo') {
                state.mechanicLimits[field] = { tipo: 'maximo', max: resolvedVal, min: null };
            } else if (calc.tipoLimite === 'minimo') {
                state.mechanicLimits[field] = { tipo: 'minimo', max: null, min: resolvedVal };
            } else if (calc.tipoLimite === 'clamp') {
                state.mechanicLimits[field] = { tipo: 'clamp', max: resolvedVal, min: calc.valorMinimo ?? 0 };
            } else if (calc.tipoLimite === 'maximo_itens') {
                // Teto só sobre a parcela vinda de peças equipadas (trilha
                // ITEM: preenchida pelo inventário). O que peculiaridade e
                // condição somam passa inteiro — Domínio limita equipamento,
                // não o corpo. Menor teto vence quando há mais de um.
                if (!state.mechanicBonuses) state.mechanicBonuses = {};
                const k = `ITEMCAP:${field}`;
                state.mechanicBonuses[k] = state.mechanicBonuses[k] === undefined
                    ? resolvedVal : Math.min(state.mechanicBonuses[k], resolvedVal);
            }
        }
    }

    // === TIPO: CONCEDER ===
    if (tipo === 'conceder') {
        if (config.tipoConcessao === 'adicionar_parte_corpo' || config.tipoConcessao === 'remover_parte_corpo') {
            state.partesCorpoModificadas = state.partesCorpoModificadas || [];
            state.partesCorpoModificadas.push({
                acao: config.tipoConcessao,
                partes: config.partesCorpo || [],
                fonte: parentPec?.nome || mech.nome
            });
            
            // Integrar os slots na state.mechanicBonuses se definidos
            if (config.partesCorpo) {
                for (const p of config.partesCorpo) {
                    if (p.slots !== null && p.slots !== undefined) {
                        const key = 'slot_' + p.id;
                        const factor = config.tipoConcessao === 'adicionar_parte_corpo' ? 1 : -1;
                        state.mechanicBonuses[key] = (state.mechanicBonuses[key] || 0) + (p.slots * factor);
                    }
                }
            }
        } else if (config.tipoConcessao === 'conceder_equipamento') {
            state.capacidades.push({
                tipo: 'acesso',
                descricao: config.descricaoConcessao || 'Equipamento concedido',
                fonte: parentPec?.nome || mech.nome
            });
            _concederEquipamentosDeMecanica(mech, config, parentPec);
        } else if (_ME_TC_EQUIP_BAG[config.tipoConcessao]) {
            const bag = state.equipRestricoes[_ME_TC_EQUIP_BAG[config.tipoConcessao]];
            bag.push({
                reqs: Array.isArray(config.equipReqs) ? config.equipReqs : [],
                descricao: config.descricaoConcessao || '',
                fonte: parentPec?.nome || mech.nome
            });
            state.capacidades.push({
                tipo: config.tipoConcessao,
                descricao: config.descricaoConcessao || _ME_TC_EQUIP_DESC[config.tipoConcessao],
                fonte: parentPec?.nome || mech.nome
            });
        } else {
            state.capacidades.push({
                tipo: config.tipoConcessao,
                descricao: config.descricaoConcessao,
                fonte: parentPec?.nome || mech.nome
            });
        }
    }

    // === TIPO: DISTRIBUIR ===
    if (tipo === 'distribuir' && (isCreation || isPermanent)) {
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaAplicada = dados?.aplicada;

        // Restaurar bônus de alvos já escolhidos (parcial ou completo)
        if (dados?.alvosEscolhidos) {
            for (const alvo of dados.alvosEscolhidos) {
                // ᛟ Elemento Rúnico → concede nível de domínio (aba Runomancia)
                if (isRunicTarget(alvo.nome)) {
                    applyRunicGrant(alvo.nome, alvo.valor, config.operacao, mech, parentPec);
                    continue;
                }
                const field = TARGET_MAP[alvo.nome];
                if (field) {
                    const v = Number(alvo.valor) || 0;
                    if (config.operacao === '-') {
                        state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - v;
                    } else if (config.operacao === '=') {
                        state.mechanicBonuses['SET:' + field] = v;
                    } else {
                        state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + v;
                    }
                } else {
                    console.warn(`Alvo não encontrado no TARGET_MAP: ${alvo.nome}`);
                }
            }
        }

        // Se não totalmente aplicada, marcar como pendente para mostrar slots restantes
        if (!jaAplicada) {
            state.mecanicasPendentes.push(mech);
        }
    }

    // === TIPO: BOOLEANO ===
    if (tipo === 'booleano') {
        // Suporta múltiplas verificações (config.verificacoes, combinadas por
        // config.operadorLogico 'e'|'ou'). Config legada (campos no topo) = 1 verificação.
        const verifs = (Array.isArray(config.verificacoes) && config.verificacoes.length > 0)
            ? config.verificacoes : [config];
        const operadorLogico = config.operadorLogico === 'ou' ? 'ou' : 'e';

        const resultados = verifs.map(v => _meEvalBoolVerif(v, mech));
        const resultadoBooleano = operadorLogico === 'ou'
            ? resultados.some(r => r.resultado)
            : resultados.every(r => r.resultado);

        const first = resultados[0] || { valA: 0, valB: 0, op: '>=', modo: 'numerico' };
        const valA = first.valA, valB = first.valB, op = first.op;

        const valorSaida = resultadoBooleano
            ? (parseFloat(config.valorVerdadeiro) || config.valorVerdadeiro || 0)
            : (parseFloat(config.valorFalso) || config.valorFalso || 0);

        if (!state.booleanResults) state.booleanResults = {};
        state.booleanResults[mech.id] = { valorSaida, resultadoBooleano, valA, valB, op, modo: first.modo, resultados, operadorLogico };
        console.log(`🔀 Booleano "${mech.nome}": [${resultados.map(r => r.resultado ? '✅' : '❌').join(operadorLogico === 'ou' ? ' OU ' : ' E ')}] → ${resultadoBooleano} (saída: ${valorSaida})`);

        // Registrar a mensagem do resultado (texto bruto de Verdadeiro/Falso)
        _mePushMsg(mech, resultadoBooleano ? (config.valorVerdadeiro ?? '') : (config.valorFalso ?? ''), resultadoBooleano);

        // Acionar mecânicas vinculadas ao resultado (✅ Verdadeiro / ❌ Falso)
        const trigIds = resultadoBooleano ? config.efeitoTrueIds : config.efeitoFalseIds;
        _meTriggerMechanics(trigIds, mech, parentPec, isOneOff);
    }

    // === TIPO: CONDICIONAL ENCADEADO ===
    if (tipo === 'condicional_encadeado') {
        const resultado = resolveChainedConditional(config);
        if (!state.chainedResults) state.chainedResults = {};
        state.chainedResults[mech.id] = resultado;
        console.log(`🔗 Cond. Encadeada "${mech.nome}": valor ${resultado.valorEquacao} → "${resultado.valorSaida}" (condição #${resultado.condicaoIndex >= 0 ? resultado.condicaoIndex + 1 : 'padrão'})`);

        // Registrar a mensagem da faixa (condição) que casou — ou o valor padrão
        _mePushMsg(mech, resultado.valorSaida, resultado.condicaoIndex >= 0);

        // Acionar mecânicas vinculadas à condição que casou
        if (resultado.condicaoIndex >= 0) {
            const condicoes = Array.isArray(config.condicoes) ? config.condicoes : [];
            const cond = condicoes[resultado.condicaoIndex];
            if (cond) _meTriggerMechanics(cond.efeitoMecanicaIds, mech, parentPec, isOneOff);
        }
    }

    // === TIPO: CONDICIONAL ===
    if (tipo === 'condicional') {
        const condicaoMecanica = config.condicaoMecanica || false;
        if (condicaoMecanica && config.condicaoMecanicaIds && config.condicaoMecanicaIds.length > 0) {
            let allTrue = true;
            
            // Avaliar mecânicas booleanas vinculadas
            for (const boolId of config.condicaoMecanicaIds) {
                const boolMech = window._systemData?.mechanics?.find(m => m.id === boolId);
                if (boolMech && boolMech.tipo === 'booleano') {
                    // Executar a mecânica booleana para atualizar state.booleanResults
                    applyMechanicToSheet(boolMech, parentPec, isOneOff);
                    
                    if (!state.booleanResults || !state.booleanResults[boolId] || !state.booleanResults[boolId].resultadoBooleano) {
                        allTrue = false;
                    }
                } else {
                    // Se não encontrar a mecânica booleana, falha a condição por segurança
                    allTrue = false;
                }
            }
            
            // Aplicar mecânicas de sucesso ou falha baseando-se no resultado
            const targetIds = allTrue ? (config.efeitoSucessoIds || []) : (config.efeitoFalhaIds || []);
            for (const targetId of targetIds) {
                const targetMech = window._systemData?.mechanics?.find(m => m.id === targetId);
                if (targetMech) {
                    applyMechanicToSheet(targetMech, parentPec, isOneOff);
                }
            }
        }
    }

    // Narrativo: apenas informativo (exibido no card) — mas, quando acionado
    // numa cadeia com coleta ativa, sua mensagem também é exibida ao jogador.
    if (tipo === 'narrativo') {
        _mePushMsg(mech, config.textoEfeito || mech.previewTexto || mech.descricao || '');
    }
}
/* ===== FORMAT EQUATION PREVIEW ===== */
function _formatEquationPreview(equacao) {
    if (!Array.isArray(equacao) || equacao.length === 0) return '?';
    // Só usa a forma menor(A, B, …) quando a equação INTEIRA é um min/max.
    // Equação mista (ex.: Qualidade + Afiação ⌊min Teto⌋ + FOR) é um fold
    // sequencial e a forma de função mentiria sobre a conta.
    const soMinMax = equacao.length > 1 && equacao.slice(1).every(t => t.op === 'min' || t.op === 'max');
    if (soMinMax) {
        const fnName = equacao[1].op === 'min' ? 'menor' : 'maior';
        const parts = equacao.map(t => {
            if (t.tipo === 'ficha') return `[${t.ref || '?'}]`;
            if (t.tipo === 'sort') return `🎲${t.min ?? '?'}~${t.max ?? '?'}`;
            return (t.valor ?? '?');
        });
        return `${fnName}(${parts.join(', ')})`;
    }
    let str = '';
    for (let i = 0; i < equacao.length; i++) {
        const t = equacao[i];
        if (i > 0 && t.op) str += (t.op === 'min' || t.op === 'max') ? ` ⌊${t.op}⌋ ` : ` ${t.op} `;
        if (t.tipo === 'ficha') str += `[${t.ref || '?'}]`;
        else if (t.tipo === 'sort') str += `🎲${t.min ?? '?'}~${t.max ?? '?'}`;
        else str += (t.valor ?? '?');
    }
    return equacao.length > 1 ? `(${str})` : str;
}

/* ===== GERAR TEXTO DE PREVIEW ===== */
function generatePreviewText(mech) {
    // For conditional mechanics, always generate dynamically to resolve sub-mechanic previews
    if (mech.previewTexto && mech.tipo !== 'condicional') return mech.previewTexto;
    const config = mech.config || {};
    const tipo = mech.tipo;

    if (tipo === 'modificar') {
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            return config.calculos.map(c => {
                // EXP: use standard equation format
                if (c.alvo === 'EXP') {
                    const op = c.operacao || '+';
                    let val;
                    if (Array.isArray(c.equacao) && c.equacao.length > 0) {
                        val = _formatEquationPreview(c.equacao);
                    } else {
                        val = c.valor ?? '?';
                    }
                    const qualLabels = { exp_total: 'EXP Total', exp_restante: 'EXP Restante', ambos: 'EXP Total + Restante' };
                    const quandoLabels = { na_criacao: 'Na Criação', por_sessao: 'Por Sessão', por_descanso_longo: 'Por Descanso Longo', por_descanso_curto: 'Por Descanso Curto', por_arco: 'Por Arco', por_masmorra: 'Por Masmorra', ao_ativar: 'Ao Ativar', ao_desativar: 'Ao Desativar', condicional: 'Condicional', permanente: 'Permanente', por_uso_recurso: 'Por Uso de Recurso', por_morte: 'Por Morte/Ressurreição' };
                    const quandoLabel = quandoLabels[mech.quandoAplica] || '';
                    const triggerSuffix = quandoLabel ? ` — ${quandoLabel}` : '';
                    return `${op}${val} em ${qualLabels[c.qualExp] || 'EXP'}${triggerSuffix}`;
                }
                const op = c.operacao || '+';
                let val;
                if (Array.isArray(c.equacao) && c.equacao.length > 0) {
                    val = _formatEquationPreview(c.equacao);
                } else if (c.valorTipo === 'ficha') {
                    const mult = c.valorMultiplicador && c.valorMultiplicador !== 1 ? ` × ${c.valorMultiplicador}` : '';
                    val = `[${c.valorRef || '?'}${mult}]`;
                } else {
                    val = c.valor ?? 0;
                }
                return `${op}${val} em ${c.alvo || '?'}`;
            }).join('; ');
        }
        const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
        const alvosStr = alvos.filter(Boolean).join(', ');
        return `${config.operacao || '+'}${config.valor || 0} em ${alvosStr}`;
    }
    if (tipo === 'limitar') {
        if (Array.isArray(config.calculos) && config.calculos.length > 0) {
            return config.calculos.map(c => {
                const alvo = c.alvo || '?';
                if (c.tipoLimite === 'bloqueio') return `Bloqueio: ${alvo}`;
                let val;
                if (Array.isArray(c.equacao) && c.equacao.length > 0) {
                    val = _formatEquationPreview(c.equacao);
                } else if (c.valorTipo === 'ficha') {
                    const mult = c.valorMultiplicador && c.valorMultiplicador !== 1 ? ` × ${c.valorMultiplicador}` : '';
                    val = `[${c.valorRef || '?'}${mult}]`;
                } else {
                    val = c.valor ?? '?';
                }
                if (c.tipoLimite === 'maximo') return `${alvo} máximo ${val}`;
                if (c.tipoLimite === 'minimo') return `${alvo} mínimo ${val}`;
                return `Limite em ${alvo}`;
            }).join('; ');
        }
        if (config.tipoLimite === 'bloqueio') return `Bloqueio: ${config.alvo}`;
        if (config.tipoLimite === 'maximo') return `${config.alvo} máximo ${config.valorMaximo}`;
        if (config.tipoLimite === 'minimo') return `${config.alvo} mínimo ${config.valorMinimo}`;
        return `Limite em ${config.alvo}`;
    }
    if (tipo === 'conceder') {
        if (config.tipoConcessao === 'conceder_equipamento') {
            const catalog = window._inventoryState?.catalog || window._systemData?.equipment || [];
            const lista = (Array.isArray(config.equipamentosConcedidos) ? config.equipamentosConcedidos : [])
                .map(g => {
                    const eq = catalog.find(e => e.id === (g.id || g.equipamentoId));
                    return `${eq ? eq.nome : (g.id || '?')}${(g.quantidade || 1) > 1 ? ` ×${g.quantidade}` : ''}`;
                }).join(', ');
            return `🎒 Concede equipamento (Item Solto): ${lista || config.descricaoConcessao || ''}`;
        }
        return `${config.tipoConcessao || 'Capacidade'}: ${config.descricaoConcessao || ''}`;
    }
    if (tipo === 'distribuir') {
        const poolLabel = config.pool === 'Personalizado' && Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.length
            ? config.poolPersonalizado.join(', ')
            : (config.pool || '?');
        return `Distribuir: ${config.operacao || '+'}${config.valorPorAlvo || 1} em ${config.quantidadeAlvos || '?'} alvos de [${poolLabel}]`;
    }
    if (tipo === 'condicional') {
        // Build conditional preview with resolved sub-mechanic previews
        const parts = [];
        
        const allMechanics = window._systemData?.mechanics || [];
        if (config.condicaoMecanica && config.condicaoMecanicaIds && config.condicaoMecanicaIds.length > 0) {
            const boolNames = config.condicaoMecanicaIds.map(id => {
                const m = allMechanics.find(x => x.id === id);
                return m ? m.nome : '?';
            }).join(', ');
            parts.push(`🔀 Condição: ${boolNames}`);
        } else {
            parts.push(config.gatilho || '');
        }

        const sucessoIds = config.efeitoSucessoIds || [];
        const falhaIds = config.efeitoFalhaIds || [];
        const textoSucesso = config.textoSucesso || '';
        const textoFalha = config.textoFalha || '';
        
        const resolveSub = (id) => {
            let m = allMechanics.find(x => x.id === id);
            if (!m) return '?';
            
            // If parent has a previewLevel and the adjustment function is available, adjust sub-mechanic
            if (mech._previewLevel && typeof window._adjustMechanicForLevel === 'function') {
                m = window._adjustMechanicForLevel(m, mech._previewLevel);
                // m._previewLevel is already set by _adjustMechanicForLevel, so it propagates recursively
                return m.previewTexto || generatePreviewText(m);
            }
            return m.previewTexto || generatePreviewText(m);
        };

        const successSubTexts = sucessoIds.map(resolveSub);
        if (textoSucesso) successSubTexts.unshift(textoSucesso);
        if (successSubTexts.length > 0) {
            parts.push(`Se Sucesso: ${successSubTexts.join('; ')}`);
        }

        const failSubTexts = falhaIds.map(resolveSub);
        if (textoFalha) failSubTexts.unshift(textoFalha);
        if (failSubTexts.length > 0) {
            parts.push(`Se Falha: ${failSubTexts.join('; ')}`);
        }
        return parts.filter(Boolean).join(' — ');
    }
    if (tipo === 'narrativo') {
        return config.textoEfeito || mech.descricao || '';
    }
    return mech.descricao || '';
}

/* ===== UI DE DISTRIBUIÇÃO ===== */

/**
 * Resolve a config de distribuição considerando nível evoluível.
 */
function _resolveDistribuirConfig(mech, parentPec) {
    let config = mech.config ? JSON.parse(JSON.stringify(mech.config)) : {};

    if (mech.evoluivel && mech.progressao && parentPec) {
        const dotKey = 'pec_' + (parentPec.key || parentPec.id);
        const currentLevel = state.dots[dotKey] || parentPec.nivelAtual || 1;
        const prog = mech.progressao[String(currentLevel)];
        if (prog) {
            if (prog.valor !== undefined) config.valorPorAlvo = prog.valor;
            if (prog.valorPorAlvo !== undefined) config.valorPorAlvo = prog.valorPorAlvo;
            if (prog.quantidadeAlvos !== undefined) config.quantidadeAlvos = prog.quantidadeAlvos;
        }
    }
    return config;
}

/**
 * (Re)escreve o rótulo de uma <option> rúnica com o nível ATUAL do personagem.
 * Idempotente: pode ser chamada quantas vezes quiser sobre a mesma option.
 */
function _setRunicOptionLabel(opt) {
    const id = opt.dataset.runicId;
    if (!id) return;
    const el = (window._systemData?.runicElements || []).find(e => e.id === id);
    const nome = opt.dataset.runicNome || el?.nome || id;
    const max = runicMaxNivel(el);
    const atual = runicNivelEfetivo(id);
    const valor = Number(opt.dataset.runicValor) || 0;
    const op = opt.dataset.runicOp || '+';

    const noTeto = op !== '=' && (atual + valor) > max;
    opt.textContent = `ᛟ ${nome} — Nv ${atual}/${max}${noTeto ? ' (nível máximo)' : ''}`;
    // Não mexer em options desabilitadas pela restrição "alvos diferentes":
    // essas carregam data-lockedDiff e têm prioridade.
    if (opt.dataset.lockedDiff === '1') return;
    opt.disabled = noTeto;
}

/**
 * Atualiza os rótulos de TODAS as options rúnicas presentes na página.
 * Chamada ao fim de cada recálculo de mecânicas e ao focar um select, para que
 * o nível exibido nunca fique defasado em relação a state.runomancia.
 */
function refreshRunicDistribuirLabels(root) {
    const scope = root || document;
    scope.querySelectorAll('.distribuir-select option[data-runic-id]').forEach(_setRunicOptionLabel);
}
window.refreshRunicDistribuirLabels = refreshRunicDistribuirLabels;

/**
 * Renderiza a UI de distribuição.
 * Se já houver alvos confirmados parcialmente, mostra-os travados e oferece os slots restantes.
 * Se todos os slots estiverem preenchidos, mostra apenas o resumo.
 */
function renderDistribuirUI(container, mech, parentPec) {
    const config = _resolveDistribuirConfig(mech, parentPec);

    const pool = config.pool === 'Personalizado' && Array.isArray(config.poolPersonalizado) && config.poolPersonalizado.length > 0
        ? config.poolPersonalizado
        : getDistribuirPool(config.pool);
    const totalQty = config.quantidadeAlvos || 1;
    const valorPorAlvo = config.valorPorAlvo || 1;
    const restricao = config.restricao || '';

    // Buscar alvos já confirmados
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const remaining = totalQty - jaEscolhidos.length;

    const wrapper = document.createElement('div');
    wrapper.className = 'distribuir-ui';
    wrapper.dataset.mechId = mech.id;

    // --- Resumo do que já foi escolhido ---
    if (jaEscolhidos.length > 0) {
        const resumo = document.createElement('div');
        resumo.className = 'distribuir-resumo';
        const linhas = jaEscolhidos.map(a => {
            const nome = isRunicTarget(a.nome) ? 'ᛟ ' + a.nome.slice(RUNIC_TARGET_PREFIX.length) : a.nome;
            return `${nome} (+${a.valor})`;
        }).join(', ');
        resumo.innerHTML = `<strong>✅ Distribuído:</strong> ${linhas}`;
        wrapper.appendChild(resumo);
    }

    // Se todos os slots foram preenchidos, não mostrar mais selects
    if (remaining <= 0) {
        container.appendChild(wrapper);
        return;
    }

    // --- Título ---
    const titulo = document.createElement('div');
    titulo.className = 'distribuir-titulo';
    const poolEhRunico = pool.length > 0 && pool.every(n => isRunicTarget(n));
    const substantivo = poolEhRunico
        ? (restricao === 'diferentes' ? 'Elementos Rúnicos diferentes' : 'Elementos Rúnicos')
        : (restricao === 'diferentes' ? 'alvos diferentes' : 'alvos');
    titulo.innerHTML = `⚠️ <strong>DISTRIBUIÇÃO PENDENTE</strong><br>
        Escolha até ${remaining} ${substantivo} para receber +${valorPorAlvo} ${poolEhRunico ? 'nível de domínio' : ''} (${jaEscolhidos.length}/${totalQty} distribuído${jaEscolhidos.length !== 1 ? 's' : ''}):`;
    wrapper.appendChild(titulo);

    // --- Selects apenas para os slots restantes ---
    const selectsContainer = document.createElement('div');
    selectsContainer.className = 'distribuir-selects';

    // Nomes já escolhidos (para desabilitar em restricao="diferentes")
    const nomesJaEscolhidos = jaEscolhidos.map(a => a.nome);

    for (let i = 0; i < remaining; i++) {
        const sel = document.createElement('select');
        sel.className = 'distribuir-select';
        sel.dataset.slotIndex = i;
        sel.innerHTML = `<option value="">— Selecione —</option>`;
        pool.forEach(alvoName => {
            const opt = document.createElement('option');
            opt.value = alvoName;
            opt.textContent = alvoName;

            // ᛟ Elemento Rúnico: mostra nível atual/máximo e trava os já no teto
            if (isRunicTarget(alvoName)) {
                const el = runicElementFromTarget(alvoName);
                if (!el) {
                    // Elemento removido do cadastro — não oferecer
                    return;
                }
                // O nível é recalculado depois por refreshRunicDistribuirLabels():
                // no boot a ficha pode renderizar a distribuição ANTES de
                // state.runomancia ser carregado, e o rótulo ficaria congelado.
                opt.dataset.runicId = el.id;
                opt.dataset.runicNome = el.nome;
                opt.dataset.runicValor = String(Number(valorPorAlvo) || 0);
                opt.dataset.runicOp = config.operacao || '+';
                _setRunicOptionLabel(opt);
            }

            // Desabilitar nomes que já foram confirmados anteriormente
            if (restricao === 'diferentes' && nomesJaEscolhidos.includes(alvoName)) {
                opt.disabled = true;
                opt.dataset.lockedDiff = '1';
            }
            sel.appendChild(opt);
        });

        // Rótulos rúnicos são recalculados ao abrir o select: garante o nível
        // correto mesmo que a ficha ainda estivesse carregando na renderização.
        sel.addEventListener('focus', () => refreshRunicDistribuirLabels(wrapper));

        sel.addEventListener('change', () => {
            if (restricao === 'diferentes') {
                updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos);
            }
        });

        selectsContainer.appendChild(sel);
    }
    wrapper.appendChild(selectsContainer);

    // --- Botão de confirmar ---
    const btnConfirmar = document.createElement('button');
    btnConfirmar.className = 'btn-distribuir-confirmar';
    btnConfirmar.textContent = '✅ Confirmar Distribuição';
    btnConfirmar.addEventListener('click', () => confirmarDistribuicao(mech, wrapper, parentPec));
    wrapper.appendChild(btnConfirmar);

    container.appendChild(wrapper);
}

function updateDistribuirOptions(wrapper, pool, nomesJaEscolhidos) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const selectedValues = Array.from(selects).map(s => s.value).filter(Boolean);
    const allUsed = [...(nomesJaEscolhidos || []), ...selectedValues];

    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.querySelectorAll('option').forEach(opt => {
            if (!opt.value) return; // skip placeholder
            const usadoPorOutro = allUsed.includes(opt.value) && opt.value !== currentVal;
            // ᛟ Um elemento no Nível Máximo continua travado mesmo que ninguém
            // o tenha escolhido — senão esta função o reabilitaria.
            const noTeto = opt.dataset.runicId
                ? String(opt.textContent).includes('(nível máximo)')
                : false;
            opt.disabled = usadoPorOutro || noTeto;
            opt.dataset.lockedDiff = usadoPorOutro ? '1' : '';
        });
    });
}

function confirmarDistribuicao(mech, wrapper, parentPec) {
    const selects = wrapper.querySelectorAll('.distribuir-select');
    const config = _resolveDistribuirConfig(mech, parentPec);
    const valorPorAlvo = config.valorPorAlvo || 1;

    // Coletar apenas os novos alvos selecionados (não vazios)
    const novosAlvos = [];
    for (const sel of selects) {
        if (sel.value) {
            novosAlvos.push({ nome: sel.value, valor: Number(valorPorAlvo) || 0 });
        }
    }

    if (novosAlvos.length === 0) {
        alert('Selecione pelo menos 1 alvo antes de confirmar.');
        return;
    }

    // Mesclar com alvos já confirmados anteriormente
    const dados = state.mecanicasAplicadas?.[mech.id];
    const jaEscolhidos = dados?.alvosEscolhidos || [];
    const todosAlvos = [...jaEscolhidos, ...novosAlvos];
    const totalQty = config.quantidadeAlvos || 1;
    const todosPreenchidos = todosAlvos.length >= totalQty;

    // Salvar no state (aplicada=true apenas quando todos preenchidos)
    state.mecanicasAplicadas[mech.id] = {
        aplicada: todosPreenchidos,
        timestamp: new Date().toISOString(),
        fonte: mech.fonte || '',
        alvosEscolhidos: todosAlvos
    };

    // Aplicar bônus dos NOVOS alvos apenas
    let tocouRunomancia = false;
    for (const alvo of novosAlvos) {
        // ᛟ Elemento Rúnico → nível de domínio, não bônus numérico
        if (isRunicTarget(alvo.nome)) {
            applyRunicGrant(alvo.nome, alvo.valor, config.operacao, mech, parentPec);
            tocouRunomancia = true;
            continue;
        }
        const field = TARGET_MAP[alvo.nome];
        if (field) {
            const v = Number(alvo.valor) || 0;
            if (config.operacao === '-') {
                state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) - v;
            } else if (config.operacao === '=') {
                state.mechanicBonuses['SET:' + field] = v;
            } else {
                state.mechanicBonuses[field] = (state.mechanicBonuses[field] || 0) + v;
            }
        } else {
            console.warn(`Alvo não encontrado no TARGET_MAP: ${alvo.nome}`);
        }
    }

    // Se todos preenchidos, remover da lista de pendentes
    if (todosPreenchidos) {
        state.mecanicasPendentes = state.mecanicasPendentes.filter(m => m.id !== mech.id);
    }

    // Recalcular e salvar
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    // Re-renderizar peculiaridades para atualizar a UI
    _reRenderPeculiaridades();
}

/**
 * Re-renderiza toda a grid de peculiaridades para refletir mudanças.
 * Inclui peculiaridades de raça, classe e tribo.
 */
function _reRenderPeculiaridades() {
    const grid = document.getElementById('peculiaridadesGrid');
    if (!grid) return;

    // Re-renderizar raça
    const racaNome = document.getElementById('selRaca')?.value;
    if (racaNome && window.RACES?.[racaNome]) {
        if (typeof _clearPeculiaridadeBlocksByFonte === 'function') {
            _clearPeculiaridadeBlocksByFonte(grid, 'raca');
        }
        if (typeof _renderSourceBlock === 'function') {
            _renderSourceBlock(window.RACES[racaNome].peculiaridades, racaNome, grid, 'raca');
        } else if (typeof renderPeculiaridadesGrouped === 'function') {
            // Fallback: render all in grid (legacy)
            renderPeculiaridadesGrouped(window.RACES[racaNome].peculiaridades, racaNome, grid);
        }
    }

    // Re-renderizar classe
    const classeNome = document.getElementById('selClasse')?.value;
    if (typeof renderClassPeculiaridades === 'function') {
        renderClassPeculiaridades(classeNome);
    }

    // Re-renderizar tribo
    const triboNome = document.getElementById('selTribo')?.value;
    if (triboNome && typeof renderTriboPeculiaridades === 'function') {
        renderTriboPeculiaridades(triboNome);
    }

    // Re-renderizar individuais
    if (typeof renderIndividualPeculiaridades === 'function') {
        renderIndividualPeculiaridades();
    }
}

/**
 * Verifica se uma mecânica distribuir evoluível precisa reabrir a UI
 * porque o novo nível tem mais alvos disponíveis.
 * Chamada após level-up de peculiaridade.
 */
function checkDistribuirOnLevelUp(pec) {
    if (!pec.mecanicas) return;
    for (const mech of pec.mecanicas) {
        if (mech.tipo !== 'distribuir') continue;
        if (!mech.evoluivel || !mech.progressao) continue;

        const config = _resolveDistribuirConfig(mech, pec);
        const totalQty = config.quantidadeAlvos || 1;
        const dados = state.mecanicasAplicadas?.[mech.id];
        const jaEscolhidos = dados?.alvosEscolhidos || [];

        // Se o novo nível oferece mais slots do que os já preenchidos, reabrir
        if (jaEscolhidos.length < totalQty) {
            // Garantir que não está marcado como totalmente aplicada
            if (dados) {
                dados.aplicada = false;
            }
            // Adicionar de volta aos pendentes se não estiver lá
            if (!state.mecanicasPendentes.some(m => m.id === mech.id)) {
                state.mecanicasPendentes.push(mech);
            }
        }
    }
    // Re-renderizar para mostrar a UI
    _reRenderPeculiaridades();
}

/* ===== OBTER TODAS AS MECÂNICAS QUE AFETAM UMA PROPRIEDADE ===== */

/**
 * Retorna todas as mecânicas que afetam uma propriedade, de QUALQUER fonte.
 *
 * Fontes varridas:
 *   1. Mecânicas vinculadas (mecanicaIds) do próprio Status Vital / Valor Derivado / Perícia
 *   2. Mecânicas de peculiaridades da raça selecionada
 *   3. Mecânicas dinâmicas de equação (_derivedValueMechanicsRaw)
 *   4. Mecânicas de distribuição já aplicadas (state.mecanicasAplicadas)
 *   5. Mecânicas vinculadas a Perícias que têm como alvo a propriedade
 *   6. Mecânicas vinculadas a outros DVs / Status Vitais que têm como alvo a propriedade
 *
 * @param {string} propertyName - Nome legível da propriedade (ex: "Energia Máxima", "Agilidade")
 * @param {object} [opts] - Opções: { skipLinked: string[] } IDs de mecânicas vinculadas já listadas
 * @returns {Array<{fonte: string, preview: string, tipo: string}>}
 */
function getAffectingMechanics(propertyName, opts) {
    const results = [];
    const seenMechIds = new Set();
    const skipLinked = (opts && opts.skipLinked) || [];
    skipLinked.forEach(id => seenMechIds.add(id));

    // Resolver o campo-alvo desta propriedade no TARGET_MAP
    const targetField = TARGET_MAP[propertyName];
    if (!targetField) return results;

    // ---- Helper: verificar se uma mecânica afeta o campo-alvo ----
    function _mechAffectsTarget(mech) {
        if (!mech || !mech.config) return false;
        const config = mech.config;

        // Multi-calc format
        if (Array.isArray(config.calculos)) {
            for (const calc of config.calculos) {
                const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
                for (const alvo of alvos) {
                    if (!alvo) continue;
                    const field = TARGET_MAP[alvo];
                    if (field === targetField) return true;
                }
            }
        }

        // Legacy / single-alvo format
        if (config.alvo) {
            const alvos = Array.isArray(config.alvo) ? config.alvo : [config.alvo];
            for (const alvo of alvos) {
                if (!alvo) continue;
                const field = TARGET_MAP[alvo];
                if (field === targetField) return true;
            }
        }

        return false;
    }

    // ---- 1. Peculiaridades da raça selecionada ----
    const racaNome = document.getElementById('selRaca')?.value || '';
    if (racaNome && window.RACES && window.RACES[racaNome]) {
        const raca = window.RACES[racaNome];
        for (const pec of raca.peculiaridades) {
            if (!pec.mecanicas) continue;
            for (const mech of pec.mecanicas) {
                if (seenMechIds.has(mech.id)) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mech.id);

                // Se evoluível, ajustar preview ao nível atual
                let previewMech = mech;
                if (mech.evoluivel && mech.progressao) {
                    const dotKey = 'pec_' + (pec.key || pec.id);
                    const currentLevel = state.dots[dotKey] || pec.nivelAtual || 1;
                    const prog = mech.progressao[String(currentLevel)];
                    if (prog) {
                        previewMech = JSON.parse(JSON.stringify(mech));
                        delete previewMech.previewTexto;
                        if (mech.tipo === 'modificar' && prog.valor !== undefined) {
                            previewMech.config = { ...previewMech.config, valor: prog.valor };
                        }
                        // Override fixo terms in equation
                        if (prog.termos && Array.isArray(previewMech.config?.calculos)) {
                            for (const calc of previewMech.config.calculos) {
                                if (Array.isArray(calc.equacao)) {
                                    let fixoIdx = 0;
                                    for (const term of calc.equacao) {
                                        if (term.tipo !== 'ficha' && term.tipo !== 'sort') {
                                            const ov = prog.termos[String(fixoIdx)];
                                            if (ov !== undefined && ov !== '') term.valor = ov;
                                            fixoIdx++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(previewMech) : (mech.descricao || '');
                results.push({
                    fonte: `${pec.nome} (${racaNome})`,
                    preview: preview,
                    tipo: 'peculiaridade'
                });
            }
        }
    }

    // ---- 2. Mecânicas dinâmicas de equação (DV/VS com ref à ficha) ----
    for (const mech of _derivedValueMechanicsRaw) {
        if (seenMechIds.has(mech.id)) continue;
        if (!_mechAffectsTarget(mech)) continue;
        seenMechIds.add(mech.id);
        const preview = typeof generatePreviewText === 'function'
            ? generatePreviewText(mech) : (mech.descricao || '');
        results.push({
            fonte: mech.nome || 'Equação Dinâmica',
            preview: preview,
            tipo: 'equacao_dinamica'
        });
    }

    // ---- 3. Mecânicas de distribuição aplicadas ----
    if (state.mecanicasAplicadas) {
        const allMechanics = window._systemData?.mechanics || [];
        for (const [mechId, dados] of Object.entries(state.mecanicasAplicadas)) {
            if (!dados || !dados.alvosEscolhidos) continue;
            for (const alvo of dados.alvosEscolhidos) {
                const field = TARGET_MAP[alvo.nome];
                if (!field || !targetField || field !== targetField) continue;
                // Encontrar a mecânica original para pegar o nome
                const mech = allMechanics.find(m => m.id === mechId);
                const mechNome = mech?.nome || dados.fonte || 'Distribuição';
                if (seenMechIds.has(mechId + ':dist:' + alvo.nome)) continue;
                seenMechIds.add(mechId + ':dist:' + alvo.nome);
                results.push({
                    fonte: mechNome,
                    preview: `+${alvo.valor} em ${alvo.nome} (distribuído)`,
                    tipo: 'distribuicao'
                });
            }
        }
    }

    // ---- 4. Mecânicas vinculadas a OUTROS Valores Derivados que afetam este alvo ----
    if (window.DERIVED_VALUES) {
        for (const dv of window.DERIVED_VALUES) {
            if (!dv.mecanicaIds || dv.mecanicaIds.length === 0) continue;
            for (const mechId of dv.mecanicaIds) {
                if (seenMechIds.has(mechId)) continue;
                const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                if (!mech) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mechId);
                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(mech) : (mech.descricao || '');
                results.push({
                    fonte: `Vínculo: ${dv.nome}`,
                    preview: preview,
                    tipo: 'vinculo_dv'
                });
            }
        }
    }

    // ---- 5. Mecânicas vinculadas a Status Vitais que afetam este alvo ----
    if (window.VITAL_STATS) {
        for (const vs of window.VITAL_STATS) {
            if (!vs.mecanicaIds || vs.mecanicaIds.length === 0) continue;
            for (const mechId of vs.mecanicaIds) {
                if (seenMechIds.has(mechId)) continue;
                const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                if (!mech) continue;
                if (!_mechAffectsTarget(mech)) continue;
                seenMechIds.add(mechId);
                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(mech) : (mech.descricao || '');
                results.push({
                    fonte: `Vínculo: ${vs.nome}`,
                    preview: preview,
                    tipo: 'vinculo_vs'
                });
            }
        }
    }

    // ---- 6. Mecânicas vinculadas a Perícias que afetam este alvo ----
    if (window.SKILLS) {
        for (const cat of Object.keys(window.SKILLS)) {
            for (const skill of window.SKILLS[cat]) {
                if (!skill.mecanicaIds || skill.mecanicaIds.length === 0) continue;
                for (const mechId of skill.mecanicaIds) {
                    if (seenMechIds.has(mechId)) continue;
                    const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                    if (!mech) continue;
                    if (!_mechAffectsTarget(mech)) continue;
                    seenMechIds.add(mechId);
                    const preview = typeof generatePreviewText === 'function'
                        ? generatePreviewText(mech) : (mech.descricao || '');
                    results.push({
                        fonte: `Vínculo: ${skill.name}`,
                        preview: preview,
                        tipo: 'vinculo_skill'
                    });
                }
            }
        }
    }

    // ---- 7. Mecânicas vinculadas a Condições que afetam este alvo ----
    if (state.conditions && Array.isArray(state.conditions)) {
        for (const cond of state.conditions) {
            if (!cond.efeitoMecanicaIds || !Array.isArray(cond.efeitoMecanicaIds)) continue;
            for (const mechId of cond.efeitoMecanicaIds) {
                // Allows same mechanic from different conditions by prefixing ID with condition index/name
                const uniqueMechId = mechId + ':cond:' + cond.nome;
                if (seenMechIds.has(uniqueMechId)) continue;
                
                const mech = (window._systemData?.mechanics || []).find(m => m.id === mechId);
                if (!mech) continue;
                if (!_mechAffectsTarget(mech)) continue;
                
                seenMechIds.add(uniqueMechId);
                const preview = typeof generatePreviewText === 'function'
                    ? generatePreviewText(mech) : (mech.descricao || '');
                results.push({
                    fonte: `Condição: ${cond.nome}`,
                    preview: preview,
                    tipo: 'vinculo_condicao'
                });
            }
        }
    }

    return results;
}

/* ===== EXP MODIFIER SYSTEM ===== */

/**
 * Handles a single EXP calc from a 'modificar' mechanic.
 * Decides whether to apply immediately or register as a pending trigger.
 * Uses resolveCalcValue() for formula-based EXP values.
 * quandoAplica is stored at mech level (Duração section), not per-calc.
 */
function _handleExpCalc(calc, mech, parentPec) {
    const quando = mech.quandoAplica || 'permanente';
    const valor = resolveCalcValue(calc);
    const qualExp = calc.qualExp || 'ambos';
    const op = calc.operacao || '+';
    const fonte = parentPec?.nome || mech.nome || 'Mecânica';

    // Apply operation to get final value
    let finalValor = valor;
    if (op === '-') finalValor = -Math.abs(valor);
    // For +, ×, ÷, = — use valor as-is (+ is the most common for EXP)

    // "Na Criação" — read-only metadata; never auto-apply after creation
    if (quando === 'na_criacao') {
        return;
    }

    // "Permanente (Passivo)" — apply once during mechanic resolution (idempotent via tracking)
    if (quando === 'permanente') {
        const trackKey = `exp_perm_${mech.id}_${calc.qualExp}`;
        if (state.expApplied && state.expApplied[trackKey]) return;
        if (!state.expApplied) state.expApplied = {};
        const success = applyExpModification(finalValor, qualExp, fonte, 'permanente');
        if (success) {
            state.expApplied[trackKey] = true;
        }
        return;
    }

    // "Ao Ativar" — apply when the mechanic source is activated
    if (quando === 'ao_ativar') {
        const trackKey = `exp_ativar_${mech.id}_${calc.qualExp}`;
        if (state.expApplied && state.expApplied[trackKey]) return;
        if (!state.expApplied) state.expApplied = {};
        const success = applyExpModification(finalValor, qualExp, fonte, 'ao_ativar');
        if (success) {
            state.expApplied[trackKey] = true;
        }
        return;
    }

    // "Por Sessão" — register as a session trigger (applied when session count increments)
    if (quando === 'por_sessao') {
        if (!state.expSessionTriggers) state.expSessionTriggers = [];
        const exists = state.expSessionTriggers.find(t => t.mechId === mech.id && t.qualExp === qualExp);
        if (!exists) {
            state.expSessionTriggers.push({
                mechId: mech.id,
                calc: calc,  // Store full calc for re-resolution at trigger time
                qualExp: qualExp,
                fonte: fonte,
                op: op
            });
        }
        return;
    }

    // "Condicional" — just registered; application is manual / narrator-driven
    if (quando === 'condicional') {
        return;
    }

    // All other triggers — NOT YET implemented. Silently ignore.
}

/**
 * Applies an EXP modification directly to the character sheet.
 * @param {number} valor - Amount to add (positive) or subtract (negative)
 * @param {string} qualExp - 'exp_total', 'exp_restante', or 'ambos'
 * @param {string} fonte - Source name for reference
 * @param {string} gatilho - Trigger type for reference
 * @returns {boolean} - True if applied successfully
 */
function applyExpModification(valor, qualExp, fonte, gatilho) {
    const expEl = document.querySelector('[data-key="exp"]');
    const expTotalEl = document.querySelector('[data-key="exp_total"]');
    if (!expEl || !expTotalEl) return false;

    const currentRestante = parseInt(expEl.value || '0', 10) || 0;
    const currentTotal = parseInt(expTotalEl.value || '0', 10) || 0;

    if (qualExp === 'exp_restante') {
        let newRestante = currentRestante + valor;
        if (newRestante < 0) newRestante = 0; // Floor at 0
        expEl.value = newRestante;
        // If adding to Restante, also add to Total (per spec)
        if (valor > 0) {
            expTotalEl.value = currentTotal + valor;
        }
    } else if (qualExp === 'exp_total') {
        let newTotal = currentTotal + valor;
        if (newTotal < 0) newTotal = 0; // Floor at 0
        expTotalEl.value = newTotal;
        // Does NOT affect Restante
    } else if (qualExp === 'ambos') {
        let newRestante = currentRestante + valor;
        if (newRestante < 0) newRestante = 0;
        expEl.value = newRestante;
        let newTotal = currentTotal + valor;
        if (newTotal < 0) newTotal = 0;
        expTotalEl.value = newTotal;
    }

    console.log(`⭐ EXP Modificado: ${valor > 0 ? '+' : ''}${valor} ${qualExp} — Fonte: ${fonte} — Gatilho: ${gatilho}`);
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    return true;
}

/**
 * Collects all EXP mechanics from all active sources (race, class, tribe, peculiarities).
 * Returns an array of { calc, mech, parentPec } objects.
 */
function collectAllExpMechanics() {
    const results = [];
    const mechanics = window._systemData?.mechanics || [];

    function _processMechanics(mechIds, source) {
        if (!Array.isArray(mechIds)) return;
        for (const mid of mechIds) {
            const id = typeof mid === 'object' ? mid.id : mid;
            const mech = mechanics.find(m => m.id === id);
            if (!mech || mech.tipo !== 'modificar') continue;
            const config = mech.config || {};
            const calculos = Array.isArray(config.calculos) ? config.calculos : [];
            for (const calc of calculos) {
                if (calc.alvo === 'EXP') {
                    results.push({ calc, mech, fonte: source });
                }
            }
        }
    }

    // From race peculiarities
    const raca = document.getElementById('selRaca')?.value;
    if (raca && window.RACES && window.RACES[raca]) {
        for (const pec of window.RACES[raca].peculiaridades || []) {
            _processMechanics(pec.mecanicaIds || pec.mecanicas?.map(m => m.id) || [], pec.nome);
        }
    }

    // From class peculiarities
    const classe = document.getElementById('selClasse')?.value;
    if (classe && window.CLASS_PECULIARITIES && window.CLASS_PECULIARITIES[classe]) {
        for (const pec of window.CLASS_PECULIARITIES[classe]) {
            _processMechanics(pec.mecanicaIds || pec.mecanicas?.map(m => m.id) || [], pec.nome);
        }
    }

    // From tribe peculiarities
    const tribo = document.getElementById('selTribo')?.value;
    if (tribo && window.TRIBES && window.TRIBES[tribo]) {
        for (const pec of window.TRIBES[tribo].peculiaridades || []) {
            _processMechanics(pec.mecanicaIds || pec.mecanicas?.map(m => m.id) || [], pec.nome);
        }
    }

    return results;
}

/* ===== SESSION INCREMENT LISTENER ===== */

/**
 * Detects when the "sessoes" field increments and triggers all 'por_sessao' EXP mechanics.
 */
(function initSessionExpListener() {
    let _lastSessionValue = null;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const sessoesEl = document.querySelector('[data-key="sessoes"]');
            if (!sessoesEl) return;

            // Capture initial value
            _lastSessionValue = parseInt(sessoesEl.value || '0', 10) || 0;

            sessoesEl.addEventListener('change', function () {
                const newVal = parseInt(this.value || '0', 10) || 0;
                const oldVal = _lastSessionValue;
                _lastSessionValue = newVal;

                // Only trigger if session count increased
                if (newVal > oldVal) {
                    const increment = newVal - oldVal;
                    console.log(`📅 Sessões incrementadas: ${oldVal} → ${newVal} (+${increment})`);
                    _applySessionExpTriggers(increment);
                }
            });
        }, 2000); // Wait for data to load
    });

    function _applySessionExpTriggers(increment) {
        const triggers = state.expSessionTriggers || [];
        if (triggers.length === 0) return;

        for (const trigger of triggers) {
            // Re-resolve value at trigger time (formula may reference changing stats)
            let valor = trigger.calc ? resolveCalcValue(trigger.calc) : (trigger.valor || 0);
            if (trigger.op === '-') valor = -Math.abs(valor);
            // Apply once per session increment
            for (let i = 0; i < increment; i++) {
                applyExpModification(valor, trigger.qualExp, trigger.fonte, 'por_sessao');
            }
        }
    }
})();
