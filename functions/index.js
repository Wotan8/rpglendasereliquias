// =============================================
// CLOUD FUNCTIONS — Lendas e Relíquias
// - comprarComFragmentos: compra segura na Loja (Admin SDK, ignora as rules)
// - registrarLogFragmentos: auditoria automática de TODA alteração de Frag$
// =============================================

const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { aplicarCompra, pesoProducao } = require("./entrega-calc");
const { TAXAS_PADRAO, calcularCobranca, EXCLUIR_POR_MEIO } = require("./taxa-gateway");
const { sortear, aplicarPremio, girosDoItem } = require("./roleta-sorteio");
const { aplicarExpDeItem } = require("./exp-item");
const { charParaNpc, devolucaoExpVip, itemDevolucao } = require("./char-para-npc");
const { itemParaCaixa, retirarDoRepertorio } = require("./item-para-mesa");

initializeApp();
const db = getFirestore();

// ---------------------------------------------
// Mercado Pago — configuração
// ---------------------------------------------
// Access Token fica em um Secret do Firebase (NUNCA no código nem no frontend):
//   firebase functions:secrets:set MP_ACCESS_TOKEN
// Credencial de TESTE (TEST-...) usa o modo sandbox; a de produção (APP_USR-...)
// cobra de verdade — trocar o secret é o único passo da virada.
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");

// Chave SECRETA do reCAPTCHA v3 (nunca vai para o frontend):
//   firebase functions:secrets:set RECAPTCHA_SECRET
const RECAPTCHA_SECRET = defineSecret("RECAPTCHA_SECRET");

// Nota mínima aceita (0.0 = provável bot, 1.0 = provável humano).
// 0.5 é o padrão recomendado pelo Google.
const RECAPTCHA_MIN_SCORE = 0.5;

// Verifica o token reCAPTCHA v3 no servidor. Lança HttpsError se reprovar.
async function verificarRecaptcha(token, acaoEsperada) {
  const secret = RECAPTCHA_SECRET.value();
  // Se o secret não estiver configurado, não bloqueia (permite operar antes do setup).
  if (!secret) {
    console.warn("RECAPTCHA_SECRET não configurado — verificação ignorada.");
    return;
  }
  if (!token) {
    throw new HttpsError("failed-precondition", "Verificação de segurança ausente. Recarregue a página e tente novamente.");
  }

  const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  });
  const data = await resp.json();

  if (!data.success) {
    console.warn("reCAPTCHA falhou:", data["error-codes"]);
    throw new HttpsError("permission-denied", "Falha na verificação de segurança. Tente novamente.");
  }
  if (typeof data.score === "number" && data.score < RECAPTCHA_MIN_SCORE) {
    console.warn("reCAPTCHA score baixo:", data.score);
    throw new HttpsError("permission-denied", "Não foi possível validar sua solicitação. Tente novamente.");
  }
  if (acaoEsperada && data.action && data.action !== acaoEsperada) {
    console.warn("reCAPTCHA action divergente:", data.action);
    throw new HttpsError("permission-denied", "Verificação de segurança inválida.");
  }
}

// API única para teste e produção — o que muda é a credencial no secret.
const MP_API = "https://api.mercadopago.com";

// URL pública do Hosting (projeto rpg-lendasereliquias)
const SITE_URL = "https://rpg-lendasereliquias.web.app";

// URL pública do webhook (formato determinístico das functions gen2 no
// cloudfunctions.net). Após o primeiro deploy, confirme com a URL impressa
// pelo `firebase deploy --only functions` — se vier no formato *.run.app,
// qualquer uma das duas funciona.
const WEBHOOK_URL =
  "https://southamerica-east1-rpg-lendasereliquias.cloudfunctions.net/mercadoPagoWebhook";

// Helper: resolve o valor em centavos de um item da loja.
// Canônico: `valorReal` (inteiro, centavos). Fallback: `valorRs` (reais, legado).
function getValorCentavos(item) {
  if (Number.isInteger(item.valorReal) && item.valorReal > 0) return item.valorReal;
  const rs = Number(item.valorRs);
  if (Number.isFinite(rs) && rs > 0) return Math.round(rs * 100);
  return 0;
}

// Helper: nomes das metas para os logs (mesmo comportamento da compra com Frag$)
async function getMetasNames(metas) {
  if (!metas || metas.length === 0) return "";
  const nomes = await Promise.all(
    metas.map(async (mId) => {
      const m = await db.collection("metas").doc(mId).get();
      return m.exists ? (m.data().nome || mId) : mId;
    })
  );
  return nomes.join(", ");
}

// ---------------------------------------------
// AVISO AO MESTRE
// O sistema sabia avisar o jogador (users.notifications), mas não tinha
// caminho de volta: nada conseguia chamar a atenção do mestre. Esta é a fila.
// Um documento por aviso, com status — o mesmo desenho que a antiga aba de
// compras usava, que é o que o painel sabe ler e contar.
// Escrita SÓ por aqui: aviso que o navegador cria é aviso que o navegador
// forja.
// ---------------------------------------------
function avisarMestre(tx, aviso) {
  const ref = db.collection("avisos_mestre").doc();
  const doc = {
    tipo: aviso.tipo || "geral",
    titulo: aviso.titulo || "Aviso",
    mensagem: aviso.mensagem || "",
    // Quem gerou, para o mestre saber com quem falar
    jogadorUid: aviso.jogadorUid || "",
    jogador: aviso.jogador || "",
    // Para onde o mestre precisa ir resolver (ex.: npcs/<id>)
    referencia: aviso.referencia || null,
    mesaId: aviso.mesaId || "",
    acao: aviso.acao || "",
    status: "novo",
    criadoEm: FieldValue.serverTimestamp(),
  };
  if (tx) tx.set(ref, doc);
  else return ref.set(doc).then(() => ref.id);
  return ref.id;
}

