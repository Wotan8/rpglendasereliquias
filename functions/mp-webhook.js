// =============================================
// MERCADO PAGO — WEBHOOK, parte pura
//
// O webhook já fazia a coisa mais importante: nunca acreditar no corpo da
// notificação, e reconsultar /v1/payments/{id} com o token antes de entregar.
// Faltavam três coisas, e as três moram aqui porque são decisão, não I/O:
//
//   1. conferir a ASSINATURA — o endpoint é público e sem autenticação;
//   2. conferir o VALOR — "approved" não diz aprovado por quanto;
//   3. reconhecer ESTORNO — o dinheiro voltava e o benefício ficava.
//
// Sem Firestore: `node functions/mp-webhook.test.mjs`.
// =============================================

const crypto = require("crypto");

/**
 * Confere a assinatura `x-signature` do Mercado Pago.
 *
 * O MP manda `x-signature: ts=1704908010,v1=<hmac>` e `x-request-id`. O HMAC
 * é SHA-256, com a chave secreta do painel do MP, sobre o manifesto:
 *
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Partes ausentes saem do manifesto — é assim que o MP monta do lado dele.
 * O `data.id` entra em minúsculas quando é alfanumérico, regra do próprio MP.
 *
 * @returns {{ok: boolean, motivo: string}}
 */
function conferirAssinatura({ xSignature, xRequestId, dataId, secret }) {
  if (!secret) return { ok: false, motivo: "sem-secret" };
  if (!xSignature) return { ok: false, motivo: "sem-assinatura" };

  const partes = {};
  for (const p of String(xSignature).split(",")) {
    const i = p.indexOf("=");
    if (i > 0) partes[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return { ok: false, motivo: "assinatura-incompleta" };

  const id = dataId == null ? "" : String(dataId).toLowerCase();
  let manifesto = "";
  if (id) manifesto += `id:${id};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${ts};`;

  const esperado = crypto.createHmac("sha256", secret).update(manifesto).digest("hex");

  // Comparação em tempo constante. Buffers de tamanhos diferentes fazem
  // timingSafeEqual lançar, então o tamanho é conferido antes.
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(String(v1), "utf8");
  if (a.length !== b.length) return { ok: false, motivo: "assinatura-invalida" };
  return crypto.timingSafeEqual(a, b)
    ? { ok: true, motivo: "" }
    : { ok: false, motivo: "assinatura-invalida" };
}

/**
 * O que o pagamento significa para a compra.
 *
 * `cancelled` só é estorno quando a compra JÁ tinha sido entregue; antes disso
 * é só um pagamento abandonado, que não precisa assustar ninguém.
 * Estorno parcial não muda o `status` do pagamento no MP: aparece em
 * `transaction_amount_refunded`, e por isso é olhado aqui também.
 */
function classificarPagamento(pay) {
  const status = String(pay?.status || "");
  if (["refunded", "charged_back"].includes(status)) return "estornado";
  if (status === "cancelled") return "cancelado";
  if (status === "approved") {
    return Number(pay?.transaction_amount_refunded) > 0 ? "estornado" : "aprovado";
  }
  return "pendente";
}

/**
 * Quanto esta compra deveria ter custado, em centavos.
 * `cobradoCentavos` é o canônico (item + taxa do gateway). As pendências
 * anteriores ao repasse de taxa só têm `totalCentavos`, e ali o preço do item
 * ERA o valor cobrado — daí o fallback.
 */
function valorEsperado(pending) {
  const cobrado = Number(pending?.cobradoCentavos);
  if (Number.isFinite(cobrado) && cobrado > 0) return cobrado;
  const total = Number(pending?.totalCentavos);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * "approved" não diz aprovado POR QUANTO. Sem esta conferência, qualquer
 * pagamento aprovado na conta entregava a compra inteira, fosse qual fosse o
 * valor.
 *
 * Pagar a MAIS passa (o troco não é problema do sistema); pagar a menos, não.
 * A tolerância de 1 centavo existe porque o MP fala em reais com ponto
 * flutuante e o nosso número é inteiro em centavos.
 *
 * @returns {{ok:boolean, esperado:number, pago:number, motivo:string}}
 */
function conferirValorPago(pending, pay) {
  const esperado = valorEsperado(pending);
  const bruto = Number(pay?.transaction_amount);
  const pago = Number.isFinite(bruto) ? Math.round(bruto * 100) : 0;

  if (esperado <= 0) return { ok: false, esperado, pago, motivo: "sem-valor-de-referencia" };
  if (pago <= 0) return { ok: false, esperado, pago, motivo: "sem-valor-pago" };
  if (pago < esperado - 1) return { ok: false, esperado, pago, motivo: "valor-menor" };
  return { ok: true, esperado, pago, motivo: "" };
}

/** Centavos → "R$ 12,34", para mensagem de aviso. */
function reais(centavos) {
  return "R$ " + (Number(centavos) / 100).toFixed(2).replace(".", ",");
}

module.exports = {
  conferirAssinatura,
  classificarPagamento,
  conferirValorPago,
  valorEsperado,
  reais,
};
