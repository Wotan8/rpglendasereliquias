// =============================================
// REPERTÓRIO — o que conta como "a mesma linha" (lado do navegador)
//
// GÊMEO DE `functions/repertorio.js`. As duas precisam dizer a mesma coisa: se
// o servidor empilha e a tela não, o jogador vê dois cards de um item que o
// banco tem como um só — e vice-versa.
//
// Por que são dois arquivos e não um: `functions/` sobe para o Cloud Functions
// sozinho, sem a pasta `shared/`, e é CommonJS. Não há import possível entre os
// dois. Mexeu em um, mexa no outro.
//
// A regra: só é a mesma linha o que é a MESMA COISA. Mesmo nome não basta —
// o que o item FAZ tem de bater. Ao fundir duas linhas, a que sobrevive é a
// antiga, com os campos dela: juntar por nome fazia uma peça barata herdar o
// EXP de uma cara de mesmo nome.
// =============================================

/* Os campos que fazem o item valer alguma coisa. `descricao` e `imagem` ficam
   de fora: corrigir um texto no catálogo não pode partir a linha de ninguém. */
export const CAMPOS_DE_EFEITO = [
    'isExp', 'expAmount', 'isExpVip',
    'isRoleta', 'roletaGiros',
    'isRerolagem', 'rerolagensAmount',
    'isNarrativo', 'isItemPersonagem',
];

/* Ausente, nulo, falso, vazio e ZERO são todos a mesma coisa: nenhum efeito.
   O zero importa — o cadastro grava `expAmount: 0` em item que não concede
   nada, e a linha antiga do jogador simplesmente não tem o campo. */
export function assinaturaDeEfeito(x) {
    return CAMPOS_DE_EFEITO.map(c => {
        const v = x ? x[c] : undefined;
        if (v === undefined || v === null || v === false || v === '') return '';
        if (v === true) return '1';
        const n = Number(v);
        if (Number.isFinite(n)) return n === 0 ? '' : String(n);
        return String(v);
    }).join('|');
}

/** Com id dos dois lados, o id decide — o nome pode ter sido corrigido. */
export function ehMesmaLinha(a, b) {
    if (!a || !b) return false;
    if (a.itemId && b.itemId) return a.itemId === b.itemId;
    return a.nome === b.nome && assinaturaDeEfeito(a) === assinaturaDeEfeito(b);
}

/**
 * Empilha `item` no inventário e devolve a lista nova. O array original não é
 * tocado. Usado pelo painel do mestre ao dar item a um jogador — antes ele
 * dava `push` direto, e o Repertório acumulava linhas repetidas do mesmo item.
 */
export function empilhar(inventario, item) {
    const lista = Array.isArray(inventario) ? [...inventario] : [];
    const quantidade = Math.max(1, parseInt(item?.quantidade, 10) || 1);
    const i = lista.findIndex(l => ehMesmaLinha(l, item));
    if (i !== -1) {
        lista[i] = { ...lista[i], quantidade: (Number(lista[i].quantidade) || 0) + quantidade };
        if (item.itemId && !lista[i].itemId) lista[i].itemId = item.itemId;
        return lista;
    }
    lista.push({ ...item, quantidade });
    return lista;
}

/** Junta as linhas iguais de um inventário. Devolve a lista nova. */
export function consolidar(inventario) {
    const lista = Array.isArray(inventario) ? inventario : [];
    const saida = [];
    for (const l of lista) {
        const i = saida.findIndex(x => ehMesmaLinha(x, l));
        if (i === -1) saida.push({ ...l, quantidade: Math.max(1, Number(l.quantidade) || 1) });
        else saida[i].quantidade += Math.max(1, Number(l.quantidade) || 1);
    }
    return saida;
}