// ---------------------------------------------
// Helper: localizar o documento do usuário
// (mesma ordem de busca do findUserDoc do frontend:
//  1) campo uid, 2) campo email, 3) doc com ID = uid)
// ---------------------------------------------
async function resolveUserRef(uid, email) {
  let snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
  if (!snap.empty) return snap.docs[0].ref;

  if (email) {
    snap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!snap.empty) return snap.docs[0].ref;
  }

  return db.collection("users").doc(uid);
}

// =============================================
// COMPRA COM FRAGMENTOS (callable)
// =============================================
exports.comprarComFragmentos = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para comprar.");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemId, selectedMetas, quantidade: reqQuantidade } = request.data || {};
    let quantidade = parseInt(reqQuantidade) || 1;
    if (quantidade < 1) quantidade = 1;
    if (quantidade > 99) quantidade = 99;

    if (!itemId || typeof itemId !== "string") {
      throw new HttpsError("invalid-argument", "itemId é obrigatório.");
    }

    // Item e preço vêm do Firestore — nunca do navegador
    const itemSnap = await db.collection("loja_itens").doc(itemId).get();
    if (!itemSnap.exists) {
      throw new HttpsError("not-found", "Item não encontrado.");
    }
    const item = itemSnap.data();

    const valorFrag = item.valorFrag;
    if (!Number.isInteger(valorFrag) || valorFrag <= 0) {
      throw new HttpsError("failed-precondition", "Este item não está à venda por Frag$.");
    }
    // Campo real usado pelo projeto é `isVendaAtiva` (default true quando ausente)
    if (item.isVendaAtiva === false) {
      throw new HttpsError("failed-precondition", "Este item não está à venda no momento.");
    }

    // Validação de metas (mesma regra que existia no frontend, agora inviolável)
    let metas = [];
    if (item.modoSelecaoMeta) {
      const limit = item.qtdSelecaoMeta || item.quantidadeMetasSelecionaveis || 1;
      const allowed = item.metasVinculadas || [];
      metas = Array.isArray(selectedMetas) ? selectedMetas : [];
      if (metas.length > limit) {
        throw new HttpsError("invalid-argument", `Você pode escolher no máximo ${limit} meta(s).`);
      }
      if (metas.some((m) => typeof m !== "string" || !allowed.includes(m))) {
        throw new HttpsError("invalid-argument", "Meta inválida selecionada.");
      }
    } else {
      metas = item.metasVinculadas || [];
    }

    // Nomes das metas para o log (equivalente ao uso de metasData no frontend)
    let metasNamesStr = "";
    if (metas.length > 0) {
      const nomes = await Promise.all(
        metas.map(async (mId) => {
          const m = await db.collection("metas").doc(mId).get();
          return m.exists ? (m.data().nome || mId) : mId;
        })
      );
      metasNamesStr = nomes.join(", ");
    }

    const userRef = await resolveUserRef(uid, email);
    let novoSaldo = 0;
    let novosGiros = 0;

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) {
        throw new HttpsError("not-found", "Documento de usuário não existe.");
      }
      const data = uSnap.data();

      const totalFrag = valorFrag * quantidade;
      const saldoAtual = data.fragmentos || 0;
      if (saldoAtual < totalFrag) {
        throw new HttpsError(
          "failed-precondition",
          `Você não tem Fragmentos suficientes. Custo total: ${totalFrag} Frag$.`
        );
      }
      novoSaldo = saldoAtual - totalFrag;

      const inventario = data.inventario || [];
      const existingItemIndex = inventario.findIndex(i => i.nome === item.nome);
      if (existingItemIndex !== -1) {
        inventario[existingItemIndex].quantidade = (inventario[existingItemIndex].quantidade || 1) + quantidade;
      } else {
        inventario.push({
          ...item,
          quantidade: quantidade,
          formaRecebimento: "Comprado na Loja (Frag$)",
        });
      }

      const logsCompra = data.logsCompra || [];
      logsCompra.push({
        itemId,
        nome: item.nome,
        valorPago: totalFrag,
        moeda: "Frag$",
        data: new Date().toISOString(),
      });

      const apoios = data.apoios || [];
      const peso = pesoProducao(item);
      apoios.push({
        nome: item.nome,
        tipo: "Loja (Frag$)",
        montante: quantidade,
        meta: metas.join(","),
        valor: "",
        dataInicio: new Date().toISOString().split("T")[0],
        recebido: true,
        ...(peso !== 1 ? { peso } : {}),
      });

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: `💎 Compra Aprovada: Você adquiriu ${quantidade}x ${item.nome} por ${totalFrag} Frag$.`,
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: "importante" },
      });
      if (notifications.length > 100) notifications.length = 100;

      // ponytail: dois caminhos de entrega (aqui e aplicarCompra); unificar se
      // aparecer um terceiro. Por ora só o crédito de giros anda nos dois.
      novosGiros = (data.giros || 0) + girosDoItem(item, quantidade);

      tx.update(userRef, {
        fragmentos: novoSaldo,
        inventario,
        logsCompra,
        apoios,
        notifications,
        giros: novosGiros,
        // Marcador de atribuição lido pelo gatilho de auditoria (registrarLogFragmentos)
        fragLastOp: {
          origem: "Compra na Loja (Frag$)",
          detalhe: `${quantidade}x ${item.nome} (itemId: ${itemId})`,
          autor: email || uid,
          ts: Date.now(),
        },
      });
    });

    return { ok: true, novoSaldo, novosGiros };
  }
);

