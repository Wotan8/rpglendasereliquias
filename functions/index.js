// =============================================
// CLOUD FUNCTIONS — Lendas e Relíquias
// - comprarComFragmentos: compra segura na Loja (Admin SDK, ignora as rules)
// - registrarLogFragmentos: auditoria automática de TODA alteração de Frag$
// =============================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

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
    const { itemId, selectedMetas } = request.data || {};
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
      const limit = item.qtdSelecaoMeta || 1;
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

      const saldoAtual = data.fragmentos || 0;
      if (saldoAtual < valorFrag) {
        throw new HttpsError(
          "failed-precondition",
          `Você não tem Fragmentos suficientes. Custo: ${valorFrag} Frag$.`
        );
      }
      novoSaldo = saldoAtual - valorFrag;

      const inventario = data.inventario || [];
      inventario.push({
        ...item,
        quantidade: 1,
        formaRecebimento: "Comprado na Loja (Frag$)",
      });

      const logsCompra = data.logsCompra || [];
      logsCompra.push({
        itemId,
        nome: item.nome,
        valorPago: valorFrag,
        moeda: "Frag$",
        data: new Date().toISOString(),
      });

      const apoios = data.apoios || [];
      const logNome = item.nome + (metasNamesStr ? ` [Metas: ${metasNamesStr}]` : "");
      apoios.push({
        nome: logNome,
        tipo: "Loja (Frag$)",
        montante: 1,
        meta: metas.join(","),
        valor: "",
        dataInicio: new Date().toISOString().split("T")[0],
        recebido: true,
      });

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: `💎 Compra Aprovada: Você adquiriu ${item.nome} por ${valorFrag} Frag$.`,
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
          detalhe: `${item.nome} (itemId: ${itemId})`,
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
