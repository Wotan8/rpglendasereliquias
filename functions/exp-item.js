// =============================================
// APLICAR EXP DE UM ITEM DO REPERTÓRIO NUMA FICHA — parte pura
//
// Até aqui, comprar EXP na Loja só escrevia uma linha no Repertório: o número
// na ficha era somado à mão. Este módulo é a conta que faltava.
//
// Sem Firestore: dá para testar com `node functions/exp-item.test.mjs`.
// =============================================

/** Campo de EXP da ficha vem como texto ("140"), às vezes vazio. */
function numero(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Quanto EXP uma unidade do item concede. Zero significa "este item não é EXP",
 * e é o que impede de aplicar um amuleto como se fosse experiência.
 */
function expDoItem(item) {
  if (!item || !item.isExp) return 0;
  const n = Number(item.expAmount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Consome N unidades do item chamado `nome` e devolve o inventário novo.
 * A linha some quando zera — item com quantidade 0 no Repertório é entulho que
 * o jogador não consegue distinguir de item que ele ainda tem.
 * O array original NÃO é alterado.
 */
function consumirUnidades(inventario, nome, quantidade) {
  const saida = [];
  for (const linha of inventario) {
    if (linha.nome !== nome) { saida.push(linha); continue; }
    const restante = (Number(linha.quantidade) || 0) - quantidade;
    if (restante > 0) saida.push({ ...linha, quantidade: restante });
    // restante <= 0 → a linha inteira sai
  }
  return saida;
}

/**
 * A operação completa, sem tocar em banco.
 *
 * @param {object} usuario doc do jogador (precisa de `inventario`)
 * @param {object} fichaFields `char.fields` do personagem escolhido
 * @param {string} nomeItem nome exato da linha do Repertório
 * @param {number} quantidade quantas unidades gastar
 * @returns {{inventario:Array, exp:number, expTotal:number, ganho:number,
 *            porUnidade:number, vip:boolean, restante:number}}
 * @throws {Error} com `codigo` legível, para a callable traduzir em HttpsError
 */
function aplicarExpDeItem(usuario, fichaFields, nomeItem, quantidade) {
  const erro = (codigo, msg) => {
    const e = new Error(msg);
    e.codigo = codigo;
    return e;
  };

  const qtd = parseInt(quantidade, 10);
  if (!Number.isFinite(qtd) || qtd < 1) {
    throw erro("invalid-argument", "Escolha quantas unidades quer usar.");
  }

  const inventario = (usuario && usuario.inventario) || [];
  const item = inventario.find((i) => i && i.nome === nomeItem);
  if (!item) {
    throw erro("not-found", `"${nomeItem}" não está no seu Repertório.`);
  }

  const porUnidade = expDoItem(item);
  if (porUnidade <= 0) {
    throw erro("failed-precondition", `"${nomeItem}" não concede EXP.`);
  }

  const disponivel = Number(item.quantidade) || 0;
  if (qtd > disponivel) {
    throw erro("failed-precondition",
      `Você tem ${disponivel} de "${nomeItem}" e tentou usar ${qtd}.`);
  }

  const ganho = porUnidade * qtd;
  const f = fichaFields || {};

  // O MESMO par que o log de sessão move: `exp` é o que sobra para gastar,
  // `exp_total` é o acumulado da vida do personagem. Mexer só num dos dois
  // deixaria a ficha mentindo sobre o próprio histórico.
  return {
    inventario: consumirUnidades(inventario, nomeItem, qtd),
    exp: numero(f.exp) + ganho,
    expTotal: numero(f.exp_total) + ganho,
    ganho,
    porUnidade,
    vip: !!item.isExpVip,
    restante: disponivel - qtd,
  };
}

module.exports = { aplicarExpDeItem, consumirUnidades, expDoItem, numero };