// =============================================
// AUDITORIA AUTOMÁTICA DE FRAGMENTOS (gatilho)
// Dispara em QUALQUER escrita em users/{userId}.
// Se o campo `fragmentos` mudou, grava um log imutável
// em `frag_logs` — não importa se a mudança veio da
// Cloud Function, do painel-mestre ou de escrita direta.
// =============================================
exports.registrarLogFragmentos = onDocumentWritten(
  { document: "users/{userId}", region: "southamerica-east1" },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;

    const saldoAnterior = before ? (before.fragmentos || 0) : 0;
    const saldoNovo = after ? (after.fragmentos || 0) : 0;
    if (saldoAnterior === saldoNovo) return; // nada mudou em Frag$

    // Atribuição: só confia no fragLastOp se ele mudou nesta mesma escrita
    let origem = "Não identificada (escrita direta no banco)";
    let detalhe = "";
    let autor = "";
    const opAntes = before ? before.fragLastOp : null;
    const opDepois = after ? after.fragLastOp : null;
    if (opDepois && JSON.stringify(opDepois) !== JSON.stringify(opAntes)) {
      origem = opDepois.origem || origem;
      detalhe = opDepois.detalhe || "";
      autor = opDepois.autor || "";
    }
    if (!after) {
      origem = "Documento de usuário excluído";
    }

    const ref = after || before || {};
    await db.collection("frag_logs").add({
      uid: event.params.userId,
      jogador: ref.displayName || ref.email || "",
      saldoAnterior,
      saldoNovo,
      delta: saldoNovo - saldoAnterior,
      origem,
      detalhe,
      autor,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
);

// =============================================
// COMPRA EM DINHEIRO REAL — validação de uma linha (item + qtd + metas)
// Compartilhada pelo carrinho do Mercado Pago e pelo pedido em dinheiro:
// o preço vem SEMPRE do Firestore; o navegador envia só itemId + metas.
// =============================================
async function validarLinhaCompra(itemId, selectedMetas, reqQuantidade) {
  let quantidade = parseInt(reqQuantidade) || 1;
  if (quantidade < 1) quantidade = 1;
  if (quantidade > 99) quantidade = 99;

  if (!itemId || typeof itemId !== "string") {
    throw new HttpsError("invalid-argument", "itemId é obrigatório.");
  }

  const itemSnap = await db.collection("loja_itens").doc(itemId).get();
  if (!itemSnap.exists) {
    throw new HttpsError("not-found", "Item não encontrado.");
  }
  const item = itemSnap.data();

  const valorCentavos = getValorCentavos(item);
  if (valorCentavos <= 0) {
    throw new HttpsError("failed-precondition", `"${item.nome}" não está à venda por dinheiro real.`);
  }
  // Campo real usado pelo projeto é `isVendaAtiva` (default true quando ausente)
  if (item.isVendaAtiva === false) {
    throw new HttpsError("failed-precondition", `"${item.nome}" não está à venda no momento.`);
  }

  // Mesma validação de metas de comprarComFragmentos
  let metas = [];
  if (item.modoSelecaoMeta) {
    const limit = item.qtdSelecaoMeta || item.quantidadeMetasSelecionaveis || 1;
    const allowed = item.metasVinculadas || [];
    metas = Array.isArray(selectedMetas) ? selectedMetas : [];
    if (metas.length > limit) {
      throw new HttpsError("invalid-argument", `Você pode escolher no máximo ${limit} meta(s).`);
    }
    if (metas.some((m) => typeof m !== "string" || !allowed.includes(m))) {
      throw new HttpsError("invalid-argument", "Meta inválida selecionada.");
    }
  } else {
    metas = item.metasVinculadas || [];
  }

  return { itemId, item, valorCentavos, quantidade, metas };
}

// =============================================
// ENTREGA DOS BENEFÍCIOS DE UMA COMPRA EM DINHEIRO
// Caminho único de entrega, hoje só do webhook do Mercado Pago: a compra é
// automática e o mestre não confirma mais nada. Idempotente (compra CONCLUIDA
// nunca é aplicada de novo) e sempre grava log imutável em `real_logs`.
// Aceita os dois formatos de pendência: carrinho (`itens[]`) e item único
// (o antigo, que ainda existe em pendências gravadas antes do carrinho).
// =============================================
async function entregarCompra(pendingRef, pending, origem, extras = {}) {
  const linhas = Array.isArray(pending.itens) && pending.itens.length > 0
    ? pending.itens
    : [{
        itemId: pending.itemId,
        itemNome: pending.itemNome,
        valorCentavos: pending.valorCentavos,
        quantidade: pending.quantidade || 1,
        selectedMetas: pending.selectedMetas || [],
      }];

  // Catálogo e nomes de metas são só leitura — resolvidos fora da transação
  const preparadas = await Promise.all(linhas.map(async (linha) => {
    const itemSnap = await db.collection("loja_itens").doc(linha.itemId).get();
    const item = itemSnap.exists ? itemSnap.data() : { nome: linha.itemNome, descricao: "" };
    const metasNamesStr = await getMetasNames(linha.selectedMetas || []);
    return { linha, item, metasNamesStr };
  }));

  const userRef = await resolveUserRef(pending.uid, pending.email || "");

  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(pendingRef);
    if (pSnap.data().status === "CONCLUIDA") return; // corrida entre notificações

    const uSnap = await tx.get(userRef);
    if (!uSnap.exists) throw new Error("Usuário não encontrado: " + pending.uid);
    let data = uSnap.data();

    for (const { linha, item, metasNamesStr } of preparadas) {
      const pendenteLinha = {
        itemId: linha.itemId,
        quantidade: linha.quantidade || 1,
        totalCentavos: (linha.valorCentavos || 0) * (linha.quantidade || 1),
        selectedMetas: linha.selectedMetas || [],
        compraId: pendingRef.id,
      };
      const { inventario, logsCompra, apoios, notifications, giros, quantidade, totalCentavos } =
        aplicarCompra(data, item, pendenteLinha, origem);
      // O resultado de uma linha é o estado de partida da próxima — inclusive
      // `giros`, senão um carrinho com dois itens de roleta credita só o último
      data = { ...data, inventario, logsCompra, apoios, notifications, giros };

      // Log imutável de transação em dinheiro real (equivalente ao frag_logs)
      tx.set(db.collection("real_logs").doc(), {
        uid: pending.uid,
        jogador: data.displayName || data.email || pending.email || "",
        itemId: linha.itemId,
        itemNome: item.nome,
        valorCentavos: totalCentavos,
        moeda: "BRL",
        compraId: pendingRef.id,
        checkoutId: pending.checkoutId || "",
        orderId: "",
        origem: `Compra na Loja (${origem})`,
        detalhe: `${quantidade}x - ` + (metasNamesStr ? `Metas: ${metasNamesStr}` : ""),
        criadoEm: FieldValue.serverTimestamp(),
        ...(extras.logExtra || {}),
      });
    }

    tx.update(userRef, {
      inventario: data.inventario,
      logsCompra: data.logsCompra,
      apoios: data.apoios,
      notifications: data.notifications,
      giros: data.giros || 0,
    });
    tx.update(pendingRef, {
      status: "CONCLUIDA",
      concluidaEm: FieldValue.serverTimestamp(),
      ...(extras.pendingExtra || {}),
    });
  });
}

