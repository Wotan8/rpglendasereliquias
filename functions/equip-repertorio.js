// =============================================
// EQUIPAMENTO DE UM ITEM DO REPERTÓRIO — parte pura
//
// Um item da Loja pode carregar equipamento (`personagemItensVinculados`):
// compre o "Kit do Batedor" e a ficha ganha a corda, o pé de cabra e a lanterna.
//
// O QUE ESTAVA QUEBRADO. Isso só acontecia dentro do assistente de criação
// (finale-module.js materializa os itens ao gravar a ficha). Comprado DEPOIS,
// o pacote caía no Repertório e parava ali: o jogador via a etiqueta
// "🎒 Equipamentos especiais" e nenhum equipamento chegava a personagem
// nenhum. Quem comprou depois da criação pagou por nada.
//
// Este módulo é a conta; quem lê o catálogo e grava os `items` é a callable.
//
// Sem Firestore: `node functions/equip-repertorio.test.mjs`.
// =============================================

const { linhasDoItem, consumirUnidades } = require("./exp-item");

/**
 * O que o item entrega, normalizado.
 *
 * Aceita as DUAS formas porque as duas existem no banco: o cadastro antigo
 * guardava só o id (`["eq1", "eq2"]`) e o de hoje guarda `{itemId, quantidade}`.
 * O assistente de criação já lia as duas — ler só a nova aqui faria o pacote
 * antigo entregar zero itens, em silêncio.
 */
function equipamentosDoItem(item) {
  const lista = (item && item.personagemItensVinculados) || [];
  if (!Array.isArray(lista)) return [];
  return lista
    .map((eq) => {
      if (typeof eq === "string") return { equipId: eq, porUnidade: 1 };
      if (!eq) return null;
      const id = eq.itemId || eq.id || "";
      if (!id) return null;
      const n = Math.floor(Number(eq.quantidade));
      return { equipId: String(id), porUnidade: Number.isFinite(n) && n > 0 ? n : 1 };
    })
    .filter(Boolean);
}

/**
 * O que entregar e o que sobra no Repertório, sem tocar em banco.
 *
 * @param {object} usuario   doc do jogador (precisa de `inventario`)
 * @param {string} nomeItem  nome exato da linha do Repertório
 * @param {number} unidades  quantas unidades do pacote gastar
 * @returns {{inventario:Array, entregas:Array<{equipId:string,quantidade:number}>,
 *            restante:number, item:object}}
 * @throws {Error} com `codigo`, para a callable virar HttpsError
 */
function planejarEntrega(usuario, nomeItem, unidades) {
  const erro = (codigo, msg) => {
    const e = new Error(msg);
    e.codigo = codigo;
    return e;
  };

  const qtd = parseInt(unidades, 10);
  if (!Number.isFinite(qtd) || qtd < 1) {
    throw erro("invalid-argument", "Escolha quantas unidades quer usar.");
  }

  const inventario = (usuario && usuario.inventario) || [];
  const idxs = linhasDoItem(inventario, nomeItem);
  if (idxs.length === 0) {
    throw erro("not-found", `"${nomeItem}" não está no seu Repertório.`);
  }
  const item = inventario[idxs[0]];

  const equipamentos = equipamentosDoItem(item);
  if (equipamentos.length === 0) {
    throw erro("failed-precondition", `"${nomeItem}" não traz equipamento nenhum.`);
  }

  /* Soma de TODAS as linhas iguais, pela mesma razão do EXP: o painel do
     mestre acrescenta item sem empilhar, e quem tem o pacote em duas linhas
     só conseguiria usar as unidades da primeira. */
  const disponivel = idxs.reduce((s, i) => s + (Number(inventario[i].quantidade) || 0), 0);
  if (qtd > disponivel) {
    throw erro("failed-precondition",
      `Você tem ${disponivel} de "${nomeItem}" e tentou usar ${qtd}.`);
  }

  return {
    inventario: consumirUnidades(inventario, nomeItem, qtd),
    entregas: equipamentos.map((e) => ({ equipId: e.equipId, quantidade: e.porUnidade * qtd })),
    restante: disponivel - qtd,
    item,
  };
}

module.exports = { equipamentosDoItem, planejarEntrega };
