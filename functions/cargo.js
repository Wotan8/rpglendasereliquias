// =============================================
// DECISÃO DE CARGO — parte pura
//
// Cargo era campo que o dono do documento escrevia: `role:'criador'` no
// console dava o catálogo inteiro. Agora `role` é campo protegido nas rules e
// só muda por aqui. Este módulo é a regra da decisão, sem banco — dá para
// testar com `node functions/cargo.test.mjs`.
// =============================================

const CARGOS = ["jogador", "mestre", "criador"];

const ROTULO = { jogador: "Jogador", mestre: "Mestre", criador: "Criador" };

/**
 * O que fazer com o pedido de cargo de uma conta.
 *
 * @param {object} alvo      doc do usuário: { role, cargoSolicitado }
 * @param {string|null} cargoNovo  cargo a conceder; `null`/ausente = recusa
 *                                 (só apaga o pedido, cargo não muda)
 * @returns {{role: string|null, decisao: 'aprovado'|'recusado',
 *            cargoAntes: string, cargoDepois: string, pedido: string,
 *            mensagem: string}}
 *          `role` null = não escrever o campo.
 * @throws {Error} com `codigo`, para a callable traduzir em HttpsError
 */
function decidirCargo(alvo, cargoNovo) {
  const erro = (codigo, msg) => {
    const e = new Error(msg);
    e.codigo = codigo;
    return e;
  };

  if (cargoNovo != null && !CARGOS.includes(cargoNovo)) {
    throw erro("invalid-argument", "Cargo inválido.");
  }

  const cargoAtual = (alvo && alvo.role) || "jogador";
  const pedido = (alvo && alvo.cargoSolicitado) || "";

  /* Criador não rebaixa Criador. A tela já mostrava o seletor desabilitado,
     mas desabilitado é enfeite: a trava tem de estar do lado que o navegador
     não alcança. */
  if (cargoAtual === "criador" && cargoNovo !== "criador") {
    throw erro("permission-denied", "Não dá para alterar o cargo de outro Criador.");
  }

  if (cargoNovo == null) {
    return {
      role: null,
      decisao: "recusado",
      cargoAntes: cargoAtual,
      cargoDepois: cargoAtual,
      pedido,
      mensagem: `🔐 Seu pedido de acesso${pedido ? ` como ${ROTULO[pedido] || pedido}` : ""}` +
        " não foi aprovado. Sua conta segue como Jogador.",
    };
  }

  return {
    role: cargoNovo,
    decisao: "aprovado",
    cargoAntes: cargoAtual,
    cargoDepois: cargoNovo,
    pedido,
    mensagem: `🔐 Seu cargo agora é ${ROTULO[cargoNovo]}. ` +
      "Recarregue a página para os painéis aparecerem.",
  };
}

module.exports = { decidirCargo, CARGOS, ROTULO };
