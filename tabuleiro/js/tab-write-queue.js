// =============================================
// TABULEIRO — Fila de escrita por objeto
// Arrastar gera dezenas de patches por segundo; o throttle agrupa para não
// torrar writes do Firestore. O ponto delicado é o FIM do arrasto: o write
// final (sem throttle) tem que CANCELAR qualquer pendente do mesmo objeto —
// senão o pendente antigo aterrissa depois e o objeto "volta" para uma posição
// intermediária (era o token que tremia e não chegava onde foi solto).
// Sem dependência de Firebase — testável em tab-write-queue.test.mjs.
// =============================================

/**
 * @param write      (id, patch) => void — a gravação de verdade
 * @param agora      relógio injetável (teste)
 * @param agendar    setTimeout injetável (teste)
 * @param cancelar   clearTimeout injetável (teste)
 */
export function criarFilaDeEscrita({ write, agora = () => Date.now(), agendar = setTimeout, cancelar = clearTimeout }) {
    const pend = new Map();   // id -> { t: instante do último write, timer, last: patch pendente }

    return {
        /**
         * `throttleMs = 0` grava imediatamente e descarta o pendente do mesmo id.
         * Com throttle, grava no máximo uma vez por janela, sempre o patch MAIS NOVO.
         */
        enviar(id, patch, throttleMs = 0) {
            const p = pend.get(id) || { t: -Infinity, timer: null, last: null };
            pend.set(id, p);

            // Qualquer patch novo torna o pendente obsoleto — ele é do mesmo objeto
            // e mais antigo, então nunca deve sobrescrever o que veio depois.
            if (p.timer != null) { cancelar(p.timer); p.timer = null; }
            p.last = patch;

            const t = agora();
            if (!throttleMs || t - p.t >= throttleMs) {
                p.t = t; p.last = null;
                write(id, patch);
                return;
            }
            p.timer = agendar(() => {
                p.timer = null; p.t = agora();
                const ultimo = p.last; p.last = null;
                if (ultimo) write(id, ultimo);
            }, throttleMs - (t - p.t));
        },

        /** Ids com gravação ainda pendente — usado nos testes e para diagnóstico. */
        pendentes() {
            return [...pend.entries()].filter(([, p]) => p.timer != null).map(([id]) => id);
        },
    };
}
