---
name: roleta-dos-apoiadores
description: "Roleta do Portal — sorteio no servidor, saldo de giros em users.giros e prêmios como itens ocultos da Loja."
metadata: 
  node_type: memory
  type: project
  originSessionId: f168345d-d579-4911-8ed6-0696886be3c1
  modified: 2026-08-26T01:31:44.287Z
---

Desde 25/08/2026 o Portal tem a **Roleta dos Apoiadores**. O sorteio acontece na callable `girarRoleta` e em lugar nenhum mais: ela sorteia com `crypto.randomBytes`, debita o giro e entrega o prêmio na mesma transação, e só então responde. A animação no navegador é encenação do que já aconteceu — nunca mexer nisso de forma que o cliente escolha ou influencie o resultado.

**Onde estão as coisas.** A régua da roda fica em `config/roleta` (o mestre monta na aba Roleta do Painel > Apoio). O saldo de giros é `users/{doc}.giros`, no mesmo regime de `fragmentos`: só o servidor escreve, e o campo está nas DUAS listas de protegidos das rules (update e create). Cada giro vira um doc em `roleta_logs`.

**As chances não somam 100 e isso é de propósito** (hoje somam 100,6). O sorteio normaliza por proporção, então o mestre escreve 5 / 1 / 0,3 e a régua vale como está escrita. Não "consertar" para fechar 100. A régua canônica é a da roda publicada em app-sorteos/QM63KK, com fração nos raríssimos que aquele site não conseguia expressar (Mi'Lunis e Contato Maior 0,5%; Re-rolagens x3 e x6 0,3%).

**Os 37 prêmios são itens da Loja com `isVendaAtiva: false`.** Somem da vitrine pelo filtro que já existia e continuam usando o caminho normal de entrega. É por isso que o mestre monta a roda escolhendo itens do catálogo em vez de digitar prêmio solto.

**`isRoleta` + `roletaGiros` deixaram de ser enfeite:** agora creditam `roletaGiros × quantidade` giros na compra, pelos dois caminhos (Frag$ e carrinho). É isso que faz o prêmio "Re-roleta 1x" devolver o giro sem caso especial — ele é um item de roleta como outro qualquer.

**Peso na produção** (`pesoProducao` no item da Loja, `peso` no apoio gravado): quanto UMA unidade rende na meta. `valorApoio` devolve `montante × peso`, com o montante continuando a ser a quantidade comprada. Ausente vale 1, então nada do que já estava gravado mudou. É o que faz a "Roleta 3x" valer 3 de Lore numa compra só. A regra legada da roleta (tipo `roleta` com montante múltiplo de 3 contando 1 a cada 3) vence o peso quando as duas se aplicam.

Relacionado: [[pagamento-mercado-pago]], [[nunca-hardcodear-regra-de-jogo]], [[economia-de-exp-da-mesa]].
