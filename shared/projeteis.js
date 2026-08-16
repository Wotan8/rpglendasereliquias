// =============================================
// 🏹 PROJÉTEIS — decisão pura
// ---------------------------------------------
// Arma de disparo gasta munição, e só do tipo certo: arco come Flecha, besta
// come Virote. Quem diz o tipo é a ARMA (`tipoProjetil`, tags), e quem carrega
// a tag é o PROJÉTIL — as tags já existiam no catálogo, então nada precisou ser
// recadastrado do lado da munição.
//
// A munição conta esteja onde estiver na mochila, INCLUSIVE dentro de container
// (aljava é container). Ninguém em mesa considera que a flecha na aljava não
// está disponível — obrigar a tirar da aljava antes de atirar seria burocracia
// que a mesa ignoraria na hora.
//
// Depois do tiro o projétil some do inventário. Ele volta ao mundo como loot no
// mapa (onde o alvo está, se acertou; por perto, se errou) ou se quebra. Quem
// decide é a chance cadastrada no próprio projétil.
//
// Sem Firestore e sem tela.
// =============================================

/** Chance de recuperar quando o projétil não cadastra a sua. */
export const CHANCE_RECUPERAR_PADRAO = 50;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Campo do item com fallback pro modelo do catálogo (instância vence). */
function campo(item, catalog, k) {
    const v = item?.[k];
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) return v;
    const tpl = (catalog || []).find(t => t.id === (item?.modeloId || item?.origemTemplateId));
    return tpl?.[k];
}

/** As tags de munição que esta arma aceita (vazio = não gasta munição). */
export function municaoDaArma(arma, catalog) {
    const t = campo(arma, catalog, 'tipoProjetil');
    if (!t) return [];
    return (Array.isArray(t) ? t : String(t).split(',')).map(x => norm(x)).filter(Boolean);
}

/**
 * Os maços de projétil no inventário que servem para esta arma.
 *
 * Conta o que está solto E o que está dentro de container: `parentItemId` não
 * exclui nada. Maço zerado não entra — não dá para atirar o que acabou.
 *
 * @returns [{ id, nome, quantidade, chanceRecuperar, dentroDe, condicaoIds }]
 */
export function projeteisCompativeis(itens, catalog, arma) {
    const querem = municaoDaArma(arma, catalog);
    if (!querem.length) return [];

    return (itens || []).filter(i => {
        if (!i) return false;
        if (campo(i, catalog, 'tipo') !== 'Projétil') return false;
        if (qtdDe(i) <= 0) return false;
        const tags = campo(i, catalog, 'tags') || [];
        return (Array.isArray(tags) ? tags : [tags]).some(t => querem.includes(norm(t)));
    }).map(i => ({
        id: i.id,
        nome: i.nome || 'Projétil',
        quantidade: qtdDe(i),
        chanceRecuperar: chanceDe(i, catalog),
        dentroDe: i.parentItemId || null,
        // 💀 A ponta envenenada envenena. Sai do cadastro do projétil, com o
        // mesmo fallback instância→modelo de todo o resto.
        condicaoIds: campo(i, catalog, 'condicaoIds') || [],
    }));
}

/** Quantidade do maço; ausente = 1 (item avulso não guarda quantidade). */
export function qtdDe(i) {
    const q = Number(i?.quantidade);
    return Number.isFinite(q) ? q : 1;
}

/** Chance de recuperar deste projétil, com o padrão do sistema por trás. */
export function chanceDe(item, catalog) {
    const c = campo(item, catalog, 'chanceRecuperar');
    const n = Number(c);
    return Number.isFinite(n) && String(c).trim() !== '' ? Math.max(0, Math.min(100, n)) : CHANCE_RECUPERAR_PADRAO;
}

/**
 * O que acontece com o projétil depois do tiro.
 *
 * @param opts {
 *   acertou: boolean,           o tiro passou?
 *   chanceRecuperar: number,    0–100
 *   rnd: () => number,          injetável para o teste (0 ≤ r < 1)
 * }
 * @returns { caiu, onde: 'alvo'|'perto'|null, quebrou }
 *
 * `onde` é 'alvo' quando acertou (a flecha está cravada nele, cai onde ele
 * está) e 'perto' quando errou (passou batido e foi parar na vizinhança).
 */
export function destinoDoProjetil(opts = {}) {
    const chance = Math.max(0, Math.min(100, Number(opts.chanceRecuperar) || 0));
    const r = (typeof opts.rnd === 'function' ? opts.rnd() : Math.random()) * 100;
    const caiu = r < chance;
    if (!caiu) return { caiu: false, onde: null, quebrou: true };
    return { caiu: true, onde: opts.acertou ? 'alvo' : 'perto', quebrou: false };
}

/**
 * Tira 1 do maço. Devolve o que gravar — não grava nada.
 * @returns { acabou, restante }
 */
export function gastarUm(maco) {
    const restante = Math.max(0, qtdDe(maco) - 1);
    return { acabou: restante === 0, restante };
}
