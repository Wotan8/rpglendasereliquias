// =============================================
// ENTREGA DE COMPRA EM DINHEIRO — parte pura
// Recebe o estado atual do jogador e devolve os arrays já atualizados.
// Sem Firestore aqui: dá para testar com `node functions/entrega-calc.test.mjs`.
// =============================================

/**
 * @param {object} data    documento atual do usuário
 * @param {object} item    item da loja (doc completo, vai inteiro pro inventário)
 * @param {object} pending doc de compras_pendentes
 * @param {string} origem  rótulo do meio de pagamento ("PagBank" | "Dinheiro")
 */
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

  return { inventario, logsCompra, apoios, notifications, quantidade, totalCentavos, valorReais };
}

module.exports = { aplicarCompra };