// =============================================
// EXP DO REPERTÓRIO → FICHA (callable)
// O jogador escolhe em qual personagem gastar o item de EXP que comprou.
// Precisa ser servidor por dois motivos: `inventario` é campo protegido nas
// rules (o navegador não consegue baixar a unidade), e o par exp/exp_total tem
// de andar junto com o consumo — senão dá para aplicar o mesmo item duas vezes
// numa aba e noutra.
// =============================================
exports.aplicarExpDoItem = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemNome, charId, quantidade } = request.data || {};

    if (!itemNome || typeof itemNome !== "string") {
      throw new HttpsError("invalid-argument", "Diga qual item usar.");
    }
    if (!charId || typeof charId !== "string") {
      throw new HttpsError("invalid-argument", "Escolha o personagem.");
    }

    const userRef = await resolveUserRef(uid, email);
    const charRef = db.collection("char").doc(charId);

    let resultado;
    await db.runTransaction(async (tx) => {
      const [uSnap, cSnap] = await Promise.all([tx.get(userRef), tx.get(charRef)]);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      if (!cSnap.exists) throw new HttpsError("not-found", "Personagem não encontrado.");

      const ficha = cSnap.data();
      // A ficha tem de ser DELE. Sem isto, um jogador aplicaria o próprio EXP
      // na ficha de outro — ou pior, na de um NPC.
      if (ficha.ownerUid !== uid) {
        throw new HttpsError("permission-denied", "Este personagem não é seu.");
      }

      const data = uSnap.data();
      try {
        resultado = aplicarExpDeItem(data, ficha.fields, itemNome, quantidade);
      } catch (e) {
        throw new HttpsError(e.codigo || "failed-precondition", e.message);
      }

      const nomePersonagem = (ficha.fields && ficha.fields.nome) || ficha.nome || "seu personagem";

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "exp_received",
        message: `⭐ ${resultado.ganho} EXP aplicados em ${nomePersonagem} (${itemNome}).`,
        timestamp: Date.now(),
        isNew: true,
        data: { direction: "up", amount: resultado.ganho, characterName: nomePersonagem },
      });
      if (notifications.length > 100) notifications.length = 100;

      tx.update(userRef, { inventario: resultado.inventario, notifications });
      // Números, e não texto: é o mesmo formato que o log de sessão grava, e a
      // ficha lê os dois com parseInt de qualquer jeito.
      const patchFicha = {
        "fields.exp": resultado.exp,
        "fields.exp_total": resultado.expTotal,
      };
      /* `expVip` é o contador que o assistente de criação já gravava. Sem somar
         aqui, EXP VIP aplicado DEPOIS da criação não contaria na devolução de
         60% quando o personagem for encerrado. */
      if (resultado.vip) {
        patchFicha.expVip = (Number(ficha.expVip) || 0) + resultado.ganho;
      }
      tx.update(charRef, patchFicha);

      // Trilha imutável: EXP é comprado com dinheiro, então tem de dar para
      // reconstruir quem aplicou o quê, em quem e quando.
      tx.set(db.collection("exp_logs").doc(), {
        uid,
        jogador: data.displayName || data.email || email,
        charId,
        personagem: nomePersonagem,
        itemNome,
        quantidade: resultado.ganho / resultado.porUnidade,
        porUnidade: resultado.porUnidade,
        ganho: resultado.ganho,
        vip: resultado.vip,
        expDepois: resultado.exp,
        expTotalDepois: resultado.expTotal,
        origem: "Repertório do jogador",
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    return {
      ok: true,
      ganho: resultado.ganho,
      exp: resultado.exp,
      expTotal: resultado.expTotal,
      restante: resultado.restante,
    };
  }
);

