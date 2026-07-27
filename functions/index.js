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

initializeApp();
const db = getFirestore();

// ---------------------------------------------
// PagBank — configuração
// ---------------------------------------------
// Token fica em um Secret do Firebase (NUNCA no código nem no frontend):
//   firebase functions:secrets:set PAGBANK_TOKEN
const PAGBANK_TOKEN = defineSecret("PAGBANK_TOKEN");

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

// Trocar para "https://api.pagseguro.com" quando for para produção (pós-homologação)
const PAGBANK_API = "https://sandbox.api.pagseguro.com";

// URL pública do Hosting (projeto rpg-lendasereliquias)
const SITE_URL = "https://rpg-lendasereliquias.web.app";

// URL pública do webhook (formato determinístico das functions gen2 no
// cloudfunctions.net). Após o primeiro deploy, confirme com a URL impressa
// pelo `firebase deploy --only functions` — se vier no formato *.run.app,
// qualquer uma das duas funciona.
const WEBHOOK_URL =
  "https://southamerica-east1-rpg-lendasereliquias.cloudfunctions.net/pagbankWebhook";

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
// PAGBANK — CRIAÇÃO DO CHECKOUT (callable)
// O jogador clica em "Comprar por R$" → esta função valida tudo,
// registra a intenção de compra e devolve o link seguro do PagBank.
// O preço vem SEMPRE do Firestore; o navegador envia só itemId + metas.
// =============================================
exports.criarCheckoutPagBank = onCall(
  { secrets: [PAGBANK_TOKEN, RECAPTCHA_SECRET], region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para comprar.");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemId, selectedMetas, quantidade: reqQuantidade, recaptchaToken } = request.data || {};

    // Verificação anti-bot ANTES de qualquer operação de pagamento
    await verificarRecaptcha(recaptchaToken, "comprar_loja");

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
      throw new HttpsError("failed-precondition", "Este item não está à venda por dinheiro real.");
    }
    // Campo real usado pelo projeto é `isVendaAtiva` (default true quando ausente)
    if (item.isVendaAtiva === false) {
      throw new HttpsError("failed-precondition", "Este item não está à venda no momento.");
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

    // Registro da intenção de compra (também serve de trilha de auditoria)
    const totalCentavos = valorCentavos * quantidade;
    const pendingRef = db.collection("compras_pendentes").doc();
    await pendingRef.set({
      uid,
      email,
      itemId,
      itemNome: item.nome,
      valorCentavos,
      quantidade,
      totalCentavos,
      selectedMetas: metas,
      status: "AGUARDANDO_PAGAMENTO",
      criadoEm: FieldValue.serverTimestamp(),
    });

    const body = {
      reference_id: pendingRef.id,
      items: [{
        reference_id: itemId,
        name: String(item.nome).slice(0, 100),
        description: String(item.descricao || item.nome).slice(0, 255),
        quantity: quantidade,
        unit_amount: valorCentavos,
      }],
      shipping: { type: "FREE" },
      redirect_url: `${SITE_URL}/menu/menu.html?compra=${pendingRef.id}`,
      return_url: `${SITE_URL}/menu/menu.html`,
      payment_notification_urls: [WEBHOOK_URL],
      notification_urls: [WEBHOOK_URL],
      payment_methods: [{ type: "PIX" }, { type: "CREDIT_CARD" }, { type: "BOLETO" }],
    };

    const resp = await fetch(`${PAGBANK_API}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAGBANK_TOKEN.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Erro PagBank ao criar checkout:", resp.status, errText);
      await pendingRef.update({ status: "ERRO_CRIACAO", erro: errText.slice(0, 1000) });
      throw new HttpsError("internal", "Falha ao criar o checkout no PagBank.");
    }

    const checkout = await resp.json();
    const payLink = (checkout.links || []).find((l) => l.rel === "PAY");
    if (!payLink) {
      console.error("Resposta sem link PAY:", JSON.stringify(checkout).slice(0, 2000));
      await pendingRef.update({ status: "ERRO_CRIACAO", erro: "Sem link PAY na resposta." });
      throw new HttpsError("internal", "PagBank não retornou o link de pagamento.");
    }

    await pendingRef.update({ checkoutId: checkout.id });
    return { paymentUrl: payLink.href, compraId: pendingRef.id };
  }
);

// =============================================
// PAGBANK — WEBHOOK DE CONFIRMAÇÃO
// O PagBank chama esta URL quando o pagamento muda de status.
// NUNCA confia no corpo da notificação: sempre reconsulta a API
// com o token para confirmar `PAID` antes de entregar o item.
// Idempotente: compra CONCLUIDA nunca é aplicada de novo.
// Toda entrega gera um log imutável em `real_logs`.
// =============================================
exports.pagbankWebhook = onRequest(
  { secrets: [PAGBANK_TOKEN], region: "southamerica-east1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const payload = req.body || {};
      console.log("Webhook recebido:", JSON.stringify(payload).slice(0, 2000));

      const referenceId =
        payload.reference_id ||
        payload?.checkout?.reference_id ||
        payload?.order?.reference_id ||
        null;

      const orderId =
        typeof payload.id === "string" && payload.id.startsWith("ORDE_") ? payload.id : null;
      const checkoutId =
        (typeof payload.id === "string" && payload.id.startsWith("CHEC_") && payload.id) ||
        payload?.checkout?.id || null;

      if (!referenceId) {
        res.status(200).send("ignored: sem reference_id");
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

      // Confirmação server-to-server — nunca confiar apenas no payload
      let pago = false;
      if (orderId) {
        const r = await fetch(`${PAGBANK_API}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${PAGBANK_TOKEN.value()}` },
        });
        if (r.ok) {
          const order = await r.json();
          pago = (order.charges || []).some((c) => c.status === "PAID");
        }
      } else if (checkoutId || pending.checkoutId) {
        const cid = checkoutId || pending.checkoutId;
        const r = await fetch(`${PAGBANK_API}/checkouts/${cid}`, {
          headers: { Authorization: `Bearer ${PAGBANK_TOKEN.value()}` },
        });
        if (r.ok) {
          const chk = await r.json();
          pago = chk.status === "PAID" || (chk.charges || []).some((c) => c.status === "PAID");
        }
      }

      if (!pago) {
        await pendingRef.update({ ultimaNotificacao: FieldValue.serverTimestamp() });
        res.status(200).send("ok: ainda não pago");
        return;
      }

      // Aplica os benefícios — MESMOS formatos da compra com Frag$
      const itemSnap = await db.collection("loja_itens").doc(pending.itemId).get();
      const item = itemSnap.exists ? itemSnap.data() : { nome: pending.itemNome, descricao: "" };
      const metasNamesStr = await getMetasNames(pending.selectedMetas || []);
      const userRef = await resolveUserRef(pending.uid, pending.email || "");

      await db.runTransaction(async (tx) => {
        const pSnap = await tx.get(pendingRef);
        if (pSnap.data().status === "CONCLUIDA") return; // corrida entre notificações

        const uSnap = await tx.get(userRef);
        if (!uSnap.exists) throw new Error("Usuário não encontrado: " + pending.uid);
        const data = uSnap.data();

        const quantidade = pending.quantidade || 1;
        const totalCentavos = pending.totalCentavos || pending.valorCentavos;
        const valorReais = (totalCentavos / 100).toFixed(2).replace(".", ",");

        const inventario = data.inventario || [];
        const existingItemIndex = inventario.findIndex(i => i.nome === item.nome);
        if (existingItemIndex !== -1) {
          inventario[existingItemIndex].quantidade = (inventario[existingItemIndex].quantidade || 1) + quantidade;
        } else {
          inventario.push({
            ...item,
            quantidade: quantidade,
            formaRecebimento: "Comprado na Loja (PagBank)",
          });
        }

        const logsCompra = data.logsCompra || [];
        logsCompra.push({
          itemId: pending.itemId,
          nome: item.nome,
          valorPago: totalCentavos,
          moeda: "BRL",
          compraId: pendingRef.id,
          data: new Date().toISOString(),
        });

        const apoios = data.apoios || [];
        apoios.push({
          nome: item.nome,
          tipo: "Loja (PagBank)",
          montante: quantidade,
          meta: (pending.selectedMetas || []).join(","),
          valor: valorReais,
          dataInicio: new Date().toISOString().split("T")[0],
          recebido: true,
        });

        const notifications = data.notifications || [];
        notifications.unshift({
          id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          type: "master_message",
          message: `💳 Compra Aprovada: Você adquiriu ${quantidade}x ${item.nome} por R$ ${valorReais}.`,
          timestamp: Date.now(),
          isNew: true,
          data: { highlight: "importante" },
        });
        if (notifications.length > 100) notifications.length = 100;

        tx.update(userRef, { inventario, logsCompra, apoios, notifications });
        tx.update(pendingRef, {
          status: "CONCLUIDA",
          concluidaEm: FieldValue.serverTimestamp(),
        });

        // Log imutável de transação em dinheiro real (equivalente ao frag_logs)
        tx.set(db.collection("real_logs").doc(), {
          uid: pending.uid,
          jogador: data.displayName || data.email || pending.email || "",
          itemId: pending.itemId,
          itemNome: item.nome,
          valorCentavos: totalCentavos,
          moeda: "BRL",
          compraId: pendingRef.id,
          checkoutId: pending.checkoutId || checkoutId || "",
          orderId: orderId || "",
          origem: "Compra na Loja (PagBank)",
          detalhe: `${quantidade}x - ` + (metasNamesStr ? `Metas: ${metasNamesStr}` : ""),
          criadoEm: FieldValue.serverTimestamp(),
        });
      });

      res.status(200).send("ok: benefícios aplicados");
    } catch (e) {
      console.error("Erro no webhook:", e);
      // 500 → o PagBank reenviará a notificação (a idempotência protege contra duplicação)
      res.status(500).send("erro interno");
    }
  }
);
