// =============================================
// ROLETA — sorteio, parte pura
// O sorteio NUNCA acontece no navegador: o cliente só anima o resultado que
// já veio decidido daqui. Sem Firestore neste arquivo, então dá para testar
// com `node functions/roleta-sorteio.test.mjs`.
// =============================================

const crypto = require("crypto");
const { empilhar } = require("./repertorio");

/**
 * Normaliza os prêmios em pesos utilizáveis.
 * As chances do documento de mesa NÃO somam 100 (somam 96,6), então o que
 * vale é a PROPORÇÃO entre elas — dividir pelo total preserva exatamente a
 * régua que o mestre escreveu, sem precisar que ele feche a conta na unha.
 * Prêmio sem chance, com chance <= 0 ou não numérica fica de fora do sorteio.
 */
function premiosValidos(premios) {
  return (Array.isArray(premios) ? premios : [])
    .map((p, i) => ({ ...p, indice: i, chance: Number(p?.chance) }))
    .filter((p) => Number.isFinite(p.chance) && p.chance > 0);
}

/**
 * Sorteia um prêmio proporcionalmente à chance.
 * @param {Array} premios lista com { chance }
 * @param {() => number} rng gerador em [0,1) — injetável só para teste
 * @returns {{indice: number, premio: object, probabilidade: number}}
 */
function sortear(premios, rng = randomFloat) {
  const validos = premiosValidos(premios);
  if (validos.length === 0) throw new Error("A roleta não tem nenhum prêmio com chance válida.");

  const total = validos.reduce((s, p) => s + p.chance, 0);
  const alvo = rng() * total;

  let acumulado = 0;
  for (const p of validos) {
    acumulado += p.chance;
    // `<` e não `<=`: com alvo exatamente 0 o primeiro prêmio já ganha, e
    // nenhum sorteio pode escapar do laço por arredondamento.
    if (alvo < acumulado) {
      return { indice: p.indice, premio: p, probabilidade: p.chance / total };
    }
  }
  const ultimo = validos[validos.length - 1];
  return { indice: ultimo.indice, premio: ultimo, probabilidade: ultimo.chance / total };
}

/**
 * Float em [0,1) com entropia de verdade.
 * Math.random() é previsível o bastante para não decidir prêmio que vale
 * dinheiro; 6 bytes dão 48 bits, precisão suficiente e sem viés de módulo.
 */
function randomFloat() {
  return crypto.randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
}

/**
 * Quantos giros um item da Loja concede.
 * É o que transforma o campo `isRoleta`/`roletaGiros` do cadastro — até agora
 * só um rótulo no card — em saldo de verdade. "Roleta 3x" comprado 2 vezes
 * vira 6 giros.
 */
function girosDoItem(item, quantidade = 1) {
  if (!item || !item.isRoleta) return 0;
  const porUnidade = Number(item.roletaGiros) || 0;
  const qtd = parseInt(quantidade) || 1;
  return porUnidade > 0 ? porUnidade * qtd : 0;
}

/**
 * Entrega UM prêmio ao jogador. Mesmo empilhamento por nome do inventário das
 * compras, mas de propósito NÃO escreve `apoios` nem `logsCompra`: prêmio não
 * é apoio, e gravar apoio moveria o progresso das Metas da mesa inteira.
 * Um prêmio que por acaso seja item de roleta (a "Re-roleta") devolve giro,
 * e é isso que faz o giro de graça funcionar sem código especial.
 * @returns {{inventario: Array, notifications: Array, girosGanhos: number}}
 */
function aplicarPremio(data, item, itemId = "") {
  // Mesma regra da compra: só empilha no que é a mesma coisa (repertorio.js).
  const inventario = empilhar(data.inventario, item, {
    quantidade: 1,
    itemId,
    formaRecebimento: "Prêmio da Roleta",
  });

  const notifications = data.notifications || [];
  notifications.unshift({
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    type: "master_message",
    message: `🎰 A roleta parou em: ${item.nome}! O prêmio já está no seu Repertório.`,
    timestamp: Date.now(),
    isNew: true,
    data: { highlight: "importante" },
  });
  if (notifications.length > 100) notifications.length = 100;

  return { inventario, notifications, girosGanhos: girosDoItem(item, 1) };
}

module.exports = { sortear, premiosValidos, randomFloat, girosDoItem, aplicarPremio };
