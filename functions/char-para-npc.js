// =============================================
// FICHA → NPC — parte pura
//
// Quando o jogador entrega o personagem ao mestre, ele vira NPC. As duas
// estruturas não se parecem: a ficha é um despejo do formulário (`fields` por
// data-key, `dots` por chave com slug), e o NPC é um documento com referências
// por id ao catálogo. Este arquivo é a tradução — e o que NÃO traduz vira texto
// na história do NPC, em vez de sumir em silêncio.
//
// Sem Firestore: `node functions/char-para-npc.test.mjs`.
// =============================================

const SIGLAS = ["FOR", "DES", "VIG", "INT", "RAC", "PRS", "PRE", "MAN", "AUT"];

/** Mesmo slug que a ficha usa para montar as chaves de perícia. */
function slug(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/__+/g, "_");
}

/**
 * Índice slug → id do catálogo de perícias.
 * A ficha grava `sk_<categoria>_<slug do nome>`; o NPC quer o id do documento.
 * Sem este mapa, toda perícia se perderia na conversão.
 */
function indicePericias(skills = []) {
  const mapa = {};
  for (const s of skills) {
    if (!s || !s.nome || !s.id) continue;
    mapa[slug(s.nome)] = s.id;
  }
  return mapa;
}

const inteiro = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Traduz a ficha num documento de NPC.
 *
 * @param {object} char      documento da coleção `char`
 * @param {object} opcoes
 * @param {Array}  opcoes.skills   catálogo `system/data/skills` (para o slug→id)
 * @param {string} opcoes.autor    e-mail de quem converteu
 * @param {string} opcoes.charId   id da ficha de origem (rastro)
 * @returns {{npc: object, perdido: string[]}}
 */
