/* ===== EFEITOS QUE ATRAVESSAM O TURNO =====
 *
 * Três mecânicas que não cabem no "mira, rola, aplica" de uma ação só:
 *
 *  ⏪ DESFAZER O TURNO (Estilhaçar Causa) — o alvo volta ao estado em que
 *     estava ANTES do último turno dele: posição, e o que ele causou nos
 *     outros. Para isso a cena guarda um retrato no começo de cada turno.
 *
 *  🕯️ RITUAL DE N RODADAS (Invocação Abissal) — a habilidade não resolve na
 *     hora: ocupa rodadas, resolve por etapas no fim de cada uma, e enquanto
 *     dura quem conjura não se defende.
 *
 *  🌀 MIRA EM DOIS ESTÁGIOS (Vórtice na Fenda) — primeiro os tokens que vão
 *     junto, depois o lugar para onde vão.
 *
 * Puro: sem Firestore, sem DOM. O Tabuleiro guarda o que sai daqui no doc da
 * cena, junto dos participantes.
 */

/* ===================== ⏪ RETRATO DO TURNO ===================== */

/**
 * O retrato tirado no começo do turno de alguém. Guarda pouco de propósito:
 * onde cada token estava e como estavam os vitais de todos. É o suficiente
 * para desfazer "o que ele fez", que é sempre mover-se e machucar alguém.
 *
 * @param {object} o
 * @param {string} o.pid      participante de quem é o turno
 * @param {number} o.rodada
 * @param {Array}  o.tokens   [{ id, x, y }]
 * @param {Array}  o.vitais   [{ pid, vit, ener, san }]
 */
export function tirarRetrato({ pid, rodada, tokens, vitais }) {
    return {
        pid, rodada, em: Date.now(),
        tokens: (tokens || []).map(t => ({ id: t.id, x: t.x, y: t.y })),
        vitais: (vitais || []).map(v => ({ pid: v.pid, vit: v.vit ?? null, ener: v.ener ?? null, san: v.san ?? null })),
    };
}

/**
 * O que precisa voltar para desfazer o turno retratado.
 *
 * Devolve SÓ as diferenças, e só as que fazem sentido desfazer:
 *   · a posição do token de quem agiu (ele volta para onde estava);
 *   · a Vitalidade de quem PERDEU vida desde o retrato (o dano que ele causou
 *     se recupera). Quem ganhou vida no meio não é rebaixado — desfazer o
 *     turno do agressor não pode roubar a cura que outro deu.
 *
 * @param {object} retrato   saída de tirarRetrato
 * @param {object} agora     { tokens: [{id,x,y}], vitais: [{pid,vit,ener,san}] }
 * @returns {{ tokens: Array, vitais: Array }}
 */
export function oQueDesfazer(retrato, agora) {
    if (!retrato) return { tokens: [], vitais: [] };
    const posAgora = new Map((agora?.tokens || []).map(t => [t.id, t]));
    const vitAgora = new Map((agora?.vitais || []).map(v => [v.pid, v]));

    const tokens = [];
    for (const t of retrato.tokens || []) {
        const at = posAgora.get(t.id);
        if (!at) continue;
        if (at.x !== t.x || at.y !== t.y) tokens.push({ id: t.id, x: t.x, y: t.y });
    }

    const vitais = [];
    for (const v of retrato.vitais || []) {
        const at = vitAgora.get(v.pid);
        if (!at || v.vit == null || at.vit == null) continue;
        // só quem PERDEU vida desde o retrato volta ao que era
        if (at.vit < v.vit) vitais.push({ pid: v.pid, vit: v.vit });
    }
    return { tokens, vitais };
}

/* ===================== 🕯️ RITUAL DE N RODADAS ===================== */

/**
 * Começa um ritual que ocupa rodadas.
 * @param {object} o
 * @param {string} o.nome
 * @param {number} o.rodadas    quantas rodadas até completar
 * @param {number} o.rodadaAtual
 * @param {boolean} [o.semDefesa] quem conjura não se defende enquanto dura
 */
export function comecarRitual({ nome, rodadas, rodadaAtual, semDefesa }) {
    const total = Math.max(1, Number(rodadas) || 1);
    return {
        nome: nome || 'Ritual', total, feitas: 0,
        comecouNaRodada: Number(rodadaAtual) || 1,
        semDefesa: !!semDefesa,
    };
}

/**
 * Avança o ritual uma rodada.
 * @returns {{ ritual: object|null, etapa: number, total: number, completou: boolean }}
 *          `ritual: null` quando completou — some do participante.
 */
export function avancarRitual(ritual) {
    if (!ritual) return { ritual: null, etapa: 0, total: 0, completou: false };
    const feitas = (Number(ritual.feitas) || 0) + 1;
    const total = Math.max(1, Number(ritual.total) || 1);
    const completou = feitas >= total;
    return {
        ritual: completou ? null : { ...ritual, feitas },
        etapa: feitas, total, completou,
    };
}

/** Quanto do ritual já foi feito, para a barra e o texto ("1/2 dos passos"). */
export function progressoDoRitual(ritual) {
    if (!ritual) return null;
    const total = Math.max(1, Number(ritual.total) || 1);
    const feitas = Math.min(total, Number(ritual.feitas) || 0);
    return { feitas, total, fracao: feitas / total, texto: `${feitas}/${total}` };
}

/** Quem está num ritual que proíbe defesa não tem Defesa nenhuma disponível. */
export function ritualProibeDefesa(p) {
    return !!p?.ritual?.semDefesa;
}

/* ===================== 🌀 MIRA EM DOIS ESTÁGIOS ===================== */

/**
 * A mira pede um segundo estágio depois dos alvos?
 * O Vórtice na Fenda leva quem conjura e mais um tocado — e só então escolhe
 * o lugar para onde os dois vão.
 */
export function precisaSegundoEstagio(mira, alvosEscolhidos) {
    if (!mira?.depoisLocais) return false;
    if (mira.tipo !== 'alvos') return false;
    return (alvosEscolhidos || []).length >= 1;
}

/** A mira do segundo estágio: mesma origem e alcance, escolhendo lugar. */
export function miraDoSegundoEstagio(mira) {
    return {
        ...mira,
        tipo: 'locais',
        maxAlvos: Math.max(1, Number(mira.depoisLocais) || 1),
        alvosPorGraus: false,
        // o alcance do destino pode ser maior que o do toque que pegou o alvo
        alcanceM: mira.alcanceDestinoM != null ? mira.alcanceDestinoM : mira.alcanceM,
        _estagio: 2,
    };
}
