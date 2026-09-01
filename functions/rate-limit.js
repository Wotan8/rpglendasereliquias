// =============================================
// LIMITE DE CHAMADAS — parte pura
//
// Nenhuma callable tinha freio. Com um login válido (e o cadastro é aberto),
// dava para chamar `criarCheckoutMercadoPago` em laço: cada chamada cria uma
// preferência no Mercado Pago e um documento em `compras_pendentes`. Ninguém
// rouba nada com isso, mas enche a conta do MP de lixo, queima cota e custa
// dinheiro em invocação.
//
// Janela fixa, não deslizante: é uma linha de conta em vez de uma lista de
// carimbos de tempo por usuário. O preço é a borda — quem gasta o limite no
// fim de uma janela recomeça no início da seguinte. Para conter abuso de
// pagamento isso é suficiente; para contar dose de remédio, não seria.
//
// Sem Firestore: `node functions/rate-limit.test.mjs`.
// =============================================

/**
 * @param {{janelaInicio?: number, contagem?: number}|null} estado  doc atual
 * @param {number} agora        Date.now() de quem chama
 * @param {number} limite       chamadas permitidas por janela
 * @param {number} janelaMs     tamanho da janela
 * @returns {{permitido: boolean, estado: {janelaInicio: number, contagem: number},
 *            restam: number, esperarMs: number}}
 */
function decidirLimite(estado, agora, limite, janelaMs) {
  const inicio = Number(estado?.janelaInicio) || 0;
  const contagem = Number(estado?.contagem) || 0;

  // Janela vencida (ou primeira chamada): recomeça a contar.
  // `agora < inicio` cobre o relógio andando para trás — sem isso, uma janela
  // gravada no futuro tranca o usuário até aquele instante chegar.
  if (!inicio || agora - inicio >= janelaMs || agora < inicio) {
    return {
      permitido: true,
      estado: { janelaInicio: agora, contagem: 1 },
      restam: limite - 1,
      esperarMs: 0,
    };
  }

  if (contagem >= limite) {
    return {
      permitido: false,
      estado: { janelaInicio: inicio, contagem },
      restam: 0,
      esperarMs: janelaMs - (agora - inicio),
    };
  }

  return {
    permitido: true,
    estado: { janelaInicio: inicio, contagem: contagem + 1 },
    restam: limite - (contagem + 1),
    esperarMs: 0,
  };
}

/** "3 minutos", "45 segundos" — para a mensagem que o jogador lê. */
function esperaEmTexto(ms) {
  const seg = Math.ceil(Math.max(0, ms) / 1000);
  if (seg < 60) return `${seg} segundo${seg === 1 ? "" : "s"}`;
  const min = Math.ceil(seg / 60);
  return `${min} minuto${min === 1 ? "" : "s"}`;
}

module.exports = { decidirLimite, esperaEmTexto };
