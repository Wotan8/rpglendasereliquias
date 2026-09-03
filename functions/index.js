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
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");
const { aplicarCompra, pesoProducao, rerolagensDoItem, MAX_LOGS_COMPRA } = require("./entrega-calc");
const { TAXAS_PADRAO, calcularCobranca, EXCLUIR_POR_MEIO } = require("./taxa-gateway");
const { sortear, aplicarPremio, girosDoItem } = require("./roleta-sorteio");
const { aplicarExpDeItem } = require("./exp-item");
const { charParaNpc, devolucaoExpVip, itemDevolucao } = require("./char-para-npc");
const { itemParaCaixa, pecaParaAviso, retirarDoRepertorio, devolverAoRepertorio, PREFIXO_CAIXA } = require("./item-para-mesa");
const { decidirCargo } = require("./cargo");
const { conferirAssinatura, classificarPagamento, conferirValorPago, reais } = require("./mp-webhook");
const { decidirLimite, esperaEmTexto } = require("./rate-limit");
const { charIdsVinculados, normalizarDonos, mudou } = require("./npc-donos");
const { empilhar } = require("./repertorio");
const { avisoNovo, tokensMortos } = require("./push-aviso");
const { gastarAplicacao, usosRestantes } = require("./narrativo-uso");
const { planejarEntrega } = require("./equip-repertorio");

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

// Chave de "Assinatura secreta" do webhook, no painel do Mercado Pago:
//   firebase functions:secrets:set MP_WEBHOOK_SECRET
// Sem ela o webhook continua entregando (a integridade vem da reconsulta com
// o token), mas fica aberto a POST de qualquer origem — ver o comentário na
// função.
const MP_WEBHOOK_SECRET = defineSecret("MP_WEBHOOK_SECRET");

// Nota mínima aceita (0.0 = provável bot, 1.0 = provável humano).
// 0.5 é o padrão recomendado pelo Google.
const RECAPTCHA_MIN_SCORE = 0.5;

// Verifica o token reCAPTCHA v3 no servidor. Lança HttpsError se reprovar.
async function verificarRecaptcha(token, acaoEsperada) {
  const secret = RECAPTCHA_SECRET.value();
  /* Faltando o secret, ISTO PARA. Antes ele deixava passar com um aviso no
     log: se a chave sumisse do Secret Manager (rotação, projeto novo, deploy
     em outro ambiente), a proteção anti-bot desaparecia em silêncio e ninguém
     ficava sabendo. Falha aberta em caminho de pagamento é a pior espécie —
     parece que está protegendo e não está. */
  if (!secret) {
    console.error("RECAPTCHA_SECRET ausente — compra bloqueada. Configure com: firebase functions:secrets:set RECAPTCHA_SECRET");
    throw new HttpsError("failed-precondition",
      "A verificação de segurança está indisponível. Avise o mestre — nenhuma cobrança foi feita.");
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
    /* A cópia fiel do que saiu do Repertório. É por ela que a recusa devolve
       — nunca pelo documento de `items`, que o jogador consegue editar. */
    peca: aviso.peca || null,
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
// E-MAIL VERIFICADO — só para quem se cadastrar de agora em diante
//
// O cadastro nunca mandou e-mail de verificação, e o resultado é medível: em
// 31/08/2026, ZERO das 19 contas tinham e-mail confirmado — a do criador
// inclusive. Exigir verificação de todos naquele dia trancaria a Loja para a
// mesa inteira.
//
// Então a régua é por data de criação da conta: quem nasceu depois do corte
// confirma o e-mail antes de comprar; quem já estava aqui segue como está,
// com o convite para confirmar aparecendo no Portal.
//
// A data vem do Auth (Admin SDK), não do campo `createdAt` do documento — esse
// o próprio dono escreve, e antedatá-lo pularia a regra.
// ---------------------------------------------
const CORTE_VERIFICACAO = Date.parse("2026-09-01T00:00:00Z");

async function exigirEmailVerificado(request) {
  if (request.auth.token.email_verified) return;

  const conta = await getAuth().getUser(request.auth.uid);
  const criadaEm = Date.parse(conta.metadata.creationTime);
  if (!Number.isFinite(criadaEm) || criadaEm < CORTE_VERIFICACAO) return;

  throw new HttpsError("failed-precondition",
    "Confirme seu e-mail antes de comprar. Procure a mensagem do Lendas e Relíquias " +
    "na sua caixa de entrada — dá para reenviar pelo aviso no topo do Portal.");
}

// ---------------------------------------------
// FREIO POR USUÁRIO
//
// Nenhuma callable tinha limite. Com um login válido — e o cadastro é aberto —
// dava para chamar `criarCheckoutMercadoPago` em laço: cada chamada cria uma
// preferência no Mercado Pago e um documento em `compras_pendentes`. Não rouba
// nada; enche a conta do MP de lixo, queima cota e custa invocação.
//
// Um documento por (uid, ação), em transação. A decisão é pura e está em
// `rate-limit.js` — aqui só mora o I/O.
// ---------------------------------------------
async function limitarChamadas(uid, acao, limite, janelaMs) {
  const ref = db.collection("rate_limits").doc(`${uid}__${acao}`);
  const agora = Date.now();

  const r = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = decidirLimite(snap.exists ? snap.data() : null, agora, limite, janelaMs);
    // Chamada recusada não grava: incrementar o contador de quem já estourou
    // empurraria o fim da espera para frente a cada tentativa.
    if (d.permitido) tx.set(ref, { ...d.estado, acao, uid, atualizadoEm: agora });
    return d;
  });

  if (!r.permitido) {
    throw new HttpsError("resource-exhausted",
      `Você fez isso vezes demais. Tente de novo em ${esperaEmTexto(r.esperarMs)}.`);
  }
}

