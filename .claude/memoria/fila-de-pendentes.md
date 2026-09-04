---
name: fila-de-pendentes
description: Backlog acordado com o usuário — o que fazer em seguida e o que ficou decidido adiar.
metadata: 
  node_type: memory
  type: project
  originSessionId: f168345d-d579-4911-8ed6-0696886be3c1
  modified: 2026-09-02T00:00:00.000Z
---

Fila de pendências combinada em 26/08/2026. O usuário mandou jogar o PWA para o
fim e começar pela Re-rolagem — ordem atual:

1. ~~**Narrativo**~~ — **FEITO em 02/09/2026** (`8a2e99d`). Os textos `narrativoBeneficio`/`narrativoQuando` aparecem no card e na ficha; a etiqueta mostra o SALDO de usos; botão "Usar" → callable `usarBeneficioNarrativo`, que numa transação baixa a aplicação, grava `narrativo_logs` e avisa o mestre. O clique é RECIBO, não pedido. Aplicação ausente/zero vale UM uso. Conta em `functions/narrativo-uso.js` (gêmea de navegador em `shared/repertorio-linha.js`).
2. **EXP VIP: regra do limite de sessão** — só anda com a decisão do usuário: qual é a regra da mesa? Sem ela, VIP conta igual ao comum (o flag já é rastreado em `expVip` e nos logs).
3. ~~**Equipamento comprado depois da criação**~~ — **FEITO em 02/09/2026** (`d97b3ab`). Botão "Pôr na ficha" → callable `entregarEquipamentoDoItem`, gêmea de `aplicarExpDoItem`. As DUAS formas de `personagemItensVinculados` valem (id cru e `{itemId, quantidade}`), e equipamento sumido do catálogo não derruba a entrega inteira. `functions/equip-repertorio.js` + teste.
4. ~~**Nomes duplicados**~~ — **FEITO em 02/09/2026** (`d64611f`), e o defeito descrito já não reproduzia: `functions/repertorio.js` fechou o empilhamento perigoso, e o banco tem ZERO itens de catálogo com nome exatamente igual. O que sobrava era humano — "Desejo Narrativo" e "Desejo Narrativo 1x" têm efeito idêntico. Agora o card da Loja acusa "⚠️ Gêmeo no catálogo" quando dois itens têm mesmo nome-base E mesmo efeito (`shared/loja-gemeos.js`). "Roleta 3x/1x" não entra: efeito diferente, produtos legítimos. **Qual dos dois "Desejo Narrativo" fica é decisão de cadastro.**
5. ~~**Fichas apontando para mesa morta**~~ — **FEITO em 02/09/2026** (`1b7b562`). Eram 3 (Belarminio, teste, hahahahah), todas na mesa `TThT6XJyBmY83HXRCEaz`; soltas com `mesaId: null`. A causa raiz já estava corrigida (`confirmDeleteMesa` solta antes de apagar). ⚠️ A coleção das fichas é **`char`** (42 docs), não `characters` (13, outra coisa) — conferir na errada dá "zero órfãs" e parece resolvido.
6. **Arte dos prêmios da roleta** — **17 dos 37 sem imagem**, e os 17 têm prompt pronto em `prompts-premios-roleta.md`. O gerador está escrito e conferido (`functions/__gera-arte-premios-roleta.mjs`, commit `3efa8dd`): lê o prompt-master e o bloco de cada prêmio verbatim, cruza com `loja_itens`, e não sobe nada. **Travado na cota:** a `GEMINI_API_KEY` do ambiente dá 429 com `limit: 0` em TODO modelo de imagem — ausência de cota, não cota gasta; a mesma chave funciona para texto. Precisa de billing no projeto do Google AI, ou a arte sai do app do Gemini como antes. Com cota, `--todos` fecha.
7. ~~**PWA: notificações push no celular**~~ — **FECHADO em 02/09/2026**. Chave VAPID em `shared/push.js` (`7df747d`); o resto em `5311d8a`. `sw.js` trata `push`/`notificationclick` sem o SDK do Messaging; token em `users.fcmTokens` (ARRAY — push é por APARELHO); `avisarPush` é UM gatilho em `users/{uid}`. Teste de ponta a ponta: `functions/__testa-push.mjs <email>`.

✅ **Re-rolagem — FEITA em 26/08/2026** (commit `36d1ab1`): `users.rerolagens` é
creditado na compra (`rerolagensDoItem` em entrega-calc.js, nos dois caminhos de
entrega), protegido nas rules, e gasto pela callable `gastarRerolagem` (log
imutável em `rerolagem_logs`). O botão mora no **Rolador de Dados do Tabuleiro**,
não na ficha: se a janela já rolou algo, re-rola o mesmo dado; se não, só cobra e
anuncia no chat — assim vale para qualquer teste sem acoplar saldo ao motor de
conflito. Saldo aparece como chip ao lado do Frag$ no Portal.

Armadilha de teste de UI que custou uma tarde: há navegador em que o submit de form `method="dialog"` fecha o `<dialog>` **sem disparar o evento `close`**. Nunca esperar decisão de diálogo pelo `close`; usar o padrão do `shared/dialogo.js` (submit com preventDefault + clique no cancelar + `cancel`).

Relacionado: [[avisos-do-mestre]], [[roleta-dos-apoiadores]], [[pagamento-mercado-pago]].
