// =============================================
// PUSH — as duas decisões, fora do gatilho
// ---------------------------------------------
// O gatilho `avisarPush` (index.js) corre a cada escrita em `users/{uid}` —
// e são muitas: saldo, apoio, inventário, o próprio `fcmTokens`. Quase
// nenhuma delas é uma notificação nova. Decidir isso é a metade que
// importa, então mora aqui, onde dá para testar sem emulador.
// =============================================

/** Códigos com que o FCM diz "este endereço não existe mais". */
const TOKEN_MORTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * O que mandar para o aparelho — ou `null` quando não há o que mandar.
 *
 * `notifications` é uma pilha: quem escreve usa `unshift`. Então "chegou
 * coisa nova" é exatamente "o id do topo mudou". Comparar o array inteiro
 * daria falso positivo toda vez que a pilha estoura em 100 e perde a última.
 */
function avisoNovo(antes, depois) {
  const topo = ((depois && depois.notifications) || [])[0];
  if (!topo || !topo.id) return null;

  const topoAntes = ((antes && antes.notifications) || [])[0];
  if (topoAntes && topoAntes.id === topo.id) return null;

  // `isNew: false` é notificação que o servidor REESCREVEU (marcou como
  // lida, migrou de formato). Acordar o celular por causa disso é o jeito
  // mais rápido de o jogador desligar os avisos de vez.
  if (topo.isNew === false) return null;

  const texto = String(topo.message || "").trim().slice(0, 240);
  if (!texto) return null;

  return { texto, tag: String(topo.type || "aviso") };
}

/**
 * Os tokens que o envio provou mortos. Recebe a lista enviada e o
 * `responses` do `sendEachForMulticast` — mesma ordem, é o contrato da API.
 *
 * Só poda o que o FCM declarou inválido. Falha de rede ou cota também vem
 * como `success: false`, e tirar o aparelho por causa dela silenciaria os
 * avisos de alguém que não fez nada de errado.
 */
function tokensMortos(tokens, respostas) {
  const fora = [];
  (respostas || []).forEach((r, i) => {
    if (!r || r.success) return;
    const codigo = r.error && r.error.code;
    if (TOKEN_MORTO.has(codigo) && tokens[i]) fora.push(tokens[i]);
  });
  return fora;
}

module.exports = { avisoNovo, tokensMortos, TOKEN_MORTO };