// ---------------------------------------------
// Helper: o documento do usuário é `users/{uid}`. Ponto.
//
// Antes esta função procurava em cascata — 1) campo `uid`, 2) campo `email`,
// 3) doc com ID = uid — e os dois primeiros eram campos que o próprio dono do
// documento podia escrever. Bastava gravar `uid: <uid da vítima>` no próprio
// doc para que TODA operação da vítima resolvesse para o documento do
// atacante: o débito de Frag$, o consumo do Repertório e, pelo webhook, a
// entrega da compra em dinheiro real.
//
// A cascata era herança de docs antigos com ID diferente do uid. Não existe
// mais nenhum: os 18 documentos conferidos em 31/08/2026 têm ID = uid do Auth
// e nenhum tem o campo `uid`. As rules agora também impedem que `uid`/`email`
// mintam (identidadeCorreta / naoMexeuNaIdentidade).
// ---------------------------------------------
function resolveUserRef(uid) {
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
    await exigirEmailVerificado(request);

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

    const userRef = resolveUserRef(uid);
    let novoSaldo = 0;
    let novosGiros = 0;
    let novasRerolagens = 0;

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

      // Mesma regra do caminho em dinheiro (ver `repertorio.js`).
      const inventario = empilhar(data.inventario, item, {
        quantidade,
        itemId,
        formaRecebimento: "Comprado na Loja (Frag$)",
      });

      const logsCompra = data.logsCompra || [];
      logsCompra.push({
        itemId,
        nome: item.nome,
        valorPago: totalFrag,
        moeda: "Frag$",
        data: new Date().toISOString(),
      });
      // Mesmo teto do caminho em dinheiro (ver aplicarCompra em entrega-calc).
      if (logsCompra.length > MAX_LOGS_COMPRA) {
        logsCompra.splice(0, logsCompra.length - MAX_LOGS_COMPRA);
      }

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
      // aparecer um terceiro. Por ora só os saldos andam nos dois.
      novosGiros = (data.giros || 0) + girosDoItem(item, quantidade);
      novasRerolagens = (data.rerolagens || 0) + rerolagensDoItem(item, quantidade);

      tx.update(userRef, {
        fragmentos: novoSaldo,
        inventario,
        logsCompra,
        apoios,
        notifications,
        giros: novosGiros,
        rerolagens: novasRerolagens,
        // Marcador de atribuição lido pelo gatilho de auditoria (registrarLogFragmentos)
        fragLastOp: {
          origem: "Compra na Loja (Frag$)",
          detalhe: `${quantidade}x ${item.nome} (itemId: ${itemId})`,
          autor: email || uid,
          ts: Date.now(),
        },
      });
    });

    return { ok: true, novoSaldo, novosGiros, novasRerolagens };
  }
);

// =============================================
// CARGO — APROVAR, RECUSAR OU DEFINIR (callable)
//
// Único caminho para `users.role` desde que o campo entrou na lista de
// protegidos das rules. Antes o cargo era do dono do documento: bastava
// `updateDoc(users/meuUid, {role:'criador'})` no console para ganhar o
// catálogo inteiro — e o "código secreto do mestre" do cadastro era só
// enfeite de frontend, porque nada no servidor o conferia.
//
// Agora o jogador PEDE (`cargoSolicitado`, campo livre que não vale nada
// sozinho) e um Criador decide aqui.
//
//   { uid, cargo: 'mestre' }  → aprova/define o cargo
//   { uid }                   → recusa: só limpa o pedido, cargo não muda
// =============================================
exports.definirCargo = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const autorUid = request.auth.uid;
    const autorEmail = request.auth.token.email || "";

    // Só Criador decide cargo. Mestre não promove ninguém — senão o primeiro
    // mestre aprovado vira a porta para todos os outros.
    const autorSnap = await db.collection("users").doc(autorUid).get();
    const autorEhCriador = autorSnap.exists && autorSnap.data().role === "criador";
    if (!autorEhCriador) {
      throw new HttpsError("permission-denied", "Só um Criador pode decidir cargos.");
    }

    const { uid, cargo } = request.data || {};
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Diga de qual conta é o cargo.");
    }
    if (uid === autorUid) {
      throw new HttpsError("failed-precondition",
        "Você não pode mexer no próprio cargo. Peça a outro Criador.");
    }
    const alvoRef = db.collection("users").doc(uid);
    let resultado;

    await db.runTransaction(async (tx) => {
      const alvoSnap = await tx.get(alvoRef);
      if (!alvoSnap.exists) throw new HttpsError("not-found", "Conta não encontrada.");
      const alvo = alvoSnap.data();

      let d;
      try {
        d = decidirCargo(alvo, cargo == null ? null : cargo);
      } catch (e) {
        throw new HttpsError(e.codigo || "failed-precondition", e.message);
      }

      const patch = { cargoSolicitado: FieldValue.delete() };
      if (d.role != null) patch.role = d.role;

      const notifications = alvo.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: d.mensagem,
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: "importante" },
      });
      if (notifications.length > 100) notifications.length = 100;
      patch.notifications = notifications;

      tx.update(alvoRef, patch);

      tx.set(db.collection("cargo_logs").doc(), {
        uid,
        jogador: alvo.displayName || alvo.email || "",
        cargoAntes: d.cargoAntes,
        cargoDepois: d.cargoDepois,
        pedido: d.pedido,
        decisao: d.decisao,
        autorUid,
        autor: autorEmail,
        criadoEm: FieldValue.serverTimestamp(),
      });

      resultado = { cargo: d.cargoDepois, aprovado: d.decisao === "aprovado" };
    });

    /* O cargo também vai para o TOKEN, como custom claim. As rules leem de lá
       primeiro: chega assinado pelo Auth, não custa leitura de documento e não
       depende de `users` continuar legível.

       E a sessão é REVOGADA junto. Sem isso, rebaixar alguém não teria efeito
       até o token dele expirar — até uma hora com o cargo antigo na mão, que é
       a última coisa que se quer de uma revogação de acesso. O preço é a pessoa
       precisar entrar de novo, o que numa mudança de cargo é aceitável e até
       esperado.

       Depois da transação de propósito: se isto falhar, o documento já está
       certo e a reserva das rules (`papelNoDoc`) cobre. O contrário — claim
       gravada e documento não — deixaria os dois discordando. */
    try {
      await getAuth().setCustomUserClaims(uid, { role: resultado.cargo });
      await getAuth().revokeRefreshTokens(uid);
    } catch (e) {
      console.error("cargo gravado no documento, mas a claim falhou:", uid, e);
    }

    return { ok: true, ...resultado };
  }
);

