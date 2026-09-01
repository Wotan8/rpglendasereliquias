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
const { empilhar } = require("./repertorio");

/** Quantas compras ficam guardadas no documento do jogador. Ver o comentário
 *  no `aplicarCompra`. Hoje o maior histórico tem 16 linhas. */
const MAX_LOGS_COMPRA = 100;

/**
 * Quanto UMA unidade do item rende na meta a que está vinculado.
 * É o que faz a "Roleta 3x" valer 3 de Lore numa compra só, em vez de 1.
 * Ausente ou inválido vale 1 — nenhum item antigo muda de valor.
 */
function pesoProducao(item) {
  const p = Number(item?.pesoProducao);
  return Number.isFinite(p) && p >= 0 ? p : 1;
}

/**
 * Quantas re-rolagens um item da Loja concede. Gêmeo de `girosDoItem`: o campo
 * `isRerolagem`/`rerolagensAmount` do cadastro era só uma etiqueta no card.
 */
function rerolagensDoItem(item, quantidade = 1) {
  if (!item || !item.isRerolagem) return 0;
  const porUnidade = Number(item.rerolagensAmount) || 0;
  const qtd = parseInt(quantidade) || 1;
  return porUnidade > 0 ? porUnidade * qtd : 0;
}

function aplicarCompra(data, item, pending, origem) {
  const quantidade = pending.quantidade || 1;
  const totalCentavos = pending.totalCentavos || pending.valorCentavos;
  const valorReais = (totalCentavos / 100).toFixed(2).replace(".", ",");

  /* Empilha só no que é a MESMA coisa — ver `repertorio.js`. Antes juntava por
     nome, e a linha que sobrevivia era a antiga, com os campos dela: duas peças
     de mesmo nome no catálogo faziam a barata herdar o EXP da cara. */
  const inventario = empilhar(data.inventario, item, {
    quantidade,
    itemId: pending.itemId,
    formaRecebimento: `Comprado na Loja (${origem})`,
  });

  const logsCompra = data.logsCompra || [];
  logsCompra.push({
    itemId: pending.itemId,
    nome: item.nome,
    valorPago: totalCentavos,
    moeda: "BRL",
    compraId: pending.compraId,
    data: new Date().toISOString(),
  });
  /* Teto, como `notifications` já tem. É a única lista do documento que cresce
     para sempre por desenho: inventário sobe e desce, apoio acompanha a meta,
     mas compra nunca é desfeita. Documento de usuário morre em 1 MB, e morrer
     ali significa não conseguir mais NEM COMPRAR.
     Cortar aqui não perde história: a trilha imutável e completa está em
     `real_logs`/`frag_logs`. Isto é a cópia de conveniência que o painel do
     mestre desenha. */
  if (logsCompra.length > MAX_LOGS_COMPRA) logsCompra.splice(0, logsCompra.length - MAX_LOGS_COMPRA);

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
  const rerolagens = (data.rerolagens || 0) + rerolagensDoItem(item, quantidade);

  return { inventario, logsCompra, apoios, notifications, quantidade, totalCentavos, valorReais, giros, rerolagens };
}

module.exports = { aplicarCompra, pesoProducao, rerolagensDoItem, MAX_LOGS_COMPRA };
