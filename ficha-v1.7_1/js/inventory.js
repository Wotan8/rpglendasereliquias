/* ===== INVENTORY MODULE — Sistema de Inventário (Ficha v1.7) ===== */
/* Substitui equipment.js para as abas Combate (Equipamentos) e Inventário.
   Itens ficam na coleção Firestore 'items', não no gatherData().
   Pressão = peso efetivo de itens equipados, alimenta o DV "Carga" via mechanicBonuses. */

// ===== BODY SLOTS — Configuração de Slots Anatômicos =====
// ===== BODY SLOTS — Dinâmico =====
function _getCharacterBodySlots() {
    const slots = {};
    if (!window.state || !window.state.partesDoCorpo) return slots;
    
    window.state.partesDoCorpo.forEach((bp) => {
        const qty = bp.slots || 1;
        for (let i = 0; i < qty; i++) {
            const slotKey = qty > 1 ? `${bp.id}_${i+1}` : bp.id;
            /* state.partesDoCorpo é uma CÓPIA congelada no personagem: flag nova
               no catálogo não chega sozinha até quem já existe. O catálogo manda
               em podeGolpear; a cópia só responde se ele não tiver a parte. */
            const cat = (window._systemData?.bodyParts || []).find(b => b.id === bp.id);
            slots[slotKey] = {
                label: qty > 1 ? `${bp.nome} ${i+1}` : bp.nome,
                parte: bp.nome,
                icon: bp.icone || '🦴',
                max: 1, // dynamically 1 item per generated slot instance
                partId: bp.id,
                podeGolpear: !!(cat ? cat.podeGolpear : bp.podeGolpear),
                podeSegurar: !!bp.podeSegurar,
                podeEmpunhar: !!bp.podeEmpunhar,
                podeVestir: !!bp.podeVestir,
                podeFixar: !!bp.podeFixar,
                // Mantém compatibilidade com selects de UI iterativos
                accepts: [] 
            };
        }
    });
    return slots;
}


/* Slots de equipamento: a lógica mora em shared/equip-slots.js, compartilhada
   com o inventário de aliados e o de NPCs do painel do mestre. Aqui ficam só os
   atalhos que injetam o catálogo/estado desta ficha. */
const _slotsDoItem      = item => window.EquipSlots.slotsDoItem(item);
const _itemOcupaSlot    = (item, slotKey) => window.EquipSlots.itemOcupaSlot(item, slotKey);
const _slotsExtrasNecessarios = item =>
    window.EquipSlots.slotsExtrasNecessarios(item, window._inventoryState?.catalog);
const _reservarSlots    = (nec, bodySlots, ocupados, label) =>
    window.EquipSlots.reservarSlots(nec, bodySlots, ocupados, label);

// ===== EQUIP STATES — Estados de Equipamento =====
const EQUIP_STATES = {
    empunhado:  { label: 'Empunhado',  icon: '✊', appliesMechanics: true,  description: 'Segurado ativamente nas mãos' },
    segurar:    { label: 'Segurado',   icon: '🖐️', appliesMechanics: false, description: 'Apenas segurado/carregado, sem uso mecânico' },
    vestido:    { label: 'Vestido',     icon: '👕', appliesMechanics: true,  description: 'Colocado junto ao corpo' },
    fixado:     { label: 'Fixado',      icon: '📌', appliesMechanics: false, description: 'Pendurado/anexado para saque rápido' },
    armazenado: { label: 'Armazenado',  icon: '📦', appliesMechanics: false, description: 'Guardado dentro de um contêiner' }
};

// ===== WEAPON CATEGORIES — Subcategorias de Armas =====
const WEAPON_CATEGORIES = [
    { value: 'uma_mao',    label: 'Arma de Uma Mão',    icon: '🗡️', handsRequired: 1 },
    { value: 'duas_maos',  label: 'Arma de Duas Mãos',  icon: '⚔️', handsRequired: 2 },
    { value: 'versatil',   label: 'Arma Versátil',       icon: '🔄', handsRequired: null },
    { value: 'escudo',     label: 'Escudo',              icon: '🛡️', handsRequired: 1 },
    { value: 'distancia',  label: 'Arma a Distância',    icon: '🏹', handsRequired: null }
];

// Mapa de emojis por tipo de item (inclui novo tipo Acessório)
const TIPO_EMOJI_MAP = {
    'Arma': '⚔️', 'Vestimenta': '🧥', 'Acessório': '💍', 'Projétil': '🎯',
    'Container': '📦', 'Objeto': '📦', 'Consumível': '🧪', 'Relíquia': '✨'
};
function _getTipoEmoji(tipo) { return TIPO_EMOJI_MAP[tipo] || '📦'; }

// ===== STATE: Cache local de itens do personagem =====
window._inventoryState = {
    items: [],          // Todos os itens do personagem (instâncias Firestore)
    catalog: [],        // Cache do catálogo global (system/data/equipment)
    itemRules: [],      // Regras globais de itens (system/data/itemRules)
    loading: false,
    loaded: false
};

// ===== FIREBASE HELPERS =====
// Usam window.db exposto pelo firebase.js
function _getFirestore() { return window.db; }
function _getCurrentCharId() { return window.currentCharacterId; }
function _getCurrentUser() { return window.currentUser; }

async function _firestoreGetDocs(colPath) {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    const snap = await getDocs(collection(db, colPath));
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
}

async function _firestoreQuery(colPath, field, op, value) {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    const q = query(collection(db, colPath), where(field, op, value));
    const snap = await getDocs(q);
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
}

async function _firestoreSetDoc(colPath, docId, data, merge = true) {
    // 📜 Log de inventário: comparar com o cache local ANTES de gravar
    let _logEntry = null;
    if (colPath === 'items' && window.CharLogger) {
        try { _logEntry = window.CharLogger.buildItemLog(docId, data); } catch (e) { /* ignore */ }
    }
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    await setDoc(doc(db, colPath, docId), data, { merge });
    if (_logEntry) { try { window.CharLogger.logEvent(_logEntry); } catch (e) { /* ignore */ } }
}

async function _firestoreDeleteDoc(colPath, docId) {
    // 📜 Log de inventário: capturar dados do item ANTES de deletar
    let _logEntry = null;
    if (colPath === 'items' && window.CharLogger) {
        try { _logEntry = window.CharLogger.buildItemDeleteLog(docId); } catch (e) { /* ignore */ }
    }
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = _getFirestore();
    await deleteDoc(doc(db, colPath, docId));
    if (_logEntry) { try { window.CharLogger.logEvent(_logEntry); } catch (e) { /* ignore */ } }
}

// ===== LOAD CHARACTER ITEMS =====
async function loadCharacterItems(charId) {
    if (!charId) return;
    window._inventoryState.loading = true;
    try {
        const items = await _firestoreQuery('items', 'characterId', '==', charId);
        window._inventoryState.items = items;
        window._inventoryState.loaded = true;
        console.log(`✅ Inventário carregado: ${items.length} item(ns)`);
        renderEquippedItems();
        renderInventoryTab();
        // Re-aplicar TODAS as mecânicas para que Regras de Item (itemRules)
        // tenham acesso aos itens carregados e apliquem corretamente
        // (ex: somar Pressão Total no valor atual de um DV).
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
        if (typeof recalcMainTests === 'function') recalcMainTests();
    } catch (e) {
        console.error('❌ Erro ao carregar inventário:', e);
    } finally {
        window._inventoryState.loading = false;
    }
}

// ===== LOAD CATALOG & ITEM RULES =====
async function loadInventoryCatalog() {
    try {
        // Catalog comes from system-data-loader (window._systemData.equipment)
        if (window._systemData?.equipment) {
            window._inventoryState.catalog = window._systemData.equipment.filter(e => e.publicado !== false);
        }
        // Item Rules
        if (window._systemData?.itemRules) {
            window._inventoryState.itemRules = window._systemData.itemRules.filter(r => r.publicado !== false && r.ativo !== false);
        }
        console.log(`✅ Catálogo: ${window._inventoryState.catalog.length} template(s), ${window._inventoryState.itemRules.length} regra(s)`);
    } catch (e) {
        console.error('❌ Erro ao carregar catálogo:', e);
    }
}

// ===== PRESSURE CALCULATION =====
/**
 * Calcula a Pressão total de todos os itens equipados.
 * Pressão = peso efetivo × quantidade. Para containers, inclui peso dos itens internos × multiplicador.
 */
function calculateTotalPressure() {
    const items = window._inventoryState.items;
    // Itens armazenados (mesmo que marcados como equipados num container) não somam pressão aqui;
    // O peso deles já é contabilizado via peso do container em si.
    const equipped = items.filter(i => i.equipado && i.estadoEquip !== 'armazenado' && !i.parentItemId);
    let total = 0;

    for (const item of equipped) {
        const qty = Math.max(1, parseInt(item.quantidade) || 1);
        const basePressao = item.pressaoOverride != null ? item.pressaoOverride
            : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));

        if (item.ehContainer) {
            const insideItems = items.filter(i => i.parentItemId === item.id);
            const insideWeight = insideItems.reduce((sum, i) => {
                const iQty = Math.max(1, parseInt(i.quantidade) || 1);
                return sum + ((i.peso || 0) * iQty);
            }, 0);
            const mult = item.multiplicadorPressao || 1;
            total += (basePressao * qty) + (insideWeight * mult);
        } else {
            total += basePressao * qty;
        }
    }
    return total;
}

/**
 * Recalcula a Pressão e dispara recalcAll para que mecânicas de Regra de Item
 * atualizem o DV "Carga (Atual)" via _resolveSheetRef('Pressão Total (Equipados)').
 * NÃO injeta pressão diretamente em DERIVED:CARGA (o máximo),
 * pois o máximo é calculado por sua própria mecânica no Firebase.
 */
function recalcInventoryPressure() {
    const totalPressure = calculateTotalPressure();

    // Atualizar indicador visual de pressão
    _updatePressureDisplay(totalPressure);

    // Recalcular DVs e testes — as mecânicas de Regra de Item capturam
    // a pressão via _resolveSheetRef('Pressão Total (Equipados)')
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
}

function _findDerivedKey(nome) {
    if (!window.DERIVED_VALUES) return null;
    const dv = window.DERIVED_VALUES.find(d => d.nome === nome);
    if (dv) return `DERIVED:${dv.key}`;
    // Fallback: buscar no TARGET_MAP
    if (typeof TARGET_MAP !== 'undefined' && TARGET_MAP[nome]) return TARGET_MAP[nome];
    return null;
}

function _updatePressureDisplay(totalPressure) {
    const el = document.getElementById('invPressureDisplay');
    if (el) {
        el.textContent = `⚖️ Pressão: ${parseFloat(totalPressure).toFixed(2)}`;
    }
}

// ===== EFEITOS ATIVOS — regra canônica =====
/**
 * Categorias de forma que um item equipado satisfaz: 'efeitos', 'segurando' e/ou 'fixado'.
 * Fonte única da verdade — mechanics-engine.js e class-modules-renderer.js delegam aqui.
 *
 * "Efeitos ativos" exige que o estado atual do item corresponda à Forma de Equipar
 * prevista para ele (uma espada guardada na cintura não dá bônus de acerto).
 * Itens legados sem `formaEquipar` continuam valendo como efeitos ativos.
 */
function itemFormasAtuais(item) {
    const formas = [];
    if (!item || !item.equipado || item.parentItemId || item.estadoEquip === 'armazenado') return formas;
    if (item.estadoEquip === 'fixado') { formas.push('fixado'); return formas; }
    if (item.estadoEquip === 'segurar') { formas.push('segurando'); return formas; }

    let efeitosOn = true;
    if (item.formaEquipar) {
        const equipToStateMap = { 'segurar': 'segurar', 'empunhar': 'empunhado', 'vestir': 'vestido', 'fixar': 'fixado' };
        if (item.estadoEquip !== equipToStateMap[item.formaEquipar]) efeitosOn = false;
    }
    if (efeitosOn) formas.push('efeitos');
    return formas;
}

/**
 * Item está com Efeitos Ativos E num slot anatômico compatível com sua restrição
 * `equipavelEm`. É o predicado que decide se as mecânicas do item valem.
 */
function itemTemEfeitosAtivos(item) {
    if (!itemFormasAtuais(item).includes('efeitos')) return false;

    const equipavelEm = Array.isArray(item.equipavelEm)
        ? item.equipavelEm
        : (item.equipavelEm ? [item.equipavelEm] : []);
    if (equipavelEm.length === 0) return true;

    const slotDef = _getCharacterBodySlots()[item.slotAnatomico];
    return !slotDef || equipavelEm.includes(slotDef.partId);
}

// ===== APPLY EQUIPPED ITEM MECHANICS =====
/**
 * Aplica mecânicas dos itens equipados ao personagem.
 * Chamada em applyAllRaceMechanics() após outras mecânicas.
 *
 * Cada item é aplicado com o escopo ligado (_meSetItemScope): alvos que sejam
 * Valores Derivados marcados com `escopoItem` caem em state.itemBonuses[item.id]
 * em vez do bag global — é o que permite duas armas terem Acerto próprio.
 */
/** Campo do item, com fallback pro modelo do catálogo. Instância vence modelo. */
function _campoDoItem(item, key) {
    const proprio = item[key];
    if (Array.isArray(proprio) && proprio.length) return proprio;
    if (!item.modeloId) return Array.isArray(proprio) ? proprio : [];
    const tpl = window._inventoryState.catalog.find(t => t.id === item.modeloId);
    return (tpl && Array.isArray(tpl[key])) ? tpl[key] : [];
}

const _statusVitaisDoItem = item => _campoDoItem(item, 'statusVitaisVinculados')
    .map(sv => (typeof sv === 'object' ? sv : { id: sv, modificador: 0 }));

const _SK_PREFIXO = {
    mental: 'sk_mental_', fisico: 'sk_fisico_', social: 'sk_social_',
    combate: 'sk_combate_', exclusivo: 'sk_exclusivo_',
};

/**
 * Perícia vinculada guarda o ID do Firestore; os dots da ficha usam
 * sk_<categoria>_<key>. Resolver aqui deixa o vínculo sobreviver a renomeação.
 */
function _periciaDotKey(skillId) {
    for (const cat of Object.keys(window.SKILLS || {})) {
        const s = (window.SKILLS[cat] || []).find(x => x.id === skillId);
        if (s) return (_SK_PREFIXO[cat] || 'sk_mental_') + s.key;
    }
    return null;
}

/**
 * Modificadores de Atributo e Perícia dos itens equipados.
 * Atributo já vem com a chave final (attr_des); perícia vem por id.
 * Substitui o par booleano+modificar que existia só para somar/subtrair.
 */
function _aplicarAtributosEPericias(item) {
    if (!window.state.mechanicBonuses) window.state.mechanicBonuses = {};
    const bag = window.state.mechanicBonuses;

    for (const a of _campoDoItem(item, 'atributosVinculados')) {
        const mod = Number(a?.modificador) || 0;
        if (!mod || !a.id) continue;
        bag[a.id] = (bag[a.id] || 0) + mod;
    }

    for (const p of _campoDoItem(item, 'periciasVinculadas')) {
        // Equação de Valor vence o modificador fixo, como no caminho dos VDs —
        // resolvida com o item em escopo (refs "Item: ..." valem para ESTE item).
        // É o que dá o "+Qualidade no Bloquear" dos escudos sem regra nova.
        const temEq = Array.isArray(p?.equacao) && p.equacao.length && typeof resolveEquation === 'function';
        const mod = temEq ? (Number(resolveEquation(p.equacao)) || 0) : (Number(p?.modificador) || 0);
        if (!mod || !p.id) continue;
        const chave = _periciaDotKey(p.id);
        if (!chave) { console.warn(`⚠️ [item ${item.nome}] perícia ${p.id} não encontrada`); continue; }
        bag[chave] = (bag[chave] || 0) + mod;
    }
}

