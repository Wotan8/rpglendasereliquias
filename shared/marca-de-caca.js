// =============================================
// 🎯 MARCA DE CAÇA — decisão pura
// ---------------------------------------------
// O Caçador escolhe UMA presa e passa a acertar melhor e machucar mais ELA —
// e só ela. É a condição "Presa" no alvo que carrega a marca, mas o efeito não
// é do alvo: é de quem marcou. Por isso a condição guarda `porPid`, e o bônus
// só vale para os ataques daquele caçador.
//
// O TETO é o que segura a régua. `Marca de Caça` = Perícia: Marcar Presa + 1,
// e cresce com a ficha; sem teto o bônus subiria junto com a escada de
// Qualidade e a habilidade sairia da faixa medida (o mesmo defeito que o
// Eletrocutado registra sobre a Blindagem).
//
// Sem Firestore e sem tela.
// =============================================

/** Teto do bônus, em pontos. Vem do cadastro; isto é só o padrão. */
export const TETO_PRESA = 3;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * A condição "Presa" que ESTE caçador pôs neste alvo (ou null).
 * @param condicoes lista crua de condições do participante alvo
 * @param cacadorPid id do participante que está atacando
 */
export function presaDe(condicoes, cacadorPid) {
    if (!cacadorPid) return null;
    return (condicoes || []).find(c =>
        c && typeof c === 'object' &&
        norm(c.nome) === 'presa' &&
        c.porPid === cacadorPid) || null;
}

/**
 * Quanto soma no Acerto e no dano contra a presa.
 * @param marcaDeCaca valor do VD na ficha do caçador
 * @param teto        teto cadastrado (0 ou ausente = usa o padrão)
 * @returns número >= 0
 */
export function bonusDaPresa(marcaDeCaca, teto) {
    const v = Math.floor(Number(marcaDeCaca) || 0);
    if (v <= 0) return 0;
    const t = Number(teto) > 0 ? Number(teto) : TETO_PRESA;
    return Math.min(v, t);
}

/**
 * O bônus que vale para ESTE ataque, contra ESTES alvos.
 *
 * O dado do Acerto é UM só para o ataque inteiro, então o bônus de Acerto só
 * entra quando a presa é o alvo ÚNICO — numa área que pega a presa e mais três
 * inimigos, somar a marca na rolagem daria de graça um bônus contra quem não
 * foi marcado. Já o dano é por alvo, e aí a marca entra só na linha da presa.
 *
 * @param alvos [{ pid, condicoes }] alvos do conflito
 * @param ctx { cacadorPid, marcaDeCaca, teto }
 * @returns { acerto, danoPorPid: {pid: bonus}, presaPid }
 */
export function bonusDoAtaque(alvos, ctx = {}) {
    const vazio = { acerto: 0, danoPorPid: {}, presaPid: null };
    const bonus = bonusDaPresa(ctx.marcaDeCaca, ctx.teto);
    if (!bonus || !ctx.cacadorPid) return vazio;

    const lista = alvos || [];
    const marcados = lista.filter(a => presaDe(a?.condicoes, ctx.cacadorPid));
    if (!marcados.length) return vazio;

    const danoPorPid = {};
    for (const a of marcados) if (a.pid) danoPorPid[a.pid] = bonus;

    return {
        // alvo único E é a presa: a rolagem inteira é contra ela
        acerto: (lista.length === 1 && marcados.length === 1) ? bonus : 0,
        danoPorPid,
        presaPid: marcados[0]?.pid || null,
    };
}
