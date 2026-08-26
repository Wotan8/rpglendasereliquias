// =============================================
// ROLETA — geometria das fatias (parte pura, sem canvas)
// O servidor decide QUEM ganhou; este arquivo decide ONDE isso fica na roda e
// quanto girar para a seta parar exatamente ali. Erro aqui não quebra nada de
// forma visível: a roda simplesmente para na fatia errada, e o jogador vê um
// prêmio diferente do que recebeu. Por isso tem teste próprio.
//
// Convenção de ângulo, a mesma do canvas: 0° às 3 horas, crescendo no sentido
// horário. A seta fica no topo, ou seja, em 270°.
// =============================================

export const ANGULO_SETA = 270;

/**
 * Divide a roda em fatias com tamanho proporcional à chance de cada prêmio.
 * Prêmio com chance <= 0 não ocupa espaço nenhum — se ele não pode sair, não
 * pode aparecer na roda, senão a fatia mente sobre a probabilidade.
 * @param {Array<{chance:number}>} premios
 * @returns {Array<{indice:number, inicio:number, fim:number, meio:number, tamanho:number}>}
 */
export function fatias(premios) {
    const validos = (premios || [])
        .map((p, indice) => ({ indice, chance: Number(p?.chance) }))
        .filter(p => Number.isFinite(p.chance) && p.chance > 0);

    const total = validos.reduce((s, p) => s + p.chance, 0);
    if (total <= 0) return [];

    let cursor = 0;
    return validos.map(p => {
        const tamanho = (p.chance / total) * 360;
        const fatia = {
            indice: p.indice,
            inicio: cursor,
            fim: cursor + tamanho,
            meio: cursor + tamanho / 2,
            tamanho,
        };
        cursor += tamanho;
        return fatia;
    });
}

/**
 * Quanto girar (em graus) para o MEIO da fatia do prêmio sorteado parar sob a
 * seta, depois de `voltas` voltas completas.
 * @param {ReturnType<fatias>} listaFatias
 * @param {number} indicePremio índice na lista ORIGINAL de prêmios
 * @param {number} voltas voltas inteiras antes de assentar
 * @param {number} desvio  -0.5..0.5 — desloca dentro da fatia para o giro não
 *                         parar sempre no centro matemático; 0 fica no meio.
 */
export function rotacaoFinal(listaFatias, indicePremio, voltas = 6, desvio = 0) {
    const fatia = listaFatias.find(f => f.indice === indicePremio);
    if (!fatia) throw new Error('Prêmio ' + indicePremio + ' não tem fatia na roda.');

    // Uma margem de 12% de cada lado impede que o desvio jogue o ponteiro
    // para cima da linha divisória e o jogador leia a fatia vizinha.
    const alvo = fatia.meio + Math.max(-0.38, Math.min(0.38, desvio)) * fatia.tamanho;
    const base = (ANGULO_SETA - alvo) % 360;
    return voltas * 360 + (base + 360) % 360;
}

/** Qual fatia está sob a seta com a roda girada em `rotacao` graus. */
export function fatiaSobASeta(listaFatias, rotacao) {
    const ponto = ((ANGULO_SETA - rotacao) % 360 + 360) % 360;
    return listaFatias.find(f => ponto >= f.inicio && ponto < f.fim)
        || listaFatias[listaFatias.length - 1];
}