function applyEquippedItemsMechanics() {
    const items = window._inventoryState.items;
    const equipped = items.filter(itemTemEfeitosAtivos);

    const mechanicsById = {};
    if (window._systemData?.mechanics) {
        for (const m of window._systemData.mechanics) {
            mechanicsById[m.id] = m;
        }
    }

    // 1) Mecânicas de itens equipados (modelo + próprias)
    for (const item of equipped) {
        // Liga o escopo: tudo aplicado daqui até o reset pertence a este item
        if (typeof window._meSetItemScope === 'function') window._meSetItemScope(item.id);
        try {
            // 1a) Mecânicas herdadas do modelo (catálogo)
            if (item.modeloId) {
                const template = window._inventoryState.catalog.find(t => t.id === item.modeloId);
                if (template?.mecanicaIds) {
                    for (const mechId of template.mecanicaIds) {
                        const mech = mechanicsById[mechId];
                        if (mech) applyMechanicToSheet(mech, null);
                    }
                }
            }

            // 1b) Mecânicas próprias da instância
            if (item.mecanicaIdsProprias) {
                for (const mechId of item.mecanicaIdsProprias) {
                    const mech = mechanicsById[mechId];
                    if (mech) applyMechanicToSheet(mech, null);
                }
            }

            // 1c) Valores Derivados Vinculados
            let dvList = item.valoresDerivadosVinculados || [];
            if (item.modeloId) {
                const template = window._inventoryState.catalog.find(t => t.id === item.modeloId);
                if (template && template.valoresDerivadosVinculados) {
                    if (!item.valoresDerivadosVinculados) {
                        dvList = template.valoresDerivadosVinculados;
                    }
                }
            }

            if (dvList && dvList.length > 0 && window.DERIVED_VALUES) {
                for (const dvObj of dvList) {
                    const dvId = dvObj.id || dvObj;
                    const dvDef = window.DERIVED_VALUES.find(d => d.id === dvId);
                    if (!dvDef) continue;
                    // Equação de Valor do vínculo SUBSTITUI o modificador fixo
                    // (legado): resolvida aqui, com o item em escopo (refs
                    // "Item: ..." valem para ESTE item). Sem equação, vale o
                    // modificador antigo.
                    const temEq = Array.isArray(dvObj.equacao) && dvObj.equacao.length && typeof resolveEquation === 'function';
                    const total = temEq ? resolveEquation(dvObj.equacao) : (Number(dvObj.modificador) || 0);
                    if (!total) continue;
                    const targetKey = `DERIVED:${dvDef.key}`;
                    // DV escopado → bag do item; DV global → bag do personagem.
                    // O vínculo pode forçar global (escopo:'global'): é o que
                    // deixa um escudo penalizar o Acerto do personagem em vez
                    // de uma coluna de Acerto do próprio escudo.
                    const escopado = dvDef.escopoItem && dvObj.escopo !== 'global';
                    let bag;
                    if (escopado) {
                        if (!window.state.itemBonuses) window.state.itemBonuses = {};
                        if (!window.state.itemBonuses[item.id]) window.state.itemBonuses[item.id] = {};
                        bag = window.state.itemBonuses[item.id];
                    } else {
                        if (!window.state.mechanicBonuses) window.state.mechanicBonuses = {};
                        bag = window.state.mechanicBonuses;
                    }
                    bag[targetKey] = (bag[targetKey] || 0) + total;
                    // Trilha paralela só do que veio de PEÇA. O bag geral mistura
                    // peculiaridade, condição e item no mesmo número, e um teto
                    // sobre ele puniria coisa que não é equipamento. Quem limita
                    // (Domínio de proteção) morde só esta parcela.
                    if (!escopado) bag[`ITEM:${targetKey}`] = (bag[`ITEM:${targetKey}`] || 0) + total;
                }
            }
            // 1d) Status Vitais Vinculados — só os "_MAX". Os "_ATUAL" são efeito
            // de uso único (usarItem), não bônus permanente: somar Vitalidade
            // Atual aqui reaplicaria a cura a cada recálculo.
            for (const sv of _statusVitaisDoItem(item)) {
                const mod = Number(sv.modificador) || 0;
                if (!mod || !String(sv.id).endsWith('_MAX')) continue;
                if (!window.state.mechanicBonuses) window.state.mechanicBonuses = {};
                const k = `DERIVED:${sv.id}`;
                window.state.mechanicBonuses[k] = (window.state.mechanicBonuses[k] || 0) + mod;
            }

            // 1e) Atributos e Perícias vinculados
            _aplicarAtributosEPericias(item);
        } finally {
            if (typeof window._meSetItemScope === 'function') window._meSetItemScope(null);
        }
    }

    // 2) Regras globais de item (aplicam independente de ter itens equipados)
    const rules = window._inventoryState.itemRules || [];
    console.log(`🔧 [ItemRules] ${rules.length} regra(s) de item carregadas, ${equipped.length} item(ns) equipado(s)`);
    for (const rule of rules) {
        console.log(`🔧 [ItemRule] "${rule.nome}": mecanicaIds =`, rule.mecanicaIds);
        if (rule.mecanicaIds) {
            for (const mechId of rule.mecanicaIds) {
                const mech = mechanicsById[mechId];
                if (!mech) {
                    console.warn(`⚠️ [ItemRule] Mecânica "${mechId}" NÃO encontrada no cache de ${Object.keys(mechanicsById).length} mecânicas`);
                    continue;
                }
                console.log(`🔧 [ItemRule] Aplicando mecânica "${mech.nome}" (tipo=${mech.tipo}, duracao=${mech.duracao})`);
                if (mech.config?.calculos) {
                    for (const calc of mech.config.calculos) {
                        const targetKey = typeof TARGET_MAP !== 'undefined' ? TARGET_MAP[calc.alvo] : 'TARGET_MAP_UNDEFINED';
                        console.log(`🔧 [ItemRule]   calc: alvo="${calc.alvo}" → targetKey="${targetKey}", op="${calc.operacao}"`);
                        if (Array.isArray(calc.equacao)) {
                            for (const term of calc.equacao) {
                                if (term.tipo === 'ficha') {
                                    const resolved = typeof _resolveSheetRef === 'function' ? _resolveSheetRef(term.ref, 1) : 'FUNC_NOT_FOUND';
                                    console.log(`🔧 [ItemRule]   term: tipo=ficha, ref="${term.ref}" → resolved=${resolved}`);
                                } else {
                                    console.log(`🔧 [ItemRule]   term: tipo=${term.tipo}, valor=${term.valor}`);
                                }
                            }
                        }
                    }
                }
                applyMechanicToSheet(mech, null);
            }
        }
    }

    // Todas as restrições ja foram coletadas (peculiaridades, itens e regras de
    // item passaram) — hora de tirar do corpo o que virou proibido.
    _desequipaItensBloqueados();
}

/**
 * Desequipa o que uma mecânica "Bloqueia Equipar" passou a proibir.
 *
 * Roda no fim de cada recálculo. O caso real: o personagem já estava de
 * armadura pesada quando ganhou a peculiaridade que a proíbe — ou chegou da
 * criação com ela vestida, onde o wizard ainda não checa bloqueio.
 *
 * Reentrância: unequipItem() dispara outro recálculo, que cai aqui de novo. O
 * flag corta a recursão; na passada seguinte os itens já saíram do corpo e não
 * são mais encontrados, então o processo sempre converge.
 */
let _desequipandoBloqueados = false;
function _desequipaItensBloqueados() {
    if (_desequipandoBloqueados) return;
    if (typeof window.equipBloqueioDoItem !== 'function') return;

    const bloqueados = window._inventoryState.items
        .filter(i => i.equipado && !i.parentItemId && i.estadoEquip !== 'armazenado')
        .map(item => {
            const total = window.equipBloqueioDoItem(item);
            if (total) return { item, bloqueio: total, motivo: 'não pode ser equipado' };
            // Bloqueio só de efeitos: sai do corpo apenas se ESTIVER com efeitos
            // ativos agora. Segurado ou fixado pode continuar onde está.
            const efeitos = typeof window.equipBloqueioEfeitosDoItem === 'function'
                ? window.equipBloqueioEfeitosDoItem(item) : null;
            if (efeitos && itemTemEfeitosAtivos(item)) {
                return { item, bloqueio: efeitos, motivo: 'não pode ficar com efeitos ativos' };
            }
            return null;
        })
        .filter(Boolean);

    if (bloqueados.length === 0) return;   // caminho normal: nada a fazer, sem efeito colateral

    _desequipandoBloqueados = true;
    (async () => {
        try {
            for (const { item, bloqueio, motivo } of bloqueados) {
                console.warn(`🚫 Desequipando "${item.nome}" — ${motivo} (regra de ${bloqueio.fonte})`);
                await unequipItem(item.id);
            }
            const nomes = bloqueados.map(b => `• ${b.item.nome} — ${b.motivo} (${b.bloqueio.fonte})`).join('\n');
            alert(`🚫 ${bloqueados.length === 1 ? 'Um item foi desequipado' : `${bloqueados.length} itens foram desequipados`} por uma regra que você não cumpre:\n\n${nomes}\n\nEles continuam no inventário — os bloqueados só de efeito podem voltar segurados ou fixados.`);
        } finally {
            _desequipandoBloqueados = false;
        }
    })();
}

/* Valores Derivados vinculados à Parte do Corpo, no mesmo contrato dos itens
   (Painel do Criador → Partes do Corpo): equação vence modificador fixo, e o
   resultado vira um bag por parte, lido pelo golpe desarmado daquela parte.
   É o que deixa a Perna somar Dano no chute sem tocar no soco.

   Só o escopo do próprio golpe: vínculo de parte não mexe no personagem
   inteiro. Bônus global continua sendo peculiaridade de raça, que é onde
   "criatura com garras acerta melhor" pertence. */
function _bagsDasPartes() {
    const bags = {};
    for (const bp of (window._systemData?.bodyParts || [])) {
        for (const dvObj of (bp.valoresDerivadosVinculados || [])) {
            const dvDef = (window.DERIVED_VALUES || []).find(d => d.id === (dvObj.id || dvObj));
            if (!dvDef) continue;
            const temEq = Array.isArray(dvObj.equacao) && dvObj.equacao.length && typeof resolveEquation === 'function';
            const total = temEq ? (Number(resolveEquation(dvObj.equacao)) || 0) : (Number(dvObj.modificador) || 0);
            if (!total) continue;
            const chave = `DERIVED:${dvDef.key}`;
            if (!bags[bp.id]) bags[bp.id] = {};
            bags[bp.id][chave] = (bags[bp.id][chave] || 0) + total;
        }
    }
    return bags;
}

// ===== RENDER: ABA COMBATE — ATAQUES E EFEITOS ATIVOS =====
/**
 * Tabela com uma linha por item que está com Efeitos Ativos e contribui com
 * algo próprio: fórmula de dano, bônus de dano, ou delta em algum Valor
 * Derivado marcado com Escopo por Item.
 *
 * Chamada no fim de recalcAll() — precisa de state.derived já atualizado.
 * NUNCA deve chamar recalcAll de volta (laço infinito).
 */