// =============================================
// LINK DE REDEFINIÇÃO DE SENHA (callable)
//
// O último caminho de recuperação, para quem perdeu o acesso ao próprio
// e-mail — aí o "esqueci minha senha" do Portal não alcança.
//
// O Criador gera o link aqui e manda pelo WhatsApp que a pessoa cadastrou. O
// desenho tem uma propriedade que importa: **ninguém vê nem digita senha
// alheia**. O link leva a pessoa à tela do Firebase, onde ela escolhe a
// própria. O Criador nunca fica com acesso à conta.
//
// É a operação mais sensível do sistema — quem recupera uma conta, entra
// nela. Por isso: só Criador, nunca em outro Criador, e sempre com trilha
// imutável em `recuperacao_logs`.
// =============================================
exports.gerarLinkDeRecuperacao = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const autorUid = request.auth.uid;
    const autorEmail = request.auth.token.email || "";

    const autor = await db.collection("users").doc(autorUid).get();
    if (!autor.exists || autor.data().role !== "criador") {
      throw new HttpsError("permission-denied", "Só um Criador pode gerar link de recuperação.");
    }

    const { uid } = request.data || {};
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Diga de qual conta é a recuperação.");
    }

    const alvoDoc = await db.collection("users").doc(uid).get();
    if (!alvoDoc.exists) throw new HttpsError("not-found", "Conta não encontrada.");
    // Criador não recupera Criador: seria o caminho curto para um assumir a
    // conta do outro sem deixar de ser "uma operação legítima".
    if (uid !== autorUid && alvoDoc.data().role === "criador") {
      throw new HttpsError("permission-denied",
        "Não dá para gerar link de outro Criador. Ele usa o 'Esqueci minha senha' do Portal.");
    }

    const conta = await getAuth().getUser(uid);
    if (!conta.email) {
      throw new HttpsError("failed-precondition", "Esta conta não tem e-mail para redefinir.");
    }

    const link = await getAuth().generatePasswordResetLink(conta.email);

    await db.collection("recuperacao_logs").add({
      uid,
      jogador: alvoDoc.data().displayName || conta.email,
      emailDaConta: conta.email,
      whatsappCadastrado: alvoDoc.data().whatsapp || "",
      emailRecuperacaoCadastrado: alvoDoc.data().emailRecuperacao || "",
      autorUid,
      autor: autorEmail,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      link,
      jogador: alvoDoc.data().displayName || conta.email,
      email: conta.email,
      whatsapp: alvoDoc.data().whatsapp || "",
      emailRecuperacao: alvoDoc.data().emailRecuperacao || "",
    };
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
// DONO DO NPC ALIADO (gatilho)
//
// A ficha chama de "aliado" o NPC que tem, em `vinculos`, uma entrada
// `{tipo:'personagem', id:<charId>}`, e deixa o jogador mexer no inventário
// dele. As rules de `items` sustentavam isso do jeito mais largo possível —
// "o characterId existe na coleção npcs" — o que dava a QUALQUER conta logada
// poder de editar e apagar item de QUALQUER NPC do cenário.
//
// Rules não sabem varrer lista de objetos. Então o vínculo é achatado aqui em
// `donosUids`, que elas sabem ler com um `in`. Quem manda continua sendo
// `vinculos`; este campo é espelho, e é recalculado a cada escrita no NPC —
// inclusive quando o mestre DESVINCULA, que é a hora em que o acesso tem de
// sumir.
// =============================================
exports.espelharDonoDoNpc = onDocumentWritten(
  { document: "npcs/{npcId}", region: "southamerica-east1" },
  async (event) => {
    if (!event.data.after.exists) return;
    const npc = event.data.after.data();

    const uids = [];
    for (const charId of charIdsVinculados(npc)) {
      const snap = await db.collection("char").doc(charId).get();
      if (snap.exists && snap.data().ownerUid) uids.push(snap.data().ownerUid);
    }

    const donos = normalizarDonos(uids);
    // Sem esta guarda o gatilho se dispara em laço: ele grava no mesmo
    // documento que o acordou.
    if (!mudou(npc.donosUids, donos)) return;

    await event.data.after.ref.update({ donosUids: donos });
  }
);

// =============================================
// ESPELHO PÚBLICO DO JOGADOR (gatilho)
//
// A coleção `users` era legível por qualquer conta logada — e ali dentro moram
// e-mail, saldo de Frag$, Repertório inteiro, histórico de compras em reais e
// as notificações. Duas telas de JOGADOR precisavam mesmo de dado dos outros:
// as Metas (soma coletiva dos apoios) e o Tabuleiro (nome de quem está na mesa).
//
// Então a leitura de `users` fechou e nasceu esta projeção, com o mínimo:
// o nome de exibição e os apoios SEM o valor em reais.
//
// Os apoios saem no MESMO formato que `shared/apoios-calc.js` consome
// (`tipo`, `montante`, `meta`, `peso`) de propósito: assim o cliente continua
// somando com a mesma função de sempre. Recalcular aqui exigiria copiar aquela
// matemática para cá — que é exatamente a divergência silenciosa que o
// cabeçalho daquele arquivo conta ter acontecido quando cada tela fazia a
// própria conta.
// =============================================
function projecaoPublica(data) {
  return {
    displayName: data.displayName || "",
    apoios: (data.apoios || []).map((a) => ({
      tipo: a.tipo || "",
      montante: a.montante == null ? 1 : a.montante,
      meta: a.meta || "",
      ...(a.peso === undefined ? {} : { peso: a.peso }),
    })),
  };
}

exports.espelharUsuarioPublico = onDocumentWritten(
  { document: "users/{userId}", region: "southamerica-east1" },
  async (event) => {
    const ref = db.collection("users_public").doc(event.params.userId);

    if (!event.data.after.exists) {
      await ref.delete();
      return;
    }

    const depois = projecaoPublica(event.data.after.data());
    // Só grava quando a PARTE PÚBLICA muda. Sem esta guarda, cada notificação
    // nova (e são muitas) geraria uma escrita aqui sem nada de novo dentro.
    if (event.data.before.exists) {
      const antes = projecaoPublica(event.data.before.data());
      if (JSON.stringify(antes) === JSON.stringify(depois)) return;
    }

    await ref.set({ ...depois, atualizadoEm: FieldValue.serverTimestamp() });
  }
);

// =============================================
// PUSH — o aviso que alcanca o celular no bolso
// ---------------------------------------------
// UM gatilho, e nao uma chamada de envio em cada lugar que escreve
// `notifications`. Sao oito hoje (compra, entrega, roleta, EXP, item para a
// mesa, mensagem do mestre...) e serao mais amanha: espalhar o envio por
// todos eles garante que o proximo nasca sem push, e ninguem percebe — o
// aviso simplesmente nao chega, e nao ha erro nenhum para investigar.
//
// A regra e uma so: mudou a notificacao do TOPO, avisa. `notifications` e
// uma pilha com `unshift`, entao "chegou coisa nova" e exatamente isso.
// =============================================

exports.avisarPush = onDocumentWritten(
  { document: "users/{userId}", region: "southamerica-east1" },
  async (event) => {
    if (!event.data.after.exists) return;
    const depois = event.data.after.data();

    const tokens = (depois.fcmTokens || [])
      .filter((t) => typeof t === "string" && t)
      .slice(0, 500);   // teto da API; ninguem tem 500 aparelhos
    if (!tokens.length) return;

    const aviso = avisoNovo(event.data.before.exists ? event.data.before.data() : null, depois);
    if (!aviso) return;

    let resposta;
    try {
      resposta = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: "Lendas e Relíquias", body: aviso.texto },
        data: { url: "/index.html", tag: aviso.tag },
        webpush: { fcmOptions: { link: "/index.html" } },
      });
    } catch (e) {
      // Push e conveniencia. Se o envio falha, o aviso continua no doc e
      // aparece na proxima vez que a pessoa abrir o site.
      console.warn("push nao saiu:", e && e.message);
      return;
    }

    const mortos = tokensMortos(tokens, resposta.responses);
    if (mortos.length) {
      await event.data.after.ref.update({ fcmTokens: FieldValue.arrayRemove(...mortos) });
    }
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

  const userRef = resolveUserRef(pending.uid);

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
      const { inventario, logsCompra, apoios, notifications, giros, rerolagens, quantidade, totalCentavos } =
        aplicarCompra(data, item, pendenteLinha, origem);
      // O resultado de uma linha é o estado de partida da próxima — inclusive
      // `giros`, senão um carrinho com dois itens de roleta credita só o último
      data = { ...data, inventario, logsCompra, apoios, notifications, giros, rerolagens };

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
      rerolagens: data.rerolagens || 0,
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

    const userRef = resolveUserRef(uid);
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

    const userRef = resolveUserRef(uid);
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
        peca: pecaParaAviso(retirada.item, qtd),
        mesaId,
        acao: "Abrir a Caixa do Mestre desta mesa",
      });

      enviado = { itemId: doc.id, quantidade: qtd, restante: retirada.restante, mesa: mesa.nome || "" };
    });

    return { ok: true, ...enviado };
  }
);

