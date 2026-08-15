// =============================================
// NPC SYSTEM DATA — Carrega os registros do Painel de Criador
// (system/data/*) para uso na Ficha de NPC v2.
// Coexiste com window._systemData usado por outros módulos do painel.
// =============================================
import { db, collection, getDocs } from './firebase-config.js';

const COLLECTIONS = [
    'races', 'classes', 'tribes', 'peculiarities',
    'mechanics', 'derivedValues', 'vitalStats', 'skills', 'classModules',
    'equipment', 'bodyParts'
];

let _loading = null;

/**
 * Garante que os registros necessários para a ficha de NPC estão carregados.
 * Retorna um objeto "sys" com listas + índices por id e por nome.
 */
export async function ensureNpcSystemData() {
    if (window._npcSys && window._npcSys.loaded) return window._npcSys;
    if (_loading) return _loading;

    _loading = (async () => {
        if (!window._systemData) window._systemData = {};

        // allSettled e não all: uma coleção que falhe (rede caindo, regra de
        // leitura, cache offline frio) derrubava a carga INTEIRA, e quem
        // consome ficava sem registro nenhum — no Tabuleiro isso apagava custo
        // e mira de todas as habilidades de uma vez. Agora o que chegou vale, e
        // o que faltou é registrado para a próxima chamada tentar de novo.
        let faltou = false;
        const r = await Promise.allSettled(COLLECTIONS.map(async (col) => {
            // Reaproveita coleções já carregadas por outros módulos do painel
            if (Array.isArray(window._systemData[col]) && window._systemData[col].length > 0) return;
            const snap = await getDocs(collection(db, `system/data/${col}`));
            const arr = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) arr.push({ id: d.id, ...data });
            });
            window._systemData[col] = arr;
        }));
        r.forEach((x, i) => {
            if (x.status === 'rejected') {
                faltou = true;
                console.warn(`⚠️ registro do sistema: "${COLLECTIONS[i]}" não carregou`, x.reason);
            }
        });

        const sd = window._systemData;
        const byId = arr => { const m = {}; (arr || []).forEach(x => m[x.id] = x); return m; };
        const norm = s => String(s || '').trim().toLowerCase();
        const byNome = arr => { const m = {}; (arr || []).forEach(x => { if (x.nome) m[norm(x.nome)] = x; }); return m; };

        const sys = {
            loaded: true,
            races: sd.races || [],
            classes: sd.classes || [],
            tribes: sd.tribes || [],
            peculiarities: sd.peculiarities || [],
            mechanics: sd.mechanics || [],
            skills: sd.skills || [],
            derivedValues: (sd.derivedValues || [])
                .slice().sort((a, b) => (Number(a.blocoOrdem) || 999) - (Number(b.blocoOrdem) || 999)
                                     || (a.ordem || 99) - (b.ordem || 99))
                .map(dv => ({
                    id: dv.id,
                    key: dv.key || dv.id,
                    nome: dv.nome,
                    descricao: dv.descricao,
                    icone: dv.icone || '📊',
                    prefixo: dv.prefixo || '',
                    sufixo: dv.sufixo || '',
                    mecanicaIds: dv.mecanicaIds || [],
                    campoAtual: dv.campoAtual || false,
                    todoPersonagem: dv.todoPersonagem || false,
                    blocoId: dv.blocoId || 'geral',
                    blocoNome: dv.blocoNome || 'Geral',
                    blocoOrdem: Number(dv.blocoOrdem) || 999,
                    // '' = global | 'coluna' = por item | 'dano' = concatena no dano
                    escopoItem: dv.escopoItem || '',
                    // usados pela janela de combate do Tabuleiro
                    statusCombate: dv.statusCombate || false,
                    arredondaMesa: dv.arredondaMesa || false,
                    espelhaVD: dv.espelhaVD || ''
                })),
            vitalStats: (sd.vitalStats || [])
                .slice().sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
                .map(vs => ({
                    id: vs.id,
                    key: vs.key || vs.id,
                    nome: vs.nome,
                    descricao: vs.descricao,
                    icone: vs.icone || '❤️',
                    mecanicaIds: vs.mecanicaIds || []
                })),
            classModules: (sd.classModules || []).map(normalizeClassModule).filter(Boolean),
            equipment: sd.equipment || [],
            bodyParts: sd.bodyParts || [],
        };

        sys.racesById = byId(sys.races);
        sys.classModulesById = byId(sys.classModules);
        sys.classesById = byId(sys.classes);
        sys.tribesById = byId(sys.tribes);
        sys.pecsById = byId(sys.peculiarities);
        sys.mechsById = byId(sys.mechanics);
        sys.racesByNome = byNome(sys.races);
        sys.classesByNome = byNome(sys.classes);
        sys.tribesByNome = byNome(sys.tribes);
        sys.norm = norm;

        // Carga incompleta não vira cache definitivo: `loaded` false faz a
        // próxima chamada refazer o que faltou (as coleções que já vieram
        // ficam em window._systemData e não são relidas).
        sys.loaded = !faltou;
        window._npcSys = sys;
        return sys;
    })();

    try { return await _loading; }
    finally { _loading = null; }
}

