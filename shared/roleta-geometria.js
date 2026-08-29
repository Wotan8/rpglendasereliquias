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

/** Menor pedaço da roda, em graus, que uma fatia pode ocupar. */
export const GRAU_MINIMO = 3;

/**
 * O mínimo de fato, dado quantas fatias existem. Os mínimos somados nunca podem
 * passar de dois terços da roda: acima disso sobraria tão pouco para repartir
 * que a proporção entre as fatias grandes viraria decoração.
 */
export function minimoDeFatia(quantidade) {
    return quantidade > 0 ? Math.min(GRAU_MINIMO, (360 * 0.66) / quantidade) : 0;
}

/**
 * Divide a roda em fatias com tamanho proporcional à chance de cada prêmio.
 * Prêmio com chance <= 0 não ocupa espaço nenhum — se ele não pode sair, não
 * pode aparecer na roda, senão a fatia mente sobre a probabilidade.
 *
 * PROPORÇÃO EXATA E VISIBILIDADE NÃO CABEM JUNTAS.
 * Um prêmio de 0,09% em proporção exata ocupa 0,32° — meio pixel de arco, que
 * some. E fatia que some diz a coisa errada: quem olha conclui que o prêmio não
 * está na roda, e ele está. Então quem não alcança `minimoDeFatia` recebe esse
 * mínimo, e o que sobra da roda é repartido em proporção EXATA entre os outros.
 * Repete-se até ninguém mais cair abaixo do mínimo, porque tirar espaço dos
 * grandes pode empurrar um médio para baixo da linha.
 *
 * O que isso custa: entre as fatias infladas o tamanho deixa de ser leitura da
 * chance — duas mínimas parecem iguais mesmo com chances diferentes. A
 * porcentagem de verdade está na legenda e na janela de espiada, que saem da
 * `chance`, nunca do tamanho desenhado.
 *
 * @param {Array<{chance:number}>} premios
 * @returns {Array<{indice:number, inicio:number, fim:number, meio:number, tamanho:number, inflada:boolean}>}
 */
export function fatias(premios) {
    const validos = (premios || [])
        .map((p, indice) => ({ indice, chance: Number(p?.chance) }))
        .filter(p => Number.isFinite(p.chance) && p.chance > 0);

    const total = validos.reduce((s, p) => s + p.chance, 0);
    if (total <= 0) return [];

    const minimo = minimoDeFatia(validos.length);
    const tamanhos = new Map();
    const noMinimo = new Set();

    /* Ponto fixo. Cada volta trava quem ficou abaixo do mínimo e reparte o que
       sobra entre os livres; travar alguém encolhe o bolo, o que pode derrubar
       o próximo. Uma volta trava pelo menos um, então não passa de
       `validos.length` voltas. E nunca trava TODOS: `minimoDeFatia` garante que
       os mínimos somem no máximo dois terços da roda, então o último livre fica
       com mais de um terço dela — bem acima do mínimo. */
    for (let volta = 0; volta <= validos.length; volta++) {
        const sobra = 360 - noMinimo.size * minimo;
        const somaLivre = validos.reduce(
            (soma, p) => noMinimo.has(p.indice) ? soma : soma + p.chance, 0);
        const caindo = [];
        for (const p of validos) {
            if (noMinimo.has(p.indice)) { tamanhos.set(p.indice, minimo); continue; }
            const tamanho = (p.chance / somaLivre) * sobra;
            tamanhos.set(p.indice, tamanho);
            if (tamanho < minimo) caindo.push(p.indice);
        }
        if (!caindo.length) break;
        caindo.forEach(i => noMinimo.add(i));
    }

    let cursor = 0;
    return validos.map(p => {
        const tamanho = tamanhos.get(p.indice);
        const fatia = {
            indice: p.indice,
            inicio: cursor,
            fim: cursor + tamanho,
            meio: cursor + tamanho / 2,
            tamanho,
            /* Marca quem foi inflado. Quem desenha não usa — fatia é fatia —,
               mas quem AUDITA a roda precisa saber onde o tamanho deixou de ser
               leitura da chance. */
            inflada: noMinimo.has(p.indice),
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

/**
 * Qual fatia está sob um PONTO da roda — o dedo ou o cursor.
 *
 * `dx`/`dy` são o deslocamento do ponto em relação ao CENTRO do disco, em
 * pixels do canvas, com y crescendo para baixo. É a mesma convenção do desenho,
 * então `Math.atan2(dy, dx)` já devolve o ângulo horário que as fatias usam —
 * não há conversão escondida aqui, e é de propósito: um sinal trocado neste
 * ponto vira fatia errada num toque, que é erro silencioso e convincente.
 *
 * Devolve `null` fora do disco e dentro do miolo, porque nenhum dos dois é
 * fatia: o miolo é o eixo, e fora do aro é o fundo da janela.
 *
 * @param {ReturnType<fatias>} listaFatias
 * @param {number} rotacao graus que a roda está girada
 * @param {number} dx      pixels à direita do centro
 * @param {number} dy      pixels ABAIXO do centro
 * @param {number} raio    raio do disco desenhado
 * @param {number} raioMiolo raio do eixo, que não conta como fatia
 */
export function fatiaNoPonto(listaFatias, rotacao, dx, dy, raio, raioMiolo = 0) {
    const dist = Math.hypot(dx, dy);
    if (!(dist <= raio) || dist < raioMiolo) return null;
    const angulo = Math.atan2(dy, dx) * 180 / Math.PI;
    const ponto = ((angulo - rotacao) % 360 + 360) % 360;
    return listaFatias.find(f => ponto >= f.inicio && ponto < f.fim) || null;
}

/** Qual fatia está sob a seta com a roda girada em `rotacao` graus. */
export function fatiaSobASeta(listaFatias, rotacao) {
    const ponto = ((ANGULO_SETA - rotacao) % 360 + 360) % 360;
    return listaFatias.find(f => ponto >= f.inicio && ponto < f.fim)
        || listaFatias[listaFatias.length - 1];
}