// =============================================
// RECUSAR ITEM MANDADO PARA A MESA (callable)
// O mestre recusa pelo próprio aviso: a peça sai da Caixa, as unidades voltam
// ao Repertório do jogador e ele é avisado. Tudo na mesma gravação — não
// existe estado em que a peça sumiu da caixa e não voltou para o jogador.
//
// Servidor porque devolver mexe em `inventario` (campo protegido) e porque
// dois dos três mestres entram só pelo `role`, sem doc em `masters` — as
// rules não os deixariam escrever no doc do jogador.
// =============================================
async function exigirMestrePorQualquerCaminho(uid) {
  const m = await db.collection("masters").doc(uid).get();
  if (m.exists) return true;
  const u = await db.collection("users").doc(uid).get();
  return u.exists && ["mestre", "criador"].includes(u.data().role);
}

/* Ser mestre em algum lugar não é ser mestre NAQUELA mesa. Sem este recorte,
   qualquer mestre resolvia aviso de mesa alheia — e a recusa mexe no
   Repertório de um jogador que nem é dele.
   A mesa guarda o e-mail de quem a criou (`createdBy`); não há campo de uid.
   Criador continua passando em tudo: é quem administra o sistema. */
async function mandaNaMesa(uid, email, mesaId) {
  const u = await db.collection("users").doc(uid).get();
  if (u.exists && u.data().role === "criador") return true;
  if (!mesaId) return false;
  const mesa = await db.collection("mesas").doc(mesaId).get();
  return mesa.exists && !!email && mesa.data().createdBy === email;
}

