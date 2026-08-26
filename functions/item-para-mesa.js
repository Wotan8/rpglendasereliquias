// =============================================
// ITEM DO REPERTÓRIO → CAIXA DO MESTRE — parte pura
//
// O Repertório guarda promessas ("Informação x1", "Aliado por 1 missão"); a
// Caixa do Mestre guarda instâncias de equipamento, com peso, slot e mecânica.
// Não são a mesma coisa, e é por isso que existe tradução: o item vai para a
// caixa no formato que o painel do mestre sabe desenhar, marcado com de onde
// veio, para o mestre saber que aquilo é uma peça a colocar no mundo — e não
// um equipamento que ele mesmo cadastrou.
//
// Sem Firestore: `node functions/item-para-mesa.test.mjs`.
// =============================================

const PREFIXO_CAIXA = "__caixa_mestre__";

/** O "dono virtual" da caixa de uma mesa. É assim que o painel a encontra. */
function idDaCaixa(mesaId) {
  return PREFIXO_CAIXA + mesaId;
}

/**
 * Monta o documento de `items` para a caixa do mestre.
 * Os valores de peso/tamanho/pressão nascem no mínimo (1) porque item de
 * Repertório não tem essas medidas — e um campo ausente faz o motor de
 * inventário calcular carga com `undefined`.
 *
 * @param {object} item   linha do Repertório
 * @param {object} ctx    { mesaId, quantidade, jogadorUid, jogador, agora }
 */
function itemParaCaixa(item, ctx = {}) {
  const quantidade = Math.max(1, parseInt(ctx.quantidade, 10) || 1);
  const agora = ctx.agora || new Date().toISOString();
  const id = "item-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);

  return {
    id,
    nome: item.nome || "Item sem nome",
    descricao: item.descricao || "",
    imagem: item.imagem || "",
    quantidade,

    // Medidas mínimas: o motor de inventário divide e soma com elas.
    peso: 1,
    tamanho: 1,
    pressaoBase: 1,

    // Nada disto é equipamento de verdade, então nasce desarmado.
    ehContainer: false,
    equipavelEm: null,
    formaEquipar: "",
    categoriaArma: null,
    mecanicaIdsProprias: [],
    modeloId: null,
    equipado: false,
    slotAnatomico: null,
    estadoEquip: null,
    parentItemId: null,
    pesoMaximoContainer: null,
    multiplicadorPressao: null,
    capacidadeContainer: null,

    // Dono: a caixa da mesa.
    characterId: idDaCaixa(ctx.mesaId),
    ownerType: "caixa",
    ownerUid: "",

    /* A marca de origem. Sem ela, o mestre abre a caixa e vê uma peça
       anônima no meio do equipamento que ele mesmo pôs lá. */
    criadoPor: "jogador",
    origemRepertorio: true,
    origemJogadorUid: ctx.jogadorUid || "",
    origemJogador: ctx.jogador || "",
    origemItemNome: item.nome || "",
    lastModified: agora,
  };
}

/**
 * Tira N unidades da linha do Repertório. Devolve o inventário novo — o
 * original não é tocado. A linha some ao zerar.
 * @throws {Error} com `codigo`, para a callable traduzir
 */
function retirarDoRepertorio(inventario, nomeItem, quantidade) {
  const erro = (codigo, msg) => {
    const e = new Error(msg);
    e.codigo = codigo;
    return e;
  };

  const qtd = parseInt(quantidade, 10);
  if (!Number.isFinite(qtd) || qtd < 1) {
    throw erro("invalid-argument", "Escolha quantas unidades quer mandar.");
  }

  const lista = Array.isArray(inventario) ? inventario : [];
  const item = lista.find((i) => i && i.nome === nomeItem);
  if (!item) throw erro("not-found", `"${nomeItem}" não está no seu Repertório.`);

  const disponivel = Number(item.quantidade) || 0;
  if (qtd > disponivel) {
    throw erro("failed-precondition",
      `Você tem ${disponivel} de "${nomeItem}" e tentou mandar ${qtd}.`);
  }

  const novo = [];
  for (const linha of lista) {
    if (linha !== item) { novo.push(linha); continue; }
    const resta = disponivel - qtd;
    if (resta > 0) novo.push({ ...linha, quantidade: resta });
  }

  return { inventario: novo, item, restante: disponivel - qtd };
}

module.exports = { itemParaCaixa, retirarDoRepertorio, idDaCaixa, PREFIXO_CAIXA };
