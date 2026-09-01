// =============================================
// REPERTÓRIO — o que conta como "a mesma linha"
//
// O inventário do jogador é uma lista, e comprar de novo aumenta a quantidade
// de uma linha que já existe. A pergunta é qual: até aqui, a resposta era
// "a que tem o mesmo NOME".
//
// O problema disso não é o empilhamento — é o que ele HERDA. Quando duas
// linhas se fundem, a que fica é a antiga, com todos os campos dela. Se o
// mestre cadastrar duas peças de mesmo nome — uma bugiganga de 5 Frag$ e um
// "Pacote de 500 EXP" —, comprar a bugiganga soma uma unidade na linha do
// pacote. O jogador paga 5 e recebe 500 de EXP. Não é ataque: é erro de
// cadastro que vira dinheiro.
//
// A regra aqui: só empilha o que é a MESMA COISA. Mesmo nome não basta; o que
// o item FAZ tem de bater também. Linhas diferentes convivem, e é isso que se
// espera — elas são itens diferentes.
//
// Por que não foi por `itemId`, como o relatório propunha: das 43 linhas de
// inventário de 01/09/2026, nenhuma tem id, e 13 têm nome que não existe mais
// no catálogo (prêmio de roleta, devolução do mestre, EXP devolvido no
// encerramento de personagem). Não há de onde tirar o id para 30% delas.
// O `itemId` passa a ser gravado nas linhas NOVAS e, quando os dois lados o
// têm, ele manda. O nome segue valendo para o que já está gravado.
//
// Sem Firestore: `node functions/repertorio.test.mjs`.
// =============================================

/* Os campos que fazem o item VALER alguma coisa. Dois itens de mesmo nome com
   efeitos diferentes são itens diferentes, e nunca se juntam.
   `descricao` e `imagem` ficam de fora de propósito: corrigir um texto no
   catálogo não pode partir a linha de ninguém em duas. */
const CAMPOS_DE_EFEITO = [
  "isExp", "expAmount", "isExpVip",
  "isRoleta", "roletaGiros",
  "isRerolagem", "rerolagensAmount",
  "isNarrativo", "isItemPersonagem",
];

/* Assinatura do que o item faz.
   Ausente, nulo, falso, vazio e ZERO são todos a mesma coisa: nenhum efeito.
   O zero importa — o cadastro grava `expAmount: 0` e `roletaGiros: 0` em item
   que não concede nada, enquanto a linha antiga do jogador simplesmente não
   tem o campo. Contar os dois como diferentes partiria 19 das 30 linhas de
   inventário de 01/09/2026 em duas na próxima recompra. */
function assinaturaDeEfeito(x) {
  return CAMPOS_DE_EFEITO
    .map((c) => {
      const v = x ? x[c] : undefined;
      if (v === undefined || v === null || v === false || v === "") return "";
      if (v === true) return "1";
      const n = Number(v);
      if (Number.isFinite(n)) return n === 0 ? "" : String(n);
      return String(v);
    })
    .join("|");
}

/**
 * A linha `linha` é a mesma coisa que o item `item`?
 * Com id dos dois lados, o id decide — nome pode até ter sido corrigido no
 * catálogo. Sem id, cai no nome, e aí a assinatura de efeito é a rede.
 */
function ehMesmaLinha(linha, item, itemId) {
  if (!linha || !item) return false;
  const idLinha = linha.itemId;
  if (idLinha && itemId) return idLinha === itemId;
  return linha.nome === item.nome && assinaturaDeEfeito(linha) === assinaturaDeEfeito(item);
}

/**
 * Índice da linha em que este item empilha, ou -1 para abrir linha nova.
 */
function acharLinha(inventario, item, itemId) {
  const lista = Array.isArray(inventario) ? inventario : [];
  return lista.findIndex((l) => ehMesmaLinha(l, item, itemId));
}

/**
 * Empilha `quantidade` unidades de `item` no inventário e devolve a lista.
 * O array original não é tocado.
 *
 * @param {Array} inventario
 * @param {object} item          doc do item da Loja (ou o prêmio)
 * @param {object} opcoes        { quantidade, itemId, formaRecebimento }
 */
function empilhar(inventario, item, opcoes = {}) {
  const lista = Array.isArray(inventario) ? [...inventario] : [];
  const quantidade = Math.max(1, parseInt(opcoes.quantidade, 10) || 1);
  const itemId = opcoes.itemId || "";

  const i = acharLinha(lista, item, itemId);
  if (i !== -1) {
    lista[i] = { ...lista[i], quantidade: (Number(lista[i].quantidade) || 0) + quantidade };
    // Linha antiga (gravada antes de existir `itemId`) aprende o id agora.
    if (itemId && !lista[i].itemId) lista[i].itemId = itemId;
    return lista;
  }

  lista.push({
    ...item,
    ...(itemId ? { itemId } : {}),
    quantidade,
    ...(opcoes.formaRecebimento ? { formaRecebimento: opcoes.formaRecebimento } : {}),
  });
  return lista;
}

module.exports = { assinaturaDeEfeito, ehMesmaLinha, acharLinha, empilhar, CAMPOS_DE_EFEITO };