exports.recusarItemDaMesa = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";

    if (!(await exigirMestrePorQualquerCaminho(uid))) {
      throw new HttpsError("permission-denied", "Só o mestre pode recusar um envio.");
    }

    const { avisoId } = request.data || {};
    if (!avisoId || typeof avisoId !== "string") {
      throw new HttpsError("invalid-argument", "Diga qual aviso recusar.");
    }

    // Pré-leitura fora da transação só para achar o jogador (resolveUserRef
    // faz consultas, que transação não aceita). Tudo é RELIDO lá dentro.
    const avisoRef = db.collection("avisos_mestre").doc(avisoId);
    const previa = await avisoRef.get();
    if (!previa.exists) throw new HttpsError("not-found", "Aviso não encontrado.");
    const jogadorUid = previa.data().jogadorUid || "";
    if (!jogadorUid) {
      throw new HttpsError("failed-precondition", "Este aviso não tem jogador para devolver.");
    }
    if (!(await mandaNaMesa(uid, email, previa.data().mesaId))) {
      throw new HttpsError("permission-denied",
        "Este aviso é de outra mesa. Só o mestre daquela mesa pode recusar.");
    }
    const userRef = resolveUserRef(jogadorUid);

    let resultado;
    await db.runTransaction(async (tx) => {
      const avisoSnap = await tx.get(avisoRef);
      if (!avisoSnap.exists) throw new HttpsError("not-found", "Aviso não encontrado.");
      const aviso = avisoSnap.data();

      if (aviso.tipo !== "item-para-mesa") {
        throw new HttpsError("failed-precondition", "Este aviso não é de item enviado para a mesa.");
      }
      if (aviso.status !== "novo") {
        throw new HttpsError("failed-precondition", "Este aviso já foi resolvido.");
      }

      const itemRef = db.collection("items").doc(String(aviso.referencia?.id || ""));
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) {
        throw new HttpsError("failed-precondition",
          "A peça não está mais na Caixa do Mestre — alguém já a moveu. Resolva o aviso à mão.");
      }
      const item = itemSnap.data();
      // Se o mestre já transferiu a peça para um personagem/NPC, recusar
      // agora tiraria o item de quem o recebeu. Aí a devolução é manual.
      if (!String(item.characterId || "").startsWith(PREFIXO_CAIXA)) {
        throw new HttpsError("failed-precondition",
          "A peça já saiu da Caixa do Mestre. Se quiser devolver, use o transferir da caixa.");
      }
      /* O doc de `items` serve só para confirmar que a peça ainda está na
         caixa e para apagá-la. Ele NÃO diz o que devolver: o jogador consegue
         escrever nele. Se ele já não é o que o aviso mandou para lá, a peça
         foi trocada — e trocar peça é justamente o ataque. */
      if (item.origemJogadorUid && item.origemJogadorUid !== jogadorUid) {
        throw new HttpsError("failed-precondition",
          "A peça na caixa não é mais a que este aviso registrou. Resolva o aviso à mão.");
      }

      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "O jogador não foi encontrado.");
      const data = uSnap.data();

      /* A VERDADE DA DEVOLUÇÃO é a peça gravada no aviso, e mais nada.
         Antes vinha de `item.origemItemNome` e `item.quantidade` — dois campos
         que o jogador editava depois de virar dono do doc (bastava criar
         `char/__caixa_mestre__<mesaId>` em nome próprio). Mandava 1 unidade de
         qualquer bugiganga, escrevia 999 e o nome do pacote de EXP mais caro,
         e a recusa do mestre creditava tudo isso. */
      const peca = aviso.peca;
      if (!peca || !peca.nome) {
        throw new HttpsError("failed-precondition",
          "Este aviso é anterior à correção e não guarda o que foi enviado. " +
          "Devolva a peça pelo transferir da caixa.");
      }
      const nome = peca.nome;
      const qtd = Math.max(1, parseInt(peca.quantidade, 10) || 1);

      const inventario = devolverAoRepertorio(data.inventario, peca);

      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "master_message",
        message: `↩️ O mestre devolveu ${qtd}x ${nome} ao seu Repertório — a peça não entrou na mesa.`,
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: "importante" },
      });
      if (notifications.length > 100) notifications.length = 100;

      tx.update(userRef, { inventario, notifications });
      tx.delete(itemRef);
      tx.update(avisoRef, {
        status: "recusado",
        resolvidoEm: new Date().toISOString(),
        resolvidoPor: email,
      });

      resultado = { nome, quantidade: qtd, jogador: aviso.jogador || "" };
    });

    return { ok: true, ...resultado };
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
    const userRef = resolveUserRef(uid);
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

    const userRef = resolveUserRef(uid);
    let novosGiros = 0;

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      const saldo = data.giros || 0;
      if (saldo < 1) {
        throw new HttpsError("failed-precondition", "Você não tem giros. Compre na Loja para girar.");
      }

      const { inventario, notifications, girosGanhos } = aplicarPremio(data, item, String(premio.itemId || ""));
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
// RE-ROLAGEM — GASTAR UMA (callable)
// Gêmeo do débito de giro, e pelo mesmo motivo: `rerolagens` é saldo, e saldo
// que o navegador escreve é saldo infinito. O que a re-rolagem AUTORIZA
// acontece na mesa (o dado rola de novo no Tabuleiro, ou na mão do jogador);
// aqui só se cobra o preço e se registra que foi cobrado.
// =============================================
exports.gastarRerolagem = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para usar uma re-rolagem.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { mesaId, motivo } = request.data || {};

    const userRef = resolveUserRef(uid);
    let restantes = 0;

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      const saldo = data.rerolagens || 0;
      if (saldo < 1) {
        throw new HttpsError("failed-precondition",
          "Você não tem re-rolagens. Compre na Loja para poder rolar de novo.");
      }
      restantes = saldo - 1;

      // Débito e registro na MESMA transação: duas abas abertas não gastam a
      // mesma re-rolagem duas vezes.
      tx.update(userRef, { rerolagens: restantes });
      tx.set(db.collection("rerolagem_logs").doc(), {
        uid,
        jogador: data.displayName || data.email || email,
        mesaId: String(mesaId || ""),
        motivo: String(motivo || "").slice(0, 200),
        saldoAntes: saldo,
        saldoDepois: restantes,
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true, restantes };
  }
);