function renderActiveEffects() {
    const section = document.getElementById('activeEffectsSection');
    const table = document.getElementById('activeEffectsTable');
    if (!section || !table) return;

    if (typeof computeItemScopedTotals !== 'function') { section.style.display = 'none'; return; }

    const ctx = {
        derivedValues: window.DERIVED_VALUES || [],
        derived: (window.state && window.state.derived) || {},
        itemBonuses: (window.state && window.state.itemBonuses) || {},
        catalog: window._inventoryState.catalog || [],
    };

    const linhas = [];
    for (const item of window._inventoryState.items.filter(itemTemEfeitosAtivos)) {
        const r = computeItemScopedTotals(item, ctx);
        if (r.temAlgo) linhas.push({ item, ...r });
    }

    /* Parte do corpo que golpeia e está desocupada vira linha de ataque, com o
       mesmo Acerto e Dano de uma arma. Qualquer item equipado no slot ocupa a
       parte — mão com escudo ou tocha não soca. */
    if (typeof computeGolpesDesarmados === 'function') {
        const ocupados = [];
        for (const it of window._inventoryState.items) {
            if (it.equipado) ocupados.push(..._slotsDoItem(it));
        }
        linhas.push(...computeGolpesDesarmados({
            derivedValues: ctx.derivedValues,
            derived: ctx.derived,
            bodySlots: _getCharacterBodySlots(),
            slotsOcupados: ocupados,
            parteBonuses: _bagsDasPartes(),
        }));
    }

    if (linhas.length === 0) { section.style.display = 'none'; return; }

    // Colunas exibidas: só as que algum item realmente usa (evita tabela larga
    // com colunas vazias quando há muitos Valores Derivados escopados).
    const colDefs = [];
    for (const l of linhas) {
        for (const c of l.colunas) {
            if (c.bonus === 0 && c.total === 0) continue;
            if (!colDefs.some(x => x.key === c.key)) colDefs.push({ key: c.key, nome: c.nome, icone: c.icone });
        }
    }
    const temDano = linhas.some(l => l.dano);
    // Canais de Essência: parcelas paralelas ao dano físico, cada uma reduzida
    // pela Blindagem da própria cor no alvo. Uma coluna só, com todas.
    const temCanais = linhas.some(l => l.canais && l.canais.length);

    let html = '<thead><tr><th class="atk-col-item">Item</th>';
    if (temDano) html += '<th>💥 Dano</th>';
    if (temCanais) html += '<th title="Cada canal é reduzido pela Blindagem daquela Essência no alvo, não pela Blindagem física.">🌈 Canais</th>';
    for (const c of colDefs) html += `<th title="${_escHtml(c.nome)}">${c.icone} ${_escHtml(c.nome)}</th>`;
    html += '</tr></thead><tbody>';

    for (const l of linhas) {
        const estado = l.item ? EQUIP_STATES[l.item.estadoEquip] : null;
        const abre = l.item ? ` onclick="openItemDetail('${l.item.id}')"` : '';
        const icone = l.item ? _getTipoEmoji(l.item.tipo) : l.icone;
        const nome = l.item ? (l.item.nome || 'Sem nome') : `${l.nome}${l.qtd > 1 ? ` ×${l.qtd}` : ''}`;
        const rotulo = l.desarmado
            ? `<small class="atk-item-state" title="${l.qtd > 1 ? `${l.qtd} partes com o mesmo golpe. ` : ''}Parte do corpo sem item equipado. Alvo = FOR + Perícia: Briga (Livro, 6.3).">👊 Desarmado</small>`
            : (estado ? `<small class="atk-item-state">${estado.icon} ${estado.label}</small>` : '');
        html += `<tr${abre}>
            <td class="atk-col-item">
                <span class="atk-item-name">${icone} ${_escHtml(nome)}</span>
                ${rotulo}
            </td>`;
        if (temDano) {
            // O tipo diz qual das três Blindagens do alvo barra este golpe.
            const tg = l.tipoGolpe;
            html += `<td class="atk-dano">${l.dano ? _escHtml(l.dano) : '—'}`
                + (tg ? `<small class="atk-tipo-golpe" title="Barrado pela Blindagem ${_escHtml(tg.nome)} do alvo">${tg.icone} ${_escHtml(tg.nome)}</small>` : '')
                + '</td>';
        }
        if (temCanais) {
            const cs = (l.canais || []).map(c =>
                `<span class="atk-canal" title="${_escHtml(c.nome)}">${c.icone} ${c.total}</span>`).join('');
            html += `<td class="atk-canais">${cs || '—'}</td>`;
        }
        for (const cd of colDefs) {
            const c = l.colunas.find(x => x.key === cd.key);
            if (!c) { html += '<td class="atk-val">—</td>'; continue; }
            const title = `Base ${c.base} ${c.bonus >= 0 ? '+' : '−'} ${Math.abs(c.bonus)} (${l.desarmado ? 'parte' : 'item'}) = ${c.total}`;
            html += `<td class="atk-val" title="${_escHtml(title)}">
                ${_escHtml(c.prefixo)}<strong>${c.total}</strong>${_escHtml(c.sufixo)}
                ${c.bonus !== 0 ? `<small class="atk-delta">${c.bonus > 0 ? '+' : ''}${c.bonus}</small>` : ''}
            </td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';

    table.innerHTML = html;
    section.style.display = '';
}
window.renderActiveEffects = renderActiveEffects;

// ===== RENDER: ABA COMBATE — EQUIPAMENTOS =====
function renderEquippedItems() {
    const container = document.getElementById('equippedItemsGrid');
    if (!container) return;

    const items = window._inventoryState.items;
    const equipped = items.filter(i => i.equipado && !i.parentItemId);

    if (equipped.length === 0) {
        container.innerHTML = `<div class="inv-empty">
            <span class="inv-empty-icon">⚔️</span>
            <span>Nenhum item equipado</span>
            <small class="inv-empty-hint">Equipe itens na aba Inventário</small>
        </div>`;
        return;
    }

    let html = '';

    // Agrupar itens por slot
    const itemsBySlot = {};
    for (const item of equipped) {
        // Fallback para itens antigos sem slot
        const slot = item.slotAnatomico || 'costas'; 
        if (!itemsBySlot[slot]) itemsBySlot[slot] = [];
        itemsBySlot[slot].push(item);
    }

    // === FALLBACK: Garantir partesDoCorpo carregadas (evita falha no carregamento inicial) ===
    if (!window.state.partesDoCorpo || window.state.partesDoCorpo.length === 0) {
        const racaNome = document.getElementById('selRaca')?.value;
        if (racaNome && window.RACES && window.RACES[racaNome]) {
            let partsToLoad = null;
            if (window.RACES[racaNome].partesDoCorpo && window.RACES[racaNome].partesDoCorpo.length > 0) {
                partsToLoad = window.RACES[racaNome].partesDoCorpo;
            } else if (window._systemData && window._systemData.bodyParts) {
                partsToLoad = window._systemData.bodyParts.filter(bp => bp.ehPadrao);
            }
            if (partsToLoad) {
                window.state.partesDoCorpo = JSON.parse(JSON.stringify(partsToLoad));
            }
        } else if (window._systemData && window._systemData.bodyParts) {
            window.state.partesDoCorpo = JSON.parse(JSON.stringify(window._systemData.bodyParts.filter(bp => bp.ehPadrao)));
        }
    }

    const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
    const partesDoCorpo = window.state?.partesDoCorpo || [];

    // Renderizar por Partes do Corpo cadastradas na ficha
    for (const bp of partesDoCorpo) {
        let groupHasAnyItems = false;
        let slotsHtml = '';
            
        const qty = bp.slots || 1;
        for (let i = 0; i < qty; i++) {
            const slotKey = qty > 1 ? `${bp.id}_${i+1}` : bp.id;
            const slotDef = bodySlots[slotKey];
            if (!slotDef) continue;
            
            const slotItems = itemsBySlot[slotKey] || [];
            if (slotItems.length > 0) {
                groupHasAnyItems = true;
                
                const mechBonus = typeof state !== 'undefined' && state.mechanicBonuses ? (state.mechanicBonuses['slot_' + slotKey] || 0) : 0;
                const dynamicMax = slotDef.max + mechBonus;
                const inSlotNormal = slotItems.filter(i => i.estadoEquip !== 'fixado');
                const isFull = inSlotNormal.length >= dynamicMax;
                
                slotsHtml += `<div class="inv-slot-container">
                    <div class="inv-slot-header">
                        <span class="inv-slot-icon">${slotDef.icon}</span>
                        <span class="inv-slot-name">${slotDef.label}</span>
                        <span class="inv-slot-cap ${isFull ? 'full' : ''}">${inSlotNormal.length}/${dynamicMax}</span>
                    </div>
                    <div class="inv-slot-items">
                        ${slotItems.map(item => _renderEquipCard(item, slotDef)).join('')}
                    </div>
                </div>`;
            }
        }
        
        let groupHtml = `<div class="inv-slot-group ${groupHasAnyItems ? '' : 'collapsed'}">
            <h4 class="inv-slot-group-title" onclick="this.parentElement.classList.toggle('collapsed')">
                <span class="group-toggle-icon">▶</span>
                ${bp.nome}
                ${groupHasAnyItems ? `<span class="group-has-items-dot"></span>` : ''}
            </h4>
            <div class="inv-slot-group-content">
                ${slotsHtml !== '' ? slotsHtml : `<div class="inv-slot-empty" style="text-align:center;color:var(--muted);font-size:0.8rem;padding:8px;border:1px dashed var(--line);border-radius:6px;">Nenhum item equipado neste local.</div>`}
            </div>
        </div>`;
        
        html += groupHtml;
    }

    // Identificar itens equipados sem slot anatômico definido (legado ou armas de duas mãos em slot secundário)
    // O slotAnatomico2 (outra mão) não renderiza card duplo, é só referência.
    // Mas se houver um item com equipado=true e slot=null, mostramos num grupo "Sem Slot"
    const noSlotItems = equipped.filter(i => !i.slotAnatomico);
    if (noSlotItems.length > 0) {
        html += `<div class="inv-slot-group">
            <h4 class="inv-slot-group-title" onclick="this.parentElement.classList.toggle('collapsed')">
                <span class="group-toggle-icon">▶</span>
                Sem Slot (Legado)
                <span class="group-has-items-dot"></span>
            </h4>
            <div class="inv-slot-group-content">
                <div class="inv-slot-container">
                    <div class="inv-slot-items">
                        ${noSlotItems.map(item => _renderEquipCard(item, null)).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

function _renderEquipCard(item, slotDef) {
    const pressao = _getItemPressure(item);
    const tipo = item.tipo || 'Objeto';
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    const tipoEmoji = _getTipoEmoji(tipo);
    const img = item.imagem || item.imagemUrl;
    const imgHtml = img
        ? `<img src="${_escHtml(img)}" class="inv-card-img" alt="${_escHtml(item.nome)}">`
        : `<div class="inv-card-img inv-card-img-placeholder">${tipoEmoji}</div>`;

    // Container info
    let containerBadge = '';
    if (item.ehContainer) {
        const inside = window._inventoryState.items.filter(i => i.parentItemId === item.id);
        containerBadge = `<span class="inv-badge inv-badge-container">📦 ${inside.length} item(ns)</span>`;
    }

    // Quantity badge
    const qtyBadge = qty > 1 ? `<span class="inv-badge inv-badge-qty">×${qty}</span>` : '';

    // State badge
    let stateBadge = '';
    if (item.estadoEquip && EQUIP_STATES[item.estadoEquip]) {
        const st = EQUIP_STATES[item.estadoEquip];
        stateBadge = `<span class="inv-badge inv-badge-state inv-badge-state-${item.estadoEquip}" title="${st.description}">${st.icon} ${st.label}</span>`;
    }

    // Armas info
    let armaInfo = '';
    if (item.tipo === 'Arma' && item.maosUsadas) {
        armaInfo = `<span class="inv-badge inv-badge-hands">✋ ${item.maosUsadas} Mão(s)</span>`;
    }

    // Mecânicas preview
    const mechPreview = _getMechPreview(item);

    return `<div class="inv-card" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-card-body">
            <div class="inv-card-top">
                <span class="inv-card-name">${_escHtml(item.nome || 'Sem nome')}</span>
                <span class="inv-badge inv-badge-type">${tipoEmoji} ${_escHtml(tipo)}</span>
                <span class="inv-badge inv-badge-pressure">⚖️ ${parseFloat(pressao).toFixed(2)}</span>
                ${qtyBadge}
                ${stateBadge}
                ${armaInfo}
                ${containerBadge}
            </div>
            ${mechPreview ? `<div class="inv-card-mechs">${mechPreview}</div>` : ''}
        </div>
        <button class="inv-btn-detail no-print" onclick="event.stopPropagation();openItemDetail('${item.id}')" title="Detalhes">ℹ️</button>
    </div>`;
}

function _getItemPressure(item) {
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    if (item.pressaoOverride != null) return item.pressaoOverride * qty;
    const base = item.pressaoBase != null ? item.pressaoBase : (item.peso || 0);
    if (item.ehContainer) {
        const inside = window._inventoryState.items.filter(i => i.parentItemId === item.id);
        const insideWeight = inside.reduce((sum, i) => {
            const iQty = Math.max(1, parseInt(i.quantidade) || 1);
            return sum + ((i.peso || 0) * iQty);
        }, 0);
        return (base * qty) + (insideWeight * (item.multiplicadorPressao || 1));
    }
    return base * qty;
}

function _getMechPreview(item) {
    const mechIds = [];
    if (item.modeloId) {
        const tpl = window._inventoryState.catalog.find(t => t.id === item.modeloId);
        if (tpl?.mecanicaIds) mechIds.push(...tpl.mecanicaIds);
    }
    if (item.mecanicaIdsProprias) mechIds.push(...item.mecanicaIdsProprias);
    if (mechIds.length === 0) return '';

    const previews = [];
    for (const mid of mechIds) {
        const m = window._systemData?.mechanics?.find(x => x.id === mid);
        if (m && typeof generatePreviewText === 'function') {
            previews.push(generatePreviewText(m));
        }
    }
    return previews.map(p => `<span class="inv-mech-tag">${_escHtml(p)}</span>`).join('');
}

// ===== RENDER: ABA INVENTÁRIO =====
function renderInventoryTab() {
    const container = document.getElementById('inventoryItemsGrid');
    if (!container) return;

    const items = window._inventoryState.items;
    // Itens de primeiro nível: sem parentItemId
    const topLevel = items.filter(i => !i.parentItemId);
    const equipped = topLevel.filter(i => i.equipado);
    const loose = topLevel.filter(i => !i.equipado);

    let html = '';

    // Seção: Equipados
    html += `<div class="inv-section">
        <div class="inv-section-title">🎒 Equipados <span class="inv-section-count">${equipped.length}</span></div>
        <div class="inv-section-grid">`;
    if (equipped.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item equipado</div>';
    } else {
        html += equipped.map(i => _renderInvItemRow(i, true)).join('');
    }
    html += '</div></div>';

    // Seção: Inventário Solto
    html += `<div class="inv-section">
        <div class="inv-section-title">📋 Itens Soltos <span class="inv-section-count">${loose.length}</span></div>
        <div class="inv-section-grid">`;
    if (loose.length === 0) {
        html += '<div class="inv-empty-small">Nenhum item solto</div>';
    } else {
        html += loose.map(i => _renderInvItemRow(i, false)).join('');
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Render container viewers
    _renderOpenContainers();
}

function _renderInvItemRow(item, isEquipped) {
    const tipoEmoji = _getTipoEmoji(item.tipo);
    const img = item.imagem || item.imagemUrl;
    const imgHtml = img
        ? `<img src="${_escHtml(img)}" class="inv-row-img" alt="">`
        : `<div class="inv-row-img inv-row-img-ph">${tipoEmoji}</div>`;

    const equipBtn = isEquipped
        ? `<button class="inv-btn inv-btn-unequip" onclick="event.stopPropagation();unequipItem('${item.id}')" title="Desequipar">⬇️</button>`
        : `<button class="inv-btn inv-btn-equip" onclick="event.stopPropagation();openEquipModal('${item.id}')" title="Equipar">⬆️</button>`;

    // State/slot badge for equipped items
    let stateBadge = '';
    if (isEquipped && item.estadoEquip && EQUIP_STATES[item.estadoEquip]) {
        const st = EQUIP_STATES[item.estadoEquip];
        const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
        const slotLabel = item.slotAnatomico && bodySlots[item.slotAnatomico] ? bodySlots[item.slotAnatomico].label : '';
        stateBadge = `<span class="inv-badge inv-badge-state inv-badge-state-${item.estadoEquip}" title="${st.description}">${st.icon} ${st.label}${slotLabel ? ' — ' + slotLabel : ''}</span>`;
    }

    let containerBtn = '';
    if (item.ehContainer) {
        const isOpen = window._openContainerId === item.id;
        containerBtn = `<button class="inv-btn ${isOpen ? 'inv-btn-open' : 'inv-btn-closed'}" onclick="event.stopPropagation();toggleContainer('${item.id}')" title="${isOpen ? 'Fechar' : 'Abrir'} container">${isOpen ? '📂' : '📁'}</button>`;
    }

    // Move to Container button — only when a container is open and this item isn't the open container itself
    let moveToContainerBtn = '';
    if (window._openContainerId && window._openContainerId !== item.id) {
        moveToContainerBtn = `<button class="inv-btn inv-btn-move-container" onclick="event.stopPropagation();moveToContainer('${item.id}')" title="Mover para container aberto">📦➡️</button>`;
    }

    // Quantity — editable if loose, or if equipped AND type is Projétil/Consumível
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    const canEditQty = item.tipo !== 'Container' && item.tipo !== 'Arma' && (!isEquipped || item.tipo === 'Projétil' || item.tipo === 'Consumível');
    const qtyHtml = canEditQty
        ? `<input type="number" class="inv-qty-input" value="${qty}" min="1" onclick="event.stopPropagation()" onchange="updateItemQuantity('${item.id}', this.value)" title="Quantidade">`
        : `<span class="inv-badge inv-badge-qty" title="Quantidade">×${qty}</span>`;

    const pressao = isEquipped ? `<span class="inv-badge inv-badge-pressure-sm">⚖️ ${parseFloat(_getItemPressure(item)).toFixed(2)}</span>` : '';

    return `<div class="inv-item-row ${isEquipped ? 'inv-equipped' : ''}" onclick="openItemDetail('${item.id}')">
        ${imgHtml}
        <div class="inv-item-info">
            <span class="inv-item-name">${_escHtml(item.nome || 'Sem nome')}</span>
            <span class="inv-item-meta">${tipoEmoji} ${_escHtml(item.tipo || '')} | Peso: ${parseFloat(item.peso || 0).toFixed(2)} | Tam: ${item.tamanho || 0}</span>
        </div>
        ${qtyHtml}
        ${pressao}
        ${stateBadge}
        <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
            ${qty > 1 && !item.ehContainer && item.tipo !== 'Container' ? `<button class="inv-btn inv-btn-split" onclick="event.stopPropagation();openSplitModal('${item.id}')" title="Dividir">➗</button>` : ''}
            ${moveToContainerBtn}
            ${containerBtn}
            ${equipBtn}
            <button class="inv-btn inv-btn-delete" onclick="event.stopPropagation();deleteInventoryItem('${item.id}')" title="Excluir">🗑️</button>
        </div>
    </div>`;
}

// ===== CONTAINER VIEWER =====
window._openContainerId = null;

window.toggleContainer = function(itemId) {
    if (window._openContainerId === itemId) {
        window._openContainerId = null;
    } else {
        window._openContainerId = itemId;
    }
    renderInventoryTab();
};

function _renderOpenContainers() {
    const viewer = document.getElementById('containerViewer');
    if (!viewer) return;
    const cid = window._openContainerId;
    if (!cid) { viewer.innerHTML = ''; return; }

    const contItem = window._inventoryState.items.find(i => i.id === cid);
    if (!contItem) { viewer.innerHTML = ''; return; }

    const inside = window._inventoryState.items.filter(i => i.parentItemId === cid);
    const cap = contItem.capacidadeContainer || 10;
    const pesoMax = contItem.pesoMaximoContainer || null;
    const insideWeight = inside.reduce((sum, i) => {
        const iQty = Math.max(1, parseInt(i.quantidade) || 1);
        return sum + ((i.peso || 0) * iQty);
    }, 0);
    const mult = contItem.multiplicadorPressao || 1;
    const pesoBase = contItem.pressaoBase != null ? contItem.pressaoBase : (contItem.peso || 0);
    const pressaoContainer = pesoBase + (insideWeight * mult);
    const overWeight = pesoMax != null && insideWeight > pesoMax;

    let itemsHtml;
    if (inside.length === 0) {
        itemsHtml = '<div class="inv-empty-small"><span>📭</span> Container vazio</div>';
    } else {
        itemsHtml = inside.map(i => {
            const tipoEmoji = _getTipoEmoji(i.tipo);
            const iQty = Math.max(1, parseInt(i.quantidade) || 1);
            const iWeightTotal = ((i.peso || 0) * iQty).toFixed(2);
            const iImg = i.imagem || i.imagemUrl;
            const iImgHtml = iImg
                ? `<img src="${_escHtml(iImg)}" class="inv-row-img" alt="">`
                : `<div class="inv-row-img inv-row-img-ph">${tipoEmoji}</div>`;

            // Quantity input — disable for Container type items (same rule as loose items)
            const canEditQty = i.tipo !== 'Container' && i.tipo !== 'Arma';
            const qtyHtml = canEditQty
                ? `<input type="number" class="inv-qty-input" value="${iQty}" min="1" onclick="event.stopPropagation()" onchange="updateItemQuantity('${i.id}', this.value)" title="Quantidade">`
                : `<span class="inv-badge inv-badge-qty" title="Quantidade">×${iQty}</span>`;

            return `<div class="inv-container-item inv-item-row" onclick="openItemDetail('${i.id}')">
                ${iImgHtml}
                <div class="inv-item-info">
                    <span class="inv-item-name">${_escHtml(i.nome || 'Sem nome')}</span>
                    <span class="inv-item-meta">${tipoEmoji} ${_escHtml(i.tipo || '')} | Peso: ${iWeightTotal}${iQty > 1 ? ` (${parseFloat(i.peso || 0).toFixed(2)} × ${iQty})` : ''} | Tam: ${i.tamanho || 0}</span>
                </div>
                ${qtyHtml}
                <div class="inv-item-actions no-print" onclick="event.stopPropagation()">
                    ${iQty > 1 && !i.ehContainer && i.tipo !== 'Container' ? `<button class="inv-btn inv-btn-split" onclick="event.stopPropagation();openSplitModal('${i.id}')" title="Dividir">➗</button>` : ''}
                    <button class="inv-btn inv-btn-remove" onclick="event.stopPropagation();removeFromContainer('${i.id}')" title="Remover do container">📤</button>
                    <button class="inv-btn inv-btn-delete" onclick="event.stopPropagation();deleteInventoryItem('${i.id}')" title="Excluir">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    const weightDisplay = pesoMax != null
        ? `⚖️ Peso: ${insideWeight.toFixed(2)} / ${parseFloat(pesoMax).toFixed(2)}${overWeight ? ' ⚠️' : ''}`
        : `⚖️ Peso: ${insideWeight.toFixed(2)}`;

    viewer.innerHTML = `<div class="inv-container-viewer">
        <div class="inv-container-header">
            <span class="inv-container-title">📂 ${_escHtml(contItem.nome || 'Container')}</span>
            <span class="inv-container-cap">Itens: ${inside.length} / ${cap}</span>
            <button class="inv-btn inv-btn-close" onclick="toggleContainer('${cid}')">✕</button>
        </div>
        <div class="inv-container-stats">
            <span class="${overWeight ? 'inv-stat-over' : 'inv-stat-ok'}">${weightDisplay}</span>
            <span class="inv-stat-pressure">📐 Pressão: ${pressaoContainer.toFixed(2)} (${pesoBase.toFixed(2)} + ${insideWeight.toFixed(2)} × ${mult})</span>
        </div>
        <div class="inv-container-items">${itemsHtml}</div>
        <button class="inv-btn inv-btn-add-to-container" onclick="addItemToContainer('${cid}')">➕ Adicionar Item</button>
    </div>`;
}

// ===== ACTIONS =====

/**
 * Verifica quais slots estão compatíveis com um tipo de item e retorna lista
 * com informação de capacidade atual.
 */
function _getCompatibleSlots(item) {
    const items = window._inventoryState.items;
    const compatSlots = [];

    // === FALLBACK: Garantir partesDoCorpo carregadas ===
    if (!window.state || !window.state.partesDoCorpo || window.state.partesDoCorpo.length === 0) {
        const racaNome = document.getElementById('selRaca')?.value;
        let partsToLoad = null;
        if (racaNome && window.RACES && window.RACES[racaNome]
            && window.RACES[racaNome].partesDoCorpo
            && window.RACES[racaNome].partesDoCorpo.length > 0) {
            partsToLoad = window.RACES[racaNome].partesDoCorpo;
        } else if (window._systemData && window._systemData.bodyParts) {
            partsToLoad = window._systemData.bodyParts.filter(bp => bp.ehPadrao);
        }
        if (partsToLoad && partsToLoad.length > 0) {
            if (!window.state) window.state = {};
            window.state.partesDoCorpo = JSON.parse(JSON.stringify(partsToLoad));
            console.log('🔧 partesDoCorpo restaurado via fallback no _getCompatibleSlots:',
                window.state.partesDoCorpo.length, 'partes');
        }
    }

    const bodySlots = _getCharacterBodySlots();
    const equipavelEm = Array.isArray(item.equipavelEm) ? item.equipavelEm : (item.equipavelEm ? [item.equipavelEm] : []);
    const slotRestritoLegacy = Array.isArray(item.slotRestrito) ? item.slotRestrito : (item.slotRestrito ? [item.slotRestrito] : []);
    const restricoes = equipavelEm.length > 0 ? equipavelEm : slotRestritoLegacy;

    for (const [slotKey, slotDef] of Object.entries(bodySlots)) {
        const isNative = restricoes.length === 0 || restricoes.includes(slotDef.partId);
        const canHold = !!slotDef.podeSegurar;

        // Adiciona à lista se for slot nativo OU se o slot permitir segurar itens
        if (!isNative && !canHold) continue;
        
        // Contar itens no slot (ignorando 'armazenado' e 'fixado')
        // _itemOcupaSlot e não slotAnatomico: sem isso a 2a mão de uma arma de
        // duas mãos aparecia como slot livre aqui.
        const inSlot = items.filter(i => _itemOcupaSlot(i, slotKey) && i.equipado && i.estadoEquip !== 'armazenado' && i.estadoEquip !== 'fixado');
        
        // mechanicBonuses
        const mechBonus = typeof state !== 'undefined' && state.mechanicBonuses ? (state.mechanicBonuses['slot_' + slotKey] || 0) : 0;
        const dynamicMax = slotDef.max + mechBonus;

        compatSlots.push({
            key: slotKey,
            ...slotDef,
            max: dynamicMax,
            current: inSlot.length,
            full: inSlot.length >= dynamicMax
        });
    }
    return compatSlots;
}

/**
 * Retorna os estados de equipamento disponíveis para um item dado seu tipo e slot selecionado.
 */
function _getAvailableStates(item, slotKey) {
    const states = [];
    const bodySlots = _getCharacterBodySlots();
    const slotDef = bodySlots[slotKey];
    if (!slotDef) return states;

    const forma = item.formaEquipar;
    const equipavelEm = Array.isArray(item.equipavelEm) ? item.equipavelEm : (item.equipavelEm ? [item.equipavelEm] : []);
    const slotRestritoLegacy = Array.isArray(item.slotRestrito) ? item.slotRestrito : (item.slotRestrito ? [item.slotRestrito] : []);
    const restricoes = equipavelEm.length > 0 ? equipavelEm : slotRestritoLegacy;
    const isNative = restricoes.length === 0 || restricoes.includes(slotDef.partId);

    // Se é o slot nativo dele
    if (isNative) {
        if (forma === 'segurar' && slotDef.podeSegurar) states.push('segurar');
        if (forma === 'empunhar' && slotDef.podeEmpunhar) states.push('empunhado');
        if (forma === 'vestir' && slotDef.podeVestir) states.push('vestido');
        if (forma === 'fixar' && slotDef.podeFixar) states.push('fixado');

        // Retrocompatibilidade
        if (!forma) {
            if (slotDef.podeEmpunhar) states.push('empunhado');
            if (slotDef.podeVestir) states.push('vestido');
            if (slotDef.podeFixar) states.push('fixado');
            if (slotDef.podeSegurar) states.push('segurar');
        }
    } else {
        // Se NÃO é nativo, a única forma que permitimos estar aqui é porque tem "podeSegurar"
        if (slotDef.podeSegurar) {
            states.push('segurar');
        }
    }

    return [...new Set(states)]; // Remove duplicatas
}

/**
 * Abre o modal de equipamento — o jogador escolhe slot anatômico e estado.
 */
/**
 * Este item ficaria com Efeitos Ativos se fosse equipado neste slot, neste modo?
 * Usa itemTemEfeitosAtivos — a fonte única da verdade — sobre uma cópia
 * hipotética do item, para o modal e a confirmação nunca discordarem.
 */
function _estadoAtivaEfeitos(item, slotKey, stateKey) {
    if (!item) return false;
    return itemTemEfeitosAtivos({
        ...item, equipado: true, parentItemId: null,
        estadoEquip: stateKey, slotAnatomico: slotKey
    });
}

/**
 * Avisa e devolve true se uma mecânica "Bloqueia Equipar" alcança este item.
 * A regra vem de state.equipRestricoes, montado no recálculo (mechanics-engine).
 */
function _avisaEquipBloqueado(item) {
    const bloqueio = typeof window.equipBloqueioDoItem === 'function'
        ? window.equipBloqueioDoItem(item) : null;
    if (!bloqueio) return false;
    const motivo = bloqueio.descricao ? `\n\n${bloqueio.descricao}` : '';
    alert(`🚫 Você não pode equipar "${item.nome || 'este item'}".\n\nRegra de: ${bloqueio.fonte || 'mecânica'}${motivo}`);
    return true;
}

window.openEquipModal = function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    if (_avisaEquipBloqueado(item)) return;

    // === FALLBACK: Garantir partesDoCorpo carregadas (mesmo padrão de openItemFormModal) ===
    if (!window.state) window.state = {};
    if (!window.state.partesDoCorpo || window.state.partesDoCorpo.length === 0) {
        const racaNome = document.getElementById('selRaca')?.value;
        let partsToLoad = null;
        if (racaNome && window.RACES && window.RACES[racaNome]
            && window.RACES[racaNome].partesDoCorpo
            && window.RACES[racaNome].partesDoCorpo.length > 0) {
            partsToLoad = window.RACES[racaNome].partesDoCorpo;
        } else if (window._systemData && window._systemData.bodyParts) {
            partsToLoad = window._systemData.bodyParts.filter(bp => bp.ehPadrao);
        }
        if (partsToLoad && partsToLoad.length > 0) {
            window.state.partesDoCorpo = JSON.parse(JSON.stringify(partsToLoad));
            console.log('🔧 partesDoCorpo restaurado via fallback no openEquipModal:',
                window.state.partesDoCorpo.length, 'partes');
            if (typeof scheduleAutosave === 'function') scheduleAutosave();
        }
    }

    let existing = document.getElementById('invEquipModal');
    if (existing) existing.remove();

    const compatSlots = _getCompatibleSlots(item);
    const isWeapon = item.tipo === 'Arma';
    const weapCat = item.categoriaArma;
    const isVersatil = weapCat === 'versatil';
    const isDuasMaos = weapCat === 'duas_maos';

    let slotsToShow = compatSlots;

    if (slotsToShow.length === 0) {
        alert('Nenhum slot compatível encontrado para este tipo de item.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invEquipModal';

    let slotsHtml = slotsToShow.map(s => {
        const fullClass = s.full ? 'inv-slot-full' : '';
        const icon = s.icon;
        
        // Permite clicar mesmo se cheio, caso o slot suporte "fixar"
        const canFixItem = s.podeFixar && (!item.formaEquipar || item.formaEquipar === 'fixar');
        const clickable = !s.full || canFixItem;

        return `<div class="inv-equip-slot-option ${fullClass}" data-slot="${s.key}" onclick="${clickable ? `selectEquipSlot('${s.key}')` : ''}">
            <span class="inv-equip-slot-icon">${icon}</span>
            <span class="inv-equip-slot-label">${s.label}</span>
            <span class="inv-equip-slot-cap">${s.current}/${s.max}</span>
            ${s.full ? '<span class="inv-equip-slot-full-tag">CHEIO</span>' : ''}
        </div>`;
    }).join('');

    // Para armas de duas mãos, mostrar aviso
    let duasMaosNote = '';
    if (isDuasMaos) {
        duasMaosNote = `<div class="inv-equip-note">⚔️ Arma de Duas Mãos — Ocupará ambas as mãos.</div>`;
    }
    if (isVersatil) {
        duasMaosNote = `<div class="inv-equip-note">🔄 Arma Versátil — Escolha quantas mãos usará.</div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:500px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">⬆️ Equipar: ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeEquipModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${duasMaosNote}
            <div class="inv-equip-section">
                <label class="inv-form-label">📍 Escolha o Slot</label>
                <div class="inv-equip-slots-grid" id="equipSlotsGrid">${slotsHtml}</div>
            </div>
            <div class="inv-equip-section" id="equipStateSection" style="display:none">
                <label class="inv-form-label">⚙️ Modo de Equipamento</label>
                <div class="inv-equip-states-grid" id="equipStatesGrid"></div>
            </div>
            ${isVersatil ? `
            <div class="inv-equip-section" id="equipHandsSection" style="display:none">
                <label class="inv-form-label">✋ Quantas mãos?</label>
                <div class="inv-equip-states-grid">
                    <div class="inv-equip-state-option" data-hands="1" onclick="selectEquipHands(1)">
                        <span class="inv-equip-state-icon">🤚</span>
                        <span>1 Mão</span>
                    </div>
                    <div class="inv-equip-state-option" data-hands="2" onclick="selectEquipHands(2)">
                        <span class="inv-equip-state-icon">🤲</span>
                        <span>2 Mãos</span>
                    </div>
                </div>
            </div>` : ''}
        </div>
        <div class="inv-modal-footer">
            <button type="button" class="inv-btn-cancel" onclick="closeEquipModal()">Cancelar</button>
            <button type="button" class="inv-btn-save" id="btnConfirmEquip" onclick="confirmEquip('${item.id}')" disabled>✅ Confirmar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    // State para o modal
    window._equipModalState = {
        itemId: item.id,
        selectedSlot: null,
        selectedState: null,
        selectedHands: isDuasMaos ? 2 : (isVersatil ? null : 1),
        isVersatil: isVersatil,
        isDuasMaos: isDuasMaos,
        itemTipo: item.tipo,
        itemSlotRestrito: (item.equipavelEm && item.equipavelEm.length > 0) ? item.equipavelEm : item.slotRestrito
    };
};

window.selectEquipSlot = function(slotKey) {
    const st = window._equipModalState;
    if (!st) return;
    st.selectedSlot = slotKey;
    st.selectedState = null;

    // Highlight selected slot
    document.querySelectorAll('#equipSlotsGrid .inv-equip-slot-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.slot === slotKey);
    });

    // Show state options
    const stateSection = document.getElementById('equipStateSection');
    const statesGrid = document.getElementById('equipStatesGrid');
    
    // We need to pass the full item object mock or properties to _getAvailableStates
    const tempItem = { tipo: st.itemTipo, slotRestrito: st.itemSlotRestrito };
    let availableStates = _getAvailableStates(tempItem, slotKey);

    // Filtrar availableStates: se o slot estiver cheio para itens normais, só permite 'fixado'
    const items = window._inventoryState.items;
    const inSlot = items.filter(i => _itemOcupaSlot(i, slotKey) && i.equipado && i.estadoEquip !== 'armazenado' && i.estadoEquip !== 'fixado');
    const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
    const slotDef = bodySlots[slotKey];
    
    if (slotDef) {
        const mechBonus = typeof state !== 'undefined' && state.mechanicBonuses ? (state.mechanicBonuses['slot_' + slotKey] || 0) : 0;
        const dynamicMax = slotDef.max + mechBonus;
        const isFullForNormal = inSlot.length >= dynamicMax;
        
        if (isFullForNormal) {
            availableStates = availableStates.filter(state => state === 'fixado');
        }
    }

    if (availableStates.length === 0) {
        stateSection.style.display = 'none';
        return;
    }

    // "Bloqueia Equipar com Efeito": o item entra no corpo, mas só nos modos que
    // não ativam efeitos. Os que ativariam ficam visíveis e não clicáveis, para
    // o jogador ver que existem e por que estão fora.
    const itemReal = items.find(i => i.id === st.itemId);
    const bloqEfeitos = typeof window.equipBloqueioEfeitosDoItem === 'function'
        ? window.equipBloqueioEfeitosDoItem(itemReal) : null;

    statesGrid.innerHTML = availableStates.map(sKey => {
        const s = EQUIP_STATES[sKey];
        const restricoes = Array.isArray(st.itemSlotRestrito) ? st.itemSlotRestrito : (st.itemSlotRestrito ? [st.itemSlotRestrito] : null);
        const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
        const partId = bodySlots[slotKey] ? bodySlots[slotKey].partId : slotKey;
        const isRestrictedToOtherSlot = restricoes && restricoes.length > 0 && !restricoes.includes(slotKey) && !restricoes.includes(partId);
        const willApplyMechanics = s.appliesMechanics && !isRestrictedToOtherSlot;
        // O que barra é o predicado real de efeitos ativos, o mesmo que confirmEquip
        // consulta — assim o modal nunca oferece um modo que a confirmação recusa.
        const barrado = bloqEfeitos && _estadoAtivaEfeitos(itemReal, slotKey, sKey);

        const tag = barrado
            ? `<span class="inv-equip-nomech-tag">🚫 Bloqueado por ${_escHtml(bloqEfeitos.fonte || 'mecânica')}</span>`
            : (willApplyMechanics ? '<span class="inv-equip-mech-tag">✨ Efeitos ativos</span>' : '<span class="inv-equip-nomech-tag">🚫 Sem efeitos</span>');

        return `<div class="inv-equip-state-option${barrado ? ' inv-slot-full' : ''}" data-state="${sKey}"
            ${barrado ? 'title="Uma mecânica impede ativar os efeitos deste item"' : `onclick="selectEquipState('${sKey}')"`}>
            <span class="inv-equip-state-icon">${s.icon}</span>
            <div>
                <strong>${s.label}</strong>
                <small>${s.description}</small>
                ${tag}
            </div>
        </div>`;
    }).join('');
    stateSection.style.display = 'block';

    // Show hands section for versatile weapons
    if (st.isVersatil && (slotKey === 'mao_dir' || slotKey === 'mao_esq')) {
        const handsSection = document.getElementById('equipHandsSection');
        if (handsSection) handsSection.style.display = 'block';
    }

    _updateEquipConfirmBtn();
};

window.selectEquipState = function(stateKey) {
    const st = window._equipModalState;
    if (!st) return;
    st.selectedState = stateKey;

    document.querySelectorAll('#equipStatesGrid .inv-equip-state-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.state === stateKey);
    });

    _updateEquipConfirmBtn();
};

window.selectEquipHands = function(hands) {
    const st = window._equipModalState;
    if (!st) return;
    st.selectedHands = hands;

    document.querySelectorAll('#equipHandsSection .inv-equip-state-option').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.hands) === hands);
    });

    _updateEquipConfirmBtn();
};

function _updateEquipConfirmBtn() {
    const st = window._equipModalState;
    const btn = document.getElementById('btnConfirmEquip');
    if (!btn || !st) return;

    const ready = st.selectedSlot && st.selectedState &&
        (!st.isVersatil || st.selectedHands != null);
    btn.disabled = !ready;
}

window.confirmEquip = async function(itemId) {
    const st = window._equipModalState;
    if (!st || !st.selectedSlot || !st.selectedState) {
        console.warn('⚠️ confirmEquip: estado do modal incompleto', st);
        return;
    }

    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) {
        console.warn('⚠️ confirmEquip: item não encontrado no cache', itemId);
        return;
    }

    // Revalida na confirmação: o modal pode ter ficado aberto enquanto um
    // recálculo mudava as regras (trocou de classe, perdeu a peculiaridade...).
    if (_avisaEquipBloqueado(item)) { closeEquipModal(); return; }

    // "Bloqueia Equipar com Efeito": o modo escolhido não pode ativar efeitos.
    const bloqEfeitos = typeof window.equipBloqueioEfeitosDoItem === 'function'
        ? window.equipBloqueioEfeitosDoItem(item) : null;
    if (bloqEfeitos && _estadoAtivaEfeitos(item, st.selectedSlot, st.selectedState)) {
        alert(`⚡ "${item.nome || 'Este item'}" não pode ser equipado com os efeitos ativos.\n\nRegra de: ${bloqEfeitos.fonte || 'mecânica'}${bloqEfeitos.descricao ? `\n\n${bloqEfeitos.descricao}` : ''}\n\nVocê ainda pode segurar, fixar ou guardar num contêiner.`);
        return;
    }

    const slotKey = st.selectedSlot;
    const stateKey = st.selectedState;
    const hands = st.selectedHands || 1;

    const bodySlots = _getCharacterBodySlots();
    
    // Validação: para arma de duas mãos ou versátil com 2 mãos
    let otherHand = null;
    if ((st.isDuasMaos || (st.isVersatil && hands === 2)) && bodySlots[slotKey]?.podeEmpunhar) {
        // Encontrar outro slot que pode empunhar e não está ocupado
        const items = window._inventoryState.items;
        otherHand = Object.keys(bodySlots).find(k => {
            if (k === slotKey) return false;
            if (!bodySlots[k].podeEmpunhar) return false;
            // Verificar se está ocupado
            const isOccupied = items.some(i => _itemOcupaSlot(i, k) && i.equipado && i.estadoEquip !== 'armazenado');
            return !isOccupied;
        });

        if (!otherHand) {
            alert(`Não há outra mão/slot livre que possa empunhar a arma. Desequipe algo antes.`);
            return;
        }
    }

    // Slots adicionais do catálogo (armadura completa, set de peças). Somam-se à
    // mão extra acima, que continua sendo o caso especial das armas de 2 mãos.
    const jaTomados = [slotKey, otherHand].filter(Boolean);
    const outrosItens = window._inventoryState.items.filter(i =>
        i.id !== itemId && i.equipado && i.estadoEquip !== 'armazenado');
    outrosItens.forEach(i => jaTomados.push(..._slotsDoItem(i)));

    const nomeParte = pid => (window.state?.partesDoCorpo || []).find(b => b.id === pid)?.nome || pid;
    const reserva = _reservarSlots(_slotsExtrasNecessarios(item), bodySlots, jaTomados, nomeParte);
    if (!reserva.ok) {
        alert(`"${item.nome}" precisa de slots que não estão livres:\n\n• ${reserva.faltando.join('\n• ')}\n\nDesequipe algo antes.`);
        return;
    }
    const slotsExtras = [...(otherHand ? [otherHand] : []), ...reserva.slots];

    // Desabilitar botão para evitar cliques duplos
    const btn = document.getElementById('btnConfirmEquip');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Equipando...'; }

    try {
        const updateData = {
            equipado: true,
            slotAnatomico: slotKey,
            estadoEquip: stateKey,
            parentItemId: null,
            lastModified: new Date().toISOString()
        };

        // maosUsadas — só definir para Armas; para outros tipos, omitir do update
        if (item.tipo === 'Arma') {
            updateData.maosUsadas = hands;
        }

        // Preservar campos de ownership para satisfazer regras de segurança do Firestore
        const user = _getCurrentUser();
        if (item.ownerUid) {
            updateData.ownerUid = item.ownerUid;
        } else if (user) {
            updateData.ownerUid = user.uid;
        }
        if (item.ownerId) {
            updateData.ownerId = item.ownerId;
        } else if (user) {
            updateData.ownerId = user.uid;
        }

        // Todos os slots extras num só campo. slotAnatomico2 continua gravado
        // para não quebrar leitura de código/dado antigo que ainda o consulta.
        updateData.slotsOcupados = slotsExtras;
        updateData.slotAnatomico2 = otherHand;

        console.log('⬆️ Equipando item:', itemId, 'Slot:', slotKey, 'Estado:', stateKey, 'Data:', updateData);

        await _firestoreSetDoc('items', itemId, updateData);
        Object.assign(item, updateData);

        console.log('✅ Item equipado com sucesso:', item.nome);

        closeEquipModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao equipar:', e);
        alert('Erro ao equipar item: ' + e.message);
        // Restaurar botão em caso de erro
        if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar'; }
    }
};

window.unequipItem = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    try {
        const updateData = {
            equipado: false,
            slotAnatomico: null,
            slotsOcupados: [],
            slotAnatomico2: null,
            estadoEquip: null,
            maosUsadas: null,
            lastModified: new Date().toISOString()
        };

        // Preservar campos de ownership para satisfazer regras de segurança do Firestore
        const user = _getCurrentUser();
        if (item && item.ownerUid) {
            updateData.ownerUid = item.ownerUid;
        } else if (user) {
            updateData.ownerUid = user.uid;
        }
        if (item && item.ownerId) {
            updateData.ownerId = item.ownerId;
        } else if (user) {
            updateData.ownerId = user.uid;
        }

        console.log('⬇️ Desequipando item:', itemId, item?.nome);

        await _firestoreSetDoc('items', itemId, updateData);
        if (item) Object.assign(item, updateData);

        console.log('✅ Item desequipado com sucesso:', item?.nome);

        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao desequipar:', e);
        alert('Erro ao desequipar item: ' + e.message);
    }
};

