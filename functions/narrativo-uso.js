// =============================================
// BENEFÍCIO NARRATIVO — a conta de quantos usos sobraram
//
// O jogador compra "Desejo Narrativo" e a peça cai no Repertório. Até aqui
// ela ficava lá para sempre: não havia como GASTAR uma aplicação, e por isso
// `narrativoAplicacoes` nunca decrementava — o campo existia no cadastro,
// era gravado pelo painel do mestre, e ninguém no site inteiro o lia.
//
// A conta mora aqui, fora do gatilho, porque é a metade que erra: quantas
// aplicações uma linha ainda tem, e o que sobra dela depois de gastar uma.
//
// Sem Firestore: `node functions/narrativo-uso.test.mjs`.
// =============================================

/**
 * Quantas aplicações UMA unidade concede.
 *
 * Ausente e zero valem 1, e isso não é chute: dos dois itens narrativos do
 * catálogo em 02/09/2026, nenhum tem `narrativoAplicacoes` gravado — o campo
 * nasceu e nunca foi preenchido, provavelmente porque nunca apareceu em
 * lugar nenhum. Ler ausente como ZERO deixaria o jogador com uma peça
 * comprada e nenhum uso, que é pior do que o defeito original.
 */
function aplicacoesPorUnidade(linha) {
  const n = Math.floor(Number(linha && linha.narrativoAplicacoes));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Usos que a linha ainda tem: (unidades × aplicações) menos o que já saiu. */
function usosRestantes(linha) {
  if (!linha || !linha.isNarrativo) return 0;
  const unidades = Math.max(0, Math.floor(Number(linha.quantidade) || 0));
  const usadas = Math.max(0, Math.floor(Number(linha.narrativoUsadas) || 0));
  return Math.max(0, unidades * aplicacoesPorUnidade(linha) - usadas);
}

/**
 * Acha a linha narrativa que o jogador quer gastar.
 *
 * Com id dos dois lados o id manda — é a mesma regra de `repertorio.js`, e
 * pela mesma razão: o nome pode ter sido corrigido no catálogo. Sem id, cai
 * no nome, que é o que 30% das linhas antigas têm de identidade.
 */
function acharLinhaNarrativa(inventario, { itemId, nome }) {
  const lista = Array.isArray(inventario) ? inventario : [];
  return lista.findIndex((l) => {
    if (!l || !l.isNarrativo) return false;
    if (itemId && l.itemId) return l.itemId === itemId;
    return !!nome && l.nome === nome;
  });
}

/**
 * Gasta UMA aplicação e devolve `{ inventario, restantes, linha }` — ou lança
 * `Error` com a frase que o jogador vai ler.
 *
 * O array original não é tocado, como no resto do módulo de repertório.
 *
 * A linha SOME quando o último uso sai. Deixar uma peça zerada no Repertório
 * seria mostrar ao jogador um card que não faz nada e não dá para tirar — e
 * o inventário já é onde ele confere o que ainda tem.
 */
function gastarAplicacao(inventario, alvo) {
  const lista = Array.isArray(inventario) ? [...inventario] : [];
  const i = acharLinhaNarrativa(lista, alvo || {});
  if (i === -1) throw new Error("Você não tem esse benefício narrativo no Repertório.");

  const linha = lista[i];
  const restavam = usosRestantes(linha);
  if (restavam < 1) throw new Error("Esse benefício já foi todo usado.");

  const restantes = restavam - 1;
  if (restantes === 0) lista.splice(i, 1);
  else {
    lista[i] = {
      ...linha,
      narrativoUsadas: (Math.max(0, Math.floor(Number(linha.narrativoUsadas) || 0))) + 1,
    };
  }
  return { inventario: lista, restantes, linha };
}

module.exports = { aplicacoesPorUnidade, usosRestantes, acharLinhaNarrativa, gastarAplicacao };