// =============================================
// BENEFÍCIO NARRATIVO — gastar uma aplicação (callable)
//
// Irmã de `gastarRerolagem`, e pela mesma razão: `inventario` é campo
// protegido nas rules, então quem tira uma aplicação de lá é o servidor.
//
// A DIFERENÇA para a re-rolagem: re-rolagem é mecânica e se resolve sozinha
// — rola o dado de novo e pronto. Benefício narrativo é um pedido que o
// MESTRE precisa honrar na mesa. Por isso o gasto nasce junto de um aviso
// para ele, na mesma transação: benefício gasto que o mestre não fica
// sabendo é dinheiro do jogador virando nada.
//
// O clique é RECIBO, não pedido: o combinado na mesa acontece na conversa, e
// o jogador registra depois que o mestre aceitou. A tela diz isso.
// =============================================
exports.usarBeneficioNarrativo = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado para usar um benefício.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemId, nome, pedido, mesaId } = request.data || {};

    if (!itemId && !nome) {
      throw new HttpsError("invalid-argument", "Diga qual benefício você quer usar.");
    }
    const texto = String(pedido || "").trim().slice(0, 300);
    if (!texto) {
      throw new HttpsError("invalid-argument", "Escreva o que você combinou com o mestre.");
    }

    const userRef = resolveUserRef(uid);
    let restantes = 0;
    let nomeDaPeca = "";

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      const data = uSnap.data();

      let saida;
      try {
        saida = gastarAplicacao(data.inventario || [], { itemId, nome });
      } catch (e) {
        // A conta explica o que houve na língua do jogador; repassar a frase
        // dela é melhor do que um "erro interno" que não ajuda ninguém.
        throw new HttpsError("failed-precondition", e.message);
      }
      restantes = saida.restantes;
      nomeDaPeca = saida.linha.nome || "Benefício narrativo";

      const jogador = data.displayName || data.email || email;

      // Baixa, registro e aviso na MESMA transação: duas abas abertas não
      // gastam a mesma aplicação duas vezes, e não existe benefício gasto
      // sem trilha nem sem o mestre saber.
      tx.update(userRef, { inventario: saida.inventario });
      tx.set(db.collection("narrativo_logs").doc(), {
        uid,
        jogador,
        itemId: String(itemId || ""),
        nome: nomeDaPeca,
        pedido: texto,
        mesaId: String(mesaId || ""),
        restantesDepois: restantes,
        criadoEm: FieldValue.serverTimestamp(),
      });
      avisarMestre(tx, {
        tipo: "beneficio-narrativo",
        titulo: `📜 ${jogador} usou ${nomeDaPeca}`,
        mensagem: texto,
        jogadorUid: uid,
        jogador,
        mesaId: String(mesaId || ""),
      });
    });

    return { ok: true, restantes, nome: nomeDaPeca };
  }
);