window.closeEquipModal = function() {
    const m = document.getElementById('invEquipModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
    window._equipModalState = null;
};

/** Aponta (ou desaponta, com id vazio) o maço que alimenta uma arma de disparo. */
window.vincularProjetil = async function(armaId, projetilId) {
    const item = window._inventoryState.items.find(i => i.id === armaId);
    if (!item) return;
    try {
        const patch = { projetilId: projetilId || null, lastModified: new Date().toISOString() };
        const user = _getCurrentUser();
        if (item.ownerUid) patch.ownerUid = item.ownerUid; else if (user) patch.ownerUid = user.uid;
        if (item.ownerId) patch.ownerId = item.ownerId; else if (user) patch.ownerId = user.uid;
        await _firestoreSetDoc('items', armaId, patch);
        Object.assign(item, patch);
        renderEquippedItems();
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao apontar projétil:', e);
        alert('Erro ao apontar projétil: ' + e.message);
    }
};

// Legacy compat — old toggleEquip still works for unequip
window.toggleEquip = async function(itemId, equip) {
    if (equip) {
        openEquipModal(itemId);
    } else {
        await unequipItem(itemId);
    }
};

/* ===== USAR ITEM (consumível) ===================================== */

// Mapa vital → ids dos campos da ficha. Espelha DERIVED_FIELDS_MAP em
// derived-values.js, que é local àquele módulo.
const VITAL_CAMPOS = {
    VIT: { atual: 'vit_atual', max: 'vit_max_display', nome: 'Vitalidade' },
    ENER: { atual: 'ener_atual', max: 'ener_max_display', nome: 'Energia' },
    SAN: { atual: 'san_atual', max: 'san_max_display', nome: 'Sanidade' },
};

/** Mecânicas do item (próprias + do modelo), que no uso disparam como one-off. */
function _mecanicasDoItem(item) {
    const ids = new Set(_campoDoItem(item, 'mecanicaIdsProprias'));
    if (item.modeloId) {
        const tpl = window._inventoryState.catalog.find(t => t.id === item.modeloId);
        for (const id of (tpl?.mecanicaIds || [])) ids.add(id);
    }
    for (const id of (item.mecanicaIds || [])) ids.add(id);
    return [...ids];
}

window.podeUsarItem = function(item) {
    if (!item || item.tipo !== 'Consumível') return false;
    return _statusVitaisDoItem(item).some(sv => String(sv.id).endsWith('_ATUAL') && Number(sv.modificador))
        || _campoDoItem(item, 'condicaoIds').length > 0
        || _mecanicasDoItem(item).length > 0;
};

/**
 * Consome 1 unidade: aplica os deltas de status vital "Atual", adiciona as
 * condições vinculadas e decrementa a quantidade (remove o item ao zerar).
 */
window.usarItem = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;
    if (item.tipo !== 'Consumível') {
        alert('Só itens do tipo Consumível podem ser usados.');
        return;
    }

    const efeitos = [];

    // 1) Status vitais "Atual" — clamp em [0, Máximo]
    for (const sv of _statusVitaisDoItem(item)) {
        const mod = Number(sv.modificador) || 0;
        const m = String(sv.id).match(/^(.+)_ATUAL$/);
        if (!mod || !m) continue;
        const campos = VITAL_CAMPOS[m[1]];
        if (!campos) { console.warn(`⚠️ [usarItem] status vital desconhecido: ${sv.id}`); continue; }

        const el = document.getElementById(campos.atual);
        if (!el) continue;
        const antes = parseInt(el.value) || 0;
        const teto = parseInt(document.getElementById(campos.max)?.textContent) || Infinity;
        const depois = Math.max(0, Math.min(antes + mod, teto));
        el.value = depois;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        if (depois !== antes) efeitos.push(`${campos.nome} ${antes} → ${depois}`);
    }

    // 1b) Mecânicas do item, como one-off. É o que faz alvo "ATUAL:" valer:
    // fora de one-off o motor descarta esses alvos (mechanics-engine.js:1746).
    if (typeof applyMechanicToSheet === 'function') {
        const mechs = window._systemData?.mechanics || [];
        for (const mid of _mecanicasDoItem(item)) {
            const mech = mechs.find(m => m.id === mid);
            if (!mech) { console.warn(`⚠️ [usarItem] mecânica ${mid} não encontrada`); continue; }
            applyMechanicToSheet(mech, null, true);
            efeitos.push(mech.nome || mid);
        }
    }

    // 2) Condições vinculadas — não duplica o que já está ativo
    for (const condId of _campoDoItem(item, 'condicaoIds')) {
        const tpl = (window._systemData?.conditions || []).find(c => c.id === condId);
        if (!tpl) continue;
        if (!Array.isArray(state.conditions)) state.conditions = [];
        if (state.conditions.some(c => c.modeloId === tpl.id)) continue;
        state.conditions.push({
            nome: tpl.nome || '',
            descricao: tpl.descricao || '',
            tempoAtual: '',
            tempoRestante: tpl.duracao || '',
            icone: tpl.icone || '💀',
            modeloId: tpl.id,
            efeitoMecanicaIds: tpl.efeitoMecanicaIds || []
        });
        efeitos.push(`+${tpl.nome}`);
    }

    // 3) Consome a unidade
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    try {
        if (qty > 1) {
            await _firestoreSetDoc('items', itemId, { quantidade: qty - 1, lastModified: new Date().toISOString() });
            item.quantidade = qty - 1;
        } else {
            await _firestoreDeleteDoc('items', itemId);
            window._inventoryState.items = window._inventoryState.items.filter(i => i.id !== itemId);
        }
    } catch (e) {
        console.error('❌ Erro ao consumir item:', e);
        return;
    }

    if (typeof renderConditions === 'function') renderConditions();
    if (typeof _triggerConditionMechanicsUpdate === 'function') _triggerConditionMechanicsUpdate();
    renderEquippedItems();
    renderInventoryTab();
    recalcInventoryPressure();
    if (typeof applyAllRaceMechanics === 'function') applyAllRaceMechanics(document.getElementById('selRaca')?.value);
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    console.log(`🧪 Usou "${item.nome}": ${efeitos.join(', ') || 'sem efeito'}`);
};

