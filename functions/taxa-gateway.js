// =============================================
// REPASSE DA TAXA DO GATEWAY — parte pura
// O jogador paga a taxa do Mercado Pago; a mesa recebe o valor cheio do item.
// Sem Firestore aqui: dá para testar com `node functions/taxa-gateway.test.mjs`.
// =============================================

// Fallback usado só quando `config/pagamento` não existe no Firestore.
// Números de referência do Checkout Pro com liberação na hora (agosto/2026).
// O valor REAL varia por conta e por prazo de recebimento — o mestre ajusta
// pelo documento no banco, sem precisar de deploy.
// `minimoCentavos` esconde o meio abaixo de um valor: os R$ 3,49 fixos do
// boleto encarecem um item de R$ 5,00 em 70%, o que espanta mais do que vende.
const TAXAS_PADRAO = {
  pix: { pct: 0.0099, fixo: 0, rotulo: "PIX" },
  credito: { pct: 0.0498, fixo: 0, rotulo: "Cartão de Crédito" },
  boleto: { pct: 0, fixo: 349, rotulo: "Boleto", minimoCentavos: 2000 },
};

/**
 * Quanto cobrar para que sobrem `subtotalCentavos` limpos depois da taxa.
 *
 * A taxa incide sobre o valor COBRADO, não sobre o do item — por isso é
 * divisão, não multiplicação. Somar 0,99% a R$ 5,00 devolveria R$ 5,05, e o
 * MP descontaria 0,99% de 5,05, deixando R$ 4,999: faltaria um centavo.
 * Arredonda para cima porque centavo quebrado quem paga é a mesa.
 *
 * @param {number} subtotalCentavos  valor limpo que a mesa precisa receber
 * @param {{pct:number,fixo:number}} taxa  fração (0,0099 = 0,99%) e parte fixa em centavos
 * @returns {{totalCentavos:number, taxaCentavos:number}}
 */
function calcularCobranca(subtotalCentavos, taxa) {
  const pct = Number(taxa?.pct) || 0;
  const fixo = Number(taxa?.fixo) || 0;
  if (pct < 0 || pct >= 1) throw new Error("Percentual de taxa inválido: " + pct);

  const totalCentavos = Math.ceil((subtotalCentavos + fixo) / (1 - pct));
  return { totalCentavos, taxaCentavos: totalCentavos - subtotalCentavos };
}

// Meios que o Checkout Pro deve ESCONDER para cada escolha feita no carrinho.
// Sem isso o jogador escolheria Pix, pagaria no cartão e a taxa cobrada
// sairia menor que a real.
const EXCLUIR_POR_MEIO = {
  pix: ["credit_card", "debit_card", "ticket", "atm", "prepaid_card"],
  credito: ["ticket", "bank_transfer", "atm", "account_money", "debit_card"],
  boleto: ["credit_card", "debit_card", "bank_transfer", "account_money", "prepaid_card"],
};

module.exports = { TAXAS_PADRAO, calcularCobranca, EXCLUIR_POR_MEIO };
