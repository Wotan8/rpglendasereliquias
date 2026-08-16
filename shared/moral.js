// =============================================================
// 🤝 MORAL — o que este NPC sente por cada personagem
//
// Não é uma estatística de combate: é memória de mesa. O taverneiro que levou
// uma facada do Bardo lembra disso na sessão seguinte, e o Mestre precisa de
// um lugar para anotar isso NA HORA, no meio do roleplay, sem sair da cena.
//
// Por PERSONAGEM, e não por grupo, porque é assim que a mesa funciona: o
// mesmo NPC pode dever a vida a um e querer a cabeça do outro. Quem só quiser
// uma linha para o grupo inteiro usa uma linha só — o formato não obriga.
//
// O histórico é a parte que o Mestre vai ler meses depois, então cada degrau
// guarda o motivo que ele quis marcar. Motivo é OPCIONAL: no meio da cena,
// clicar −1 e seguir tem de ser possível.
//
// Sem Firestore e sem DOM.
// =============================================================

/** O quanto a moral anda para cada lado. Fora disto, não há mais o que sentir. */
export const MORAL_MIN = -10;
export const MORAL_MAX = 10;

/**
 * As faixas, do ódio à lealdade. O número é frio; o que o Mestre lê na tela
 * tem de ser uma palavra que ele possa interpretar sem consultar tabela.
 * `min` é inclusivo e as faixas são varridas de cima para baixo.
 */
export const FAIXAS = [
    { min: 8,   nome: 'Leal',        icone: '💚', desc: 'Arrisca a própria pele por ele.' },
    { min: 4,   nome: 'Amistoso',    icone: '🙂', desc: 'Ajuda de bom grado, faz favores.' },
    { min: 1,   nome: 'Simpático',   icone: '🤝', desc: 'Boa vontade, mas nada de graça.' },
    { min: 0,   nome: 'Neutro',      icone: '😐', desc: 'Trata como trataria qualquer um.' },
    { min: -3,  nome: 'Desconfiado', icone: '🤨', desc: 'Atende, mas cobra caro e vigia.' },
    { min: -7,  nome: 'Hostil',      icone: '😠', desc: 'Nega ajuda; atrapalha se puder.' },
    { min: -10, nome: 'Inimigo',     icone: '🗡️', desc: 'Age contra, e não precisa de motivo novo.' },
];

/** A faixa de um valor de moral. Nunca devolve null — o 0 é Neutro. */
export function faixaDe(valor) {
    const v = limitar(valor);
    return FAIXAS.find(f => v >= f.min) || FAIXAS[FAIXAS.length - 1];
}

/** Prende o valor entre os extremos. */
export function limitar(valor) {
    const n = Number(valor) || 0;
    return Math.max(MORAL_MIN, Math.min(MORAL_MAX, Math.round(n)));
}

/** A moral deste NPC com este personagem (0 quando nunca se falaram). */
export function moralCom(npc, charId) {
    if (!charId) return 0;
    return limitar(npc?.moral?.[charId]?.valor ?? 0);
}

/** Quantos degraus de histórico o documento guarda. Memória de mesa, não log. */
export const HISTORICO_MAX = 30;

/**
 * Aplica um degrau e devolve o BLOCO NOVO — não grava nada.
 *
 * Devolve `mudou: false` quando o valor já estava no extremo e o degrau
 * empurrava para fora: sem isso o histórico encheria de "−1" que não mexeram
 * em nada, e o Mestre leria uma briga que não aconteceu.
 *
 * @param npc      o NPC (só `moral` é lido)
 * @param charId   personagem
 * @param delta    quanto somar (pode ser negativo)
 * @param motivo   texto livre, opcional
 * @param por      quem registrou (e-mail/uid), opcional
 * @returns { moral, antes, depois, mudou, entrada }
 */
export function aplicarMoral(npc, charId, delta, motivo = '', por = null) {
    const d = Math.round(Number(delta) || 0);
    const antes = moralCom(npc, charId);
    const depois = limitar(antes + d);
    const atual = npc?.moral?.[charId] || {};
    if (!charId || depois === antes) {
        return { moral: npc?.moral || {}, antes, depois: antes, mudou: false, entrada: null };
    }
    const entrada = {
        delta: depois - antes,          // o que REALMENTE andou, não o que se pediu
        de: antes, para: depois,
        motivo: String(motivo || '').trim(),
        em: new Date().toISOString(),
        por: por || null,
    };
    return {
        moral: {
            ...(npc?.moral || {}),
            [charId]: {
                ...atual,
                valor: depois,
                // mais recente primeiro: é o que o Mestre quer ver ao abrir
                historico: [entrada, ...(atual.historico || [])].slice(0, HISTORICO_MAX),
            },
        },
        antes, depois, mudou: true, entrada,
    };
}

/**
 * As linhas prontas para a tela: um personagem por linha, com faixa e último
 * motivo. Ordena do pior para o melhor — quem odeia o grupo é o que o Mestre
 * precisa ver primeiro numa cena.
 */
export function linhasDeMoral(npc, personagens) {
    return (personagens || []).map(p => {
        const reg = npc?.moral?.[p.id] || {};
        const valor = limitar(reg.valor ?? 0);
        const ultimo = (reg.historico || [])[0] || null;
        return {
            charId: p.id, nome: p.nome || p.name || '?',
            valor, faixa: faixaDe(valor),
            ultimoMotivo: ultimo?.motivo || '',
            historico: reg.historico || [],
        };
    }).sort((a, b) => a.valor - b.valor || a.nome.localeCompare(b.nome));
}