function charParaNpc(char, opcoes = {}) {
  // `= {}` no parâmetro só cobre undefined; um doc que veio null cairia aqui.
  char = char || {};
  const f = char.fields || {};
  const dots = char.dots || {};
  const mapaPericias = indicePericias(opcoes.skills);

  // --- atributos: dots.attr_for → atributos.FOR ---
  const atributos = {};
  for (const sigla of SIGLAS) {
    atributos[sigla] = inteiro(dots["attr_" + sigla.toLowerCase()]);
  }

  // --- perícias: sk_<cat>_<slug> → {refId, nivel} ---
  const periciasEstruturadas = [];
  const periciasSemCatalogo = [];
  for (const [chave, valor] of Object.entries(dots)) {
    const m = /^sk_(?:mental|fisico|social|combate|exclusivo|classe)_(.+)$/.exec(chave);
    if (!m) continue;
    const nivel = inteiro(valor);
    if (nivel <= 0) continue;
    const refId = mapaPericias[m[1]];
    if (refId) periciasEstruturadas.push({ refId, nivel });
    else periciasSemCatalogo.push(`${m[1].replace(/_/g, " ")} ${nivel}`);
  }

  // --- peculiaridades: a chave JÁ é o id do catálogo ---
  const peculiaridades = [];
  for (const [chave, valor] of Object.entries(dots)) {
    if (!chave.startsWith("pec_")) continue;
    const nivel = inteiro(valor);
    if (nivel <= 0) continue;
    peculiaridades.push({ refId: chave.slice(4), nivel });
  }
  // As avulsas não têm id de catálogo: entram pelo nome, como o painel aceita.
  for (const p of char.peculiaridadesIndividuais || []) {
    if (!p) continue;
    peculiaridades.push({
      refId: null,
      nomeCustom: p.nome || p.nomeCustom || "Peculiaridade",
      efeitoManual: p.efeito || p.efeitoManual || "",
      nivel: inteiro(p.nivel) || 1,
    });
  }

  /* O que a ficha tem e o NPC não comporta. Vai para a história em vez de
     evaporar: o mestre lê e decide o que aproveitar. */
  const perdido = [];
  const anotar = (rotulo, texto) => { if (texto) perdido.push(`${rotulo}: ${texto}`); };

  anotar("EXP", `${f.exp_total || 0} total, ${f.exp || 0} disponível`);
  if (char.expVip) anotar("EXP VIP aplicado", String(char.expVip));
  anotar("Idade", f.idade);
  anotar("Aparência", f.aparencia);
  anotar("Virtude", f.virtude);
  anotar("Vício", f.vicio);
  anotar("Medo", f.medo);
  if (periciasSemCatalogo.length) anotar("Perícias sem correspondência no catálogo", periciasSemCatalogo.join(", "));
  const notas = (char.notes || []).map(n => `${n.titulo || "Nota"}: ${String(n.conteudo || "").replace(/<[^>]+>/g, " ").trim()}`)
    .filter(t => t.length > 6);
  if (notas.length) perdido.push("Notas do jogador — " + notas.join(" | "));
  if (char.runomancia && (char.runomancia.aprendidos || []).length) {
    anotar("Runomancia", `${char.runomancia.aprendidos.length} runa(s) aprendida(s)`);
  }
  if (Object.keys(char.mecanicasAplicadas || {}).length) {
    anotar("Mecânicas com escolha do jogador", `${Object.keys(char.mecanicasAplicadas).length} — o motor do NPC recalcula do zero`);
  }

  const nome = f.nome || char.nome || "Personagem sem nome";
  const historia = [
    `Era um personagem de jogador, entregue ao mestre em ${new Date().toISOString().split("T")[0]}.`,
    perdido.length ? "O que a ficha tinha e o NPC não guarda — " + perdido.join(" · ") : "",
  ].filter(Boolean).join("\n\n");

  const npc = {
    schemaVersion: 2,
    nome,
    tipo: "npc",
    modoFicha: "mecanico",
    imagem: char.charImg || char.characterImage || "",
    // A ficha não tem nível: ela conta EXP. 1 é o default do painel, e o mestre
    // ajusta — chutar um nível a partir de EXP seria inventar régua.
    nivel: 1,
    ai: 1,
    porte: "",
    papel: "Ex-personagem de jogador",
    local: "",
    tamanho: f.altura || f.tamanho || "",
    tags: "ex-jogador",
    funcao: [],
    aliadoProprio: false,
    visibilidade: "secreto",

    // Strings legadas: o normalize do painel resolve para refId pelo nome.
    raca: f.raca || "",
    classe: f.classe || "",
    tribo: f.tribo || "",

    atributos,
    periciasEstruturadas,
    peculiaridades,
    modulosClasse: [],
    partesDoCorpo: char.partesDoCorpo || [],

    /* Sem overrides de propósito: gravar os totais congelados da ficha
       impediria o motor do NPC de recalcular, e os dois modelos de cálculo não
       são o mesmo. Melhor o painel recalcular do zero. */
    valoresDer: { overrides: {}, atual: {}, extras: [], vinculados: [] },

    ataques: "",
    skills: "",
    rolePlay: {
      personalidade: [], trejeitos: "", motivacao: "", segredos: "",
      relacoes: { aliado: "", rival: "", devedor: "" },
      frases: "", historia,
    },
    loot: { itens: "", luns: "", pistas: "", complicacoes: "" },
    criatura: null,
    eco: null,

    vinculos: [],
    mesaId: "",

    // Rastro: de qual ficha veio e quem entregou.
    origemCharId: opcoes.charId || "",
    origemJogador: opcoes.autor || "",
    createdVia: "entrega-do-jogador",
    lastUpdate: new Date().toISOString(),
    lastUpdateBy: opcoes.autor || "",
  };

  // Mesa: o NPC nasce na mesa em que o personagem jogava.
  const mesa = char.mesaId || (char.mesaVinculada && char.mesaVinculada.id) || "";
  if (mesa) {
    npc.mesaId = mesa;
    npc.vinculos = [{ tipo: "mesa", id: mesa }];
  }

  return { npc, perdido };
}

/** 60% do EXP VIP aplicado, arredondado. É o que volta ao Repertório. */
function devolucaoExpVip(expVip, fracao = 0.6) {
  const n = Number(expVip);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * fracao);
}

/** A linha que entra no Repertório com o EXP devolvido. */
function itemDevolucao(quantidadeExp, nomePersonagem) {
  return {
    nome: `EXP+ recuperado (${nomePersonagem})`,
    descricao: `60% do EXP VIP que estava aplicado em ${nomePersonagem}, devolvido ao encerrar o personagem. Pode ser aplicado em outro.`,
    quantidade: 1,
    isExp: true,
    expAmount: quantidadeExp,
    isExpVip: true,
    isVendaAtiva: false,
    formaRecebimento: "Devolução de EXP VIP",
  };
}

module.exports = { charParaNpc, devolucaoExpVip, itemDevolucao, indicePericias, slug };
