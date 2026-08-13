// =============================================
// SLOTS DE EQUIPAMENTO — lógica pura de ocupação
// Fica em shared/ porque três inventários equipam do MESMO jeito: ficha do
// personagem (inventory.js), aliados (aliado-inventario.js) e NPCs do painel do
// mestre (npc-inventario.js). Cada um com a sua cópia, uma espada de duas mãos
// passaria a ocupar 1 slot num lugar e 2 no outro sem ninguém perceber.
//
// Script CLÁSSICO de propósito: dois dos três consumidores não são módulos, e
// script clássico sempre executa antes de módulo — a ordem fica garantida.
// Sem Firebase e sem DOM: testável fora do navegador (equip-slots.test.mjs).
//
// Um item ocupa:
//   slotAnatomico   → o slot principal, onde ele aparece na ficha
//   slotsOcupados[] → os adicionais, declarados em `slotsAdicionais` no catálogo
//   slotAnatomico2  → formato legado (uma única mão extra), ainda no banco
// =============================================
(function (raiz) {
    'use strict';

    /** Todos os slots que um item ocupa: principal + adicionais + o legado. */
    function slotsDoItem(item) {
        if (!item) return [];
        const extras = Array.isArray(item.slotsOcupados) ? item.slotsOcupados : [];
        return [item.slotAnatomico, ...extras, item.slotAnatomico2].filter(Boolean);
    }

    /** O item ocupa este slot, em qualquer das suas posições? */
    function itemOcupaSlot(item, slotKey) {
        return slotsDoItem(item).includes(slotKey);
    }

    /** Campo do item com fallback pro modelo do catálogo. Instância vence modelo. */
    function campoComModelo(item, key, catalog) {
        const proprio = item && item[key];
        if (Array.isArray(proprio) && proprio.length) return proprio;
        if (!item || !item.modeloId || !Array.isArray(catalog)) return [];
        const tpl = catalog.find(t => t.id === item.modeloId);
        return (tpl && Array.isArray(tpl[key])) ? tpl[key] : [];
    }

    /**
     * Slots extras que o item cobre, além do principal.
     * @returns {Array<{parteId: string, quantidade: number}>}
     */
    function slotsExtrasNecessarios(item, catalog) {
        return campoComModelo(item, 'slotsAdicionais', catalog)
            .map(s => ({
                parteId: s && s.id,
                // aceita 'modificador' porque o seletor do painel usou essa chave
                quantidade: Math.max(1, Number((s && (s.quantidade ?? s.modificador))) || 1),
            }))
            .filter(s => s.parteId);
    }

    /**
     * Reserva o que couber. Slot adicional é COBERTURA, não requisito: a armadura
     * que cobre Torso + Ombros equipa no Torso mesmo que o personagem não tenha
     * ombro, ou que só um esteja livre — ocupa o que dá e segue. O único slot
     * exigido é o principal, que a própria ficha escolhe.
     *
     * @param {Array}    necessidades [{parteId, quantidade}]
     * @param {Object}   bodySlots    slotKey → {partId, ...}
     * @param {Array}    ocupados     slotKeys já tomados (inclui o principal)
     * @param {Function} labelParte   parteId → nome legível, para a mensagem
     * @returns {{slots: string[], naoCoube: string[]}} naoCoube é informativo
     */
    function reservarSlots(necessidades, bodySlots, ocupados, labelParte) {
        const nome = labelParte || (id => id);
        const usados = new Set(ocupados || []);
        const slots = [];
        const naoCoube = [];

        for (const need of (necessidades || [])) {
            const livres = Object.keys(bodySlots || {})
                .filter(k => bodySlots[k].partId === need.parteId && !usados.has(k));

            const pega = Math.min(livres.length, need.quantidade);
            for (let i = 0; i < pega; i++) {
                usados.add(livres[i]);
                slots.push(livres[i]);
            }
            if (pega < need.quantidade) {
                naoCoube.push(`${need.quantidade - pega}× ${nome(need.parteId)}`);
            }
        }
        return { slots, naoCoube };
    }

    // ===== MODO DE USO — quantas mãos a peça ocupa =====
    // Ao contrário dos slotsAdicionais (cobertura, pega o que couber), a 2ª mão
    // de uma arma de duas mãos é REQUISITO: sem ela a arma não equipa. A regra
    // morava só em ficha-v1.7_1/js/inventory.js, então aliado, NPC e Tabuleiro
    // deixavam um espadão ocupar uma mão só.

    /** Categorias que decidem sozinhas; o resto pergunta ao dono. */
    const MAOS_POR_CATEGORIA = { uma_mao: 1, duas_maos: 2, escudo: 1 };

    /** A arma deixa o dono escolher 1 ou 2 mãos? (versátil, arma a distância) */
    function escolheMaos(item) {
        return item?.tipo === 'Arma' && !MAOS_POR_CATEGORIA[item.categoriaArma];
    }

    /** Mãos que a peça ocupa AGORA. Onde a categoria não decide, vale `maosUsadas`. */
    function maosDoItem(item) {
        if (!item || item.tipo !== 'Arma') return 1;
        return MAOS_POR_CATEGORIA[item.categoriaArma]
            || (Number(item.maosUsadas) === 2 ? 2 : 1);
    }

    /**
     * Vínculo de Valor Derivado vale no modo atual do item?
     * `maos` ausente ou 0 = vale sempre; 1 ou 2 = só naquele número de mãos.
     * É o que dá "machado: +4 de Dano em duas mãos, +1 numa" sem regra nova.
     */
    function vinculoValeComMaos(vinculo, item) {
        const m = Number(vinculo && vinculo.maos) || 0;
        return !m || m === maosDoItem(item);
    }

    /**
     * Fórmula de dano do modo atual. Instância vence modelo por INTEIRO — se a
     * peça define qualquer dado próprio, o modelo não é mais consultado.
     */
    function formulaDanoPorMaos(item, tpl) {
        const duas = maosDoItem(item) === 2;
        const dado = (o) => (o && ((duas && o.formulaDano2Maos) || o.formulaDano)) || '';
        return dado(item) || dado(tpl);
    }

    /** A 2ª mão: mesma parte do corpo do slot principal, +1. */
    function maoExtraNecessaria(item, slotKey, bodySlots) {
        if (maosDoItem(item) < 2) return [];
        const parte = (bodySlots || {})[slotKey] && bodySlots[slotKey].partId;
        return parte ? [{ parteId: parte, quantidade: 1 }] : [];
    }

    /**
     * Fecha o ciclo: dado o slot principal escolhido, devolve os extras a gravar
     * em `slotsOcupados`. Só recusa por falta da 2ª mão (`faltaMao` preenchido);
     * a cobertura dos slotsAdicionais nunca recusa — ver reservarSlots.
     *
     * @param {Object} item      o item sendo equipado
     * @param {string} slotKey   slot principal escolhido
     * @param {Array}  todos     todos os itens do dono (para saber o que está tomado)
     * @param {Object} bodySlots mapa de slots do corpo
     * @param {Object} opts      {catalog, labelParte, extrasJaReservados}
     * @returns {{faltaMao: ?string, maoExtra: ?string, naoCoube: string[], extras: string[]}}
     */
    function planejarEquipar(item, slotKey, todos, bodySlots, opts) {
        const o = opts || {};
        const jaTomados = [slotKey].concat(o.extrasJaReservados || []);
        (todos || []).forEach(i => {
            if (!i || i.id === (item && item.id)) return;
            if (!i.equipado || i.estadoEquip === 'armazenado') return;
            jaTomados.push(...slotsDoItem(i));
        });

        // Requisito, não cobertura: sem a 2ª mão livre, a arma não equipa.
        const jaTemMao2 = (o.extrasJaReservados || []).length > 0;
        const mao = reservarSlots(
            jaTemMao2 ? [] : maoExtraNecessaria(item, slotKey, bodySlots),
            bodySlots, jaTomados, o.labelParte);
        if (mao.naoCoube.length) {
            return { faltaMao: mao.naoCoube[0], maoExtra: null, naoCoube: [], extras: [] };
        }
        jaTomados.push(...mao.slots);

        const r = reservarSlots(
            slotsExtrasNecessarios(item, o.catalog), bodySlots, jaTomados, o.labelParte);
        return {
            faltaMao: null,
            maoExtra: mao.slots[0] || (o.extrasJaReservados || [])[0] || null,
            naoCoube: r.naoCoube,
            extras: (o.extrasJaReservados || []).concat(mao.slots, r.slots),
        };
    }

    raiz.EquipSlots = {
        slotsDoItem, itemOcupaSlot, slotsExtrasNecessarios, reservarSlots, planejarEquipar,
        escolheMaos, maosDoItem, vinculoValeComMaos, formulaDanoPorMaos,
    };
})(typeof window !== 'undefined' ? window : globalThis);