window.deleteInventoryItem = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;
    if (!confirm(`Excluir "${item.nome || 'item'}"?`)) return;
    try {
        // Also remove items inside if it's a container
        if (item.ehContainer) {
            const inside = window._inventoryState.items.filter(i => i.parentItemId === itemId);
            for (const child of inside) {
                await _firestoreDeleteDoc('items', child.id);
            }
        }
        await _firestoreDeleteDoc('items', itemId);
        window._inventoryState.items = window._inventoryState.items.filter(i => i.id !== itemId && i.parentItemId !== itemId);
        if (window._openContainerId === itemId) window._openContainerId = null;
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao excluir item:', e);
    }
};

window.moveToContainer = async function(itemId) {
    const containerId = window._openContainerId;
    if (!containerId || containerId === itemId) return;
    const contItem = window._inventoryState.items.find(i => i.id === containerId);
    if (!contItem) return;
    try {
        await _firestoreSetDoc('items', itemId, { parentItemId: containerId, equipado: false, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) { item.parentItemId = containerId; item.equipado = false; }
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        // Re-apply mechanics since equipped items may have changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao mover para container:', e);
    }
};

window.updateItemQuantity = async function(itemId, newQty) {
    const qty = Math.max(1, parseInt(newQty) || 1);
    try {
        await _firestoreSetDoc('items', itemId, { quantidade: qty, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) item.quantidade = qty;
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        // Re-apply mechanics since pressure changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();
    } catch (e) {
        console.error('❌ Erro ao atualizar quantidade:', e);
    }
};

window.removeFromContainer = async function(itemId) {
    try {
        await _firestoreSetDoc('items', itemId, { parentItemId: null, equipado: false, lastModified: new Date().toISOString() });
        const item = window._inventoryState.items.find(i => i.id === itemId);
        if (item) { item.parentItemId = null; item.equipado = false; }
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao remover do container:', e);
    }
};

window.addItemToContainer = function(containerId) {
    openItemFormModal('Criar Item no Container', null, containerId);
};

// ===== ITEM DETAIL MODAL =====
window.openItemDetail = function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    let existing = document.getElementById('invDetailModal');
    if (existing) existing.remove();

    const pressao = _getItemPressure(item);
    const qty = Math.max(1, parseInt(item.quantidade) || 1);
    const tipoEmoji = _getTipoEmoji(item.tipo);
    const img = item.imagem || item.imagemUrl;
    const mechPreview = _getMechPreview(item);

    // Totais escopados: base do personagem + o que ESTE item acrescenta
    let escopoHtml = '';
    if (typeof computeItemScopedTotals === 'function') {
        const r = computeItemScopedTotals(item, {
            derivedValues: window.DERIVED_VALUES || [],
            derived: (window.state && window.state.derived) || {},
            itemBonuses: (window.state && window.state.itemBonuses) || {},
            catalog: window._inventoryState.catalog || [],
        });
        const ativo = itemTemEfeitosAtivos(item);
        const linhas = r.colunas.filter(c => c.bonus !== 0 || c.total !== 0).map(c =>
            `<div class="inv-escopo-row">
                <span class="inv-escopo-nome">${c.icone} ${_escHtml(c.nome)}</span>
                <span class="inv-escopo-calc">base ${c.base} ${c.bonus >= 0 ? '+' : '−'} ${Math.abs(c.bonus)} <em>(item)</em></span>
                <span class="inv-escopo-total">= ${_escHtml(c.prefixo)}${c.total}${_escHtml(c.sufixo)}</span>
            </div>`).join('');

        // Canal de Essência é parcela separada: o alvo reduz cada uma com a
        // Blindagem da própria cor, então cada canal ganha a sua linha.
        const canaisHtml = (r.canais || []).map(c =>
            `<div class="inv-escopo-row">
                <span class="inv-escopo-nome">${c.icone} ${_escHtml(c.nome)}</span>
                <span class="inv-escopo-calc"><em>canal separado</em></span>
                <span class="inv-escopo-total inv-escopo-dano">${c.total > 0 ? '+' : ''}${c.total}</span>
            </div>`).join('');

        if (r.dano || canaisHtml || linhas) {
            escopoHtml = `<div class="inv-detail-escopo${ativo ? '' : ' inv-escopo-inativo'}">
                <span class="inv-detail-label">⚔️ Com este item${ativo ? '' : ' <em>(efeitos inativos — equipe na forma prevista)</em>'}</span>
                ${r.dano ? `<div class="inv-escopo-row"><span class="inv-escopo-nome">💥 Dano</span>${
                    r.tipoGolpe ? `<span class="inv-escopo-calc" title="Barrado pela Blindagem ${_escHtml(r.tipoGolpe.nome)} do alvo">${r.tipoGolpe.icone} ${_escHtml(r.tipoGolpe.nome)}</span>` : ''
                }<span class="inv-escopo-total inv-escopo-dano">${_escHtml(r.dano)}</span></div>` : ''}
                ${canaisHtml}
                ${linhas}
            </div>`;
        }
    }

    // Arco/besta: o dado é da arma, mas Qualidade e Afiação vêm do maço
    // apontado (Livro, 5.6 v2). O vínculo é escolhido aqui — com dois maços
    // na aljava, dedução automática escolheria errado em silêncio.
    let projetilHtml = '';
    if (item.tipo === 'Arma') {
        const tagsArma = _campoDoItem(item, 'tags');
        const tagProj = tagsArma.includes('Arco') ? 'Flecha' : tagsArma.includes('Besta') ? 'Virote' : null;
        if (tagProj) {
            const projs = window._inventoryState.items.filter(i => {
                if (i.tipo !== 'Projétil') return false;
                const t = _campoDoItem(i, 'tags');
                // do tipo certo — ou sem tipo declarado (munição genérica)
                return t.includes(tagProj) || (!t.includes('Flecha') && !t.includes('Virote'));
            });
            projetilHtml = `<div class="inv-detail-mechs">
                <span class="inv-detail-label">🎯 Projétil apontado (${tagProj === 'Flecha' ? 'flechas' : 'virotes'})</span>
                <select onchange="vincularProjetil('${item.id}', this.value)" style="width:100%;margin-top:4px">
                    <option value="">— sem projétil: a arma dispara só o dado —</option>
                    ${projs.map(p => `<option value="${p.id}" ${item.projetilId === p.id ? 'selected' : ''}>${_escHtml(p.nome)} ×${parseInt(p.quantidade) || 1}</option>`).join('')}
                </select>
            </div>`;
        }
    }

    const modal = document.createElement('div');
    modal.className = 'inv-modal';
    modal.id = 'invDetailModal';
    modal.innerHTML = `<div class="inv-modal-content">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${tipoEmoji} ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeItemDetail()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${img ? `<img src="${_escHtml(img)}" class="inv-detail-img" alt="">` : ''}
            <div class="inv-detail-grid">
                <div class="inv-detail-field"><span class="inv-detail-label">Tipo</span><span>${tipoEmoji} ${_escHtml(item.tipo || '-')}</span></div>
                ${item.tipo === 'Arma' && item.categoriaArma ? `<div class="inv-detail-field"><span class="inv-detail-label">Categoria</span><span>${WEAPON_CATEGORIES.find(c=>c.value===item.categoriaArma)?.label || item.categoriaArma}</span></div>` : ''}
                <div class="inv-detail-field"><span class="inv-detail-label">Peso (un.)</span><span>${parseFloat(item.peso || 0).toFixed(2)}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Quantidade</span><span>×${qty}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Tamanho</span><span>${item.tamanho || 0}</span></div>
                <div class="inv-detail-field"><span class="inv-detail-label">Pressão</span><span>⚖️ ${parseFloat(pressao).toFixed(2)}</span></div>
                ${item.equipado ? (() => {
                    const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
                    const slotLabel = item.slotAnatomico ? bodySlots[item.slotAnatomico]?.label || item.slotAnatomico : 'Sem Slot';
                    return `<div class="inv-detail-field"><span class="inv-detail-label">Slot</span><span>${slotLabel}</span></div>`;
                })() : ''}
                ${item.equipado && item.estadoEquip ? `<div class="inv-detail-field"><span class="inv-detail-label">Estado</span><span>${EQUIP_STATES[item.estadoEquip]?.label || item.estadoEquip}</span></div>` : ''}
                ${item.ehContainer ? `<div class="inv-detail-field"><span class="inv-detail-label">Peso Máximo</span><span>⚖️ ${item.pesoMaximoContainer || '∞'}</span></div>` : ''}
                ${item.ehContainer ? `<div class="inv-detail-field"><span class="inv-detail-label">Multiplicador</span><span>×${item.multiplicadorPressao || 1}</span></div>` : ''}
            </div>
            ${projetilHtml}
            ${item.descricao ? `<div class="inv-detail-desc">${_escHtml(item.descricao)}</div>` : ''}
            ${escopoHtml}
            ${mechPreview ? `<div class="inv-detail-mechs"><span class="inv-detail-label">Efeitos</span>${mechPreview}</div>` : ''}
        </div>
        <div class="inv-modal-footer">
            ${window.podeUsarItem(item) ? `<button class="inv-btn-action" onclick="usarItem('${item.id}');closeItemDetail()">🧪 Usar</button>` : ''}
            <button class="inv-btn-action" onclick="toggleEquip('${item.id}',${!item.equipado});closeItemDetail()">${item.equipado ? '⬇️ Desequipar' : '⬆️ Equipar'}</button>
            <button class="inv-btn-transfer" onclick="openTransferModal('${item.id}')">🔄 Transferir</button>
            ${qty > 1 && !item.ehContainer && item.tipo !== 'Container' ? `<button class="inv-btn-action" onclick="closeItemDetail();openSplitModal('${item.id}')">➗ Dividir</button>` : ''}
            <button class="inv-btn-action" onclick="closeItemDetail();openItemFormModal('Editar Item', window._inventoryState.items.find(i=>i.id==='${item.id}'))" style="margin-left:auto">✏️ Editar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
};

window.closeItemDetail = function() {
    const m = document.getElementById('invDetailModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

// ===== SPLIT MODAL =====
window.openSplitModal = function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    let existing = document.getElementById('invSplitModal');
    if (existing) existing.remove();

    const maxQty = Math.max(1, parseInt(item.quantidade) || 1);
    if (maxQty <= 1) return; // Cannot split

    const half = Math.floor(maxQty / 2);
    const remain = maxQty - half;

    const modal = document.createElement('div');
    modal.className = 'inv-modal';
    modal.id = 'invSplitModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width: 400px;">
        <div class="inv-modal-header">
            <span class="inv-modal-title">➗ Dividir: ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeSplitModal()">✕</button>
        </div>
        <div class="inv-modal-body" style="text-align:center;">
            <p style="margin-bottom: 15px; color: var(--text-muted);">Dividindo pilha de <b style="color:var(--text-color);">${maxQty}</b> itens</p>
            <div class="inv-split-container" style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">
                <div class="inv-split-field" style="flex: 1;">
                    <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">Pilha Original</label>
                    <input type="number" id="splitRemainInput" class="inv-form-input" min="1" max="${maxQty - 1}" value="${remain}" oninput="syncSplitInputs('remain', ${maxQty})" style="text-align: center; font-size: 1.1rem; padding: 8px;">
                </div>
                <div class="inv-split-field" style="flex: 1;">
                    <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">Nova Pilha</label>
                    <input type="number" id="splitNewInput" class="inv-form-input" min="1" max="${maxQty - 1}" value="${half}" oninput="syncSplitInputs('new', ${maxQty})" style="text-align: center; font-size: 1.1rem; padding: 8px;">
                </div>
            </div>
            <input type="range" id="splitSlider" class="inv-split-slider" min="1" max="${maxQty - 1}" value="${half}" oninput="syncSplitInputs('slider', ${maxQty})" style="width:100%; cursor: pointer;">
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="closeSplitModal()">Cancelar</button>
            <button class="inv-btn-save" onclick="confirmSplitItem('${item.id}', ${maxQty})">Confirmar Divisão</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
};

window.closeSplitModal = function() {
    const m = document.getElementById('invSplitModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

window.syncSplitInputs = function(source, maxQty) {
    const remainInput = document.getElementById('splitRemainInput');
    const newInput = document.getElementById('splitNewInput');
    const slider = document.getElementById('splitSlider');
    
    let newVal, remainVal;
    if (source === 'slider') {
        newVal = parseInt(slider.value) || 1;
        remainVal = maxQty - newVal;
    } else if (source === 'new') {
        newVal = parseInt(newInput.value) || 1;
        if (newVal >= maxQty) newVal = maxQty - 1;
        if (newVal < 1) newVal = 1;
        remainVal = maxQty - newVal;
    } else if (source === 'remain') {
        remainVal = parseInt(remainInput.value) || 1;
        if (remainVal >= maxQty) remainVal = maxQty - 1;
        if (remainVal < 1) remainVal = 1;
        newVal = maxQty - remainVal;
    }
    
    remainInput.value = remainVal;
    newInput.value = newVal;
    slider.value = newVal;
};

window.confirmSplitItem = async function(itemId, maxQty) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    const newInput = document.getElementById('splitNewInput');
    const newQty = parseInt(newInput.value);
    if (!newQty || newQty < 1 || newQty >= maxQty) return;
    const remainQty = maxQty - newQty;

    try {
        // Create new item
        const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        const newItemData = { ...item, id: newId, quantidade: newQty, lastModified: new Date().toISOString() };
        await _firestoreSetDoc('items', newId, newItemData);

        // Update original item
        await _firestoreSetDoc('items', itemId, { quantidade: remainQty, lastModified: new Date().toISOString() });
        item.quantidade = remainQty;

        // Add to local state
        window._inventoryState.items.push(newItemData);

        closeSplitModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
        
        alert(`✅ Pilha dividida com sucesso! (${remainQty} e ${newQty})`);
    } catch (e) {
        console.error('❌ Erro ao dividir item:', e);
        alert('❌ Erro ao dividir item: ' + e.message);
    }
};

// ===== TRANSFER MODAL =====
window.openTransferModal = async function(itemId) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    // Close detail modal if open
    closeItemDetail();

    // Show loading modal
    let existing = document.getElementById('invTransferModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invTransferModal';
    modal.innerHTML = `<div class="inv-modal-content" style="max-width:500px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">🔄 Transferir: ${_escHtml(item.nome || 'Item')}</span>
            <button class="inv-modal-close" onclick="closeTransferModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            <div style="text-align:center;padding:30px;color:var(--muted)">⏳ Carregando alvos...</div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    try {
        const { doc, getDoc, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = _getFirestore();
        const charId = _getCurrentCharId();

        // Get current character data to check mesaId
        const charSnap = await getDoc(doc(db, 'char', charId));
        const charData = charSnap.exists() ? charSnap.data() : {};
        const mesaId = charData.mesaId || null;

        let targets = [];

        if (mesaId) {
            // Character is in a mesa — show mesa characters + Caixa do Mestre
            // Add Caixa do Mestre as first option
            targets.push({
                id: '__caixa_mestre__' + mesaId,
                nome: '📦 Caixa do Mestre',
                ownerUid: '__mestre__',
                isCaixaMestre: true
            });

            // Get all characters in same mesa
            const charSnaps = await getDocs(query(collection(db, 'char'), where('mesaId', '==', mesaId)));
            charSnaps.forEach(d => {
                const data = d.data();
                if (d.id !== charId) {
                    const f = data.fields || {};
                    targets.push({
                        id: d.id,
                        nome: f.nome || data.nome || 'Sem nome',
                        ownerUid: data.ownerUid || '',
                        ownerEmail: data.ownerEmail || data.userEmail || ''
                    });
                }
            });
        } else {
            // Character is avulso — show all avulso characters of the SAME OWNER
            const charSnaps = await getDocs(query(collection(db, 'char'), where('ownerUid', '==', window.currentUser?.uid || '')));
            charSnaps.forEach(d => {
                const data = d.data();
                if (!data.mesaId && d.id !== charId) {
                    const f = data.fields || {};
                    targets.push({
                        id: d.id,
                        nome: f.nome || data.nome || 'Sem nome',
                        ownerUid: data.ownerUid || '',
                        ownerEmail: data.ownerEmail || data.userEmail || ''
                    });
                }
            });
        }

        // ===== ALIADOS (NPCs) =====
        // O jogador pode transferir apenas para SEUS próprios aliados ou para
        // aliados de personagens da MESMA MESA.
        try {
            // IDs de personagens permitidos: o próprio + (se em mesa) os da mesa
            const allowedCharIds = new Set([charId]);
            if (mesaId) {
                const charSnaps2 = await getDocs(query(collection(db, 'char'), where('mesaId', '==', mesaId)));
                charSnaps2.forEach(d => allowedCharIds.add(d.id));
            }
            const npcSnaps = await getDocs(collection(db, 'npcs'));
            npcSnaps.forEach(d => {
                const n = d.data();
                const vincs = Array.isArray(n.vinculos) ? n.vinculos : [];
                const ehAliadoPermitido = vincs.some(v =>
                    v.tipo === 'personagem' &&
                    String(v.relacao || '').toLowerCase() === 'aliado' &&
                    allowedCharIds.has(v.id)
                );
                if (ehAliadoPermitido) {
                    targets.push({
                        id: d.id,
                        nome: n.nome || 'Sem nome',
                        ownerUid: '',
                        ownerEmail: n.papel || (n.tipo === 'criatura' ? 'Criatura aliada' : 'NPC aliado'),
                        isNpc: true
                    });
                }
            });
        } catch (eNpc) {
            console.warn('⚠️ Não foi possível carregar aliados (NPCs) para transferência:', eNpc);
        }

        // Render target list
        const body = modal.querySelector('.inv-modal-body');
        if (targets.length === 0) {
            body.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted)">
                <div style="font-size:2rem;margin-bottom:8px">🚫</div>
                Nenhum alvo disponível para transferência.
            </div>`;
            return;
        }

        let qtyHtml = '';
        if ((item.quantidade || 1) > 1) {
            qtyHtml = `
            <div class="inv-form-group" style="padding: 0 15px 15px 15px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
                <label class="inv-form-label" style="text-align:center; font-weight:bold;">Quantidade a transferir (Máximo: ${item.quantidade})</label>
                <input type="number" id="invTransferQtyInput" class="inv-form-input" style="text-align:center; font-size:1.2rem; width:100px; margin: 0 auto; display:block;" value="0" min="0" max="${item.quantidade}">
            </div>`;
        }

        // Cache dos alvos para o transferItem (nome, tipo do destino, etc.)
        window._invTransferTargets = {};
        targets.forEach(t => { window._invTransferTargets[t.id] = t; });

        const charTargets = targets.filter(t => !t.isNpc);
        const npcTargets = targets.filter(t => t.isNpc);

        const renderTarget = t => `<div class="inv-transfer-target ${t.isCaixaMestre ? 'inv-transfer-target-master' : ''}"
                onclick="transferItem('${itemId}', '${t.id}', '${t.ownerUid}')">
                <div class="inv-transfer-target-name">${t.isCaixaMestre ? '📦' : (t.isNpc ? '🤝' : '🎭')} ${_escHtml(t.nome)}</div>
                ${t.ownerEmail ? `<div class="inv-transfer-target-meta">${t.isNpc ? '' : '👤 '}${_escHtml(t.ownerEmail)}</div>` : ''}
            </div>`;

        body.innerHTML = `
            ${qtyHtml}
            <div class="inv-transfer-list">
            ${charTargets.map(renderTarget).join('')}
            ${npcTargets.length ? `
                <div style="margin:10px 0 4px 0;font-weight:700;font-size:.85rem;color:var(--primary,#8b5cf6);border-top:1px solid var(--border-color,#334155);padding-top:8px">
                    🤝 Aliados (NPCs) — seus aliados e aliados da sua mesa
                </div>
                ${npcTargets.map(renderTarget).join('')}` : ''}
        </div>`;

    } catch (e) {
        console.error('❌ Erro ao carregar alvos:', e);
        const body = modal.querySelector('.inv-modal-body');
        if (body) body.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444">❌ Erro ao carregar alvos: ${_escHtml(e.message)}</div>`;
    }
};

window.closeTransferModal = function() {
    const m = document.getElementById('invTransferModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 200); }
};

window.transferItem = async function(itemId, targetCharId, targetOwnerUid) {
    const item = window._inventoryState.items.find(i => i.id === itemId);
    if (!item) return;

    const targetInfo = (window._invTransferTargets || {})[targetCharId] || null;
    const isNpcTarget = !!targetInfo?.isNpc;
    const targetName = targetCharId.startsWith('__caixa_mestre__')
        ? 'Caixa do Mestre'
        : (targetInfo?.nome ? (isNpcTarget ? `Aliado "${targetInfo.nome}"` : targetInfo.nome) : targetCharId);
    
    let transferQty = item.quantidade || 1;
    let isPartialTransfer = false;

    if (transferQty > 1) {
        const qtyInput = document.getElementById('invTransferQtyInput');
        if (!qtyInput) {
            alert("Erro: Campo de quantidade não encontrado.");
            return;
        }
        
        const inputQty = parseInt(qtyInput.value, 10);
        if (isNaN(inputQty) || inputQty <= 0) {
            alert("Quantidade inválida ou igual a zero. Por favor, insira um valor válido no campo de quantidade acima da lista de alvos.");
            return;
        }
        if (inputQty > transferQty) {
            alert("Você não possui essa quantidade toda. Transferência cancelada.");
            return;
        }
        if (inputQty < transferQty) {
            isPartialTransfer = true;
        }
        transferQty = inputQty;
    }

    const confirmMsg = transferQty > 1 
        ? `Transferir ${transferQty}x "${item.nome || 'item'}" para ${targetName}?` 
        : `Transferir "${item.nome || 'item'}" para ${targetName}?`;
    
    if (!confirm(confirmMsg)) return;

    try {
        const updateData = {
            characterId: targetCharId,
            equipado: false,
            slotAnatomico: null,
            estadoEquip: null,
            parentItemId: null,
            lastModified: new Date().toISOString()
        };

        if (isNpcTarget) {
            // Destino é um NPC aliado: o item passa a "pertencer" ao NPC,
            // mas o ownerUid NÃO muda (regras do Firestore: o jogador só pode
            // atualizar itens dos quais é dono ou que estejam em NPCs).
            updateData.ownerType = 'npc';
        } else if (!targetCharId.startsWith('__caixa_mestre__')) {
            // Only update ownerUid if target is a real character
            // Fetch target character to get ownerUid
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const db = _getFirestore();
            const targetSnap = await getDoc(doc(db, 'char', targetCharId));
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                updateData.ownerUid = targetData.ownerUid || targetOwnerUid;
                updateData.ownerId = targetData.ownerUid || targetOwnerUid;
            }
        }

        if (isPartialTransfer) {
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            const newItemData = { ...item, ...updateData, id: newId, quantidade: transferQty };
            await _firestoreSetDoc('items', newId, newItemData);
            
            const remainingQty = item.quantidade - transferQty;
            await _firestoreSetDoc('items', itemId, { quantidade: remainingQty, lastModified: new Date().toISOString() });
            item.quantidade = remainingQty;
        } else {
            await _firestoreSetDoc('items', itemId, updateData);
            window._inventoryState.items = window._inventoryState.items.filter(i => i.id !== itemId);
        }

        // 📜 Log dedicado da transferência (respeita a lógica do CharLogger)
        if (window.CharLogger) {
            try {
                window.CharLogger.logEvent({
                    category: 'Inventário',
                    action: `🔁 Item "${item.nome || 'item'}"${transferQty > 1 ? ` (x${transferQty})` : ''} transferido para ${targetName}`,
                    changes: [
                        { label: 'Item', from: item.nome || '(item)', to: item.nome || '(item)' },
                        { label: 'Quantidade transferida', from: '—', to: String(transferQty) },
                        { label: 'Destino', from: '—', to: targetName }
                    ]
                });
            } catch (e) { /* ignore */ }
        }

        closeTransferModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();

        // Re-apply mechanics since equipped items may have changed
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();

        alert(`✅ Item "${item.nome}" transferido com sucesso!`);
    } catch (e) {
        console.error('❌ Erro ao transferir item:', e);
        alert('❌ Erro ao transferir item: ' + e.message);
    }
};

// ===== ITEM FORM MODAL (Create/Edit) =====
window.openItemFormModal = function(title, item, containerId) {
    let existing = document.getElementById('invFormModal');
    if (existing) existing.remove();

    // ====== VALIDAÇÃO E INJEÇÃO AUTOMÁTICA DE DEPENDÊNCIAS ======
    if (!window.state) window.state = {};
    if (!window.state.partesDoCorpo || window.state.partesDoCorpo.length === 0) {
        const racaNome = document.getElementById('selRaca')?.value || (window.state.fields && window.state.fields['raca']);
        let partsToLoad = null;
        if (racaNome && window.RACES && window.RACES[racaNome] && window.RACES[racaNome].partesDoCorpo && window.RACES[racaNome].partesDoCorpo.length > 0) {
            partsToLoad = window.RACES[racaNome].partesDoCorpo;
        } else if (window._systemData && window._systemData.bodyParts) {
            partsToLoad = window._systemData.bodyParts.filter(bp => bp.ehPadrao);
        }
        if (partsToLoad) {
            window.state.partesDoCorpo = JSON.parse(JSON.stringify(partsToLoad));
            if (typeof scheduleAutosave === 'function') scheduleAutosave();
        }
    }
    // =============================================================

    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'invFormModal';

    // Se temos catálogo, mostrar picker com busca
    const catalog = window._inventoryState.catalog || [];
    let catalogHtml = '';
    if (!isEdit && catalog.length > 0) {
        const options = catalog.map(t => ({
            value: t.id,
            label: `${_escHtml(t.nome)} (${t.tipo || '-'})`,
            sub: t.descricao ? t.descricao.substring(0, 60) + (t.descricao.length > 60 ? '...' : '') : ''
        }));
        catalogHtml = `<div class="inv-form-section">
            <label class="inv-form-label">📚 Criar a partir do catálogo</label>
            ${_createSearchableSelectHTML('invCatalogPicker', options, '— Item personalizado —', 'Pesquisar item...')}
        </div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${title || (isEdit ? 'Editar Item' : 'Criar Item')}</span>
            <button class="inv-modal-close" onclick="closeItemFormModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${catalogHtml}
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="invFormName" class="inv-form-input" value="${_escHtml(item?.nome || '')}" placeholder="Nome do item">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tipo</label>
                    <select id="invFormTipo" class="inv-form-select" onchange="_toggleContainerFields()">
                        <option value="Objeto" ${item?.tipo === 'Objeto' ? 'selected' : ''}>📦 Objeto</option>
                        <option value="Arma" ${item?.tipo === 'Arma' ? 'selected' : ''}>⚔️ Arma</option>
                        <option value="Vestimenta" ${item?.tipo === 'Vestimenta' ? 'selected' : ''}>🧥 Vestimenta</option>
                        <option value="Acessório" ${item?.tipo === 'Acessório' ? 'selected' : ''}>💍 Acessório</option>
                        <option value="Projétil" ${item?.tipo === 'Projétil' ? 'selected' : ''}>🎯 Projétil</option>
                        <option value="Container" ${item?.tipo === 'Container' ? 'selected' : ''}>📦 Container</option>
                        <option value="Consumível" ${item?.tipo === 'Consumível' ? 'selected' : ''}>🧪 Consumível</option>
                        <option value="Relíquia" ${item?.tipo === 'Relíquia' ? 'selected' : ''}>✨ Relíquia</option>
                    </select>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Equipável em</label>
                    <select id="invFormEquipavelEm" class="inv-form-select" multiple size="4" onchange="_updateFormaEquiparOptions()">
                        ${(window.state?.partesDoCorpo || []).map(bp => {
                            const selected = Array.isArray(item?.equipavelEm) && item.equipavelEm.includes(bp.id) ? 'selected' : '';
                            return `<option value="${bp.id}" data-segurar="${!!bp.podeSegurar}" data-empunhar="${!!bp.podeEmpunhar}" data-vestir="${!!bp.podeVestir}" data-fixar="${!!bp.podeFixar}" ${selected}>${bp.icone || '🦴'} ${bp.nome}</option>`;
                        }).join('')}
                    </select>
                    <small style="color:var(--muted); font-size: 0.8rem;">Segure Ctrl/Cmd p/ selecionar vários. Deixe vazio para Livre.</small>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Forma de equipar</label>
                    <select id="invFormFormaEquipar" class="inv-form-select">
                        <option value="" ${!item?.formaEquipar ? 'selected' : ''}>— Livre —</option>
                        <option value="segurar" ${item?.formaEquipar === 'segurar' ? 'selected' : ''}>Segurar</option>
                        <option value="empunhar" ${item?.formaEquipar === 'empunhar' ? 'selected' : ''}>Empunhar</option>
                        <option value="vestir" ${item?.formaEquipar === 'vestir' ? 'selected' : ''}>Vestir</option>
                        <option value="fixar" ${item?.formaEquipar === 'fixar' ? 'selected' : ''}>Fixar</option>
                    </select>
                </div>
                <div class="inv-form-group" id="invFormCategoriaArmaGroup" style="display:${item?.tipo === 'Arma' ? 'flex' : 'none'}">
                    <label class="inv-form-label">Categoria da Arma *</label>
                    <select id="invFormCategoriaArma" class="inv-form-select">
                        <option value="" disabled ${!item?.categoriaArma ? 'selected' : ''}>— Selecione —</option>
                        <option value="uma_mao" ${item?.categoriaArma === 'uma_mao' ? 'selected' : ''}>🗡️ Arma de Uma Mão</option>
                        <option value="duas_maos" ${item?.categoriaArma === 'duas_maos' ? 'selected' : ''}>⚔️ Arma de Duas Mãos</option>
                        <option value="versatil" ${item?.categoriaArma === 'versatil' ? 'selected' : ''}>🔄 Arma Versátil</option>
                        <option value="escudo" ${item?.categoriaArma === 'escudo' ? 'selected' : ''}>🛡️ Escudo</option>
                        <option value="distancia" ${item?.categoriaArma === 'distancia' ? 'selected' : ''}>🏹 Arma a Distância</option>
                    </select>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Peso</label>
                    <input type="number" id="invFormPeso" class="inv-form-input" value="${item?.peso || 1}" min="0" step="0.1">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Tamanho</label>
                    <input type="number" id="invFormTamanho" class="inv-form-input" value="${item?.tamanho || 1}" min="0">
                </div>
                <div class="inv-form-group" id="invFormQuantidadeGroup" style="display:${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 'none' : 'flex'}">
                    <label class="inv-form-label">Quantidade</label>
                    <input type="number" id="invFormQuantidade" class="inv-form-input" value="${(item?.tipo === 'Container' || item?.tipo === 'Arma' || item?.ehContainer) ? 1 : (item?.quantidade || 1)}" min="1">
                </div>
                <div id="invContainerFields" class="inv-form-group inv-form-wide" style="display:${(item?.tipo === 'Container' || item?.ehContainer) ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="inv-form-group">
                        <label class="inv-form-label">⚖️ Peso Máximo</label>
                        <input type="number" id="invFormPesoMaximo" class="inv-form-input" value="${item?.pesoMaximoContainer || 10}" min="0" step="0.1" placeholder="Limite de peso interno">
                    </div>
                    <div class="inv-form-group">
                        <label class="inv-form-label">✖️ Multiplicador de Pressão</label>
                        <input type="number" id="invFormMultPressao" class="inv-form-input" value="${item?.multiplicadorPressao || 1}" min="0" step="0.01" placeholder="Ex: 0.5">
                    </div>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">💥 Fórmula de Dano</label>
                    <input type="text" id="invFormFormulaDano" class="inv-form-input" value="${_escHtml(item?.formulaDano || '')}" placeholder="Ex: 1d10 — bônus numéricos vêm dos Valores Derivados">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="invFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição do item">${_escHtml(item?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Imagem</label>
                    ${CampoImagem.html({ id: 'invFormImagem', classe: 'inv-form-input', valor: item?.imagem || item?.imagemUrl || '', pasta: 'imagens/itens' })}
                </div>
                <div class="inv-form-group inv-form-wide" id="invFormMechanicsGroup" style="display:none; margin-top: 8px;">
                    <label class="inv-form-label" style="color: var(--accent-color);">✨ Efeitos do Item</label>
                    <div id="invFormMechanicsPreview" style="background:var(--bg-lighter); padding:10px; border-radius:6px; font-size:0.9rem; color:var(--text-color); border: 1px solid var(--border-color); line-height: 1.4;"></div>
                </div>
            </div>
            <input type="hidden" id="invFormModeloId" value="${item?.modeloId || ''}">
            <input type="hidden" id="invFormContainerId" value="${containerId || ''}">
            ${isEdit ? `<input type="hidden" id="invFormEditId" value="${item.id}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="closeItemFormModal()">Cancelar</button>
            <button class="inv-btn-save" onclick="saveInventoryItemForm()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);

    if (window._updateFormaEquiparOptions) {
        window._updateFormaEquiparOptions();
        // Se for edição, garantir que a forma de equipar antiga está selecionada, se possível
        if (isEdit && item?.formaEquipar) {
            const formaSelect = document.getElementById('invFormFormaEquipar');
            if (formaSelect) formaSelect.value = item.formaEquipar;
        }
    }

    // Initialize searchable select for catalog after DOM insertion
    if (!isEdit && catalog.length > 0) {
        _initSearchableSelect('invCatalogPicker', (value) => {
            fillFromCatalog(value);
        });
    }

    _toggleContainerFields();
};

window.closeItemFormModal = function() {
    document.getElementById('invFormModal')?.remove();
};

window.fillFromCatalog = function(templateId) {
    if (!templateId) return;
    const tpl = window._inventoryState.catalog.find(t => t.id === templateId);
    if (!tpl) return;

    document.getElementById('invFormName').value = tpl.nome || '';
    document.getElementById('invFormTipo').value = tpl.tipo || 'Objeto';
    document.getElementById('invFormPeso').value = tpl.peso || 1;
    document.getElementById('invFormTamanho').value = tpl.tamanho || 1;
    document.getElementById('invFormDesc').value = tpl.descricao || '';
    document.getElementById('invFormImagem').value = tpl.imagemUrl || '';
    const fdEl = document.getElementById('invFormFormulaDano');
    if (fdEl) fdEl.value = tpl.formulaDano || '';
    document.getElementById('invFormModeloId').value = tpl.id;
    document.getElementById('invFormQuantidade').value = 1;

    // Preencher categoria da arma do catálogo
    if (tpl.tipo === 'Arma' && tpl.categoriaArma) {
        const catSel = document.getElementById('invFormCategoriaArma');
        if (catSel) catSel.value = tpl.categoriaArma;
    }

    // Preencher campos de container do catálogo
    if (tpl.ehContainer || tpl.tipo === 'Container') {
        document.getElementById('invFormPesoMaximo').value = tpl.pesoMaximoContainer || 10;
        document.getElementById('invFormMultPressao').value = tpl.multiplicadorPressao || 1;
    }
    
    const equipSelect = document.getElementById('invFormEquipavelEm');
    if (equipSelect) {
        const slots = Array.isArray(tpl.equipavelEm) ? tpl.equipavelEm : (tpl.equipavelEm ? [tpl.equipavelEm] : []);
        Array.from(equipSelect.options).forEach(opt => {
            opt.selected = slots.includes(opt.value);
        });
        if (window._updateFormaEquiparOptions) window._updateFormaEquiparOptions();
    }
    const formaSelect = document.getElementById('invFormFormaEquipar');
    if (formaSelect && tpl.formaEquipar) {
        formaSelect.value = tpl.formaEquipar;
    }
    
    _toggleContainerFields();

    // Mostrar preview das mecânicas, se houver
    const mechGroup = document.getElementById('invFormMechanicsGroup');
    const mechPreview = document.getElementById('invFormMechanicsPreview');
    if (mechGroup && mechPreview) {
        if (tpl.mecanicaIds && tpl.mecanicaIds.length > 0 && window._systemData && window._systemData.mechanics) {
            const previews = [];
            for (const mechId of tpl.mecanicaIds) {
                const mech = window._systemData.mechanics.find(m => m.id === mechId);
                if (mech) {
                    const txt = (typeof generatePreviewText === 'function') ? generatePreviewText(mech) : (mech.previewTexto || mech.descricao || '');
                    if (txt) previews.push(`• ${_escHtml(txt)}`);
                }
            }
            if (previews.length > 0) {
                mechPreview.innerHTML = previews.join('<br>');
                mechGroup.style.display = 'block';
            } else {
                mechGroup.style.display = 'none';
            }
        } else {
            mechGroup.style.display = 'none';
        }
    }
};

window._updateFormaEquiparOptions = function() {
    const equipSelect = document.getElementById('invFormEquipavelEm');
    const formaSelect = document.getElementById('invFormFormaEquipar');
    if (!equipSelect || !formaSelect) return;

    let canSegurar = false;
    let canEmpunhar = false;
    let canVestir = false;
    let canFixar = false;

    if (equipSelect.selectedOptions.length === 0) {
        canSegurar = canEmpunhar = canVestir = canFixar = true;
    } else {
        Array.from(equipSelect.selectedOptions).forEach(opt => {
            if (opt.dataset.segurar === 'true') canSegurar = true;
            if (opt.dataset.empunhar === 'true') canEmpunhar = true;
            if (opt.dataset.vestir === 'true') canVestir = true;
            if (opt.dataset.fixar === 'true') canFixar = true;
        });
    }

    const currentVal = formaSelect.value;
    let html = '<option value="">— Livre —</option>';
    if (canSegurar) html += `<option value="segurar" ${currentVal === 'segurar' ? 'selected' : ''}>Segurar</option>`;
    if (canEmpunhar) html += `<option value="empunhar" ${currentVal === 'empunhar' ? 'selected' : ''}>Empunhar</option>`;
    if (canVestir) html += `<option value="vestir" ${currentVal === 'vestir' ? 'selected' : ''}>Vestir</option>`;
    if (canFixar) html += `<option value="fixar" ${currentVal === 'fixar' ? 'selected' : ''}>Fixar</option>`;

    formaSelect.innerHTML = html;
    if (currentVal && !html.includes(`value="${currentVal}"`)) {
        formaSelect.value = '';
    }
};

window.saveInventoryItemForm = async function() {
    const nome = document.getElementById('invFormName')?.value?.trim();
    if (!nome) { alert('Nome obrigatório'); return; }

    const charId = _getCurrentCharId();
    const user = _getCurrentUser();
    if (!charId || !user) { alert('Erro: personagem não carregado'); return; }

    const containerId = document.getElementById('invFormContainerId')?.value || '';
    const editId = document.getElementById('invFormEditId')?.value || '';

    const tipo = document.getElementById('invFormTipo')?.value || 'Objeto';
    const isContainer = tipo === 'Container';

    // Validar categoria da arma quando tipo é Arma
    const categoriaArma = document.getElementById('invFormCategoriaArma')?.value || null;
    if (tipo === 'Arma' && !categoriaArma) {
        alert('Selecione a categoria da arma'); return;
    }

        const equipSelect = document.getElementById('invFormEquipavelEm');
        const equipavelEm = equipSelect ? Array.from(equipSelect.selectedOptions).map(o => o.value) : [];
        const formaEquipar = document.getElementById('invFormFormaEquipar')?.value || null;

        const itemData = {
            nome,
            tipo,
            categoriaArma: tipo === 'Arma' ? categoriaArma : null,
            peso: parseFloat(document.getElementById('invFormPeso')?.value) || 1,
            tamanho: parseInt(document.getElementById('invFormTamanho')?.value) || 1,
            // Containers e Armas NÃO podem ser "stacados" — quantidade sempre 1
            quantidade: (isContainer || tipo === 'Arma') ? 1 : Math.max(1, parseInt(document.getElementById('invFormQuantidade')?.value) || 1),
            descricao: document.getElementById('invFormDesc')?.value?.trim() || '',
            formulaDano: document.getElementById('invFormFormulaDano')?.value?.trim() || '',
            imagem: document.getElementById('invFormImagem')?.value?.trim() || '',
            modeloId: document.getElementById('invFormModeloId')?.value || null,
            equipavelEm: equipavelEm.length > 0 ? equipavelEm : null,
            formaEquipar,
        characterId: charId,
        ownerUid: user.uid,
        equipado: false,
        slotAnatomico: null,
        estadoEquip: null,
        maosUsadas: null,
        parentItemId: containerId || null,
        criadoPor: window.isCreator ? 'criador' : (window.isMestre ? 'mestre' : 'jogador'),
        lastModified: new Date().toISOString(),
        // Campos de container
        ehContainer: isContainer,
        pesoMaximoContainer: isContainer ? (parseFloat(document.getElementById('invFormPesoMaximo')?.value) || 10) : null,
        multiplicadorPressao: isContainer ? (parseFloat(document.getElementById('invFormMultPressao')?.value) || 1) : null,
        pressaoBase: parseFloat(document.getElementById('invFormPeso')?.value) || 1
    };

    // Herdar campos do template se modeloId existe
    if (itemData.modeloId) {
        const tpl = window._inventoryState.catalog.find(t => t.id === itemData.modeloId);
        if (tpl) {
            itemData.pressaoBase = itemData.peso;
            itemData.ehContainer = tpl.ehContainer || false;
            itemData.multiplicadorPressao = tpl.multiplicadorPressao || 1;
            itemData.capacidadeContainer = tpl.capacidadeContainer || 10;
        }
    }

    try {
        if (editId) {
            await _firestoreSetDoc('items', editId, itemData);
            const idx = window._inventoryState.items.findIndex(i => i.id === editId);
            if (idx >= 0) window._inventoryState.items[idx] = { ...window._inventoryState.items[idx], ...itemData };
        } else {
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await _firestoreSetDoc('items', newId, itemData);
            window._inventoryState.items.push({ id: newId, ...itemData });
        }
        closeItemFormModal();
        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();
    } catch (e) {
        console.error('❌ Erro ao salvar item:', e);
        alert('Erro ao salvar item: ' + e.message);
    }
};

// ===== LEGACY COMPAT: Keep old functions to not break existing calls =====
// Note: wC, aC, pC, cC, iC are already declared in app.js (same global scope)
function addWeapon() {} // No-op: replaced by inventory system
function addArmor() {}
function addProjectile() {}
function addInventoryItem() {} // No-op: replaced by inventory system

// ===== SEARCHABLE SELECT UTILITY =====
/**
 * Creates a searchable select dropdown component.
 * @param {string} containerId - ID for the container div
 * @param {Array} options - Array of { value, label, sub? } objects
 * @param {Function} onChange - Callback(value) when option is selected
 * @param {string} placeholder - Placeholder text
 * @param {string} defaultLabel - Label for the default/empty option
 * @returns {string} HTML string for the component
 */
function _createSearchableSelectHTML(containerId, options, defaultLabel, placeholder) {
    const optionsHtml = options.map(opt =>
        `<div class="searchable-select-option" data-value="${_escHtml(opt.value)}">
            <div>${_escHtml(opt.label)}</div>
            ${opt.sub ? `<div class="searchable-select-option-sub">${_escHtml(opt.sub)}</div>` : ''}
        </div>`
    ).join('');

    return `<div class="searchable-select" id="${containerId}">
        <input type="text" class="searchable-select-input" placeholder="${_escHtml(placeholder || 'Selecionar...')}" readonly>
        <span class="searchable-select-arrow">▼</span>
        <div class="searchable-select-dropdown">
            <div class="searchable-select-search">
                <input type="text" placeholder="🔍 Pesquisar..." autocomplete="off">
            </div>
            <div class="searchable-select-default" data-value="">${_escHtml(defaultLabel || '— Nenhum —')}</div>
            <div class="searchable-select-options-list">
                ${optionsHtml}
            </div>
            <div class="searchable-select-empty" style="display:none">Nenhum resultado encontrado</div>
        </div>
    </div>`;
}

/**
 * Initializes the searchable select behavior after it's been added to the DOM.
 * @param {string} containerId - ID of the container div
 * @param {Function} onChange - Callback(value) when an option is selected
 */
function _initSearchableSelect(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    const arrow = container.querySelector('.searchable-select-arrow');
    const dropdown = container.querySelector('.searchable-select-dropdown');
    const searchInput = dropdown.querySelector('.searchable-select-search input');
    const optionsList = container.querySelector('.searchable-select-options-list');
    const emptyMsg = container.querySelector('.searchable-select-empty');
    const defaultOpt = container.querySelector('.searchable-select-default');

    function toggleOpen(open) {
        if (open) {
            container.classList.add('open');
            searchInput.value = '';
            _filterOptions('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            container.classList.remove('open');
        }
    }

    function _filterOptions(query) {
        const q = query.toLowerCase().trim();
        const options = optionsList.querySelectorAll('.searchable-select-option');
        let visible = 0;
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const match = !q || text.includes(q);
            opt.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        if (defaultOpt) defaultOpt.style.display = q ? 'none' : '';
        emptyMsg.style.display = (visible === 0 && q) ? '' : 'none';
    }

    function selectOption(value, label) {
        input.value = label || '';
        container.dataset.selectedValue = value || '';
        toggleOpen(false);
        if (onChange) onChange(value);
    }

    // Toggle dropdown on input click
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpen(!container.classList.contains('open'));
    });

    // Search filtering
    searchInput.addEventListener('input', () => {
        _filterOptions(searchInput.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // Default option click
    if (defaultOpt) {
        defaultOpt.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption('', '');
        });
    }

    // Option clicks
    optionsList.querySelectorAll('.searchable-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            const label = opt.querySelector('div').textContent;
            selectOption(val, label);
        });
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => toggleOpen(false));
    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// ===== CONDITION SYSTEM =====

/**
 * Opens the condition form modal (replaces old inline addCondition).
 * Similar UX to openItemFormModal.
 */
function addCondition() {
    openConditionFormModal('Criar Condição');
}

function openConditionFormModal(title, condition, editIndex) {
    let existing = document.getElementById('condFormModal');
    if (existing) existing.remove();

    const isEdit = editIndex != null;
    const modal = document.createElement('div');
    modal.className = 'inv-modal active';
    modal.id = 'condFormModal';

    // Build template picker from system data
    const templates = (window._systemData?.conditions || []).filter(c => c.publicado !== false);
    let templatePickerHtml = '';
    if (!isEdit && templates.length > 0) {
        const options = templates.map(t => ({
            value: t.id,
            label: `${t.icone || '💀'} ${t.nome}`,
            sub: t.duracao ? `Duração: ${t.duracao}` : ''
        }));
        templatePickerHtml = `<div class="inv-form-section">
            <label class="inv-form-label">📚 Criar a partir de modelo (Painel do Mestre)</label>
            ${_createSearchableSelectHTML('condTemplatePicker', options, '— Condição personalizada —', 'Pesquisar condição...')}
        </div>`;
    }

    modal.innerHTML = `<div class="inv-modal-content" style="max-width:600px">
        <div class="inv-modal-header">
            <span class="inv-modal-title">${title || (isEdit ? 'Editar Condição' : 'Criar Condição')}</span>
            <button class="inv-modal-close" onclick="closeConditionFormModal()">✕</button>
        </div>
        <div class="inv-modal-body">
            ${templatePickerHtml}
            <div class="inv-form-grid">
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Nome *</label>
                    <input type="text" id="condFormNome" class="inv-form-input" value="${_escHtml(condition?.nome || '')}" placeholder="Nome da condição">
                </div>
                <div class="inv-form-group inv-form-wide">
                    <label class="inv-form-label">Descrição</label>
                    <textarea id="condFormDesc" class="inv-form-textarea" rows="3" placeholder="Descrição da condição">${_escHtml(condition?.descricao || '')}</textarea>
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Atual</label>
                    <input type="text" id="condFormTempoAtual" class="inv-form-input" value="${_escHtml(condition?.tempoAtual || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">⏱️ Tempo Restante</label>
                    <input type="text" id="condFormTempoRestante" class="inv-form-input" value="${_escHtml(condition?.tempoRestante || '')}" placeholder="0">
                </div>
                <div class="inv-form-group">
                    <label class="inv-form-label">Ícone / Emoji</label>
                    <input type="text" id="condFormIcone" class="inv-form-input" value="${_escHtml(condition?.icone || '💀')}" placeholder="💀" maxlength="4">
                </div>
            </div>
            <input type="hidden" id="condFormModeloId" value="${condition?.modeloId || ''}">
            <input type="hidden" id="condFormMechIds" value="${(condition?.efeitoMecanicaIds || []).join(',')}">
            ${isEdit ? `<input type="hidden" id="condFormEditIndex" value="${editIndex}">` : ''}
        </div>
        <div class="inv-modal-footer">
            <button class="inv-btn-cancel" onclick="closeConditionFormModal()">Cancelar</button>
            <button class="inv-btn-save" onclick="saveConditionForm()">💾 Salvar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    // Initialize searchable select after DOM insertion
    if (!isEdit && templates.length > 0) {
        _initSearchableSelect('condTemplatePicker', (value) => {
            _fillConditionFromTemplate(value);
        });
    }
}

window.closeConditionFormModal = function() {
    document.getElementById('condFormModal')?.remove();
};

function _fillConditionFromTemplate(templateId) {
    if (!templateId) {
        // Reset to empty
        document.getElementById('condFormNome').value = '';
        document.getElementById('condFormDesc').value = '';
        document.getElementById('condFormTempoAtual').value = '';
        document.getElementById('condFormTempoRestante').value = '';
        document.getElementById('condFormIcone').value = '💀';
        document.getElementById('condFormModeloId').value = '';
        document.getElementById('condFormMechIds').value = '';
        return;
    }

    const tpl = (window._systemData?.conditions || []).find(c => c.id === templateId);
    if (!tpl) return;

    document.getElementById('condFormNome').value = tpl.nome || '';
    document.getElementById('condFormDesc').value = tpl.descricao || '';
    document.getElementById('condFormTempoAtual').value = '';
    document.getElementById('condFormTempoRestante').value = tpl.duracao || '';
    document.getElementById('condFormIcone').value = tpl.icone || '💀';
    document.getElementById('condFormModeloId').value = tpl.id;
    document.getElementById('condFormMechIds').value = (tpl.efeitoMecanicaIds || []).join(',');
}

window.saveConditionForm = function() {
    const nome = document.getElementById('condFormNome')?.value?.trim();
    if (!nome) { alert('Nome obrigatório'); return; }

    const condData = {
        nome,
        descricao: document.getElementById('condFormDesc')?.value?.trim() || '',
        tempoAtual: document.getElementById('condFormTempoAtual')?.value?.trim() || '',
        tempoRestante: document.getElementById('condFormTempoRestante')?.value?.trim() || '',
        icone: document.getElementById('condFormIcone')?.value?.trim() || '💀',
        modeloId: document.getElementById('condFormModeloId')?.value || null,
        efeitoMecanicaIds: (document.getElementById('condFormMechIds')?.value || '').split(',').filter(Boolean)
    };

    const editIndexEl = document.getElementById('condFormEditIndex');
    if (editIndexEl) {
        const idx = parseInt(editIndexEl.value);
        if (idx >= 0 && idx < state.conditions.length) {
            state.conditions[idx] = condData;
        }
    } else {
        state.conditions.push(condData);
    }

    closeConditionFormModal();
    renderConditions();
    _triggerConditionMechanicsUpdate();
    scheduleAutosave();
};

window.removeCondition = function(idx) {
    if (idx >= 0 && idx < state.conditions.length) {
        state.conditions.splice(idx, 1);
        renderConditions();
        _triggerConditionMechanicsUpdate();
        scheduleAutosave();
    }
};

window.editCondition = function(idx) {
    if (idx >= 0 && idx < state.conditions.length) {
        openConditionFormModal('Editar Condição', state.conditions[idx], idx);
    }
};

/**
 * Renders all active conditions as cards in #conditionsContainer.
 */
function renderConditions() {
    const container = document.getElementById('conditionsContainer');
    if (!container) return;

    const conditions = state.conditions || [];

    // Miniaturas no topo da aba Combate acompanham a lista completa
    if (typeof renderCombatConditionTags === 'function') renderCombatConditionTags();

    if (conditions.length === 0) {
        container.innerHTML = `<div class="cond-empty">
            <span class="cond-empty-icon">💀</span>
            <span>Nenhuma condição ativa</span>
            <small style="color:var(--muted)">Adicione condições pelo botão abaixo</small>
        </div>`;
        return;
    }

    let html = '';
    conditions.forEach((cond, idx) => {
        const icon = cond.icone || '💀';
        const nome = _escHtml(cond.nome || 'Sem nome');
        const desc = cond.descricao ? `<div class="cond-card-desc">${_escHtml(cond.descricao)}</div>` : '';

        // Mechanic preview tags
        let mechHtml = '';
        const mechIds = cond.efeitoMecanicaIds || [];
        if (mechIds.length > 0) {
            const tags = [];
            for (const mid of mechIds) {
                const m = window._systemData?.mechanics?.find(x => x.id === mid);
                if (m && typeof generatePreviewText === 'function') {
                    tags.push(`<span class="cond-mech-tag">${_escHtml(generatePreviewText(m))}</span>`);
                }
            }
            if (tags.length > 0) {
                mechHtml = `<div class="cond-card-mechs">
                    <span class="cond-card-mechs-label">⚙️ Mecânicas:</span>
                    ${tags.join('')}
                </div>`;
            }
        }

        // Time inputs
        const tempoAtual = _escHtml(cond.tempoAtual || '');
        const tempoRestante = _escHtml(cond.tempoRestante || '');
        const timeHtml = `<div class="cond-card-time">
            <span class="cond-card-time-label">⏱️ Tempo:</span>
            <input type="text" class="cond-time-input" value="${tempoAtual}" placeholder="0"
                data-cond-idx="${idx}" data-cond-field="tempoAtual"
                oninput="updateConditionTime(${idx}, 'tempoAtual', this.value)">
            <span class="cond-time-sep">/</span>
            <input type="text" class="cond-time-input" value="${tempoRestante}" placeholder="0"
                data-cond-idx="${idx}" data-cond-field="tempoRestante"
                oninput="updateConditionTime(${idx}, 'tempoRestante', this.value)">
        </div>`;

        html += `<div class="cond-card">
            <div class="cond-card-header">
                <span class="cond-card-icon">${icon}</span>
                <span class="cond-card-name">${nome}</span>
                <button class="cond-card-remove no-print" onclick="removeCondition(${idx})" title="Remover condição">✕</button>
            </div>
            ${desc}
            ${mechHtml}
            ${timeHtml}
        </div>`;
    });

    container.innerHTML = html;
}

window.updateConditionTime = function(idx, field, value) {
    if (idx >= 0 && idx < state.conditions.length) {
        state.conditions[idx][field] = value;
        if (typeof renderCombatConditionTags === 'function') renderCombatConditionTags();
        scheduleAutosave();
    }
};

function _triggerConditionMechanicsUpdate() {
    if (typeof applyAllRaceMechanics === 'function') {
        const raca = document.getElementById('selRaca')?.value;
        applyAllRaceMechanics(raca);
    }
    if (typeof recalcAll === 'function') recalcAll();
    if (typeof recalcMainTests === 'function') recalcMainTests();
}

// ===== TOGGLE CONTAINER FIELDS =====
window._toggleContainerFields = function() {
    const tipo = document.getElementById('invFormTipo')?.value;
    const fields = document.getElementById('invContainerFields');
    if (fields) {
        fields.style.display = tipo === 'Container' ? 'grid' : 'none';
    }
    // Mostrar/ocultar categoria da arma
    const armaGroup = document.getElementById('invFormCategoriaArmaGroup');
    if (armaGroup) {
        armaGroup.style.display = tipo === 'Arma' ? 'flex' : 'none';
    }
    // Containers e Armas NÃO podem ser "stacados" — ocultar campo de quantidade
    const qtyGroup = document.getElementById('invFormQuantidadeGroup');
    if (qtyGroup) {
        qtyGroup.style.display = (tipo === 'Container' || tipo === 'Arma') ? 'none' : 'flex';
    }
    // Resetar quantidade para 1 quando for Container ou Arma
    if (tipo === 'Container' || tipo === 'Arma') {
        const qtyInput = document.getElementById('invFormQuantidade');
        if (qtyInput) qtyInput.value = 1;
    }
    
    // Atualizar opções de slot restrito
    const slotSelect = document.getElementById('invFormSlotRestrito');
    if (slotSelect) {
        let initialValStr = slotSelect.dataset.value || '[]';
        let initialVal = [];
        try { initialVal = JSON.parse(initialValStr); } catch(e) {}
        if (!Array.isArray(initialVal)) initialVal = initialVal ? [initialVal] : [];
        
        let currentVals = Array.from(slotSelect.selectedOptions).map(o => o.value);
        let targetVals = currentVals.length > 0 ? currentVals : initialVal;
        
        let html = '';
        const bodySlots = typeof _getCharacterBodySlots === 'function' ? _getCharacterBodySlots() : {};
        for (const [key, def] of Object.entries(bodySlots)) {
            if (def.accepts && def.accepts.includes(tipo)) {
                html += `<option value="${key}">${def.label}</option>`;
            }
        }
        slotSelect.innerHTML = html;
        
        // Restore previous values
        for (let i = 0; i < slotSelect.options.length; i++) {
            if (targetVals.includes(slotSelect.options[i].value)) {
                slotSelect.options[i].selected = true;
            }
        }
        slotSelect.dataset.value = '[]'; // Clear initial value after first use
    }
};

// ===== UTILITY =====
function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== MERGE / STACK SYSTEM =====
/**
 * Mescla itens idênticos no inventário, somando suas quantidades.
 * Itens são considerados "idênticos" se possuem o mesmo:
 *   nome, tipo, modeloId, peso, tamanho, descricao, imagem, parentItemId, equipado.
 * Containers e Armas NUNCA são mesclados (não podem ser stacados).
 * Retorna a quantidade de merges realizados.
 */
window.mergeInventoryItems = async function() {
    const charId = _getCurrentCharId();
    if (!charId) { alert('Erro: personagem não carregado'); return 0; }

    const items = window._inventoryState.items;
    if (items.length < 2) {
        alert('ℹ️ Não há itens suficientes para mesclar.');
        return 0;
    }

    // Chave de identidade para comparar itens
    function _itemKey(item) {
        return [
            (item.nome || '').trim().toLowerCase(),
            (item.tipo || '').toLowerCase(),
            item.modeloId || '',
            parseFloat(item.peso || 0),
            parseInt(item.tamanho || 0),
            (item.descricao || '').trim().toLowerCase(),
            (item.imagem || item.imagemUrl || '').trim(),
            item.parentItemId || '__root__',
            !!item.equipado
        ].join('||');
    }

    // Agrupar por chave — excluir Containers e Armas (nunca mesclam)
    const groups = {};
    for (const item of items) {
        if (item.ehContainer || item.tipo === 'Container' || item.tipo === 'Arma') continue;
        const key = _itemKey(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    }

    // Filtrar apenas grupos com 2+ itens
    const mergeableGroups = Object.values(groups).filter(g => g.length > 1);
    if (mergeableGroups.length === 0) {
        alert('ℹ️ Nenhum item idêntico encontrado para mesclar.');
        return 0;
    }

    // Confirmar
    const totalMerges = mergeableGroups.reduce((sum, g) => sum + g.length - 1, 0);
    const groupNames = mergeableGroups.map(g => `"${g[0].nome}" (${g.length} → 1)`).join('\n');
    if (!confirm(`🔀 Mesclar ${totalMerges} item(ns) em ${mergeableGroups.length} stack(s)?\n\n${groupNames}`)) {
        return 0;
    }

    let mergeCount = 0;
    try {
        for (const group of mergeableGroups) {
            // O primeiro item do grupo é o "sobrevivente"
            const survivor = group[0];
            let totalQty = 0;
            for (const item of group) {
                totalQty += Math.max(1, parseInt(item.quantidade) || 1);
            }

            // Atualizar quantidade do sobrevivente
            await _firestoreSetDoc('items', survivor.id, {
                quantidade: totalQty,
                lastModified: new Date().toISOString()
            });
            survivor.quantidade = totalQty;

            // Excluir os demais
            for (let i = 1; i < group.length; i++) {
                await _firestoreDeleteDoc('items', group[i].id);
                window._inventoryState.items = window._inventoryState.items.filter(x => x.id !== group[i].id);
                mergeCount++;
            }
        }

        renderEquippedItems();
        renderInventoryTab();
        recalcInventoryPressure();

        // Re-apply mechanics
        if (typeof applyAllRaceMechanics === 'function') {
            const raca = document.getElementById('selRaca')?.value;
            applyAllRaceMechanics(raca);
        }
        if (typeof recalcAll === 'function') recalcAll();

        alert(`✅ ${mergeCount} item(ns) mesclado(s) com sucesso!`);
    } catch (e) {
        console.error('❌ Erro ao mesclar itens:', e);
        alert('❌ Erro ao mesclar itens: ' + e.message);
    }
    return mergeCount;
};

// ===== EXPOSE GLOBALLY =====
window.loadCharacterItems = loadCharacterItems;
window.loadInventoryCatalog = loadInventoryCatalog;
window.applyEquippedItemsMechanics = applyEquippedItemsMechanics;
window.recalcInventoryPressure = recalcInventoryPressure;
window.renderEquippedItems = renderEquippedItems;
window.renderInventoryTab = renderInventoryTab;
window.openItemFormModal = openItemFormModal;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.transferItem = transferItem;
window.mergeInventoryItems = mergeInventoryItems;
window.renderConditions = renderConditions;
window.addCondition = addCondition;
window.openConditionFormModal = openConditionFormModal;
