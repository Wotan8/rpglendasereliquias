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
const { aplicarCompra } = require("./entrega-calc");
const { TAXAS_PADRAO, calcularCobranca, EXCLUIR_POR_MEIO } = require("./taxa-gateway");

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
      apoios.push({
        nome: item.nome,
        tipo: "Loja (Frag$)",
        montante: quantidade,
        meta: metas.join(","),
        valor: "",
        dataInicio: new Date().toISOString().split("T")[0],
        recebido: true,
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

      tx.update(userRef, {
        fragmentos: novoSaldo,
        inventario,
        logsCompra,
        apoios,
        notifications,
        // Marcador de atribuição lido pelo gatilho de auditoria (registrarLogFragmentos)
        fragLastOp: {
          origem: "Compra na Loja (Frag$)",
          detalhe: `${quantidade}x ${item.nome} (itemId: ${itemId})`,
          autor: email || uid,
          ts: Date.now(),
        },
      });
    });

    return { ok: true, novoSaldo };
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

// Pedido de UM item (fluxo dinheiro/mestre): valida e registra a intenção.
async function registrarCompraPendente(request, status) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Você precisa estar logado para comprar.");
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email || "";
  const { itemId, selectedMetas, quantidade: reqQuantidade, recaptchaToken } = request.data || {};

  // Verificação anti-bot ANTES de qualquer operação de pagamento
  await verificarRecaptcha(recaptchaToken, "comprar_loja");

  const { item, valorCentavos, quantidade, metas } =
    await validarLinhaCompra(itemId, selectedMetas, reqQuantidade);

  // Registro da intenção de compra (também serve de trilha de auditoria)
  const pendingRef = db.collection("compras_pendentes").doc();
  await pendingRef.set({
    uid,
    email,
    itemId,
    itemNome: item.nome,
    valorCentavos,
    quantidade,
    totalCentavos: valorCentavos * quantidade,
    selectedMetas: metas,
    status,
    criadoEm: FieldValue.serverTimestamp(),
  });

  return { pendingRef, item, itemId, valorCentavos, quantidade, metas };
}

// =============================================
// ENTREGA DOS BENEFÍCIOS DE UMA COMPRA EM DINHEIRO
// Único caminho de entrega: usado pelo webhook do Mercado Pago e pela
// confirmação manual do mestre. Idempotente (compra CONCLUIDA nunca
// é aplicada de novo) e sempre grava log imutável em `real_logs`.
// `origem` é o rótulo do meio de pagamento ("Mercado Pago" | "Dinheiro").
// Aceita os dois formatos de pendência: carrinho (`itens[]`) e item único.
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
      const { inventario, logsCompra, apoios, notifications, quantidade, totalCentavos } =
        aplicarCompra(data, item, pendenteLinha, origem);
      // O resultado de uma linha é o estado de partida da próxima
      data = { ...data, inventario, logsCompra, apoios, notifications };

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
    });
    tx.update(pendingRef, {
      status: "CONCLUIDA",
      concluidaEm: FieldValue.serverTimestamp(),
      ...(extras.pendingExtra || {}),
    });
  });
}

// Só o mestre (doc em `masters/{uid}`) passa daqui — mesma fonte de verdade das rules
async function exigirMestre(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Você precisa estar logado.");
  }
  const m = await db.collection("masters").doc(request.auth.uid).get();
  if (!m.exists) {
    throw new HttpsError("permission-denied", "Apenas o mestre pode confirmar pagamentos.");
  }
  return request.auth.token.email || request.auth.uid;
}

// =============================================
// COMPRA EM DINHEIRO — PEDIDO DO JOGADOR (callable)
// Sem gateway: registra o pedido e espera o mestre confirmar que
// recebeu o dinheiro (na mão, PIX direto, etc.). A entrega acontece
// só em confirmarCompraDinheiro.
// =============================================
exports.solicitarCompraDinheiro = onCall(
  { secrets: [RECAPTCHA_SECRET], region: "southamerica-east1" },
  async (request) => {
    const { pendingRef, item, valorCentavos, quantidade } =
      await registrarCompraPendente(request, "AGUARDANDO_CONFIRMACAO_MESTRE");

    return {
      compraId: pendingRef.id,
      itemNome: item.nome,
      totalCentavos: valorCentavos * quantidade,
    };
  }
);

// =============================================
// COMPRA EM DINHEIRO — CONFIRMAÇÃO DO MESTRE (callable)
// aprovar=true  → entrega os benefícios (mesmo caminho do webhook)
// aprovar=false → cancela e avisa o jogador
// =============================================
exports.confirmarCompraDinheiro = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    const autor = await exigirMestre(request);
    const { compraId, aprovar } = request.data || {};

    if (!compraId || typeof compraId !== "string") {
      throw new HttpsError("invalid-argument", "compraId é obrigatório.");
    }

    const pendingRef = db.collection("compras_pendentes").doc(compraId);
    const snap = await pendingRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Pedido não encontrado.");
    }
    const pending = snap.data();

    if (pending.status === "CONCLUIDA") {
      throw new HttpsError("failed-precondition", "Este pedido já foi entregue.");
    }
    if (pending.status !== "AGUARDANDO_CONFIRMACAO_MESTRE") {
      throw new HttpsError("failed-precondition", "Este pedido não é de pagamento em dinheiro.");
    }

    if (aprovar === false) {
      await pendingRef.update({
        status: "CANCELADA",
        canceladaEm: FieldValue.serverTimestamp(),
        canceladaPor: autor,
      });

      // Avisa o jogador — sem isso o pedido some sem explicação
      const userRef = await resolveUserRef(pending.uid, pending.email || "");
      await db.runTransaction(async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists) return;
        const notifications = uSnap.data().notifications || [];
        notifications.unshift({
          id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          type: "master_message",
          message: `❌ Pedido cancelado: ${pending.quantidade || 1}x ${pending.itemNome}. Fale com o mestre.`,
          timestamp: Date.now(),
          isNew: true,
        });
        if (notifications.length > 100) notifications.length = 100;
        tx.update(userRef, { notifications });
      });

      return { ok: true, status: "CANCELADA" };
    }

    await entregarCompra(pendingRef, pending, "Dinheiro", {
      pendingExtra: { confirmadaPor: autor },
      logExtra: { confirmadaPor: autor },
    });

    return { ok: true, status: "CONCLUIDA" };
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