/**
 * Normaliza a definição de um Módulo de Classe (registro OU objeto inline
 * legado do campo modulosDaClasse) para o formato usado pela Ficha de NPC.
 */
export function normalizeClassModule(mod) {
    if (!mod || typeof mod !== 'object') return null;
    return {
        ...mod,
        id: mod.id || ('mod_' + String(mod.titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '_')),
        tipo: mod.tipo || 'lista',
        titulo: mod.titulo || 'Módulo',
        icone: mod.icone || '📦',
        schema: Array.isArray(mod.schema) ? mod.schema : [],
        itensPredefinidos: Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [],
        permitirCriacaoJogador: mod.permitirCriacaoJogador !== false
    };
}

/**
 * Módulos de Classe atrelados a uma classe do registro.
 * Suporta o formato novo (IDs referenciando a coleção classModules)
 * e o formato legado (objetos inline em modulosDaClasse).
 * Retorna definições normalizadas.
 */
export function modulosDaClasseNpc(classeRefId, sys) {
    const cls = classeRefId ? sys.classesById[classeRefId] : null;
    if (!cls || !Array.isArray(cls.modulosDaClasse)) return [];
    return cls.modulosDaClasse.map(entry => {
        if (typeof entry === 'string') return sys.classModulesById[entry] || null;
        if (entry && typeof entry === 'object') return normalizeClassModule(entry);
        return null;
    }).filter(Boolean);
}

/**
 * Resolve o vínculo de módulo salvo no NPC ({refId, snapshot}) para a
 * definição atual do registro (preferida) ou o snapshot salvo.
 */
export function resolveNpcClassModule(vinc, sys) {
    if (!vinc) return null;
    if (vinc.refId && sys.classModulesById[vinc.refId]) return sys.classModulesById[vinc.refId];
    return vinc.snapshot ? normalizeClassModule(vinc.snapshot) : null;
}

/**
 * Peculiaridades que uma origem (raça/classe/tribo) concede, já resolvidas.
 * Retorna [{ refId, nivel, fonte }]
 */
export function pecsDaOrigem(tipo, refId, sys) {
    if (!refId) return [];
    let docRef = null, campo = 'peculiaridadeIds';
    if (tipo === 'raca') docRef = sys.racesById[refId];
    else if (tipo === 'tribo') docRef = sys.tribesById[refId];
    else if (tipo === 'classe') { docRef = sys.classesById[refId]; campo = 'bonusIniciais'; }
    if (!docRef || !Array.isArray(docRef[campo])) return [];

    return docRef[campo].map(pd => {
        const isObj = typeof pd === 'object' && pd !== null;
        const pecId = isObj ? pd.id : pd;
        if (!sys.pecsById[pecId]) return null;
        return { refId: pecId, nivel: isObj ? (pd.nivelInicial || 1) : 1, fonte: tipo };
    }).filter(Boolean);
}