// =============================================
// ITEM DO REPERTÓRIO → MESA (callable)
// O jogador escolhe uma mesa em que joga e manda a peça para lá. Ela sai do
// Repertório dele, cai na Caixa do Mestre daquela mesa e vira um aviso: o
// mestre precisa saber que aquilo é de um jogador e que falta dar um lugar
// para a peça no mundo.
//
// Servidor porque `inventario` é campo protegido, e porque o item só pode
// sair do Repertório se a peça entrar na caixa — as duas coisas na mesma
// gravação.
// =============================================
exports.enviarItemParaMesa = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemNome, mesaId, quantidade } = request.data || {};

    if (!itemNome || typeof itemNome !== "string") {
      throw new HttpsError("invalid-argument", "Diga qual item mandar.");
    }
    if (!mesaId || typeof mesaId !== "string") {
      throw new HttpsError("invalid-argument", "Escolha a mesa.");
    }

    const mesaSnap = await db.collection("mesas").doc(mesaId).get();
    if (!mesaSnap.exists) throw new HttpsError("not-found", "Essa mesa não existe.");
    const mesa = mesaSnap.data();
    // Só para mesa em que ele joga: sem isto, daria para despejar item na mesa
    // de qualquer um.
    if (!(mesa.jogadores || []).includes(uid)) {
      throw new HttpsError("permission-denied", "Você não joga nessa mesa.");
    }

    const userRef = await resolveUserRef(uid, email);
    let enviado;

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      let retirada;
      try {
        retirada = retirarDoRepertorio(data.inventario, itemNome, quantidade);
      } catch (e) {
        throw new HttpsError(e.codigo || "failed-precondition", e.message);
      }

      const jogador = data.displayName || data.email || email;
      const qtd = Math.max(1, parseInt(quantidade, 10) || 1);
      const doc = itemParaCaixa(retirada.item, { mesaId, quantidade: qtd, jogadorUid: uid, jogador });

      tx.set(db.collection("items").doc(doc.id), doc);

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: `🎁 ${qtd}x ${itemNome} foi para a mesa ${mesa.nome || ""}. O mestre já foi avisado.`,
        timestamp: Date.now(),
        isNew: true,
      });
      if (notifications.length > 100) notifications.length = 100;

      tx.update(userRef, { inventario: retirada.inventario, notifications });

      avisarMestre(tx, {
        tipo: "item-para-mesa",
        titulo: `${jogador} mandou ${qtd}x ${itemNome} para a mesa`,
        mensagem:
          `A peça saiu do Repertório de ${jogador} e está na Caixa do Mestre de ` +
          `${mesa.nome || "sua mesa"}. Falta você colocá-la no mundo para o jogador encontrar.` +
          (retirada.item.descricao ? ` — "${retirada.item.descricao}"` : ""),
        jogadorUid: uid,
        jogador,
        referencia: { colecao: "items", id: doc.id, nome: itemNome },
        mesaId,
        acao: "Abrir a Caixa do Mestre desta mesa",
      });

      enviado = { itemId: doc.id, quantidade: qtd, restante: retirada.restante, mesa: mesa.nome || "" };
    });

    return { ok: true, ...enviado };
  }
);

