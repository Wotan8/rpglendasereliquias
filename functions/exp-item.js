// =============================================
// APLICAR EXP DE UM ITEM DO REPERTÓRIO NUMA FICHA — parte pura
//
// Até aqui, comprar EXP na Loja só escrevia uma linha no Repertório: o número
// na ficha era somado à mão. Este módulo é a conta que faltava.
//
// Sem Firestore: dá para testar com `node functions/exp-item.test.mjs`.
// =============================================

const { assinaturaDeEfeito } = require("./repertorio");

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
 * As linhas que representam o MESMO item. Existe porque o inventário pode ter
 * várias: o painel do mestre acrescenta item sem empilhar, e em 01/09/2026 uma
 * conta tinha três linhas "EXP" (2, 1 e 1 unidades).
 *
 * A primeira linha com o nome define o que se está consumindo; as demais só
 * entram se fizerem a mesma coisa (mesma assinatura de efeito). Sem isso, um
 * homônimo com outro efeito seria consumido junto.
 */
function linhasDoItem(inventario, nome) {
  const lista = Array.isArray(inventario) ? inventario : [];
  const primeira = lista.findIndex((l) => l && l.nome === nome);
  if (primeira === -1) return [];
  const assinatura = assinaturaDeEfeito(lista[primeira]);
  const idxs = [];
  for (let i = 0; i < lista.length; i++) {
    const l = lista[i];
    if (l && l.nome === nome && assinaturaDeEfeito(l) === assinatura) idxs.push(i);
  }
  return idxs;
}

/**
 * Consome N unidades do item chamado `nome` e devolve o inventário novo.
 * A linha some quando zera — item com quantidade 0 no Repertório é entulho que
 * o jogador não consegue distinguir de item que ele ainda tem.
 * O array original NÃO é alterado.
 *
 * As linhas iguais são UM POÇO SÓ: consome da primeira, o que faltar vem da
 * seguinte. A versão anterior subtraía a quantidade pedida de CADA linha com
 * aquele nome — com três linhas de "EXP" (2,1,1), gastar 1 unidade apagava as
 * outras duas. EXP é comprado com dinheiro; sumir com ele em silêncio é a pior
 * coisa que este arquivo poderia fazer.
 */
function consumirUnidades(inventario, nome, quantidade) {
  const lista = Array.isArray(inventario) ? inventario : [];
  const alvos = new Set(linhasDoItem(lista, nome));
  let falta = Math.max(0, parseInt(quantidade, 10) || 0);

  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const linha = lista[i];
    if (!alvos.has(i)) { saida.push(linha); continue; }
    const tem = Number(linha.quantidade) || 0;
    const tirar = Math.min(tem, falta);
    falta -= tirar;
    const restante = tem - tirar;
    if (restante > 0) saida.push({ ...linha, quantidade: restante });
    // zerou → a linha inteira sai
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
  const idxs = linhasDoItem(inventario, nomeItem);
  if (idxs.length === 0) {
    throw erro("not-found", `"${nomeItem}" não está no seu Repertório.`);
  }
  const item = inventario[idxs[0]];

  const porUnidade = expDoItem(item);
  if (porUnidade <= 0) {
    throw erro("failed-precondition", `"${nomeItem}" não concede EXP.`);
  }

  /* Soma de TODAS as linhas iguais, não só a primeira. Quem tinha "EXP" em três
     linhas (2,1,1) só conseguia aplicar 2 das 4 unidades que possuía. */
  const disponivel = idxs.reduce((s, i) => s + (Number(inventario[i].quantidade) || 0), 0);
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

module.exports = { aplicarExpDeItem, consumirUnidades, linhasDoItem, expDoItem, numero };
