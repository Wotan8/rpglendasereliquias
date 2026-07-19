/* ═══════════════════════════════════════════════════════════
   wb-ecosystem.js — Ponte com o Painel do Criador (mecânica)
   ────────────────────────────────────────────────────────────
   O Worldbuilding cuida da LORE; o Painel do Criador cuida das
   MECÂNICAS. As duas metades descrevem as MESMAS entidades.
   Este módulo carrega, uma vez, os dados mecânicos e os deixa
   disponíveis para enriquecer os modais e o @ do editor:

     system/data/races      → Raças (lore + mecânica)
     system/data/classes    → Classes
     system/data/tribes      → Tribos mecânicas (Criador)
     char                    → Personagens de jogador (raça/classe/tribo)

   Cruzamento de nomes: em `char`, raça/classe/tribo são gravadas
   pelo NOME (ex.: "Elorin"), casando com o campo `nome` dos docs
   de system/data — então ligamos por nome, com fallback por id.
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs } from './firebase-config.js';
import { WB } from './wb-utils.js';

export const Eco = (() => {
    const cache = { races: [], classes: [], tribesMech: [], chars: [], lineages: [], loaded: false };

    async function safeList(path, q) {
        try {
            const ref = collection(db, path);
            const snap = await getDocs(q ? q(ref) : ref);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.warn(`[eco] falha ao ler ${path}`, e); return []; }
    }

    async function load() {
        if (cache.loaded) return cache;
        const [races, classes, tribes, chars, lineages] = await Promise.all([
            safeList('system/data/races'),
            safeList('system/data/classes'),
            safeList('system/data/tribes'),
            // TODOS os personagens de jogador (as regras permitem leitura a logados);
            // o Mestre precisa ver os personagens de todos para montar linhagens.
            safeList('char'),
            safeList('worldbuilding-lineages'),
        ]);
        cache.races = races;
        cache.classes = classes;
        cache.tribesMech = tribes;
        // Personagens de jogador guardam os dados dentro de `fields` (nome, raça,
        // classe…) e a imagem em `charImg`. Normalizamos aqui, uma única vez,
        // para que TODOS os consumidores (grafos, editor, busca, linhagens)
        // enxerguem `nome`, `raca`, `classe`, `nivel` e `imagem` no topo.
        cache.chars = chars.map(normalizeChar);
        cache.lineages = lineages;
        cache.loaded = true;
        return cache;
    }

    /* Achata os campos do personagem de jogador para o topo do objeto. */
    function normalizeChar(c) {
        const f = c.fields || {};
        return {
            ...c,
            nome: f.nome || c.nome || c.nomePersonagem || '',
            raca: f.raca || c.raca || '',
            classe: f.classe || c.classe || '',
            tribo: f.tribo || c.tribo || '',
            nivel: f.nivel || c.nivel || '',
            imagem: c.charImg || c.imagem || c.imagemUrl || f.imagem || '',
        };
    }

    async function reloadLineages() {
        cache.lineages = await safeList('worldbuilding-lineages');
        return cache.lineages;
    }

    const byName = (list, name) =>
        !name ? null : list.find(x => (x.nome || '').toLowerCase() === String(name).toLowerCase()) || null;

    /* Dado um NPC/char da lore, devolve o "dossiê mecânico" casado. */
    function mechanicsFor(entry) {
        const raca = byName(cache.races, entry?.raca || entry?.racaNome)
            || cache.races.find(r => r.id === entry?.racaId) || null;
        const classe = byName(cache.classes, entry?.classe || entry?.classeNome)
            || cache.classes.find(c => c.id === entry?.classeId) || null;
        const tribo = byName(cache.tribesMech, entry?.tribo || entry?.triboNome)
            || cache.tribesMech.find(t => t.id === entry?.triboId) || null;
        return { raca, classe, tribo };
    }

    /* Personagens de jogador de uma dada raça/classe/tribo (por nome). */
    function charsOf(kind, name) {
        return cache.chars.filter(c => (c[kind] || '').toLowerCase() === String(name).toLowerCase());
    }

    return {
        load, reloadLineages,
        get races() { return cache.races; },
        get classes() { return cache.classes; },
        get tribesMech() { return cache.tribesMech; },
        get chars() { return cache.chars; },
        normalizeChar,
        get lineages() { return cache.lineages; },
        mechanicsFor, charsOf, byName,
    };
})();
