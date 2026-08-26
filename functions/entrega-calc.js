// =============================================
// ENTREGA DE COMPRA EM DINHEIRO — parte pura
// Recebe o estado atual do jogador e devolve os arrays já atualizados.
// Sem Firestore aqui: dá para testar com `node functions/entrega-calc.test.mjs`.
// =============================================

/**
 * @param {object} data    documento atual do usuário
 * @param {object} item    item da loja (doc completo, vai inteiro pro inventário)
 * @param {object} pending doc de compras_pendentes
 * @param {string} origem  rótulo do meio de pagamento ("Mercado Pago" | "Dinheiro")
 */
const { girosDoItem } = require("./roleta-sorteio");

/**
 * Quanto UMA unidade do item rende na meta a que está vinculado.
 * É o que faz a "Roleta 3x" valer 3 de Lore numa compra só, em vez de 1.
 * Ausente ou inválido vale 1 — nenhum item antigo muda de valor.
 */
function pesoProducao(item) {
  const p = Number(item?.pesoProducao);
  return Number.isFinite(p) && p >= 0 ? p : 1;
}

function aplicarCompra(data, item, pending, origem) {
  const quantidade = pending.quantidade || 1;
  const totalCentavos = pending.totalCentavos || pending.valorCentavos;
  const valorReais = (totalCentavos / 100).toFixed(2).replace(".", ",");

  const inventario = data.inventario || [];
  const existingItemIndex = inventario.findIndex((i) => i.nome === item.nome);
  if (existingItemIndex !== -1) {
    inventario[existingItemIndex].quantidade =
      (inventario[existingItemIndex].quantidade || 1) + quantidade;
  } else {
    inventario.push({
      ...item,
      quantidade,
      formaRecebimento: `Comprado na Loja (${origem})`,
    });
  }

  const logsCompra = data.logsCompra || [];
  logsCompra.push({
    itemId: pending.itemId,
    nome: item.nome,
    valorPago: totalCentavos,
    moeda: "BRL",
    compraId: pending.compraId,
    data: new Date().toISOString(),
  });

  const apoios = data.apoios || [];
  apoios.push({
    nome: item.nome,
    tipo: `Loja (${origem})`,
    montante: quantidade,
    meta: (pending.selectedMetas || []).join(","),
    valor: valorReais,
    dataInicio: new Date().toISOString().split("T")[0],
    recebido: true,
    // Só grava quando é diferente de 1 — apoio antigo sem o campo já vale 1,
    // e escrever o padrão em todo mundo só engordaria o documento.
    ...(pesoProducao(item) !== 1 ? { peso: pesoProducao(item) } : {}),
  });

  const notifications = data.notifications || [];
  notifications.unshift({
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    type: "master_message",
    message: `💳 Compra Aprovada: Você adquiriu ${quantidade}x ${item.nome} por R$ ${valorReais}.`,
    timestamp: Date.now(),
    isNew: true,
    data: { highlight: "importante" },
  });
  if (notifications.length > 100) notifications.length = 100;

  // Item de roleta vira saldo de giros, e não uma peça parada no inventário
  // que ninguém sabe usar. A peça continua entrando (é o comprovante), mas o
  // que o jogador gasta é o contador.
  const giros = (data.giros || 0) + girosDoItem(item, quantidade);

  return { inventario, logsCompra, apoios, notifications, quantidade, totalCentavos, valorReais, giros };
}

module.exports = { aplicarCompra, pesoProducao };