// =============================================
// EQUIPAMENTO DO REPERTÓRIO → FICHA (callable)
//
// Um item da Loja pode carregar equipamento (`personagemItensVinculados`).
// Isso só chegava à ficha DENTRO do assistente de criação: comprado depois,
// o pacote caía no Repertório e parava ali. O jogador via a etiqueta
// "🎒 Equipamentos especiais" e nenhum equipamento aparecia em personagem
// nenhum — pagou e não recebeu.
//
// Irmã de `aplicarExpDoItem`, e o desenho é o mesmo: o jogador escolhe a
// ficha, o SERVIDOR gasta a unidade e materializa. `inventario` é campo
// protegido, e a peça só pode sair de um lado se entrar no outro.
// =============================================
exports.entregarEquipamentoDoItem = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const { itemNome, charId, quantidade } = request.data || {};

    if (!itemNome || typeof itemNome !== "string") {
      throw new HttpsError("invalid-argument", "Diga qual pacote usar.");
    }
    if (!charId || typeof charId !== "string") {
      throw new HttpsError("invalid-argument", "Escolha o personagem.");
    }

    /* O catálogo vem ANTES da transação. Transação do Firestore não deixa ler
       depois de escrever, e este documento é do sistema — ninguém o altera no
       meio de uma compra. */
    const eqSnap = await db.collection("system").doc("data").collection("equipment").get();
    const catalogo = new Map(eqSnap.docs.map((d) => [String(d.id), { ...d.data(), id: d.id }]));

    const userRef = resolveUserRef(uid);
    const charRef = db.collection("char").doc(charId);

    let plano;
    let entregues = [];
    let nomePersonagem = "";

    await db.runTransaction(async (tx) => {
      const [uSnap, cSnap] = await Promise.all([tx.get(userRef), tx.get(charRef)]);
      if (!uSnap.exists) throw new HttpsError("not-found", "Documento de usuário não existe.");
      if (!cSnap.exists) throw new HttpsError("not-found", "Personagem não encontrado.");

      const ficha = cSnap.data();
      // A ficha tem de ser DELE — mesma trava do EXP, pela mesma razão.
      if (ficha.ownerUid !== uid) {
        throw new HttpsError("permission-denied", "Este personagem não é seu.");
      }
      nomePersonagem = (ficha.fields && ficha.fields.nome) || ficha.nome || "seu personagem";

      const data = uSnap.data();
      try {
        plano = planejarEntrega(data, itemNome, quantidade);
      } catch (e) {
        throw new HttpsError(e.codigo || "failed-precondition", e.message);
      }

      /* Equipamento que saiu do catálogo desde a compra não pode derrubar a
         entrega inteira: entrega o que existe e conta o que faltou. Abortar
         deixaria o jogador com um pacote que nunca mais funciona, e sem
         entender por quê. */
      const perdidos = [];
      for (const e of plano.entregas) {
        const base = catalogo.get(String(e.equipId));
        if (!base) { perdidos.push(e.equipId); continue; }

        const itemId = "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        tx.set(db.collection("items").doc(itemId), {
          ...base,
          id: itemId,
          originalEquipId: String(e.equipId),
          characterId: charId,
          ownerUid: uid,
          ownerId: uid,
          quantidade: e.quantidade,
          equipado: false,
          estadoEquip: null,
          slotAnatomico: null,
          maosUsadas: null,
          parentItemId: null,
          origemPacote: itemNome,
          lastModified: new Date().toISOString(),
        });
        entregues.push({ nome: base.nome || String(e.equipId), quantidade: e.quantidade });
      }

      if (entregues.length === 0) {
        throw new HttpsError("failed-precondition",
          `Nenhum equipamento de "${itemNome}" existe mais no catálogo. Fale com o mestre.`);
      }

      const resumo = entregues.map((x) => `${x.quantidade}x ${x.nome}`).join(", ");
      const notifications = data.notifications || [];
      notifications.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "inventory_item_received",
        message: `🎒 ${nomePersonagem} recebeu ${resumo} (${itemNome}).`,
        timestamp: Date.now(),
        isNew: true,
        data: { highlight: "inventory", characterName: nomePersonagem },
      });
      if (notifications.length > 100) notifications.length = 100;

      tx.update(userRef, { inventario: plano.inventario, notifications });

      // Trilha: o pacote foi comprado com dinheiro, então tem de dar para
      // reconstruir o que entrou em qual ficha, e o que se perdeu no caminho.
      tx.set(db.collection("exp_logs").doc(), {
        uid,
        jogador: data.displayName || data.email || email,
        charId,
        personagem: nomePersonagem,
        itemNome,
        tipo: "equipamento",
        entregues,
        perdidos,
        origem: "Repertório do jogador",
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true, entregues, restante: plano.restante, personagem: nomePersonagem };
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

    /* Freio ANTES do reCAPTCHA: o reCAPTCHA custa uma chamada HTTP ao Google
       por tentativa, então quem está martelando não deve nem chegar lá.
       10 por hora é folgado para quem compra de verdade — o carrinho aceita 20
       linhas de uma vez — e apertado para laço. */
    await limitarChamadas(uid, "checkout", 10, 60 * 60 * 1000);
    await exigirEmailVerificado(request);

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
  { secrets: [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET], region: "southamerica-east1" },
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

      /* ASSINATURA. Este endereço é público e sem autenticação: sem conferir a
         assinatura, qualquer um dispara milhares de POSTs e cada um vira uma
         consulta à API do MP — custo, limite da conta e log poluído. Também dá
         para sondar quais IDs de pagamento existem, pela diferença entre o 404
         e o 200.
         Enquanto o secret não estiver configurado, o webhook segue funcionando
         e avisa no log a cada chamada: a integridade não depende dele (o valor
         e o status vêm da reconsulta com o token), mas o abuso, sim. Configure:
           firebase functions:secrets:set MP_WEBHOOK_SECRET
         com a chave de "Assinatura secreta" do painel do Mercado Pago. */
      /* O secret precisa EXISTIR para a function subir (defineSecret), mas o
         valor é credencial do painel do MP — quem digita é o dono da conta.
         Até lá ele guarda este marcador, que aqui vale como ausente. */
      const bruto = MP_WEBHOOK_SECRET.value();
      const segredoWebhook = bruto && bruto !== "NAO-CONFIGURADO" ? bruto : "";
      if (segredoWebhook) {
        const ass = conferirAssinatura({
          xSignature: req.get("x-signature"),
          xRequestId: req.get("x-request-id"),
          dataId: paymentId,
          secret: segredoWebhook,
        });
        if (!ass.ok) {
          console.warn("Webhook MP com assinatura recusada:", ass.motivo);
          res.status(401).send("assinatura inválida");
          return;
        }
      } else {
        console.warn(
          "MP_WEBHOOK_SECRET não configurado — assinatura do webhook NÃO conferida. " +
          "Configure com: firebase functions:secrets:set MP_WEBHOOK_SECRET"
        );
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
      const situacao = classificarPagamento(pay);

      /* ESTORNO E CHARGEBACK. Antes só existia "approved" ou "ainda não pago":
         o dinheiro voltava e o benefício ficava no Repertório — e, se já tinha
         virado EXP numa ficha, ficava lá também.
         A reversão NÃO é automática de propósito: desfazer EXP já gasto é
         decisão de mesa, não de código. O que o servidor faz é marcar a compra,
         deixar a trilha em `real_logs` e chamar o mestre. */
      if (situacao === "estornado") {
        const jaEntregue = pending.status === "CONCLUIDA";
        await pendingRef.update({
          status: "ESTORNADA",
          estornadaEm: FieldValue.serverTimestamp(),
          estornoStatusMP: String(pay.status || ""),
          estornoValorCentavos: Math.round(Number(pay.transaction_amount_refunded || pay.transaction_amount || 0) * 100),
        });
        await db.collection("real_logs").add({
          uid: pending.uid,
          jogador: pending.email || "",
          itemId: "",
          itemNome: "(estorno)",
          valorCentavos: -Math.round(Number(pay.transaction_amount_refunded || pay.transaction_amount || 0) * 100),
          moeda: "BRL",
          compraId: referenceId,
          checkoutId: pending.checkoutId || "",
          orderId: String(paymentId),
          origem: `Estorno no Mercado Pago (${pay.status})`,
          detalhe: jaEntregue
            ? "A compra JÁ tinha sido entregue — os benefícios continuam com o jogador."
            : "A compra ainda não tinha sido entregue; nada a desfazer.",
          criadoEm: FieldValue.serverTimestamp(),
        });
        if (jaEntregue) {
          await avisarMestre(null, {
            tipo: "estorno",
            titulo: `Estorno de ${reais(pending.cobradoCentavos || pending.totalCentavos)} — a compra já tinha sido entregue`,
            mensagem:
              `O pagamento de ${pending.email || pending.uid} voltou (${pay.status}), mas os benefícios ` +
              `já estavam no Repertório dele. O sistema não desfaz sozinho: EXP já aplicado numa ficha ` +
              `não tem como voltar sem decisão sua. Confira em real_logs pela compra ${referenceId}.`,
            jogadorUid: pending.uid,
            jogador: pending.email || "",
            referencia: { colecao: "compras_pendentes", id: referenceId, nome: "Compra estornada" },
            acao: "Decidir o que fazer com os benefícios já entregues",
          });
        }
        res.status(200).send("ok: estorno registrado");
        return;
      }

      if (pending.status === "CONCLUIDA") {
        res.status(200).send("ok: já processada");
        return;
      }

      if (situacao !== "aprovado") {
        await pendingRef.update({ ultimaNotificacao: FieldValue.serverTimestamp() });
        res.status(200).send("ok: ainda não pago");
        return;
      }

      /* VALOR. "approved" não diz aprovado POR QUANTO. Sem esta conferência,
         qualquer pagamento aprovado na conta com este `external_reference`
         entregava a compra inteira, fosse qual fosse o valor pago. */
      const conf = conferirValorPago(pending, pay);
      if (!conf.ok) {
        console.error("Webhook MP: valor divergente", { referenceId, ...conf });
        await pendingRef.update({
          status: "VALOR_DIVERGENTE",
          conferenciaValor: conf,
          ultimaNotificacao: FieldValue.serverTimestamp(),
        });
        await avisarMestre(null, {
          tipo: "valor-divergente",
          titulo: `Pagamento com valor diferente do cobrado (${reais(conf.pago)} de ${reais(conf.esperado)})`,
          mensagem:
            `Uma compra de ${pending.email || pending.uid} foi aprovada no Mercado Pago por um valor ` +
            `que não bate com o que o sistema cobrou. NADA foi entregue. Confira o pagamento ` +
            `${paymentId} no painel do MP antes de liberar à mão.`,
          jogadorUid: pending.uid,
          jogador: pending.email || "",
          referencia: { colecao: "compras_pendentes", id: referenceId, nome: "Valor divergente" },
          acao: "Conferir no painel do Mercado Pago",
        });
        res.status(200).send("ok: valor divergente, nada entregue");
        return;
      }

      // Aplica os benefícios — MESMOS formatos da compra com Frag$
      await entregarCompra(pendingRef, pending, "Mercado Pago", {
        logExtra: {
          checkoutId: pending.checkoutId || "",
          orderId: String(paymentId),
          pagoCentavos: conf.pago,
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
