// =============================================
// 🔁 RETORNO DE RECURSO — decisão pura
// ---------------------------------------------
// Algumas classes devolvem recurso no fim do turno em vez de só gastar. O Bardo
// é o caso que originou isto: a Harmonia volta igual ao que ele gastou para
// conjurar, +1 se ele não saiu do lugar — e some inteira se a música quebrar.
//
// A regra é da CLASSE, não da magia: cadastrar por skill repetiria a mesma
// linha em trinta itens do Bardo. Por isso mora no Módulo de Classe.
//
// Sem Firestore e sem tela: recebe o que o turno acumulou e decide.
// =============================================

/**
 * @param cfg {
 *   retornoRecurso: 'Harmonia',    nome do VD/recurso que volta ('' = desligado)
 *   retornoFixo: 1,                ganho FIXO por turno em que conjurou e passou (Livro p. 8: a Harmonia
 *                                  constrói Harmonia, +1 por canção que passa, seja qual for a moeda)
 *   retornoBonusParado: 1,         soma se não gastou a Ação de Movimento
 *   retornoExigeSucesso: true,     falhou no teste ⇒ não ganha nada
 *   retornoZeraSeFalhar: true,     falhou ⇒ perde também o que já tinha
 * }
 * @param turno {
 *   gastou: number,    quanto foi pago DESTE recurso no turno
 *   conjurou: boolean, houve conjuração deste módulo no turno (para o retorno fixo)
 *   parado: boolean,   ainda tinha a Ação de Movimento no fim do turno
 *   falhou: boolean,   errou algum teste de conjuração no turno
 * }
 * @returns { ganho, zera, motivo } — `zera` manda pôr o recurso em 0.
 */
export function retornoDoTurno(cfg, turno) {
    const recurso = String(cfg?.retornoRecurso || '').trim();
    if (!recurso) return { ganho: 0, zera: false, motivo: '' };

    const gastou = Math.max(0, Number(turno?.gastou) || 0);
    const falhou = !!turno?.falhou;
    const parado = !!turno?.parado;

    if (falhou) {
        // A música quebrou. Zerar é decisão de cadastro, não de código: uma
        // classe pode só não ganhar sem perder o que juntou.
        const zera = !!cfg.retornoZeraSeFalhar;
        return {
            ganho: 0, zera,
            motivo: zera ? `falhou — ${recurso} zerada` : 'falhou — sem retorno',
        };
    }

    // 🎶 Retorno fixo: +N por turno em que conjurou e passou, seja qual for a moeda.
    const fixo = Math.max(0, Number(cfg.retornoFixo) || 0);
    if (fixo) {
        if (!turno?.conjurou && !gastou) return { ganho: 0, zera: false, motivo: '' };
        return { ganho: fixo, zera: false, motivo: `+${fixo} por conjurar` };
    }

    // Não gastou nada com o recurso ⇒ não houve conjuração ⇒ não há retorno.
    // Sem isto, o Bardo que passou o turno andando ganharia +1 de graça.
    if (!gastou) return { ganho: 0, zera: false, motivo: '' };

    if (cfg.retornoExigeSucesso && turno?.falhou) return { ganho: 0, zera: false, motivo: 'sem sucesso' };

    const bonus = parado ? (Number(cfg.retornoBonusParado) || 0) : 0;
    return {
        ganho: gastou + bonus,
        zera: false,
        motivo: parado && bonus ? `${gastou} gasto +${bonus} parado` : `${gastou} gasto`,
    };
}