// =============================================
// ENCERRAR PERSONAGEM (callable)
// Duas saídas, e as duas devolvem 60% do EXP VIP ao Repertório:
//   'mestre' → a ficha vira NPC no cadastro do mestre e sai do jogador
//   'apagar' → some de vez, com os itens dela
//
// Precisa ser servidor por três motivos independentes: `npcs` só aceita
// criação de mestre nas rules, `inventario` é campo protegido, e apagar a
// ficha junto com os itens dela é coisa que não pode ficar pela metade.
// =============================================
exports.encerrarPersonagem = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { charId, destino } = request.data || {};

    if (!charId || typeof charId !== "string") {
      throw new HttpsError("invalid-argument", "Diga qual personagem encerrar.");
    }
    if (destino !== "mestre" && destino !== "apagar") {
      throw new HttpsError("invalid-argument", "Escolha entregar ao mestre ou apagar.");
    }

    const charRef = db.collection("char").doc(charId);
    const charSnap = await charRef.get();
    if (!charSnap.exists) throw new HttpsError("not-found", "Personagem não encontrado.");
    const ficha = charSnap.data();
    if (ficha.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "Este personagem não é seu.");
    }

    const nome = (ficha.fields && ficha.fields.nome) || ficha.nome || "Personagem sem nome";
    const devolvido = devolucaoExpVip(ficha.expVip);

    // Itens da ficha: a mesma coleção `items`, marcada pelo characterId.
    const itensSnap = await db.collection("items").where("characterId", "==", charId).get();

    let npcId = "";
    let perdidoNaConversao = [];

    if (destino === "mestre") {
      // O catálogo de perícias é o que traduz `sk_<cat>_<slug>` em refId.
      // Sem ele a conversão perderia todas as perícias em silêncio.
      let skills = [];
      try {
        const cat = await db.collection("system/data/skills").get();
        skills = cat.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn("catálogo de perícias indisponível na conversão:", e.message);
      }

      const { npc, perdido } = charParaNpc(ficha, { skills, autor: email, charId });
      perdidoNaConversao = perdido;

      const npcRef = db.collection("npcs").doc();
      await npcRef.set(npc);
      npcId = npcRef.id;

      // Os itens vão junto: mesma coleção, novo dono. O painel do mestre lê o
      // inventário do NPC exatamente assim.
      const lote = db.batch();
      itensSnap.forEach((d) => {
        lote.update(d.ref, { characterId: npcId, ownerType: "npc", ownerUid: "" });
      });
      await lote.commit();
    } else {
      // Apagar de verdade leva os itens junto. Deixá-los para trás é o que
      // vinha acontecendo: docs em `items` apontando para uma ficha que não
      // existe mais, invisíveis e eternos.
      const lote = db.batch();
      itensSnap.forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }

    // Devolução do EXP VIP + baixa da ficha, na mesma transação.
    const userRef = await resolveUserRef(uid, email);
    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      const inventario = data.inventario || [];
      if (devolvido > 0) inventario.push(itemDevolucao(devolvido, nome));

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: destino === "mestre"
          ? `📜 ${nome} foi entregue ao mestre e virou NPC.` +
            (devolvido > 0 ? ` ${devolvido} EXP VIP voltaram ao seu Repertório.` : "")
          : `🗑️ ${nome} foi apagado.` +
            (devolvido > 0 ? ` ${devolvido} EXP VIP voltaram ao seu Repertório.` : ""),
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: "importante" },
      });
      if (notifications.length > 100) notifications.length = 100;

      tx.update(userRef, { inventario, notifications });
      tx.delete(charRef);

      /* Entrega precisa de aviso: o NPC aparece no cadastro, mas em silêncio.
         O mestre tem de saber que aquilo era o personagem de alguém e que
         está esperando um lugar no mundo. */
      if (destino === "mestre") {
        avisarMestre(tx, {
          tipo: "personagem-entregue",
          titulo: `${nome} foi entregue por um jogador`,
          mensagem:
            `${data.displayName || data.email || email} encerrou o personagem ${nome} e entregou ao mestre. ` +
            `A ficha virou NPC${itensSnap.size ? ` e levou ${itensSnap.size} item(ns) junto` : ""}. ` +
            `Falta você dar um lugar a ele no mundo.` +
            (perdidoNaConversao.length
              ? ` A história do NPC guarda o que a ficha tinha e o cadastro não comporta.`
              : ""),
          jogadorUid: uid,
          jogador: data.displayName || data.email || email,
          referencia: { colecao: "npcs", id: npcId, nome },
          mesaId: ficha.mesaId || (ficha.mesaVinculada && ficha.mesaVinculada.id) || "",
          acao: "Abrir no cadastro de NPCs",
        });
      }

      tx.set(db.collection("exp_logs").doc(), {
        uid,
        jogador: data.displayName || data.email || email,
        charId,
        personagem: nome,
        itemNome: "(encerramento do personagem)",
        quantidade: 1,
        porUnidade: devolvido,
        ganho: -Number(ficha.expVip || 0),
        devolvido,
        vip: true,
        destino,
        npcId,
        itensMovidos: itensSnap.size,
        origem: destino === "mestre" ? "Entregue ao mestre" : "Apagado pelo jogador",
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    return {
      ok: true,
      destino,
      nome,
      devolvido,
      expVip: Number(ficha.expVip) || 0,
      npcId,
      itens: itensSnap.size,
      perdido: perdidoNaConversao,
    };
  }
);

