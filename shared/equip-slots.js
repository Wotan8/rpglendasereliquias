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
     * Slots extras que o item exige, além do principal.
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
     * Escolhe slots livres para atender às exigências. Ou atende tudo, ou não
     * reserva nada — meia reserva deixaria o personagem com o item pela metade.
     *
     * @param {Array}    necessidades [{parteId, quantidade}]
     * @param {Object}   bodySlots    slotKey → {partId, ...}
     * @param {Array}    ocupados     slotKeys já tomados (inclui o principal)
     * @param {Function} labelParte   parteId → nome legível, para a mensagem
     * @returns {{ok: boolean, slots: string[], faltando: string[]}}
     */
    function reservarSlots(necessidades, bodySlots, ocupados, labelParte) {
        const nome = labelParte || (id => id);
        const usados = new Set(ocupados || []);
        const slots = [];
        const faltando = [];

        for (const need of (necessidades || [])) {
            const livres = Object.keys(bodySlots || {})
                .filter(k => bodySlots[k].partId === need.parteId && !usados.has(k));

            if (livres.length < need.quantidade) {
                faltando.push(`${need.quantidade}× ${nome(need.parteId)} (livre: ${livres.length})`);
                continue;
            }
            for (let i = 0; i < need.quantidade; i++) {
                usados.add(livres[i]);
                slots.push(livres[i]);
            }
        }
        return { ok: faltando.length === 0, slots, faltando };
    }

    /**
     * Fecha o ciclo: dado o slot principal escolhido, devolve os extras a gravar
     * em `slotsOcupados` — ou o que falta para poder recusar com mensagem.
     *
     * @param {Object} item      o item sendo equipado
     * @param {string} slotKey   slot principal escolhido
     * @param {Array}  todos     todos os itens do dono (para saber o que está tomado)
     * @param {Object} bodySlots mapa de slots do corpo
     * @param {Object} opts      {catalog, labelParte, extrasJaReservados}
     */
    function planejarEquipar(item, slotKey, todos, bodySlots, opts) {
        const o = opts || {};
        const jaTomados = [slotKey].concat(o.extrasJaReservados || []);
        (todos || []).forEach(i => {
            if (!i || i.id === (item && item.id)) return;
            if (!i.equipado || i.estadoEquip === 'armazenado') return;
            jaTomados.push(...slotsDoItem(i));
        });
        const r = reservarSlots(
            slotsExtrasNecessarios(item, o.catalog), bodySlots, jaTomados, o.labelParte);
        return { ok: r.ok, faltando: r.faltando, extras: (o.extrasJaReservados || []).concat(r.slots) };
    }

    raiz.EquipSlots = {
        slotsDoItem, itemOcupaSlot, slotsExtrasNecessarios, reservarSlots, planejarEquipar,
    };
})(typeof window !== 'undefined' ? window : globalThis);
