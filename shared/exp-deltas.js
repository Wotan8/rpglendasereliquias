// =============================================
// EXP de log de sessão — diferença, não total.
// Um log guarda quanto cada personagem ganhou. Ao EDITAR o log, reaplicar os
// valores dobraria o EXP, e ignorar quem saiu da lista deixaria EXP pendurado
// na ficha. Só o delta entre o que o log já aplicou e o que ele passa a dizer
// vai para a ficha.
// =============================================
export const expAssinado = (p) => (p?.expType === 'sub' ? -1 : 1) * (parseInt(p?.expAmount, 10) || 0);

/** @returns [{ p, delta }] — só quem mudou; `p` é o participante mais recente. */
export function expDeltas(antes = [], agora = []) {
    const m = new Map();
    for (const p of antes) m.set(p.characterId, { p, delta: -expAssinado(p) });
    for (const p of agora) {
        const v = m.get(p.characterId);
        m.set(p.characterId, { p, delta: (v?.delta || 0) + expAssinado(p) });
    }
    return [...m.values()].filter(v => v.delta);
}