// =============================================
// ROLETA — UM GIRO (callable)
// O sorteio acontece AQUI e em lugar nenhum mais. O navegador não manda
// índice, nem semente, nem a lista de prêmios: manda só o token de login. O
// prêmio já está entregue e o giro já está debitado quando a resposta sai —
// a animação da roda é encenação do que já aconteceu. Fechar a aba no meio
// do giro custa o espetáculo, nunca o prêmio.
// =============================================
exports.girarRoleta = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para girar a roleta.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";

    // Sorteio ANTES da transação, de propósito: o callback de uma transação
    // roda de novo quando há contenção, e sortear lá dentro re-sortearia o
    // prêmio a cada retentativa.
    const cfgSnap = await db.collection("config").doc("roleta").get();
    const premios = (cfgSnap.exists ? cfgSnap.data().premios : null) || [];

    let sorteio;
    try {
      sorteio = sortear(premios);
    } catch (e) {
      // Roleta sem prêmio válido falha aqui, antes de custar um giro.
      throw new HttpsError("failed-precondition", "A roleta ainda não foi configurada pelo mestre.");
    }
    const { indice, premio, probabilidade } = sorteio;

    const itemSnap = await db.collection("loja_itens").doc(String(premio.itemId || "")).get();
    if (!itemSnap.exists) {
      throw new HttpsError("failed-precondition",
        `O prêmio "${premio.nome || ""}" não existe mais no catálogo. Avise o mestre.`);
    }
    const item = itemSnap.data();

    const userRef = await resolveUserRef(uid, email);
    let novosGiros = 0;

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      const saldo = data.giros || 0;
      if (saldo < 1) {
        throw new HttpsError("failed-precondition", "Você não tem giros. Compre na Loja para girar.");
      }

      const { inventario, notifications, girosGanhos } = aplicarPremio(data, item);
      // Débito e entrega na MESMA transação: não existe estado em que o giro
      // saiu e o prêmio não entrou. `girosGanhos` é o que faz a Re-roleta
      // devolver o giro sem nenhum caso especial no código.
      novosGiros = saldo - 1 + girosGanhos;

      tx.update(userRef, { giros: novosGiros, inventario, notifications });

      tx.set(db.collection("roleta_logs").doc(), {
        uid,
        jogador: data.displayName || data.email || email,
        itemId: premio.itemId,
        itemNome: item.nome,
        indice,
        chance: premio.chance,
        probabilidade,
        girosAntes: saldo,
        girosDepois: novosGiros,
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    // `premios` volta junto porque o mestre pode ter salvo a roleta entre o
    // desenho da roda e o clique: sem redesenhar com esta lista, a agulha
    // pararia numa fatia que não existe mais.
    return {
      indice,
      premios,
      novosGiros,
      premio: {
        nome: item.nome,
        descricao: item.descricao || "",
        imagem: item.imagem || "",
        giros: girosDoItem(item, 1),
      },
    };
  }
);

// =============================================
// MERCADO PAGO — CRIAÇÃO DO CHECKOUT DO CARRINHO (callable)
// O jogador fecha o carrinho → esta função valida cada linha,
// registra a intenção de compra (uma pendência para o carrinho todo)
// e devolve o link do Checkout Pro (PIX, Cartão e Boleto na página do MP).
// =============================================
const MAX_LINHAS_CARRINHO = 20;

// Taxas do gateway: o mestre ajusta em `config/pagamento` sem deploy.
// Só cai no padrão do código se o documento não existir.
async function lerTaxas() {
  try {
    const snap = await db.collection("config").doc("pagamento").get();
    const d = snap.exists ? snap.data() : null;
    if (d && d.pix && d.credito && d.boleto) return d;
  } catch (e) {
    console.warn("Falha ao ler config/pagamento, usando padrão:", e.message);
  }
  return TAXAS_PADRAO;
}

