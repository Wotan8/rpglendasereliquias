// =============================================
// TABULEIRO — Sincronia de música: decisões puras (testável em Node)
// Módulo "folha": não importa nada.
// =============================================

/**
 * Compara o que a mesa está tocando com o que ESTE aparelho já toca.
 * @param tocando  { faixaId: t0 } — vindo do Firestore
 * @param temFaixa (faixaId) => boolean — a faixa ainda existe e tem url?
 * @param ativos   faixaIds tocando localmente
 * @returns { parar, iniciar }
 */
export function planoDeReproducao(tocando, temFaixa, ativos) {
    const alvo = tocando || {};
    const noAr = (fid) => Object.prototype.hasOwnProperty.call(alvo, fid);
    return {
        parar: (ativos || []).filter(fid => !noAr(fid) || !temFaixa(fid)),
        iniciar: Object.keys(alvo).filter(fid => temFaixa(fid) && !(ativos || []).includes(fid)),
    };
}

/**
 * Em que segundo a faixa deve começar para entrar em fase com quem já está ouvindo.
 * Sem loop e já passou do fim → devolve o fim (a faixa acabou enquanto eu não ouvia).
 * @returns segundos, ou null quando não há o que ajustar
 */
export function posicaoInicial(t0, agora, duracao, loop) {
    if (!t0 || !duracao || !isFinite(duracao) || duracao <= 0) return null;
    const decorrido = (agora - t0) / 1000;
    if (decorrido <= 0.5) return null;           // começou agora: não vale mexer
    if (loop) return decorrido % duracao;
    return Math.min(decorrido, Math.max(0, duracao - 0.1));
}
