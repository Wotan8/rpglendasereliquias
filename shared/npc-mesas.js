// =============================================
// NPC × Mesas — um NPC pode estar em VÁRIAS mesas ao mesmo tempo.
//
// `vinculos: [{tipo:'mesa', id}]` é a lista canônica (o editor de NPCs já
// permite marcar várias). `mesaId` continua existindo como espelho legado da
// PRIMEIRA mesa, porque dados antigos e telas antigas ainda leem esse campo —
// por isso todo leitor deve usar npcNaMesa(), nunca comparar mesaId direto.
// =============================================

/** Todas as mesas de um NPC (vínculos + espelho legado, sem repetir). */
export function mesasDoNpc(npc) {
    const ids = (Array.isArray(npc?.vinculos) ? npc.vinculos : [])
        .filter(v => v && v.tipo === 'mesa' && v.id)
        .map(v => v.id);
    if (npc?.mesaId && !ids.includes(npc.mesaId)) ids.push(npc.mesaId);
    return ids;
}

/** Este NPC pertence a esta mesa? */
export function npcNaMesa(npc, mesaId) {
    return !!mesaId && mesasDoNpc(npc).includes(mesaId);
}

/**
 * Vínculos após ligar/desligar UMA mesa — as outras ficam intactas.
 * (O antigo vinculosComMesa apagava todas as mesas antes de somar a atual,
 * o que tornava impossível um NPC servir duas campanhas.)
 */
export function comMesa(vinculos, mesaId, vincular) {
    const out = (Array.isArray(vinculos) ? vinculos : [])
        .filter(v => v && !(v.tipo === 'mesa' && v.id === mesaId));
    if (vincular) out.push({ tipo: 'mesa', id: mesaId });
    return out;
}

/** Espelho legado: primeira mesa da lista (ou '' se não houver nenhuma). */
export function espelhoMesaId(vinculos) {
    const v = (Array.isArray(vinculos) ? vinculos : []).find(x => x && x.tipo === 'mesa' && x.id);
    return v ? v.id : '';
}

/** Patch pronto para o Firestore ao ligar/desligar uma mesa. */
export function patchVinculoMesa(npc, mesaId, vincular) {
    const vinculos = comMesa(npc?.vinculos, mesaId, vincular);
    return { vinculos, mesaId: espelhoMesaId(vinculos) };
}