exports.criarCheckoutMercadoPago = onCall(
  { secrets: [MP_ACCESS_TOKEN, RECAPTCHA_SECRET], region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para comprar.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itens, meio, recaptchaToken } = request.data || {};

    // Verificação anti-bot ANTES de qualquer operação de pagamento
    await verificarRecaptcha(recaptchaToken, "comprar_loja");

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new HttpsError("invalid-argument", "O carrinho está vazio.");
    }
    if (itens.length > MAX_LINHAS_CARRINHO) {
      throw new HttpsError("invalid-argument", `O carrinho aceita no máximo ${MAX_LINHAS_CARRINHO} itens.`);
    }
    if (!EXCLUIR_POR_MEIO[meio]) {
      throw new HttpsError("invalid-argument", "Escolha como quer pagar: PIX, cartão ou boleto.");
    }

    const linhas = [];
    for (const l of itens) {
      linhas.push(await validarLinhaCompra(l?.itemId, l?.selectedMetas, l?.quantidade));
    }
    const totalCentavos = linhas.reduce((s, l) => s + l.valorCentavos * l.quantidade, 0);

    // O jogador paga a taxa do gateway; a mesa recebe o valor cheio do item.
    // O cálculo é SEMPRE aqui — o que o navegador mostrou é só previsão.
    const taxas = await lerTaxas();
    const taxaDoMeio = taxas[meio];

    const minimo = Number(taxaDoMeio.minimoCentavos) || 0;
    if (totalCentavos < minimo) {
      throw new HttpsError("failed-precondition",
        `${taxaDoMeio.rotulo || meio} só vale para compras a partir de R$ ${(minimo / 100).toFixed(2).replace(".", ",")}.`);
    }

    const { totalCentavos: cobradoCentavos, taxaCentavos } =
      calcularCobranca(totalCentavos, taxaDoMeio);

    // Registro da intenção de compra (também serve de trilha de auditoria)
    const pendingRef = db.collection("compras_pendentes").doc();
    await pendingRef.set({
      uid,
      email,
      itens: linhas.map((l) => ({
        itemId: l.itemId,
        itemNome: l.item.nome,
        valorCentavos: l.valorCentavos,
        quantidade: l.quantidade,
        selectedMetas: l.metas,
      })),
      totalCentavos,          // o que a mesa recebe, e o que vira apoio/log
      taxaCentavos,           // repasse do gateway, não é apoio
      cobradoCentavos,        // o que o jogador paga de fato
      meioPagamento: meio,
      status: "AGUARDANDO_PAGAMENTO",
      criadoEm: FieldValue.serverTimestamp(),
    });

    const body = {
      external_reference: pendingRef.id,
      payment_methods: {
        excluded_payment_types: EXCLUIR_POR_MEIO[meio].map((id) => ({ id })),
      },
      items: linhas.map((l) => ({
        id: l.itemId,
        title: String(l.item.nome).slice(0, 100),
        description: String(l.item.descricao || l.item.nome).slice(0, 255),
        quantity: l.quantidade,
        currency_id: "BRL",
        unit_price: l.valorCentavos / 100, // o MP fala em reais, não em centavos
      })).concat(taxaCentavos > 0 ? [{
        id: "taxa",
        title: "Taxa de processamento",
        description: `Tarifa cobrada pelo Mercado Pago (${taxaDoMeio.rotulo || meio})`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: taxaCentavos / 100,
      }] : []),
      back_urls: {
        success: `${SITE_URL}/?compra=${pendingRef.id}`,
        pending: `${SITE_URL}/?compra=${pendingRef.id}`,
        failure: `${SITE_URL}/`,
      },
      auto_return: "approved",
      notification_url: WEBHOOK_URL,
      statement_descriptor: "LENDAS E RELIQUIAS",
    };

    const resp = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Erro Mercado Pago ao criar preferência:", resp.status, errText);
      await pendingRef.update({ status: "ERRO_CRIACAO", erro: errText.slice(0, 1000) });
      throw new HttpsError("internal", "Falha ao criar o pagamento no Mercado Pago.");
    }

    const pref = await resp.json();
    if (!pref.init_point) {
      console.error("Resposta sem init_point:", JSON.stringify(pref).slice(0, 2000));
      await pendingRef.update({ status: "ERRO_CRIACAO", erro: "Sem init_point na resposta." });
      throw new HttpsError("internal", "Mercado Pago não retornou o link de pagamento.");
    }

    // checkoutId guarda o id da preferência (mesmo campo da era PagBank)
    await pendingRef.update({ checkoutId: pref.id });
    return { paymentUrl: pref.init_point, compraId: pendingRef.id };
  }
);

// =============================================
// MERCADO PAGO — WEBHOOK DE CONFIRMAÇÃO
// O MP chama esta URL quando o pagamento muda de status. Chega em dois
// formatos: webhook novo (body {type:"payment", data:{id}}) e IPN legado
// (query ?topic=payment&id=...). NUNCA confia no corpo da notificação:
// sempre reconsulta /v1/payments/{id} com o token para confirmar
// `approved` antes de entregar. Idempotente: compra CONCLUIDA nunca é
// aplicada de novo. Toda entrega gera um log imutável em `real_logs`.
// =============================================
exports.mercadoPagoWebhook = onRequest(
  { secrets: [MP_ACCESS_TOKEN], region: "southamerica-east1" },
  async (req, res) => {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const q = req.query || {};
      const body = req.body || {};
      console.log("Webhook MP recebido:", JSON.stringify({ query: q, body }).slice(0, 2000));

      const tipo = String(body.type || body.topic || q.type || q.topic || "");
      const paymentId = body?.data?.id || q["data.id"] || q.id || body.id || null;

      // Só o evento de pagamento interessa (merchant_order etc. são redundantes)
      if (!tipo.includes("payment") || !paymentId) {
        res.status(200).send("ignored");
        return;
      }

      // Confirmação server-to-server — nunca confiar apenas no payload
      const r = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}` },
      });
      if (r.status === 404) {
        res.status(200).send("ignored: pagamento desconhecido");
        return;
      }
      if (!r.ok) {
        // Falha transitória na API → 500 faz o MP reenviar a notificação
        res.status(500).send("erro ao consultar pagamento");
        return;
      }
      const pay = await r.json();

      const referenceId = pay.external_reference || null;
      if (!referenceId) {
        res.status(200).send("ignored: sem external_reference");
        return;
      }

      const pendingRef = db.collection("compras_pendentes").doc(referenceId);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists) {
        res.status(200).send("ignored: compra desconhecida");
        return;
      }
      const pending = pendingSnap.data();

      if (pending.status === "CONCLUIDA") {
        res.status(200).send("ok: já processada");
        return;
      }

      if (pay.status !== "approved") {
        await pendingRef.update({ ultimaNotificacao: FieldValue.serverTimestamp() });
        res.status(200).send("ok: ainda não pago");
        return;
      }

      // Aplica os benefícios — MESMOS formatos da compra com Frag$
      await entregarCompra(pendingRef, pending, "Mercado Pago", {
        logExtra: {
          checkoutId: pending.checkoutId || "",
          orderId: String(paymentId),
        },
      });

      res.status(200).send("ok: benefícios aplicados");
    } catch (e) {
      console.error("Erro no webhook:", e);
      // 500 → o MP reenviará a notificação (a idempotência protege contra duplicação)
      res.status(500).send("erro interno");
    }
  }
);
