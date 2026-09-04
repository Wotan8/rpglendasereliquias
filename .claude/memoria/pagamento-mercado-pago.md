---
name: pagamento-mercado-pago
description: A Loja cobra pelo Mercado Pago (PagBank foi removido); o jogador paga a taxa e o meio é escolhido no carrinho.
metadata: 
  node_type: memory
  type: project
  originSessionId: f168345d-d579-4911-8ed6-0696886be3c1
  modified: 2026-08-26T00:00:50.909Z
---

Em 25/08/2026 o PagBank saiu inteiro do projeto e entrou o **Mercado Pago (Checkout Pro)**, com carrinho no Portal. As funções `criarCheckoutPagBank` e `pagbankWebhook` foram apagadas; hoje são `criarCheckoutMercadoPago` e `mercadoPagoWebhook`.

**O jogador paga a taxa do gateway** — decisão do dono, para a mesa receber o valor cheio do item. As taxas vivem em `config/pagamento` no Firestore (`pct` = fração, `fixo` = centavos, `minimoCentavos` = valor abaixo do qual o meio some), não no código: mudou a taxa, edita o documento, sem deploy. O fallback em `functions/taxa-gateway.js` só vale se o documento sumir.

**Por que o meio de pagamento é escolhido no carrinho, e não no Mercado Pago:** cada meio tem taxa diferente (PIX 0,99%, crédito 4,98%, boleto R$ 3,49 fixos) e o Checkout Pro só pergunta o meio na página dele — tarde demais para precificar. Por isso o carrinho mostra os três preços e o checkout é travado no meio escolhido via `excluded_payment_types`; sem essa trava dava para escolher PIX e pagar no cartão. O boleto só aparece a partir de R$ 20, senão os R$ 3,49 encarecem um item de R$ 5,00 em 70%.

A conta é **divisão, não acréscimo**: `total = (item + fixo) / (1 - pct)`. Somar a porcentagem deixaria a mesa alguns centavos curta, porque a taxa incide sobre o valor cobrado. Teste em `functions/taxa-gateway.test.mjs`.

Dois fatos que confundem no teste ao vivo: **pagar com a própria conta Mercado Pago trava o botão de gerar o Pix** (use janela anônima e outro e-mail), e **no Pix não existe retorno automático** ao site — quem entrega é o webhook, então o carrinho é esvaziado ao sair para o MP, não na volta.

Relacionado: [[economia-de-exp-da-mesa]], [[nunca-hardcodear-regra-de-jogo]].
