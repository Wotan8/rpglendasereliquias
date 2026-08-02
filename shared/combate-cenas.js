// =============================================
// CENAS DE COMBATE — o doc `mesas/{id}/tabuleiro-meta/combate`
// ---------------------------------------------
// Uma mesa pode ter várias cenas armadas ao mesmo tempo (a emboscada da estrada,
// a briga da taverna), cada uma com a própria lista de participantes, turno e
// rodada. Só UMA fica aberta por vez.
//
// Formato:
//   { cenas: [{ id, nome, participantes, turnoAtual, rodada }], cenaAtiva,
//     participantes, turnoAtual, rodada }   ← ESPELHO da cena ativa
//
// O espelho não é redundância à toa: o painel de combate da FICHA lê
// `participantes` direto do doc para mostrar a iniciativa do jogador, e o mesmo
// vale para o HUD do tabuleiro. Sem ele, cada leitor precisaria conhecer cenas.
// A regra que segura os dois lados iguais: NINGUÉM escreve o doc na mão —
// todo write sai de `docDeCenas` (ou de quem chama ele).
//
// Doc antigo (só `participantes`) vira uma cena única, sem migração.
// =============================================

export const CENA_PADRAO = { id: 'cena-1', nome: 'Combate' };

export function novaCena(id, nome) {
    return { id, nome: nome || 'Nova cena', participantes: [], turnoAtual: 0, rodada: 1 };
}

/** Cenas do doc. Doc antigo (participantes soltos) = uma cena só. */
export function cenasDoDoc(c) {
    if (Array.isArray(c?.cenas) && c.cenas.length) return c.cenas;
    return [{
        ...CENA_PADRAO,
        participantes: c?.participantes || [],
        turnoAtual: c?.turnoAtual || 0,
        rodada: c?.rodada || 1,
    }];
}

/** A cena aberta agora. Cai na primeira quando o id salvo não existe mais. */
export function cenaAtiva(c) {
    const cs = cenasDoDoc(c);
    return cs.find(x => x.id === c?.cenaAtiva) || cs[0];
}

export function idCenaAtiva(c) { return cenaAtiva(c).id; }

/**
 * Doc completo a partir da lista de cenas — inclui o espelho da ativa.
 * É a ÚNICA porta de escrita: quem monta o doc por fora quebra o espelho.
 */
export function docDeCenas(cenas, ativaId) {
    const cs = (cenas || []).length ? cenas : [novaCena(CENA_PADRAO.id, CENA_PADRAO.nome)];
    const ativa = cs.find(x => x.id === ativaId) || cs[0];
    return {
        cenas: cs,
        cenaAtiva: ativa.id,
        participantes: ativa.participantes || [],
        turnoAtual: ativa.turnoAtual || 0,
        rodada: ativa.rodada || 1,
    };
}

/** Doc com a cena `id` alterada. */
export function comCena(c, id, patch) {
    return docDeCenas(cenasDoDoc(c).map(x => x.id === id ? { ...x, ...patch } : x), idCenaAtiva(c));
}

/** Doc com a cena ATIVA alterada — o caminho de todo dia. */
export function comCenaAtivaPatch(c, patch) {
    return comCena(c, idCenaAtiva(c), patch);
}

/** Doc com uma cena a mais, já aberta. */
export function comCenaNova(c, id, nome) {
    return docDeCenas([...cenasDoDoc(c), novaCena(id, nome)], id);
}

/** Doc sem a cena `id`. Tirar a última deixa uma cena vazia no lugar. */
export function semCena(c, id) {
    const cs = cenasDoDoc(c).filter(x => x.id !== id);
    return docDeCenas(cs, idCenaAtiva(c) === id ? cs[0]?.id : idCenaAtiva(c));
}

/** Doc com outra cena aberta. */
export function comTrocaDeCena(c, id) {
    return docDeCenas(cenasDoDoc(c), id);
}
