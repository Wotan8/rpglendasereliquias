// =============================================
// NPC SYSTEM DATA — Carrega os registros do Painel de Criador
// (system/data/*) para uso na Ficha de NPC v2.
// Coexiste com window._systemData usado por outros módulos do painel.
// =============================================
import { db, collection, getDocs } from './firebase-config.js';

const COLLECTIONS = [
    'races', 'classes', 'tribes', 'peculiarities',
    'mechanics', 'derivedValues', 'vitalStats', 'skills'
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

        await Promise.all(COLLECTIONS.map(async (col) => {
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
                .slice().sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
                .map(dv => ({
                    id: dv.id,
                    key: dv.key || dv.id,
                    nome: dv.nome,
                    mecanicaIds: dv.mecanicaIds || [],
                    campoAtual: dv.campoAtual || false,
                    todoPersonagem: dv.todoPersonagem || false
                })),
            vitalStats: (sd.vitalStats || [])
                .slice().sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
                .map(vs => ({
                    id: vs.id,
                    key: vs.key || vs.id,
                    nome: vs.nome,
                    icone: vs.icone || '❤️',
                    mecanicaIds: vs.mecanicaIds || []
                })),
        };

        sys.racesById = byId(sys.races);
        sys.classesById = byId(sys.classes);
        sys.tribesById = byId(sys.tribes);
        sys.pecsById = byId(sys.peculiarities);
        sys.mechsById = byId(sys.mechanics);
        sys.racesByNome = byNome(sys.races);
        sys.classesByNome = byNome(sys.classes);
        sys.tribesByNome = byNome(sys.tribes);
        sys.norm = norm;

        window._npcSys = sys;
        console.log('✅ [NPC v2] Registros carregados:', {
            races: sys.races.length, classes: sys.classes.length, tribes: sys.tribes.length,
            peculiarities: sys.peculiarities.length, mechanics: sys.mechanics.length,
            derivedValues: sys.derivedValues.length, vitalStats: sys.vitalStats.length
        });
        return sys;
    })();

    try { return await _loading; }
    finally { _loading = null; }
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
